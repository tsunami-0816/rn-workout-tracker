# -*- coding: utf-8 -*-
"""L2 计划接口（/api/plans*）：推荐轮换、动作顺序、归属校验."""
from __future__ import annotations

from datetime import date

import pytest

from api import plan_api
from common.assert_util import assert_error, assert_ok
from common.expect_util import today_plan_index

pytestmark = [pytest.mark.l2_api, pytest.mark.usefixtures("live_api", "clean_today")]

DAY_TYPES = {"推", "拉", "腿"}


@pytest.mark.l2_api
def test_plans_list_matches_baseline_and_today_rotation(user_ctx):
    body = assert_ok(plan_api.list_plans(user_ctx["client"]))
    data = body["data"]
    plans = data["list"]
    assert len(plans) == 3, f"三日分化应 3 张，实际 {len(plans)}"
    assert all(p["dayType"] in DAY_TYPES for p in plans), f"dayType 非法：{[p['dayType'] for p in plans]}"
    assert all(isinstance(p["weekDone"], int) and 0 <= p["weekDone"] <= 7 for p in plans)
    assert all(p["name"] for p in plans)

    expected_today = plans[today_plan_index(len(plans), date.today())]["id"]
    assert data["todayPlanId"] == expected_today, (
        f"今日推荐应按 ISO 星期轮换：期望 {expected_today}，实际 {data['todayPlanId']}"
    )
    assert data["todayWorkoutPlanId"] in {None, user_ctx["plan_id"]}, (
        f"今日已开练计划应为 {user_ctx['plan_id']}，实际 {data['todayWorkoutPlanId']}"
    )


@pytest.mark.l2_api
def test_plans_requires_token(anon):
    assert_error(plan_api.list_plans(anon), 401, 40101)


@pytest.mark.l2_api
def test_plans_current_matches_today_plan(user_ctx):
    body = assert_ok(plan_api.current(user_ctx["client"]))
    data = body["data"]
    assert data["id"] == user_ctx["plans_body"]["todayPlanId"], "current 与 plans.todayPlanId 不一致"
    assert data["exercisesCount"] == 12, f"每份计划应 12 个动作，实际 {data['exercisesCount']}"
    assert data["dayType"] in DAY_TYPES


@pytest.mark.l2_api
def test_plans_current_without_any_plan_returns_404(no_plan_ctx):
    assert_error(plan_api.current(no_plan_ctx["client"]), 404, 40401)


@pytest.mark.l2_api
def test_plan_exercises_ordered_and_templated(user_ctx):
    body = assert_ok(plan_api.exercises(user_ctx["client"], user_ctx["plan_id"]))
    rows = body["data"]["list"]
    assert len(rows) == 12, f"计划动作应 12 条，实际 {len(rows)}"
    assert [r["orderNo"] for r in rows] == list(range(1, 13)), "orderNo 必须 1..12 升序"
    assert all(r["targetSets"] == 4 and r["targetReps"] == 10 for r in rows), "模板 4x10 口径被改"
    assert all(r["name"] for r in rows)


@pytest.mark.l2_api
def test_plan_exercises_of_other_user_returns_404(user_ctx, admin_ctx):
    """普通用户读 admin 的计划 → 404（归属校验，不是 403——不泄露存在性）."""
    body = assert_error(plan_api.exercises(user_ctx["client"], admin_ctx["plan_id"]), 404, 40401)
    assert "计划不存在" in body["message"]


@pytest.mark.l2_api
def test_plan_exercises_non_numeric_id_returns_40001(user_ctx):
    assert_error(plan_api.exercises(user_ctx["client"], "abc"), 400, 40001)


@pytest.mark.l2_api
def test_plan_exercises_unknown_id_returns_404(user_ctx):
    assert_error(plan_api.exercises(user_ctx["client"], 999999), 404, 40401)
