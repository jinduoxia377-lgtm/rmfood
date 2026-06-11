"""
SafetyAlertSystem - 安全阈值预警系统

实现三级安全预警机制和阈值管理系统:
1. INFO 级别: 距阈值 <20% 时触发
2. WARNING 级别: 超过软阈值但未达硬阈值
3. CRITICAL 级别: 达到硬阈值 -> 阻断操作

功能特性:
- 内置 50+ 种常见成分的 ADI/UL 阈值数据库
- 三级预警机制 (INFO/WARNING/CRITICAL)
- 特殊人群限制规则 (孕妇/儿童/老年人)
- 法规限量标准 (GB 2760/GB 14880/GB 16740)
- 风险评分算法 (0-100)
- RBAC 权限控制 (admin 角色验证)
- 操作审计日志记录
- 完整的 API 接口实现

作者: RMFOOD Team
日期: 2026-05-03
版本: 1.0.0
"""

from .types import (
    AlertLevel,
    ParameterType,
    SafetyAlert,
    SafetyCheckResult,
    SafetyThreshold,
    ThresholdUpdateRecord,
)
from .thresholds import BUILT_IN_THRESHOLDS
from .core import SafetyAlertSystem
from .api import (
    FormulaIngredientInput,
    FormulaSafetyCheckRequest,
    SafetyThresholdUpdate,
    create_safety_alert_router,
    get_safety_system,
    example_usage,
    HAS_PYDANTIC,
)

__all__ = [
    # Enums
    "AlertLevel",
    "ParameterType",
    # Data classes
    "SafetyThreshold",
    "SafetyAlert",
    "SafetyCheckResult",
    "ThresholdUpdateRecord",
    # Threshold data
    "BUILT_IN_THRESHOLDS",
    # Main class
    "SafetyAlertSystem",
    # API models
    "FormulaIngredientInput",
    "FormulaSafetyCheckRequest",
    "SafetyThresholdUpdate",
    # Router and utilities
    "create_safety_alert_router",
    "get_safety_system",
    "example_usage",
    "HAS_PYDANTIC",
]
