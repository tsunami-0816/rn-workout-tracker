# -*- coding: utf-8 -*-
"""认证接口封装（/api/auth/*）."""
from __future__ import annotations

from typing import Any, Mapping

import httpx

from common.request_util import ApiClient


def send_code(c: ApiClient, phone: str) -> httpx.Response:
    return c.post("/auth/send-code", json={"phone": phone})


def login(c: ApiClient, phone: str, code: str) -> httpx.Response:
    return c.post("/auth/login", json={"phone": phone, "code": code})


def me(c: ApiClient) -> httpx.Response:
    return c.get("/auth/me")


def login_raw(c: ApiClient, payload: Mapping[str, Any]) -> httpx.Response:
    """缺字段/类型错等非法 payload 用（不经 DTO 封装）."""
    return c.post("/auth/login", json=dict(payload))
