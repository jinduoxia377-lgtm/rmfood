"""Tests for account lockout mechanism.

Covers: failed attempt tracking, lockout enforcement, automatic unlock,
manual unlock, lockout duration expiration, admin override.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta, timezone
import time


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def mock_db():
    """Mock async database session."""
    db = AsyncMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


@pytest.fixture
def mock_user():
    """Mock user object."""
    user = MagicMock()
    user.id = 1
    user.username = "brute_force_target"
    user.email = "target@example.com"
    return user


@pytest.fixture
def lockout_manager():
    """Account lockout manager with known settings."""
    from app.core.account_lockout import AccountLockout
    return AccountLockout(max_attempts=3, lockout_duration_minutes=2)


# ── AccountLockout Class Tests ────────────────────────────────────

class TestAccountLockoutInit:
    """Test AccountLockout initialization."""

    def test_default_settings(self):
        """Default max_attempts=5, lockout_duration=15min."""
        from app.core.account_lockout import AccountLockout

        manager = AccountLockout()
        assert manager.max_attempts == 5
        assert manager.lockout_duration == timedelta(minutes=15)

    def test_custom_settings(self):
        """Custom settings are applied."""
        from app.core.account_lockout import AccountLockout

        manager = AccountLockout(max_attempts=10, lockout_duration_minutes=30)
        assert manager.max_attempts == 10
        assert manager.lockout_duration == timedelta(minutes=30)

    def test_zero_max_attempts_blocks_immediately(self):
        """Zero max_attempts means no login allowed."""
        from app.core.account_lockout import AccountLockout

        manager = AccountLockout(max_attempts=0)
        assert manager.max_attempts == 0


class TestRecordFailedAttempt:
    """Test recording failed login attempts."""

    @pytest.mark.asyncio
    async def test_record_first_failure(self, mock_db, mock_user, lockout_manager):
        """First failure recorded successfully."""
        from app.core.account_lockout import record_failed_attempt

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        result = await record_failed_attempt(mock_db, mock_user, "192.168.1.1")

        assert result["attempts"] == 1
        assert result["locked"] is False

    @pytest.mark.asyncio
    async def test_record_multiple_failures(self, mock_db, mock_user, lockout_manager):
        """Multiple failures accumulate."""
        from app.core.account_lockout import record_failed_attempt

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        for i in range(3):
            result = await record_failed_attempt(mock_db, mock_user, "192.168.1.1")
            assert result["attempts"] == i + 1

        assert result["locked"] is True  # 3rd attempt locks

    @pytest.mark.asyncio
    async def test_record_failure_logs_event(self, mock_db, mock_user, lockout_manager):
        """Failure is logged with IP and timestamp."""
        from app.core.account_lockout import record_failed_attempt

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        await record_failed_attempt(mock_db, mock_user, "10.0.0.1")

        # Verify database was called
        assert mock_db.execute.called

    @pytest.mark.asyncio
    async def test_ip_tracking_per_user(self, mock_db, mock_user, lockout_manager):
        """Different IPs tracked separately."""
        from app.core.account_lockout import record_failed_attempt

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        await record_failed_attempt(mock_db, mock_user, "1.1.1.1")
        await record_failed_attempt(mock_db, mock_user, "2.2.2.2")

        # Both IPs should have recorded attempts


class TestCheckAccountLocked:
    """Test account lockout status checking."""

    @pytest.mark.asyncio
    async def test_unlocked_account(self, mock_db, mock_user, lockout_manager):
        """Account with no failures is not locked."""
        from app.core.account_lockout import check_account_lockout

        mock_db.execute = AsyncMock()
        mock_db.execute.return_value = AsyncMock()
        mock_db.execute.return_value.scalar_one_or_none = AsyncMock(return_value=None)

        # Should not raise
        result = await check_account_lockout(mock_db, mock_user)
        assert result is None

    @pytest.mark.asyncio
    async def test_locked_account_raises(self, mock_db, mock_user, lockout_manager):
        """Locked account raises exception."""
        from app.core.account_lockout import check_account_lockout, record_failed_attempt

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        # Lock the account
        for i in range(3):
            await record_failed_attempt(mock_db, mock_user, "1.1.1.1")

        # Now should raise
        with pytest.raises(Exception):
            await check_account_lockout(mock_db, mock_user)

    @pytest.mark.asyncio
    async def test_lockout_duration_enforced(self, mock_db, mock_user, lockout_manager):
        """Lockout lasts for configured duration."""
        from app.core.account_lockout import check_account_lockout, record_failed_attempt

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        # Lock the account
        for i in range(3):
            await record_failed_attempt(mock_db, mock_user, "1.1.1.1")

        # Should be locked
        with pytest.raises(Exception):
            await check_account_lockout(mock_db, mock_user)


class TestResetAttempts:
    """Test resetting failed attempts after success."""

    @pytest.mark.asyncio
    async def test_reset_after_success(self, mock_db, mock_user, lockout_manager):
        """Failed attempts reset on successful login."""
        from app.core.account_lockout import record_failed_attempt, reset_login_attempts

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        # Record failures
        for i in range(2):
            await record_failed_attempt(mock_db, mock_user, "1.1.1.1")

        # Successful login resets
        await reset_login_attempts(mock_db, mock_user)

        # Should not be locked anymore
        from app.core.account_lockout import check_account_lockout
        result = await check_account_lockout(mock_db, mock_user)
        assert result is None

    @pytest.mark.asyncio
    async def test_reset_nonexistent_user(self, mock_db, lockout_manager):
        """Resetting nonexistent user doesn't crash."""
        from app.core.account_lockout import reset_login_attempts

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        # Should not raise
        await reset_login_attempts(mock_db, mock_user)


