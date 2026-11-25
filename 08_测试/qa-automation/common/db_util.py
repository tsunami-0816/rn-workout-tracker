# -*- coding: utf-8 -*-
"""PG 直查工具（L3 中间件集成层）.

降级说明（框架硬规则允许，必须写明）：
- 标准做法是 Testcontainers 起真实 MySQL/PG；本项目 PG 已作为 `rn-workout-pg` 容器常驻 5434，
  再起一个容器会重复占内存（16GB 本机同时跑 PG + Node + Metro），故 L3 改为
  「L2 打真实 HTTP + docker exec psql 直查真实 PG」，验证事务/唯一约束/缓存失效/数据隔离。
- 查询只接受测试代码内的固定 SQL；外部输入不进 SQL 字符串。
"""
from __future__ import annotations

import subprocess
from typing import Any, Dict, List, Optional

CONTAINER = "rn-workout-pg"
DB_USER = "postgres"
DB_NAME = "rn_workout"


def psql(sql: str) -> str:
    """执行 SQL，返回 -tA（无表头、| 分隔）文本；失败抛 AssertionError 带 stderr."""
    proc = subprocess.run(
        ["docker", "exec", CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME, "-tAc", sql],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if proc.returncode != 0:
        raise AssertionError(f"psql 执行失败：{sql}\nstderr={proc.stderr.strip()[:400]}")
    return proc.stdout.strip()


def scalar(sql: str) -> Optional[str]:
    """单值查询；无行返回 None."""
    out = psql(sql)
    return out if out != "" else None


def rows(sql: str) -> List[List[str]]:
    """多行查询：每行按 | 切分."""
    out = psql(sql)
    if out == "":
        return []
    return [line.split("|") for line in out.splitlines()]


def counts() -> Dict[str, int]:
    """基线计数：users/plans/exercises/workout_logs/set_logs."""
    out = psql(
        "select (select count(*) from users)||','||(select count(*) from plans)||','||"
        "(select count(*) from exercises)||','||(select count(*) from workout_logs)||','||"
        "(select count(*) from set_logs)"
    )
    parts = [int(x) for x in out.split(",")]
    keys = ["users", "plans", "exercises", "workouts", "sets"]
    return dict(zip(keys, parts))


def today_workout_count(user_id: int, log_date: str) -> int:
    """某用户某日 workout 行数（唯一约束断言用）."""
    assert log_date.replace("-", "").isdigit() and len(log_date) == 10, f"日期非法：{log_date}"
    return int(scalar(f"select count(*) from workout_logs where user_id = {int(user_id)} and log_date = '{log_date}'") or 0)


def workout_volume_from_db(workout_id: int) -> float:
    """DB 里的 total_volume（与 API 回显对账用）."""
    return float(scalar(f"select total_volume from workout_logs where id = {int(workout_id)}") or 0)


def set_row_count(workout_id: int, exercise_id: int, set_no: int) -> int:
    """幂等断言：同 (workout, exercise, set_no) 的 DB 行数."""
    return int(
        scalar(
            "select count(*) from set_logs where workout_log_id = "
            f"{int(workout_id)} and exercise_id = {int(exercise_id)} and set_no = {int(set_no)}"
        )
        or 0
    )


def cleanup_today() -> Dict[str, Any]:
    """清理今日测试产生的 workout/set（只清当天，seed 的 2/6/72 不动），保证可重复跑."""
    out = psql(
        "with deleted as (delete from workout_logs "
        "where log_date = (now() at time zone 'Asia/Shanghai')::date returning id) "
        "select count(*) from deleted"
    )
    return {"deleted_workouts": int(out or 0)}


def restart_hint_counts() -> str:
    return psql(
        "select (select count(*) from users)||'/'||(select count(*) from plans)||'/'||"
        "(select count(*) from exercises)||'/'||(select count(*) from workout_logs)||'/'||"
        "(select count(*) from set_logs)"
    )
