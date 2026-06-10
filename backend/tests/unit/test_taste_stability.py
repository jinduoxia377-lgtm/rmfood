"""
RMFOOD 口感预测与稳定性评估模块单元测试

覆盖范围:
- score_taste: 基础风味轮廓计算、成分风味贡献、边界条件
- score_stability: 存储条件因子、保质期预测、成分稳定性兼容性
- score_formula: 多目标综合评分集成

运行命令:
    pytest tests/unit/test_taste_stability.py -v

作者: RMFOOD Team
"""

import pytest


# ── Fixtures ──

@pytest.fixture
def scorer():
    """创建 MultiObjectiveScorer 实例"""
    from app.services.ai_models.scorer import MultiObjectiveScorer
    return MultiObjectiveScorer()


@pytest.fixture
def single_sweet_ingredient():
    """单一甜味成分"""
    return [{"name": "红枣", "taste": "甜", "cost": 10}]


@pytest.fixture
def mixed_ingredients():
    """多种味道成分组合"""
    return [
        {"name": "红枣", "taste": "甜", "cost": 10},
        {"name": "菊花", "taste": "苦", "cost": 5},
        {"name": "山楂", "taste": "酸", "cost": 8},
        {"name": "甘草", "taste": "甘", "cost": 3},
    ]


@pytest.fixture
def stability_ingredients():
    """含易变质成分的配方"""
    return [
        {"name": "菊花", "taste": "苦", "cost": 5},
        {"name": "薄荷", "taste": "辛", "cost": 6},
        {"name": "枸杞子", "taste": "甘", "cost": 12},
        {"name": "人参", "taste": "甘", "cost": 50},
    ]


@pytest.fixture
def stable_ingredients():
    """高稳定性成分配方（无易受潮/挥发成分）"""
    return [
        {"name": "人参", "taste": "甘", "cost": 50},
        {"name": "甘草", "taste": "甘", "cost": 3},
    ]


# ════════════════════════════════════════════
# 1. 口感评分 - 基础风味轮廓计算
# ════════════════════════════════════════════

class TestTasteBasicFlavorProfile:
    """口感评分 - 基础风味轮廓计算"""

    @pytest.mark.unit
    def test_sweet_ingredient_produces_high_score(self, scorer, single_sweet_ingredient):
        """甜味成分应产生较高的口感评分（无偏好时甜味加分）"""
        # Arrange
        ingredients = single_sweet_ingredient

        # Act
        score = scorer.score_taste(ingredients)

        # Assert
        assert 0.0 <= score <= 1.0
        # 甜味成分 bitterness 低，默认公式 0.8 - avg_bitterness*0.3 应较高
        assert score > 0.7

    @pytest.mark.unit
    def test_bitter_ingredient_produces_lower_score(self, scorer):
        """苦味成分在无偏好时应产生较低的评分"""
        # Arrange
        ingredients = [{"name": "黄连", "taste": "苦", "cost": 15}]

        # Act
        score = scorer.score_taste(ingredients)

        # Assert
        assert 0.0 <= score <= 1.0
        # 苦味成分 bitterness=0.9, 默认公式 0.8 - 0.9*0.3 = 0.53
        assert score < 0.6

    @pytest.mark.unit
    def test_mixed_ingredients_blended_flavor(self, scorer, mixed_ingredients):
        """多种成分应产生混合风味评分"""
        # Arrange
        ingredients = mixed_ingredients

        # Act
        score = scorer.score_taste(ingredients)

        # Assert
        assert 0.0 <= score <= 1.0
        # 混合成分评分应在合理范围
        assert 0.3 <= score <= 1.0

    @pytest.mark.unit
    def test_default_taste_for_unknown_taste_value(self, scorer):
        """未知味道值应使用'淡'作为默认值"""
        # Arrange
        ingredients = [{"name": "未知成分", "taste": "涩", "cost": 10}]

        # Act
        score = scorer.score_taste(ingredients)

        # Assert
        assert 0.0 <= score <= 1.0
        # "淡" 默认 sweetness=0.2, bitterness=0.2, astringency=0.2
        # 无偏好: 0.8 - 0.2*0.3 = 0.74
        assert score == pytest.approx(0.74, abs=0.02)

    @pytest.mark.unit
    def test_missing_taste_field_uses_default(self, scorer):
        """缺少taste字段的成分应使用'淡'默认值"""
        # Arrange
        ingredients = [{"name": "人参", "cost": 50}]

        # Act
        score = scorer.score_taste(ingredients)

        # Assert
        assert 0.0 <= score <= 1.0
        # 缺少 taste -> ingredient.get("taste", "淡") -> "淡"

    @pytest.mark.unit
    def test_all_taste_types_produce_valid_scores(self, scorer):
        """所有已知味道类型都应产生有效的评分"""
        # Arrange
        taste_types = ["甘", "甜", "酸", "苦", "辣", "辛", "淡", "鲜", "香"]

        # Act & Assert
        for taste in taste_types:
            ingredients = [{"name": f"测试_{taste}", "taste": taste}]
            score = scorer.score_taste(ingredients)
            assert 0.0 <= score <= 1.0, f"Taste '{taste}' produced out-of-range score: {score}"


