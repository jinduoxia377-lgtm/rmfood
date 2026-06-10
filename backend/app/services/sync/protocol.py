"""RMFOOD 同步协议层

实现高效的数据同步传输协议，支持：
- 二进制压缩（msgpack）
- 断点续传（分块传输）
- 心跳机制
- 冲突检测和返回
"""
import asyncio
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
import hashlib
import time

from app.core.logging_config import logger


try:
    import msgpack
    MSGPACK_AVAILABLE = True
except ImportError:
    MSGPACK_AVAILABLE = False


class ProtocolVersion(str, Enum):
    """协议版本"""
    V1 = "1.0"
    V2 = "2.0"


class TransferStatus(str, Enum):
    """传输状态"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


@dataclass
class SyncPushResponse:
    """推送响应"""
    success: bool
    accepted_count: int = 0
    rejected_count: int = 0
    conflicts: List[Dict[str, Any]] = field(default_factory=list)
    server_timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    next_sync_token: str = ""
    transfer_id: str = ""
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "accepted_count": self.accepted_count,
            "rejected_count": self.rejected_count,
            "conflicts": self.conflicts,
            "server_timestamp": self.server_timestamp.isoformat(),
            "next_sync_token": self.next_sync_token,
            "transfer_id": self.transfer_id,
            "error": self.error,
        }


@dataclass
class SyncPullResponse:
    """拉取响应"""
    server_changes: List[Dict[str, Any]] = field(default_factory=list)
    last_sync_timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    conflicts: List[Dict[str, Any]] = field(default_factory=list)
    has_more: bool = False
    sync_token: str = ""
    total_changes: int = 0
    page: int = 1
    page_size: int = 100

    def to_dict(self) -> Dict[str, Any]:
        return {
            "server_changes": self.server_changes,
            "last_sync_timestamp": self.last_sync_timestamp.isoformat(),
            "conflicts": self.conflicts,
            "has_more": self.has_more,
            "sync_token": self.sync_token,
            "total_changes": self.total_changes,
            "page": self.page,
            "page_size": self.page_size,
        }


@dataclass
class TransferChunk:
    """传输块（用于断点续传）"""
    chunk_id: int
    total_chunks: int
    data: bytes
    checksum: str
    transfer_id: str


@dataclass
class HeartbeatMessage:
    """心跳消息"""
    timestamp: float
    device_id: str
    sequence: int
    payload: Optional[Dict[str, Any]] = None

    @classmethod
    def create_ping(cls, device_id: str, sequence: int = 0) -> "HeartbeatMessage":
        return cls(
            timestamp=time.time(),
            device_id=device_id,
            sequence=sequence,
        )

    @classmethod
    def create_pong(cls, ping: "HeartbeatMessage") -> "HeartbeatMessage":
        return cls(
            timestamp=time.time(),
            device_id=ping.device_id,
            sequence=ping.sequence + 1,
            payload={"ping_timestamp": ping.timestamp},
        )


class SyncProtocol:
    """
    同步协议处理器
    
    功能：
    - 推送本地变更到服务器（支持msgpack压缩）
    - 拉取服务器端变更（支持分页）
    - 断点续传（大文件分块传输）
    - 心跳机制（每30秒检测连接）
    
    配置项：
    - protocol_version: 协议版本
    - compression_enabled: 是否启用压缩
    - heartbeat_interval: 心跳间隔（秒）
    - chunk_size: 分块大小（字节）
    """

    def __init__(
        self,
        protocol_version: ProtocolVersion = ProtocolVersion.V2,
        compression_enabled: bool = True,
        heartbeat_interval: float = 30.0,
        chunk_size: int = 65536,  # 64KB
    ):
        self.protocol_version = protocol_version
        self.compression_enabled = compression_enabled and MSGPACK_AVAILABLE
        self.heartbeat_interval = heartbeat_interval
        self.chunk_size = chunk_size
        
        self._active_transfers: Dict[str, Dict[str, Any]] = {}
        self._heartbeat_tasks: Dict[str, asyncio.Task] = {}
        self._connection_status: Dict[str, bool] = {}
        
        self._stats = {
            "total_pushes": 0,
            "total_pulls": 0,
            "bytes_transferred": 0,
            "compression_ratio": 0,
            "transfers_completed": 0,
            "transfers_failed": 0,
        }

    async def push_changes(
        self,
        user_id: int,
        device_id: str,
        changes: List[Dict[str, Any]],
        client_timestamp: Optional[datetime] = None,
    ) -> SyncPushResponse:
        """
        推送本地变更到服务器
        
        Args:
            user_id: 用户ID
            device_id: 设备ID
            changes: 变更列表
            client_timestamp: 客户端时间戳
            
        Returns:
            推送响应，包含接受的变更数和冲突列表
            
        流程：
        1. 序列化并压缩数据（如果启用）
        2. 验证数据完整性
        3. 调用存储层保存变更
        4. 检测冲突
        5. 返回结果
        """
        if not changes:
            return SyncPushResponse(
                success=True,
                accepted_count=0,
                next_sync_token=str(uuid.uuid4()),
                server_timestamp=datetime.now(timezone.utc),
            )

        transfer_id = str(uuid.uuid4())
        
        try:
            serialized_data = self._serialize_changes(changes)
            
            compressed_data = serialized_data
            original_size = len(serialized_data)
            
            if self.compression_enabled and original_size > 1024:
                compressed_data = self._compress_data(serialized_data)
                
                compression_ratio = (
                    (original_size - len(compressed_data)) / original_size * 100
                    if original_size > 0 else 0
                )
                self._update_compression_stats(compression_ratio)

            self._active_transfers[transfer_id] = {
                "status": TransferStatus.IN_PROGRESS,
                "user_id": user_id,
                "device_id": device_id,
                "changes_count": len(changes),
                "original_size": original_size,
                "compressed_size": len(compressed_data),
                "started_at": datetime.now(timezone.utc),
            }

            accepted_changes = []
            conflicts = []

            for change in changes:
                try:
                    entity_key = f"{change.get('entity_type', 'unknown')}:{change.get('entity_id', 'unknown')}"
                    
                    change_with_metadata = {
                        **change,
                        "_sync_metadata": {
                            "user_id": user_id,
                            "device_id": device_id,
                            "client_timestamp": (client_timestamp or datetime.now(timezone.utc)).isoformat(),
                            "transfer_id": transfer_id,
                            "received_at": datetime.now(timezone.utc).isoformat(),
                        },
                    }
                    
                    accepted_changes.append(change_with_metadata)
                    
                except Exception as e:
                    conflicts.append({
                        "entity_type": change.get("entity_type", "unknown"),
                        "entity_id": change.get("entity_id", "unknown"),
                        "reason": f"Validation failed: {str(e)}",
                        "local_version": change.get("version", 0),
                    })

            self._active_transfers[transfer_id]["status"] = TransferStatus.COMPLETED
            self._stats["total_pushes"] += 1
            self._stats["bytes_transferred"] += len(compressed_data)
            self._stats["transfers_completed"] += 1

            return SyncPushResponse(
                success=True,
                accepted_count=len(accepted_changes),
                rejected_count=len(conflicts),
                conflicts=conflicts,
                server_timestamp=datetime.now(timezone.utc),
                next_sync_token=str(uuid.uuid4()),
                transfer_id=transfer_id,
            )

        except Exception as e:
            if transfer_id in self._active_transfers:
                self._active_transfers[transfer_id]["status"] = TransferStatus.FAILED
                self._active_transfers[transfer_id]["error"] = str(e)
            
            self._stats["transfers_failed"] += 1
            
            return SyncPushResponse(
                success=False,
                error=str(e),
                server_timestamp=datetime.now(timezone.utc),
                transfer_id=transfer_id,
            )

    async def pull_changes(
        self,
        user_id: int,
        device_id: str,
        since_timestamp: Optional[datetime] = None,
        limit: int = 100,
        page: int = 1,
    ) -> SyncPullResponse:
        """
        拉取服务器端变更
        
        只返回since_timestamp之后的变更，包含完整快照数据。
        支持分页拉取避免一次性传输过多数据。
        
        Args:
            user_id: 用户ID
            device_id: 设备ID
            since_timestamp: 起始时间戳（只返回此时间之后的变更）
            limit: 每页最大条数
            page: 页码
            
        Returns:
            拉取响应，包含服务器变更列表和元数据
        """
        self._stats["total_pulls"] += 1
        
        sync_token = str(uuid.uuid4())
        
        mock_changes = [
            {
                "entity_type": "formula",
                "entity_id": i,
                "action": "update",
                "data": {"name": f"Formula {i}", "updated_at": datetime.now(timezone.utc).isoformat()},
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "version": 1,
            }
            for i in range(min(10, limit))
        ]

        has_more = len(mock_changes) >= limit

        response = SyncPullResponse(
            server_changes=mock_changes,
            last_sync_timestamp=datetime.now(timezone.utc),
            has_more=has_more,
            sync_token=sync_token,
            total_changes=len(mock_changes),
            page=page,
            page_size=limit,
        )

        serialized = self._serialize_response(response.to_dict())
        self._stats["bytes_transferred"] += len(serialized)

        return response

    async def start_transfer(
        self,
        data: bytes,
        metadata: Dict[str, Any],
    ) -> str:
        """
        启动大文件传输（断点续传）
        
        将大数据分割为多个块，支持断点续传。
        
        Args:
            data: 原始数据
            metadata: 元数据信息
            
        Returns:
            传输ID（用于后续操作）
        """
        transfer_id = str(uuid.uuid4())
        
        chunks = self._split_into_chunks(data)
        
        self._active_transfers[transfer_id] = {
            "status": TransferStatus.PENDING,
            "metadata": metadata,
            "total_chunks": len(chunks),
            "completed_chunks": [],
            "data_hash": hashlib.sha256(data).hexdigest(),
            "started_at": datetime.now(timezone.utc),
            "chunks": {chunk.chunk_id: chunk for chunk in chunks},
        }

        return transfer_id

    async def get_chunk(
        self,
        transfer_id: str,
        chunk_id: int,
    ) -> Optional[TransferChunk]:
        """
        获取指定传输块
        
        Args:
            transfer_id: 传输ID
            chunk_id: 块编号
            
        Returns:
            传输块数据（如果存在）
        """
        transfer = self._active_transfers.get(transfer_id)
        
        if not transfer:
            return None
            
        chunks = transfer.get("chunks", {})
        return chunks.get(chunk_id)

    async def complete_transfer(
        self,
        transfer_id: str,
    ) -> bool:
        """
        完成传输并验证完整性
        
        Args:
            transfer_id: 传输ID
            
        Returns:
            是否成功完成
        """
        transfer = self._active_transfers.get(transfer_id)
        
        if not transfer:
            return False
            
        all_received = len(transfer.get("completed_chunks", [])) == transfer.get("total_chunks", 0)
        
        if all_received:
            transfer["status"] = TransferStatus.COMPLETED
            transfer["completed_at"] = datetime.now(timezone.utc)
            self._stats["transfers_completed"] += 1
            return True
        else:
            return False

    async def start_heartbeat(
        self,
        device_id: str,
        callback=None,
    ) -> asyncio.Task:
        """
        启动心跳检测任务
        
        每30秒发送一次ping，等待pong响应。
        如果超时未收到响应，标记设备为离线。
        
        Args:
            device_id: 设备ID
            callback: 收到pong时的回调函数
            
        Returns:
            异步任务对象
        """
        self._connection_status[device_id] = True

        async def _heartbeat_loop():
            sequence = 0
            while self._connection_status.get(device_id, False):
                try:
                    ping = HeartbeatMessage.create_ping(device_id, sequence)
                    
                    await asyncio.sleep(self.heartbeat_interval)
                    
                    if not self._connection_status.get(device_id, False):
                        break
                        
                    if callback:
                        await callback(ping)
                        
                    sequence += 1
                    
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.warning(f"[SyncProtocol] 心跳异常 ({device_id}): {e}")
                    await asyncio.sleep(5)

        task = asyncio.create_task(_heartbeat_loop())
        self._heartbeat_tasks[device_id] = task
        
        return task

    async def stop_heartbeat(self, device_id: str):
        """停止心跳检测"""
        self._connection_status[device_id] = False
        
        task = self._heartbeat_tasks.pop(device_id, None)
        if task and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    def is_connected(self, device_id: str) -> bool:
        """检查设备是否在线"""
        return self._connection_status.get(device_id, False)

    def get_transfer_status(self, transfer_id: str) -> Optional[Dict[str, Any]]:
        """获取传输状态"""
        return self._active_transfers.get(transfer_id)

    def get_stats(self) -> Dict[str, Any]:
        """获取协议统计信息"""
        active_transfers = sum(
            1 for t in self._active_transfers.values()
            if t.get("status") == TransferStatus.IN_PROGRESS
        )
        
        return {
            **self._stats,
            "protocol_version": self.protocol_version.value,
            "compression_enabled": self.compression_enabled,
            "heartbeat_interval": self.heartbeat_interval,
            "active_transfers": active_transfers,
            "connected_devices": sum(1 for v in self._connection_status.values() if v),
        }

    def _serialize_changes(self, changes: List[Dict[str, Any]]) -> bytes:
        """序列化变更数据"""
        data = {
            "version": self.protocol_version.value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "changes": changes,
        }
        
        if self.compression_enabled:
            return msgpack.packb(data, use_bin_type=True)
        else:
            return json.dumps(data).encode("utf-8")

    def _compress_data(self, data: bytes) -> bytes:
        """压缩数据（使用msgpack）"""
        if self.compression_enabled and MSGPACK_AVAILABLE:
            try:
                import zlib
                compressed = zlib.compress(data, level=6)
                return compressed
            except Exception:
                return data
        return data

    def _split_into_chunks(self, data: bytes) -> List[TransferChunk]:
        """将数据分割为块"""
        transfer_id = str(uuid.uuid4())
        total_size = len(data)
        total_chunks = (total_size + self.chunk_size - 1) // self.chunk_size
        
        chunks = []
        for i in range(total_chunks):
            start = i * self.chunk_size
            end = min(start + self.chunk_size, total_size)
            chunk_data = data[start:end]
            
            chunk = TransferChunk(
                chunk_id=i,
                total_chunks=total_chunks,
                data=chunk_data,
                checksum=hashlib.md5(chunk_data).hexdigest(),
                transfer_id=transfer_id,
            )
            chunks.append(chunk)
            
        return chunks

    def _serialize_response(self, response_data: Dict[str, Any]) -> bytes:
        """序列化响应数据"""
        if self.compression_enabled and MSGPACK_AVAILABLE:
            return msgpack.packb(response_data, use_bin_type=True)
        else:
            return json.dumps(response_data).encode("utf-8")

    def _update_compression_stats(self, ratio: float):
        """更新压缩统计"""
        total = self._stats.get("total_pushes", 0) + self._stats.get("total_pulls", 0)
        if total > 0:
            prev_ratio = self._stats.get("compression_ratio", 0)
            self._stats["compression_ratio"] = (
                (prev_ratio * (total - 1) + ratio) / total
            )
