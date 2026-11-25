# -*- coding: utf-8 -*-
"""L2 认证接口（/api/auth/*）：正向 / 反向 / 边界 / 未授权四象限."""
from __future__ import annotations

import time

import pytest

from api import auth_api
from common.assert_util import assert_error, assert_ok
from common.config_util import ADMIN_PHONE, DEMO_CODE, USER_PHONE
from common.expect_util import mask_phone

pytestmark = [pytest.mark.l2_api, pytest.mark.usefixtures("live_api", "clean_today")]


def fresh_phone(suffix: int) -> str:
    """13x + 8 位时间片：保证 60s 频控窗口内不撞历史号码."""
    return f"131{(int(time.time()) + suffix) % 100000000:08d}"


@pytest.mark.l2_api
def test_login_user_success(live_api, anon):
    body = assert_ok(auth_api.login(anon, USER_PHONE, DEMO_CODE))
    data = body["data"]
    assert len(data["token"]) > 20, "JWT 长度异常"
    assert data["expiresIn"] == 604800, f"7 天 JWT 应为 604800 秒，实际 {data['expiresIn']}"
    assert data["user"]["role"] == "user"
    assert data["user"]["id"] > 0
    assert data["user"]["nickname"], "昵称不应为空"


@pytest.mark.l2_api
def test_login_admin_success(live_api, anon):
    body = assert_ok(auth_api.login(anon, ADMIN_PHONE, DEMO_CODE))
    assert body["data"]["user"]["role"] == "admin", "seed admin 角色丢失"


@pytest.mark.l2_api
def test_login_wrong_code_returns_40102(live_api, anon):
    assert_error(auth_api.login(anon, USER_PHONE, "000000"), 401, 40102)


@pytest.mark.l2_api
def test_login_bad_phone_returns_40001_with_field(live_api, anon):
    body = assert_error(auth_api.login(anon, "123", DEMO_CODE), 400, 40001)
    assert body["data"]["field"] == "phone"


@pytest.mark.l2_api
def test_login_code_not_6_digits_returns_40001(live_api, anon):
    assert_error(auth_api.login(anon, USER_PHONE, "12ab"), 400, 40001, field="code")


@pytest.mark.l2_api
def test_login_missing_code_returns_40001(live_api, anon):
    assert_error(auth_api.login_raw(anon, {"phone": USER_PHONE}), 400, 40001)


@pytest.mark.l2_api
def test_me_returns_masked_phone(live_api, user_token):
    from common.request_util import ApiClient

    c = ApiClient(live_api, token=user_token)
    try:
        body = assert_ok(auth_api.me(c))
    finally:
        c.close()
    data = body["data"]
    assert data["phoneMasked"] == mask_phone(USER_PHONE), f"脱敏口径不符：{data['phoneMasked']}"
    assert data["role"] == "user"
    assert data["id"] > 0


@pytest.mark.l2_api
def test_me_without_token_returns_40101(live_api, anon):
    assert_error(auth_api.me(anon), 401, 40101)


@pytest.mark.l2_api
def test_me_with_forged_token_returns_40101(live_api, base_url):
    from common.request_util import ApiClient

    forged = ApiClient(base_url, token="eyJhbGciOiJIUzI1NiJ9.forged.sig")
    try:
        assert_error(auth_api.me(forged), 401, 40101)
    finally:
        forged.close()


@pytest.mark.l2_api
def test_send_code_success_returns_cooldown(live_api, anon):
    body = assert_ok(auth_api.send_code(anon, fresh_phone(0)))
    assert body["data"]["cooldown"] == 60, f"频控窗口应为 60s，实际 {body['data']}"


@pytest.mark.l2_api
def test_send_code_repeat_within_60s_returns_42901(live_api, anon):
    phone = fresh_phone(1)
    assert_ok(auth_api.send_code(anon, phone))
    body = assert_error(auth_api.send_code(anon, phone), 429, 42901)
    remain = body["data"]["remainSec"]
    assert 1 <= remain <= 60, f"remainSec 应在 1..60，实际 {remain}"


@pytest.mark.l2_api
def test_send_code_bad_phone_returns_40001(live_api, anon):
    assert_error(auth_api.send_code(anon, "1380000"), 400, 40001, field="phone")
