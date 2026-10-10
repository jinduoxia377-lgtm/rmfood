# -*- coding: utf-8 -*-
"""核查前端各 Tab 字段使用 vs 后端真实返回"""
import io, re

P = r'D:\RMFOODFP\frontend\src\pages\database\tabs\PeptideStructureAnalyzer.tsx'
src = io.open(P, encoding='utf-8').read()

print("=" * 70)
print("1. 完整分析 Tab（AnalyzeView）使用的 /analyze 字段")
print("=" * 70)
# 截取 AnalyzeView 区域（搜分子结果渲染部分）
for pat in ['result.dpp4_inhibition', 'result.taste', 'result.source',
            'result.isoelectric_point', 'result.hydrophobicity',
            'result.ace_inhibition', 'result.antioxidant', 'result.antimicrobial']:
    hits = [m.start() for m in re.finditer(re.escape(pat), src)]
    print(f"  {pat}: {len(hits)} 处引用")

print()
print("=" * 70)
print("2. 完整分析 Tab 是否渲染 taste/dpp4/source")
print("=" * 70)
# 找 taste 相关渲染
for kw in ['taste', 'dpp4', 'bitterness', 'umami']:
    idx = src.find(kw)
    print(f"  '{kw}' 首次出现位置: {idx}")

print()
print("=" * 70)
print("3. 历史 Tab 后端实际返回字段（已知 items keys）")
print("=" * 70)
print("  items[0] keys: id, sequence, molecular_weight, food_safety_score,")
print("    ace_inhibition_score, antioxidant_score, antimicrobial_score,")
print("    is_allergen, is_toxic, digestibility, created_at")

# 找历史 Tab 渲染
m = re.search(r"function HistoryView\(\).*?\n\}", src, re.DOTALL)
if m:
    hist = m.group(0)
    print("\n  HistoryView 使用的字段:")
    for pat in ['molecular_weight', 'food_safety_score', 'ace_inhibition_score',
                'antioxidant_score', 'antimicrobial_score', 'is_allergen',
                'is_toxic', 'digestibility', 'analysis_mode', 'tags', 'notes']:
        c = hist.count(pat)
        print(f"    {pat}: {c} 处")

print()
print("=" * 70)
print("4. 后端 _serialize_history_item 实际输出字段（grep 后端）")
print("=" * 70)
B = r'D:\RMFOODFP\backend\app\api\peptide_structure_routes.py'
bsrc = io.open(B, encoding='utf-8').read()
m = re.search(r"def _serialize_history_item.*?(?=\n@router|\ndef )", bsrc, re.DOTALL)
if m:
    blk = m.group(0)
    # 抽取 dict key
    keys = re.findall(r"['\"]([a-z_]+)['\"]\s*:", blk)
    print("  _serialize_history_item 输出 keys:", keys)
    print("\n  代码片段:")
    print(blk[:1500])
