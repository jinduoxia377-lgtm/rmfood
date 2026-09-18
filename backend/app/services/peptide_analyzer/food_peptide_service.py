"""
食品肽分析服务
整合结构转换 + 性质计算 + 活性预测
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)

# 导入核心转换器
from app.services.peptide_analyzer.converter import PeptideConverter, SMILESResult


@dataclass
class FoodPeptideAnalysis:
    """食品肽分析结果"""
    sequence: str
    smiles: Optional[str] = None
    selfies: Optional[str] = None
    molecular_weight: float = 0.0
    isoelectric_point: float = 0.0
    hydrophobicity: float = 0.0
    ace_inhibition_score: float = 0.0
    antioxidant_score: float = 0.0
    antimicrobial_score: float = 0.0
    food_safety_score: float = 0.0
    is_allergen: bool = False
    is_toxic: bool = False
    digestibility: str = "unknown"
    bitterness_score: float = 0.0
    umami_potential: float = 0.0
    source_food: Optional[str] = None
    source_database: Optional[str] = None
    literature_refs: List[str] = field(default_factory=list)
    analysis_timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "sequence": self.sequence,
            "smiles": self.smiles,
            "selfies": self.selfies,
            "molecular_weight": self.molecular_weight,
            "isoelectric_point": self.isoelectric_point,
            "hydrophobicity": self.hydrophobicity,
            "ace_inhibition": {
                "score": self.ace_inhibition_score,
                "level": self._get_score_level(self.ace_inhibition_score)
            },
            "antioxidant": {
                "score": self.antioxidant_score,
                "level": self._get_score_level(self.antioxidant_score)
            },
            "antimicrobial": {
                "score": self.antimicrobial_score,
                "level": self._get_score_level(self.antimicrobial_score)
            },
            "safety": {
                "food_score": self.food_safety_score,
                "is_allergen": self.is_allergen,
                "is_toxic": self.is_toxic,
                "digestibility": self.digestibility,
            },
            "food_safety_score": self.food_safety_score,
            "taste": {
                "bitterness": self.bitterness_score,
                "umami": self.umami_potential,
            },
            "source": {
                "food": self.source_food,
                "database": self.source_database,
                "references": self.literature_refs,
            },
            "analysis_time": self.analysis_timestamp.isoformat(),
        }
    
    def _get_score_level(self, score: float) -> str:
        """获取评分等级"""
        if score >= 0.8:
            return "high"
        elif score >= 0.5:
            return "medium"
        elif score > 0:
            return "low"
        return "none"


class FoodPeptideAnalyzer:
    """
    食品肽综合分析器
    
    整合：
    1. PeptideConverter (PepLink): 结构转换
    2. 简化理化性质计算
    3. 食品特性预测（占位实现，后续可集成真实模型）
    """
    
    # 常见末端修饰的分子量偏移（Da）
    _MOD_MW_OFFSETS = {
        "ACT": 42.0106,    # N端乙酰化
        "AMP": 43.0058,    # N端甲酰胺
        "AMC": 72.0211,    # N端甲氧羰基
        "Bz": 105.0319,    # N端苯甲酰
        "Gln": 43.0058,    # N端谷氨酰胺（天然）
        "Glu": 43.0058,    # N端谷氨酸（天然）
        "AMD": -17.0027,   # C端酰胺化
        "OH": 17.0027,     # C端羟基化（天然）
        "NH2": -17.0027,   # C端酰胺化（同AMD）
        "KP": 42.0106,     # N端K乙酰化（侧链）
        "QA": 42.0106,     # N端Q乙酰化
        "CY": 42.0106,     # N端C乙酰化
        "AM": 42.0106,     # N端A乙酰化
        "AG": 42.0106,     # N端G乙酰化
        "AK": 42.0106,     # N端K乙酰化
        "AR": 42.0106,     # N端R乙酰化
        "AS": 42.0106,     # N端S乙酰化
        "AT": 42.0106,     # N端T乙酰化
        "AV": 42.0106,     # N端V乙酰化
        "AW": 42.0106,     # N端W乙酰化
        "AY": 42.0106,     # N端Y乙酰化
        "DBS": -2.0157,    # 二硫键形成（每条键）
        "DIS": -2.0157,    # 二硫键（同DBS）
        "SSB": -2.0157,    # 二硫键（同DBS）
    }

    def __init__(self):
        self.converter = PeptideConverter()
        # 简化的疏水性表（Kyte-Doolittle）
        self._hydrophobicity = {
            'I': 4.5, 'V': 4.2, 'L': 3.8, 'F': 2.8, 'C': 2.5,
            'M': 1.9, 'A': 1.8, 'G': -0.4, 'T': -0.7, 'S': -0.8,
            'W': -0.9, 'Y': -1.3, 'P': -1.6, 'H': -3.2, 'E': -3.5,
            'Q': -3.5, 'D': -3.5, 'N': -3.5, 'K': -3.9, 'R': -4.5,
        }
    
    async def analyze(
        self,
        sequence: str,
        check_food_source: bool = True,
        n_terminal: Optional[str] = None,
        c_terminal: Optional[str] = None,
        unusual_aaminos: Optional[List[Dict]] = None,
    ) -> FoodPeptideAnalysis:
        """
        完整食品肽分析流程

        Args:
            sequence: 氨基酸序列
            check_food_source: 是否检查食物来源
            n_terminal: N端修饰（如 "ACT"）
            c_terminal: C端修饰（如 "AMD"）
            unusual_aaminos: 非天然氨基酸列表

        Returns:
            FoodPeptideAnalysis 对象
        """
        seq = sequence.upper()
        result = FoodPeptideAnalysis(sequence=seq)

        try:
            # Step 1: 序列 → SMILES 转换
            smiles_result = self.converter.sequence_to_smiles(
                seq,
                n_terminal=n_terminal,
                c_terminal=c_terminal,
                unusual_aaminos=unusual_aaminos,
            )

            if smiles_result.success:
                result.smiles = smiles_result.smiles
                result.selfies = smiles_result.selfies

            # Step 2: 理化性质估算（从 SMILES 精确计算分子量）
            props = self._calculate_properties(seq, smiles=result.smiles)
            result.molecular_weight = props['molecular_weight']
            result.hydrophobicity = props['hydrophobicity']
            
            # Step 3: 活性预测（简化版，后续可替换为真实模型）
            activities = await self._predict_activities(sequence.upper())
            result.ace_inhibition_score = activities.get('ace_inhibition', 0.0)
            result.antioxidant_score = activities.get('antioxidant', 0.0)
            result.antimicrobial_score = activities.get('antimicrobial', 0.0)
            
            # Step 4: 安全性评估
            safety = self._assess_safety(sequence.upper())
            result.is_allergen = safety['is_allergen']
            result.is_toxic = safety['is_toxic']
            result.digestibility = safety['digestibility']
            
            # Step 5: 食品特性预测
            taste = self._predict_taste(sequence.upper())
            result.bitterness_score = taste['bitterness']
            result.umami_potential = taste['umami']
            
            # Step 6: 计算综合食品评分
            result.food_safety_score = self._calculate_food_score(result)
            
            logger.info(
                f"肽分析完成: {sequence}, "
                f"分子量: {result.molecular_weight:.1f} Da, "
                f"食品评分: {result.food_safety_score:.1f}/100"
            )
            
        except Exception as e:
            logger.error(f"食品肽分析失败: {e}", exc_info=True)
            raise
        
        return result
    
    def _calculate_properties(
        self,
        sequence: str,
        smiles: Optional[str] = None,
    ) -> Dict[str, float]:
        """
        计算基本理化性质

        分子量优先从 SMILES 通过 RDKit 精确计算，
        疏水性基于 Kyte-Doolittle 表计算。
        """
        # 从 SMILES 精确计算分子量
        mw = 0.0
        if smiles:
            try:
                from rdkit import Chem
                from rdkit.Chem import rdMolDescriptors
                mol = Chem.MolFromSmiles(smiles)
                if mol is not None:
                    mw = rdMolDescriptors.CalcExactMolWt(mol)
            except Exception:
                pass

        # 疏水性计算
        hydro = sum(self._hydrophobicity.get(aa, 0.0) for aa in sequence) / max(len(sequence), 1)

        return {
            'molecular_weight': round(mw, 2),
            'hydrophobicity': round(hydro, 4),
        }
    
    async def _predict_activities(
        self,
        sequence: str
    ) -> Dict[str, float]:
        """
        活性预测（简化版）
        
        TODO: 后续集成 PeptideRanker 或 BPFun 模型
        """
        # 基于序列特征的启发式预测
        score = 0.0
        
        # ACE抑制肽特征：富含 Pro, Lys, Arg, Phe, Tyr
        ace_keywords = ['P', 'K', 'R', 'F', 'Y']
        ace_count = sum(1 for aa in sequence if aa in ace_keywords)
        ace_score = min(ace_count / len(sequence) * 100, 100) if sequence else 0
        
        # 抗氧化肽特征：富含 His, Tyr, Trp, Cys
        antiox_keywords = ['H', 'Y', 'W', 'C']
        antiox_count = sum(1 for aa in sequence if aa in antiox_keywords)
        antiox_score = min(antiox_count / len(sequence) * 100, 100) if sequence else 0
        
        # 抗菌肽特征：富含 Arg, Lys, hydrophobic
        amp_keywords = ['R', 'K', 'F', 'W', 'I', 'L', 'V']
        amp_count = sum(1 for aa in sequence if aa in amp_keywords)
        amp_score = min(amp_count / len(sequence) * 100, 100) if sequence else 0
        
        return {
            'ace_inhibition': round(ace_score / 100, 4),
            'antioxidant': round(antiox_score / 100, 4),
            'antimicrobial': round(amp_score / 100, 4),
        }
    
    def _assess_safety(
        self,
        sequence: str
    ) -> Dict[str, Any]:
        """
        安全性评估（简化版）
        
        TODO: 后续集成 ToxinPred 和 AllerTOP
        """
        # 基于已知过敏原序列的简单检测
        allergen_patterns = ['QQ', 'EE', 'KK']  # 示例模式
        is_allergen = any(p in sequence for p in allergen_patterns)
        
        # 毒性检测（简化）
        toxic_patterns = ['GPPP', 'AAAG']  # 示例模式
        is_toxic = any(p in sequence for p in toxic_patterns)
        
        # 消化稳定性估算
        # 富含 Pro 的肽通常更稳定
        pro_count = sequence.count('P')
        if pro_count > len(sequence) * 0.3:
            digestibility = "high"
        elif pro_count > len(sequence) * 0.1:
            digestibility = "medium"
        else:
            digestibility = "low"
        
        return {
            'is_allergen': is_allergen,
            'is_toxic': is_toxic,
            'digestibility': digestibility,
        }
    
    def _predict_taste(
        self,
        sequence: str
    ) -> Dict[str, float]:
        """
         taste 预测（简化版）
        
        TODO: 后续集成 taste 预测模型
        """
        # 苦味预测：富含 hydrophobic 氨基酸
        bitter_aa = {'F', 'W', 'Y', 'L', 'I', 'V', 'M'}
        bitter_count = sum(1 for aa in sequence if aa in bitter_aa)
        bitterness = bitter_count / max(len(sequence), 1)
        
        # 鲜味预测：富含 Glu, Asp
        umami_aa = {'E', 'D'}
        umami_count = sum(1 for aa in sequence if aa in umami_aa)
        umami = umami_count / max(len(sequence), 1)
        
        return {
            'bitterness': round(min(bitterness * 2, 1.0), 4),
            'umami': round(min(umami * 2, 1.0), 4),
        }
    
    def _calculate_food_score(
        self,
        result: FoodPeptideAnalysis
    ) -> float:
        """
        计算食品应用综合评分 (0-100)
        
        评分维度:
        - 活性得分 (40%)
        - 安全性得分 (30%)
        - 溶解度/苦味 (20%)
        - 文献支持 (10%)
        """
        # 活性得分
        activity_score = (
            result.ace_inhibition_score * 0.4 +
            result.antioxidant_score * 0.3 +
            result.antimicrobial_score * 0.3
        ) * 100
        
        # 安全性得分
        if result.is_toxic:
            safety_score = 0.0
        elif result.is_allergen:
            safety_score = 50.0
        else:
            safety_score = 100.0
        
        # 苦味惩罚
        taste_score = max(0, 100 - result.bitterness_score * 100)
        
        # 文献支持得分
        lit_score = min(len(result.literature_refs) * 20, 100)
        
        # 综合评分
        food_score = (
            activity_score * 0.4 +
            safety_score * 0.3 +
            taste_score * 0.2 +
            lit_score * 0.1
        )
        
        return round(food_score, 2)
    
    async def batch_analyze(
        self,
        sequences: List[str],
        max_concurrent: int = 10
    ) -> List[FoodPeptideAnalysis]:
        """
        批量分析肽序列
        
        Args:
            sequences: 序列列表
            max_concurrent: 最大并发数
        
        Returns:
            分析结果列表
        """
        import asyncio
        
        async def analyze_one(seq: str) -> FoodPeptideAnalysis:
            return await self.analyze(seq)
        
        # 限制并发数
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def _analyze_with_semaphore(seq: str) -> FoodPeptideAnalysis:
            async with semaphore:
                return await analyze_one(seq)
        
        # 并发执行
        tasks = [_analyze_with_semaphore(seq) for seq in sequences]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 过滤异常
        valid_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"序列 {sequences[i]} 分析失败: {result}")
            else:
                valid_results.append(result)
        
        return valid_results


# 全局单例
_analyzer_instance: Optional[FoodPeptideAnalyzer] = None


def get_analyzer() -> FoodPeptideAnalyzer:
    """获取分析器单例"""
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = FoodPeptideAnalyzer()
    return _analyzer_instance
