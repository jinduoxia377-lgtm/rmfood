# -*- coding: utf-8 -*-
"""Compare full DB vs real-only training. Same seed, structure, epochs."""
import sys
import os
import random

sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

from app.services.peptide_analyzer.real_ml_trainer import _load_real_training_set
from app.services.peptide_analyzer.ml_models import SimpleNeuralNetwork, AminoAcidEncoder


def evaluate(model, X, y):
    """Full honest metrics: accuracy + F1 + balanced acc + majority baseline."""
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
    pos_rec = rec
    neg_rec = tn / max(tn + fp, 1)
    bal = (pos_rec + neg_rec) / 2
    base = max(tn + fn, tp + fp) / n
    return {
        "n": len(y), "pos": tp + fn, "acc": round(acc, 4),
        "precision": round(prec, 4), "recall": round(rec, 4),
        "f1": round(f1, 4), "balanced": round(bal, 4), "baseline": round(base, 4),
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
    }


def run(real_only, epochs=60):
    """Train one variant, return (metrics, sizes)."""
    records = _load_real_training_set("ACE inhibitory", real_only=real_only)
    X_all = [AminoAcidEncoder.extract_features(r["sequence"]) for r in records]
    y_all = [r["label"] for r in records]
    idx = list(range(len(records)))
    random.seed(42)
    random.shuffle(idx)
    split = int(len(idx) * 0.85)
    tr, va = idx[:split], idx[split:]
    X_tr = [X_all[i] for i in tr]
    y_tr = [y_all[i] for i in tr]
    X_va = [X_all[i] for i in va]
    y_va = [y_all[i] for i in va]
    modelbef = SimpleNeuralNetwork(input_size=12, hidden_sizes=[16, 8], output_size=1)
    modelbef.train(X_tr, y_tr, epochs=epochs, lr=0.01)
    return evaluate(modelbef, X_va, y_va), evaluate(modelbef, X_tr, y_tr), len(records)


print("=" * 68)
print("COMPARISON: full DB (real+synthetic)  vs  real-only 400")
print("=" * 68)

val_full, tr_full, n_full = run(real_only=False)
val_real, tr_real, n_real = run(real_only=True)

print()
print("[A] Full DB (real + synthetic)")
print(f"  records: {n_full}   train: {tr_full['n']}   val: {val_full['n']}")
print(f"  val accuracy : {val_full['acc']:.4f}   (majority baseline {val_full['baseline']:.4f})")
print(f"  val F1       : {val_full['f1']:.4f}")
print(f"  val balanced : {val_full['balanced']:.4f}")
print(f"  precision    : {val_full['precision']:.4f}   recall: {val_full['recall']:.4f}")
print(f"  confusion tp/fp/fn/tn: {val_full['tp']}/{val_full['fp']}/{val_full['fn']}/{val_full['tn']}")

print()
print("[B] Real-only 400 (synthetic filtered out)")
print(f"  records: {n_real}   train: {tr_real['n']}   val: {val_real['n']}")
print(f"  val accuracy : {val_real['acc']:.4f}   (majority baseline {val_real['baseline']:.4f})")
print(f"  val F1       : {val_real['f1']:.4f}")
print(f"  val balanced : {val_real['balanced']:.4f}")
print(f"  precision    : {val_real['precision']:.4f}   recall: {val_real['recall']:.4f}")
print(f"  confusion tp/fp/fn/tn: {val_real['tp']}/{val_real['fp']}/{val_real['fn']}/{val_real['tn']}")

print()
print("=" * 68)
print("DELTA (real-only minus full)")
print("=" * 68)
print(f"  F1       : {val_real['f1'] - val_full['f1']:+.4f}")
print(f"  balanced : {val_real['balanced'] - val_full['balanced']:+.4f}")
print(f"  accuracy : {val_real['acc'] - val_full['acc']:+.4f}")
print(f"  precision: {val_real['precision'] - val_full['precision']:+.4f}")
print(f"  recall   : {val_real['recall'] - val_full['recall']:+.4f}")