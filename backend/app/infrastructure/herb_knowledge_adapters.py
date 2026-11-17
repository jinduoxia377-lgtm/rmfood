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
from contextlib import asynccontextmanager
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..domain.herb_ports import HerbKnowledgePort, HerbProfile

logger = logging.getLogger(__name__)


def _normalize_efficacy_key(key: str) -> str:
    """修复 extra_knowledge 功效键的 mojibake（非 UTF-8 默认编码解析导致）。

    服务进程若未设 PYTHONUTF8，json 解析出的中文键可能被误码成 latin-1/cp1252
    可解码的字符序列（如 'å…ç–«è°ƒèŠ'）。此函数检测并还原：把误码串按原编码
    编回字节，再用 UTF-8 解码；已是正常中文/ASCII 则原样返回。绝不伪造数据。
    """
    if not isinstance(key, str) or not key:
        return key
    # 已含正常 CJK → 视为正常，直接返回
    if any("\u4e00" <= ch <= "\u9fff" for ch in key):
        return key
    for wrong_codec in ("latin-1", "cp1252"):
        try:
            restored = key.encode(wrong_codec)
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        try:
            candidate = restored.decode("utf-8")
        except UnicodeDecodeError:
            continue
        # 还原后应出现 CJK 才认定为 mojibake 修复成功
        if any("\u4e00" <= ch <= "\u9fff" for ch in candidate):
            return candidate
    return key

# ── TCMHerb name → herb_id 映射（来自 knowledge_base + _BUILTIN_HERBS）──
_HERB_NAME_TO_ID: Dict[str, str] = {
    "黄芪": "hq", "党参": "ds", "枸杞子": "gz", "人参": "rs",
    "当归": "dg", "黄芪根": "hqg", "白术": "bq", "茯苓": "fp",
    "甘草": "gq", "菊花": "jgh", "川芎": "cs", "藜芦": "lk",
    "马利兰": "mld", "附子": "fz", "陈皮": "cx", "薏苡仁": "yq",
    "金银花": "cyh", "大枣": "dcx", "生姜": "sj", "葛根": "gh",
    "山楂": "sz", "丹参": "dsz", "山药": "sx", "决明子": "jq",
    "连翘": "lq", "薄荷": "bo", "桂圆": "gy", "莲子": "ls",
    "红豆": "hd", "黑芝麻": "hhz", "核桃": "ht", "桑椹": "ss",
    "百合": "bh", "麦冬": "md", "沙参": "ssn", "玉竹": "yz",
    "阿胶": "aj", "三七": "sq", "天麻": "tm", "钩藤": "gt",
    "鱼腥草": "ypc", "蒲公英": "pyg", "马齿苋": "mcx", "荷叶": "hy",
    "桑叶": "sy", "罗布麻": "lbm", "绞股蓝": "jgl",
    "白芍": "bsh", "桔梗": "jgf", "半夏": "bx", "枳实": "zs",
    "厚朴": "hp",
    # 别名
    "红枣": "dcx", "桑葚": "ss",
}

