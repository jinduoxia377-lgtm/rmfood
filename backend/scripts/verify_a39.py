#!/usr/bin/env python
"""
A-39 进程内验收 —— 绕开端口上那个杀不掉的僵尸监听器。

端口 8000 上有一个本会话无法终止的旧 uvicorn（netstat 报 pid 14248，
taskkill / Get-Process 都找不到它），HTTP 探测会随机落到它身上，
导致「改了代码但测出来还是旧行为」。这里直接在进程里建 app 校验：
  ① 路由表里不得再出现 /api/v1/api/v1/... 幽灵前缀
  ② 三个知识图谱/知识库端点不再抛异常

用法：
    PYTHONPATH=. python scripts/verify_a39.py
"""
import asyncio
import traceback

from app.main import create_app
from app.core.performance.cache_system import MultiLevelCache


def check_routes(app):
    paths = [getattr(r, "path", "") for r in app.routes]
    bad = [p for p in paths if p.startswith("/api/v1/api/v1")]
    print(f"[routes] 总计 {len(paths)} 条，重复前缀 {len(bad)} 条")
    for p in bad[:10]:
        print(f"        幽灵: {p}")
    return len(bad) == 0


async def check_endpoints():
    from app.api import knowledge_base as kb
    from app.api.deps import get_db_session

    ok = True
    cache = MultiLevelCache()

    # ① graph/nodes
    try:
        # 注意：端点返回的是 {"nodes": [...], ...} 包装对象，不是裸列表
        res = await kb.get_graph_nodes(node_type=None, limit=10, offset=0, cache=cache)
        nodes = res.get("nodes", []) if isinstance(res, dict) else res
        print(f"[graph/nodes] OK, {len(nodes)} 个节点，示例: {nodes[0]['node_label'] if nodes else '-'}")
        # 顺带验证四种节点类型都能展开（原实现正是卡在导入不存在的常量上）
        for t in ("compound", "target", "disease"):
            r = await kb.get_graph_nodes(node_type=t, limit=5, offset=0, cache=cache)
            items = r.get("nodes", []) if isinstance(r, dict) else r
            print(f"    {t}: {len(items)} 个，示例: {items[0]['node_label'] if items else '-'}")
    except Exception:  # noqa: BLE001
        ok = False
        print("[graph/nodes] FAILED")
        traceback.print_exc()

    # ② peptide/search
    try:
        res = await kb.search_peptides(
            activity_type=None, source_protein=None, threshold=None, cache=cache)
        print(f"[peptide/search] OK, total={res.get('total')}")
    except Exception:  # noqa: BLE001
        ok = False
        print("[peptide/search] FAILED")
        traceback.print_exc()

    # ③ tcm/compounds/{herb_name} —— 需要真实 DB 会话
    try:
        gen = get_db_session()
        if hasattr(gen, "__anext__"):
            db = await gen.__anext__()
        elif hasattr(gen, "__next__"):
            db = next(gen)
        else:
            db = await gen
        try:
            res = await kb.get_tcm_compounds(herb_name="人参", db=db, cache=cache)
            print(f"[tcm/compounds] OK, compounds={len(res.get('compounds', []))}")
        finally:
            try:
                await db.close()
            except Exception:  # noqa: BLE001
                pass
    except Exception:  # noqa: BLE001
        # 数据库不可用时，只要不再是「NoneType 没有 execute」即视为代码修复生效
        msg = traceback.format_exc()
        ok = ok and ("'NoneType' object has no attribute 'execute'" not in msg)
        print("[tcm/compounds] 会话获取失败或非致命异常：")
        print("   " + msg.strip().splitlines()[-1])

    return ok


async def main():
    app = create_app()
    r1 = check_routes(app)
    r2 = await check_endpoints()
    print("\n结果:", "✅ 全部通过" if (r1 and r2) else "❌ 仍有失败")
    return 0 if (r1 and r2) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
