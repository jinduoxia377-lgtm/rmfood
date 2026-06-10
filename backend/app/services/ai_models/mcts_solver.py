"""
MCTS配方空间搜索算法
基于专利 US 11,742,060 B2 实现
权利要求4: 使用蒙特卡洛树搜索（MCTS）探索配方空间

MCTS是一种启发式搜索算法，通过模拟随机游戏来评估状态，
结合UCB1上界选择策略平衡探索与利用。
"""
import logging
import math
import random
from typing import Any, Optional

import numpy as np

from .scorer import MultiObjectiveScorer

logger = logging.getLogger(__name__)


class MCTSNode:
    """MCTS树节点"""

    def __init__(
        self,
        formula_state: dict[str, Any] | None = None,
        parent: Optional["MCTSNode"] = None,
        ingredients: list[str] | None = None,
        dosages: list[float] | None = None,
    ):
        self.parent = parent
        self.children: list["MCTSNode"] = []
        self.visits: int = 0
        self.q_value: float = 0.0
        self.formula_state: dict[str, Any] = formula_state or {}
        self.ingredients: list[str] = ingredients or []
        self.dosages: list[float] = dosages or []
        self.depth: int = 0
        if parent is not None:
            self.depth = parent.depth + 1

    def is_fully_expanded(self, max_children: int = 20) -> bool:
        """检查是否完全展开"""
        return len(self.children) >= max_children

    def is_terminal(self, max_ingredients: int = 8, max_depth: int = 10) -> bool:
        """检查是否为终止节点"""
        if self.depth >= max_depth:
            return True
        if len(self.ingredients) >= max_ingredients:
            return True
        return False

    def ucb1(self, exploration_constant: float = 1.414) -> float:
        """
        计算UCB1值

        UCB1 = Q(s) / N(s) + c * sqrt(ln(N(parent)) / N(s))
        c = sqrt(2) ≈ 1.414
        """
        if self.visits == 0:
            return float("inf")

        exploitation = self.q_value / self.visits
        exploration = exploration_constant * math.sqrt(
            math.log(self.parent.visits) / self.visits
        )
        return exploitation + exploration

    def get_state_key(self) -> str:
        """获取状态唯一键"""
        ingredient_str = ",".join(sorted(self.ingredients))
        dosage_str = ",".join(f"{d:.2f}" for d in self.dosages)
        return f"{ingredient_str}|{dosage_str}"


class MCTSTree:
    """MCTS树结构"""

    def __init__(
        self,
        exploration_constant: float = 1.414,
        max_depth: int = 10,
    ):
        self.root = MCTSNode(formula_state={"type": "root"})
        self.exploration_constant = exploration_constant
        self.max_depth = max_depth
        self.total_nodes: int = 1
        self.state_cache: dict[str, MCTSNode] = {}

    def add_node(self, node: MCTSNode) -> None:
        """添加节点到树"""
        self.total_nodes += 1
        state_key = node.get_state_key()
        if state_key:
            self.state_cache[state_key] = node

    def find_state(self, state_key: str) -> MCTSNode | None:
        """查找状态"""
        return self.state_cache.get(state_key)

    def get_tree_stats(self) -> dict[str, Any]:
        """获取树统计信息"""
        return {
            "total_nodes": self.total_nodes,
            "max_depth_reached": self._get_max_depth(self.root),
            "unique_states": len(self.state_cache),
        }

    def _get_max_depth(self, node: MCTSNode) -> int:
        """获取最大深度"""
        if not node.children:
            return node.depth
        return max(self._get_max_depth(child) for child in node.children)


