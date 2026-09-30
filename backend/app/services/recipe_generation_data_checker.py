"""
配方生成数据完整性检查脚本

功能:
1. 验证数据库中的药材数据是否完整
2. 检查 extra_knowledge 字段是否正确填充
3. 输出数据质量报告

用法:
    python -m app.services.recipe_generation_data_checker
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, ".")

from app.core.database.session import async_session_factory
from app.models.external_data import TCMHerb

logger = logging.getLogger(__name__)


async def check_herb_data_completeness(db: AsyncSession) -> dict[str, Any]:
    """检查药材数据完整性"""
    
    # 总药材数
    total_result = await db.execute(select(func.count()).select_from(TCMHerb))
    total_herbs = total_result.scalar() or 0
    
    # 有 extra_knowledge 的数量
    with_knowledge = await db.execute(
        select(func.count())
        .select_from(TCMHerb)
        .where(TCMHerb.extra_knowledge != None)
        .where(TCMHerb.extra_knowledge != '')
    )
    with_knowledge = with_knowledge.scalar() or 0
    
    # 药食同源数量
    food_homology = await db.execute(
        select(func.count())
        .select_from(TCMHerb)
        .where(TCMHerb.is_food_homology == True)
    )
    food_homology = food_homology.scalar() or 0
    
    # 检查 efficacy_scores 分布
    result = await db.execute(
        select(TCMHerb.extra_knowledge)
        .where(TCMHerb.extra_knowledge != None)
        .limit(100)
    )
    
    valid_knowledge = 0
    invalid_knowledge = 0
    empty_efficacy = 0
    
    for row in result.scalars().all():
        try:
            data = json.loads(row)
            efficacy_scores = data.get("efficacy_scores", {})
            if efficacy_scores and len(efficacy_scores) > 0:
                valid_knowledge += 1
            else:
                empty_efficacy += 1
        except (json.JSONDecodeError, TypeError):
            invalid_knowledge += 1
    
    # 按分类统计
    category_result = await db.execute(
        select(TCMHerb.category, func.count())
        .group_by(TCMHerb.category)
        .order_by(func.count().desc())
    )
    categories = {row[0] or "未分类": row[1] for row in category_result.all()}
    
    return {
        "total_herbs": total_herbs,
        "with_extra_knowledge": with_knowledge,
        "food_homology_count": food_homology,
        "knowledge_coverage_rate": f"{with_knowledge/total_herbs*100:.1f}%" if total_herbs > 0 else "0%",
        "valid_knowledge": valid_knowledge,
        "empty_efficacy": empty_efficacy,
        "invalid_knowledge": invalid_knowledge,
        "categories": categories,
        "sufficient_data": total_herbs >= 50 and with_knowledge >= 40,
    }


async def check_herb_knowledge_service(db: AsyncSession) -> dict[str, Any]:
    """检查 HerbKnowledgeService 能否正确加载数据"""
    
    try:
        from app.infrastructure.herb_knowledge_adapters import TCMSPHerbKnowledgeAdapter
        from app.services.ai.algorithms.herb_knowledge_service import HerbKnowledgeService
        
        # 创建适配器
        adapter = TCMSPHerbKnowledgeAdapter(db)
        
        # 加载所有药材
        all_herbs = await adapter.get_all_herbs()
        
        # 构建功效索引
        efficacy_index = {}
        for herb in all_herbs:
            for efficacy, score in herb.efficacy_scores.items():
                if score > 0:
                    if efficacy not in efficacy_index:
                        efficacy_index[efficacy] = []
                    efficacy_index[efficacy].append(herb.herb_id)
        
        return {
            "adapter_working": True,
            "herbs_loaded": len(all_herbs),
            "efficacy_categories": len(efficacy_index),
            "sample_herbs": [
                {
                    "herb_id": h.herb_id,
                    "name_cn": h.name_cn,
                    "efficacy_count": len(h.efficacy_scores),
                    "safety_index": h.safety_index,
                }
                for h in all_herbs[:5]
            ] if all_herbs else [],
            "sufficient": len(all_herbs) >= 50,
        }
    
    except Exception as e:
        return {
            "adapter_working": False,
            "error": str(e),
            "sufficient": False,
        }


async def main():
    """主入口"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    logger.info("=" * 70)
    logger.info("配方生成数据完整性检查")
    logger.info("=" * 70)
    
    async with async_session_factory() as db:
        # 1. 检查数据库数据
        logger.info("\n[1] 检查 TCMHerb 表数据...")
        db_stats = await check_herb_data_completeness(db)
        
        logger.info(f"\n  数据库统计:")
        logger.info(f"    总药材数: {db_stats['total_herbs']}")
        logger.info(f"    有知识数据: {db_stats['with_extra_knowledge']}")
        logger.info(f"    覆盖率: {db_stats['knowledge_coverage_rate']}")
        logger.info(f"    药食同源: {db_stats['food_homology_count']}")
        logger.info(f"    数据充足: {'✅ 是' if db_stats['sufficient_data'] else '❌ 否'}")
        
        if db_stats['categories']:
            logger.info(f"\n  分类分布:")
            for cat, count in sorted(db_stats['categories'].items(), key=lambda x: -x[1])[:10]:
                logger.info(f"    {cat}: {count} 种")
        
        # 2. 检查 HerbKnowledgeService
        logger.info("\n[2] 检查 HerbKnowledgeService...")
        service_stats = await check_herb_knowledge_service(db)
        
        logger.info(f"\n  服务状态:")
        logger.info(f"    适配器工作: {'✅ 是' if service_stats['adapter_working'] else '❌ 否'}")
        logger.info(f"    药材加载数: {service_stats.get('herbs_loaded', 0)}")
        logger.info(f"    功效类别数: {service_stats.get('efficacy_categories', 0)}")
        logger.info(f"    数据充足: {'✅ 是' if service_stats.get('sufficient', False) else '❌ 否'}")
        
        if service_stats.get('sample_herbs'):
            logger.info(f"\n  样本药材:")
            for herb in service_stats['sample_herbs']:
                logger.info(f"    - {herb['name_cn']}: {herb['efficacy_count']} 项功效, 安全指数 {herb['safety_index']}")
        
        if 'error' in service_stats:
            logger.error(f"  错误: {service_stats['error']}")
    
    # 3. 最终评估
    logger.info("\n" + "=" * 70)
    logger.info("评估结果:")
    
    db_ok = db_stats['sufficient_data']
    service_ok = service_stats.get('sufficient', False)
    
    if db_ok and service_ok:
        logger.info("  ✅ 数据完整性检查通过，可以正常使用配方生成功能")
    elif db_ok:
        logger.warning("  ⚠️  数据库数据充足，但 HerbKnowledgeService 加载失败")
    elif service_ok:
        logger.warning("  ⚠️  HerbKnowledgeService 工作正常，但数据库数据不足")
    else:
        logger.error("  ❌ 数据完整性检查失败，请先运行数据补全脚本")
        logger.error("     运行命令: python -m app.services.recipe_generation_data_completer")
    
    logger.info("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
