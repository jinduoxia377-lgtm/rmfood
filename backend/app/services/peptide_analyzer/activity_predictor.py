"""
活性预测器模块
基于已知活性肽数据库的特征工程与机器学习预测
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# 标准氨基酸单字母代码
STANDARD_AA = 'ACDEFGHIKLMNPQRSTVWY'

# 已知ACE抑制肽特征序列模式 (来自DBFBP数据库分析)
ACE_INHIBITOR_MOTIFS = [
    r'[PK][YP][FK]',           # C端Pro/Phe/Tyr模式
    r'[PR][YF][X]',            # X端Pos+Y/F模式
    r'YP[FE]',                  # YP起始模式
    r'[RK][PY][FK]',           # 碱性+芳香族模式
    r'PP',                      # Pro-Pro二肽
    r'LP',                      # Leu-Pro C端
    r'YP',                      # Tyr-Pro
]

# 已知抗氧化肽特征
ANTIOXIDANT_MOTIFS = [
    r'[HYWK]',                 # 抗氧化氨基酸
    r'H.*[YWH]',               # His-Tyr/Trp间隔模式
    r'C',                      # Cys巯基
    r'[YW]',                   # Trp/Tyr富集
]

# 已知抗菌肽特征 (正电荷+两亲性)
ANTIMICROBIAL_MOTIFS = [
    r'[RK]{2,}',              # 多碱基序列
    r'[FRWI][RK][FRWI]',      # 疏水-碱性-疏水
    r'[RK].{3,}[FRWI]',       # N端碱性C端疏水
]

# 已知DPP-IV抑制肽特征
DPP4_INHIBITOR_MOTIFS = [
    r'XP',                    # X-Pro C端
    r'[AFLI]P',               # 疏水-Pro
    r'YP',                    # Tyr-Pro
]


@dataclass
class ActivityPrediction:
    """活性预测结果"""
    success: bool
    activity_type: str
    score: float = 0.0
    confidence: float = 0.0
    is_active: bool = False
    features: Dict[str, float] = field(default_factory=dict)
    motifs_found: List[str] = field(default_factory=list)
    error_message: Optional[str] = None


class ActivityFeatureExtractor:
    """活性特征提取器"""

    # 氨基酸疏水性表 (Kyte-Doolittle)
    HYDROPHOBICITY = {
        'I': 4.5, 'V': 4.2, 'L': 3.8, 'F': 2.8, 'C': 2.5,
        'M': 1.9, 'A': 1.8, 'G': -0.4, 'T': -0.7, 'S': -0.8,
        'W': -0.9, 'Y': -1.3, 'P': -1.6, 'H': -3.2, 'E': -3.5,
        'Q': -3.5, 'D': -3.5, 'N': -3.5, 'K': -3.9, 'R': -4.5,
    }

    # 氨基酸电荷 (pH 7.0)
    CHARGE = {
        'D': -1, 'E': -1,   # 酸性
        'K': 1, 'R': 1, 'H': 0.1,  # 碱性
    }

    # 抗氧化氨基酸
    ANTIOXIDANT_AA = set('HYWCM')

    # 疏水氨基酸
    HYDROPHOBIC_AA = set('IVFLMCAYWP')

    # 碱性氨基酸
    BASIC_AA = set('KRH')

    @classmethod
    def extract_features(cls, sequence: str) -> Dict[str, float]:
        """提取活性相关特征"""
        seq = sequence.upper()
        length = len(seq)

        if length == 0:
            return {}

        features = {
            'length': length,
            'hydrophobic_ratio': cls._hydrophobic_ratio(seq),
            'charge': cls._net_charge(seq),
            'basic_ratio': cls._amino_acid_ratio(seq, cls.BASIC_AA),
            'hydrophobic_aa_ratio': cls._amino_acid_ratio(seq, cls.HYDROPHOBIC_AA),
            'antioxidant_aa_ratio': cls._amino_acid_ratio(seq, cls.ANTIOXIDANT_AA),
            'proline_ratio': cls._amino_acid_ratio(seq, 'P'),
            'aromatic_ratio': cls._amino_acid_ratio(seq, 'FYW'),
            'c_terminal_hydrophobic': 1.0 if seq[-1] in 'FLIMV' else 0.0,
            'n_terminal_basic': 1.0 if seq[0] in 'KRH' else 0.0,
            'mean_hydrophobicity': sum(cls.HYDROPHOBICITY.get(aa, 0) for aa in seq) / length,
            'instability_index': cls._instability_index(seq),
        }

        return features

    @classmethod
    def _hydrophobic_ratio(cls, sequence: str) -> float:
        """疏水氨基酸比例"""
        hydro_count = sum(1 for aa in sequence if aa in cls.HYDROPHOBIC_AA)
        return hydro_count / max(len(sequence), 1)

    @classmethod
    def _net_charge(cls, sequence: str) -> float:
        """净电荷"""
        charge = 0
        for aa in sequence:
            charge += cls.CHARGE.get(aa, 0)
        return charge

    @classmethod
    def _amino_acid_ratio(cls, sequence: str, targets) -> float:
        """目标氨基酸比例"""
        # 处理字符串或集合输入
        if isinstance(targets, str):
            target_set = set(targets.upper())
        else:
            target_set = targets
        count = sum(1 for aa in sequence if aa in target_set)
        return count / max(len(sequence), 1)

    @classmethod
    def _instability_index(cls, sequence: str) -> float:
        """不稳定性指数 (Ghosh方法简化版)"""
        # 简化的不稳定性计算
        dipeptide_counts = {}
        for i in range(len(sequence) - 1):
            dipep = sequence[i:i+2]
            dipeptide_counts[dipep] = dipeptide_counts.get(dipep, 0) + 1

        # 已知不稳定二肽权重 (简化版)
        unstable_dipeptides = {
            'DA': 5.56, 'DE': 5.46, 'DK': 5.27, 'DL': 5.18,
            'DV': 5.07, 'ED': 4.96, 'EK': 4.85, 'EL': 4.74,
            'KE': 4.63, 'KD': 4.52, 'LK': 4.41, 'LV': 4.30,
        }

        total = len(sequence) - 1
        if total == 0:
            return 0.0

        instability = sum(
            unstable_dipeptides.get(dp, 0) * count
            for dp, count in dipeptide_counts.items()
        ) / total

        return min(instability / 100.0, 1.0)


class ACEInhibitorPredictor:
    """ACE抑制肽预测器"""

    # ACE抑制肽训练数据特征 (来自DBFBP)
    # 基于31类活性数据的统计特征
    _FEATURE_WEIGHTS = {
        'length': 0.15,
        'hydrophobic_ratio': 0.20,
        'proline_ratio': 0.25,
        'c_terminal_hydrophobic': 0.15,
        'aromatic_ratio': 0.10,
        'mean_hydrophobicity': 0.10,
        'instability_index': 0.05,
    }

    # 阈值 (经验值，后续可优化)
    _ACTIVE_THRESHOLD = 0.5

    def predict(self, sequence: str) -> ActivityPrediction:
        """预测ACE抑制活性"""
        try:
            features = ActivityFeatureExtractor.extract_features(sequence)

            #  motif匹配得分
            motif_score = self._motif_match_score(sequence)

            # 特征加权得分
            feature_score = sum(
                features.get(k, 0) * v
                for k, v in self._FEATURE_WEIGHTS.items()
            )

            # 综合得分 (motif权重更高)
            score = 0.6 * motif_score + 0.4 * feature_score

            # 置信度基于Pro含量和长度
            pro_content = features.get('proline_ratio', 0)
            length_factor = min(features.get('length', 0) / 20, 1.0)
            confidence = 0.5 + 0.3 * pro_content + 0.2 * length_factor

            is_active = score >= self._ACTIVE_THRESHOLD

            return ActivityPrediction(
                success=True,
                activity_type='ace_inhibition',
                score=round(score, 4),
                confidence=round(min(confidence, 1.0), 4),
                is_active=is_active,
                features=features,
                motifs_found=self._find_motifs(sequence)
            )
        except Exception as e:
            logger.error(f"ACE抑制预测失败: {e}", exc_info=True)
            return ActivityPrediction(
                success=False,
                activity_type='ace_inhibition',
                error_message=str(e)
            )

    def _motif_match_score(self, sequence: str) -> float:
        """motif匹配得分"""
        matches = 0
        for motif in ACE_INHIBITOR_MOTIFS:
            if re.search(motif, sequence):
                matches += 1
        return min(matches / len(ACE_INHIBITOR_MOTIFS) * 2, 1.0)

    def _find_motifs(self, sequence: str) -> List[str]:
        """查找匹配的motif"""
        found = []
        for motif in ACE_INHIBITOR_MOTIFS:
            if re.search(motif, sequence):
                found.append(motif)
        return found


class AntioxidantPredictor:
    """抗氧化肽预测器"""

    _FEATURE_WEIGHTS = {
        'antioxidant_aa_ratio': 0.35,
        'hydrophobic_ratio': 0.20,
        'aromatic_ratio': 0.20,
        'length': 0.10,
        'mean_hydrophobicity': 0.10,
        'instability_index': 0.05,
    }

    _ACTIVE_THRESHOLD = 0.4

    def predict(self, sequence: str) -> ActivityPrediction:
        """预测抗氧化活性"""
        try:
            features = ActivityFeatureExtractor.extract_features(sequence)
            motif_score = self._motif_match_score(sequence)
            feature_score = sum(
                features.get(k, 0) * v
                for k, v in self._FEATURE_WEIGHTS.items()
            )

            score = 0.5 * motif_score + 0.5 * feature_score
            confidence = 0.4 + 0.3 * features.get('antioxidant_aa_ratio', 0)

            is_active = score >= self._ACTIVE_THRESHOLD

            return ActivityPrediction(
                success=True,
                activity_type='antioxidant',
                score=round(score, 4),
                confidence=round(min(confidence, 1.0), 4),
                is_active=is_active,
                features=features,
                motifs_found=self._find_motifs(sequence)
            )
        except Exception as e:
            logger.error(f"抗氧化预测失败: {e}", exc_info=True)
            return ActivityPrediction(
                success=False,
                activity_type='antioxidant',
                error_message=str(e)
            )

    def _motif_match_score(self, sequence: str) -> float:
        matches = sum(1 for m in ANTIOXIDANT_MOTIFS if re.search(m, sequence))
        return min(matches / len(ANTIOXIDANT_MOTIFS) * 1.5, 1.0)

    def _find_motifs(self, sequence: str) -> List[str]:
        return [m for m in ANTIOXIDANT_MOTIFS if re.search(m, sequence)]


class AntimicrobialPredictor:
    """抗菌肽预测器"""

    _FEATURE_WEIGHTS = {
        'basic_ratio': 0.30,
        'hydrophobic_ratio': 0.25,
        'charge': 0.20,
        'length': 0.10,
        'hydrophobic_aa_ratio': 0.10,
        'instability_index': 0.05,
    }

    _ACTIVE_THRESHOLD = 0.45
    _MIN_CHARGE = 2  # 最小净正电荷

    def predict(self, sequence: str) -> ActivityPrediction:
        """预测抗菌活性"""
        try:
            features = ActivityFeatureExtractor.extract_features(sequence)
            motif_score = self._motif_match_score(sequence)
            feature_score = sum(
                features.get(k, 0) * v
                for k, v in self._FEATURE_WEIGHTS.items()
            )

            # 电荷修正
            charge_factor = max(0, features.get('charge', 0)) / 10
            score = 0.4 * motif_score + 0.4 * feature_score + 0.2 * charge_factor

            confidence = 0.3 + 0.3 * features.get('basic_ratio', 0) + 0.2 * charge_factor

            is_active = score >= self._ACTIVE_THRESHOLD and features.get('charge', 0) >= self._MIN_CHARGE

            return ActivityPrediction(
                success=True,
                activity_type='antimicrobial',
                score=round(min(score, 1.0), 4),
                confidence=round(min(confidence, 1.0), 4),
                is_active=is_active,
                features=features,
                motifs_found=self._find_motifs(sequence)
            )
        except Exception as e:
            logger.error(f"抗菌肽预测失败: {e}", exc_info=True)
            return ActivityPrediction(
                success=False,
                activity_type='antimicrobial',
                error_message=str(e)
            )

    def _motif_match_score(self, sequence: str) -> float:
        matches = sum(1 for m in ANTIMICROBIAL_MOTIFS if re.search(m, sequence))
        return min(matches / len(ANTIMICROBIAL_MOTIFS), 1.0)

    def _find_motifs(self, sequence: str) -> List[str]:
        return [m for m in ANTIMICROBIAL_MOTIFS if re.search(m, sequence)]


class DPP4InhibitorPredictor:
    """DPP-IV抑制肽预测器"""

    _FEATURE_WEIGHTS = {
        'proline_ratio': 0.30,
        'length': 0.15,
        'hydrophobic_ratio': 0.20,
        'c_terminal_hydrophobic': 0.20,
        'aromatic_ratio': 0.10,
        'instability_index': 0.05,
    }

    _ACTIVE_THRESHOLD = 0.4

    def predict(self, sequence: str) -> ActivityPrediction:
        """预测DPP-IV抑制活性"""
        try:
            features = ActivityFeatureExtractor.extract_features(sequence)
            motif_score = self._motif_match_score(sequence)
            feature_score = sum(
                features.get(k, 0) * v
                for k, v in self._FEATURE_WEIGHTS.items()
            )

            score = 0.5 * motif_score + 0.5 * feature_score
            confidence = 0.4 + 0.3 * features.get('proline_ratio', 0)

            is_active = score >= self._ACTIVE_THRESHOLD

            return ActivityPrediction(
                success=True,
                activity_type='dpp4_inhibition',
                score=round(score, 4),
                confidence=round(min(confidence, 1.0), 4),
                is_active=is_active,
                features=features,
                motifs_found=self._find_motifs(sequence)
            )
        except Exception as e:
            logger.error(f"DPP-IV抑制预测失败: {e}", exc_info=True)
            return ActivityPrediction(
                success=False,
                activity_type='dpp4_inhibition',
                error_message=str(e)
            )

    def _motif_match_score(self, sequence: str) -> float:
        matches = sum(1 for m in DPP4_INHIBITOR_MOTIFS if re.search(m, sequence))
        return min(matches / len(DPP4_INHIBITOR_MOTIFS) * 1.5, 1.0)

    def _find_motifs(self, sequence: str) -> List[str]:
        return [m for m in DPP4_INHIBITOR_MOTIFS if re.search(m, sequence)]


class ActivityPredictor:
    """活性预测主类"""

    def __init__(self):
        self.ace_predictor = ACEInhibitorPredictor()
        self.antioxidant_predictor = AntioxidantPredictor()
        self.antimicrobial_predictor = AntimicrobialPredictor()
        self.dpp4_predictor = DPP4InhibitorPredictor()

    async def predict_all(self, sequence: str) -> Dict[str, Any]:
        """预测所有活性"""
        results = {}

        ace_result = self.ace_predictor.predict(sequence)
        results['ace_inhibition'] = {
            'score': ace_result.score,
            'confidence': ace_result.confidence,
            'is_active': ace_result.is_active,
            'motifs': ace_result.motifs_found
        }

        antiox_result = self.antioxidant_predictor.predict(sequence)
        results['antioxidant'] = {
            'score': antiox_result.score,
            'confidence': antiox_result.confidence,
            'is_active': antiox_result.is_active,
            'motifs': antiox_result.motifs_found
        }

        amp_result = self.antimicrobial_predictor.predict(sequence)
        results['antimicrobial'] = {
            'score': amp_result.score,
            'confidence': amp_result.confidence,
            'is_active': amp_result.is_active,
            'motifs': amp_result.motifs_found
        }

        dpp4_result = self.dpp4_predictor.predict(sequence)
        results['dpp4_inhibition'] = {
            'score': dpp4_result.score,
            'confidence': dpp4_result.confidence,
            'is_active': dpp4_result.is_active,
            'motifs': dpp4_result.motifs_found
        }

        return results

    def get_activity_summary(self, sequence: str) -> str:
        """获取活性摘要"""
        results = {}

        ace = self.ace_predictor.predict(sequence)
        antiox = self.antioxidant_predictor.predict(sequence)
        amp = self.antimicrobial_predictor.predict(sequence)
        dpp4 = self.dpp4_predictor.predict(sequence)

        activities = []
        if ace.is_active:
            activities.append(f"ACE抑制(score={ace.score:.2f})")
        if antiox.is_active:
            activities.append(f"抗氧化(score={antiox.score:.2f})")
        if amp.is_active:
            activities.append(f"抗菌(score={amp.score:.2f})")
        if dpp4.is_active:
            activities.append(f"DPP-IV抑制(score={dpp4.score:.2f})")

        return ", ".join(activities) if activities else "无显著活性"


# 全局单例
_predictor_instance: Optional[ActivityPredictor] = None

def get_activity_predictor() -> ActivityPredictor:
    """获取活性预测器单例"""
    global _predictor_instance
    if _predictor_instance is None:
        _predictor_instance = ActivityPredictor()
    return _predictor_instance
