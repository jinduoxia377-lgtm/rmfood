"""
感官智能评价引擎（M2.3）

基于成分-味觉知识库的味觉/口感预测。
"""
from __future__ import annotations

from ..domain.sensory import (
    FlavorNote,
    MouthfeelProfile,
    SensoryReport,
    SensoryScore,
    TasteOptimizationSuggestion,
    TasteProfile,
)

# ─── 药材味觉知识库（药典记载 + 经验数据） ───

_HERB_TASTE_DB: dict[str, dict] = {
    # 药材名: {taste_scores: {甜, 酸, 苦, 辛, 咸, 鲜, 涩}, mouthfeel: {厚度, 顺滑, 清爽}}
    "枸杞子": {"taste": {"sweetness": 7.0, "sourness": 1.0, "bitterness": 0.5, "spiciness": 0, "saltiness": 0.5, "umami": 2.0, "astringency": 0.5},
               "mouthfeel": {"thickness": 2.0, "smoothness": 6.0, "freshness": 5.0, "richness": 3.0, "aftertaste": 4.0},
               "flavor": [("果香", 6.0, "枸杞特有的清甜果香")], "appearance": 7.0},
    "人参": {"taste": {"sweetness": 3.0, "sourness": 0.5, "bitterness": 4.0, "spiciness": 0, "saltiness": 0.5, "umami": 1.0, "astringency": 1.0},
             "mouthfeel": {"thickness": 5.0, "smoothness": 3.0, "freshness": 3.0, "richness": 7.0, "aftertaste": 5.0},
             "flavor": [("草本", 7.0, "人参特有的草本气息"), ("木香", 4.0, "淡雅的木质香")], "appearance": 5.0},
    "山楂": {"taste": {"sweetness": 4.0, "sourness": 8.0, "bitterness": 0.5, "spiciness": 0, "saltiness": 0, "umami": 0.5, "astringency": 2.0},
             "mouthfeel": {"thickness": 1.5, "smoothness": 4.0, "freshness": 7.0, "richness": 2.0, "aftertaste": 3.0},
             "flavor": [("果香", 8.0, "浓郁的山楂果香"), ("酸香", 7.0, "清爽的酸味香气")], "appearance": 6.0},
    "甘草": {"taste": {"sweetness": 9.0, "sourness": 0, "bitterness": 0.5, "spiciness": 0, "saltiness": 0.5, "umami": 1.0, "astringency": 0},
             "mouthfeel": {"thickness": 3.0, "smoothness": 5.0, "freshness": 4.0, "richness": 4.0, "aftertaste": 6.0},
             "flavor": [("草本", 5.0, "甘草特有的甜香")], "appearance": 4.0},
    "黄芪": {"taste": {"sweetness": 4.0, "sourness": 0, "bitterness": 1.0, "spiciness": 0, "saltiness": 0.5, "umami": 1.0, "astringency": 0.5},
             "mouthfeel": {"thickness": 4.0, "smoothness": 4.0, "freshness": 4.0, "richness": 5.0, "aftertaste": 4.0},
             "flavor": [("草本", 6.0, "豆科植物的清香")], "appearance": 5.0},
    "当归": {"taste": {"sweetness": 3.0, "sourness": 0.5, "bitterness": 2.0, "spiciness": 1.0, "saltiness": 0, "umami": 0.5, "astringency": 0.5},
             "mouthfeel": {"thickness": 3.5, "smoothness": 5.0, "freshness": 3.0, "richness": 6.0, "aftertaste": 5.0},
             "flavor": [("草本", 7.0, "当归特有的浓烈香气"), ("辛香", 5.0, "微辛的芳香")], "appearance": 5.0},
    "茯苓": {"taste": {"sweetness": 2.0, "sourness": 0, "bitterness": 0.5, "spiciness": 0, "saltiness": 0, "umami": 0.5, "astringency": 0},
             "mouthfeel": {"thickness": 2.0, "smoothness": 7.0, "freshness": 6.0, "richness": 2.0, "aftertaste": 2.0},
             "flavor": [("淡香", 3.0, "清淡的菌类香气")], "appearance": 6.0},
    "红枣": {"taste": {"sweetness": 8.0, "sourness": 1.0, "bitterness": 0, "spiciness": 0, "saltiness": 0, "umami": 1.0, "astringency": 0},
             "mouthfeel": {"thickness": 3.0, "smoothness": 5.0, "freshness": 5.0, "richness": 5.0, "aftertaste": 5.0},
             "flavor": [("果香", 8.0, "甘甜的红枣香"), ("甜香", 7.0, "浓郁的焦糖甜香")], "appearance": 7.0},
    "菊花": {"taste": {"sweetness": 1.0, "sourness": 0.5, "bitterness": 3.0, "spiciness": 0, "saltiness": 0, "umami": 0, "astringency": 1.0},
             "mouthfeel": {"thickness": 1.0, "smoothness": 6.0, "freshness": 8.0, "richness": 1.5, "aftertaste": 2.0},
             "flavor": [("花香", 8.0, "清雅的菊花香"), ("草本", 5.0, "清新的植物气息")], "appearance": 8.0},
    "陈皮": {"taste": {"sweetness": 2.0, "sourness": 3.0, "bitterness": 2.0, "spiciness": 1.0, "saltiness": 0, "umami": 0.5, "astringency": 0.5},
             "mouthfeel": {"thickness": 2.0, "smoothness": 4.0, "freshness": 6.0, "richness": 3.0, "aftertaste": 3.0},
             "flavor": [("橘香", 9.0, "浓郁的柑橘皮香"), ("陈香", 6.0, "岁月沉淀的陈香")], "appearance": 4.0},
}


