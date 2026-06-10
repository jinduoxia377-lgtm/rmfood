"""
梯度下降优化模块
基于专利权利要求 D1 和 D4 实现梯度下降优化功能
用于提升配方配比精度
"""
import logging
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


class AdaptiveLearningRate:
    """
    自适应学习率调度器
    支持指数衰减、余弦退火和阶梯衰减策略
    """

    def __init__(
        self,
        initial_lr: float = 0.1,
        decay_type: str = "exponential",
        decay_rate: float = 0.95,
        min_lr: float = 1e-6,
        step_size: int = 10
    ):
        """
        初始化自适应学习率调度器

        Args:
            initial_lr: 初始学习率
            decay_type: 衰减类型 ("exponential", "cosine", "step")
            decay_rate: 衰减率
            min_lr: 最小学习率下限
            step_size: 阶梯衰减的步长
        """
        self.initial_lr = initial_lr
        self.current_lr = initial_lr
        self.decay_type = decay_type
        self.decay_rate = decay_rate
        self.min_lr = min_lr
        self.step_size = step_size
        self._scale_factor = 1.0

    def get_lr(self, iteration: int) -> float:
        """
        根据迭代次数获取当前学习率

        Args:
            iteration: 当前迭代次数

        Returns:
            当前学习率
        """
        if self.decay_type == "exponential":
            lr = self.initial_lr * (self.decay_rate ** iteration)
        elif self.decay_type == "cosine":
            lr = self.min_lr + (self.initial_lr - self.min_lr) * (
                1 + np.cos(np.pi * iteration / (iteration + 1))
            ) / 2
        elif self.decay_type == "step":
            lr = self.initial_lr * (self.decay_rate ** (iteration // self.step_size))
        else:
            lr = self.initial_lr

        self.current_lr = max(lr * self._scale_factor, self.min_lr)
        return self.current_lr

    def scale_lr(self, scale_factor: float):
        """
        手动缩放学习率

        Args:
            scale_factor: 缩放因子
        """
        self._scale_factor *= scale_factor
        self.current_lr = max(self.current_lr * scale_factor, self.min_lr)


class OptimizationMonitor:
    """
    优化过程监控器
    记录并分析优化过程中的各项指标
    """

    def __init__(self):
        """初始化监控器"""
        self.loss_history: List[float] = []
        self.lr_history: List[float] = []
        self.iteration_times: List[float] = []
        self.gradient_norms: List[float] = []
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None

    def record(
        self,
        iteration: int,
        loss: float,
        lr: float,
        elapsed_time: float,
        gradient_norm: Optional[float] = None
    ):
        """
        记录优化过程指标

        Args:
            iteration: 当前迭代次数
            loss: 当前损失值
            lr: 当前学习率
            elapsed_time: 迭代耗时（秒）
            gradient_norm: 梯度范数
        """
        self.loss_history.append(loss)
        self.lr_history.append(lr)
        self.iteration_times.append(elapsed_time)
        if gradient_norm is not None:
            self.gradient_norms.append(gradient_norm)

    def start(self):
        """开始计时"""
        self.start_time = time.time()

    def stop(self):
        """结束计时"""
        self.end_time = time.time()

    def get_summary(self) -> dict:
        """
        获取优化摘要统计

        Returns:
            包含各项统计指标的字典
        """
        if not self.loss_history:
            return {}

        total_time = 0.0
        if self.start_time and self.end_time:
            total_time = self.end_time - self.start_time
        elif self.iteration_times:
            total_time = sum(self.iteration_times)

        return {
            "total_iterations": len(self.loss_history),
            "initial_loss": self.loss_history[0] if self.loss_history else None,
            "final_loss": self.loss_history[-1] if self.loss_history else None,
            "best_loss": min(self.loss_history) if self.loss_history else None,
            "total_time": total_time,
            "avg_iteration_time": np.mean(self.iteration_times) if self.iteration_times else 0.0,
            "final_lr": self.lr_history[-1] if self.lr_history else None,
            "loss_reduction": (
                self.loss_history[0] - self.loss_history[-1]
                if len(self.loss_history) > 1 else 0.0
            ),
            "loss_reduction_ratio": (
                (self.loss_history[0] - self.loss_history[-1]) / self.loss_history[0]
                if len(self.loss_history) > 1 and self.loss_history[0] != 0 else 0.0
            )
        }

    def plot_convergence(self, save_path: Optional[str] = None):
        """
        绘制收敛曲线图

        Args:
            save_path: 保存路径，如果为None则显示图像
        """
        try:
            import matplotlib.pyplot as plt

            fig, axes = plt.subplots(2, 2, figsize=(12, 10))

            iterations = range(len(self.loss_history))

            axes[0, 0].plot(iterations, self.loss_history, 'b-', linewidth=2)
            axes[0, 0].set_xlabel('迭代次数')
            axes[0, 0].set_ylabel('损失值')
            axes[0, 0].set_title('损失曲线')
            axes[0, 0].grid(True, alpha=0.3)

            axes[0, 1].plot(iterations, self.lr_history, 'r-', linewidth=2)
            axes[0, 1].set_xlabel('迭代次数')
            axes[0, 1].set_ylabel('学习率')
            axes[0, 1].set_title('学习率曲线')
            axes[0, 1].grid(True, alpha=0.3)
            axes[0, 1].set_yscale('log')

            axes[1, 0].plot(iterations, self.iteration_times, 'g-', linewidth=2)
            axes[1, 0].set_xlabel('迭代次数')
            axes[1, 0].set_ylabel('迭代耗时 (秒)')
            axes[1, 0].set_title('迭代耗时曲线')
            axes[1, 0].grid(True, alpha=0.3)

            if self.gradient_norms:
                axes[1, 1].plot(iterations, self.gradient_norms, 'm-', linewidth=2)
                axes[1, 1].set_xlabel('迭代次数')
                axes[1, 1].set_ylabel('梯度范数')
                axes[1, 1].set_title('梯度范数曲线')
                axes[1, 1].grid(True, alpha=0.3)
                axes[1, 1].set_yscale('log')
            else:
                axes[1, 1].text(0.5, 0.5, '无梯度数据', ha='center', va='center')
                axes[1, 1].set_title('梯度范数曲线')

            plt.tight_layout()

            if save_path:
                plt.savefig(save_path, dpi=150, bbox_inches='tight')
                logger.info(f"收敛曲线已保存至: {save_path}")
            else:
                plt.show()

            plt.close()

        except ImportError:
            logger.warning("matplotlib 未安装，无法绘制收敛曲线")


class GradientDescentOptimizer:
    """
    梯度下降优化器
    实现带动量、Nesterov加速和自适应学习率的梯度下降优化
    适用于配方配比优化任务
    """

    def __init__(
        self,
        learning_rate: float = 0.01,
        max_iterations: int = 1000,
        tolerance: float = 1e-6,
        momentum: float = 0.9,
        nesterov: bool = True,
        adaptive_lr: bool = True,
        decay_type: str = "exponential",
        decay_rate: float = 0.95,
        min_lr: float = 1e-6,
        early_stopping_patience: int = 10
    ):
        """
        梯度下降优化器初始化

        Args:
            learning_rate: 初始学习率
            max_iterations: 最大迭代次数
            tolerance: 收敛判定容忍度（损失相对变化阈值）
            momentum: 动量因子
            nesterov: 是否使用Nesterov加速梯度
            adaptive_lr: 是否启用自适应学习率
            decay_type: 学习率衰减类型
            decay_rate: 学习率衰减率
            min_lr: 最小学习率
            early_stopping_patience: 早停耐心值
        """
        self.learning_rate = learning_rate
        self.max_iterations = max_iterations
        self.tolerance = tolerance
        self.momentum = momentum
        self.nesterov = nesterov
        self.adaptive_lr = adaptive_lr
        self.early_stopping_patience = early_stopping_patience

        self.lr_scheduler = AdaptiveLearningRate(
            initial_lr=learning_rate,
            decay_type=decay_type,
            decay_rate=decay_rate,
            min_lr=min_lr
        ) if adaptive_lr else None

        self.monitor = OptimizationMonitor()
        self.velocity: Optional[dict] = None
        self._iteration = 0

    def optimize(
        self,
        initial_formula: dict,
        objective_function: Callable[[dict], float],
        gradient_function: Optional[Callable[[dict], dict]] = None,
        constraints: Optional[dict] = None,
        callback: Optional[Callable[[int, dict, float], None]] = None
    ) -> dict:
        """
        执行梯度下降优化

        Args:
            initial_formula: 初始配方 {ingredient: dosage}
            objective_function: 目标函数 (formula) -> score
            gradient_function: 梯度函数 (formula) -> {ingredient: gradient}，如果为None则使用数值梯度
            constraints: 约束条件
            callback: 迭代回调函数 (iteration, formula, loss) -> None

        Returns:
            优化后的配方及相关信息
        """
        constraints = constraints or {}
        current_formula = initial_formula.copy()
        self.velocity = {k: 0.0 for k in current_formula.keys()}
        self._iteration = 0
        self.monitor = OptimizationMonitor()
        self.monitor.start()

        previous_loss = objective_function(current_formula)
        loss_history = [previous_loss]

        logger.info(f"开始梯度下降优化: 初始损失={previous_loss:.6f}")

        for iteration in range(self.max_iterations):
            self._iteration = iteration
            iter_start_time = time.time()

            current_lr = (
                self.lr_scheduler.get_lr(iteration)
                if self.lr_scheduler else self.learning_rate
            )

            if gradient_function:
                gradients = gradient_function(current_formula)
            else:
                gradients = self.compute_gradient(
                    current_formula, objective_function
                )

            gradient_norm = np.sqrt(sum(g ** 2 for g in gradients.values()))
            gradients_normalized = {
                k: g / gradient_norm if gradient_norm > 0 else 0.0
                for k, g in gradients.items()
            }

            if self.nesterov and self.momentum > 0:
                nesterov_gradients = {}
                for k, v in self.velocity.items():
                    if k in gradients_normalized:
                        nesterov_gradients[k] = gradients_normalized[k] + self.momentum * v
                gradients_to_use = nesterov_gradients
            else:
                gradients_to_use = gradients_normalized

            for k in current_formula.keys():
                if k in gradients_to_use:
                    self.velocity[k] = (
                        self.momentum * self.velocity.get(k, 0.0)
                        + current_lr * gradients_to_use[k]
                    )
                    current_formula[k] = current_formula[k] - self.velocity[k]

            current_formula = self._apply_constraints(current_formula, constraints)

            current_loss = objective_function(current_formula)

            elapsed_time = time.time() - iter_start_time
            self.monitor.record(
                iteration, current_loss, current_lr, elapsed_time, gradient_norm
            )

            if callback:
                callback(iteration, current_formula, current_loss)

            if self.check_convergence(current_loss, previous_loss):
                logger.info(f"迭代 {iteration + 1}: 收敛条件满足，停止优化")
                break

            if self.should_early_stop(loss_history):
                logger.info(f"迭代 {iteration + 1}: 早停触发，停止优化")
                break

            if self.adaptive_lr and self.lr_scheduler:
                if len(loss_history) >= 5:
                    recent_variance = np.var(loss_history[-5:])
                    if recent_variance < self.tolerance:
                        self.lr_scheduler.scale_lr(0.5)
                        logger.debug(f"迭代 {iteration + 1}: 检测到损失停滞，降低学习率")

            previous_loss = current_loss
            loss_history.append(current_loss)

        self.monitor.stop()

        logger.info(
            f"优化完成: 最终损失={current_loss:.6f}, "
            f"迭代次数={iteration + 1}, "
            f"损失改善={loss_history[0] - current_loss:.6f}"
        )

        return {
            "optimized_formula": current_formula,
            "final_loss": current_loss,
            "initial_loss": loss_history[0],
            "iterations": iteration + 1,
            "converged": self.check_convergence(current_loss, loss_history[0]),
            "monitor": self.monitor
        }

    def compute_gradient(
        self,
        formula: dict,
        objective_function: Callable[[dict], float],
        epsilon: float = 1e-5
    ) -> dict:
        """
        数值梯度计算（有限差分法）

        Args:
            formula: 当前配方
            objective_function: 目标函数
            epsilon: 扰动幅度

        Returns:
            各成分的梯度值字典
        """
        base_loss = objective_function(formula)
        gradients = {}

        for ingredient, dosage in formula.items():
            perturbed_formula = formula.copy()
            if abs(dosage) > epsilon:
                perturbed_formula[ingredient] = dosage + epsilon
            else:
                perturbed_formula[ingredient] = epsilon

            perturbed_loss = objective_function(perturbed_formula)
            gradients[ingredient] = (perturbed_loss - base_loss) / epsilon

        return gradients

    def check_convergence(
        self,
        current_loss: float,
        previous_loss: float
    ) -> bool:
        """
        收敛判定：基于损失变化率的动态判定

        当 |loss变化| < tolerance * |previous_loss| 时认为收敛

        Args:
            current_loss: 当前损失值
            previous_loss: 上一次损失值

        Returns:
            是否收敛
        """
        if previous_loss == 0:
            return abs(current_loss) < self.tolerance

        relative_change = abs(current_loss - previous_loss) / abs(previous_loss)
        return relative_change < self.tolerance

    def should_early_stop(
        self,
        loss_history: List[float],
        patience: Optional[int] = None
    ) -> bool:
        """
        早停机制：监控损失变化，如果在patience次迭代内没有改善则停止

        Args:
            loss_history: 损失历史记录
            patience: 耐心值，覆盖初始化时的设置

        Returns:
            是否应该早停
        """
        if patience is None:
            patience = self.early_stopping_patience

        if len(loss_history) < patience + 1:
            return False

        recent_losses = loss_history[-(patience + 1):]
        best_loss = min(recent_losses[:-1])
        current_loss = recent_losses[-1]

        return current_loss >= best_loss

    def _apply_constraints(
        self,
        formula: dict,
        constraints: dict
    ) -> dict:
        """
        应用约束条件到配方

        Args:
            formula: 当前配方
            constraints: 约束条件

        Returns:
            应用约束后的配方
        """
        constrained_formula = formula.copy()

        min_dosage = constraints.get("min_dosage", 0.0)
        max_dosage = constraints.get("max_dosage", float('inf'))
        min_total = constraints.get("min_total", None)
        max_total = constraints.get("max_total", None)

        for ingredient in constrained_formula:
            constrained_formula[ingredient] = max(
                min_dosage,
                min(max_dosage, constrained_formula[ingredient])
            )

        if min_total is not None or max_total is not None:
            current_total = sum(constrained_formula.values())
            if min_total is not None and current_total < min_total:
                scale_factor = min_total / current_total if current_total > 0 else 1.0
                constrained_formula = {
                    k: v * scale_factor for k, v in constrained_formula.items()
                }
            elif max_total is not None and current_total > max_total:
                scale_factor = max_total / current_total if current_total > 0 else 1.0
                constrained_formula = {
                    k: v * scale_factor for k, v in constrained_formula.items()
                }

        return constrained_formula


class FormulaGradientCalculator:
    """
    配方梯度计算工具类
    提供配方相关的梯度计算辅助功能
    """

    @staticmethod
    def compute_safety_gradient(
        formula: dict,
        safety_function: Callable[[dict], float],
        epsilon: float = 1e-5
    ) -> dict:
        """
        计算安全性相关的梯度

        Args:
            formula: 配方
            safety_function: 安全性评估函数
            epsilon: 扰动幅度

        Returns:
            安全性梯度
        """
        base_safety = safety_function(formula)
        gradients = {}

        for ingredient, dosage in formula.items():
            perturbed = formula.copy()
            if abs(dosage) > epsilon:
                perturbed[ingredient] = dosage + epsilon
            else:
                perturbed[ingredient] = epsilon

            perturbed_safety = safety_function(perturbed)
            gradients[ingredient] = (perturbed_safety - base_safety) / epsilon

        return gradients

    @staticmethod
    def compute_synergy_gradient(
        formula: dict,
        synergy_function: Callable[[dict], float],
        ingredient_pairs: List[Tuple[str, str]],
        epsilon: float = 1e-5
    ) -> dict:
        """
        计算协同效应相关的梯度

        Args:
            formula: 配方
            synergy_function: 协同效应评估函数
            ingredient_pairs: 成分对列表
            epsilon: 扰动幅度

        Returns:
            协同效应梯度
        """
        base_synergy = synergy_function(formula)
        gradients = {k: 0.0 for k in formula.keys()}

        for ing1, ing2 in ingredient_pairs:
            if ing1 not in formula or ing2 not in formula:
                continue

            perturbed1 = formula.copy()
            if abs(formula[ing1]) > epsilon:
                perturbed1[ing1] = formula[ing1] + epsilon
            else:
                perturbed1[ing1] = epsilon
            synergy1 = synergy_function(perturbed1)

            perturbed2 = formula.copy()
            if abs(formula[ing2]) > epsilon:
                perturbed2[ing2] = formula[ing2] + epsilon
            else:
                perturbed2[ing2] = epsilon
            synergy2 = synergy_function(perturbed2)

            gradients[ing1] += (synergy1 - base_synergy) / epsilon
            gradients[ing2] += (synergy2 - base_synergy) / epsilon

        return gradients

    @staticmethod
    def compute_multi_objective_gradient(
        formula: dict,
        objective_functions: Dict[str, Callable[[dict], float]],
        weights: Optional[Dict[str, float]] = None,
        epsilon: float = 1e-5
    ) -> dict:
        """
        计算多目标优化的梯度

        Args:
            formula: 配方
            objective_functions: 各目标函数字典
            weights: 各目标权重
            epsilon: 扰动幅度

        Returns:
            综合梯度
        """
        weights = weights or {k: 1.0 for k in objective_functions.keys()}
        total_weight = sum(weights.values())
        normalized_weights = {k: v / total_weight for k, v in weights.items()}

        combined_gradient = {k: 0.0 for k in formula.keys()}

        for obj_name, obj_func in objective_functions.items():
            obj_gradient = {}
            base_value = obj_func(formula)

            for ingredient, dosage in formula.items():
                perturbed = formula.copy()
                if abs(dosage) > epsilon:
                    perturbed[ingredient] = dosage + epsilon
                else:
                    perturbed[ingredient] = epsilon

                perturbed_value = obj_func(perturbed)
                obj_gradient[ingredient] = (
                    (perturbed_value - base_value) / epsilon
                )

            weight = normalized_weights.get(obj_name, 1.0)
            for ingredient in combined_gradient:
                combined_gradient[ingredient] += (
                    obj_gradient.get(ingredient, 0.0) * weight
                )

        return combined_gradient


def create_formula_objective_function(
    target_scores: dict,
    scorer: Any
) -> Callable[[dict], float]:
    """
    创建配方目标函数

    Args:
        target_scores: 目标分数
        scorer: 评分器实例

    Returns:
        目标函数
    """
    def objective(formula: dict) -> float:
        score_result = scorer.score_formula(formula, target_scores)
        return -score_result.get("final_score", 0.0)

    return objective


def create_formula_gradient_function(
    target_scores: dict,
    scorer: Any,
    epsilon: float = 1e-5
) -> Callable[[dict], dict]:
    """
    创建配方梯度函数

    Args:
        target_scores: 目标分数
        scorer: 评分器实例
        epsilon: 扰动幅度

    Returns:
        梯度函数
    """
    def gradient(formula: dict) -> dict:
        base_score = scorer.score_formula(formula, target_scores)
        base_loss = -base_score.get("final_score", 0.0)
        gradients = {}

        for ingredient, dosage in formula.items():
            perturbed = formula.copy()
            if abs(dosage) > epsilon:
                perturbed[ingredient] = dosage + epsilon
            else:
                perturbed[ingredient] = epsilon

            perturbed_score = scorer.score_formula(perturbed, target_scores)
            perturbed_loss = -perturbed_score.get("final_score", 0.0)
            gradients[ingredient] = (perturbed_loss - base_loss) / epsilon

        return gradients

    return gradient
