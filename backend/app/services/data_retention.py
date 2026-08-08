"""RMFOOD 数据保留策略服务骨架

用于定期清理已过保留期的数据分类记录。
当前仅提供接口定义，实际调度由外部任务（如 Celery/APScheduler）触发。

使用方式:
    from app.services.data_retention import DataRetentionService
    service = DataRetentionService(db_session)
    await service.cleanup_expired()
"""
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


class DataRetentionService:
    """数据保留策略服务

    根据模型的 data_retention_days 字段定期清理过期数据。
    支持按 data_classification 等级设置不同的默认保留策略。
    """

    # 默认保留天数（按数据分类等级）
    DEFAULT_RETENTION_DAYS = {
        "public": None,           # 永久保留
        "internal": 365,          # 1年
        "secret": 90,             # 90天
        "top_secret": 30,         # 30天
    }

    def __init__(self, db_session):
        self.db = db_session

    async def cleanup_expired(
        self,
        cutoff_date: Optional[datetime] = None,
        dry_run: bool = True,
    ) -> dict:
        """
        清理已过保留期的数据

        Args:
            cutoff_date: 截止日期（默认当前时间）
            dry_run: 是否仅预览（不实际删除）

        Returns:
            {"deleted_count": int, "dry_run": bool}
        """
        if cutoff_date is None:
            cutoff_date = datetime.now(timezone.utc)

        if dry_run:
            logger.info("[DataRetention] DRY RUN: 将清理 %s 之前的过期数据", cutoff_date)
            return {"deleted_count": 0, "dry_run": True}

        logger.info("[DataRetention] 清理 %s 之前的过期数据", cutoff_date)
        return {"deleted_count": 0, "dry_run": False}

    @classmethod
    def get_default_retention_days(cls, classification: str) -> Optional[int]:
        """获取指定数据分类等级的默认保留天数"""
        return cls.DEFAULT_RETENTION_DAYS.get(classification)
