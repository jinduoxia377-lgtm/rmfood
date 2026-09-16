"""
数据库同步 API
"""
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db_session, get_current_user
from ...models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sync", tags=["数据库同步"])


@router.get("/stats", summary="同步状态统计")
async def get_sync_stats(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """获取数据库同步状态统计"""
    # 获取各数据库的统计信息
    result = await db.execute(text("""
        SELECT 
            'herbs' as source,
            COUNT(*) as total_records,
            MAX(updated_at) as last_updated
        FROM tcmsp_herbs
        UNION ALL
        SELECT 
            'rmchm' as source,
            COUNT(*) as total_records,
            MAX(updated_at) as last_updated
        FROM rmchm_herbs
        UNION ALL
        SELECT 
            'peptides' as source,
            COUNT(*) as total_records,
            MAX(created_at) as last_updated
        FROM bioactive_peptides
    """))
    
    rows = result.fetchall()
    stats = {
        "herbs": {"total_records": 0, "last_updated": None},
        "rmchm": {"total_records": 0, "last_updated": None},
        "peptides": {"total_records": 0, "last_updated": None},
    }
    
    for row in rows:
        source = row[0]
        if source in stats:
            stats[source]["total_records"] = row[1] or 0
            stats[source]["last_updated"] = row[2].isoformat() if row[2] else None
    
    return {
        "success": True,
        "data": stats,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/herbs", summary="触发中药材同步")
async def sync_herbs(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """触发TCMSP中药材数据同步（异步执行）"""
    # 注意：实际同步逻辑应通过异步任务队列执行
    # 这里返回一个占位响应
    return {
        "status": "started",
        "message": "中药材同步任务已启动",
        "source": "tcmsp",
    }


@router.post("/peptides", summary="触发活性肽同步")
async def sync_peptides(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """触发生活性肽数据同步（异步执行）"""
    # 注意：实际同步逻辑应通过异步任务队列执行
    # 这里返回一个占位响应
    return {
        "status": "started",
        "message": "活性肽同步任务已启动",
        "source": "dfbp",
    }
