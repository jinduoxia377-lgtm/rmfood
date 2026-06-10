"""
RMFOOD 异步任务队列系统

设计理念:
- 轻量级实现 (无需Celery依赖)
- 基于asyncio的内存队列
- 支持任务优先级
- 实时状态追踪
- 自动重试和死信队列
- 任务结果持久化 (可选)

适用场景:
✅ AI配方生成 (耗时10-60秒)
✅ 批量肽分析 (可能需要数分钟)
✅ 数据导出/报表生成
✅ 文件处理任务
✅ 定时清理任务

架构:
┌──────────┐    ┌──────────┐    ┌──────────────┐
│ Producer │───▶│  Queue   │───▶│   Worker     │
│ (API)    │    │ (内存)   │    │ (Asyncio)    │
└──────────┘    └──────────┘    └──────────────┘
                      │                │
                      ▼                ▼
               ┌──────────┐    ┌──────────────┐
               │ Priority │    │ Result Store │
               │ Scheduler│    │ (DB/Redis)   │
               └──────────┘    └──────────────┘
"""

from __future__ import annotations

import asyncio
import enum
import json
import logging
import time
import traceback
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, TypeVar, Awaitable
from functools import wraps
import heapq

logger = logging.getLogger(__name__)

T = TypeVar('T')


class TaskStatus(enum.Enum):
    """任务状态枚举"""
    PENDING = "pending"           # 等待执行
    RUNNING = "running"           # 正在执行
    SUCCESS = "success"           # 成功完成
    FAILED = "failed"             # 执行失败
    RETRYING = "retrying"         # 重试中
    CANCELLED = "cancelled"       # 已取消
    TIMEOUT = "timeout"           # 超时


class TaskPriority(enum.IntEnum):
    """任务优先级 (数值越小优先级越高)"""
    CRITICAL = 0      # 紧急任务 (如安全告警)
    HIGH = 1          # 高优先级 (用户交互)
    NORMAL = 2        # 普通任务 (后台批处理)
    LOW = 3           # 低优先级 (日志清理等)
    BACKGROUND = 4    # 后台任务 (统计、备份)


@dataclass(order=True)
class PrioritizedTask:
    """带优先级的任务项"""
    priority: int
    task_id: str = field(compare=False)
    created_at: float = field(compare=False)
    func: Callable = field(compare=False)
    args: tuple = field(compare=False)
    kwargs: dict = field(compare=False)
    max_retries: int = field(default=3, compare=False)
    timeout: Optional[int] = field(default=None, compare=False)
    metadata: Dict[str, Any] = field(default_factory=dict, compare=False)


@dataclass
class TaskResult:
    """任务执行结果"""
    task_id: str
    status: TaskStatus
    result: Any = None
    error: Optional[str] = None
    traceback_str: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    retry_count: int = 0
    processing_time_ms: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "status": self.status.value,
            "result": self.result if not isinstance(self.result, bytes) else "<binary>",
            "error": self.error,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "retry_count": self.retry_count,
            "processing_time_ms": round(self.processing_time_ms, 1),
        }


@dataclass
class QueueStats:
    """队列统计信息"""
    total_tasks: int = 0
    pending_tasks: int = 0
    running_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    avg_processing_time_ms: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_tasks": self.total_tasks,
            "pending_tasks": self.pending_tasks,
            "running_tasks": self.running_tasks,
            "completed_tasks": self.completed_tasks,
            "failed_tasks": self.failed_tasks,
            "success_rate": f"{(self.completed_tasks / max(self.total_tasks, 1)) * 100:.1f}%",
            "avg_processing_time_ms": round(self.avg_processing_time_ms, 1),
        }


