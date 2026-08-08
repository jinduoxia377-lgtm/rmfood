"""导入引擎 Pydantic Schemas

定义导入 API 的请求和响应模型。
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── 枚举 ────────────────────────────────────────────────────


class ImportStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AdapterType(str, Enum):
    CSV = "csv"
    JSON = "json"
    API = "api"


class ErrorType(str, Enum):
    VALIDATION = "validation"
    TRANSFORM = "transform"
    DATABASE = "database"


# ── 请求 Schema ─────────────────────────────────────────────


class ImportPreviewRequest(BaseModel):
    """预览请求：上传文件后查看前 N 行数据"""
    file_type: AdapterType = Field(..., description="文件类型")
    delimiter: Optional[str] = Field("auto", description="CSV 分隔符，auto=自动检测")
    data_path: Optional[str] = Field(None, description="JSON 嵌套路径，如 'data.items'")
    limit: int = Field(10, ge=1, le=100, description="预览行数")


class ImportRunRequest(BaseModel):
    """运行导入请求：定义字段映射和目标表"""
    target_table: str = Field(..., description="目标数据库表名")
    id_field: str = Field("external_id", description="用于幂等 upsert 的唯一字段")
    mappings: List[FieldMappingConfig] = Field(
        ...,
        description="字段映射配置列表",
        min_length=1,
    )


class FieldMappingConfig(BaseModel):
    """单个字段映射配置"""
    source: str = Field(..., description="源字段名（CSV 列名 / JSON key）")
    target: str = Field(..., description="目标字段名（数据库列名）")
    required: bool = Field(False, description="是否必填")
    default: Optional[Any] = Field(None, description="默认值")
    transform: Optional[str] = Field(None, description="转换方式: strip|lower|upper|to_float|to_int|split_first|json_load")


# ── 响应 Schema ─────────────────────────────────────────────


class ImportTaskSummary(BaseModel):
    """导入任务摘要"""
    task_id: str
    adapter_type: str
    target_table: str
    status: str
    total_rows: int
    processed_rows: int
    inserted_rows: int
    updated_rows: int
    error_rows: int
    progress_pct: float
    success_rate: float
    file_name: Optional[str] = None
    created_at: str
    updated_at: str


class ImportTaskDetail(BaseModel):
    """导入任务详情"""
    task_id: str
    adapter_type: str
    target_table: str
    status: str
    total_rows: int
    processed_rows: int
    inserted_rows: int
    updated_rows: int
    error_rows: int
    progress_pct: float
    success_rate: float
    error_summary: str
    file_name: Optional[str] = None
    file_size_bytes: Optional[int] = None
    mapping_config: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str


class ImportErrorItem(BaseModel):
    """单条导入错误"""
    row: int
    raw_data: str
    error: str
    type: str


class ImportErrorsResponse(BaseModel):
    """错误日志响应"""
    errors: List[ImportErrorItem]
    total: int
    page: int
    page_size: int


class ImportReportResponse(BaseModel):
    """导入报告响应"""
    task_id: str
    status: str
    stats: Dict[str, Any]
    duration_seconds: float
    message: str


class CancelResponse(BaseModel):
    """取消响应"""
    task_id: str
    status: str
    message: str


class ImportListResponse(BaseModel):
    """导入任务列表响应"""
    tasks: List[ImportTaskSummary]
    total: int
