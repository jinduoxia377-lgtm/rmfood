"""
药食同源药材 — 活性肽 跨域协同评估引擎

通过靶点 (target) 作为桥梁，计算中药化合物与活性肽之间的间接协同效应：
  中药化合物 X → 靶点 Y ← 活性肽 Z  → 共享靶点 = 协同潜力

核心功能：
1. 靶点桥梁计算 — 基于知识图谱 KGNode/KGEdge 查找中药-肽共享靶点
2. 复合生物活性评分 — 结合中药化合物功效 + 肽的 DFBP 活性
3. 中药-肽网络协同评分 — 三层模型（功效互补 + 靶点共享 + 剂量协调）
4. 肽库数据加载 — 从 BioactivePeptide / TCMCompound 加载可用肽数据

@version 2.0.0
"""

import logging
import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════
# 数据定义
# ════════════════════════════════════════════

@dataclass
class PeptideEntry:
    """肽条目（从数据库加载）"""
    id: int
    sequence: str
    activity_type: Optional[str]
    activity_value: Optional[float]
    activity_unit: Optional[str]
    molecular_weight: Optional[float]
    source_protein: Optional[str]
    dfbp_id: Optional[str]
    inferred_targets: List[str] = field(default_factory=list)


@dataclass
class CompoundEntry:
    """化合物条目（从 TCMSP 加载）"""
    id: int
    name: str
    herb_id: Optional[str]
    ob_percent: Optional[float]
    dl_value: Optional[float]
    inferred_targets: List[str] = field(default_factory=list)


@dataclass
class TargetBridge:
    """靶点桥梁关系"""
    target_name: str
    herb_compound_ids: List[int] = field(default_factory=list)
    peptide_ids: List[int] = field(default_factory=list)
    strength: float = 0.0


@dataclass
class HerbPeptideSynergy:
    """中药-肽协同评估结果"""
    herb_id: str
    peptide_id: int
    peptide_sequence: str = ""
    synergy_score: float = 0.0
    efficacy_complement: float = 0.0
    target_share_count: int = 0
    target_bridge_strength: float = 0.0
    dose_coordination: float = 0.0


@dataclass
class PeptideActivityProfile:
    """肽活性画像（用于 GA 评估）"""
    peptide_id: int
    sequence: str
    activity_types: List[str] = field(default_factory=list)
    avg_activity_value: float = 0.0
    molecular_weight: Optional[float] = None


# ════════════════════════════════════════════
# 靶点桥梁计算器
# ════════════════════════════════════════════

