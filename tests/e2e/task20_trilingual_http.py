# -*- coding: utf-8 -*-
"""QA task-20：三语（中/英/德）关键词搜索验证。

对 15 个关键词（中文5 + 英文5 + 德文5）分别 POST /openfoodfacts/search（realtime true/false）：
- 记录 data_source/total/items/off_error/mirror；
- 检查每个 item 的 product_name/full_ingredients/brand 是否含查询词或英文同义词；
- 记录相关率。

Run: backend\\venv\\Scripts\\python.exe tests/e2e/task20_trilingual_http.py
"""
import json
import os
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:8000"
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "task20_trilingual_http_results.json")

KEYWORDS: dict[str, list[str]] = {
    "zh": ["蛋白粉", "胶原蛋白肽", "维生素C", "益生菌", "鱼油"],
    "en": ["protein powder", "collagen peptide", "vitamin c", "probiotic", "fish oil"],
    "de": ["Eiweißpulver", "Kollagenpeptid", "Vitamin C", "Probiotika", "Fischöl"],
}

# 每类词对应的相关性同义词（英文为主，因 OFF 产品名多为英文）
RELEVANCE_TERMS: dict[str, list[str]] = {
    "protein powder": ["protein", "whey", "protein powder", "eiweiß", "proteinpulver"],
    "collagen peptide": ["collagen", "kollagen", "peptide", "collagen peptide"],
    "vitamin c": ["vitamin c", "ascorbic acid", "vitamin c"],
    "probiotic": ["probiotic", "probiotics", "probiotika"],
    "fish oil": ["fish oil", "omega-3", "fischöl", "fischol"],
}


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


def get_terms_for_query(q: str) -> list[str]:
    ql = q.lower()
    for key, terms in RELEVANCE_TERMS.items():
        if ql == key or key in ql or ql in key:
            return terms
    # 兜底：用查询词本身
    return [q]


def is_relevant(item: dict, terms: list[str]) -> bool:
    name = str(item.get("product_name") or "").lower()
    brand = str(item.get("brand") or "").lower()
    ing = str(item.get("full_ingredients") or "").lower()
    category = str(item.get("category") or "").lower()
    haystack = f"{name} {brand} {ing} {category}"
    return any(t.lower() in haystack for t in terms)


def main() -> int:
    report = {"base": BASE, "results": {}}
    for lang, kws in KEYWORDS.items():
        report["results"][lang] = {}
        for kw in kws:
            entry = {}
            for rt in (True, False):
                status, data = post(f"{BASE}/api/v1/databases/openfoodfacts/search", {"query": kw, "realtime": rt})
                items = (data or {}).get("items") or []
                terms = get_terms_for_query(kw)
                relevant = [it for it in items if is_relevant(it, terms)]
                rec = {
                    "http_status": status,
                    "data_source": (data or {}).get("data_source"),
                    "total": (data or {}).get("total"),
                    "off_total": (data or {}).get("off_total"),
                    "off_error": (data or {}).get("off_error"),
                    "mirror": (data or {}).get("mirror"),
                    "items_count": len(items),
                    "relevant_count": len(relevant),
                    "relevance_ratio": round(len(relevant) / len(items), 2) if items else 0.0,
                    "first_items": [
                        {
                            "product_name": (it.get("product_name") or "")[:45],
                            "brand": (it.get("brand") or "")[:20],
                            "relevant": is_relevant(it, terms),
                        }
                        for it in items[:5]
                    ],
                }
                entry["realtime_true" if rt else "realtime_false"] = rec
                print(json.dumps({"lang": lang, "kw": kw, "rt": rt, **rec}, ensure_ascii=False))
            report["results"][lang][kw] = entry

    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
    print("Results written to", OUTPUT_FILE)
    return 0


if __name__ == "__main__":
    sys.exit(main())