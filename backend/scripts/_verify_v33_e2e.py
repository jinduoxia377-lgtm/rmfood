"""v3.3 端到端实测：任务驱动自动建群 → 自动配人/招募 → 派单 → 汇总。"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx

BASE = "http://127.0.0.1:8000/api/v1"


async def main() -> None:
    async with httpx.AsyncClient(base_url=BASE, timeout=60, trust_env=False) as client:
        login = await client.post("/auth/login", json={"username": "admin", "password": "admin123"})
        token = login.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}

        # 1. 创建研发任务（不指定任何人员）
        resp = await client.post(
            "/tasks/auto-team",
            json={"content": "请设计一款助眠安神饮品配方，并做安全性审查与药食同源合规核查。", "constraints": {}},
            headers=headers,
        )
        print("AUTO_TEAM_STATUS:", resp.status_code)
        data = resp.json().get("data", {})
        print("TASK_ID:", data.get("task_id"))
        print("GROUP_ID:", data.get("group_id"))
        print("GROUP_NAME:", json.dumps(data.get("group_name", ""), ensure_ascii=True))
        print("MEMBERS:", data.get("members"))
        print("ROLES:", json.dumps(data.get("roles"), ensure_ascii=True))

        if not data.get("group_id"):
            print("BODY:", resp.text[:500])
            return

        gid = data["group_id"]
        # 2. 轮询消息流（最多 180 秒）
        for i in range(60):
            await asyncio.sleep(3)
            msgs = (await client.get(f"/groups/{gid}/messages?limit=100", headers=headers)).json()["items"]
            # 任务状态
            tasks = (await client.get("/tasks", headers=headers)).json()["items"]
            t = next((t for t in tasks if t["id"] == data["task_id"]), None)
            print(f"\n--- [{i*3}s] 消息数={len(msgs)} 任务状态={t['status'] if t else '?'} ---")
            for m in msgs:
                sender = "user" if m["sender_type"] == "user" else f"bot[{m.get('sender_bot_name') or ('#'+str(m['sender_bot_id']))}]"
                print(f"  {sender}: {json.dumps(m['content'][:80], ensure_ascii=True)}")
            if any(m["content"].startswith("【汇总】") for m in msgs):
                print("\n[OK] 自主派单完成")
                return
        print("TIMEOUT")


if __name__ == "__main__":
    asyncio.run(main())