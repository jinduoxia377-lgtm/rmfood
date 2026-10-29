# ruff: noqa: N806
"""
神经网络配方预测引擎 (Neural Formula Network)

使用前馈神经网络从功效需求预测最优配方组成。
架构: 输入层 → 隐藏层1 (ReLU) → Dropout → 隐藏层2 (ReLU) → 输出层 (Sigmoid)

@version 1.0.0
"""
import logging
import math
import random
from typing import Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

# 药食材编码 (输入层索引)
HERB_INDEX: Dict[str, int] = {
    "hq": 0, "ds": 1, "gz": 2, "rs": 3, "dg": 4,
    "bq": 5, "fp": 6, "gq": 7, "jgh": 8, "cs": 9,
    "cx": 10, "yq": 11, "cyh": 12, "dcx": 13, "sj": 14,
    "gh": 15, "hqg": 16, "lk": 17, "mld": 18, "fz": 19,
}
N_HERBS = len(HERB_INDEX)

# 功效编码
EFFECT_INDEX: Dict[str, int] = {
    "免疫调节": 0, "抗氧化": 1, "抗疲劳": 2,
    "降血糖": 3, "降压": 4, "护肝": 5,
    "消化系统": 6, "补气": 7, "养血": 8, "安神": 9,
}
N_EFFECTS = len(EFFECT_INDEX)

# 药材-功效先验知识矩阵 (用于合成训练数据)
# 从 bayesian_formula_optimizer 的 _BUILTIN_HERBS 提取
HERB_EFFICACY_MATRIX: List[List[float]] = [
    # 免  抗  抗  降  降  护  消  补  养  安
    # 疫  氧  疲  血  压  肝  化  气  血  神
    [.92,.78,.85,.65,.55,.60,.50,.80,.40,.30],  # 黄芪 hq
    [.85,.60,.80,.50,.45,.50,.55,.90,.50,.40],  # 党参 ds
    [.82,.90,.60,.50,.45,.78,.50,.60,.70,.50],  # 枸杞 gz
    [.90,.70,.95,.55,.78,.50,.40,.85,.65,.50],  # 人参 rs
    [.70,.75,.60,.40,.45,.50,.55,.70,.92,.60],  # 当归 dg
    [.72,.50,.55,.40,.35,.45,.85,.80,.50,.30],  # 白术 bq
    [.70,.40,.45,.30,.30,.50,.68,.60,.50,.60],  # 茯苓 fp
    [.60,.50,.40,.35,.30,.50,.55,.50,.50,.40],  # 甘草 gq
    [.60,.75,.40,.70,.30,.65,.40,.30,.50,.50],  # 菊花 jgh
    [.70,.70,.60,.45,.78,.50,.55,.60,.88,.40],  # 川芎 cs
    [.50,.68,.40,.30,.25,.40,.85,.50,.40,.30],  # 陈皮 cx
    [.72,.50,.45,.65,.30,.40,.70,.60,.50,.40],  # 薏苡仁 yq
    [.72,.78,.40,.30,.25,.50,.50,.30,.50,.30],  # 金银花 cyh
    [.72,.50,.55,.35,.30,.45,.68,.78,.75,.50],  # 大枣 dcx
    [.55,.68,.50,.60,.55,.40,.85,.50,.40,.40],  # 生姜 sj
    [.60,.70,.50,.80,.75,.55,.45,.55,.50,.35],  # 葛根 gh
    [.88,.75,.70,.65,.55,.60,.50,.80,.40,.30],  # 黄芪根 hqg
    [.20,.15,.10,.30,.55,.10,.10,.10,.10,.15],  # 藜芦 lk
    [.15,.10,.10,.20,.50,.10,.10,.10,.10,.10],  # 马利兰 mld
    [.25,.20,.30,.10,.72,.10,.10,.15,.20,.10],  # 附子 fz
]


