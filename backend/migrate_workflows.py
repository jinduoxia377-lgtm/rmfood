"""
修复 workflows 表结构以匹配 Workflow 模型
"""
import asyncio
from app.core.database.session import get_session_factory
from sqlalchemy import text

async def migrate():
    async with get_session_factory()() as db:
        # Step 1: Check current columns
        result = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'workflows' ORDER BY ordinal_position"))
        existing = {row[0] for row in result.fetchall()}
        print(f"Current columns: {sorted(existing)}")

        # Step 2: Add missing columns one by one
        additions = [
            ("workflow_type", "VARCHAR(50) NOT NULL DEFAULT 'formula_validation'"),
            ("config", "JSON DEFAULT '{}'::json"),
            ("result", "JSON DEFAULT '{}'::json"),
            ("error_message", "TEXT"),
            ("created_by", "BIGINT REFERENCES users(id)"),
        ]

        for col_name, col_def in additions:
            if col_name not in existing:
                try:
                    await db.execute(text(f"ALTER TABLE workflows ADD COLUMN {col_name} {col_def}"))
                    print(f"  Added: {col_name}")
                except Exception as e:
                    print(f"  Skip {col_name}: {e}")
            else:
                print(f"  Exists: {col_name}")

        await db.commit()

        # Step 3: Drop old columns that are no longer needed (optional)
        # We keep them to preserve existing data

        # Step 4: Verify
        result2 = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'workflows' ORDER BY ordinal_position"))
        final = [row[0] for row in result2.fetchall()]
        print(f"\nFinal columns: {final}")

        # Step 5: Check workflow_tasks
        result3 = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'workflow_tasks' ORDER BY ordinal_position"))
        task_cols = [row[0] for row in result3.fetchall()]
        print(f"\nworkflow_tasks columns: {task_cols}")

        # Step 6: Check formula_ingredients
        result4 = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'formula_ingredients' ORDER BY ordinal_position"))
        ing_cols = [row[0] for row in result4.fetchall()]
        print(f"formula_ingredients columns: {ing_cols}")

if __name__ == "__main__":
    asyncio.run(migrate())
