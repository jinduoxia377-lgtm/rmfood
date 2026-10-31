"""
AI 核心算法单元测试套件

院士级修复[P1]: 为三类核心模块建立独立测试策略：

1. 遗传算法 (GeneticFormulaOptimizer)
   - 测试个体适应度评估函数的正确性
   - 用确定性随机种子验证进化过程可重现性
   - 测试 HerbKnowledgePort 注入路径

2. 贝叶斯优化 (BayesianFormulaOptimizer)
   - 测试贝叶斯配置边界校验
   - 测试 HerbKnowledgePort 注入路径（使用 InMemoryHerbKnowledgeAdapter）

3. HerbKnowledgePort 适配器
   - 测试 InMemoryHerbKnowledgeAdapter 的完整接口
   - 测试 HerbProfile 数据模型边界

测试原则:
- 全部单元测试无需数据库（使用内存适配器）
- 使用确定性随机种子（random.seed）
- 数值精度验证使用 pytest.approx

P1 修复:
- 修正导入路径：app.domain.herb_ports（原 ports.py 已随 DDD 死代码删除）、
  app.services.ai.algorithms.*（模块迁移后的实际路径）。
- GeneticFormulaOptimizer 的 optimize() 为同步方法，评分使用注入的内存药材字典。
"""

import random
import asyncio
import pytest

import sys
import os

# 确保可以找到 backend 目录
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))


# ══════════════════════════════════════════════════════════
# 测试辅助工具
# ══════════════════════════════════════════════════════════

def make_test_herb_profiles():
    """构建测试用的 HerbProfile 集合（确定性数据）"""
    from app.domain.herb_ports import HerbProfile

    return [
        HerbProfile(
            herb_id="hq",
            name_cn="黄芪",
            dosage_min=3.0, dosage_max=30.0, dosage_step=1.0,
            efficacy_scores={"免疫调节": 0.92, "抗氧化": 0.78, "抗疲劳": 0.85, "补气": 0.90},
            safety_index=0.95,
            cost_per_gram=0.08,
            synergy_partners=["ds", "gz"],
            antagonistic_pairs=["fz"],
        ),
        HerbProfile(
            herb_id="ds",
            name_cn="党参",
            dosage_min=3.0, dosage_max=15.0, dosage_step=1.0,
            efficacy_scores={"免疫调节": 0.85, "抗疲劳": 0.80, "补气": 0.90},
            safety_index=0.95,
            cost_per_gram=0.12,
            synergy_partners=["hq", "gz"],
            antagonistic_pairs=[],
        ),
        HerbProfile(
            herb_id="gz",
            name_cn="枸杞子",
            dosage_min=3.0, dosage_max=15.0, dosage_step=1.0,
            efficacy_scores={"抗氧化": 0.90, "免疫调节": 0.82, "抗衰老": 0.85},
            safety_index=0.98,
            cost_per_gram=0.15,
            synergy_partners=["hq", "ds"],
            antagonistic_pairs=[],
        ),
        HerbProfile(
            herb_id="gq",
            name_cn="甘草",
            dosage_min=1.0, dosage_max=6.0, dosage_step=0.5,
            efficacy_scores={"调和诸药": 0.90, "抗炎": 0.78},
            safety_index=0.92,
            cost_per_gram=0.05,
            synergy_partners=["hq", "ds"],
            antagonistic_pairs=[],
        ),
        HerbProfile(
            herb_id="fz",
            name_cn="附子",
            dosage_min=1.0, dosage_max=9.0, dosage_step=0.5,
            efficacy_scores={"回阳救逆": 0.90, "止痛": 0.78},
            safety_index=0.40,
            cost_per_gram=0.25,
            synergy_partners=[],
            antagonistic_pairs=["hq", "ds"],
        ),
    ]


