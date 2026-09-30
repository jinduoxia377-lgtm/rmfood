"""Fix workflow_tasks error_message column"""
import asyncio
from app.core.database.session import get_session_factory
from sqlalchemy import text

async def migrate():
    async with get_session_factory()() as db:
        try:
            await db.execute(text("ALTER TABLE workflow_tasks ADD COLUMN error_message TEXT"))
            print("Added error_message column")
        except Exception as e:
            err = str(e).lower()
            if "duplicate" in err or "already exists" in err:
                print("error_message column already exists")
            else:
                print(f"Error: {e}")
        await db.commit()

        result = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'workflow_tasks' ORDER BY ordinal_position"))
        cols = [row[0] for row in result.fetchall()]
        print(f"Final columns: {cols}")

if __name__ == "__main__":
    asyncio.run(migrate())
