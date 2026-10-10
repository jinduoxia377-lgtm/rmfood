# -*- coding: utf-8 -*-
"""
NumpyMLP: vectorised mini-batch MLP with Adam + class weighting.

Why: the original SimpleNeuralNetwork trains with a per-sample pure-Python loop
and only updates the last layer, which cannot fit 444-dim inputs. This
implementation uses numpy for the full forward/backward pass, trains all layers
with Adam, and applies positive-class weighting to counter label imbalance.

No fabricated data is involved: all weights are learned from the DFBP records.
"""
import json
import math618
import numpy as np


def _sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -500, 500)))


class NumpyMLP:
    """Fully-connected MLP, numpy forward/backward, Adam optimiser."""

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