class TargetBridgeCalculator:
    """
    靶点桥梁计算器

    通过知识图谱查找中药化合物与活性肽之间的共享靶点：
      化合物 X → targets → 靶点 Y ← targets ← 肽 Z

    依赖：
    - KGNode / KGEdge 表
    - TCMCompound 表
    - BioactivePeptide 表
    - PeptideActivity 表
    """

    def __init__(self, db_session_factory=None):
        self.db_session_factory = db_session_factory
        self._herb_targets: Dict[str, Set[str]] = {}
        self._peptide_targets: Dict[int, Set[str]] = {}
        self._bridges: List[TargetBridge] = []
        self._loaded = False

    async def load_target_maps(self) -> None:
        """从数据库加载中药化合物靶点和肽靶点映射"""
        if self._loaded:
            return

        if self.db_session_factory is None:
            logger.warning("[TargetBridge] 未配置 DB 会话工厂，使用空映射")
            self._loaded = True
            return

        try:
            from sqlalchemy import text
            async with self.db_session_factory() as session:
                # 加载中药化合物-靶点关系
                result = await session.execute(text("""
                    SELECT tc.compound_id, tc.target_id, tc.confidence
                    FROM tcm_compound_targets tc
                    WHERE tc.confidence > 0.3
                """))
                for row in result:
                    compound_id = row[0]
                    target_id = row[1]
                    confidence = row[2] or 0.5

                    herb_result = await session.execute(text("""
                        SELECT hc.herb_id FROM tcm_herb_compounds hc
                        WHERE hc.compound_id = :cid
                        LIMIT 1
                    """), {"cid": compound_id})
                    herb_row = herb_result.scalar_one_or_none()
                    herb_id = herb_row if herb_row else f"compound_{compound_id}"

                    target_result = await session.execute(text("""
                        SELECT name FROM tcm_targets WHERE id = :tid
                    """), {"tid": target_id})
                    target_name = target_result.scalar_one_or_none() or f"target_{target_id}"

                    self._herb_targets.setdefault(herb_id, set()).add(target_name)

                # 加载肽-靶点关系（通过知识图谱）
                kg_result = await session.execute(text("""
                    SELECT s.label, t.label
                    FROM kg_edges e
                    JOIN kg_nodes s ON s.id = e.source_id
                    JOIN kg_nodes t ON t.id = e.target_id
                    WHERE e.edge_type = 'targets'
                      AND (
                        (s.node_type = 'compound' AND t.node_type = 'target')
                        OR
                        (s.node_type = 'target' AND t.node_type = 'peptide')
                      )
                """))
                for row in kg_result:
                    src_type = row[0]
                    tgt_type = row[1]
                    # 简化处理：通过标签匹配肽ID
                    if tgt_type == 'target':
                        # 反向查找肽节点
                        peptide_result = await session.execute(text("""
                            SELECT kn.node_label FROM kg_nodes kn
                            JOIN kg_edges e2 ON e2.target_id = kn.id
                            WHERE e2.edge_type = 'targets'
                              AND kn.node_type = 'peptide'
                            LIMIT 1
                        """))
                        peptide_label = peptide_result.scalar_one_or_none()
                        if peptide_label:
                            # 从标签提取肽ID（格式: peptide_123）
                            try:
                                pid = int(peptide_label.split("_")[-1])
                                self._peptide_targets.setdefault(pid, set()).add(src_type)
                            except (ValueError, IndexError):
                                pass

                self._loaded = True
                logger.info(
                    f"[TargetBridge] 加载完成: "
                    f"中药靶点={len(self._herb_targets)}种, "
                    f"肽靶点={len(self._peptide_targets)}种"
                )

        except Exception as e:
            logger.warning(f"[TargetBridge] 靶点加载失败: {e}")
            self._loaded = True

    def find_target_bridges(
        self,
        herb_ids: List[str],
        peptide_ids: List[int]
    ) -> List[TargetBridge]:
        """查找指定药材和肽之间的靶点桥梁"""
        bridges: Dict[str, TargetBridge] = {}

        herb_targets_set: Set[str] = set()
        for hid in herb_ids:
            targets = self._herb_targets.get(hid, set())
            herb_targets_set |= targets
            for t in targets:
                bridge = bridges.setdefault(
                    t,
                    TargetBridge(target_name=t)
                )
                bridge.herb_compound_ids.append(hash(hid) % 10000)

        for pid in peptide_ids:
            targets = self._peptide_targets.get(pid, set())
            for t in targets:
                if t in herb_targets_set:
                    bridge = bridges.setdefault(
                        t,
                        TargetBridge(target_name=t)
                    )
                    bridge.peptide_ids.append(pid)

        for bridge in bridges.values():
            total_targets = len(herb_targets_set | set(
                self._peptide_targets.get(pid, set()) for pid in bridge.peptide_ids
            ))
            if total_targets > 0:
                bridge.strength = min(
                    1.0, len(bridge.herb_compound_ids) / max(total_targets, 1)
                )

        result = [b for b in bridges.values() if b.herb_compound_ids and b.peptide_ids]
        result.sort(key=lambda b: b.strength, reverse=True)
        self._bridges = result
        return result

    def get_shared_target_count(
        self,
        herb_id: str,
        peptide_id: int
    ) -> Tuple[int, float]:
        """获取单个药材-肽对的共享靶点数和桥梁强度"""
        herb_t = self._herb_targets.get(herb_id, set())
        peptide_t = self._peptide_targets.get(peptide_id, set())
        shared = herb_t & peptide_t
        union = herb_t | peptide_t
        strength = len(shared) / max(len(union), 1)
        return len(shared), strength


