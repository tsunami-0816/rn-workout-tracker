# -*- coding: utf-8 -*-
"""Admin 只读接口封装（/api/admin/*）."""
from __future__ import annotations

from typing import Any

import httpx

from common.request_util import ApiClient


def workouts(c: ApiClient, page: int | str = 1, size: int | str = 20, **extra: Any) -> httpx.Response:
    params: dict[str, Any] = {"page": page, "size": size}
    params.update({k: v for k, v in extra.items() if v is not None})
    return c.get("/admin/workouts", params=params)


def users(c: ApiClient, page: int | str = 1, size: int | str = 20) -> httpx.Response:
    return c.get("/admin/users", params={"page": page, "size": size})


def summary(c: ApiClient) -> httpx.Response:
    return c.get("/admin/stats/summary")
