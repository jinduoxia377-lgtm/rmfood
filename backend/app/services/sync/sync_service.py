"""RMFOOD 同步服务编排

整合差异检测、变更队列、冲突解决和协议传输，
提供完整的云端同步流程编排。
"""
import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from .change_queue import ChangeQueue
from .conflict_detector import (
    Conflict,
    ConflictDetector,
    MergeStrategy,
    ResolvedEntity,
)
from .diff_detector import ChangeType, DiffDetector, SyncChange
from .protocol import SyncProtocol, SyncPullResponse, SyncPushResponse

logger = logging.getLogger(__name__)


class SyncMode(str, Enum):
    """同步模式"""
    FULL = "full"
    INCREMENTAL = "incremental"
    FORCE_PUSH = "force_push"
    FORCE_PULL = "force_pull"


class SyncState(str, Enum):
    """同步状态"""
    IDLE = "idle"
    DETECTING_CHANGES = "detecting_changes"
    PUSHING = "pushing"
    PULLING = "pulling"
    RESOLVING_CONFLICTS = "resolving_conflicts"
    APPLYING_CHANGES = "applying_changes"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class SyncResult:
    """同步结果"""
    success: bool = False
    sync_mode: SyncMode = SyncMode.INCREMENTAL
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: float = 0

    pushed_count: int = 0
    pulled_count: int = 0
    conflicts_detected: int = 0
    conflicts_auto_resolved: int = 0
    conflicts_pending_user: int = 0
    failed_count: int = 0

    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    server_timestamp: Optional[datetime] = None
    next_sync_token: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "sync_mode": self.sync_mode.value,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_ms": round(self.duration_ms, 2),
            "pushed_count": self.pushed_count,
            "pulled_count": self.pulled_count,
            "conflicts_detected": self.conflicts_detected,
            "conflicts_auto_resolved": self.conflicts_auto_resolved,
            "conflicts_pending_user": self.conflicts_pending_user,
            "failed_count": self.failed_count,
            "errors": self.errors,
            "warnings": self.warnings,
            "server_timestamp": self.server_timestamp.isoformat() if self.server_timestamp else None,
            "next_sync_token": self.next_sync_token,
        }


@dataclass
class SyncSession:
    """同步会话"""
    id: str
    user_id: int
    device_id: str
    mode: SyncMode
    state: SyncState = SyncState.IDLE
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    local_snapshot: Dict[str, Any] = field(default_factory=dict)
    server_snapshot: Dict[str, Any] = field(default_factory=dict)
    changes_detected: List[SyncChange] = field(default_factory=list)
    conflicts: List[Conflict] = field(default_factory=list)
    resolved_entities: List[ResolvedEntity] = field(default_factory=list)

    result: Optional[SyncResult] = None


