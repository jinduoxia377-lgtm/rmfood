"""
HerbKnowledgePort 适配器实现

职责：将 domain.ports.HerbKnowledgePort 接口映射到具体的数据源

适配器列表：
- TCMSPHerbKnowledgeAdapter   → 从 TCMSP 数据库实时读取（生产环境）
- BuiltinHerbKnowledgeAdapter → 兼容旧有硬编码字典（迁移过渡期）
- InMemoryHerbKnowledgeAdapter → 单元测试用的内存实现

院士级修复[P0]: 解耦 AI 优化器对硬编码 _BUILTIN_HERBS 字典的依赖。
通过依赖注入，使优化器能动态获取 TCMSP 数据库中的完整药材知识。
"""
import logging
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..domain.herb_ports import HerbKnowledgePort, HerbProfile

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# 1. TCMSP 数据库适配器（生产环境首选）
# ═══════════════════════════════════════════════════════════════

class TCMSPHerbKnowledgeAdapter(HerbKnowledgePort):
    """
    从 TCMSP 数据库读取药材知识的适配器。

    直接查询 TCMHerb 表（models/external_data.py），
    将 ORM 实体映射为 AI 优化器所需的 HerbProfile 数据模型。
    这使得 AI 优化器能够访问 TCMSP 数据库中的全部 48+ 种药材，
    而不是被限制在硬编码字典的 20 种。
    """

    def __init__(self, session: AsyncSession):
        self._session = session
        self._efficacy_index_cache: Optional[Dict[str, List[str]]] = None

    async def get_herb_by_id(self, herb_id: str) -> Optional[HerbProfile]:
        try:
            from ..models.external_data import TCMHerb
            stmt = select(TCMHerb).where(TCMHerb.tcm_id == herb_id)
            result = await self._session.execute(stmt)
            orm = result.scalar_one_or_none()
            return self._to_profile(orm) if orm else None
        except Exception as e:
            logger.error(f"[TCMSPHerbKnowledgeAdapter] 查询药材失败 herb_id={herb_id}: {e}")
            return None

    async def get_herbs_by_efficacy(self, efficacy: str) -> List[HerbProfile]:
        try:
            from ..models.external_data import TCMHerb
            from sqlalchemy import or_, cast, String
            # 使用 JSON contains 或字符串匹配查询功效
            stmt = select(TCMHerb).where(
                cast(TCMHerb.efficacy_json, String).contains(efficacy)
            )
            result = await self._session.execute(stmt)
            herbs = result.scalars().all()
            profiles = [self._to_profile(h) for h in herbs if h]
            # 按功效评分降序排列
            return sorted(
                profiles,
                key=lambda p: p.efficacy_scores.get(efficacy, 0),
                reverse=True,
            )
        except Exception as e:
            logger.error(f"[TCMSPHerbKnowledgeAdapter] 功效查询失败 efficacy={efficacy}: {e}")
            return []

    async def get_all_herbs(self) -> List[HerbProfile]:
        try:
            from ..models.external_data import TCMHerb
            stmt = select(TCMHerb)
            result = await self._session.execute(stmt)
            herbs = result.scalars().all()
            return [self._to_profile(h) for h in herbs]
        except Exception as e:
            logger.error(f"[TCMSPHerbKnowledgeAdapter] 获取全部药材失败: {e}")
            return []

    async def get_efficacy_index(self) -> Dict[str, List[str]]:
        if self._efficacy_index_cache is not None:
            return self._efficacy_index_cache
        all_herbs = await self.get_all_herbs()
        index: Dict[str, List[str]] = {}
        for herb in all_herbs:
            for eff in herb.efficacy_scores:
                index.setdefault(eff, []).append(herb.herb_id)
        self._efficacy_index_cache = index
        return index

    async def find_synergy_group(self, herb_id: str) -> List[str]:
        herb = await self.get_herb_by_id(herb_id)
        return herb.synergy_partners if herb else []

    async def find_antagonistic(self, herb_id: str) -> List[str]:
        herb = await self.get_herb_by_id(herb_id)
        return herb.antagonistic_pairs if herb else []

    def _to_profile(self, orm) -> HerbProfile:
        """将 TCMHerb ORM 实体映射为 HerbProfile"""
        efficacy_scores: Dict[str, float] = {}
        synergy: List[str] = []
        antagonistic: List[str] = []

        # 兼容 JSON 字段的多种存储格式
        if hasattr(orm, "efficacy_json") and orm.efficacy_json:
            raw = orm.efficacy_json
            if isinstance(raw, dict):
                efficacy_scores = {k: float(v) for k, v in raw.items()}
            elif isinstance(raw, list):
                # 部分存储格式为 ["免疫调节", "抗氧化"]，给予默认评分
                efficacy_scores = {e: 0.7 for e in raw}

        if hasattr(orm, "synergy_json") and orm.synergy_json:
            synergy = list(orm.synergy_json) if isinstance(orm.synergy_json, list) else []
        if hasattr(orm, "antagonistic_json") and orm.antagonistic_json:
            antagonistic = list(orm.antagonistic_json) if isinstance(orm.antagonistic_json, list) else []

        return HerbProfile(
            herb_id=getattr(orm, "tcm_id", "") or getattr(orm, "id", ""),
            name_cn=getattr(orm, "name_cn", "") or getattr(orm, "name", ""),
            name_en=getattr(orm, "name_en", "") or "",
            dosage_min=float(getattr(orm, "dosage_min", 0) or 0),
            dosage_max=float(getattr(orm, "dosage_max", 30) or 30),
            dosage_step=float(getattr(orm, "dosage_step", 1) or 1),
            efficacy_scores=efficacy_scores,
            safety_index=float(getattr(orm, "safety_index", 0.9) or 0.9),
            cost_per_gram=float(getattr(orm, "cost_per_gram", 0.1) or 0.1),
            synergy_partners=synergy,
            antagonistic_pairs=antagonistic,
            categories=list(getattr(orm, "categories_json", None) or []),
        )


