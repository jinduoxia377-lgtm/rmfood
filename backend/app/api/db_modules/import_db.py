"""导入任务数据库持久化模块

提供导入任务追踪和错误日志的数据库操作函数。所有操作均使用异步 SQLAlchemy Session。
"""
from datetime import datetime, timezone
from typing import Any, Dict

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_import_task(db: AsyncSession, task_id: str) -> dict:
    """从 import_tasks 表获取任务记录."""
    result = await db.execute(text("SELECT * FROM import_tasks WHERE task_id = :tid"), {"tid": task_id})
    row = result.fetchone()
    if not row:
        raise ValueError(f"任务 {task_id} 不存在")
    return dict(row._mapping)


async def update_task_progress(db: AsyncSession, task_id: str, updates: Dict[str, Any]) -> None:
    """更新任务进度（部分字段合并更新）."""
    now = datetime.now(timezone.utc).isoformat()

    # 构建 SET 子句
    set_clauses = []
    params = {"task_id": task_id, "updated_at": now}

    for key, value in updates.items():
        if key not in ("processed_add", "inserted_add", "updated_add", "error_add"):
            set_clauses.append(f"{key} = :{key}")
            params[key] = value

    if set_clauses:
        query = text(f"""
            UPDATE import_tasks SET
                {", ".join(set_clauses)},
                updated_at = :updated_at
            WHERE task_id = :task_id
        """)
        await db.execute(query, params)
        await db.commit()
    else:
        # 仅更新 updated_at
        await db.execute(
            text("UPDATE import_tasks SET updated_at = :now WHERE task_id = :tid"),
            {"now": now, "tid": task_id}
        )
        await db.commit()


async def complete_task(db: AsyncSession, task_id: str, status: str, stats: Dict[str, Any], message: str = "") -> None:
    """标记任务完成（COMPLETED/FAILED/CANCELLED）."""
    now = datetime.now(timezone.utc).isoformat()

    total_rows = stats.get("total_rows", stats.get("valid_rows", 0))
    processed_rows = stats.get("valid_rows", 0)
    inserted = stats.get("inserted", 0)
    updated = stats.get("updated", 0)
    error_count = stats.get("error_count", 0)

    progress_pct = round(processed_rows / total_rows * 100, 1) if total_rows > 0 else 0.0

    await db.execute(text("""
        UPDATE import_tasks SET
            status = :status,
            total_rows = COALESCE(total_rows, :total_rows),
            processed_rows = COALESCE(processed_rows, :processed_rows),
            inserted_rows = COALESCE(inserted_rows, :inserted_rows),
            updated_rows = COALESCE(updated_rows, :updated_rows),
            error_rows = COALESCE(error_rows, :error_rows),
            progress_pct = :progress_pct,
            error_summary = :message,
            updated_at = :updated_at
        WHERE task_id = :task_id
    """, {
        "status": status,
        "task_id": task_id,
        "total_rows": total_rows,
        "processed_rows": processed_rows,
        "inserted_rows": inserted,
        "updated_rows": updated,
        "error_rows": error_count,
        "progress_pct": progress_pct,
        "message": message[:2000],
        "updated_at": now,
    }))
    await db.commit()


async def log_import_error(db: AsyncSession, task_id: str, row_number: int, raw_data: str,
                           error_msg: str, error_type: str = "validation") -> None:
    """在 import_errors 表中记录单行错误."""
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(text("""
        INSERT INTO import_errors (task_id, row_number, raw_data, error_message, error_type, created_at)
        VALUES (:task_id, :row_number, :raw_data, :error_message, :error_type, :created_at)
    """, {
        "task_id": task_id,
        "row_number": row_number,
        "raw_data": raw_data[:500],
        "error_message": error_msg[:500],
        "error_type": error_type,
        "created_at": now,
    }))
    await db.commit()
