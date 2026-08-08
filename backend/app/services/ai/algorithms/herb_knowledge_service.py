"""中药知识服务 - 通过端口接口提供药材数据

通过 HerbKnowledgePort 接口获取药材知识，
使业务逻辑解耦于具体的数据访问实现。

核心功能：
1. 通过 HerbKnowledgePort 获取药材数据
2. 将 Port 数据转换为优化器所需的 HerbParameter 格式
3. 构建功效-药材索引
4. 提供缓存机制
"""

import logging
from typing import Dict, List, Optional

from app.domain.herb_ports import HerbKnowledgePort

from .bayesian_formula_optimizer import HerbParameter

logger = logging.getLogger(__name__)


class HerbKnowledgeService:
    """中药知识服务 - 通过端口接口提供药材数据"""

    def __init__(self, herb_knowledge: HerbKnowledgePort):
        """
        初始化服务，注入 HerbKnowledgePort
        
        Args:
            herb_knowledge: 药材知识端口实现（可由适配器工厂提供）
        """
        self._herb_knowledge = herb_knowledge
        self._herbs: Dict[str, HerbParameter] = {}
        self._efficacy_to_herbs: Dict[str, List[str]] = {}
        self._loaded = False

    async def load_herbs(self, force_reload: bool = False) -> Dict[str, HerbParameter]:
        """
        通过端口加载中药数据
        
        Args:
            force_reload: 是否强制重新加载
            
        Returns:
            药材参数字典 {药材ID: HerbParameter}
        """
        if self._loaded and not force_reload:
            return self._herbs

        try:
            all_herbs = await self._herb_knowledge.get_all_herbs()
            
            logger.info("[HerbKnowledge] 从端口加载到 %d 种药材", len(all_herbs))

            for herb in all_herbs:
                herb_param = self._convert_to_herb_parameter(herb)
                if herb_param:
                    self._herbs[herb_param.herb_id] = herb_param

            for herb_param in self._herbs.values():
                self._merge_builtin_synergy(herb_param)

            self._build_efficacy_index()

            self._loaded = True
            logger.info("[HerbKnowledge] 成功加载 %d 种药材，%d 种功效",
                        len(self._herbs), len(self._efficacy_to_herbs))

            return self._herbs

        except Exception as e:
            logger.error("[HerbKnowledge] 加载中药数据失败: %s", str(e))
            raise

    def _convert_to_herb_parameter(self, herb) -> Optional[HerbParameter]:
        """
        将 HerbProfile 对象转换为 HerbParameter
        
        Args:
            herb: 来自端口的药材数据对象
            
        Returns:
            HerbParameter 对象，转换失败返回 None
        """
        try:
            efficacy_scores = getattr(herb, 'efficacy_scores', {})
            herb_id = getattr(herb, 'herb_id', '')
            if not herb_id:
                return None

            min_dosage = getattr(herb, 'dosage_min', 0.0)
            max_dosage = getattr(herb, 'dosage_max', 30.0)
            dosage_step = getattr(herb, 'dosage_step', 1.0)
            safety_score = getattr(herb, 'safety_index', 0.9)
            cost_score = getattr(herb, 'cost_per_gram', 0.15)
            synergy_partners = getattr(herb, 'synergy_partners', [])
            antagonistic_pairs = getattr(herb, 'antagonistic_pairs', [])

            herb_param = HerbParameter(
                herb_id=herb_id,
                name_cn=getattr(herb, 'name_cn', ''),
                dosage_min=min_dosage,
                dosage_max=max_dosage,
                dosage_step=dosage_step,
                efficacy_scores=efficacy_scores,
                safety_index=safety_score,
                cost_per_gram=cost_score,
                synergy_partners=synergy_partners,
                antagonistic_pairs=antagonistic_pairs,
            )

            self._merge_builtin_synergy(herb_param)
            return herb_param
        except Exception as e:
            logger.warning("[HerbKnowledge] 转换药材失败: %s", str(e))
            return None

    def _merge_builtin_synergy(self, herb_param: HerbParameter) -> None:
        """从内置知识库合并协同/拮抗数据"""
        pass

    def _build_efficacy_index(self) -> None:
        """构建功效-药材索引（基于已加载的 herbs）"""
        self._efficacy_to_herbs = {}
        for herb_id, herb_param in self._herbs.items():
            for eff, score in herb_param.efficacy_scores.items():
                if score > 0:
                    if eff not in self._efficacy_to_herbs:
                        self._efficacy_to_herbs[eff] = []
                    self._efficacy_to_herbs[eff].append(herb_id)


# =================== 全局单例管理 ===================

_global_herb_knowledge: Optional[HerbKnowledgeService] = None


def get_global_herb_knowledge() -> Optional[HerbKnowledgeService]:
    """获取全局 HerbKnowledgeService 实例"""
    return _global_herb_knowledge


def set_global_herb_knowledge(service: HerbKnowledgeService) -> None:
    """设置全局 HerbKnowledgeService 实例"""
    global _global_herb_knowledge
    _global_herb_knowledge = service


async def init_herb_knowledge(herb_knowledge_port: HerbKnowledgePort) -> HerbKnowledgeService:
    """
    初始化中药知识服务
    
    注意：现在需要传入 HerbKnowledgePort 而不是数据库会话
    
    Args:
        herb_knowledge_port: 来自适配器工厂的 HerbKnowledgePort 实现
        
    Returns:
        已初始化的 HerbKnowledgeService 实例
    """
    service = HerbKnowledgeService(herb_knowledge_port)
    await service.load_herbs()
    global _global_herb_knowledge
    _global_herb_knowledge = service
    return service
