# -*- coding: utf-8 -*-
"""Step 2: old per-sample MLP vs new vectorised numpy MLP (Adam + class weighting)."""
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


def metrics(y_true, probs, thr=0.5):
    pl = [1 if p >= thr else 0 for p in probs]
    tp = sum(1 for p, t in zip(pl, y_true) if p == 1 and t == 1)
    fp = sum(1 for p, t in zip(pl, y_true) if p == 1 and t == 0)
    fn = sum(1 for p, t in zip(pl, y_true) if p == 0 and t == 1)
    tn = sum(1 for p, t in zip(pl, y_true) if p == 0 and t == 0)
    n = max(len(y_true), 1)
    acc = (tp + tn) / n
    prec = tp / max(tp + fp, 1)
    rec = tp / max(tp + fn, 1)
    f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0
    bal = (rec + tn / max(tn + fp, 1)) / 2
    base = max(tn + fn, tp + fp) / n
    return {
        "thr": thr, "f1": round(f1, 4), "precision": round(prec, 4),
        "recall": round(rec, 4), "balanced": round(bal, 4),
        "acc": round(acc, 4), "baseline": round(base, 4),
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
    }


def best_f1(y_true, probs):
    """Scan thresholds for the best achievable F1 (honest, reported separately)."""
    best = (0.0, 0.5)
    for i in range(5, 96):
        thr = i / 100.0
        m = metrics(y_true, probs, thr)
        if m["f1"] > best[0]:
            best = (m["f1"], thr)
    return best


records = _load_real_training_set("ACE inhibitory")
y_all = [r["label"] for r in records]
idx = list(range(len(records)))
random.seed(42)
random.shuffle(idx)
split = int(len(idx) * 0.85)
tr, va = idx[:split], idx[split:]

X_rich = [AminoAcidEncoder.extract_features_rich(r["sequence"]) for r in records]
X_tr = [X_rich[i] for i in tr]
y_tr = [y_all[i] for i in tr]
X_va = [X_rich[i] for i in va]
y_va = [y_all[i] for i in va]

print("=" * 72)
print("STEP 2: MODEL UPGRADE  (444-dim rich features, same seed 42)")
print("=" * 72)
print(f"train={len(X_tr)}  val={len(X_va)}  pos_in_val={sum(y_va)}")

# --- A: old per-sample pure-Python MLP ---
t0 = time.time()
old = SimpleNeuralNetwork(input_size=444, hidden_sizes=[64, 32], output_size=1)
old.train(X_tr, y_tr, epochs=60, lr=0.01)
t_old = time.time() - t0
probs_old = [old.forward(x) for x in X_va]
m_old = metrics(y_va, probs_old)
bf_old = best_f1(y_va, probs_old)
print()
print("[A] OLD per-sample MLP 16-8 style loop, 60 epochs")
print(f"  time={t_old:.1f}s")
print(f"  @0.5 F1={m_old['f1']:.4f} prec={m_old['precision']:.4f} rec={m_old['recall']:.4f} bal={m_old['balanced']:.4f} acc={m_old['acc']:.4f} (base {m_old['baseline']:.4f})")
print(f"  confusion {m_old['tp']}/{m_old['fp']}/{m_old['fn']}/{m_old['tn']}")
print(f"  best-F1 over thresholds: {bf_old[0]:.4f} @ thr={bf_old[1]:.2f}")

# --- B: new numpy MLP + Adam + class weighting ---
t0 = time.time()
new = NumpyMLP(input_size=444, hidden_sizes=[64, 32], output_size=1, seed=42)
new.train(X_tr, y_tr, epochs=60, lr=0.01, batch_size=64)
t_new = time.time() - t0
probs_new = [new.predict_proba_one(x) for x in X_va]
m_new = metrics(y_va, probs_new)
bf_new = best_f1(y_va, probs_new)
print()
print("[B] NEW vectorised numpy MLP + Adam + sqrt(neg/pos) class weight")
print(f"  time={t_new:.1f}s")
print(f"  @0.5 F1={m_new['f1']:.4f} prec={m_new['precision']:.4f} rec={m_new['recall']:.4f} bal={m_new['balanced']:.4f} acc={m_new['acc']:.4f} (base {m_new['baseline']:.4f})")
print(f"  confusion {m_new['tp']}/{m_new['fp']}/{m_new['fn']}/{m_new['tn']}")
print(f"  best-F1 over thresholds: {bf_new[0]:.4f} @ thr={bf_new[1]:.2f}")

print()
print("=" * 72)
print("DELTA (new minus old)")
print("=" * 72)
print(f"  F1 @0.5   : {m_new['f1'] - m_old['f1']:+.4f}")
print(f"  best-F1   : {bf_new[0] - bf_old[0]:+.4f}")
print(f"  balanced  : {m_new['balanced'] - m_old['balanced']:+.4f}")
print(f"  recall    : {m_new['recall'] - m_old['recall']:+.4f}")
print(f"  precision : {m_new['precision'] - m_old['precision']:+.4f}")
print(f"  speedup   : {t_old / max(t_new, 1e-6):.0f}x")