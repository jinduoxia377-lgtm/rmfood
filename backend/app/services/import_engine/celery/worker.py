"""Celery 异步导入任务模块

定义 Celery 应用和异步导入任务。
支持通过数据库追踪任务进度和状态。
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from celery import Celery

from app.api.db_modules.import_db import complete_task, get_import_task, update_task_progress
from app.core.config import CeleryConfig, get_settings
from app.core.database.session import get_session_factory
from app.services.import_engine.adapters.base import FieldMapper
from app.services.import_engine.adapters.csv_adapter import CsvAdapter
from app.services.import_engine.adapters.json_adapter import JsonAdapter
from app.services.import_engine.engine import ImportEngine

logger = logging.getLogger(__name__)
settings = get_settings()


def create_celery_app(cfg: Optional[CeleryConfig] = None) -> Celery:
    """创建 Celery 应用实例."""
    config = cfg or settings.celery

    app = Celery("import_worker")
    app.conf.update(
        broker_url=config.broker_url,
        result_backend=config.result_backend,
        task_default_queue=config.task_default_queue,
        task_serializer=config.task_serializer,
        accept_content=config.accept_content,
        result_expires=config.result_expires,
        task_track_started=config.task_track_started,
        task_time_limit=config.task_time_limit,
    )
    return app


# 全局 Celery 实例（懒加载）
_celery_app: Optional[Celery] = None


def get_celery_app() -> Celery:
    """获取 Celery 应用单例."""
    global _celery_app
    if _celery_app is None:
        _celery_app = create_celery_app()
    return _celery_app


CELERY_APP = get_celery_app()


@CELERY_APP.task(bind=True, max_retries=3, default_retry_delay=60)
async def run_import_task(self, task_id: str, adapter_type: str, target_table: str, id_field: str,
                           mapping_config: Dict[str, Any], file_path: str, user_id: Optional[int] = None):
    """执行数据导入的 Celery 任务.

    参数:
        task_id: 唯一任务标识符
        adapter_type: 适配器类型 ('csv' | 'json')
        target_table: 目标数据库表名
        id_field: 唯一标识字段名
        mapping_config: 字段映射配置
        file_path: 输入文件路径
        user_id: 操作用户 ID（可选）
    """
    logger.info(f"[{task_id}] Celery 任务开始执行")

    try:
        # 获取数据库会话
        session_factory = get_session_factory()
        async with session_factory() as db:
            # 获取任务记录
            try:
                task_record = await get_import_task(db, task_id)
                logger.info(f"[{task_id}] 找到任务记录，当前状态: {task_record.get('status')}")
            except ValueError:
                logger.warning(f"[{task_id}] 任务记录不存在，跳过初始化检查")
                task_record = None

            # 更新任务状态为 running
            if not task_record or task_record.get("status") in ("pending", "uploaded"):
                logger.info(f"[{task_id}] 将任务状态设为 running")
                await update_task_progress(db, task_id, {"status": "running", "started_at": datetime.now(timezone.utc).isoformat()})

            # 初始化适配器
            if adapter_type.lower() == "csv":
                adapter = CsvAdapter(file_path=file_path)
            elif adapter_type.lower() == "json":
                adapter = JsonAdapter(file_path=file_path, is_jsonl=file_path.endswith(".jsonl"))
            else:
                raise ValueError(f"不支持的适配器类型: {adapter_type}")

            # 统计总行数
            total_rows = await adapter.count()
            logger.info(f"[{task_id}] 文件总行数: {total_rows:,}")
            await update_task_progress(db, task_id, {"total_rows": total_rows})

            # 构建字段映射器
            mapper = FieldMapper()
            for m in mapping_config.get("mappings", []):
                mapper.add(
                    source=m["source"],
                    target=m["target"],
                    required=m.get("required", False),
                    default=m.get("default"),
                    transform=m.get("transform"),
                )

            # 执行导入
            engine = ImportEngine(db)
            report = await engine.run(
                adapter=adapter,
                mapper=mapper,
                target_table=target_table,
                id_field=id_field,
                adapter_type=adapter_type,
            )

            # 完成任务
            stats = report.stats.to_dict()
            await complete_task(
                db=db,
                task_id=task_id,
                status=report.status.value,
                stats=stats,
                message=report.message[:2000],
            )

            logger.info(f"[{task_id}] 导入完成: {report.message}")
            return {"task_id": task_id, "status": report.status.value, "stats": stats}

    except Exception as e:
        logger.error(f"[{task_id}] 导入失败: {e}", exc_info=True)
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=self.default_retry_delay)
        # 最后尝试标记失败
        try:
            # 重新获取数据库会话以标记失败
            session_factory = get_session_factory()
            async with session_factory() as db:
                await complete_task(
                    db=db,
                    task_id=task_id,
                    status="failed",
                    stats={"total_rows": 0, "inserted": 0, "updated": 0, "error_count": 1, "success_rate": 0.0},
                    message=str(e)[:2000],
                )
        except Exception as db_err:
            logger.error(f"[{task_id}] 标记任务失败时出错: {db_err}")
        raise
