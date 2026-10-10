# -*- coding: utf-8 -*-
"""重训 ML artifact（类别加权 + 诚实指标 + 真实/合成拆分），并验证 artifact 落盘。"""
import sys, os, json
sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

from app.services.peptide_analyzer.real_ml_trainer import get_real_model_trainer
t = get_real_model_trainer('ACE inhibitory')
print('trainer id:', id(t))
print('ARTIFACT_DIR:', __import__('app.services.peptide_analyzer.real_ml_trainer', fromlist=['ARTIFACT_DIR']).ARTIFACT_DIR)
r = t.train(max_epochs=60)
v = r['metrics']['validation']
print('=== 重训完成（内存 metrics）===')
print('  验证集 keys:', list(v.keys()))
print('  accuracy:', v['accuracy'], '（基线', v['majority_baseline'], '）')
print('  balanced_acc:', v['balanced_accuracy'], ' f1:', v['f1'])
# 确认 artifact 落盘了新字段
print()
print('=== artifact 落盘验证 ===')
artifact = json.load(open(t.artifact_path, encoding='utf-8'))
av = artifact['metrics']['validation']
print('  artifact path:', t.artifact_path)
print('  artifact validation keys:', list(av.keys()))
print('  balanced_acc:', av.get('balanced_accuracy'), ' f1:', av.get('f1'), ' 基线:', av.get('majority_baseline'))
print('  artifact saved_at:', artifact.get('saved_at'))
print('=== honest_note ===')
print(r['honest_note'])
