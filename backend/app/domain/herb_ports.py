"""
药材知识库端口 (HerbKnowledgePort)

从 domain.ports 迁移至此独立文件，
因为原 ports.py 随 DDD 死代码删除而移除。
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class HerbProfile:
    """药材知识画像 — 供 AI 优化器使用的标准化数据模型"""
    herb_id: str                                        # 药材唯一标识
    name_cn: str                                        # 中文名
    name_en: str = ""                                   # 英文名
    dosage_min: float = 0.0                             # 最小用量 (g)
    dosage_max: float = 30.0                            # 最大用量 (g)
    dosage_step: float = 1.0                            # 用量步长
    efficacy_scores: Dict[str, float] = field(default_factory=dict)  # {功效: 0~1}
    safety_index: float = 0.9                           # 安全性指数 0~1
    cost_per_gram: float = 0.1                          # 每克成本 (¥)
    synergy_partners: List[str] = field(default_factory=list)    # 协同配伍
    antagonistic_pairs: List[str] = field(default_factory=list)  # 相反药材
    categories: List[str] = field(default_factory=list)          # 药材分类


class HerbKnowledgePort(ABC):
    """
    药材知识库端口

    AI 优化器（贝叶斯/遗传/NSGA-II/MCTS）通过此接口访问药材知识，
    不再依赖硬编码的 Python 字典。

    实现类：
    - TCMSPHerbKnowledgeAdapter  → 从 TCMSP 数据库读取（infrastructure/）
    - InMemoryHerbKnowledgeAdapter → 用于单元测试的内存实现
    - BuiltinHerbKnowledgeAdapter  → 兼容旧有硬编码字典（迁移过渡期）
    """

    @abstractmethod
    async def get_herb_by_id(self, herb_id: str) -> Optional[HerbProfile]:
        """按 ID 获取药材画像"""
        ...

    @abstractmethod
    async def get_herbs_by_efficacy(self, efficacy: str) -> List[HerbProfile]:
        """按功效检索匹配药材列表（按功效评分降序）"""
        ...

    @abstractmethod
    async def get_all_herbs(self) -> List[HerbProfile]:
        """获取全部可用药材（供优化器初始化搜索空间）"""
        ...

    @abstractmethod
    async def get_efficacy_index(self) -> Dict[str, List[str]]:
        """获取功效→药材ID的倒排索引（预计算，用于快速筛选）"""
        ...

    @abstractmethod
    async def find_synergy_group(self, herb_id: str) -> List[str]:
        """获取与指定药材有协同配伍关系的药材ID列表"""
        ...

    @abstractmethod
    async def find_antagonistic(self, herb_id: str) -> List[str]:
        """获取与指定药材相反（禁忌配伍）的药材ID列表"""
        ...
