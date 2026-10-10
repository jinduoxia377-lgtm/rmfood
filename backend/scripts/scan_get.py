#!/usr/bin/env python3
"""GET 端点全量体检（进程内，不经 HTTP）。

为什么不用 HTTP 探活：
  8000 端口上有一个杀不掉的僵尸监听（netstat 报 pid 14248，taskkill / Get-Process 都失败），
  HTTP 探测会随机打到那份陈旧实例上，结果不可信。TestClient 直接在进程内跑 ASGI，绕开端口。

为什么必须先装 traceback 中间件：
  app/core/exceptions.py 里有一条兜底 —— 只要异常文本里出现 database/connection/timeout 等字样，
  就统一转成 503。于是 ImportError / NameError / AttributeError 全都伪装成"数据库连不上"，
  A-39 的三个真实 500 就是这么被掩盖了一整轮。这里用中间件在异常被处理器吞掉之前
  把 traceback 截下来，按【最后一帧】归类，才能看到真正的病根。

用法：
  python scripts/scan_get.py                 # 全量
  python scripts/scan_get.py --start 220 --limit 180   # 分批（避免单次跑太久）
"""
import argparse
import os
import re
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

# ── 截获被异常处理器吞掉之前的真实 traceback ──
CAPTURED = {}
_state = {"current": None}


async def _capture(request, call_next):
    _state["current"] = request.url.path
    try:
        return await call_next(request)
    except Exception:
        CAPTURED[_state["current"]] = traceback.format_exc()
        raise


app.add_middleware(__import__("starlette.middleware.base", fromlist=["BaseHTTPMiddleware"]).BaseHTTPMiddleware, dispatch=_capture)

ap = argparse.ArgumentParser()
ap.add_argument("--start", type=int, default=0)
ap.add_argument("--limit", type=int, default=0)  # 0 = 不限
args = ap.parse_args()

# ── 1) 解开速率限制（默认 60/min、1000/hour，第 61 个请求就开始返回 429，
#       会把真实结果冲掉）。实例已经在 import 时按默认配置建好了，改 dataclass
#       的默认值没用，必须直接改到实例上。
def _bump(cfg):
    """把某个限流配置放宽到实际上不触发。返回 True 表示确实改到了。"""
    hit = False
    for f in ("requests_per_minute", "requests_per_hour", "rpm", "rph", "limit", "max_requests"):
        if hasattr(cfg, f):
            setattr(cfg, f, 10 ** 6)
            hit = True
    return hit


def _unlimit():
    n = 0
    for mw in getattr(app, "user_middleware", []):
        # Starlette 的 add_middleware(cls, **kw) 会把 kw 存进 Middleware.kwargs（dict），
        # 不是挂在实例属性上 —— 上一版只查了对象属性，所以一处都没改到。
        cands = []
        kw = getattr(mw, "kwargs", None)
        if isinstance(kw, dict):
            cands.extend(kw.values())
        cands.append(getattr(mw, "cls", None))
        for cand in cands:
            cfg = getattr(cand, "config", None)
            if cfg is not None and _bump(cfg):
                n += 1
            if _bump(cand):
                n += 1
    for attr in ("limiter", "rate_limiter", "rate_limit"):
        obj = getattr(getattr(app, "state", None), attr, None)
        if obj is not None and _bump(obj):
            n += 1
    return n


print(f"[ratelimit] 已放宽 {_unlimit()} 处")

# ── 2) 包住已注册的异常处理器，把异常在被转成 5xx 响应之前记下来 ──
_orig_handlers = dict(app.exception_handlers)


def _root_cause(exc):
    """沿着 __context__ / __cause__ 一路挖到最初的异常。

    项目里几乎每个路由都写成
        try: ...
        except Exception as e:
            raise HTTPException(status_code=500, detail="服务器内部错误")
    在 except 块里 raise 会把原始异常挂到新异常的 __context__ 上，
    但 traceback 的【最后一帧】会停在那句 raise HTTPException —— 只看最后一帧
    永远只能看到"服务器内部错误"，看不到真正炸在哪一行。必须回溯整条链。
    """
    seen, chain, cur, guard = set(), [], exc, 0
    while cur is not None and id(cur) not in seen and guard < 20:
        seen.add(id(cur))
        chain.append(cur)
        cur = getattr(cur, "__cause__", None) or getattr(cur, "__context__", None)
        guard += 1
    return chain[-1] if chain else exc


def _fmt(exc):
    root = _root_cause(exc)
    tb = getattr(root, "__traceback__", None)
    if tb is None:
        return f"{type(root).__name__}: {root}"
    frames = [f for f in traceback.extract_tb(tb) if "site-packages" not in f.filename]
    if not frames:
        frames = traceback.extract_tb(tb)[-1:]
    last = frames[-1]
    return f"{type(root).__name__}: {root} @ {last.filename.split('backend')[-1]}:{last.lineno} in {last.name}"


def _wrap(handler):
    async def inner(request, exc):
        _last_exc["exc"] = _fmt(exc)
        return await handler(request, exc)
    return inner


_last_exc = {"exc": ""}
for k, v in list(app.exception_handlers.items()):
    app.exception_handlers[k] = _wrap(v)

c = TestClient(app)
r = c.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
tok = (r.json() or {}).get("access_token") or ""
H = {"Authorization": f"Bearer {tok}"} if tok else {}
print(f"[auth] login={r.status_code} token={'yes' if tok else 'NO'}")

spec = app.openapi()["paths"]
paths = sorted(p for p, ops in spec.items() if "get" in ops)
paths = [p for p in paths if not any(k in p for k in ("/health", "/metrics", "/docs", "/openapi"))]
if args.limit:
    paths = paths[args.start: args.start + args.limit]
else:
    paths = paths[args.start:]

bad = []
for path in paths:
    p = re.sub(r"\{[^}]+\}", "1", path)
    try:
        resp = c.get(p, headers=H, timeout=60)
    except Exception as e:
        tb = CAPTURED.get(p, "")
        bad.append((path, f"EXC {type(e).__name__}", tb))
        continue
    if resp.status_code >= 500:
        tb = CAPTURED.get(p, "") or _last_exc["exc"]
        bad.append((path, resp.status_code, tb))
    _last_exc["exc"] = ""


def cause(tb: str) -> str:
    if not tb:
        return "(未捕获到异常：可能由更内层的中间件直接返回了响应)"
    return tb


print(f"\nGET endpoints tested: {len(paths)}")
print(f"5xx: {len(bad)}\n")
for path, st, tb in bad:
    print(f"  {st}  {path}")
    print(f"        -> {cause(tb)}")
