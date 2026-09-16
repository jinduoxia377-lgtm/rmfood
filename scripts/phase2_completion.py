# -*- coding: utf-8 -*-
"""
RMCHM 数据库完善方案执行 - 第二阶段
解决图片匹配、UsePart、Alias等问题
"""
import json
import os
import re
from collections import defaultdict
from datetime import datetime

print("=" * 70)
print("  RMCHM 数据库完善方案 - 第二阶段执行")
print("=" * 70)
print(f"执行时间: {datetime.utcnow().isoformat()}Z")

# ==================== 加载数据 ====================
print("\n[1] 加载数据源...")

with open(r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v312.json', 'r', encoding='utf-8') as f:
    rmchm_data = json.load(f)

with open(r'D:\RMFOODFP\data\SymMap\symmap_herbs.json', 'r', encoding='utf-8') as f:
    symmap_herbs = json.load(f)

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

# 加载106FAM图片
fam_dir = r'D:\RMFOODFP\data\106FAM'
fam_images = {}
if os.path.exists(fam_dir):
    for f in os.listdir(fam_dir):
        if f.endswith('.jpg') or f.endswith('.png'):
            name = f.replace('.jpg', '').replace('.png', '')
            fam_images[name] = f'data/106FAM/{f}'

# 构建SymMap查找表
symmap_by_id = {str(h['Herb_id']): h for h in symmap_herbs}

total = len(rmchm_data)
print(f"  RMCHM herbs: {total}")
print(f"  SymMap herbs: {len(symmap_herbs)}")
print(f"  SMHB entries: {len(smhb_by_id)}")
print(f"  106FAM images: {len(fam_images)}")

# ==================== 任务1: 完善图片匹配 ====================
print("\n" + "=" * 70)
print("  [任务1] 完善图片匹配")
print("=" * 70)

# 建立更智能的匹配策略
img_fixed = 0
img_matches = []

for d in rmchm_data:
    cn = d.get('name_cn', '')
    if d.get('image_path'):
        continue
    
    # 精确匹配
    if cn in fam_images:
        d['image_path'] = fam_images[cn]
        d['image_source'] = '106FAM'
        img_fixed += 1
        img_matches.append((cn, 'exact'))
        continue
    
    # 模糊匹配：去掉括号内容
    cn_clean = re.sub(r'[（(].*?[）)]', '', cn).strip()
    if cn_clean in fam_images:
        d['image_path'] = fam_images[cn_clean]
        d['image_source'] = '106FAM'
        img_fixed += 1
        img_matches.append((cn, 'fuzzy'))
        continue
    
    # 部分匹配
    for fam_name in fam_images.keys():
        if fam_name in cn or cn in fam_name:
            d['image_path'] = fam_images[fam_name]
            d['image_source'] = '106FAM'
            img_fixed += 1
            img_matches.append((cn, 'partial'))
            break

print(f"  修复图片: {img_fixed} 条")
print(f"  精确匹配: {sum(1 for _, t in img_matches if t == 'exact')} 条")
print(f"  模糊匹配: {sum(1 for _, t in img_matches if t == 'fuzzy')} 条")
print(f"  部分匹配: {sum(1 for _, t in img_matches if t == 'partial')} 条")

# ==================== 任务2: 补充UsePart数据 ====================
print("\n" + "=" * 70)
print("  [任务2] 补充UsePart数据")
print("=" * 70)

# UsePart在SMHB的index 11
up_fixed = 0
for d in rmchm_data:
    if not d.get('use_part') and d.get('symmap_id'):
        sid = str(d['symmap_id'])
        if sid in smhb_by_id:
            up = smhb_by_id[sid].get('UsePart')
            if up:
                d['use_part'] = up
                up_fixed += 1

print(f"  修复UsePart: {up_fixed} 条")

# 统计剩余缺失
no_up = [d['name_cn'] for d in rmchm_data if not d.get('use_part')]
print(f"  仍缺失: {len(no_up)} 条")

# ==================== 任务3: 补充Alias数据 ====================
print("\n" + "=" * 70)
print("  [任务3] 补充Alias数据")
print("=" * 70)

# Alias在SMHB的index 16
al_fixed = 0
for d in rmchm_data:
    if not d.get('alias') and d.get('symmap_id'):
        sid = str(d['symmap_id'])
        if sid in smhb_by_id:
            al = smhb_by_id[sid].get('Alias')
            if al:
                d['alias'] = al
                al_fixed += 1

print(f"  修复Alias: {al_fixed} 条")

# 统计剩余缺失
no_al = [d['name_cn'] for d in rmchm_data if not d.get('alias')]
print(f"  仍缺失: {len(no_al)} 条")

# ==================== 任务4: 解析TCMSP HTML获取化合物映射 ====================
print("\n" + "=" * 70)
print("  [任务4] 解析TCMSP HTML获取化合物映射")
print("=" * 70)

tcmsp_herb_mol = defaultdict(set)
html_path = r'D:\RMFOODFP\data\TCMSP\data_ingredients.html'

if os.path.exists(html_path):
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print(f"  HTML大小: {len(content)} bytes")
    
    # 方法1: 查找表格行
    table_rows = re.findall(r'<tr[^>]*>(.*?)</tr>', content, re.DOTALL)
    print(f"  表格行数: {len(table_rows)}")
    
    # 方法2: 查找所有herb_id和mol_id
    herb_ids_in_html = set(re.findall(r'herb_id["\s:=]+(\d+)', content))
    mol_ids_in_html = set(re.findall(r'MOL\d+', content))
    print(f"  HTML中herb_id数量: {len(herb_ids_in_html)}")
    print(f"  HTML中MOL_ID数量: {len(mol_ids_in_html)}")
    
    # 尝试从表格行中提取映射关系
    for row in table_rows[:2000]:
        herb_match = re.search(r'herb_id["\s:=]+(\d+)', row)
        mol_match = re.search(r'mol_id["\s:=]+(MOL\d+)', row)
        if herb_match and mol_match:
            tcmsp_herb_mol[herb_match.group(1)].add(mol_match.group(2))
    
    print(f"  提取的herb-mol映射: {sum(len(v) for v in tcmsp_herb_mol.values())} 条")

# ==================== 任务5: 补充网络药理学数据 ====================
print("\n" + "=" * 70)
print("  [任务5] 补充网络药理学数据")
print("=" * 70)

# 加载TCMSP化合物数据
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_ingredients.json', 'r', encoding='utf-8') as f:
    tcmsp_compounds = json.load(f)

# 加载TCMSP靶点数据
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_targets.json', 'r', encoding='utf-8') as f:
    tcmsp_targets = json.load(f)

# 加载TCMSP疾病数据
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_diseases.json', 'r', encoding='utf-8') as f:
    tcmsp_diseases = json.load(f)

# 加载SymMap化合物数据
with open(r'D:\RMFOODFP\data\SymMap\symmap_ingredients.json', 'r', encoding='utf-8') as f:
    symmap_compounds = json.load(f)

# 构建化合物索引
tcmsp_compound_by_mol = {c['MOL_ID']: c for c in tcmsp_compounds}
symmap_compound_by_tcmsp_mol = defaultdict(list)
for c in symmap_compounds:
    tid = c.get('TCMSP_id', '')
    if tid:
        symmap_compound_by_tcmsp_mol[str(tid)].append(c)

print(f"  TCMSP化合物: {len(tcmsp_compound_by_mol)}")
print(f"  SymMap化合物(by TCMSP_mol): {len(symmap_compound_by_tcmsp_mol)}")

# 为每个药材补充化合物数据
comp_enriched = 0
target_enriched = 0

for d in rmchm_data:
    tcmsp_hid = str(d.get('tcmsp_id', ''))
    symmap_hid = str(d.get('symmap_id', ''))
    
    # 补充化合物
    if not d.get('compounds') or len(d.get('compounds', [])) == 0:
        compounds = []
        
        # 方法1: 通过SymMap化合物(TCMSP_id=MOL_ID)
        if symmap_hid and symmap_hid in symmap_by_id:
            # 获取该药材的所有化合物
            pass  # SymMap化合物不直接按herb_id组织
        
        # 方法2: 通过TCMSP化合物映射
        if tcmsp_hid and tcmsp_hid in tcmsp_herb_mol:
            for mol_id in tcmsp_herb_mol[tcmsp_hid]:
                if mol_id in tcmsp_compound_by_mol:
                    compounds.append(tcmsp_compound_by_mol[mol_id])
        
        d['compounds'] = compounds
        d['compounds_count'] = len(compounds)
        
        if len(compounds) > 0:
            comp_enriched += 1
    
    # 补充靶点
    if not d.get('targets') or len(d.get('targets', [])) == 0:
        targets = []
        # 简化：通过化合物获取靶点
        if tcmsp_hid and tcmsp_hid in tcmsp_herb_mol:
            for mol_id in tcmsp_herb_mol[tcmsp_hid]:
                # TCMSP化合物到靶点的映射需要从HTML解析
                pass
        d['targets'] = targets
        d['targets_count'] = len(targets)
        
        if len(targets) > 0:
            target_enriched += 1

print(f"  化合物数据增强: {comp_enriched} 条")
print(f"  靶点数据增强: {target_enriched} 条")

# ==================== 任务6: 计算综合质量评分 ====================
print("\n" + "=" * 70)
print("  [任务6] 计算综合质量评分")
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
print("\n" + "=" * 70)
print("  保存结果")
print("=" * 70)

output_path = r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v313.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(rmchm_data, f, ensure_ascii=False, indent=2)
print(f"  已保存: {output_path}")

# ==================== 生成最终报告 ====================
print("\n" + "=" * 70)
print("  生成最终报告")
print("=" * 70)

report = []
report.append("=" * 70)
report.append("  RMCHM 数据库补全方案执行报告 v313")
report.append("=" * 70)
report.append(f"\n执行时间: {datetime.utcnow().isoformat()}Z")
report.append(f"总药材数: {total}")
report.append(f"输出文件: {output_path}")

# 统计各字段
report.append("\n" + "-" * 70)
report.append("  一、补全结果统计")
report.append("-" * 70)

stats = [
    ('name_eng', '英文名称'),
    ('use_part', '药用部位'),
    ('alias', '别名'),
    ('is_toxic', '毒性标记'),
    ('image_path', '图片资源'),
    ('ob_percent', 'OB%'),
    ('compounds', '化合物'),
    ('targets', '靶点'),
    ('diseases', '疾病'),
]

report.append(f"\n  {'字段':<15} {'缺失数':>8} {'覆盖率':>8} {'状态':>10}")
report.append("  " + "-" * 50)

for field, label in stats:
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
    report.append(f"  {label:<13} {missing:>8} {pct:6.1f}% {status:>10}")

# 毒性统计
report.append("\n" + "-" * 70)
report.append("  二、毒性药材分析")
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
report.append(f"\n  大毒/有毒示例: {severe_toxic[:10]}")
report.append(f"  小毒示例: {slight_toxic[:10]}")

# 图片统计
report.append("\n" + "-" * 70)
report.append("  三、图片资源统计")
report.append("-" * 70)

img_herbs = [d for d in rmchm_data if d.get('image_path')]
report.append(f"\n  有图片药材: {len(img_herbs)}/{total}")
report.append(f"  图片覆盖率: {len(img_herbs)/total*100:.1f}%")

# 质量评分分布
report.append("\n" + "-" * 70)
report.append("  四、质量评分分布")
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

# 后续建议
report.append("\n" + "-" * 70)
report.append("  五、后续完善建议")
report.append("-" * 70)

report.append("""
  【短期行动 - 1-2周】
  1. ✅ 完成name_eng补全 (69.3%)
  2. ✅ 完成is_toxic补全 (14.7%)
  3. ⏳ 对接《中华本草》获取完整use_part数据
  4. ⏳ 对接国家药典获取完整alias数据
  5. ⏳ 对照GB 16740-2014补全药食同源标记
  
  【中期行动 - 1-3个月】
  1. ⏳ 建立TCMSP化合物-药材完整映射
  2. ⏳ 完善化合物-靶点-疾病三层关联
  3. ⏳ 接入SymMap完整网络药理学数据
  4. ⏳ 建立数据质量监控和自动更新机制
  
  【长期行动 - 3-6个月】
  1. ⏳ 构建药食同源知识图谱
  2. ⏳ 接入PubMed/CNKI文献数据
  3. ⏳ 建立多源数据融合机制
  4. ⏳ 完善数据版本管理和追溯体系
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
