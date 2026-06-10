"""RMFOOD 差异检测算法

基于时间戳和SHA-256哈希的高效差异检测器。
支持嵌套对象深度比较，用于增量同步场景。
"""
import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set
import asyncio
import time

from app.core.logging_config import logger


class ChangeType(str, Enum):
    """变更类型枚举"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


@dataclass
class SyncChange:
    """同步变更项"""
    entity_type: str
    entity_id: str
    change_type: ChangeType
    local_data: Optional[Dict[str, Any]] = None
    server_data: Optional[Dict[str, Any]] = None
    changed_fields: List[str] = field(default_factory=list)
    content_hash: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now())
    version: int = 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "change_type": self.change_type.value,
            "local_data": self.local_data,
            "server_data": self.server_data,
            "changed_fields": self.changed_fields,
            "content_hash": self.content_hash,
            "timestamp": self.timestamp.isoformat(),
            "version": self.version,
        }


class DiffDetector:
    """
    差异检测器
    
    功能：
    - 基于时间戳快速筛选（> last_sync_timestamp的记录）
    - 基于SHA-256内容哈希精确比对
    - 支持嵌套对象深度比较（递归遍历dict/list）
    - 返回变更类型：CREATE/UPDATE/DELETE
    
    性能目标：
    - 单次差异检测 < 100ms（1000条记录）
    """

    def __init__(self):
        self._hash_cache: Dict[str, str] = {}
        self._stats = {
            "total_detections": 0,
            "cache_hits": 0,
            "avg_detection_time_ms": 0,
        }

    async def detect_changes(
        self,
        local_data: Dict[str, Any],
        server_data: Dict[str, Any],
        last_sync_timestamp: Optional[datetime] = None,
        entity_type: str = "unknown",
    ) -> List[SyncChange]:
        """
        检测本地与服务器数据的差异
        
        Args:
            local_data: 本地数据字典 {entity_id: data}
            server_data: 服务器数据字典 {entity_id: data}
            last_sync_timestamp: 上次同步时间戳，只检测此之后的变更
            entity_type: 实体类型标识
            
        Returns:
            变更列表，包含CREATE/UPDATE/DELETE类型的变更
            
        Example:
            >>> detector = DiffDetector()
            >>> changes = await detector.detect_changes(
            ...     local_data={"1": {"name": "test", "updated_at": "2024-01-01"}},
            ...     server_data={"1": {"name": "old", "updated_at": "2023-12-01"}},
            ... )
        """
        start_time = time.time()
        
        if not isinstance(local_data, dict):
            raise ValueError(f"local_data 必须是字典类型，实际类型: {type(local_data)}")
        if not isinstance(server_data, dict):
            raise ValueError(f"server_data 必须是字典类型，实际类型: {type(server_data)}")

        changes: List[SyncChange] = []
        
        local_ids: Set[str] = set(local_data.keys())
        server_ids: Set[str] = set(server_data.keys())

        only_in_local = local_ids - server_ids
        only_in_server = server_ids - local_ids
        common_ids = local_ids & server_ids

        for entity_id in only_in_local:
            data = local_data[entity_id]
            
            if last_sync_timestamp and self._has_timestamp(data):
                entity_time = self._parse_timestamp(data.get("updated_at") or data.get("created_at"))
                if entity_time and entity_time <= last_sync_timestamp:
                    continue
            
            content_hash = self.compute_content_hash(data)
            changes.append(SyncChange(
                entity_type=entity_type,
                entity_id=str(entity_id),
                change_type=ChangeType.CREATE,
                local_data=data,
                content_hash=content_hash,
            ))

        for entity_id in only_in_server:
            data = server_data[entity_id]
            
            if last_sync_timestamp and self._has_timestamp(data):
                entity_time = self._parse_timestamp(data.get("updated_at") or data.get("deleted_at"))
                if entity_time and entity_time <= last_sync_timestamp:
                    continue
            
            content_hash = self.compute_content_hash(data)
            changes.append(SyncChange(
                entity_type=entity_type,
                entity_id=str(entity_id),
                change_type=ChangeType.DELETE,
                server_data=data,
                content_hash=content_hash,
            ))

        for entity_id in common_ids:
            local_entity = local_data[entity_id]
            server_entity = server_data[entity_id]

            should_check = True
            if last_sync_timestamp:
                local_time = self._parse_timestamp(local_entity.get("updated_at"))
                server_time = self._parse_timestamp(server_entity.get("updated_at"))
                
                if local_time and server_time:
                    if local_time <= last_sync_timestamp and server_time <= last_sync_timestamp:
                        should_check = False

            if not should_check:
                continue

            local_hash = self.compute_content_hash(local_entity)
            server_hash = self.compute_content_hash(server_entity)

            if local_hash != server_hash:
                changed_fields = self._deep_compare(local_entity, server_entity)
                
                changes.append(SyncChange(
                    entity_type=entity_type,
                    entity_id=str(entity_id),
                    change_type=ChangeType.UPDATE,
                    local_data=local_entity,
                    server_data=server_entity,
                    changed_fields=changed_fields,
                    content_hash=local_hash,
                ))

        elapsed_ms = (time.time() - start_time) * 1000
        self._update_stats(elapsed_ms)
        
        return changes

    def compute_content_hash(self, data: Any) -> str:
        """
        计算数据的SHA-256哈希值
        
        Args:
            data: 任意可序列化数据（dict, list, str, int等）
            
        Returns:
            SHA-256十六进制哈希字符串（64字符）
            
        Example:
            >>> detector = DiffDetector()
            >>> hash_val = detector.compute_content_hash({"name": "test", "value": 123})
            >>> len(hash_val)
            64
        """
        cache_key = self._make_cache_key(data)
        
        if cache_key in self._hash_cache:
            self._stats["cache_hits"] += 1
            return self._hash_cache[cache_key]

        normalized = self._normalize_for_hashing(data)
        json_str = json.dumps(normalized, sort_keys=True, ensure_ascii=False)
        hash_value = hashlib.sha256(json_str.encode("utf-8")).hexdigest()

        if len(self._hash_cache) < 10000:
            self._hash_cache[cache_key] = hash_value

        return hash_value

    def _deep_compare(
        self,
        local: Dict[str, Any],
        server: Dict[str, Any],
        prefix: str = "",
    ) -> List[str]:
        """
        深度比较两个字典，返回不同的字段路径列表
        
        支持递归比较嵌套的dict和list结构。
        """
        changed_fields: List[str] = []
        
        all_keys = set(local.keys()) | set(server.keys())

        for key in all_keys:
            field_path = f"{prefix}.{key}" if prefix else key
            
            if key not in server:
                changed_fields.append(field_path)
                continue
                
            if key not in local:
                changed_fields.append(field_path)
                continue

            local_val = local[key]
            server_val = server[key]

            if type(local_val) != type(server_val):
                changed_fields.append(field_path)
                continue

            if isinstance(local_val, dict):
                sub_changes = self._deep_compare(local_val, server_val, field_path)
                changed_fields.extend(sub_changes)
            elif isinstance(local_val, list):
                if len(local_val) != len(server_val):
                    changed_fields.append(field_path)
                else:
                    for i, (l_item, s_item) in enumerate(zip(local_val, server_val)):
                        item_path = f"{field_path}[{i}]"
                        if isinstance(l_item, dict) and isinstance(s_item, dict):
                            sub_changes = self._deep_compare(l_item, s_item, item_path)
                            changed_fields.extend(sub_changes)
                        elif l_item != s_item:
                            changed_fields.append(item_path)
            else:
                if local_val != server_val:
                    changed_fields.append(field_path)

        return changed_fields

    def _normalize_for_hashing(self, data: Any) -> Any:
        """
        规范化数据以便进行一致性哈希计算
        
        处理：
        - 排序字典键
        - 处理特殊类型（datetime转为ISO格式）
        - 处理None值
        - 确保浮点数精度一致
        """
        if data is None:
            return None
            
        if isinstance(data, (str, int, bool)):
            return data
            
        if isinstance(data, float):
            return round(data, 10)
            
        if isinstance(data, datetime):
            return data.isoformat()
            
        if isinstance(data, dict):
            return {
                k: self._normalize_for_hashing(v)
                for k, v in sorted(data.items())
            }
            
        if isinstance(data, (list, tuple)):
            return [self._normalize_for_hashing(item) for item in data]
            
        if isinstance(data, set):
            return sorted([self._normalize_for_hashing(item) for item in data])
            
        return str(data)

    def _has_timestamp(self, data: Dict[str, Any]) -> bool:
        """检查数据是否包含时间戳字段"""
        return any(key in data for key in ["updated_at", "created_at", "deleted_at", "timestamp"])

    def _parse_timestamp(self, timestamp_str: Optional[str]) -> Optional[datetime]:
        """解析时间戳字符串"""
        if not timestamp_str:
            return None
            
        formats = [
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(timestamp_str, fmt)
            except (ValueError, TypeError):
                continue
                
        return None

    def _make_cache_key(self, data: Any) -> str:
        """生成缓存键"""
        try:
            return str(hash(json.dumps(data, sort_keys=True, default=str)))[:16]
        except Exception:
            return id(data)

    def _update_stats(self, elapsed_ms: float):
        """更新性能统计"""
        self._stats["total_detections"] += 1
        
        total = self._stats["total_detections"]
        prev_avg = self._stats["avg_detection_time_ms"]
        self._stats["avg_detection_time_ms"] = (
            (prev_avg * (total - 1) + elapsed_ms) / total
        )

    @property
    def stats(self) -> Dict[str, Any]:
        """获取性能统计信息"""
        return {
            **self._stats,
            "cache_size": len(self._hash_cache),
        }

    def clear_cache(self):
        """清除哈希缓存"""
        self._hash_cache.clear()
        self._stats["cache_hits"] = 0


async def batch_detect_changes(
    detector: DiffDetector,
    data_batches: List[tuple],
    last_sync_timestamp: Optional[datetime] = None,
) -> List[SyncChange]:
    """
    批量执行差异检测（并发优化版本）
    
    Args:
        detector: DiffDetector实例
        data_batches: [(local_data, server_data, entity_type), ...]
        last_sync_timestamp: 上次同步时间戳
        
    Returns:
        所有批次合并后的变更列表
    """
    tasks = [
        detector.detect_changes(local, server, last_sync_timestamp, etype)
        for local, server, etype in data_batches
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    all_changes: List[SyncChange] = []
    for result in results:
        if isinstance(result, Exception):
            logger.warning(f"[DiffDetector] 批量检测异常: {result}")
            continue
        all_changes.extend(result)
    
    return all_changes
