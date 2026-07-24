"""
中药知识服务 - 从数据库加载中药数据

负责从数据库读取中药信息并转换为优化器所需的格式，
替代硬编码的药材数据。

核心功能：
1. 从 TCMHerb 表加载中药数据
2. 将数据库模型转换为 HerbParameter 格式
3. 构建功效-药材索引
4. 提供异常处理和缓存机制
"""

import logging
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .bayesian_formula_optimizer import HerbParameter

logger = logging.getLogger(__name__)


class HerbKnowledgeService:
    """中药知识服务 - 从数据库加载中药数据"""

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session
        self._herbs: Dict[str, HerbParameter] = {}
        self._efficacy_to_herbs: Dict[str, List[str]] = {}
        self._loaded = False

    async def load_herbs(self, force_reload: bool = False) -> Dict[str, HerbParameter]:
        """
        从数据库加载中药数据
        
        Args:
            force_reload: 是否强制重新加载
            
        Returns:
            药材参数字典 {药材ID: HerbParameter}
            
        Raises:
            DatabaseConnectionError: 数据库连接失败
            DatabaseQueryError: 查询执行失败
        """
        if self._loaded and not force_reload:
            return self._herbs

        try:
            from app.models.external_data import TCMHerb

            # 从数据库查询中药数据
            result = await self.db_session.execute(
                select(TCMHerb)
                .where(TCMHerb.is_food_homology == True)
                .order_by(TCMHerb.name_cn)
            )
            tcm_herbs = result.scalars().all()

            logger.info(f"[HerbKnowledge] 从数据库加载到 {len(tcm_herbs)} 种药食同源中药")

            # 转换为 HerbParameter 格式
            for herb in tcm_herbs:
                herb_param = self._convert_to_herb_parameter(herb)
                if herb_param:
                    self._herbs[herb_param.herb_id] = herb_param

            # 为所有已加载药材合并内置协同/拮抗数据
            for herb_param in self._herbs.values():
                self._merge_builtin_synergy(herb_param)

            # 构建功效-药材索引
            self._build_efficacy_index()

            self._loaded = True
            logger.info(f"[HerbKnowledge] 成功加载 {len(self._herbs)} 种药材，{len(self._efficacy_to_herbs)} 种功效")

            return self._herbs

        except Exception as e:
            logger.error(f"[HerbKnowledge] 加载中药数据失败: {str(e)}")
            # 如果数据库加载失败，回退到内置数据
            from .bayesian_formula_optimizer import _BUILTIN_HERBS, _EFFICACY_TO_HERBS
            logger.warning("[HerbKnowledge] 回退到内置药材数据")
            self._herbs = dict(_BUILTIN_HERBS)
            self._efficacy_to_herbs = dict(_EFFICACY_TO_HERBS)
            self._loaded = True
            return self._herbs

    def _convert_to_herb_parameter(self, herb) -> Optional[HerbParameter]:
        """
        将数据库 TCMHerb 模型转换为 HerbParameter
        
        Args:
            herb: TCMHerb 数据库模型实例
            
        Returns:
            HerbParameter 对象，转换失败返回 None
        """
        try:
            # 从 effects 字段解析功效评分（简单处理，实际项目中可能需要更复杂的解析）
            efficacy_scores = self._parse_efficacy_scores(herb.effects)
            
            # 生成药材ID（使用拼音或拉丁名）
            herb_id = self._generate_herb_id(herb)

            # 默认剂量范围（可从数据库获取或使用合理默认值）
            min_dosage, max_dosage = self._get_dosage_range(herb)

            # 安全性评分（基于药食同源标记和毒性数据）
            safety_score = self._calculate_safety_score(herb)

            # 成本评分（默认值，可从数据库获取）
            cost_score = 0.15  # 默认中等成本

            # 常用配伍（暂时为空，可从知识图谱获取）
            common_pairs = []
            avoid_pairs = []

            herb_param = HerbParameter(
                herb_id=herb_id,
                name_cn=herb.name_cn,
                dosage_min=min_dosage,
                dosage_max=max_dosage,
                dosage_step=herb.dosage_step if hasattr(herb, 'dosage_step') and herb.dosage_step else 1,
                efficacy_scores=efficacy_scores,
                safety_index=safety_score,
                cost_per_gram=cost_score,
                synergy_partners=common_pairs,
                antagonistic_pairs=avoid_pairs,
            )

            # 合并内置知识库的协同/拮抗数据（DB模型无此字段，需从内置字典补充）
            self._merge_builtin_synergy(herb_param)

            return herb_param
        except Exception as e:
            logger.warning(f"[HerbKnowledge] 转换药材 {herb.name_cn} 失败: {e}")
            return None

    def _merge_builtin_synergy(self, herb_param: 'HerbParameter') -> None:
        """
        从内置药材知识库 (_BUILTIN_HERBS) 合并协同/拮抗数据。

        DB 模型缺少 synergy_partners / antagonistic_pairs 列，
        但 _BUILTIN_HERBS 中有完整数据。通过 herb_id 拼音缩写匹配后合并。
        """
        try:
            from .bayesian_formula_optimizer import _BUILTIN_HERBS
            builtin = _BUILTIN_HERBS.get(herb_param.herb_id)
            if builtin is None:
                # 尝试通过 name_cn 反向查找拼音缩写
                for bid, bdata in _BUILTIN_HERBS.items():
                    if bdata.name_cn == herb_param.name_cn:
                        builtin = bdata
                        break
            if builtin is not None:
                if not herb_param.synergy_partners and builtin.synergy_partners:
                    herb_param.synergy_partners = list(builtin.synergy_partners)
                if not herb_param.antagonistic_pairs and builtin.antagonistic_pairs:
                    herb_param.antagonistic_pairs = list(builtin.antagonistic_pairs)
        except Exception as e:
            logger.debug(f"[HerbKnowledge] 合并内置协同数据失败 {herb_param.name_cn}: {e}")

    def _parse_efficacy_scores(self, effects_str: Optional[str]) -> Dict[str, float]:
        """
        解析功效字符串为功效评分字典
        
        Args:
            effects_str: 功效描述字符串
            
        Returns:
            功效评分字典 {功效名: 评分}
        """
        if not effects_str:
            return {}

        efficacy_mapping = {
            "免疫调节": 0.85,
            "抗氧化": 0.80,
            "抗疲劳": 0.82,
            "降血糖": 0.70,
            "心血管保护": 0.75,
            "补气": 0.88,
            "补血": 0.85,
            "清热解毒": 0.88,
            "明目": 0.80,
            "护肝": 0.78,
            "抗衰老": 0.75,
            "消化系统": 0.78,
            "调经": 0.82,
            "抗炎": 0.75,
            "止痛": 0.78,
            "活血": 0.85,
            "利尿": 0.78,
            "安神": 0.70,
            "化痰": 0.75,
            "理气": 0.78,
            "止咳": 0.72,
            "解毒": 0.75,
            "调和诸药": 0.88,
        }

        scores = {}
        effects_str = effects_str.strip()
        
        for efficacy, default_score in efficacy_mapping.items():
            if efficacy in effects_str:
                scores[efficacy] = default_score

        # 如果没有匹配到已知功效，尝试简单解析
        if not scores and effects_str:
            # 按顿号分割
            effect_list = [e.strip() for e in effects_str.split("、") if e.strip()]
            for effect in effect_list[:5]:  # 最多取5个
                scores[effect] = 0.70  # 默认评分

        return scores

    def _generate_herb_id(self, herb) -> str:
        """
        生成药材ID
        
        Args:
            herb: TCMHerb 数据库模型实例
            
        Returns:
            药材ID字符串
        """
        # 优先使用拼音缩写
        if herb.name_pinyin:
            # 取拼音首字母
            pinyin_parts = herb.name_pinyin.lower().split()
            if pinyin_parts:
                return ''.join([p[0] for p in pinyin_parts])
        
        # 使用中文名称拼音缩写
        return self._chinese_to_pinyin_abbr(herb.name_cn)

    def _chinese_to_pinyin_abbr(self, chinese: str) -> str:
        """
        将中文转换为拼音缩写（简单映射）
        
        Args:
            chinese: 中文名称
            
        Returns:
            拼音缩写字符串
        """
        pinyin_map = {
            '黄': 'h', '芪': 'q', '党': 'd', '参': 's', '枸': 'g', '杞': 'q',
            '金': 'j', '银': 'y', '花': 'h', '连': 'l', '翘': 'q', '蒲': 'p',
            '公': 'g', '英': 'y', '白': 'b', '术': 's', '茯': 'f', '苓': 'l',
            '山': 's', '药': 'y', '人': 'r', '灵': 'l', '芝': 'z', '淫': 'y',
            '羊': 'y', '藿': 'h', '地': 'd', '黄': 'h', '丹': 'd', '当': 'd',
            '归': 'g', '川': 'c', '芎': 'x', '陈': 'c', '皮': 'p', '薏': 'y',
            '苡': 'y', '仁': 'r', '菊': 'j', '甘': 'g', '草': 'c',
        }
        
        abbr = ''
        for char in chinese:
            abbr += pinyin_map.get(char, char[:1])
            if len(abbr) >= 4:
                break
        return abbr.lower()

    def _get_dosage_range(self, herb) -> Tuple[float, float]:
        """
        获取剂量范围
        
        Args:
            herb: TCMHerb 数据库模型实例
            
        Returns:
            (最小剂量, 最大剂量)
        """
        # 默认剂量范围（实际项目中应从数据库获取）
        dose_map = {
            '黄芪': (3, 30), '党参': (3, 15), '枸杞子': (3, 15), '金银花': (6, 15),
            '连翘': (6, 15), '蒲公英': (9, 30), '白术': (3, 15), '茯苓': (6, 20),
            '山药': (15, 30), '人参': (1, 9), '灵芝': (3, 15), '当归': (3, 12),
            '川芎': (3, 10), '陈皮': (3, 10), '薏苡仁': (9, 30), '菊花': (5, 10),
            '甘草': (1, 6),
        }
        
        return dose_map.get(herb.name_cn, (3, 15))

    def _calculate_safety_score(self, herb) -> float:
        """
        计算安全性评分
        
        Args:
            herb: TCMHerb 数据库模型实例
            
        Returns:
            安全性评分 (0~1)
        """
        # 药食同源药材安全性较高
        if herb.is_food_homology:
            return 0.92  # 较高安全评分
        
        # 根据药材名称判断毒性
        toxic_herbs = {'附子', '藜芦', '马利兰'}
        if herb.name_cn in toxic_herbs:
            return 0.40
        
        return 0.85  # 默认中等安全评分

    def _build_efficacy_index(self):
        """构建功效-药材索引"""
        self._efficacy_to_herbs = {}
        for herb_id, herb in self._herbs.items():
            for efficacy in herb.efficacy_scores:
                if efficacy not in self._efficacy_to_herbs:
                    self._efficacy_to_herbs[efficacy] = []
                self._efficacy_to_herbs[efficacy].append(herb_id)

    def get_herbs(self) -> Dict[str, HerbParameter]:
        """获取所有药材"""
        return self._herbs

    def get_efficacy_to_herbs(self) -> Dict[str, List[str]]:
        """获取功效-药材索引"""
        return self._efficacy_to_herbs

    def get_herb_by_id(self, herb_id: str) -> Optional[HerbParameter]:
        """根据ID获取药材"""
        return self._herbs.get(herb_id)

    def get_herbs_by_efficacy(self, efficacy: str) -> List[HerbParameter]:
        """根据功效获取药材列表"""
        herb_ids = self._efficacy_to_herbs.get(efficacy, [])
        return [self._herbs[hid] for hid in herb_ids if hid in self._herbs]

    def search_herbs(self, keyword: str) -> List[HerbParameter]:
        """搜索药材"""
        keyword = keyword.lower()
        results = []
        for herb in self._herbs.values():
            if (keyword in herb.name_cn.lower() or
                keyword in herb.herb_id.lower()):
                results.append(herb)
        return results

    @property
    def herb_count(self) -> int:
        """药材数量"""
        return len(self._herbs)

    @property
    def efficacy_count(self) -> int:
        """功效类型数量"""
        return len(self._efficacy_to_herbs)

    @property
    def is_loaded(self) -> bool:
        """是否已加载"""
        return self._loaded


