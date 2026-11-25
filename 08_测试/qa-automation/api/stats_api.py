# -*- coding: utf-8 -*-
"""统计接口封装（/api/stats/*）."""
from __future__ import annotations

import httpx

from common.request_util import ApiClient


def weekly(c: ApiClient) -> httpx.Response:
    return c.get("/stats/weekly")


def history(c: ApiClient, weeks: int | str | None = None) -> httpx.Response:
    params = {} if weeks is None else {"weeks": weeks}
    return c.get("/stats/history", params=params or None)
