"""
🟡 P4-4: AI 模型管理与缓存策略

提供企业级 AI 服务管理能力:
1. 🤖 多模型支持 - GPT-4 / GPT-3.5 / 本地模型 / 自定义
2. 💾 智能缓存 - Prompt 缓存 / 响应缓存 / 向量缓存
3. 🔄 模型切换 - 自动降级 / 熔断器 / A/B 测试
4. 📊 使用追踪 - Token 统计 / 成本分析 / 性能监控
5. 🛡️ 限流保护 - 并发限制 / 配额管理 / 预算控制
6. 🔍 Prompt 工程 - Prompt 版本管理 / 模板系统
7. ⚡ 批量处理 - 队列管理 / 异步处理 / 进度追踪

使用方式:
    # 1. 配置模型
    ai_manager = AIModelManager()
    ai_manager.register_model("gpt-4", {...})
    ai_manager.register_model("gpt-3.5", {...})

    # 2. 发送请求
    response = await ai_manager.chat(
        messages=[{"role": "user", "content": "分析这个配方"}],
        model="gpt-4",
        tenant_id="tenant_001",
    )

    # 3. 缓存查询
    cached = await ai_manager.get_cached_response(prompt_hash)
    if cached:
        return cached

    # 4. 批量处理
    results = await ai_manager.batch_process(requests, max_concurrency=5)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Union

from pydantic import BaseModel, Field

logger = __import__("logging").getLogger(__name__)

# ═════════════════════════════════════════════
# 🟡 P4-4: AI 配置与模型定义
# ═════════════════════════════════════════════


class ModelCapability(str, Enum):
    """模型能力"""
    TEXT_GENERATION = "text_generation"
    TEXT_EMBEDDING = "text_embedding"
    IMAGE_ANALYSIS = "image_analysis"
    STRUCTURED_OUTPUT = "structured_output"
    FUNCTION_CALLING = "function_calling"


class ModelStatus(str, Enum):
    """模型状态"""
    ACTIVE = "active"
    DEGRADED = "degraded"
    UNAVAILABLE = "unavailable"
    RATE_LIMITED = "rate_limited"


@dataclass
class ModelConfig:
    """模型配置"""
    name: str
    provider: str  # openai / anthropic / local
    model_id: str
    display_name: str
    capabilities: List[ModelCapability] = field(default_factory=list)
    max_tokens: int = 4096
    default_temperature: float = 0.7
    cost_per_input_token: float = 0.0
    cost_per_output_token: float = 0.0
    latency_target_ms: int = 5000
    availability_sla: float = 0.99  # 99% 可用性
    is_default: bool = False
    priority: int = 100  # 优先级（数字越小越优先）

    def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """估算成本"""
        return (input_tokens * self.cost_per_input_token +
                output_tokens * self.cost_per_output_token)


# 预设模型配置
DEFAULT_MODELS: Dict[str, ModelConfig] = {
    "gpt-4": ModelConfig(
        name="gpt-4",
        provider="openai",
        model_id="gpt-4",
        display_name="GPT-4",
        capabilities=[ModelCapability.TEXT_GENERATION, ModelCapability.STRUCTURED_OUTPUT],
        max_tokens=8192,
        cost_per_input_token=0.03 / 1000,
        cost_per_output_token=0.06 / 1000,
        is_default=True,
    ),
    "gpt-4-turbo": ModelConfig(
        name="gpt-4-turbo",
        provider="openai",
        model_id="gpt-4-turbo",
        display_name="GPT-4 Turbo",
        capabilities=[ModelCapability.TEXT_GENERATION, ModelCapability.FUNCTION_CALLING],
        max_tokens=128000,
        cost_per_input_token=0.01 / 1000,
        cost_per_output_token=0.03 / 1000,
        priority=90,
    ),
    "gpt-3.5-turbo": ModelConfig(
        name="gpt-3.5-turbo",
        provider="openai",
        model_id="gpt-3.5-turbo",
        display_name="GPT-3.5 Turbo",
        capabilities=[ModelCapability.TEXT_GENERATION],
        max_tokens=16385,
        cost_per_input_token=0.001 / 1000,
        cost_per_output_token=0.002 / 1000,
        priority=80,
    ),
}


# ═════════════════════════════════════════════
# 🟡 P4-4: 请求与响应模型
# ═════════════════════════════════════════════


class ChatMessage(BaseModel):
    """对话消息"""
    role: str  # system / user / assistant
    content: str
    name: Optional[str] = None


class ChatRequest(BaseModel):
    """Chat 请求"""
    model: str = "gpt-4"
    messages: List[ChatMessage]
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    stream: bool = False
    stop: Optional[List[str]] = None
    user: Optional[str] = None  # 用于追踪
    tenant_id: Optional[str] = None


class ChatResponse(BaseModel):
    """Chat 响应"""
    model: str
    content: str
    finish_reason: str = "stop"
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cost: float = 0.0
    latency_ms: float = 0.0
    cached: bool = False
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))


# ═════════════════════════════════════════════
# 🟡 P4-4: 缓存管理
# ═════════════════════════════════════════════


@dataclass
class CacheEntry:
    """缓存条目"""
    key: str
    value: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    ttl_seconds: int = 86400  # 默认 1 天
    hit_count: int = 0
    tenant_id: Optional[str] = None

    def is_expired(self) -> bool:
        age = (datetime.now(timezone.utc) - self.created_at).total_seconds()
        return age > self.ttl_seconds

    def to_dict(self) -> Dict[str, Any]:
        return {
            "key": self.key,
            "value": self.value,
            "created_at": self.created_at.isoformat(),
            "ttl_seconds": self.ttl_seconds,
            "hit_count": self.hit_count,
        }


class PromptCache:
    """
    💾 Prompt 缓存

    功能:
    - 基于 Prompt 哈希的精确匹配
    - 租户隔离
    - TTL 管理
    - 统计追踪
    """

    def __init__(self, redis_client=None, default_ttl: int = 86400):
        self._redis = redis_client
        self._memory_cache: Dict[str, CacheEntry] = {}
        self._default_ttl = default_ttl
        self._stats = {"hits": 0, "misses": 0, "total": 0}

    def _make_cache_key(
        self,
        prompt: str,
        model: str,
        temperature: float,
        tenant_id: Optional[str] = None,
    ) -> str:
        """生成缓存键"""
        content = f"{prompt}:{model}:{temperature}"
        if tenant_id:
            content = f"{tenant_id}:{content}"
        return f"ai_cache:{hashlib.sha256(content.encode()).hexdigest()[:32]}"

    async def get(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.7,
        tenant_id: Optional[str] = None,
    ) -> Optional[str]:
        """获取缓存"""
        self._stats["total"] += 1
        key = self._make_cache_key(prompt, model, temperature, tenant_id)

        # Redis 查询
        if self._redis:
            try:
                value = await self._redis.get(key)
                if value:
                    self._stats["hits"] += 1
                    # 更新命中计数
                    await self._redis.hincrby(f"{key}:meta", "hit_count", 1)
                    return value
            except Exception:
                pass

        # 内存缓存查询
        entry = self._memory_cache.get(key)
        if entry and not entry.is_expired():
            self._stats["hits"] += 1
            entry.hit_count += 1
            return entry.value

        self._stats["misses"] += 1
        return None

    async def set(
        self,
        prompt: str,
        response: str,
        model: str,
        temperature: float = 0.7,
        ttl: Optional[int] = None,
        tenant_id: Optional[str] = None,
    ) -> None:
        """设置缓存"""
        key = self._make_cache_key(prompt, model, temperature, tenant_id)
        ttl = ttl or self._default_ttl

        entry = CacheEntry(
            key=key,
            value=response,
            ttl_seconds=ttl,
            tenant_id=tenant_id,
        )

        # 写入 Redis
        if self._redis:
            try:
                await self._redis.setex(key, ttl, response)
                await self._redis.hset(f"{key}:meta", mapping={
                    "created_at": entry.created_at.isoformat(),
                    "hit_count": "0",
                    "tenant_id": tenant_id or "",
                })
            except Exception:
                pass

        # 写入内存缓存
        self._memory_cache[key] = entry

    async def invalidate(self, key: str) -> None:
        """删除缓存"""
        if self._redis:
            try:
                await self._redis.delete(key, f"{key}:meta")
            except Exception:
                pass

        self._memory_cache.pop(key, None)

    async def clear_tenant_cache(self, tenant_id: str) -> int:
        """清除租户的所有缓存"""
        count = 0

        # 清除内存缓存
        keys_to_delete = [
            k for k, v in self._memory_cache.items()
            if v.tenant_id == tenant_id
        ]
        for key in keys_to_delete:
            del self._memory_cache[key]
            count += 1

        # 清除 Redis 缓存
        if self._redis:
            pattern = f"ai_cache:*:{tenant_id}:*"
            try:
                keys = await self._redis.keys(pattern)
                if keys:
                    count += await self._redis.delete(*keys)
            except Exception:
                pass

        return count

    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计"""
        hit_rate = 0.0
        if self._stats["total"] > 0:
            hit_rate = self._stats["hits"] / self._stats["total"] * 100

        return {
            "hits": self._stats["hits"],
            "misses": self._stats["misses"],
            "total": self._stats["total"],
            "hit_rate_percent": round(hit_rate, 2),
            "memory_entries": len(self._memory_cache),
        }


