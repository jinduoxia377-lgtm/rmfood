"""Fix workflow_tasks table to match WorkflowTask model"""
import asyncio
from app.core.database.session import get_session_factory
from sqlalchemy import text

async def migrate():
    async with get_session_factory()() as db:
        # Check current columns
        result = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'workflow_tasks' ORDER BY ordinal_position"))
        existing = {row[0] for row in result.fetchall()}
        print(f"Current columns: {sorted(existing)}")

        # Add missing columns
        additions = [
            ("step_order", "INTEGER NOT NULL DEFAULT 0"),
            ("task_type", "VARCHAR(50) NOT NULL DEFAULT 'general'"),
            ("input_data", "JSON DEFAULT '{}'::json"),
            ("output_data", "JSON DEFAULT '{}'::json"),
            ("duration_ms", "INTEGER"),
        ]

        for col_name, col_def in additions:
            if col_name not in existing:
                try:
                    await db.execute(text(f"ALTER TABLE workflow_tasks ADD COLUMN {col_name} {col_def}"))
                    print(f"  Added: {col_name}")
                except Exception as e:
                    print(f"  Skip {col_name}: {e}")
            else:
                print(f"  Exists: {col_name}")

        await db.commit()

        # Verify
        result2 = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'workflow_tasks' ORDER BY ordinal_position"))
        final = [row[0] for row in result2.fetchall()]
        print(f"\nFinal columns: {final}")

if __name__ == "__main__":
    asyncio.run(migrate())
