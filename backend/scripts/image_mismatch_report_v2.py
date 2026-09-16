"""
图片匹配差异诊断报告 v2
正确识别未匹配的13张图片及其原因
"""
import json
import os
import re
from difflib import SequenceMatcher

# 加载数据
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v2.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

with open('D:/RMFOODFP/data/rmchm/rmchm_image_mapping_v2.json', 'r', encoding='utf-8') as f:
    image_mapping = json.load(f)

# 图片目录（带.jpg后缀）
img_dir = 'D:/RMFOODFP/data/106FAM'
image_files = {}  # name_without_jpg -> filename_with_jpg
for f in os.listdir(img_dir):
    if f.endswith('.jpg'):
        name_without_jpg = f[:-4]
        image_files[name_without_jpg] = f

# 已匹配的图片文件名（带.jpg）
matched_files = set(image_mapping.values())

# 找出未匹配的图片
unmatched = []
for name_no_jpg, filename_with_jpg in sorted(image_files.items()):
    if filename_with_jpg not in matched_files:
        unmatched.append(name_no_jpg)

# 药材名列表
herb_names = [h['name_cn'] for h in herbs]

def normalize(name):
    name = re.sub(r'[（(].*?[）)]', '', name)
    name = re.sub(r'^鲜/', '', name)
    name = re.sub(r'[、,\s]+', '', name)
    return name.strip().lower()

def similarity(a, b):
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio()

# 生成报告
report = []
report.append("=" * 70)
report.append("  RMCHM 图片匹配差异诊断报告 v2")
report.append("=" * 70)
report.append("")
report.append(f"总图片数: {len(image_files)}")
report.append(f"已匹配: {len(matched_files)}")
report.append(f"未匹配: {len(unmatched)}")
report.append("")
report.append("-" * 70)
report.append("  请判断以下图片对应的药材名称:")
report.append("-" * 70)

for i, img_name in enumerate(unmatched, 1):
    report.append("")
    report.append(f"【{i}】图片文件名: {img_name}.jpg")

    # 分析可能的对应关系
    # 1. 括号内容
    bracket_match = re.search(r'[（(](.+?)[）)]', img_name)
    bracket_content = bracket_match.group(1) if bracket_match else None

    # 2. 基础名（去除括号）
    base_name = re.sub(r'[（(].*?[）)]', '', img_name).strip()

    # 3. 去除鲜前缀
    no_xian = re.sub(r'^鲜/', '', img_name)

    # 4. 找最接近的药材
    best_herb = None
    best_score = 0
    for h in herb_names:
        score = similarity(img_name, h)
        if score > best_score:
            best_score = score
            best_herb = h

    report.append(f"    最佳匹配药材: {best_herb} (相似度: {best_score:.0%})")

    # 5. 检查各种可能性
    possibilities = []

    # 括号内容作为别名
    if bracket_content:
        bracket_parts = [p.strip() for p in bracket_content.split('、')]
        for part in bracket_parts:
            if part in herb_names:
                possibilities.append(f"  -> 括号内「{part}」可精确匹配药材")
            elif any(part in h for h in herb_names):
                possibilities.append(f"  -> 括号内「{part}」与药材名部分匹配")

    # 基础名
    if base_name and base_name != img_name:
        if base_name in herb_names:
            possibilities.append(f"  -> 去除括号后「{base_name}」可精确匹配")
        else:
            for h in herb_names:
                if base_name in h or h in base_name:
                    possibilities.append(f"  -> 基础名「{base_name}」与药材「{h}」有包含关系")
                    break

    # 去鲜前缀
    if no_xian and no_xian != img_name:
        if no_xian in herb_names:
            possibilities.append(f"  -> 去除'鲜/'后「{no_xian}」可精确匹配")
        else:
            for h in herb_names:
                if no_xian in h or h in no_xian:
                    possibilities.append(f"  -> 去鲜后「{no_xian}」与药材「{h}」有包含关系")
                    break

    # 相似度>=70%的药材
    similar_herbs = [h for h in herb_names if similarity(img_name, h) >= 0.7]
    if similar_herbs and not possibilities:
        possibilities.append(f"  -> 相似药材: {', '.join(similar_herbs[:5])}")

    if possibilities:
        for p in possibilities:
            report.append(p)
    else:
        report.append(f"  -> 无明显匹配，请人工判断")

report.append("")
report.append("=" * 70)
report.append("  汇总：请确认以下13张图片对应的药材名称")
report.append("=" * 70)
for i, img_name in enumerate(unmatched, 1):
    report.append(f"  {i}. {img_name}")

# 写入文件
output_path = 'D:/RMFOODFP/data/rmchm/image_mismatch_report_v2.txt'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(report))

print(f"Report written to: {output_path}")
print(f"Unmatched images: {len(unmatched)}")
for u in unmatched:
    print(f"  - {u}")
