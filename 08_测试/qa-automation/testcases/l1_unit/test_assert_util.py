# -*- coding: utf-8 -*-
"""L1 断言工具自测（不碰服务，用构造响应包验证断言器本身不假绿）."""
from __future__ import annotations

import httpx
import pytest

from common.assert_util import (
    assert_error,
    assert_masked,
    assert_ok,
    assert_pagination,
    assert_volume,
)


def ok_resp(trace: str = "abcd1234") -> httpx.Response:
    return httpx.Response(
        200,
        json={"code": 0, "message": "ok", "data": {"x": 1}, "traceId": trace},
        headers={"X-Trace-Id": trace},
    )


@pytest.mark.l1_unit
def test_assert_ok_accepts_200_and_201():
    assert_ok(ok_resp())
    resp201 = httpx.Response(
        201,
        json={"code": 0, "message": "ok", "data": None, "traceId": "t201"},
        headers={"X-Trace-Id": "t201"},
    )
    assert_ok(resp201)


@pytest.mark.l1_unit
def test_assert_ok_rejects_nonzero_code():
    bad = httpx.Response(
        200,
        json={"code": 40001, "message": "参数校验失败", "data": None, "traceId": "t1"},
        headers={"X-Trace-Id": "t1"},
    )
    with pytest.raises(AssertionError, match="code=40001"):
        assert_ok(bad)


@pytest.mark.l1_unit
def test_assert_ok_rejects_trace_mismatch():
    bad = httpx.Response(
        200,
        json={"code": 0, "message": "ok", "data": {}, "traceId": "body1"},
        headers={"X-Trace-Id": "head1"},
    )
    with pytest.raises(AssertionError, match="traceId 不一致"):
        assert_ok(bad)


@pytest.mark.l1_unit
def test_assert_error_matches_status_code_and_field():
    err = httpx.Response(
        400,
        json={"code": 40001, "message": "from 必须是 YYYY-MM-DD", "data": {"field": "from"}, "traceId": "t"},
        headers={"X-Trace-Id": "t"},
    )
    assert_error(err, 400, 40001, field="from")


@pytest.mark.l1_unit
def test_assert_error_detects_wrong_code():
    err = httpx.Response(
        400,
        json={"code": 40002, "message": "状态冲突", "data": None, "traceId": "t"},
        headers={"X-Trace-Id": "t"},
    )
    with pytest.raises(AssertionError, match="期望 code=40001"):
        assert_error(err, 400, 40001)


@pytest.mark.l1_unit
def test_assert_masked_flags_full_phone():
    with pytest.raises(AssertionError, match="完整手机号"):
        assert_masked('{"phone":"13900139000"}')
    assert_masked('{"phoneMasked":"139****9000"}')


@pytest.mark.l1_unit
def test_assert_pagination_echo():
    assert_pagination({"list": [], "total": 0, "page": 1, "size": 50}, 1, 50)
    with pytest.raises(AssertionError, match="size 回显"):
        assert_pagination({"list": [], "total": 0, "page": 1, "size": 999}, 1, 50)


@pytest.mark.l1_unit
def test_assert_volume_tolerance():
    assert_volume({"totalVolume": 740}, 740.0)
    with pytest.raises(AssertionError, match="容量应为"):
        assert_volume({"totalVolume": 700}, 740.0)
