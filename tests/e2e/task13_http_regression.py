# -*- coding: utf-8 -*-
"""QA task-13: 全链路 HTTP 回归（镜像/降级/缓存依赖记录 + 常规端点回归）。

覆盖：
1. POST /openfoodfacts/search（胶原蛋白肽/蛋白/维生素/Nutella × realtime true/false）
2. GET /openfoodfacts/categories、/sync-status、/report
3. GET /retail-products 列表、GET /retail-products/{id} 详情
4. 收藏增删：GET /pantry、POST/DELETE /pantry/retail-products/{product_id}
5. GET /openfoodfacts/diagnostics（task-11 依赖，预期当前 404）

Run: backend\\venv\\Scripts\\python.exe tests/e2e/task13_http_regression.py
"""
import json
import os
import sys
import urllib.parse
import urllib.request
import urllib.error

BASE = "http://localhost:8000"
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "task13_http_results.json")


def request(method: str, url: str, payload=None, token: str | None = None, form: bool = False) -> tuple:
    headers = {"Accept": "application/json"}
    data = None
    if payload is not None:
        if form:
            body = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in payload.items())
            data = body.encode("utf-8")
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json; charset=utf-8"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"_body": raw[:500]}
    except Exception as e:  # noqa: BLE001
        return 0, {"_exception": repr(e)}


def main() -> int:
    report: dict = {"base": BASE, "results": {}}

    # 1) 登录
    status, login = request("POST", f"{BASE}/api/v1/auth/login", {"username": "admin", "password": "admin123"})
    token = (login or {}).get("access_token") or (login or {}).get("token")
    report["results"]["login"] = {"status": status, "has_token": bool(token)}
    print("login:", status, "has_token:", bool(token))

    # 2) 搜索回归
    search_cases = [
        ("胶原蛋白肽_realtime_true", {"query": "胶原蛋白肽", "realtime": True}),
        ("胶原蛋白肽_realtime_false", {"query": "胶原蛋白肽", "realtime": False}),
        ("蛋白_realtime_true", {"query": "蛋白", "realtime": True}),
        ("蛋白_realtime_false", {"query": "蛋白", "realtime": False}),
        ("维生素_realtime_true", {"query": "维生素", "realtime": True}),
        ("Nutella_realtime_true", {"query": "Nutella", "realtime": True}),
        ("Nutella_realtime_false", {"query": "Nutella", "realtime": False}),
    ]
    report["results"]["search"] = []
    for name, payload in search_cases:
        status, data = request("POST", f"{BASE}/api/v1/databases/openfoodfacts/search", payload)
        items = (data or {}).get("items") or []
        rec = {
            "case": name, "http_status": status,
            "data_source": (data or {}).get("data_source"),
            "total": (data or {}).get("total"),
            "items_count": len(items),
            "off_error": (data or {}).get("off_error"),
            "off_total": (data or {}).get("off_total"),
            "db_total": (data or {}).get("db_total"),
        }
        report["results"]["search"].append(rec)
        print(json.dumps(rec, ensure_ascii=False))

    # 3) 分类/同步/报告
    for name, path in [
        ("categories", "/api/v1/databases/openfoodfacts/categories"),
        ("sync_status", "/api/v1/databases/openfoodfacts/sync-status"),
        ("report", "/api/v1/databases/openfoodfacts/report"),
        ("diagnostics", "/api/v1/databases/openfoodfacts/diagnostics"),
    ]:
        status, data = request("GET", f"{BASE}{path}")
        rec = {"endpoint": name, "http_status": status}
        if isinstance(data, dict):
            rec.update({k: data.get(k) for k in ("total_products", "avg_quality", "unique_brands", "kb_categories", "total", "quality_distribution") if k in data})
        elif isinstance(data, list):
            rec["count"] = len(data)
        report["results"][name] = rec
        print(name, "->", json.dumps(rec, ensure_ascii=False))

    # 4) 产品列表与详情
    status, data = request("GET", f"{BASE}/api/v1/databases/retail-products?page_size=3")
    items = (data or {}).get("items") or []
    report["results"]["retail_products_list"] = {"status": status, "total": (data or {}).get("total"), "count": len(items)}
    print("retail-products list:", status, "total=", (data or {}).get("total"))
    detail_id = None
    for it in items:
        if it.get("source") == "manual" or it.get("id"):
            detail_id = it.get("id")
            break
    if detail_id:
        status2, detail = request("GET", f"{BASE}/api/v1/databases/retail-products/{detail_id}")
        report["results"]["retail_product_detail"] = {
            "status": status2, "id": detail_id,
            "product_name": (detail or {}).get("product_name"),
        }
        print("retail-product detail", detail_id, "->", status2)

    # 5) 收藏增删（需 token）
    if token:
        status_p, pantry = request("GET", f"{BASE}/api/v1/databases/pantry?item_type=retail_product", token=token)
        pantry_ids = (pantry or {}).get("items") or (pantry or {}).get("ids") or []
        report["results"]["pantry_get"] = {"status": status_p, "ids": pantry_ids}
        print("pantry GET:", status_p, pantry_ids)

        # 添加收藏（用详情 id 或列表第一个）
        fav_id = detail_id or (pantry_ids[0] if pantry_ids else None)
        if fav_id:
            status_a, add_resp = request("POST", f"{BASE}/api/v1/databases/pantry/retail-products/{fav_id}", token=token)
            report["results"]["pantry_add"] = {"status": status_a, "id": fav_id, "body": add_resp}
            print("pantry ADD", fav_id, "->", status_a)

            status_d, del_resp = request("DELETE", f"{BASE}/api/v1/databases/pantry/retail-products/{fav_id}", token=token)
            report["results"]["pantry_delete"] = {"status": status_d, "id": fav_id, "body": del_resp}
            print("pantry DELETE", fav_id, "->", status_d)
        else:
            report["results"]["pantry_add"] = {"status": "skipped", "reason": "no product id"}
    else:
        report["results"]["pantry_get"] = {"status": "skipped", "reason": "no token"}

    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
    print("Results written to", OUTPUT_FILE)
    return 0


if __name__ == "__main__":
    sys.exit(main())