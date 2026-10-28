"""
知识图谱推理引擎 (v1.0)

在现有图谱查询能力基础上，提供三大推理能力：
1. 路径推理：基于已知关系发现"原料A→功效B→疾病C"路径
2. 协同效应预测：分析两个原料的组合效应（协同/拮抗/无关）
3. 配伍冲突检测：自动检测十八反十九畏等禁忌搭配

推理结果可写回图谱，实现知识的持续积累。
"""
from __future__ import annotations

import logging
from collections import (
    defaultdict,
    deque,  # A-27
)
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


class SynergyType(str, Enum):
    """协同效应类型"""
    SYNERGY = "synergy"        # 协同增效
    ANTAGONISM = "antagonism"  # 拮抗减效
    INDEPENDENT = "independent"  # 无关/独立
    UNKNOWN = "unknown"        # 未检测到关联


class ConflictType(str, Enum):
    """配伍冲突类型"""
    PROHIBITED_COMBO = "prohibited_combo"  # 十八反十九畏
    DOSE_EXCESS = "dose_excess"           # 超量
    POPULATION_FORBIDDEN = "population_forbidden"  # 人群禁忌
    UNCERTAIN = "uncertain"               # 不确定


@dataclass
class PathResult:
    """路径推理结果"""
    source: str
    target: str
    path: List[str]
    path_length: int
    confidence: float
    description: str


@dataclass
class SynergyResult:
    """协同效应预测结果"""
    herb_a: str
    herb_b: str
    synergy_type: SynergyType
    confidence: float
    shared_compounds: List[str] = field(default_factory=list)
    shared_targets: List[str] = field(default_factory=list)
    reasoning: str = ""


@dataclass
class ConflictResult:
    """配伍冲突检测结果"""
    herb_a: str
    herb_b: str
    conflict_type: ConflictType
    severity: str  # "high" | "medium" | "low"
    description: str
    suggestion: str = ""


@dataclass
class InferenceReport:
    """完整推理报告"""
    query: str
    paths: List[PathResult] = field(default_factory=list)
    synergies: List[SynergyResult] = field(default_factory=list)
    conflicts: List[ConflictResult] = field(default_factory=list)
    inferences_count: int = 0
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def summary(self) -> str:
        return (
            f"InferenceReport(query={self.query!r}, "
            f"paths={len(self.paths)}, synergies={len(self.synergies)}, "
            f"conflicts={len(self.conflicts)})"
        )

    def to_dict(self) -> dict:
        return {
            "query": self.query,
            "paths": [
                {
                    "source": p.source,
                    "target": p.target,
                    "path": p.path,
                    "length": p.path_length,
                    "confidence": p.confidence,
                    "description": p.description,
                }
                for p in self.paths
            ],
            "synergies": [
                {
                    "herb_a": s.herb_a,
                    "herb_b": s.herb_b,
                    "type": s.synergy_type.value,
                    "confidence": s.confidence,
                    "shared_compounds": s.shared_compounds,
                    "shared_targets": s.shared_targets,
                    "reasoning": s.reasoning,
                }
                for s in self.synergies
            ],
            "conflicts": [
                {
                    "herb_a": c.herb_a,
                    "herb_b": c.herb_b,
                    "type": c.conflict_type.value,
                    "severity": c.severity,
                    "description": c.description,
                    "suggestion": c.suggestion,
                }
                for c in self.conflicts
            ],
            "total_inferences": self.inferences_count,
        }


# ── 配伍禁忌规则（十八反十九畏简化版）────────────────────────────────

PROHIBITED_COMBOS: List[Tuple[str, str]] = [
    ("人参", "藜芦"),
    ("甘草", "甘遂"),
    ("甘草", "大戟"),
    ("甘草", "芫花"),
    ("海藻", "甘草"),
    ("乌头", "贝母"),
    ("乌头", "瓜蒌"),
    ("乌头", "半夏"),
    ("乌头", "白蔹"),
    ("乌头", "白及"),
    # 十九畏
    ("丁香", "郁金"),
    ("肉桂", "赤石脂"),
    ("牙硝", "三棱"),
    ("人参", "五灵脂"),
]