def _make_kb():
    """构建注入优化器的内存 HerbKnowledgeService（无需数据库）"""
    from app.services.ai.algorithms.herb_knowledge_service import HerbKnowledgeService
    from app.infrastructure.herb_knowledge_adapters import InMemoryHerbKnowledgeAdapter

    kb = HerbKnowledgeService(InMemoryHerbKnowledgeAdapter(herbs=make_test_herb_profiles()))
    asyncio.run(kb.load_herbs())
    return kb


def _make_extra_profiles():
    """构造 20 味附加测试药材画像（用于凑足 >20 的完整性检查）"""
    from app.domain.herb_ports import HerbProfile

    extra_ids = [
        "hqg", "bq", "fp", "jgh", "cs", "lk", "mld", "cx", "yq", "cyh",
        "dcx", "sj", "gh", "sz", "dsz", "sx", "jq", "lq", "bo", "gy",
    ]
    return [
        HerbProfile(
            herb_id=hid,
            name_cn=f"测试药材{i + 1}",
            dosage_min=3.0, dosage_max=15.0, dosage_step=1.0,
            efficacy_scores={"免疫调节": 0.70, "抗氧化": 0.60},
            safety_index=0.90,
            cost_per_gram=0.10,
        )
        for i, hid in enumerate(extra_ids)
    ]


# ══════════════════════════════════════════════════════════
# 1. InMemoryHerbKnowledgeAdapter 接口测试
# ══════════════════════════════════════════════════════════

class TestInMemoryHerbKnowledgeAdapter:
    """测试内存药材知识库适配器的完整接口契约"""

    def setup_method(self):
        from app.infrastructure.herb_knowledge_adapters import InMemoryHerbKnowledgeAdapter
        self.herbs = make_test_herb_profiles()
        self.adapter = InMemoryHerbKnowledgeAdapter(herbs=self.herbs)

    @pytest.mark.asyncio
    async def test_get_herb_by_id_found(self):
        herb = await self.adapter.get_herb_by_id("hq")
        assert herb is not None
        assert herb.name_cn == "黄芪"
        assert herb.safety_index == pytest.approx(0.95)

    @pytest.mark.asyncio
    async def test_get_herb_by_id_not_found(self):
        herb = await self.adapter.get_herb_by_id("nonexistent")
        assert herb is None

    @pytest.mark.asyncio
    async def test_get_herbs_by_efficacy_immune(self):
        herbs = await self.adapter.get_herbs_by_efficacy("免疫调节")
        herb_ids = [h.herb_id for h in herbs]
        assert "hq" in herb_ids
        assert "ds" in herb_ids
        assert "gz" in herb_ids
        # 按评分降序
        scores = [h.efficacy_scores["免疫调节"] for h in herbs]
        assert scores == sorted(scores, reverse=True)

    @pytest.mark.asyncio
    async def test_get_herbs_by_efficacy_empty(self):
        herbs = await self.adapter.get_herbs_by_efficacy("不存在的功效")
        assert herbs == []

    @pytest.mark.asyncio
    async def test_get_all_herbs(self):
        herbs = await self.adapter.get_all_herbs()
        assert len(herbs) == 5
        ids = {h.herb_id for h in herbs}
        assert ids == {"hq", "ds", "gz", "gq", "fz"}

    @pytest.mark.asyncio
    async def test_get_efficacy_index(self):
        index = await self.adapter.get_efficacy_index()
        assert "免疫调节" in index
        assert "hq" in index["免疫调节"]

    @pytest.mark.asyncio
    async def test_find_synergy_group(self):
        synergy = await self.adapter.find_synergy_group("hq")
        assert "ds" in synergy
        assert "gz" in synergy

    @pytest.mark.asyncio
    async def test_find_antagonistic(self):
        antagonistic = await self.adapter.find_antagonistic("fz")
        assert "hq" in antagonistic

    def test_add_herb_dynamically(self):
        from app.domain.herb_ports import HerbProfile
        new_herb = HerbProfile(
            herb_id="jgh",
            name_cn="菊花",
            dosage_min=3.0, dosage_max=10.0, dosage_step=1.0,
            efficacy_scores={"清热解毒": 0.85},
            safety_index=0.96,
        )
        self.adapter.add_herb(new_herb)
        assert "jgh" in self.adapter._profiles
        assert "清热解毒" in self.adapter._efficacy_index


