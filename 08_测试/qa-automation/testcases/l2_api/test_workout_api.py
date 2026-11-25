# -*- coding: utf-8 -*-
"""L2 训练与组次接口：正向 / 反向 / 边界 / 越权，P0 主链路打 p0 标记.

数据自愈：每条写组用例先清掉自己占用的 (exercise, setNo) 槽位，再用相对容量断言，
不依赖其他用例留下的绝对值；今日唯一 workout 由 `start` 幂等复用（产品口径：一天一次训练）。
"""
from __future__ import annotations

import pytest

from api import workout_api
from common.assert_util import assert_error, assert_ok
from common.expect_util import clamp_page, clamp_size, expected_volume

pytestmark = [pytest.mark.l2_api, pytest.mark.usefixtures("live_api", "clean_today")]


def detail_of(client, workout_id) -> dict:
    return assert_ok(workout_api.detail(client, workout_id))["data"]


def volume_of(client, workout_id) -> float:
    return float(detail_of(client, workout_id)["totalVolume"])


def sets_of(client, workout_id) -> list:
    return detail_of(client, workout_id)["sets"]


def reset_slot(client, workout_id, exercise_id: int, set_no: int) -> None:
    """清掉该槽位的历史组（上次失败运行可能留下的），保证写前干净."""
    for s in sets_of(client, workout_id):
        if s["exerciseId"] == exercise_id and s["setNo"] == set_no:
            workout_api.delete_set(client, workout_id, s["id"])


def clean_set(client, workout_id, set_id) -> None:
    try:
        workout_api.delete_set(client, workout_id, set_id)
    except Exception:  # noqa: BLE001
        pass


def ensure_admin_finished(admin_ctx) -> str:
    body = assert_ok(workout_api.finish(admin_ctx["client"], admin_ctx["workout_id"]))
    return body["data"]["finishedAt"]


@pytest.mark.l2_api
@pytest.mark.p0
def test_workout_list_returns_today_record(user_ctx):
    data = assert_ok(workout_api.list_workouts(user_ctx["client"], 1, 20))["data"]
    assert data["total"] >= 1, "开练后列表 total 应 ≥1"
    assert data["page"] == 1 and data["size"] == 20
    today = data["list"][0]
    assert today["id"] == user_ctx["workout_id"], "列表首条应是今日 workout（log_date 降序）"
    assert today["logDate"] == user_ctx["log_date"]
    assert today["finished"] is False, "user 今日训练尚未结束"
    assert isinstance(today["totalVolume"], (int, float))


@pytest.mark.l2_api
def test_workout_list_page_zero_clamped(user_ctx):
    data = assert_ok(workout_api.list_workouts(user_ctx["client"], 0, 20))["data"]
    assert data["page"] == clamp_page(0) == 1
    assert len(data["list"]) >= 1, "page=0 被钳到 1 后仍应返回数据"


@pytest.mark.l2_api
def test_workout_list_size_999_clamped_to_50(user_ctx):
    data = assert_ok(workout_api.list_workouts(user_ctx["client"], 1, 999))["data"]
    assert data["size"] == clamp_size(999) == 50
    assert len(data["list"]) <= 50


@pytest.mark.l2_api
def test_workout_list_size_negative_clamped_to_1(user_ctx):
    data = assert_ok(workout_api.list_workouts(user_ctx["client"], 1, -5))["data"]
    assert data["size"] == 1
    assert len(data["list"]) <= 1


@pytest.mark.l2_api
def test_workout_list_non_numeric_page_falls_back_to_1(user_ctx):
    """实测口径：page 非数字不报错，按 1 处理（Q-013 P3：契约未声明参数解析失败的行为）."""
    data = assert_ok(workout_api.list_workouts(user_ctx["client"], "abc", 20))["data"]
    assert data["page"] == 1


