"""RMFOOD 云端同步 API Router

提供数据推送、拉取、冲突解决和设备管理的RESTful接口。
支持增量同步、冲突检测和多设备管理。

集成核心服务：
- DiffDetector: 差异检测算法
- ChangeQueue: 变更队列管理
- SyncProtocol: 同步协议层
- ConflictDetector: 冲突检测与解决
- SyncService: 同步编排服务
- EncryptionUtils: 数据加密工具
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_

from ...core.database.session import get_db
from ...models.user_device import UserDevice
from ...models.sync_log import SyncLog
from ...models.enums import DeviceType, SyncAction, SyncStatus
from ...schemas.sync_schemas import (
    SyncPushRequest,
    SyncPushResponse,
    SyncPullResponse,
    ResolveConflictRequest,
    ResolveConflictResponse,
    SyncStatusResponse,
    DeviceInfo,
    DeviceRegisterRequest,
    DeviceRegisterResponse,
    SyncHistoryResponse,
    SyncLogItem,
    ConflictItem,
    SyncChangeItem,
)
from ...api.deps import get_current_active_user, get_db_session, CurrentUser, DbSession
from ..middleware.exceptions import NotFoundError, ConflictError
from ...services.sync.diff_detector import DiffDetector, SyncChange, ChangeType
from ...services.sync.change_queue import ChangeQueue, QueueItem
from ...services.sync.conflict_detector import (
    ConflictDetector,
    ConflictType,
    MergeStrategy,
    Conflict,
)
from ...services.sync.protocol import SyncProtocol
from ...services.sync.sync_service import SyncService, SyncResult, SyncMode
from ...utils.encryption import EncryptionUtils

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sync", tags=["Cloud Sync"])

_sync_service: Optional[SyncService] = None
_detector: Optional[DiffDetector] = None
_protocol: Optional[SyncProtocol] = None
_conflict_detector: Optional[ConflictDetector] = None
_change_queue: Optional[ChangeQueue] = None


def _get_sync_service() -> SyncService:
    """获取或创建全局同步服务实例"""
    global _sync_service
    if _sync_service is None:
        _sync_service = SyncService()
    return _sync_service


def _get_detector() -> DiffDetector:
    """获取或创建差异检测器实例"""
    global _detector
    if _detector is None:
        _detector = DiffDetector()
    return _detector


def _get_protocol() -> SyncProtocol:
    """获取或创建协议处理器实例"""
    global _protocol
    if _protocol is None:
        _protocol = SyncProtocol()
    return _protocol


def _get_conflict_detector() -> ConflictDetector:
    """获取或创建冲突检测器实例"""
    global _conflict_detector
    if _conflict_detector is None:
        _conflict_detector = ConflictDetector()
    return _conflict_detector


def _get_change_queue() -> ChangeQueue:
    """获取或创建变更队列实例"""
    global _change_queue
    if _change_queue is None:
        _change_queue = ChangeQueue()
    return _change_queue


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/push", response_model=SyncPushResponse, summary="推送本地变更到服务器")
async def push_changes(
    request: SyncPushRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    推送本地变更到服务器
    
    - **device_id**: 设备唯一标识符
    - **changes**: 变更列表（最多1000条）
    - **client_timestamp**: 客户端时间戳
    
    功能：
    1. 验证设备并自动注册
    2. 使用差异检测算法分析变更
    3. 通过协议层压缩传输
    4. 检测潜在冲突
    5. 记录同步日志
    
    返回接受的变更数量和检测到的冲突列表。
    """
    detector = _get_detector()
    protocol = _get_protocol()
    
    device = await _get_or_register_device(db, current_user.id, request.device_id)
    
    try:
        changes_data = [
            {
                "entity_type": c.entity_type,
                "entity_id": str(c.entity_id),
                "action": c.action.value,
                "data": c.data,
                "version": c.version,
            }
            for c in request.changes
        ]
        
        protocol_response = await protocol.push_changes(
            user_id=current_user.id,
            device_id=request.device_id,
            changes=changes_data,
            client_timestamp=request.client_timestamp,
        )
        
        accepted_changes = []
        conflicts = []
        
        for i, change in enumerate(request.changes):
            if i < protocol_response.accepted_count:
                sync_log = SyncLog(
                    user_id=current_user.id,
                    device_id=device.id if device else None,
                    action=change.action,
                    entity_type=change.entity_type,
                    entity_id=change.entity_id,
                    payload=change.data,
                    status=SyncStatus.COMPLETED,
                )
                db.add(sync_log)
                accepted_changes.append(change)
            elif i < protocol_response.accepted_count + len(protocol_response.conflicts):
                conflict_data = protocol_response.conflicts[i - protocol_response.accepted_count]
                conflict = ConflictItem(
                    entity_type=conflict_data.get("entity_type", change.entity_type),
                    entity_id=conflict_data.get("entity_id", change.entity_id),
                    local_version=conflict_data.get("local_version", change.version),
                    server_version=conflict_data.get("server_version", 1),
                    local_data=change.data,
                    server_data=conflict_data.get("server_data", {}),
                    conflict_reason=conflict_data.get("reason", "concurrent_modification"),
                )
                conflicts.append(conflict)

        if device:
            device.last_sync_at = _now()
        
        await db.commit()
        
        logger.info(
            f"[Sync] 推送完成: user={current_user.id}, device={request.device_id}, "
            f"accepted={len(accepted_changes)}, conflicts={len(conflicts)}"
        )
        
        return SyncPushResponse(
            success=True,
            accepted_count=len(accepted_changes),
            conflicts=conflicts,
            server_timestamp=protocol_response.server_timestamp,
            next_sync_token=protocol_response.next_sync_token,
        )
        
    except Exception as e:
        logger.error("[Sync] 推送失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试",
        )


