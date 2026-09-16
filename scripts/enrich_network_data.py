# -*- coding: utf-8 -*-
"""
RMCHM 数据库完善方案 - 化合物/靶点/疾病数据增强
"""
import json
import os
from collections import defaultdict
from datetime import datetime

print("=" * 70)
print("  RMCHM 数据库数据增强 - 化合物/靶点/疾病")
print("=" * 70)
print(f"执行时间: {datetime.utcnow().isoformat()}Z")

# ==================== 加载数据 ====================
print("\n[1] 加载数据源...")

with open(r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v316.json', 'r', encoding='utf-8') as f:
    rmchm_data = json.load(f)

with open(r'D:\RMFOODFP\data\SymMap\symmap_ingredients.json', 'r', encoding='utf-8') as f:
    symmap_compounds = json.load(f)
with open(r'D:\RMFOODFP\data\SymMap\symmap_targets.json', 'r', encoding='utf-8') as f:
    symmap_targets = json.load(f)
with open(r'D:\RMFOODFP\data\SymMap\symmap_mm_symptoms.json', 'r', encoding='utf-8') as f:
    symmap_diseases = json.load(f)

with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_ingredients.json', 'r', encoding='utf-8') as f:
    tcmsp_compounds = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_targets.json', 'r', encoding='utf-8') as f:
    tcmsp_targets = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_diseases.json', 'r', encoding='utf-8') as f:
    tcmsp_diseases = json.load(f)

# 加载SMIT映射
import openpyxl
wb = openpyxl.load_workbook(r'D:\RMFOODFP\data\SymMap\SymMap v2.0, SMIT file.xlsx', read_only=True)
ws = wb.active
smit_rows = list(ws.iter_rows(values_only=True))
wb.close()

smit_header = smit_rows[0]
# Link_ingredient_id 是 herb ID，Mol_id 是 compound ID
compound_to_herb = defaultdict(list)
for row in smit_rows[1:]:
    d = dict(zip(smit_header, row))
    link_id = d.get('Link_ingredient_id')
    mol_id = d.get('Mol_id')
    if link_id and mol_id:
        compound_to_herb[str(link_id)].append(str(mol_id))

print(f"  SMIT mappings: {len(compound_to_herb)} herbs with compounds")

# 构建化合物索引
symmap_compound_by_mol = {str(c['Mol_id']): c for c in symmap_compounds}
tcmsp_compound_by_mol = {c['MOL_ID']: c for c in tcmsp_compounds}

# 构建靶点索引
symmap_target_by_gene = {str(t['Gene_id']): t for t in symmap_targets}
tcmsp_target_by_id = {str(t['target_ID']): t for t in tcmsp_targets}

# 构建疾病索引
symmap_disease_by_id = {str(d['MM_symptom_id']): d for d in symmap_diseases}
tcmsp_disease_by_id = {str(d['disease_ID']): d for d in tcmsp_diseases}

total = len(rmchm_data)
print(f"\n数据源:")
print(f"  RMCHM: {total}")
print(f"  SymMap compounds: {len(symmap_compound_by_mol)}")
print(f"  SymMap targets: {len(symmap_target_by_gene)}")
print(f"  SymMap diseases: {len(symmap_disease_by_id)}")
print(f"  TCMSP compounds: {len(tcmsp_compound_by_mol)}")
print(f"  TCMSP targets: {len(tcmsp_target_by_id)}")
print(f"  TCMSP diseases: {len(tcmsp_disease_by_id)}")

# ==================== 数据增强 ====================
print("\n" + "=" * 70)
print("  [阶段1] 化合物数据增强")
print("=" * 70)

comp_enriched = 0
for d in rmchm_data:
    # 跳过已有化合物数据的药材
    if d.get('compounds') and len(d['compounds']) > 0:
        continue
    
    # 获取该药材的compound IDs
    mol_ids = []
    
    # 通过symmap_id查找
    if d.get('symmap_id'):
        sid = str(d['symmap_id'])
        if sid in compound_to_herb:
            mol_ids.extend(compound_to_herb[sid])
    
    # 通过tcmsp_id查找
    if d.get('tcmsp_id'):
        tid = str(d['tcmsp_id'])
        if tid in compound_to_herb:
            mol_ids.extend(compound_to_herb[tid])
    
    # 去重
    mol_ids = list(set(mol_ids))[:30]  # 限制最多30个化合物
    
    if not mol_ids:
        d['compounds'] = []
        d['compounds_count'] = 0
        continue
    
    # 获取化合物详细信息
    compounds = []
    for mid in mol_ids:
        # 优先从SymMap获取
        if mid in symmap_compound_by_mol:
            c = symmap_compound_by_mol[mid]
            compounds.append({
                'mol_id': mid,
                'name': c.get('Molecule_name', ''),
                'weight': c.get('Molecule_weight', ''),
                'ob': c.get('OB_score', ''),
                'cas': c.get('CAS_id', ''),
                'formula': c.get('Molecule_formula', ''),
                'source': 'SymMap'
            })
        # 从TCMSP获取
        elif mid in tcmsp_compound_by_mol:
            c = tcmsp_compound_by_mol[mid]
            compounds.append({
                'mol_id': mid,
                'name': c.get('molecule_name', ''),
                'weight': c.get('mw', ''),
                'ob': c.get('ob', ''),
                'dl': c.get('dl', ''),
                'source': 'TCMSP'
            })
    
    d['compounds'] = compounds
    d['compounds_count'] = len(compounds)
    
    if len(compounds) > 0:
        comp_enriched += 1

print(f"  化合物数据增强: {comp_enriched} 条药材")

# ==================== 靶点数据增强 ====================
print("\n" + "=" * 70)
print("  [阶段2] 靶点数据增强")
print("=" * 70)

# 建立化合物到靶点的映射（从TCMSP HTML解析或现有数据）
# 简化处理：直接使用SymMap靶点数据
target_enriched = 0
for d in rmchm_data:
    # 跳过已有靶点数据的药材
    if d.get('targets') and len(d['targets']) > 0:
        continue
    
    # 获取该药材的化合物IDs
    mol_ids = []
    if d.get('compounds'):
        mol_ids = [c.get('mol_id') for c in d['compounds']]
    
    # 简化：为有化合物的药材分配靶点
    # 实际应用中需要更复杂的映射
    targets = []
    d['targets'] = targets
    d['targets_count'] = 0

print(f"  靶点数据增强: 需进一步映射")

# ==================== 疾病数据增强 ====================
print("\n" + "=" * 70)
print("  [阶段3] 疾病数据增强")
print("=" * 70)

disease_enriched = 0
for d in rmchm_data:
    # 跳过已有疾病数据的药材
    if d.get('diseases') and len(d['diseases']) > 0:
        continue
    
    diseases = []
    d['diseases'] = diseases
    d['diseases_count'] = 0

print(f"  疾病数据增强: 需进一步映射")

# ==================== 计算质量评分 ====================
print("\n" + "=" * 70)
print("  [阶段4] 计算质量评分")
print("=" * 70)

for d in rmchm_data:
    score = 0.0
    
    # 基础信息 (15分)
    if d.get('name_eng'): score += 5
    if d.get('use_part'): score += 5
    if d.get('alias'): score += 2
    if d.get('image_path'): score += 3
    
    # 传统属性 (25分)
    if d.get('nature_cn'): score += 5
    if d.get('nature_eng'): score += 3
    if d.get('meridians_cn'): score += 5
    if d.get('meridians_eng'): score += 3
    if d.get('category_cn'): score += 4
    if d.get('category_eng'): score += 3
    if d.get('function_cn'): score += 2
    
    # 药理学数据 (40分)
    if d.get('ob_percent'): score += 10
    if d.get('dl_value'): score += 5
    if isinstance(d.get('compounds'), list) and len(d['compounds']) > 0:
        score += 10
    if isinstance(d.get('targets'), list) and len(d['targets']) > 0:
        score += 10
    if isinstance(d.get('diseases'), list) and len(d['diseases']) > 0:
        score += 5
    
    # 安全性 (20分)
    if d.get('is_toxic') is not None: score += 10
    if d.get('is_food_homology') is not None: score += 10
    
    d['data_quality_score'] = round(min(score, 100), 1)
    d['synced_at'] = datetime.utcnow().isoformat() + 'Z'

# ==================== 保存结果 ====================
output_path = r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v317.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(rmchm_data, f, ensure_ascii=False, indent=2)
print(f"\n  已保存: {output_path}")

# ==================== 验证结果 ====================
print("\n" + "=" * 70)
print("  最终验证报告")
print("=" * 70)

def count_missing(data, field):
    if isinstance(data[0].get(field), list):
        return sum(1 for d in data if not d.get(field) or len(d[field]) == 0)
    return sum(1 for d in data if not d.get(field))

fields = [
    ('name_eng', '英文名'),
    ('use_part', '药用部位'),
    ('alias', '别名'),
    ('is_toxic', '毒性'),
    ('image_path', '图片'),
    ('ob_percent', 'OB%'),
    ('compounds', '化合物'),
    ('targets', '靶点'),
    ('diseases', '疾病'),
]

print(f"\n字段覆盖率:")
print("-" * 50)
print(f"  {'字段':<12} {'缺失数':>8} {'覆盖率':>8} {'状态':>8}")
print("  " + "-" * 45)

improvements = {}
for field, label in fields:
    missing = count_missing(rmchm_data, field)
    filled = total - missing
    pct = filled / total * 100
    if pct >= 90:
        status = "优秀"
    elif pct >= 70:
        status = "良好"
    elif pct >= 50:
        status = "中等"
    else:
        status = "待加强"
    print(f"  {label:<10} {missing:>8} {pct:6.1f}% {status:>8}")
    improvements[field] = pct

# 毒性统计
toxic = [d['name_cn'] for d in rmchm_data if d.get('is_toxic')]
print(f"\n毒性药材: {len(toxic)}/{total} ({len(toxic)/total*100:.1f}%)")

# 图片统计
img = [d for d in rmchm_data if d.get('image_path')]
print(f"有图片药材: {len(img)}/{total} ({len(img)/total*100:.1f}%)")

# 质量评分分布
scores = [d.get('data_quality_score', 0) for d in rmchm_data]
excellent = sum(1 for s in scores if s >= 80)
good = sum(1 for s in scores if 60 <= s < 80)
fair = sum(1 for s in scores if 40 <= s < 60)
poor = sum(1 for s in scores if s < 40)

print(f"\n质量评分分布:")
print(f"  优秀(>=80): {excellent} ({excellent/total*100:.1f}%)")
print(f"  良好(60-80): {good} ({good/total*100:.1f}%)")
print(f"  中等(40-60): {fair} ({fair/total*100:.1f}%)")
print(f"  待加强(<40): {poor} ({poor/total*100:.1f}%)")

# 总体质量
avg_score = sum(scores) / len(scores)
print(f"\n平均质量评分: {avg_score:.1f}/100")

print("\n" + "=" * 70)
print("  完成")
print("=" * 70)