# 全局服务实例
_global_herb_knowledge: Optional[HerbKnowledgeService] = None


def get_global_herb_knowledge() -> Optional[HerbKnowledgeService]:
    """获取全局 HerbKnowledgeService 实例（启动时初始化）"""
    return _global_herb_knowledge


def set_global_herb_knowledge(service: HerbKnowledgeService) -> None:
    """设置全局 HerbKnowledgeService 实例（由 init_ai_services 调用）"""
    global _global_herb_knowledge
    _global_herb_knowledge = service


def get_herb_knowledge_service(db_session: AsyncSession = None) -> HerbKnowledgeService:
    """
    获取全局中药知识服务实例
    
    Args:
        db_session: 数据库会话（可选）
        
    Returns:
        HerbKnowledgeService 实例
    """
    global _global_herb_knowledge
    if _global_herb_knowledge is None:
        if db_session is None:
            # 如果没有提供会话，尝试创建默认服务（会回退到内置数据）
            from sqlalchemy.ext.asyncio import AsyncSession
            _global_herb_knowledge = HerbKnowledgeService(db_session=None)
        else:
            _global_herb_knowledge = HerbKnowledgeService(db_session)
    return _global_herb_knowledge


async def init_herb_knowledge(db_session: AsyncSession) -> HerbKnowledgeService:
    """
    初始化中药知识服务
    
    Args:
        db_session: 数据库会话
        
    Returns:
        已初始化的 HerbKnowledgeService 实例
    """
    service = HerbKnowledgeService(db_session)
    await service.load_herbs()
    global _global_herb_knowledge
    _global_herb_knowledge = service
    return service