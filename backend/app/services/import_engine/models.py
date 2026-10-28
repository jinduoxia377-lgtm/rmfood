"""Import Engine 核心模型

定义导入任务、统计数据和报告的数据结构。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

# ── 状态枚举 ────────────────────────────────────────────────


class ImportStatus(str, Enum):
    """导入任务生命周期状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AdapterType(str, Enum):
    """数据源适配器类型"""
    CSV = "csv"
    JSON = "json"
    API = "api"


class ErrorType(str, Enum):
    """错误分类"""
    VALIDATION = "validation"      # 字段校验失败
    TRANSFORM = "transform"        # 数据转换失败
    DATABASE = "database"          # 数据库写入失败


# ── 导入任务 ────────────────────────────────────────────────


@dataclass
class ImportTask:
    """一个导入任务的运行时状态"""
    task_id: str
    adapter_type: AdapterType
    target_table: str
    status: ImportStatus = ImportStatus.PENDING
    total_rows: int = 0
    processed_rows: int = 0
    inserted_rows: int = 0
    updated_rows: int = 0
    error_rows: int = 0
    progress_pct: float = 0.0
    error_summary: str = ""
    file_name: Optional[str] = None
    file_size_bytes: Optional[int] = None
    mapping_config: Optional[Dict[str, Any]] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def is_done(self) -> bool:
        return self.status in (ImportStatus.COMPLETED, ImportStatus.FAILED, ImportStatus.CANCELLED)

    @property
    def success_rate(self) -> float:
        if self.total_rows == 0:
            return 0.0
        successful = self.inserted_rows + self.updated_rows
        return round(successful / self.total_rows * 100, 2)

    def mark_running(self) -> None:
        self.status = ImportStatus.RUNNING
        self.updated_at = datetime.now(timezone.utc)

    def mark_completed(self) -> None:
        self.status = ImportStatus.COMPLETED
        self.updated_at = datetime.now(timezone.utc)

    def mark_failed(self, reason: str) -> None:
        self.status = ImportStatus.FAILED
        self.error_summary = reason[:2000]  # 截断防止过大
        self.updated_at = datetime.now(timezone.utc)

    def mark_cancelled(self) -> None:
        self.status = ImportStatus.CANCELLED
        self.updated_at = datetime.now(timezone.utc)

    def advance(self, inserted: int = 0, updated: int = 0, errors: int = 0) -> None:
        self.processed_rows += inserted + updated + errors
        self.inserted_rows += inserted
        self.updated_rows += updated
        self.error_rows += errors
        if self.total_rows > 0:
            self.progress_pct = round(self.processed_rows / self.total_rows * 100, 2)
        self.updated_at = datetime.now(timezone.utc)

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "adapter_type": self.adapter_type.value,
            "target_table": self.target_table,
            "status": self.status.value,
            "total_rows": self.total_rows,
            "processed_rows": self.processed_rows,
            "inserted_rows": self.inserted_rows,
            "updated_rows": self.updated_rows,
            "error_rows": self.error_rows,
            "progress_pct": self.progress_pct,
            "success_rate": self.success_rate,
            "error_summary": self.error_summary,
            "file_name": self.file_name,
            "file_size_bytes": self.file_size_bytes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


# ── 导入统计 ────────────────────────────────────────────────


@dataclass
class ImportStats:
    """单次导入操作的统计摘要"""
    total_rows: int = 0
    valid_rows: int = 0
    invalid_rows: int = 0
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    errors: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def success_rate(self) -> float:
        if self.total_rows == 0:
            return 0.0
        return round(self.valid_rows / self.total_rows * 100, 2)

    def to_dict(self) -> dict:
        return {
            "total_rows": self.total_rows,
            "valid_rows": self.valid_rows,
            "invalid_rows": self.invalid_rows,
            "inserted": self.inserted,
            "updated": self.updated,
            "skipped": self.skipped,
            "error_count": len(self.errors),
            "success_rate": self.success_rate,
            "errors": self.errors[:50],  # 最多返回前50条错误
        }


# ── 导入报告 ────────────────────────────────────────────────


@dataclass
class ImportReport:
    """完整的导入结果报告"""
    task_id: str
    stats: ImportStats
    status: ImportStatus
    duration_seconds: float = 0.0
    message: str = ""

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "status": self.status.value,
            "stats": self.stats.to_dict(),
            "duration_seconds": round(self.duration_seconds, 2),
            "message": self.message,
        }
