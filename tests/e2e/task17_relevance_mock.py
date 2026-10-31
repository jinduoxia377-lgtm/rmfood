# -*- coding: utf-8 -*-
"""QA task-17 辅助：服务层相关性诊断 mock（当前磁盘代码 = task-14 前基线）。

模拟 OFF 返回「相关 + 无关」混合产品（如搜蛋白粉时返回乳清蛋白粉/植物蛋白粉 + 白奶酪/矿泉水/牛奶/饼干），
验证：
1) 当前 `_realtime_search` 只做相关性排序（_rank_relevant_items），**不过滤** → 无关产品仍被返回（基线缺陷）；
2) 若按 task-14 的强相关性过滤（_product_relevance_score > 0）→ 仅保留相关产品，total=相关数。

Run: backend\\venv\\Scripts\\python.exe tests/e2e/task17_relevance_mock.py
"""
import asyncio
import sys

sys.path.insert(0, r"D:\RMFOODFP\backend")


def fake_off_response() -> dict:
    """模拟 OFF 对英文词 'protein powder' 的返回：相关 + 无关混合。"""
    return {
        "count": 123456,
        "page": 1,
        "page_size": 40,
        "products": [
            {"code": "001", "product_name": "Whey Protein Powder", "brands": "Optimum Nutrition",
             "ingredients_text": "Whey protein isolate, chocolate flavor"},
            {"code": "002", "product_name": "植物蛋白粉 Plant Protein", "brands": "MyProtein",
             "ingredients_text": "pea protein, soy protein"},
            {"code": "003", "product_name": "原味白奶酪", "brands": "Milky Food Professional",
             "ingredients_text": "巴氏杀菌牛奶, 牛奶蛋白, 牛奶奶油, 乳酸菌发酵剂"},
            {"code": "004", "product_name": "天然矿泉水", "brands": "sidi ali",
             "ingredients_text": "100% 矿泉水"},
            {"code": "005", "product_name": "牛奶", "brands": "Jaouda",
             "ingredients_text": "巴氏杀菌新鲜半脱脂牛奶"},
            {"code": "006", "product_name": "Prince 全麦巧克力味", "brands": "Mondelez",
             "ingredients_text": "小麦粉, 糖, 巧克力"},
        ],
    }


async def main() -> None:
    from app.services.data_sources.openfoodfacts_client import (
        OFFDataService,
        _expand_query_terms,
        _product_relevance_score,
    )

    service = OFFDataService()
    service.client.search_by_keyword = lambda keyword, page=1, page_size=20, fields=None, brand=None, category_tag=None, base_url=None: fake_off_response()

    print("== 1) 当前 _realtime_search（仅排序，不过滤）==")
    result = await service._realtime_search("蛋白粉", page=1, page_size=20)
    items = result.get("items") or []
    print("data_source:", result.get("data_source"), "| total:", result.get("total"), "| off_total:", result.get("off_total"), "| items:", len(items))
    for it in items:
        score = _product_relevance_score(it, _expand_query_terms("蛋白粉"))
        print(f"  score={score} {it.get('product_name')!r} | brand={it.get('brand')!r}")

    print("\n== 2) 强相关性过滤（score>0 仅保留相关项）==")
    terms = _expand_query_terms("蛋白粉")
    print("expanded terms:", terms)
    relevant = [it for it in items if _product_relevance_score(it, terms) > 0]
    irrelevant = [it for it in items if _product_relevance_score(it, terms) <= 0]
    print("相关 items:", len(relevant))
    for it in relevant:
        print(f"  + {it.get('product_name')!r}")
    print("无关 items（应被过滤）:", len(irrelevant))
    for it in irrelevant:
        print(f"  - {it.get('product_name')!r}")
    print("\n结论：task-14 强过滤后 total 应为", len(relevant), "而非 OFF 原始 count。")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))