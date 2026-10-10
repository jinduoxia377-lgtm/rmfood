"""数据导入 API 路由

提供文件上传、预览、执行导入、进度查询、错误日志等端点。
注册到 /api/v1/imports 前缀下。
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import BigInteger as sa_BigInteger, String as sa_String, DateTime as sa_DateTime

from app.api.deps import get_db_session
from app.services.import_engine.celery.worker import run_import_task
from app.schemas.import_schema import (
    CancelResponse,
    ImportErrorItem,  # A-27: 488 行用到，原漏导入
    ImportErrorsResponse,
    ImportListResponse,
    ImportPreviewRequest,
    ImportReportResponse,
    ImportRunRequest,
    ImportTaskDetail,
    ImportTaskSummary,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/imports", tags=["数据导入"])


# ── 任务状态完全持久化到数据库 ────────────────────────────────────
# 不再使用内存字典存储任务，所有状态都保存在 import_tasks 表中

async def _get_task(task_id: str, db: AsyncSession) -> dict:
    """从数据库获取任务（使用AsyncSession）"""
    result = await db.execute(
        text("SELECT * FROM import_tasks WHERE task_id = :tid"),
        {"tid": task_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="导入任务不存在")
    return dict(row._mapping)


async def _load_tasks_from_db(db: AsyncSession) -> list[dict]:
    """从数据库加载导入任务列表"""
    result = await db.execute(
        text("SELECT * FROM import_tasks ORDER BY created_at DESC LIMIT 50"),
    )
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


async def _save_task_to_db(db: AsyncSession, task_data: dict) -> None:
    """将任务状态持久化到数据库"""
    await db.execute(text("""
        INSERT INTO import_tasks (
            task_id, user_id, adapter_type, target_table, status,
            total_rows, processed_rows, inserted_rows, updated_rows, error_rows,
            progress_pct, error_summary, file_name, file_size_bytes, mapping_config,
            created_at, updated_at
        ) VALUES (
            :task_id, :user_id, :adapter_type, :target_table, :status,
            :total_rows, :processed_rows, :inserted_rows, :updated_rows, :error_rows,
            :progress_pct, :error_summary, :file_name, :file_size_bytes, :mapping_config,
            :created_at, :updated_at
        )
        ON CONFLICT (task_id) DO UPDATE SET
            status = EXCLUDED.status,
            total_rows = EXCLUDED.total_rows,
            processed_rows = EXCLUDED.processed_rows,
            inserted_rows = EXCLUDED.inserted_rows,
            updated_rows = EXCLUDED.updated_rows,
            error_rows = EXCLUDED.error_rows,
            progress_pct = EXCLUDED.progress_pct,
            error_summary = EXCLUDED.error_summary,
            updated_at = NOW()
    """), {
        "task_id": task_data["task_id"],
        "user_id": task_data.get("user_id"),
        "adapter_type": task_data["adapter_type"],
        "target_table": task_data["target_table"],
        "status": task_data["status"],
        "total_rows": task_data["total_rows"],
        "processed_rows": task_data["processed_rows"],
        "inserted_rows": task_data["inserted_rows"],
        "updated_rows": task_data["updated_rows"],
        "error_rows": task_data["error_rows"],
        "progress_pct": task_data["progress_pct"],
        "error_summary": task_data.get("error_summary", ""),
        "file_name": task_data.get("file_name"),
        "file_size_bytes": task_data.get("file_size_bytes"),
        "mapping_config": json.dumps(task_data.get("mapping_config", {}), ensure_ascii=False) if task_data.get("mapping_config") else None,
        "created_at": task_data.get("created_at", datetime.now(timezone.utc).isoformat()),
        "updated_at": task_data.get("updated_at", datetime.now(timezone.utc).isoformat()),
    })
    await db.commit()


# ── 端点 ─────────────────────────────────────────────────────


@router.post("/upload", summary="上传文件并创建导入任务")
async def upload_file(
    file: UploadFile = File(..., description="CSV/JSON 文件"),
    file_type: str = Form("csv", description="文件类型: csv | json"),
    delimiter: str = Form("auto", description="CSV 分隔符"),
    db: AsyncSession = Depends(get_db_session),
):
    """上传数据文件，返回 task_id，之后可调用 preview 和 run。"""
    # 验证文件类型
    allowed_types = {
        "csv": [".csv", ".tsv", ".txt"],
        "json": [".json", ".jsonl"],
    }
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_types.get(file_type, []):
        raise HTTPException(
            status_code=400,
            detail=f"类型 '{file_type}' 不支持文件扩展名 '{ext}'。"
                   f"允许扩展名：{allowed_types.get(file_type, [])}",
        )

    # 保存到临时目录
    import_dir = Path(__file__).parent.parent.parent / "data" / "imports"
    import_dir.mkdir(parents=True, exist_ok=True)

    task_id = str(uuid.uuid4())
    safe_filename = file.filename or ""
    if not safe_filename:
        raise HTTPException(status_code=400, detail="文件名无效")
    # Simple sanitization (remove path and dangerous chars)
    from pathlib import Path
    safe_filename = Path(safe_filename).name
    import re
    safe_filename = re.sub(r'[^\w\.-]', '_', safe_filename)
    safe_filename = re.sub(r'_+', '_', safe_filename).strip('.')
    temp_path = import_dir / f"{task_id}_{safe_filename}"

    content = await file.read()
    file_size = len(content)
    temp_path.write_bytes(content)

    # 初始化任务记录
    now_iso = datetime.now(timezone.utc).isoformat()
    task_data = {
        "task_id": task_id,
        "_temp_path": str(temp_path),  # Temporary internal reference
        "user_id": None,  # TODO: 从 session 中获取当前用户
        "adapter_type": file_type,
        "target_table": "",  # 运行导入时设置
        "status": "uploaded",
        "total_rows": 0,
        "processed_rows": 0,
        "inserted_rows": 0,
        "updated_rows": 0,
        "error_rows": 0,
        "progress_pct": 0.0,
        "file_name": safe_filename,
        "file_size_bytes": file_size,
        "mapping_config": {"delimiter": delimiter, "file_path": str(temp_path)},
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await _save_task_to_db(db, task_data)

    logger.info(f"[{task_id}] 文件已上传: {safe_filename} ({file_size:,} bytes)")

    return {
        "task_id": task_id,
        "file_name": safe_filename,
        "file_size_bytes": file_size,
        "status": "uploaded",
        "message": "文件上传成功。请使用 /preview 与 /run 端点继续操作。",
    }


@router.post("/{task_id}/preview", summary="预览数据")
async def preview_data(
    task_id: str,
    req: ImportPreviewRequest | None = None,
    limit: int = Query(10, ge=1, le=100),
    delimiter: str = Query("auto", description="CSV 分隔符"),
    data_path: str | None = Query(None, description="JSON 嵌套路径"),
    db: AsyncSession = Depends(get_db_session),
):
    """预览上传文件的前 N 行原始数据。"""
    task = _get_task(task_id, db)

    if task["status"] != "uploaded":
        raise HTTPException(status_code=400, detail="任务须处于已上传状态才能预览")

    file_path_str = task.get("_temp_path")
    if not file_path_str:
        raise HTTPException(status_code=400, detail="文件路径不可用")

    file_path = Path(file_path_str)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="上传的文件不存在")

    try:
        from app.services.import_engine.adapters.csv_adapter import CsvAdapter
        from app.services.import_engine.adapters.json_adapter import JsonAdapter

        if task["adapter_type"] == "csv":
            adapter = CsvAdapter(
                file_path=file_path,
                delimiter=delimiter,
                chunk_size=limit,
            )
        elif task["adapter_type"] == "json":
            adapter = JsonAdapter(
                file_path=file_path,
                is_jsonl=Path(file_path).suffix == ".jsonl",
                data_path=data_path,
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported adapter type: {task['adapter_type']}")

        valid, msg = await adapter.validate()
        if not valid:
            raise HTTPException(status_code=400, detail=f"Validation failed: {msg}")

        total = await adapter.count()
        preview_rows = await adapter.preview(limit=limit)

        # 更新任务中的行数
        task["total_rows"] = total
        await _save_task_to_db(db, task)

        return {
            "total_rows": total,
            "preview": preview_rows,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[{task_id}] Preview failed")
        raise HTTPException(status_code=500, detail="预览失败，请稍后重试")


@router.post("/{task_id}/run", summary="执行导入")
async def run_import(
    task_id: str,
    req: ImportRunRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """启动数据导入任务（异步非阻塞）。"""
    task = _get_task(task_id, db)

    if task["status"] not in ("uploaded", "failed"):
        raise HTTPException(
            status_code=400,
            detail=f"任务处于 '{task['status']}' 状态，无法启动导入",
        )

    # 准备任务配置
    # Extract file_path from existing mapping_config if available
    mapping_config = task.get("mapping_config", {}) or {}
    file_path = mapping_config.get("file_path") or task.get("_temp_path")  # Fallback for old tasks

    # Prepare new mapping config with mappings but preserve file_path
    new_mapping_config = {
        "mappings": [m.model_dump() for m in req.mappings],
    }
    if file_path:
        new_mapping_config["file_path"] = file_path

    task.update({
        "target_table": req.target_table,
        "id_field": req.id_field,
        "status": "queued",
        "mapping_config": new_mapping_config,
    })
    task["updated_at"] = datetime.now(timezone.utc).isoformat()
    await _save_task_to_db(db, task)

    # 启动 Celery 异步任务
    try:
        from app.services.import_engine.celery.worker import run_import_task as celery_worker
        adapter_type = task["adapter_type"]

        # Dispatch Celery task with all required parameters
        # Use new_mapping_config which already contains file_path
        celery_result = celery_worker.delay(
            task_id=task_id,
            adapter_type=adapter_type,
            target_table=req.target_table,
            id_field=req.id_field,
            mapping_config={"mappings": [m.model_dump() for m in req.mappings]},
            file_path=file_path,
            user_id=None,  # TODO: get from auth session
        )
        return {
            "task_id": task_id,
            "status": "queued",
            "message": "Import started asynchronously. Check progress with /{task_id}",
            "celery_task_id": celery_result.id,
        }
    except Exception as e:
        logger.error(f"[{{task_id}}] Failed to start Celery task: {{e}}")
        task.update({
            "status": "failed",
            "error_summary": "导入任务启动失败",
        })
        task["updated_at"] = datetime.now(timezone.utc).isoformat()
        await _save_task_to_db(db, task)
        raise HTTPException(status_code=500, detail="导入任务启动失败，请稍后重试")


@router.get("", summary="列出所有导入任务")
async def list_import_tasks(
    status: Optional[str] = Query(None, description="按状态筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
):
    tasks = await _load_tasks_from_db(db)

    if status:
        tasks = [t for t in tasks if t.get("status") == status]

    total = len(tasks)
    start = (page - 1) * page_size
    end = start + page_size
    paginated = tasks[start:end]

    summaries = []
    for t in paginated:
        total_rows = t.get("total_rows", 0) or 0
        processed = t.get("processed_rows", 0) or 0
        inserted = t.get("inserted_rows", 0) or 0
        updated = t.get("updated_rows", 0) or 0
        success_rate = round((inserted + updated) / total_rows * 100, 2) if total_rows > 0 else 0.0
        summaries.append(ImportTaskSummary(**{
            "task_id": t["task_id"],
            "adapter_type": t["adapter_type"],
            "target_table": t["target_table"],
            "status": t["status"],
            "total_rows": total_rows,
            "processed_rows": processed,
            "inserted_rows": inserted,
            "updated_rows": updated,
            "error_rows": t.get("error_rows", 0) or 0,
            "progress_pct": t.get("progress_pct", 0.0) or 0.0,
            "success_rate": success_rate,
            "file_name": t.get("file_name"),
            "created_at": t["created_at"].isoformat() if hasattr(t["created_at"], "isoformat") else str(t["created_at"]),
            "updated_at": t["updated_at"].isoformat() if hasattr(t["updated_at"], "isoformat") else str(t["updated_at"]),
        }))

    return ImportListResponse(tasks=summaries, total=total)


@router.get("/{task_id}", summary="获取任务详情")
async def get_task_detail(
    task_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    task = _get_task(task_id, db)

    # 优先从数据库读取最新状态
    result = await db.execute(
        text("SELECT * FROM import_tasks WHERE task_id = :tid"),
        {"tid": task_id},
    )
    row = result.fetchone()
    if row:
        d = dict(row._mapping)
        total_rows = d.get("total_rows", 0) or 0
        inserted = d.get("inserted_rows", 0) or 0
        updated = d.get("updated_rows", 0) or 0
        success_rate = round((inserted + updated) / total_rows * 100, 2) if total_rows > 0 else 0.0
        return ImportTaskDetail(
            task_id=d["task_id"],
            adapter_type=d["adapter_type"],
            target_table=d["target_table"],
            status=d["status"],
            total_rows=total_rows,
            processed_rows=d.get("processed_rows", 0) or 0,
            inserted_rows=inserted,
            updated_rows=updated,
            error_rows=d.get("error_rows", 0) or 0,
            progress_pct=d.get("progress_pct", 0.0) or 0.0,
            success_rate=success_rate,
            error_summary=d.get("error_summary", "") or "",
            file_name=d.get("file_name"),
            file_size_bytes=d.get("file_size_bytes"),
            mapping_config=json.loads(d["mapping_config"]) if d.get("mapping_config") else None,
            created_at=d["created_at"].isoformat() if hasattr(d["created_at"], "isoformat") else str(d["created_at"]),
            updated_at=d["updated_at"].isoformat() if hasattr(d["updated_at"], "isoformat") else str(d["updated_at"]),
        )

    # Fallback: 内存状态
    total_rows = task.get("total_rows", 0) or 0
    inserted = task.get("inserted_rows", 0) or 0
    updated = task.get("updated_rows", 0) or 0
    success_rate = round((inserted + updated) / total_rows * 100, 2) if total_rows > 0 else 0.0
    return ImportTaskDetail(
        task_id=task_id,
        adapter_type=task.get("adapter_type", ""),
        target_table=task.get("target_table", ""),
        status=task.get("status", ""),
        total_rows=total_rows,
        processed_rows=task.get("processed_rows", 0) or 0,
        inserted_rows=inserted,
        updated_rows=updated,
        error_rows=task.get("error_rows", 0) or 0,
        progress_pct=task.get("progress_pct", 0.0) or 0.0,
        success_rate=success_rate,
        error_summary=task.get("error_summary", ""),
        file_name=task.get("file_name"),
        file_size_bytes=task.get("file_size_bytes"),
        mapping_config=task.get("mapping_config"),
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )


@router.delete("/{task_id}", summary="取消或删除导入任务")
async def cancel_import(
    task_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    task = _get_task(task_id, db)

    if task["status"] == "running":
        raise HTTPException(status_code=400, detail="无法取消运行中的任务")

    task["status"] = "cancelled"
    task["updated_at"] = datetime.now(timezone.utc).isoformat()
    await _save_task_to_db(db, task)

    # 删除临时文件
    temp_path = task.get("_temp_path")
    if temp_path and Path(temp_path).exists():
        Path(temp_path).unlink()


    return CancelResponse(
        task_id=task_id,
        status="cancelled",
        message="Import task cancelled and cleaned up",
    )


@router.get("/{task_id}/errors", summary="获取导入错误日志")
async def get_import_errors(
    task_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    error_type: Optional[str] = Query(None, description="按错误类型筛选"),
    db: AsyncSession = Depends(get_db_session),
):
    offset = (page - 1) * page_size

    # Build query dynamically with proper parameterization
    query = text("""
        SELECT id, row_number, raw_data, error_message, error_type, created_at
        FROM import_errors
        WHERE task_id = :tid
        ORDER BY id DESC
        LIMIT :limit OFFSET :offset
    """)
    params: dict = {"tid": task_id, "limit": page_size, "offset": offset}

    if error_type:
        # Add error_type filter as parameter (NOT string interpolation)
        query = text(query.text + " AND error_type = :et_type")
        params["et_type"] = error_type

    result = await db.execute(query, params)
    rows = result.fetchall()

    errors = []
    for r in rows:
        m = r._mapping
        errors.append(ImportErrorItem(
            row=m["row_number"] or 0,
            raw_data=(m["raw_data"] or "")[:500],
            error=m["error_message"] or "",
            type=m["error_type"] or "unknown",
        ))

    # Calculate total count with same filter
    count_query = text("SELECT COUNT(*) FROM import_errors WHERE task_id = :tid")
    count_params = {"tid": task_id}
    if error_type:
        count_query = text(count_query.text + " AND error_type = :et_type")
        count_params["et_type"] = error_type

    count_result = await db.execute(count_query, count_params)
    total = count_result.scalar() or 0

    return ImportErrorsResponse(errors=errors, total=total, page=page, page_size=page_size)
