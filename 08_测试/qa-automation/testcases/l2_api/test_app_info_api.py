# -*- coding: utf-8 -*-
"""L2 服务信息（/api/health、/api/app/version、静态 /apk、404 兜底）."""
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from api import app_api
from common.assert_util import assert_error, assert_ok

pytestmark = [pytest.mark.l2_api, pytest.mark.usefixtures("live_api", "clean_today")]

PROJ_DIR = Path(__file__).resolve().parents[4]   # testcases/l2_api → qa-automation → 08_测试 → 项目根


@pytest.mark.l2_api
@pytest.mark.p0
def test_health_reports_db_up(anon):
    data = assert_ok(app_api.health(anon))["data"]
    assert data["status"] == "up"
    assert data["db"] == "up", "数据库探活失败"
    assert data["uptimeSec"] > 0


@pytest.mark.l2_api
@pytest.mark.p0
def test_version_matches_release_json(anon):
    data = assert_ok(app_api.version(anon))["data"]
    release = json.loads((PROJ_DIR / "release.json").read_text(encoding="utf-8"))
    assert data["version"] == release["version"], f"版本接口 {data['version']} 与 release.json {release['version']} 不一致"
    assert data["buildNo"] == release["buildNo"]
    assert "/apk/" in data["apkUrl"], f"apkUrl 应指向静态托管目录：{data['apkUrl']}"
    assert data["notes"], "版本说明不应为空"


@pytest.mark.l2_api
@pytest.mark.p0
def test_apk_static_file_is_reachable(anon, root_url):
    data = assert_ok(app_api.version(anon))["data"]
    resp = app_api.apk_head(root_url, data["apkUrl"])
    if resp.status_code == 404 and os.getenv("CI") == "true":
        pytest.skip("APK 77MB 未纳入仓库，CI 不做静态包断言（本地必跑）")
    assert resp.status_code == 200, f"APK HEAD 应为 200，实际 {resp.status_code}"
    length = int(resp.headers.get("content-length", "0"))
    assert length > 50_000_000, f"APK 体积异常（{length}）"


@pytest.mark.l2_api
def test_unknown_route_returns_404_envelope(anon):
    body = assert_error(app_api.unknown(anon, "/no-such-endpoint"), 404, 40401)
    assert body["traceId"], "404 也应带 traceId"


@pytest.mark.l2_api
def test_api_docs_is_public(anon):
    """Swagger 文档在非生产环境开放（契约自证入口）."""
    resp = anon.get("/docs")
    assert resp.status_code in (200, 302), f"Swagger 文档不可达：{resp.status_code}"