@pytest.mark.l2_api
@pytest.mark.p0
def test_start_is_idempotent_same_plan(user_ctx):
    first = assert_ok(workout_api.start(user_ctx["client"], user_ctx["plan_id"]))["data"]
    second = assert_ok(workout_api.start(user_ctx["client"], user_ctx["plan_id"]))["data"]
    assert first["workoutId"] == user_ctx["workout_id"], "同日同计划应复用同一 workout"
    assert second["workoutId"] == user_ctx["workout_id"]
    assert second["logDate"] == user_ctx["log_date"]


@pytest.mark.l2_api
def test_start_switch_plan_same_day_returns_40002(user_ctx):
    other_plan = next(p for p in user_ctx["plans"] if p["id"] != user_ctx["plan_id"])
    body = assert_error(workout_api.start(user_ctx["client"], other_plan["id"]), 400, 40002, field="planId")
    assert "今天已按" in body["message"], "拒绝文案应可直接展示给用户"
    assert other_plan["name"] in body["message"]


@pytest.mark.l2_api
def test_start_unknown_plan_returns_404(user_ctx):
    assert_error(workout_api.start(user_ctx["client"], 999999), 404, 40401)


@pytest.mark.l2_api
def test_start_other_users_plan_returns_404(user_ctx, admin_ctx):
    assert_error(workout_api.start(user_ctx["client"], admin_ctx["plan_id"]), 404, 40401)


@pytest.mark.l2_api
@pytest.mark.parametrize("payload", [{"planId": 0}, {"planId": -1}, {}])
def test_start_invalid_plan_id_returns_40001(user_ctx, payload):
    assert_error(workout_api.start_raw(user_ctx["client"], payload), 400, 40001)


@pytest.mark.l2_api
@pytest.mark.p0
def test_detail_returns_plan_and_empty_sets(user_ctx):
    data = detail_of(user_ctx["client"], user_ctx["workout_id"])
    assert data["id"] == user_ctx["workout_id"]
    assert data["planId"] == user_ctx["plan_id"]
    assert data["logDate"] == user_ctx["log_date"]
    assert isinstance(data["sets"], list)
    assert data["finished"] is False


@pytest.mark.l2_api
def test_detail_unknown_workout_returns_404(user_ctx):
    assert_error(workout_api.detail(user_ctx["client"], 999999), 404, 40401)


@pytest.mark.l2_api
def test_detail_other_users_workout_returns_404(user_ctx, admin_ctx):
    assert_error(workout_api.detail(user_ctx["client"], admin_ctx["workout_id"]), 404, 40401)


@pytest.mark.l2_api
@pytest.mark.p0
def test_create_set_recalculates_volume(user_ctx):
    client, wid = user_ctx["client"], user_ctx["workout_id"]
    exercise_id = user_ctx["exercises"][0]["id"]
    reset_slot(client, wid, exercise_id, 1)
    before = volume_of(client, wid)
    data = assert_ok(workout_api.create_set(client, wid, exercise_id, 1, 40, 10, True))["data"]
    assert data["setLog"]["exerciseId"] == exercise_id
    assert data["setLog"]["setNo"] == 1
    assert data["setLog"]["weight"] == 40 and data["setLog"]["reps"] == 10
    assert data["setLog"]["done"] is True
    assert data["totalVolume"] == before + expected_volume([{"weight": 40, "reps": 10, "done": True}])
    clean_set(client, wid, data["setLog"]["id"])


@pytest.mark.l2_api
@pytest.mark.p0
def test_create_set_same_group_three_times_keeps_one_row(user_ctx):
    client, wid = user_ctx["client"], user_ctx["workout_id"]
    exercise_id = user_ctx["exercises"][1]["id"]
    reset_slot(client, wid, exercise_id, 2)
    before = volume_of(client, wid)
    set_id = None
    for _ in range(3):
        data = assert_ok(workout_api.create_set(client, wid, exercise_id, 2, 40, 10, True))["data"]
        set_id = data["setLog"]["id"]
        assert data["totalVolume"] == before + 400, "连点同组容量不该叠加"
    rows = [s for s in sets_of(client, wid) if s["exerciseId"] == exercise_id and s["setNo"] == 2]
    assert len(rows) == 1, f"复合唯一键失效，出现 {len(rows)} 行"
    clean_set(client, wid, set_id)


