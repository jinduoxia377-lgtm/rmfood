"""RMFOOD LLM Provider工厂与Fallback链

提供智能的Provider管理：
- 根据配置选择主Provider
- Fallback链：主Provider失败→自动切换备用Provider
- 负载均衡：多个同类型Provider间分配请求
- 健康检查：定期探测Provider可用性
- 用量统计：Token消耗追踪（用于计费）
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from .llm_provider import (
    LLMProvider,
    OpenAIProvider,
    AnthropicProvider,
    LocalLlamaProvider,
    ProviderConfig,
)

logger = logging.getLogger(__name__)


class TaskType(str, Enum):
    """任务类型枚举"""
    GENERATE = "generate"
    OPTIMIZE = "optimize"
    RECOMMEND = "recommend"
    CHAT = "chat"


@dataclass
class ProviderHealthStatus:
    """Provider健康状态"""
    provider_name: str
    is_healthy: bool = True
    last_check_time: float = 0.0
    consecutive_failures: int = 0
    avg_latency_ms: float = 0.0
    total_requests: int = 0
    total_tokens: int = 0


@dataclass
class FallbackConfig:
    """Fallback配置"""
    enable_fallback: bool = True
    max_fallback_attempts: int = 3
    health_check_interval: int = 300  # 秒
    auto_recovery_after: int = 5      # 连续失败N次后标记为不健康


class LLMProviderFactory:
    """
    Provider管理器
    
    功能：
    - 管理多个Provider实例
    - 智能路由请求到最佳Provider
    - 自动故障转移
    - 健康监控
    - 用量统计
    """

    def __init__(
        self,
        providers_config: Optional[Dict[str, Dict[str, Any]]] = None,
        fallback_config: Optional[FallbackConfig] = None,
    ):
        self.providers: Dict[str, LLMProvider] = {}
        self.provider_order: List[str] = []  # Fallback顺序
        self.health_status: Dict[str, ProviderHealthStatus] = {}
        self.fallback_config = fallback_config or FallbackConfig()
        
        # 任务类型到Provider的映射（成本优化策略）
        self.task_routing: Dict[TaskType, str] = {
            TaskType.GENERATE: "",  # 使用主Provider
            TaskType.OPTIMIZE: "",  # 可使用较便宜的模型
            TaskType.RECOMMEND: "",  # 轻量级任务
            TaskType.CHAT: "",
        }
        
        # 负载均衡计数器
        self._load_balance_counters: Dict[str, int] = {}
        
        # 初始化Providers
        if providers_config:
            self._initialize_providers(providers_config)
            
        # 启动健康检查任务
        self._health_check_task: Optional[asyncio.Task] = None

    def _initialize_providers(self, config: Dict[str, Dict[str, Any]]):
        """从配置初始化所有Providers"""
        for name, provider_cfg in config.items():
            try:
                provider_type = provider_cfg.get("type", "openai").lower()
                pconfig = ProviderConfig(
                    api_key=provider_cfg.get("api_key", ""),
                    base_url=provider_cfg.get("base_url", ""),
                    model=provider_cfg.get("model", ""),
                    max_tokens=provider_cfg.get("max_tokens", 4096),
                    temperature=provider_cfg.get("temperature", 0.7),
                    timeout=provider_cfg.get("timeout", 60.0),
                    max_retries=provider_cfg.get("max_retries", 3),
                )
                
                if provider_type == "openai":
                    provider = OpenAIProvider(pconfig)
                elif provider_type in ("deepseek", "zhipu", "qwen", "custom"):
                    logger.info(f"OpenAI兼容Provider: {provider_type}")
                    provider = OpenAIProvider(pconfig)
                elif provider_type == "anthropic":
                    provider = AnthropicProvider(pconfig)
                elif provider_type == "ollama" or provider_type == "local":
                    provider = LocalLlamaProvider(pconfig)
                else:
                    logger.warning(f"未知的Provider类型: {provider_type}")
                    continue
                    
                self.providers[name] = provider
                self.provider_order.append(name)
                self.health_status[name] = ProviderHealthStatus(
                    provider_name=name
                )
                self._load_balance_counters[name] = 0
                
                logger.info(f"✅ 初始化Provider成功: {name} ({provider_type})")
                
            except Exception as e:
                logger.error(f"❌ 初始化Provider失败 {name}: {e}")

    async def get_provider(self, task_type: TaskType = TaskType.GENERATE) -> LLMProvider:
        """
        根据任务类型获取最佳Provider
        
        Args:
            task_type: 任务类型，用于成本优化
            
        Returns:
            可用的LLMProvider实例
        """
        if not self.providers:
            raise RuntimeError("没有可用的LLM Provider")
            
        # 如果为特定任务配置了专用Provider，优先使用
        preferred = self.task_routing.get(task_type)
        if preferred and preferred in self.providers:
            status = self.health_status.get(preferred)
            if status and status.is_healthy:
                return self.providers[preferred]
        
        # 按优先级遍历，找到第一个健康的Provider
        for name in self.provider_order:
            status = self.health_status.get(name)
            if status and status.is_healthy:
                return self.providers[name]
                
        # 所有Provider都不健康，尝试使用第一个（可能已恢复）
        logger.warning("⚠️ 所有Provider都不健康，尝试使用默认Provider")
        return self.providers[self.provider_order[0]]

    async def call_with_fallback(
        self,
        messages: List[Dict[str, str]],
        task_type: TaskType = TaskType.GENERATE,
        **kwargs
    ) -> str:
        """
        带自动重试和Fallback的容错调用
        
        流程：
        1. 尝试主Provider
        2. 失败则切换到下一个健康的Provider
        3. 记录失败并更新健康状态
        
        Args:
            messages: 对话消息
            task_type: 任务类型
            kwargs: 传递给generate的参数
            
        Returns:
            生成结果文本
            
        Raises:
            RuntimeError: 所有Provider都失败时抛出
        """
        if not self.fallback_config.enable_fallback:
            provider = await self.get_provider(task_type)
            return await provider.generate(messages, **kwargs)
        
        last_error = None
        attempted_providers = []
        
        for attempt in range(min(self.fallback_config.max_fallback_attempts, len(self.provider_order))):
            # 选择Provider（轮询负载均衡）
            provider_name = self._select_provider_for_attempt(attempt, task_type)
            
            if provider_name in attempted_providers:
                continue
                
            attempted_providers.append(provider_name)
            provider = self.providers[provider_name]
            
            try:
                logger.info(f"🔄 尝试Provider: {provider_name} (第{attempt+1}次)")
                
                result = await provider.generate(messages, **kwargs)
                
                # 成功，更新统计
                self._record_success(provider_name)
                
                return result
                
            except Exception as e:
                last_error = e
                logger.warning(f"⚠️ Provider {provider_name} 调用失败: {e}")
                
                # 更新健康状态
                self._record_failure(provider_name)
                
                # 如果还有更多Provider可选，继续尝试
                if attempt < len(self.provider_order) - 1:
                    await asyncio.sleep(0.5)  # 短暂等待后重试
        
        # 所有Provider都失败了
        error_msg = (
            f"所有Provider调用失败 (已尝试{len(attempted_providers)}个)。"
            f"最后一个错误: {last_error}"
        )
        logger.error(f"❌ {error_msg}")
        raise RuntimeError(error_msg) from last_error

    async def stream_with_fallback(
        self,
        messages: List[Dict[str, str]],
        task_type: TaskType = TaskType.GENERATE,
        **kwargs
    ):
        """
        流式调用的Fallback版本
        
        注意：流式调用不支持中途切换Provider，
        只在开始时选择一个可用的Provider
        """
        provider = await self.get_provider(task_type)
        provider_name = provider.get_provider_name()
        
        try:
            async for chunk in provider.stream_generate(messages, **kwargs):
                yield chunk
            self._record_success(provider_name)
        except Exception as e:
            self._record_failure(provider_name)
            raise

    def _select_provider_for_attempt(
        self, 
        attempt: int, 
        task_type: TaskType
    ) -> str:
        """为第N次尝试选择Provider"""
        # 首先尝试专用Provider
        preferred = self.task_routing.get(task_type)
        if preferred and attempt == 0 and preferred in self.providers:
            return preferred
            
        # 否则按优先级+负载均衡选择
        healthy_providers = [
            name for name in self.provider_order 
            if self.health_status.get(name, ProviderHealthStatus(name)).is_healthy
        ]
        
        if not healthy_providers:
            return self.provider_order[attempt % len(self.provider_order)]
        
        # 轮询选择
        idx = attempt % len(healthy_providers)
        return healthy_providers[idx]

    def _record_success(self, provider_name: str):
        """记录成功调用"""
        status = self.health_status.get(provider_name)
        if status:
            status.consecutive_failures = 0
            status.is_healthy = True
            status.total_requests += 1
            self._load_balance_counters[provider_name] = \
                self._load_balance_counters.get(provider_name, 0) + 1

    def _record_failure(self, provider_name: str):
        """记录失败调用"""
        status = self.health_status.get(provider_name)
        if status:
            status.consecutive_failures += 1
            status.total_requests += 1
            
            if status.consecutive_failures >= self.fallback_config.auto_recovery_after:
                status.is_healthy = False
                logger.warning(
                    f"⚠️ Provider {provider_name} 已标记为不健康 "
                    f"(连续失败{status.consecutive_failures}次)"
                )

    async def start_health_checks(self):
        """启动定期健康检查"""
        if self._health_check_task and not self._health_check_task.done():
            return
            
        self._health_check_task = asyncio.create_task(
            self._health_check_loop()
        )
        logger.info("🔍 Provider健康检查已启动")

    async def stop_health_checks(self):
        """停止健康检查"""
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
            logger.info("⏹️ Provider健康检查已停止")

    async def _health_check_loop(self):
        """定期健康检查循环"""
        while True:
            try:
                await asyncio.sleep(self.fallback_config.health_check_interval)
                
                for name, provider in self.providers.items():
                    is_healthy = await provider.validate_connection()
                    status = self.health_status.get(name)
                    
                    if status:
                        status.last_check_time = time.time()
                        
                        if is_healthy:
                            # 从不健康恢复
                            if not status.is_healthy:
                                logger.info(
                                    f"✅ Provider {name} 已恢复健康"
                                )
                                status.consecutive_failures = 0
                            status.is_healthy = True
                        else:
                            status.consecutive_failures += 1
                            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"健康检查异常: {e}")

    def get_usage_stats(self) -> Dict[str, Any]:
        """获取用量统计信息"""
        stats = {
            "total_requests": sum(s.total_requests for s in self.health_status.values()),
            "total_tokens": sum(s.total_tokens for s in self.health_status.values()),
            "providers": {},
        }
        
        for name, status in self.health_status.items():
            stats["providers"][name] = {
                "is_healthy": status.is_healthy,
                "total_requests": status.total_requests,
                "total_tokens": status.total_tokens,
                "consecutive_failures": status.consecutive_failures,
                "avg_latency_ms": round(status.avg_latency_ms, 2),
            }
            
        return stats

    def set_task_routing(self, task_type: TaskType, provider_name: str):
        """设置特定任务类型的路由"""
        if provider_name in self.providers:
            self.task_routing[task_type] = provider_name
            logger.info(
                f"📋 任务路由更新: {task_type.value} → {provider_name}"
            )

    async def close(self):
        """关闭所有Provider连接"""
        await self.stop_health_checks()
        
        for provider in self.providers.values():
            await provider.close()
            
        logger.info("🔒 所有Provider连接已关闭")


# 全局单例
_factory_instance: Optional[LLMProviderFactory] = None


def _get_runtime_config() -> Dict[str, Any]:
    """优先读取 llm_service 运行时配置，fallback 到 settings 环境变量"""
    try:
        from ..llm_service import llm_service
        if llm_service and hasattr(llm_service, 'config') and llm_service.config:
            return {
                'api_key': getattr(llm_service.config, 'api_key', None) or '',
                'provider': getattr(llm_service.config, 'provider', None) or '',
                'base_url': getattr(llm_service.config, 'base_url', None) or '',
                'model': getattr(llm_service.config, 'model', None) or '',
                'temperature': getattr(llm_service.config, 'temperature', 0.7),
                'max_tokens': getattr(llm_service.config, 'max_tokens', 4096),
            }
    except Exception:
        pass
    return {}


def get_provider_factory() -> LLMProviderFactory:
    """获取全局Provider工厂实例（懒加载）"""
    global _factory_instance

    if _factory_instance is None:
        from ...core.config import settings

        # 优先使用运行时配置（前端配置面板保存的值）
        runtime = _get_runtime_config()

        # 构建配置
        providers_config = {
            "primary": {
                "type": runtime.get('provider') or getattr(settings, 'llm_provider', 'openai'),
                "api_key": runtime.get('api_key') or getattr(settings, 'openai_api_key', '') or '',
                "base_url": runtime.get('base_url') or getattr(settings, 'openai_base_url', '') or '',
                "model": runtime.get('model') or getattr(settings, 'llm_model', '') or '',
                "max_tokens": runtime.get('max_tokens') or getattr(settings, 'ai_max_tokens', 4096),
                "temperature": runtime.get('temperature') or getattr(settings, 'ai_temperature', 0.7),
            },
        }
        
        # 如果有Ollama配置，添加为备用
        if getattr(settings, 'vllm_endpoint', None):
            providers_config["ollama_backup"] = {
                "type": "ollama",
                "base_url": settings.vllm_endpoint,
                "model": "llama3.1:8b",
            }
        
        _factory_instance = LLMProviderFactory(providers_config)
        logger.info("🏭 全局LLM Provider工厂已初始化")
        
    return _factory_instance


async def cleanup_provider_factory():
    """清理全局工厂实例"""
    global _factory_instance
    
    if _factory_instance:
        await _factory_instance.close()
        _factory_instance = None
