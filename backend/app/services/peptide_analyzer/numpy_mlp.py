# -*- coding: utf-8 -*-
"""NumpyMLP: vectorised mini-batch MLP with Adam + class weighting.

The original SimpleNeuralNetwork trains with a per-sample pure-Python loop and
only updates the last layer, which cannot fit 444-dim inputs. This version uses
numpy for the full forward/backward pass and trains every layer with Adam.

No fabricated data: all weights are learned from the DFBP records.
"""
import math
import numpy as np


def _sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -500.0, 500.0)))


def _relu(z):
    return np.maximum(0.0, z)


class NumpyMLP:
    """Fully-connected MLP with numpy forward/backward and Adam."""

    def __init__(self, input_size, hidden_sizes, output_size=1, seed=42):
        rng = np.random.default_rng(seed)
        sizes = [input_size] + list(hidden_sizes) + [output_size]
        self.sizes = sizes
        self.input_size = input_size
        self.hidden_sizes = list(hidden_sizes)
        self.output_size = output_size
        self.weights = []
        self.biases = []
        for i in range(len(sizes) - 1):
            fan_in, fan_out = sizes[i], sizes[i + 1]
            limit = math.sqrt(6.0 / (fan_in + fan_out))
            self.weights.append(rng.uniform(-limit, limit, size=(fan_in, fan_out)))
            self.biases.append(np.zeros(fan_out))

    def forward(self, X):
        """X: (n, input_size) -> (n, 1) probabilities."""
        a = np.asarray(X, dtype=np.float64)
        if a.ndim == 1:
            a = a.reshape(1, -1)
        for i in range(len(self.weights) - 1):
            a = _relu(a @ self.weights[i] + self.biases[i])
        return _sigmoid(a @ self.weights[-1] + self.biases[-1])

    def predict_proba_one(self, x):
        """Single-sample probability as a float."""
        return float(self.forward(np.asarray(x, dtype=np.float64))[0, 0])

    def train(self, X, y, epochs=60, lr=0.01, batch_size=64,
              pos_weight=None, l2=1e-4, seed=42):
        """Mini-batch Adam training with positive-class weighting.

        pos_weight: loss weight for positive (label=1) samples.
            None -> sqrt(n_neg / n_pos), a moderate reweighting.
        """
        X = np.asarray(X, dtype=np.float64)
        y = np.asarray(y, dtype=np.float64).reshape(-1, 1)
        n = X.shape[0]
        n_pos = float(y.sum())
        n_neg = float(n - n_pos)
        if pos_weight is None:
            pos_weight = math.sqrt(max(n_neg, 1.0) / max(n_pos, 1.0))
        sample_w = np.where(y > 0.5, pos_weight, 1.0)

        mw = [np.zeros_like(w) for w in self.weights]
        vw = [np.zeros_like(w) for w in self.weights]
        mb = [np.zeros_like(b) for b in self.biases]
        vb = [np.zeros_like(b) for b in self.biases]
        beta1, beta2, eps = 0.9, 0.999, 1e-8
        step = 0
        rng = np.random.default_rng(seed)

        for _epoch in range(epochs):
            order = rng.permutation(n)
            for start in range(0, n, batch_size):
                idx = order[start:start + batch_size]
                xb, yb, wb = X[idx], y[idx], sample_w[idx]
                bs = xb.shape[0]
                wsum = max(float(wb.sum()), 1e-9)

                # forward, keeping hidden activations
                acts = [xb]
                a = xb
                for i in range(len(self.weights) - 1):
                    a = _relu(a @ self.weights[i] + self.biases[i])
                    acts.append(a)
                p = _sigmoid(a @ self.weights[-1] + self.biases[-1])

                # weighted BCE gradient with respect to output logits
                dz = (p - yb) * wb / wsum

                grads_w = [None] * len(self.weights)
                grads_b = [None] * len(self.biases)
                grads_w[-1] = acts[-1].T @ dz / bs
                grads_b[-1] = dz.sum(axis=0) / bs
                da = dz @ self.weights[-1].T
                for i in range(len(self.weights) - 2, -1, -1):
                    dz_i = da * (acts[i + 1] > 0)
                    grads_w[i] = acts[i].T @ dz_i / bs
                    grads_b[i] = dz_i.sum(axis=0) / bs
                    if i > 0:
                        da = dz_i @ self.weights[i].T

                # Adam update
                step += 1
                for i in range(len(self.weights)):
                    gw = grads_w[i] + l2 * self.weights[i]
                    gb = grads_b[i] + l2 * self.biases[i]
                    mw[i] = beta1 * mw[i] + (1 - beta1) * gw
                    vw[i] = beta2 * vw[i] + (1 - beta2) * (gw ** 2)
                    mb[i] = beta1 * mb[i] + (1 - beta1) * gb
                    vb[i] = beta2 * vb[i] + (1 - beta2) * (gb ** 2)
                    mw_hat = mw[i] / (1 - beta1 ** step)
                    vw_hat = vw[i] / (1 - beta2 ** step)
                    mb_hat = mb[i] / (1 - beta1 ** step)
                    vb_hat = vb[i] / (1 - beta2 ** step)
                    self.weights[i] -= lr * mw_hat / (np.sqrt(vw_hat) + eps)
                    self.biases[i] -= lr * mb_hat / (np.sqrt(vb_hat) + eps)

    def to_json(self):
        """Serialise weights for artifact persistence."""
        return {
            "input_size": self.input_size,
            "hidden_sizes": list(self.hidden_sizes),
            "output_size": self.output_size,
            "weights": [w.tolist() for w in self.weights],
            "biases": [b.tolist() for b in self.biases],
        }

    @classmethod
    def from_json(cls, payload):
        """Rebuild from a serialised artifact."""
        m = cls(
            input_size=payload["input_size"],
            hidden_sizes=payload["hidden_sizes"],
            output_size=payload.get("output_size", 1),
        )
        m.weights = [np.asarray(w, dtype=np.float64) for w in payload["weights"]]
        m.biases = [np.asarray(b, dtype=np.float64) for b in payload["biases"]]
        return m