# -*- coding: utf-8 -*-
"""配置读取（conftest 与用例共用，避免各文件重复解析）."""
from __future__ import annotations

from pathlib import Path
from typing import Dict

QA_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = QA_DIR / "config" / "config.yaml"


def load_config() -> Dict[str, str]:
    """极简 KEY: VALUE 解析（不引入 pyyaml 依赖）."""
    cfg: Dict[str, str] = {}
    for line in CONFIG_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, _, value = line.partition(":")
        cfg[key.strip()] = value.strip().strip('"')
    return cfg


CFG = load_config()
BASE_URL = CFG.get("base_url", "http://127.0.0.1:8094/api")
ROOT_URL = CFG.get("root_url", "http://127.0.0.1:8094")
USER_PHONE = CFG.get("user_phone", "13900139000")
ADMIN_PHONE = CFG.get("admin_phone", "13800138000")
DEMO_CODE = CFG.get("demo_code", "123456")
