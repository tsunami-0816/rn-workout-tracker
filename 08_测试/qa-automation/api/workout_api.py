# -*- coding: utf-8 -*-
"""训练与组次接口封装（/api/workouts*）."""
from __future__ import annotations

from typing import Any, Mapping

import httpx

from common.request_util import ApiClient


def list_workouts(c: ApiClient, page: int | str = 1, size: int | str = 20) -> httpx.Response:
    return c.get("/workouts", params={"page": page, "size": size})


def start(c: ApiClient, plan_id: int) -> httpx.Response:
    return c.post("/workouts/start", json={"planId": plan_id})


def start_raw(c: ApiClient, payload: Mapping[str, Any]) -> httpx.Response:
    return c.post("/workouts/start", json=dict(payload))


def detail(c: ApiClient, workout_id: int | str) -> httpx.Response:
    return c.get(f"/workouts/{workout_id}")


def create_set(
    c: ApiClient,
    workout_id: int,
    exercise_id: int,
    set_no: int,
    weight: float,
    reps: int,
    done: bool,
) -> httpx.Response:
    return c.post(
        f"/workouts/{workout_id}/sets",
        json={"exerciseId": exercise_id, "setNo": set_no, "weight": weight, "reps": reps, "done": done},
    )


def create_set_raw(c: ApiClient, workout_id: int, payload: Mapping[str, Any]) -> httpx.Response:
    return c.post(f"/workouts/{workout_id}/sets", json=dict(payload))


def update_set(c: ApiClient, workout_id: int, set_id: int, payload: Mapping[str, Any]) -> httpx.Response:
    return c.patch(f"/workouts/{workout_id}/sets/{set_id}", json=dict(payload))


def delete_set(c: ApiClient, workout_id: int, set_id: int) -> httpx.Response:
    return c.delete(f"/workouts/{workout_id}/sets/{set_id}")


def finish(c: ApiClient, workout_id: int) -> httpx.Response:
    return c.post(f"/workouts/{workout_id}/finish")
