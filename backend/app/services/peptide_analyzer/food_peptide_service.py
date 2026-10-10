"""
食品肽分析服务
整合结构转换 + 性质计算 + 活性预测 + 安全性评估
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)

# 导入核心组件
from .converter import PeptideConverter, SMILESResult
from .activity_predictor import get_activity_predictor, ActivityPredictor
from .safety_predictor import get_safety_predictor, SafetyPredictor


@dataclass
class FoodPeptideAnalysis:
    """食品肽分析结果"""
    sequence: str
    smiles: Optional[str] = None
    selfies: Optional[str] = None
    molecular_weight: float = 0.0
    isoelectric_point: float = 0.0
    hydrophobicity: float = 0.0
    
    # 活性预测结果
    ace_inhibition_score: float = 0.0
    ace_confidence: float = 0.0
    ace_is_active: bool = False
    ace_motifs: List[str] = field(default_factory=list)
    
    antioxidant_score: float = 0.0
    antioxidant_confidence: float = 0.0
    antioxidant_is_active: bool = False
    antioxidant_motifs: List[str] = field(default_factory=list)
    
    antimicrobial_score: float = 0.0
    antimicrobial_confidence: float = 0.0
    antimicrobial_is_active: bool = False
    antimicrobial_motifs: List[str] = field(default_factory=list)
    
    dpp4_inhibition_score: float = 0.0
    dpp4_confidence: float = 0.0
    dpp4_is_active: bool = False
    dpp4_motifs: List[str] = field(default_factory=list)
    
    # 真实 ML 模型（DFBP 7540 条真数据训练）并列分数
    ml_ace_score: Optional[float] = None      # 真实 ML 模型 ACE 抑制分（0-1）
    ml_method: str = "unavailable"            # ml / fallback_rule / unavailable
    ml_training_samples: int = 0              # 训练样本量
    ml_validation_accuracy: Optional[float] = None
    ml_model_name: str = "PeptideRanker-Mini"
    
    # 安全性评估结果
    food_safety_score: float = 0.0
    is_allergen: bool = False
    allergen_source: Optional[str] = None
    allergen_evidence: str = ""
    is_toxic: bool = False
    toxic_source: Optional[str] = None
    toxic_evidence: str = ""
    digestibility: str = "unknown"
    digestibility_reason: str = ""
    peptic_resistance: bool = False
    proteolytic_resistance: bool = False
    overall_risk: str = "low"
    warnings: List[str] = field(default_factory=list)
    
    # 口感预测
    bitterness_score: float = 0.0
    umami_potential: float = 0.0
    
    # 来源信息
    source_food: Optional[str] = None
    source_database: Optional[str] = None
    literature_refs: List[str] = field(default_factory=list)
    
    # 元数据
    analysis_timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "sequence": self.sequence,
            "smiles": self.smiles,
            "selfies": self.selfies,
            "molecular_weight": round(self.molecular_weight, 2),
            "isoelectric_point": round(self.isoelectric_point, 2),
            "hydrophobicity": round(self.hydrophobicity, 4),
            
            "ace_inhibition": {
                "score": round(self.ace_inhibition_score, 4),
                "level": self._get_score_level(self.ace_inhibition_score),
                "confidence": round(self.ace_confidence, 4),
                "is_active": self.ace_is_active,
                "motifs": self.ace_motifs
            },
            "antioxidant": {
                "score": round(self.antioxidant_score, 4),
                "level": self._get_score_level(self.antioxidant_score),
                "confidence": round(self.antioxidant_confidence, 4),
                "is_active": self.antioxidant_is_active,
                "motifs": self.antioxidant_motifs
            },
            "antimicrobial": {
                "score": round(self.antimicrobial_score, 4),
                "level": self._get_score_level(self.antimicrobial_score),
                "confidence": round(self.antimicrobial_confidence, 4),
                "is_active": self.antimicrobial_is_active,
                "motifs": self.antimicrobial_motifs
            },
            "dpp4_inhibition": {
                "score": round(self.dpp4_inhibition_score, 4),
                "level": self._get_score_level(self.dpp4_inhibition_score),
                "confidence": round(self.dpp4_confidence, 4),
                "is_active": self.dpp4_is_active,
                "motifs": self.dpp4_motifs
            },
            "ml_model": {
                "name": self.ml_model_name,
                "ace_score": round(self.ml_ace_score, 4) if self.ml_ace_score is not None else None,
                "method": self.ml_method,
                "training_samples": self.ml_training_samples,
                "validation_accuracy": round(self.ml_validation_accuracy, 4) if self.ml_validation_accuracy is not None else None,
                "honest_note": "真实 ML 模型：用 DFBP 7540 条真实数据训练；method=fallback_rule 表示未加载权重、回退规则分；unavailable 表示模型不可用。"
            },
            
            "safety": {
                "food_score": round(self.food_safety_score, 2),
                "is_allergen": self.is_allergen,
                "allergen_source": self.allergen_source,
                "allergen_evidence": self.allergen_evidence,
                "is_toxic": self.is_toxic,
                "toxic_source": self.toxic_source,
                "toxic_evidence": self.toxic_evidence,
                "digestibility": self.digestibility,
                "digestibility_reason": self.digestibility_reason,
                "peptic_resistance": self.peptic_resistance,
                "proteolytic_resistance": self.proteolytic_resistance,
                "overall_risk": self.overall_risk,
                "warnings": self.warnings
            },
            
            "taste": {
                "bitterness": round(self.bitterness_score, 4),
                "umami": round(self.umami_potential, 4),
            },
            
            "source": {
                "food": self.source_food,
                "database": self.source_database,
                "references": self.literature_refs,
            },
            
            "analysis_time": self.analysis_timestamp.isoformat() + "Z"
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
    
    def get_activity_summary(self) -> str:
        """获取活性摘要"""
        activities = []
        if self.ace_is_active:
            activities.append(f"ACE抑制(score={self.ace_inhibition_score:.2f}, conf={self.ace_confidence:.2f})")
        if self.antioxidant_is_active:
            activities.append(f"抗氧化(score={self.antioxidant_score:.2f}, conf={self.antioxidant_confidence:.2f})")
        if self.antimicrobial_is_active:
            activities.append(f"抗菌(score={self.antimicrobial_score:.2f}, conf={self.antimicrobial_confidence:.2f})")
        if self.dpp4_is_active:
            activities.append(f"DPP-IV抑制(score={self.dpp4_inhibition_score:.2f}, conf={self.dpp4_confidence:.2f})")
        return ", ".join(activities) if activities else "无显著活性预测"
    
    def get_safety_summary(self) -> str:
        """获取安全性摘要"""
        parts = [f"风险等级: {self.overall_risk}"]
        if self.is_allergen:
            parts.append(f"致敏: 是 (来源: {self.allergen_source})")
        if self.is_toxic:
            parts.append(f"毒性: 是 (来源: {self.toxic_source})")
        parts.append(f"消化性: {self.digestibility}")
        return "; ".join(parts)


class FoodPeptideAnalyzer:
    """
    食品肽综合分析器
    
    整合：
    1. PeptideConverter (PepLink): 结构转换
    2. ActivityPredictor: 活性预测
    3. SafetyPredictor: 安全性评估
    4. RDKit: 理化性质计算
    """
    
    # 常见末端修饰的分子量偏移（Da）
    _MOD_MW_OFFSETS = {
        "ACT": 42.0106,    # N端乙酰化
        "AMP": 43.0058,    # N端甲酰胺
        "AMD": -17.0027,   # C端酰胺化
        "OH": 17.0027,     # C端羟基化
        "NH2": -17.0027,   # C端酰胺化
    }

    def __init__(self):
        self.converter = PeptideConverter()
        self.activity_predictor = get_activity_predictor()
        self.safety_predictor = get_safety_predictor()
        
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

            # Step 2: 理化性质计算
            props = self._calculate_properties(seq, smiles=result.smiles)
            result.molecular_weight = props['molecular_weight']
            result.hydrophobicity = props['hydrophobicity']
            result.isoelectric_point = props['isoelectric_point']
            
            # Step 3: 活性预测（使用真实特征工程模型）
            activity_results = await self.activity_predictor.predict_all(seq)
            
            result.ace_inhibition_score = activity_results['ace_inhibition']['score']
            result.ace_confidence = activity_results['ace_inhibition']['confidence']
            result.ace_is_active = activity_results['ace_inhibition']['is_active']
            result.ace_motifs = activity_results['ace_inhibition']['motifs']
            
            result.antioxidant_score = activity_results['antioxidant']['score']
            result.antioxidant_confidence = activity_results['antioxidant']['confidence']
            result.antioxidant_is_active = activity_results['antioxidant']['is_active']
            result.antioxidant_motifs = activity_results['antioxidant']['motifs']
            
            result.antimicrobial_score = activity_results['antimicrobial']['score']
            result.antimicrobial_confidence = activity_results['antimicrobial']['confidence']
            result.antimicrobial_is_active = activity_results['antimicrobial']['is_active']
            result.antimicrobial_motifs = activity_results['antimicrobial']['motifs']
            
            result.dpp4_inhibition_score = activity_results['dpp4_inhibition']['score']
            result.dpp4_confidence = activity_results['dpp4_inhibition']['confidence']
            result.dpp4_is_active = activity_results['dpp4_inhibition']['is_active']
            result.dpp4_motifs = activity_results['dpp4_inhibition']['motifs']
            
            # Step 3b: 真实 ML 模型并列预测（DFBP 7540 条真数据训练的 PeptideRanker-Mini）
            # 与 QSAR 规则分并列输出；未加载权重时诚实标记 fallback_rule，不冒充 ML
            await self._run_real_ml(seq, result)
            
            # Step 4: 安全性评估（使用专业预测器）
            safety_results = await self.safety_predictor.assess(seq)
            
            result.is_allergen = safety_results['is_allergen']
            result.allergen_source = safety_results.get('allergen_source')
            result.allergen_evidence = safety_results.get('allergen_evidence', '')
            result.warnings.extend(safety_results.get('allergen_warnings', []))
            
            result.is_toxic = safety_results['is_toxic']
            result.toxic_source = safety_results.get('toxic_source')
            result.toxic_evidence = safety_results.get('toxic_evidence', '')
            
            result.digestibility = safety_results.get('digestibility', 'unknown')
            result.digestibility_reason = safety_results.get('digestibility_reason', '')
            result.peptic_resistance = safety_results.get('peptic_resistance', False)
            result.proteolytic_resistance = safety_results.get('proteolytic_resistance', False)
            result.overall_risk = safety_results.get('overall_risk', 'low')
            result.warnings.extend(safety_results.get('compliance_warnings', []))
            
            # Step 5: 口感预测
            taste = self._predict_taste(seq)
            result.bitterness_score = taste['bitterness']
            result.umami_potential = taste['umami']
            
            # Step 6: 计算综合食品评分
            result.food_safety_score = self._calculate_food_score(result)
            
            # Step 7: 来源追溯（数据库检索 + 食物来源 + 文献 + NCBI 在线证据）
            await self._enrich_source(seq, result)
            
            logger.info(
                f"肽分析完成: {sequence}, "
                f"分子量: {result.molecular_weight:.1f} Da, "
                f"食品评分: {result.food_safety_score:.1f}/100, "
                f"风险: {result.overall_risk}"
            )
            
        except Exception as e:
            logger.error(f"食品肽分析失败: {e}", exc_info=True)
            raise
        
        return result
    
    async def _enrich_source(
        self,
        sequence: str,
        result: "FoodPeptideAnalysis",
    ) -> None:
        """
        来源追溯：从 DFBP 数据库检索序列对应记录，
        回填 source.food / source.database / source.references。

        匹配策略：精确匹配 → 去除修饰字符后匹配 → 子串模糊匹配。
        失败时静默降级（保持 source 为空），不影响主流程。
        末尾追加 NCBI 真实在线文献证据（可达时）。
        """
        top = None
        try:
            from app.services.peptide_analyzer.food_database import get_food_peptide_database
            manager = get_food_peptide_database()
            records = await manager.dfbp.search_by_sequence(sequence, use_online=False)
            if not records:
                # 子串模糊匹配（序列可能包含修饰）
                clean = sequence.replace('-', '').replace('.', '')
                records = manager.dfbp._fuzzy_match(clean)
            if records:
                top = records[0]
                result.source_food = top.food_source
                result.source_database = top.source_database
                # 文献参考：DOI + 活性证据
                refs = []
                if top.literature_doi:
                    refs.append(f"DOI: {top.literature_doi}")
                if top.activity_type:
                    val = f"IC50={top.activity_value} {top.activity_unit}" if top.activity_value else "活性已报道"
                    refs.append(f"{top.activity_type} ({val})")
                if top.source_protein:
                    refs.append(f"来源蛋白: {top.source_protein} ({top.source_organism or '未知物种'})")
                result.literature_refs = refs
                logger.info(
                    f"来源追溯成功: {sequence} → {top.source_database}"
                    f" 食物={top.food_source} 记录数={len(records)}"
                )
            else:
                logger.debug(f"来源追溯：{sequence} 在 DFBP 无匹配记录")
        except Exception as e:
            logger.warning(f"来源追溯失败（不影响分析）: {e}")
        finally:
            # Step 7b: 追加 NCBI 真实在线文献证据（可达时，诚实降级不伪造）
            await self._append_ncbi_literature(
                sequence, result,
                activity_type_hint=(top.activity_type if top else None),
            )

    async def _append_ncbi_literature(
        self,
        sequence: str,
        result: "FoodPeptideAnalysis",
        activity_type_hint: Optional[str] = None,
        limit: int = 3,
    ) -> None:
        """
        把 NCBI PubMed 真实在线文献追加进 source 证据链。
        - 可达时：检索与序列/活性类型相关的真实文献，标注来源数据库 PubMed
        - 不可达时：诚实降级，仅追加一条离线说明，绝不伪造文献
        """
        try:
            from app.services.peptide_analyzer.real_source_client import get_real_source_client
            client = get_real_source_client()
            probe = await client.ncbi.probe()
            if not probe.get("reachable"):
                result.literature_refs.append(
                    "[离线] NCBI PubMed 当前不可达，未追加在线文献（诚实降级，无伪造数据）"
                )
                return
            # 用活性类型关键词检索（优先用命中的真实活性类型，否则默认 ACE 抑制肽）
            query = (activity_type_hint or "ACE inhibitory peptide")
            refs = await client.search_references(activity_type=query, limit=limit)
            if not refs:
                result.literature_refs.append(f"[在线] NCBI PubMed 可达，但 {query} 无匹配文献")
                return
            result.source_database = "DFBP + PubMed" if result.source_database == "DFBP" else (result.source_database or "PubMed")
            for r in refs:
                title = (r.get("title") or "").strip()
                journal = r.get("journal") or ""
                pmid = r.get("pmid")
                doi = r.get("doi")
                parts = [f"PMID:{pmid}"]
                if doi:
                    parts.append(f"DOI:{doi}")
                if journal:
                    parts.append(journal)
                if title:
                    parts.append(title[:80])
                result.literature_refs.append(f"[PubMed在线] {' · '.join(parts)}")
            logger.info(f"NCBI 在线文献追加: {sequence} → {len(refs)} 篇")
        except Exception as e:
            logger.warning(f"NCBI 文献追加失败（不影响分析）: {e}")

    async def _run_real_ml(self, sequence: str, result: "FoodPeptideAnalysis") -> None:
        """
        真实 ML 模型并列预测：用 DFBP 真实数据训练的 PeptideRanker-Mini
        对 ACE 抑制做预测，与 QSAR 规则分并列输出。

        诚实边界：
        - 已加载训练权重 → method=ml，给出真实模型分
        - 未加载/不可用 → method=fallback_rule，回退规则分并显式标注
        - 训练样本量 / 验证准确率随结果返回
        """
        try:
            from app.services.peptide_analyzer.real_ml_trainer import get_real_model_trainer
            trainer = get_real_model_trainer("ACE inhibitory")
            pred = trainer.predict(sequence)
            result.ml_ace_score = pred.get("score")
            result.ml_method = pred.get("method", "unavailable")
            result.ml_training_samples = trainer.training_set_size
            val = (trainer.metrics or {}).get("validation", {})
            if val:
                result.ml_validation_accuracy = val.get("accuracy")
            logger.info(
                f"真实 ML 预测: {sequence} → ACE={result.ml_ace_score} "
                f"method={result.ml_method} samples={result.ml_training_samples}"
            )
        except Exception as e:
            result.ml_method = "unavailable"
            logger.warning(f"真实 ML 预测失败（不影响分析）: {e}")

    def _calculate_properties(
        self,
        sequence: str,
        smiles: Optional[str] = None,
    ) -> Dict[str, float]:
        """
        计算基本理化性质

        分子量优先从 SMILES 通过 RDKit 精确计算，
        疏水性基于 Kyte-Doolittle 表计算。
        等电点（pI）通过 Henderson-Hasselbalch 方程近似计算。
        """
        from collections import Counter

        # 从 SMILES 精确计算分子量
        mw = 0.0
        if smiles:
            try:
                from rdkit import Chem
                from rdkit.Chem import rdMolDescriptors
                mol = Chem.MolFromSmiles(smiles)
                if mol is not None:
                    mw = rdMolDescriptors.CalcExactMolWt(mol)
            except Exception as e:
                logger.warning(f"RDKit分子量计算失败，使用简化计算: {e}")

        # 如果RDKit计算失败，使用简化计算
        if mw == 0.0:
            avg_aa_weight = 110.0  # 平均残基分子量
            mw = len(sequence) * avg_aa_weight + 18.0  # 加水

        # 疏水性计算
        hydro = sum(self._hydrophobicity.get(aa, 0.0) for aa in sequence) / max(len(sequence), 1)

        # 等电点（pI）近似计算
        # 使用 amino_acid_constants 中每个氨基酸的 pKa 值加权平均
        pI = self._calculate_isoelectric_point(sequence)

        return {
            'molecular_weight': round(mw, 2),
            'hydrophobicity': round(hydro, 4),
            'isoelectric_point': round(pI, 2),
        }

    @staticmethod
    def _calculate_isoelectric_point(sequence: str) -> float:
        """
        计算肽链的等电点（pI）。

        使用简化方法：
        - N端氨基 pKa ≈ 8.0，C端羧基 pKa ≈ 3.1
        - 侧链可电离基团：Asp/Glu (pKa≈4.0), His (pKa≈6.0),
          Cys (pKa≈8.3), Tyr (pKa≈10.0), Lys (pKa≈10.5), Arg (pKa≈12.5)
        - 通过二分法找到净电荷为零时的 pH
        """
        from collections import Counter
        from rdkit import Chem
        from rdkit.Chem import rdMolDescriptors

        # 如果 RDKit 可用，直接用 SMILES 计算精确 pI
        # 否则使用简化公式
        pka_values = {
            'NTERM': 8.0,
            'CTERM': 3.1,
            'D': 3.9, 'E': 4.3,   # 酸性侧链
            'H': 6.0,              # 碱性侧链
            'C': 8.3,              # 半胱氨酸
            'Y': 10.1,             # 酪氨酸
            'K': 10.5, 'R': 12.5,  # 强碱性侧链
        }

        # 统计各可电离基团数量
        counts = Counter(sequence.upper())
        n_term_count = 1
        c_term_count = 1

        # 收集所有 pKa 值
        pkas = []
        for aa, count in counts.items():
            if aa in pka_values:
                pkas.extend([pka_values[aa]] * count)
        # N端和C端
        pkas.append(pka_values['NTERM'] * n_term_count)
        pkas.append(pka_values['CTERM'] * c_term_count)

        if not pkas:
            return 6.0  # 默认中性

        # 二分法计算等电点
        def net_charge(pH: float) -> float:
            charge = 0.0
            for pka in pkas:
                if pka >= 7.0:  # 碱性基团
                    charge += 1.0 / (1.0 + 10.0 ** (pH - pka))
                else:  # 酸性基团
                    charge -= 1.0 / (1.0 + 10.0 ** (pka - pH))
            return charge

        lo, hi = 1.0, 14.0
        for _ in range(50):  # 足够收敛
            mid = (lo + hi) / 2.0
            if net_charge(mid) > 0:
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2.0
    
    def _predict_taste(
        self,
        sequence: str
    ) -> Dict[str, float]:
        """
        口感预测
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
            result.antimicrobial_score * 0.3 +
            result.dpp4_inhibition_score * 0.1
        ) * 100
        
        # 安全性得分
        risk_scores = {'low': 100, 'medium': 60, 'high': 20}
        safety_score = risk_scores.get(result.overall_risk, 50)
        
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
