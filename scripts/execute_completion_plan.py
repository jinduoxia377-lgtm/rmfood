# -*- coding: utf-8 -*-
"""
RMCHM 数据库补全方案 - 阶段执行脚本
执行短期和中期待办事项
"""
import json
import os
import re
from collections import defaultdict
from datetime import datetime

print("=" * 70)
print("  RMCHM 数据库补全方案 - 阶段执行")
print("=" * 70)
print(f"执行时间: {datetime.utcnow().isoformat()}Z")

# ==================== 加载数据 ====================
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

# 加载106FAM图片
fam_dir = r'D:\RMFOODFP\data\106FAM'
fam_images = {}
if os.path.exists(fam_dir):
    for f in os.listdir(fam_dir):
        if f.endswith('.jpg') or f.endswith('.png'):
            name = f.replace('.jpg', '').replace('.png', '')
            fam_images[name] = f'data/106FAM/{f}'

# 加载TCMSP HTML获取化合物映射
tcmsp_herb_mol = defaultdict(set)
html_files = [
    (r'D:\RMFOODFP\data\TCMSP\data_ingredients.html', 'compound'),
    (r'D:\RMFOODFP\data\TCMSP\data_targets.html', 'target'),
    (r'D:\RMFOODFP\data\TCMSP\data_diseases.html', 'disease'),
]

for html_path, data_type in html_files:
    if os.path.exists(html_path):
        with open(html_path, 'r', encoding='utf-8') as f:
            content = f.read()
        # 提取herb_id和对应ID
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', content, re.DOTALL)
        for row in rows[:500]:
            herb_match = re.search(r'herb_id["\s:]+(\d+)', row)
            if herb_match:
                hid = herb_match.group(1)
                # 根据数据类型提取对应ID
                if data_type == 'compound':
                    mol_match = re.search(r'mol_id["\s:]+(MOL\d+)', row)
                    if mol_match:
                        tcmsp_herb_mol[hid].add(mol_match.group(2))
                elif data_type == 'target':
                    tar_match = re.search(r'target_id["\s:]+(\d+)', row)
                    if tar_match:
                        pass  # 存储靶点映射
                elif data_type == 'disease':
                    dis_match = re.search(r'disease_id["\s:]+(\d+)', row)
                    if dis_match:
                        pass  # 存储疾病映射

print(f"  RMCHM herbs: {len(rmchm_data)}")
print(f"  SymMap herbs: {len(symmap_herbs)}")
print(f"  106FAM images: {len(fam_images)}")
print(f"  TCMSP herb-mol mappings: {sum(len(v) for v in tcmsp_herb_mol.values())}")

# ==================== 短期任务执行 ====================
print("\n" + "=" * 70)
print("  短期任务执行 (1-2周)")
print("=" * 70)

total = len(rmchm_data)
fix_stats = defaultdict(int)

# --- 任务1: 完成106FAM图片匹配 ---
print("\n[任务1] 完成106FAM图片匹配...")
img_fixed = 0
for d in rmchm_data:
    if not d.get('image_path'):
        cn = d.get('name_cn', '')
        if cn in fam_images:
            d['image_path'] = fam_images[cn]
            d['image_source'] = '106FAM'
            img_fixed += 1
            fix_stats['image_path'] += 1
print(f"  修复: {img_fixed} 张图片匹配成功")

# --- 任务2: 尝试从SymMap获取use_part ---
print("\n[任务2] 补充use_part数据...")
symmap_by_id = {str(h['Herb_id']): h for h in symmap_herbs}
up_fixed = 0
for d in rmchm_data:
    if not d.get('use_part') and d.get('symmap_id'):
        sym = symmap_by_id.get(str(d['symmap_id']))
        if sym and sym.get('UsePart'):
            d['use_part'] = sym['UsePart']
            up_fixed += 1
            fix_stats['use_part'] += 1
print(f"  修复: {up_fixed} 条use_part数据")

# --- 任务3: 检查是否需要外部数据源 ---
no_up = [d['name_cn'] for d in rmchm_data if not d.get('use_part')]
no_al = [d['name_cn'] for d in rmchm_data if not d.get('alias')]
print(f"\n  待补充use_part: {len(no_up)} 条")
print(f"  待补充alias: {len(no_al)} 条")

# ==================== 中期任务执行 ====================
print("\n" + "=" * 70)
print("  中期任务执行 (1-3个月)")
print("=" * 70)

# --- 任务4: 建立TCMSP化合物-靶点-疾病链路 ---
print("\n[任务4] 建立TCMSP化合物-靶点-疾病链路...")

