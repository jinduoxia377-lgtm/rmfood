"""
Test-helper factory for backend/tests/api/* — single source of truth.

Replaces the per-file make_unique_id() / create_test_user() / cleanup_test_user()
triplets that polluted the shared production users table.

Usage in a test module:
    from tests._test_helpers import test_user_factory, cleanup_factory

    factory = test_user_factory(db, email_prefix="bot", username_prefix="botuser")
    user = factory()                       # auto-tracks the new user id
    ...
    cleanup_factory()                      # optional immediate delete
    # OR rely on the conftest session finalizer to sweep tracked ids.

Id band: 90,000,000 .. 99,999,999
  - Below INT32_MAX (2,147,483,647) → no numeric overflow in any int32 column.
  - Far above production ids (≤10)  → zero collision risk with real accounts.
"""
from __future__ import annotations

import uuid
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

# ── id band ─────────────────────────────────────────────────────────────────
TEST_USER_ID_MIN = 90_000_000
TEST_USER_ID_MAX = 99_999_999
_ID_RANGE = TEST_USER_ID_MAX - TEST_USER_ID_MIN + 1


def make_test_user_id() -> int:
    """Random user id in [90,000,000, 99,999,999]."""
    return TEST_USER_ID_MIN + abs(hash(uuid.uuid4().hex)) % _ID_RANGE


# ── tracker: every id we create, so conftest can sweep at session end ─────
_TRACKED_USER_IDS: list[int] = []


def get_tracked_user_ids() -> list[int]:
    return list(_TRACKED_USER_IDS)


def clear_tracked_user_ids() -> None:
    _TRACKED_USER_IDS.clear()


def _track(user_id: int) -> None:
    _TRACKED_USER_IDS.append(user_id)


# ── factory (returns a callable for ergonomic one-shot use) ────────────────
def test_user_factory(
    db: AsyncSession,
    *,
    email_prefix: str = "test",
    username_prefix: str = "testuser",
    role: str = "researcher",
    is_active: bool = True,
    user_id: int | None = None,
) -> Callable[[], "User"]:
    """
    Return a zero-arg callable that creates + tracks a test user.

    Example:
        user = test_user_factory(db, email_prefix="bot", username_prefix="botuser")()
    """
    from app.models import User

    def _create() -> User:
        uid = user_id if user_id is not None else make_test_user_id()
        u = User(
            id=uid,
            email=f"{email_prefix}{uid}@example.com",
            username=f"{username_prefix}{uid}",
            hashed_password="hashed_password",
            is_active=is_active,
            role=role,
        )
        db.add(u)
        _track(uid)
        return u

    return _create


def cleanup_factory(db: AsyncSession, user_id: int) -> Callable[[], None]:
    """Return a zero-arg callable that deletes one test user immediately."""
    from sqlalchemy import delete as sa_delete
    from app.models import User

    def _delete() -> None:
        import asyncio

        async def _do():
            await db.execute(sa_delete(User).where(User.id == user_id))
            await db.commit()

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        loop.run_until_complete(_do())

    return _delete
