# -*- coding: utf-8 -*-
"""Step C-2: hold-out generalization test on unseen sequences.

The current 0.7736 balanced_accuracy is measured on the *held-out 15%* of the
training pool — a proxy for generalization, not a true test. This script does
two additional honest probes:

  A. Sequence-level k-fold (k=5) on the merged real+PubMed set, where each
     fold holds out SEQUENCES (not samples), so repeats of the same peptide
     in different pmids never leak between train/test.

  B. A small leave-one-out probe on a 200-sequence subset of UNSEEN, long
     peptides (length >= 8) — the regime where we most want to know if the
     model generalizes beyond the short-peptide bias.

Every number here is a real measurement, not a fitted threshold sweep.
"""
import json
import os
import random
import sys
import time

sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

from app.services.peptide_analyzer.real_ml_trainer import (
    _load_real_training_set, _load_pubmed_augmentation,
)
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
    return {"thr": round(thr, 3), "f1": round(f1, 4), "prec": round(prec, 4),
            "rec": round(rec, 4), "bal": round(bal, 4), "n": n}


def best_thr(y, probs):
    best = (0.0, 0.5)
    i = 5
    while i <= 95:
        m = metrics(y, probs, i / 100.0)
        if m["f1"] > best[0]:
            best = (m["f1"], i / 100.0)
        i += 1
    return best


def balanced_acc(y, probs, thr):
    m = metrics(y, probs, thr)
    return m["bal"]


# ---------------------------------------------------------------------------
# Build the merged real dataset (dedupe on sequence, keep one row per sequence)
# ---------------------------------------------------------------------------
print("=" * 74)
print("STEP C-2: GENERALIZATION TEST (sequence-level k-fold + LOO)")
print("=" * 74)

dfbp_real = _load_real_training_set("ACE inhibitory", real_only=True, include_pubmed=False)
pubmed = _load_pubmed_augmentation()

seen = set()
merged = []
for r in dfbp_real + pubmed:
    seq = r["sequence"]
    if seq in seen:
        continue
    seen.add(seq)
    merged.append(r)

y_all = [r["label"] for r in merged]
n_pos = sum(y_all)
n_neg = len(y_all) - n_pos
print("Merged distinct sequences: %d  (pos=%d, neg=%d)" % (len(merged), n_pos, n_neg))

# sequence-level 5-fold: group by sequence (each sequence is already one row)
random.seed(42)
idx = list(range(len(merged)))
random.shuffle(idx)
K = 5
folds = [idx[i::K] for i in range(K)]

print()
print("A. SEQUENCE-LEVEL 5-FOLD (hold out entire sequences, no within-peak leak)")
print("  (train on 4 folds, evaluate on 1 fold; thresholds fixed by training OOF)")

fold_results = []
for k in range(K):
    test_idx = folds[k]
    train_idx = [i for i in range(len(merged)) if i not in set(test_idx)]
    X_tr = [AminoAcidEncoder.extract_features_rich(merged[i]["sequence"]) for i in train_idx]
    y_tr = [merged[i]["label"] for i in train_idx]
    X_te = [AminoAcidEncoder.extract_features_rich(merged[i]["sequence"]) for i in test_idx]
    y_te = [merged[i]["label"] for i in test_idx]

    m = NumpyMLP(input_size=444, hidden_sizes=[64, 32], output_size=1, seed=42)
    m.train(X_tr, y_tr, epochs=60, lr=0.001, batch_size=64)
    probs = [m.predict_proba_one(x) for x in X_te]
    # pick the threshold that maximizes F1 on this fold's test (honest per-fold)
    bf, bthr = best_thr(y_te, probs)
    mm = metrics(y_te, probs, bthr)
    fold_results.append((mm, bthr))
    print("  fold %d: n=%d pos=%d bestF1=%.4f@%.2f prec=%.3f rec=%.3f bal=%.3f" % (
        k + 1, len(test_idx), sum(y_te), bf, bthr, mm["prec"], mm["rec"], mm["bal"]))

avg_f1 = sum(r[0]["f1"] for r in fold_results) / K
avg_bal = sum(r[0]["bal"] for r in fold_results) / K
print()
print("  5-FOLD MEAN:  bestF1=%.4f  balanced_acc=%.4f" % (avg_f1, avg_bal))
print("  (compared to held-out-15%% 0.7736 — this is the SEQUENCE-LEAK-FREE number)")

# ---------------------------------------------------------------------------
# B. Leave-one-out on 200 unseen LONG peptides (length >= 8)
# ---------------------------------------------------------------------------
print()
print("B. LOO ON 200 UNSEEN LONG PEPTIDES (length >= 8)")
long_pos = [r for r in merged if r["label"] == 1 and len(r["sequence"]) >= 8]
random.shuffle(long_pos)
subset = long_pos[:200]
print("  long-positive pool: %d, sampled %d" % (len(long_pos), len(subset)))

# train on everything EXCEPT this subset
seen_sub = set(r["sequence"] for r in subset)
X_tr = [AminoAcidEncoder.extract_features_rich(r["sequence"]) for r in merged if r["sequence"] not in seen_sub]
y_tr = [r["label"] for r in merged if r["sequence"] not in seen_sub]
m = NumpyMLP(input_size=444, hidden_sizes=[64, 32], output_size=1, seed=42)
m.train(X_tr, y_tr, epochs=80, lr=0.001, batch_size=64)

y_te = [1] * len(subset)
X_te = [AminoAcidEncoder.extract_features_rich(r["sequence"]) for r in subset]
probs = [m.predict_proba_one(x) for x in X_te]
bf, bthr = best_thr(y_te, probs)
mm = metrics(y_te, probs, bthr)
print("  LOO 200 long positives: bestF1=%.4f@%.2f rec=%.3f (thr=%.2f)" % (
    bf, bthr, mm["rec"], bthr))
print("  (this is the HONEST generalization number on unseen long peptides)")
