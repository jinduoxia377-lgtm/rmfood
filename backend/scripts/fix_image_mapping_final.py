"""
修复图片映射，确保107/107全部匹配
"""
import json
import os

# 加载数据
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v3.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

with open('D:/RMFOODFP/data/rmchm/rmchm_image_mapping_v3.json', 'r', encoding='utf-8') as f:
    old_mapping = json.load(f)

# 图片目录
img_dir = 'D:/RMFOODFP/data/106FAM'
all_images = {}
for f in os.listdir(img_dir):
    if f.endswith('.jpg'):
        all_images[f[:-4]] = f

print(f"总图片: {len(all_images)}")
print(f"旧映射: {len(old_mapping)}")

# 找出未匹配的图片
matched_files = set(old_mapping.values())
unmatched_images = [name for name in all_images if name not in matched_files and all_images[name] not in matched_files]
print(f"未匹配图片: {unmatched_images}")

# 药材名列表
herb_names = [h['name_cn'] for h in herbs]

# 图片映射规则（修复版）
IMAGE_RULES = {
    '代代花': '代代花',
    '八角': '八角茴香',
    '杏仁': '苦杏仁',
    '枣': '大枣',
    '桔红': '化橘红',
    '槐米': '槐花',
    '橘皮': '陈皮',
    '益智仁': '益智',
    '紫苏籽': '紫苏子',
    '藿香': '广藿香',
    '鲜芦根': '芦根',
    '黄芥子': '芥子',
    '黑胡椒': '胡椒',
}

# 特殊处理：姜图片分配给生姜和干姜
JIANG_IMG = '姜（生姜、干姜）'
if JIANG_IMG in all_images:
    IMAGE_RULES[JIANG_IMG] = ['生姜', '干姜']

# 修复映射
new_mapping = dict(old_mapping)
fixed = []

for img_name, target in IMAGE_RULES.items():
    if img_name in all_images:
        img_file = all_images[img_name]
        if isinstance(target, list):
            for t in target:
                if t not in new_mapping:
                    new_mapping[t] = img_file
                    fixed.append((img_name, t))
        else:
            if target not in new_mapping:
                new_mapping[target] = img_file
                fixed.append((img_name, target))

print(f"\n修复了 {len(fixed)} 条映射:")
for img, herb in fixed:
    print(f"  {img}.jpg -> {herb}")

# 检查是否还有未匹配的
remaining = [name for name in all_images if all_images[name] not in new_mapping.values()]
print(f"\n剩余未匹配: {remaining}")

# 保存
out_path = 'D:/RMFOODFP/data/rmchm/rmchm_image_mapping_final.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(new_mapping, f, ensure_ascii=False, indent=2)

print(f"\n已保存到: {out_path}")
print(f"总映射数: {len(new_mapping)}")
