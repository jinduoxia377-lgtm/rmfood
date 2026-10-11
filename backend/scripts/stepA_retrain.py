# -*- coding: utf-8 -*-
"""Step A: retrain real-only with credibility gate, and confirm honest verdict."""
import sys
import os
import json

sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

import importlib
import app.services.peptide_analyzer.real_ml_trainer as tm
importlib.reload(tm)

print("=" * 74)
print("STEP A: real-only training + credibility gate")
print("=" * 74)

trainer = tm.RealModelTrainer('ACE inhibitory')
report = trainer.train(max_epochs=60)
m = report['metrics']
v = m['validation']
print("  real_only          :", report.get('real_only', m.get('trained_on_real_only')))
print("  library_size       :", report['library_size'])
print("  library_real_count :", report['library_real_count'])
print("  library_synth_count:", report['library_synth_count'])
print("  train / val        :", report['training_samples'], '/', report['validation_samples'])
print("  decision_threshold :", m.get('decision_threshold'))
print("  best_f1@threshold  :", m.get('best_f1_at_threshold'))
print("  balanced_accuracy  :", m.get('balanced_accuracy'))
print("  is_trustworthy     :", m.get('is_trustworthy'))
print("  trust_note         :", m.get('trust_note'))
print()
print("  val confusion tp/fp/fn/tn:", v['tp'], v['fp'], v['fn'], v['tn'])
print("  val precision/recall:", v['precision'], '/', v['recall'])
print()
print("  artifact:")
art = json.load(open(trainer.artifact_path, encoding='utf-8'))
print("    input_size:", art.get('input_size'), "hidden:", art.get('hidden_sizes'))
print("    real_only:", art.get('real_only'))
print("    is_trustworthy:", art.get('is_trustworthy'))
print("    balanced_accuracy:", art.get('balanced_accuracy'))
print("    saved_at:", art.get('saved_at'))