# -*- coding: utf-8 -*-
"""Step 1 experiment: 12-dim base features vs 444-dim rich features (same DB, same seed)."""
import sys
import os
import random

sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

from app.services.peptide_analyzer.real_ml_trainer import _load_real_training_set
from app.services.peptide_analyzer.ml_models import SimpleNeuralNetwork, AminoAcidEncoder


def evaluate(model, X, y):
    preds = [model.forward(x) for x in X]
    pl = [1 if p >= 0.5 else 0 for p in preds]
    tp = sum(1 for p, t in zip(pl, y) if p == 1 and t == 1)
    fp = sum(1 for p, t in zip(pl, y) if p == 1 and t == 0)
    fn = sum(1 for p, t in zip(pl, y) if p == 0 and t == 1)
    tn = sum(1 for p, t in zip(pl, y) if p == 0 and t == 0)
    n = max(len(y), 1)
    acc = (tp + tn) / n
    prec = tp / max(tp + fp, 1)
    rec = tp / max(tp + fn, 1)
    f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0
    bal = (rec + tn / max(tn + fp, 1)) / 2
    base = max(tn + fn, tp + fp) / n
    return {
        "acc": round(acc, 4), "precision": round(prec, 4), "recall": round(rec, 4),
        "f1": round(f1, 4), "balanced": round(bal, 4), "baseline": round(base, 4),
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
    }


records = _load_real_training_set("ACE inhibitory")
y_all = [r["label"] for r in records]

# identical split for both variants
idx = list(range(len(records)))
random.seed(42)
random.shuffle(idx)
split = int(len(idx) * 0.85)
tr, va = idx[:split], idx[split:]

X_base = [AminoAcidEncoder.extract_features(r["sequence"]) for r in records]
X_rich = [AminoAcidEncoder.extract_features_rich(r["sequence"]) for r in records]


def run(X_all, hidden, epochs=60, tag=""):
    X_tr = [X_all[i] for i in tr]
    y_tr = [y_all[i] for i in tr]
    X_va = [X_all[i] for i in va]
    y_va = [y_all[i] for i in va]
    m = SimpleNeuralNetwork(input_size=len(X_all[0]), hidden_sizes=hidden, output_size=1)
    m.train(X_tr, y_tr, epochs=epochs, lr=0.01)
    return evaluate(m, X_va, y_va)


print("=" * 70)
print("STEP 1: FEATURE ENGINEERING UPGRADE (same DB 7540, same seed 42)")
print("=" * 70)
r1 = run(X_base, [16, 8], tag="base")
print()
print("[A] 12-dim base features, MLP 16-8")
print(f"  F1={r1['f1']:.4f}  balanced={r1['balanced']:.4f}  acc={r1['acc']:.4f} (base {r1['baseline']:.4f})")
print(f"  precision={r1['precision']:.4f}  recall={r1['recall']:.4f}")
print(f"  confusion {r1['tp']}/{r1['fp']}/{r1['fn']}/{r1['tn']}")

r2 = run(X_rich, [64, 32], tag="rich")
print()
print("[B] 444-dim rich features, MLP 64-32")
print(f"  F1={r2['f1']:.4f}  balanced={r2['balanced']:.4f}  acc={r2['acc']:.4f} (base {r2['baseline']:.4f})")
print(f"  precision={r2['precision']:.4f}  recall={r2['recall']:.4f}")
print(f"  confusion {r2['tp']}/{r2['fp']}/{r2['fn']}/{r2['tn']}")

print()
print("=" * 70)
print("DELTA (rich minus base)")
print("=" * 70)
print(f"  F1       : {r2['f1'] - r1['f1']:+.4f}")
print(f"  balanced : {r2['balanced'] - r1['balanced']:+.4f}")
print(f"  precision: {r2['precision'] - r1['precision']:+.4f}")
print(f"  recall   : {r2['recall'] - r1['recall']:+.4f}")
print(f"  accuracy : {r2['acc'] - r1['acc']:+.4f}")