# ════════════════════════════════════════════
# 肽活性画像加载器
# ════════════════════════════════════════════

class PeptideProfileLoader:
    """从数据库加载肽活性画像"""

    def __init__(self, db_session_factory=None):
        self.db_session_factory = db_session_factory
        self._profiles: Dict[int, PeptideActivityProfile] = {}

    async def load_profiles(self) -> Dict[int, PeptideActivityProfile]:
        """加载所有肽的活性画像"""
        if self.db_session_factory is None:
            logger.warning("[PeptideLoader] 未配置 DB 会话工厂")
            return self._profiles

        try:
            from sqlalchemy import text
            async with self.db_session_factory() as session:
                result = await session.execute(text("""
                    SELECT id, sequence, activity_type, activity_value,
                           activity_unit, molecular_weight, source_protein
                    FROM bioactive_peptides
                    WHERE deleted_at IS NULL
                    ORDER BY id
                """))
                rows = result.fetchall()

                for row in rows:
                    pid, seq, atype, aval, aunit, mw, sp = row
                    profile = PeptideActivityProfile(
                        peptide_id=pid,
                        sequence=seq[:50],
                        molecular_weight=mw,
                    )

                    if atype:
                        profile.activity_types.append(atype)
                    if aval is not None:
                        profile.avg_activity_value = aval

                    self._profiles[pid] = profile

                logger.info(f"[PeptideLoader] 加载 {len(self._profiles)} 个肽画像")

        except Exception as e:
            logger.warning(f"[PeptideLoader] 加载失败: {e}")

        return self._profiles

    def get_profile(self, peptide_id: int) -> Optional[PeptideActivityProfile]:
        return self._profiles.get(peptide_id)

    def get_profiles_by_activity(self, activity_type: str) -> List[PeptideActivityProfile]:
        return [
            p for p in self._profiles.values()
            if activity_type in p.activity_types
        ]

    @property
    def all_peptide_ids(self) -> List[int]:
        return list(self._profiles.keys())


# ════════════════════════════════════════════
# 中药-肽协同评估器
# ════════════════════════════════════════════

