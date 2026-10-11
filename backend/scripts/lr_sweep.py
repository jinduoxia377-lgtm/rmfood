# -*- coding: utf-8 -*-
"""Compare learning rates for the numpy MLP to find a configuration with real skill."""
import sys
import os
import random
import statistics

sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

from app.services.peptide_analyzer.real_ml_trainer import _load_real_training_set
from app.services.peptide_analyzer.ml_models import AminoAcidEncoder
from app.services.peptide_analyzer.numpy_mlp import NumpyMLP


def metrics(y_true, probs, thr):
    pl = [1 if p >= thr else 0 for p in probs]
    tp = sum(1 for p, t in zip(pl, y_true) if p == 1 and t == 1)
    fp = sum(1 for p, t in zip(pl, y_true) if p == 1 and t == 0)
    fn = sum(1 for p, t in zip(pl, y_true) if p == 0 and t == 1)
    tn = sum(1 for p, t in zip(pl, y_true) if p == 0 and t == 0)
    n = max(len(y_true), 1)
    prec = tp / max(tp + fp, 1)
    rec = tp / max(tp + fn, 1)
    f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0
    bal = (rec + tn / max(tn + fp, 1)) / 2
    return dict(thr=round(thr, 3), f1=round(f1, 4), prec=round(prec, 4),
                rec=round(rec, 4), bal=round(bal, 4), auc_like=None,
                tp=tp, fp=fp, fn=fn, tn=tn)


def best_thr(y, probs):
    best = (0.0, 0.5)
    i = 5
    while i <= 95:
        m = metrics(y, probs, i / 100.0)
        if m["f1"] > best[0]:
            best = (m["f1"], i / 100.0)
        i += 1
    return best


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

print("=" * 78)
print("LR SWEEP (444-dim rich features, numpy MLP+Adam, 60 epochs)")
print("=" * 78)
for lr in [0.003, 0.001, 0.0005]:
    for bs in [64]:
        m = NumpyMLP(input_size=444, hidden_sizes=[64, 32], output_size=1, seed=42)
        m.train(X_tr, y_tr, epochs=60, lr=lr, batch_size=bs)
        probs = [m.predict_proba_one(x) for x in X_va]
        bf, bthr = best_thr(y_va, probs)
        mt = metrics(y_va, probs, bthr)
        print("lr=%-7s bs=%-4d stdev=%.5f | bestF1=%.4f@%.2f prec=%.3f rec=%.3f bal=%.3f tp/fp/fn/tn=%d/%d/%d/%d" % (
            lr, bs, statistics.pstdev(probs), bf, bthr,
            mt["prec"], mt["rec"], mt["bal"], mt["tp"], mt["fp"], mt["fn"], mt["tn"]))