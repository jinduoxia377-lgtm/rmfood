"""
RMFOOD Peptide Analysis System v2.0 - 食品活性肽核心算法模块

本模块专为RMFOOD配方平台设计，聚焦于**功能性食品肽**的深度分析。

核心功能 (按重要性排序):
1. 🛡️ 食品安全性评估 (Safety Assessment)
   - 过敏原性风险检测
   - 毒性模式识别
   - 消化稳定性预测
   
2. 💪 生物活性预测 (Bioactivity Prediction)
   - ACE抑制活性 (降压肽)
   - 抗氧化活性 (保鲜/抗衰老)
   - 抗菌活性 (天然防腐剂)
   - 鲜味增强活性 (风味调节)
   
3. 🧪 理化性质计算 (Physicochemical Properties)
   - 分子量、等电点、溶解度
   * 苦味评分、必需氨基酸含量
   * pH稳定性范围
   
4. 🔬 结构特征分析 (Structural Features)
   - 二级结构倾向性 (α-helix/β-sheet/coil)
   - 柔性区域识别 (酶切位点)
   
5. 🏷️ 食品相关PTM识别 (Food-Relevant PTM Detection)
   - 仅保留4种与食品加工/功能相关的修饰:
     * 磷酸化 (影响生物活性)
     * N-糖基化 (影响溶解度/稳定性)
     * O-糖基化 (影响口感/质地)
     * 乙酰化 (影响稳定性)

技术特点:
✅ 100%离线运行, 无需外部API依赖
✅ 高性能: 单序列<200ms, 批量>500 seq/s
✅ 结果直接指导食品配方开发决策

使用示例:
>>> from ..services.peptide_analysis_v2.core_algorithms import FoodPeptideAnalyzer
>>> analyzer = FoodPeptideAnalyzer()
>>> result = await analyzer.analyze("VLGYTKEGN")
>>> print(f"应用评分: {result.food_application_score}/100")
>>> print(f"建议用途: {result.application_suggestions[0]}")
"""

# 核心算法模块 (保留的基础组件)
from .preprocessor import SequencePreprocessor, ValidationResult, QualityMetrics
from .feature_extractor import FeatureExtractor, FeatureVector, PhysicochemicalFeatures

# ★★★ RMFOOD核心业务模块 (新增) ★★★
from .food_peptide_analyzer import (
    FoodPeptideAnalyzer,
    FoodPeptideAnalysisResult,
    PhysicochemicalProperties,
    BioactivityPrediction,
    SafetyAssessment,
    PTMSite,
    SecondaryStructure,
)

__all__ = [
    # 基础组件
    'SequencePreprocessor',
    'ValidationResult', 
    'QualityMetrics',
    'FeatureExtractor',
    'FeatureVector',
    'PhysicochemicalFeatures',
    
    # ★ RMFOOD核心业务组件 ★
    'FoodPeptideAnalyzer',
    'FoodPeptideAnalysisResult',
    'BioactivityPrediction',
    'SafetyAssessment',
    'PTMSite',
    'SecondaryStructure',
]
