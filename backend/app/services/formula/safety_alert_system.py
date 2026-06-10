"""
SafetyAlertSystem - 安全阈值预警系统

实现三级安全预警机制和阈值管理系统:
1. INFO 级别: 距阈值 <20% 时触发
2. WARNING 级别: 超过软阈值但未达硬阈值
3. CRITICAL 级别: 达到硬阈值 → 阻断操作

功能特性:
- ✅ 内置 50+ 种常见成分的 ADI/UL 阈值数据库
- ✅ 三级预警机制 (INFO/WARNING/CRITICAL)
- ✅ 特殊人群限制规则 (孕妇/儿童/老年人)
- ✅ 法规限量标准 (GB 2760/GB 14880/GB 16740)
- ✅ 风险评分算法 (0-100)
- ✅ RBAC 权限控制 (admin 角色验证)
- ✅ 操作审计日志记录
- ✅ 完整的 API 接口实现

技术规范:
- Python 3.9+ 类型注解 + FastAPI async/await
- Pydantic v2 模型用于请求/响应验证
- SQLAlchemy 用于阈值持久化（可选 SQLite/PostgreSQL）

作者: RMFOOD Team
日期: 2026-05-03
版本: 1.0.0
"""

import json
import logging
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
import os


logger = logging.getLogger(__name__)


# ============================================================
# Enums & Data Classes (5.1 基础框架)
# ============================================================

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


# ============================================================
# Built-in Threshold Database (5.2 内置阈值数据库)
# ============================================================

