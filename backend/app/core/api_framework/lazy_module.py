"""
懒加载模块框架

提供 LazyModule 类，实现模块级延迟导入。
首次访问属性时才执行 import，避免启动时加载所有服务。

使用方式:
    from .core.api_framework.lazy_module import LazyModule

    # 声明（不触发导入）
    synergy_engine = LazyModule("app.services.formula.synergy_engine")

    # 首次访问时才导入
    result = synergy_engine.analyze_formula(formula)
"""
from __future__ import annotations

import importlib
import logging
from typing import Any

logger = logging.getLogger(__name__)


class LazyModule:
    """
    延迟导入模块 — 首次访问属性时才执行 import

    优势：
    - 启动时不加载重型模块（numpy, scipy, torch 等）
    - 减少启动时间和内存占用
    - 模块加载失败时延迟到实际使用时报错
    """

    def __init__(self, module_path: str, fallback: Any = None):
        """
        Args:
            module_path: Python 模块路径（如 "app.services.formula.synergy_engine"）
            fallback: 模块不可用时的回退值（默认 None，访问时抛异常）
        """
        self._module_path = module_path
        self._module = None
        self._loaded = False
        self._fallback = fallback

    def _load(self) -> None:
        """加载模块"""
        if self._loaded:
            return

        try:
            self._module = importlib.import_module(self._module_path)
            self._loaded = True
            logger.debug(f"懒加载模块: {self._module_path}")
        except ImportError as e:
            self._loaded = True
            if self._fallback is not None:
                logger.warning(f"模块不可用 {self._module_path}: {e}，使用回退")
            else:
                logger.error(f"模块加载失败 {self._module_path}: {e}")
                raise

    def __getattr__(self, name: str) -> Any:
        self._load()
        if self._module is not None:
            return getattr(self._module, name)
        if self._fallback is not None:
            return getattr(self._fallback, name, None)
        raise AttributeError(f"模块 {self._module_path} 未加载，属性 {name} 不可用")

    @property
    def is_loaded(self) -> bool:
        """模块是否已加载"""
        return self._loaded and self._module is not None

    @property
    def module_path(self) -> str:
        """模块路径"""
        return self._module_path

    def __repr__(self) -> str:
        status = "loaded" if self.is_loaded else "pending"
        return f"LazyModule({self._module_path!r}, status={status})"


class LazyServiceRegistry:
    """
    懒加载服务注册表

    统一管理所有服务模块的懒加载声明。
    服务按域分组，首次使用时才导入。

    使用方式:
        registry = LazyServiceRegistry()

        # 注册服务（不触发导入）
        registry.register("formula.synergy", "app.services.formula.synergy_engine")

        # 获取服务（首次访问时导入）
        synergy = registry.get("formula.synergy")
        result = synergy.analyze_formula(data)
    """

    def __init__(self):
        self._modules: dict[str, LazyModule] = {}

    def register(self, name: str, module_path: str, fallback: Any = None) -> None:
        """注册一个懒加载模块"""
        self._modules[name] = LazyModule(module_path, fallback=fallback)

    def get(self, name: str) -> LazyModule:
        """获取懒加载模块（首次访问时才导入）"""
        if name not in self._modules:
            raise KeyError(f"未注册的服务: {name}")
        return self._modules[name]

    def is_loaded(self, name: str) -> bool:
        """检查模块是否已加载"""
        if name not in self._modules:
            return False
        return self._modules[name].is_loaded

    def get_status(self) -> dict[str, dict[str, Any]]:
        """获取所有模块的加载状态"""
        return {
            name: {
                "path": mod.module_path,
                "loaded": mod.is_loaded,
            }
            for name, mod in self._modules.items()
        }

    def __len__(self) -> int:
        return len(self._modules)

    def __contains__(self, name: str) -> bool:
        return name in self._modules


# 全局服务注册表
service_registry = LazyServiceRegistry()
