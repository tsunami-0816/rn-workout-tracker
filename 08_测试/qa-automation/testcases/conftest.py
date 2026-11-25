# -*- coding: utf-8 -*-
"""pytest 共享夹具（qa-automation 四层框架）.

- L1 只做静态/纯函数，不依赖服务
- L2/L3/L4 打真实 8094 服务；不可达整层 skip（CI 只收集，本地全量必跑）
- session 起始清掉「今日」测试产生的 workout/set + 固定测试号，保证可重复跑
  （seed 的 2 用户 / 6 计划 / 72 动作不动）
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List

import httpx
import pytest

QA_DIR = Path(__file__).resolve().parents[1]      # 08_测试/qa-automation
PROJ_DIR = Path(__file__).resolve().parents[3]    # rn-mobile-app-release 根
for _p in (str(QA_DIR),):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from common import db_util  # noqa: E402
from common.assert_util import assert_ok  # noqa: E402
from common.config_util import BASE_URL, ROOT_URL, USER_PHONE, ADMIN_PHONE, DEMO_CODE  # noqa: E402
from common.expect_util import shanghai_today, today_plan_index  # noqa: E402
from common.request_util import ApiClient  # noqa: E402

FIXED_NO_PLAN_PHONE = "13600000999"   # 专用于「新用户无计划」用例；session 起始清理

BASE = BASE_URL
ROOT = ROOT_URL


def login_token(base: str, phone: str, code: str = DEMO_CODE) -> str:
    with httpx.Client(base_url=base, trust_env=False, timeout=10.0) as c:
        resp = c.post("/auth/login", json={"phone": phone, "code": code})
        body = resp.json()
        assert resp.status_code == 200 and body.get("code") == 0, f"登录失败 {phone}：{resp.text[:200]}"
        return body["data"]["token"]


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE


@pytest.fixture(scope="session")
def root_url() -> str:
    return ROOT


@pytest.fixture(scope="session")
def live_api(base_url: str) -> str:
    """服务存活门禁：不可达 skip（CI 无服务 → 只收集，不算 failed）."""
    try:
        resp = httpx.get(f"{base_url}/health", timeout=5.0, trust_env=False)
        resp.raise_for_status()
        body = resp.json()
        assert body["code"] == 0 and body["data"]["db"] == "up"
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"L2+ 需要真实服务 {base_url} 存活（db=up）：{exc}")
    return base_url


@pytest.fixture(scope="session")
def clean_today(live_api: str) -> Dict[str, Any]:
    """session 起始清理：今日 workout/set + 固定无计划测试号（保证用例可重复）."""
    info = db_util.cleanup_today()
    db_util.psql(f"delete from users where phone = '{FIXED_NO_PLAN_PHONE}'")
    print(f"[setup] 清掉今日训练 {info['deleted_workouts']} 条；测试号 {FIXED_NO_PLAN_PHONE} 已重置")
    return info


@pytest.fixture(scope="session")
def anon(base_url: str):
    client = ApiClient(base_url)
    yield client
    client.close()


@pytest.fixture()
def make_client(base_url: str):
    """按 token 造独立 client（避免 header 串场）."""
    created: List[ApiClient] = []

    def factory(token: str | None = None) -> ApiClient:
        c = ApiClient(base_url, token=token)
        created.append(c)
        return c

    yield factory
    for c in created:
        c.close()


@pytest.fixture(scope="session")
def user_token(live_api: str) -> str:
    return login_token(live_api, USER_PHONE)


@pytest.fixture(scope="session")
def admin_token(live_api: str) -> str:
    return login_token(live_api, ADMIN_PHONE)


def _ctx(base: str, token: str) -> Dict[str, Any]:
    """登录后的用户上下文：client/plans/今日推荐计划/动作/今日 workout（start 幂等，可自愈）."""
    client = ApiClient(base, token=token)
    me = assert_ok(client.get("/auth/me"))["data"]
    plans_body = assert_ok(client.get("/plans"))["data"]
    plans = plans_body["list"]
    assert plans, "seed 计划缺失，无法进入训练链路"
    # 与产品口径一致：开练「今日推荐」计划（ISO 星期轮换），避免与推荐日不一致
    plan = plans[today_plan_index(len(plans), shanghai_today())]
    exercises = assert_ok(client.get(f"/plans/{plan['id']}/exercises"))["data"]["list"]
    started = assert_ok(client.post("/workouts/start", json={"planId": plan["id"]}))["data"]
    return {
        "client": client,
        "token": token,
        "me": me,
        "plans": plans,
        "plans_body": plans_body,
        "plan_id": plan["id"],
        "plan_name": plan["name"],
        "exercises": exercises,
        "workout_id": started["workoutId"],
        "log_date": started["logDate"],
    }


@pytest.fixture(scope="session")
def user_ctx(live_api: str, clean_today: Dict[str, Any], user_token: str):
    ctx = _ctx(live_api, user_token)
    yield ctx
    ctx["client"].close()


@pytest.fixture(scope="session")
def admin_ctx(live_api: str, clean_today: Dict[str, Any], admin_token: str):
    ctx = _ctx(live_api, admin_token)
    yield ctx
    ctx["client"].close()


@pytest.fixture(scope="session")
def no_plan_ctx(live_api: str, clean_today: Dict[str, Any]):
    """固定测试号：登录自动建号但无计划（边界用例专用）."""
    token = login_token(live_api, FIXED_NO_PLAN_PHONE)
    client = ApiClient(live_api, token=token)
    yield {"client": client, "token": token, "phone": FIXED_NO_PLAN_PHONE}
    client.close()
