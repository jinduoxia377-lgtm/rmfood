"""
AI 推理结果存储后端 — 可插拔存储抽象

院士级修复[Phase 4-A]: 将推理结果存储从内存迁移到 Redis，
支持多实例部署时任务状态共享。

架构：
- InferenceResultStore (ABC) — 存储后端抽象接口
- MemoryResultStore — 内存实现（开发/测试用，单实例）
- RedisResultStore — Redis 实现（生产用，多实例共享）
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional

logger = logging.getLogger("rmfood.ai.inference_store")


# ── 数据模型（与 inference_queue.py 保持一致）─────────────────────────

class InferenceTaskStatus(str, Enum):
    """推理任务状态（inference_store 专用）"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


@dataclass
class InferenceResult:
    """AI 推理任务结果（可序列化）"""

    task_id: str
    status: InferenceTaskStatus
    result: Optional[Any] = None
    error: Optional[str] = None
    duration_ms: float = 0.0
    created_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None
    submitted_by: Optional[str] = None
    org_id: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "status": self.status.value,
            "result": self.result,
            "error": self.error,
            "duration_ms": round(self.duration_ms, 2),
            "created_at": datetime.fromtimestamp(self.created_at, tz=timezone.utc).isoformat(),
            "completed_at": (
                datetime.fromtimestamp(self.completed_at, tz=timezone.utc).isoformat()
                if self.completed_at else None
            ),
            "submitted_by": self.submitted_by,
            "org_id": self.org_id,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "InferenceResult":
        return cls(
            task_id=data["task_id"],
            status=InferenceTaskStatus(data["status"]),
            result=data.get("result"),
            error=data.get("error"),
            duration_ms=data.get("duration_ms", 0.0),
            created_at=data.get("created_at_ts", time.time()),
            completed_at=data.get("completed_at_ts"),
            submitted_by=data.get("submitted_by"),
            org_id=data.get("org_id"),
        )


# ── 存储后端抽象 ─────────────────────────────────────────────────────────

class InferenceResultStore(ABC):
    """
    推理结果存储后端抽象接口

    实现多实例部署时任务状态的共享存储。
    不同实例可通过同一存储后端访问任务结果。

    方法语义：
    - put(result): 写入/更新任务结果
    - get(task_id): 读取任务结果（None 表示不存在或已过期）
    - update_status(task_id, status, **kwargs): 原子更新任务状态
    - delete(task_id): 删除任务结果
    - cleanup_expired(): 清理过期结果，返回清理数量
    - get_stats(): 获取存储统计信息
    """

    @abstractmethod
    async def put(self, result: InferenceResult) -> None:
        """写入任务结果"""

    @abstractmethod
    async def get(self, task_id: str) -> Optional[InferenceResult]:
        """读取任务结果"""

    @abstractmethod
    async def update_status(
        self,
        task_id: str,
        status: InferenceTaskStatus,
        **kwargs,
    ) -> None:
        """原子更新任务状态和相关字段"""

    @abstractmethod
    async def delete(self, task_id: str) -> None:
        """删除任务结果"""

    @abstractmethod
    async def cleanup_expired(self) -> int:
        """清理过期结果，返回清理数量"""

    @abstractmethod
    async def get_stats(self) -> Dict[str, Any]:
        """获取存储统计信息"""


# ── 内存实现（开发/测试用）───────────────────────────────────────────────

