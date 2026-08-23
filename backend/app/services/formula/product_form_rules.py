"""
产品形态规则库 — 定义不同食品形态的配比规则

参考《中国普通配方设计思路》第一节"主体骨架设计"
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple


@dataclass
class ProductFormRule:
    """单种产品形态的配比规则"""
    form_type: str
    total_dosage_g: float           # 日总用量(g)
    max_herbs: int                  # 最大成分数
    min_herbs: int                  # 最小成分数
    jun_ratio_range: Tuple[float, float]   # 君药占比范围
    chen_ratio_range: Tuple[float, float]  # 臣药占比范围
    zuo_ratio_range: Tuple[float, float]  # 佐药占比范围
    shi_ratio_range: Tuple[float, float]  # 使药占比范围
    water_content_limit: Optional[float] = None   # 水分上限(%)，None表示不限
    particle_size_um: Optional[float] = None      # 粒径要求(μm)，None表示不限
    cost_per_gram_max: float = 2.0      # 每克成本上限（元）
    shelf_life_months_min: int = 12     # 最低货架期（月）


# ═══════════════════════════════════════════════════════════════
# 产品形态规则库
# ═══════════════════════════════════════════════════════════════
# 覆盖主流中式功能性食品形态

PRODUCT_FORM_RULES: Dict[str, ProductFormRule] = {
    "保健饮品": ProductFormRule(
        form_type="保健饮品",
        total_dosage_g=50.0,           # 每次50g冲泡
        max_herbs=8,
        min_herbs=3,
        jun_ratio_range=(0.30, 0.45),  # 君药30-45%
        chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.20),
        shi_ratio_range=(0.05, 0.10),
        water_content_limit=5.0,       # 干粉形态
        particle_size_um=200.0,
    ),
    "代茶饮": ProductFormRule(
        form_type="代茶饮",
        total_dosage_g=10.0,           # 每次10g泡茶
        max_herbs=6,
        min_herbs=3,
        jun_ratio_range=(0.35, 0.50),
        chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.15),
        shi_ratio_range=(0.05, 0.10),
        water_content_limit=8.0,
    ),
    "膏方": ProductFormRule(
        form_type="膏方",
        total_dosage_g=30.0,           # 每次30g膏滋
        max_herbs=12,
        min_herbs=5,
        jun_ratio_range=(0.20, 0.35),
        chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.15, 0.25),
        shi_ratio_range=(0.05, 0.10),
        water_content_limit=15.0,
    ),
    "散剂": ProductFormRule(
        form_type="散剂",
        total_dosage_g=15.0,           # 每次15g
        max_herbs=10,
        min_herbs=3,
        jun_ratio_range=(0.25, 0.40),
        chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.20),
        shi_ratio_range=(0.05, 0.10),
        water_content_limit=3.0,
        particle_size_um=150.0,
    ),
    "丸剂": ProductFormRule(
        form_type="丸剂",
        total_dosage_g=9.0,            # 每次9g（约30丸）
        max_herbs=8,
        min_herbs=3,
        jun_ratio_range=(0.30, 0.45),
        chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.20),
        shi_ratio_range=(0.05, 0.10),
        water_content_limit=12.0,
    ),
    "口服液": ProductFormRule(
        form_type="口服液",
        total_dosage_g=10.0,           # 每次10ml≈10g
        max_herbs=6,
        min_herbs=3,
        jun_ratio_range=(0.30, 0.45),
        chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.20),
        shi_ratio_range=(0.05, 0.10),
        water_content_limit=None,       # 液态产品不限
    ),
    "功能性食品": ProductFormRule(
        form_type="功能性食品",
        total_dosage_g=100.0,          # 每100g产品
        max_herbs=15,
        min_herbs=5,
        jun_ratio_range=(0.10, 0.25),
        chen_ratio_range=(0.10, 0.20),
        zuo_ratio_range=(0.10, 0.20),
        shi_ratio_range=(0.03, 0.08),
        water_content_limit=5.0,
    ),
    "压片糖果": ProductFormRule(
        form_type="压片糖果",
        total_dosage_g=5.0,            # 每次5g（1片）
        max_herbs=8,
        min_herbs=3,
        jun_ratio_range=(0.20, 0.35),
        chen_ratio_range=(0.15, 0.25),
        zuo_ratio_range=(0.10, 0.20),
        shi_ratio_range=(0.05, 0.10),
        water_content_limit=3.0,
        particle_size_um=100.0,
    ),
}


def get_product_form_rule(form_type: str) -> Optional[ProductFormRule]:
    """按产品形态获取规则"""
    return PRODUCT_FORM_RULES.get(form_type)


def list_product_forms() -> list:
    """列出所有支持的产品形态"""
    return list(PRODUCT_FORM_RULES.keys())
