"""
租户级 AI 配置 (v1.0)

允许不同租户自定义 AI 模型参数、配方优化权重、合规规则集，
实现"千租千面"的 AI 服务。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class TenantAIConfig:
    """租户 AI 配置"""
    org_id: int
    llm_provider: str = "openai"           # "openai" | "deepseek" | "zhipu" | "custom"
    llm_model: str = "gpt-4"               # 默认模型
    temperature: float = 0.3               # 温度参数
    top_p: float = 0.9                     # Top-p 参数
    max_tokens: int = 2000                 # 最大输出长度

    # 配方优化权重
    optimization_weights: Dict[str, float] = field(default_factory=lambda: {
        "cost": 0.3,        # 成本权重
        "efficacy": 0.4,    # 功效权重
        "safety": 0.3,      # 安全权重
    })

    # 合规规则集覆盖
    compliance_overrides: Dict[str, Any] = field(default_factory=dict)
    custom_prohibited_combos: List[List[str]] = field(default_factory=list)
    custom_max_dosage: Dict[str, float] = field(default_factory=dict)

    # 求解器偏好
    solver_preferences: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "org_id": self.org_id,
            "llm_provider": self.llm_provider,
            "llm_model": self.llm_model,
            "temperature": self.temperature,
            "top_p": self.top_p,
            "max_tokens": self.max_tokens,
            "optimization_weights": self.optimization_weights,
            "compliance_overrides": self.compliance_overrides,
            "custom_prohibited_combos": self.custom_prohibited_combos,
            "custom_max_dosage": self.custom_max_dosage,
            "solver_preferences": self.solver_preferences,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "TenantAIConfig":
        return cls(
            org_id=data.get("org_id", 0),
            llm_provider=data.get("llm_provider", "openai"),
            llm_model=data.get("llm_model", "gpt-4"),
            temperature=data.get("temperature", 0.3),
            top_p=data.get("top_p", 0.9),
            max_tokens=data.get("max_tokens", 2000),
            optimization_weights=data.get("optimization_weights", {
                "cost": 0.3, "efficacy": 0.4, "safety": 0.3,
            }),
            compliance_overrides=data.get("compliance_overrides", {}),
            custom_prohibited_combos=data.get("custom_prohibited_combos", []),
            custom_max_dosage=data.get("custom_max_dosage", {}),
            solver_preferences=data.get("solver_preferences", {}),
        )


class TenantAIConfigManager:
    """
    租户级 AI 配置管理器

    用法：
        manager = TenantAIConfigManager()
        config = manager.get_config(org_id)
        manager.update_config(org_id, {"temperature": 0.5})
    """

    def __init__(self):
        self._configs: Dict[int, TenantAIConfig] = {}

    def get_config(self, org_id: int) -> TenantAIConfig:
        """获取租户 AI 配置"""
        return self._configs.get(org_id, TenantAIConfig(org_id=org_id))

    def update_config(
        self,
        org_id: int,
        updates: Dict[str, Any],
    ) -> TenantAIConfig:
        """
        更新租户 AI 配置

        支持的部分更新字段：
        - llm_provider: 模型供应商
        - llm_model: 模型名称
        - temperature: 温度参数
        - top_p: Top-p 参数
        - max_tokens: 最大输出长度
        - optimization_weights: 优化权重
        - compliance_overrides: 合规规则覆盖
        - custom_prohibited_combos: 自定义禁忌搭配
        - custom_max_dosage: 自定义最大用量
        - solver_preferences: 求解器偏好
        """
        config = self._configs.get(org_id)
        if config is None:
            config = TenantAIConfig(org_id=org_id)
            self._configs[org_id] = config

        # 部分更新
        for key, value in updates.items():
            if hasattr(config, key):
                setattr(config, key, value)
                logger.info(
                    "[TenantAIConfig] 更新组织 %d 的 %s = %s",
                    org_id, key, value,
                )

        return config

    def reset_config(self, org_id: int) -> TenantAIConfig:
        """重置租户配置为默认值"""
        self._configs[org_id] = TenantAIConfig(org_id=org_id)
        logger.info("[TenantAIConfig] 重置组织 %d 的配置为默认值", org_id)
        return self._configs[org_id]

    def get_org_ids(self) -> List[int]:
        """获取所有已配置的组织 ID"""
        return list(self._configs.keys())

    def has_custom_config(self, org_id: int) -> bool:
        """检查租户是否有自定义配置"""
        return org_id in self._configs


# ── 全局单例 ───────────────────────────────────────────────────────────

_manager: Optional[TenantAIConfigManager] = None


def get_tenant_ai_config_manager() -> TenantAIConfigManager:
    """获取全局租户 AI 配置管理器单例"""
    global _manager
    if _manager is None:
        _manager = TenantAIConfigManager()
    return _manager
