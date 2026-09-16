"""
最终图片映射修复 - 确保107/107全部匹配
"""
import json
import os
import re

# 加载数据
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v3.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

img_dir = 'D:/RMFOODFP/data/106FAM'
image_files = {f[:-4]: f for f in os.listdir(img_dir) if f.endswith('.jpg')}

# 药材名
herb_names = [h['name_cn'] for h in herbs]
herb_lookup = {h['name_cn']: h for h in herbs}

# 建立完整映射
mapping = {}

# 1. 精确匹配
for img_name, img_file in image_files.items():
    if img_name in herb_lookup:
        mapping[img_name] = img_file

# 2. 规则映射（图片名->药材名）
rules = {
    '八角': '八角茴香',
    '杏仁': '苦杏仁',
    '枣': '大枣',
    '橘皮': '陈皮',
    '益智仁': '益智',
    '紫苏籽': '紫苏子',
    '藿香': '广藿香',
    '鲜芦根': '芦根',
    '黄芥子': '芥子',
    '黑胡椒': '胡椒',
    '桔红': '化橘红',
    '槐米': '槐花',
    '代代花': '代代花',  # 新药材
}

for img_name, herb_name in rules.items():
    if img_name in image_files and herb_name in herb_lookup:
        if herb_name not in mapping:
            mapping[herb_name] = image_files[img_name]

# 3. 特殊处理：姜图片同时分配给生姜和干姜
if '姜（生姜、干姜）' in image_files:
    jiang_img = image_files['姜（生姜、干姜）']
    if '生姜' in herb_lookup and '生姜' not in mapping:
        mapping['生姜'] = jiang_img
    if '干姜' in herb_lookup and '干姜' not in mapping:
        mapping['干姜'] = jiang_img

# 4. 模糊匹配剩余图片
from difflib import SequenceMatcher

def normalize(name):
    name = re.sub(r'[（(].*?[）)]', '', name)
    name = re.sub(r'^鲜/', '', name)
    return name.strip().lower()

def similarity(a, b):
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio()

used_imgs = set(mapping.values())
for img_name, img_file in image_files.items():
    if img_file in used_imgs:
        continue
    best_match = None
    best_score = 0
    for h_name in herb_names:
        if h_name in mapping:
            continue
        score = similarity(img_name, h_name)
        if score > best_score:
            best_score = score
            best_match = h_name
    if best_score >= 0.7 and best_match:
        mapping[best_match] = img_file
        used_imgs.add(img_file)

# 统计
print("=" * 70)
print("  最终图片映射结果")
print("=" * 70)
print(f"\n总图片: {len(image_files)}")
print(f"已映射: {len(mapping)}")
print(f"未映射: {len(image_files) - len(mapping)}")

# 找出未映射的图片
remaining = [n for n in image_files if image_files[n] not in mapping.values()]
if remaining:
    print(f"\n仍未匹配的图片({len(remaining)}):")
    for r in remaining:
        print(f"  {r}.jpg")

# 输出完整映射
print(f"\n完整映射表({len(mapping)}条):")
for herb, img in sorted(mapping.items()):
    print(f"  {herb} -> {img}")

# 保存
out_path = 'D:/RMFOODFP/data/rmchm/rmchm_image_mapping_100.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(mapping, f, ensure_ascii=False, indent=2)

print(f"\n已保存到: {out_path}")
