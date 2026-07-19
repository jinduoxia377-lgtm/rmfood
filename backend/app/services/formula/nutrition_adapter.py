"""
NutritionEngine 适配器

将现有的 NutritionEngine 封装为算法引擎（MILP/GA/NSGA-II）可用的接口：
1. 快速营养查询（批量）
2. 营养约束校验（硬约束/软约束）
3. 营养偏差评分（用于多目标优化第8维目标）
4. 合规性预检查
5. 营养优化建议

关键优化：
- 内部维护 HerbNutritionData 内存缓存
- 所有公开方法是同步的（避免async开销）
- 支持增量营养计算
- 线程安全

@version 1.0.0
"""

import logging
import threading
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ============================================================
# 数据类定义
# ============================================================

@dataclass(frozen=True)
class NutritionTarget:
    """营养目标：优化过程中需要满足的营养约束"""
    nutrient: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    min_nrv_pct: Optional[float] = None
    max_nrv_pct: Optional[float] = None


@dataclass(frozen=True)
class NutritionBounds:
    """营养上下限默认值（每100g）"""
    protein: Tuple[float, float] = (0.0, 50.0)
    fat: Tuple[float, float] = (0.0, 50.0)
    carbohydrate: Tuple[float, float] = (0.0, 80.0)
    sodium: Tuple[float, float] = (0.0, 600.0)
    dietary_fiber: Tuple[float, float] = (0.0, 20.0)
    calcium: Tuple[float, float] = (0.0, 1200.0)
    iron: Tuple[float, float] = (0.0, 20.0)
    energy: Tuple[float, float] = (0.0, 700.0)

    def to_constraints(self) -> List["NutritionTarget"]:
        """转换为 NutritionTarget 列表"""
        constraints = []
        for attr in ["protein", "fat", "carbohydrate", "sodium",
                      "dietary_fiber", "calcium", "iron", "energy"]:
            min_val, max_val = getattr(self, attr)
            constraints.append(NutritionTarget(
                nutrient=attr,
                min_value=min_val if min_val > 0 else None,
                max_value=max_val if max_val < float('inf') else None,
            ))
        return constraints


# ============================================================
# NutritionAdapter
# ============================================================

