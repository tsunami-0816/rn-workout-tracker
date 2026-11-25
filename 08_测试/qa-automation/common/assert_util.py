# -*- coding: utf-8 -*-
"""统一断言封装.

- assert_ok：HTTP in (200,201) + code==0 + 响应包四字段齐全（框架硬规则 10）
- assert_error：业务错误码 + HTTP 状态 + 可选 data.field（40001 字段红字口径）
- assert_masked：脱敏断言（响应全文不得出现 11 位手机号）
- assert_volume：容量口径（只算 done=true 的 weight*reps）
"""
from __future__ import annotations

import re
from typing import Any, Dict, Optional

import httpx

PHONE_FULL = re.compile(r"1[3-9]\d{9}")


def _body(resp: httpx.Response) -> Dict[str, Any]:
    try:
        body = resp.json()
    except Exception:  # noqa: BLE001
        raise AssertionError(f"响应不是 JSON：{resp.text[:200]}") from None
    assert isinstance(body, dict), f"响应包不是对象：{body}"
    return body


def assert_ok(resp: httpx.Response) -> Dict[str, Any]:
    """成功响应包断言，返回 body 供业务字段继续断言."""
    assert resp.status_code in (200, 201), f"HTTP {resp.status_code} 不在 (200,201)：{resp.text[:200]}"
    body = _body(resp)
    assert body.get("code") == 0, f"业务码 code={body.get('code')} message={body.get('message')}"
    assert body.get("message") == "ok", f"成功响应 message 应为 ok，实际 {body.get('message')}"
    assert "data" in body, "响应包缺 data 字段"
    assert isinstance(body.get("traceId"), str) and body["traceId"], "响应包 traceId 缺失"
    header_trace = resp.headers.get("x-trace-id")
    assert header_trace, "响应头缺 X-Trace-Id"
    assert header_trace == body["traceId"], f"traceId 不一致：header={header_trace} body={body['traceId']}"
    return body


def assert_error(resp: httpx.Response, http_status: int, code: int, field: Optional[str] = None) -> Dict[str, Any]:
    """业务错误断言：HTTP 状态 + 五位业务码 + 可选 data.field."""
    assert resp.status_code == http_status, f"期望 HTTP {http_status}，实际 {resp.status_code}：{resp.text[:200]}"
    body = _body(resp)
    assert body.get("code") == code, f"期望 code={code}，实际 {body.get('code')} message={body.get('message')}"
    assert body.get("data") is None or isinstance(body.get("data"), dict), "错误响应 data 应为 null 或对象"
    if field is not None:
        data = body.get("data") or {}
        assert data.get("field") == field, f"期望 data.field={field}，实际 {data}"
    return body


def assert_masked(text: str) -> None:
    """脱敏断言：响应全文不得出现完整 11 位手机号."""
    hits = PHONE_FULL.findall(text)
    assert not hits, f"响应含完整手机号（应脱敏）：{hits}"


def assert_pagination(data: Dict[str, Any], page: int, size: int) -> None:
    """分页回显口径：page/size 按服务端钳制后的值回显."""
    assert data.get("page") == page, f"page 回显应为 {page}，实际 {data.get('page')}"
    assert data.get("size") == size, f"size 回显应为 {size}，实际 {data.get('size')}"
    assert isinstance(data.get("total"), int) and data["total"] >= 0, f"total 非法：{data.get('total')}"
    assert isinstance(data.get("list"), list), "list 必须是数组"


def assert_volume(body_data: Dict[str, Any], expected: float) -> None:
    """容量口径断言：totalVolume == 期望（只算 done=true 的组）."""
    actual = body_data.get("totalVolume")
    assert actual is not None, "响应缺 totalVolume"
    assert abs(float(actual) - float(expected)) < 1e-6, f"容量应为 {expected}，实际 {actual}"
