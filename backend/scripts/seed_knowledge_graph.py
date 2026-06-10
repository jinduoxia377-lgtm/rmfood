"""
知识图谱数据种子脚本

将现有硬编码数据迁移到数据库：
1. 从 graph_service.py 的 HERB_INTERACTIONS 提取配伍关系
2. 从 COMPOUND_TARGET_PATHS 提取化合物-靶点路径
3. 从 tcmsp_client.py 的 TCMSP_HERB_DATABASE 提取药材/化合物/靶点

使用方式:
    python scripts/seed_knowledge_graph.py
    python scripts/seed_knowledge_graph.py --clear  # 清空后重新导入
"""
import asyncio
import logging
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def seed_knowledge_graph(clear_first: bool = False):
    """将硬编码数据迁移到数据库"""
    from app.core.session import async_session_factory
    from app.models.knowledge_graph import KGNode, KGEdge
    from sqlalchemy import select, delete

    async with async_session_factory() as db:
        if clear_first:
            logger.info("清空现有知识图谱数据...")
            await db.execute(delete(KGEdge))
            await db.execute(delete(KGNode))
            await db.commit()

        # ── 1. 导入 HERB_INTERACTIONS 配伍关系 ──
        logger.info("导入配伍关系数据...")
        from app.services.data_sources.graph_service import HERB_INTERACTIONS

        # 收集所有涉及的药材名称
        herb_names = set()
        for interaction in HERB_INTERACTIONS:
            herb_names.add(interaction["a"])
            herb_names.add(interaction["b"])

        # 创建药材节点
        herb_nodes = {}
        for herb_name in herb_names:
            # 检查是否已存在
            existing = await db.execute(
                select(KGNode).where(
                    KGNode.node_type == "herb",
                    KGNode.node_label == herb_name,
                )
            )
            node = existing.scalar_one_or_none()
            if not node:
                node = KGNode(
                    node_type="herb",
                    node_label=herb_name,
                    source="graph_service",
                )
                db.add(node)
                await db.flush()
            herb_nodes[herb_name] = node

        # 创建配伍关系边
        edge_count = 0
        for interaction in HERB_INTERACTIONS:
            source_node = herb_nodes.get(interaction["a"])
            target_node = herb_nodes.get(interaction["b"])
            if not source_node or not target_node:
                continue

            # 检查是否已存在
            existing = await db.execute(
                select(KGEdge).where(
                    KGEdge.source_id == source_node.id,
                    KGEdge.target_id == target_node.id,
                    KGEdge.edge_type == interaction["type"],
                )
            )
            if existing.scalar_one_or_none():
                continue

            edge = KGEdge(
                source_id=source_node.id,
                target_id=target_node.id,
                edge_type=interaction["type"],
                strength=interaction.get("strength", 0.0),
                properties={"basis": interaction.get("basis", "")},
                source="graph_service",
            )
            db.add(edge)
            edge_count += 1

        logger.info(f"导入 {len(herb_nodes)} 个药材节点, {edge_count} 条配伍关系")

        # ── 2. 导入 COMPOUND_TARGET_PATHS 化合物-靶点路径 ──
        logger.info("导入化合物-靶点路径数据...")
        from app.services.data_sources.graph_service import COMPOUND_TARGET_PATHS

        compound_nodes = {}
        target_nodes = {}
        disease_nodes = {}

        for path in COMPOUND_TARGET_PATHS:
            compound_name = path.get("compound")
            target_name = path.get("target")
            disease_name = path.get("disease")

            # 创建化合物节点
            if compound_name and compound_name not in compound_nodes:
                existing = await db.execute(
                    select(KGNode).where(
                        KGNode.node_type == "compound",
                        KGNode.node_label == compound_name,
                    )
                )
                node = existing.scalar_one_or_none()
                if not node:
                    node = KGNode(
                        node_type="compound",
                        node_label=compound_name,
                        properties={
                            "ob": path.get("ob"),
                            "dl": path.get("dl"),
                        },
                        source="graph_service",
                    )
                    db.add(node)
                    await db.flush()
                compound_nodes[compound_name] = node

            # 创建靶点节点
            if target_name and target_name not in target_nodes:
                existing = await db.execute(
                    select(KGNode).where(
                        KGNode.node_type == "target",
                        KGNode.node_label == target_name,
                    )
                )
                node = existing.scalar_one_or_none()
                if not node:
                    node = KGNode(
                        node_type="target",
                        node_label=target_name,
                        source="graph_service",
                    )
                    db.add(node)
                    await db.flush()
                target_nodes[target_name] = node

            # 创建疾病节点
            if disease_name and disease_name not in disease_nodes:
                existing = await db.execute(
                    select(KGNode).where(
                        KGNode.node_type == "disease",
                        KGNode.node_label == disease_name,
                    )
                )
                node = existing.scalar_one_or_none()
                if not node:
                    node = KGNode(
                        node_type="disease",
                        node_label=disease_name,
                        source="graph_service",
                    )
                    db.add(node)
                    await db.flush()
                disease_nodes[disease_name] = node

        # 创建化合物-靶点边
        compound_target_count = 0
        for path in COMPOUND_TARGET_PATHS:
            compound_name = path.get("compound")
            target_name = path.get("target")
            if compound_name and target_name:
                source_node = compound_nodes.get(compound_name)
                target_node = target_nodes.get(target_name)
                if source_node and target_node:
                    existing = await db.execute(
                        select(KGEdge).where(
                            KGEdge.source_id == source_node.id,
                            KGEdge.target_id == target_node.id,
                            KGEdge.edge_type == "targets",
                        )
                    )
                    if not existing.scalar_one_or_none():
                        edge = KGEdge(
                            source_id=source_node.id,
                            target_id=target_node.id,
                            edge_type="targets",
                            strength=path.get("strength", 0.5),
                            source="graph_service",
                        )
                        db.add(edge)
                        compound_target_count += 1

        # 创建靶点-疾病边
        target_disease_count = 0
        for path in COMPOUND_TARGET_PATHS:
            target_name = path.get("target")
            disease_name = path.get("disease")
            if target_name and disease_name:
                source_node = target_nodes.get(target_name)
                target_node = disease_nodes.get(disease_name)
                if source_node and target_node:
                    existing = await db.execute(
                        select(KGEdge).where(
                            KGEdge.source_id == source_node.id,
                            KGEdge.target_id == target_node.id,
                            KGEdge.edge_type == "treats",
                        )
                    )
                    if not existing.scalar_one_or_none():
                        edge = KGEdge(
                            source_id=source_node.id,
                            target_id=target_node.id,
                            edge_type="treats",
                            strength=path.get("strength", 0.5),
                            source="graph_service",
                        )
                        db.add(edge)
                        target_disease_count += 1

        logger.info(
            f"导入 {len(compound_nodes)} 个化合物节点, "
            f"{len(target_nodes)} 个靶点节点, "
            f"{len(disease_nodes)} 个疾病节点"
        )
        logger.info(f"导入 {compound_target_count} 条化合物-靶点关系, {target_disease_count} 条靶点-疾病关系")

        # ── 3. 从 TCMSP 药材表同步 ──
        logger.info("从 TCMSP 药材表同步数据...")
        from app.models.external_data import TCMHerb

        herbs_result = await db.execute(select(TCMHerb))
        herbs = herbs_result.scalars().all()

        herb_sync_count = 0
        for herb in herbs:
            # 检查是否已有对应的节点
            existing = await db.execute(
                select(KGNode).where(
                    KGNode.node_type == "herb",
                    KGNode.node_label == herb.name_cn,
                )
            )
            if existing.scalar_one_or_none():
                continue

            node = KGNode(
                node_type="herb",
                node_label=herb.name_cn,
                properties={
                    "name_latin": herb.name_latin,
                    "name_pinyin": herb.name_pinyin,
                    "category": herb.category,
                    "effects": herb.effects,
                    "ob_percent": herb.ob_percent,
                    "dl_value": herb.dl_value,
                    "is_food_homology": herb.is_food_homology,
                },
                source="tcmsp",
                tcm_herb_id=herb.id,
            )
            db.add(node)
            herb_sync_count += 1

        logger.info(f"从 TCMSP 同步 {herb_sync_count} 个药材节点")

        # ── 提交 ──
        await db.commit()

        # 统计
        from sqlalchemy import func
        total_nodes = (await db.execute(select(func.count(KGNode.id)))).scalar() or 0
        total_edges = (await db.execute(select(func.count(KGEdge.id)))).scalar() or 0
        logger.info(f"知识图谱数据导入完成: {total_nodes} 个节点, {total_edges} 条边")


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="知识图谱数据种子脚本")
    parser.add_argument("--clear", action="store_true", help="清空现有数据后重新导入")
    args = parser.parse_args()

    try:
        await seed_knowledge_graph(clear_first=args.clear)
    except Exception as e:
        logger.error(f"数据导入失败: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
