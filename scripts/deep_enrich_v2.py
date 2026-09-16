# -*- coding: utf-8 -*-
"""
RMCHM 数据库完善方案 - 深度执行版
目标：突破数据瓶颈，提升关键指标
"""
import json
import os
import re
from collections import defaultdict
from datetime import datetime

print("=" * 70)
print("  RMCHM 数据库完善方案 - 深度执行")
print("=" * 70)
print(f"执行时间: {datetime.utcnow().isoformat()}Z")

# ==================== 加载数据 ====================
print("\n[1] 加载数据源...")

with open(r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v321.json', 'r', encoding='utf-8') as f:
    rmchm_data = json.load(f)

with open(r'D:\RMFOODFP\data\SymMap\symmap_herbs.json', 'r', encoding='utf-8') as f:
    symmap_herbs = json.load(f)
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

# 加载xlsx
import openpyxl

# SMHB
wb1 = openpyxl.load_workbook(r'D:\RMFOODFP\data\SymMap\SymMap v2.0, SMHB file.xlsx', read_only=True)
smhb_rows = list(wb1.active.iter_rows(values_only=True))
wb1.close()

# SMIT
wb2 = openpyxl.load_workbook(r'D:\RMFOODFP\data\SymMap\SymMap v2.0, SMIT file.xlsx', read_only=True)
smit_rows = list(wb2.active.iter_rows(values_only=True))
wb2.close()

# SMTT
wb3 = openpyxl.load_workbook(r'D:\RMFOODFP\data\SymMap\SymMap v2.0, SMTT file.xlsx', read_only=True)
smtt_rows = list(wb3.active.iter_rows(values_only=True))
wb3.close()

# 106FAM
fam_dir = r'D:\RMFOODFP\data\106FAM'
fam_images = {}
if os.path.exists(fam_dir):
    for f in os.listdir(fam_dir):
        if f.endswith('.jpg') or f.endswith('.png'):
            name = f.replace('.jpg', '').replace('.png', '')
            fam_images[name] = f'data/106FAM/{f}'

total = len(rmchm_data)
print(f"\n数据加载完成:")
print(f"  RMCHM: {total}")
print(f"  SymMap herbs: {len(symmap_herbs)}")
print(f"  SymMap compounds: {len(symmap_compounds)}")
print(f"  106FAM images: {len(fam_images)}")

# ==================== 构建查找表 ====================
print("\n[2] 构建查找表...")

symmap_by_id = {str(h['Herb_id']): h for h in symmap_herbs}
symmap_by_name = {h['Chinese_name']: h for h in symmap_herbs}
tcmsp_compound_by_mol = {c['MOL_ID']: c for c in tcmsp_compounds}
symmap_compound_by_mol = {str(c['Mol_id']): c for c in symmap_compounds}
symmap_target_by_gene = {str(t['Gene_id']): t for t in symmap_targets}
symmap_disease_by_id = {str(d['MM_symptom_id']): d for d in symmap_diseases}

# SMHB lookup
smhb_header = smhb_rows[0]
smhb_by_name = {}
smhb_by_id = {}
for row in smhb_rows[1:]:
    d = dict(zip(smhb_header, row))
    if d.get('Chinese_name'):
        smhb_by_name[d['Chinese_name']] = d
    if d.get('Herb_id'):
        smhb_by_id[str(d['Herb_id'])] = d

# SMIT mapping
compound_to_herb = defaultdict(list)
smit_header = smit_rows[0]
for row in smit_rows[1:]:
    d = dict(zip(smit_header, row))
    link_id = d.get('Link_ingredient_id')
    mol_id = d.get('Mol_id')
    if link_id and mol_id:
        compound_to_herb[str(link_id)].append(str(mol_id))

print(f"  SMHB by name: {len(smhb_by_name)}")
print(f"  Compound-herb mappings: {sum(len(v) for v in compound_to_herb.values())}")

# ==================== 记录初始状态 ====================
print("\n" + "=" * 70)
print("  [初始状态]")
print("=" * 70)

def count_missing(data, field):
    if isinstance(data[0].get(field), list):
        return sum(1 for d in data if not d.get(field) or len(d[field]) == 0)
    return sum(1 for d in data if not d.get(field))

initial_stats = {}
fields_check = ['name_eng', 'use_part', 'alias', 'is_toxic', 'image_path', 'compounds', 'targets', 'diseases']
for f in fields_check:
    missing = count_missing(rmchm_data, f)
    initial_stats[f] = missing
    filled = total - missing
    pct = filled / total * 100
    print(f"  {f}: {filled}/{total} ({pct:.1f}%)")

# ==================== 执行深度补全 ====================
print("\n" + "=" * 70)
print("  [阶段1] 深度数据补全")
print("=" * 70)

fix_stats = defaultdict(int)

# 1. 英文名补全
fixed = 0
for d in rmchm_data:
    if d.get('name_eng'):
        continue
    if d.get('symmap_id'):
        sym = symmap_by_id.get(str(d['symmap_id']))
        if sym and sym.get('English_name'):
            d['name_eng'] = sym['English_name']
            fixed += 1
            fix_stats['name_eng'] += 1
print(f"  name_eng: +{fixed}")

# 2. 药用部位补全 - 多策略
fixed = 0
for d in rmchm_data:
    if d.get('use_part'):
        continue
    cn = d.get('name_cn', '')
    
    # 策略1: SymMap JSON
    if d.get('symmap_id'):
        sym = symmap_by_id.get(str(d['symmap_id']))
        if sym and sym.get('UsePart'):
            d['use_part'] = sym['UsePart']
            fixed += 1
            fix_stats['use_part'] += 1
            continue
    
    # 策略2: SMHB by name
    if cn in smhb_by_name:
        sm = smhb_by_name[cn]
        if sm.get('UsePart'):
            d['use_part'] = sm['UsePart']
            fixed += 1
            fix_stats['use_part'] += 1
            continue
    
    # 策略3: SMHB by TCMSP ID
    if d.get('tcmsp_id'):
        sm = smhb_by_id.get(str(d['tcmsp_id']))
        if sm and sm.get('UsePart'):
            d['use_part'] = sm['UsePart']
            fixed += 1
            fix_stats['use_part'] += 1
            continue

print(f"  use_part: +{fixed}")

# 3. 别名补全 - 多策略
fixed = 0
for d in rmchm_data:
    if d.get('alias'):
        continue
    cn = d.get('name_cn', '')
    
    # 策略1: SymMap JSON
    if d.get('symmap_id'):
        sym = symmap_by_id.get(str(d['symmap_id']))
        if sym and sym.get('Alias'):
            d['alias'] = sym['Alias']
            fixed += 1
            fix_stats['alias'] += 1
            continue
    
    # 策略2: SMHB by name
    if cn in smhb_by_name:
        sm = smhb_by_name[cn]
        if sm.get('Alias'):
            d['alias'] = sm['Alias']
            fixed += 1
            fix_stats['alias'] += 1
            continue
    
    # 策略3: SMHB by TCMSP ID
    if d.get('tcmsp_id'):
        sm = smhb_by_id.get(str(d['tcmsp_id']))
        if sm and sm.get('Alias'):
            d['alias'] = sm['Alias']
            fixed += 1
            fix_stats['alias'] += 1
            continue

print(f"  alias: +{fixed}")

# 4. 毒性补全
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

# 5. 图片补全 - 增强匹配策略
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
    
    # 模糊匹配：去掉括号内容
    cn_clean = re.sub(r'[（(].*?[）)]', '', cn).strip()
    if cn_clean in fam_images:
        d['image_path'] = fam_images[cn_clean]
        d['image_source'] = '106FAM'
        fixed += 1
        fix_stats['image_path'] += 1
        continue
    
    # 去除常见后缀匹配
    cn_base = re.sub(r'(花|叶|果|根|茎|皮|仁|子|枝|苗|草|茶|片|粉)$', '', cn)
    if cn_base in fam_images:
        d['image_path'] = fam_images[cn_base]
        d['image_source'] = '106FAM'
        fixed += 1
        fix_stats['image_path'] += 1
        continue
    
    # 部分匹配
    for fam_name, img_path in fam_images.items():
        if len(fam_name) >= 2 and (fam_name in cn or cn in fam_name):
            d['image_path'] = img_path
            d['image_source'] = '106FAM'
            fixed += 1
            fix_stats['image_path'] += 1
            break

print(f"  image_path: +{fixed}")

print("\n" + "=" * 70)
print("  [阶段2] 网络药理学数据增强")
print("=" * 70)

# 6. 化合物数据增强
comp_enriched = 0
for d in rmchm_data:
    mol_ids = set()
    
    # 通过symmap_id获取
    if d.get('symmap_id'):
        sid = str(d['symmap_id'])
        if sid in compound_to_herb:
            mol_ids.update(compound_to_herb[sid])
    
    # 通过tcmsp_id获取
    if d.get('tcmsp_id'):
        tid = str(d['tcmsp_id'])
        if tid in compound_to_herb:
            mol_ids.update(compound_to_herb[tid])
    
    mol_ids = list(mol_ids)[:50]
    
    if not mol_ids:
        if not d.get('compounds'):
            d['compounds'] = []
            d['compounds_count'] = 0
        continue
    
    # 获取化合物详细信息
    compounds = []
    seen_mols = set()
    
    # 先添加已有化合物
    if d.get('compounds'):
        for c in d['compounds']:
            mid = c.get('mol_id', '')
            if mid and mid not in seen_mols:
                compounds.append(c)
                seen_mols.add(mid)
    
    # 添加新化合物
    for mid in mol_ids:
        if mid in seen_mols:
            continue
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
            seen_mols.add(mid)
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
            seen_mols.add(mid)
    
    d['compounds'] = compounds
    d['compounds_count'] = len(compounds)
    
    if len(compounds) > 0:
        comp_enriched += 1

print(f"  compounds enriched: {comp_enriched}")

# 7. 靶点数据增强 - 尝试建立化合物-靶点关联
target_enriched = 0
# 建立MOL_ID到gene_id的映射（简化：通过化合物名称模糊匹配）
for d in rmchm_data:
    if d.get('targets') and len(d['targets']) > 0:
        continue
    
    targets = []
    
    # 简化处理：为有化合物的药材分配示例靶点
    # 实际应用中需要完整的化合物-靶点映射数据
    if d.get('compounds') and len(d['compounds']) > 0:
        # 这里使用SymMap靶点数据作为示例填充
        # 实际应该根据化合物ID查找对应靶点
        pass
    
    d['targets'] = targets
    d['targets_count'] = len(targets)

print(f"  targets: 需完整映射数据")

# 8. 疾病数据增强
disease_enriched = 0
for d in rmchm_data:
    if d.get('diseases') and len(d['diseases']) > 0:
        continue
    
    diseases = []
    d['diseases'] = diseases
    d['diseases_count'] = len(diseases)

print(f"  diseases: 需完整映射数据")

# ==================== 计算质量评分 ====================
print("\n" + "=" * 70)
print("  [阶段3] 计算质量评分")
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
output_path = r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v322.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(rmchm_data, f, ensure_ascii=False, indent=2)
print(f"\n  已保存: {output_path}")

# ==================== 生成最终报告 ====================
print("\n" + "=" * 70)
print("  最终验证报告")
print("=" * 70)

fields_report = [
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

print(f"\n字段覆盖率对比:")
print("-" * 65)
print(f"  {'字段':<12} {'初始缺失':>10} {'当前缺失':>10} {'覆盖率':>8} {'改善':>8} {'状态':>8}")
print("  " + "-" * 60)

for field, label in fields_report:
    missing_init = initial_stats.get(field, count_missing(rmchm_data, field))
    missing_curr = count_missing(rmchm_data, field)
    filled = total - missing_curr
    pct = filled / total * 100
    improvement = missing_init - missing_curr
    
    if pct >= 90:
        status = "优秀"
    elif pct >= 70:
        status = "良好"
    elif pct >= 50:
        status = "中等"
    else:
        status = "待加强"
    
    print(f"  {label:<10} {missing_init:>10} {missing_curr:>10} {pct:6.1f}% {improvement:>+8} {status:>8}")

# 毒性统计
toxic = [d['name_cn'] for d in rmchm_data if d.get('is_toxic')]
print(f"\n毒性药材: {len(toxic)}/{total} ({len(toxic)/total*100:.1f}%)")

# 图片统计
img = [d for d in rmchm_data if d.get('image_path')]
print(f"有图片药材: {len(img)}/{total} ({len(img)/total*100:.1f}%)")

# 化合物统计
comp = [d for d in rmchm_data if d.get('compounds') and len(d['compounds']) > 0]
print(f"有化合物药材: {len(comp)}/{total} ({len(comp)/total*100:.1f}%)")

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

avg_score = sum(scores) / len(scores)
print(f"\n平均质量评分: {avg_score:.1f}/100")

print("\n" + "=" * 70)
print("  完成")
print("=" * 70)
