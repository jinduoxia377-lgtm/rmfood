#!/usr/bin/env python
"""
复现 knowledge-base 三个 5xx 端点的【真实异常】—— A-39

全局异常中间件会把堆栈吞掉（只留一条脱敏后的 503/500），
uvicorn 的日志配置又没把 app 的 logger 接到文件，所以直接打 HTTP 看不到原因。
这里绕过中间件，直接 await 端点函数本体，拿到原始 traceback。

用法：
    python scripts/repro_kg_errors.py
"""
import asyncio
import traceback

from app.core.performance.cache_system import MultiLevelCache

CASES = [
    ("graph/nodes", "app.api.knowledge_base", "get_graph_nodes",
     {"node_type": None, "limit": 100, "offset": 0}),
    # Query(...) 的默认值本身是 Query 对象；直接调用函数时必须显式传 None，
    # 否则会把 Query 对象当成真实入参，Fake 出一个「HTTP 上并不存在」的报错。
    ("peptide/search", "app.api.knowledge_base", "search_peptides",
     {"activity_type": None, "source_protein": None, "threshold": None}),
    ("tcm/compounds/{herb}", "app.api.knowledge_base", "get_tcm_compounds",
     {"herb_name": "ginseng"}),
]


async def main():
    cache = MultiLevelCache()
    for name, mod_name, fn_name, kwargs in CASES:
        print("=" * 70)
        print(f"[CASE] {name}")
        try:
            mod = __import__(mod_name, fromlist=[fn_name])
            fn = getattr(mod, fn_name)
            kwargs = dict(kwargs)
            if "cache" in fn.__code__.co_varnames[: fn.__code__.co_argcount]:
                kwargs["cache"] = cache
            res = fn(**kwargs)
            if hasattr(res, "__await__"):
                res = await res
            print(f"  OK -> {str(res)[:200]}")
        except Exception:  # noqa: BLE001
            print("  RAISED:")
            traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