# ════════════════════════════════════════════
# 2. 口感评分 - 成分风味贡献
# ════════════════════════════════════════════

class TestTasteIngredientContributions:
    """口感评分 - 成分风味贡献"""

    @pytest.mark.unit
    def test_equal_weight_distribution(self, scorer):
        """各成分应按等权重 (1/N) 贡献风味"""
        # Arrange
        # 两个相同的甜味成分，每个权重 0.5
        ingredients = [
            {"name": "红枣A", "taste": "甜"},
            {"name": "红枣B", "taste": "甜"},
        ]

        # Act
        score_two = scorer.score_taste(ingredients)

        # 单个甜味成分，权重 1.0
        single = [{"name": "红枣A", "taste": "甜"}]
        score_one = scorer.score_taste(single)

        # Assert
        # 两个相同成分的混合应与单个相同成分得分一致（权重均匀分配）
        assert score_two == pytest.approx(score_one, abs=0.01)

    @pytest.mark.unit
    def test_preference_matching_sweet(self, scorer):
        """指定甜偏好时，甜味配方应得到更高评分"""
        # Arrange
        sweet_ingredients = [
            {"name": "红枣", "taste": "甜"},
            {"name": "甘草", "taste": "甘"},
        ]
        bitter_ingredients = [
            {"name": "黄连", "taste": "苦"},
            {"name": "龙胆草", "taste": "苦"},
        ]

        # Act
        sweet_score = scorer.score_taste(sweet_ingredients, preference="甜")
        bitter_score = scorer.score_taste(bitter_ingredients, preference="甜")

        # Assert
        assert sweet_score > bitter_score

    @pytest.mark.unit
    def test_preference_matching_bitter(self, scorer):
        """指定苦偏好时，苦味配方应得到更高评分"""
        # Arrange
        sweet_ingredients = [
            {"name": "红枣", "taste": "甜"},
            {"name": "甘草", "taste": "甘"},
        ]
        bitter_ingredients = [
            {"name": "黄连", "taste": "苦"},
            {"name": "龙胆草", "taste": "苦"},
        ]

        # Act
        sweet_pref_score = scorer.score_taste(sweet_ingredients, preference="苦")
        bitter_pref_score = scorer.score_taste(bitter_ingredients, preference="苦")

        # Assert
        assert bitter_pref_score > sweet_pref_score

    @pytest.mark.unit
    def test_invalid_preference_falls_back_to_default(self, scorer):
        """无效偏好值应使用默认评分逻辑"""
        # Arrange
        ingredients = [{"name": "红枣", "taste": "甜"}]

        # Act
        score_default = scorer.score_taste(ingredients)
        score_invalid_pref = scorer.score_taste(ingredients, preference="不存在的偏好")

        # Assert
        assert score_default == pytest.approx(score_invalid_pref, abs=0.01)


# ════════════════════════════════════════════
# 3. 口感评分 - 边界条件
# ════════════════════════════════════════════

