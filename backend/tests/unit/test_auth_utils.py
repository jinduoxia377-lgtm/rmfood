"""app.utils.auth 单元测试

覆盖:
- 密码哈希 / 验证
- Access/Refresh Token 生成与解码
- Token 黑名单管理
- 登录限流
- Refresh Token 重用检测与速率限制
- 安全 Cookie 设置
"""
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi import HTTPException
from jose import jwt as jose_jwt

from app.utils import auth as auth_utils
from app.core.config import settings


@pytest.fixture(autouse=True)
def _reset_auth_state():
    """每个测试前重置模块级内存状态，避免用例间相互污染。"""
    auth_utils._token_blacklist.clear()
    auth_utils._login_attempts.clear()
    auth_utils._refresh_token_usage.clear()
    auth_utils._refresh_token_ratelimit.clear()
    yield


class TestPassword:
    def test_get_password_hash_and_verify(self):
        hashed = auth_utils.get_password_hash("SecurePass123!")
        assert hashed.startswith("$2")
        assert auth_utils.verify_password("SecurePass123!", hashed) is True

    def test_verify_wrong_password(self):
        hashed = auth_utils.get_password_hash("SecurePass123!")
        assert auth_utils.verify_password("WrongPass456!", hashed) is False

    def test_verify_password_invalid_hash(self):
        assert auth_utils.verify_password("SecurePass123!", "not-a-valid-hash") is False


class TestToken:
    def test_create_access_token_shape(self):
        token = auth_utils.create_access_token({"sub": "42", "role": "admin"})
        payload = jose_jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.security.jwt_algorithm],
            issuer=settings.security.jwt_issuer,
            audience=settings.security.jwt_audience,
        )
        assert payload["sub"] == "42"
        assert payload["role"] == "admin"
        assert payload["type"] == "access"
        assert payload["jti"]

    def test_create_access_token_custom_expiry(self):
        token = auth_utils.create_access_token(
            {"sub": "1"}, expires_delta=timedelta(minutes=5)
        )
        payload = jose_jwt.get_unverified_claims(token)
        exp = datetime.fromtimestamp(payload["exp"], timezone.utc)
        assert exp > datetime.now(timezone.utc)

    def test_create_refresh_token_type(self):
        token = auth_utils.create_refresh_token("user-1")
        payload = jose_jwt.get_unverified_claims(token)
        assert payload["type"] == "refresh"
        assert payload["sub"] == "user-1"

    def test_decode_token_roundtrip(self):
        token = auth_utils.create_access_token({"sub": "7"})
        payload = auth_utils.decode_token(token)
        assert payload["sub"] == "7"

    def test_decode_invalid_token_raises(self):
        with pytest.raises(HTTPException) as exc:
            auth_utils.decode_token("not.a.jwt")
        assert exc.value.status_code == 401

    def test_decode_expired_token_raises(self):
        token = auth_utils.create_access_token(
            {"sub": "1"}, expires_delta=timedelta(seconds=-10)
        )
        with pytest.raises(HTTPException) as exc:
            auth_utils.decode_token(token)
        assert exc.value.status_code == 401

    def test_decode_blacklisted_token_raises(self):
        token = auth_utils.create_access_token({"sub": "1"})
        auth_utils._token_blacklist.add(token)
        with pytest.raises(HTTPException) as exc:
            auth_utils.decode_token(token)
        assert exc.value.status_code == 401


class TestBlacklist:
    def test_add_and_check_blacklist(self):
        token = auth_utils.create_access_token({"sub": "1"})
        assert auth_utils.is_token_blacklisted(token) is False
        assert auth_utils.add_token_to_blacklist(token) is True
        assert auth_utils.is_token_blacklisted(token) is True

    def test_add_invalid_token_returns_false(self):
        assert auth_utils.add_token_to_blacklist("garbage.token.value") is False

    def test_cleanup_expired_tokens(self):
        # 构造一个已过期的 token
        token = auth_utils.create_access_token(
            {"sub": "1"}, expires_delta=timedelta(seconds=-5)
        )
        auth_utils._token_blacklist.add(token)
        cleaned = auth_utils.cleanup_expired_tokens()
        assert cleaned >= 1
        assert auth_utils.is_token_blacklisted(token) is False

    def test_cleanup_expired_tokens_noop(self):
        assert auth_utils.cleanup_expired_tokens() == 0


