# -*- coding: utf-8 -*-
"""期望值计算器（L1 自测 + L2/L3 断言复用）.

口径与后端 `src/common/time.ts` / `src/common/*` 对齐：
- 时区 Asia/Shanghai（本机无夏令时，用固定 UTC+8 偏移，避免 Windows 缺 tzdata）
- ISO 周：周一为一周起点
- 容量：只算 done=true 的 weight*reps
- 分页：page 下限 1；size 钳制 [1, 50]
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Iterable, List, Mapping

CST = timezone(timedelta(hours=8))


def mask_phone(phone: str) -> str:
    """13800138000 → 138****8000（与后端 maskPhone 同口径）."""
    if len(phone) != 11:
        return "***"
    return f"{phone[:3]}****{phone[7:]}"


def clamp_page(page: int) -> int:
    return max(1, page)


def clamp_size(size: int) -> int:
    return min(50, max(1, size))


def expected_volume(sets: Iterable[Mapping[str, float | bool]]) -> float:
    """容量期望：只累加 done=true 的 weight*reps."""
    total = 0.0
    for s in sets:
        if s.get("done"):
            total += float(s.get("weight", 0)) * float(s.get("reps", 0))
    return round(total, 2)


def shanghai_today() -> date:
    return datetime.now(CST).date()


def iso_weekday(d: date) -> int:
    """ISO 星期：1=周一 … 7=周日."""
    return d.isoweekday()


def iso_week_start(d: date) -> date:
    """给定日期返回本周一."""
    return d - timedelta(days=d.isoweekday() - 1)


def recent_week_starts(n: int, base: date | None = None) -> List[date]:
    """含本周在内的最近 n 周的周一（升序）."""
    base = base or shanghai_today()
    start = iso_week_start(base)
    return [start - timedelta(days=7 * i) for i in range(n - 1, -1, -1)]


def today_plan_index(plan_count: int, d: date | None = None) -> int:
    """今日推荐计划下标：后端口径 `list[(isoWeekday() - 1) % plans.length]`."""
    assert plan_count > 0, "计划数必须 > 0"
    return (iso_weekday(d or shanghai_today()) - 1) % plan_count
