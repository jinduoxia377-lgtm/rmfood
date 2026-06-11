"""
SafetyAlertSystem - 类型定义

包含所有枚举和数据类:
- AlertLevel: 预警级别枚举
- ParameterType: 参数类型枚举
- SafetyThreshold: 安全阈值定义
- SafetyAlert: 安全预警信息
- SafetyCheckResult: 安全检查结果
- ThresholdUpdateRecord: 阈值更新记录
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class AlertLevel(str, Enum):
    """预警级别枚举"""
    INFO = "info"           # 信息级：距阈值 <20%
    WARNING = "warning"     # 警告级：超过软阈值
    CRITICAL = "critical"   # 严重级：达到硬阈值 → 阻断操作


class ParameterType(str, Enum):
    """参数类型枚举"""
    DAILY_INTAKE = "daily_intake"       # 每日摄入量
    SINGLE_DOSE = "single_dose"         # 单次剂量
    CONCENTRATION = "concentration"     # 浓度百分比


@dataclass
class SafetyThreshold:
    """
    安全阈值定义

    Attributes:
        ingredient_name: 成分名称
        parameter: 参数类型 ("daily_intake" | "single_dose" | "concentration")
        unit: 单位 ("mg/day" | "mg/kg_bw" | "%")
        soft_limit: 软阈值（WARNING 触发点）
        hard_limit: 硬阈值（CRITICAL 触发点）
        adi_value: 每日允许摄入量 (Acceptable Daily Intake)
        ul_value: 可耐受最高摄入量 (Upper Limit)
        source: 数据来源（EFSA/WHO/JECFA/GB 标准）
        effective_date: 生效日期
        version: 版本号
        special_groups: 特殊人群限制倍数
            {"pregnant": 0.5, "children": 0.3, "elderly": 0.8}
            表示特殊人群的限制倍数（相对于普通成人）
    """
    ingredient_name: str
    parameter: str                    # "daily_intake" | "single_dose" | "concentration"
    unit: str                         # "mg/day" | "mg/kg_bw" | "%"
    soft_limit: float                 # 软阈值（WARNING 触发点）
    hard_limit: float                 # 硬阈值（CRITICAL 触发点）
    adi_value: Optional[float] = None # 每日允许摄入量 (Acceptable Daily Intake)
    ul_value: Optional[float] = None  # 可耐受最高摄入量 (Upper Limit)
    source: str = ""                  # 数据来源（EFSA/WHO/JECFA/GB 标准）
    effective_date: datetime = field(default_factory=datetime.now)
    version: str = "1.0"
    special_groups: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "ingredient_name": self.ingredient_name,
            "parameter": self.parameter,
            "unit": self.unit,
            "soft_limit": self.soft_limit,
            "hard_limit": self.hard_limit,
            "adi_value": self.adi_value,
            "ul_value": self.ul_value,
            "source": self.source,
            "effective_date": self.effective_date.isoformat(),
            "version": self.version,
            "special_groups": self.special_groups,
        }

    def get_adjusted_limits(self, target_group: str = "adult") -> Tuple[float, float]:
        """
        根据目标人群调整阈值

        Args:
            target_group: 目标人群 ("adult" | "pregnant" | "children" | "elderly")

        Returns:
            Tuple[soft_limit, hard_limit]: 调整后的阈值
        """
        if target_group == "adult":
            return self.soft_limit, self.hard_limit

        multiplier = self.special_groups.get(target_group, 1.0)
        return self.soft_limit * multiplier, self.hard_limit * multiplier


@dataclass
class SafetyAlert:
    """
    安全预警信息

    Attributes:
        alert_level: 预警级别
        ingredient_name: 成分名称
        parameter: 参数名称
        current_value: 当前值
        threshold_value: 阈值
        percentage: 当前值占阈值的百分比
        message: 预警消息
        recommendation: 建议措施
        blocking: 是否阻断操作（仅 CRITICAL 为 True）
        timestamp: 时间戳
    """
    alert_level: AlertLevel
    ingredient_name: str
    parameter: str
    current_value: float
    threshold_value: float
    percentage: float                  # 当前值占阈值的百分比
    message: str                       # 预警消息
    recommendation: str                # 建议措施
    blocking: bool                     # 是否阻断操作（仅 CRITICAL 为 True）
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "level": self.alert_level.value,
            "ingredient": self.ingredient_name,
            "parameter": self.parameter,
            "current_value": self.current_value,
            "threshold_value": self.threshold_value,
            "percentage": round(self.percentage, 2),
            "message": self.message,
            "recommendation": self.recommendation,
            "blocking": self.blocking,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class SafetyCheckResult:
    """
    安全检查结果

    Attributes:
        is_safe: 是否安全
        alerts: 预警列表
        overall_risk_score: 综合风险评分 (0-100)
        checked_parameters: 检查参数数量
        blocked_by_critical: 是否被 CRITICAL 级别阻断
        recommendations: 建议列表
        detailed_breakdown: 详细分解
    """
    is_safe: bool
    alerts: List[SafetyAlert]
    overall_risk_score: float          # 0-100 风险评分
    checked_parameters: int
    blocked_by_critical: bool
    recommendations: List[str] = field(default_factory=list)
    detailed_breakdown: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "is_safe": self.is_safe,
            "overall_risk_score": round(self.overall_risk_score, 2),
            "alerts": [alert.to_dict() for alert in self.alerts],
            "checked_parameters": self.checked_parameters,
            "blocked_by_critical": self.blocked_by_critical,
            "recommendations": self.recommendations,
            "detailed_breakdown": self.detailed_breakdown,
        }


@dataclass
class ThresholdUpdateRecord:
    """阈值更新记录"""
    id: str
    ingredient_name: str
    changes: Dict[str, Dict[str, Any]]  # {"field": {"old": value, "new": value}}
    updated_by: str
    updated_at: datetime
    version_before: str
    version_after: str
    reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "id": self.id,
            "ingredient_name": self.ingredient_name,
            "changes": self.changes,
            "updated_by": self.updated_by,
            "updated_at": self.updated_at.isoformat(),
            "version_before": self.version_before,
            "version_after": self.version_after,
            "reason": self.reason,
        }