class MemoryResultStore(InferenceResultStore):
    """
    内存推理结果存储（单实例开发用）

    与 Phase 2 原有的 ResultStore 功能一致，但实现了
    InferenceResultStore 抽象接口，可与 Redis 版互换。
    """

    def __init__(self, ttl_seconds: int = 3600):
        self._results: Dict[str, InferenceResult] = {}
        self._ttl: Dict[str, float] = {}
        self._ttl_seconds = ttl_seconds

    async def put(self, result: InferenceResult) -> None:
        self._results[result.task_id] = result
        self._ttl[result.task_id] = time.time() + self._ttl_seconds

    async def get(self, task_id: str) -> Optional[InferenceResult]:
        if task_id in self._results:
            if time.time() < self._ttl.get(task_id, 0):
                return self._results[task_id]
            self._results.pop(task_id, None)
            self._ttl.pop(task_id, None)
        return None

    async def update_status(
        self,
        task_id: str,
        status: InferenceTaskStatus,
        **kwargs,
    ) -> None:
        result = self._results.get(task_id)
        if result:
            result.status = status
            for k, v in kwargs.items():
                setattr(result, k, v)

    async def delete(self, task_id: str) -> None:
        self._results.pop(task_id, None)
        self._ttl.pop(task_id, None)

    async def cleanup_expired(self) -> int:
        now = time.time()
        expired = [tid for tid, exp in self._ttl.items() if now > exp]
        for tid in expired:
            self._results.pop(tid, None)
            self._ttl.pop(tid, None)
        if expired:
            logger.debug("[MemoryStore] 清理过期结果 %d 条", len(expired))
        return len(expired)

    async def get_stats(self) -> Dict[str, Any]:
        now = time.time()
        active = sum(1 for exp in self._ttl.values() if now < exp)
        return {
            "backend": "memory",
            "active_results": active,
            "total_stored": len(self._results),
            "ttl_seconds": self._ttl_seconds,
        }


# ── Redis 实现（生产用，多实例共享）────────────────────────────────────

