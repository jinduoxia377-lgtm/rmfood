"""执行知识图谱构建 — 从TCMSP真实数据生成kg_nodes/kg_edges"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.kg.graph_engine import KnowledgeGraphEngine
from app.core.session import async_session_factory


async def main():
    engine = KnowledgeGraphEngine()

    print("=" * 60)
    print("  知识图谱构建引擎 v2.0")
    print("  数据源: tcm_herbs(578) + tcm_compounds(9692)")
    print("=" * 60)

    async with async_session_factory() as db:
        # 先检查当前状态
        from sqlalchemy import text, func
        r = await db.execute(text("SELECT COUNT(*) FROM kg_nodes"))
        before_nodes = r.scalar()
        r = await db.execute(text("SELECT COUNT(*) FROM kg_edges"))
        before_edges = r.scalar()
        print(f"\n构建前状态: kg_nodes={before_nodes}, kg_edges={before_edges}")

        # 执行构建
        print("\n[1/3] 开始构建知识图谱...")
        try:
            stats = await engine.build_from_tcmsp(db, options={
                "rebuild": True,
                "batch_size": 50,
            })
            print(f"\n构建成功!")
            print(f"  药材节点:   {stats['herbs_created']}")
            print(f"  化合物节点: {stats['compounds_created']}")
            print(f"  靶点节点:   {stats['targets_created']}")
            print(f"  疾病节点:   {stats['diseases_created']}")
            print(f"  contains边: {stats['edges_contains']}")
            print(f"  targets边:  {stats['edges_targets']}")
            print(f"  treats边:   {stats['edges_treats']}")
            print(f"  总耗时:     {stats['total_time_ms']}ms")

        except Exception as e:
            print(f"\n!!! 构建失败: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            return False

        # 验证结果
        print("\n[2/3] 验证构建结果...")
        r = await db.execute(text("SELECT COUNT(*) FROM kg_nodes"))
        after_nodes = r.scalar()
        r = await db.execute(text("SELECT COUNT(*) FROM kg_edges"))
        after_edges = r.scalar()

        # 按类型统计
        r = await db.execute(text("""
            SELECT node_type, COUNT(*), COUNT(DISTINCT source) as sources
            FROM kg_nodes GROUP BY node_type ORDER BY COUNT(*) DESC
        """))
        type_stats = r.fetchall()

        r = await db.execute(text("""
            SELECT edge_type, COUNT(*), ROUND(AVG(strength)::numeric, 3) as avg_str
            FROM kg_edges GROUP BY edge_type ORDER BY COUNT(*) DESC
        """))
        edge_stats = r.fetchall()

        print(f"\n构建后状态: kg_nodes={after_nodes}, kg_edges={after_edges}")
        print(f"\n--- 节点类型分布 ---")
        for ts in type_stats:
            print(f"  {ts[0]:12s} | {ts[1]:>5} 个 | 来源: {ts[2]}")
        print(f"\n--- 边类型分布 ---")
        for es in edge_stats:
            print(f"  {es[0]:12s} | {es[1]:>5} 条 | 平均强度: {es[2]}")

        # [3/3] 运行算法验证
        print("\n[3/3] 运行图论算法验证...")
        nodes, edges = await engine.load_graph_from_db(db)

        if nodes and edges:
            pr = engine.compute_pagerank(nodes, edges)
            top_pr = sorted(pr.items(), key=lambda x: x[1], reverse=True)[:5]
            print(f"\n  PageRank Top5:")
            lookup = {n["id"]: n for n in nodes}
            for nid, score in top_pr:
                info = lookup.get(nid, {})
                print(f"    [{info.get('node_type','?')}] {info.get('node_label',nid)} = {score:.6f}")

            communities = engine.detect_communities_louvain(nodes, edges)
            comm_counts = {}
            for _, cid in communities.items():
                comm_counts[cid] = comm_counts.get(cid, 0) + 1
            print(f"\n  Louvain社区: {len(comm_counts)}个社区, 最大社区={max(comm_counts.values()) if comm_counts else 0}节点")

            kcore = engine.decompose_kcore(nodes, edges, k=2)
            print(f"  2-Core核心子图: {len(kcore)}个节点 (度>=2)")

            bridges = engine.find_key_bridges(nodes, edges, top_n=5)
            print(f"  桥梁节点Top5:")
            for b in bridges[:5]:
                info = lookup.get(b["node_id"], {})
                print(f"    [{info.get('node_type','?')}] {info.get('node_label',b['node_id'])} score={b['bridge_score']:.4f}")

        else:
            print("  ⚠️ 图谱数据为空，跳过算法验证")

    print("\n" + "=" * 60)
    print("  知识图谱构建完成!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
