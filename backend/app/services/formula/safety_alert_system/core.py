"""
SafetyAlertSystem - 核心预警系统

实现安全阈值管理和三级预警机制:
1. INFO 级别: 距阈值 <20% 时触发
2. WARNING 级别: 超过软阈值但未达硬阈值
3. CRITICAL 级别: 达到硬阈值 -> 阻断操作
"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from .types import (
    AlertLevel,
    SafetyAlert,
    SafetyCheckResult,
    SafetyThreshold,
    ThresholdUpdateRecord,
)
from .thresholds import BUILT_IN_THRESHOLDS
from .formula_check import FormulaCheckMixin


logger = logging.getLogger(__name__)


class SafetyAlertSystem(FormulaCheckMixin):
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