class TestTasteEdgeCases:
    """口感评分 - 边界条件"""

    @pytest.mark.unit
    def test_empty_ingredients_returns_zero(self, scorer):
        """空成分列表应返回 0.0"""
        # Arrange
        ingredients = []

        # Act
        score = scorer.score_taste(ingredients)

        # Assert
        assert score == 0.0

    @pytest.mark.unit
    def test_single_ingredient_produces_valid_score(self, scorer):
        """单一成分应产生有效评分"""
        # Arrange
        ingredients = [{"name": "人参", "taste": "甘"}]

        # Act
        score = scorer.score_taste(ingredients)

        # Assert
        assert 0.0 <= score <= 1.0

    @pytest.mark.unit
    def test_many_ingredients_produce_valid_score(self, scorer):
        """大量成分应产生有效评分"""
        # Arrange
        tastes = ["甘", "甜", "酸", "苦", "辣", "辛", "淡", "鲜", "香"]
        ingredients = [
            {"name": f"成分_{i}", "taste": tastes[i % len(tastes)]}
            for i in range(50)
        ]

        # Act
        score = scorer.score_taste(ingredients)

        # Assert
        assert 0.0 <= score <= 1.0

    @pytest.mark.unit
    def test_score_is_rounded_to_four_decimals(self, scorer):
        """评分应四舍五入到小数点后4位"""
        # Arrange
        ingredients = [{"name": "红枣", "taste": "甜"}, {"name": "菊花", "taste": "苦"}]

        # Act
        score = scorer.score_taste(ingredients)

        # Assert
        assert score == round(score, 4)


# ════════════════════════════════════════════
# 4. 稳定性评分 - 存储条件因子
# ════════════════════════════════════════════

class TestStabilityStorageConditions:
    """稳定性评分 - 存储条件因子"""

    @pytest.mark.unit
    def test_room_temperature_baseline(self, scorer, stable_ingredients):
        """25C 常温存储应作为基准条件"""
        # Arrange
        ingredients = stable_ingredients
        temp = 25.0

        # Act
        score = scorer.score_stability(ingredients, storage_temp=temp)

        # Assert
        # 25C -> temp_factor = max(0.5, 1.0 - 0/50) = 1.0
        # base = 1.0 + 0 (无易变质成分) = 1.0
        # score = 1.0 * 1.0 = 1.0
        assert score == 1.0

    @pytest.mark.unit
    def test_high_temperature_reduces_stability(self, scorer, stable_ingredients):
        """高温存储应降低稳定性评分"""
        # Arrange
        ingredients = stable_ingredients

        # Act
        score_room = scorer.score_stability(ingredients, storage_temp=25.0)
        score_hot = scorer.score_stability(ingredients, storage_temp=45.0)

        # Assert
        assert score_hot < score_room
        # 45C -> temp_factor = max(0.5, 1.0 - 20/50) = 0.6
        assert score_hot == pytest.approx(0.6, abs=0.01)

    @pytest.mark.unit
    def test_low_temperature_maintains_stability(self, scorer, stable_ingredients):
        """低温存储应维持或提高稳定性"""
        # Arrange
        ingredients = stable_ingredients

        # Act
        score_cold = scorer.score_stability(ingredients, storage_temp=4.0)
        score_room = scorer.score_stability(ingredients, storage_temp=25.0)

        # Assert
        # 4C -> temp_factor = max(0.5, 1.0 - (-21)/50) = max(0.5, 1.42) = 1.42
        # 但最终被 min(1.0, ...) 截断
        assert score_cold >= score_room
        assert score_cold == 1.0

    @pytest.mark.unit
    def test_extreme_high_temperature_floor(self, scorer, stable_ingredients):
        """极高温度时 temp_factor 不低于 0.5"""
        # Arrange
        ingredients = stable_ingredients

        # Act
        score = scorer.score_stability(ingredients, storage_temp=100.0)

        # Assert
        # 100C -> temp_factor = max(0.5, 1.0 - 75/50) = max(0.5, -0.5) = 0.5
        assert score == pytest.approx(0.5, abs=0.01)

    @pytest.mark.unit
    def test_score_never_exceeds_one(self, scorer):
        """评分不应超过 1.0"""
        # Arrange
        ingredients = [{"name": "人参", "taste": "甘"}]

        # Act
        score = scorer.score_stability(ingredients, storage_temp=-50.0)

        # Assert
        assert score <= 1.0


