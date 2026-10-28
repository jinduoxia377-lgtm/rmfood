"""RMFOOD 冲突检测与解决

基于CRDTs（Conflict-free Replicated Data Types）的三向合并算法。
支持自动冲突检测、分类和多种合并策略。
"""
import copy
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Set


class ConflictType(str, Enum):
    """冲突类型"""
    CONTENT_CONFLICT = "content_conflict"
    DELETE_MODIFY_CONFLICT = "delete_modify_conflict"
    STRUCTURAL_CONFLICT = "structural_conflict"


class MergeStrategy(str, Enum):
    """合并策略"""
    LAST_WRITE_WINS = "last_write_wins"
    UNION_MERGE = "union_merge"
    MANUAL = "manual"


class ConflictStatus(str, Enum):
    """冲突状态"""
    DETECTED = "detected"
    AUTO_RESOLVED = "auto_resolved"
    PENDING_USER = "pending_user"
    RESOLVED = "resolved"


@dataclass
class Conflict:
    """冲突项"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: str = ""
    entity_id: str = ""
    conflict_type: ConflictType = ConflictType.CONTENT_CONFLICT
    status: ConflictStatus = ConflictStatus.DETECTED

    local_data: Dict[str, Any] = field(default_factory=dict)
    server_data: Dict[str, Any] = field(default_factory=dict)
    base_data: Optional[Dict[str, Any]] = None

    local_timestamp: Optional[datetime] = None
    server_timestamp: Optional[datetime] = None

    conflicting_fields: List[str] = field(default_factory=list)

    recommended_strategy: MergeStrategy = MergeStrategy.LAST_WRITE_WINS
    resolved_data: Optional[Dict[str, Any]] = None
    resolution_strategy: Optional[MergeStrategy] = None

    detected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None

    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "conflict_type": self.conflict_type.value,
            "status": self.status.value,
            "local_data": self.local_data,
            "server_data": self.server_data,
            "base_data": self.base_data,
            "local_timestamp": self.local_timestamp.isoformat() if self.local_timestamp else None,
            "server_timestamp": self.server_timestamp.isoformat() if self.server_timestamp else None,
            "conflicting_fields": self.conflicting_fields,
            "recommended_strategy": self.recommended_strategy.value,
            "resolved_data": self.resolved_data,
            "resolution_strategy": self.resolution_strategy.value if self.resolution_strategy else None,
            "detected_at": self.detected_at.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }


@dataclass
class ResolvedEntity:
    """解决后的实体"""
    entity_type: str
    entity_id: str
    merged_data: Dict[str, Any]
    merge_strategy: MergeStrategy
    conflict_count: int = 0
    auto_resolved: bool = True
    requires_user_review: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "merged_data": self.merged_data,
            "merge_strategy": self.merge_strategy.value,
            "conflict_count": self.conflict_count,
            "auto_resolved": self.auto_resolved,
            "requires_user_review": self.requires_user_review,
        }


class ConflictDetector:
    """
    冲突检测器

    功能：
    - 检测同一实体的并发修改（三向合并）
    - 分类冲突类型（内容/删除-修改/结构）
    - 推荐自动解决策略
    - 执行自动合并（LAST_WRITE_WINS / UNION_MERGE）

    算法：
    基于CRDTs的三向合并：
    1. 比较本地版本与服务器版本的差异
    2. 与基线版本（上次同步时的共同祖先）对比
    3. 确定哪些是真正的冲突（双方都修改了同一字段）
    4. 应用选定的合并策略
    """

    def __init__(
        self,
        default_strategy: MergeStrategy = MergeStrategy.LAST_WRITE_WINS,
        auto_resolve_content: bool = True,
        auto_resolve_structural: bool = False,
    ):
        """
        初始化冲突检测器

        Args:
            default_strategy: 默认合并策略
            auto_resolve_content: 是否自动解决内容冲突
            auto_resolve_structural: 是否自动解决结构冲突
        """
        self.default_strategy = default_strategy
        self.auto_resolve_content = auto_resolve_content
        self.auto_resolve_structural = auto_resolve_structural

        self._union_merge_fields: Set[str] = {
            "tags", "categories", "ingredients", "notes",
            "attachments", "references", "collaborators",
        }

        self._protected_fields: Set[str] = {
            "id", "created_at", "created_by", "version",
        }

        self._stats = {
            "total_detections": 0,
            "auto_resolutions": 0,
            "manual_required": 0,
            "avg_detection_time_ms": 0,
        }

    async def detect_conflicts(
        self,
        local_changes: List[Dict[str, Any]],
        remote_changes: List[Dict[str, Any]],
        base_snapshot: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> List[Conflict]:
        """
        检测并发编辑产生的冲突

        使用三向合并算法：
        - local_changes: 本地变更列表
        - remote_changes: 远程（服务器）变更列表
        - base_snapshot: 基线快照 {entity_key: base_data}

        Returns:
            检测到的冲突列表
        """
        import time
        start_time = time.time()

        conflicts: List[Conflict] = []

        remote_index = self._index_changes_by_entity(remote_changes)

        for local_change in local_changes:
            entity_key = f"{local_change.get('entity_type', 'unknown')}:{local_change.get('entity_id', 'unknown')}"

            if entity_key not in remote_index:
                continue

            remote_change = remote_index[entity_key]

            base_data = None
            if base_snapshot and entity_key in base_snapshot:
                base_data = base_snapshot[entity_key]

            local_data = local_change.get("data") or local_change.get("local_data", {})
            remote_data = remote_change.get("data") or remote_change.get("server_data", {})

            conflict = await self._analyze_conflict(
                entity_type=local_change.get("entity_type", "unknown"),
                entity_id=str(local_change.get("entity_id", "")),
                local_data=local_data,
                remote_data=remote_data,
                base_data=base_data,
                local_timestamp=self._parse_timestamp(local_change.get("timestamp")),
                remote_timestamp=self._parse_timestamp(remote_change.get("timestamp")),
            )

            if conflict:
                conflicts.append(conflict)

        elapsed_ms = (time.time() - start_time) * 1000
        self._update_stats(elapsed_ms, len(conflicts))

        return conflicts

    async def auto_resolve(
        self,
        conflict: Conflict,
        strategy: Optional[MergeStrategy] = None,
    ) -> ResolvedEntity:
        """
        自动解决冲突

        支持的策略：
        - LAST_WRITE_WINS: 选择时间戳更新的版本
        - UNION_MERGE: 合并集合类字段（tags, ingredients等）

        Args:
            conflict: 冲突对象
            strategy: 合并策略（如果为None则使用推荐策略）

        Returns:
            解决后的实体对象

        Raises:
            ValueError: 如果策略不适用或数据无效
        """
        resolve_strategy = strategy or conflict.recommended_strategy

        if resolve_strategy == MergeStrategy.MANUAL:
            return ResolvedEntity(
                entity_type=conflict.entity_type,
                entity_id=conflict.entity_id,
                merged_data={},
                merge_strategy=MergeStrategy.MANUAL,
                auto_resolved=False,
                requires_user_review=True,
            )

        try:
            if resolve_strategy == MergeStrategy.LAST_WRITE_WINS:
                resolved = self._apply_last_write_wins(conflict)
            elif resolve_strategy == MergeStrategy.UNION_MERGE:
                resolved = self._apply_union_merge(conflict)
            else:
                raise ValueError(f"不支持的合并策略: {resolve_strategy}")

            conflict.status = ConflictStatus.AUTO_RESOLVED
            conflict.resolved_data = resolved.merged_data
            conflict.resolution_strategy = resolve_strategy
            conflict.resolved_at = datetime.now(timezone.utc)

            self._stats["auto_resolutions"] += 1

            return resolved

        except Exception as e:
            conflict.metadata["auto_resolve_error"] = "自动解决失败"
            conflict.recommended_strategy = MergeStrategy.MANUAL
            conflict.status = ConflictStatus.PENDING_USER
            self._stats["manual_required"] += 1

            raise ValueError(f"自动解决失败: {str(e)}") from e

    def manual_resolve(
        self,
        conflict: Conflict,
        user_choice: str,
        custom_data: Optional[Dict[str, Any]] = None,
    ) -> ResolvedEntity:
        """
        用户手动解决冲突

        Args:
            conflict: 冲突对象
            user_choice: 用户选择 (local/server/custom)
            custom_data: 自定义合并数据（当user_choice="custom"时）

        Returns:
            解决后的实体对象
        """
        if user_choice == "local":
            merged_data = copy.deepcopy(conflict.local_data)
        elif user_choice == "server":
            merged_data = copy.deepcopy(conflict.server_data)
        elif user_choice == "custom" and custom_data:
            merged_data = copy.deepcopy(custom_data)
        else:
            raise ValueError(f"无效的用户选择: {user_choice}")

        conflict.status = ConflictStatus.RESOLVED
        conflict.resolved_data = merged_data
        conflict.resolution_strategy = MergeStrategy.MANUAL
        conflict.resolved_at = datetime.now(timezone.utc)

        return ResolvedEntity(
            entity_type=conflict.entity_type,
            entity_id=conflict.entity_id,
            merged_data=merged_data,
            merge_strategy=MergeStrategy.MANUAL,
            auto_resolved=False,
            requires_user_review=False,
        )

    async def _analyze_conflict(
        self,
        entity_type: str,
        entity_id: str,
        local_data: Dict[str, Any],
        remote_data: Dict[str, Any],
        base_data: Optional[Dict[str, Any]],
        local_timestamp: Optional[datetime],
        remote_timestamp: Optional[datetime],
    ) -> Optional[Conflict]:
        """分析并分类冲突"""
        if not local_data and not remote_data:
            return None

        is_local_delete = len(local_data) == 0 or local_data.get("_deleted")
        is_remote_delete = len(remote_data) == 0 or remote_data.get("_deleted")

        if is_local_delete and is_remote_delete:
            return None
        elif is_local_delete or is_remote_delete:
            return Conflict(
                entity_type=entity_type,
                entity_id=entity_id,
                conflict_type=ConflictType.DELETE_MODIFY_CONFLICT,
                status=ConflictStatus.PENDING_USER,
                local_data=local_data,
                server_data=remote_data,
                base_data=base_data,
                local_timestamp=local_timestamp,
                server_timestamp=remote_timestamp,
                recommended_strategy=MergeStrategy.MANUAL,
            )

        conflicting_fields = self._find_conflicting_fields(
            local_data, remote_data, base_data
        )

        if not conflicting_fields:
            return None

        has_structural = any(
            self._is_structural_conflict(field, local_data.get(field), remote_data.get(field))
            for field in conflicting_fields
        )

        conflict_type = (
            ConflictType.STRUCTURAL_CONFLICT
            if has_structural
            else ConflictType.CONTENT_CONFLICT
        )

        can_auto_resolve = (
            (conflict_type == ConflictType.CONTENT_CONFLICT and self.auto_resolve_content)
            or (conflict_type == ConflictType.STRUCTURAL_CONFLICT and self.auto_resolve_structural)
        )

        recommended = self._recommend_strategy(conflicting_fields, conflict_type)

        if not can_auto_resolve:
            recommended = MergeStrategy.MANUAL

        return Conflict(
            entity_type=entity_type,
            entity_id=entity_id,
            conflict_type=conflict_type,
            status=ConflictStatus.DETECTED if can_auto_resolve else ConflictStatus.PENDING_USER,
            local_data=local_data,
            server_data=remote_data,
            base_data=base_data,
            local_timestamp=local_timestamp,
            server_timestamp=remote_timestamp,
            conflicting_fields=conflicting_fields,
            recommended_strategy=recommended,
        )

    def _find_conflicting_fields(
        self,
        local: Dict[str, Any],
        remote: Dict[str, Any],
        base: Optional[Dict[str, Any]],
    ) -> List[str]:
        """找出真正冲突的字段（双方都从基线修改过的字段）"""
        conflicting: List[str] = []

        all_keys = set(local.keys()) | set(remote.keys())

        if base:
            for key in all_keys:
                if key in self._protected_fields:
                    continue

                local_val = local.get(key)
                remote_val = remote.get(key)
                base_val = base.get(key)

                local_changed = local_val != base_val
                remote_changed = remote_val != base_val

                if local_changed and remote_changed:
                    conflicting.append(key)
        else:
            for key in all_keys:
                if key in self._protected_fields:
                    continue

                if local.get(key) != remote.get(key):
                    conflicting.append(key)

        return conflicting

    def _is_structural_conflict(
        self,
        field: str,
        local_value: Any,
        remote_value: Any,
    ) -> bool:
        """判断是否为结构性冲突（类型不匹配等）"""
        if type(local_value) != type(remote_value):
            return True

        if isinstance(local_value, dict) and isinstance(remote_value, dict):
            local_keys = set(local_value.keys())
            remote_keys = set(remote_value.keys())

            if local_keys != remote_keys:
                return True

        return False

    def _recommend_strategy(
        self,
        conflicting_fields: List[str],
        conflict_type: ConflictType,
    ) -> MergeStrategy:
        """根据冲突类型和字段特征推荐策略"""
        if conflict_type == ConflictType.DELETE_MODIFY_CONFLICT:
            return MergeStrategy.MANUAL

        if conflict_type == ConflictType.STRUCTURAL_CONFLICT:
            return MergeStrategy.MANUAL if not self.auto_resolve_structural else MergeStrategy.LAST_WRITE_WINS

        all_union = all(f in self._union_merge_fields for f in conflicting_fields)
        if all_union:
            return MergeStrategy.UNION_MERGE

        return self.default_strategy

    def _apply_last_write_wins(self, conflict: Conflict) -> ResolvedEntity:
        """应用最后写入优先策略"""
        use_local = False

        if conflict.local_timestamp and conflict.server_timestamp:
            use_local = conflict.local_timestamp > conflict.server_timestamp
        elif conflict.local_timestamp:
            use_local = True
        else:
            use_local = False

        winner_data = copy.deepcopy(conflict.local_data if use_local else conflict.server_data)
        loser_data = conflict.server_data if use_local else conflict.local_data

        for field in conflict.conflicting_fields:
            if field in self._union_merge_fields and field in loser_data:
                if field not in winner_data:
                    winner_data[field] = loser_data[field]
                elif isinstance(winner_data[field], list) and isinstance(loser_data[field], list):
                    combined = list(set(winner_data[field] + loser_data[field]))
                    winner_data[field] = combined

        return ResolvedEntity(
            entity_type=conflict.entity_type,
            entity_id=conflict.entity_id,
            merged_data=winner_data,
            merge_strategy=MergeStrategy.LAST_WRITE_WINS,
            conflict_count=len(conflict.conflicting_fields),
            auto_resolved=True,
            metadata={"winner": "local" if use_local else "server"},
        )

    def _apply_union_merge(self, conflict: Conflict) -> ResolvedEntity:
        """应用联合合并策略"""
        merged = copy.deepcopy(conflict.local_data)

        for field in conflict.conflicting_fields:
            if field in self._protected_fields:
                continue

            remote_val = conflict.server_data.get(field)
            local_val = merged.get(field)

            if field in self._union_merge_fields:
                merged[field] = self._merge_field_values(local_val, remote_val, field)
            elif remote_val is not None and field not in merged:
                merged[field] = remote_val

        return ResolvedEntity(
            entity_type=conflict.entity_type,
            entity_id=conflict.entity_id,
            merged_data=merged,
            merge_strategy=MergeStrategy.UNION_MERGE,
            conflict_count=len(conflict.conflicting_fields),
            auto_resolved=True,
        )

    def _merge_field_values(
        self,
        local_val: Any,
        remote_val: Any,
        field: str,
    ) -> Any:
        """合并单个字段的值"""
        if local_val is None:
            return remote_val
        if remote_val is None:
            return local_val

        if isinstance(local_val, list) and isinstance(remote_val, list):
            seen = set()
            result = []
            for item in local_val + remote_val:
                key = json.dumps(item, sort_keys=True, default=str) if isinstance(item, (dict, list)) else str(item)
                if key not in seen:
                    seen.add(key)
                    result.append(item)
            return result

        if isinstance(local_val, dict) and isinstance(remote_val, dict):
            merged = copy.deepcopy(local_val)
            for k, v in remote_val.items():
                if k not in merged:
                    merged[k] = v
            return merged

        return remote_val

    def _index_changes_by_entity(
        self,
        changes: List[Dict[str, Any]],
    ) -> Dict[str, Dict[str, Any]]:
        """按实体索引变更"""
        index = {}
        for change in changes:
            key = f"{change.get('entity_type', 'unknown')}:{change.get('entity_id', 'unknown')}"
            index[key] = change
        return index

    def _parse_timestamp(self, ts: Any) -> Optional[datetime]:
        """解析时间戳"""
        if ts is None:
            return None
        if isinstance(ts, datetime):
            return ts
        if isinstance(ts, str):
            formats = [
                "%Y-%m-%dT%H:%M:%S.%fZ",
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%dT%H:%M:%S.%f",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S",
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(ts, fmt).replace(tzinfo=timezone.utc)
                except (ValueError, TypeError):
                    continue
        return None

    def _update_stats(self, elapsed_ms: float, conflict_count: int):
        """更新统计信息"""
        self._stats["total_detections"] += 1

        total = self._stats["total_detections"]
        prev_avg = self._stats["avg_detection_time_ms"]
        self._stats["avg_detection_time_ms"] = (
            (prev_avg * (total - 1) + elapsed_ms) / total
        )

        if conflict_count > 0:
            self._stats["manual_required"] += 1

    @property
    def stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return dict(self._stats)


import json as _json

json = _json
