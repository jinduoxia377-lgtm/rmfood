"""验证 P2/Phase3 新 API：usage stats + MCP servers CRUD。"""
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

        # 用量统计
        stats = await client.get("/usage/stats", headers=headers)
        print("USAGE_STATS:", stats.status_code, json.dumps(stats.json().get("today", {}), ensure_ascii=True))

        # MCP 服务器 CRUD
        create = await client.post(
            "/admin/mcp-servers",
            json={"name": "test_pubmed", "url": "http://localhost:9999/mcp", "transport": "http", "enabled": True},
            headers=headers,
        )
        print("MCP_CREATE:", create.status_code)
        mcp_id = create.json()["data"]["id"]
        print("MCP_ID:", mcp_id)

        lst = await client.get("/admin/mcp-servers", headers=headers)
        print("MCP_LIST:", lst.status_code, "count=", len(lst.json()["items"]))

        upd = await client.put(f"/admin/mcp-servers/{mcp_id}", json={"enabled": False}, headers=headers)
        print("MCP_UPDATE:", upd.status_code, "enabled=", upd.json()["data"]["enabled"])

        dl = await client.delete(f"/admin/mcp-servers/{mcp_id}", headers=headers)
        print("MCP_DELETE:", dl.status_code)


if __name__ == "__main__":
    asyncio.run(main())