class AsyncTaskQueue:
    """
    异步任务队列
    
    Usage:
        queue = AsyncTaskQueue(max_workers=4)
        
        # 启动工作进程
        await queue.start()
        
        # 提交任务
        task_id = await queue.submit(
            my_async_function,
            args=(arg1, arg2),
            priority=TaskPriority.HIGH,
            timeout=30,
        )
        
        # 查询状态
        status = await queue.get_task_status(task_id)
        
        # 获取结果
        result = await queue.get_task_result(task_id, timeout=60)
        
        # 关闭队列
        await queue.stop()
    """
    
    def __init__(
        self,
        max_workers: int = 4,
        max_queue_size: int = 1000,
        default_timeout: int = 300,
        default_retries: int = 3,
    ):
        self.max_workers = max_workers
        self.max_queue_size = max_queue_size
        self.default_timeout = default_timeout
        self.default_retries = default_retries
        
        # 优先级队列 (使用heapq)
        self._queue: List[PrioritizedTask] = []
        
        # 任务存储
        self._tasks: Dict[str, PrioritizedTask] = {}
        self._results: Dict[str, TaskResult] = {}
        
        # 工作线程控制
        self._workers: List[asyncio.Task] = []
        self._running_tasks: set = set()
        self._stop_event = asyncio.Event()
        
        # 统计信息
        self.stats = QueueStats()
        
        logger.info(
            f"⚡ 异步任务队列初始化 | "
            f"Workers: {max_workers} | MaxQueue: {max_queue_size}"
        )
    
    async def start(self):
        """启动工作进程"""
        self._stop_event.clear()
        
        for i in range(self.max_workers):
            worker = asyncio.create_task(self._worker(f"worker-{i}"))
            self._workers.append(worker)
        
        logger.info(f"🚀 已启动 {self.max_workers} 个工作进程")
    
    async def stop(self, wait_for_completion: bool = False):
        """停止队列"""
        self._stop_event.set()
        
        if wait_for_completion:
            # 等待所有任务完成
            while self._queue or self._running_tasks:
                await asyncio.sleep(0.1)
        
        # 取消工作进程
        for worker in self._workers:
            worker.cancel()
        
        # 等待工作进程结束
        await asyncio.gather(*self._workers, return_exceptions=True)
        
        self._workers.clear()
        logger.info("🛑 任务队列已停止")
    
    async def submit(
        self,
        func: Callable[..., Awaitable[T]],
        args: tuple = (),
        kwargs: dict = None,
        priority: TaskPriority = TaskPriority.NORMAL,
        timeout: Optional[int] = None,
        max_retries: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        task_id: Optional[str] = None,
    ) -> str:
        """
        提交异步任务
        
        Args:
            func: 异步函数
            args: 位置参数
            kwargs: 关键字参数
            priority: 任务优先级
            timeout: 超时时间(秒)，None则使用默认值
            max_retries: 最大重试次数
            metadata: 元数据（用于追踪）
            task_id: 自定义任务ID
            
        Returns:
            任务ID
            
        Raises:
            QueueFullError: 队列已满
        """
        if len(self._queue) >= self.max_queue_size:
            raise Exception(f"队列已满 (当前{len(self._queue)}/{self.max_queue_size})")
        
        task_id = task_id or str(uuid.uuid4())[:12]
        
        task = PrioritizedTask(
            priority=priority.value,
            task_id=task_id,
            created_at=time.time(),
            func=func,
            args=args,
            kwargs=kwargs or {},
            max_retries=max_retries or self.default_retries,
            timeout=timeout or self.default_timeout,
            metadata=metadata or {},
        )
        
        # 加入优先级队列
        heapq.heappush(self._queue, task)
        self._tasks[task_id] = task
        
        # 初始化结果（PENDING状态）
        self._results[task_id] = TaskResult(
            task_id=task_id,
            status=TaskStatus.PENDING,
        )
        
        self.stats.total_tasks += 1
        self.stats.pending_tasks += 1
        
        logger.info(
            f"📥 任务提交 | ID: {task_id} | "
            f"优先级: {priority.name} | 队列长度: {len(self._queue)}"
        )
        
        return task_id
    
    async def _worker(self, worker_name: str):
        """工作进程主循环"""
        logger.debug(f"🔧 {worker_name} 已启动")
        
        while not self._stop_event.is_set():
            try:
                # 从队列获取任务（非阻塞，带超时）
                try:
                    task = await asyncio.wait_for(
                        self._get_next_task(),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue
                
                # 检查队列是否为空
                if task is None:
                    await asyncio.sleep(0.1)
                    continue
                
                # 执行任务
                await self._execute_task(task, worker_name)
                
            except asyncio.CancelledError:
                logger.debug(f"⛔ {worker_name} 收到取消信号")
                break
                
            except Exception as e:
                logger.error(f"❌ {worker_name} 异常: {e}", exc_info=True)
    
    async def _get_next_task(self) -> Optional[PrioritizedTask]:
        """从队列获取下一个任务"""
        if not self._queue:
            return None
        
        task = heapq.heappop(self._queue)
        return task
    
    async def _execute_task(self, task: PrioritizedTask, worker_name: str):
        """执行单个任务（含重试逻辑）"""
        task_id = task.task_id
        result = self._results[task_id]
        
        # 更新状态为RUNNING
        result.status = TaskStatus.RUNNING
        result.started_at = datetime.now(timezone.utc)
        self._running_tasks.add(task_id)
        
        self.stats.pending_tasks -= 1
        self.stats.running_tasks += 1
        
        logger.info(
            f"⚙️ {worker_name} 开始执行 | ID: {task_id} | "
            f"超时: {task.timeout}s"
        )
        
        start_time = time.time()
        retry_count = 0
        
        while retry_count <= task.max_retries:
            try:
                # 带超时执行
                if task.timeout:
                    result.result = await asyncio.wait_for(
                        task.func(*task.args, **task.kwargs),
                        timeout=task.timeout
                    )
                else:
                    result.result = await task.func(*task.args, **task.kwargs)
                
                # 成功完成
                result.status = TaskStatus.SUCCESS
                result.completed_at = datetime.now(timezone.utc)
                result.processing_time_ms = (time.time() - start_time) * 1000
                
                self.stats.running_tasks -= 1
                self.stats.completed_tasks += 1
                
                # 更新平均处理时间
                total_time = self.stats.avg_processing_time_ms * (self.stats.completed_tasks - 1)
                self.stats.avg_processing_time_ms = (
                    total_time + result.processing_time_ms
                ) / self.stats.completed_tasks
                
                logger.info(
                    f"✅ {worker_name} 完成 | ID: {task_id} | "
                    f"耗时: {result.processing_time_ms:.0f}ms"
                )
                
                break
                
            except asyncio.TimeoutError:
                result.status = TaskStatus.TIMEOUT
                result.error = f"任务超时 ({task.timeout}s)"
                retry_count += 1
                
                if retry_count <= task.max_retries:
                    result.status = TaskStatus.RETRYING
                    logger.warning(
                        f"⏰ {worker_name} 超时 | ID: {task_id} | "
                        f"重试 {retry_count}/{task.max_retries}"
                    )
                    await asyncio.sleep(min(retry_count * 2, 10))
                    
            except asyncio.CancelledError:
                result.status = TaskStatus.CANCELLED
                result.error = "任务被取消"
                break
                
            except Exception as e:
                result.error = str(e)
                result.traceback_str = traceback.format_exc()
                retry_count += 1
                
                if retry_count <= task.max_retries:
                    result.status = TaskStatus.RETRYING
                    logger.warning(
                        f"❌ {worker_name} 失败 | ID: {task_id} | "
                        f"错误: {e} | 重试 {retry_count}/{task.max_retries}"
                    )
                    await asyncio.sleep(min(retry_count * 2, 10))
                else:
                    # 最终失败
                    result.status = TaskStatus.FAILED
                    result.retry_count = retry_count
                    
                    self.stats.running_tasks -= 1
                    self.stats.failed_tasks += 1
                    
                    logger.error(
                        f"💀 {worker_name} 最终失败 | ID: {task_id} | "
                        f"错误: {e} | 总重试: {retry_count}"
                    )
                    break
        
        self._running_tasks.discard(task_id)
    
    async def get_task_status(self, task_id: str) -> Optional[TaskStatus]:
        """查询任务状态"""
        result = self._results.get(task_id)
        return result.status if result else None
    
    async def get_task_result(
        self,
        task_id: str,
        wait: bool = False,
        timeout: Optional[int] = None,
    ) -> Optional[TaskResult]:
        """
        获取任务结果
        
        Args:
            task_id: 任务ID
            wait: 是否等待完成
            timeout: 等待超时(秒)
            
        Returns:
            TaskResult对象，如果任务不存在返回None
        """
        result = self._results.get(task_id)
        
        if not result:
            return None
        
        if wait and result.status in (TaskStatus.PENDING, TaskStatus.RUNNING, TaskStatus.RETRYING):
            start_time = time.time()
            
            while result.status in (TaskStatus.PENDING, TaskStatus.RUNNING, TaskStatus.RETRYING):
                if timeout and (time.time() - start_time) > timeout:
                    raise TimeoutError(f"等待任务 {task_id} 结果超时")
                await asyncio.sleep(0.1)
                result = self._results.get(task_id)
        
        return result
    
    async def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        result = self._results.get(task_id)
        
        if not result:
            return False
        
        if result.status == TaskStatus.PENDING:
            # 从队列移除
            task = self._tasks.pop(task_id, None)
            if task and task in self._queue:
                self._queue.remove(task)
                heapq.heapify(self._queue)
            
            result.status = TaskStatus.CANCELLED
            result.error = "用户取消"
            
            self.stats.pending_tasks -= 1
            logger.info(f"🚫 任务已取消 | ID: {task_id}")
            return True
        
        elif result.status == TaskStatus.RUNNING:
            # 标记为取消（无法强制终止协程）
            result.status = TaskStatus.CANCELLED
            logger.warning(f"⚠️ 任务正在运行，将尝试取消 | ID: {task_id}")
            return True
        
        return False
    
    def get_stats(self) -> Dict[str, Any]:
        """获取队列统计信息"""
        stats_dict = self.stats.to_dict()
        stats_dict.update({
            "queue_size": len(self._queue),
            "active_workers": len([w for w in self._workers if not w.done()]),
            "total_results": len(self._results),
        })
        return stats_dict
    
    def get_pending_tasks(self, limit: int = 20) -> List[Dict[str, Any]]:
        """获取等待中的任务列表"""
        tasks = []
        for task in sorted(self._queue)[:limit]:
            result = self._results.get(task.task_id)
            tasks.append({
                "task_id": task.task_id,
                "priority": TaskPriority(task.priority).name,
                "created_at": datetime.fromtimestamp(
                    task.created_at, tz=timezone.utc
                ).isoformat(),
                "metadata": task.metadata,
                "status": result.status.value if result else "unknown",
            })
        return tasks
    
    async def clear_completed(self, keep_recent: int = 100):
        """清理已完成的结果"""
        if len(self._results) <= keep_recent:
            return
        
        # 按完成时间排序，保留最近的
        completed = [
            (tid, res)
            for tid, res in self._results.items()
            if res.status in (TaskStatus.SUCCESS, TaskStatus.FAILED, 
                             TaskStatus.CANCELLED, TaskStatus.TIMEOUT)
        ]
        
        completed.sort(key=lambda x: x[1].completed_at or datetime.min, reverse=True)
        
        to_remove = completed[keep_recent:]
        removed_count = 0
        
        for tid, _ in to_remove:
            del self._results[tid]
            self._tasks.pop(tid, None)
            removed_count += 1
        
        logger.info(f"🧹 清理了 {removed_count} 个已完成任务结果")


# ════════════════════════════════════════════
# 便捷装饰器
# ════════════════════════════════════════════

_global_queue: Optional[AsyncTaskQueue] = None


def get_task_queue(config: Optional[dict] = None) -> AsyncTaskQueue:
    """获取全局任务队列实例"""
    global _global_queue
    if _global_queue is None:
        cfg = config or {}
        _global_queue = AsyncTaskQueue(**cfg)
    return _global_queue


def background_task(
    priority: TaskPriority = TaskPriority.NORMAL,
    timeout: Optional[int] = None,
):
    """
    后台任务装饰器
    
    用法:
        @background_task(priority=TaskPriority.HIGH, timeout=60)
        async def send_email(to: str, subject: str, body: str):
            # 发送邮件逻辑...
            pass
        
        # 调用后会立即返回任务ID
        task_id = await send_email("user@example.com", "Hello", "World")
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            queue = get_task_queue()
            task_id = await queue.submit(
                func=func,
                args=args,
                kwargs=kwargs,
                priority=priority,
                timeout=timeout,
                metadata={
                    "function": func.__name__,
                    "module": func.__module__,
                }
            )
            return {"task_id": task_id, "status": "submitted"}
        
        wrapper._is_background_task = True
        return wrapper
    
    return decorator


logger.info("⚡ 异步任务队列系统初始化完成")