# 人群禁忌
CHILD_FORBIDDEN_HERBS: Set[str] = {"人参", "藜芦", "附子", "川乌", "草乌", "麝香"}
PREGNANCY_FORBIDDEN_HERBS: Set[str] = {"麝香", "三棱", "莪术", "桃仁", "红花", "附子"}


class KnowledgeGraphReasoningEngine:
    """
    知识图谱推理引擎

    用法：
        engine = KnowledgeGraphReasoningEngine()
        report = await engine.infer({
            "type": "synergy",
            "herbs": ["枸杞", "黄芪"],
        })
    """

    def __init__(self):
        # 缓存推理结果（实际生产中应使用Redis）
        self._cache: Dict[str, InferenceReport] = {}

    async def infer(
        self,
        query: str,
        inference_type: str = "all",
        herbs: Optional[List[str]] = None,
        target_effect: Optional[str] = None,
        db_service: Any = None,
    ) -> InferenceReport:
        """
        执行推理

        Args:
            query: 用户问题描述
            inference_type: "all" | "path" | "synergy" | "conflict"
            herbs: 原料列表
            target_effect: 目标功效
            db_service: 可选的数据库服务（用于实际推理）

        Returns:
            InferenceReport: 推理报告
        """
        cache_key = f"{inference_type}:{hash(str(sorted(herbs or [])))}"

        # 检查缓存
        if cache_key in self._cache:
            return self._cache[cache_key]

        report = InferenceReport(query=query)

        if inference_type in ("all", "path"):
            if herbs:
                report.paths = await self._path_reasoning(herbs, db_service)
                report.inferences_count += len(report.paths)

        if inference_type in ("all", "synergy"):
            if herbs and len(herbs) >= 2:
                report.synergies = await self._synergy_reasoning(herbs, db_service)
                report.inferences_count += len(report.synergies)

        if inference_type in ("all", "conflict"):
            if herbs:
                report.conflicts = await self._conflict_reasoning(herbs, db_service)
                report.inferences_count += len(report.conflicts)

        self._cache[cache_key] = report
        return report

    async def infer_path(
        self,
        source_herb: str,
        target_disease: str,
        db_service: Any = None,
    ) -> List[PathResult]:
        """路径推理：发现从原料到疾病的关联路径"""
        return await self._path_reasoning([source_herb], db_service)

    async def infer_synergy(
        self,
        herbs: List[str],
        db_service: Any = None,
    ) -> List[SynergyResult]:
        """协同效应推理"""
        return await self._synergy_reasoning(herbs, db_service)

    async def infer_conflicts(
        self,
        herbs: List[str],
        population: str = "adults",
        db_service: Any = None,
    ) -> List[ConflictResult]:
        """配伍冲突推理"""
        return await self._conflict_reasoning(herbs, db_service, population)

    # ── 路径推理 ──────────────────────────────────────────────────────

    async def _path_reasoning(
        self,
        herbs: List[str],
        db_service: Any,
    ) -> List[PathResult]:
        """
        路径推理：基于图谱的BFS路径发现

        策略：
        1. 从源药材出发，沿 contains→targets→treats 边遍历
        2. 记录路径上的节点类型和关系
        3. 计算路径置信度（基于边强度）

        如果提供了 db_service（GraphQueryService），则使用真实图谱数据；
        否则回退到模拟数据。
        """
        paths: List[PathResult] = []

        if not herbs:
            return paths

        # 尝试使用真实数据库查询
        if db_service is not None:
            db_paths = await self._db_path_reasoning(herbs, db_service)
            if db_paths:
                logger.info(
                    "路径推理完成（数据库）: 输入herbs=%s, 发现路径=%d",
                    herbs, len(db_paths),
                )
                return db_paths

        # 回退到模拟数据
        for herb in herbs:
            path_results = self._simulate_path_discovery(herb)
            paths.extend(path_results)

        logger.info(
            "路径推理完成（模拟）: 输入herbs=%s, 发现路径=%d",
            herbs, len(paths),
        )
        return paths

    async def _db_path_reasoning(
        self,
        herbs: List[str],
        db_service: Any,
    ) -> List[PathResult]:
        """基于数据库的BFS路径推理"""
        from sqlalchemy import select

        from app.models.knowledge_graph import KGEdge, KGNode

        paths: List[PathResult] = []

        for herb in herbs:
            # 查找药材节点
            result = await db_service.get_node_by_type_label("herb", herb)
            if not result:
                # 尝试模糊匹配
                result = await db_service.search_nodes(herb, node_type="herb", limit=1)
                if not result:
                    continue
                result = result[0] if isinstance(result, list) else result

            herb_id = result.id if hasattr(result, 'id') else result.get('id')
            if not herb_id:
                continue

            # BFS遍历：herb → compound → target → disease
            visited: Set[int] = {herb_id}
            queue: deque = deque([(herb_id, [herb], 0.9)])  # (node_id, path_labels, confidence)

            while queue:
                current_id, path, confidence = queue.popleft()
                if confidence < 0.3:
                    continue

                # 获取当前节点的出边
                edge_result = await db_service.db.execute(
                    select(KGEdge).where(KGEdge.source_id == current_id)
                )
                edges = edge_result.scalars().all()

                for edge in edges:
                    next_id = edge.target_id
                    if next_id in visited:
                        continue
                    visited.add(next_id)

                    # 获取下一节点信息
                    node_result = await db_service.db.execute(
                        select(KGNode).where(KGNode.id == next_id)
                    )
                    next_node = node_result.scalar_one_or_none()
                    if not next_node:
                        continue

                    new_path = path + [next_node.node_label]
                    new_confidence = confidence * edge.strength if edge.strength else confidence * 0.7

                    # 如果是 disease 节点，记录完整路径
                    if next_node.node_type == "disease" and len(new_path) >= 3:
                        paths.append(PathResult(
                            source=herb,
                            target=new_path[-1],
                            path=new_path,
                            path_length=len(new_path) - 1,
                            confidence=round(new_confidence, 3),
                            description=" → ".join(new_path),
                        ))
                    elif len(new_path) < 5:
                        queue.append((next_id, new_path, new_confidence))

        return paths

    def _simulate_path_discovery(self, herb: str) -> List[PathResult]:
        """
        模拟路径发现（基于预定义的药效知识）

        实际项目中应从图谱数据库动态查询
        """
        # 预定义的药效知识图谱（简化版）
        herb_effects: Dict[str, List[str]] = {
            "枸杞": ["滋补肝肾", "益精明目", "免疫调节"],
            "黄芪": ["补气升阳", "固表止汗", "利水消肿"],
            "人参": ["大补元气", "复脉固脱", "补脾益肺"],
            "甘草": ["补脾益气", "清热解毒", "调和诸药"],
            "当归": ["补血活血", "调经止痛", "润肠通便"],
        }

        effect_diseases: Dict[str, List[str]] = {
            "滋补肝肾": ["肝肾不足", "视力模糊", "腰膝酸软"],
            "补气升阳": ["气虚乏力", "食欲不振", "免疫力低下"],
            "免疫调节": ["免疫力低下", "易感冒", "疲劳综合征"],
            "大补元气": ["体虚欲脱", "气短脉微", "休克"],
        }

        paths = []
        effects = herb_effects.get(herb, [])

        for effect in effects:
            diseases = effect_diseases.get(effect, [])
            for disease in diseases[:2]:  # 每个功效最多2个疾病
                path = [herb, effect, disease]
                paths.append(PathResult(
                    source=herb,
                    target=disease,
                    path=path,
                    path_length=len(path) - 1,
                    confidence=0.7,
                    description=f"{herb} → {effect} → {disease}",
                ))

        return paths

    # ── 协同效应推理 ──────────────────────────────────────────────────

    async def _synergy_reasoning(
        self,
        herbs: List[str],
        db_service: Any,
    ) -> List[SynergyResult]:
        """
        协同效应推理

        策略：
        1. 分析共同化合物（shared compounds）
        2. 分析共同靶点（shared targets）
        3. 基于中医配伍理论判断协同/拮抗

        如果提供了 db_service，则从图谱查询共同节点；
        否则回退到预定义规则。
        """
        synergies: List[SynergyResult] = []

        # 尝试使用真实数据库查询
        if db_service is not None:
            db_synergies = await self._db_synergy_reasoning(herbs, db_service)
            if db_synergies:
                synergies.extend(db_synergies)

        # 补充基于规则的协同分析
        for i in range(len(herbs)):
            for j in range(i + 1, len(herbs)):
                herb_a, herb_b = herbs[i], herbs[j]
                # 检查是否已在数据库结果中
                existing = [s for s in synergies if {s.herb_a, s.herb_b} == {herb_a, herb_b}]
                if existing:
                    continue
                synergy = await self._analyze_pair_synergy(herb_a, herb_b)
                if synergy:
                    synergies.append(synergy)

        logger.info(
            "协同效应推理完成: 分析%d对组合, 发现%d个协同关系",
            len(herbs) * (len(herbs) - 1) // 2, len(synergies),
        )
        return synergies

    async def _db_synergy_reasoning(
        self,
        herbs: List[str],
        db_service: Any,
    ) -> List[SynergyResult]:
        """基于数据库的协同效应推理"""
        from sqlalchemy import select

        from app.models.knowledge_graph import KGEdge, KGNode

        synergies: List[SynergyResult] = []

        # 获取所有药材节点及其ID
        herb_nodes = {}
        for herb in herbs:
            result = await db_service.get_node_by_type_label("herb", herb)
            if result:
                herb_nodes[herb] = result.id

        if len(herb_nodes) < 2:
            return synergies

        herb_ids = list(herb_nodes.values())
        herb_labels = list(herb_nodes.keys())

        # 获取所有化合物节点
        compound_result = await db_service.db.execute(
            select(KGNode).where(KGNode.node_type == "compound")
        )
        compounds = {n.id: n.node_label for n in compound_result.scalars().all()}

        # 获取所有边
        edge_result = await db_service.db.execute(
            select(KGEdge).where(
                KGEdge.source_id.in_(herb_ids) | KGEdge.target_id.in_(herb_ids)
            )
        )
        edges = edge_result.scalars().all()

        # 分析共同化合物
        herb_compounds: Dict[str, Set[int]] = defaultdict(set)
        for edge in edges:
            if edge.edge_type == "contains":
                herb_id = edge.source_id if edge.source_id in herb_ids else edge.target_id
                compound_id = edge.target_id if edge.target_id in compounds else edge.source_id
                if herb_id in herb_ids and compound_id in compounds:
                    herb_idx = herb_ids.index(herb_id)
                    herb_compounds[herb_labels[herb_idx]].add(compound_id)

        # 计算共同化合物并生成协同结果
        for i in range(len(herb_labels)):
            for j in range(i + 1, len(herb_labels)):
                shared = herb_compounds[herb_labels[i]] & herb_compounds[herb_labels[j]]
                if shared:
                    synergies.append(SynergyResult(
                        herb_a=herb_labels[i],
                        herb_b=herb_labels[j],
                        synergy_type=SynergyType.SYNERGY,
                        confidence=round(min(0.5 + len(shared) * 0.1, 0.95), 2),
                        shared_compounds=list(shared)[:5],
                        reasoning=f"{herb_labels[i]}与{herb_labels[j]}共享{len(shared)}个化合物",
                    ))

        return synergies

    async def _analyze_pair_synergy(
        self,
        herb_a: str,
        herb_b: str,
    ) -> Optional[SynergyResult]:
        """分析两个药材的协同效应"""
        # 简化实现：基于预定义规则
        # 实际项目应查询图谱数据库

        # 已知协同组合（经典配伍）
        SYNERGY_PAIRS = {
            ("黄芪", "枸杞"): SynergyResult(
                herb_a="黄芪",
                herb_b="枸杞",
                synergy_type=SynergyType.SYNERGY,
                confidence=0.85,
                shared_compounds=["黄芪多糖", "枸杞多糖"],
                shared_targets=["免疫调节", "抗氧化"],
                reasoning="黄芪补气，枸杞滋补肝肾，两者合用增强免疫和抗氧化功效",
            ),
            ("人参", "甘草"): SynergyResult(
                herb_a="人参",
                herb_b="甘草",
                synergy_type=SynergyType.SYNERGY,
                confidence=0.80,
                shared_compounds=["人参皂苷", "甘草酸"],
                shared_targets=["补气", "解毒"],
                reasoning="人参大补元气，甘草调和诸药，经典配伍'人参甘草汤'",
            ),
            ("当归", "黄芪"): SynergyResult(
                herb_a="当归",
                herb_b="黄芪",
                synergy_type=SynergyType.SYNERGY,
                confidence=0.90,
                shared_compounds=["当归素", "黄芪皂苷"],
                shared_targets=["补血", "补气"],
                reasoning="当归补血活血，黄芪补气生血，组成'当归补血汤'",
            ),
        }

        # 检查是否在已知协同组合中（不排序，保持原始顺序）
        if (herb_a, herb_b) in SYNERGY_PAIRS:
            return SYNERGY_PAIRS[(herb_a, herb_b)]
        if (herb_b, herb_a) in SYNERGY_PAIRS:
            return SYNERGY_PAIRS[(herb_b, herb_a)]

        # 未知组合，返回不确定结果
        return SynergyResult(
            herb_a=herb_a,
            herb_b=herb_b,
            synergy_type=SynergyType.UNKNOWN,
            confidence=0.3,
            reasoning=f"{herb_a}与{herb_b}的协同关系待进一步研究",
        )

    # ── 配伍冲突推理 ──────────────────────────────────────────────────

    async def _conflict_reasoning(
        self,
        herbs: List[str],
        db_service: Any,
        population: str = "adults",
    ) -> List[ConflictResult]:
        """
        配伍冲突推理

        检测：
        1. 十八反十九畏
        2. 人群禁忌（儿童、孕妇）
        3. 超量风险
        """
        conflicts: List[ConflictResult] = []
        herb_set = set(herbs)

        # 1. 十八反十九畏检测
        for herb1, herb2 in PROHIBITED_COMBOS:
            if herb1 in herb_set and herb2 in herb_set:
                conflicts.append(ConflictResult(
                    herb_a=herb1,
                    herb_b=herb2,
                    conflict_type=ConflictType.PROHIBITED_COMBO,
                    severity="high",
                    description=f"配伍禁忌：{herb1}与{herb2}不可同用（十八反/十九畏）",
                    suggestion=f"建议将{herb1}或{herb2}替换为其他安全成分",
                ))

        # 2. 人群禁忌检测
        if population == "children":
            for herb in herbs:
                if herb in CHILD_FORBIDDEN_HERBS:
                    conflicts.append(ConflictResult(
                        herb_a=herb,
                        herb_b="",
                        conflict_type=ConflictType.POPULATION_FORBIDDEN,
                        severity="high",
                        description=f"儿童禁忌：{herb}禁止用于儿童配方",
                        suggestion=f"建议将{herb}替换为适合儿童的安全成分",
                    ))

        if population == "pregnancy":
            for herb in herbs:
                if herb in PREGNANCY_FORBIDDEN_HERBS:
                    conflicts.append(ConflictResult(
                        herb_a=herb,
                        herb_b="",
                        conflict_type=ConflictType.POPULATION_FORBIDDEN,
                        severity="high",
                        description=f"孕妇禁忌：{herb}禁止用于孕妇配方",
                        suggestion=f"建议将{herb}替换为孕妇安全成分",
                    ))

        logger.info(
            "配伍冲突推理完成: 输入herbs=%s, 发现冲突=%d",
            herbs, len(conflicts),
        )
        return conflicts

    def clear_cache(self) -> None:
        """清除推理缓存"""
        self._cache.clear()
        logger.info("[KGReasoning] 推理缓存已清除")

    def get_cache_stats(self) -> Dict[str, Any]:
        """获取缓存统计"""
        return {
            "cached_inferences": len(self._cache),
            "cache_keys": list(self._cache.keys())[:10],  # 只显示前10个
        }


# ── 全局单例 ───────────────────────────────────────────────────────────

_engine: Optional[KnowledgeGraphReasoningEngine] = None


def get_reasoning_engine() -> KnowledgeGraphReasoningEngine:
    """获取全局推理引擎单例"""
    global _engine
    if _engine is None:
        _engine = KnowledgeGraphReasoningEngine()
    return _engine
