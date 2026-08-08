"""Tests for security utilities (JWT, password hashing, rate limiting, cookies).

Covers: token generation/validation, blacklist, password strength,
cookie settings, rate limiting, token type differentiation.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta, timezone


# ── JWT Token Tests ───────────────────────────────────────────────

class TestJWTTokenGeneration:
    """Test JWT token creation and structure."""

    def test_access_token_structure(self):
        """Access token has correct header and payload."""
        from app.utils.auth import create_access_token

        token = create_access_token(data={"sub": "42", "role": "admin"})

        # Should be a valid JWT (3 parts separated by dots)
        parts = token.split(".")
        assert len(parts) == 3

        # Decode payload
        from jose import jwt as pyjwt
        from app.core.config import settings

        payload = pyjwt.decode(
            token, settings.security.secret_key,
            algorithms=[settings.security.jwt_algorithm]
        )
        assert payload["sub"] == "42"
        assert payload["role"] == "admin"
        assert "exp" in payload
        assert "iat" in payload
        assert payload.get("type") != "refresh"  # Not a refresh token

    def test_refresh_token_has_type_flag(self):
        """Refresh token has is_refresh=True in payload."""
        from app.utils.auth import create_refresh_token

        token = create_refresh_token(data={"sub": "42"})

        from jose import jwt as pyjwt
        from app.core.config import settings

        payload = pyjwt.decode(
            token, settings.security.secret_key,
            algorithms=[settings.security.jwt_algorithm]
        )
        assert payload["is_refresh"] is True

    def test_token_expiration_within_range(self):
        """Access token expires within expected timeframe."""
        from app.utils.auth import create_access_token
        from jose import jwt as pyjwt
        from app.core.config import settings

        token = create_access_token(data={"sub": "1"})
        payload = pyjwt.decode(
            token, settings.security.secret_key,
            algorithms=[settings.security.jwt_algorithm]
        )

        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        iat = datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
        delta = exp - iat

        # Should be approximately 60 minutes (settings default)
        assert timedelta(minutes=55) <= delta <= timedelta(minutes=65)

    def test_refresh_token_longer_expiration(self):
        """Refresh token expires in ~30 days, not 60 minutes."""
        from app.utils.auth import create_refresh_token
        from jose import jwt as pyjwt
        from app.core.config import settings

        token = create_refresh_token(data={"sub": "1"})
        payload = pyjwt.decode(
            token, settings.security.secret_key,
            algorithms=[settings.security.jwt_algorithm]
        )

        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        iat = datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
        delta = exp - iat

        # Should be approximately 30 days
        assert timedelta(days=29) <= delta <= timedelta(days=31)


class TestJWTTokenValidation:
    """Test JWT token decoding and validation."""

    def test_decode_valid_token(self):
        """Valid token decodes correctly."""
        from app.utils.auth import decode_token, create_access_token

        token = create_access_token(data={"sub": "99", "role": "researcher"})
        payload = decode_token(token)

        assert payload is not None
        assert payload["sub"] == "99"
        assert payload["role"] == "researcher"

    def test_decode_expired_token_raises(self):
        """Expired token raises HTTPException."""
        from app.utils.auth import decode_token, create_access_token
        from fastapi import HTTPException

        # Create an already-expired token
        expired_data = {
            "sub": "1",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1)
        }
        token = create_access_token(data=expired_data)

        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)

        assert exc_info.value.status_code == 401

    def test_decode_tampered_token_raises(self):
        """Tampered token raises exception."""
        from app.utils.auth import decode_token

        with pytest.raises(Exception):
            decode_token("invalid.token.here")

    def test_decode_none_raises(self):
        """None token raises exception."""
        from app.utils.auth import decode_token

        with pytest.raises(Exception):
            decode_token(None)


# ── Password Hashing Tests ────────────────────────────────────────

class TestPasswordHashing:
    """Test password hashing and verification."""

    def test_hash_is_different_from_plain(self):
        """Hashed password is not the plaintext."""
        from app.utils.auth import get_password_hash

        pw = "MySecurePassword123!"
        hashed = get_password_hash(pw)

        assert hashed != pw
        assert "$2b$" in hashed  # bcrypt format

    def test_verify_correct_password(self):
        """Correct password verifies."""
        from app.utils.auth import get_password_hash, verify_password

        pw = "TestPassword!456"
        hashed = get_password_hash(pw)
        assert verify_password(pw, hashed) is True

    def test_verify_incorrect_password(self):
        """Incorrect password fails verification."""
        from app.utils.auth import get_password_hash, verify_password

        hashed = get_password_hash("correct_pass")
        assert verify_password("wrong_pass", hashed) is False

    def test_verify_empty_password(self):
        """Empty password fails verification."""
        from app.utils.auth import get_password_hash, verify_password

        hashed = get_password_hash("real_pass")
        assert verify_password("", hashed) is False

    def test_verify_none_password(self):
        """None password fails verification."""
        from app.utils.auth import get_password_hash, verify_password

        hashed = get_password_hash("real_pass")
        assert verify_password(None, hashed) is False


class TestPasswordStrength:
    """Test password strength validation."""

    def test_short_password_rejected(self):
        """Passwords shorter than minimum length are rejected."""
        from app.utils.auth import validate_password_strength
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            validate_password_strength("short")
        assert exc_info.value.status_code == 400

    def test_no_uppercase_rejected(self):
        """Password without uppercase letter is rejected (if required)."""
        from app.utils.auth import validate_password_strength
        from fastapi import HTTPException

        with patch("app.utils.auth.settings") as mock_settings:
            mock_settings.security.password_require_uppercase = True
            mock_settings.security.password_min_length = 8

            with pytest.raises(HTTPException):
                validate_password_strength("lowercase123!")

    def test_no_digit_rejected(self):
        """Password without digit is rejected (if required)."""
        from app.utils.auth import validate_password_strength
        from fastapi import HTTPException

        with patch("app.utils.auth.settings") as mock_settings:
            mock_settings.security.password_require_number = True
            mock_settings.security.password_min_length = 8

            with pytest.raises(HTTPException):
                validate_password_strength("NoDigitsHere!!")

    def test_strong_password_accepted(self):
        """Strong password passes validation."""
        from app.utils.auth import validate_password_strength

        # Should not raise
        validate_password_strength("Str0ng!Pass")


# ── Token Blacklist Tests ─────────────────────────────────────────

class TestTokenBlacklist:
    """Test token blacklist functionality."""

    def test_blacklist_and_check(self):
        """Token can be blacklisted and detected."""
        from app.utils.auth import blacklist_token, is_token_blacklisted
        from app.utils.auth import _token_blacklist

        _token_blacklist.clear()

        token = "test_blacklist_token_abc123"
        blacklist_token(None, token)  # Memory fallback

        assert is_token_blacklisted(None, token) is True

        # Clean up
        _token_blacklist.discard(token)

    def test_non_blacklisted_token(self):
        """Non-blacklisted token returns False."""
        from app.utils.auth import is_token_blacklisted
        from app.utils.auth import _token_blacklist

        _token_blacklist.clear()

        assert is_token_blacklisted(None, "nonexistent_token") is False

        # Clean up
        _token_blacklist.discard("nonexistent_token")

    def test_logout_adds_to_blacklist(self):
        """Logout adds token to blacklist."""
        from app.utils.auth import blacklist_token, _token_blacklist

        _token_blacklist.clear()
        token = "logout_test_token_xyz"

        blacklist_token(None, token)

        assert token in _token_blacklist

        # Clean up
        _token_blacklist.discard(token)


# ── Rate Limiting Tests ───────────────────────────────────────────

class TestRateLimiting:
    """Test login rate limiter."""

    def test_rate_limit_blocks_after_threshold(self):
        """Too many login attempts triggers rate limit."""
        from app.utils.auth import check_login_rate_limit
        from fastapi import HTTPException

        # Clear rate limit state
        from app.utils.auth import _login_attempts
        _login_attempts.clear()

        # Simulate excessive attempts from same IP
        ip = "192.168.1.100"
        for i in range(10):
            try:
                check_login_rate_limit(ip)
            except HTTPException:
                break

        # Should eventually raise
        with pytest.raises(HTTPException) as exc_info:
            check_login_rate_limit(ip)
        assert exc_info.value.status_code == 429

    def test_different_ips_independent(self):
        """Rate limits are per-IP, not global."""
        from app.utils.auth import check_login_rate_limit
        from app.utils.auth import _login_attempts

        _login_attempts.clear()

        # Fill up IP1's quota
        for i in range(10):
            try:
                check_login_rate_limit("10.0.0.1")
            except Exception:
                break

        # IP2 should still be allowed
        assert check_login_rate_limit("10.0.0.2") is None

        _login_attempts.clear()

    def test_rate_limit_resets_over_time(self):
        """Rate limit window slides."""
        from app.utils.auth import check_login_rate_limit
        from app.utils.auth import _login_attempts
        import time

        _login_attempts.clear()

        ip = "192.168.1.200"
        # Add old attempts
        _login_attempts[ip] = [
            (time.time() - 120, "fail")  # 2 minutes ago
        ]

        # These should be outside the window
        for i in range(5):
            check_login_rate_limit(ip)


# ── Cookie Settings Tests ─────────────────────────────────────────

class TestCookieSettings:
    """Test secure cookie generation."""

    def test_cookie_is_httponly(self):
        """Cookie has HttpOnly flag."""
        from app.utils.auth import create_secure_cookie_settings

        cookie = create_secure_cookie_settings("key", "val", 3600)
        assert cookie["httponly"] is True

    def test_cookie_has_same_site(self):
        """Cookie has SameSite attribute."""
        from app.utils.auth import create_secure_cookie_settings

        cookie = create_secure_cookie_settings("key", "val", 3600)
        assert "samesite" in cookie
        assert cookie["samesite"] in ("Strict", "Lax", "None")

    def test_cookie_max_age_set(self):
        """Cookie has correct max_age."""
        from app.utils.auth import create_secure_cookie_settings

        cookie = create_secure_cookie_settings("key", "val", 7200)
        assert cookie["max_age"] == 7200

    def test_cookie_clear_settings(self):
        """Clear cookie sets appropriate expiry."""
        from app.utils.auth import clear_cookie_settings

        cookie = clear_cookie_settings("key")
        assert cookie["max_age"] == 0
        assert cookie["value"] == ""


# ── Security Config Tests ─────────────────────────────────────────

class TestSecurityConfig:
    """Test security configuration."""

    def test_secret_key_minimum_length(self):
        """SECRET_KEY must be at least 32 characters."""
        from app.core.config import SecurityConfig
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            SecurityConfig(secret_key="short")

        # Should pass with 32+ chars
        config = SecurityConfig(secret_key="a" * 32)
        assert config.secret_key == "a" * 32

    def test_default_secret_key_is_random(self):
        """Empty secret_key generates a random one."""
        from app.core.config import SecurityConfig

        config = SecurityConfig(secret_key="")
        assert len(config.secret_key) >= 32

    def test_jwt_algorithm_default(self):
        """Default JWT algorithm is HS256."""
        from app.core.config import SecurityConfig

        config = SecurityConfig()
        assert config.jwt_algorithm == "HS256"

    def test_password_min_length_default(self):
        """Default password minimum length is 8."""
        from app.core.config import SecurityConfig

        config = SecurityConfig()
        assert config.password_min_length == 8
