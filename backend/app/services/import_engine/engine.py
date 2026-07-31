"""ImportEngine — 核心导入引擎

协调 Adapter → FieldMapper → Database 的完整导入流水线。
支持批量写入、进度追踪、错误隔离和幂等 upsert。
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from .adapters.base import BaseAdapter, FieldMapper
from .models import (
    ImportReport,
    ImportStats,
    ImportStatus,
    AdapterType,
    ErrorType,
)

logger = logging.getLogger(__name__)


class ImportEngine:
    """核心导入引擎。

    用法:
        engine = ImportEngine(db_session)
        report = await engine.run(
            adapter=csv_adapter,
            mapper=field_mapper,
            target_table="retail_products",
            id_field="external_id",
        )
    """

    BATCH_SIZE = 500  # 每批写入的行数

    def __init__(self, db: AsyncSession):
        self.db = db

    async def run(
        self,
        adapter: BaseAdapter,
        mapper: FieldMapper,
        target_table: str,
        id_field: str = "external_id",
        adapter_type: AdapterType = AdapterType.CSV,
        user_id: Optional[int] = None,
        file_name: Optional[str] = None,
        file_size_bytes: Optional[int] = None,
        mapping_config: Optional[Dict[str, Any]] = None,
    ) -> ImportReport:
        """执行一次完整的导入流程。

        步骤:
        1. 验证适配器
        2. 统计总行数
        3. 逐行读取 → 映射 → 批量写入
        4. 生成报告
        """
        task_id = str(uuid.uuid4())
        start_time = datetime.now(timezone.utc)

        logger.info(f"[{task_id}] 开始导入: adapter={adapter_type.value}, table={target_table}")

        # Step 1: Validate
        valid, msg = await adapter.validate()
        if not valid:
            elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
            stats = adapter.get_stats()
            return ImportReport(
                task_id=task_id,
                stats=stats,
                status=ImportStatus.FAILED,
                duration_seconds=elapsed,
                message=f"Validation failed: {msg}",
            )

        # Step 2: Count total rows
        total_rows = await adapter.count()
        logger.info(f"[{task_id}] 总行数: {total_rows:,}")

        # Step 3: Iterate and import
        inserted = 0
        updated = 0
        error_count = 0
        batch_buffer: list[dict] = []
        last_log_count = 0

        async for row_num_idx, raw_row in enumerate(adapter.iterate(), start=1):
            try:
                mapped, errors = mapper.map(raw_row)
                if errors:
                    # 记录字段级错误
                    for err in errors:
                        adapter.record_error(row_num_idx, raw_row, err, ErrorType.VALIDATION.value)
                    # 如果有映射结果但不完整，仍然尝试写入（让 DB 约束处理）
                    if not mapped:
                        error_count += 1
                        continue

                batch_buffer.append(mapped)
                adapter.record_valid()

                # 批量写入
                if len(batch_buffer) >= self.BATCH_SIZE:
                    batch_result = await self._write_batch(
                        batch_buffer, target_table, id_field, mapper
                    )
                    inserted += batch_result["inserted"]
                    updated += batch_result["updated"]
                    batch_buffer.clear()

            except Exception as e:
                error_count += 1
                adapter.record_error(row_num_idx, str(raw_row)[:200], str(e), ErrorType.TRANSFORM.value)

            # 进度日志
            if row_num_idx - last_log_count >= 5000:
                logger.info(
                    f"[{task_id}] 已处理 {row_num_idx:,} 行 | "
                    f"有效: {adapter.stats.valid_rows:,} | "
                    f"错误: {error_count}"
                )
                last_log_count = row_num_idx

        # 最后一批
        if batch_buffer:
            batch_result = await self._write_batch(
                batch_buffer, target_table, id_field, mapper
            )
            inserted += batch_result["inserted"]
            updated += batch_result["updated"]
            batch_buffer.clear()

        # Step 4: Update stats
        adapter.stats.total_rows = total_rows
        adapter.stats.inserted = inserted
        adapter.stats.updated = updated
        adapter.stats.error_rows = error_count

        elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
        status = ImportStatus.COMPLETED  # 部分成功也算 completed

        report = ImportReport(
            task_id=task_id,
            stats=adapter.get_stats(),
            status=status,
            duration_seconds=elapsed,
            message=f"Imported {inserted + updated:,} rows ({inserted} new, {updated} updated, {error_count} errors) in {elapsed:.1f}s",
        )

        logger.info(f"[{task_id}] 导入完成: {report.message}")
        return report

    async def _write_batch(
        self,
        batch: list[dict],
        target_table: str,
        id_field: str,
        mapper: FieldMapper,
    ) -> dict:
        """将一批数据写入数据库。

        使用 INSERT ... ON CONFLICT DO UPDATE 实现幂等 upsert。
        返回 {inserted: int, updated: int}。
        """
        if not batch:
            return {"inserted": 0, "updated": 0}

        from sqlalchemy import text

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
            # Build placeholder names safely
            param_names = [f"id_{i}" for i in range(len(id_values))]
            check_sql = text(f"""
                SELECT {id_field} FROM {target_table}
                WHERE {id_field} IN ({','.join(param_names)})
            """)
            check_params = {name: val for name, val in zip(param_names, id_values)}
            result = await self.db.execute(check_sql, check_params)
            updated_ids = {str(row[0]) for row in result.fetchall()}

        # 构建 ON CONFLICT 子句
        update_sets = []
        for c in columns:
            if c == id_field:
                continue  # ID 不更新
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

        # 统计：在 batch 中，如果 ID 在已存在集合中则为更新，否则为插入
        inserted = 0
        updated = 0
        for row in batch:
            id_val = str(row.get(id_field)) if id_field in row else None
            if id_val and id_val in updated_ids:
                updated += 1
            else:
                inserted += 1

        return {"inserted": inserted, "updated": updated}