# ══════════════════════════════════════════════════════════
# 2. Individual 适应度评估单元测试
# ══════════════════════════════════════════════════════════

class TestIndividualFitness:
    """遗传算法个体适应度评估的正确性测试"""

    def setup_method(self):
        from app.services.ai.algorithms.genetic_formula_optimizer import Individual
        self.Individual = Individual
        # P1 之后 evaluate 依赖注入的药材字典：这里用测试药材画像构造字典
        self.herbs = {h.herb_id: h for h in make_test_herb_profiles()}

    def test_empty_genes_zero_fitness(self):
        ind = self.Individual({})
        ind.evaluate(["免疫调节"], herb_dict=self.herbs)
        assert ind.fitness == 0

    def test_high_safety_herb_better_safety_score(self):
        """安全性高的药材（黄芪0.95）配出的配方安全评分应高于低安全性药材（附子0.40）"""
        ind_safe = self.Individual({"hq": 10.0, "ds": 8.0, "gz": 6.0})
        ind_danger = self.Individual({"fz": 5.0})

        ind_safe.evaluate(["免疫调节"], herb_dict=self.herbs)
        ind_danger.evaluate(["回阳救逆"], herb_dict=self.herbs)

        assert ind_safe.safety > ind_danger.safety, \
            f"安全配方的安全评分({ind_safe.safety:.3f}) 应 > 危险配方({ind_danger.safety:.3f})"

    def test_antagonistic_penalty_applied(self):
        """相反药材（hq vs fz）配伍时，安全评分应有惩罚"""
        ind_normal = self.Individual({"hq": 10.0, "ds": 8.0})
        ind_conflict = self.Individual({"hq": 10.0, "fz": 5.0})

        ind_normal.evaluate(["免疫调节"], herb_dict=self.herbs)
        ind_conflict.evaluate(["免疫调节"], herb_dict=self.herbs)

        assert ind_normal.safety > ind_conflict.safety, \
            "包含禁忌配伍的配方安全评分应低于正常配方"

    def test_fitness_components_sum_correctly(self):
        """适应度综合评分应等于各分量的加权和（含结构合规因子）"""
        ind = self.Individual({"hq": 10.0, "ds": 8.0, "gz": 6.0, "gq": 3.0})
        ind.evaluate(["免疫调节", "抗氧化"], herb_dict=self.herbs)

        # 当前 Individual.DEFAULT_OBJECTIVE_WEIGHTS:
        #   efficacy0.30 / safety0.25 / taste0.10 / cost0.15 / synergy0.10 / stability0.10
        # fitness = 加权和 * (0.5 + 0.5*structural_compliance)，默认 structural_compliance=0.7
        expected = (
            ind.efficacy * 0.30 +
            ind.safety * 0.25 +
            ind.taste * 0.10 +
            ind.cost * 0.15 +
            ind.synergy * 0.10 +
            ind.stability * 0.10
        ) * (0.5 + 0.5 * ind.structural_compliance)
        assert ind.fitness == pytest.approx(expected, abs=1e-6), \
            f"适应度应等于加权分量之和"

    def test_fitness_range_0_to_1(self):
        """所有评分分量应在 [0, 1] 区间内"""
        ind = self.Individual({"hq": 15.0, "ds": 10.0, "gz": 8.0})
        ind.evaluate(["免疫调节"], herb_dict=self.herbs)

        for attr in ("efficacy", "safety", "taste", "cost", "fitness"):
            val = getattr(ind, attr)
            assert 0.0 <= val <= 1.0, f"{attr} 应在 [0, 1]，实际值: {val}"

    def test_reproducible_with_same_seed(self):
        """使用相同随机种子，遗传算法结果应可复现"""
        from app.services.ai.algorithms.genetic_formula_optimizer import (
            GeneticFormulaOptimizer, GAConfig
        )
        config = GAConfig(
            population_size=10,
            generations=5,
            target_effects=["免疫调节"],
        )

        def run_once(seed: int):
            random.seed(seed)
            opt = GeneticFormulaOptimizer(config=config, herb_knowledge=_make_kb())
            results, history = opt.optimize(["免疫调节"])
            return results[0].fitness if results else 0.0

        seed = 42
        fitness1 = run_once(seed)
        fitness2 = run_once(seed)
        assert fitness1 == pytest.approx(fitness2, abs=1e-8), \
            "相同随机种子下遗传算法结果应完全可复现"