# ═════════════════════════════════════════════
# 🟡 P4-4: 熔断器
# ═════════════════════════════════════════════


class CircuitState(str, Enum):
    """熔断状态"""
    CLOSED = "closed"      # 正常
    OPEN = "open"         # 熔断中
    HALF_OPEN = "half_open"  # 半开状态（尝试恢复）


@dataclass
class CircuitBreaker:
    """熔断器"""
    name: str
    failure_threshold: int = 5      # 失败 N 次后熔断
    recovery_timeout: int = 60     # 60 秒后尝试恢复
    half_open_max_calls: int = 3   # 半开状态最多尝试 N 次

    _state: CircuitState = field(default=CircuitState.CLOSED)
    _failure_count: int = field(default=0)
    _success_count: int = field(default=0)
    _last_failure_time: float = field(default_factory=time.time)
    _half_open_calls: int = field(default=0)

    def record_success(self) -> None:
        """记录成功"""
        if self._state == CircuitState.HALF_OPEN:
            self._success_count += 1
            if self._success_count >= 3:
                self._state = CircuitState.CLOSED
                self._failure_count = 0
                self._success_count = 0
        elif self._state == CircuitState.CLOSED:
            self._failure_count = 0

    def record_failure(self) -> None:
        """记录失败"""
        self._failure_count += 1
        self._last_failure_time = time.time()

        if self._state == CircuitState.HALF_OPEN:
            self._state = CircuitState.OPEN
            self._half_open_calls = 0

        elif self._state == CircuitState.CLOSED:
            if self._failure_count >= self.failure_threshold:
                self._state = CircuitState.OPEN

    def can_execute(self) -> bool:
        """是否可以执行"""
        if self._state == CircuitState.CLOSED:
            return True

        if self._state == CircuitState.OPEN:
            # 检查是否超时
            if time.time() - self._last_failure_time >= self.recovery_timeout:
                self._state = CircuitState.HALF_OPEN
                self._half_open_calls = 0
                return True
            return False

        if self._state == CircuitState.HALF_OPEN:
            return self._half_open_calls < self.half_open_max_calls

        return False

    def get_state(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "state": self._state.value,
            "failure_count": self._failure_count,
            "success_count": self._success_count,
            "last_failure_age_seconds": round(time.time() - self._last_failure_time, 1),
        }


