"""
感官智能评价领域实体（M2.3）

味觉/嗅觉/口感的多维度评价模型。
"""
from __future__ import annotations

from dataclasses import dataclass, field

# ─── 味觉维度 ───

@dataclass
class TasteProfile:
    """味觉轮廓"""
    sweetness: float = 0.0     # 甜 0-10
    sourness: float = 0.0      # 酸 0-10
    bitterness: float = 0.0    # 苦 0-10
    spiciness: float = 0.0     # 辣 0-10
    saltiness: float = 0.0     # 咸 0-10
    umami: float = 0.0         # 鲜 0-10
    astringency: float = 0.0   # 涩 0-10

    def to_radar(self) -> list[dict]:
        """转为雷达图数据格式"""
        return [
            {"axis": "甜", "value": self.sweetness},
            {"axis": "酸", "value": self.sourness},
            {"axis": "苦", "value": self.bitterness},
            {"axis": "辣", "value": self.spiciness},
            {"axis": "咸", "value": self.saltiness},
            {"axis": "鲜", "value": self.umami},
            {"axis": "涩", "value": self.astringency},
        ]

    def dominant_notes(self) -> list[str]:
        """主要风味（评分最高的前3个）"""
        scores = [
            ("甜", self.sweetness), ("酸", self.sourness),
            ("苦", self.bitterness), ("辣", self.spiciness),
            ("咸", self.saltiness), ("鲜", self.umami),
            ("涩", self.astringency),
        ]
        return [name for name, score in sorted(scores, key=lambda x: -x[1])[:3] if score > 0]


@dataclass
class FlavorNote:
    """风味描述（嗅觉）"""
    name: str                 # 风味名（果香/花香/草本/木香/奶香）
    intensity: float          # 强度 0-10
    description: str = ""


@dataclass
class MouthfeelProfile:
    """口感质地"""
    thickness: float = 0.0    # 厚度 0-10
    smoothness: float = 0.0   # 顺滑度 0-10
    freshness: float = 0.0    # 清爽度 0-10
    richness: float = 0.0     # 醇厚感 0-10
    aftertaste: float = 0.0   # 回甘/余味 0-10


# ─── 综合评价 ───

@dataclass
class SensoryScore:
    """感官综合评分"""
    overall: float = 0.0      # 总体评分 0-100
    taste: float = 0.0        # 味觉评分 0-100
    flavor: float = 0.0       # 风味评分 0-100
    mouthfeel: float = 0.0    # 口感评分 0-100
    appearance: float = 0.0   # 外观评分 0-100

    def to_dict(self) -> dict:
        return {
            "overall": round(self.overall, 1),
            "taste": round(self.taste, 1),
            "flavor": round(self.flavor, 1),
            "mouthfeel": round(self.mouthfeel, 1),
            "appearance": round(self.appearance, 1),
        }


@dataclass
class SensoryReport:
    """感官评价报告"""
    formula_name: str
    taste_profile: TasteProfile
    mouthfeel: MouthfeelProfile
    scores: SensoryScore
    flavor_notes: list[FlavorNote] = field(default_factory=list)
    pros: list[str] = field(default_factory=list)        # 优点
    cons: list[str] = field(default_factory=list)        # 不足
    optimization_suggestions: list[str] = field(default_factory=list)
    recommended_uses: list[str] = field(default_factory=list)  # 推荐用途


# ─── 优化建议 ───

@dataclass
class TasteOptimizationSuggestion:
    """口味优化建议"""
    target_dimension: str     # 目标维度（如 bitterness）
    current_value: float
    target_value: float
    suggestion: str
    adjustment_herbs: list[str] = field(default_factory=list)
    priority: str = "medium"  # high/medium/low