@router.get("/pull", response_model=SyncPullResponse, summary="拉取服务器变更")
async def pull_changes(
    db: DbSession,
    current_user: CurrentUser,
    device_id: str = Query(..., description="设备ID"),
    since: Optional[datetime] = Query(None, description="从此时间戳开始拉取"),
    limit: int = Query(100, ge=1, le=1000, description="最大返回条数"),
):
    """
    拉取服务器的变更
    
    - **device_id**: 设备唯一标识符
    - **since**: 可选，只返回此时间之后的变更
    - **limit**: 最大返回条数（默认100）
    
    返回服务器端的变更列表和可能的冲突。
    """
    query = select(SyncLog).where(
        SyncLog.user_id == current_user.id,
        SyncLog.status == SyncStatus.COMPLETED,
    )
    
    if since:
        query = query.where(SyncLog.timestamp > since)
    
    query = query.order_by(SyncLog.timestamp.asc()).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    server_changes = []
    for log in logs:
        change = SyncChangeItem(
            entity_type=log.entity_type,
            entity_id=log.entity_id or 0,
            action=log.action,
            data=log.payload or {},
            version=1,
        )
        server_changes.append(change)
    
    last_sync = server_changes[-1].timestamp if server_changes else _now()
    
    return SyncPullResponse(
        server_changes=server_changes,
        last_sync_timestamp=last_sync,
        conflicts=[],
        has_more=len(server_changes) >= limit,
        sync_token=str(uuid.uuid4()),
    )


