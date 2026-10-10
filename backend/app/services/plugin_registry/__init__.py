"""
插件注册中心

管理核心插件的注册、发现和生命周期。
每个插件实现 PluginInterface 协议，通过装饰器自动注册。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Protocol, runtime_checkable

logger = logging.getLogger(__name__)


class PluginStatus(str, Enum):
    DISABLED = "disabled"
    ENABLED = "enabled"
    ERROR = "error"


class PluginType(str, Enum):
    """插件类型"""
    FORMULA_ENGINE = "formula_engine"     # 配方优化引擎
    COMPLIANCE = "compliance"             # 合规检查
    DATA_SOURCE = "data_source"           # 数据源
    ANALYSIS = "analysis"                 # 分析引擎
    EXPORTER = "exporter"                 # 报告导出器
    AGENT_TOOL = "agent_tool"             # Agent 工具


@runtime_checkable
class PluginInterface(Protocol):
    """插件协议"""

    @property
    def plugin_id(self) -> str: ...

    @property
    def plugin_name(self) -> str: ...

    @property
    def plugin_type(self) -> PluginType: ...

    @property
    def version(self) -> str: ...

    @property
    def description(self) -> str: ...

    async def initialize(self, config: Dict[str, Any]) -> bool: ...

    async def shutdown(self) -> None: ...

    def health_check(self) -> Dict[str, Any]: ...


@dataclass
class PluginSpec:
    """插件规范（用于注册和发现）"""
    plugin_id: str
    plugin_name: str
    plugin_type: PluginType
    version: str
    description: str
    author: str = "RMFOOD"
    dependencies: List[str] = field(default_factory=list)
    config_schema: Dict[str, Any] = field(default_factory=dict)
    api_endpoints: List[str] = field(default_factory=list)
    capabilities: List[str] = field(default_factory=list)


class PluginRegistry:
    """
    插件注册中心

    提供：
    - 插件注册/注销
    - 按类型查询
    - 依赖解析
    - 健康检查聚合
    """

    def __init__(self):
        self._plugins: Dict[str, PluginSpec] = {}
        self._instances: Dict[str, PluginInterface] = {}
        self._hooks: Dict[str, List[Callable]] = {}

    def register(self, spec: PluginSpec, instance: Optional[PluginInterface] = None) -> None:
        """注册插件"""
        if spec.plugin_id in self._plugins:
            logger.warning("插件已存在，覆盖: %s", spec.plugin_id)
        self._plugins[spec.plugin_id] = spec
        if instance:
            self._instances[spec.plugin_id] = instance
        logger.info("插件注册: %s (%s) v%s", spec.plugin_name, spec.plugin_type.value, spec.version)

    def unregister(self, plugin_id: str) -> bool:
        """注销插件"""
        if plugin_id in self._plugins:
            del self._plugins[plugin_id]
            self._instances.pop(plugin_id, None)
            logger.info("插件已注销: %s", plugin_id)
            return True
        return False

    def get(self, plugin_id: str) -> Optional[PluginSpec]:
        return self._plugins.get(plugin_id)

    def get_instance(self, plugin_id: str) -> Optional[PluginInterface]:
        return self._instances.get(plugin_id)

    def list_by_type(self, plugin_type: PluginType) -> List[PluginSpec]:
        return [p for p in self._plugins.values() if p.plugin_type == plugin_type]

    def list_all(self) -> List[PluginSpec]:
        return list(self._plugins.values())

    def health_check(self) -> Dict[str, Any]:
        """聚合所有插件的健康状态"""
        result = {"total": len(self._plugins), "plugins": {}}
        for pid, spec in self._plugins.items():
            instance = self._instances.get(pid)
            if instance:
                try:
                    health = instance.health_check()
                    result["plugins"][pid] = {**health, "status": "healthy"}
                except Exception as e:
                    result["plugins"][pid] = {"status": "error", "error": str(e)}
            else:
                result["plugins"][pid] = {"status": "no_instance"}
        result["healthy_count"] = sum(
            1 for v in result["plugins"].values() if v.get("status") == "healthy"
        )
        return result

    def resolve_dependencies(self, plugin_id: str) -> List[str]:
        """解析插件依赖链（拓扑排序）"""
        spec = self._plugins.get(plugin_id)
        if not spec:
            return []
        visited = set()
        order = []

        def visit(pid: str):
            if pid in visited:
                return
            visited.add(pid)
            dep_spec = self._plugins.get(pid)
            if dep_spec:
                for dep in dep_spec.dependencies:
                    visit(dep)
            order.append(pid)

        visit(plugin_id)
        return order


# 全局注册中心
_registry: Optional[PluginRegistry] = None


def get_plugin_registry() -> PluginRegistry:
    global _registry
    if _registry is None:
        _registry = PluginRegistry()
    return _registry


def register_plugin(spec: PluginSpec, instance: Optional[PluginInterface] = None) -> None:
    get_plugin_registry().register(spec, instance)


def plugin_register(plugin_type: PluginType):
    """装饰器：自动注册插件"""
    def decorator(cls):
        instance = cls()
        spec = PluginSpec(
            plugin_id=instance.plugin_id,
            plugin_name=instance.plugin_name,
            plugin_type=plugin_type,
            version=getattr(instance, "version", "0.1.0"),
            description=getattr(instance, "description", ""),
        )
        register_plugin(spec, instance)
        return cls
    return decorator


# 延迟触发核心插件注册：放在模块底部，避免 core_plugins 在 __init__ 尚未完成初始化时
# import PluginInterface/PluginType 造成循环导入失败（原先在顶部触发会导致
# "partially initialized module" 错误，使整个 plugin_router 无法加载）。
from . import core_plugins  # noqa: F401,E402
