# -*- coding: utf-8 -*-
"""
使用SymMap完整数据补全RMCHM
"""
import json
import os
import re
from collections import defaultdict
from datetime import datetime

print("=" * 70)
print("  RMCHM 数据库全面补全 - 最终执行")
print("=" * 70)
print(f"执行时间: {datetime.utcnow().isoformat()}Z")

# ==================== 加载所有数据 ====================
print("\n[1] 加载数据源...")

with open(r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v312.json', 'r', encoding='utf-8') as f:
    rmchm_data = json.load(f)

with open(r'D:\RMFOODFP\data\SymMap\symmap_herbs.json', 'r', encoding='utf-8') as f:
    symmap_herbs = json.load(f)
with open(r'D:\RMFOODFP\data\SymMap\symmap_ingredients.json', 'r', encoding='utf-8') as f:
    symmap_compounds = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_ingredients.json', 'r', encoding='utf-8') as f:
    tcmsp_compounds = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_targets.json', 'r', encoding='utf-8') as f:
    tcmsp_targets = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_diseases.json', 'r', encoding='utf-8') as f:
    tcmsp_diseases = json.load(f)

# 加载SMHB xlsx获取UsePart和Alias
import openpyxl
wb = openpyxl.load_workbook(r'D:\RMFOODFP\data\SymMap\SymMap v2.0, SMHB file.xlsx', read_only=True)
ws = wb.active
smhb_rows = list(ws.iter_rows(values_only=True))
wb.close()

smhb_header = smhb_rows[0]
smhb_by_id = {}
for row in smhb_rows[1:]:
    d = dict(zip(smhb_header, row))
    if d.get('Herb_id'):
        smhb_by_id[str(d['Herb_id'])] = d

# 加载SymMap IT xlsx获取化合物-药材映射
wb2 = openpyxl.load_workbook(r'D:\RMFOODFP\data\SymMap\SymMap v2.0, SMIT file.xlsx', read_only=True)
ws2 = wb2.active
smit_rows = list(ws2.iter_rows(values_only=True))
wb2.close()

smit_header = smit_rows[0]
# SMIT: Mol_id, Molecule_name, PubChem_CID, Molecule_structure, Molecule_formula, Molecule_weight, OB_score, CAS_id, TCMID_id, TCM-ID_id, TCMSP_id, Version, Type, Link_ingredient_id, Suppress
print(f"SMIT header: {smit_header}")

# 建立compound到herb的映射 (通过Link_ingredient_id)
compound_to_herb = defaultdict(list)
for row in smit_rows[1:]:
    d = dict(zip(smit_header, row))
    link_id = d.get('Link_ingredient_id')
    mol_id = d.get('Mol_id')
    if link_id and mol_id:
        compound_to_herb[str(link_id)].append(str(mol_id))

print(f"SMIT compound-herb mappings: {len(compound_to_herb)} herbs with compounds")

# 加载106FAM图片
fam_dir = r'D:\RMFOODFP\data\106FAM'
fam_images = {}
if os.path.exists(fam_dir):
    for f in os.listdir(fam_dir):
        if f.endswith('.jpg') or f.endswith('.png'):
            name = f.replace('.jpg', '').replace('.png', '')
            fam_images[name] = f'data/106FAM/{f}'

# 构建查找表
symmap_by_id = {str(h['Herb_id']): h for h in symmap_herbs}
tcmsp_compound_by_mol = {c['MOL_ID']: c for c in tcmsp_compounds}

total = len(rmchm_data)
print(f"\n数据源统计:")
print(f"  RMCHM: {total}")
print(f"  SymMap herbs: {len(symmap_by_id)}")
print(f"  SMHB: {len(smhb_by_id)}")
print(f"  SMIT mappings: {sum(len(v) for v in compound_to_herb.values())} compounds")
print(f"  106FAM: {len(fam_images)}")

# ==================== 数据补全 ====================
print("\n" + "=" * 70)
print("  [阶段1] 名称与属性补全")
print("=" * 70)

fix_stats = defaultdict(int)

# 1. name_eng - 从SymMap JSON获取
fixed = 0
for d in rmchm_data:
    if not d.get('name_eng') and d.get('symmap_id'):
        sym = symmap_by_id.get(str(d['symmap_id']))
        if sym and sym.get('English_name'):
            d['name_eng'] = sym['English_name']
            fixed += 1
            fix_stats['name_eng'] += 1
print(f"  name_eng: +{fixed}")

# 2. use_part - 从SymMap JSON和SMHB获取
fixed = 0
for d in rmchm_data:
    if d.get('use_part'):
        continue
    cn = d.get('name_cn', '')
    
    # 方法1: 通过symmap_id从SymMap JSON获取
    if d.get('symmap_id'):
        sym = symmap_by_id.get(str(d['symmap_id']))
        if sym and sym.get('UsePart'):
            d['use_part'] = sym['UsePart']
            fixed += 1
            fix_stats['use_part'] += 1
            continue
    
    # 方法2: 通过TCMSP_id从SMHB获取
    if d.get('tcmsp_id'):
        sm = smhb_by_id.get(str(d['tcmsp_id']))
        if sm and sm.get('UsePart'):
            d['use_part'] = sm['UsePart']
            fixed += 1
            fix_stats['use_part'] += 1
            continue

print(f"  use_part: +{fixed}")

# 3. alias - 从SymMap JSON和SMHB获取
fixed = 0
for d in rmchm_data:
    if d.get('alias'):
        continue
    cn = d.get('name_cn', '')
    
    # 方法1: 通过symmap_id从SymMap JSON获取
    if d.get('symmap_id'):
        sym = symmap_by_id.get(str(d['symmap_id']))
        if sym and sym.get('Alias'):
            d['alias'] = sym['Alias']
            fixed += 1
            fix_stats['alias'] += 1
            continue
    
    # 方法2: 通过TCMSP_id从SMHB获取
    if d.get('tcmsp_id'):
        sm = smhb_by_id.get(str(d['tcmsp_id']))
        if sm and sm.get('Alias'):
            d['alias'] = sm['Alias']
            fixed += 1
            fix_stats['alias'] += 1
            continue

print(f"  alias: +{fixed}")

# 4. is_toxic - 从SymMap Properties解析
fixed = 0
for d in rmchm_data:
    if d.get('is_toxic'):
        continue
    sid = str(d.get('symmap_id', ''))
    if sid in symmap_by_id:
        props = symmap_by_id[sid].get('Properties_Chinese', '')
        if '毒' in props:
            d['is_toxic'] = True
            fixed += 1
            fix_stats['is_toxic'] += 1
print(f"  is_toxic: +{fixed}")

print("\n" + "=" * 70)
print("  [阶段2] 图片资源补全")
print("=" * 70)

# 5. image_path - 从106FAM匹配
fixed = 0
for d in rmchm_data:
    if d.get('image_path'):
        continue
    cn = d.get('name_cn', '')
    
    # 精确匹配
    if cn in fam_images:
        d['image_path'] = fam_images[cn]
        d['image_source'] = '106FAM'
        fixed += 1
        fix_stats['image_path'] += 1
        continue
    
    # 模糊匹配：去掉括号
    cn_clean = re.sub(r'[（(].*?[）)]', '', cn).strip()
    if cn_clean in fam_images:
        d['image_path'] = fam_images[cn_clean]
        d['image_source'] = '106FAM'
        fixed += 1
        fix_stats['image_path'] += 1
        continue
    
    # 部分匹配
    for fam_name, img_path in fam_images.items():
        if fam_name in cn or cn in fam_name:
            d['image_path'] = img_path
            d['image_source'] = '106FAM'
            fixed += 1
            fix_stats['image_path'] += 1
            break

print(f"  image_path: +{fixed}")

print("\n" + "=" * 70)
print("  [阶段3] 网络药理学数据增强")
print("=" * 70)

# 6. 通过SymMap SMIT映射补充化合物数据
comp_enriched = 0
for d in rmchm_data:
    # 获取该药材的compound IDs
    mol_ids = []
    
    # 方法1: 通过symmap_id查找
    if d.get('symmap_id'):
        sid = str(d['symmap_id'])
        if sid in compound_to_herb:
            mol_ids.extend(compound_to_herb[sid])
    
    # 方法2: 通过tcmsp_id查找
    if d.get('tcmsp_id'):
        tid = str(d['tcmsp_id'])
        if tid in compound_to_herb:
            mol_ids.extend(compound_to_herb[tid])
    
    # 去重
    mol_ids = list(set(mol_ids))
    
    # 如果已有化合物数据，跳过
    if d.get('compounds') and len(d['compounds']) > 0:
        continue
    
    # 补充化合物数据
    compounds = []
    for mid in mol_ids[:20]:  # 限制每个药材最多20个化合物
        # 先尝试从SymMap化合物数据获取
        for c in symmap_compounds:
            if str(c.get('Mol_id')) == mid:
                compounds.append({
                    'mol_id': mid,
                    'name': c.get('Molecule_name', ''),
                    'weight': c.get('Molecule_weight', ''),
                    'ob': c.get('OB_score', ''),
                    'cas': c.get('CAS_id', ''),
                    'source': 'SymMap'
                })
                break
        
        # 如果SymMap没有，尝试TCMSP
        if len(compounds) <= len(mol_ids) - 1:
            for c in tcmsp_compounds:
                if c.get('MOL_ID') == mid:
                    compounds.append({
                        'mol_id': mid,
                        'name': c.get('molecule_name', ''),
                        'weight': c.get('mw', ''),
                        'ob': c.get('ob', ''),
                        'dl': c.get('dl', ''),
                        'source': 'TCMSP'
                    })
                    break
    
    d['compounds'] = compounds
    d['compounds_count'] = len(compounds)
    
    if len(compounds) > 0:
        comp_enriched += 1

print(f"  compounds enriched: {comp_enriched}")

# 7. 补充靶点和疾病数据
target_enriched = 0
disease_enriched = 0

for d in rmchm_data:
    # 简化处理：通过化合物ID获取靶点
    # 这里需要更复杂的映射逻辑
    pass
    # 计算质量评分时再处理

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
output_path = r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v316.json'
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

# 补全统计
print(f"\n本次补全统计:")
for k, v in sorted(fix_stats.items(), key=lambda x: -x[1]):
    print(f"  {k}: +{v}")

print("\n" + "=" * 70)
print("  完成")
print("=" * 70)
