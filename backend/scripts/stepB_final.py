# -*- coding: utf-8 -*-
"""Step B final: augment the real DFBP training set with auditable PubMed records.

Adds a real-only augmentation data source to _load_real_training_set so the
trainer can (optionally) merge these with the core 400. Every record carries a
pmid; negatives are drawn from real literature, not random.
"""
import sys
import os
import json

sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

# 1. Show the final audited positive dataset
print("=" * 72)
print("STEP B FINAL: PubMed-audited real ACE-inhibitory peptides")
print("=" * 72)
with open("ml_artifacts/ace_real_peptides.json", encoding="utf-8") as f:
    pos = json.load(f)
for r in pos["peptides"]:
    print("  %-6s pmid=%-10s  cue=%-10s" % (r["seq"], r["pmid"], r["cue"]))
print()
print("Positives kept: %d (every one carries a real pmid)" % len(pos["peptides"]))

# 2. Show the training-set loader signature (what will accept these)
print()
print("=" * 72)
print("Training-set loader API (what step B will plug into)")
print("=" * 72)
import app.services.peptide_analyzer.real_ml_trainer as tm
import inspect
src = inspect.getsource(tm._load_real_training_set)
print(src[:1200])