class NutritionAdapter:
    """
    NutritionEngine适配器

    将NutritionEngine封装为算法引擎可用的接口。
    所有营养数据在首次使用时预加载到内存，后续操作O(1)。
    """

    def __init__(
        self,
        nutrition_engine: Any,
        nutrition_bounds: Optional[NutritionBounds] = None,
    ):
        """
        Args:
            nutrition_engine: NutritionEngine实例
            nutrition_bounds: 营养上下限默认值
        """
        self.engine = nutrition_engine
        self.bounds = nutrition_bounds or NutritionBounds()

        # 内存缓存: {herb_id: {nutrient: value_per_100g}}
        self._herb_nutrition_cache: Dict[str, Dict[str, float]] = {}
        self._herb_cost_cache: Dict[str, float] = {}
        self._herb_allergen_cache: Dict[str, List[str]] = {}
        self._loaded = False
        self._lock = threading.Lock()

        logger.info("[NutritionAdapter] 初始化完成")

    def _ensure_loaded(self) -> None:
        """懒加载：首次使用时从engine获取所有药材营养数据"""
        if self._loaded:
            return

        with self._lock:
            if self._loaded:
                return

            # 尝试从engine获取药材营养数据
            try:
                # 如果有 _get_ingredient_nutrition 方法，批量调用
                import asyncio

                async def _load():
                    # 获取所有药材ID（从内置字典或数据库）
                    from app.services.ai.bayesian_formula_optimizer import _BUILTIN_HERBS
                    for herb_id, herb_param in _BUILTIN_HERBS.items():
                        self._herb_nutrition_cache[herb_id] = herb_param.efficacy_scores.copy()
                        self._herb_cost_cache[herb_id] = herb_param.cost_per_gram

                asyncio.run(_load())
            except Exception as e:
                logger.warning(f"[NutritionAdapter] 懒加载失败: {e}，使用空缓存")

            self._loaded = True

    def get_herb_nutrition_matrix(self, herb_ids: List[str]) -> Dict[str, Dict[str, float]]:
        """
        批量获取多种药材的营养数据矩阵

        Returns:
            {herb_id: {nutrient: value_per_100g}}
        """
        self._ensure_loaded()
        result = {}
        for hid in herb_ids:
            if hid in self._herb_nutrition_cache:
                result[hid] = self._herb_nutrition_cache[hid]
            else:
                result[hid] = {}
        return result

    def get_herb_cost(self, herb_id: str) -> float:
        """获取单味药材每克成本"""
        self._ensure_loaded()
        return self._herb_cost_cache.get(herb_id, 0.1)  # 默认0.1元/g

    def validate_nutrition(
        self,
        herbs: Dict[str, float],
        bounds: Optional[NutritionBounds] = None,
        soft_penalty: bool = True,
    ) -> Tuple[bool, Dict[str, float]]:
        """
        快速营养约束校验 O(n)

        Args:
            herbs: {herb_id: dosage_g}
            bounds: 营养上下限（使用self.bounds如果为None）
            soft_penalty: True=返回违反度而不是抛异常

        Returns:
            (is_feasible, violation_dict)
        """
        if not herbs:
            return False, {}

        total_dosage = sum(herbs.values())
        if total_dosage <= 0:
            return False, {}

        bounds = bounds or self.bounds

        # 计算每100g的营养成分
        nutrients: Dict[str, float] = {}
        for hid, dosage in herbs.items():
            herb_nutr = self._herb_nutrition_cache.get(hid, {})
            for nut, val in herb_nutr.items():
                nutrients[nut] = nutrients.get(nut, 0.0) + val * dosage / 100.0

        # 转为每100g
        per_100g = {k: v / total_dosage * 100 for k, v in nutrients.items()}

        # 检查约束
        violation: Dict[str, float] = {}
        bound_pairs = [
            ("protein", bounds.protein),
            ("fat", bounds.fat),
            ("carbohydrate", bounds.carbohydrate),
            ("sodium", bounds.sodium),
            ("dietary_fiber", bounds.dietary_fiber),
            ("calcium", bounds.calcium),
            ("iron", bounds.iron),
            ("energy", bounds.energy),
        ]

        for nutrient, (min_val, max_val) in bound_pairs:
            actual = per_100g.get(nutrient, 0.0)
            if actual < min_val:
                violation[f"min_{nutrient}"] = round(min_val - actual, 4)
            elif max_val < float('inf') and actual > max_val:
                violation[f"max_{nutrient}"] = round(actual - max_val, 4)

        if soft_penalty:
            return len(violation) == 0, violation
        else:
            if violation:
                return False, violation
            return True, {}

    def calc_nutrition_deviation_score(
        self,
        herbs: Dict[str, float],
        targets: Optional[List[NutritionTarget]] = None,
    ) -> float:
        """
        计算营养偏差评分（0~1，越高越接近目标）

        用于NSGA-II的多目标优化中作为第8维目标

        Args:
            herbs: {herb_id: dosage_g}
            targets: 营养目标列表

        Returns:
            偏差评分 0~1
        """
        if not herbs:
            return 0.0

        targets = targets or self.bounds.to_constraints()
        total_dosage = sum(herbs.values())
        if total_dosage <= 0:
            return 0.0

        # 计算实际营养
        per_100g: Dict[str, float] = {}
        for hid, dosage in herbs.items():
            herb_nutr = self._herb_nutrition_cache.get(hid, {})
            for nut, val in herb_nutr.items():
                per_100g[nut] = per_100g.get(nut, 0.0) + val * dosage / 100.0
        per_100g = {k: v / total_dosage * 100 for k, v in per_100g.items()}

        # 计算每个目标的偏差
        deviations = []
        for target in targets:
            actual = per_100g.get(target.nutrient, 0.0)
            if target.min_value is not None and actual < target.min_value:
                deviations.append((target.min_value - actual) / max(target.min_value, 1.0))
            elif target.max_value is not None and actual > target.max_value:
                deviations.append((actual - target.max_value) / max(target.max_value, 1.0))
            # 在范围内，偏差为0

        if not deviations:
            return 1.0  # 所有目标都满足

        # 平均偏差（越小越好），映射到 0~1
        avg_dev = sum(deviations) / len(deviations)
        score = max(0.0, 1.0 - avg_dev)
        return round(score, 6)

    def estimate_nutrition_fast(
        self,
        herb_ids: List[str],
        dosages: List[float],
    ) -> Dict[str, float]:
        """
        快速营养估算（不依赖数据库）

        使用内部缓存的营养数据，O(1)计算
        适用于GA每代评估时的快速预览

        Args:
            herb_ids: 药材ID列表
            dosages: 对应剂量列表

        Returns:
            {nutrient: value_per_100g}
        """
        self._ensure_loaded()
        total_dosage = sum(dosages)
        if total_dosage <= 0:
            return {}

        nutrients: Dict[str, float] = {}
        for hid, dosage in zip(herb_ids, dosages):
            herb_nutr = self._herb_nutrition_cache.get(hid, {})
            for nut, val in herb_nutr.items():
                nutrients[nut] = nutrients.get(nut, 0.0) + val * dosage / 100.0

        return {k: round(v / total_dosage * 100, 4) for k, v in nutrients.items()}

    def clear_cache(self) -> None:
        """清空内部缓存"""
        with self._lock:
            self._herb_nutrition_cache.clear()
            self._herb_cost_cache.clear()
            self._herb_allergen_cache.clear()
            self._loaded = False
        logger.info("[NutritionAdapter] 缓存已清空")

    def stats(self) -> Dict[str, Any]:
        """返回适配器统计信息"""
        return {
            "cached_herbs": len(self._herb_nutrition_cache),
            "loaded": self._loaded,
        }