# ═══════════════════════════════════════════════════════════════
# 2. 内置字典兼容适配器（迁移过渡期使用）
#    将旧有的 _BUILTIN_HERBS 包装为 HerbKnowledgePort 接口
# ═══════════════════════════════════════════════════════════════

class BuiltinHerbKnowledgeAdapter(HerbKnowledgePort):
    """
    基于 bayesian_formula_optimizer._BUILTIN_HERBS 的兼容适配器。

    在完成数据库迁移前，此适配器作为过渡方案，
    使 AI 优化器能够以统一接口访问旧有的硬编码知识库。
    完成迁移后应被 TCMSPHerbKnowledgeAdapter 替换。
    """

    def __init__(self):
        # 延迟导入，避免循环依赖
        from ..services.ai.bayesian_formula_optimizer import (
            _BUILTIN_HERBS,
            _EFFICACY_TO_HERBS,
        )
        self._herbs_raw = _BUILTIN_HERBS
        self._efficacy_index_raw = _EFFICACY_TO_HERBS
        self._profiles: Dict[str, HerbProfile] = {
            hid: self._convert(herb) for hid, herb in _BUILTIN_HERBS.items()
        }
        logger.info(f"[BuiltinHerbKnowledgeAdapter] 加载内置药材 {len(self._profiles)} 种")

    def _convert(self, herb) -> HerbProfile:
        return HerbProfile(
            herb_id=herb.herb_id,
            name_cn=herb.name_cn,
            dosage_min=herb.dosage_min,
            dosage_max=herb.dosage_max,
            dosage_step=herb.dosage_step,
            efficacy_scores=dict(herb.efficacy_scores),
            safety_index=herb.safety_index,
            cost_per_gram=herb.cost_per_gram,
            synergy_partners=list(herb.synergy_partners),
            antagonistic_pairs=list(herb.antagonistic_pairs),
        )

    async def get_herb_by_id(self, herb_id: str) -> Optional[HerbProfile]:
        return self._profiles.get(herb_id)

    async def get_herbs_by_efficacy(self, efficacy: str) -> List[HerbProfile]:
        ids = self._efficacy_index_raw.get(efficacy, [])
        return sorted(
            [self._profiles[i] for i in ids if i in self._profiles],
            key=lambda p: p.efficacy_scores.get(efficacy, 0),
            reverse=True,
        )

    async def get_all_herbs(self) -> List[HerbProfile]:
        return list(self._profiles.values())

    async def get_efficacy_index(self) -> Dict[str, List[str]]:
        return dict(self._efficacy_index_raw)

    async def find_synergy_group(self, herb_id: str) -> List[str]:
        herb = self._profiles.get(herb_id)
        return herb.synergy_partners if herb else []

    async def find_antagonistic(self, herb_id: str) -> List[str]:
        herb = self._profiles.get(herb_id)
        return herb.antagonistic_pairs if herb else []


# ═══════════════════════════════════════════════════════════════
# 3. 内存测试适配器（单元测试专用）
# ═══════════════════════════════════════════════════════════════

class InMemoryHerbKnowledgeAdapter(HerbKnowledgePort):
    """
    用于单元测试的内存实现。

    可在测试初始化时注入任意药材数据，无需数据库，
    使 AI 算法单元测试完全隔离于外部依赖。
    """

    def __init__(self, herbs: Optional[List[HerbProfile]] = None):
        self._profiles: Dict[str, HerbProfile] = {
            h.herb_id: h for h in (herbs or [])
        }
        # 构建功效索引
        self._efficacy_index: Dict[str, List[str]] = {}
        for herb in self._profiles.values():
            for eff in herb.efficacy_scores:
                self._efficacy_index.setdefault(eff, []).append(herb.herb_id)

    def add_herb(self, herb: HerbProfile) -> None:
        """动态添加药材（测试辅助方法）"""
        self._profiles[herb.herb_id] = herb
        for eff in herb.efficacy_scores:
            self._efficacy_index.setdefault(eff, []).append(herb.herb_id)

    async def get_herb_by_id(self, herb_id: str) -> Optional[HerbProfile]:
        return self._profiles.get(herb_id)

    async def get_herbs_by_efficacy(self, efficacy: str) -> List[HerbProfile]:
        ids = self._efficacy_index.get(efficacy, [])
        return [self._profiles[i] for i in ids if i in self._profiles]

    async def get_all_herbs(self) -> List[HerbProfile]:
        return list(self._profiles.values())

    async def get_efficacy_index(self) -> Dict[str, List[str]]:
        return dict(self._efficacy_index)

    async def find_synergy_group(self, herb_id: str) -> List[str]:
        herb = self._profiles.get(herb_id)
        return herb.synergy_partners if herb else []

    async def find_antagonistic(self, herb_id: str) -> List[str]:
        herb = self._profiles.get(herb_id)
        return herb.antagonistic_pairs if herb else []
