# -*- coding: utf-8 -*-
"""
诊断RMCHM与SMHB名称匹配问题
"""
import json
import os
import openpyxl
from collections import defaultdict

print("=" * 70)
print("  诊断RMCHM-SMHB名称匹配问题")
print("=" * 70)

# 加载RMCHM数据
with open(r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v314.json', 'r', encoding='utf-8') as f:
    rmchm_data = json.load(f)

# 加载SMHB数据
wb = openpyxl.load_workbook(r'D:\RMFOODFP\data\SymMap\SymMap v2.0, SMHB file.xlsx', read_only=True)
ws = wb.active
smhb_rows = list(ws.iter_rows(values_only=True))
wb.close()

smhb_header = smhb_rows[0]
smhb_by_name = {}
for row in smhb_rows[1:]:
    d = dict(zip(smhb_header, row))
    if d.get('Chinese_name'):
        smhb_by_name[d['Chinese_name']] = row

rmchm_names = set(d.get('name_cn', '') for d in rmchm_data)
smhb_names = set(smhb_by_name.keys())

print(f"\nRMCHM药材数: {len(rmchm_names)}")
print(f"SMHB药材数: {len(smhb_names)}")

# 精确匹配
exact_match = rmchm_names & smhb_names
print(f"\n精确匹配: {len(exact_match)}")

# 未匹配的RMCHM药材
unmatched_rmchm = rmchm_names - smhb_names
print(f"RMCHM未匹配: {len(unmatched_rmchm)}")

# 检查未匹配的原因
print("\n前20个未匹配的RMCHM药材:")
for name in sorted(list(unmatched_rmchm))[:20]:
    # 尝试模糊匹配
    matched = False
    for smhb_name in smhb_names:
        if name in smhb_name or smhb_name in name:
            print(f"  '{name}' -> 可能匹配: '{smhb_name}'")
            matched = True
            break
    if not matched:
        print(f"  '{name}' -> 无匹配")

# 检查UsePart数据在SMHB中的分布
print("\n" + "=" * 70)
print("  SMHB UsePart数据分布")
print("=" * 70)

usepart_count = 0
no_usepart_count = 0
for row in smhb_rows[1:]:
    if row[11]:  # UsePart column
        usepart_count += 1
    else:
        no_usepart_count += 1

print(f"有UsePart: {usepart_count}")
print(f"无UsePart: {no_usepart_count}")

# 检查Alias数据
alias_count = 0
no_alias_count = 0
for row in smhb_rows[1:]:
    if row[16]:  # Alias column
        alias_count += 1
    else:
        no_alias_count += 1

print(f"\n有Alias: {alias_count}")
print(f"无Alias: {no_alias_count}")

# 统计：有多少RMCHM药材可以从SMHB获取UsePart
can_get_up = 0
for name in exact_match:
    row = smhb_by_name[name]
    if row[11]:  # UsePart
        can_get_up += 1

print(f"\n可以从SMHB获取UsePart的药材: {can_get_up}/{len(exact_match)}")

# 检查为什么只有3个被修复
fixed_up = [d['name_cn'] for d in rmchm_data if d.get('use_part')]
print(f"\n已修复UsePart的药材 ({len(fixed_up)}):")
for n in fixed_up:
    print(f"  {n}")
