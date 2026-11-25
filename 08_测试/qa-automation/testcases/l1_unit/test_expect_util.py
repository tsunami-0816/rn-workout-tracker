# -*- coding: utf-8 -*-
"""L1 期望值计算器自测（不碰服务）.

口径与后端 time.ts / 分页 clamp / 容量重算一致；L2/L3 断言复用同一批函数。
"""
from __future__ import annotations

from datetime import date

import pytest

from common.expect_util import (
    clamp_page,
    clamp_size,
    expected_volume,
    iso_week_start,
    iso_weekday,
    mask_phone,
    recent_week_starts,
    today_plan_index,
)


@pytest.mark.l1_unit
def test_mask_phone_keeps_first3_last4():
    assert mask_phone("13800138000") == "138****8000"
    assert mask_phone("13900139000") == "139****9000"


@pytest.mark.l1_unit
def test_mask_phone_non_11_digits_returns_stars():
    assert mask_phone("123") == "***"
    assert mask_phone("") == "***"


@pytest.mark.l1_unit
@pytest.mark.parametrize("raw,expected", [(0, 1), (1, 1), (7, 7)])
def test_clamp_page_lower_bound(raw, expected):
    assert clamp_page(raw) == expected


@pytest.mark.l1_unit
@pytest.mark.parametrize("raw,expected", [(0, 1), (1, 1), (20, 20), (50, 50), (999, 50), (-5, 1)])
def test_clamp_size_range_1_to_50(raw, expected):
    assert clamp_size(raw) == expected


@pytest.mark.l1_unit
def test_expected_volume_only_counts_done_sets():
    sets = [
        {"weight": 40, "reps": 10, "done": True},
        {"weight": 42.5, "reps": 8, "done": True},
        {"weight": 100, "reps": 5, "done": False},
    ]
    assert expected_volume(sets) == 740.0


@pytest.mark.l1_unit
def test_expected_volume_empty_is_zero():
    assert expected_volume([]) == 0.0


@pytest.mark.l1_unit
def test_iso_week_helpers_use_monday_as_start():
    wed = date(2026, 11, 25)
    assert iso_weekday(wed) == 3
    assert iso_week_start(wed) == date(2026, 11, 23)   # 周一
    sun = date(2026, 11, 29)
    assert iso_weekday(sun) == 7
    assert iso_week_start(sun) == date(2026, 11, 23)


@pytest.mark.l1_unit
def test_recent_week_starts_returns_4_ascending_mondays():
    base = date(2026, 11, 25)
    starts = recent_week_starts(4, base)
    assert len(starts) == 4
    assert starts[-1] == date(2026, 11, 23)
    assert all(s.isoweekday() == 1 for s in starts)
    assert all(a < b for a, b in zip(starts, starts[1:]))


@pytest.mark.l1_unit
def test_today_plan_index_rotates_by_iso_weekday():
    # 周三（iso=3）→ (3-1)%3 = 2；周一 → 0；周日 → (7-1)%3=0
    assert today_plan_index(3, date(2026, 11, 25)) == 2
    assert today_plan_index(3, date(2026, 11, 23)) == 0
    assert today_plan_index(3, date(2026, 11, 29)) == 0
    assert today_plan_index(1, date(2026, 11, 25)) == 0
