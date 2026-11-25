# -*- coding: utf-8 -*-
"""计划接口封装（/api/plans*）."""
from __future__ import annotations

import httpx

from common.request_util import ApiClient


def list_plans(c: ApiClient) -> httpx.Response:
    return c.get("/plans")


def current(c: ApiClient) -> httpx.Response:
    return c.get("/plans/current")


def exercises(c: ApiClient, plan_id: int | str) -> httpx.Response:
    return c.get(f"/plans/{plan_id}/exercises")
