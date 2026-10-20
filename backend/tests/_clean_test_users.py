"""
Shared helpers for backend/tests/api/* — single source of truth for
creating isolated test users + bots that are auto-swept after the
pytest session ends.

Why this module
---------------
5 API test modules (bots / groups / autodispatch / task_team / chat)
each have their own `create_test_user()` / `make_unique_id()` helpers
that write a RESEARCHER row into the SHARED production `users` table
with a huge random id and never delete it. The result: hundreds of
fake users accumulate in the production DB on every test run.

What this module does
---------------------
1. `make_test_user_id()` — id in [90,000,000, 99,999,999].
   - Upper bound < INT32_MAX (2,147,483,647) so no numeric overflow.
   - Far above production ids (<=10) so zero collision with real accounts.
2. `create_test_user()` — creates + commits + **tracks** the user id.
3. `create_test_bot()` — creates + commits + tracks the bot id.
4. The atexit finalizer in tests/conftest_clean_users.py runs a session-end
   DB sweep that DELETEs all tracked user/bot ids plus a safety-net
   DELETE on the 90M band.

Usage in a test module
----------------------
    from tests._clean_test_users import create_test_user, create_test_bot

    async def test_x(self):
        async for db in get_db_session():
            user = await create_test_user(db, email_prefix="bot",
                                          username_prefix="botuser")
            ...

No manual cleanup needed — the session sweep handles it.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.api.deps import get_db_session

# Re-export the track functions + id generator so callers only need one import line
from tests.conftest_clean_users import (
    track_test_user,
    track_test_bot,
    make_test_user_id,
)

__all__ = [
    "make_test_user_id",
    "create_test_user",
    "create_test_bot",
    "cleanup_test_user",
]


async def create_test_user(
    db: AsyncSession,
    user_id: int | None = None,
    *,
    email_prefix: str = "test",
    username_prefix: str = "testuser",
    role: str = "researcher",
    is_active: bool = True,
) -> User:
    """
    Create a test user in the shared production DB, track its id for
    session-end cleanup, and return the persisted user.

    The id is generated in [90,000,000, 99,999,999] unless explicitly
    provided (which must also fall in that band — callers should not
    pass production ids).
    """
    if user_id is None:
        user_id = make_test_user_id()

    # 幂等：清理同 ID 或同用户名/邮箱的历史残留（上次会话异常中断未 sweep 时可能冲突）
    from sqlalchemy import delete as sa_delete
    await db.execute(sa_delete(User).where(
        (User.id == user_id)
        | (User.username == f"{username_prefix}{user_id}")
        | (User.email == f"{email_prefix}{user_id}@example.com")
    ))
    await db.commit()

    user = User(
        id=user_id,
        email=f"{email_prefix}{user_id}@example.com",
        username=f"{username_prefix}{user_id}",
        hashed_password="hashed_password",
        is_active=is_active,
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    track_test_user(user.id)
    return user


async def create_test_bot(
    db: AsyncSession,
    owner_user_id: int,
    name: str,
    *,
    capabilities: list[str] | None = None,
    visibility: str = "private",
    status: str = "active",
    tenant_id: int = 1,
) -> "int":
    """
    Create a test AIBot owned by owner_user_id, track its id,
    and return the bot id.
    """
    from app.models.bot import AIBot

    bot = AIBot(
        tenant_id=tenant_id,
        created_by=owner_user_id,
        name=name,
        persona_prompt="测试 Bot 人设",
        visibility=visibility,
        status=status,
        capabilities=capabilities or [],
    )
    db.add(bot)
    await db.commit()
    await db.refresh(bot)
    track_test_bot(bot.id)
    return bot.id


def cleanup_test_user(user_id: int) -> None:
    """
    Immediately delete a single test user (synchronous wrapper).
    Use this when you need to clean up before the session sweep,
    e.g. inside a `finally` block for precise resource control.
    The session sweep is a safety net; this is optional.
    """
    import asyncio
    from sqlalchemy import delete as sa_delete

    async def _do():
        async for db in get_db_session():
            await db.execute(sa_delete(User).where(User.id == user_id))
            await db.commit()

    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError
        loop.run_until_complete(_do())
    except RuntimeError:
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_do())
        finally:
            loop.close()