class RedisResultStore(InferenceResultStore):
    """
    Redis 推理结果存储（生产用，多实例共享）

    存储结构：
    - Key: `rmfood:inference:{task_id}` — 单个任务结果（Hash 或 String）
    - Key: `rmfood:inference:{task_id}:ttl` — TTL 管理
    - 使用 Redis Hash 存储任务字段，TTL 自动过期

    序列化格式（Redis Hash）：
    - task_id, status, result_json, error, duration_ms
    - created_at_ts, completed_at_ts, submitted_by, org_id

    TTL 管理：
    - 每次 put/update 时设置 TTL（默认 1 小时）
    - Redis 自动清理过期 Key，无需手动 cleanup
    """

    KEY_PREFIX = "rmfood:inference"
    DEFAULT_TTL = 3600  # 1 小时

    def __init__(self, redis_url: str, ttl_seconds: int = DEFAULT_TTL):
        """
        初始化 Redis 结果存储

        Args:
            redis_url: Redis 连接 URL（如 redis://localhost:6379/0）
            ttl_seconds: 结果 TTL（秒），默认 3600
        """
        self._redis_url = redis_url
        self._ttl = ttl_seconds
        self._redis = None  # 延迟初始化

    async def _get_redis(self):
        """获取 Redis 连接（延迟初始化）"""
        if self._redis is None:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(
                self._redis_url,
                decode_responses=True,  # 自动解码为 str（JSON 序列化自己管理）
                socket_timeout=5.0,
                socket_connect_timeout=5.0,
                retry_on_timeout=True,
            )
        return self._redis

    def _key(self, task_id: str) -> str:
        return f"{self.KEY_PREFIX}:{task_id}"

    async def put(self, result: InferenceResult) -> None:
        redis = await self._get_redis()
        key = self._key(result.task_id)
        data = result.to_dict()
        # 将 result/error 等复杂对象 JSON 序列化
        data["result_json"] = json.dumps(data.pop("result"), ensure_ascii=False)
        data["created_at_ts"] = result.created_at
        data["completed_at_ts"] = result.completed_at
        # 移除 ISO 格式字段（使用 timestamp 存储）
        data.pop("created_at", None)
        data.pop("completed_at", None)

        # 使用 Redis Pipeline 原子写入 Hash + 设置 TTL
        async with redis.pipeline() as pipe:
            await pipe.delete(key)  # 先清理旧数据
            await pipe.hset(key, mapping=data)
            await pipe.expire(key, self._ttl)
            await pipe.execute()
        logger.debug("[RedisStore] put: %s", task_id)

    async def get(self, task_id: str) -> Optional[InferenceResult]:
        redis = await self._get_redis()
        key = self._key(task_id)
        data = await redis.hgetall(key)
        if not data:
            return None
        # 反序列化 result_json
        if "result_json" in data:
            try:
                data["result"] = json.loads(data["result_json"])
            except (json.JSONDecodeError, TypeError):
                data["result"] = data.get("result_json")
        # 恢复 timestamp 字段
        data["created_at"] = float(data.get("created_at_ts", time.time()))
        if data.get("completed_at_ts"):
            data["completed_at"] = float(data["completed_at_ts"])
        return InferenceResult.from_dict(data)

    async def update_status(
        self,
        task_id: str,
        status: InferenceTaskStatus,
        **kwargs,
    ) -> None:
        redis = await self._get_redis()
        key = self._key(task_id)
        # 检查 Key 是否存在
        exists = await redis.exists(key)
        if not exists:
            logger.warning("[RedisStore] update_status: task %s 不存在", task_id)
            return
        # 构建更新字段
        fields = {"status": status.value}
        for k, v in kwargs.items():
            if k in ("result", "error", "duration_ms", "completed_at"):
                fields[k] = str(v) if v is not None else ""
        # 如果 result 是复杂对象，JSON 序列化
        if "result" in kwargs and kwargs["result"] is not None:
            fields["result_json"] = json.dumps(kwargs["result"], ensure_ascii=False)
            fields.pop("result", None)

        async with redis.pipeline() as pipe:
            if fields:
                await pipe.hset(key, mapping=fields)
            await pipe.expire(key, self._ttl)  # 刷新 TTL
            await pipe.execute()
        logger.debug("[RedisStore] update_status: %s → %s", task_id, status.value)

    async def delete(self, task_id: str) -> None:
        redis = await self._get_redis()
        key = self._key(task_id)
        await redis.delete(key)
        logger.debug("[RedisStore] delete: %s", task_id)

    async def cleanup_expired(self) -> int:
        """
        Redis 自动 TTL 过期，无需手动清理
        返回 0（Redis 自动管理）
        """
        return 0

    async def get_stats(self) -> Dict[str, Any]:
        redis = await self._get_redis()
        # 使用 SCAN 统计 key 数量（生产环境可用，但大数量时注意性能）
        count = 0
        cursor = 0
        pattern = f"{self.KEY_PREFIX}:*"
        while True:
            cursor, keys = await redis.scan(cursor, match=pattern, count=100)
            count += len(keys)
            if cursor == 0:
                break
        return {
            "backend": "redis",
            "redis_url": self._redis_url,
            "active_results": count,
            "ttl_seconds": self._ttl,
        }

    async def close(self) -> None:
        """关闭 Redis 连接"""
        if self._redis is not None:
            await self._redis.close()
            self._redis = None


# ── 存储工厂 ─────────────────────────────────────────────────────────────

def create_result_store(
    backend: str = "memory",
    redis_url: Optional[str] = None,
    ttl_seconds: int = 3600,
) -> InferenceResultStore:
    """
    创建推理结果存储实例

    Args:
        backend: "memory" 或 "redis"
        redis_url: Redis 连接 URL（backend="redis" 时必填）
        ttl_seconds: 结果 TTL（秒）

    Returns:
        InferenceResultStore 实例
    """
    if backend == "redis":
        if not redis_url:
            raise ValueError(
                "Redis 存储后端需要 redis_url 参数。"
                "请设置 config.settings.redis_url 或 REDIS_URL 环境变量。"
            )
        logger.info("[InferenceStore] 使用 Redis 存储后端: %s", redis_url)
        return RedisResultStore(redis_url=redis_url, ttl_seconds=ttl_seconds)
    else:
        logger.info("[InferenceStore] 使用内存存储后端（单实例模式）")
        return MemoryResultStore(ttl_seconds=ttl_seconds)