class SensoryEvaluationEngine:
    """
    感官智能评价引擎

    基于成分味觉知识库，预测配方的口感、风味和综合评分。
    """

    def __init__(self):
        self._herb_db = _HERB_TASTE_DB

    def evaluate(self, ingredients: list[str | dict]) -> SensoryReport:
        """
        评价配方的感官特性

        Args:
            ingredients: 原料列表，每项可为原料名(str)或包含 name 字段的 dict

        Returns:
            SensoryReport: 完整感官评价报告
        """
        names = []
        dosages = []
        for ing in ingredients:
            if isinstance(ing, dict):
                names.append(ing.get("name", ""))
                dosages.append(float(ing.get("dosage", 10)))
            else:
                names.append(ing)
                dosages.append(1.0)

        if not names:
            return self._empty_report()

        # 计算加权味觉轮廓
        taste = self._compute_weighted_taste(names, dosages)
        mouthfeel = self._compute_weighted_mouthfeel(names, dosages)
        flavor_notes = self._collect_flavor_notes(names)
        appearance = self._compute_appearance(names)
        scores = self._compute_scores(taste, mouthfeel, appearance)
        pros, cons = self._analyze_strengths_weaknesses(taste, mouthfeel)
        suggestions = self._generate_suggestions(taste, mouthfeel, scores)

        return SensoryReport(
            formula_name="、".join(names[:3]) + ("等" if len(names) > 3 else ""),
            taste_profile=taste,
            mouthfeel=mouthfeel,
            scores=scores,
            flavor_notes=flavor_notes,
            pros=pros,
            cons=cons,
            optimization_suggestions=suggestions,
            recommended_uses=self._recommend_uses(taste, scores),
        )

    def evaluate_with_optimization(
        self, ingredients: list[str | dict]
    ) -> tuple[SensoryReport, list[TasteOptimizationSuggestion]]:
        """评价并生成优化建议"""
        report = self.evaluate(ingredients)
        suggestions = self._get_optimization_suggestions(report)
        return report, suggestions

    # ─── 内部方法 ───

    def _compute_weighted_taste(self, names: list[str], dosages: list[float]) -> TasteProfile:
        """计算加权味觉轮廓"""
        total_weight = sum(dosages) or 1
        taste = TasteProfile()

        for name, dosage in zip(names, dosages):
            db_entry = self._herb_db.get(name)
            if not db_entry:
                continue
            weight = dosage / total_weight
            t = db_entry["taste"]
            taste.sweetness += t["sweetness"] * weight
            taste.sourness += t["sourness"] * weight
            taste.bitterness += t["bitterness"] * weight
            taste.spiciness += t["spiciness"] * weight
            taste.saltiness += t["saltiness"] * weight
            taste.umami += t["umami"] * weight
            taste.astringency += t["astringency"] * weight

        return taste

    def _compute_weighted_mouthfeel(self, names: list[str], dosages: list[float]) -> MouthfeelProfile:
        total_weight = sum(dosages) or 1
        mf = MouthfeelProfile()

        for name, dosage in zip(names, dosages):
            db_entry = self._herb_db.get(name)
            if not db_entry:
                continue
            weight = dosage / total_weight
            mf_data = db_entry["mouthfeel"]
            mf.thickness += mf_data["thickness"] * weight
            mf.smoothness += mf_data["smoothness"] * weight
            mf.freshness += mf_data["freshness"] * weight
            mf.richness += mf_data["richness"] * weight
            mf.aftertaste += mf_data["aftertaste"] * weight

        return mf

    def _collect_flavor_notes(self, names: list[str]) -> list[FlavorNote]:
        notes = []
        seen = set()
        for name in names:
            db_entry = self._herb_db.get(name)
            if not db_entry:
                continue
            for flavor_name, intensity, desc in db_entry.get("flavor", []):
                if flavor_name not in seen:
                    seen.add(flavor_name)
                    notes.append(FlavorNote(
                        name=flavor_name, intensity=intensity, description=desc
                    ))
        return sorted(notes, key=lambda x: -x.intensity)

    def _compute_appearance(self, names: list[str]) -> float:
        scores = [self._herb_db.get(n, {}).get("appearance", 5.0) for n in names]
        return sum(scores) / len(scores) if scores else 5.0

    def _compute_scores(
        self, taste: TasteProfile, mouthfeel: MouthfeelProfile, appearance: float
    ) -> SensoryScore:
        # 味觉评分：理想味觉曲线（五味平衡）
        # 甜度适中(3-6)、不酸(3-)、不苦(3-)、微鲜(2-)
        taste_score = 100.0
        taste_score -= abs(taste.sweetness - 4.5) * 3  # 甜度理想值4.5
        taste_score -= abs(taste.sourness - 2.5) * 4   # 酸度理想值2.5
        taste_score -= abs(taste.bitterness - 1.5) * 5  # 苦度越低越好
        taste_score -= abs(taste.spiciness) * 3
        taste_score = max(0, min(100, taste_score))

        # 口感评分
        mouthfeel_score = (
            mouthfeel.smoothness * 10 +
            mouthfeel.freshness * 8 +
            (10 - abs(mouthfeel.thickness - 3)) * 5 +
            mouthfeel.richness * 5 +
            mouthfeel.aftertaste * 6
        ) / 3.4
        mouthfeel_score = max(0, min(100, mouthfeel_score))

        flavor_score = min(90, 60 + mouthfeel_score * 0.3)
        overall = taste_score * 0.35 + flavor_score * 0.25 + mouthfeel_score * 0.25 + appearance * 1.5

        return SensoryScore(
            overall=overall,
            taste=taste_score,
            flavor=flavor_score,
            mouthfeel=mouthfeel_score,
            appearance=appearance * 10,
        )

    def _analyze_strengths_weaknesses(
        self, taste: TasteProfile, mouthfeel: MouthfeelProfile
    ) -> tuple[list[str], list[str]]:
        pros = []
        cons = []

        if 3 <= taste.sweetness <= 6:
            pros.append("甜度适中，口感接受度高")
        elif taste.sweetness > 7:
            pros.append("甜味突出，适合甜品应用")
        if taste.sourness < 3:
            pros.append("酸度适宜，不刺激")
        elif taste.sourness > 6:
            cons.append("酸度过高，可能需要中和")
            pros.append("酸味突出，适合开胃产品")
        if taste.bitterness < 2:
            pros.append("苦味轻微，适口性好")
        elif taste.bitterness > 5:
            cons.append("苦味较重，建议添加甜味原料调节")
        if taste.umami > 2:
            pros.append("鲜味明显，风味层次丰富")
        if mouthfeel.smoothness > 5:
            pros.append("口感顺滑细腻")
        if mouthfeel.freshness > 5:
            pros.append("清爽不腻")
        if mouthfeel.richness > 5:
            pros.append("醇厚感佳")
        if 2 <= mouthfeel.aftertaste <= 5:
            pros.append("回甘适中，余味持久")

        if not pros:
            pros.append("成分组合具有潜在开发价值")
        if not cons:
            cons.append("未见明显感官缺陷")

        return pros[:4], cons[:3]

    def _generate_suggestions(
        self, taste: TasteProfile, mouthfeel: MouthfeelProfile, scores: SensoryScore
    ) -> list[str]:
        suggestions = []

        if taste.bitterness > 4:
            suggestions.append("建议添加红枣、甘草等甜味原料中和苦味")
        if taste.sourness > 6:
            suggestions.append("可添加枸杞或红枣增加甜度，平衡酸味")
        if taste.sweetness > 7:
            suggestions.append("甜度偏高，可考虑减糖或增加酸味成分平衡")
        if taste.astringency > 4:
            suggestions.append("涩味偏重，建议搭配顺滑型原料（如茯苓）")
        if scores.overall < 60:
            suggestions.append("整体口感有较大提升空间，建议优化配方比例")
        if mouthfeel.thickness > 6:
            suggestions.append("质地偏厚重，可增加清爽型原料（如菊花）")
        if mouthfeel.thickness < 1.5:
            suggestions.append("质地偏薄，可增加醇厚型原料（如当归）")

        if not suggestions:
            suggestions.append("建议进行消费者口味测试验证")
            suggestions.append("可考虑开发多种口味版本")

        return suggestions

    def _recommend_uses(self, taste: TasteProfile, scores: SensoryScore) -> list[str]:
        uses = []
        if taste.sweetness > 5 and scores.overall > 60:
            uses.append("适合开发为日常养生饮品")
        if taste.sourness > 4:
            uses.append("适合餐前开胃产品")
        if scores.mouthfeel > 70:
            uses.append("适合作为调味基料")
        if taste.bitterness < 2 and taste.sweetness > 3:
            uses.append("适合大众消费市场")
        if not uses:
            uses.append("建议根据目标市场定向优化")
        return uses

    def _get_optimization_suggestions(
        self, report: SensoryReport
    ) -> list[TasteOptimizationSuggestion]:
        suggestions = []
        t = report.taste_profile

        if t.bitterness > 4:
            suggestions.append(TasteOptimizationSuggestion(
                target_dimension="bitterness",
                current_value=t.bitterness,
                target_value=2.0,
                suggestion="添加甘草或红枣增加甜味，降低苦感",
                adjustment_herbs=["甘草", "红枣"],
                priority="high",
            ))
        if t.sourness > 6:
            suggestions.append(TasteOptimizationSuggestion(
                target_dimension="sourness",
                current_value=t.sourness,
                target_value=3.0,
                suggestion="增加枸杞或茯苓平衡酸味",
                adjustment_herbs=["枸杞子", "茯苓"],
                priority="high",
            ))
        if t.sweetness > 7:
            suggestions.append(TasteOptimizationSuggestion(
                target_dimension="sweetness",
                current_value=t.sweetness,
                target_value=4.5,
                suggestion="可考虑减少甜味原料用量",
                adjustment_herbs=[],
                priority="medium",
            ))
        if report.scores.overall < 60:
            suggestions.append(TasteOptimizationSuggestion(
                target_dimension="overall",
                current_value=report.scores.overall,
                target_value=75.0,
                suggestion="建议调整原料比例，增强君药用量",
                adjustment_herbs=[],
                priority="high",
            ))

        return suggestions

    @staticmethod
    def _empty_report() -> SensoryReport:
        return SensoryReport(
            formula_name="空配方",
            taste_profile=TasteProfile(),
            mouthfeel=MouthfeelProfile(),
            scores=SensoryScore(),
            optimization_suggestions=["请添加原料后进行评价"],
        )

    def search_by_taste(self, target_taste: str, min_value: float = 5.0) -> list[str]:
        """按味觉特征搜索原料"""
        dim_map = {
            "甜": "sweetness", "酸": "sourness", "苦": "bitterness",
            "辣": "spiciness", "咸": "saltiness", "鲜": "umami", "涩": "astringency",
        }
        dim = dim_map.get(target_taste)
        if not dim:
            return []
        results = []
        for name, data in self._herb_db.items():
            if data["taste"].get(dim, 0) >= min_value:
                results.append(name)
        return results
