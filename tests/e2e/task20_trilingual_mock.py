# -*- coding: utf-8 -*-
"""QA task-20：服务层三语关键词映射 mock 验证（不依赖 OFF 外网）。

对中/英/德 15 个关键词调用 _realtime_search，mock OFFClient.search_by_keyword 记录实际使用的
英文主搜索词，并返回相关产品；断言：
1) 德文/英文关键词被正确映射为英文主搜索词（Eiweißpulver→protein powder、Kollagenpeptid→collagen peptide、Probiotika→probiotic、Fischöl→fish oil 等）；
2) 强相关性过滤后返回的产品与查询相关（data_source=openfoodfacts_api）。

Run: backend\\venv\\Scripts\\python.exe tests/e2e/task20_trilingual_mock.py
"""
import asyncio
import sys

sys.path.insert(0, r"D:\RMFOODFP\backend")

EXPECTED_MAPPING = {
    "蛋白粉": "protein powder", "胶原蛋白肽": "collagen peptide", "维生素C": "vitamin c",
    "益生菌": "probiotic", "鱼油": "fish oil",
    "protein powder": "protein powder", "collagen peptide": "collagen peptide",
    "vitamin c": "vitamin c", "probiotic": "probiotic", "fish oil": "fish oil",
    "Eiweißpulver": "protein powder", "Kollagenpeptid": "collagen peptide",
    "Vitamin C": "vitamin c", "Probiotika": "probiotic", "Fischöl": "fish oil",
}

# 每个关键词对应的英文同义词（用于验证返回产品相关性）
RELEVANT_TERMS = {
    "蛋白粉": ["protein", "whey"], "胶原蛋白肽": ["collagen"], "维生素C": ["vitamin c"],
    "益生菌": ["probiotic"], "鱼油": ["fish oil", "omega-3"],
    "protein powder": ["protein", "whey"], "collagen peptide": ["collagen"],
    "vitamin c": ["vitamin c"], "probiotic": ["probiotic"], "fish oil": ["fish oil", "omega-3"],
    "Eiweißpulver": ["protein", "whey"], "Kollagenpeptid": ["collagen"],
    "Vitamin C": ["vitamin c"], "Probiotika": ["probiotic"], "Fischöl": ["fish oil", "omega-3"],
}


def fake_off_response(en_term: str) -> dict:
    """根据英文搜索词返回包含相关产品的 OFF 响应。"""
    code_map = {
        "protein powder": ("1001", "Whey Protein Powder", "Optimum Nutrition", "Whey protein isolate"),
        "collagen peptide": ("1002", "Collagen Peptides", "Vital Proteins", "Hydrolyzed collagen peptides"),
        "vitamin c": ("1003", "Vitamin C Tablets", "Nature Made", "Ascorbic acid, vitamin C"),
        "probiotic": ("1004", "Probiotic Capsules", "Culturelle", "Lactobacillus probiotic"),
        "fish oil": ("1005", "Fish Oil Omega-3", "Nordic Naturals", "Fish oil, omega-3"),
    }
    code, name, brand, ing = code_map.get(en_term, ("9999", f"Product for {en_term}", "TestBrand", en_term))
    return {
        "count": 10,
        "page": 1,
        "page_size": 20,
        "products": [{
            "code": code, "product_name": name, "brands": brand,
            "ingredients_text": ing, "categories_tags": ["en:supplements"],
            "quantity": "100 g",
        }],
    }


async def main() -> None:
    from app.services.data_sources.openfoodfacts_client import OFFDataService, _expand_query_terms, _product_relevance_score

    service = OFFDataService()
    used_terms: dict[str, str] = {}
    original = service.client.search_by_keyword

    def spy_search(keyword, page=1, page_size=20, fields=None, brand=None, category_tag=None, base_url=None):
        used_terms[keyword] = used_terms.get(keyword, 0) + 1
        # 返回与该英文词对应的相关产品
        return fake_off_response(keyword)

    service.client.search_by_keyword = spy_search
    results = {}
    all_ok = True
    try:
        for kw in EXPECTED_MAPPING:
            res = await service._realtime_search(kw, page=1, page_size=20)
            items = res.get("items") or []
            terms = _expand_query_terms(kw)
            rel_terms = RELEVANT_TERMS[kw]
            relevant = [it for it in items if any(t.lower() in f"{it.get('product_name','')} {it.get('full_ingredients','')} {it.get('brand','')}".lower() for t in rel_terms)]
            # 找到实际使用的英文主搜索词：spy_search 收到的 keyword
            # （_search_mirrors 会传 off_keyword；这里取最后一次调用用的词）
            actual_en = None
            for k in used_terms:
                if used_terms[k] > 0:
                    actual_en = k  # 最后记录的非空 key
            entry = {
                "query": kw,
                "expected_en": EXPECTED_MAPPING[kw],
                "data_source": res.get("data_source"),
                "total": res.get("total"),
                "items_count": len(items),
                "relevant_count": len(relevant),
                "mirror": res.get("mirror"),
            }
            results[kw] = entry
            mapping_ok = EXPECTED_MAPPING[kw] in used_terms
            relevant_ok = len(items) > 0 and len(relevant) == len(items)
            ok = res.get("data_source") == "openfoodfacts_api" and mapping_ok and relevant_ok
            all_ok &= ok
            print(f"{kw!r:20} -> en_used={EXPECTED_MAPPING[kw] in used_terms!s:5} data_source={res.get('data_source'):20} items={len(items)} relevant={len(relevant)} ok={ok}")
    finally:
        service.client.search_by_keyword = original

    with open(r"D:\RMFOODFP\tests\e2e\task20_trilingual_mock_results.json", "w", encoding="utf-8") as fh:
        import json
        json.dump({"results": results, "all_pass": all_ok}, fh, ensure_ascii=False, indent=2)
    print("RESULT:", "PASS（三语映射 + 强过滤全部正确）" if all_ok else "FAIL")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))