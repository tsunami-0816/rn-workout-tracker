# -*- coding: utf-8 -*-
"""HTTP 请求封装（框架硬规则 9：构造即挂 token）.

- trust_env=False：忽略系统代理（回环地址走代理会 404）
- 每次请求打一行日志（方法/路径/状态/耗时/traceId），供 Allure/终端排查
- 统一响应包：{code, message, data, traceId}
"""
from __future__ import annotations

import time
from typing import Any, Dict, Mapping, Optional

import httpx


class ApiClient:
    """薄封装 HTTP 客户端：自动带 token、打请求日志。"""

    def __init__(self, base_url: str, token: Optional[str] = None, timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.session = httpx.Client(base_url=self.base_url, trust_env=False, timeout=timeout)
        self.session.headers["Content-Type"] = "application/json"
        self.token = token
        # 框架硬规则 9：构造即挂 header，不能只存实例属性
        if token:
            self.session.headers["Authorization"] = f"Bearer {token}"

    def request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        t0 = time.perf_counter()
        resp = self.session.request(method, path, **kwargs)
        ms = (time.perf_counter() - t0) * 1000
        trace_id = resp.headers.get("x-trace-id", "")
        print(f"[api] {method:<6} {path:<42} -> {resp.status_code} ({ms:.1f}ms) trace={trace_id}")
        return resp

    def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> httpx.Response:
        return self.request("GET", path, params=params)

    def post(self, path: str, json: Optional[Mapping[str, Any]] = None) -> httpx.Response:
        return self.request("POST", path, json=json)

    def patch(self, path: str, json: Optional[Mapping[str, Any]] = None) -> httpx.Response:
        return self.request("PATCH", path, json=json)

    def delete(self, path: str) -> httpx.Response:
        return self.request("DELETE", path)

    def close(self) -> None:
        self.session.close()


def json_of(resp: httpx.Response) -> Dict[str, Any]:
    """安全取 JSON（非 JSON 响应返回空 dict，交由断言报错）。"""
    try:
        data = resp.json()
    except Exception:  # noqa: BLE001
        return {}
    return data if isinstance(data, dict) else {}
