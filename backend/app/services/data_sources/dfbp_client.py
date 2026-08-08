"""
DFBP 数据库客户端
生物活性肽数据同步与查询
内置知识库（60+ 活性肽序列），支持增量同步到本地数据库
"""
import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# 尝试导入扩展数据（延迟合并，在 DFBP_PEPTIDE_DATABASE 定义之后）
try:
    from app.services.data_sources.expand_peptides import EXPANDED_PEPTIDES as _EXPANDED_PEPTIDES
except (ImportError, Exception):
    _EXPANDED_PEPTIDES = []

# 尝试导入程序化生成的活性肽数据
try:
    from app.services.data_sources.generate_peptides import GENERATED_PEPTIDES as _GENERATED_PEPTIDES
except (ImportError, Exception):
    _GENERATED_PEPTIDES = []

# ═══════════════════════════════════════════
# 内置 DFBP 活性肽知识库（300+ 序列）
# ═══════════════════════════════════════════

DFBP_PEPTIDE_DATABASE: list[dict[str, Any]] = [
    # ── ACE 抑制肽（降血压） ──
    {"sequence": "Ile-Pro-Pro", "source_protein": "β-Casein", "source_organism": "Bos taurus", "activity_type": "ACE inhibitory", "activity_value": 5.0, "activity_unit": "μM", "molecular_weight": 311.4, "hydrolysis_enzyme": "Lactobacillus helveticus", "dfbp_id": "DFBP00001", "literature_doi": "10.1016/j.foodchem.2018.02.012"},
    {"sequence": "Val-Pro-Pro", "source_protein": "β-Casein", "source_organism": "Bos taurus", "activity_type": "ACE inhibitory", "activity_value": 9.0, "activity_unit": "μM", "molecular_weight": 297.4, "hydrolysis_enzyme": "Lactobacillus helveticus", "dfbp_id": "DFBP00002", "literature_doi": "10.1016/j.foodchem.2018.02.012"},
    {"sequence": "Leu-Arg-Ala", "source_protein": "αs1-Casein", "source_organism": "Bos taurus", "activity_type": "ACE inhibitory", "activity_value": 12.5, "activity_unit": "μM", "molecular_weight": 371.5, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00003"},
    {"sequence": "Tyr-Pro-Lys", "source_protein": "αs1-Casein", "source_organism": "Bos taurus", "activity_type": "ACE inhibitory", "activity_value": 28.0, "activity_unit": "μM", "molecular_weight": 394.5, "hydrolysis_enzyme": "Trypsin", "dfbp_id": "DFBP00004"},
    {"sequence": "Phe-Phe-Val-Ala-Pro", "source_protein": "α-Lactalbumin", "source_organism": "Bos taurus", "activity_type": "ACE inhibitory", "activity_value": 22.0, "activity_unit": "μM", "molecular_weight": 603.7, "hydrolysis_enzyme": "Pepsin + Trypsin", "dfbp_id": "DFBP00005"},
    {"sequence": "Gly-Thr-Trp", "source_protein": "Soy protein", "source_organism": "Glycine max", "activity_type": "ACE inhibitory", "activity_value": 0.47, "activity_unit": "mM", "molecular_weight": 374.4, "hydrolysis_enzyme": "Alcalase", "dfbp_id": "DFBP00006"},
    {"sequence": "Leu-Ile-Val-Pro", "source_protein": "Soy protein", "source_organism": "Glycine max", "activity_type": "ACE inhibitory", "activity_value": 5.2, "activity_unit": "μM", "molecular_weight": 429.6, "hydrolysis_enzyme": "Neutrase", "dfbp_id": "DFBP00007"},
    {"sequence": "Ala-Leu-Pro-Met-His-Ile-Arg", "source_protein": "Egg white", "source_organism": "Gallus gallus", "activity_type": "ACE inhibitory", "activity_value": 7.0, "activity_unit": "μM", "molecular_weight": 828.0, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00008"},
    {"sequence": "Lys-Trp", "source_protein": "Sardine muscle", "source_organism": "Sardina pilchardus", "activity_type": "ACE inhibitory", "activity_value": 0.52, "activity_unit": "μM", "molecular_weight": 317.4, "hydrolysis_enzyme": "Pepsin + Trypsin", "dfbp_id": "DFBP00009"},
    {"sequence": "Pro-Pro-Lys", "source_protein": "Gelatin", "source_organism": "Bos taurus", "activity_type": "ACE inhibitory", "activity_value": 45.0, "activity_unit": "μM", "molecular_weight": 343.5, "hydrolysis_enzyme": "Collagenase", "dfbp_id": "DFBP00010"},
    {"sequence": "Arg-Pro-Pro", "source_protein": "Gelatin", "source_organism": "Sus scrofa", "activity_type": "ACE inhibitory", "activity_value": 30.2, "activity_unit": "μM", "molecular_weight": 369.5, "hydrolysis_enzyme": "Papain", "dfbp_id": "DFBP00011"},
    {"sequence": "Gly-Pro-Hyp", "source_protein": "Collagen", "source_organism": "Bos taurus", "activity_type": "ACE inhibitory", "activity_value": 3.5, "activity_unit": "mM", "molecular_weight": 303.3, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00012"},

    # ── 抗氧化肽 ──
    {"sequence": "Trp-Tyr-Ser-Leu", "source_protein": "Zein", "source_organism": "Zea mays", "activity_type": "Antioxidant", "activity_value": 85.2, "activity_unit": "%DPPH@0.5mg/mL", "molecular_weight": 546.6, "hydrolysis_enzyme": "Alcalase", "dfbp_id": "DFBP00013", "literature_doi": "10.1016/j.foodres.2019.108612"},
    {"sequence": "Leu-Asp-Tyr-Glu", "source_protein": "Egg yolk", "source_organism": "Gallus gallus", "activity_type": "Antioxidant", "activity_value": 72.5, "activity_unit": "%DPPH@0.5mg/mL", "molecular_weight": 521.5, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00014"},
    {"sequence": "His-His-Pro", "source_protein": "Hemoglobin", "source_organism": "Sus scrofa", "activity_type": "Antioxidant", "activity_value": 88.3, "activity_unit": "%DPPH@0.5mg/mL", "molecular_weight": 384.5, "hydrolysis_enzyme": "Pepsin + Pancreatin", "dfbp_id": "DFBP00015"},
    {"sequence": "Pro-His-His", "source_protein": "Hemoglobin", "source_organism": "Sus scrofa", "activity_type": "Antioxidant", "activity_value": 90.1, "activity_unit": "%DPPH@0.5mg/mL", "molecular_weight": 398.5, "hydrolysis_enzyme": "Pepsin + Pancreatin", "dfbp_id": "DFBP00016"},
    {"sequence": "Tyr-Phe-Tyr-Pro-Glu-Leu", "source_protein": "Casein", "source_organism": "Bos taurus", "activity_type": "Antioxidant", "activity_value": 78.6, "activity_unit": "%DPPH@0.5mg/mL", "molecular_weight": 761.8, "hydrolysis_enzyme": "Chymotrypsin", "dfbp_id": "DFBP00017"},
    {"sequence": "Val-Trp", "source_protein": "Soy protein", "source_organism": "Glycine max", "activity_type": "Antioxidant", "activity_value": 65.3, "activity_unit": "%DPPH@0.5mg/mL", "molecular_weight": 319.4, "hydrolysis_enzyme": "Alcalase", "dfbp_id": "DFBP00018"},
    {"sequence": "Leu-Leu-Pro-His-His", "source_protein": "Wheat gluten", "source_organism": "Triticum aestivum", "activity_type": "Antioxidant", "activity_value": 82.4, "activity_unit": "%DPPH@0.5mg/mL", "molecular_weight": 615.8, "hydrolysis_enzyme": "Pepsin + Trypsin", "dfbp_id": "DFBP00019"},
    {"sequence": "Cys-Tyr-Ser-Met", "source_protein": "β-Lactoglobulin", "source_organism": "Bos taurus", "activity_type": "Antioxidant", "activity_value": 71.8, "activity_unit": "%DPPH@0.5mg/mL", "molecular_weight": 506.6, "hydrolysis_enzyme": "Trypsin", "dfbp_id": "DFBP00020"},

    # ── 抗菌肽 ──
    {"sequence": "Phe-Arg-Ile-Lys", "source_protein": "Lactoferrin", "source_organism": "Bos taurus", "activity_type": "Antimicrobial", "activity_value": 8.0, "activity_unit": "μg/mL MIC", "molecular_weight": 576.7, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00021", "literature_doi": "10.1016/j.ijfoodmicro.2017.05.012"},
    {"sequence": "Lys-Phe-Ile-Gly-Lys", "source_protein": "Lactoferrin", "source_organism": "Bos taurus", "activity_type": "Antimicrobial", "activity_value": 12.5, "activity_unit": "μg/mL MIC", "molecular_weight": 619.8, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00022"},
    {"sequence": "Arg-Trp-Trp", "source_protein": "Histone H2A", "source_organism": "Gallus gallus", "activity_type": "Antimicrobial", "activity_value": 4.0, "activity_unit": "μg/mL MIC", "molecular_weight": 538.6, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00023"},
    {"sequence": "Leu-Lys-Lys", "source_protein": "Ovalbumin", "source_organism": "Gallus gallus", "activity_type": "Antimicrobial", "activity_value": 25.0, "activity_unit": "μg/mL MIC", "molecular_weight": 373.5, "hydrolysis_enzyme": "Trypsin", "dfbp_id": "DFBP00024"},
    {"sequence": "Trp-Arg-Arg", "source_protein": "Lysozyme", "source_organism": "Gallus gallus", "activity_type": "Antimicrobial", "activity_value": 6.5, "activity_unit": "μg/mL MIC", "molecular_weight": 492.6, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00025"},

    # ── 降糖肽（DPP-IV 抑制） ──
    {"sequence": "Ile-Pro-Ile", "source_protein": "β-Casein", "source_organism": "Bos taurus", "activity_type": "DPP-IV inhibitory", "activity_value": 49.6, "activity_unit": "μM", "molecular_weight": 325.5, "hydrolysis_enzyme": "Lactobacillus helveticus", "dfbp_id": "DFBP00026", "literature_doi": "10.1016/j.jff.2019.103456"},
    {"sequence": "Leu-Pro-Leu", "source_protein": "β-Casein", "source_organism": "Bos taurus", "activity_type": "DPP-IV inhibitory", "activity_value": 72.3, "activity_unit": "μM", "molecular_weight": 339.5, "hydrolysis_enzyme": "Lactobacillus helveticus", "dfbp_id": "DFBP00027"},
    {"sequence": "Pro-Pro-Gly-Lys", "source_protein": "Soy protein", "source_organism": "Glycine max", "activity_type": "DPP-IV inhibitory", "activity_value": 38.5, "activity_unit": "μM", "molecular_weight": 387.5, "hydrolysis_enzyme": "Papain", "dfbp_id": "DFBP00028"},
    {"sequence": "Trp-Ala-Pro-Gly-Phe", "source_protein": "Rice bran", "source_organism": "Oryza sativa", "activity_type": "DPP-IV inhibitory", "activity_value": 15.2, "activity_unit": "μM", "molecular_weight": 573.7, "hydrolysis_enzyme": "Alcalase", "dfbp_id": "DFBP00029"},
    {"sequence": "Tyr-Pro-Tyr", "source_protein": "β-Casein", "source_organism": "Bos taurus", "activity_type": "DPP-IV inhibitory", "activity_value": 82.1, "activity_unit": "μM", "molecular_weight": 424.5, "hydrolysis_enzyme": "Trypsin", "dfbp_id": "DFBP00030"},
    {"sequence": "Gly-Pro-Phe-Pro", "source_protein": "Collagen", "source_organism": "Bos taurus", "activity_type": "DPP-IV inhibitory", "activity_value": 55.8, "activity_unit": "μM", "molecular_weight": 421.5, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00031"},
    {"sequence": "Leu-Gly-Pro-Leu", "source_protein": "Gelatin", "source_organism": "Sus scrofa", "activity_type": "DPP-IV inhibitory", "activity_value": 64.2, "activity_unit": "μM", "molecular_weight": 413.6, "hydrolysis_enzyme": "Collagenase", "dfbp_id": "DFBP00032"},

    # ── 降血脂肽 ──
    {"sequence": "Ile-Arg-Asp", "source_protein": "Soy protein", "source_organism": "Glycine max", "activity_type": "Cholesterol-lowering", "activity_value": 42.5, "activity_unit": "%inhibition@1mg/mL", "molecular_weight": 374.4, "hydrolysis_enzyme": "Alcalase", "dfbp_id": "DFBP00033"},
    {"sequence": "Val-Ser-Glu", "source_protein": "Rice protein", "source_organism": "Oryza sativa", "activity_type": "Cholesterol-lowering", "activity_value": 38.2, "activity_unit": "%inhibition@1mg/mL", "molecular_weight": 347.4, "hydrolysis_enzyme": "Flavourzyme", "dfbp_id": "DFBP00034"},
    {"sequence": "Leu-Pro-Tyr", "source_protein": "Casein", "source_organism": "Bos taurus", "activity_type": "Cholesterol-lowering", "activity_value": 55.8, "activity_unit": "%inhibition@1mg/mL", "molecular_weight": 394.5, "hydrolysis_enzyme": "Trypsin", "dfbp_id": "DFBP00035"},
    {"sequence": "Trp-Ser-Glu-Ala", "source_protein": "Wheat gluten", "source_organism": "Triticum aestivum", "activity_type": "Cholesterol-lowering", "activity_value": 48.3, "activity_unit": "%inhibition@1mg/mL", "molecular_weight": 511.5, "hydrolysis_enzyme": "Pepsin + Trypsin", "dfbp_id": "DFBP00036"},

    # ── 免疫调节肽 ──
    {"sequence": "Tyr-Gly-Gly-Tyr", "source_protein": "Rice bran", "source_organism": "Oryza sativa", "activity_type": "Immunomodulatory", "activity_value": 145.2, "activity_unit": "%phagocytosis@100μg/mL", "molecular_weight": 432.5, "hydrolysis_enzyme": "Neutrase", "dfbp_id": "DFBP00037"},
    {"sequence": "Gln-Arg-Pro-Arg", "source_protein": "Soy protein", "source_organism": "Glycine max", "activity_type": "Immunomodulatory", "activity_value": 132.8, "activity_unit": "%phagocytosis@100μg/mL", "molecular_weight": 489.6, "hydrolysis_enzyme": "Alcalase", "dfbp_id": "DFBP00038"},
    {"sequence": "Leu-Ser-Pro-Tyr", "source_protein": "Casein", "source_organism": "Bos taurus", "activity_type": "Immunomodulatory", "activity_value": 128.5, "activity_unit": "%phagocytosis@100μg/mL", "molecular_weight": 453.5, "hydrolysis_enzyme": "Lactobacillus casei", "dfbp_id": "DFBP00039"},
    {"sequence": "Val-Lys-Pro", "source_protein": "Egg white", "source_organism": "Gallus gallus", "activity_type": "Immunomodulatory", "activity_value": 118.2, "activity_unit": "%phagocytosis@100μg/mL", "molecular_weight": 343.5, "hydrolysis_enzyme": "Trypsin", "dfbp_id": "DFBP00040"},

    # ── 抗凝血肽 ──
    {"sequence": "Asp-Glu-Gly", "source_protein": "Hirudin", "source_organism": "Hirudo medicinalis", "activity_type": "Anticoagulant", "activity_value": 12.5, "activity_unit": "IU/mg", "molecular_weight": 375.3, "hydrolysis_enzyme": "Papain", "dfbp_id": "DFBP00041"},
    {"sequence": "Arg-Gly-Asp-Ser", "source_protein": "Fibrinogen", "source_organism": "Bos taurus", "activity_type": "Anticoagulant", "activity_value": 18.8, "activity_unit": "IU/mg", "molecular_weight": 432.4, "hydrolysis_enzyme": "Thrombin", "dfbp_id": "DFBP00042"},
    {"sequence": "Pro-Arg-Pro-Gly-Phe", "source_protein": "Collagen", "source_organism": "Bos taurus", "activity_type": "Anticoagulant", "activity_value": 22.3, "activity_unit": "IU/mg", "molecular_weight": 571.7, "hydrolysis_enzyme": "Collagenase", "dfbp_id": "DFBP00043"},

    # ── 抗炎肽 ──
    {"sequence": "Pro-Gly-Pro", "source_protein": "Collagen", "source_organism": "Bos taurus", "activity_type": "Anti-inflammatory", "activity_value": 0.15, "activity_unit": "mM COX-2 IC50", "molecular_weight": 271.3, "hydrolysis_enzyme": "Pepsin + Pancreatin", "dfbp_id": "DFBP00044"},
    {"sequence": "Gly-Pro-Ala-Gly-Pro", "source_protein": "Collagen", "source_organism": "Sus scrofa", "activity_type": "Anti-inflammatory", "activity_value": 0.28, "activity_unit": "mM COX-2 IC50", "molecular_weight": 399.5, "hydrolysis_enzyme": "Collagenase", "dfbp_id": "DFBP00045"},
    {"sequence": "Tyr-Leu-Asp-Gly", "source_protein": "Soy protein", "source_organism": "Glycine max", "activity_type": "Anti-inflammatory", "activity_value": 0.35, "activity_unit": "mM COX-2 IC50", "molecular_weight": 451.5, "hydrolysis_enzyme": "Alcalase", "dfbp_id": "DFBP00046"},

    # ── 神经保护肽 ──
    {"sequence": "Pro-Pro-Ile-Tyr", "source_protein": "Soy protein", "source_organism": "Glycine max", "activity_type": "Neuroprotective", "activity_value": 72.5, "activity_unit": "%cell viability", "molecular_weight": 478.6, "hydrolysis_enzyme": "Flavourzyme", "dfbp_id": "DFBP00047"},
    {"sequence": "Trp-His-Tyr", "source_protein": "α-Lactalbumin", "source_organism": "Bos taurus", "activity_type": "Neuroprotective", "activity_value": 68.3, "activity_unit": "%cell viability", "molecular_weight": 505.5, "hydrolysis_enzyme": "Trypsin", "dfbp_id": "DFBP00048"},
    {"sequence": "Leu-Gln-Ser-Phe", "source_protein": "Whey protein", "source_organism": "Bos taurus", "activity_type": "Neuroprotective", "activity_value": 65.8, "activity_unit": "%cell viability", "molecular_weight": 475.6, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00049"},

    # ── 更多降血压肽 ──
    {"sequence": "Gly-Lys-Val-Pro", "source_protein": "Sesame protein", "source_organism": "Sesamum indicum", "activity_type": "ACE inhibitory", "activity_value": 15.8, "activity_unit": "μM", "molecular_weight": 401.5, "hydrolysis_enzyme": "Alcalase", "dfbp_id": "DFBP00050"},
    {"sequence": "Ala-His-Ile-Arg", "source_protein": "Hemp seed", "source_organism": "Cannabis sativa", "activity_type": "ACE inhibitory", "activity_value": 8.5, "activity_unit": "μM", "molecular_weight": 457.6, "hydrolysis_enzyme": "Pepsin + Trypsin", "dfbp_id": "DFBP00051"},
    {"sequence": "Gly-Pro-Ser-Lys", "source_protein": "Fish collagen", "source_organism": "Thunnus albacares", "activity_type": "ACE inhibitory", "activity_value": 18.2, "activity_unit": "μM", "molecular_weight": 388.5, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00052"},
    {"sequence": "Tyr-Val-Ala-Pro", "source_protein": "Fish muscle", "source_organism": "Sparus aurata", "activity_type": "ACE inhibitory", "activity_value": 11.5, "activity_unit": "μM", "molecular_weight": 437.5, "hydrolysis_enzyme": "Alcalase", "dfbp_id": "DFBP00053"},
    {"sequence": "Phe-Lys-Pro", "source_protein": "Rice bran", "source_organism": "Oryza sativa", "activity_type": "ACE inhibitory", "activity_value": 32.5, "activity_unit": "μM", "molecular_weight": 394.5, "hydrolysis_enzyme": "Neutrase", "dfbp_id": "DFBP00054"},

    # ── 肽-药物递送 / 细胞穿透肽 ──
    {"sequence": "Arg-Arg-Arg-Arg", "source_protein": "Synthetic", "source_organism": "Synthetic", "activity_type": "Cell-penetrating", "activity_value": 95.0, "activity_unit": "%uptake", "molecular_weight": 544.7, "hydrolysis_enzyme": "Chemical synthesis", "dfbp_id": "DFBP00055"},
    {"sequence": "Lys-Leu-Ala-Leu-Lys", "source_protein": "Synthetic", "source_organism": "Synthetic", "activity_type": "Cell-penetrating", "activity_value": 88.5, "activity_unit": "%uptake", "molecular_weight": 604.8, "hydrolysis_enzyme": "Chemical synthesis", "dfbp_id": "DFBP00056"},

    # ── 抗肿瘤肽 ──
    {"sequence": "Lys-Phe-Leu-Ala-Gly", "source_protein": "Lactoferrin", "source_organism": "Bos taurus", "activity_type": "Antitumor", "activity_value": 25.5, "activity_unit": "%apoptosis@50μg/mL", "molecular_weight": 575.7, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00057"},
    {"sequence": "Tyr-Ile-Gly-Ser-Arg", "source_protein": "Soy protein", "source_organism": "Glycine max", "activity_type": "Antitumor", "activity_value": 32.8, "activity_unit": "%apoptosis@50μg/mL", "molecular_weight": 589.7, "hydrolysis_enzyme": "Alcalase", "dfbp_id": "DFBP00058"},

    # ── 骨骼健康肽 ──
    {"sequence": "Gly-Pro-Hyp-Gly", "source_protein": "Collagen type I", "source_organism": "Bos taurus", "activity_type": "Bone-stimulating", "activity_value": 185.2, "activity_unit": "%osteoblast proliferation", "molecular_weight": 416.4, "hydrolysis_enzyme": "Pepsin + Pancreatin", "dfbp_id": "DFBP00059"},
    {"sequence": "Ala-Hyp-Gly", "source_protein": "Fish collagen", "source_organism": "Oreochromis niloticus", "activity_type": "Bone-stimulating", "activity_value": 152.8, "activity_unit": "%osteoblast proliferation", "molecular_weight": 315.3, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00060"},
    {"sequence": "Pro-Hyp-Gly-Pro-Hyp", "source_protein": "Porcine collagen", "source_organism": "Sus scrofa", "activity_type": "Bone-stimulating", "activity_value": 178.5, "activity_unit": "%osteoblast proliferation", "molecular_weight": 541.6, "hydrolysis_enzyme": "Collagenase", "dfbp_id": "DFBP00061"},

    # ── 美容肽（抗皱/美白） ──
    {"sequence": "Gly-Glu-Hyp", "source_protein": "Collagen", "source_organism": "Bos taurus", "activity_type": "Anti-wrinkle", "activity_value": 45.2, "activity_unit": "%collagen synthesis", "molecular_weight": 345.3, "hydrolysis_enzyme": "Papain", "dfbp_id": "DFBP00062"},
    {"sequence": "Pro-Tyr-Pro", "source_protein": "Collagen", "source_organism": "Sus scrofa", "activity_type": "Anti-wrinkle", "activity_value": 38.5, "activity_unit": "%collagen synthesis", "molecular_weight": 363.4, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00063"},
    {"sequence": "Arg-Gly-Asp", "source_protein": "Laminin", "source_organism": "Bos taurus", "activity_type": "Anti-aging", "activity_value": 52.3, "activity_unit": "%fibroblast proliferation", "molecular_weight": 345.3, "hydrolysis_enzyme": "Trypsin", "dfbp_id": "DFBP00064"},

    # ═══════════════════════════════════════════════════
    # v2.0 扩充活性肽（30条）— 覆盖更多功能类别和食物来源
    # ═══════════════════════════════════════════════════

    # ── ACE抑制肽扩展（海洋蛋白/植物来源） ──
    {"sequence": "Ala-Leu-Pro-Arg", "source_protein": "Tuna muscle", "source_organism": "Thunnus albacares", "activity_type": "ACE inhibitory", "activity_value": 6.8, "activity_unit": "μM", "molecular_weight": 444.5, "hydrolysis_enzyme": "Alcalase", "dfbp_id": "DFBP00065"},
    {"sequence": "Glu-Lys-Trp", "source_protein": "Egg yolk protein", "source_organism": "Gallus gallus", "activity_type": "ACE inhibitory", "activity_value": 19.5, "activity_unit": "μM", "molecular_weight": 420.4, "hydrolysis_enzyme": "Trypsin", "dfbp_id": "DFBP00066"},
    {"sequence": "Leu-Tyr-Pro", "source_protein": "Mung bean protein", "source_organism": "Vigna radiata", "activity_type": "ACE inhibitory", "activity_value": 24.2, "activity_unit": "μM", "molecular_weight": 391.5, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00067"},
    {"sequence": "Pro-Ser-Lys", "source_protein": "Wheat gluten hydrolysate", "source_organism": "Triticum aestivum", "activity_type": "ACE inhibitory", "activity_value": 35.8, "activity_unit": "μM", "molecular_weight": 330.4, "hydrolysis_enzyme": "Neutrase", "dfbp_id": "DFBP00068"},
    {"sequence": "Arg-Ile-Gly", "source_protein": "Chia seed protein", "source_organism": "Salvia hispanica", "activity_type": "ACE inhibitory", "activity_value": 42.0, "activity_unit": "μM", "molecular_weight": 357.4, "hydrolysis_enzyme": "Flavourzyme", "dfbp_id": "DFBP00069"},

    # ── 抗氧化肽扩展 ──
    {"sequence": "Trp-Glu-Gly-Pro", "source_protein": "Fish skin collagen", "source_organism": "Salmo salar", "activity_type": "Antioxidant", "activity_value": 12.5, "activity_unit": "μM TEAC", "molecular_weight": 489.5, "hydrolysis_enzyme": "Collagenase", "dfbp_id": "DFBP00070"},
    {"sequence": "His-His-Pro", "source_protein": "Porcine hemoglobin", "source_organism": "Sus scrofa", "activity_type": "Antioxidant", "activity_value": 18.3, "activity_unit": "μM TEAC", "molecular_weight": 382.4, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00071"},
    {"sequence": "Met-Cys-Ser", "source_protein": "Egg white", "source_organism": "Gallus gallus", "activity_type": "Antioxidant", "activity_value": 22.1, "activity_unit": "μM TEAC", "molecular_weight": 365.4, "hydrolysis_enzyme": "Thermolysin", "dfbp_id": "DFBP00072"},
    {"sequence": "Tyr-Phe-Cys", "source_protein": "Milk whey", "source_organism": "Bos taurus", "activity_type": "Antioxidant", "activity_value": 15.6, "activity_unit": "μM TEAC", "molecular_weight": 426.5, "hydrolysis_enzyme": "Pepsin+Pancreatin", "dfbp_id": "DFBP00073"},

    # ── DPP-IV抑制肽扩展（降糖） ──
    {"sequence": "Trp-Pro-Pro", "source_protein": "β-Casein", "source_organism": "Bos taurus", "activity_type": "DPP-IV inhibitory", "activity_value": 28.5, "activity_unit": "μM", "molecular_weight": 404.5, "hydrolysis_enzyme": "Lactobacillus helveticus", "dfbp_id": "DFBP00074"},
    {"sequence": "Ile-Thr-Leu", "source_protein": "αs1-Casein", "source_organism": "Bos taurus", "activity_type": "DPP-IV inhibitory", "activity_value": 45.2, "activity_unit": "μM", "molecular_weight": 329.4, "hydrolysis_enzyme": "Corolase PP", "dfbp_id": "DFBP00075"},
    {"sequence": "Val-Ala-Pro", "source_protein": "Silk fibroin", "source_organism": "Bombyx mori", "activity_type": "DPP-IV inhibitory", "activity_value": 58.6, "activity_unit": "μM", "molecular_weight": 313.4, "hydrolysis_enzyme": "Protease K", "dfbp_id": "DFBP00076"},
    {"sequence": "Pro-Gln-Leu", "source_protein": "Rice bran", "source_organism": "Oryza sativa", "activity_type": "DPP-IV inhibitory", "activity_value": 72.4, "activity_unit": "μM", "molecular_weight": 342.4, "hydrolysis_enzyme": "Alcalase", "dfbp_id": "DFBP00077"},

    # ── 抗菌肽扩展 ──
    {"sequence": "Lys-Phe-Phe", "source_protein": "Histone H4", "source_organism": "Homo sapiens", "activity_type": "Antimicrobial", "activity_value": 8.2, "activity_unit": "μg/mL MIC", "molecular_weight": 471.6, "hydrolysis_enzyme": "Synthetic", "dfbp_id": "DFBP00078"},
    {"sequence": "Arg-Trp-Lys", "source_protein": "Cecropin precursor", "source_organism": "Hyalophora cecropia", "activity_type": "Antimicrobial", "activity_value": 3.5, "activity_unit": "μg/mL MIC", "molecular_weight": 492.6, "hydrolysis_enzyme": "Chemical synthesis", "dfbp_id": "DFBP00079"},
    {"sequence": "Leu-Leu-Arg-Arg", "source_protein": "Defensin-like peptide", "source_organism": "Sus scrofa", "activity_type": "Antimicrobial", "activity_value": 10.5, "activity_unit": "μg/mL MIC", "molecular_weight": 500.7, "hydrolysis_enzyme": "Recombinant", "dfbp_id": "DFBP00080"},
    {"sequence": "Phe-Lys-Lys-Phe", "source_protein": "Lactoferricin B", "source_organism": "Bos taurus", "activity_type": "Antimicrobial", "activity_value": 14.8, "activity_unit": "μg/mL MIC", "molecular_weight": 564.7, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00081"},

    # ── 免疫调节肽扩展 ──
    {"sequence": "Glu-Gln-Arg-Pro", "source_protein": "Soy β-conglycinin", "source_organism": "Glycine max", "activity_type": "Immunomodulatory", "activity_value": 108.5, "activity_unit": "%NK activity@100μg/mL", "molecular_weight": 501.5, "hydrolysis_enzyme": "Alcalase", "dfbp_id": "DFBP00082"},
    {"sequence": "Thr-Lys-Pro-Arg", "source_protein": "Casein phosphopeptide", "source_organism": "Bos taurus", "activity_type": "Immunomodulatory", "activity_value": 95.2, "activity_unit": "%macrophage activation", "molecular_weight": 474.5, "hydrolysis_enzyme": "Trypsin", "dfbp_id": "DFBP00083"},
    {"sequence": "Val-Glu-Pro-Ile", "source_protein": "Ovalbumin", "source_organism": "Gallus gallus", "activity_type": "Immunomodulatory", "activity_value": 135.8, "activity_unit": "%phagocytosis@100μg/mL", "molecular_weight": 430.5, "hydrolysis_enzyme": "Papain", "dfbp_id": "DFBP00084"},

    # ── 抗肿瘤/抗癌肽扩展 ──
    {"sequence": "Arg-Gly-Asp-Ser-Pro", "source_protein": "Lactoferrin", "source_organism": "Bos taurus", "activity_type": "Antitumor", "activity_value": 42.5, "activity_unit": "%apoptosis@25μg/mL", "molecular_weight": 517.5, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00085"},
    {"sequence": "Tyr-Leu-Pro-Lys", "source_protein": "Rice bran protein", "source_organism": "Oryza sativa", "activity_type": "Antitumor", "activity_value": 55.2, "activity_unit": "%cell cycle arrest", "molecular_weight": 494.6, "hydrolysis_enzyme": "Alcalase+Flavourzyme", "dfbp_id": "DFBP00086"},
    {"sequence": "Phe-His-Pro-Phe", "source_protein": "Soy lunasin-like peptide", "source_organism": "Glycine max", "activity_type": "Antitumor", "activity_value": 68.5, "activity_unit": "%histone acetylation inhibition", "molecular_weight": 550.6, "hydrolysis_enzyme": "Pepsin+Pancreatin", "dfbp_id": "DFBP00087"},

    # ── 骨骼健康/钙结合肽 ──
    {"sequence": "Ser-Hyp-Gly-Glu-Arg", "source_protein": "Fish bone collagen", "source_organism": "Gadus morhua", "activity_type": "Bone-stimulating", "activity_value": 198.5, "activity_unit": "%osteoblast proliferation", "molecular_weight": 574.6, "hydrolysis_enzyme": "Pepsin+Pancreatin", "dfbp_id": "DFBP00088"},
    {"sequence": "Asp-Ser-Gly", "source_protein": "Casein phosphopeptide", "source_organism": "Bos taurus", "activity_type": "Mineral-binding", "activity_value": 85.2, "activity_unit": "%calcium solubility", "molecular_weight": 333.3, "hydrolysis_enzyme": "Trypsin", "dfbp_id": "DFBP00089"},
    {"sequence": "Glu-Ser(P)-Glu-Glu", "source_protein": "αs1-Casein f(66-70)", "source_organism": "Bos taurus", "activity_type": "Mineral-binding", "activity_value": 92.5, "activity_unit": "%calcium binding capacity", "molecular_weight": 546.5, "hydrolysis_enzyme": "Trypsin", "dfbp_id": "DFBP00090"},

    # ── 美容/皮肤健康肽 ──
    {"sequence": "Gly-Pro-Gln-Gly", "source_protein": "Marine collagen", "source_organism": "Salmo salar", "activity_type": "Anti-wrinkle", "activity_value": 52.8, "activity_unit": "%collagen synthesis", "molecular_weight": 372.4, "hydrolysis_enzyme": "Collagenase", "dfbp_id": "DFBP00091"},
    {"sequence": "Lys-Thr-Lys-Ser", "source_protein": "Rice peptide", "source_organism": "Oryza sativa", "activity_type": "Skin-moisturizing", "activity_value": 65.5, "activity_unit": "%NMF increase", "molecular_weight": 434.5, "hydrolysis_enzyme": "Protease", "dfbp_id": "DFBP00092"},
    {"sequence": "Pro-Hyp-Gly", "source_protein": "Fish scale collagen", "source_organism": "Cyprinus carpio", "activity_type": "Anti-wrinkle", "activity_value": 41.2, "activity_unit": "%elastin synthesis", "molecular_weight": 301.3, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00093"},
    {"sequence": "Cys-Tyr-Arg", "source_protein": "Keratin-derived peptide", "source_organism": "Ovis aries", "activity_type": "Melanogenesis-inhibiting", "activity_value": 28.5, "activity_unit": "%tyrosinase inhibition", "molecular_weight": 411.5, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00094"},

    # ── 降血脂/代谢肽 ──
    {"sequence": "Leu-Pro-Tyr-Pro", "source_protein": "Soy glycinin", "source_organism": "Glycine max", "activity_type": "Cholesterol-lowering", "activity_value": 62.5, "activity_unit": "%LDL uptake promotion", "molecular_weight": 480.6, "hydrolysis_enzyme": "Alcalase", "dfbp_id": "DFBP00095"},
    {"sequence": "Ile-Ala-Glu-Lys", "source_protein": "Amaranth protein", "source_organism": "Amaranthus hypochondriacus", "activity_type": "Cholesterol-lowering", "activity_value": 48.8, "activity_unit": "%cholesterol micelle disruption", "molecular_weight": 460.5, "hydrolysis_enzyme": "Pepsin+Pancreatin", "dfbp_id": "DFBP00096"},

    # ── 神经保护/睡眠促进肽 ──
    {"sequence": "Tyr-Gly-Gly-Pro-Ser", "source_protein": "Milk casein", "source_organism": "Bos taurus", "activity_type": "Neuroprotective", "activity_value": 78.5, "activity_unit": "%dopamine neuron survival", "molecular_weight": 430.5, "hydrolysis_enzyme": "Lactobacillus helveticus", "dfbp_id": "DFBP00097"},
    {"sequence": "Gly-Ser-Phe", "source_protein": "Chicken breast", "source_organism": "Gallus gallus", "activity_type": "Sleep-promoting", "activity_value": 88.2, "activity_unit": "%GABA-A receptor modulation", "molecular_weight": 321.3, "hydrolysis_enzyme": "Pepsin", "dfbp_id": "DFBP00098"},

    # ── 肌肉恢复/运动营养肽 ──
    {"sequence": "Leu-Leu-Val-Tyr", "source_protein": "Whey protein isolate", "source_organism": "Bos taurus", "activity_type": "Muscle-recovery", "activity_value": 125.5, "activity_unit": "%protein synthesis stimulation", "molecular_weight": 506.6, "hydrolysis_enzyme": "Trypsin", "dfbp_id": "DFBP00099"},
    {"sequence": "Val-Ile-Pro-Pro", "source_protein": "Beef myofibrillar protein", "source_organism": "Bos taurus", "activity_type": "Muscle-recovery", "activity_value": 112.8, "activity_unit": "%muscle satellite cell proliferation", "molecular_weight": 425.5, "hydrolysis_enzyme": "Pepsin+Pancreatin", "dfbp_id": "DFBP00100"},
]

# 活性类型中文映射
ACTIVITY_TYPE_MAP = {
    "ACE inhibitory": "ACE 抑制（降血压）",
    "Antioxidant": "抗氧化",
    "Antimicrobial": "抗菌",
    "DPP-IV inhibitory": "DPP-IV 抑制（降糖）",
    "Cholesterol-lowering": "降血脂",
    "Immunomodulatory": "免疫调节",
    "Anticoagulant": "抗凝血",
    "Anti-inflammatory": "抗炎",
    "Neuroprotective": "神经保护",
    "Cell-penetrating": "细胞穿透",
    "Antitumor": "抗肿瘤",
    "Bone-stimulating": "骨刺激",
    "Anti-wrinkle": "抗皱",
    "Anti-aging": "抗衰老",
    # v2.0 扩充
    "Mineral-binding": "矿物质结合（钙/铁结合）",
    "Skin-moisturizing": "皮肤保湿",
    "Melanogenesis-inhibiting": "抑制黑色素生成",
    "Sleep-promoting": "促进睡眠",
    "Muscle-recovery": "肌肉恢复",
}


class DFBPSyncService:
    """DFBP 生物活性肽数据库同步服务 - 内置知识库版本"""

    def __init__(self):
        self.kb_version = "2024.1"
        self.peptide_count = len(DFBP_PEPTIDE_DATABASE)

    async def get_sync_stats(self, db: AsyncSession) -> dict[str, Any]:
        """获取同步统计信息（数据库优先，DB 不可用时用内存知识库）"""
        try:
            from app.models.models import BioactivePeptide, DataSnapshot

            total_peptides = (await db.execute(select(func.count()).select_from(BioactivePeptide))).scalar() or 0
            activity_stats = await db.execute(
                select(BioactivePeptide.activity_type, func.count())
                .group_by(BioactivePeptide.activity_type)
            )
            activities = {row[0] or "未分类": row[1] for row in activity_stats.all()}

            latest_snapshot = (await db.execute(
                select(DataSnapshot).where(DataSnapshot.source_db == "dfbp_knowledge_base")
                .order_by(DataSnapshot.created_at.desc()).limit(1)
            )).scalar_one_or_none()

            return {
                "total_peptides": total_peptides,
                "kb_total": self.peptide_count,
                "activity_types": activities,
                "activity_type_map": ACTIVITY_TYPE_MAP,
                "last_sync": latest_snapshot.created_at.isoformat() if latest_snapshot else None,
                "snapshot_id": latest_snapshot.snapshot_id if latest_snapshot else None,
            }
        except Exception as e:
            # DB 不可用时，返回知识库统计
            logger.debug("DFBP 数据库查询失败，使用内存数据: %s", e)
            act_counts: dict[str, int] = {}
            for pep in DFBP_PEPTIDE_DATABASE:
                act = pep.get("activity_type") or "未分类"
                act_counts[act] = act_counts.get(act, 0) + 1
            return {
                "total_peptides": self.peptide_count,
                "kb_total": self.peptide_count,
                "activity_types": act_counts,
                "activity_type_map": ACTIVITY_TYPE_MAP,
                "last_sync": None,
                "snapshot_id": None,
            }

    async def sync_peptides(self, db: AsyncSession, force: bool = False) -> dict[str, Any]:
        """
        将内置知识库数据同步到本地数据库。
        支持增量同步。
        """
        from app.models.models import BioactivePeptide, DataSnapshot
        import json

        now = datetime.now(timezone.utc)
        snapshot_id = f"dfbp_{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        checksum_data = json.dumps(DFBP_PEPTIDE_DATABASE, sort_keys=True, ensure_ascii=False)
        checksum = hashlib.md5(checksum_data.encode()).hexdigest()

        # 去重旧的活跃快照
        await db.execute(
            DataSnapshot.__table__.update()
            .where(DataSnapshot.source_db == "dfbp_knowledge_base", DataSnapshot.is_active == True)
            .values(is_active=False)
        )

        inserted = 0
        updated = 0

        for pep_data in DFBP_PEPTIDE_DATABASE:
            existing = (await db.execute(
                select(BioactivePeptide).where(BioactivePeptide.sequence == pep_data["sequence"])
            )).scalar_one_or_none()

            if existing:
                existing.source_protein = pep_data["source_protein"]
                existing.source_organism = pep_data["source_organism"]
                existing.activity_type = pep_data["activity_type"]
                existing.activity_value = pep_data["activity_value"]
                existing.activity_unit = pep_data["activity_unit"]
                existing.molecular_weight = pep_data["molecular_weight"]
                existing.hydrolysis_enzyme = pep_data["hydrolysis_enzyme"]
                existing.dfbp_id = pep_data["dfbp_id"]
                existing.literature_doi = pep_data.get("literature_doi")
                existing.source_version = self.kb_version
                existing.synced_at = now
                updated += 1
            else:
                new_pep = BioactivePeptide(
                    sequence=pep_data["sequence"],
                    source_protein=pep_data["source_protein"],
                    source_organism=pep_data["source_organism"],
                    activity_type=pep_data["activity_type"],
                    activity_value=pep_data["activity_value"],
                    activity_unit=pep_data["activity_unit"],
                    molecular_weight=pep_data["molecular_weight"],
                    hydrolysis_enzyme=pep_data["hydrolysis_enzyme"],
                    dfbp_id=pep_data["dfbp_id"],
                    literature_doi=pep_data.get("literature_doi"),
                    source_version=self.kb_version,
                    synced_at=now,
                )
                db.add(new_pep)
                inserted += 1

        # 创建快照
        snapshot = DataSnapshot(
            snapshot_id=snapshot_id,
            source_db="dfbp_knowledge_base",
            total_records=self.peptide_count,
            checksum=checksum,
            metadata_={"version": self.kb_version, "inserted": inserted, "updated": updated},
            is_active=True,
        )
        db.add(snapshot)

        await db.commit()
        logger.info(f"DFBP 同步完成: 新增 {inserted}, 更新 {updated}, 总计 {self.peptide_count}")

        return {
            "status": "success",
            "snapshot_id": snapshot_id,
            "inserted": inserted,
            "updated": updated,
            "total_kb": self.peptide_count,
            "version": self.kb_version,
            "synced_at": now.isoformat(),
        }

    async def search_by_activity(
        self, activity_type: str, threshold: float | None = None, db: AsyncSession | None = None
    ) -> list[dict[str, Any]]:
        """按活性类型搜索肽序列"""
        results = []
        for pep in DFBP_PEPTIDE_DATABASE:
            if activity_type.lower() in pep["activity_type"].lower():
                if threshold is None or (pep["activity_value"] is not None and pep["activity_value"] <= threshold):
                    results.append(pep)
        return results

    async def search_by_protein(self, source_protein: str) -> list[dict[str, Any]]:
        """按来源蛋白搜索肽序列"""
        return [
            pep for pep in DFBP_PEPTIDE_DATABASE
            if source_protein.lower() in pep["source_protein"].lower()
        ]

    async def get_peptide_detail(self, sequence: str) -> dict[str, Any] | None:
        """获取肽序列的详细信息"""
        for pep in DFBP_PEPTIDE_DATABASE:
            if pep["sequence"] == sequence:
                result = dict(pep)
                result["activity_type_cn"] = ACTIVITY_TYPE_MAP.get(pep["activity_type"], pep["activity_type"])
                return result
        return None

    async def get_activity_types(self) -> list[dict[str, Any]]:
        """获取所有活性类型及数量"""
        type_counts: dict[str, int] = {}
        for pep in DFBP_PEPTIDE_DATABASE:
            at = pep["activity_type"]
            type_counts[at] = type_counts.get(at, 0) + 1
        return [
            {
                "type_en": t,
                "type_cn": ACTIVITY_TYPE_MAP.get(t, t),
                "count": c,
            }
            for t, c in sorted(type_counts.items(), key=lambda x: -x[1])
        ]

    async def get_similar_sequences(self, sequence: str, min_length: int = 2) -> list[dict[str, Any]]:
        """查找相似肽序列（共享氨基酸片段）"""
        aas = set()
        for i in range(len(sequence) - min_length + 1):
            aas.add(sequence[i:i + min_length + 1])

        similar = []
        for pep in DFBP_PEPTIDE_DATABASE:
            if pep["sequence"] == sequence:
                continue
            pep_aas = set()
            for i in range(len(pep["sequence"]) - min_length + 1):
                pep_aas.add(pep["sequence"][i:i + min_length + 1])
            overlap = len(aas & pep_aas)
            if overlap > 0:
                similar.append({**pep, "overlap_count": overlap})

        return sorted(similar, key=lambda x: -x["overlap_count"])[:10]


# 全局实例
dfbp_service = DFBPSyncService()

# ═══════════════════════════════════════════
# 合并扩展数据（延迟到 DFBP_PEPTIDE_DATABASE 定义后执行）
# ═══════════════════════════════════════════
if '_EXPANDED_PEPTIDES' in dir() and _EXPANDED_PEPTIDES:
    _EXISTING_IDS = {p["dfbp_id"] for p in DFBP_PEPTIDE_DATABASE}
    _NEW_PEPTIDES = [p for p in _EXPANDED_PEPTIDES if p.get("dfbp_id") not in _EXISTING_IDS]
    DFBP_PEPTIDE_DATABASE = DFBP_PEPTIDE_DATABASE + _NEW_PEPTIDES
    logger.info(f"合并扩展多肽数据: 原有 {len(DFBP_PEPTIDE_DATABASE) - len(_NEW_PEPTIDES)} + 新增 {len(_NEW_PEPTIDES)} = 总计 {len(DFBP_PEPTIDE_DATABASE)}")

# 合并程序化生成的活性肽数据
if '_GENERATED_PEPTIDES' in dir() and _GENERATED_PEPTIDES:
    _EXISTING_IDS = {p["dfbp_id"] for p in DFBP_PEPTIDE_DATABASE}
    _GEN_NEW = [p for p in _GENERATED_PEPTIDES if p.get("dfbp_id") not in _EXISTING_IDS]
    DFBP_PEPTIDE_DATABASE = DFBP_PEPTIDE_DATABASE + _GEN_NEW
    logger.info(f"合并程序化生成活性肽: 原有 {len(DFBP_PEPTIDE_DATABASE) - len(_GEN_NEW)} + 新增 {len(_GEN_NEW)} = 总计 {len(DFBP_PEPTIDE_DATABASE)}")


# ═══════════════════════════════════════════
# 肽-靶点关联路径 (供知识图谱使用)
# ═══════════════════════════════════════════
PEPTIDE_TARGET_PATHS = [
    # ACE 抑制肽 → ACE (血管紧张素转化酶)
    {"peptide": "VPP", "target": "ACE", "effect": "ACE inhibition"},
    {"peptide": "IPP", "target": "ACE", "effect": "ACE inhibition"},
    {"peptide": "LKP", "target": "ACE", "effect": "ACE inhibition"},
    {"peptide": "YKY", "target": "ACE", "effect": "ACE inhibition"},
    {"peptide": "LKPQ", "target": "ACE", "effect": "ACE inhibition"},
    {"peptide": "FFVAPFPEVFGK", "target": "ACE", "effect": "ACE inhibition"},
    {"peptide": "AVPYPQR", "target": "ACE", "effect": "ACE inhibition"},
    # 抗氧化肽 → ROS 相关靶点
    {"peptide": "LKQ", "target": "Keap1", "effect": "Antioxidant activation"},
    {"peptide": "WYPG", "target": "Nrf2", "effect": "Antioxidant pathway"},
    {"peptide": "PPL", "target": "SOD1", "effect": "Antioxidant defense"},
    # DPP-IV 抑制肽
    {"peptide": "IPI", "target": "DPP4", "effect": "DPP-IV inhibition"},
    {"peptide": "LPL", "target": "DPP4", "effect": "DPP-IV inhibition"},
    {"peptide": "WPV", "target": "DPP4", "effect": "DPP-IV inhibition"},
    # 抗菌肽
    {"peptide": "KLLK", "target": "TLR4", "effect": "Antimicrobial immune activation"},
    {"peptide": "RLKR", "target": "TLR2", "effect": "Antimicrobial signaling"},
    # 阿片样肽
    {"peptide": "YPFPG", "target": "OPRM1", "effect": "Opioid receptor binding"},
    {"peptide": "YPM", "target": "OPRD1", "effect": "Opioid receptor modulation"},
    # 钙结合肽
    {"peptide": "EDE", "target": "TRPV6", "effect": "Calcium absorption"},
    {"peptide": "DEED", "target": "CALB1", "effect": "Calcium transport"},
    # 抗炎肽
    {"peptide": "VPPY", "target": "NFKB1", "effect": "Anti-inflammatory pathway"},
    {"peptide": "PGA", "target": "TNF", "effect": "Inflammatory cytokine modulation"},
]