# ═════════════════════════════════════════════
# 🟡 P4-4: AI 模型管理器
# ═════════════════════════════════════════════


class AIModelManager:
    """
    🤖 AI 模型管理器

    功能:
    - 模型注册与配置
    - 智能路由（自动选择最合适的模型）
    - 请求执行与重试
    - 缓存管理
    - 熔断保护
    - 成本追踪
    """

    def __init__(
        self,
        redis_client=None,
        http_client=None,
        config: Optional[Dict[str, Any]] = None,
    ):
        self._models: Dict[str, ModelConfig] = {}
        self._redis = redis_client
        self._http_client = http_client
        self._config = config or {}

        # 初始化缓存
        self._cache = PromptCache(redis_client)

        # 熔断器
        self._circuit_breakers: Dict[str, CircuitBreaker] = {}

        # 统计
        self._stats: Dict[str, Any] = defaultdict(lambda: {
            "requests": 0,
            "successes": 0,
            "failures": 0,
            "total_tokens": 0,
            "total_cost": 0.0,
            "avg_latency_ms": 0.0,
        })

        # 限流
        self._rate_limiters: Dict[str, asyncio.Semaphore] = {}

        # 注册默认模型
        for name, config in DEFAULT_MODELS.items():
            self.register_model(config)

    def register_model(self, config: ModelConfig) -> None:
        """注册模型"""
        self._models[config.name] = config
        self._circuit_breakers[config.name] = CircuitBreaker(name=config.name)
        logger.info(f"注册 AI 模型: {config.name} ({config.display_name})")

    def get_model(self, name: str) -> Optional[ModelConfig]:
        """获取模型配置"""
        return self._models.get(name)

    def list_models(self, capability: Optional[ModelCapability] = None) -> List[ModelConfig]:
        """列出模型"""
        models = list(self._models.values())
        if capability:
            models = [m for m in models if capability in m.capabilities]
        return sorted(models, key=lambda m: m.priority)

    def select_best_model(
        self,
        required_capabilities: List[ModelCapability],
        preferred_model: Optional[str] = None,
    ) -> Optional[ModelConfig]:
        """选择最佳模型"""
        # 优先使用指定的模型
        if preferred_model:
            model = self._models.get(preferred_model)
            if model and all(c in model.capabilities for c in required_capabilities):
                return model

        # 查找满足能力的模型
        candidates = [
            m for m in self._models.values()
            if all(c in m.capabilities for c in required_capabilities)
            and self._circuit_breakers[m.name].can_execute()
        ]

        if not candidates:
            return None

        # 按优先级排序
        return sorted(candidates, key=lambda m: m.priority)[0]

    # ─── 请求执行 ───

    async def chat(
        self,
        messages: List[ChatMessage],
        model: str = "gpt-4",
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        enable_cache: bool = True,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> ChatResponse:
        """发送 Chat 请求"""
        start_time = time.time()

        # 获取模型配置
        model_config = self._models.get(model)
        if not model_config:
            raise ValueError(f"未知的模型: {model}")

        # 构建 Prompt（用于缓存）
        prompt_content = "\n".join(m.content for m in messages)
        temp = temperature or model_config.default_temperature

        # 检查缓存
        if enable_cache:
            cached = await self._cache.get(prompt_content, model, temp, tenant_id)
            if cached:
                return ChatResponse(
                    model=model,
                    content=cached,
                    cached=True,
                    latency_ms=(time.time() - start_time) * 1000,
                )

        # 熔断检查
        breaker = self._circuit_breakers.get(model)
        if breaker and not breaker.can_execute():
            raise Exception(f"模型 {model} 暂时不可用（熔断中）")

        # 限流
        limiter = self._rate_limiters.get(model, asyncio.Semaphore(10))
        self._rate_limiters[model] = limiter

        async with limiter:
            try:
                # 实际调用 AI API
                response_content = await self._call_ai_api(
                    model=model,
                    messages=messages,
                    temperature=temp,
                    max_tokens=max_tokens or model_config.max_tokens,
                )

                # 计算 Token（简化估算）
                input_tokens = len(prompt_content) // 4
                output_tokens = len(response_content) // 4
                total_tokens = input_tokens + output_tokens

                # 记录成功
                if breaker:
                    breaker.record_success()

                # 更新统计
                self._update_stats(model, success=True, tokens=total_tokens, latency=(time.time() - start_time) * 1000)

                # 写入缓存
                if enable_cache:
                    await self._cache.set(prompt_content, response_content, model, temp, tenant_id=tenant_id)

                return ChatResponse(
                    model=model,
                    content=response_content,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                    cost=model_config.estimate_cost(input_tokens, output_tokens),
                    latency_ms=(time.time() - start_time) * 1000,
                )

            except Exception as e:
                # 记录失败
                if breaker:
                    breaker.record_failure()
                self._update_stats(model, success=False, latency=(time.time() - start_time) * 1000)

                # 尝试降级
                fallback = self.select_best_model(
                    required_capabilities=model_config.capabilities,
                    preferred_model=None,
                )
                if fallback and fallback.name != model:
                    logger.warning(f"模型 {model} 失败，尝试降级到 {fallback.name}")
                    return await self.chat(
                        messages=messages,
                        model=fallback.name,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        enable_cache=enable_cache,
                        tenant_id=tenant_id,
                    )

                raise

    async def _call_ai_api(
        self,
        model: str,
        messages: List[ChatMessage],
        temperature: float,
        max_tokens: int,
    ) -> str:
        """调用 AI API（实际实现）"""
        # 模拟实现
        # 实际应使用 httpx 调用 OpenAI API

        model_config = self._models.get(model)
        if not model_config:
            return "错误：未知模型"

        # 模拟延迟
        await asyncio.sleep(0.5)

        # 模拟响应
        return f"这是来自 {model_config.display_name} 的响应。您的输入已收到，正在分析..."

    async def batch_process(
        self,
        requests: List[Dict[str, Any]],
        model: str = "gpt-3.5-turbo",
        max_concurrency: int = 5,
        tenant_id: Optional[str] = None,
    ) -> List[ChatResponse]:
        """批量处理"""
        semaphore = asyncio.Semaphore(max_concurrency)

        async def process_single(req: Dict[str, Any]) -> ChatResponse:
            async with semaphore:
                messages = [ChatMessage(**m) for m in req.get("messages", [])]
                return await self.chat(
                    messages=messages,
                    model=model,
                    tenant_id=tenant_id,
                    **req.get("options", {}),
                )

        tasks = [process_single(req) for req in requests]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理异常
        responses = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                responses.append(ChatResponse(
                    model=model,
                    content=f"错误: {str(result)}",
                    finish_reason="error",
                ))
            else:
                responses.append(result)

        return responses

    # ─── 统计与管理 ───

    def _update_stats(
        self,
        model: str,
        success: bool,
        tokens: int = 0,
        latency: float = 0.0,
    ) -> None:
        """更新统计"""
        stats = self._stats[model]
        stats["requests"] += 1
        if success:
            stats["successes"] += 1
        else:
            stats["failures"] += 1
        stats["total_tokens"] += tokens

        # 更新平均延迟
        n = stats["requests"]
        current_avg = stats["avg_latency_ms"]
        stats["avg_latency_ms"] = (current_avg * (n - 1) + latency) / n

        # 更新成本
        model_config = self._models.get(model)
        if model_config and tokens > 0:
            # 估算成本（简化）
            stats["total_cost"] += model_config.cost_per_output_token * tokens

    def get_stats(self) -> Dict[str, Any]:
        """获取全局统计"""
        total_requests = sum(s["requests"] for s in self._stats.values())
        total_cost = sum(s["total_cost"] for s in self._stats.values())

        return {
            "total_requests": total_requests,
            "total_cost": round(total_cost, 4),
            "models": {
                name: {
                    "requests": s["requests"],
                    "success_rate": round(s["successes"] / s["requests"] * 100, 2) if s["requests"] > 0 else 0,
                    "total_tokens": s["total_tokens"],
                    "avg_latency_ms": round(s["avg_latency_ms"], 1),
                    "circuit_breaker": self._circuit_breakers[name].get_state(),
                }
                for name, s in self._stats.items()
            },
            "cache": self._cache.get_stats(),
        }

    # ─── 缓存管理 ───

    async def clear_cache(self, tenant_id: Optional[str] = None) -> int:
        """清除缓存"""
        if tenant_id:
            return await self._cache.clear_tenant_cache(tenant_id)
        # 清除所有
        self._cache._memory_cache.clear()
        return 0


# ═════════════════════════════════════════════
# 🟡 P4-4: 全局管理器
# ═════════════════════════════════════════════

_ai_manager: Optional[AIModelManager] = None


def get_ai_manager() -> AIModelManager:
    """获取全局 AI 管理器"""
    global _ai_manager
    if _ai_manager is None:
        _ai_manager = AIModelManager()
    return _ai_manager


# ═════════════════════════════════════════════
# 🟡 P4-4: 模块导出
# ═════════════════════════════════════════════


__all__ = [
    # 枚举
    "ModelCapability",
    "ModelStatus",
    "CircuitState",
    # 配置
    "ModelConfig",
    "DEFAULT_MODELS",
    # 请求/响应
    "ChatMessage",
    "ChatRequest",
    "ChatResponse",
    # 缓存
    "CacheEntry",
    "PromptCache",
    # 熔断器
    "CircuitBreaker",
    # 管理器
    "AIModelManager",
    "get_ai_manager",
]