class NeuralFormulaNetwork:
    """
    前馈神经网络配方预测器

    架构: N_EFFECTS + 4(约束) → 16 → 12 → N_HERBS
    """

    def __init__(self, learning_rate: float = 0.01):
        self.lr = learning_rate
        self._init_weights()

    def _init_weights(self):
        """Xavier 初始化权重"""
        n_input = N_EFFECTS + 4
        self.W1 = np.random.randn(n_input, 16) * math.sqrt(2.0 / n_input)
        self.b1 = np.zeros((1, 16))
        self.W2 = np.random.randn(16, 12) * math.sqrt(2.0 / 16)
        self.b2 = np.zeros((1, 12))
        self.W3 = np.random.randn(12, N_HERBS) * math.sqrt(2.0 / 12)
        self.b3 = np.zeros((1, N_HERBS))

    def _relu(self, x: np.ndarray) -> np.ndarray:
        return np.maximum(0, x)

    def _relu_deriv(self, x: np.ndarray) -> np.ndarray:
        return (x > 0).astype(float)

    def _sigmoid(self, x: np.ndarray) -> np.ndarray:
        return 1.0 / (1.0 + np.exp(-np.clip(x, -10, 10)))

    def forward(self, effects: np.ndarray, constraints: Optional[np.ndarray] = None) -> np.ndarray:
        """前向传播: 功效向量 → 药材用量向量"""
        if constraints is None:
            constraints = np.array([[0.5, 0.5, 0.5, 0.5]])
        x = np.concatenate([effects.reshape(1, -1), constraints.reshape(1, -1)], axis=1)
        self.z1 = x @ self.W1 + self.b1
        self.a1 = self._relu(self.z1)
        self.z2 = self.a1 @ self.W2 + self.b2
        self.a2 = self._relu(self.z2)
        self.z3 = self.a2 @ self.W3 + self.b3
        self.output = self._sigmoid(self.z3)
        return self.output[0]

    def train_step(self, effects: np.ndarray, target: np.ndarray,
                   constraints: Optional[np.ndarray] = None) -> float:
        """单步训练: 反向传播"""
        self.forward(effects, constraints)
        error = target - self.output

        # 输出层梯度
        dZ3 = error * self.output * (1 - self.output)
        dW3 = self.a2.T @ dZ3
        db3 = np.sum(dZ3, axis=0, keepdims=True)

        # 隐藏层2梯度
        dA2 = dZ3 @ self.W3.T
        dZ2 = dA2 * self._relu_deriv(self.z2)
        dW2 = self.a1.T @ dZ2
        db2 = np.sum(dZ2, axis=0, keepdims=True)

        # 隐藏层1梯度
        dA1 = dZ2 @ self.W2.T
        dZ1 = dA1 * self._relu_deriv(self.z1)
        dW1 = self.z1.T @ dZ1
        db1 = np.sum(dZ1, axis=0, keepdims=True)

        # 更新权重
        self.W3 += self.lr * dW3
        self.b3 += self.lr * db3
        self.W2 += self.lr * dW2
        self.b2 += self.lr * db2
        self.W1 += self.lr * dW1
        self.b1 += self.lr * db1

        return float(np.mean(error ** 2))

    def train(self, epochs: int = 1000, verbose: bool = False):
        """使用先验知识训练网络"""
        losses = []
        for epoch in range(epochs):
            total_loss = 0.0
            n_samples = 0
            for eff_name, eff_idx in EFFECT_INDEX.items():
                # 构造训练样本: 对每个功效, 期望的药材输出
                target_vec = np.zeros(N_HERBS)
                for hid, h_idx in HERB_INDEX.items():
                    if hid in range(len(HERB_EFFICACY_MATRIX)):
                        target_vec[h_idx] = HERB_EFFICACY_MATRIX[hid][eff_idx] * random.uniform(0.8, 1.0)

                eff_vec = np.zeros(N_EFFECTS)
                eff_vec[eff_idx] = 1.0
                constraints = np.array([[random.uniform(0, 1) for _ in range(4)]])

                loss = self.train_step(eff_vec, target_vec, constraints)
                total_loss += loss
                n_samples += 1

            # 多功效组合训练
            for _ in range(20):
                n_eff = random.randint(2, 4)
                selected = random.sample(list(EFFECT_INDEX.values()), n_eff)
                eff_vec = np.zeros(N_EFFECTS)
                for idx in selected:
                    eff_vec[idx] = 1.0
                target_vec = np.zeros(N_HERBS)
                for hid, h_idx in HERB_INDEX.items():
                    if hid in range(len(HERB_EFFICACY_MATRIX)):
                        score = sum(HERB_EFFICACY_MATRIX[hid][idx] for idx in selected) / n_eff
                        target_vec[h_idx] = score * random.uniform(0.7, 1.0)

                constraints = np.array([[random.uniform(0, 1) for _ in range(4)]])
                loss = self.train_step(eff_vec, target_vec, constraints)
                total_loss += loss
                n_samples += 1

            avg_loss = total_loss / max(1, n_samples)
            losses.append(avg_loss)
            if verbose and (epoch + 1) % 200 == 0:
                logger.info(f"[NeuralNetwork] Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.6f}")

        return losses

    def predict(self, target_effects: List[str]) -> Dict[str, float]:
        """根据目标功效预测最优配方"""
        eff_vec = np.zeros(N_EFFECTS)
        for eff in target_effects:
            if eff in EFFECT_INDEX:
                eff_vec[EFFECT_INDEX[eff]] = 1.0

        constraints = np.array([[0.5, 0.5, 0.5, 0.5]])
        output = self.forward(eff_vec, constraints)

        result = {}
        for hid, h_idx in HERB_INDEX.items():
            val = float(output[h_idx])
            if val > 0.2:
                from .bayesian_formula_optimizer import _BUILTIN_HERBS
                if hid in _BUILTIN_HERBS:
                    herb = _BUILTIN_HERBS[hid]
                    dosage = herb.dosage_min + val * (herb.dosage_max - herb.dosage_min)
                    dosage = round(dosage / herb.dosage_step) * herb.dosage_step
                    dosage = max(herb.dosage_min, min(herb.dosage_max, dosage))
                    result[hid] = dosage
        return result


