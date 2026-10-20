"""诊断：最新任务错误信息与群聊消息。"""
import asyncio
from sqlalchemy import text
from app.core.database.session import async_session_factory


async def main() -> None:
    async with async_session_factory() as db:
        rows = (await db.execute(text(
            "SELECT id, task_content, status, error_message, created_at FROM ai_task_groups ORDER BY id DESC LIMIT 5"
        ))).all()
        print("=== 最近任务 ===")
        for r in rows:
            print(f"TASK {r.id} | status={r.status} | err={(r.error_message or '')[:300]} | content={(r.task_content or '')[:40]}")

        msgs = (await db.execute(text(
            "SELECT id, group_id, sender_bot_name, left(content, 200) AS c "
            "FROM ai_bot_group_messages ORDER BY id DESC LIMIT 8"
        ))).all()
        print("=== 最近消息 ===")
        for m in msgs:
            print(f"MSG {m.id} | group={m.group_id} | bot={m.sender_bot_name} | {(m.c or '')[:180]}")


if __name__ == "__main__":
    asyncio.run(main())