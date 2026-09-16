"""
RMCHM v2.1 图片匹配修复版
修复14张未匹配图片的对应关系
"""
import json
import os
import re
import uuid
from datetime import datetime, timezone

# 加载数据
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v2.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

with open('D:/RMFOODFP/data/rmchm/rmchm_image_mapping_v2.json', 'r', encoding='utf-8') as f:
    old_mapping = json.load(f)

# 图片目录
img_dir = 'D:/RMFOODFP/data/106FAM'
image_files = {}
for f in os.listdir(img_dir):
    if f.endswith('.jpg'):
        image_files[f[:-4]] = f

# 已匹配的图片
matched_files = set(old_mapping.values())

# ============================================================
# 图片名 -> 药材名 映射规则（修复版）
# ============================================================
IMAGE_HERB_RULES = {
    # 类型A：名称标准化差异（直接映射）
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
    
    # 类型B：同药异名
    '桔红': '化橘红',  # 药典中桔红=化橘红
    '槐米': '槐花',    # 槐米=槐花花蕾，同源
    
    # 类型C：新药材（需新增到数据库）
    '代代花': '代代花',  # 新药材，别名：玳玳花、枳壳、代代果、酸橙、回青橙
    
    # 类型D：一张图对应多个药材
    '姜（生姜、干姜）': ['生姜', '干姜'],  # 同时分配给生姜和干姜
}

# ============================================================
# 修复匹配逻辑
# ============================================================
def fix_image_mapping(image_name, herb_lookup):
    """
    修复图片匹配
    herb_lookup: name_cn -> herb_record
    """
    # 1. 检查是否已在原映射中
    for herb_name, mapped_img in old_mapping.items():
        if mapped_img == image_name:
            return [(herb_name, image_name, 'existing')]
    
    # 2. 检查规则映射
    if image_name in IMAGE_HERB_RULES:
        rule = IMAGE_HERB_RULES[image_name]
        if isinstance(rule, list):
            # 多药材映射
            results = []
            for herb_name in rule:
                if herb_name in herb_lookup:
                    results.append((herb_name, image_name, 'rule_fixed'))
            return results if results else [(image_name, image_name, 'manual_check')]
        else:
            # 单药材映射
            if rule in herb_lookup:
                return [(rule, image_name, 'rule_fixed')]
            else:
                # 新药材，返回自身
                return [(image_name, image_name, 'new_herb')]
    
    # 3. 模糊匹配（相似度>=0.85）
    from difflib import SequenceMatcher
    best_match = None
    best_score = 0
    for h_name in herb_lookup.keys():
        score = SequenceMatcher(None, image_name, h_name).ratio()
        if score > best_score:
            best_score = score
            best_match = h_name
    
    if best_score >= 0.85 and best_match:
        return [(best_match, image_name, 'fuzzy_match')]
    
    return [(image_name, image_name, 'no_match')]

# 构建药材查找表
herb_lookup = {h['name_cn']: h for h in herbs}

# ============================================================
# 执行修复
# ============================================================
new_mapping = dict(old_mapping)  # 复制原有映射
fixed_images = []
new_herbs_needed = []
multi_herb_images = []

for img_name in sorted(image_files.keys()):
    if img_name in [f[:-4] for f in matched_files]:  # 已匹配则跳过
        continue
    
    results = fix_image_mapping(img_name, herb_lookup)
    
    for herb_name, img_file, match_type in results:
        if match_type == 'existing':
            continue  # 已在原映射中
        elif match_type == 'rule_fixed':
            new_mapping[herb_name] = img_file
            fixed_images.append((img_name, herb_name, match_type))
        elif match_type == 'new_herb':
            new_herbs_needed.append((img_name, herb_name))
            new_mapping[herb_name] = img_file
            fixed_images.append((img_name, herb_name, match_type))
        elif match_type == 'multi_herb':
            multi_herb_images.append((img_name, herb_name))
        elif match_type == 'fuzzy_match':
            new_mapping[herb_name] = img_file
            fixed_images.append((img_name, herb_name, match_type))
        elif match_type == 'no_match':
            print(f"  警告: 无法匹配 {img_name}")

# ============================================================
# 特殊处理：姜（生姜、干姜）同时分配给生姜和干姜
# ============================================================
姜_image = '姜（生姜、干姜）'
if 姜_image in image_files:
    # 生姜和干姜都使用这张图片
    img_file = image_files[姜_image]
    new_mapping['生姜'] = img_file
    new_mapping['干姜'] = img_file
    fixed_images.append((姜_image, '生姜', 'shared'))
    fixed_images.append((姜_image, '干姜', 'shared'))

# ============================================================
# 保存修复后的映射
# ============================================================
output_dir = 'D:/RMFOODFP/data/rmchm'
os.makedirs(output_dir, exist_ok=True)

# 保存新映射
with open(os.path.join(output_dir, 'rmchm_image_mapping_v3.json'), 'w', encoding='utf-8') as f:
    json.dump(new_mapping, f, ensure_ascii=False, indent=2)

# 保存修复报告
report = {
    'total_images': len(image_files),
    'previously_matched': len(old_mapping),
    'newly_fixed': len(fixed_images),
    'total_matched': len(new_mapping),
    'fix_details': fixed_images,
    'new_herbs_needed': new_herbs_needed,
}

with open(os.path.join(output_dir, 'image_fix_report.json'), 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print("=" * 60)
print("  图片匹配修复完成")
print("=" * 60)
print(f"原有匹配: {len(old_mapping)} 张")
print(f"新增修复: {len(fixed_images)} 张")
print(f"总计匹配: {len(new_mapping)} 张")
print(f"匹配率: {len(new_mapping)*100//len(image_files)}%")
print()
print("修复详情:")
for img, herb, method in fixed_images:
    print(f"  {img}.jpg -> {herb} [{method}]")

if new_herbs_needed:
    print()
    print("需要新增的药材:")
    for img, herb in new_herbs_needed:
        print(f"  {img}.jpg -> {herb} (需添加到数据库)")
