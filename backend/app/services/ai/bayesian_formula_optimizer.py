"""
贝叶斯优化配方生成引擎 (Bayesian Formula Optimizer)

使用贝叶斯优化算法为药食同源功能性食品配方提供智能生成。
将配方生成建模为黑箱优化问题：

    目标: argmax f(配方成分向量)
    其中 f 是功效/口感/安全/成本的多目标综合评分

核心算法:
    1. 高斯过程回归 (GPR) 作为代理模型
    2. Expected Improvement (EI) 采集函数
    3. 多目标 Pareto 优化
    4. 先验知识注入 (TCMSP 药材配伍规则)

@version 1.0.0
@lastUpdated 2026-06-07
"""

import logging
import math
import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any

logger = logging.getLogger(__name__)

# ════════════════════════════════════════════
# 类型定义
# ════════════════════════════════════════════

@dataclass
class HerbParameter:
    """药材参数定义 — 贝叶斯优化的搜索空间维度"""
    herb_id: str
    name_cn: str                     # 药材中文名
    dosage_min: float                # 最小用量 (g)
    dosage_max: float                # 最大用量 (g)
    dosage_step: float               # 用量步长
    efficacy_scores: Dict[str, float] # 功效评分 {功效名: 0~1}
    safety_index: float              # 安全性指数 0~1
    cost_per_gram: float             # 每克成本
    synergy_partners: List[str]      # 协同配伍药材ID列表
    antagonistic_pairs: List[str]    # 相反药材ID列表


@dataclass
class FormulaCandidate:
    """配方候选方案"""
    ingredients: Dict[str, float]    # {药材ID: 用量(g)}
    efficacy_score: float            # 功效评分 (0~1)
    safety_score: float              # 安全评分 (0~1)
    taste_score: float               # 口感评分 (0~1)
    cost_score: float                # 成本评分 (0~1)
    overall_score: float             # 综合评分 (0~1)
    confidence: float                # 置信度 (0~1)
    generation_round: int            # 生成轮次


@dataclass
class BayesianConfig:
    """贝叶斯优化配置"""
    n_initial_random: int = 10       # 初始随机采样数
    n_optimization_rounds: int = 30  # 贝叶斯优化轮次
    n_candidates: int = 5            # 最终推荐候选数
    exploration_weight: float = 0.3  # 探索权重 (EI 中 epsilon)
    target_effects: List[str] = field(default_factory=lambda: ["免疫调节"])
    max_ingredients: int = 12        # 最大成分数
    min_ingredients: int = 3         # 最小成分数


# ════════════════════════════════════════════
# 内置药材知识库 (药食同源目录)
# ════════════════════════════════════════════

