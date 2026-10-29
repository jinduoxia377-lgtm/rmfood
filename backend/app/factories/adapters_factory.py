"""适配器工厂注册表模块 - 延迟注册实现"""
from __future__ import annotations

import logging
import os
from abc import ABCMeta, abstractmethod
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Type

logger = logging.getLogger(__name__)

@dataclass
class AdapterVariant:
    cls: Type[Any]
    env: str
    description: str
    priority: int = 1
    def matches_env(self, env: str) -> bool:
        return self.env == env

@dataclass
class AdapterRegistration:
    port_name: str
    variants: Dict[str, "AdapterVariant"]
    default_variant_key: str = "prod"
    factory_func: Optional[Callable[[], Any]] = None

class AdapterRegistry(metaclass=ABCMeta):
    _instances: Dict[type, "AdapterRegistry"] = {}

    def __new__(cls):
        if cls not in cls._instances:
            cls._instances[cls] = super(AdapterRegistry, cls).__new__(cls)
            cls._instances[cls]._initialized = False
        return cls._instances[cls]

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._registered: Dict[str, AdapterRegistration] = {}
        self._loaded = False

    @abstractmethod
    def _initialize_default_variants(self) -> None:
        pass

    def register_variant(self, port_name: str, variant_key: str, adapter_cls: Type[Any], description: str, env_override: Optional[str] = None) -> None:
        if port_name not in self._registered:
            self._registered[port_name] = AdapterRegistration(port_name=port_name, variants={})
        env = env_override or ("prod" if variant_key == "prod" else ("test" if variant_key == "test" else "dev"))
        variant = AdapterVariant(cls=adapter_cls, env=env, description=description, priority=variant_key.count("_"))
        self._registered[port_name].variants[variant_key] = variant
        self._registered[port_name].default_variant_key = variant_key

    def set_default(self, port_name: str, variant_key: str) -> None:
        if port_name in self._registered and variant_key in self._registered[port_name].variants:
            self._registered[port_name].default_variant_key = variant_key
        else:
            raise KeyError("Port or variant not registered")

    def get_registered_ports(self) -> List[str]:
        return list(self._registered.keys())

    def get_adapter_instance(self, port_name: str, *args, env: Optional[str] = None, **kwargs) -> Any:
        if port_name not in self._registered:
            raise KeyError(f"Unregistered port: {port_name}")
        registration = self._registered[port_name]
        if env is None:
            env_value = os.getenv("APP_ENV", "production")
            env_map = {"production": "prod", "development": "dev", "testing": "test"}
            variant_key = env_map.get(env_value, registration.default_variant_key)
        elif env_value in ("prod", "test", "dev", "migration"):
            variant_key = env
        else:
            variant_key = registration.default_variant_key
        if variant_key not in registration.variants:
            available = list(registration.variants.keys())
            raise KeyError(f"Variant not in port; options: {available}")
        adapter_cls = registration.variants[variant_key].cls
        try:
            return adapter_cls(*args, **kwargs)
        except Exception as e:
            raise RuntimeError(f"Failed to instantiate adapter: {e}") from e

    def load_all(self) -> None:
        if self._loaded:
            return
        self._initialize_default_variants()
        self._loaded = True
        logger.info(f"Adapter registry loaded: {len(self._registered)} ports registered")

class AppAdapterRegistry(AdapterRegistry):
    def _initialize_default_variants(self) -> None:
        pass

    def register_core_adapters_at_runtime(self) -> None:
        from app.infrastructure.herb_knowledge_adapters import (
            BuiltinHerbKnowledgeAdapter,
            InMemoryHerbKnowledgeAdapter,
            TCMSPHerbKnowledgeAdapter,
        )

        self.register_variant("herb_knowledge", "prod", TCMSPHerbKnowledgeAdapter, "Production: TCMSP database herb knowledge")
        self.register_variant("herb_knowledge", "test", InMemoryHerbKnowledgeAdapter, "Test: in-memory herb knowledge adapter")
        self.register_variant("herb_knowledge", "migration", BuiltinHerbKnowledgeAdapter, "Migration: builtin herb knowledge adapter")
        self.set_default("herb_knowledge", "prod")

        # formula_repository（可选：缺失时跳过）
        try:
            from app.infrastructure.formula_repository import (
                InMemoryFormulaRepository,
                SqlalchemyFormulaRepository,
            )
            self.register_variant("formula_repository", "prod", SqlalchemyFormulaRepository, "Production: SQLAlchemy ORM formula repository")
            self.register_variant("formula_repository", "test", InMemoryFormulaRepository, "Test: in-memory formula repository")
            self.set_default("formula_repository", "prod")
        except ImportError:
            logger.warning("[AdapterRegistry] formula_repository 模块不存在，跳过注册")

        # event_bus（可选）
        try:
            from app.infrastructure.event_bus import LocalEventBus
            self.register_variant("event_publisher", "dev", LocalEventBus, "Development: local event bus")
            self.set_default("event_publisher", "dev")
        except ImportError:
            logger.warning("[AdapterRegistry] event_bus 模块不存在，跳过注册")

        logger.info("Core adapters registered at runtime")

    def load_all(self) -> None:
        if not self._loaded:
            self.register_core_adapters_at_runtime()
            super().load_all()