# TCMSP ID → herb_id 映射（常见TCMSP ID前缀）
_TCMSPTO_HERB_ID: Dict[str, str] = {
    "TCM4524": "hq", "TCM1168": "ds", "TCM338": "gz", "TCM26": "rs",
    "TCM5694": "dg", "TCM2529": "bq", "TCM35": "fp", "TCM110": "gq",
    "TCM154": "jgh", "TCM89": "cs", "TCM108": "cx", "TCM916": "yq",
    "TCM37": "cyh", "TCM60": "sj", "TCM27": "dcx",
}


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

    def __init__(self, session=None):
        self._session = session
        self._efficacy_index_cache: Optional[Dict[str, List[str]]] = None
        self._all_profiles_cache: Optional[List[HerbProfile]] = None

    @asynccontextmanager
    async def _session_scope(self):
        """会话生命周期管理：外部注入的 session 不关闭，自建 session 自动关闭。

        修复连接泄漏：get_all_herbs / get_herb_by_id 不再遗留未关闭的会话。
        """
        if self._session is not None:
            yield self._session
            return
        from app.core.database.session import async_session_factory
        async with async_session_factory() as session:
            yield session

    async def _load_all_profiles(self, session: AsyncSession) -> List[HerbProfile]:
        """加载全部药材并缓存（供 extra_knowledge.herb_id 双路匹配使用）"""
        if self._all_profiles_cache is not None:
            return self._all_profiles_cache
        from ..models.external_data import TCMHerb
        stmt = select(TCMHerb)
        herbs = (await session.execute(stmt)).scalars().all()
        profiles = [self._to_profile(h) for h in herbs]
        self._all_profiles_cache = profiles
        return profiles

    async def get_herb_by_id(self, herb_id: str) -> Optional[HerbProfile]:
        try:
            from ..models.external_data import TCMHerb
            async with self._session_scope() as session:
                # 1) name_cn 精确匹配（原实现仅此一路，导致 "hq" 这类 herb_id 恒查不到）
                stmt = select(TCMHerb).where(TCMHerb.name_cn == herb_id)
                orm = (await session.execute(stmt)).scalar_one_or_none()
                if orm:
                    return self._to_profile(orm)
                # 2) extra_knowledge.herb_id 匹配（双路）
                for profile in await self._load_all_profiles(session):
                    if profile.herb_id == herb_id:
                        return profile
                return None
        except Exception as e:
            logger.error(f"[TCMSPHerbKnowledgeAdapter] 查询药材失败 herb_id={herb_id}: {e}")
            return None

    async def get_herbs_by_efficacy(self, efficacy: str) -> List[HerbProfile]:
        try:
            from ..models.external_data import TCMHerb
            async with self._session_scope() as session:
                # 从 extra_knowledge JSON 和 effects 文本字段匹配功效
                stmt = select(TCMHerb)
                result = await session.execute(stmt)
                herbs = result.scalars().all()
                profiles = []
                for h in herbs:
                    p = self._to_profile(h)
                    if p.efficacy_scores.get(efficacy, 0) > 0 or efficacy in (h.effects or ""):
                        profiles.append(p)
                return sorted(profiles, key=lambda p: p.efficacy_scores.get(efficacy, 0), reverse=True)
        except Exception as e:
            logger.error(f"[TCMSPHerbKnowledgeAdapter] 功效查询失败 efficacy={efficacy}: {e}")
            return []

    async def get_all_herbs(self) -> List[HerbProfile]:
        try:
            from ..models.external_data import TCMHerb
            async with self._session_scope() as session:
                stmt = select(TCMHerb)
                result = await session.execute(stmt)
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
        """将 TCMHerb ORM 实体映射为 HerbProfile

        优先级:
        1. extra_knowledge JSON 字段（enrich_herb_knowledge 写入的结构化数据）
        2. efficacy_json / synergy_json / antagonistic_json（旧格式兼容）
        3. 硬编码默认值（兜底）
        """
        import json as _json

        # ── 解析 extra_knowledge（结构化扩展数据）──
        extra: Dict = {}
        if hasattr(orm, "extra_knowledge") and orm.extra_knowledge:
            try:
                extra = _json.loads(orm.extra_knowledge) if isinstance(orm.extra_knowledge, str) else orm.extra_knowledge
            except (TypeError, ValueError):
                extra = {}

        # name_cn (must be resolved before herb_id lookup)
        name_cn = getattr(orm, "name_cn", "") or getattr(orm, "name", "")

        # herb_id: 优先 extra_knowledge.herb_id，其次 tcm_id，再 name 映射，最后 tcmsp_id 映射
        herb_id = (
            extra.get("herb_id")
            or getattr(orm, "tcm_id", None)
            or _HERB_NAME_TO_ID.get(name_cn)
            or _TCMSPTO_HERB_ID.get(getattr(orm, "tcmsp_id", ""))
            or (name_cn[:3] if name_cn else "")
        )

        # dosage
        dosage_min = extra.get("dosage_min", float(getattr(orm, "dosage_min", 3) or 3))
        dosage_max = extra.get("dosage_max", float(getattr(orm, "dosage_max", 15) or 15))
        dosage_step = extra.get("dosage_step", float(getattr(orm, "dosage_step", 1) or 1))

        # efficacy_scores: 优先 extra_knowledge 中的数值评分
        efficacy_scores: Dict[str, float] = {}
        if "efficacy_scores" in extra:
            efficacy_scores = {k: float(v) for k, v in extra["efficacy_scores"].items() if isinstance(v, (int, float))}
        elif hasattr(orm, "efficacy_json") and orm.efficacy_json:
            raw = orm.efficacy_json
            if isinstance(raw, dict):
                efficacy_scores = {k: float(v) for k, v in raw.items()}
            elif isinstance(raw, list):
                efficacy_scores = {e: 0.7 for e in raw}

        # ★ P0 编码鲁棒修复（2026-11-16 efficacy 恒 0.05 地板排查）★
        # 现象：服务进程 get_herbs() 返回 562 味带非空 efficacy_scores，但 GA 用
        # TCM 关键词（免疫调节/补气/抗炎/抗氧化）逐味 .get(kw,0) 全部命中 0 → 评分
        # 退化为地板值。根因：服务进程未设 PYTHONUTF8，extra_knowledge JSON 以非 UTF-8
        # 默认编码（如 cp936/latin-1）解析 → 功效键变 mojibake（计数保留但字符损坏，
        # 与关键词不相等）。直连/离线用 UTF-8 解析则键正常（免疫调节…）。
        # 修法：检测并修复 mojibake 键——把被误码的 str 用 latin-1/cp1252 还原成
        # 原始 UTF-8 字节再正确解码；已是正常中文则原样保留。绝不伪造数据。
        if efficacy_scores:
            efficacy_scores = {_normalize_efficacy_key(k): v for k, v in efficacy_scores.items()}

        # safety_index
        safety_index = float(extra.get("safety_index", getattr(orm, "safety_index", 0.9) or 0.9))

        # cost_per_gram
        cost_per_gram = float(extra.get("cost_per_gram", getattr(orm, "cost_per_gram", 0.1) or 0.1))

        # synergy_partners
        synergy: List[str] = []
        if "synergy_partners" in extra:
            synergy = [s for s in extra["synergy_partners"] if isinstance(s, str)]
        elif hasattr(orm, "synergy_json") and orm.synergy_json:
            synergy = list(orm.synergy_json) if isinstance(orm.synergy_json, list) else []

        # antagonistic_pairs
        antagonistic: List[str] = []
        if "antagonistic_pairs" in extra:
            antagonistic = [s for s in extra["antagonistic_pairs"] if isinstance(s, str)]
        elif hasattr(orm, "antagonistic_json") and orm.antagonistic_json:
            antagonistic = list(orm.antagonistic_json) if isinstance(orm.antagonistic_json, list) else []

        # categories
        categories: List[str] = []
        if "categories" in extra:
            categories = [c for c in extra["categories"] if isinstance(c, str)]
        elif hasattr(orm, "categories_json") and orm.categories_json:
            categories = list(orm.categories_json) if isinstance(orm.categories_json, list) else []

        return HerbProfile(
            herb_id=herb_id,
            name_cn=name_cn,
            name_en=getattr(orm, "name_en", "") or "",
            dosage_min=dosage_min,
            dosage_max=dosage_max,
            dosage_step=dosage_step,
            efficacy_scores=efficacy_scores,
            safety_index=safety_index,
            cost_per_gram=cost_per_gram,
            synergy_partners=synergy,
            antagonistic_pairs=antagonistic,
            categories=categories,
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
