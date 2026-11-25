# -*- coding: utf-8 -*-
"""L3 中间件集成（真实 PG 直查）：并发唯一约束、幂等行数、事务重算、缓存失效、数据隔离.

降级说明：Testcontainers 需再起 PG 容器，本机已常驻 rn-workout-pg（16GB 内存同时跑 PG+Node+Metro），
故按 step08 硬规则 8 的允许路径降级为「L2 打真实 HTTP + docker exec psql 直查」。
"""
from __future__ import annotations

import threading
from datetime import timedelta

import pytest

from api import stats_api, workout_api
from common import db_util
from common.assert_util import assert_ok
from common.config_util import BASE_URL
from common.expect_util import iso_weekday, shanghai_today
from common.request_util import ApiClient

pytestmark = [pytest.mark.l3_integration, pytest.mark.usefixtures("live_api", "clean_today")]


def detail(client, wid) -> dict:
    return assert_ok(workout_api.detail(client, wid))["data"]


def reset_slot(client, wid, exercise_id: int, set_no: int) -> None:
    for s in detail(client, wid)["sets"]:
        if s["exerciseId"] == exercise_id and s["setNo"] == set_no:
            workout_api.delete_set(client, wid, s["id"])


@pytest.mark.l3_integration
@pytest.mark.p0
def test_concurrent_start_hits_unique_index_and_returns_same_id(user_ctx):
    results: list[int] = []
    errors: list[str] = []
    lock = threading.Lock()

    def worker() -> None:
        c = ApiClient(BASE_URL, token=user_ctx["token"])
        try:
            resp = c.post("/workouts/start", json={"planId": user_ctx["plan_id"]})
            body = resp.json()
            with lock:
                if resp.status_code == 200 and body.get("code") == 0:
                    results.append(body["data"]["workoutId"])
                else:
                    errors.append(f"{resp.status_code}/{body.get('code')}")
        finally:
            c.close()

    threads = [threading.Thread(target=worker) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=15)

    assert not errors, f"并发 start 出现异常响应：{errors}"
    assert set(results) == {user_ctx["workout_id"]}, f"并发 start 应全部返回同一 workout：{results}"
    assert db_util.today_workout_count(user_ctx["me"]["id"], user_ctx["log_date"]) == 1, "唯一索引失效：今日出现多行"


@pytest.mark.l3_integration
@pytest.mark.p0
def test_upsert_idempotency_keeps_one_db_row(user_ctx):
    client, wid = user_ctx["client"], user_ctx["workout_id"]
    exercise_id = user_ctx["exercises"][4]["id"]
    reset_slot(client, wid, exercise_id, 9)
    before = float(detail(client, wid)["totalVolume"])
    for _ in range(3):
        assert_ok(workout_api.create_set(client, wid, exercise_id, 9, 25, 12, True))
    assert db_util.set_row_count(wid, exercise_id, 9) == 1, "DB 里同组出现多行"
    assert db_util.workout_volume_from_db(wid) == before + 300, "DB total_volume 应只加一次 300"
    # 清理自己造的组
    for s in detail(client, wid)["sets"]:
        if s["exerciseId"] == exercise_id and s["setNo"] == 9:
            workout_api.delete_set(client, wid, s["id"])


@pytest.mark.l3_integration
def test_transaction_recalc_matches_api_and_db(user_ctx):
    client, wid = user_ctx["client"], user_ctx["workout_id"]
    e1 = user_ctx["exercises"][6]["id"]
    e2 = user_ctx["exercises"][7]["id"]
    reset_slot(client, wid, e1, 1)
    reset_slot(client, wid, e2, 1)
    before = float(detail(client, wid)["totalVolume"])

    assert_ok(workout_api.create_set(client, wid, e1, 1, 50, 5, True))       # 250
    second = assert_ok(workout_api.create_set(client, wid, e2, 1, 20, 10, True))["data"]  # 200
    expected = before + 450

    assert second["totalVolume"] == expected, "API 回显容量不等于事务重算值"
    assert db_util.workout_volume_from_db(wid) == expected, "DB total_volume 与 API 不一致"

    for s in detail(client, wid)["sets"]:
        if (s["exerciseId"], s["setNo"]) in {(e1, 1), (e2, 1)}:
            workout_api.delete_set(client, wid, s["id"])
    assert db_util.workout_volume_from_db(wid) == before, "删完组后 DB 容量应回落"


@pytest.mark.l3_integration
def test_create_set_invalidates_weekly_cache(user_ctx):
    client, wid = user_ctx["client"], user_ctx["workout_id"]
    exercise_id = user_ctx["exercises"][8]["id"]
    reset_slot(client, wid, exercise_id, 2)

    before = float(assert_ok(stats_api.weekly(client))["data"]["totalVolume"])
    created = assert_ok(workout_api.create_set(client, wid, exercise_id, 2, 40, 10, True))["data"]
    after = float(assert_ok(stats_api.weekly(client))["data"]["totalVolume"])
    assert after == before + 400, f"写组后统计缓存未失效：{before} → {after}"

    workout_api.delete_set(client, wid, created["setLog"]["id"])
    rolled = float(assert_ok(stats_api.weekly(client))["data"]["totalVolume"])
    assert rolled == before, f"删组后统计缓存未失效：{rolled}"


