# -*- coding: utf-8 -*-
"""强制重训 artifact 并立即落盘验证（绕开单例缓存）"""
import sys, os, json
sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

# 直接 new 一个新 trainer（不用单例缓存），保证跑的是磁盘最新代码
import importlib
import app.services.peptide_analyzer.real_ml_trainer as tm
importlib.reload(tm)
from app.services.peptide_analyzer.ml_models import SimpleNeuralNetwork, AminoAcidEncoder

trainer = tm.RealModelTrainer('ACE inhibitory')
print('trainer 实例:', type(trainer).__name__)
report = trainer.train(max_epochs=60)
v = report['metrics']['validation']
print('=== 内存指标 ===')
print('  validation keys:', list(v.keys()))
print('  F1:', v['f1'], ' 平衡:', v['balanced_accuracy'], ' 基线:', v['majority_baseline'])

# 立即读 artifact 文件确认落盘
with open(trainer.artifact_path, encoding='utf-8') as f:
    art = json.load(f)
av = art['metrics']['validation']
print('=== artifact 文件当前内容 ===')
print('  artifact validation keys:', list(av.keys()))
print('  F1:', av.get('f1'), ' 平衡:', av.get('balanced_accuracy'), ' 基线:', av.get('majority_baseline'))
print('  saved_at:', art.get('saved_at'))
print('  file path:', trainer.artifact_path)
