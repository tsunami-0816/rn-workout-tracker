# -*- coding: utf-8 -*-
"""L2 Admin 接口（/api/admin/*）：脱敏、日期筛选边界、越权四象限."""
from __future__ import annotations

import pytest

from api import admin_api
from common.assert_util import assert_error, assert_masked, assert_ok
from common.expect_util import clamp_page, clamp_size

pytestmark = [pytest.mark.l2_api, pytest.mark.usefixtures("live_api", "clean_today")]


@pytest.mark.l2_api
@pytest.mark.p0
def test_admin_workouts_masked_and_paged(admin_ctx):
    resp = admin_api.workouts(admin_ctx["client"], 1, 5)
    body = assert_ok(resp)
    data = body["data"]
    assert data["page"] == 1 and data["size"] == 5
    assert data["total"] >= 1, "admin 今日开练后全站记录应 ≥1"
    assert all(set(row) >= {"id", "phoneMasked", "logDate", "totalVolume"} for row in data["list"])
    assert all(row["phoneMasked"].count("*") == 4 for row in data["list"]), "脱敏格式应为 3+4 位掩码"
    assert_masked(resp.text)


@pytest.mark.l2_api
def test_admin_workouts_size_999_clamped(admin_ctx):
    data = assert_ok(admin_api.workouts(admin_ctx["client"], 1, 999))["data"]
    assert data["size"] == clamp_size(999) == 50
    assert len(data["list"]) <= 50


@pytest.mark.l2_api
def test_admin_workouts_page_zero_clamped(admin_ctx):
    data = assert_ok(admin_api.workouts(admin_ctx["client"], 0, 5))["data"]
    assert data["page"] == clamp_page(0) == 1


@pytest.mark.l2_api
@pytest.mark.parametrize("value", ["2026-1-1", "20261101", "2026/11/01", "202611"])
def test_admin_workouts_bad_date_format_returns_40001(admin_ctx, value):
    assert_error(admin_api.workouts(admin_ctx["client"], 1, 5, **{"from": value}), 400, 40001, field="from")


@pytest.mark.l2_api
@pytest.mark.parametrize("value", ["2026-1-1", "abc"])
def test_admin_workouts_bad_to_returns_40001(admin_ctx, value):
    assert_error(admin_api.workouts(admin_ctx["client"], 1, 5, to=value), 400, 40001, field="to")


@pytest.mark.l2_api
def test_admin_workouts_valid_future_range_is_empty(admin_ctx):
    data = assert_ok(admin_api.workouts(admin_ctx["client"], 1, 5, **{"from": "2099-01-01", "to": "2099-12-31"}))["data"]
    assert data["total"] == 0 and data["list"] == [], "未来区间应无记录"


@pytest.mark.l2_api
def test_admin_workouts_from_after_to_returns_empty(admin_ctx):
    data = assert_ok(admin_api.workouts(admin_ctx["client"], 1, 5, **{"from": "2026-11-30", "to": "2026-11-01"}))["data"]
    assert data["total"] == 0, "from>to 应返回空集合（不产生 500）"


@pytest.mark.l2_api
@pytest.mark.parametrize("value", ["2026-13-01", "2026-02-30"])
def test_admin_workouts_impossible_calendar_day_returns_40001(admin_ctx, value):
    """Q-012 回归：形状合法但日历日不存在 → 40001/field=from（修复前为 500）。"""
    assert_error(admin_api.workouts(admin_ctx["client"], 1, 5, **{"from": value}), 400, 40001, field="from")


@pytest.mark.l2_api
def test_admin_users_masked(admin_ctx):
    resp = admin_api.users(admin_ctx["client"], 1, 20)
    body = assert_ok(resp)
    data = body["data"]
    assert data["total"] >= 2, "seed 至少 2 个账号"
    assert {"id", "phoneMasked", "role", "createdAt"} <= set(data["list"][0])
    assert all(u["role"] in {"user", "admin"} for u in data["list"])
    assert_masked(resp.text)


@pytest.mark.l2_api
@pytest.mark.p0
def test_admin_summary_counts(admin_ctx):
    data = assert_ok(admin_api.summary(admin_ctx["client"]))["data"]
    assert data["userCount"] >= 2
    assert data["workoutCount"] >= 1
    assert isinstance(data["totalVolume"], (int, float)) and data["totalVolume"] >= 0


@pytest.mark.l2_api
@pytest.mark.parametrize(
    "call",
    [
        lambda c: admin_api.workouts(c, 1, 5),
        lambda c: admin_api.users(c, 1, 5),
        lambda c: admin_api.summary(c),
    ],
)
def test_admin_endpoints_forbid_normal_user(user_ctx, call):
    assert_error(call(user_ctx["client"]), 403, 40301)


@pytest.mark.l2_api
def test_admin_endpoints_require_token(anon):
    assert_error(admin_api.summary(anon), 401, 40101)