class MCTSOptimizer:
    """
    MCTS配方优化器

    使用蒙特卡洛树搜索算法探索配方空间，找到最优成分组合。
    集成NeuralFormulaEngine的评分功能进行奖励计算。
    """

    DEFAULT_INGREDIENT_POOL = {
        "补气": ["人参", "黄芪", "党参", "西洋参", "太子参", "红景天"],
        "养血": ["红枣", "枸杞子", "龙眼肉", "当归", "熟地黄", "阿胶"],
        "清热": ["菊花", "金银花", "夏枯草", "鱼腥草", "蒲公英", "决明子"],
        "利湿": ["茯苓", "薏苡仁", "泽泻", "车前草", "玉米须"],
        "安神": ["酸枣仁", "远志", "合欢花", "夜交藤", "茯神"],
        "润肺": ["百合", "沙参", "麦冬", "玉竹", "川贝母"],
        "健脾": ["山药", "白术", "陈皮", "佛手", "砂仁"],
        "抗氧化": ["葡萄籽", "绿茶提取物", "枸杞子", "蓝莓提取物"],
    }

    DOSAGE_RANGES = {
        "君药": (15.0, 30.0),
        "臣药": (10.0, 20.0),
        "佐药": (5.0, 15.0),
        "使药": (3.0, 10.0),
    }

    def __init__(
        self,
        target_effects: list[str],
        constraints: dict[str, Any] | None = None,
        n_simulations: int = 1000,
        max_depth: int = 10,
        exploration_constant: float = 1.414,
    ):
        self.target_effects = target_effects
        self.constraints = constraints or {}
        self.n_simulations = n_simulations
        self.max_depth = max_depth
        self.exploration_constant = exploration_constant
        self.tree = MCTSTree(
            exploration_constant=exploration_constant,
            max_depth=max_depth,
        )
        self.scorer = MultiObjectiveScorer()
        self.ingredient_pool = self._build_ingredient_pool()
        self.best_solution: MCTSNode | None = None
        self.best_reward: float = float("-inf")

    def _build_ingredient_pool(self) -> dict[str, list[str]]:
        """构建成分池"""
        pool = {}
        for effect in self.target_effects:
            if effect in self.DEFAULT_INGREDIENT_POOL:
                pool[effect] = self.DEFAULT_INGREDIENT_POOL[effect]
            else:
                for cat, ingredients in self.DEFAULT_INGREDIENT_POOL.items():
                    if effect in cat or cat in effect:
                        pool[effect] = ingredients
                        break

        if not pool:
            for effect in ["补气", "养血", "清热"]:
                if effect in self.DEFAULT_INGREDIENT_POOL:
                    pool[effect] = self.DEFAULT_INGREDIENT_POOL[effect]

        return pool

    def search(self) -> list[dict[str, Any]]:
        """
        执行MCTS搜索，返回最优配方列表

        Returns:
            最优配方列表
        """
        logger.info(
            f"MCTS搜索开始: 目标功效={self.target_effects}, "
            f"模拟次数={self.n_simulations}, 最大深度={self.max_depth}"
        )

        for simulation in range(self.n_simulations):
            node = self._select(self.tree.root)
            reward = self._simulate(node)

            if reward > self.best_reward:
                self.best_reward = reward
                self.best_solution = node

            self._backpropagate(node, reward)

            if simulation % 100 == 0:
                stats = self.tree.get_tree_stats()
                logger.info(
                    f"模拟进度: {simulation}/{self.n_simulations}, "
                    f"最优奖励: {self.best_reward:.4f}, "
                    f"树节点数: {stats['total_nodes']}"
                )

        results = self._extract_results()
        logger.info(f"MCTS搜索完成: 找到 {len(results)} 个候选配方")
        return results

    def _select(self, node: MCTSNode) -> MCTSNode:
        """
        UCB1选择策略

        从根节点开始，选择UCB1值最大的子节点，直到找到未完全展开的节点
        """
        while not node.is_terminal(max_ingredients=8, max_depth=self.max_depth):
            if not node.is_fully_expanded(max_children=15):
                return self._expand(node)
            best_child = self._best_child(node)
            if best_child is None:
                return node
            node = best_child
        return node

    def _expand(self, node: MCTSNode) -> MCTSNode:
        """
        展开节点，添加子节点

        基于目标功效和当前配方状态生成候选成分
        """
        candidates = self._generate_candidate_children(node)

        if not candidates:
            return node

        selected = random.choice(candidates)
        child = MCTSNode(
            formula_state=selected["state"],
            parent=node,
            ingredients=selected["ingredients"],
            dosages=selected["dosages"],
        )

        node.children.append(child)
        self.tree.add_node(child)

        return child

    def _generate_candidate_children(
        self, node: MCTSNode
    ) -> list[dict[str, Any]]:
        """生成候选子节点"""
        candidates = []
        current_ingredients = set(node.ingredients)
        max_ingredients = min(8, 3 + node.depth)

        if len(node.ingredients) >= max_ingredients:
            return []

        for effect, ingredients in self.ingredient_pool.items():
            for ing in ingredients:
                if ing in current_ingredients:
                    continue

                if self._check_constraint(ing):
                    continue

                new_ingredients = node.ingredients + [ing]
                role = self._assign_role(len(new_ingredients))
                dosage_range = self.DOSAGE_RANGES.get(role, (5.0, 15.0))
                dosage = random.uniform(*dosage_range)
                new_dosages = node.dosages + [dosage]

                state = {
                    "type": "formula",
                    "ingredients": new_ingredients,
                    "dosages": new_dosages,
                    "depth": node.depth + 1,
                }

                candidates.append({
                    "state": state,
                    "ingredients": new_ingredients,
                    "dosages": new_dosages,
                })

        if not candidates:
            for _ in range(3):
                new_ingredients = node.ingredients + ["辅助成分"]
                new_dosages = node.dosages + [5.0]
                state = {
                    "type": "formula",
                    "ingredients": new_ingredients,
                    "dosages": new_dosages,
                    "depth": node.depth + 1,
                }
                candidates.append({
                    "state": state,
                    "ingredients": new_ingredients,
                    "dosages": new_dosages,
                })

        return candidates

    def _best_child(self, node: MCTSNode) -> MCTSNode | None:
        """选择UCB1值最大的子节点"""
        if not node.children:
            return None

        best = None
        best_ucb = float("-inf")

        for child in node.children:
            ucb = child.ucb1(self.exploration_constant)
            if ucb > best_ucb:
                best_ucb = ucb
                best = child

        return best

    def _simulate(self, node: MCTSNode) -> float:
        """
        模拟评估

        将配方节点转换为评分器可用的格式，计算奖励值
        """
        if not node.ingredients:
            return 0.0

        ingredients_formatted = []
        for i, name in enumerate(node.ingredients):
            dosage = node.dosages[i] if i < len(node.dosages) else 10.0
            ingredients_formatted.append({
                "name": name,
                "dosage": dosage,
                "efficacy": self._infer_efficacy(name),
                "taste": self._infer_taste(name),
                "category": self._infer_category(name),
            })

        score_result = self.scorer.score_formula(
            ingredients_formatted,
            self.target_effects,
            self.constraints,
        )

        reward = score_result.get("calibrated_score", score_result.get("final_score", 0.0))

        if len(node.ingredients) < 3:
            reward *= 0.8
        elif len(node.ingredients) > 6:
            reward *= 0.9

        return reward

    def _infer_efficacy(self, ingredient_name: str) -> list[str]:
        """推断成分功效"""
        efficacy_map = {
            "人参": ["补气", "提高免疫"],
            "黄芪": ["补气", "利湿"],
            "党参": ["补气", "养血"],
            "西洋参": ["补气", "清热"],
            "红枣": ["养血", "安神"],
            "枸杞子": ["养血", "抗氧化"],
            "当归": ["养血", "活血"],
            "菊花": ["清热", "明目"],
            "金银花": ["清热", "解毒"],
            "茯苓": ["利湿", "健脾"],
            "薏苡仁": ["利湿", "清热"],
            "酸枣仁": ["安神", "敛汗"],
            "远志": ["安神", "祛痰"],
            "百合": ["润肺", "清热"],
            "沙参": ["润肺", "清热"],
            "山药": ["健脾", "补气"],
            "白术": ["健脾", "利湿"],
        }
        return efficacy_map.get(ingredient_name, ["清热"])

    def _infer_taste(self, ingredient_name: str) -> str:
        """推断成分味道"""
        taste_map = {
            "人参": "甘",
            "黄芪": "甘",
            "党参": "甘",
            "西洋参": "甘",
            "红枣": "甘",
            "枸杞子": "甘",
            "当归": "甘",
            "菊花": "甘",
            "金银花": "甘",
            "茯苓": "甘",
            "薏苡仁": "甘",
            "酸枣仁": "酸",
            "远志": "苦",
            "百合": "甘",
            "沙参": "甘",
            "山药": "甘",
            "白术": "甘",
        }
        return taste_map.get(ingredient_name, "甘")

    def _infer_category(self, ingredient_name: str) -> str:
        """推断成分类别"""
        return "中药材"

    def _assign_role(self, ingredient_count: int) -> str:
        """分配君臣佐使角色"""
        if ingredient_count == 1:
            return "君药"
        elif ingredient_count <= 3:
            return "臣药"
        elif ingredient_count <= 5:
            return "佐药"
        return "使药"

    def _check_constraint(self, ingredient_name: str) -> bool:
        """检查成分约束"""
        exclude_set = set(self.constraints.get("exclude_ingredients", []))
        if ingredient_name in exclude_set:
            return True

        return False

    def _backpropagate(self, node: MCTSNode, reward: float) -> None:
        """
        回溯更新

        从叶子节点回溯到根节点，更新访问次数和Q值
        """
        while node is not None:
            node.visits += 1
            node.q_value += reward
            node = node.parent

    def _extract_results(self) -> list[dict[str, Any]]:
        """提取最优配方结果"""
        if self.best_solution is None:
            return []

        results = []
        top_nodes = self._get_top_nodes(5)

        for rank, node in enumerate(top_nodes, 1):
            ingredients_formatted = []
            for i, name in enumerate(node.ingredients):
                dosage = node.dosages[i] if i < len(node.dosages) else 10.0
                role = self._assign_role(i + 1)
                ingredients_formatted.append({
                    "name": name,
                    "role": role,
                    "dosage": dosage,
                    "efficacy": self._infer_efficacy(name),
                    "taste": self._infer_taste(name),
                    "category": self._infer_category(name),
                })

            score_result = self.scorer.score_formula(
                ingredients_formatted,
                self.target_effects,
                self.constraints,
            )

            results.append({
                "id": f"mcts_candidate_{rank}",
                "name": f"MCTS方案-{rank}（{'+'.join(self.target_effects[:2])}）",
                "ingredients": ingredients_formatted,
                "target_effects": self.target_effects,
                "confidence": round(min(0.95, score_result.get("calibrated_score", 0.0) + 0.1), 2),
                "score_result": score_result,
                "final_score": score_result.get("calibrated_score", score_result.get("final_score", 0.0)),
                "mcts_visits": node.visits,
                "mcts_q_value": node.q_value,
                "rank": rank,
            })

        results.sort(key=lambda x: x["final_score"], reverse=True)

        for rank, result in enumerate(results, 1):
            result["rank"] = rank

        return results

    def _get_top_nodes(self, n: int) -> list[MCTSNode]:
        """获取Q值最高的N个叶子节点"""
        all_nodes = self._collect_all_nodes(self.tree.root)
        leaf_nodes = [node for node in all_nodes if len(node.children) == 0]

        if not leaf_nodes:
            return [self.best_solution] if self.best_solution else []

        scored_nodes = [(node, node.q_value / node.visits if node.visits > 0 else 0) for node in leaf_nodes]
        scored_nodes.sort(key=lambda x: x[1], reverse=True)

        return [node for node, _ in scored_nodes[:n]]

    def _collect_all_nodes(self, node: MCTSNode) -> list[MCTSNode]:
        """收集所有节点"""
        nodes = [node]
        for child in node.children:
            nodes.extend(self._collect_all_nodes(child))
        return nodes

    def select(self, node: MCTSNode) -> MCTSNode:
        """
        UCB1选择子节点（公开接口）

        Args:
            node: 当前节点

        Returns:
            选中的子节点
        """
        return self._select(node)

    def expand(self, node: MCTSNode) -> MCTSNode:
        """
        展开节点（公开接口）

        Args:
            node: 当前节点

        Returns:
            展开后的节点
        """
        return self._expand(node)

    def simulate(self, node: MCTSNode) -> float:
        """
        模拟评估（公开接口）

        Args:
            node: 当前节点

        Returns:
            模拟奖励值
        """
        return self._simulate(node)

    def backpropagate(self, node: MCTSNode, reward: float) -> None:
        """
        回溯更新（公开接口）

        Args:
            node: 当前节点
            reward: 奖励值
        """
        self._backpropagate(node, reward)

    def get_tree_stats(self) -> dict[str, Any]:
        """获取MCTS树统计信息"""
        return self.tree.get_tree_stats()
