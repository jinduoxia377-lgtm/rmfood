"""全面诊断：任务状态/错误/消息/Bot/MCP/角色库。"""
import asyncio
from sqlalchemy import text
from app.core.database.session import async_session_factory


async def main() -> None:
    async with async_session_factory() as db:
        print("=== 最近任务 ===")
        rows = (await db.execute(text(
            "SELECT id, task_content, status, error_message, created_at FROM ai_task_groups ORDER BY id DESC LIMIT 10"
        ))).all()
        for r in rows:
            print(f"TASK {r.id} | {r.status} | err={(r.error_message or '')[:200]} | content={(r.task_content or '')[:30]}")

        print("=== 任务 37 群聊消息（若有） ===")
        row = (await db.execute(text("SELECT group_id FROM ai_task_groups WHERE id=37"))).first()
        if row:
            gid = row[0]
            msgs = (await db.execute(text(
                "SELECT sender_bot_id, sender_bot_name, left(content, 200) AS c FROM ai_bot_group_messages "
                "WHERE group_id=:g ORDER BY id ASC LIMIT 15"
            ), {"g": gid})).all()
            for m in msgs:
                print(f"[bot={m[0]} name={m[1]}] {(m[2] or '').encode('unicode_escape').decode('ascii')[:180]}")

        print("=== 运行中任务 ===")
        run = (await db.execute(text(
            "SELECT id, task_content, status, created_at FROM ai_task_groups WHERE status IN ('recruiting','dispatching')"
        ))).all()
        print("RUNNING:", [(r[0], r[1]) for r in run])

        print("=== 系统 Bot（非删除）===")
        bots = (await db.execute(text(
            "SELECT id, name, is_chief, is_system, left(capabilities::text,100) FROM ai_bots WHERE deleted_at IS NULL ORDER BY id"
        ))).all()
        for b in bots:
            print(f"BOT {b[0]} | {b[1]} | chief={b[2]} sys={b[3]} | caps={(b[4] or '')[:80]}")

        print("=== MCP 服务器 ===")
        mcps = (await db.execute(text(
            "SELECT id, name, transport, url, command, enabled FROM ai_mcp_servers ORDER BY id"
        ))).all()
        for m in mcps:
            print(f"MCP {m[0]} | {m[1]} | {m[2]} | url={(m[3] or '')[:40]} | cmd={(m[4] or '')[:30]} | enabled={m[5]}")


if __name__ == "__main__":
    asyncio.run(main())