"""幂等应用 DS Bot 迁移（ai_bots / ai_bot_memories / chat_sessions.bot_id）

背景：alembic 历史存在重叠 head（20260926_000000 与 20260925_000000 路径重叠），
无法通过 `alembic upgrade head` 走通。本脚本直接执行等价 DDL（全部幂等），
并将版本号 20261013_000000 写入 alembic_version 表，保证后续迁移可追踪。

用法：
    cd backend && venv\\Scripts\\python -m scripts.apply_bot_migration
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from app.core.database.session import async_session_factory

DDL = [
    # ── ai_bots 表 ──
    """
    CREATE TABLE IF NOT EXISTS ai_bots (
        id BIGSERIAL PRIMARY KEY,
        tenant_id BIGINT NOT NULL,
        created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        avatar VARCHAR(500),
        description VARCHAR(500),
        persona_prompt TEXT NOT NULL,
        model_config_id BIGINT REFERENCES ai_model_configs(id) ON DELETE SET NULL,
        model_type VARCHAR(64) NOT NULL DEFAULT 'llm',
        provider VARCHAR(64),
        model_id VARCHAR(128),
        temperature DOUBLE PRECISION NOT NULL DEFAULT 0.7,
        max_tokens INTEGER NOT NULL DEFAULT 4096,
        capabilities JSONB NOT NULL DEFAULT '[]',
        is_chief BOOLEAN NOT NULL DEFAULT FALSE,
        is_system BOOLEAN NOT NULL DEFAULT FALSE,
        visibility VARCHAR(20) NOT NULL DEFAULT 'private',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_ai_bots_tenant_id ON ai_bots (tenant_id);",
    "CREATE INDEX IF NOT EXISTS ix_ai_bots_deleted_at ON ai_bots (deleted_at);",
    "CREATE INDEX IF NOT EXISTS ix_ai_bots_tenant_status ON ai_bots (tenant_id, status);",
    "CREATE INDEX IF NOT EXISTS ix_ai_bots_tenant_creator ON ai_bots (tenant_id, created_by);",
    # ── ai_bot_memories 表 ──
    """
    CREATE TABLE IF NOT EXISTS ai_bot_memories (
        id BIGSERIAL PRIMARY KEY,
        bot_id BIGINT NOT NULL REFERENCES ai_bots(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        memory_type VARCHAR(20) NOT NULL DEFAULT 'preference',
        content TEXT NOT NULL,
        importance INTEGER NOT NULL DEFAULT 3,
        source VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_ai_bot_memories_bot_id ON ai_bot_memories (bot_id);",
    "CREATE INDEX IF NOT EXISTS ix_ai_bot_memories_user_id ON ai_bot_memories (user_id);",
    "CREATE INDEX IF NOT EXISTS ix_ai_bot_memories_bot_user ON ai_bot_memories (bot_id, user_id);",
    # ── 群聊协作表（Phase 2）──
    """
    CREATE TABLE IF NOT EXISTS ai_bot_group_sessions (
        id BIGSERIAL PRIMARY KEY,
        tenant_id BIGINT NOT NULL,
        name VARCHAR(100) NOT NULL,
        chief_bot_id BIGINT NOT NULL REFERENCES ai_bots(id) ON DELETE SET NULL,
        created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_ai_bot_group_sessions_tenant_id ON ai_bot_group_sessions (tenant_id);",
    "CREATE INDEX IF NOT EXISTS ix_ai_bot_group_sessions_chief_bot_id ON ai_bot_group_sessions (chief_bot_id);",
    """
    CREATE TABLE IF NOT EXISTS ai_bot_group_members (
        id BIGSERIAL PRIMARY KEY,
        group_id BIGINT NOT NULL REFERENCES ai_bot_group_sessions(id) ON DELETE CASCADE,
        bot_id BIGINT NOT NULL REFERENCES ai_bots(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_ai_bot_group_members_group_id ON ai_bot_group_members (group_id);",
    "CREATE INDEX IF NOT EXISTS ix_ai_bot_group_members_bot_id ON ai_bot_group_members (bot_id);",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_ai_bot_group_members_group_bot ON ai_bot_group_members (group_id, bot_id);",
    """
    CREATE TABLE IF NOT EXISTS ai_bot_group_messages (
        id BIGSERIAL PRIMARY KEY,
        group_id BIGINT NOT NULL REFERENCES ai_bot_group_sessions(id) ON DELETE CASCADE,
        sender_type VARCHAR(10) NOT NULL DEFAULT 'user',
        sender_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        sender_bot_id BIGINT REFERENCES ai_bots(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        reply_to BIGINT,
        mentioned_bot_ids JSONB DEFAULT '[]',
        task_execution_id VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    "CREATE INDEX IF NOT EXISTS ix_ai_bot_group_messages_group_id ON ai_bot_group_messages (group_id);",
    "CREATE INDEX IF NOT EXISTS ix_ai_bot_group_messages_created_at ON ai_bot_group_messages (created_at);",
    # ── chat_sessions 增加 bot_id ──
    "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS bot_id BIGINT;",
    "CREATE INDEX IF NOT EXISTS ix_chat_sessions_bot_id ON chat_sessions (bot_id);",
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_chat_sessions_bot_id_ai_bots'
        ) THEN
            ALTER TABLE chat_sessions
                ADD CONSTRAINT fk_chat_sessions_bot_id_ai_bots
                FOREIGN KEY (bot_id) REFERENCES ai_bots(id) ON DELETE SET NULL;
        END IF;
    END $$;
    """,
]

VERSION = "20261013_000000"


async def main() -> None:
    async with async_session_factory() as db:
        for stmt in DDL:
            await db.execute(text(stmt))
        # 记录版本号（幂等）
        await db.execute(
            text(
                "INSERT INTO alembic_version (version_num) VALUES (:v) "
                "ON CONFLICT (version_num) DO NOTHING"
            ),
            {"v": VERSION},
        )
        await db.commit()
    print(f"BOT_MIGRATION_OK version={VERSION}")


if __name__ == "__main__":
    asyncio.run(main())