@pytest.mark.l2_api
def test_create_set_exercise_not_in_plan_returns_40001(user_ctx, admin_ctx):
    body = assert_error(
        workout_api.create_set(user_ctx["client"], user_ctx["workout_id"], admin_ctx["exercises"][0]["id"], 1, 40, 10, True),
        400,
        40001,
    )
    assert body["data"]["field"] == "exerciseId"


@pytest.mark.l2_api
@pytest.mark.parametrize("set_no", [0, 11])
def test_create_set_set_no_out_of_range_returns_40001(user_ctx, set_no):
    assert_error(
        workout_api.create_set(user_ctx["client"], user_ctx["workout_id"], user_ctx["exercises"][0]["id"], set_no, 40, 10, True),
        400,
        40001,
        field="setNo",
    )


@pytest.mark.l2_api
@pytest.mark.parametrize("weight", [-1, 10000])
def test_create_set_weight_out_of_range_returns_40001(user_ctx, weight):
    assert_error(
        workout_api.create_set(user_ctx["client"], user_ctx["workout_id"], user_ctx["exercises"][0]["id"], 3, weight, 10, True),
        400,
        40001,
        field="weight",
    )


@pytest.mark.l2_api
def test_create_set_reps_over_50_returns_40001(user_ctx):
    assert_error(
        workout_api.create_set(user_ctx["client"], user_ctx["workout_id"], user_ctx["exercises"][0]["id"], 3, 40, 51, True),
        400,
        40001,
        field="reps",
    )


@pytest.mark.l2_api
def test_create_set_done_must_be_boolean(user_ctx):
    payload = {"exerciseId": user_ctx["exercises"][0]["id"], "setNo": 3, "weight": 40, "reps": 10, "done": "true"}
    assert_error(workout_api.create_set_raw(user_ctx["client"], user_ctx["workout_id"], payload), 400, 40001)


@pytest.mark.l2_api
def test_create_set_undone_does_not_count_volume(user_ctx):
    client, wid = user_ctx["client"], user_ctx["workout_id"]
    exercise_id = user_ctx["exercises"][0]["id"]
    reset_slot(client, wid, exercise_id, 4)
    before = volume_of(client, wid)
    data = assert_ok(workout_api.create_set(client, wid, exercise_id, 4, 40, 10, False))["data"]
    assert data["totalVolume"] == before, "done=false 的组不该计入容量"
    clean_set(client, wid, data["setLog"]["id"])


@pytest.mark.l2_api
def test_patch_set_updates_weight_and_volume(user_ctx):
    client, wid = user_ctx["client"], user_ctx["workout_id"]
    exercise_id = user_ctx["exercises"][2]["id"]
    reset_slot(client, wid, exercise_id, 3)
    before = volume_of(client, wid)
    created = assert_ok(workout_api.create_set(client, wid, exercise_id, 3, 40, 10, True))["data"]
    set_id = created["setLog"]["id"]
    try:
        assert created["totalVolume"] == before + 400
        patched = assert_ok(workout_api.update_set(client, wid, set_id, {"weight": 42.5, "reps": 8}))["data"]
        assert patched["setLog"]["weight"] == 42.5 and patched["setLog"]["reps"] == 8
        assert patched["totalVolume"] == before + 340, "PATCH 后应按 42.5×8 重算"
    finally:
        clean_set(client, wid, set_id)


