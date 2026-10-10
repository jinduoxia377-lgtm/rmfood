#!/usr/bin/env python
"""
知识图谱 / 知识库 GET 端点定向巡检 —— A-39

scan_get_endpoints.py 是全站扫描（400 条 GET 一轮要十几分钟，且容易被限流）。
现在只需要盯住 knowledge-graph / knowledge-base 两族，单独打一遍更快。

用法：
    python scripts/probe_kg.py
"""
import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"
NO_PROXY = {"http": ""}


def get(path, timeout=40):
    req = urllib.request.Request(BASE + path, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()[:300].decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:300].decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        return 0, f"{type(e).__name__}: {e}"


def main():
    with urllib.request.urlopen(BASE + "/openapi.json", timeout=40) as r:
        spec = json.loads(r.read().decode("utf-8"))
    paths = [
        p for p, item in spec.get("paths", {}).items()
        if ("knowledge-graph" in p or "knowledge-base" in p) and "get" in item
    ]
    paths.sort()
    print(f"待检 {len(paths)} 个 GET 端点\n")
    bad = []
    for p in paths:
        real = p.replace("{node_type}", "herb").replace("{node_label}", "ginseng") \
                .replace("{node_id}", "1").replace("{herb_name}", "ginseng") \
                .replace("{sequence}", "AAAA")
        code, body = get(real)
        flag = ""
        if code == 0 or code >= 500:
            flag = "  <<< 5xx"
            bad.append((code, real, body))
        print(f"  {code}  {real}{flag}")
    print(f"\n5xx / 异常 {len(bad)} 个：")
    for code, real, body in bad:
        print(f"  {code}  {real}\n      {body}")


if __name__ == "__main__":
    main()
