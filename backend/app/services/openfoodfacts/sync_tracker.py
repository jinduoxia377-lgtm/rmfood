"""
OFF 增量同步状态追踪器

使用 Redis (快速 checkpoint) + PostgreSQL (持久化状态) 双重追踪。
"""
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime, date, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class OFFSyncTracker:
    """增量同步状态追踪"""

    REDIS_KEY_CHECKPOINT = "off:sync:last_completed_date"
    REDIS_KEY_RUNNING = "off:sync:running"

    def __init__(self, db: AsyncSession, redis=None):
        self.db = db
        self.redis = redis

    async def get_last_completed_date(self) -> Optional[date]:
        """
        获取上次成功同步的日期

        优先读 Redis，失败则读 PostgreSQL。
        """
        # 1. 尝试 Redis
        if self.redis:
            try:
                cached = await self.redis.get(self.REDIS_KEY_CHECKPOINT)
                if cached:
                    return date.fromisoformat(coded.decode() if isinstance(cached, bytes) else cached)
            except Exception as e:
                logger.warning(f"[Tracker] Redis 读取失败: {e}")

        # 2. 回退 PostgreSQL
        try:
            result = await self.db.execute(text("""
                SELECT last_sync_date
                FROM off_sync_state
                WHERE status = 'completed'
                ORDER BY last_sync_date DESC
                LIMIT 1
            """))
            row = result.scalar()
            if row:
                if isinstance(row, str):
                    return date.fromisoformat(row)
                return row.date() if hasattr(row, 'date') else row
        except Exception as e:
            logger.warning(f"[Tracker] DB 读取失败: {e}")

        return None

    async def mark_sync_complete(
        self,
        sync_date: date,
        processed: int,
        updated: int,
        failed: int,
        status: str = "completed",
        error_message: str = None,
    ):
        """
        标记某日同步完成

        Args:
            sync_date: 同步日期
            processed: 处理总数
            updated: 更新数 (新插入为 0)
            failed: 失败数
            status: 状态
            error_message: 错误信息
        """
        # 1. 写入 Redis (快速 checkpoint)
        if self.redis:
            try:
                await self.redis.setex(
                    self.REDIS_KEY_CHECKPOINT,
                    86400 * 30,  # 30 天 TTL
                    sync_date.isoformat(),
                )
            except Exception as e:
                logger.warning(f"[Tracker] Redis 写入失败: {e}")

        # 2. 写入 PostgreSQL
        try:
            await self.db.execute(text("""
                INSERT INTO off_sync_state
                    (source, last_sync_date, total_processed, total_updated,
                     total_failed, status, started_at, completed_at, error_message)
                VALUES
                    (:source, :sync_date, :processed, :updated, :failed,
                     :status, :started, NOW(), :error)
            """), {
                "source": "openfoodfacts",
                "sync_date": sync_date,
                "processed": processed,
                "updated": updated,
                "failed": failed,
                "status": status,
                "started": datetime.now(timezone.utc),
                "error": error_message,
            })
            await self.db.commit()
            logger.info(
                f"[Tracker] 同步完成 {sync_date}: 处理={processed}, "
                f"成功={processed-failed}, 失败={failed}"
            )
        except Exception as e:
            await self.db.rollback()
            logger.error(f"[Tracker] DB 写入失败: {e}")

    async def get_sync_status(self) -> Dict[str, Any]:
        """获取最新同步状态"""
        try:
            result = await self.db.execute(text("""
                SELECT * FROM off_sync_state
                ORDER BY last_sync_date DESC
                LIMIT 1
            """))
            row = result.fetchone()
            if row:
                d = dict(row._mapping)
                return {
                    "last_sync_date": d.get("last_sync_date"),
                    "total_processed": d.get("total_processed", 0),
                    "total_updated": d.get("total_updated", 0),
                    "total_failed": d.get("total_failed", 0),
                    "status": d.get("status", "idle"),
                    "started_at": d.get("started_at"),
                    "completed_at": d.get("completed_at"),
                    "error_message": d.get("error_message"),
                }
        except Exception as e:
            logger.warning(f"[Tracker] 状态查询失败: {e}")

        return {
            "status": "idle",
            "last_sync_date": None,
            "total_processed": 0,
            "total_failed": 0,
        }

    async def log_error(
        self,
        barcode: str,
        error_type: str,
        error_message: str,
        raw_data: Dict[str, Any] = None,
    ):
        """记录导入错误"""
        try:
            await self.db.execute(text("""
                INSERT INTO off_import_errors
                    (barcode, error_type, error_message, raw_data)
                VALUES (:barcode, :error_type, :error_msg, :raw)::jsonb
            """), {
                "barcode": barcode,
                "error_type": error_type,
                "error_msg": error_message[:2000],
                "raw": json.dumps(raw_data, ensure_ascii=False)[:65535] if raw_data else None,
            })
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            logger.error(f"[Tracker] 错误日志写入失败: {e}")
