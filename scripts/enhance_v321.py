# -*- coding: utf-8 -*-
"""
RMCHM 数据补全 - 恢复并增强
基于v321（已有完整数据）进行增强
"""
import json
import openpyxl
import os
import re
from collections import defaultdict
from datetime import datetime

print("=" * 70)
print("  RMCHM 数据补全增强执行")
print("=" * 70)

# 加载v321（已有完整基础数据）
with open(r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v321.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 加载SymMap数据
with open(r'D:\RMFOODFP\data\SymMap\symmap_herbs.json', 'r', encoding='utf-8') as f:
    symmap_herbs = json.load(f)

# 加载SMHB
wb = openpyxl.load_workbook(r'D:\RMFOODFP\data\SymMap\SymMap v2.0, SMHB file.xlsx', read_only=True)
smhb_rows = list(wb.active.iter_rows(values_only=True))
wb.close()

smhb_header = smhb_rows[0]
smhb_by_name = {}
smhb_by_id = {}
for row in smhb_rows[1:]:
    d = dict(zip(smhb_header, row))
    if d.get('Chinese_name'):
        smhb_by_name[d['Chinese_name']] = d
    if d.get('Herb_id'):
        smhb_by_id[str(d['Herb_id'])] = d

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

total = len(data)
print(f"\n数据加载: RMCHM={total}, SymMap={len(symmap_by_id)}, SMHB={len(smhb_by_name)}")

# 记录初始状态
initial = {}
for field in ['name_eng', 'use_part', 'alias', 'is_toxic', 'image_path']:
    if isinstance(data[0].get(field), list):
        initial[field] = sum(1 for d in data if not d.get(field) or len(d[field]) == 0)
    else:
        initial[field] = sum(1 for d in data if not d.get(field))

print("\n初始状态:")
for k, v in initial.items():
    print(f"  {k}: {v}/{total} missing ({(total-v)/total*100:.1f}% filled)")

# ========== 执行补全 ==========
print("\n" + "=" * 70)
print("  执行补全")
print("=" * 70)

# 1. use_part补全 - SMHB优先
fixed = 0
for d in data:
    if d.get('use_part'):
        continue
    cn = d.get('name_cn', '')
    
    # SMHB by name
    if cn in smhb_by_name:
        sm = smhb_by_name[cn]
        up = sm.get('UsePart')
        if up:
            d['use_part'] = up
            fixed += 1
            continue
    
    # SymMap by ID
    sid = str(d.get('symmap_id', ''))
    if sid in symmap_by_id:
        sym = symmap_by_id[sid]
        up = sym.get('UsePart')
        if up:
            d['use_part'] = up
            fixed += 1

print(f"use_part: +{fixed}")

# 2. alias补全 - SMHB
fixed = 0
for d in data:
    if d.get('alias'):
        continue
    cn = d.get('name_cn', '')
    
    # SMHB by name
    if cn in smhb_by_name:
        sm = smhb_by_name[cn]
        al = sm.get('Alias')
        if al:
            d['alias'] = al
            fixed += 1
            continue
    
    # SymMap by ID
    sid = str(d.get('symmap_id', ''))
    if sid in symmap_by_id:
        sym = symmap_by_id[sid]
        al = sym.get('Alias')
        if al:
            d['alias'] = al
            fixed += 1

print(f"alias: +{fixed}")

# 3. image_path补全 - 增强匹配
fixed = 0
for d in data:
    if d.get('image_path'):
        continue
    cn = d.get('name_cn', '')
    
    # 精确匹配
    if cn in fam_images:
        d['image_path'] = fam_images[cn]
        d['image_source'] = '106FAM'
        fixed += 1
        continue
    
    # 去掉括号
    cn_clean = re.sub(r'[（(].*?[）)]', '', cn).strip()
    if cn_clean in fam_images:
        d['image_path'] = fam_images[cn_clean]
        d['image_source'] = '106FAM'
        fixed += 1
        continue
    
    # 去掉后缀
    cn_base = re.sub(r'(花|叶|果|根|茎|皮|仁|子|枝|苗|草|茶|片|粉)$', '', cn)
    if cn_base in fam_images:
        d['image_path'] = fam_images[cn_base]
        d['image_source'] = '106FAM'
        fixed += 1
        continue
    
    # 部分匹配
    for fn, fp in fam_images.items():
        if len(fn) >= 2 and (fn in cn or cn in fn):
            d['image_path'] = fp
            d['image_source'] = '106FAM'
            fixed += 1
            break

print(f"image_path: +{fixed}")

# 计算质量评分
for d in data:
    score = 0.0
    if d.get('name_eng'): score += 5
    if d.get('use_part'): score += 5
    if d.get('alias'): score += 2
    if d.get('image_path'): score += 3
    if d.get('nature_cn'): score += 5
    if d.get('meridians_cn'): score += 5
    if d.get('category_cn'): score += 4
    if d.get('ob_percent'): score += 10
    if d.get('dl_value'): score += 5
    if isinstance(d.get('compounds'), list) and len(d['compounds']) > 0:
        score += 10
    if d.get('is_toxic') is not None: score += 10
    if d.get('is_food_homology') is not None: score += 10
    d['data_quality_score'] = round(min(score, 100), 1)
    d['synced_at'] = datetime.utcnow().isoformat() + 'Z'

# 保存
out = r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v324.json'
with open(out, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f"\n已保存: {out}")

# 验证
print("\n" + "=" * 70)
print("  最终验证")
print("=" * 70)

for field in ['name_eng', 'use_part', 'alias', 'is_toxic', 'image_path', 'compounds']:
    if isinstance(data[0].get(field), list):
        has = sum(1 for d in data if isinstance(d.get(field), list) and len(d[field]) > 0)
    else:
        has = sum(1 for d in data if d.get(field))
    pct = has / total * 100
    init_missing = initial.get(field, 0)
    curr_missing = total - has
    improvement = init_missing - curr_missing
    print(f"{field}: {has}/{total} ({pct:.1f}%) 改善+{improvement}")

toxic = sum(1 for d in data if d.get('is_toxic'))
img = sum(1 for d in data if d.get('image_path'))
comp = sum(1 for d in data if isinstance(d.get('compounds'), list) and len(d['compounds']) > 0)
print(f"\n毒性: {toxic}, 图片: {img}, 化合物: {comp}")

scores = [d.get('data_quality_score', 0) for d in data]
avg = sum(scores) / len(scores)
exc = sum(1 for s in scores if s >= 80)
print(f"平均质量分: {avg:.1f}, 优秀: {exc}/{total}")
print("=" * 70)
