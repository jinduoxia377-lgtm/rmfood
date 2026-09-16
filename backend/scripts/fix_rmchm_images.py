"""
修复 RMCHM 图片路径问题
1. 更新 herb_images.py 支持多目录
2. 更新数据库中的 image_path 为正确格式
"""
import os
import json
import psycopg2

# 配置
DB_CONFIG = {
    'host': 'localhost',
    'database': 'rmfood',
    'user': 'postgres',
    'password': 'password'
}

# 图片目录列表（按优先级）
IMAGE_DIRS = [
    r'D:\RMFOODFP\data\106FAM',
    r'D:\RMFOODFP\data\rmchm\images',
]

def find_image(herb_name: str) -> str:
    """根据药材名查找图片"""
    # 尝试多种匹配方式
    patterns = [
        f"{herb_name}.jpg",
        f"{herb_name}.png",
        herb_name + ".jpg",
    ]

    for img_dir in IMAGE_DIRS:
        if not os.path.exists(img_dir):
            continue

        # 精确匹配
        for pattern in patterns:
            path = os.path.join(img_dir, pattern)
            if os.path.exists(path):
                return f"/api/v1/rmchm/images/{os.path.basename(path)}"

        # 模糊匹配（包含关系）
        for filename in os.listdir(img_dir):
            if filename.endswith('.jpg') and herb_name in filename:
                return f"/api/v1/rmchm/images/{filename}"

    return None

def main():
    print("=" * 70)
    print("  RMCHM 图片路径修复工具")
    print("=" * 70)

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    # 获取所有需要图片的药材
    print("\n[查询] 获取药材图片需求...")
    cur.execute("""
        SELECT rmchm_id, name_cn, image_path
        FROM rmchm_herbs
        WHERE image_path IS NULL OR image_path = ''
        LIMIT 100
    """)
    herbs = cur.fetchall()
    print(f"  共 {len(herbs)} 条记录需要处理")

    # 查找并更新图片路径
    print("\n[修复] 查找并更新图片路径...")
    updated = 0
    for rmchm_id, name_cn, old_path in herbs:
        new_path = find_image(name_cn)
        if new_path:
            cur.execute(
                "UPDATE rmchm_herbs SET image_path = %s WHERE rmchm_id = %s",
                (new_path, rmchm_id)
            )
            updated += 1
            if updated <= 5:
                print(f"  {name_cn}: {old_path} -> {new_path}")

    conn.commit()
    print(f"\n  已更新 {updated} 条记录")

    # 生成图片映射文件
    print("\n[生成] 图片映射文件...")
    mapping = {}
    for img_dir in IMAGE_DIRS:
        if not os.path.exists(img_dir):
            continue
        for filename in os.listdir(img_dir):
            if filename.endswith('.jpg'):
                name = filename.replace('.jpg', '')
                mapping[name] = f"/api/v1/rmchm/images/{filename}"

    output_file = r'D:\RMFOODFP\backend\data\rmchm_image_map.json'
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

    print(f"  映射文件已生成: {output_file}")
    print(f"  共 {len(mapping)} 条映射")

    # 验证
    print("\n[验证] 数据统计...")
    cur.execute("SELECT COUNT(*) FROM rmchm_herbs WHERE image_path IS NOT NULL")
    with_image = cur.fetchone()[0]
    print(f"  有图片的药材: {with_image} / 714")

    cur.close()
    conn.close()

    print("\n" + "=" * 70)
    print("  修复完成!")
    print("=" * 70)

if __name__ == '__main__':
    main()
