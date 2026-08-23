"""适配器数据模型"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from enum import Enum


class AdapterType(str, Enum):
    """适配器类型"""
    CSV = "csv"
    JSON = "json"
    API = "api"


@dataclass
class ImportResult:
    """导入结果"""
    success: bool
    total_rows: int = 0
    imported_rows: int = 0
    error_rows: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class FieldMapping:
    """字段映射"""
    source: str
    target: str
    required: bool = False
    default: Any = None
    transform: Optional[str] = None


@dataclass
class AdapterConfig:
    """适配器配置"""
    adapter_type: AdapterType
    file_path: Optional[str] = None
    url: Optional[str] = None
    encoding: str = "utf-8"
    delimiter: str = ","
    field_mappings: List[FieldMapping] = field(default_factory=list)
    skip_rows: int = 0
    max_rows: Optional[int] = None


@dataclass
class ImportStats:
    """导入统计"""
    total_rows: int = 0
    valid_rows: int = 0
    invalid_rows: int = 0
    errors: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


# Export all models
__all__ = [
    "AdapterType",
    "ImportResult", 
    "FieldMapping",
    "AdapterConfig",
    "ImportStats",
]