# ══════════════════════════════════════════════════════════
# 3. GeneticFormulaOptimizer 集成单元测试
# ══════════════════════════════════════════════════════════

class TestGeneticFormulaOptimizer:
    """遗传算法优化器的集成测试（使用内存知识库）"""

    def test_optimize_returns_results(self):
        from app.services.ai.algorithms.genetic_formula_optimizer import (
            GeneticFormulaOptimizer, GAConfig
        )

        config = GAConfig(population_size=20, generations=5)
        opt = GeneticFormulaOptimizer(config=config, herb_knowledge=_make_kb())

        results, history = opt.optimize(["免疫调节"])

        assert len(results) > 0, "优化结果不能为空"
        assert len(history) == 5, f"进化历史应有 5 代，实际: {len(history)}"

    def test_optimize_with_kb_finds_more_herbs(self):
        """注入知识库后，优化器应能访问所有注入的药材"""
        from app.services.ai.algorithms.genetic_formula_optimizer import (
            GeneticFormulaOptimizer, GAConfig
        )
        from app.services.ai.algorithms.herb_knowledge_service import HerbKnowledgeService
        from app.infrastructure.herb_knowledge_adapters import InMemoryHerbKnowledgeAdapter
        from app.domain.herb_ports import HerbProfile

        # 创建包含额外"新药材"的知识库
        herbs = make_test_herb_profiles() + [
            HerbProfile(
                herb_id="test_new_herb",
                name_cn="测试新药材",
                dosage_min=1.0, dosage_max=10.0, dosage_step=1.0,
                efficacy_scores={"免疫调节": 0.99},  # 超高免疫调节评分
                safety_index=0.99,
                cost_per_gram=0.01,
            )
        ]
        kb = HerbKnowledgeService(InMemoryHerbKnowledgeAdapter(herbs=herbs))
        asyncio.run(kb.load_herbs())
        opt = GeneticFormulaOptimizer(
            config=GAConfig(population_size=20, generations=3),
            herb_knowledge=kb,
        )

        opt._try_load_herb_knowledge()
        assert "test_new_herb" in opt._herbs, \
            "注入知识库后应包含新增药材"

    def test_optimize_results_fitness_ordered(self):
        """优化结果应按适应度降序排列"""
        from app.services.ai.algorithms.genetic_formula_optimizer import (
            GeneticFormulaOptimizer, GAConfig
        )
        config = GAConfig(population_size=20, generations=5)
        opt = GeneticFormulaOptimizer(config=config, herb_knowledge=_make_kb())
        results, _ = opt.optimize(["免疫调节"])

        if len(results) >= 2:
            fitnesses = [r.fitness for r in results]
            assert fitnesses == sorted(fitnesses, reverse=True), \
                "结果应按适应度降序排列"

    def test_exclude_herbs_respected(self):
        """exclude_herbs 参数应排除指定药材"""
        from app.services.ai.algorithms.genetic_formula_optimizer import (
            GeneticFormulaOptimizer, GAConfig
        )
        config = GAConfig(population_size=20, generations=3)
        opt = GeneticFormulaOptimizer(config=config, herb_knowledge=_make_kb())
        # 排除危险附子
        results, _ = opt.optimize(["免疫调节"], exclude_herbs={"fz"})

        for ind in results:
            assert "fz" not in ind.genes, "排除的药材不应出现在优化结果中"