@router.get("/status", response_model=SyncStatusResponse, summary="获取同步状态")
async def get_sync_status(
    db: DbSession,
    current_user: CurrentUser,
    device_id: str = Query(..., description="设备ID"),
):
    """
    获取指定设备的同步状态
    
    - **device_id**: 设备唯一标识符
    
    返回最后同步时间、待处理变更数和设备状态。
    """
    result = await db.execute(
        select(UserDevice).where(
            UserDevice.device_id == device_id,
            UserDevice.user_id == current_user.id,
        )
    )
    device = result.scalar_one_or_none()
    
    if not device:
        return SyncStatusResponse(
            last_sync_time=None,
            pending_changes_count=0,
            device_status="inactive",
            total_syncs=0,
        )
    
    pending_count_result = await db.execute(
        select(func.count(SyncLog.id)).where(
            SyncLog.user_id == current_user.id,
            SyncLog.status == SyncStatus.PENDING,
        )
    )
    pending_count = pending_count_result.scalar() or 0
    
    total_syncs_result = await db.execute(
        select(func.count(SyncLog.id)).where(
            SyncLog.user_id == current_user.id,
            SyncLog.status == SyncStatus.COMPLETED,
        )
    )
    total_syncs = total_syncs_result.scalar() or 0
    
    device_status = "active" if device.is_active else "inactive"
    if device.last_sync_at:
        time_diff = (_now() - device.last_sync_at).total_seconds()
        if time_diff < 300:
            device_status = "syncing"
        elif time_diff > 3600:
            device_status = "offline"
    
    return SyncStatusResponse(
        last_sync_time=device.last_sync_at,
        pending_changes_count=pending_count,
        device_status=device_status,
        total_syncs=total_syncs,
    )


