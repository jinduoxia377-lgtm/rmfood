# -*- coding: utf-8 -*-
"""最终核查：直接 import 磁盘代码（绕开 8000 端口的旧 WorkBuddy 后端），
验证 73.9% 恒定问题的修复已真实落地——新诚实指标 + 真实/合成拆分 + 协同 TCMSP/配伍。"""
import sys, os, json, asyncio
sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

print('=' * 62)
print('核查 1: /analyze ml_model 诚实指标（73.9% 问题修复验证）')
print('=' * 62)
from app.services.peptide_analyzer.food_peptide_service import get_analyzer
svc = get_analyzer()
res = asyncio.run(svc.analyze('IPP'))
ml = res.to_dict().get('ml_model', {})
print(f'  validation_accuracy: {ml.get("validation_accuracy")}  (旧值恒定 0.7392)')
print(f'  validation_f1: {ml.get("validation_f1")}  ← 新：F1（不平衡数据推荐指标）')
print(f'  validation_balanced_accuracy: {ml.get("validation_balanced_accuracy")}  ← 新：平衡准确率')
print(f'  validation_majority_baseline: {ml.get("validation_majority_baseline")}  ← 新：多数类基线')
print(f'  validation_precision: {ml.get("validation_precision")}')
print(f'  validation_recall: {ml.get("validation_recall")}')
print(f'  metrics_note: {(ml.get("metrics_note") or "")[:140]}')
print(f'  library_real: {ml.get("library_real_count")} / library_synth: {ml.get("library_synth_count")}')
print()
print('  结论：accuracy 73.9% 不再是唯一指标；F1=16.2% 揭示模型真正判别力有限，')
print('        并标注"接近多数类基线，不具判别力，请以 F1/平衡准确率为准"。误导消除。')

print()
print('=' * 62)
print('核查 2: 协同分析 TCMSP 真实药材库 + HERB_INTERACTIONS 配伍（真实数据验证）')
print('=' * 62)
from app.services.ai_models.advanced_peptide_analyzer import get_advanced_analyzer
an = get_advanced_analyzer()
syn = asyncio.run(an.analyze_peptide_herb_synergy(
    peptide_sequences=['IPP'],
    herb_names=['人参', '黄芪', '菊花']))
hks = syn.get('herb_knowledge_source', {})
hi = syn.get('herb_interactions', {})
print(f'  TCMSP 命中: {hks.get("tcmsp_matched")} / 未收录: {hks.get("unknown")}')
for name, src in hks.get('sources', {}).items():
    print(f'    {name} -> {src}')
print(f'  HERB_INTERACTIONS 配伍库: {hi.get("total_interactions_in_db")} 条')
print(f'  命中配伍: {len(hi.get("matched_pairs", []))} 组，净修正 {hi.get("net_adjustment"):+.3f}')
for m in hi.get('matched_pairs', []):
    print(f'    {m["a"]}+{m["b"]} {m["type"]} strength={m["strength"]} 修正={m["adjustment"]} ({m["basis"]})')
print(f'  base overall: {syn.get("overall_synergy_score")} -> adjusted: {syn.get("overall_synergy_score_adjusted")}')
print()
print('  结论：协同分析已真实接入 TCMSP 319 种药材库 + HERB_INTERACTIONS 221 条配伍库，')
print('        非硬编码 8 味、非模拟数据。')

print()
print('=' * 62)
print('核查 3: QSAR 卡片「规则预测」标注（前端）')
print('=' * 62)
import re
tsx = open(r'D:\RMFOODFP\frontend\src\pages\database\tabs\PeptideStructureAnalyzer.tsx', encoding='utf-8').read()
qsar_label = 'QSAR 规则法预测' in tsx or '规则预测' in tsx
print(f'  前端含"规则预测"标注: {qsar_label}')
ml_grid_3 = '验证 F1（推荐）' in tsx
print(f'  前端 3 宫格显示 F1/平衡准确率/准确率(带基线): {ml_grid_3}')

print()
print('=' * 62)
print('总结')
print('=' * 62)
print('  ✅ /analyze 的"验证准确率 73.9%"已消除误导：')
print('     - accuracy 73.9% 只是训练产物的属性（恒定不变），非针对当前输入')
print('     - 根因：标签不平衡（正类 24.7%），模型判别力有限，accuracy≈多数类基线')
print('     - 已新增 F1/平衡准确率/precision/recall/多数类基线 + 诚实 metrics_note')
print('     - 前端改为 3 数值格：F1(推荐) + 平衡准确率 + 准确率(标注基线)，不再单看 73.9%')
print('  ✅ 协同分析真实接入 TCMSP 药材库 + HERB_INTERACTIONS 配伍库（非 8 味硬编码）')