# ══════════════════════════════════════════════════════════
# 4. BayesianFormulaOptimizer 单元测试
# ══════════════════════════════════════════════════════════

class TestBayesianFormulaOptimizer:
    """贝叶斯优化器配置校验和知识库注入测试"""

    def test_config_defaults(self):
        from app.services.ai.algorithms.bayesian_formula_optimizer import BayesianConfig
        cfg = BayesianConfig()
        assert cfg.n_initial_random == 10
        assert cfg.n_optimization_rounds == 30
        assert 0.0 <= cfg.exploration_weight <= 1.0

    @pytest.mark.asyncio
    async def test_optimizer_with_kb_loads_herbs(self):
        """验证注入 HerbKnowledgePort 后，贝叶斯优化器能加载药材"""
        from app.services.ai.algorithms.bayesian_formula_optimizer import (
            BayesianFormulaOptimizer, BayesianConfig
        )
        from app.services.ai.algorithms.herb_knowledge_service import HerbKnowledgeService
        from app.infrastructure.herb_knowledge_adapters import InMemoryHerbKnowledgeAdapter

        config = BayesianConfig(
            n_initial_random=3,
            n_optimization_rounds=2,
            n_candidates=2,
        )
        # 在异步上下文中直接 await 加载，避免 asyncio.run 嵌套
        kb = HerbKnowledgeService(InMemoryHerbKnowledgeAdapter(
            herbs=make_test_herb_profiles() + _make_extra_profiles(),
        ))
        await kb.load_herbs()
        opt = BayesianFormulaOptimizer(config=config, herb_knowledge=kb)

        # 加载后应至少有 20 种药材（满足数据库完整性检查）
        await opt._ensure_herbs_loaded(["免疫调节"])
        assert len(opt._herbs) >= 20, \
            f"加载后应至少有 20 种药材，实际: {len(opt._herbs)}"

    @pytest.mark.asyncio
    async def test_generate_returns_candidates(self):
        """验证 generate 方法返回候选方案"""
        from app.services.ai.algorithms.bayesian_formula_optimizer import (
            BayesianFormulaOptimizer, BayesianConfig
        )
        config = BayesianConfig(
            n_initial_random=5,
            n_optimization_rounds=3,
            n_candidates=2,
            target_effects=["免疫调节"],
        )
        opt = BayesianFormulaOptimizer(config=config)
        results = await opt.generate(["免疫调节"])

        assert isinstance(results, list), "结果应为列表"
        for candidate in results:
            assert 0.0 <= candidate.overall_score <= 1.0
            assert 0.0 <= candidate.safety_score <= 1.0


# ══════════════════════════════════════════════════════════
# 5. HerbProfile 数据模型边界测试
# ══════════════════════════════════════════════════════════

class TestHerbProfile:
    """HerbProfile 数据模型的边界情况测试"""

    def test_default_values(self):
        from app.domain.herb_ports import HerbProfile
        herb = HerbProfile(herb_id="test", name_cn="测试药材")
        assert herb.dosage_min == 0.0
        assert herb.dosage_max == 30.0
        assert herb.safety_index == 0.9
        assert herb.efficacy_scores == {}
        assert herb.synergy_partners == []
        assert herb.antagonistic_pairs == []

    def test_custom_values(self):
        from app.domain.herb_ports import HerbProfile
        herb = HerbProfile(
            herb_id="custom",
            name_cn="自定义药材",
            dosage_min=5.0,
            dosage_max=50.0,
            efficacy_scores={"抗炎": 0.88, "免疫调节": 0.75},
            safety_index=0.85,
        )
        assert herb.herb_id == "custom"
        assert herb.dosage_max == 50.0
        assert herb.efficacy_scores["抗炎"] == pytest.approx(0.88)