class HerbPeptideSynergyEvaluator:
    """
    中药-肽协同效应评估器

    三层评分模型：
    Layer 1 - 功效互补度 (0~0.4): Jaccard 差异集分析
    Layer 2 - 靶点桥梁强度 (0~0.3): TargetBridgeCalculator
    Layer 3 - 剂量协调度 (0~0.3): 主辅比例 2:1 ~ 4:1
    """

    def __init__(
        self,
        target_bridge: Optional[TargetBridgeCalculator] = None,
        peptide_loader: Optional[PeptideProfileLoader] = None,
    ):
        self.bridge = target_bridge or TargetBridgeCalculator()
        self.peptide_loader = peptide_loader or PeptideProfileLoader()

    def evaluate_herb_peptide_synergy(
        self,
        herb_id: str,
        peptide_id: int,
        peptide_dosage: float,
        herb_dosage: float,
        herb_efficacy_scores: Optional[Dict[str, float]] = None,
        use_database_lookup: bool = True,
    ) -> HerbPeptideSynergy:
        """评估单个药材-肽对的协同效应"""
        synergy = HerbPeptideSynergy(
            herb_id=herb_id,
            peptide_id=peptide_id,
        )

        profile = self.peptide_loader.get_profile(peptide_id)
        if profile:
            synergy.peptide_sequence = profile.sequence[:30]
        else:
            synergy.peptide_sequence = f"peptide_{peptide_id}"

        # Layer 1: 功效互补度
        efficacy_complement = self._compute_efficacy_complement(
            herb_id, herb_efficacy_scores, profile
        )
        synergy.efficacy_complement = efficacy_complement

        # Layer 2: 靶点桥梁强度
        if use_database_lookup and self.bridge.db_session_factory:
            shared_count, bridge_strength = self.bridge.get_shared_target_count(
                herb_id, peptide_id
            )
            synergy.target_share_count = shared_count
            synergy.target_bridge_strength = bridge_strength
        else:
            synergy.target_share_count = 0
            synergy.target_bridge_strength = 0.1

        # Layer 3: 剂量协调度
        dose_coord = self._compute_dose_coordination(herb_dosage, peptide_dosage)
        synergy.dose_coordination = dose_coord

        # 综合协同分
        synergy.synergy_score = (
            efficacy_complement * 0.40 +
            synergy.target_bridge_strength * 0.30 +
            dose_coord * 0.30
        )
        synergy.synergy_score = max(0.0, min(1.0, synergy.synergy_score))

        return synergy

    def _compute_efficacy_complement(
        self,
        herb_id: str,
        herb_efficacy_scores: Optional[Dict[str, float]],
        peptide_profile: Optional[PeptideActivityProfile],
    ) -> float:
        """功效互补度 (0~0.4)"""
        if not herb_efficacy_scores and not peptide_profile:
            return 0.15

        herb_effects = set(herb_efficacy_scores.keys()) if herb_efficacy_scores else set()
        peptide_effects = set(peptide_profile.activity_types) if peptide_profile else set()

        if not herb_effects and not peptide_effects:
            return 0.15

        union = herb_effects | peptide_effects
        if not union:
            return 0.15

        overlap = len(herb_effects & peptide_effects)
        diff = len(herb_effects ^ peptide_effects)
        jaccard = overlap / max(len(union), 1)
        diff_score = diff / max(len(union), 1)

        complement = 0.15 * (1 - jaccard) + 0.25 * diff_score
        return max(0.0, min(0.4, complement))

    def _compute_dose_coordination(
        self, herb_dosage: float, peptide_dosage: float
    ) -> float:
        """剂量协调度 (0~0.3)"""
        if herb_dosage <= 0 or peptide_dosage <= 0:
            return 0.15

        ratio = herb_dosage / max(peptide_dosage, 0.001)

        if 2.0 <= ratio <= 4.0:
            return 0.30
        elif 1.0 <= ratio < 2.0 or 4.0 < ratio <= 6.0:
            return 0.25
        elif ratio > 6.0:
            return max(0.10, 0.30 - (ratio - 6.0) * 0.02)
        else:
            return 0.20

    def evaluate_batch(
        self,
        herb_peptide_pairs: List[Tuple[str, int, float, float, Optional[Dict[str, float]]]]
    ) -> List[HerbPeptideSynergy]:
        """批量评估药材-肽协同效应"""
        return [
            self.evaluate_herb_peptide_synergy(*pair)
            for pair in herb_peptide_pairs
        ]


# ════════════════════════════════════════════
# 模块级工厂函数
# ════════════════════════════════════════════

_global_bridge: Optional[TargetBridgeCalculator] = None
_global_loader: Optional[PeptideProfileLoader] = None
_global_evaluator: Optional[HerbPeptideSynergyEvaluator] = None


def get_herb_peptide_bridge(db_session_factory=None) -> TargetBridgeCalculator:
    global _global_bridge
    if _global_bridge is None:
        _global_bridge = TargetBridgeCalculator(db_session_factory)
    return _global_bridge


def get_peptide_loader(db_session_factory=None) -> PeptideProfileLoader:
    global _global_loader
    if _global_loader is None:
        _global_loader = PeptideProfileLoader(db_session_factory)
    return _global_loader


def get_herb_peptide_evaluator(db_session_factory=None) -> HerbPeptideSynergyEvaluator:
    global _global_evaluator
    if _global_evaluator is None:
        bridge = get_herb_peptide_bridge(db_session_factory)
        loader = get_peptide_loader(db_session_factory)
        _global_evaluator = HerbPeptideSynergyEvaluator(bridge, loader)
    return _global_evaluator