class NeuralEnsemble:
    """
    神经网络集成 (Ensemble of 3 networks)
    投票机制提高预测稳定性
    """

    def __init__(self):
        self.networks = [NeuralFormulaNetwork() for _ in range(3)]
        # 不同学习率
        self.networks[0].lr = 0.008
        self.networks[1].lr = 0.015
        self.networks[2].lr = 0.025

    def train_all(self, epochs: int = 500):
        for i, net in enumerate(self.networks):
            logger.info(f"[NeuralEnsemble] Training network {i+1}/3...")
            net.train(epochs=epochs)

    def ensemble_predict(self, target_effects: List[str]) -> Dict[str, float]:
        """集成预测 (平均值)"""
        all_results = [net.predict(target_effects) for net in self.networks]
        merged: Dict[str, List[float]] = {}
        for result in all_results:
            for hid, dosage in result.items():
                if hid not in merged:
                    merged[hid] = []
                merged[hid].append(dosage)

        final = {}
        for hid, dosages in merged.items():
            final[hid] = sum(dosages) / len(dosages)

        return final


# 全局单例 + 预训练
_neural_ensemble: Optional[NeuralEnsemble] = None

def get_neural_ensemble() -> NeuralEnsemble:
    global _neural_ensemble
    if _neural_ensemble is None:
        _neural_ensemble = NeuralEnsemble()
        try:
            _neural_ensemble.train_all(epochs=500)
            logger.info("[NeuralEnsemble] 3 networks trained successfully")
        except Exception as e:
            logger.warning(f"[NeuralEnsemble] Training failed: {e}")
    return _neural_ensemble
