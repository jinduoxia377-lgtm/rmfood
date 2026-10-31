# -*- coding: utf-8 -*-
"""QA task-9 辅助：带重试的 HTTP 验证（应对 OFF world 域名限流 503）。

对关键用例（胶原蛋白肽 realtime=true / Nutella realtime=true）多次重试，
只要有一次返回真实产品（data_source 含 api 且 items 非空）即记为通过。
同时记录每次尝试的 data_source，供报告展示 OFF 服务间歇性。

Run: backend\\venv\\Scripts\\python.exe tests/e2e/http_verify_retry.py
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8000"
SEARCH_URL = f"{BASE_URL}/api/v1/databases/openfoodfacts/search"
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "http_verify_retry_results.json")

CASES = [
    ("胶原蛋白肽_realtime_true", {"query": "胶原蛋白肽", "realtime": True}, "api"),
    ("胶原蛋白肽_realtime_false", {"query": "胶原蛋白肽", "realtime": False}, None),
    ("回归_蛋白", {"query": "蛋白", "realtime": True}, "api"),
    ("回归_维生素", {"query": "维生素", "realtime": True}, "api"),
    ("回归_Nutella", {"query": "Nutella", "realtime": True}, "api"),
]

MAX_ATTEMPTS = 5
SLEEP_SECONDS = 25


def post_json(url: str, payload: dict) -> tuple:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, {"_error_body": e.read().decode("utf-8", errors="replace")}
    except Exception as e:  # noqa: BLE001
        return 0, {"_exception": repr(e)}


def main() -> int:
    report = {"base_url": BASE_URL, "attempts": []}
    overall_pass = True
    for name, payload, required_source in CASES:
        case_result = {"case": name, "attempts": [], "passed": False}
        for attempt in range(1, MAX_ATTEMPTS + 1):
            status, data = post_json(SEARCH_URL, payload)
            ds = str(data.get("data_source", "")) if isinstance(data, dict) else ""
            items = (data.get("items") or []) if isinstance(data, dict) else []
            is_ok_source = not ds.startswith("postgresql_error") and "empty" not in ds
            if required_source:
                ok = status == 200 and "api" in ds.lower() and len(items) > 0
            else:
                ok = status == 200 and is_ok_source
            attempt_rec = {
                "attempt": attempt,
                "http_status": status,
                "data_source": ds,
                "total": data.get("total") if isinstance(data, dict) else None,
                "items_count": len(items),
                "ok": ok,
            }
            case_result["attempts"].append(attempt_rec)
            if ok:
                case_result["passed"] = True
                break
            time.sleep(SLEEP_SECONDS)
        report["attempts"].append(case_result)
        overall_pass &= case_result["passed"]
        print(f"{name}: passed={case_result['passed']}")
        for a in case_result["attempts"]:
            print("  ", a)

    report["all_pass"] = overall_pass
    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
    print("RESULT:", "PASS" if overall_pass else "FAIL")
    print("Results written to", OUTPUT_FILE)
    return 0 if overall_pass else 1


if __name__ == "__main__":
    sys.exit(main())