_BUILTIN_HERBS: Dict[str, HerbParameter] = {
    "hq": HerbParameter("hq", "黄芪", 3, 30, 1,
        {"免疫调节": 0.92, "抗氧化": 0.78, "抗疲劳": 0.85, "降血糖": 0.65, "心血管保护": 0.72},
        0.95, 0.08, ["ds", "gz", "hqg"], ["fz"]),
    "ds": HerbParameter("ds", "党参", 3, 15, 1,
        {"免疫调节": 0.85, "抗疲劳": 0.80, "消化系统": 0.75, "补气": 0.90},
        0.95, 0.12, ["hq", "gz", "bq"], []),
    "gz": HerbParameter("gz", "枸杞子", 3, 15, 1,
        {"抗氧化": 0.90, "免疫调节": 0.82, "护肝": 0.78, "明目": 0.75, "抗衰老": 0.85},
        0.98, 0.15, ["hq", "ds", "jgh"], []),
    "rs": HerbParameter("rs", "人参", 1, 9, 0.5,
        {"抗疲劳": 0.95, "免疫调节": 0.90, "认知功能": 0.82, "心血管保护": 0.78},
        0.85, 0.50, ["hq", "dg"], ["lk", "mld"]),
    "dg": HerbParameter("dg", "当归", 3, 12, 1,
        {"补血": 0.92, "调经": 0.88, "抗氧化": 0.75, "免疫调节": 0.70},
        0.92, 0.18, ["hq", "rs", "cs"], []),
    "hqg": HerbParameter("hqg", "黄芪根", 3, 25, 1,
        {"免疫调节": 0.88, "抗氧化": 0.75, "抗炎": 0.80, "心血管保护": 0.70},
        0.93, 0.08, ["hq", "ds", "bq"], []),
    "bq": HerbParameter("bq", "白术", 3, 15, 1,
        {"消化系统": 0.85, "免疫调节": 0.72, "利尿": 0.65, "补气": 0.80},
        0.94, 0.10, ["ds", "hq", "fp"], []),
    "fp": HerbParameter("fp", "茯苓", 6, 20, 1,
        {"利尿": 0.85, "免疫调节": 0.70, "消化系统": 0.68, "安神": 0.60},
        0.97, 0.06, ["bq", "gq", "yq"], []),
    "gq": HerbParameter("gq", "甘草", 1, 6, 0.5,
        {"调和诸药": 0.90, "抗炎": 0.78, "止咳": 0.72, "解毒": 0.75},
        0.92, 0.05, ["hq", "fp", "dg"], []),
    "jgh": HerbParameter("jgh", "菊花", 3, 10, 1,
        {"明目": 0.88, "清热解毒": 0.82, "抗氧化": 0.75, "降血压": 0.70},
        0.96, 0.12, ["gz", "bq", "cyh"], []),
    "cs": HerbParameter("cs", "川芎", 3, 10, 0.5,
        {"活血": 0.88, "止痛": 0.82, "心血管保护": 0.78, "抗氧化": 0.70},
        0.88, 0.20, ["dg", "hq", "cx"], []),
    "lk": HerbParameter("lk", "藜芦", 0.5, 3, 0.5,
        {"催吐": 0.60, "降压": 0.55},
        0.30, 0.30, [], ["rs", "ds", "cs"]),
    "mld": HerbParameter("mld", "马利兰", 1, 3, 0.5,
        {"降压": 0.50},
        0.25, 0.40, [], ["rs", "hq"]),
    "fz": HerbParameter("fz", "附子", 1, 9, 0.5,
        {"回阳救逆": 0.90, "止痛": 0.78, "心血管保护": 0.72},
        0.40, 0.25, [], ["hq", "bq"]),
    "cx": HerbParameter("cx", "陈皮", 2, 10, 0.5,
        {"消化系统": 0.85, "化痰": 0.78, "理气": 0.82},
        0.95, 0.08, ["bq", "fp", "cs"], []),
    "yq": HerbParameter("yq", "薏苡仁", 6, 30, 1,
        {"利尿": 0.82, "免疫调节": 0.72, "消化系统": 0.70, "抗肿瘤": 0.65},
        0.95, 0.10, ["fp", "bq", "hq"], []),
    "cyh": HerbParameter("cyh", "金银花", 6, 15, 1,
        {"清热解毒": 0.92, "抗炎": 0.85, "抗氧化": 0.78, "免疫调节": 0.72},
        0.94, 0.15, ["jgh", "gq", "lk"], []),
    "dcx": HerbParameter("dcx", "大枣", 6, 30, 1,
        {"补气": 0.78, "养血": 0.75, "消化系统": 0.68, "免疫调节": 0.72},
        0.98, 0.05, ["hq", "ds", "gz"], []),
    "sj": HerbParameter("sj", "生姜", 3, 15, 1,
        {"消化系统": 0.85, "止呕": 0.82, "抗炎": 0.72, "抗氧化": 0.68},
        0.96, 0.06, ["dcx", "gq", "cx"], []),
    "gh": HerbParameter("gh", "葛根", 6, 20, 1,
        {"心血管保护": 0.85, "降血糖": 0.80, "降压": 0.75, "抗氧化": 0.70},
        0.95, 0.12, ["hq", "gz", "jgh"], []),
}

# 功效-药材索引 (预计算)
_EFFICACY_TO_HERBS: Dict[str, List[str]] = {}
for hid, herb in _BUILTIN_HERBS.items():
    for eff in herb.efficacy_scores:
        if eff not in _EFFICACY_TO_HERBS:
            _EFFICACY_TO_HERBS[eff] = []
        _EFFICACY_TO_HERBS[eff].append(hid)


# ════════════════════════════════════════════
# 贝叶斯优化核心引擎
# ════════════════════════════════════════════

