# -*- coding: utf-8 -*-
"""QA task-9: HTTP layer verification for 市售产品 (retail product) search.

Verifies POST /api/v1/databases/openfoodfacts/search against a running backend:
- 胶原蛋白肽 with realtime=true  -> expect 200, data_source contains "api", items non-empty
- 胶原蛋白肽 with realtime=false -> expect 200, data_source NOT postgresql_error/empty
                                    (task-8 fallback: openfoodfacts_api_fallback / postgresql_ilike)
- regression: 蛋白 / 维生素 / Nutella

Run: backend\\venv\\Scripts\\python.exe tests/e2e/http_verify_retail_search.py
"""
import json
import os
import sys
import urllib.request
import urllib.error

OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "http_verify_results.json")

BASE_URL = "http://localhost:8000"
SEARCH_URL = f"{BASE_URL}/api/v1/databases/openfoodfacts/search"

CASES = [
    ("胶原蛋白肽_realtime_true", {"query": "胶原蛋白肽", "realtime": True}),
    ("胶原蛋白肽_realtime_false", {"query": "胶原蛋白肽", "realtime": False}),
    ("回归_蛋白", {"query": "蛋白", "realtime": True}),
    ("回归_维生素", {"query": "维生素", "realtime": True}),
    ("回归_Nutella", {"query": "Nutella", "realtime": True}),
]


def post_json(url: str, payload: dict) -> tuple:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return e.code, {"_error_body": body}
    except Exception as e:  # noqa: BLE001
        return 0, {"_exception": repr(e)}


def summarize(name: str, status: int, data) -> dict:
    if status != 200 or not isinstance(data, dict):
        return {
            "case": name,
            "http_status": status,
            "error": data.get("_error_body") or data.get("_exception") or data,
        }
    items = data.get("items") or []
    return {
        "case": name,
        "http_status": status,
        "data_source": data.get("data_source"),
        "total": data.get("total"),
        "raw_count": data.get("raw_count"),
        "items_count": len(items),
        "first_item": {
            "product_name": items[0].get("product_name") if items else None,
            "brand": items[0].get("brand") or items[0].get("brands") if items else None,
            "code": items[0].get("code") or items[0].get("id") if items else None,
        },
    }


def main() -> int:
    print(f"POST {SEARCH_URL}")
    results = []
    failed = False
    for name, payload in CASES:
        status, data = post_json(SEARCH_URL, payload)
        summary = summarize(name, status, data)
        results.append(summary)
        print(json.dumps(summary, ensure_ascii=False, indent=2))

        if name == "胶原蛋白肽_realtime_true":
            ok = (
                status == 200
                and isinstance(data, dict)
                and "api" in str(data.get("data_source", "")).lower()
                and (data.get("items") or [])
            )
            failed |= not ok
            print(f"  => PASS: {ok}")
        elif name == "胶原蛋白肽_realtime_false":
            ds = str(data.get("data_source", "")) if isinstance(data, dict) else ""
            ok = status == 200 and ds and "postgresql_error" not in ds and "empty" not in ds
            failed |= not ok
            print(f"  => PASS: {ok} (data_source={ds!r})")
        else:
            ok = (
                status == 200
                and isinstance(data, dict)
                and "postgresql_error" not in str(data.get("data_source", ""))
                and (data.get("items") or [])
            )
            failed |= not ok
            print(f"  => PASS: {ok}")

    print("\nRESULT:", "FAIL" if failed else "ALL_PASS")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        json.dump({"base_url": BASE_URL, "results": results, "all_pass": not failed}, fh, ensure_ascii=False, indent=2)
    print(f"Results written to {OUTPUT_FILE}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())