@pytest.mark.l3_integration
def test_done_flag_drives_db_volume(user_ctx):
    client, wid = user_ctx["client"], user_ctx["workout_id"]
    exercise_id = user_ctx["exercises"][9]["id"]
    reset_slot(client, wid, exercise_id, 3)
    before = db_util.workout_volume_from_db(wid)

    created = assert_ok(workout_api.create_set(client, wid, exercise_id, 3, 60, 10, False))["data"]
    assert db_util.workout_volume_from_db(wid) == before, "done=false 不该进入 DB 容量"
    set_id = created["setLog"]["id"]

    assert_ok(workout_api.update_set(client, wid, set_id, {"done": True}))
    assert db_util.workout_volume_from_db(wid) == before + 600, "done=true 后 DB 容量应 +600"

    assert_ok(workout_api.delete_set(client, wid, set_id))
    assert db_util.workout_volume_from_db(wid) == before


@pytest.mark.l3_integration
@pytest.mark.p0
def test_weekly_scope_is_this_week_not_rolling_7d(user_ctx):
    """Q-001 回归：weekly 的 days/totalVolume 必须是「本周一至今」，不是滚动近 7 天.

    手法：直插一条上周五（5 天前，落在滚动 7 天窗口内）的训练记录；
    本周口径应完全忽略它，滚动口径会把 days/volume 算进来。断言同时与 DB 的本周范围对账。
    """
    client, wid = user_ctx["client"], user_ctx["workout_id"]
    uid, pid = int(user_ctx["me"]["id"]), int(user_ctx["plan_id"])
    today = shanghai_today()
    last_friday = today - timedelta(days=iso_weekday(today) + 2)   # 周三(3)+2=5 天前
    assert iso_weekday(last_friday) == 5, f"构造日期不是周五：{last_friday}"

    db_util.psql(f"delete from workout_logs where user_id = {uid} and log_date = '{last_friday}'")
    db_util.psql(
        "insert into workout_logs (user_id, plan_id, log_date, total_volume, finished_at, created_at) "
        f"values ({uid}, {pid}, '{last_friday}', 100, now(), now())"
    )
    try:
        # 强制让统计缓存失效：写一组再删（写路径会 invalidateByPrefix）
        ex = user_ctx["exercises"][0]["id"]
        reset_slot(client, wid, ex, 10)
        created = assert_ok(workout_api.create_set(client, wid, ex, 10, 20, 10, True))["data"]
        workout_api.delete_set(client, wid, created["setLog"]["id"])

        weekly = assert_ok(stats_api.weekly(client))["data"]
        db_week = db_util.psql(
            "select coalesce(sum(total_volume),0)||','||count(distinct log_date) "
            "from workout_logs where user_id = " + str(uid) +
            " and log_date >= date_trunc('week', (now() at time zone 'Asia/Shanghai')::date)::date"
            " and log_date <= (now() at time zone 'Asia/Shanghai')::date"
        ).split(",")
        db_volume, db_days = float(db_week[0]), int(db_week[1])

        assert weekly["days"] == db_days == 1, (
            f"本周打卡天数应为 1（只算本周一至今，不含上周五），实际 API={weekly['days']} DB={db_days}"
        )
        assert weekly["totalVolume"] == db_volume, (
            f"本周容量应为 DB 本周和 {db_volume}，实际 API={weekly['totalVolume']}（若为 100+ 说明按滚动 7 天算）"
        )
        assert weekly["totalVolume"] < 100, "上周五的 100 不应计入本周容量"
        # 4 周序列里上周那一条应包含这 100（本周指标与 4 周序列是两套口径）
        last_week = weekly["series"][-2]
        assert float(last_week["volume"]) == 100, f"4 周序列上周应含 100，实际 {last_week}"
    finally:
        db_util.psql(f"delete from workout_logs where user_id = {uid} and log_date = '{last_friday}'")
        reset_slot(client, wid, user_ctx["exercises"][0]["id"], 10)


@pytest.mark.l3_integration
@pytest.mark.p0
def test_workout_ownership_isolated_in_db(user_ctx, admin_ctx):
    """JWT sub 决定归属：user 的 workout 在 DB 里只对应自己的 user_id；跨用户读取 404."""
    rows = db_util.rows(f"select user_id, plan_id from workout_logs where id = {int(user_ctx['workout_id'])}")
    assert len(rows) == 1, "今日 workout 不存在"
    assert int(rows[0][0]) == int(user_ctx["me"]["id"]), "workout 归属不是当前用户"
    assert int(rows[0][1]) == int(user_ctx["plan_id"])

    from common.assert_util import assert_error

    assert_error(workout_api.detail(admin_ctx["client"], user_ctx["workout_id"]), 404, 40401)
