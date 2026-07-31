"""BaseAdapter — 数据源适配器抽象基类 + FieldMapper 字段映射器"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, AsyncIterator

from .models import ImportStats

logger = logging.getLogger(__name__)


# ── 字段映射配置 ────────────────────────────────────────────


class FieldMapping:
    """单个字段的映射规则"""

    def __init__(
        self,
        source: str,
        target: str,
        required: bool = False,
        default: Any = None,
        transform: Optional[str] = None,
        transform_params: Optional[Dict[str, Any]] = None,
    ):
        self.source = source
        self.target = target
        self.required = required
        self.default = default
        self.transform = transform or "none"
        self.transform_params = transform_params or {}

    def apply(self, row: Dict[str, Any]) -> tuple[Any, Optional[str]]:
        """对源数据应用转换，返回 (值, 错误信息)"""
        value = row.get(self.source)

        # 空值处理
        if value is None or (isinstance(value, str) and not value.strip()):
            if self.default is not None:
                value = self.default
            elif self.required:
                return None, f"Required field '{self.source}' is empty"
            else:
                return None, None

        # 字符串统一转 strip
        if isinstance(value, str):
            value = value.strip()
            if not value and not self.required:
                return None, None

        # 预定义变换
        if self.transform == "split_first":
            sep = self.transform_params.get("sep", ",")
            parts = [p.strip() for p in value.split(sep) if p.strip()]
            value = parts[0] if parts else None
        elif self.transform == "to_float":
            try:
                value = float(value)
            except (ValueError, TypeError):
                return None, f"Cannot convert '{value}' to float"
        elif self.transform == "to_int":
            try:
                value = int(float(value))
            except (ValueError, TypeError):
                return None, f"Cannot convert '{value}' to int"
        elif self.transform == "lower":
            value = str(value).lower()
        elif self.transform == "upper":
            value = str(value).upper()
        elif self.transform == "json_load":
            import json as _json
            try:
                value = _json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return None, f"Cannot parse JSON from '{value}'"

        return value, None


class FieldMapper:
    """声明式字段映射器。

    用法:
        mapper = FieldMapper()
        mapper.add("code", "external_id", required=True)
        mapper.add("product_name", "product_name")
        mapper.add("brands", "brand", default="Unknown")

        mapped, errors = mapper.map(row_dict)
    """

    def __init__(self):
        self._mappings: List[FieldMapping] = []

    def add(
        self,
        source: str,
        target: str,
        required: bool = False,
        default: Any = None,
        transform: Optional[str] = None,
        **params,
    ) -> "FieldMapper":
        """注册一个字段映射，返回 self 支持链式调用"""
        self._mappings.append(FieldMapping(
            source=source,
            target=target,
            required=required,
            default=default,
            transform=transform,
            transform_params=params,
        ))
        return self

    def map(self, row: Dict[str, Any]) -> tuple[Dict[str, Any], List[str]]:
        """将一行源数据映射为目标格式。

        Returns:
            (mapped_dict, error_messages)
        """
        result: Dict[str, Any] = {}
        errors: List[str] = []

        for mapping in self._mappings:
            value, err = mapping.apply(row)
            if err:
                errors.append(err)
                if mapping.required:
                    continue  # 必填字段出错，跳过此行
            if value is not None:
                result[mapping.target] = value

        return result, errors

    @property
    def field_count(self) -> int:
        return len(self._mappings)


# ── BaseAdapter ─────────────────────────────────────────────


class BaseAdapter(ABC):
    """数据源适配器抽象基类。

    所有具体适配器（CSV、JSON、API）都应继承此类并实现:
    - validate(): 验证数据源是否可用
    - preview(): 预览前 N 行数据
    - iterate(): 异步迭代每一行原始数据
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.stats = ImportStats()

    @abstractmethod
    async def validate(self) -> tuple[bool, str]:
        """验证数据源配置和内容是否有效。

        Returns:
            (is_valid, error_message)
        """

    @abstractmethod
    async def preview(self, limit: int = 10) -> List[Dict[str, Any]]:
        """预览前 N 行原始数据（未映射）。"""

    @abstractmethod
    async def iterate(self) -> AsyncIterator[Dict[str, Any]]:
        """异步迭代所有原始数据行。"""

    @abstractmethod
    async def count(self) -> int:
        """预估或精确的总行数。"""

    def record_error(self, row_number: int, raw_data: Any, error_msg: str, error_type: str = "validation") -> None:
        """记录一行导入错误到统计中"""
        self.stats.invalid_rows += 1
        self.stats.errors.append({
            "row": row_number,
            "raw_data": str(raw_data)[:500],
            "error": error_msg,
            "type": error_type,
        })

    def record_valid(self) -> None:
        self.stats.valid_rows += 1

    def get_stats(self) -> ImportStats:
        return self.stats
