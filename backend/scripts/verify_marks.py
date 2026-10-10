# -*- coding: utf-8 -*-
"""确认 DFBP_PEPTIDE_DATABASE 是否已带 is_synthetic 标记 + 重训验证真实/合成拆分"""
import sys, os
sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')

from app.services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
total = len(DFBP_PEPTIDE_DATABASE)
marked = sum(1 for p in DFBP_PEPTIDE_DATABASE if 'is_synthetic' in p)
synth = sum(1 for p in DFBP_PEPTIDE_DATABASE if p.get('is_synthetic'))
real = sum(1 for p in DFBP_PEPTIDE_DATABASE if p.get('provenance') == 'core_dfbp_literature')
hand = sum(1 for p in DFBP_PEPTIDE_DATABASE if p.get('provenance') == 'hand_expanded')
print(f'总记录: {total}')
print(f'带 is_synthetic 字段: {marked}/{total}')
print(f'真实文献(core): {real}')
print(f'手写扩展(hand_expanded): {hand}')
print(f'程序合成(synthetic): {synth}')
sample = [p for p in DFBP_PEPTIDE_DATABASE if p.get('is_synthetic')][0]
print(f'合成样例: {sample["dfbp_id"]} is_synthetic={sample["is_synthetic"]} provenance={sample["provenance"]}')

# 现在重训
print('\n=== 重训（应反映真实/合成拆分）===')
from app.services.peptide_analyzer.real_ml_trainer import get_real_model_trainer
trainer = get_real_model_trainer('ACE inhibitory')
report = trainer.train(max_epochs=60)
print(f'library_size: {report["library_size"]}')
print(f'library_real_count: {report["library_real_count"]}')
print(f'library_synth_count: {report["library_synth_count"]}')
print(f'train_real_count: {report["train_real_count"]}')
print(f'train_synth_count: {report["train_synth_count"]}')
print(f'honest_note: {report["honest_note"]}')
