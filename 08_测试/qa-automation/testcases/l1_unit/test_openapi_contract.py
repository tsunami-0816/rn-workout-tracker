# -*- coding: utf-8 -*-
"""L1 契约静态校验（不碰服务）：openapi.json 结构、覆盖端点、鉴权声明、DTO 必填.

作用：契约一旦少路径/少 summary/漏 bearer，这里先红，避免 L2 用例打到不存在的口径。
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

QA_DIR = Path(__file__).resolve().parents[2]      # qa-automation
PROJ_DIR = Path(__file__).resolve().parents[4]    # 项目根
OPENAPI = PROJ_DIR / "06.5_契约" / "openapi.json"

EXPECTED_PATHS = {
    "/api/auth/send-code",
    "/api/auth/login",
    "/api/auth/me",
    "/api/plans",
    "/api/plans/current",
    "/api/plans/{id}/exercises",
    "/api/workouts",
    "/api/workouts/start",
    "/api/workouts/{id}",
    "/api/workouts/{id}/sets",
    "/api/workouts/{id}/sets/{setId}",
    "/api/workouts/{id}/finish",
    "/api/stats/weekly",
    "/api/stats/history",
    "/api/admin/workouts",
    "/api/admin/users",
    "/api/admin/stats/summary",
    "/api/app/version",
    "/api/health",
}


@pytest.fixture(scope="module")
def spec() -> dict:
    assert OPENAPI.exists(), f"契约文件不存在：{OPENAPI}"
    return json.loads(OPENAPI.read_text(encoding="utf-8"))


@pytest.mark.l1_unit
def test_openapi_declares_all_19_paths(spec):
    paths = set(spec["paths"].keys())
    assert paths == EXPECTED_PATHS, f"契约路径与基线不符：多={paths - EXPECTED_PATHS} 少={EXPECTED_PATHS - paths}"


@pytest.mark.l1_unit
def test_openapi_operation_count_is_20(spec):
    ops = [op for item in spec["paths"].values() for op in item.values()]
    assert len(ops) == 20, f"端点数应为 20，实际 {len(ops)}"


@pytest.mark.l1_unit
def test_every_operation_has_summary_and_unique_operation_id(spec):
    ops = [op for item in spec["paths"].values() for op in item.values()]
    ids = [op.get("operationId") for op in ops]
    assert all(op.get("summary") for op in ops), "存在无 summary 的操作"
    assert all(ids), "存在无 operationId 的操作"
    assert len(ids) == len(set(ids)), f"operationId 重复：{ids}"


@pytest.mark.l1_unit
def test_admin_endpoints_declare_bearer_security(spec):
    for path in ("/api/admin/workouts", "/api/admin/users", "/api/admin/stats/summary"):
        assert "security" in spec["paths"][path]["get"], f"{path} 未声明 bearer 鉴权"


@pytest.mark.l1_unit
def test_dto_schemas_have_required_fields(spec):
    schemas = spec["components"]["schemas"]
    for name in ("SendCodeDto", "LoginDto", "StartWorkoutDto", "CreateSetDto"):
        assert name in schemas, f"缺少 DTO {name}"
        required = schemas[name].get("required") or []
        assert required, f"{name} 未声明必填字段"
        props = schemas[name].get("properties") or {}
        assert set(required) <= set(props.keys()), f"{name} required 含未定义字段"


@pytest.mark.l1_unit
def test_workout_invariants_documented_in_contract(spec):
    """关键业务口径必须写在契约摘要里：幂等 / size 上限 50 / ISO 周三选一."""
    summaries = " ".join(
        op.get("summary", "") for item in spec["paths"].values() for op in item.values()
    )
    assert "幂等" in summaries, "契约未声明组次幂等口径"
    assert "size 上限 50" in summaries, "契约未声明 size 上限 50"
    assert "复用" in summaries or "同一天" in summaries, "契约未声明 start 同日复用"
