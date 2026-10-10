# -*- coding: utf-8 -*-
"""核查 DFBP_PEPTIDE_DATABASE 中合成数据 vs 真实数据占比"""
import sys, os
sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')

from app.services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
from app.services.data_sources.generate_peptides import GENERATED_PEPTIDES
from app.services.data_sources.expand_peptides import EXPANDED_PEPTIDES

base = DFBP_PEPTIDE_DATABASE
gen_ids = {p['dfbp_id'] for p in GENERATED_PEPTIDES}
ex_ids = {p['dfbp_id'] for p in EXPANDED_PEPTIDES}
total = len(base)
synthetic = sum(1 for p in base if p.get('dfbp_id') in gen_ids)
expanded = sum(1 for p in base if p.get('dfbp_id') in ex_ids and p.get('dfbp_id') not in gen_ids)
core = total - synthetic - expanded

print('=== DFBP_PEPTIDE_DATABASE 构成 ===')
print(f'总记录: {total}')
print(f'核心手写(真实 DFBP 文献): {core} 条  ({core/total*100:.1f}%)')
print(f'扩展手写(expand_peptides): {expanded} 条  ({expanded/total*100:.1f}%)')
print(f'程序合成(generate_peptides): {synthetic} 条  ({synthetic/total*100:.1f}%)')

sample_gen = [p for p in base if p.get('dfbp_id') in gen_ids][:3]
print(f'\n合成数据样例字段: {list(sample_gen[0].keys()) if sample_gen else "无"}')
print(f'合成数据有 is_synthetic 标记: {"is_synthetic" in (sample_gen[0] if sample_gen else {})}')
if sample_gen:
    print(f'合成数据样例: {sample_gen[0]}')

# 训练集里合成占比
from app.services.peptide_analyzer.real_ml_trainer import _load_real_training_set
trainset = _load_real_training_set('ACE inhibitory')
syn_in_train = sum(1 for r in trainset if r.get('dfbp_id') in gen_ids or r.get('dfbp_id','').startswith('DFBP') and int(r.get('dfbp_id','DFBP00000')[4:]) >= 365)
print(f'\n=== ML 训练集(ACE inhibitory) ===')
print(f'总训练样本: {len(trainset)} 条')
print(f'训练样本来源构成（启发式）: DFBP 编号 >= 365 的（合成段）约 {syn_in_train} 条')
print(f'注意: 合成数据由 random.seed(42) 程序化生成，编号 DFBP00365+，并非真实 DFBP 数据库记录')
