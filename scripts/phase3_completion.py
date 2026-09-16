# -*- coding: utf-8 -*-
"""
RMCHM 数据库完善方案执行 - 第三阶段
重点解决UsePart、Alias和化合物映射问题
"""
import json
import os
import re
from collections import defaultdict
from datetime import datetime

print("=" * 70)
print("  RMCHM 数据库补全 - 第三阶段")
print("=" * 70)

# ==================== 加载数据 ====================
with open(r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v312.json', 'r', encoding='utf-8') as f:
    rmchm_data = json.load(f)

with open(r'D:\RMFOODFP\data\SymMap\symmap_herbs.json', 'r', encoding='utf-8') as f:
    symmap_herbs = json.load(f)

# 加载SMHB
import openpyxl
wb = openpyxl.load_workbook(r'D:\RMFOODFP\data\SymMap\SymMap v2.0, SMHB file.xlsx', read_only=True)
ws = wb.active
smhb_rows = list(ws.iter_rows(values_only=True))
wb.close()

smhb_header = smhb_rows[0]
print(f"SMHB Header: {smhb_header}")

# Build SMHB by Chinese name (not ID) - store both dict and tuple
smhb_by_name = {}
for row in smhb_rows[1:]:
    d = dict(zip(smhb_header, row))
    if d.get('Chinese_name'):
        smhb_by_name[d['Chinese_name']] = {'dict': d, 'row': row}

print(f"SMHB by name: {len(smhb_by_name)}")

# Find UsePart and Alias column indices
usepart_col = None
alias_col = None
for i, h in enumerate(smhb_header):
    if h == 'UsePart':
        usepart_col = i
    if h == 'Alias':
        alias_col = i

print(f"UsePart column index: {usepart_col}")
print(f"Alias column index: {alias_col}")

# Build SymMap by ID
symmap_by_id = {str(h['Herb_id']): h for h in symmap_herbs}

# Check what fields SymMap JSON has
print(f"\nSymMap herb fields: {list(symmap_herbs[0].keys())}")
print(f"Has UsePart in SymMap JSON: {'UsePart' in symmap_herbs[0]}")
print(f"Has Alias in SymMap JSON: {'Alias' in symmap_herbs[0]}")

# Check if any SymMap herb has UsePart
symmap_with_up = sum(1 for h in symmap_herbs if h.get('UsePart'))
symmap_with_al = sum(1 for h in symmap_herbs if h.get('Alias'))
print(f"SymMap herbs with UsePart in JSON: {symmap_with_up}")
print(f"SymMap herbs with Alias in JSON: {symmap_with_al}")

total = len(rmchm_data)

# ==================== 修复UsePart ====================
print("\n" + "=" * 70)
print("  修复UsePart数据")
print("=" * 70)

up_fixed = 0
for d in rmchm_data:
    if d.get('use_part'):
        continue
    
    cn = d.get('name_cn', '')
    
    # 方法1: 直接通过中文名称匹配SMHB
    if cn in smhb_by_name:
        entry = smhb_by_name[cn]
        row = entry['row']
        if usepart_col is not None and row[usepart_col]:
            d['use_part'] = row[usepart_col]
            up_fixed += 1
            continue
    
    # 方法2: 通过symmap_id查找
    if d.get('symmap_id'):
        sid = str(d['symmap_id'])
        if sid in symmap_by_id:
            sym = symmap_by_id[sid]
            if sym.get('UsePart'):
                d['use_part'] = sym['UsePart']
                up_fixed += 1
                continue

print(f"  修复UsePart: {up_fixed} 条")

# ==================== 修复Alias ====================
print("\n" + "=" * 70)
print("  修复Alias数据")
print("=" * 70)

al_fixed = 0
for d in rmchm_data:
    if d.get('alias'):
        continue
    
    cn = d.get('name_cn', '')
    
    # 方法1: 直接通过中文名称匹配SMHB
    if cn in smhb_by_name:
        entry = smhb_by_name[cn]
        row = entry['row']
        if alias_col is not None and row[alias_col]:
            d['alias'] = row[alias_col]
            al_fixed += 1
            continue
    
    # 方法2: 通过symmap_id查找
    if d.get('symmap_id'):
        sid = str(d['symmap_id'])
        if sid in symmap_by_id:
            sym = symmap_by_id[sid]
            if sym.get('Alias'):
                d['alias'] = sym['Alias']
                al_fixed += 1
                continue

print(f"  修复Alias: {al_fixed} 条")

# ==================== 修复图片匹配 ====================
print("\n" + "=" * 70)
print("  修复图片匹配")
print("=" * 70)

fam_dir = r'D:\RMFOODFP\data\106FAM'
fam_images = {}
if os.path.exists(fam_dir):
    for f in os.listdir(fam_dir):
        if f.endswith('.jpg') or f.endswith('.png'):
            name = f.replace('.jpg', '').replace('.png', '')
            fam_images[name] = f'data/106FAM/{f}'

img_fixed = 0
for d in rmchm_data:
    if d.get('image_path'):
        continue
    
    cn = d.get('name_cn', '')
    
    # 精确匹配
    if cn in fam_images:
        d['image_path'] = fam_images[cn]
        d['image_source'] = '106FAM'
        img_fixed += 1
        continue
    
    # 模糊匹配：去掉括号
    cn_clean = re.sub(r'[（(].*?[）)]', '', cn).strip()
    if cn_clean in fam_images:
        d['image_path'] = fam_images[cn_clean]
        d['image_source'] = '106FAM'
        img_fixed += 1
        continue
    
    # 部分匹配
    for fam_name, img_path in fam_images.items():
        if fam_name in cn or cn in fam_name:
            d['image_path'] = img_path
            d['image_source'] = '106FAM'
            img_fixed += 1
            break

print(f"  修复图片: {img_fixed} 条")

# ==================== 计算质量评分 ====================
print("\n" + "=" * 70)
print("  计算质量评分")
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
output_path = r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v314.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(rmchm_data, f, ensure_ascii=False, indent=2)
print(f"\n  已保存: {output_path}")

# ==================== 验证结果 ====================
print("\n" + "=" * 70)
print("  验证补全结果")
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

print(f"\n{'字段':<12} {'缺失数':>8} {'覆盖率':>8} {'状态':>8}")
print("-" * 45)
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
    print(f"{label:<10} {missing:>8} {pct:6.1f}% {status:>8}")

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

print("\n" + "=" * 70)
print("  执行完成")
print("=" * 70)
