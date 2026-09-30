"""
配方生成数据初始化脚本

在应用启动时运行，确保：
1. TCMHerb 表有完整的 extra_knowledge 数据
2. HerbKnowledgeService 能正确加载数据
3. 如果数据不完整，自动运行补全脚本

用法:
    python -m app.services.recipe_generation_data_initializer
"""
from __future__ import annotations

import asyncio
import logging
import sys
from typing import Any

sys.path.insert(0, ".")

logger = logging.getLogger(__name__)


async def ensure_data_completeness() -> dict[str, Any]:
    """
    确保配方生成数据完整性
    
    Returns:
        执行结果 {status: str, herbs_count: int, knowledge_rate: str, action: str}
    """
    from sqlalchemy import select, func
    from app.core.database.session import async_session_factory
    from app.models.external_data import TCMHerb
    
    result = {
        "status": "unknown",
        "herbs_count": 0,
        "knowledge_rate": "0%",
        "action": "none",
        "details": []
    }
    
    async with async_session_factory() as db:
        # 1. 检查当前数据状态
        logger.info("[Initializer] 检查数据库数据状态...")
        
        total_result = await db.execute(select(func.count()).select_from(TCMHerb))
        total_herbs = total_result.scalar() or 0
        
        with_knowledge_result = await db.execute(
            select(func.count())
            .select_from(TCMHerb)
            .where(TCMHerb.extra_knowledge != None)
            .where(TCMHerb.extra_knowledge != '')
        )
        with_knowledge = with_knowledge_result.scalar() or 0
        
        result["herbs_count"] = total_herbs
        result["knowledge_rate"] = f"{with_knowledge/total_herbs*100:.1f}%" if total_herbs > 0 else "0%"
        
        logger.info(f"[Initializer] 当前数据: {total_herbs} 种药材, {with_knowledge} 种有知识数据")
        
        # 2. 判断是否需要补全
        if total_herbs >= 50 and with_knowledge >= 40:
            logger.info("[Initializer] ✅ 数据已完整，无需补全")
            result["status"] = "sufficient"
            result["action"] = "none"
            return result
        
        # 3. 运行补全脚本
        logger.info("[Initializer] 开始数据补全...")
        result["details"].append("运行数据补全脚本...")
        
        try:
            from app.services.recipe_generation_data_completer import enrich_herb_knowledge
            
            enrich_stats = await enrich_herb_knowledge(db)
            result["details"].append(f"补全结果: 更新 {enrich_stats['updated']} 条")
            
            # 重新统计
            with_knowledge_result = await db.execute(
                select(func.count())
                .select_from(TCMHerb)
                .where(TCMHerb.extra_knowledge != None)
                .where(TCMHerb.extra_knowledge != '')
            )
            with_knowledge = with_knowledge_result.scalar() or 0
            result["knowledge_rate"] = f"{with_knowledge/total_herbs*100:.1f}%" if total_herbs > 0 else "0%"
            
            result["status"] = "enriched"
            result["action"] = "enrich_herb_knowledge"
            
            logger.info(f"[Initializer] ✅ 数据补全完成: {result['knowledge_rate']}")
            
        except Exception as e:
            logger.error(f"[Initializer] ❌ 数据补全失败: {e}")
            result["status"] = "failed"
            result["details"].append(f"补全失败: {str(e)}")
    
    return result


async def verify_adapter_loading() -> dict[str, Any]:
    """验证适配器能正确加载数据"""
    from app.infrastructure.herb_knowledge_adapters import TCMSPHerbKnowledgeAdapter
    from app.core.database.session import async_session_factory
    
    result = {
        "adapter_working": False,
        "herbs_loaded": 0,
        "error": None
    }
    
    try:
        async with async_session_factory() as db:
            adapter = TCMSPHerbKnowledgeAdapter(db)
            all_herbs = await adapter.get_all_herbs()
            
            result["adapter_working"] = True
            result["herbs_loaded"] = len(all_herbs)
            
            logger.info(f"[Initializer] ✅ 适配器加载成功: {len(all_herbs)} 种药材")
            
            if len(all_herbs) < 20:
                logger.warning(f"[Initializer] ⚠️  加载的药材数量不足: {len(all_herbs)} < 20")
                
    except Exception as e:
        result["error"] = str(e)
        logger.error(f"[Initializer] ❌ 适配器加载失败: {e}")
    
    return result


async def main():
    """主入口"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    logger.info("=" * 70)
    logger.info("配方生成数据初始化")
    logger.info("=" * 70)
    
    # 1. 确保数据完整
    init_result = await ensure_data_completeness()
    
    logger.info(f"\n初始化结果:")
    logger.info(f"  状态: {init_result['status']}")
    logger.info(f"  药材数: {init_result['herbs_count']}")
    logger.info(f"  知识覆盖率: {init_result['knowledge_rate']}")
    logger.info(f"  执行动作: {init_result['action']}")
    
    if init_result['details']:
        logger.info(f"  详情: {', '.join(init_result['details'])}")
    
    # 2. 验证适配器
    logger.info("\n验证适配器...")
    adapter_result = await verify_adapter_loading()
    
    logger.info(f"  适配器工作: {'✅ 是' if adapter_result['adapter_working'] else '❌ 否'}")
    logger.info(f"  加载药材: {adapter_result['herbs_loaded']}")
    
    if adapter_result['error']:
        logger.error(f"  错误: {adapter_result['error']}")
    
    # 3. 最终评估
    logger.info("\n" + "=" * 70)
    
    if init_result['status'] == 'sufficient' and adapter_result['adapter_working']:
        logger.info("✅ 数据初始化完成，配方生成功能可用")
        return 0
    elif init_result['status'] == 'enriched' and adapter_result['adapter_working']:
        logger.info("⚠️  数据已补全，但建议重启服务以确保 HerbKnowledgeService 正确初始化")
        return 0
    else:
        logger.error("❌ 数据初始化失败，请检查数据库连接和数据补全脚本")
        logger.error("   手动运行补全: python -m app.services.recipe_generation_data_completer")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
