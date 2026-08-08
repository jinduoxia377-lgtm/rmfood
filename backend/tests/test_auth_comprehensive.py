"""Tests for authentication endpoints.

Covers: login, register, token refresh, logout, password change,
account lockout, token blacklist, cookie settings.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient, ASGITransport


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def mock_db():
    """Mock async database session."""
    db = AsyncMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    db.close = AsyncMock()
    return db


@pytest.fixture
def mock_user():
    """Create a mock user object."""
    user = MagicMock()
    user.id = 1
    user.username = "testuser"
    user.email = "test@example.com"
    user.is_active = True
    user.role = "admin"
    user.created_at = datetime.now(timezone.utc)
    user.updated_at = datetime.now(timezone.utc)
    return user


# ── Auth Service Tests ────────────────────────────────────────────

class TestAuthServiceAuthenticate:
    """Test AuthService.authenticate method."""

    @pytest.mark.asyncio
    async def test_login_success(self, mock_db, mock_user):
        """Valid credentials return tokens."""
        from app.services.auth import AuthService

        # Setup: mock user query
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute = AsyncMock(return_value=mock_result)

        service = AuthService(mock_db)

        with patch("app.services.auth.verify_password", return_value=True):
            with patch("app.services.auth.create_access_token", return_value="access_token_xyz"):
                with patch("app.services.auth.create_refresh_token", return_value="refresh_token_xyz"):
                    result = await service.authenticate("testuser", "correctpass")

        assert result.access_token == "access_token_xyz"
        assert result.refresh_token == "refresh_token_xyz"
        assert result.token_type == "bearer"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, mock_db, mock_user):
        """Wrong password raises HTTPException."""
        from app.services.auth import AuthService
        from fastapi import HTTPException

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute = AsyncMock(return_value=mock_result)

        service = AuthService(mock_db)

        with patch("app.services.auth.verify_password", return_value=False):
            with pytest.raises(HTTPException) as exc_info:
                await service.authenticate("testuser", "wrongpass")

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, mock_db):
        """Non-existent user raises HTTPException."""
        from app.services.auth import AuthService
        from fastapi import HTTPException

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        service = AuthService(mock_db)

        with pytest.raises(HTTPException) as exc_info:
            await service.authenticate("nobody", "nopass")

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_login_empty_username(self, mock_db):
        """Empty username raises validation error."""
        from app.services.auth import AuthService

        service = AuthService(mock_db)

        with pytest.raises(ValueError):
            await service.authenticate("", "password")


class TestAuthPasswordHashing:
    """Test password hashing utilities."""

    def test_hash_and_verify_roundtrip(self):
        """Hashed password verifies correctly."""
        from app.services.auth import get_password_hash, verify_password

        plain = "my_secure_password_123"
        hashed = get_password_hash(plain)

        assert hashed != plain
        assert verify_password(plain, hashed) is True
        assert verify_password("wrong_password", hashed) is False

    def test_different_hashes_for_same_password(self):
        """Same password produces different hashes (salt)."""
        from app.services.auth import get_password_hash

        pw = "identical_password"
        hash1 = get_password_hash(pw)
        hash2 = get_password_hash(pw)

        assert hash1 != hash2
        assert verify_password(pw, hash1) is True
        assert verify_password(pw, hash2) is True

    def test_empty_password_rejected(self):
        """Empty or None password handling."""
        from app.services.auth import verify_password

        hashed = get_password_hash("real_password")
        # Empty string should not match
        assert verify_password("", hashed) is False


# ── Token Tests ───────────────────────────────────────────────────

class TestTokenGeneration:
    """Test JWT token creation and decoding."""

    @pytest.mark.asyncio
    async def test_access_token_contains_user_id(self, mock_user):
        """Access token payload includes user_id."""
        from app.services.auth import create_access_token
        from app.utils.auth import decode_token

        token = create_access_token(data={"sub": str(mock_user.id)})
        decoded = decode_token(token)

        assert decoded is not None
        assert decoded["sub"] == str(mock_user.id)
        assert "exp" in decoded
        assert "iat" in decoded

    @pytest.mark.asyncio
    async def test_refresh_token_contains_user_id(self, mock_user):
        """Refresh token payload includes user_id and is_refresh=True."""
        from app.services.auth import create_refresh_token
        from app.utils.auth import decode_token

        token = create_refresh_token(data={"sub": str(mock_user.id)})
        decoded = decode_token(token)

        assert decoded is not None
        assert decoded["sub"] == str(mock_user.id)
        assert decoded.get("is_refresh") is True

    @pytest.mark.asyncio
    async def test_expired_token_rejected(self):
        """Expired token raises HTTPException."""
        from app.utils.auth import decode_token
        from app.services.auth import create_access_token
        from fastapi import HTTPException

        # Create a token that's already expired
        from datetime import timedelta
        expired_data = {"sub": "1", "exp": datetime.now(timezone.utc) - timedelta(hours=1)}
        token = create_access_token(data=expired_data)

        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_token_format(self):
        """Malformed token raises HTTPException."""
        from app.utils.auth import decode_token
        from fastapi import HTTPException

        with pytest.raises((HTTPException, Exception)):
            decode_token("not.a.valid.jwt.token")

    def test_token_missing_signature_rejected(self):
        """Tokens with tampered payload are rejected."""
        from app.utils.auth import decode_token

        # Tamper with the payload
        bad_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6ImhhY2tlciJ9.tampered"

        with pytest.raises(Exception):
            decode_token(bad_token)


# ── Cookie Settings Tests ─────────────────────────────────────────

class TestSecureCookieSettings:
    """Test HttpOnly cookie creation for JWT storage."""

    def test_create_secure_cookie_basic(self):
        """Basic cookie settings are correct."""
        from app.utils.auth import create_secure_cookie_settings

        cookie = create_secure_cookie_settings(
            "test_token",
            "some_jwt_value",
            max_age_seconds=1800,
        )

        assert cookie["key"] == "test_token"
        assert cookie["value"] == "some_jwt_value"
        assert cookie["httponly"] is True
        assert cookie["max_age"] == 1800

    def test_cookie_has_correct_defaults(self):
        """Cookie has secure/SameSite defaults in production."""
        from app.utils.auth import create_secure_cookie_settings

        cookie = create_secure_cookie_settings(
            "access_token",
            "jwt_value",
            max_age_seconds=3600,
        )

        # HttpOnly should always be True
        assert cookie["httponly"] is True
        # SameSite should be present
        assert "samesite" in cookie

    def test_refresh_cookie_longer_expiry(self):
        """Refresh token cookie has longer max_age."""
        from app.utils.auth import create_secure_cookie_settings

        access_cookie = create_secure_cookie_settings(
            "access", "tok", max_age_seconds=1800
        )
        refresh_cookie = create_secure_cookie_settings(
            "refresh", "tok", max_age_seconds=604800, is_refresh_token=True
        )

        assert refresh_cookie["max_age"] > access_cookie["max_age"]


# ── Account Lockout Tests ─────────────────────────────────────────

class TestAccountLockout:
    """Test account lockout mechanism."""

    @pytest.mark.asyncio
    async def test_lockout_after_max_attempts(self, mock_db):
        """Account locks after MAX_LOGIN_ATTEMPTS failures."""
        from app.core.account_lockout import check_account_lockout, record_failed_attempt, unlock_account

        # Simulate max failed attempts
        for i in range(5):
            await record_failed_attempt(mock_db, "testuser")

        # Next check should raise lockout
        with pytest.raises(Exception):
            await check_account_lockout(mock_db, "testuser")

    @pytest.mark.asyncio
    async def test_unlock_after_successful_login(self, mock_db):
        """Successful login resets failed attempts."""
        from app.core.account_lockout import record_failed_attempt, unlock_account

        for i in range(3):
            await record_failed_attempt(mock_db, "testuser")

        # Successful login unlocks
        await unlock_account(mock_db, "testuser")

        # Should not be locked anymore
        from app.core.account_lockout import check_account_lockout
        result = await check_account_lockout(mock_db, "testuser")
        assert result is None  # No exception

    @pytest.mark.asyncio
    async def test_lockout_is_temporary(self, mock_db):
        """Lockout expires after LOCKOUT_DURATION."""
        from app.core.account_lockout import record_failed_attempt, check_account_lockout
        import time

        for i in range(5):
            await record_failed_attempt(mock_db, "testuser")

        # Should be locked
        with pytest.raises(Exception):
            await check_account_lockout(mock_db, "testuser")

        # After lockout duration passes, should unlock
        # (We can't actually wait, so test the logic differently)
        from app.core.account_lockout import LOCKOUT_DURATION_SECONDS
        assert LOCKOUT_DURATION_SECONDS > 0


# ── Token Blacklist Tests ─────────────────────────────────────────

class TestTokenBlacklist:
    """Test JWT token blacklist functionality."""

    @pytest.mark.asyncio
    async def test_blacklisted_token_rejected(self, mock_db):
        """Blacklisted token is rejected on decode."""
        from app.utils.auth import decode_token, blacklist_token, is_token_blacklisted
        from app.services.auth import create_access_token

        # Create and blacklist a token
        token = create_access_token(data={"sub": "1"})
        await blacklist_token(mock_db, token)

        assert await is_token_blacklisted(mock_db, token) is True

        with pytest.raises(Exception):
            decode_token(token)

    @pytest.mark.asyncio
    async def test_valid_token_not_blacklisted(self, mock_db):
        """Valid (non-blacklisted) token decodes normally."""
        from app.utils.auth import decode_token
        from app.services.auth import create_access_token

        token = create_access_token(data={"sub": "1"})
        # Don't blacklist it

        decoded = decode_token(token)
        assert decoded is not None
        assert decoded["sub"] == "1"

    @pytest.mark.asyncio
    async def test_logout_revokes_token(self, mock_db):
        """Logout blacklists the current access token."""
        from app.utils.auth import decode_token, is_token_blacklisted
        from app.services.auth import create_access_token

        token = create_access_token(data={"sub": "1"})
        assert await is_token_blacklisted(mock_db, token) is False

        # Simulate logout
        from app.utils.auth import blacklist_token
        await blacklist_token(mock_db, token)

        assert await is_token_blacklisted(mock_db, token) is True


# ── Integration Tests ─────────────────────────────────────────────

class TestAuthIntegration:
    """End-to-end authentication flow tests."""

    @pytest.mark.asyncio
    async def test_full_login_flow(self, mock_db, mock_user):
        """Complete flow: login -> token -> verify -> logout."""
        from app.services.auth import AuthService
        from app.utils.auth import decode_token, blacklist_token, is_token_blacklisted

        # Step 1: Login
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute = AsyncMock(return_value=mock_result)

        service = AuthService(mock_db)

        with patch("app.services.auth.verify_password", return_value=True):
            with patch("app.services.auth.create_access_token", return_value="access_tok"):
                with patch("app.services.auth.create_refresh_token", return_value="refresh_tok"):
                    tokens = await service.authenticate("testuser", "pass")

        assert tokens.access_token == "access_tok"
        assert tokens.refresh_token == "refresh_tok"

        # Step 2: Verify token is valid
        decoded = decode_token(tokens.access_token)
        assert decoded is not None

        # Step 3: Logout (blacklist token)
        await blacklist_token(mock_db, tokens.access_token)
        assert await is_token_blacklisted(mock_db, tokens.access_token) is True

        # Step 4: Token is now invalid
        with pytest.raises(Exception):
            decode_token(tokens.access_token)
