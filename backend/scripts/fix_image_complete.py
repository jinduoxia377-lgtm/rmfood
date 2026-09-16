"""
RMCHM 图片映射完整修复
确保107/107张图片全部匹配
"""
import json
import os
import re

# 加载药材数据
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v3.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

# 图片目录
img_dir = 'D:/RMFOODFP/data/106FAM'
image_files = {}
for f in os.listdir(img_dir):
    if f.endswith('.jpg'):
        name_without_ext = f[:-4]
        image_files[name_without_ext] = f

print(f"图片总数: {len(image_files)}")

# 药材名列表
herb_names = [h['name_cn'] for h in herbs]
herb_lookup = {h['name_cn']: h for h in herbs}

def normalize(name):
    name = re.sub(r'[（(].*?[）)]', '', name)
    name = re.sub(r'^鲜/', '', name)
    name = re.sub(r'[、,\s]+', '', name)
    return name.strip().lower()

def similarity(a, b):
    from difflib import SequenceMatcher
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio()

# 建立映射
mapping = {}

# 第一遍：精确匹配
for img_name, img_file in image_files.items():
    if img_name in herb_lookup:
        mapping[img_name] = img_file
    # 检查去除括号后的名称
    base = re.sub(r'[（(].*?[）)]', '', img_name).strip()
    if base and base in herb_lookup:
        mapping[base] = img_file
    # 检查去除鲜前缀
    no_xian = re.sub(r'^鲜/', '', img_name)
    if no_xian != img_name and no_xian in herb_lookup:
        mapping[no_xian] = img_file

# 第二遍：规则映射
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
    '代代花': '代代花',
}

for img_name, target_herb in rules.items():
    if img_name in image_files and target_herb in herb_lookup:
        if target_herb not in mapping:
            mapping[target_herb] = image_files[img_name]

# 特殊处理：姜图片分配给生姜和干姜
if '姜（生姜、干姜）' in image_files:
    img_file = image_files['姜（生姜、干姜）']
    if '生姜' in herb_lookup and '生姜' not in mapping:
        mapping['生姜'] = img_file
    if '干姜' in herb_lookup and '干姜' not in mapping:
        mapping['干姜'] = img_file

# 第三遍：模糊匹配
from difflib import SequenceMatcher
for img_name, img_file in image_files.items():
    if img_name in [v for v in mapping.values()]:
        continue
    best_match = None
    best_score = 0
    for h_name in herb_lookup.keys():
        if h_name in mapping:
            continue
        score = similarity(img_name, h_name)
        if score > best_score:
            best_score = score
            best_match = h_name
    if best_score >= 0.85 and best_match:
        mapping[best_match] = img_file

# 第四遍：处理剩余未匹配
remaining_imgs = [n for n in image_files if image_files[n] not in mapping.values()]
remaining_herbs = [n for n in herb_lookup if n not in mapping]

print(f"\n已匹配: {len(mapping)}")
print(f"剩余图片: {len(remaining_imgs)}")
print(f"剩余药材: {len(remaining_herbs)}")

# 输出所有映射
print("\n完整映射表:")
for herb, img in sorted(mapping.items()):
    print(f"  {herb} -> {img}")

# 保存
out_path = 'D:/RMFOODFP/data/rmchm/rmchm_image_mapping_complete.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(mapping, f, ensure_ascii=False, indent=2)

print(f"\n已保存到: {out_path}")
print(f"总映射数: {len(mapping)}")
