# -*- coding: utf-8 -*-
"""QA task-17：HTTP 搜索相关性验证（task-14 前基线）。

对 8 个关键词分别 POST /openfoodfacts/search（realtime true/false）：
- 记录 data_source/total/items 数；
- 对每个 item 检查相关性：product_name / full_ingredients / brand 是否含查询词或同义词；
- 计算相关率（相关 items / 总 items）；total 应为相关数而非百万级（task-14 后验证）。

Run: backend\\venv\\Scripts\\python.exe tests/e2e/task17_http_relevance.py
"""
import json
import os
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:8000"
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "task17_http_relevance_results.json")

# 关键词 → 相关同义词（按 task 要求）
SYNONYMS: dict[str, list[str]] = {
    "蛋白粉": ["protein", "protein powder", "whey", "蛋白粉", "蛋白质", "乳清蛋白", "大豆蛋白"],
    "胶原蛋白肽": ["collagen", "collagen peptide", "胶原蛋白", "胶原蛋白肽", "peptide"],
    "维生素C": ["vitamin c", "ascorbic acid", "维生素c", "维生素 c"],
    "钙片": ["calcium", "钙片", "碳酸钙", "钙"],
    "益生菌": ["probiotic", "probiotics", "益生菌"],
    "鱼油": ["fish oil", "omega-3", "omega 3", "鱼油"],
    "褪黑素": ["melatonin", "褪黑素"],
    "Nutella": ["nutella", "榛子巧克力酱", "可可榛子"],
}

KEYWORDS = list(SYNONYMS.keys())


def post(url: str, payload: dict) -> tuple:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json; charset=utf-8"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, {"_error": e.read().decode("utf-8", errors="replace")[:300]}
    except Exception as e:  # noqa: BLE001
        return 0, {"_exception": repr(e)}


def is_relevant(item: dict, synonyms: list[str]) -> bool:
    """按任务要求：仅检查 product_name / full_ingredients / brand 是否含查询词/同义词。"""
    name = str(item.get("product_name") or "").lower()
    brand = str(item.get("brand") or "").lower()
    ing = str(item.get("full_ingredients") or "").lower()
    category = str(item.get("category") or "").lower()
    haystack = f"{name} {brand} {ing} {category}"
    return any(s.lower() in haystack for s in synonyms)


def main() -> int:
    report = {"base": BASE, "results": {}}
    for kw in KEYWORDS:
        entry = {"realtime_true": None, "realtime_false": None}
        for rt in (True, False):
            status, data = post(f"{BASE}/api/v1/databases/openfoodfacts/search", {"query": kw, "realtime": rt})
            items = (data or {}).get("items") or []
            relevant = [it for it in items if is_relevant(it, SYNONYMS[kw])]
            entry["realtime_true" if rt else "realtime_false"] = {
                "http_status": status,
                "data_source": (data or {}).get("data_source"),
                "total": (data or {}).get("total"),
                "off_total": (data or {}).get("off_total"),
                "off_error": (data or {}).get("off_error"),
                "items_count": len(items),
                "relevant_count": len(relevant),
                "relevance_ratio": round(len(relevant) / len(items), 2) if items else 0.0,
                "first_items": [
                    {
                        "product_name": (it.get("product_name") or "")[:50],
                        "brand": (it.get("brand") or "")[:25],
                        "relevant": is_relevant(it, SYNONYMS[kw]),
                    }
                    for it in items[:6]
                ],
            }
            print(json.dumps({kw: entry["realtime_true" if rt else "realtime_false"]}, ensure_ascii=False))
        report["results"][kw] = entry

    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
    print("Results written to", OUTPUT_FILE)
    return 0


if __name__ == "__main__":
    sys.exit(main())