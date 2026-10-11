# -*- coding: utf-8 -*-
"""迁移：search_history/search_recent_views/import_tasks 建表 + 补齐模型缺失列
运行: python backend/scripts/migrate_missing_columns.py
"""
import sys, os, asyncio
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from sqlalchemy import text
from app.core.database.session import async_session_factory

MIGRATIONS = {
    "api_keys": ["ADD COLUMN IF NOT EXISTS organization_id BIGINT",
                 "ADD COLUMN IF NOT EXISTS permissions JSON DEFAULT '[]'::json",
                 "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()"],
    "webhooks": ["ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
                 "ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ",
                 "ADD COLUMN IF NOT EXISTS organization_id BIGINT"],
    "webhook_deliveries": ["ADD COLUMN IF NOT EXISTS http_status INTEGER",
                           "ADD COLUMN IF NOT EXISTS status VARCHAR(50)",
                           "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()"],
    "notification_preferences": ["ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN DEFAULT TRUE",
                                 "ADD COLUMN IF NOT EXISTS in_app_enabled BOOLEAN DEFAULT TRUE",
                                 "ADD COLUMN IF NOT EXISTS settings JSON DEFAULT '{}'::json",
                                 "ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN DEFAULT FALSE"],
    "organization_members": ["ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()",
                             "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()"],
    "teams": ["ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE",
              "ADD COLUMN IF NOT EXISTS owner_id BIGINT",
              "ADD COLUMN IF NOT EXISTS settings JSON DEFAULT '{}'::json",
              "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()"],
    "tcm_herbs_pd": ["ADD COLUMN IF NOT EXISTS \"EC50\" DOUBLE PRECISION",
                     "ADD COLUMN IF NOT EXISTS \"E_max\" DOUBLE PRECISION",
                     "ADD COLUMN IF NOT EXISTS \"E_max_source\" VARCHAR(100)",
                     "ADD COLUMN IF NOT EXISTS \"Hill\" DOUBLE PRECISION"],
}

async def main():
    async with async_session_factory() as db:
        await db.execute(text("CREATE TABLE IF NOT EXISTS search_history (id BIGSERIAL PRIMARY KEY, user_id BIGINT, query TEXT NOT NULL, result_count INTEGER DEFAULT 0, filters JSON, source VARCHAR(50), search_type VARCHAR(50), created_at TIMESTAMPTZ DEFAULT now())"))
        await db.execute(text("CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(created_at)"))
        await db.execute(text("CREATE TABLE IF NOT EXISTS search_recent_views (id BIGSERIAL PRIMARY KEY, user_id BIGINT, item_type VARCHAR(50), item_id BIGINT, created_at TIMESTAMPTZ DEFAULT now())"))
        await db.execute(text("CREATE INDEX IF NOT EXISTS idx_srv_user ON search_recent_views(user_id)"))
        await db.execute(text("CREATE TABLE IF NOT EXISTS import_tasks (task_id VARCHAR(100) PRIMARY KEY, user_id BIGINT, adapter_type VARCHAR(100), target_table VARCHAR(100), status VARCHAR(50), total_rows INTEGER DEFAULT 0, processed_rows INTEGER DEFAULT 0, inserted_rows INTEGER DEFAULT 0, updated_rows INTEGER DEFAULT 0, error_rows INTEGER DEFAULT 0, progress_pct FLOAT DEFAULT 0, error_summary TEXT, file_name VARCHAR(500), file_size_bytes BIGINT, mapping_config JSON, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())"))
        await db.execute(text("CREATE INDEX IF NOT EXISTS idx_import_tasks_user ON import_tasks(user_id)"))
        for tbl, stmts in MIGRATIONS.items():
            for stmt in stmts:
                await db.execute(text(f"ALTER TABLE {tbl} {stmt}"))
        await db.commit()
        print("迁移完成")

if __name__ == "__main__":
    asyncio.run(main())
