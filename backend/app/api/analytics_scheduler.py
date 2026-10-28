"""
Scheduler API Router — 定时报表管理

提供定时任务的增删改查接口，并持久化到数据库。

端点：
- GET    /api/v1/analytics/scheduler/jobs      — 列出所有定时任务（含 DB 持久化记录）
- POST   /api/v1/analytics/scheduler/jobs      — 创建定时任务（同时写入 DB）
- DELETE /api/v1/analytics/scheduler/jobs/{id} — 删除定时任务（同时清理 DB）
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import get_current_active_user
from app.core.analytics_reports.scheduled_reports import get_scheduler
from app.models.analytics_scheduler import ensure_table_exists
from app.models.user_model import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics/scheduler", tags=["定时报表调度"])


class CreateJobRequest(BaseModel):
    template_id: str = Field(..., description="报表模板 ID")
    cron: str = Field("0 9 * * *", description="Cron 表达式，默认每天 9:00")
    recipients: List[str] = Field(default_factory=list, description="收件人列表")
    settings: Dict[str, Any] = Field(default_factory=dict, description="SMTP 等配置")


@router.get("/jobs", summary="列出所有定时任务")
async def list_jobs(current_user: User = Depends(get_current_active_user)):
    """列出所有定时任务（含数据库持久化记录）。"""
    jobs = get_scheduler().list_jobs()
    return {"jobs": jobs}


@router.post("/jobs", summary="创建定时任务", status_code=201)
async def create_job(
    req: CreateJobRequest,
    db,
    current_user: User = Depends(get_current_active_user),
):
    """创建定时任务，同步写入数据库。"""
    import time  # noqa: PLC0415

    job_id = f"job_{req.template_id}_{int(time.time())}"
    scheduler = get_scheduler()

    # 注册到内存调度器
    scheduler.register(
        job_id=job_id,
        template_id=req.template_id,
        cron_expr=req.cron,
        recipients=req.recipients,
        settings=req.settings,
    )

    # 持久化到数据库（异步，不阻塞响应）
    try:
        import asyncio  # noqa: PLC0415

        from app.models.analytics_scheduler import upsert_job  # noqa: PLC0415

        async def _persist():
            from app.core.database.session import AsyncSessionLocal  # noqa: PLC0415
            async with AsyncSessionLocal() as db_session:
                await ensure_table_exists(db_session)
                await upsert_job(
                    db=db_session,
                    job_id=job_id,
                    template_id=req.template_id,
                    cron_expr=req.cron,
                    recipients=req.recipients,
                    settings=req.settings,
                )

        asyncio.create_task(_persist())
    except Exception as e:
        logger.warning("[Scheduler] 数据库持久化失败（非致命）: %s", e)

    return {"job_id": job_id, "message": "定时任务已创建"}


@router.delete("/jobs/{job_id}", summary="删除定时任务")
async def delete_job(
    job_id: str,
    db,
    current_user: User = Depends(get_current_active_user),
):
    """删除定时任务，同步清理数据库记录。"""
    # 从 job_id 中提取 template_id
    template_id = job_id.replace("job_", "")
    # 清理时间戳后缀（如 job_xxx_1234567890）
    if "_" in template_id:
        parts = template_id.rsplit("_", 1)
        if parts[-1].isdigit():
            template_id = parts[0]

    scheduler = get_scheduler()
    scheduler.unregister(job_id)

    # 从数据库删除（异步，不阻塞响应）
    try:
        import asyncio  # noqa: PLC0415

        async def _remove():
            from app.core.database.session import AsyncSessionLocal  # noqa: PLC0415
            from app.models.analytics_scheduler import remove_job  # noqa: PLC0415
            async with AsyncSessionLocal() as db_session:
                await remove_job(db_session, template_id)

        asyncio.create_task(_remove())
    except Exception as e:
        logger.warning("[Scheduler] 数据库删除失败（非致命）: %s", e)

    return {"message": f"任务 {job_id} 已删除"}


@router.post("/sync-db", summary="手动同步 DB → 内存")
async def sync_db_to_memory(current_user: User = Depends(get_current_active_user)):
    """启动时将 DB 中的任务加载到内存。"""
    scheduler = get_scheduler()
    loaded = await scheduler.load_jobs_from_db()
    return {"loaded": len(loaded), "jobs": loaded}