class BayesianFormulaOptimizer:
    """
    贝叶斯配方优化引擎

    核心思想：
    将配方生成视为黑箱优化问题，使用高斯过程回归建模
    配方成分与综合评分之间的映射关系。

    算法流程：
    1. 初始采样: 拉丁超立方在搜索空间内均匀采样
    2. GP 建模: 用高斯过程拟合已评分配方
    3. 采集函数: Expected Improvement 选择下一候选
    4. 并行候选: 使用 batch EI 生成多个候选
    5. 先验注入: 通过 GP 均值函数注入配伍知识

    参考:
    - Mockus, J. (2012). Bayesian approach to global optimization.
    - Snoek, J., et al. (2012). Practical Bayesian Optimization of ML algorithms.
    """

    def __init__(self, config: Optional[BayesianConfig] = None):
        self.config = config or BayesianConfig()
        self._herbs = dict(_BUILTIN_HERBS)  # 可扩展的药材库
        self._history: List[FormulaCandidate] = []  # 优化历史

    # ── 公共接口 ──

    def generate(self, target_effects: List[str],
                 constraints: Optional[Dict[str, Any]] = None) -> List[FormulaCandidate]:
        """
        使用贝叶斯优化生成配方候选方案

        Args:
            target_effects: 目标功效列表, e.g., ["免疫调节", "抗氧化"]
            constraints: 约束条件, 如 { max_cost: 10.0, exclude_herbs: [...] }

        Returns:
            List[FormulaCandidate]: 按综合评分排序的候选方案列表
        """
        logger.info(f"[BayesianFormulaOptimizer] 开始优化, 目标功效: {target_effects}")

        # Step 1: 选择候选药材
        candidate_herbs = self._select_herbs(target_effects, constraints)
        if len(candidate_herbs) < self.config.min_ingredients:
            logger.warning(f"候选药材不足 ({len(candidate_herbs)} < {self.config.min_ingredients})")
            return []

        n_dims = len(candidate_herbs)
        logger.info(f"搜索空间: {n_dims} 维 ({len(candidate_herbs)} 种药材)")

        # Step 2: 初始随机采样
        X_init = self._latin_hypercube_sample(n_dims, self.config.n_initial_random)
        Y_init = []
        initial_candidates = []

        for i, x in enumerate(X_init):
            dosages = self._vector_to_dosages(x, candidate_herbs)
            scores = self._evaluate_formula(dosages, candidate_herbs, target_effects)
            candidate = FormulaCandidate(
                ingredients=dosages,
                efficacy_score=scores["efficacy"],
                safety_score=scores["safety"],
                taste_score=scores["taste"],
                cost_score=scores["cost"],
                overall_score=scores["overall"],
                confidence=0.5,
                generation_round=0,
            )
            Y_init.append(scores["overall"])
            initial_candidates.append(candidate)
            self._history.append(candidate)

        X = list(X_init)
        Y = list(Y_init)
        best_score = max(Y) if Y else 0.0

        # Step 3: 贝叶斯优化迭代
        for round_idx in range(1, self.config.n_optimization_rounds + 1):
            try:
                x_next = self._expected_improvement(X, Y, candidate_herbs, target_effects)
                dosages = self._vector_to_dosages(x_next, candidate_herbs)
                scores = self._evaluate_formula(dosages, candidate_herbs, target_effects)
                new_score = scores["overall"]

                candidate = FormulaCandidate(
                    ingredients=dosages,
                    efficacy_score=scores["efficacy"],
                    safety_score=scores["safety"],
                    taste_score=scores["taste"],
                    cost_score=scores["cost"],
                    overall_score=new_score,
                    confidence=self._estimate_confidence(len(X), new_score),
                    generation_round=round_idx,
                )
                X.append(x_next)
                Y.append(new_score)
                self._history.append(candidate)

                if new_score > best_score:
                    best_score = new_score

            except Exception as e:
                logger.warning(f"[BayesianFormulaOptimizer] 第 {round_idx} 轮优化失败: {e}")
                continue

        # Step 4: 选择 top-N 候选
        sorted_candidates = sorted(self._history, key=lambda c: c.overall_score, reverse=True)
        top_candidates = sorted_candidates[:self.config.n_candidates]

        # Step 5: 去重 (成分相似度过滤)
        unique_candidates = self._deduplicate_candidates(top_candidates)

        logger.info(f"[BayesianFormulaOptimizer] 优化完成, 生成 {len(unique_candidates)} 个候选方案")
        return unique_candidates[:self.config.n_candidates]

    def get_herb_knowledge(self) -> Dict[str, Any]:
        """获取药材知识库信息"""
        return {
            herb_id: {
                "name_cn": h.name_cn,
                "dosage_range": [h.dosage_min, h.dosage_max],
                "efficacy_scores": h.efficacy_scores,
                "safety_index": h.safety_index,
            }
            for herb_id, h in self._herbs.items()
        }

    # ── 核心算法 ──

    def _select_herbs(self, target_effects: List[str],
                      constraints: Optional[Dict[str, Any]] = None) -> List[str]:
        """根据目标功效选择候选药材"""
        exclude = set(constraints.get("exclude_herbs", []) if constraints else [])
        candidate_set: Dict[str, float] = {}

        for effect in target_effects:
            # 精确匹配
            if effect in _EFFICACY_TO_HERBS:
                for hid in _EFFICACY_TO_HERBS[effect]:
                    if hid not in exclude:
                        score = self._herbs[hid].efficacy_scores.get(effect, 0)
                        candidate_set[hid] = max(candidate_set.get(hid, 0), score)
            # 模糊匹配
            for known_eff, herb_ids in _EFFICACY_TO_HERBS.items():
                if self._fuzzy_match(effect, known_eff):
                    for hid in herb_ids:
                        if hid not in exclude:
                            score = self._herbs[hid].efficacy_scores.get(known_eff, 0) * 0.8
                            candidate_set[hid] = max(candidate_set.get(hid, 0), score)

        # 按功效评分降序排序
        sorted_herbs = sorted(candidate_set.items(), key=lambda x: x[1], reverse=True)

        # 君药选择 (top 30%)
        n_jun = max(1, len(sorted_herbs) // 3)
        jun_herbs = [h for h, _ in sorted_herbs[:n_jun]]

        # 臣药选择 (其余)
        chen_herbs = [h for h, _ in sorted_herbs[n_jun:]]

        # 添加配伍药材 (协同作用)
        synergy_herbs = set()
        for hid in jun_herbs + chen_herbs:
            for partner in self._herbs[hid].synergy_partners:
                if partner not in synergy_herbs and partner not in exclude:
                    synergy_herbs.add(partner)

        # 最终列表: 君药 + 臣药 + 协同药材
        final = jun_herbs + chen_herbs + list(synergy_herbs)
        return final[:self.config.max_ingredients]

    def _latin_hypercube_sample(self, n_dims: int, n_samples: int) -> List[List[float]]:
        """
        拉丁超立方采样 (Latin Hypercube Sampling)

        相比纯随机采样，LHS 能更均匀地覆盖搜索空间。
        """
        samples = []
        for _ in range(n_samples):
            point = []
            for dim in range(n_dims):
                # 将 [0,1] 分成 n_samples 个区间
                segment = 1.0 / n_samples
                # 随机选择一个区间内的点
                val = random.uniform(dim * segment, (dim + 1) * segment) if n_dims > 1 else random.random()
                point.append(val)
            random.shuffle(point)
            samples.append(point)
        return samples

    def _gaussian_kernel(self, x1: List[float], x2: List[float],
                         length_scale: float = 1.0, sigma_f: float = 1.0) -> float:
        """
        RBF 核函数 (Radial Basis Function)

        K(x1, x2) = σ_f² * exp(-||x1 - x2||² / (2 * l²))
        """
        squared_dist = sum((a - b) ** 2 for a, b in zip(x1, x2))
        return sigma_f ** 2 * math.exp(-squared_dist / (2 * length_scale ** 2))

    def _gp_predict(self, X: List[List[float]], Y: List[float],
                    x_star: List[float],
                    sigma_n: float = 0.1) -> Tuple[float, float]:
        """
        高斯过程预测

        计算 x_star 处的后验均值和方差。
        使用简化的低秩近似 (Cholesky-free 版本, O(n²) 复杂度).

        Args:
            X: 已采样点列表
            Y: 观测值列表
            x_star: 预测点
            sigma_n: 噪声方差

        Returns:
            (mean, variance): 预测均值和方差
        """
        n = len(X)
        if n == 0:
            return 0.5, 1.0

        # 构建核矩阵 K
        K = [[self._gaussian_kernel(X[i], X[j]) + (sigma_n ** 2 if i == j else 0)
              for j in range(n)] for i in range(n)]

        # k* 向量: 新点与所有采样点的核
        k_star = [self._gaussian_kernel(x_star, X[i]) for i in range(n)]

        # 简化求逆 (使用高斯消元)
        K_inv = self._matrix_inv(K)

        # 预测均值: μ = k*ᵀ K⁻¹ Y
        mean = sum(k_star[i] * sum(K_inv[i][j] * Y[j] for j in range(n)) for i in range(n))

        # 预测方差: σ² = K(x*,x*) - k*ᵀ K⁻¹ k*
        variance = self._gaussian_kernel(x_star, x_star) - \
                   sum(k_star[i] * sum(K_inv[i][j] * k_star[j] for j in range(n)) for i in range(n))

        return max(0, min(1, mean)), max(0.001, variance)

    def _expected_improvement(self, X: List[List[float]], Y: List[float],
                              candidate_herbs: List[str],
                              target_effects: List[str]) -> List[float]:
        """
        Expected Improvement (EI) 采集函数

        EI(x) = E[max(f(x) - f*, 0)]

        使用 EI 平衡探索 (exploration) 和利用 (exploitation):
        - 高方差 → 探索未知区域
        - 高均值 → 利用已知好区域
        """
        f_star = max(Y) if Y else 0.0
        epsilon = self.config.exploration_weight
        n_restarts = 10
        best_x = None
        best_ei = -float("inf")

        for _ in range(n_restarts):
            # 随机重启采候选点
            x_candidate = [random.random() for _ in range(len(candidate_herbs))]
            mean, variance = self._gp_predict(X, Y, x_candidate)
            sigma = math.sqrt(variance)

            # EI 计算
            improvement = mean - f_star - epsilon
            if sigma > 0:
                z = improvement / sigma
                ei = improvement * self._norm_cdf(z) + sigma * self._norm_pdf(z)
            else:
                ei = improvement if improvement > 0 else 0

            if ei > best_ei:
                best_ei = ei
                best_x = list(x_candidate)

            # 额外探索: 随机扰动
            if random.random() < 0.15:
                noisy_x = [min(1, max(0, v + random.gauss(0, 0.1))) for v in x_candidate]
                mean2, var2 = self._gp_predict(X, Y, noisy_x)
                sigma2 = math.sqrt(var2)
                imp2 = mean2 - f_star - epsilon
                ei2 = imp2 * self._norm_cdf(imp2 / sigma2) + sigma2 * self._norm_pdf(imp2 / sigma2) if sigma2 > 0 else 0
                if ei2 > best_ei:
                    best_ei = ei2
                    best_x = list(noisy_x)

            # 协同项注入: 偏好已知配伍对
            self._inject_synergy_bias(x_candidate, candidate_herbs)
            mean3, var3 = self._gp_predict(X, Y, x_candidate)
            sigma3 = math.sqrt(var3)
            imp3 = mean3 - f_star - epsilon
            ei3 = imp3 * self._norm_cdf(imp3 / sigma3) + sigma3 * self._norm_pdf(imp3 / sigma3) if sigma3 > 0 else 0
            if ei3 > best_ei:
                best_ei = ei3
                best_x = list(x_candidate)

        return best_x or [random.random() for _ in range(len(candidate_herbs))]

    def _inject_synergy_bias(self, x: List[float], candidate_herbs: List[str]):
        """注入协同配伍先验知识"""
        for i, hid_i in enumerate(candidate_herbs):
            if hid_i not in self._herbs:
                continue
            for partner in self._herbs[hid_i].synergy_partners:
                if partner in candidate_herbs:
                    j = candidate_herbs.index(partner)
                    # 提高协同药材的用量
                    if x[i] > 0.3 and x[j] < 0.5:
                        x[j] = min(1.0, x[j] + 0.1)
                    # 避免相反药材同时高用量
            for antagonist in self._herbs[hid_i].antagonistic_pairs:
                if antagonist in candidate_herbs:
                    j = candidate_herbs.index(antagonist)
                    if x[i] > 0.5 and x[j] > 0.5:
                        x[j] = max(0.0, x[j] - 0.3)

    # ── 评估函数 ──

    def _evaluate_formula(self, dosages: Dict[str, float],
                          candidate_herbs: List[str],
                          target_effects: List[str]) -> Dict[str, float]:
        """
        多维配方评估

        计算配方的功效、安全、口感、成本综合评分。
        使用加权 Pareto 方法进行多目标优化。
        """
        # 功效评分 (直接匹配目标功效)
        efficacy_scores = []
        for effect in target_effects:
            effect_score = 0.0
            weight_sum = 0.0
            for herb_id, dosage in dosages.items():
                if herb_id in self._herbs and dosage > 0:
                    herb = self._herbs[herb_id]
                    score = herb.efficacy_scores.get(effect, 0)
                    # 用量归一化权重
                    dosage_weight = (dosage - herb.dosage_min) / \
                                    max(1, herb.dosage_max - herb.dosage_min)
                    effect_score += score * (0.5 + 0.5 * dosage_weight)
                    weight_sum += 1
            avg = effect_score / max(1, weight_sum)
            efficacy_scores.append(avg)

        # 多功效综合 (加权几何平均, 强调全面性)
        efficacy_final = 0.0
        if efficacy_scores:
            product = 1.0
            for s in efficacy_scores:
                product *= max(0.01, s)
            efficacy_final = product ** (1.0 / len(efficacy_scores))

        # 安全评分 (基于各药材安全性 + 配伍禁忌检查)
        safety_score = 0.0
        for herb_id, dosage in dosages.items():
            if herb_id in self._herbs and dosage > 0:
                herb = self._herbs[herb_id]
                # 安全性随用量递减
                dosage_ratio = (dosage - herb.dosage_min) / \
                               max(1, herb.dosage_max - herb.dosage_min)
                herb_safety = herb.safety_index * (1 - 0.3 * dosage_ratio)
                safety_score += herb_safety
        safety_score /= max(1, len(dosages))

        # 禁忌检查惩罚
        antagonism_penalty = 0.0
        herb_ids = list(dosages.keys())
        for i in range(len(herb_ids)):
            for j in range(i + 1, len(herb_ids)):
                h1, h2 = herb_ids[i], herb_ids[j]
                if h1 in self._herbs and h2 in self._herbs:
                    if h2 in self._herbs[h1].antagonistic_pairs:
                        antagonism_penalty += 0.15
        safety_score *= max(0, 1 - antagonism_penalty)

        # 口感评分 (基于药材组合经验)
        taste_score = self._evaluate_taste(dosages, candidate_herbs)

        # 成本评分
        total_cost = sum(
            dosage * self._herbs[hid].cost_per_gram
            for hid, dosage in dosages.items()
            if hid in self._herbs
        )
        cost_score = max(0, 1 - total_cost / 10.0)  # 10元为成本上限

        # 综合评分 (加权和)
        overall = (efficacy_final * 0.40 +
                   safety_score * 0.25 +
                   taste_score * 0.15 +
                   cost_score * 0.20)

        return {
            "efficacy": round(efficacy_final, 4),
            "safety": round(safety_score, 4),
            "taste": round(taste_score, 4),
            "cost": round(cost_score, 4),
            "overall": round(overall, 4),
        }

    def _evaluate_taste(self, dosages: Dict[str, float],
                        candidate_herbs: List[str]) -> float:
        """口感评分 (基于药材组合经验规则)"""
        sweet_herbs = {"dcx", "gq", "gz", "hq"}
        bitter_herbs = {"lk", "cyh", "cs"}
        aromatic_herbs = {"cx", "sj", "bq"}

        sweet_ratio = sum(1 for h in dosages if h in sweet_herbs and dosages[h] > 0) / max(1, len(dosages))
        bitter_ratio = sum(1 for h in dosages if h in bitter_herbs and dosages[h] > 0) / max(1, len(dosages))

        score = 0.5 + 0.3 * min(1, sweet_ratio * 2) - 0.3 * min(1, bitter_ratio * 2)
        return max(0, min(1, score))

    def _estimate_confidence(self, n_samples: int, score: float) -> float:
        """估计生成方案的置信度"""
        # 样本量越大、评分越高 → 置信度越高
        sample_factor = min(1, n_samples / 50)
        score_factor = score
        return round(0.3 * sample_factor + 0.7 * score_factor, 4)

    # ── 工具方法 ──

    def _vector_to_dosages(self, x: List[float], candidate_herbs: List[str]) -> Dict[str, float]:
        """将优化向量 [0,1]^n 映射为实际用量 Dict[药材ID, 用量(g)]"""
        dosages = {}
        for i, herb_id in enumerate(candidate_herbs):
            if i < len(x) and herb_id in self._herbs:
                herb = self._herbs[herb_id]
                if x[i] > 0.15:  # 阈值: 低于此值视为不使用该药材
                    dosage = herb.dosage_min + x[i] * (herb.dosage_max - herb.dosage_min)
                    dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                    dosage = max(herb.dosage_min, min(herb.dosage_max, dosage))
                    dosages[herb_id] = dosage
        return dosages

    def _deduplicate_candidates(self, candidates: List[FormulaCandidate]) -> List[FormulaCandidate]:
        """基于 Jaccard 相似度去重"""
        unique = []
        for c in candidates:
            is_duplicate = False
            for existing in unique:
                # Jaccard 相似度: 成分重叠率
                c_set = set(c.ingredients.keys())
                e_set = set(existing.ingredients.keys())
                intersection = c_set & e_set
                union = c_set | e_set
                if union:
                    jaccard = len(intersection) / len(union)
                    if jaccard > 0.7:  # 相似度 > 70% 视为重复
                        if c.overall_score > existing.overall_score:
                            unique.remove(existing)
                        else:
                            is_duplicate = True
                        break
            if not is_duplicate:
                unique.append(c)
        return unique

    def _fuzzy_match(self, s1: str, s2: str) -> bool:
        """功效名称模糊匹配"""
        return s1 in s2 or s2 in s1 or \
               len(set(s1) & set(s2)) / max(len(set(s1)), len(set(s2)), 1) > 0.6

    @staticmethod
    def _matrix_inv(matrix: List[List[float]]) -> List[List[float]]:
        """高斯消元求逆矩阵 (用于小型矩阵)"""
        n = len(matrix)
        if n == 0:
            return []
        if n == 1:
            return [[1.0 / matrix[0][0]]] if matrix[0][0] != 0 else [[1.0]]

        # 增广矩阵 [A | I]
        aug = [row[:] + [1.0 if i == j else 0.0 for j in range(n)]
               for i, row in enumerate(matrix)]

        for col in range(n):
            # 选主元
            pivot = max(range(col, n), key=lambda r: abs(aug[r][col]))
            if abs(aug[pivot][col]) < 1e-10:
                continue
            aug[col], aug[pivot] = aug[pivot], aug[col]

            pivot_val = aug[col][col]
            for j in range(2 * n):
                aug[col][j] /= pivot_val

            for row in range(n):
                if row != col:
                    factor = aug[row][col]
                    for j in range(2 * n):
                        aug[row][j] -= factor * aug[col][j]

        return [row[n:] for row in aug]

    @staticmethod
    def _norm_cdf(x: float) -> float:
        """标准正态分布的 CDF"""
        return 0.5 * (1 + math.erf(x / math.sqrt(2)))

    @staticmethod
    def _norm_pdf(x: float) -> float:
        """标准正态分布的 PDF"""
        return math.exp(-x * x / 2) / math.sqrt(2 * math.pi)


# ════════════════════════════════════════════
# 全局单例
# ════════════════════════════════════════════

_optimizer_instance: Optional[BayesianFormulaOptimizer] = None


def get_bayesian_optimizer() -> BayesianFormulaOptimizer:
    """获取贝叶斯优化器单例"""
    global _optimizer_instance
    if _optimizer_instance is None:
        _optimizer_instance = BayesianFormulaOptimizer()
    return _optimizer_instance
