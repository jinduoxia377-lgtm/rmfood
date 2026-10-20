"""
Test user / bot auto-cleaner — pytest plugin.

Prevents backend/tests/api/* from leaking fake users into the shared
production database. The 5 API test modules (bots / groups /
autodispatch / task_team / chat) each create test users with random
90M-99M band ids; this module:

  1. Tracks every test user id and test bot id at creation time.
  2. Registers a session-finalizer hook (via atexit, because pytest-
     asyncio closes its main event loop before session fixtures tear
     down, making it impossible to await DB calls inside a session
     fixture teardown).
  3. The finalizer runs in a fresh event loop and:
       a. Deletes all tracked test bot ids (FK → users, so delete bots first).
       b. Deletes all tracked test user ids.
       c. Runs a safety-net DELETE: any remaining users whose id is in
          the 90M-99M band AND whose username starts with a known test
          prefix — catching rows created by paths that forgot to
          register.

The atexit approach is safe even when tests fail, because atexit runs
on interpreter shutdown regardless of test outcomes.
"""
from __future__ import annotations

import asyncio
import atexit
import uuid

# 测试 ID 隔离区：[90,000,000, 99,999,999]
# - 上限 99,999,999 < INT32_MAX (2,147,483,647)，任何 int32 外键列不会溢出。
# - 下限 90,000,000 远大于生产 users.id (<=10)，与真实账户零冲突。
_TEST_USER_ID_MIN = 90_000_000
_TEST_USER_ID_MAX = 99_999_999
_TEST_USER_ID_RANGE = _TEST_USER_ID_MAX - _TEST_USER_ID_MIN + 1

# 已知的测试 username 前缀（安全网 SELECT 用）
_TEST_USERNAME_PREFIXES = ("botuser", "aduser", "grpuser", "ttuser", "testuser")


def make_test_user_id() -> int:
    """Generate a random user id in the [90M, 99M] isolation band."""
    return _TEST_USER_ID_MIN + abs(hash(uuid.uuid4().hex)) % _TEST_USER_ID_RANGE


# ── 全局跟踪表 ──────────────────────────────────────────────────────────────
_TRACKED_TEST_USER_IDS: list[int] = []
_TRACKED_TEST_BOT_IDS: list[int] = []
_SWEPT = False


def track_test_user(user_id: int) -> None:
    """Register a test user id for cleanup. Idempotent (by value)."""
    if user_id not in _TRACKED_TEST_USER_IDS:
        _TRACKED_TEST_USER_IDS.append(user_id)


def track_test_bot(bot_id: int) -> None:
    """Register a test bot id for cleanup. Idempotent (by value)."""
    if bot_id not in _TRACKED_TEST_BOT_IDS:
        _TRACKED_TEST_BOT_IDS.append(bot_id)


# ── 会话结束清理 ────────────────────────────────────────────────────────────
def _run_sweep() -> None:
    """Delete all tracked test users + bots + safety-net 90M band rows.

    Runs in a fresh asyncio loop (main loop is already closed by
    pytest-asyncio by the time atexit fires).
    """
    global _SWEPT
    if _SWEPT:
        return
    _SWEPT = True

    user_ids = list(_TRACKED_TEST_USER_IDS)
    bot_ids = list(_TRACKED_TEST_BOT_IDS)

    async def _do_sweep() -> None:
        from sqlalchemy import delete as sa_delete, or_, and_
        from app.models import User
        from app.api.deps import get_db_session

        async for db in get_db_session():
            # 1) Delete tracked bots first (FK → users.created_by/owner)
            if bot_ids:
                from app.models.bot import AIBot
                res = await db.execute(
                    sa_delete(AIBot).where(AIBot.id.in_(bot_ids))
                )
                print(f"[conftest-clean] deleted {res.rowcount} tracked test bots")

            # 2) Delete tracked test users
            if user_ids:
                res = await db.execute(
                    sa_delete(User).where(User.id.in_(user_ids))
                )
                print(f"[conftest-clean] deleted {res.rowcount} tracked test users")

            # 3) Safety net: any 90M-band user whose username matches a
            #    known test prefix (catches rows created before tracking
            #    was wired in, or by code paths that skipped track_test_user).
            like_clauses = [User.username.like(f"{p}%") for p in _TEST_USERNAME_PREFIXES]
            safety = and_(
                User.id >= _TEST_USER_ID_MIN,
                User.id <= _TEST_USER_ID_MAX,
                or_(*like_clauses),
            )
            res = await db.execute(sa_delete(User).where(safety))
            sn = res.rowcount
            if sn:
                print(f"[conftest-clean] safety-net deleted {sn} leftover test users in 90M band")

            await db.commit()

            # 4) Also clean up any test-owned child rows (FK to deleted users).
            #    These tables may not have ON DELETE CASCADE; do explicit deletes.
            for table, col in [
                ("chat_sessions", "user_id"),
                ("notifications", "user_id"),
                ("audit_logs", "user_id"),
                ("workflows", "created_by"),
                ("workflow_tasks", "assignee_id"),
                ("ai_bot_group_sessions", "created_by"),
            ]:
                try:
                    if user_ids:
                        await db.execute(
                            f"DELETE FROM {table} WHERE {col} = ANY(:ids)",
                            {"ids": user_ids},
                        )
                except Exception as e:
                    print(f"[conftest-clean] skip {table}.{col}: {str(e)[:80]}")

            await db.commit()

    # Run in a fresh loop; atexit fires after pytest-asyncio closed the main loop.
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_do_sweep())
    except Exception as e:
        print(f"[conftest-clean] sweep failed: {e}")
    finally:
        loop.close()


# ── pytest 钩子：注册 atexit 清理 ───────────────────────────────────────────
def pytest_configure(config) -> None:
    """Register the atexit sweep once per pytest session."""
    atexit.register(_run_sweep)


# ── 兼容别名：_clean_test_users.py 引用的名称 ────────────────────────────────
_register_test_user = track_test_user
_register_test_bot = track_test_bot