class SyncService:
    """
    同步服务（编排层）

    整合所有组件，执行完整的同步流程：
    1. 推送本地变更 (push)
    2. 拉取远程变更 (pull)
    3. 检测并解决冲突 (resolve conflicts)
    4. 更新本地和服务器状态
    5. 记录同步日志

    使用示例：
        >>> service = SyncService()
        >>> result = await service.full_sync(user_id=1, device_id="device123")
        >>> print(f"推送了 {result.pushed_count} 条变更")
    """

    def __init__(
        self,
        max_concurrent_syncs: int = 5,
        auto_resolve_conflicts: bool = True,
        default_conflict_strategy: MergeStrategy = MergeStrategy.LAST_WRITE_WINS,
        sync_timeout_seconds: float = 300.0,
    ):
        """
        初始化同步服务

        Args:
            max_concurrent_syncs: 最大并发同步数
            auto_resolve_conflicts: 是否自动解决可解决的冲突
            default_conflict_strategy: 默认冲突解决策略
            sync_timeout_seconds: 同步超时时间
        """
        self.detector = DiffDetector()
        self.queue = ChangeQueue()
        self.protocol = SyncProtocol()
        self.conflict_detector = ConflictDetector(
            default_strategy=default_conflict_strategy,
            auto_resolve_content=True,
        )

        self.max_concurrent_syncs = max_concurrent_syncs
        self.auto_resolve_conflicts = auto_resolve_conflicts
        self.sync_timeout = sync_timeout_seconds

        self._active_sessions: Dict[str, SyncSession] = {}
        self._user_last_sync: Dict[int, datetime] = {}

        self._stats = {
            "total_syncs": 0,
            "successful_syncs": 0,
            "failed_syncs": 0,
            "total_changes_pushed": 0,
            "total_changes_pulled": 0,
            "total_conflicts_resolved": 0,
            "avg_sync_duration_ms": 0,
        }

    async def full_sync(
        self,
        user_id: int,
        device_id: str,
        local_data: Dict[str, Dict[str, Any]],
        last_sync_timestamp: Optional[datetime] = None,
    ) -> SyncResult:
        """
        执行完整的双向同步流程

        流程：
        1. 检测本地变更
        2. 推送变更到服务器
        3. 拉取服务器变更
        4. 检测并解决冲突
        5. 应用合并后的变更

        Args:
            user_id: 用户ID
            device_id: 设备ID
            local_data: 本地数据 {entity_type: {entity_id: data}}
            last_sync_timestamp: 上次同步时间戳

        Returns:
            同步结果统计
        """
        session = self._create_session(user_id, device_id, SyncMode.FULL)
        session.local_snapshot = local_data
        start_time = datetime.now(timezone.utc)

        try:
            session.state = SyncState.DETECTING_CHANGES

            all_local_changes = []
            for entity_type, entities in local_data.items():
                changes = await self.detector.detect_changes(
                    local_data=entities,
                    server_data={},
                    last_sync_timestamp=last_sync_timestamp,
                    entity_type=entity_type,
                )
                all_local_changes.extend(changes)

            session.changes_detected = all_local_changes
            logger.info(f"[SyncService] 检测到 {len(all_local_changes)} 个本地变更")

            session.state = SyncState.PUSHING

            push_changes = [
                {
                    "entity_type": c.entity_type,
                    "entity_id": c.entity_id,
                    "action": c.change_type.value,
                    "data": c.local_data or {},
                    "version": c.version,
                    "timestamp": c.timestamp.isoformat(),
                }
                for c in all_local_changes
                if c.change_type in (ChangeType.CREATE, ChangeType.UPDATE)
            ]

            push_response = await self.protocol.push_changes(
                user_id=user_id,
                device_id=device_id,
                changes=push_changes,
                client_timestamp=start_time,
            )

            session.result = SyncResult(
                pushed_count=push_response.accepted_count,
                server_timestamp=push_response.server_timestamp,
                next_sync_token=push_response.next_sync_token,
            )

            session.state = SyncState.PULLING

            pull_response = await self.protocol.pull_changes(
                user_id=user_id,
                device_id=device_id,
                since_timestamp=last_sync_timestamp,
                limit=1000,
            )

            session.server_snapshot = {
                f"{c.get('entity_type', 'unknown')}:{c.get('entity_id', 'unknown')}": c.get("data", {})
                for c in pull_response.server_changes
            }

            session.result.pulled_count = len(pull_response.server_changes)

            session.state = SyncState.RESOLVING_CONFLICTS

            if push_response.conflicts or pull_response.conflicts:
                all_conflicts_data = push_response.conflicts + pull_response.conflicts

                conflicts = await self.conflict_detector.detect_conflicts(
                    local_changes=push_changes,
                    remote_changes=pull_response.server_changes,
                )

                session.conflicts = conflicts

                for conflict in conflicts:
                    if (self.auto_resolve_conflicts and
                        conflict.recommended_strategy != MergeStrategy.MANUAL):
                        try:
                            resolved = await self.conflict_detector.auto_resolve(conflict)
                            session.resolved_entities.append(resolved)
                            session.result.conflicts_auto_resolved += 1
                        except Exception as e:
                            logger.warning(f"自动解决冲突失败: {e}")
                            session.result.conflicts_pending_user += 1
                    else:
                        session.result.conflicts_pending_user += 1

                session.result.conflicts_detected = len(conflicts)

            session.state = SyncState.COMPLETED
            session.result.success = True

            self._update_user_last_sync(user_id)

        except asyncio.TimeoutError:
            session.state = SyncState.FAILED
            session.result = SyncResult(
                success=False,
                errors=["同步超时"],
            )
            logger.error(f"[SyncService] 同步超时 ({self.sync_timeout}s)")  # A-27: 原引用了不存在的裸名

        except Exception as e:
            session.state = SyncState.FAILED
            session.result = SyncResult(
                success=False,
                errors=["处理异常"],
            )
            logger.error(f"[SyncService] 同步异常: {e}", exc_info=True)

        finally:
            end_time = datetime.now(timezone.utc)
            if session.result:
                session.result.started_at = start_time
                session.result.completed_at = end_time
                session.result.duration_ms = (end_time - start_time).total_seconds() * 1000

            self._cleanup_session(session.id)
            self._update_stats(session.result)

        return session.result or SyncResult(success=False, errors=["未知错误"])

    async def incremental_sync(
        self,
        user_id: int,
        device_id: str,
        local_data: Dict[str, Dict[str, Any]],
        entity_types: Optional[List[str]] = None,
    ) -> SyncResult:
        """
        增量同步（只处理最近变更）

        只同步指定实体类型或最近修改的数据。
        适用于频繁的小规模同步场景。

        Args:
            user_id: 用户ID
            device_id: 设备ID
            local_data: 本地数据
            entity_types: 要同步的实体类型列表（None表示全部）

        Returns:
            同步结果
        """
        last_sync = self._user_last_sync.get(user_id)

        filtered_data = local_data
        if entity_types:
            filtered_data = {
                etype: data
                for etype, data in local_data.items()
                if etype in entity_types
            }

        return await self.full_sync(
            user_id=user_id,
            device_id=device_id,
            local_data=filtered_data,
            last_sync_timestamp=last_sync,
        )

    async def push_only(
        self,
        user_id: int,
        device_id: str,
        changes: List[Dict[str, Any]],
    ) -> SyncPushResponse:
        """
        仅推送模式（不拉取远程变更）

        适用于离线后的批量上传。
        """
        response = await self.protocol.push_changes(
            user_id=user_id,
            device_id=device_id,
            changes=changes,
        )

        self._stats["total_changes_pushed"] += response.accepted_count

        return response

    async def pull_only(
        self,
        user_id: int,
        device_id: str,
        since: Optional[datetime] = None,
    ) -> SyncPullResponse:
        """
        仅拉取模式（不推送本地变更）

        适用于强制刷新服务器数据到本地。
        """
        response = await self.protocol.pull_changes(
            user_id=user_id,
            device_id=device_id,
            since_timestamp=since,
        )

        self._stats["total_changes_pulled"] += len(response.server_changes)

        return response

    async def resolve_conflict(
        self,
        conflict_id: str,
        resolution: Dict[str, Any],
    ) -> Optional[ResolvedEntity]:
        """
        解决特定冲突（用户手动）

        Args:
            conflict_id: 冲突ID
            resolution: 解决方案 {strategy, choice, custom_data}

        Returns:
            解决后的实体
        """
        for session in self._active_sessions.values():
            for conflict in session.conflicts:
                if conflict.id == conflict_id:
                    strategy_str = resolution.get("strategy", "manual")
                    strategy = MergeStrategy(strategy_str)

                    if strategy == MergeStrategy.MANUAL:
                        user_choice = resolution.get("choice", "local")
                        custom_data = resolution.get("custom_data")

                        resolved = self.conflict_detector.manual_resolve(
                            conflict=conflict,
                            user_choice=user_choice,
                            custom_data=custom_data,
                        )
                    else:
                        resolved = await self.conflict_detector.auto_resolve(
                            conflict=conflict,
                            strategy=strategy,
                        )

                    session.resolved_entities.append(resolved)
                    self._stats["total_conflicts_resolved"] += 1

                    return resolved

        return None

    def get_sync_status(self, user_id: int) -> Dict[str, Any]:
        """获取用户同步状态"""
        last_sync = self._user_last_sync.get(user_id)
        active_sessions = [
            s for s in self._active_sessions.values()
            if s.user_id == user_id
        ]

        return {
            "user_id": user_id,
            "last_sync_time": last_sync.isoformat() if last_sync else None,
            "active_syncs": len(active_sessions),
            "pending_queue_size": self.queue.get_pending_count(),
            "is_syncing": len(active_sessions) > 0,
        }

    def get_stats(self) -> Dict[str, Any]:
        """获取服务统计信息"""
        return {
            **self._stats,
            "active_sessions": len(self._active_sessions),
            "queue_stats": self.queue.get_stats(),
            "detector_stats": self.detector.stats,
            "protocol_stats": self.protocol.get_stats(),
            "conflict_detector_stats": self.conflict_detector.stats,
        }

    def _create_session(
        self,
        user_id: int,
        device_id: str,
        mode: SyncMode,
    ) -> SyncSession:
        """创建新的同步会话"""
        import uuid
        session = SyncSession(
            id=str(uuid.uuid4()),
            user_id=user_id,
            device_id=device_id,
            mode=mode,
        )

        if len(self._active_sessions) >= self.max_concurrent_syncs:
            oldest = min(
                self._active_sessions.values(),
                key=lambda s: s.created_at,
            )
            del self._active_sessions[oldest.id]

        self._active_sessions[session.id] = session

        return session

    def _cleanup_session(self, session_id: str):
        """清理已完成的会话"""
        session = self._active_sessions.pop(session_id, None)
        if session:
            del session

    def _update_user_last_sync(self, user_id: int):
        """更新用户最后同步时间"""
        self._user_last_sync[user_id] = datetime.now(timezone.utc)

    def _update_stats(self, result: Optional[SyncResult]):
        """更新统计信息"""
        if not result:
            return

        self._stats["total_syncs"] += 1

        if result.success:
            self._stats["successful_syncs"] += 1
        else:
            self._stats["failed_syncs"] += 1

        total = self._stats["total_syncs"]
        prev_avg = self._stats["avg_sync_duration_ms"]
        self._stats["avg_sync_duration_ms"] = (
            (prev_avg * (total - 1) + result.duration_ms) / total
        )