def get_adapter_registry() -> AppAdapterRegistry:
    return AppAdapterRegistry()

__all__ = [
    "AdapterRegistry",
    "AppAdapterRegistry",
    "get_adapter_registry",
    "AdapterVariant",
    "AdapterRegistration",
]
# ────────────────────────────────────────────────────────────────────────────────
# MicroService Adapters (Phase 3 - Microservices Preparation)
# ────────────────────────────────────────────────────────────────────────────────

class MicroServiceRegistry(AdapterRegistry):
    """
    Extended registry specifically for microservice adapter registration.
    Each microservice can declare its own ports and environment-specific implementations.
    This prepares the codebase for eventual physical separation into independent services.
    """

    def register_microservice_port(
        self,
        service_name: str,
        port_name: str,
        variants: Dict[str, Type[Any]],
        env_mapping: Optional[Dict[str, str]] = None,
        default_variant: str = "prod"
    ) -> None:
        """Register a port for a specific microservice with multiple implementation variants."""

        # Create a unique port identifier including service name
        full_port_key = f"{service_name}.{port_name}"

        for variant_key, adapter_cls in variants.items():
            # Determine environment based on variant or explicit mapping
            if env_mapping and variant_key in env_mapping:
                env = env_mapping[variant_key]
            else:
                env = variant_key  # Use variant key as env

            # Create description including service context
            desc = f"{service_name} - {port_name} variant: {variant_key}"

            # Register using the base class method
            self.register_variant(
                port_name=full_port_key,
                variant_key=variant_key,
                adapter_cls=adapter_cls,
                description=desc,
                env_override=env
            )

        # Set default for this port
        self.set_default(full_port_key, default_variant)

    def get_microservice_adapter(
        self,
        service_name: str,
        port_name: str,
        *args, **kwargs
    ) -> Any:
        """Convenience method to get an adapter for a specific microservice port."""
        full_port_key = f"{service_name}.{port_name}"
        return self.get_adapter_instance(full_port_key, *args, **kwargs)


def create_microservice_registry() -> MicroServiceRegistry:
    """Create and initialize a MicroServiceRegistry with predefined service ports."""
    registry = MicroServiceRegistry()

    # Pre-register common microservice ports

    # 1. AI Conversation Service ports

    # For now, use in-memory adapters as placeholders
    # In microservice mode, these would be replaced by HTTP/gRPC client adapters that call the remote service
    registry.register_microservice_port(
        service_name="ai-conversation-service",
        port_name="chat",
        variants={
            "prod": InMemoryChatAdapter,  # Will be replaced by RemoteChatClientAdapter in actual microservice  # noqa: F821
            "dev": LocalChatAdapter,      # In-process adapter during development  # noqa: F821
            "test": MockChatAdapter,      # Test mock  # noqa: F821
        },
        env_mapping={"prod": "production", "dev": "development", "test": "testing"},
        default_variant="dev"
    )

    # 2. Formula Calculation Service ports
    registry.register_microservice_port(
        service_name="formula-calculation-service",
        port_name="optimizer",
        variants={
            "prod": RayClusterOptimizerClient,  # noqa: F821
            "dev": LocalOptimizerAdapter,  # noqa: F821
            "test": MockOptimizerAdapter,  # noqa: F821
        },
        default_variant="dev"
    )

    # 3. Authentication Service ports
    registry.register_microservice_port(
        service_name="authz-service",
        port_name="auth",
        variants={
            "prod": RemoteAuthClient,  # noqa: F821
            "dev": LocalAuthProvider,  # noqa: F821
            "test": MockAuthProvider,  # noqa: F821
        },
        default_variant="dev"
    )

    logger.info("Microservice registry initialized with core service ports")
    return registry


# Global instance (for backward compatibility while transitioning)
_microservice_registry: Optional[MicroServiceRegistry] = None

def get_microservice_registry() -> MicroServiceRegistry:
    """Get or create the global microservice registry singleton."""
    global _microservice_registry
    if _microservice_registry is None:
        _microservice_registry = create_microservice_registry()
    return _microservice_registry