class TestRateLimit:
    def test_check_rate_limit_allows_until_max(self):
        # max_attempts=3 表示允许前 3 次尝试，第 4 次被拦截
        for _ in range(3):
            allowed, _ = auth_utils.check_rate_limit("1.2.3.4", max_attempts=3, window_seconds=60)
            assert allowed is True
        allowed, remaining = auth_utils.check_rate_limit("1.2.3.4", max_attempts=3, window_seconds=60)
        assert allowed is False
        assert remaining == 0

    def test_clear_rate_limit(self):
        auth_utils.check_rate_limit("1.2.3.4", max_attempts=3, window_seconds=60)
        auth_utils.clear_rate_limit("1.2.3.4")
        allowed, _ = auth_utils.check_rate_limit("1.2.3.4", max_attempts=3, window_seconds=60)
        assert allowed is True


class TestPasswordStrength:
    def test_strong_password(self):
        ok, msg = auth_utils.validate_password_strength("StrongPass1")
        assert ok is True
        assert msg == ""

    def test_too_short(self):
        ok, msg = auth_utils.validate_password_strength("Ab1")
        assert ok is False
        assert "8位" in msg

    def test_missing_uppercase(self):
        ok, msg = auth_utils.validate_password_strength("lowercase1")
        assert ok is False
        assert "大写" in msg

    def test_missing_lowercase(self):
        ok, msg = auth_utils.validate_password_strength("UPPERCASE1")
        assert ok is False
        assert "小写" in msg

    def test_missing_digit(self):
        ok, msg = auth_utils.validate_password_strength("NoDigitsHere")
        assert ok is False
        assert "数字" in msg


class TestRefreshTokenProtection:
    def test_reuse_detection(self):
        token = auth_utils.create_refresh_token("user-1")
        used, _ = auth_utils.check_refresh_token_reuse(token)
        assert used is False
        assert auth_utils.mark_refresh_token_used(token) is True
        used, msg = auth_utils.check_refresh_token_reuse(token)
        assert used is True
        assert "已被使用" in msg

    def test_mark_refresh_token_used_no_jti(self):
        # 构造无 jti 的 token
        token = jose_jwt.encode(
            {"sub": "1"}, settings.secret_key, algorithm=settings.security.jwt_algorithm
        )
        assert auth_utils.mark_refresh_token_used(token) is False

    def test_refresh_token_ratelimit(self):
        token = auth_utils.create_refresh_token("user-1")
        for _ in range(auth_utils.REFRESH_TOKEN_RATE_LIMIT):
            allowed, _ = auth_utils.check_refresh_token_ratelimit(token)
            assert allowed is True
        allowed, remaining = auth_utils.check_refresh_token_ratelimit(token)
        assert allowed is False
        assert remaining == 0


class TestCookieSettings:
    def test_create_secure_cookie_settings(self):
        cfg = auth_utils.create_secure_cookie_settings("rmfood_token", "abc", 3600)
        assert cfg["key"] == "rmfood_token"
        assert cfg["value"] == "abc"
        assert cfg["max_age"] == 3600
        assert cfg["httponly"] is True
        assert cfg["samesite"] == "strict"

    def test_create_cookie_refresh_token_samesite_lax(self):
        cfg = auth_utils.create_secure_cookie_settings("rmfood_refresh", "abc", 86400, is_refresh_token=True)
        assert cfg["samesite"] == "lax"

    def test_get_cookie_value(self):
        assert auth_utils.get_cookie_value({"a": "1"}, "a") == "1"
        assert auth_utils.get_cookie_value({}, "missing") is None

    def test_clear_cookie_settings(self):
        cfg = auth_utils.clear_cookie_settings("rmfood_token")
        assert cfg["key"] == "rmfood_token"
        assert cfg["httponly"] is True