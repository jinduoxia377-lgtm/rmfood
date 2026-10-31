# -*- coding: utf-8 -*-
"""QA task-13：OFF_BASE_URLS 环境变量 + 镜像故障转移 mock 验证（服务层，磁盘新代码）。

设置 OFF_BASE_URLS = "https://bad.example.com,https://fr.openfoodfacts.org"，
mock OFFClient.search_by_keyword：bad.example.com 抛 503，fr.openfoodfacts.org 返回产品。
验证 _search_mirrors 自动切换镜像并返回产品；随后验证 _realtime_search 输出 openfoodfacts_api。

Run: backend\\venv\\Scripts\\python.exe tests/e2e/task13_mirror_env_mock.py
"""
import asyncio
import os
import sys

os.environ["OFF_BASE_URLS"] = "https://bad.example.com,https://fr.openfoodfacts.org"
sys.path.insert(0, r"D:\RMFOODFP\backend")

import httpx  # noqa: E402


def fake_off_response() -> dict:
    return {
        "count": 12345,
        "page": 1,
        "page_size": 20,
        "products": [
            {
                "code": "3017620422003",
                "product_name": "Collagen Peptides Powder",
                "brands": "Vital Proteins",
                "ingredients_text": "Collagen peptides",
                "categories_tags": ["en:supplements", "en:collagen"],
                "quantity": "300 g",
            },
            {
                "code": "1234567890123",
                "product_name": "胶原蛋白肽果味饮",
                "brands": "SomeBrand",
                "ingredients_text": "胶原蛋白肽, water",
                "categories_tags": ["en:beverages"],
                "quantity": "50 ml",
            },
        ],
    }


async def main() -> None:
    from app.services.data_sources.openfoodfacts.config import OFFConfig
    from app.services.data_sources.openfoodfacts_client import OFFDataService

    print("OFF_BASE_URLS ->", OFFConfig().MIRROR_URLS)

    service = OFFDataService()

    def fake_search(keyword, page=1, page_size=20, fields=None, brand=None, category_tag=None, base_url=None):
        if "bad.example.com" in (base_url or ""):
            resp = httpx.Response(503, request=httpx.Request("GET", base_url))
            resp.raise_for_status()
        return fake_off_response()

    service.client.search_by_keyword = fake_search
    try:
        result = await service._realtime_search("胶原蛋白肽", page=1, page_size=20)
        print("data_source:", result.get("data_source"))
        print("mirror used:", result.get("mirror"))
        print("total:", result.get("total"), "| off_total:", result.get("off_total"))
        print("items_count:", len(result.get("items") or []))
        for it in (result.get("items") or [])[:5]:
            print("  -", it.get("id"), "|", it.get("brand"), "|", (it.get("product_name") or "")[:50])
        ok = (
            result.get("data_source") == "openfoodfacts_api"
            and "fr.openfoodfacts.org" in (result.get("mirror") or "")
            and len(result.get("items") or []) > 0
        )
        print("metrics mirror_failures:", service._metrics["mirror_failures"])
        print("RESULT:", "PASS（OFF_BASE_URLS 生效，bad 镜像 503 自动切换到 fr 镜像）" if ok else "FAIL")
        return 0 if ok else 1
    finally:
        os.environ.pop("OFF_BASE_URLS", None)


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))