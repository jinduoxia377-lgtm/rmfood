"""为已存在的系统 Chief Bot 补丁 delegate 能力（幂等）。"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select, update

from app.core.database.session import async_session_factory
from app.models.bot import AIBot


async def main() -> None:
    async with async_session_factory() as db:
        chiefs = (await db.execute(
            select(AIBot).where(AIBot.is_chief.is_(True), AIBot.is_system.is_(True))
        )).scalars().all()
        updated = 0
        for chief in chiefs:
            caps = list(chief.capabilities or [])
            if "delegate" not in caps:
                caps.append("delegate")
                await db.execute(
                    update(AIBot).where(AIBot.id == chief.id).values(capabilities=caps)
                )
                updated += 1
        await db.commit()
        print(f"CHIEF_DELEGATE_PATCH_OK updated={updated}")


if __name__ == "__main__":
    asyncio.run(main())