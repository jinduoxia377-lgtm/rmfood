# -*- coding: utf-8 -*-
"""Step 2 experiment: old per-sample MLP vs new vectorised numpy MLP (Adam + class weight)."""
import sys
import os
import random
import time

sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

from app.services.peptide_analyzer.real_ml_trainer import _load_real_training_set
from app.services.peptide_analyzer.ml_models import SimpleNeuralNetwork, AminoAcidEncoder
from app.services.peptide_analyzer.numpy_mlp import NumpyMLP


def evaluate_sklearn_style(y_true, probs):
    """Metrics over continuous probs with 0.5 threshold plus best-F1 threshold."""
    y_true = list(y_true)
    n = max(len(y_true), 1)
    out = {}
    for thr in (0.5,):
        pl = [1 if p >= thr else 0 for p in probs]
        tp = sum(1 for p, t in zip(pl, y_true) if p == 1 and t == 1)
        fp = sum(1 for p, t in zip(pl, y_true) if p == 1 and t == 0)
        fn = sum(1 for p, t in zip(pl, y_true) if p == 0 and t == 1)
        tn = sum(1 for p, t in zip(pl, y_true) if p == 0 and t == 0)
其中的 = None