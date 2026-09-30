"""
定时数据同步调度器

负责定期将 TCMSP/DFBP 内存知识库同步到 PostgreSQL。
基于 APScheduler (异步后台调度器)。

运行规则：
- TCMSP 中药材：每 6 小时同步一次（仅当内存数据 checksum 变化时）
- DFBP 肽链：每天凌晨 2:00 同步一次（仅当 checksum 变化时）

触发方式：
1. 通过 uvicorn --factory 启动时自动激活
2. 通过 system cron / systemd timer 调用独立脚本
"""
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, func

logger = logging.getLogger("rmfood.auto_sync")


_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler | None:
    """获取全局调度器实例（单例）"""
    return _scheduler


async def _sync_tcmsp_herbs():
    """同步 TCMSP 中药材数据"""
    logger.info("[auto_sync] 开始 TCMSP 中药材同步...")
    try:
        from app.services.data_sources.tcmsp_client import tcmsp_service
        from app.core.database.session import async_session_factory

        async with async_session_factory() as db:
            result = await tcmsp_service.sync_herbs(db, force=False)
            logger.info(f"[auto_sync] TCMSP 同步完成: {result}")
    except Exception as e:
        logger.error(f"[auto_sync] TCMSP 同步失败: {e}", exc_info=True)


async def _sync_dfbp_peptides():
    """同步 DFBP 肽链数据"""
    logger.info("[auto_sync] 开始 DFBP 肽链同步...")
    try:
        from app.services.data_sources.dfbp_client import dfbp_service
        from app.core.database.session import async_session_factory

        async with async_session_factory() as db:
            result = await dfbp_service.sync_peptides(db, force=False)
            logger.info(f"[auto_sync] DFBP 同步完成: {result}")
    except Exception as e:
        logger.error(f"[auto_sync] DFBP 同步失败: {e}", exc_info=True)


def start_auto_sync(app_state: dict | None = None):
    """启动定时同步调度器"""
    global _scheduler
    if _scheduler is not None:
        logger.warning("[auto_sync] 调度器已运行，跳过重复启动")
        return
    
    _scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")
    
    # TCMSP 每 6 小时
    _scheduler.add_job(
        _sync_tcmsp_herbs,
        trigger='interval',
        hours=6,
        id='tcmsp_herb_sync',
        name='TCMSP Herbs Sync',
        max_instances=1,
        replace_existing=True,
    )
    
    # DFBP 每天凌晨 2:00
    _scheduler.add_job(
        _sync_dfbp_peptides,
        trigger='cron',
        hour=2,
        minute=0,
        id='dfbp_peptide_sync',
        name='DFBP Peptides Sync',
        max_instances=1,
        replace_existing=True,
    )
    
    _scheduler.start()
    logger.info("[auto_sync] 调度器已启动")


def stop_auto_sync():
    """停止定时同步调度器"""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        logger.info("[auto_sync] 调度器已停止")
        _scheduler = None


# ── CLI 入口 ────────────────────────────────────────
# 此入口用于 cron/systemd 独立进程调用，非 FastAPI 事件循环内，asyncio.run() 安全。
if __name__ == "__main__":
    import asyncio
    
    async def one_shot_sync():
        """一次性同步所有数据源（用于 cron/systemd 调用）"""
        from app.core.database.session import async_session_factory
        
        async with async_session_factory() as db:
            from app.services.data_sources.tcmsp_client import tcmsp_service
            from app.services.data_sources.dfbp_client import dfbp_service
            
            h_result = await tcmsp_service.sync_herbs(db, force=False)
            logger.info(f"TCMSP sync: {h_result}")
            
            p_result = await dfbp_service.sync_peptides(db, force=False)
            logger.info(f"DFBP sync: {p_result}")
    
    asyncio.run(one_shot_sync())
