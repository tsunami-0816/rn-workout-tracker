# -*- coding: utf-8 -*-
"""服务信息接口封装（/api/health、/api/app/version、静态 /apk）."""
from __future__ import annotations

import httpx

from common.request_util import ApiClient


def health(c: ApiClient) -> httpx.Response:
    return c.get("/health")


def version(c: ApiClient) -> httpx.Response:
    return c.get("/app/version")


def apk_head(root_url: str, apk_url: str) -> httpx.Response:
    """静态 APK 可达性（HEAD 取 Content-Length，不下载 77MB）."""
    path = apk_url.split("8094", 1)[-1] if "8094" in apk_url else apk_url
    with httpx.Client(base_url=root_url.rstrip("/"), trust_env=False, timeout=15.0) as c:
        return c.head(path)


def unknown(c: ApiClient, path: str = "/not-exist") -> httpx.Response:
    return c.get(path)
