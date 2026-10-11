# -*- coding: utf-8 -*-
"""Retrain with the upgraded pipeline (numpy MLP + Adam + class weight + learned threshold)."""
import sys
import os
import json

sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

import importlib
import app.services.peptide_analyzer.real_ml_trainer as tm
importlib.reload(tm)

trainer = tm.RealModelTrainer('ACE inhibitory')
report = trainer.train(max_epochs=60)
v = report['metrics']['validation']
print('=== 内存指标 ===')
print('  decision_threshold:', report['metrics'].get('decision_threshold'))
print('  best_f1_at_threshold:', report['metrics'].get('best_f1_at_threshold'))
print('  validation accuracy:', v['accuracy'], '(baseline', v['majority_baseline'], ')')
print('  validation F1:', v['f1'])
print('  validation balanced:', v['balanced_accuracy'])
print('  precision:', v['precision'], 'recall:', v['recall'])
print('  confusion tp/fp/fn/tn:', v['tp'], v['fp'], v['fn'], v['tn'])

art = json.load(open(trainer.artifact_path, encoding='utf-8'))
av = art['metrics']['validation']
print()
print('=== artifact 落盘 ===')
print('  input_size:', art.get('input_size'), ' hidden:', art.get('hidden_sizes'))
print('  feature_mode:', art.get('feature_mode'))
print('  decision_threshold:', art.get('metrics', {}).get('decision_threshold'))
print('  best_f1:', art.get('metrics', {}).get('best_f1_at_threshold'))
print('  F1:', av.get('f1'), ' balanced:', av.get('balanced_accuracy'))
print('  saved_at:', art.get('saved_at'))

print()
print('=== predict 抽查（阈值生效验证）===')
for seq in ['IPP', 'VPP', 'VLGYT', 'GGGGG']:
    p = trainer.predict(seq)
    print('  %-6s score=%.4f active=%s thr=%.2f' % (
        seq, p['score'], p['is_predicted_active'], p['decision_threshold']))