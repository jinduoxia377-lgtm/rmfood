"""进程内短 TTL 缓存 — 给慢搜索端点降 worker 占用。

P0 稳定性修复：/databases/food-materials 混合检索、/databases/peptides 检索
单次 0.1-1.3s，并发下占满 --workers 2 导致排队/超时。重复/翻页查询直接命中缓存，
大幅降低 worker 占用与 DB/向量计算开销。

设计（保守、无新依赖——cachetools 未安装，用 stdlib 实现）：
- 每 key 存 (expire_at, value)，读取时惰性判断过期。
- 线程安全（threading.Lock），因为 to_thread 卸载的 encode_query 在线程池跑，
  且 uvicorn --workers 是多进程但每进程独立缓存（进程内命中已足够降载）。
- 缓存 key 必须包含全部影响结果的参数（query+filters+page+size+sort 等），避免脏读。
- TTL 过期即唯一失效策略（简单、够用）。value 存不可变的结果对象（pydantic/列表），
  命中直接返回；调用方不得就地修改返回值。
"""
from __future__ import annotations

import threading
import time
from typing import Any, Dict, Tuple


class TTLCache:
    """极简线程安全 TTL 缓存。maxsize 满时惰性清过期项，仍满则丢最旧。"""

    def __init__(self, ttl_seconds: float = 45.0, maxsize: int = 1024):
        self._ttl = float(ttl_seconds)
        self._maxsize = int(maxsize)
        self._store: Dict[str, Tuple[float, Any]] = {}
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Any | None:
        now = time.monotonic()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return None
            expire_at, value = entry
            if now >= expire_at:
                # 过期即删
                del self._store[key]
                self._misses += 1
                return None
            self._hits += 1
            return value

    def put(self, key: str, value: Any) -> None:
        now = time.monotonic()
        with self._lock:
            if len(self._store) >= self._maxsize:
                self._evict_locked(now)
            self._store[key] = (now + self._ttl, value)

    def _evict_locked(self, now: float) -> None:
        # 先清过期
        expired = [k for k, (exp, _) in self._store.items() if now >= exp]
        for k in expired:
            del self._store[k]
        # 仍满则丢最旧（按 expire_at 升序 = 插入顺序近似）
        while len(self._store) >= self._maxsize:
            oldest = min(self._store, key=lambda k: self._store[k][0])
            del self._store[oldest]

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "size": len(self._store),
                "maxsize": self._maxsize,
                "ttl": self._ttl,
                "hits": self._hits,
                "misses": self._misses,
            }

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


# 模块级单例：搜索结果缓存（TTL 45s，覆盖翻页/重复查询；数据变更最多延迟 45s 可见，
# 对只读搜索可接受）。key 由各端点用「影响结果的全部参数」构造。
search_result_cache = TTLCache(ttl_seconds=45.0, maxsize=2048)