# ════════════════════════════════════════════
# 5. 稳定性评分 - 保质期预测
# ════════════════════════════════════════════

class TestStabilityShelfLife:
    """稳定性评分 - 保质期预测（通过成分稳定性间接验证）"""

    @pytest.mark.unit
    def test_no_moisture_volatile_ingredients_give_max_stability(self, scorer):
        """无受潮和挥发性成分时，常温存储应达到最高稳定性"""
        # Arrange
        ingredients = [
            {"name": "人参", "taste": "甘"},
            {"name": "甘草", "taste": "甘"},
        ]

        # Act
        score = scorer.score_stability(ingredients, storage_temp=25.0)

        # Assert
        assert score == 1.0

    @pytest.mark.unit
    def test_all_moisture_sensitive_ingredients_reduce_stability(self, scorer):
        """大量受潮敏感成分应显著降低稳定性"""
        # Arrange
        moisture_sensitive = ["菊花", "决明子", "桑叶", "红枣", "枸杞子", "百合", "山楂", "桑葚"]
        ingredients = [{"name": name, "taste": "甘"} for name in moisture_sensitive]

        # Act
        score = scorer.score_stability(ingredients, storage_temp=25.0)

        # Assert
        # 每个受潮成分 -0.1, 共8个 -> base = 1.0 - 0.8 = 0.2
        assert score == pytest.approx(0.2, abs=0.01)

    @pytest.mark.unit
    def test_volatile_ingredients_reduce_stability_less(self, scorer):
        """挥发性成分对稳定性的影响应小于受潮成分"""
        # Arrange
        volatile_only = [{"name": "薄荷", "taste": "辛"}]
        moisture_only = [{"name": "菊花", "taste": "苦"}]

        # Act
        score_volatile = scorer.score_stability(volatile_only, storage_temp=25.0)
        score_moisture = scorer.score_stability(moisture_only, storage_temp=25.0)

        # Assert
        # 薄荷: -0.05, 菊花: -0.1
        assert score_volatile > score_moisture
        assert score_volatile == pytest.approx(0.95, abs=0.01)
        assert score_moisture == pytest.approx(0.9, abs=0.01)


# ════════════════════════════════════════════
# 6. 稳定性评分 - 成分稳定性兼容性
# ════════════════════════════════════════════

class TestStabilityIngredientCompatibility:
    """稳定性评分 - 成分稳定性兼容性"""

    @pytest.mark.unit
    def test_mixed_stability_ingredients(self, scorer, stability_ingredients):
        """混合稳定性成分应产生综合评分"""
        # Arrange
        # 菊花(moisture -0.1), 薄荷(volatile -0.05), 枸杞子(moisture -0.1), 人参(neutral)
        ingredients = stability_ingredients

        # Act
        score = scorer.score_stability(ingredients, storage_temp=25.0)

        # Assert
        # base = 1.0 - 0.1 - 0.05 - 0.1 = 0.75
        assert score == pytest.approx(0.75, abs=0.01)

    @pytest.mark.unit
    def test_unknown_ingredients_have_no_penalty(self, scorer):
        """不在敏感列表中的成分不应降低稳定性"""
        # Arrange
        ingredients = [
            {"name": "茯苓", "taste": "淡"},
            {"name": "薏苡仁", "taste": "淡"},
        ]

        # Act
        score = scorer.score_stability(ingredients, storage_temp=25.0)

        # Assert
        assert score == 1.0

    @pytest.mark.unit
    def test_stability_with_high_temp_and_sensitive_ingredients(self, scorer):
        """高温 + 受潮敏感成分的叠加效应"""
        # Arrange
        ingredients = [
            {"name": "菊花", "taste": "苦"},     # moisture -0.1
            {"name": "薄荷", "taste": "辛"},     # volatile -0.05
        ]

        # Act
        score = scorer.score_stability(ingredients, storage_temp=40.0)

        # Assert
        # base = 1.0 - 0.1 - 0.05 = 0.85
        # temp_factor = max(0.5, 1.0 - 15/50) = 0.7
        # score = 0.85 * 0.7 = 0.595
        assert score == pytest.approx(0.595, abs=0.01)

    @pytest.mark.unit
    def test_empty_ingredients_returns_zero(self, scorer):
        """空成分列表应返回 0.0"""
        # Arrange
        ingredients = []

        # Act
        score = scorer.score_stability(ingredients)

        # Assert
        assert score == 0.0

    @pytest.mark.unit
    def test_stability_score_clamped_to_zero(self, scorer):
        """评分不应低于 0.0"""
        # Arrange
        # 构造大量受潮敏感成分使 base < 0
        moisture_sensitive = ["菊花", "决明子", "桑叶", "红枣", "枸杞子", "百合", "山楂", "桑葚"]
        volatile = ["薄荷", "丁香", "八角茴香", "小茴香"]
        ingredients = [{"name": n, "taste": "苦"} for n in moisture_sensitive + volatile]

        # Act
        score = scorer.score_stability(ingredients, storage_temp=75.0)

        # Assert
        # base = 1.0 - 8*0.1 - 4*0.05 = -0.2 -> clamped via max(0, ...)
        assert score >= 0.0


