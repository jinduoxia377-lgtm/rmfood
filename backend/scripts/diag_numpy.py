# -*- coding: utf-8 -*-
"""Diagnose the numpy MLP: check whether outputs collapse to a constant."""
import sys
import os
import random

sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

from app.services.peptide_analyzer.real_ml_trainer import _load_real_training_set
from app.services.peptide_analyzer.ml_models import AminoAcidEncoder
from app.services.peptide_analyzer.numpy_mlp import NumpyMLP

records = _load_real_training_set("ACE inhibitory")
y_all = [r["label"] for r in records]
idx = list(range(len(records)))
random.seed(42)
random.shuffle(idx)
split = int(len(idx) * 0.85)
tr, va = idx[:split], idx[split:]
X = [AminoAcidEncoder.extract_features_rich(r["sequence"]) for r in records]
X_tr = [X[i] for i in tr]
y_tr = [y_all[i] for i in tr]
X_va = [X[i] for i in va]
y_va = [y_all[i] for i in va]

print("train pos ratio:", sum(y_tr) / len(y_tr))
print("val pos ratio:", sum(y_va) / len(y_va))

for lr in [0.01, 0.001]:
    for bs in [64, 256]:
        m = NumpyMLP(input_size=444, hidden_sizes=[64, 32], output_size=1, seed=42)
        m.train(X_tr, y_tr, epochs=60, lr=lr, batch_size=bs)
        probs = [m.predict_proba_one(x) for x in X_va]
        mn, mx = min(probs), max(probs)
        import statistics
        print("lr=%-6s bs=%-4d  min=%.4f max=%.4f mean=%.4f stdev=%.5f" % (
            lr, bs, mn, mx, statistics.mean(probs),
            statistics.pstdev(probs)))