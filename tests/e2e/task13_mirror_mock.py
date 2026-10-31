# -*- coding: utf-8 -*-
"""QA task-13 辅助：镜像故障转移 mock 验证（针对当前已实现的 _parallel_probe_mirrors）。

模拟：第一个镜像 world.openfoodfacts.org 返回 503，第二个镜像 world-en.openfoodfacts.org
返回成功 → _realtime_category_search 仍应返回产品（data_source=openfoodfacts_api）。
注意：task-10 的 OFF_BASE_URLS 正式实现尚未落地，本脚本验证的是当前代码中的镜像探测逻辑。

Run: backend\\venv\\Scripts\\python.exe tests/e2e/task13_mirror_mock.py
"""
import asyncio
import sys

sys.path.insert(0, r"D:\RMFOODFP\backend")

import httpx  # noqa: E402


def make_response(status: int, url: str, payload: dict | None = None) -> httpx.Response:
    req = httpx.Request("GET", url)
    return httpx.Response(status, request=req, json=payload or {})


async def main() -> None:
    from app.services.data_sources.openfoodfacts_client import OFFDataService

    service = OFFDataService()
    real_get = service.client._http_client.get

    def fake_get(url: str, *args, **kwargs):  # noqa: ANN001
        if "world.openfoodfacts.org" in url and "world-en" not in url:
            # 第一个镜像：503
            resp = make_response(503, url)
            resp.raise_for_status()
        # 第二个镜像（world-en）走真实请求（可达时返回数据）
        return real_get(url, *args, **kwargs)

    service.client._http_client.get = fake_get
    try:
        result = await service._realtime_category_search("en:collagen-supplements", page=1, page_size=20)
        print("data_source:", result.get("data_source"))
        print("total:", result.get("total"))
        print("items_count:", len(result.get("items") or []))
        for it in (result.get("items") or [])[:5]:
            print("  -", it.get("id"), "|", it.get("brand"), "|", (it.get("product_name") or "")[:50])
        ok = result.get("data_source") == "openfoodfacts_api" and len(result.get("items") or []) > 0
        print("RESULT:", "PASS（首个镜像 503 时切换到 world-en 成功）" if ok else "FAIL")
        return 0 if ok else 1
    finally:
        service.client._http_client.get = real_get


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))