# ════════════════════════════════════════════
# 7. 综合评分集成
# ════════════════════════════════════════════

class TestOverallScoringIntegration:
    """综合评分集成 - score_formula"""

    @pytest.mark.unit
    def test_score_formula_returns_all_dimensions(self, scorer):
        """综合评分应返回所有维度的分数字典"""
        # Arrange
        ingredients = [
            {"name": "人参", "taste": "甘", "efficacy": ["补气"], "cost": 50},
            {"name": "红枣", "taste": "甜", "efficacy": ["养血"], "cost": 10},
        ]
        target_effects = ["补气", "养血"]

        # Act
        result = scorer.score_formula(ingredients, target_effects)

        # Assert
        expected_keys = [
            "efficacy_score", "safety_score", "taste_score", "stability_score",
            "cost_score", "synergy_score", "constraint_score", "weighted_score",
            "final_score", "calibrated_score", "confidence", "weights",
        ]
        for key in expected_keys:
            assert key in result, f"Missing key: {key}"

    @pytest.mark.unit
    def test_score_formula_dimensions_in_range(self, scorer):
        """所有维度评分应在 [0, 1] 范围内"""
        # Arrange
        ingredients = [
            {"name": "人参", "taste": "甘", "efficacy": ["补气"], "cost": 50},
            {"name": "红枣", "taste": "甜", "efficacy": ["养血"], "cost": 10},
            {"name": "菊花", "taste": "苦", "efficacy": ["清热"], "cost": 5},
        ]
        target_effects = ["补气", "养血", "清热"]

        # Act
        result = scorer.score_formula(ingredients, target_effects)

        # Assert
        dimension_keys = [
            "efficacy_score", "safety_score", "taste_score", "stability_score",
            "cost_score", "synergy_score", "constraint_score",
        ]
        for key in dimension_keys:
            assert 0.0 <= result[key] <= 1.0, f"{key} = {result[key]} out of range"

    @pytest.mark.unit
    def test_score_formula_weighted_score_reflects_weights(self, scorer):
        """加权评分应正确反映目标权重"""
        # Arrange
        ingredients = [
            {"name": "人参", "taste": "甘", "efficacy": ["补气"], "cost": 50},
            {"name": "红枣", "taste": "甜", "efficacy": ["养血"], "cost": 10},
        ]
        target_effects = ["补气", "养血"]

        # Act
        result = scorer.score_formula(ingredients, target_effects)

        # Assert
        expected_weighted = (
            result["efficacy_score"] * 0.30
            + result["safety_score"] * 0.30
            + result["taste_score"] * 0.20
            + result["stability_score"] * 0.20
        )
        assert result["weighted_score"] == pytest.approx(expected_weighted, abs=0.01)

    @pytest.mark.unit
    def test_score_formula_with_constraints(self, scorer):
        """带约束条件的综合评分应正确处理"""
        # Arrange
        ingredients = [
            {"name": "人参", "taste": "甘", "efficacy": ["补气"], "cost": 50},
            {"name": "红枣", "taste": "甜", "efficacy": ["养血"], "cost": 10},
        ]
        target_effects = ["补气", "养血"]
        constraints = {
            "preferred_taste": "甜",
            "storage_temp": 20.0,
            "max_budget": 100.0,
        }

        # Act
        result = scorer.score_formula(ingredients, target_effects, constraints=constraints)

        # Assert
        assert 0.0 <= result["final_score"] <= 1.0
        assert result["taste_score"] > 0.0
        assert result["stability_score"] > 0.0

    @pytest.mark.unit
    def test_score_formula_empty_ingredients(self, scorer):
        """空成分列表应返回零分或最低分"""
        # Arrange
        ingredients = []
        target_effects = ["补气"]

        # Act
        result = scorer.score_formula(ingredients, target_effects)

        # Assert
        assert result["efficacy_score"] == 0.0
        assert result["taste_score"] == 0.0
        assert result["stability_score"] == 0.0
        assert result["safety_score"] == 0.0

    @pytest.mark.unit
    def test_rank_candidates_orders_by_score(self, scorer):
        """rank_candidates 应按校准评分降序排列"""
        # Arrange
        candidates = [
            {
                "name": "配方A",
                "ingredients": [
                    {"name": "人参", "taste": "甘", "efficacy": ["补气"], "cost": 50},
                    {"name": "红枣", "taste": "甜", "efficacy": ["养血"], "cost": 10},
                ],
            },
            {
                "name": "配方B",
                "ingredients": [
                    {"name": "黄连", "taste": "苦", "efficacy": ["清热"], "cost": 20},
                ],
            },
        ]
        target_effects = ["补气", "养血"]

        # Act
        ranked = scorer.rank_candidates(candidates, target_effects)

        # Assert
        assert len(ranked) == 2
        score_a = ranked[0]["score_result"]["calibrated_score"]
        score_b = ranked[1]["score_result"]["calibrated_score"]
        assert score_a >= score_b
        assert ranked[0]["rank"] == 1
        assert ranked[1]["rank"] == 2

    @pytest.mark.unit
    def test_calibration_model_updates_bias(self, scorer):
        """校准模型应根据反馈更新 bias"""
        # Arrange
        initial_bias = scorer.calibration_model.bias
        predicted = 0.5
        actual = 0.8

        # Act
        scorer.calibration_model.update_from_feedback(predicted, actual)

        # Assert
        assert scorer.calibration_model.bias != initial_bias
        # 误差为正 -> bias 应增加
        assert scorer.calibration_model.bias > initial_bias

    @pytest.mark.unit
    def test_feedback_tracker_records_history(self, scorer):
        """反馈追踪器应正确记录历史"""
        # Arrange
        tracker = scorer.feedback_tracker

        # Act
        tracker.add_feedback(formula_id=1, predicted_score=0.7, actual_score=0.8)
        tracker.add_feedback(formula_id=2, predicted_score=0.6, actual_score=0.65)

        # Assert
        assert len(tracker.feedback_history) == 2
        assert tracker.get_average_error() > 0.0

    @pytest.mark.unit
    def test_user_preference_affects_calibrated_score(self, scorer):
        """用户偏好应影响校准评分"""
        # Arrange
        ingredients = [
            {"name": "人参", "taste": "甘", "efficacy": ["补气"], "cost": 50},
            {"name": "红枣", "taste": "甜", "efficacy": ["养血"], "cost": 10},
        ]
        target_effects = ["补气", "养血"]

        # 无用户偏好
        result_no_pref = scorer.score_formula(ingredients, target_effects, user_id=None)

        # 设置用户偏好
        scorer.feedback_tracker.update_user_preference(42, "taste", 5.0)
        result_with_pref = scorer.score_formula(ingredients, target_effects, user_id=42)

        # Assert
        assert result_with_pref["calibrated_score"] != result_no_pref["calibrated_score"]
