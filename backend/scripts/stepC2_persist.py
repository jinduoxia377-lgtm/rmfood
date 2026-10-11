# -*- coding: utf-8 -*-
"""Persist the Step C-2 generalization numbers into the artifact so the UI can
show the sequence-leak-free 5-fold figure (0.7153) as the headline and the
long-peptide LOO recall (0.527) as a caveat."""
import json
import os
import sys

sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')

GEN = "ml_artifacts/generalization_report.json"
report = {
    "generated_by": "stepC2_generalization.py",
    "note": "Honest generalization numbers; 5-fold is sequence-leak-free.",
    "five_fold_sequence_level": {
        "mean_best_f1": 0.8382,
        "mean_balanced_accuracy": 0.7153,
        "per_fold": [
            {"n": 174, "best_f1": 0.8448, "bal": 0.757},
            {"n": 173, "best_f1": 0.8636, "bal": 0.692},
            {"n": 173, "best_f1": 0.8356, "bal": 0.757},
            {"n": 173, "best_f1": 0.8595, "bal": 0.752},
            {"n": 173, "best_f1": 0.7874, "bal": 0.619},
        ],
    },
    "loo_long_peptides_ge8": {
        "pool_size": 129,
        "best_f1": 0.6904,
        "recall": 0.527,
        "threshold": 0.05,
    },
    "short_peptide_bias": "62% of positives are <=5 aa; recall degrades on >=8 aa",
}
os.makedirs("ml_artifacts", exist_ok=True)
with open(GEN, "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print("Saved: %s" % os.path.abspath(GEN))
print("Headline (5-fold seq-leak-free): bestF1=0.8382 balanced=0.7153")
print("Long-peptide LOO: bestF1=0.6904 recall=0.527 (pool=129)")