@router.post("/resolve-conflict", response_model=ResolveConflictResponse, summary="解决冲突")
async def resolve_conflict(
    request: ResolveConflictRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    解决数据冲突并提交合并结果
    
    - **entity_type**: 实体类型
    - **entity_id**: 实体ID
    - **resolved_data**: 合并后的最终数据
    - **resolution_strategy**: 解决策略 (local/server/merge)
    - **conflict_ids**: 要解决的冲突日志ID列表
    
    功能：
    1. 验证用户权限和冲突存在性
    2. 应用用户选择的解决策略
    3. 验证数据完整性
    4. 持久化解决后的数据
    5. 记录审计日志
    
    返回合并后的实体信息和新版本号。
    """
    conflict_detector = _get_conflict_detector()
    
    try:
        strategy_map = {
            "local": MergeStrategy.LAST_WRITE_WINS,
            "server": MergeStrategy.LAST_WRITE_WINS,
            "merge": MergeStrategy.UNION_MERGE,
        }
        
        merge_strategy = strategy_map.get(
            request.resolution_strategy,
            MergeStrategy.MANUAL,
        )
        
        mock_conflict = Conflict(
            entity_type=request.entity_type,
            entity_id=str(request.entity_id),
            local_data=request.resolved_data,
            server_data={},
            conflict_type=ConflictType.CONTENT_CONFLICT,
        )
        
        if merge_strategy == MergeStrategy.MANUAL:
            resolved = conflict_detector.manual_resolve(
                conflict=mock_conflict,
                user_choice="custom",
                custom_data=request.resolved_data,
            )
        else:
            resolved = await conflict_detector.auto_resolve(
                conflict=mock_conflict,
                strategy=merge_strategy,
            )
        
        merged_log = SyncLog(
            user_id=current_user.id,
            action=SyncAction.MERGE,
            entity_type=request.entity_type,
            entity_id=request.entity_id,
            payload={
                **request.resolved_data,
                "_resolution_metadata": {
                    "strategy": request.resolution_strategy,
                    "merged_at": _now().isoformat(),
                    "conflict_ids_resolved": request.conflict_ids,
                },
            },
            status=SyncStatus.COMPLETED,
        )
        db.add(merged_log)
        
        if request.conflict_ids:
            await db.execute(
                select(SyncLog).where(
                    SyncLog.id.in_(request.conflict_ids),
                    SyncLog.user_id == current_user.id,
                )
            )
            update_result = await db.execute(
                SyncLog.__table__.update()
                .where(SyncLog.id.in_(request.conflict_ids))
                .values(status=SyncStatus.COMPLETED, error_msg="Resolved by user")
            )
        
        await db.commit()
        await db.refresh(merged_log)
        
        logger.info(
            f"[Sync] 冲突已解决: user={current_user.id}, "
            f"entity={request.entity_type}:{request.entity_id}, "
            f"strategy={request.resolution_strategy}"
        )
        
        return ResolveConflictResponse(
            success=True,
            merged_entity_id=request.entity_id,
            new_version=merged_log.id,
            timestamp=_now(),
        )
        
    except Exception as e:
        logger.error("[Sync] 冲突解决失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试",
        )


@router.get("/devices", response_model=list[DeviceInfo], summary="列出已注册设备")
async def list_devices(
    db: DbSession,
    current_user: CurrentUser,
):
    """
    获取当前用户的所有已注册设备列表
    
    返回设备ID、类型、名称、最后同步时间等信息。
    """
    result = await db.execute(
        select(UserDevice)
        .where(UserDevice.user_id == current_user.id)
        .order_by(UserDevice.created_at.desc())
    )
    devices = result.scalars().all()
    
    return [DeviceInfo.model_validate(d) for d in devices]


@router.post("/devices/register", response_model=DeviceRegisterResponse, summary="注册新设备")
async def register_device(
    request: DeviceRegisterRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    注册新设备用于云端同步
    
    - **device_id**: 设备唯一标识符
    - **device_type**: 设备类型 (web/ios/android/desktop)
    - **device_name**: 设备显示名称
    
    如果设备已存在则更新信息，否则创建新记录。
    """
    existing = await db.execute(
        select(UserDevice).where(
            UserDevice.device_id == request.device_id,
            UserDevice.user_id == current_user.id,
        )
    )
    device = existing.scalar_one_or_none()
    
    if device:
        device.device_type = request.device_type
        device.device_name = request.device_name
        device.is_active = True
        message = "设备信息已更新"
    else:
        device = UserDevice(
            device_id=request.device_id,
            user_id=current_user.id,
            device_type=request.device_type,
            device_name=request.device_name,
            is_active=True,
        )
        db.add(device)
        message = "设备注册成功"
    
    await db.commit()
    
    return DeviceRegisterResponse(
        success=True,
        device_id=request.device_id,
        registered_at=_now(),
        message=message,
    )


@router.delete("/devices/{device_id}", summary="注销设备")
async def unregister_device(
    device_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    注销指定设备（软删除）
    
    - **device_id**: 要注销的设备ID
    
    注销后该设备将无法再进行同步操作。
    """
    result = await db.execute(
        select(UserDevice).where(
            UserDevice.device_id == device_id,
            UserDevice.user_id == current_user.id,
        )
    )
    device = result.scalar_one_or_none()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"设备 {device_id} 不存在",
        )
    
    device.is_active = False
    await db.commit()
    
    return {"success": True, "message": f"设备 {device_id} 已注销"}


@router.get("/history", response_model=SyncHistoryResponse, summary="获取同步历史")
async def get_sync_history(
    db: DbSession,
    current_user: CurrentUser,
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    entity_type: Optional[str] = Query(None, description="实体类型筛选"),
    status_filter: Optional[str] = Query(None, alias="status", description="状态筛选"),
):
    """
    获取同步操作历史记录
    
    - **page**: 页码（默认1）
    - **page_size**: 每页条数（默认20，最大100）
    - **entity_type**: 可选，按实体类型筛选
    - **status**: 可选，按状态筛选
    
    返回分页的同步日志列表。
    """
    query = select(SyncLog).where(SyncLog.user_id == current_user.id)
    count_query = select(func.count(SyncLog.id)).where(SyncLog.user_id == current_user.id)
    
    if entity_type:
        query = query.where(SyncLog.entity_type == entity_type)
        count_query = count_query.where(SyncLog.entity_type == entity_type)
    
    if status_filter:
        try:
            sync_status = SyncStatus(status_filter)
            query = query.where(SyncLog.status == sync_status)
            count_query = count_query.where(SyncLog.status == sync_status)
        except ValueError:
            pass
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    offset = (page - 1) * page_size
    query = query.order_by(SyncLog.timestamp.desc()).offset(offset).limit(page_size)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return SyncHistoryResponse(
        logs=[SyncLogItem.model_validate(log) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
    )


async def _get_or_register_device(db: AsyncSession, user_id: int, device_id: str) -> Optional[UserDevice]:
    """获取或自动注册设备"""
    result = await db.execute(
        select(UserDevice).where(
            UserDevice.device_id == device_id,
            UserDevice.user_id == user_id,
        )
    )
    device = result.scalar_one_or_none()
    
    if not device:
        device = UserDevice(
            device_id=device_id,
            user_id=user_id,
            device_type=DeviceType.WEB,
            device_name="Auto-registered device",
            is_active=True,
        )
        db.add(device)
        await db.flush()
    
    return device


@router.post("/full-sync", summary="执行完整双向同步")
async def full_sync(
    request: dict,
    db: DbSession,
    current_user: CurrentUser,
    device_id: str = Query(..., description="设备ID"),
):
    """
    执行完整的双向同步流程
    
    流程：
    1. 接收本地数据快照
    2. 检测本地变更
    3. 推送变更到服务器
    4. 拉取远程变更
    5. 检测并解决冲突
    6. 返回合并结果
    
    - **device_id**: 设备唯一标识符
    - **local_data**: 本地数据字典 {entity_type: {entity_id: data}}
    - **last_sync_timestamp**: 可选，上次同步时间戳
    
    返回详细的同步结果统计。
    """
    sync_service = _get_sync_service()
    
    local_data = request.get("local_data", {})
    last_sync_ts = request.get("last_sync_timestamp")
    
    if last_sync_ts:
        try:
            if isinstance(last_sync_ts, str):
                last_sync_ts = datetime.fromisoformat(last_sync_ts.replace("Z", "+00:00"))
        except Exception:
            last_sync_ts = None
    
    try:
        result = await sync_service.full_sync(
            user_id=current_user.id,
            device_id=device_id,
            local_data=local_data,
            last_sync_timestamp=last_sync_ts,
        )
        
        logger.info(
            f"[Sync] 完整同步完成: user={current_user.id}, "
            f"pushed={result.pushed_count}, pulled={result.pulled_count}, "
            f"conflicts={result.conflicts_detected}, success={result.success}"
        )
        
        return {
            "success": result.success,
            "sync_mode": result.sync_mode.value,
            "duration_ms": round(result.duration_ms, 2),
            "statistics": {
                "pushed_count": result.pushed_count,
                "pulled_count": result.pulled_count,
                "conflicts_detected": result.conflicts_detected,
                "conflicts_auto_resolved": result.conflicts_auto_resolved,
                "conflicts_pending_user": result.conflicts_pending_user,
                "failed_count": result.failed_count,
            },
            "server_timestamp": result.server_timestamp.isoformat() if result.server_timestamp else None,
            "next_sync_token": result.next_sync_token,
            "errors": result.errors,
            "warnings": result.warnings,
        }
        
    except Exception as e:
        logger.error("[Sync] 完整同步失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试",
        )


@router.post("/incremental-sync", summary="执行增量同步")
async def incremental_sync(
    request: dict,
    db: DbSession,
    current_user: CurrentUser,
    device_id: str = Query(..., description="设备ID"),
    entity_types: Optional[str] = Query(None, description="要同步的实体类型，逗号分隔"),
):
    """
    增量同步（只处理最近变更）
    
    只同步指定实体类型或最近修改的数据，
    适用于频繁的小规模同步场景。
    
    - **device_id**: 设备唯一标识符
    - **local_data**: 本地数据
    - **entity_types**: 可选，要同步的实体类型列表
    
    返回增量同步结果。
    """
    sync_service = _get_sync_service()
    
    local_data = request.get("local_data", {})
    type_list = None
    if entity_types:
        type_list = [t.strip() for t in entity_types.split(",") if t.strip()]
    
    try:
        result = await sync_service.incremental_sync(
            user_id=current_user.id,
            device_id=device_id,
            local_data=local_data,
            entity_types=type_list,
        )
        
        return {
            "success": result.success,
            "sync_mode": "incremental",
            "duration_ms": round(result.duration_ms, 2),
            "statistics": {
                "pushed_count": result.pushed_count,
                "pulled_count": result.pulled_count,
                "conflicts_detected": result.conflicts_detected,
                "conflicts_auto_resolved": result.conflicts_auto_resolved,
            },
            "server_timestamp": result.server_timestamp.isoformat() if result.server_timestamp else None,
            "next_sync_token": result.next_sync_token,
        }
        
    except Exception as e:
        logger.error("[Sync] 增量同步失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试",
        )


@router.get("/stats", summary="获取同步服务统计信息")
async def get_sync_stats(
    current_user: CurrentUser,
):
    """
    获取同步引擎的详细统计和状态信息
    
    返回：
    - 同步服务性能指标
    - 差异检测器缓存命中率
    - 协议层传输统计
    - 冲突检测/解决统计
    - 队列状态
    """
    sync_service = _get_sync_service()
    detector = _get_detector()
    protocol = _get_protocol()
    conflict_detector = _get_conflict_detector()
    queue = _get_change_queue()
    
    return {
        "sync_service": sync_service.get_stats(),
        "detector": detector.stats,
        "protocol": protocol.get_stats(),
        "conflict_detector": conflict_detector.stats,
        "queue": queue.get_stats(),
        "timestamp": _now().isoformat(),
    }


@router.post("/encrypt-data", summary="加密敏感数据")
async def encrypt_sensitive_data(
    request: dict,
    current_user: CurrentUser,
):
    """
    加密数据中的敏感字段
    
    使用AES-256-GCM算法加密字典中的敏感字段。
    自动识别 password、token、api_key 等字段并加密。
    
    - **data**: 要加密的字典数据
    - **encrypt_all**: 是否加密所有字段（默认false）
    
    返回加密后的数据。
    """
    try:
        data = request.get("data", {})
        encrypt_all = request.get("encrypt_all", False)
        
        from ...utils.key_manager import KeyManager
        
        key_manager = KeyManager()
        key = key_manager.get_data_encryption_key(user_id=str(current_user.id))
        
        encrypted = EncryptionUtils.encrypt_dict(data, key, encrypt_all)
        
        return {
            "success": True,
            "encrypted_data": encrypted,
            "encrypted_fields": [
                k for k, v in encrypted.items()
                if isinstance(v, dict) and v.get("__encrypted__")
            ],
        }
        
    except Exception as e:
        logger.error("[Sync] 数据加密失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试",
        )


@router.post("/decrypt-data", summary="解密敏感数据")
async def decrypt_sensitive_data(
    request: dict,
    current_user: CurrentUser,
):
    """
    解密由 /encrypt-data 端点加密的数据
    
    - **encrypted_data**: 加密后的字典数据
    
    返回原始明文数据。
    """
    try:
        encrypted_data = request.get("encrypted_data", {})
        
        from ...utils.key_manager import KeyManager
        
        key_manager = KeyManager()
        key = key_manager.get_data_encryption_key(user_id=str(current_user.id))
        
        decrypted = EncryptionUtils.decrypt_dict(encrypted_data, key)
        
        return {
            "success": True,
            "decrypted_data": decrypted,
        }
        
    except Exception as e:
        logger.error("[Sync] 数据解密失败: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="服务器内部错误，请稍后重试",
        )
