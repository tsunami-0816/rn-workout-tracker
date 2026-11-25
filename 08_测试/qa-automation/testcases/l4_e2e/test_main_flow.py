# -*- coding: utf-8 -*-
"""L4 端到端主链路（P0）：登录 → 计划 → 开练 → 组次 → 统计 → 结束 → admin 可见."""
from __future__ import annotations

import pytest

from api import admin_api, auth_api, plan_api, stats_api, workout_api
from common.assert_util import assert_error, assert_ok
from common.config_util import BASE_URL, DEMO_CODE, USER_PHONE
from common.expect_util import mask_phone
from common.request_util import ApiClient

pytestmark = [pytest.mark.l4_e2e, pytest.mark.usefixtures("live_api", "clean_today")]


def reset_slot(client, wid, exercise_id: int, set_no: int) -> None:
    for s in assert_ok(workout_api.detail(client, wid))["data"]["sets"]:
        if s["exerciseId"] == exercise_id and s["setNo"] == set_no:
            workout_api.delete_set(client, wid, s["id"])


@pytest.mark.l4_e2e
@pytest.mark.p0
def test_full_chain_login_to_admin_visibility(user_ctx, admin_ctx):
    # 1. 独立登录（端到端不复用 fixture 的 client，验证登录链路本身）
    c = ApiClient(BASE_URL)
    try:
        login = assert_ok(auth_api.login(c, USER_PHONE, DEMO_CODE))["data"]
        assert len(login["token"]) > 20
    finally:
        c.close()
    fresh = ApiClient(BASE_URL, token=login["token"])
    try:
        me_fresh = assert_ok(auth_api.me(fresh))["data"]
    finally:
        fresh.close()
    assert me_fresh["phoneMasked"] == mask_phone(USER_PHONE)

    # 2. 计划 → 今日推荐 → 动作清单
    plans = assert_ok(plan_api.list_plans(user_ctx["client"]))["data"]
    current = assert_ok(plan_api.current(user_ctx["client"]))["data"]
    assert current["id"] == plans["todayPlanId"]
    exercises = assert_ok(plan_api.exercises(user_ctx["client"], current["id"]))["data"]["list"]
    assert len(exercises) == 12

    # 3. 开练（幂等）
    started = assert_ok(workout_api.start(user_ctx["client"], current["id"]))["data"]
    assert started["workoutId"] == user_ctx["workout_id"]
    wid = started["workoutId"]

    # 4. 写两组（都 done），容量按 只算 done 的口径
    client = user_ctx["client"]
    e1, e2 = exercises[10]["id"], exercises[11]["id"]
    reset_slot(client, wid, e1, 1)
    reset_slot(client, wid, e2, 1)
    before = float(assert_ok(stats_api.weekly(client))["data"]["totalVolume"])
    s1 = assert_ok(workout_api.create_set(client, wid, e1, 1, 40, 10, True))["data"]
    s2 = assert_ok(workout_api.create_set(client, wid, e2, 1, 30, 10, True))["data"]
    assert s1["totalVolume"] == before + 400
    assert s2["totalVolume"] == before + 700, f"两组容量应为 +700，实际 {s2['totalVolume'] - before}"

    weekly = assert_ok(stats_api.weekly(client))["data"]
    assert weekly["days"] == 1, f"今日打卡天数应为 1，实际 {weekly['days']}"
    assert weekly["totalVolume"] == before + 700, "统计容量与组次写入不一致"

    # 5. 结束训练（幂等）→ 统计/历史可见
    finished = assert_ok(workout_api.finish(client, wid))["data"]
    assert finished["finishedAt"]
    again = assert_ok(workout_api.finish(client, wid))["data"]
    assert again["finishedAt"] == finished["finishedAt"]
    history = assert_ok(stats_api.history(client))["data"]["list"]
    assert history and history[0]["logDate"] == user_ctx["log_date"]
    assert float(history[0]["totalVolume"]) == before + 700

    # 6. admin 端可见且脱敏
    summary = assert_ok(admin_api.summary(admin_ctx["client"]))["data"]
    assert summary["workoutCount"] >= 1
    admin_rows = admin_api.workouts(admin_ctx["client"], 1, 10)
    body = assert_ok(admin_rows)
    assert any(row["logDate"] == user_ctx["log_date"] for row in body["data"]["list"]), "admin 全站列表看不到今日记录"
    assert "13900139000" not in admin_rows.text, "admin 列表泄露完整手机号"


@pytest.mark.l4_e2e
@pytest.mark.p0
def test_finish_locks_writes_end_to_end(user_ctx):
    wid = user_ctx["workout_id"]
    assert_ok(workout_api.finish(user_ctx["client"], wid))
    payload = {
        "exerciseId": user_ctx["exercises"][0]["id"],
        "setNo": 10,
        "weight": 10,
        "reps": 10,
        "done": True,
    }
    body = assert_error(workout_api.create_set_raw(user_ctx["client"], wid, payload), 400, 40002)
    assert "已结束" in body["message"]


@pytest.mark.l4_e2e
def test_relogin_keeps_identity(user_ctx, base_url):
    """重新登录拿新 token：me 的 id/role 与旧 token 一致（JWT 7 天且身份不漂移）."""
    c = ApiClient(base_url)
    try:
        token = assert_ok(auth_api.login(c, USER_PHONE, DEMO_CODE))["data"]["token"]
    finally:
        c.close()
    other = ApiClient(base_url, token=token)
    try:
        me_new = assert_ok(auth_api.me(other))["data"]
    finally:
        other.close()
    assert me_new["id"] == user_ctx["me"]["id"]
    assert me_new["role"] == user_ctx["me"]["role"]


@pytest.mark.l4_e2e
def test_new_user_without_plan_cannot_start(no_plan_ctx, user_ctx):
    plans = assert_ok(plan_api.list_plans(no_plan_ctx["client"]))["data"]
    assert plans["list"] == [] and plans["todayPlanId"] is None, "新用户不该有计划"
    assert_error(plan_api.current(no_plan_ctx["client"]), 404, 40401)
    body = assert_error(workout_api.start(no_plan_ctx["client"], user_ctx["plan_id"]), 404, 40401)
    assert "计划不存在" in body["message"], "不能借用他人计划开练"
