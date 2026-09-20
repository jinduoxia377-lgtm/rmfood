"""
依赖注入容器 - 支持测试隔离 (ADR-029 P2-3)

提供可注入的单例管理，支持测试时重置状态。

@version 1.0.0
@created 2026-09-21
"""
from __future__ import annotations

import logging
from typing import Any, TypeVar, Generic, Type
from weakref import WeakKeyDictionary

logger = logging.getLogger(__name__)

T = TypeVar("T")


class DIContainer:
    """
    依赖注入容器 - 管理单例和可注入服务

    支持:
    - 单例模式：每个类只创建一个实例
    - 测试隔离：提供 reset() 方法重置所有单例
    - 懒加载：按需创建实例

    Usage:
        container = get_di_container()
        engine = container.get_or_create(AcademicianChatEngine)

        # 测试时
        container.reset()
    """

    def __init__(self):
        self._instances: dict[type, Any] = {}
        self._factories: dict[type, Any] = {}

    def register_factory(self, cls: type, factory: callable) -> None:
        """注册工厂函数（用于需要参数的构造函数）"""
        self._factories[cls] = factory
        # 如果已有实例，清除它以使用新工厂
        if cls in self._instances:
            del self._instances[cls]
            logger.info(f"[DI] 清除 {cls.__name__} 的现有实例")

    def get_or_create(self, cls: type[T]) -> T:
        """
        获取或创建单例实例

        Args:
            cls: 要创建的类

        Returns:
            单例实例
        """
        if cls in self._instances:
            return self._instances[cls]  # type: ignore

        # 检查是否有工厂函数
        if cls in self._factories:
            instance = self._factories[cls](self)
        else:
            try:
                instance = cls()
            except TypeError as e:
                # 如果构造函数需要参数，尝试从容器获取依赖
                logger.warning(f"[DI] 无法直接实例化 {cls.__name__}: {e}")
                raise

        self._instances[cls] = instance
        logger.debug(f"[DI] 创建实例: {cls.__name__}")
        return instance

    def get(self, cls: type[T]) -> T | None:
        """获取已注册的实例（不创建）"""
        return self._instances.get(cls)  # type: ignore

    def reset(self) -> None:
        """重置所有单例（用于测试）"""
        count = len(self._instances)
        self._instances.clear()
        logger.info(f"[DI] 容器已重置，清除了 {count} 个实例")

    def has(self, cls: type) -> bool:
        """检查是否已注册实例"""
        return cls in self._instances

    def list_instances(self) -> dict[str, Any]:
        """列出所有已注册的实例（用于调试）"""
        return {cls.__name__: instance for cls, instance in self._instances.items()}


# ── 全局容器单例 ──

_container: DIContainer | None = None


def get_di_container() -> DIContainer:
    """获取全局 DI 容器单例"""
    global _container
    if _container is None:
        _container = DIContainer()
    return _container


def reset_di_container() -> None:
    """重置全局 DI 容器（用于测试）"""
    global _container
    _container = None
    logger.info("[DI] 全局容器已重置")


def get_chat_engine() -> Any:
    """
    获取 ChatEngine 实例（向后兼容）

    替代原来的全局单例模式
    """
    container = get_di_container()
    from ...services.ai.orchestration.chat_engine import AcademicianChatEngine
    return container.get_or_create(AcademicianChatEngine)


__all__ = [
    "DIContainer",
    "get_di_container",
    "reset_di_container",
    "get_chat_engine",
]