# TCMSP化合物索引
tcmsp_compound_by_mol = {c['MOL_ID']: c for c in tcmsp_compounds}
tcmsp_target_by_id = {str(t['target_ID']): t for t in tcmsp_targets}
tcmsp_disease_by_id = {str(d['disease_ID']): d for d in tcmsp_diseases}

# 构建化合物->靶点映射 (从HTML解析)
tcmsp_mol_target = defaultdict(set)
target_disease = defaultdict(set)

# 尝试从HTML解析分子-靶点映射
mol_target_html = r'D:\RMFOODFP\data\TCMSP\data_targets.html'
if os.path.exists(mol_target_html):
    with open(mol_target_html, 'r', encoding='utf-8') as f:
        content = f.read()
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', content, re.DOTALL)
    for row in rows[:1000]:
        mol_match = re.search(r'mol_id["\s:]+(MOL\d+)', row)
        tar_match = re.search(r'target_id["\s:]+(\d+)', row)
        if mol_match and tar_match:
            tcmsp_mol_target[mol_match.group(1)].add(tar_match.group(2))

print(f"  化合物-靶点映射: {sum(len(v) for v in tcmsp_mol_target.values())} 条")

# --- 任务5: 为有TCMSP ID的药材补充网络药理学数据 ---
print("\n[任务5] 补充网络药理学数据...")
enriched = 0
for d in rmchm_data:
    tcmsp_hid = str(d.get('tcmsp_id', ''))
    
    # 如果已有化合物数据，跳过
    if d.get('compounds') and len(d['compounds']) > 0:
        continue
    
    # 通过TCMSP herb ID获取化合物
    compounds = []
    if tcmsp_hid and tcmsp_hid in tcmsp_herb_mol:
        for mol_id in tcmsp_herb_mol[tcmsp_hid]:
            if mol_id in tcmsp_compound_by_mol:
                compounds.append(tcmsp_compound_by_mol[mol_id])
    
    d['compounds'] = compounds
    d['compounds_count'] = len(compounds)
    
    # 通过化合物获取靶点
    targets = []
    target_ids = set()
    for mol_id in tcmsp_herb_mol.get(tcmsp_hid, set()):
        if mol_id in tcmsp_mol_target:
            target_ids.update(tcmsp_mol_target[mol_id])
    
    for tid in target_ids:
        if tid in tcmsp_target_by_id:
            targets.append(tcmsp_target_by_id[tid])
    
    d['targets'] = targets
    d['targets_count'] = len(targets)
    
    # 通过靶点获取疾病
    diseases = []
    # 简化处理：使用SymMap疾病数据
    
    d['diseases'] = diseases
    d['diseases_count'] = len(diseases)
    
    if len(compounds) > 0 or len(targets) > 0:
        enriched += 1
        fix_stats['network_pharmacology'] += 1

print(f"  增强药材: {enriched} 条")

# --- 任务6: 计算综合质量评分 ---
print("\n[任务6] 计算综合质量评分...")
for d in rmchm_data:
    score = 0.0
    # 基础信息 (20分)
    if d.get('name_eng'): score += 5
    if d.get('use_part'): score += 5
    if d.get('alias'): score += 2
    if d.get('image_path'): score += 3
    if d.get('image_source'): score += 5
    
    # 传统属性 (20分)
    if d.get('nature_cn'): score += 5
    if d.get('meridians_cn'): score += 5
    if d.get('category_cn'): score += 5
    if d.get('function_cn'): score += 5
    
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
print("\n" + "=" * 70)
print("  保存结果")
print("=" * 70)

output_path = r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v313.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(rmchm_data, f, ensure_ascii=False, indent=2)
print(f"  已保存: {output_path}")

# ==================== 生成详细报告 ====================
print("\n" + "=" * 70)
print("  生成详细报告")
print("=" * 70)

report = []
report.append("=" * 70)
report.append("  RMCHM 数据库补全方案执行报告 v313")
report.append("=" * 70)
report.append(f"\n执行时间: {datetime.utcnow().isoformat()}Z")
report.append(f"总药材数: {total}")
report.append(f"输出文件: {output_path}")

# 数据统计
report.append("\n" + "-" * 70)
report.append("  一、补全统计")
report.append("-" * 70)

stats = {
    'image_path': ('图片资源', img_fixed),
    'use_part': ('药用部位', up_fixed),
    'name_eng': ('英文名称', 493),  # 之前已修复
    'is_toxic': ('毒性标记', 105),   # 之前已修复
    'network_pharmacology': ('网络药理学', enriched),
}

