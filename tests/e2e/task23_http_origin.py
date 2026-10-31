# -*- coding: utf-8 -*-
"""QA task-23：数据来源透明化 HTTP 验证。

1) 搜索 蛋白粉/胶原蛋白肽/维生素C（origin=all）→ 每个 item 含 data_origin：
   manual→local_reference，OFF→internet_realtime/internet_cache；
2) origin=internet → 仅 OFF（source=openfoodfacts，data_origin 为 internet_*）；
3) origin=local → 仅 manual（source=manual，data_origin=local_reference）；
4) 数据真实性抽查：详情 external_id / 条码 / 注册号 / 成分。

Run: backend\\venv\\Scripts\\python.exe tests/e2e/task23_http_origin.py
"""
import json
import os
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:8000"
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "task23_http_origin_results.json")


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


def get(url: str) -> tuple:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, {"_error": e.read().decode("utf-8", errors="replace")[:300]}
    except Exception as e:  # noqa: BLE001
        return 0, {"_exception": repr(e)}


def summarize_items(items: list[dict]) -> dict:
    counts: dict[str, int] = {}
    bad = []
    for it in items:
        origin = it.get("data_origin")
        source = it.get("source")
        counts[origin] = counts.get(origin, 0) + 1
        # 校验 data_origin 与 source 的一致性（OFF 实时 source=openfoodfacts_api，缓存=openfoodfacts）
        if origin == "local_reference" and source != "manual":
            bad.append(("local_reference_source", it.get("id"), source))
        if origin in ("internet_realtime", "internet_cache") and source not in ("openfoodfacts", "openfoodfacts_api"):
            bad.append(("internet_source", it.get("id"), source))
        if origin not in ("local_reference", "internet_realtime", "internet_cache"):
            bad.append(("unknown_origin", it.get("id"), origin))
    return {"counts": counts, "bad": bad, "total": len(items)}


def main() -> int:
    report = {"base": BASE, "results": {}}
    for kw in ["蛋白粉", "胶原蛋白肽", "维生素C"]:
        for origin in ("all", "internet", "local"):
            status, data = post(f"{BASE}/api/v1/databases/openfoodfacts/search", {"query": kw, "realtime": False, "origin": origin})
            items = (data or {}).get("items") or []
            summary = summarize_items(items)
            report.setdefault("results", {})[f"{kw}|{origin}"] = {
                "http_status": status,
                "data_source": (data or {}).get("data_source"),
                "total": (data or {}).get("total"),
                **summary,
            }
            print(f"{kw} origin={origin}: status={status} data_source={(data or {}).get('data_source')} total={(data or {}).get('total')} counts={summary['counts']} bad={summary['bad']}")

    # 数据真实性抽查：manual 详情 + OFF 缓存条目
    status, detail = get(f"{BASE}/api/v1/databases/retail-products/13")  # 汤臣倍健 蛋白质粉（manual）
    report["manual_detail"] = {"status": status, "id": 13, "external_id": (detail or {}).get("external_id"), "source": (detail or {}).get("source"), "reg_number": (detail or {}).get("reg_number"), "product_name": (detail or {}).get("product_name"), "has_ingredients": bool((detail or {}).get("full_ingredients"))}
    print("manual_detail:", json.dumps(report["manual_detail"], ensure_ascii=False))

    status2, off_detail = get(f"{BASE}/api/v1/databases/retail-products/1")  # 找一个 OFF 产品
    if status2 != 200 or not (off_detail or {}).get("id"):
        # 列出 OFF 产品
        s3, lst = get(f"{BASE}/api/v1/databases/retail-products?page_size=100")
        off = [it for it in (lst or {}).get("items", []) if it.get("source") == "openfoodfacts"]
        if off:
            oid = off[0]["id"]
            status2, off_detail = get(f"{BASE}/api/v1/databases/retail-products/{oid}")
            report["off_detail"] = {"status": status2, "id": oid, "external_id": (off_detail or {}).get("external_id"), "source": (off_detail or {}).get("source"), "sku": (off_detail or {}).get("sku"), "has_ingredients": bool((off_detail or {}).get("full_ingredients"))}
    else:
        report["off_detail"] = {"status": status2, "id": 1, "external_id": (off_detail or {}).get("external_id"), "source": (off_detail or {}).get("source"), "sku": (off_detail or {}).get("sku")}
    print("off_detail:", json.dumps(report["off_detail"], ensure_ascii=False))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
    print("Results written to", OUTPUT_FILE)
    return 0


if __name__ == "__main__":
    sys.exit(main())