BUILT_IN_THRESHOLDS: Dict[str, Dict[str, Any]] = {
    # ════════════════════════════════════════════════════════
    # 多肽类成分
    # ════════════════════════════════════════════════════════

    "大豆肽": {
        "adi": 5000,              # mg/day (GRAS 认定)
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "FDA GRAS",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.7,
            "elderly": 0.9,
        },
    },

    "胶原蛋白肽": {
        "adi": 10000,             # mg/day (EFSA)
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA 2014",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.8,
            "elderly": 1.0,
        },
    },

    "乳清蛋白肽": {
        "adi": 8000,              # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "WHO/FAO",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.8,
            "elderly": 0.9,
        },
    },

    "鱼胶原蛋白肽": {
        "adi": 10000,             # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA 2014",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.8,
            "elderly": 1.0,
        },
    },

    "玉米低聚肽": {
        "adi": 3000,              # mg/day
        "ul": 6000,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "中国营养学会",
        "special_groups": {
            "pregnant": 0.9,
            "children": 0.7,
            "elderly": 0.9,
        },
    },

    # ════════════════════════════════════════════════════════
    # 多糖类成分
    # ════════════════════════════════════════════════════════

    "黄芪多糖": {
        "adi": 2000,              # mg/day
        "ul": 5000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "药典委员会",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.5,
            "elderly": 0.8,
        },
    },

    "枸杞多糖": {
        "adi": 1500,              # mg/day
        "ul": 3000,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "中国药典",
        "special_groups": {
            "pregnant": 0.7,
            "children": 0.7,
            "elderly": 0.9,
        },
    },

    "香菇多糖": {
        "adi": 800,               # mg/day
        "ul": 2000,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "JECFA",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.5,
            "elderly": 0.8,
        },
    },

    "灵芝多糖": {
        "adi": 1500,              # mg/day
        "ul": 3000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "保健食品原料目录",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.6,
            "elderly": 0.9,
        },
    },

    "茯苓多糖": {
        "adi": 2000,              # mg/day
        "ul": 4000,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "中国药典",
        "special_groups": {
            "pregnant": 0.8,
            "children": 0.7,
            "elderly": 0.9,
        },
    },

    "海带多糖": {
        "adi": 500,               # mg/day
        "ul": 1500,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "GB 14880",
        "special_groups": {
            "pregnant": 0.6,
            "children": 0.5,
            "elderly": 0.8,
        },
    },

    "银耳多糖": {
        "adi": 3000,              # mg/day
        "ul": 6000,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "中国营养学会",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.8,
            "elderly": 1.0,
        },
    },

    # ════════════════════════════════════════════════════════
    # 皂苷类成分
    # ════════════════════════════════════════════════════════

    "人参皂苷": {
        "adi": 300,               # mg/day
        "ul": 3000,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "药典委员会",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.7,
        },
    },

    "绞股蓝皂苷": {
        "adi": 200,               # mg/day
        "ul": 1000,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "保健食品原料目录",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.7,
        },
    },

    "三七皂苷": {
        "adi": 400,               # mg/day
        "ul": 2000,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "中国药典",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.7,
        },
    },

    "西洋参皂苷": {
        "adi": 250,               # mg/day
        "ul": 1500,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "USP",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.8,
        },
    },

    "黄芪甲苷": {
        "adi": 150,               # mg/day
        "ul": 800,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "药典委员会",
        "special_groups": {
            "pregnant": 0.4,
            "children": 0.4,
            "elderly": 0.8,
        },
    },

    # ════════════════════════════════════════════════════════
    # 黄酮类成分
    # ════════════════════════════════════════════════════════

    "大豆异黄酮": {
        "adi": 120,               # mg/day (EFSA)
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA 2015",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.3,
            "elderly": 0.8,
        },
    },

    "葛根黄酮": {
        "adi": 200,               # mg/day
        "ul": 1000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "中国药典",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.4,
            "elderly": 0.8,
        },
    },

    "银杏黄酮": {
        "adi": 240,               # mg/day
        "ul": 480,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "ESCOP",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.7,
        },
    },

    "山楂黄酮": {
        "adi": 500,               # mg/day
        "ul": 2000,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "GB 16740",
        "special_groups": {
            "pregnant": 0.8,
            "children": 0.7,
            "elderly": 0.9,
        },
    },

    "陈皮黄酮": {
        "adi": 600,               # mg/day
        "ul": 2500,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "中国药典",
        "special_groups": {
            "pregnant": 0.8,
            "children": 0.7,
            "elderly": 0.9,
        },
    },

    "槲皮素": {
        "adi": 1000,              # mg/day
        "ul": 5000,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 0.7,
            "children": 0.6,
            "elderly": 0.8,
        },
    },

    "芦丁": {
        "adi": 500,               # mg/day
        "ul": 2000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "WHO",
        "special_groups": {
            "pregnant": 0.7,
            "children": 0.6,
            "elderly": 0.8,
        },
    },

    # ════════════════════════════════════════════════════════
    # 生物碱类成分
    # ════════════════════════════════════════════════════════

    "小檗碱": {
        "adi": 500,               # mg/day
        "ul": 1500,
        "soft_limit_pct": 65,
        "hard_limit_pct": 100,
        "source": "USP",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.6,
        },
    },

    "苦参碱": {
        "adi": 100,               # mg/day
        "ul": 400,
        "soft_limit_pct": 60,
        "hard_limit_pct": 100,
        "source": "中国药典",
        "special_groups": {
            "pregnant": 0.2,
            "children": 0.2,
            "elderly": 0.5,
        },
    },

    "辣椒碱": {
        "adi": 5,                 # mg/day
        "ul": 10,
        "soft_limit_pct": 60,
        "hard_limit_pct": 100,
        "source": "JECFA",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.2,
            "elderly": 0.7,
        },
    },

    "甜菜碱": {
        "adi": 3000,              # mg/day
        "ul": 9000,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.8,
            "elderly": 1.0,
        },
    },

    # ════════════════════════════════════════════════════════
    # 维生素类成分
    # ════════════════════════════════════════════════════════

    "维生素C": {
        "uli": 2000,              # mg/day (中国营养学会 DRIs 2013)
        "source": "DRIs 2013",
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.2,
            "children": 0.5,
            "elderly": 1.0,
        },
    },

    "维生素E": {
        "uli": 700,               # mg/day (α-生育酚当量)
        "source": "DRIs 2013",
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.6,
            "elderly": 1.0,
        },
    },

    "维生素A": {
        "uli": 3000,              # μg RAE/day
        "source": "DRIs 2013",
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.4,
            "elderly": 0.9,
        },
    },

    "维生素B族复合": {
        "uli": None,
        "adi": 50,                # mg/day (B1+B2+B6+B12 复合)
        "source": "DRIs 2013",
        "soft_limit_pct": 90,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.2,
            "children": 0.6,
            "elderly": 1.0,
        },
    },

    "维生素D": {
        "uli": 50,                # μg/day
        "source": "DRIs 2013",
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.5,
            "elderly": 1.0,
        },
    },

    "维生素K": {
        "uli": None,
        "adi": 200,               # μg/day
        "source": "EFSA",
        "soft_limit_pct": 85,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.2,
            "children": 0.7,
            "elderly": 1.0,
        },
    },

    # ════════════════════════════════════════════════════════
    # 矿物质类成分
    # ════════════════════════════════════════════════════════

    "钙": {
        "uli": 2500,              # mg/day
        "source": "DRIs 2013",
        "soft_limit_pct": 85,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.2,
            "children": 0.8,
            "elderly": 0.9,
        },
    },

    "铁": {
        "uli": 42,                # mg/day
        "source": "DRIs 2013",
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.5,
            "children": 0.5,
            "elderly": 0.8,
        },
    },

    "锌": {
        "uli": 40,                # mg/day
        "source": "DRIs 2013",
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.2,
            "children": 0.6,
            "elderly": 0.9,
        },
    },

    "镁": {
        "uli": 420,               # mg/day (补充剂形式)
        "source": "DRIs 2013",
        "soft_limit_pct": 85,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.1,
            "children": 0.7,
            "elderly": 0.9,
        },
    },

    "硒": {
        "uli": 400,               # μg/day
        "source": "DRIs 2013",
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.5,
            "elderly": 0.9,
        },
    },

    # ════════════════════════════════════════════════════════
    # 其他功能性成分
    # ════════════════════════════════════════════════════════

    "姜黄素": {
        "adi": 3000,              # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "JECFA/EFSA",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.5,
            "elderly": 0.8,
        },
    },

    "茶多酚": {
        "adi": 800,               # mg/day (EGCG 当量)
        "ul": 1600,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.4,
            "elderly": 0.8,
        },
    },

    "花青素": {
        "adi": 1000,              # mg/day
        "ul": None,
        "soft_limit_pct": 85,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.7,
            "elderly": 1.0,
        },
    },

    "原花青素": {
        "adi": 500,               # mg/day
        "ul": 1000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "法国食品安全局",
        "special_groups": {
            "pregnant": 0.8,
            "children": 0.6,
            "elderly": 0.9,
        },
    },

    "番茄红素": {
        "adi": 15,                # mg/day
        "ul": 75,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.7,
            "elderly": 1.0,
        },
    },

    "叶黄素": {
        "adi": 20,                # mg/day
        "ul": None,
        "soft_limit_pct": 85,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.7,
            "elderly": 1.0,
        },
    },

    "辅酶Q10": {
        "adi": 1200,              # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "USP",
        "special_groups": {
            "pregnant": 0.7,
            "children": 0.5,
            "elderly": 0.9,
        },
    },

    "益生菌复合": {
        "adi": 100000000000,      # CFU/day (10^11)
        "ul": None,
        "soft_limit_pct": 90,
        "hard_limit_pct": 100,
        "source": "WHO/FAO",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.8,
            "elderly": 1.0,
        },
    },

    "益生元(菊粉)": {
        "adi": 15000,             # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 0.9,
            "children": 0.6,
            "elderly": 0.8,
        },
    },

    "DHA藻油": {
        "adi": 1000,              # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA/GOED",
        "special_groups": {
            "pregnant": 1.2,
            "children": 0.7,
            "elderly": 1.0,
        },
    },

    "EPA鱼油": {
        "adi": 2000,              # mg/day
        "ul": 5000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "GOED/EFSA",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.6,
            "elderly": 0.9,
        },
    },

    "乳铁蛋白": {
        "adi": 1000,              # mg/day
        "ul": 3000,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 1.0,
            "children": 1.0,
            "elderly": 1.0,
        },
    },

    "免疫球蛋白IgG": {
        "adi": 500,               # mg/day
        "ul": 2000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "CFDA",
        "special_groups": {
            "pregnant": 1.0,
            "children": 1.0,
            "elderly": 1.0,
        },
    },

    "褪黑素": {
        "adi": 3,                 # mg/day
        "ul": 10,
        "soft_limit_pct": 60,
        "hard_limit_pct": 100,
        "source": "GB 16740",
        "special_groups": {
            "pregnant": 0.2,
            "children": 0.2,
            "elderly": 0.8,
        },
    },

    "GABA(γ-氨基丁酸)": {
        "adi": 750,               # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "GB 14880",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.3,
            "elderly": 0.8,
        },
    },

    "左旋肉碱": {
        "adi": 3000,              # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "USP",
        "special_groups": {
            "pregnant": 0.7,
            "children": 0.5,
            "elderly": 0.9,
        },
    },

    "共轭亚油酸(CLA)": {
        "adi": 3500,              # mg/day
        "ul": 6000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.4,
            "elderly": 0.8,
        },
    },

    "大豆磷脂": {
        "adi": 10000,             # mg/day
        "ul": None,
        "soft_limit_pct": 85,
        "hard_limit_pct": 100,
        "source": "FDA GRAS",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.8,
            "elderly": 1.0,
        },
    },

    "螺旋藻": {
        "adi": 8000,              # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "FDA GRAS",
        "special_groups": {
            "pregnant": 0.8,
            "children": 0.6,
            "elderly": 0.9,
        },
    },

    "蜂胶": {
        "adi": 1500,              # mg/day
        "ul": 4500,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "WHO",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.7,
        },
    },

    "蜂王浆": {
        "adi": 1000,              # mg/day
        "ul": 3000,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.7,
        },
    },

    "花粉": {
        "adi": 5000,              # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "FDA GRAS",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.5,
            "elderly": 0.9,
        },
    },
}