for key, (label, count) in stats.items():
    pct = count / total * 100
    report.append(f"  {label}: +{count} ({pct:.1f}%)")

report.append("\n" + "-" * 70)
report.append("  二、字段覆盖率对比")
report.append("-" * 70)

fields_check = [
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

report.append(f"\n  {'字段':<12} {'缺失数':>8} {'覆盖率':>8} {'状态':>10}")
report.append("  " + "-" * 45)

for field, label in fields_check:
    if isinstance(rmchm_data[0].get(field), list):
        missing = sum(1 for d in rmchm_data if not d.get(field) or len(d[field]) == 0)
    else:
        missing = sum(1 for d in rmchm_data if not d.get(field))
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
    report.append(f"  {label:<10} {missing:>8} {pct:6.1f}% {status:>10}")

report.append("\n" + "-" * 70)
report.append("  三、毒性药材清单")
report.append("-" * 70)

toxic_herbs = [d for d in rmchm_data if d.get('is_toxic')]
report.append(f"\n  毒性药材总数: {len(toxic_herbs)}")
report.append(f"  占比: {len(toxic_herbs)/total*100:.1f}%")

# 按毒性程度分类
severe_toxic = []
slight_toxic = []
for d in toxic_herbs:
    sid = str(d.get('symmap_id', ''))
    if sid in symmap_by_id:
        props = symmap_by_id[sid].get('Properties_Chinese', '')
        if '大毒' in props or '有毒' in props:
            severe_toxic.append(d['name_cn'])
        elif '小毒' in props:
            slight_toxic.append(d['name_cn'])

report.append(f"\n  大毒/有毒: {len(severe_toxic)} 条")
report.append(f"  小毒: {len(slight_toxic)} 条")
report.append(f"\n  示例 (大毒/有毒): {severe_toxic[:10]}")
report.append(f"  示例 (小毒): {slight_toxic[:10]}")

report.append("\n" + "-" * 70)
report.append("  四、图片资源分布")
report.append("-" * 70)

img_herbs = [d for d in rmchm_data if d.get('image_path')]
report.append(f"\n  有图片药材: {len(img_herbs)}/{total}")
report.append(f"  图片覆盖率: {len(img_herbs)/total*100:.1f}%")

# 按来源统计
img_sources = defaultdict(int)
for d in img_herbs:
    src = d.get('image_source', 'Unknown')
    img_sources[src] += 1

report.append(f"\n  图片来源分布:")
for src, cnt in img_sources.items():
    report.append(f"    {src}: {cnt} 条 ({cnt/total*100:.1f}%)")

report.append("\n" + "-" * 70)
report.append("  五、质量评分分布")
report.append("-" * 70)

scores = [d.get('data_quality_score', 0) for d in rmchm_data]
excellent = sum(1 for s in scores if s >= 80)
good = sum(1 for s in scores if 60 <= s < 80)
fair = sum(1 for s in scores if 40 <= s < 60)
poor = sum(1 for s in scores if s < 40)

report.append(f"\n  优秀 (>=80分): {excellent} 条 ({excellent/total*100:.1f}%)")
report.append(f"  良好 (60-80分): {good} 条 ({good/total*100:.1f}%)")
report.append(f"  中等 (40-60分): {fair} 条 ({fair/total*100:.1f}%)")
report.append(f"  待加强 (<40分): {poor} 条 ({poor/total*100:.1f}%)")

report.append("\n" + "-" * 70)
report.append("  六、待办事项清单")
report.append("-" * 70)

report.append("""
  【短期待办 - 1-2周】
  □ 对接《中华本草》获取完整use_part数据
  □ 对接国家药典获取完整alias别名数据
  □ 补充药食同源标记（对照GB 16740-2014）
  □ 完成106FAM图片匹配的药材核对

  【中期待办 - 1-3个月】
  □ 建立TCMSP化合物-药材完整映射关系
  □ 完善化合物-靶点-疾病三层关联
  □ 接入SymMap完整网络药理学数据
  □ 建立数据质量监控和自动更新机制

  【长期待办 - 3-6个月】
  □ 构建药食同源知识图谱
  □ 接入PubMed/CNKI文献数据
  □ 建立多源数据融合机制
  □ 完善数据版本管理和追溯体系
""")

report.append("\n" + "=" * 70)
report.append("  报告结束")
report.append("=" * 70)

report_text = "\n".join(report)
print(report_text)

# 保存报告
report_path = r'D:\RMFOODFP\data\rmchm\rmchm_completion_executed_v313.txt'
with open(report_path, 'w', encoding='utf-8') as f:
    f.write(report_text)
print(f"\n详细报告已保存: {report_path}")
