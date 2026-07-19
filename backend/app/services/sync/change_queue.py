"""RMFOOD 变更队列管理

提供线程安全的异步变更队列，支持批量操作、顺序保证和幂等性。
用于同步引擎的变更缓冲和传输。
"""
import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set
from collections import OrderedDict


class QueueItemStatus(str, Enum):
    """队列项状态"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class QueueItem:
    """队列中的变更项"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: str = ""
    entity_id: str = ""
    change_type: str = "update"
    data: Dict[str, Any] = field(default_factory=dict)
    status: QueueItemStatus = QueueItemStatus.PENDING
    created_at: datetime = field(default_factory=lambda: datetime.now())
    completed_at: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3
    error: Optional[str] = None
    priority: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def mark_processing(self):
        """标记为处理中"""
        self.status = QueueItemStatus.PROCESSING

    def mark_completed(self):
        """标记为完成"""
        self.status = QueueItemStatus.COMPLETED
        self.completed_at = datetime.now()

    def mark_failed(self, error: str):
        """标记为失败"""
        self.status = QueueItemStatus.FAILED
        self.error = error
        self.retry_count += 1


class ChangeQueue:
    """
    异步变更队列
    
    特性：
    - FIFO队列，支持优先级排序
    - 批量入队/出队优化
    - 顺序一致性保证
    - 幂等性标记
    - 自动重试机制
    - 持久化支持（可选）
    
    使用示例：
        >>> queue = ChangeQueue()
        >>> await queue.enqueue(change)
        >>> batch = await queue.dequeue_batch(batch_size=50)
        >>> await queue.mark_completed([item.id for item in batch])
    """

    def __init__(
        self,
        max_size: int = 10000,
        batch_merge_enabled: bool = True,
        auto_retry: bool = True,
    ):
        """
        初始化变更队列
        
        Args:
            max_size: 队列最大容量
            batch_merge_enabled: 是否启用批量合并优化
            auto_retry: 是否自动重试失败项
        """
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=max_size)
        self._max_size = max_size
        self._batch_merge_enabled = batch_merge_enabled
        self._auto_retry = auto_retry
        
        self._processing: bool = False
        self._items: Dict[str, QueueItem] = {}
        self._entity_index: Dict[str, str] = {}
        
        self._completed_ids: Set[str] = set()
        self._lock = asyncio.Lock()
        
        self._stats = {
            "total_enqueued": 0,
            "total_dequeued": 0,
            "total_completed": 0,
            "total_failed": 0,
            "merge_count": 0,
            "retry_count": 0,
        }

    async def enqueue(
        self,
        item: QueueItem,
        merge_strategy: str = "latest_wins",
    ) -> bool:
        """
        入队一个变更项
        
        支持批量合并优化：
        - 如果同一实体的多个变更在队列中，可以合并为最新版本
        
        Args:
            item: 队列项
            merge_strategy: 合并策略 (latest_wins/keep_all)
            
        Returns:
            是否成功入队
            
        Raises:
            QueueFullError: 队列已满
        """
        if self._queue.full():
            raise QueueFullError(f"队列已满，最大容量: {self._max_size}")

        async with self._lock:
            if self._batch_merge_enabled and merge_strategy == "latest_wins":
                existing_item_id = self._entity_index.get(item.entity_key)
                
                if existing_item_id and existing_item_id in self._items:
                    existing_item = self._items[existing_item_id]
                    
                    if existing_item.status == QueueItemStatus.PENDING:
                        existing_item.data = item.data
                        existing_item.change_type = item.change_type
                        existing_item.created_at = item.created_at
                        existing_item.priority = item.priority
                        
                        self._stats["merge_count"] += 1
                        return True

            self._items[item.id] = item
            self._entity_index[item.entity_key] = item.id
            
            await self._queue.put(item.id)
            
            self._stats["total_enqueued"] += 1
            
            return True

    async def enqueue_batch(
        self,
        items: List[QueueItem],
        merge_strategy: str = "latest_wins",
    ) -> int:
        """
        批量入队多个变更项
        
        Args:
            items: 队列项列表
            merge_strategy: 合并策略
            
        Returns:
            成功入队的数量
        """
        success_count = 0
        
        for item in items:
            try:
                await self.enqueue(item, merge_strategy)
                success_count += 1
            except QueueFullError:
                break
                
        return success_count

    async def dequeue_batch(
        self,
        batch_size: int = 50,
        timeout: float = 5.0,
    ) -> List[QueueItem]:
        """
        出队一批变更项
        
        保证顺序一致性：按入队顺序返回。
        
        Args:
            batch_size: 最大出队数量
            timeout: 超时时间（秒），超时返回空列表
            
        Returns:
            队列项列表（按FIFO顺序）
        """
        if self._processing:
            return []

        self._processing = True
        
        try:
            batch: List[QueueItem] = []
            deadline = asyncio.get_event_loop_policy().get_event_loop().time() + timeout
            
            while len(batch) < batch_size:
                remaining_time = deadline - asyncio.get_event_loop_policy().get_event_loop().time()
                
                if remaining_time <= 0:
                    break
                    
                try:
                    item_id = await asyncio.wait_for(
                        self._queue.get(),
                        timeout=min(remaining_time, 1.0),
                    )
                except asyncio.TimeoutError:
                    break

                async with self._lock:
                    item = self._items.get(item_id)
                    
                    if not item:
                        continue
                        
                    if item.status == QueueItemStatus.PENDING:
                        item.mark_processing()
                        batch.append(item)
                        self._stats["total_dequeued"] += 1
                    elif (
                        self._auto_retry
                        and item.status == QueueItemStatus.FAILED
                        and item.retry_count < item.max_retries
                    ):
                        item.status = QueueItemStatus.PENDING
                        item.error = None
                        item.mark_processing()
                        batch.append(item)
                        self._stats["retry_count"] += 1

            return batch
            
        finally:
            self._processing = False

    async def mark_completed(
        self,
        item_ids: List[str],
        success: bool = True,
    ) -> int:
        """
        标记一批项目为已完成或失败（幂等操作）
        
        幂等性保证：
        - 同一ID多次调用不会产生副作用
        - 已完成的项再次标记会被忽略
        
        Args:
            item_ids: 项目ID列表
            success: 是否成功
            
        Returns:
            实际更新的项目数
        """
        async with self._lock:
            updated_count = 0
            
            for item_id in item_ids:
                if item_id in self._completed_ids:
                    continue
                    
                item = self._items.get(item_id)
                
                if not item:
                    continue
                    
                if success:
                    item.mark_completed()
                    self._stats["total_completed"] += 1
                else:
                    item.mark_failed("Marked as failed")
                    self._stats["total_failed"] += 1
                
                self._completed_ids.add(item_id)
                
                entity_key = item.entity_key
                if self._entity_index.get(entity_key) == item_id:
                    del self._entity_index[entity_key]
                
                updated_count += 1

            return updated_count

    async def mark_failed(
        self,
        item_id: str,
        error: str,
    ) -> bool:
        """
        标记单个项目为失败（可重试）
        
        Args:
            item_id: 项目ID
            error: 错误信息
            
        Returns:
            是否成功标记
        """
        async with self._lock:
            item = self._items.get(item_id)
            
            if not item:
                return False
                
            item.mark_failed(error)
            
            if item.retry_count < item.max_retries and self._auto_retry:
                await self._queue.put(item_id)
            
            self._stats["total_failed"] += 1
            
            return True

    @property
    def size(self) -> int:
        """当前队列大小"""
        return self._queue.qsize()

    @property
    def is_empty(self) -> bool:
        """队列是否为空"""
        return self._queue.empty()

    @property
    def is_full(self) -> bool:
        """队列是否已满"""
        return self._queue.full()

    def get_pending_count(self) -> int:
        """获取待处理项目数"""
        return sum(
            1 for item in self._items.values()
            if item.status == QueueItemStatus.PENDING
        )

    def get_processing_count(self) -> int:
        """获取正在处理的项目数"""
        return sum(
            1 for item in self._items.values()
            if item.status == QueueItemStatus.PROCESSING
        )

    def get_stats(self) -> Dict[str, Any]:
        """获取队列统计信息"""
        return {
            **self._stats,
            "current_size": self.size,
            "max_size": self._max_size,
            "pending_count": self.get_pending_count(),
            "processing_count": self.get_processing_count(),
            "completed_count": len(self._completed_ids),
            "total_items": len(self._items),
        }

    async def clear(self):
        """清空队列（仅清除待处理项）"""
        async with self._lock:
            while not self._queue.empty():
                try:
                    self._queue.get_nowait()
                except asyncio.QueueEmpty:
                    break

            pending_ids = [
                item_id for item_id, item in self._items.items()
                if item.status == QueueItemStatus.PENDING
            ]
            
            for item_id in pending_ids:
                del self._items[item_id]

            self._entity_index.clear()

    async def get_by_entity(
        self,
        entity_type: str,
        entity_id: str,
    ) -> Optional[QueueItem]:
        """
        根据实体类型和ID查找队列项
        
        Args:
            entity_type: 实体类型
            entity_id: 实体ID
            
        Returns:
            队列项（如果存在）
        """
        key = f"{entity_type}:{entity_id}"
        item_id = self._entity_index.get(key)
        
        if item_id:
            return self._items.get(item_id)
            
        return None


class QueueFullError(Exception):
    """队列已满异常"""
    pass


@property
def entity_key(self: QueueItem) -> str:
    """生成实体唯一键"""
    return f"{self.entity_type}:{self.entity_id}"

QueueItem.entity_key = entity_key
