"""
图片匹配差异分析报告
列出107张图片中未匹配的13张，以及对应的药材名分析
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

# 图片目录
img_dir = 'D:/RMFOODFP/data/106FAM'
image_names = {}
for f in os.listdir(img_dir):
    if f.endswith('.jpg'):
        image_names[f[:-4]] = f

# 所有药材名列表
herb_names = [h['name_cn'] for h in herbs]

def normalize(name):
    """标准化：去除括号、前缀、标点"""
    name = re.sub(r'[（(].*?[）)]', '', name)
    name = re.sub(r'^鲜/', '', name)
    name = re.sub(r'[、,\s]+', '', name)
    return name.strip().lower()

def similarity(a, b):
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio()

# 分析每张图片
print("=" * 70)
print("  图片匹配差异详细分析")
print("=" * 70)
print(f"\n总图片数: {len(image_names)}")
print(f"已匹配: {len(image_mapping)}")
print(f"未匹配: {len(image_names) - len(image_mapping)}")
print()

unmatched = []
for img_name in sorted(image_names.keys()):
    if img_name not in image_mapping.values():
        # 找最接近的药材
        best_herb = None
        best_score = 0
        for h in herb_names:
            score = similarity(img_name, h)
            if score > best_score:
                best_score = score
                best_herb = h

        # 检查括号内容
        bracket_match = re.search(r'[（(](.+?)[）)]', img_name)
        bracket_content = bracket_match.group(1) if bracket_match else None

        # 检查去除括号后
        base_name = re.sub(r'[（(].*?[）)]', '', img_name).strip()
        # 检查去除鲜前缀
        no_xian = re.sub(r'^鲜/', '', img_name)

        unmatched.append({
            'image': img_name,
            'best_herb': best_herb,
            'best_score': best_score,
            'bracket_content': bracket_content,
            'base_name': base_name,
            'no_xian': no_xian,
        })

# 输出详细分析
print("-" * 70)
print("  未匹配图片详细分析")
print("-" * 70)

for i, item in enumerate(unmatched, 1):
    print(f"\n【{i}】图片文件名: {item['image']}")
    print(f"    最佳匹配药材: {item['best_herb']}")
    print(f"    匹配相似度: {item['best_score']:.2%}")

    # 分析可能的原因
    reasons = []

    # 1. 括号内容可能是别名
    if item['bracket_content']:
        # 检查括号内容是否在药材列表中
        bracket_parts = [p.strip() for p in item['bracket_content'].split('、')]
        for part in bracket_parts:
            if part in herb_names:
                reasons.append(f"  → 括号内别名「{part}」可精确匹配到药材")
            elif any(part in h for h in herb_names):
                reasons.append(f"  → 括号内别名「{part}」与药材名部分匹配")

    # 2. 去除括号后的基础名
    if item['base_name'] and item['base_name'] != item['image']:
        if item['base_name'] in herb_names:
            reasons.append(f"  → 去除括号后基础名「{item['base_name']}」可精确匹配")
        else:
            # 找部分匹配
            for h in herb_names:
                if item['base_name'] in h or h in item['base_name']:
                    reasons.append(f"  → 基础名「{item['base_name']}」与药材「{h}」有包含关系")
                    break

    # 3. 去除鲜前缀
    if item['no_xian'] and item['no_xian'] != item['image']:
        if item['no_xian'] in herb_names:
            reasons.append(f"  → 去除'鲜/'前缀后「{item['no_xian']}」可精确匹配")
        else:
            for h in herb_names:
                if item['no_xian'] in h or h in item['no_xian']:
                    reasons.append(f"  → 去除'鲜/'后「{item['no_xian']}」与药材「{h}」有包含关系")
                    break

    # 4. 同义词/别名分析
    if not reasons:
        # 检查是否有相似名称
        similar = [h for h in herb_names if similarity(item['image'], h) >= 0.7]
        if similar:
            reasons.append(f"  → 相似药材: {', '.join(similar[:5])}")
        else:
            reasons.append(f"  → 无明显匹配，可能为别名或新名称")
    else:
        # 检查是否已有匹配但映射错误
        base = item['base_name'] or item['no_xian'] or item['image']
        for h_name, img_mapped in image_mapping.items():
            if img_mapped == item['image']:
                reasons.append(f"  → 但该图片已映射到药材「{h_name}」（可能映射错误）")

    for r in reasons:
        print(r)

print()
print("=" * 70)
print("  汇总：请用户判断以下13张图片的对应关系")
print("=" * 70)
for i, item in enumerate(unmatched, 1):
    print(f"  {i}. {item['image']}")
