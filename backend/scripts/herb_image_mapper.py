"""
中药材图片映射生成脚本
将图片目录中的药材名与数据库药材名匹配
"""
import os
import json
import re

# 图片目录
IMAGE_DIR = r"D:\RMFOODFP\data\（高清版）106种药食同源带介绍"

# 获取所有图片文件名
image_files = [f.replace('.jpg', '') for f in os.listdir(IMAGE_DIR) if f.endswith('.jpg')]

print(f"找到 {len(image_files)} 个药材图片")

# 创建映射 - 多种匹配策略
herb_image_map = {}

# 名称标准化函数
def normalize_name(name):
    """标准化药材名称用于匹配"""
    # 去除括号内容
    name = re.split(r'[（(].*?[）)]', name)[0].strip()
    # 去除特殊字符
    name = re.sub(r'[（\(].*?[）\)]', '', name).strip()
    # 去除常见后缀
    name = re.sub(r'(的|子|叶|花|根|茎|皮|仁|实|霜|粉|片)$', '', name)
    return name

# 建立映射
for img_name in image_files:
    # 原始名称
    original = img_name
    # 标准化名称
    normalized = normalize_name(img_name)
    # 去除后缀后的基础名
    base_name = re.sub(r'（.*?）|（.*?）|[\(\[].*?[\)\]]', '', img_name).strip()

    herb_image_map[original] = f"/herbs-images/{img_name}.jpg"
    herb_image_map[normalized] = f"/herbs-images/{img_name}.jpg"
    herb_image_map[base_name] = f"/herbs-images/{img_name}.jpg"

# 去重并输出
unique_map = {}
for k, v in herb_image_map.items():
    if k not in unique_map:
        unique_map[k] = v

# 输出映射
print("\n药材图片映射（前20个）:")
for name, url in sorted(unique_map.items())[:20]:
    print(f"  {name}: {url}")

# 保存到 JSON
output_file = r"D:\RMFOODFP\backend\data\herb_image_map.json"
os.makedirs(os.path.dirname(output_file), exist_ok=True)
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(unique_map, f, ensure_ascii=False, indent=2)

print(f"\n映射已保存到: {output_file}")
print(f"总共 {len(unique_map)} 个药材图片映射")
