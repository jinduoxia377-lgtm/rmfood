"""查看任务 43/44 群聊消息，定位 LLM 失败发生阶段。"""
import asyncio
from sqlalchemy import text
from app.core.database.session import async_session_factory


async def main() -> None:
    async with async_session_factory() as db:
        for tid in (43, 44):
            row = (await db.execute(text("SELECT group_id, task_content, error_message FROM ai_task_groups WHERE id=:id"), {"id": tid})).first()
            if not row:
                print(f"TASK {tid}: NOT FOUND")
                continue
            gid, content, err = row[0], row[1], row[2]
            print(f"\n=== TASK {tid} | content={(content or '').encode('unicode_escape').decode('ascii')} | err={(err or '').encode('unicode_escape').decode('ascii')} ===")
            msgs = (await db.execute(text(
                "SELECT sender_bot_id, sender_bot_name, left(content, 250) AS c FROM ai_bot_group_messages "
                "WHERE group_id=:g ORDER BY id ASC LIMIT 12"
            ), {"g": gid})).all()
            for m in msgs:
                print(f"[bot={m[0]} name={m[1]}] {(m[2] or '').encode('unicode_escape').decode('ascii')[:200]}")


if __name__ == "__main__":
    asyncio.run(main())