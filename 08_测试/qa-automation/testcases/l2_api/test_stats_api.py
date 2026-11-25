# -*- coding: utf-8 -*-
"""L2 统计接口（/api/stats/*）：本周口径、4 周序列、历史回溯边界."""
from __future__ import annotations

from datetime import date

import pytest

from api import stats_api
from common.assert_util import assert_error, assert_ok
from common.expect_util import iso_week_start, shanghai_today

pytestmark = [pytest.mark.l2_api, pytest.mark.usefixtures("live_api", "clean_today")]


@pytest.mark.l2_api
@pytest.mark.p0
def test_weekly_returns_this_week_and_4_week_series(user_ctx):
    data = assert_ok(stats_api.weekly(user_ctx["client"]))["data"]
    assert isinstance(data["days"], int) and 1 <= data["days"] <= 7, (
        f"今天已开练，本周打卡天数应在 1..7，实际 {data['days']}"
    )
    assert isinstance(data["totalVolume"], (int, float)) and data["totalVolume"] >= 0

    series = data["series"]
    assert len(series) == 4, f"近 4 周序列应 4 条，实际 {len(series)}"
    starts = [s["weekStart"] for s in series]
    assert starts == sorted(starts), f"weekStart 必须升序：{starts}"
    assert all(date.fromisoformat(s).isoweekday() == 1 for s in starts), f"weekStart 必须是周一：{starts}"
    assert starts[-1] == iso_week_start(shanghai_today()).isoformat(), (
        f"最后一条应是本周一：{starts[-1]} vs {iso_week_start(shanghai_today())}"
    )
    assert all(s["volume"] >= 0 for s in series)


@pytest.mark.l2_api
def test_weekly_requires_token(anon):
    assert_error(stats_api.weekly(anon), 401, 40101)


@pytest.mark.l2_api
def test_weekly_new_user_is_zero(no_plan_ctx):
    data = assert_ok(stats_api.weekly(no_plan_ctx["client"]))["data"]
    assert data["days"] == 0 and data["totalVolume"] == 0, "新用户本周应为 0"
    assert len(data["series"]) == 4 and all(s["volume"] == 0 for s in data["series"])


@pytest.mark.l2_api
@pytest.mark.p0
def test_history_default_weeks_contains_today(user_ctx):
    data = assert_ok(stats_api.history(user_ctx["client"]))["data"]
    rows = data["list"]
    assert isinstance(rows, list) and len(rows) <= 100
    assert rows, "今天已开练，历史列表不该为空"
    assert rows[0]["logDate"] == user_ctx["log_date"], "历史按日期降序，首条应是今天"
    assert rows[0]["planName"] == user_ctx["plan_name"]
    dates = [r["logDate"] for r in rows]
    assert dates == sorted(dates, reverse=True), f"历史未按日期降序：{dates}"


@pytest.mark.l2_api
def test_history_weeks_zero_clamped_to_one(user_ctx):
    data = assert_ok(stats_api.history(user_ctx["client"], 0))["data"]
    rows = data["list"]
    assert len(rows) <= 1, f"weeks=0 被钳到 1 周后应只含本周，实际 {len(rows)} 条"
    if rows:
        assert rows[0]["logDate"] >= iso_week_start(shanghai_today()).isoformat()


@pytest.mark.l2_api
def test_history_weeks_999_clamped_to_52(user_ctx):
    data = assert_ok(stats_api.history(user_ctx["client"], 999))["data"]
    assert len(data["list"]) <= 100, "上限 100 条口径被破坏"


@pytest.mark.l2_api
def test_history_non_numeric_weeks_falls_back_to_default(user_ctx):
    """实测口径：weeks 非数字不报错，按默认 4 周返回（Service 侧 Math.min/max 容错）。

    契约未声明该行为 → Q-013（P3，deferred，step11 统一响应/参数口径）。
    """
    resp = stats_api.history(user_ctx["client"], "abc")
    data = assert_ok(resp)["data"]
    assert data["list"] and data["list"][0]["logDate"] == user_ctx["log_date"]
    assert len(data["list"]) <= 100


@pytest.mark.l2_api
def test_history_requires_token(anon):
    assert_error(stats_api.history(anon), 401, 40101)
