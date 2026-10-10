#!/usr/bin/env python
"""
GET 端点 5xx 巡检 —— A-32

背景：后端有 1200+ 路由，其中一批 GET 端点会在运行时抛 500，原因集中在两类：
  ① response_model=dict 却返回 SQLAlchemy 实体（无法序列化）
  ② 函数体内用了未导入 / 未定义的名字（NameError）
这类问题静态扫不出来（scan_undefined.py 只能覆盖当前模块作用域的全局名），
必须实打实打一遍。

设计要点：
  · 从 /openapi.json 拉全量路由，只取 GET，避免触发写操作
  · 路径参数用占位值填充（数字 -> 1，其它 -> test）；404 属正常，只关心 5xx
  · 限流 + 429 指数退避：之前一次性并发打全站被限流，结果里全是 429 噪声
  · 分批跑，--start/--limit 控制，便于人工观察

用法：
  python scripts/scan_get_endpoints.py --limit 150          # 跑前 150 个
  python scripts/scan_get_endpoints.py --start 150 --limit 150
"""
import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:8000"
USER = "admin"
PASSWORD = "admin123"
# 这些路由是重量级任务（图谱计算 / 全表扫描），巡检时跳过，避免拖垮服务
SKIP_HINTS = (
    "/knowledge-graph/build",
    "/knowledge-graph/compute",
    "rebuild",
    "/export/all",
    "/sync",
    "/import/run",
)


def http(method, path, token=None, timeout=25, cap=200):
    """cap 只用于【错误摘要】裁剪；拉 openapi.json 这类正常响应要传 cap=0 取全文"""
    url = BASE + path
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return r.status, (raw if not cap else raw[:cap])
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:200]
    except Exception as e:  # 超时 / 连接重置
        return 0, str(e)[:200].encode()


def login():
    # 登录接口只吃 JSON；发表单会被当成缺少必填字段，返回 500 而不是 422
    body = json.dumps({"username": USER, "password": PASSWORD}).encode()
    req = urllib.request.Request(
        BASE + "/api/v1/auth/login", data=body, method="POST",
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read()).get("access_token")


def fill(path):
    """把 {param} 换成占位值"""
    out = path
    while "{" in out:
        a = out.index("{")
        b = out.index("}", a)
        name = out[a + 1:b]
        out = out[:a] + ("1" if name.endswith("id") or name.endswith("_id") else "test") + out[b + 1:]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--limit", type=int, default=150)
    ap.add_argument("--sleep", type=float, default=0.25)
    args = ap.parse_args()

    token = login()
    spec = json.loads(http("GET", "/openapi.json", token, timeout=60, cap=0)[1])
    paths = [p for p, item in spec.get("paths", {}).items() if "get" in item]
    paths.sort()
    paths = [p for p in paths if not any(h in p for h in SKIP_HINTS)]
    batch = paths[args.start:args.start + args.limit]
    print(f"总计 GET 路由 {len(paths)}，本批 {len(batch)}（从 {args.start} 起）")

    bad = []
    for i, p in enumerate(batch, 1):
        url = fill(p)
        for attempt in range(4):
            code, body = http("GET", url, token)
            if code != 429:
                break
            time.sleep(2 ** attempt)  # 429 退避
        if code == 0:
            bad.append((url, "TIMEOUT/ERR", body.decode("utf-8", "replace")))
        elif code >= 500:
            bad.append((url, code, body.decode("utf-8", "replace")))
        if code >= 500 or code == 0:
            print(f"  [{args.start + i}/{len(paths)}] {code}  {url}")
        time.sleep(args.sleep)

    print(f"\n本批 5xx/异常 {len(bad)} 个：")
    for url, code, body in bad:
        print(f"  {code}  {url}\n      {body[:160]}")


if __name__ == "__main__":
    main()
