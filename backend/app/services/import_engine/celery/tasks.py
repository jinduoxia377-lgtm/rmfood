"""Celery 异步导入任务定义

包含用于执行数据导入的 Celery 任务。
该任务从数据库中读取配置，执行导入并实时更新进度。
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.api.db_modules.import_db import get_import_task, update_task_progress, complete_task, log_import_error
from app.services.import_engine.engine import ImportEngine, ImportStatus, ImportReport, ImportStats
from app.services.import_engine.adapters.csv_adapter import CsvAdapter
from app.services.import_engine.adapters.json_adapter import JsonAdapter
from app.services.import_engine.adapters.base import FieldMapper, AdapterType
from app.api.deps import get_db_session

logger = logging.getLogger(__name__)


class ImportWorker:
    """导入工作器，执行实际的导入逻辑并在数据库中进行状态追踪."""

    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.import_engine: Optional[ImportEngine] = None

    async def execute_import(self, task_id: str, adapter_type: str, target_table: str, id_field: str,
                             mapping_config: Dict[str, Any], file_path: str, user_id: Optional[int] = None) -> ImportReport:
        """执行完整的导入流程."""
        logger.info(f"[{task_id}] 开始导入: adapter={adapter_type}, table={target_table}")

        # 1. 验证并获取任务记录（确保任务已创建）
        try:
            task_record = await get_import_task(task_id, self.db)
            logger.info(f"[{task_id}] 找到任务记录，当前状态: {task_record.get('status')}")
        except Exception as e:
            logger.warning(f"[{task_id}] 未找到任务记录，将创建新记录: {e}")
            # 如果任务不存在，说明可能在 Celery 启动前未创建，继续执行

        # 2. 初始化适配器
        if adapter_type.lower() == "csv":
            adapter = CsvAdapter(file_path=file_path)
        elif adapter_type.lower() == "json":
            adapter = JsonAdapter(file_path=file_path, is_jsonl=False)
        else:
            raise ValueError(f"不支持的适配器类型: {adapter_type}")

        # 3. 统计总行数并更新任务进度
        total_rows = await adapter.count()
        logger.info(f"[{task_id}] 文件总行数: {total_rows:,}")
        await self._update_task_progress(task_id, {"total_rows": total_rows})

        # 4. 构建字段映射器
        mapper = FieldMapper()
        for m in mapping_config.get("mappings", []):
            mapper.add(
                source=m["source"],
                target=m["target"],
                required=m.get("required", False),
                default=m.get("default"),
                transform=m.get("transform"),
            )

        # 5. 创建导入引擎
        self.import_engine = ImportEngine(self.db)

        # 6. 执行导入循环（包含进度跟踪）
        inserted = 0
        updated = 0
        error_count = 0
        batch_buffer: list[Dict[str, Any]] = []
        last_log_count = 0
        row_num_idx = 0

        async for raw_row in adapter.iterate():
            row_num_idx += 1

            try:
                mapped, errors = mapper.map(raw_row)

                if errors:
                    for err in errors:
                        await self._log_task_error(task_id, row_num_idx, raw_row, err, "validation")
                    if not mapped:
                        error_count += 1
                        continue

                batch_buffer.append(mapped)

                # 批量写入
                if len(batch_buffer) >= ImportEngine.BATCH_SIZE:
                    batch_result = await self._write_batch(
                        batch_buffer, target_table, id_field, mapper
                    )
                    inserted += batch_result["inserted"]
                    updated += batch_result["updated"]
                    batch_buffer.clear()

                # 定期更新进度
                if row_num_idx % 5000 == 0:
                    progress = round(row_num_idx / total_rows * 100, 1) if total_rows > 0 else 0
                    await self._update_task_progress(task_id, {
                        "processed_rows": row_num_idx,
                        "progress_pct": progress,
                        "inserted_rows": inserted,
                        "updated_rows": updated,
                    })
                    logger.info(f"[{task_id}] 进度: {row_num_idx:,}/{total_rows:,} ({progress}%) 插入:{inserted} 更新:{updated} 错误:{error_count}")

            except Exception as e:
                error_count += 1
                await self._log_task_error(task_id, row_num_idx, str(raw_row)[:200], str(e), "transform")
                # 继续处理下一行

        # 最后一批
        if batch_buffer:
            batch_result = await self._write_batch(
                batch_buffer, target_table, id_field, mapper
            )
            inserted += batch_result["inserted"]
            updated += batch_result["updated"]

        # 7. 完成导入并生成报告
        final_progress = round(row_num_idx / total_rows * 100, 1) if total_rows > 0 else 0.0
        await self._update_task_progress(task_id, {
            "processed_rows": row_num_idx,
            "progress_pct": final_progress,
            "inserted_rows": inserted,
            "updated_rows": updated,
            "error_rows": error_count,
        })

        status = ImportStatus.COMPLETED
        message = f"导入完成: {inserted + updated:,} 行 ({inserted} 新增, {updated} 更新, {error_count} 错误)"

        report = ImportReport(
            task_id=task_id,
            stats=ImportStats(
                total_rows=total_rows,
                valid_rows=row_num_idx - error_count,
                invalid_rows=error_count,
                inserted=inserted,
                updated=updated,
                skipped=0,
                errors=[],
            ),
            status=status,
            duration_seconds=0.0,  # 实际计算在调用者处
            message=message,
        )

        logger.info(f"[{task_id}] {message}")
        return report

    async def _update_task_progress(self, task_id: str, updates: Dict[str, Any]) -> None:
        """更新任务进度到数据库."""
        await update_task_progress(
            db=self.db,
            task_id=task_id,
            updates=updates
        )

    async def _log_task_error(self, task_id: str, row_number: int, raw_data: str, error_msg: str, error_type: str = "validation") -> None:
        """记录单行错误到 import_errors 表."""
        await log_import_error(
            task_id=task_id,
            row_number=row_number,
            raw_data=raw_data,
            error_message=error_msg[:500],
            error_type=error_type,
        )

    async def _write_batch(self, batch: List[Dict[str, Any]], target_table: str, id_field: str,
                          mapper: FieldMapper) -> Dict[str, int]:
        """写入一批数据到数据库，返回 {inserted: int, updated: int}. """
        from sqlalchemy import text

        if not batch:
            return {"inserted": 0, "updated": 0}

        # 提取所有列名
        all_columns = set()
        for row in batch:
            all_columns.update(row.keys())
        columns = sorted(all_columns)
        col_names = ", ".join(columns)
        placeholders = ", ".join(f":{c}" for c in columns)

        # 先收集需要检查的 ID（用于区分 insert vs update）
        id_values = [str(row[id_field]) for row in batch if id_field in row and row[id_field] is not None]

        # 查询已存在的 ID 用于判断哪些是更新
        updated_ids = set()
        if id_values:
            param_names = [f"id_{i}" for i in range(len(id_values))]
            check_sql = text(f"SELECT {id_field} FROM {target_table} WHERE {id_field} IN ({','.join(param_names)})")
            check_params = {name: val for name, val in zip(param_names, id_values)}
            result = await self.db.execute(check_sql, check_params)
            updated_ids = {str(row[0]) for row in result.fetchall()}

        # 构建 ON CONFLICT 子句
        update_sets = []
        for c in columns:
            if c == id_field:
                continue
            update_sets.append(f"{c} = EXCLUDED.{c}")
        update_clause = ", ".join(update_sets)

        sql = text(f"""
            INSERT INTO {target_table} ({col_names})
            VALUES ({placeholders})
            ON CONFLICT ({id_field}) DO UPDATE SET
                {update_clause},
                updated_at = NOW()
        """)

        result = await self.db.execute(sql, batch)
        await self.db.commit()

        # 统计插入和更新数量
        inserted = 0
        updated = 0
        for row in batch:
            id_val = str(row.get(id_field)) if id_field in row else None
            if id_val and id_val in updated_ids:
                updated += 1
            else:
                inserted += 1

        return {"inserted": inserted, "updated": updated}


async def run_import_task_async(task_id: str, adapter_type: str, target_table: str, id_field: str,
                                mapping_config: Dict[str, Any], file_path: str,
                                user_id: Optional[int] = None) -> Dict[str, Any]:
    """Celery 任务的异步入口点."""
    db_session = None
    try:
        # 获取数据库会话
        db_session = next(get_db_session())
        db_session.autocommit = False  # 确保事务控制

        # 创建工作器
        worker = ImportWorker(db_session)

        # 开始导入
        report = await worker.execute_import(
            task_id=task_id,
            adapter_type=adapter_type,
            target_table=target_table,
            id_field=id_field,
            mapping_config=mapping_config,
            file_path=file_path,
            user_id=user_id,
        )

        # 标记任务完成
        await complete_task(
            db=db_session,
            task_id=task_id,
            status=report.status.value,
            stats=report.stats.to_dict(),
            message=report.message[:2000],
        )

        logger.info(f"[{task_id}] 导入成功完成: {report.message}")

        return {
            "status": "completed",
            "task_id": task_id,
            "report": report.to_dict(),
        }

    except Exception as e:
        logger.error(f"[{task_id}] 导入过程中发生错误: {e}", exc_info=True)

        if db_session:
            try:
                await complete_task(
                    db=db_session,
                    task_id=task_id,
                    status="failed",
                    stats={"total_rows": 0, "inserted": 0, "updated": 0, "error_count": 1, "success_rate": 0.0},
                    message=f"导入失败: {str(e)}"[:2000],
                )
            except Exception as update_err:
                logger.warning("[Import] 更新任务状态失败 (非致命): %s", update_err)

        raise