@pytest.mark.l2_api
def test_patch_set_weight_out_of_range_returns_40001(user_ctx):
    client, wid = user_ctx["client"], user_ctx["workout_id"]
    exercise_id = user_ctx["exercises"][2]["id"]
    reset_slot(client, wid, exercise_id, 4)
    created = assert_ok(workout_api.create_set(client, wid, exercise_id, 4, 40, 10, True))["data"]
    set_id = created["setLog"]["id"]
    try:
        assert_error(workout_api.update_set(client, wid, set_id, {"weight": 10000}), 400, 40001, field="weight")
    finally:
        clean_set(client, wid, set_id)


@pytest.mark.l2_api
def test_patch_unknown_set_returns_404(user_ctx):
    assert_error(workout_api.update_set(user_ctx["client"], user_ctx["workout_id"], 999999, {"weight": 30}), 404, 40401)


@pytest.mark.l2_api
def test_delete_set_drops_volume(user_ctx):
    client, wid = user_ctx["client"], user_ctx["workout_id"]
    exercise_id = user_ctx["exercises"][3]["id"]
    reset_slot(client, wid, exercise_id, 5)
    before = volume_of(client, wid)
    created = assert_ok(workout_api.create_set(client, wid, exercise_id, 5, 30, 10, True))["data"]
    set_id = created["setLog"]["id"]
    assert created["totalVolume"] == before + 300
    body = assert_ok(workout_api.delete_set(client, wid, set_id))
    assert body["data"]["totalVolume"] == before, "删除组后容量应回落"
    assert [s for s in sets_of(client, wid) if s["id"] == set_id] == []


@pytest.mark.l2_api
def test_delete_set_twice_returns_404(user_ctx):
    client, wid = user_ctx["client"], user_ctx["workout_id"]
    exercise_id = user_ctx["exercises"][3]["id"]
    reset_slot(client, wid, exercise_id, 6)
    created = assert_ok(workout_api.create_set(client, wid, exercise_id, 6, 30, 10, True))["data"]
    set_id = created["setLog"]["id"]
    assert_ok(workout_api.delete_set(client, wid, set_id))
    assert_error(workout_api.delete_set(client, wid, set_id), 404, 40401)


@pytest.mark.l2_api
@pytest.mark.p0
def test_finish_returns_timestamp(admin_ctx):
    before = volume_of(admin_ctx["client"], admin_ctx["workout_id"])
    data = assert_ok(workout_api.finish(admin_ctx["client"], admin_ctx["workout_id"]))["data"]
    assert data["finishedAt"], "finish 应返回完成时间"
    assert data["totalVolume"] == before
    assert detail_of(admin_ctx["client"], admin_ctx["workout_id"])["finished"] is True


@pytest.mark.l2_api
def test_finish_is_idempotent(admin_ctx):
    first = ensure_admin_finished(admin_ctx)
    second = assert_ok(workout_api.finish(admin_ctx["client"], admin_ctx["workout_id"]))["data"]["finishedAt"]
    assert first == second, "重复 finish 应返回原完成时间，不得刷新"


@pytest.mark.l2_api
def test_finish_unknown_workout_returns_404(user_ctx):
    assert_error(workout_api.finish(user_ctx["client"], 999999), 404, 40401)


@pytest.mark.l2_api
def test_write_after_finish_returns_40002(admin_ctx):
    ensure_admin_finished(admin_ctx)
    payload = {
        "exerciseId": admin_ctx["exercises"][0]["id"],
        "setNo": 7,
        "weight": 20,
        "reps": 10,
        "done": True,
    }
    body = assert_error(workout_api.create_set_raw(admin_ctx["client"], admin_ctx["workout_id"], payload), 400, 40002)
    assert "已结束" in body["message"]


@pytest.mark.l2_api
def test_delete_after_finish_returns_40002(admin_ctx):
    ensure_admin_finished(admin_ctx)
    sets = sets_of(admin_ctx["client"], admin_ctx["workout_id"])
    if not sets:
        pytest.skip("admin 今日无组次可删（已结束态写入 40002 已由 createSet 用例覆盖）")
    assert_error(workout_api.delete_set(admin_ctx["client"], admin_ctx["workout_id"], sets[0]["id"]), 400, 40002)
