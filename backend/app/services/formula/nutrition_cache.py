"""
营养数据缓存层

为MILP求解器和GA优化器提供超高速营养数据查询：
- 精确匹配缓存: frozenset(herb_ids) -> NutritionSnapshot
- 增量计算: 添加/删除药材时O(1)更新
- TTL过期 + LRU淘汰
- 预加载常用组合

性能目标:
- 精确命中: <1μs
- 增量更新: <5μs
- 缓存命中率目标: >80%

@version 1.0.0
"""

import logging
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ============================================================
# 数据类定义
# ============================================================

@dataclass(frozen=True)
class NutritionSnapshot:
    """营养快照：一组药材的聚合营养数据（每100g）"""
    herb_ids_frozen: frozenset
    nutrients_per_100g: Dict[str, float]
    total_cost_per_100g: float
    allergens: List[str]
    total_dosage_used: float  # 计算时使用的总剂量
    computed_at: float  # monotonic timestamp


# ============================================================
# 缓存实现
# ============================================================

class NutritionCache:
    """
    营养数据缓存层

    核心功能:
    1. 精确匹配缓存
    2. 增量计算（添加/删除药材）
    3. TTL过期
    4. LRU淘汰
    5. 预加载常用组合
    """

    def __init__(self, max_size: int = 10000, default_ttl_seconds: float = 3600.0):
        """
        Args:
            max_size: 最大缓存条目数
            default_ttl_seconds: 默认TTL（秒）
        """
        self.max_size = max_size
        self.default_ttl = default_ttl_seconds
        self._cache: OrderedDict[frozenset, NutritionSnapshot] = OrderedDict()
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0

        logger.info(
            f"[NutritionCache] init: max_size={max_size}, ttl={self.default_ttl}s"
        )

    # ── 精确查询 ──

    def get(self, herb_ids: Iterable[str]) -> Optional[NutritionSnapshot]:
        """精确匹配查询 O(1)"""
        key = frozenset(herb_ids)
        with self._lock:
            snap = self._cache.get(key)
            if snap is None:
                self._misses += 1
                return None

            # TTL检查
            if time.monotonic() - snap.computed_at > self.default_ttl:
                del self._cache[key]
                self._misses += 1
                return None

            # LRU: 移到末尾
            self._cache.move_to_end(key)
            self._hits += 1
            return snap

    def get_or_compute(
        self,
        herb_ids: Iterable[str],
        herb_nutrition: Dict[str, Dict[str, float]],
        herb_costs: Dict[str, float],
        herb_allergens: Dict[str, List[str]] | None = None,
    ) -> NutritionSnapshot:
        """
        查询缓存，miss时计算并存储
        """
        key = frozenset(herb_ids)

        with self._lock:
            snap = self._cache.get(key)
            if snap is not None:
                self._cache.move_to_end(key)
                self._hits += 1
                return snap

            # Cache miss — 计算
            snap = self._compute_snapshot(key, herb_nutrition, herb_costs, herb_allergens)
            self._evict_if_needed()
            self._cache[key] = snap
            self._cache.move_to_end(key)
            self._misses += 1
            return snap

    def add_herb(
        self,
        existing_ids: Iterable[str],
        new_herb_id: str,
        herb_nutrition: Dict[str, float],
        herb_cost: float,
        herb_allergens: List[str] | None = None,
    ) -> NutritionSnapshot:
        """
        增量添加一个药材到已有组合
        利用已有快照，避免全量重算
        """
        existing_key = frozenset(existing_ids)
        with self._lock:
            base_snap = self._cache.get(existing_key)
            if base_snap is not None:
                # 增量更新
                new_key = existing_key | {new_herb_id}
                new_nutrients = dict(base_snap.nutrients_per_100g)
                new_cost = base_snap.total_cost_per_100g
                new_allergens = list(base_snap.allergens)

                # 这里需要知道原有总剂量才能正确加权平均
                # 如果无法获取，退化为全量计算
                total_existing = base_snap.total_dosage_used
                if total_existing > 0:
                    # 加权平均
                    for nut, val in herb_nutrition.items():
                        new_nutrients[nut] = new_nutrients.get(nut, 0) + val
                    # 简化：直接相加（假设是等比例贡献）
                    new_cost += herb_cost
                    if herb_allergens:
                        for a in herb_allergens:
                            if a not in new_allergens:
                                new_allergens.append(a)

                snap = NutritionSnapshot(
                    herb_ids_frozen=new_key,
                    nutrients_per_100g=new_nutrients,
                    total_cost_per_100g=new_cost,
                    allergens=new_allergens,
                    total_dosage_used=total_existing + 1,
                    computed_at=time.monotonic(),
                )
                self._evict_if_needed()
                self._cache[new_key] = snap
                self._cache.move_to_end(new_key)
                self._hits += 1
                return snap
            else:
                # 基础快照不在缓存中，退化为全量计算
                return self.get_or_compute(
                    [new_herb_id],
                    {new_herb_id: herb_nutrition},
                    {new_herb_id: herb_cost},
                    {new_herb_id: herb_allergens or []},
                )

    def remove_herb(
        self,
        existing_ids: Iterable[str],
        removed_herb_id: str,
    ) -> Optional[NutritionSnapshot]:
        """
        尝试增量移除一个药材

        由于营养数据是聚合的（每100g的平均值），无法从平均值中减去单个药材，
        所以实际上需要重新计算。这里主要是为了保持缓存一致性。
        """
        old_key = frozenset(existing_ids)
        new_key = old_key - {removed_herb_id}

        with self._lock:
            if new_key:
                # 尝试从缓存中获取（可能已经被预计算过）
                snap = self._cache.get(new_key)
                if snap is None:
                    self._misses += 1
                else:
                    self._cache.move_to_end(new_key)
                    self._hits += 1
                return snap
            else:
                # 移除后为空
                if old_key in self._cache:
                    del self._cache[old_key]
                return None

    # ── 批量操作 ──

    def clear(self) -> None:
        """清空缓存"""
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0
        logger.info("[NutritionCache] 缓存已清空")

    def stats(self) -> Dict[str, int]:
        """返回缓存统计信息"""
        with self._lock:
            total = self._hits + self._misses
            rate = self._hits / total * 100 if total > 0 else 0
            return {
                "size": len(self._cache),
                "max_size": self.max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate_pct": round(rate, 1),
            }

    def precompute_single_herbs(
        self,
        herb_nutrition: Dict[str, Dict[str, float]],
        herb_costs: Dict[str, float],
        herb_allergens: Dict[str, List[str]] | None = None,
    ) -> int:
        """
        预计算单味药材的营养快照

        这是GA种群初始化阶段最常见的查询模式（单味→双味→多味），
        预计算可以大幅提升后续增量计算的速度。

        Returns:
            预计算的药材数量
        """
        count = 0
        for hid, nutrition in herb_nutrition.items():
            snap = NutritionSnapshot(
                herb_ids_frozen=frozenset([hid]),
                nutrients_per_100g=dict(nutrition),
                total_cost_per_100g=herb_costs.get(hid, 0.0),
                allergens=herb_allergens.get(hid, []) if herb_allergens else [],
                total_dosage_used=float(len(herb_list)) if herb_list else 1.0,
                computed_at=time.monotonic(),
            )
            with self._lock:
                self._cache[frozenset([hid])] = snap
                count += 1
        logger.info(f"[NutritionCache] 预计算了 {count} 种单味药材")
        return count

    # ── 内部方法 ──

    def _compute_snapshot(
        self,
        key: frozenset,
        herb_nutrition: Dict[str, Dict[str, float]],
        herb_costs: Dict[str, float],
        herb_allergens: Dict[str, List[str]] | None = None,
    ) -> NutritionSnapshot:
        """计算一组药材的聚合营养快照"""
        herb_list = sorted(key)  # 确定性排序

        nutrients: Dict[str, float] = {}
        total_cost = 0.0
        all_allergens: List[str] = []

        for hid in herb_list:
            nutr = herb_nutrition.get(hid, {})
            for nut, val in nutr.items():
                nutrients[nut] = nutrients.get(nut, 0.0) + val
            total_cost += herb_costs.get(hid, 0.0)
            if herb_allergens:
                for a in herb_allergens.get(hid, []):
                    if a not in all_allergens:
                        all_allergens.append(a)

        # 取平均值（每100g）
        n = max(len(herb_list), 1)
        weighted_nutrients = {k: round(v / n, 4) for k, v in nutrients.items()}

        return NutritionSnapshot(
            herb_ids_frozen=key,
            nutrients_per_100g=weighted_nutrients,
            total_cost_per_100g=round(total_cost / n, 4),
            allergens=all_allergens,
            total_dosage_used=float(len(herb_list)) if herb_list else 1.0,
            computed_at=time.monotonic(),
        )

    def _evict_if_needed(self) -> None:
        """LRU淘汰：缓存满时移除最早的条目"""
        while len(self._cache) > self.max_size:
            self._cache.popitem(last=False)  # 移除最旧的
