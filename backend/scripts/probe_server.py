# -*- coding: utf-8 -*-
"""直接 import 当前磁盘代码（等同重启加载），验证协同分析+ml_model 拆分逻辑真实生效。"""
import sys, json, asyncio
sys.path.insert(0, r'D:\RMFOODFP\backend')
import os
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

from app.services.ai_models.advanced_peptide_analyzer import get_advanced_analyzer

analyzer = get_advanced_analyzer()

# 多味药触发 HERB_INTERACTIONS 配伍
result = asyncio.run(analyzer.analyze_peptide_herb_synergy(
    peptide_sequences=['IPP'],
    herb_names=['人参', '黄芪', '菊花'],
))

print('=== 协同分析 result keys ===')
print(list(result.keys()))
print()

hks = result.get('herb_knowledge_source', {})
print('=== herb_knowledge_source（TCMSP 真实库 319 种）===')
print('  TCMSP matched:', hks.get('tcmsp_matched'))
print('  fallback:', hks.get('fallback_8herb'))
print('  unknown:', hks.get('unknown'))
for name, src in hks.get('sources', {}).items():
    print(f'    {name} -> {src}')
print()

hi = result.get('herb_interactions', {})
print('=== herb_interactions（HERB_INTERACTIONS 配伍库）===')
print('  available:', hi.get('available'))
print('  配伍库总条数:', hi.get('total_interactions_in_db'))
print('  药对数:', hi.get('pairs_checked'))
print('  命中配伍:', len(hi.get('matched_pairs', [])))
for m in hi.get('matched_pairs', []):
    print(f'    {m["a"]}+{m["b"]} {m["type"]} strength={m["strength"]} 修正={m["adjustment"]} ({m["basis"]})')
print('  base overall:', result.get('overall_synergy_score'))
print('  adjusted overall:', result.get('overall_synergy_score_adjusted'))
print()

sm = result.get('synergy_matrix', [])
if sm:
    print('=== synergy_matrix 第一行（per-herb 来源）===')
    for c in sm[0]:
        print(f'  {c.get("herb")}: synergy={c.get("synergy_score")} herb_source={c.get("herb_source")}')

# 再验 /analyze ml_model 拆分
print()
print('=== /analyze ml_model 真实/合成拆分 ===')
from app.services.peptide_analyzer.food_peptide_service import get_analyzer
svc = get_analyzer()
res = asyncio.run(svc.analyze('IPP'))
print('  结果类型:', type(res).__name__)
ml = res.to_dict().get('ml_model', {}) if hasattr(res, 'to_dict') else {}
print('  library_real_count:', ml.get('library_real_count'))
print('  library_synth_count:', ml.get('library_synth_count'))
print('  train_real_count:', ml.get('train_real_count'))
print('  train_synth_count:', ml.get('train_synth_count'))
print('  honest_note:', ml.get('honest_note'))
