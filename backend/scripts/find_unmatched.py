"""
找出未匹配的图片和药材
"""
import json
import os

# 加载数据
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v3.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

# 图片目录
img_dir = 'D:/RMFOODFP/data/106FAM'
image_files = {}
for f in os.listdir(img_dir):
    if f.endswith('.jpg'):
        image_files[f[:-4]] = f

# 加载映射
with open('D:/RMFOODFP/data/rmchm/rmchm_image_mapping_complete.json', 'r', encoding='utf-8') as f:
    mapping = json.load(f)

# 找出未匹配的图片
matched_imgs = set(mapping.values())
unmatched_imgs = [name for name in image_files if image_files[name] not in matched_imgs]

print("=" * 70)
print("  未匹配图片分析")
print("=" * 70)
print(f"\n总图片: {len(image_files)}")
print(f"已匹配: {len(matched_imgs)}")
print(f"未匹配: {len(unmatched_imgs)}")

print(f"\n未匹配图片:")
for img in sorted(unmatched_imgs):
    print(f"  {img}.jpg")

# 检查这些图片名是否在药材名中
herb_names = set(h['name_cn'] for h in herbs)
print(f"\n药材名总数: {len(herb_names)}")

print(f"\n未匹配图片对应的药材名检查:")
for img in sorted(unmatched_imgs):
    if img in herb_names:
        print(f"  {img}: 在药材名中 ✓")
    else:
        # 检查是否部分匹配
        matches = [n for n in herb_names if img in n or n in img]
        if matches:
            print(f"  {img}: 部分匹配 -> {matches[:3]}")
        else:
            print(f"  {img}: 无匹配")

# 同时检查哪些药材没有图片
print(f"\n无图片的药材示例（前20）:")
count = 0
for h in herbs:
    if not h.get('image_path'):
        print(f"  {h['name_cn']}")
        count += 1
        if count >= 20:
            break
