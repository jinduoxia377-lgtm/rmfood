"""
重新生成 RMCHM 图片映射文件
确保 UTF-8 编码正确
"""
import os
import json

IMAGE_DIR = r'D:\RMFOODFP\data\106FAM'
OUTPUT_FILE = r'D:\RMFOODFP\backend\data\rmchm_image_map.json'

def main():
    print("=" * 70)
    print("  重新生成 RMCHM 图片映射文件")
    print("=" * 70)

    if not os.path.exists(IMAGE_DIR):
        print(f"错误: 图片目录不存在: {IMAGE_DIR}")
        return

    mapping = {}
    images = []

    for filename in os.listdir(IMAGE_DIR):
        if filename.endswith('.jpg'):
            name = filename.replace('.jpg', '')
            mapping[name] = f"/api/v1/rmchm/images/{filename}"
            images.append(filename)

    # 保存映射
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

    print(f"\n已生成映射文件: {OUTPUT_FILE}")
    print(f"共 {len(mapping)} 条映射")
    print(f"\n示例映射:")
    for i, (k, v) in enumerate(list(mapping.items())[:5]):
        print(f"  {k} -> {v}")

    print(f"\n图片文件列表:")
    for img in images[:10]:
        print(f"  {img}")
    if len(images) > 10:
        print(f"  ... 共 {len(images)} 个文件")

if __name__ == '__main__':
    main()