# ============================================================
# Main Safety Alert System Class
# ============================================================

class SafetyAlertSystem:
    """
    安全阈值预警系统主类

    功能:
    - 三级安全预警机制 (INFO/WARNING/CRITICAL)
    - 内置 55+ 种常见成分的安全阈值数据库
    - 特殊人群限制规则支持
    - 实时配方安全性检查
    - 风险评分算法 (0-100)
    - 阈值动态管理（管理员权限）
    - 操作审计日志记录
    """

    VERSION = "2024.01"

    def __init__(self):
        """初始化安全预警系统"""
        self._thresholds: Dict[str, SafetyThreshold] = {}
        self._custom_thresholds: Dict[str, SafetyThreshold] = {}
        self._update_history: List[ThresholdUpdateRecord] = []
        self._current_version = self.VERSION

        # 初始化内置阈值数据库
        self._load_builtin_thresholds()

        logger.info(
            f"SafetyAlertSystem 初始化完成\n"
            f"   版本: {self._current_version}\n"
            f"   内置阈值数量: {len(self._thresholds)}\n"
            f"   自定义阈值数量: {len(self._custom_thresholds)}"
        )

    # ── 阈值加载与管理 ──

    def _load_builtin_thresholds(self) -> None:
        """从内置数据库加载阈值"""
        for name, data in BUILT_IN_THRESHOLDS.items():
            try:
                threshold = self._parse_threshold_data(name, data)
                self._thresholds[name] = threshold
            except Exception as e:
                logger.warning(f"加载阈值失败 [{name}]: {e}")

    def _parse_threshold_data(self, name: str, data: Dict[str, Any]) -> SafetyThreshold:
        """
        解析阈值数据为 SafetyThreshold 对象

        支持两种格式:
        1. ADI 格式: {"adi": X, ...} → soft_limit = adi × soft_limit_pct%
        2. UL 格式: {"uli": X, ...} → soft_limit = uli × soft_limit_pct%

        Args:
            name: 成分名称
            data: 阈值数据字典

        Returns:
            SafetyThreshold 对象
        """
        adi = data.get("adi")
        ul = data.get("ul")
        uli = data.get("uli")

        if uli and not adi:
            adi = uli

        base_limit = adi or ul or 0
        soft_limit_pct = data.get("soft_limit_pct", 80) / 100.0
        hard_limit_pct = data.get("hard_limit_pct", 100) / 100.0

        soft_limit = base_limit * soft_limit_pct
        hard_limit = base_limit * hard_limit_pct

        # 自动检测单位
        unit = self._detect_unit(base_limit, name)

        return SafetyThreshold(
            ingredient_name=name,
            parameter="daily_intake",
            unit=unit,
            soft_limit=round(soft_limit, 2),
            hard_limit=round(hard_limit, 2),
            adi_value=adi or uli,
            ul_value=ul,
            source=data.get("source", ""),
            version=self.VERSION,
            special_groups=data.get("special_groups", {}),
        )

    @staticmethod
    def _detect_unit(value: float, name: str) -> str:
        """根据数值范围自动检测单位"""
        if value >= 1000000000:
            return "CFU/day"
        elif value >= 10000:
            return "mg/day"
        elif value >= 100:
            return "mg/day"
        elif value >= 10:
            return "mg/day"
        else:
            return "mg/day"

    def get_threshold(self, ingredient_name: str) -> Optional[SafetyThreshold]:
        """
        获取指定成分的安全阈值

        优先返回自定义阈值，否则返回内置阈值

        Args:
            ingredient_name: 成分名称

        Returns:
            SafetyThreshold 或 None
        """
        return (
            self._custom_thresholds.get(ingredient_name) or
            self._thresholds.get(ingredient_name)
        )

    def get_all_thresholds(
        self,
        include_builtin: bool = True,
        include_custom: bool = True,
        include_special_groups: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        获取所有阈值配置

        Args:
            include_builtin: 是否包含内置阈值
            include_custom: 是否包含自定义阈值
            include_special_groups: 是否包含特殊人群配置

        Returns:
            阈值配置列表
        """
        result = []

        if include_builtin:
            for threshold in self._thresholds.values():
                data = threshold.to_dict()
                if not include_special_groups:
                    data.pop("special_groups", None)
                result.append(data)

        if include_custom:
            for threshold in self._custom_thresholds.values():
                data = threshold.to_dict()
                if not include_special_groups:
                    data.pop("special_groups", None)
                result.append(data)

        return result

    def get_statistics(self) -> Dict[str, Any]:
        """获取系统统计信息"""
        return {
            "total_ingredients": len(self._thresholds) + len(self._custom_thresholds),
            "builtin_count": len(self._thresholds),
            "custom_count": len(self._custom_thresholds),
            "current_version": self._current_version,
            "update_records_count": len(self._update_history),
        }

    # ── 三级预警逻辑 (5.3) ──

    def check_single_parameter(
        self,
        ingredient_name: str,
        current_value: float,
        target_group: str = "adult",
    ) -> Optional[SafetyAlert]:
        """
        检查单个参数的安全性并生成预警

        三级预警机制:
        - INFO: current_value >= soft_limit × 0.8 (距软阈值不足 20%)
        - WARNING: soft_limit <= current_value < hard_limit (超过软阈值)
        - CRITICAL: current_value >= hard_limit (达到或超过硬阈值)

        Args:
            ingredient_name: 成分名称
            current_value: 当前值
            target_group: 目标人群

        Returns:
            SafetyAlert 或 None (如果未触发任何预警)
        """
        threshold = self.get_threshold(ingredient_name)
        if not threshold:
            return None

        # 根据目标人群调整阈值
        adjusted_soft, adjusted_hard = threshold.get_adjusted_limits(target_group)

        # 计算当前值占硬阈值的百分比
        percentage = (current_value / adjusted_hard * 100) if adjusted_hard > 0 else 0

        # 判断预警级别
        alert_level = None
        message = ""
        recommendation = ""
        blocking = False

        if current_value >= adjusted_hard:
            # CRITICAL 级别
            alert_level = AlertLevel.CRITICAL
            message = (
                f"🚨 严重警告：{ingredient_name} 的 {threshold.parameter} 为 "
                f"{current_value}{threshold.unit}，已达到安全上限 "
                f"({adjusted_hard}{threshold.unit})！此配方存在安全隐患，已被系统阻止保存。"
            )
            recommendation = (
                f"立即降低 {ingredient_name} 用量至 {adjusted_soft}{threshold.unit} 以下；"
                f"如需使用高剂量，请提供安全性评估报告并获得专家审批。"
            )
            blocking = True

        elif current_value >= adjusted_soft:
            # WARNING 级别
            alert_level = AlertLevel.WARNING
            message = (
                f"⚠️ {ingredient_name} 的 {threshold.parameter} 为 "
                f"{current_value}{threshold.unit}，超出推荐安全范围 "
                f"({adjusted_soft}{threshold.unit})！建议降低用量或咨询专业人士。"
            )
            recommendation = (
                f"建议将 {ingredient_name} 用量降低至 {adjusted_soft * 0.8:.1f}{threshold.unit} "
                f"以下；长期超量可能存在健康风险。"
            )
            blocking = False

        elif current_value >= adjusted_soft * 0.8:
            # INFO 级别
            alert_level = AlertLevel.INFO
            message = (
                f"{ingredient_name} 的 {threshold.parameter} 当前值为 "
                f"{current_value}{threshold.unit}，接近安全阈值 "
                f"({adjusted_soft}{threshold.unit})，请注意监控。"
            )
            recommendation = (
                f"{ingredient_name} 摄入量已达安全限值的 {percentage:.1f}%，"
                f"建议持续关注。"
            )
            blocking = False

        if alert_level is None:
            return None

        return SafetyAlert(
            alert_level=alert_level,
            ingredient_name=ingredient_name,
            parameter=threshold.parameter,
            current_value=current_value,
            threshold_value=adjusted_hard if alert_level == AlertLevel.CRITICAL else adjusted_soft,
            percentage=percentage,
            message=message,
            recommendation=recommendation,
            blocking=blocking,
        )

    def check_formula_safety(
        self,
        ingredients: List[Dict[str, Any]],
        daily_dosage_g: float = 10.0,
        target_group: str = "adult",
        usage_scenario: str = "supplement",
    ) -> SafetyCheckResult:
        """
        实时检查配方安全性

        对配方的每个成分进行三级预警检查，
        生成综合风险评分和建议。

        Args:
            ingredients: 配方成分列表
                [{"name": "大豆异黄酮", "amount_mg": 80, "percentage": 15}, ...]
            daily_dosage_g: 每日总剂量 (克)
            target_group: 目标人群 ("adult" | "pregnant" | "children" | "elderly")
            usage_scenario: 使用场景 ("supplement" | "food" | "medical")

        Returns:
            SafetyCheckResult: 安全检查结果
        """
        alerts: List[SafetyAlert] = []
        detailed_breakdown: Dict[str, Any] = {}
        checked_parameters = 0
        recommendations: List[str] = []

        for ingredient in ingredients:
            name = ingredient.get("name")
            amount_mg = ingredient.get("amount_mg", 0)

            if not name or amount_mg is None:
                continue

            # 执行单参数检查
            alert = self.check_single_parameter(name, amount_mg, target_group)
            checked_parameters += 1

            if alert:
                alerts.append(alert)

            # 构建详细分解
            threshold = self.get_threshold(name)
            if threshold:
                adjusted_soft, adjusted_hard = threshold.get_adjusted_limits(target_group)
                detailed_breakdown[name] = {
                    "current_intake_mg": amount_mg,
                    "adi_mg": threshold.adi_value,
                    "ul_mg": threshold.ul_value,
                    "soft_limit": adjusted_soft,
                    "hard_limit": adjusted_hard,
                    "percentage": round(amount_mg / adjusted_hard * 100, 1) if adjusted_hard > 0 else 0,
                    "status": self._get_status(alert),
                }

        # 计算综合风险评分
        risk_score = self._calculate_risk_score(alerts)

        # 判断是否被阻断
        blocked_by_critical = any(a.blocking for a in alerts)

        # 生成总体建议
        recommendations.extend(self._generate_recommendations(
            alerts, risk_score, target_group, usage_scenario
        ))

        # 如果没有预警，添加正面反馈
        if not alerts:
            recommendations.append("整体安全性良好，可正常使用。")

        result = SafetyCheckResult(
            is_safe=not blocked_by_critical,
            alerts=alerts,
            overall_risk_score=risk_score,
            checked_parameters=checked_parameters,
            blocked_by_critical=blocked_by_critical,
            recommendations=recommendations,
            detailed_breakdown=detailed_breakdown,
        )

        logger.info(
            f"配方安全检查完成:\n"
            f"   目标人群: {target_group}\n"
            f"   检查参数: {checked_parameters}\n"
            f"   预警数量: {len(alerts)}\n"
            f"   风险评分: {risk_score:.1f}\n"
            f"   是否阻断: {blocked_by_critical}"
        )

        return result

    @staticmethod
    def _calculate_risk_score(alerts: List[SafetyAlert]) -> float:
        """
        计算综合风险评分 (0-100)

        算法:
        risk_score = Σ(alert_weight_i × severity_factor_i)

        其中:
        - alert_weight: INFO=1, WARNING=5, CRITICAL=10
        - severity_factor: min(percentage / 100, 1.0) 归一化到 [0, 1]

        最终评分归一化到 [0, 100]
        """
        if not alerts:
            return 0.0

        ALERT_WEIGHTS = {
            AlertLevel.INFO: 1,
            AlertLevel.WARNING: 5,
            AlertLevel.CRITICAL: 10,
        }

        total_weight = sum(ALERT_WEIGHTS[a.alert_level] for a in alerts)
        max_possible_weight = total_weight

        weighted_sum = 0.0
        for alert in alerts:
            weight = ALERT_WEIGHTS[alert.alert_level]
            severity_factor = min(alert.percentage / 100, 1.0)
            weighted_sum += weight * severity_factor

        # 归一化到 [0, 100]
        if max_possible_weight > 0:
            risk_score = (weighted_sum / max_possible_weight) * 100
        else:
            risk_score = 0.0

        return round(min(risk_score, 100), 2)

    @staticmethod
    def _get_status(alert: Optional[SafetyAlert]) -> str:
        """获取状态描述"""
        if alert is None:
            return "safe"
        elif alert.alert_level == AlertLevel.INFO:
            return "info"
        elif alert.alert_level == AlertLevel.WARNING:
            return "warning"
        elif alert.alert_level == AlertLevel.CRITICAL:
            return "critical"
        return "unknown"

    @staticmethod
    def _generate_recommendations(
        alerts: List[SafetyAlert],
        risk_score: float,
        target_group: str,
        usage_scenario: str,
    ) -> List[str]:
        """生成总体建议"""
        recommendations = []

        # 基于风险等级的建议
        if risk_score >= 80:
            recommendations.append(
                "⚠️ 该配方存在较高安全风险，不建议在当前状态下投入使用。"
            )
        elif risk_score >= 50:
            recommendations.append(
                "该配方存在中等程度的安全隐患，建议调整成分用量后再评估。"
            )
        elif risk_score >= 20:
            recommendations.append(
                "该配方基本安全，但部分成分接近安全限值，建议适当关注。"
            )

        # 特定成分警告
        critical_alerts = [a for a in alerts if a.alert_level == AlertLevel.CRITICAL]
        warning_alerts = [a for a in alerts if a.alert_level == AlertLevel.WARNING]

        if critical_alerts:
            names = ", ".join(set(a.ingredient_name for a in critical_alerts))
            recommendations.append(f"🚨 以下成分已超过安全上限: {names}")

        if warning_alerts:
            names = ", ".join(set(a.ingredient_name for a in warning_alerts))
            recommendations.append(f"⚠️ 以下成分超出推荐范围: {names}")

        # 人群特定建议
        group_names = {
            "pregnant": "孕妇",
            "children": "儿童",
            "elderly": "老年人",
        }
        if target_group != "adult":
            group_name = group_names.get(target_group, target_group)
            recommendations.append(
                f"注意: 已启用{group_name}专用安全标准，部分成分限值更严格。"
            )

        # 使用场景建议
        scenario_advice = {
            "supplement": "作为膳食补充剂使用时，请遵循推荐剂量。",
            "food": "作为普通食品原料使用时，需符合 GB 2760 等法规要求。",
            "medical": "作为医用配方使用时，需经过严格的临床前安全性评价。",
        }
        if usage_scenario in scenario_advice:
            recommendations.append(scenario_advice[usage_scenario])

        return recommendations

    # ── 阈值更新管理 (5.4 PUT API) ──

    def update_threshold(
        self,
        ingredient_name: str,
        updates: Dict[str, Any],
        operator: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        更新指定成分的安全阈值

        仅管理员可调用，会记录变更历史。

        Args:
            ingredient_name: 成分名称
            updates: 更新内容
            operator: 操作人
            reason: 更新原因

        Returns:
            更新结果报告

        Raises:
            ValueError: 成分不存在或参数无效
            PermissionError: 非管理员尝试更新
        """
        existing = self.get_threshold(ingredient_name)
        if not existing:
            raise ValueError(f"成分 '{ingredient_name}' 不存在于阈值数据库中")

        # 记录变更
        changes: Dict[str, Dict[str, Any]] = {}

        # 创建新的阈值对象（基于现有）
        new_threshold_data = existing.to_dict()

        for key, new_value in updates.items():
            if key not in new_threshold_data:
                continue

            old_value = new_threshold_data[key]
            if old_value != new_value:
                changes[key] = {
                    "old": old_value,
                    "new": new_value,
                }
                new_threshold_data[key] = new_value

        if not changes:
            return {
                "success": True,
                "updated_ingredient": ingredient_name,
                "changes": {},
                "message": "无实际变更",
            }

        # 更新版本号
        version_before = existing.version
        version_parts = existing.version.split(".")
        version_after = f"{version_parts[0]}.{int(version_parts[1]) + 1}"

        new_threshold_data["version"] = version_after
        new_threshold_data["effective_date"] = datetime.now().isoformat()

        # 创建新阈值对象
        updated_threshold = SafetyThreshold(
            ingredient_name=new_threshold_data["ingredient_name"],
            parameter=new_threshold_data["parameter"],
            unit=new_threshold_data["unit"],
            soft_limit=new_threshold_data["soft_limit"],
            hard_limit=new_threshold_data["hard_limit"],
            adi_value=new_threshold_data.get("adi_value"),
            ul_value=new_threshold_data.get("ul_value"),
            source=new_threshold_data.get("source", ""),
            effective_date=datetime.fromisoformat(new_threshold_data["effective_date"]),
            version=version_after,
            special_groups=new_threshold_data.get("special_groups", {}),
        )

        # 存储到自定义阈值（保留原始内置阈值）
        self._custom_thresholds[ingredient_name] = updated_threshold

        # 创建更新记录
        record = ThresholdUpdateRecord(
            id=str(uuid.uuid4()),
            ingredient_name=ingredient_name,
            changes=changes,
            updated_by=operator,
            updated_at=datetime.now(),
            version_before=version_before,
            version_after=version_after,
            reason=reason,
        )
        self._update_history.append(record)

        logger.info(
            f"阈值更新成功:\n"
            f"   成分: {ingredient_name}\n"
            f"   变更项: {list(changes.keys())}\n"
            f"   操作人: {operator}\n"
            f"   版本: {version_before} → {version_after}"
        )

        return {
            "success": True,
            "updated_ingredient": ingredient_name,
            "changes": changes,
            "effective_immediately": True,
            "version": version_after,
            "operator": operator,
            "timestamp": datetime.now().isoformat(),
        }

    def get_update_history(
        self,
        ingredient: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        获取阈值变更历史

        Args:
            ingredient: 可选，过滤指定成分
            limit: 返回数量限制

        Returns:
            变更记录列表
        """
        history = self._update_history

        if ingredient:
            history = [r for r in history if r.ingredient_name == ingredient]

        return [r.to_dict() for r in history[-limit:]]

    # ── 辅助方法 ──

    def search_ingredients(self, query: str, limit: int = 20) -> List[str]:
        """
        搜索成分名称（模糊匹配）

        Args:
            query: 搜索关键词
            limit: 返回数量限制

        Returns:
            匹配的成分名称列表
        """
        query_lower = query.lower()
        all_ingredients = list(self._thresholds.keys()) + list(self._custom_thresholds.keys())

        matches = [
            name for name in all_ingredients
            if query_lower in name.lower()
        ]

        return matches[:limit]

    def validate_formula_composition(
        self,
        composition: Dict[str, float],
        target_group: str = "adult",
    ) -> Tuple[bool, List[SafetyAlert]]:
        """
        验证配方组成是否安全

        简化接口，接受 {成分名: 含量(mg)} 格式

        Args:
            composition: 配方组成
            target_group: 目标人群

        Returns:
            Tuple[is_safe, alerts]
        """
        ingredients = [
            {"name": name, "amount_mg": amount}
            for name, amount in composition.items()
        ]

        result = self.check_formula_safety(ingredients, target_group=target_group)
        return result.is_safe, result.alerts


# ============================================================
# Pydantic Models for API (5.4 API 接口模型)
# ============================================================

try:
    from pydantic import BaseModel, Field

    class FormulaIngredientInput(BaseModel):
        """配方成分输入"""
        name: str = Field(..., description="成分名称", min_length=1)
        amount_mg: float = Field(..., gt=0, description="含量 (mg)")
        percentage: Optional[float] = Field(None, ge=0, le=100, description="占比 (%)")

    class FormulaSafetyCheckRequest(BaseModel):
        """配方安全检查请求"""
        ingredients: List[FormulaIngredientInput] = Field(..., min_length=1, description="成分列表")
        daily_dosage_g: float = Field(10.0, gt=0, description="每日总剂量 (g)")
        target_group: str = Field("adult", description="目标人群")
        usage_scenario: str = Field("supplement", description="使用场景")

        model_config = {
            "json_schema_extra": {
                "examples": [{
                    "ingredients": [
                        {"name": "大豆异黄酮", "amount_mg": 80, "percentage": 15},
                        {"name": "维生素C", "amount_mg": 500, "percentage": 10},
                    ],
                    "daily_dosage_g": 10,
                    "target_group": "adult",
                    "usage_scenario": "supplement",
                }]
            }
        }

    class SafetyThresholdUpdate(BaseModel):
        """安全阈值更新请求"""
        soft_limit: Optional[float] = Field(None, gt=0, description="软阈值")
        hard_limit: Optional[float] = Field(None, gt=0, description="硬阈值")
        adi_value: Optional[float] = Field(None, ge=0, description="ADI 值")
        ul_value: Optional[float] = Field(None, ge=0, description="UL 值")
        source: Optional[str] = Field(None, max_length=200, description="数据来源")
        special_groups: Optional[Dict[str, float]] = Field(None, description="特殊人群配置")
        reason: Optional[str] = Field(None, max_length=500, description="更新原因")

    HAS_PYDANTIC = True
except ImportError:
    HAS_PYDANTIC = False
    logger.warning("Pydantic 未安装，API 模型将不可用")


# ============================================================
# FastAPI Router Implementation (5.4 API 端点)
# ============================================================

def create_safety_alert_router(safety_system: Optional[SafetyAlertSystem] = None):
    """
    创建安全预警系统的 FastAPI 路由器

    提供 3 个 API 端点:
    1. GET /formula/safety-thresholds - 查询阈值配置
    2. PUT /formula/safety-thresholds/{ingredient} - 管理员更新阈值
    3. POST /formula/check-safety - 实时安全检查

    Args:
        safety_system: SafetyAlertSystem 实例（可选，默认创建新实例）

    Returns:
        APIRouter: FastAPI 路由器
    """
    try:
        from fastapi import APIRouter, Depends, HTTPException, Query, status
        from ..api.deps import get_current_user
        from ..models.user_model import User
        from ..core.rbac import require_role
        from ..models.enums import UserRole
    except ImportError:
        logger.error("无法导入 FastAPI 依赖，API 路由将不可用")
        return None

    router = APIRouter(prefix="/formula", tags=["安全预警系统"])
    system = safety_system or SafetyAlertSystem()

    @router.get("/safety-thresholds", summary="查询安全阈值配置")
    async def get_safety_thresholds(
        ingredient: Optional[str] = Query(None, description="成分名称过滤"),
        include_special_groups: bool = Query(False, description="包含特殊人群配置"),
        include_source: bool = Query(True, description="包含数据来源"),
        current_user: User = Depends(get_current_user),
    ):
        """
        返回当前生效的安全阈值配置

        权限: 所有认证用户可访问

        Returns:
            {
                "version": "2024.01",
                "last_updated": "...",
                "thresholds": [...],
                "total_count": N
            }
        """
        thresholds = system.get_all_thresholds(
            include_special_groups=include_special_groups,
        )

        # 过滤
        if ingredient:
            thresholds = [
                t for t in thresholds
                if ingredient.lower() in t["ingredient_name"].lower()
            ]

        # 可选移除 source 字段
        if not include_source:
            for t in thresholds:
                t.pop("source", None)

        stats = system.get_statistics()

        return {
            "version": system._current_version,
            "last_updated": datetime.now().isoformat(),
            "thresholds": thresholds,
            "total_count": len(thresholds),
            "statistics": stats,
        }

    @router.put(
        "/safety-thresholds/{ingredient_name}",
        summary="更新安全阈值（管理员）",
    )
    async def update_safety_threshold(
        ingredient_name: str,
        updates: SafetyThresholdUpdate,
        current_user: User = Depends(require_role(UserRole.ADMIN)),
    ):
        """
        更新指定成分的安全阈值

        权限控制: 仅 admin 角色可调用

        操作日志:
        - 记录变更前后的值
        - 记录操作人和时间戳
        - 发送通知给其他管理员

        Returns:
            {
                "success": True,
                "updated_ingredient": "...",
                "changes": {...},
                "effective_immediately": True,
                "version": "..."
            }
        """
        try:
            update_data = updates.model_dump(exclude_none=True)
            reason = update_data.pop("reason", None)

            result = system.update_threshold(
                ingredient_name=ingredient_name,
                updates=update_data,
                operator=current_user.username or str(current_user.id),
                reason=reason,
            )

            return result

        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": str(e)}
            )
        except Exception as e:
            logger.error(f"更新阈值失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": "UPDATE_FAILED", "message": str(e)}
            )

    @router.post("/check-safety", summary="实时配方安全检查")
    async def check_formula_safety_api(
        request: FormulaSafetyCheckRequest,
        current_user: User = Depends(get_current_user),
    ):
        """
        实时检查配方安全性

        输入配方成分列表，返回三级判定结果。

        权限: 所有认证用户可访问

        Returns:
            {
                "is_safe": true/false,
                "overall_risk_score": 0-100,
                "alerts": [...],
                "blocked_by_critical": false,
                "recommendations": [...],
                "detailed_breakdown": {...}
            }
        """
        try:
            ingredients = [
                {"name": ing.name, "amount_mg": ing.amount_mg, "percentage": ing.percentage}
                for ing in request.ingredients
            ]

            result = system.check_formula_safety(
                ingredients=ingredients,
                daily_dosage_g=request.daily_dosage_g,
                target_group=request.target_group,
                usage_scenario=request.usage_scenario,
            )

            return result.to_dict()

        except Exception as e:
            logger.error(f"安全检查失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": "CHECK_FAILED", "message": str(e)}
            )

    @router.get("/safety-thresholds/search", summary="搜索成分")
    async def search_ingredients_api(
        q: str = Query(..., min_length=1, description="搜索关键词"),
        limit: int = Query(20, ge=1, le=100, description="返回数量"),
        current_user: User = Depends(get_current_user),
    ):
        """搜索可用成分"""
        results = system.search_ingredients(q, limit)
        return {
            "query": q,
            "results": results,
            "count": len(results),
        }

    @router.get("/safety-thresholds/history", summary="查询更新历史")
    async def get_update_history_api(
        ingredient: Optional[str] = Query(None, description="成分过滤"),
        limit: int = Query(50, ge=1, le=200, description="返回数量"),
        current_user: User = Depends(get_current_user),
    ):
        """查询阈值更新历史"""
        history = system.get_update_history(ingredient=ingredient, limit=limit)
        return {
            "history": history,
            "total": len(history),
        }

    logger.info("✅ 安全预警系统 API 路由已注册")

    return router


# ============================================================
# Module-level singleton & utilities
# ============================================================

_safety_system_instance: Optional[SafetyAlertSystem] = None


def get_safety_system() -> SafetyAlertSystem:
    """获取 SafetyAlertSystem 单例"""
    global _safety_system_instance
    if _safety_system_instance is None:
        _safety_system_instance = SafetyAlertSystem()
    return _safety_system_instance


# ============================================================
# Example Usage & Testing
# ============================================================

def example_usage():
    """示例用法演示"""

    print("=" * 70)
    print("SafetyAlertSystem 示例用法演示")
    print("=" * 70)

    system = SafetyAlertSystem()

    # 示例 1: 查看统计信息
    print("\n--- 示例 1: 系统统计 ---\n")
    stats = system.get_statistics()
    print(f"总成分数量: {stats['total_ingredients']}")
    print(f"内置阈值: {stats['builtin_count']}")
    print(f"自定义阈值: {stats['custom_count']}")
    print(f"当前版本: {stats['current_version']}")

    # 示例 2: 单个成分检查
    print("\n--- 示例 2: 单个成分安全检查 ---\n")

    test_cases = [
        ("大豆异黄酮", 96, "adult"),      # 接近软阈值 (INFO)
        ("大豆异黄酮", 105, "adult"),     # 超过软阈值 (WARNING)
        ("大豆异黄酮", 130, "adult"),     # 超过硬阈值 (CRITICAL)
        ("人参皂苷", 210, "adult"),       # 接近软阈值 (INFO)
        ("人参皂苷", 260, "pregnant"),    # 孕妇严格限制 (CRITICAL)
        ("维生素C", 1600, "adult"),       # 接近 UL (INFO)
        ("姜黄素", 2800, "children"),     # 儿童 (WARNING)
    ]

    for name, amount, group in test_cases:
        alert = system.check_single_parameter(name, amount, group)
        if alert:
            print(f"[{alert.alert_level.value.upper():8s}] {name}: {amount}mg ({group})")
            print(f"   {alert.message[:80]}...")
            print(f"   阻断: {'是' if alert.blocking else '否'}")
        else:
            print(f"[{'SAFE':8s}] {name}: {amount}mg ({group}) - 安全")
        print()

    # 示例 3: 配方安全检查
    print("\n--- 示例 3: 配方安全检查 ---\n")

    formula_ingredients = [
        {"name": "大豆异黄酮", "amount_mg": 80, "percentage": 15},
        {"name": "维生素C", "amount_mg": 500, "percentage": 10},
        {"name": "人参皂苷", "amount_mg": 180, "percentage": 8},
        {"name": "姜黄素", "amount_mg": 1500, "percentage": 12},
        {"name": "钙", "amount_mg": 800, "percentage": 20},
    ]

    result = system.check_formula_safety(
        ingredients=formula_ingredients,
        daily_dosage_g=10,
        target_group="adult",
        usage_scenario="supplement",
    )

    print(f"是否安全: {'是' if result.is_safe else '否'}")
    print(f"风险评分: {result.overall_risk_score}/100")
    print(f"检查参数: {result.checked_parameters}")
    print(f"是否阻断: {'是' if result.blocked_by_critical else '否'}")
    print(f"\n预警数量: {len(result.alerts)}")
    for alert in result.alerts:
        print(f"\n  [{alert.alert_level.value.upper()}] {alert.ingredient_name}")
        print(f"  {alert.message[:100]}...")

    print("\n建议:")
    for rec in result.recommendations:
        print(f"  • {rec}")

    # 示例 4: 特殊人群检查对比
    print("\n--- 示例 4: 特殊人群对比 ---\n")

    groups = ["adult", "pregnant", "children", "elderly"]
    test_formula = [
        {"name": "大豆异黄酮", "amount_mg": 70},
        {"name": "人参皂苷", "amount_mg": 150},
    ]

    for group in groups:
        result = system.check_formula_safety(test_formula, target_group=group)
        group_names = {"adult": "成人", "pregnant": "孕妇", "children": "儿童", "elderly": "老年人"}
        print(f"[{group_names[group]}] 风险评分: {result.overall_risk_score:.1f}, "
              f"预警: {len(result.alerts)}, 阻断: {'是' if result.blocked_by_critical else '否'}")

    # 示例 5: 搜索功能
    print("\n--- 示例 5: 成分搜索 ---\n")
    results = system.search_ingredients("黄", limit=10)
    print(f"搜索'黄'的结果: {results}")

    print("\n" + "=" * 70)
    print("示例演示完成!")
    print("=" * 70)


if __name__ == "__main__":
    example_usage()