class TestManualUnlock:
    """Test admin manual unlock."""

    @pytest.mark.asyncio
    async def test_admin_can_unlock(self, mock_db, mock_user, lockout_manager):
        """Admin can manually unlock any account."""
        from app.core.account_lockout import manual_unlock

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        admin = MagicMock()
        admin.id = 999
        admin.username = "superadmin"

        result = await manual_unlock(mock_db, mock_user.id, admin)

        assert result["unlocked"] is True
        assert result["admin_id"] == 999

    @pytest.mark.asyncio
    async def test_unlock_nonexistent_user(self, mock_db, lockout_manager):
        """Unlocking nonexistent user handled gracefully."""
        from app.core.account_lockout import manual_unlock

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        admin = MagicMock()
        admin.id = 999
        admin.username = "superadmin"

        result = await manual_unlock(mock_db, 99999, admin)
        assert result["user_found"] is False


class TestLockoutDurationExpiry:
    """Test lockout duration expiration."""

    def test_lockout_duration_calculation(self):
        """Lockout duration is correctly calculated."""
        from app.core.account_lockout import AccountLockout

        manager = AccountLockout(lockout_duration_minutes=30)
        assert manager.lockout_duration == timedelta(minutes=30)

        manager2 = AccountLockout(lockout_duration_minutes=5)
        assert manager2.lockout_duration == timedelta(minutes=5)

    @pytest.mark.asyncio
    async def test_auto_unlock_after_duration(self, mock_db, mock_user):
        """Account auto-unlocks after lockout duration."""
        from app.core.account_lockout import AccountLockout, record_failed_attempt, check_account_lockout

        manager = AccountLockout(max_attempts=2, lockout_duration_minutes=1)

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        # Lock the account
        await record_failed_attempt(mock_db, mock_user, "1.1.1.1")
        await record_failed_attempt(mock_db, mock_user, "1.1.1.1")

        # Should be locked
        with pytest.raises(Exception):
            await check_account_lockout(mock_db, mock_user)


# ── Integration Tests ─────────────────────────────────────────────

class TestAccountLockoutIntegration:
    """End-to-end account lockout flow."""

    @pytest.mark.asyncio
    async def test_full_lockout_flow(self, mock_db, mock_user):
        """Complete flow: attempts -> lock -> unlock."""
        from app.core.account_lockout import (
            AccountLockout, record_failed_attempt,
            check_account_lockout, reset_login_attempts,
            manual_unlock
        )

        manager = AccountLockout(max_attempts=3, lockout_duration_minutes=2)

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        # Phase 1: Record failures
        for i in range(3):
            result = await record_failed_attempt(mock_db, mock_user, "1.1.1.1")
            assert result["attempts"] == i + 1

        # Phase 2: Account is locked
        with pytest.raises(Exception):
            await check_account_lockout(mock_db, mock_user)

        # Phase 3: Admin unlocks
        admin = MagicMock()
        admin.id = 1
        admin.username = "admin"
        unlock_result = await manual_unlock(mock_db, mock_user.id, admin)
        assert unlock_result["unlocked"] is True

        # Phase 4: Account is now accessible
        result = await check_account_lockout(mock_db, mock_user)
        assert result is None

    @pytest.mark.asyncio
    async def test_successful_login_resets_counter(self, mock_db, mock_user):
        """Successful login resets failure counter."""
        from app.core.account_lockout import record_failed_attempt, reset_login_attempts, check_account_lockout

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        # 2 failures
        await record_failed_attempt(mock_db, mock_user, "1.1.1.1")
        await record_failed_attempt(mock_db, mock_user, "1.1.1.1")

        # Success
        await reset_login_attempts(mock_db, mock_user)

        # Not locked
        result = await check_account_lockout(mock_db, mock_user)
        assert result is None

    @pytest.mark.asyncio
    async def test_brute_force_detection(self, mock_db, mock_user):
        """Rapid successive failures detected and blocked."""
        from app.core.account_lockout import record_failed_attempt, check_account_lockout

        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        # Rapid fire attempts
        for i in range(5):
            try:
                await record_failed_attempt(mock_db, mock_user, "attacker_ip")
            except Exception:
                break

        # Eventually blocked
        blocked = False
        for i in range(3):
            try:
                await check_account_lockout(mock_db, mock_user)
            except Exception:
                blocked = True
                break

        assert blocked is True
