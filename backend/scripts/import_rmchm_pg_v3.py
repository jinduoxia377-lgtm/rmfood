"""
RMCHM数据导入PostgreSQL - 最终版
"""
import json
import os
import psycopg2
from datetime import datetime

# 配置
DB_CONFIG = {
    'host': 'localhost',
    'port': '5432',
    'database': 'rmfood',
    'user': 'postgres',
    'password': 'password'
}

DATA_FILE = r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v311.json'

def truncate_text(text, max_len=500):
    """截断文本到指定长度"""
    if not text:
        return text
    text = str(text)
    if len(text) > max_len:
        return text[:max_len] + '...'
    return text

def main():
    print("=" * 70)
    print("  RMCHM数据导入PostgreSQL (最终版)")
    print("=" * 70)

    # 连接数据库
    print("\n[连接] PostgreSQL...")
    conn = psycopg2.connect(**DB_CONFIG)
    conn.set_client_encoding('UTF8')
    cur = conn.cursor()
    print("  OK 连接成功")

    # 清空表
    print("\n[清空] 清空现有数据...")
    cur.execute("TRUNCATE rmchm_herbs CASCADE;")
    conn.commit()
    print("  OK 清空完成")

    # 加载数据
    print("\n[加载] RMCHM数据...")
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        herbs = json.load(f)
    print(f"  总药材数: {len(herbs)}")

    # 插入数据
    print("\n[导入] 插入药材数据...")
    inserted = 0
    errors = 0

    for herb in herbs:
        try:
            sql = """
            INSERT INTO rmchm_herbs (
                rmchm_id, rmchm_code, name_cn, name_pinyin, name_latin, name_eng,
                nature_cn, nature_eng, meridians_cn, meridians_eng,
                category_cn, category_eng, use_part, alias, function_cn,
                ob_percent, dl_value, is_food_homology, is_toxic,
                tcmsp_id, symmap_id, compounds_count, targets_count, diseases_count,
                image_path, image_source, data_quality_score, synced_at, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s
            ) ON CONFLICT (rmchm_id) DO NOTHING;
            """
            values = (
                herb.get('rmchm_id'),
                herb.get('rmchm_code'),
                truncate_text(herb.get('name_cn'), 100),
                truncate_text(herb.get('name_pinyin'), 100),
                truncate_text(herb.get('name_latin'), 300),
                truncate_text(herb.get('name_eng'), 300),
                truncate_text(herb.get('nature_cn'), 500),
                truncate_text(herb.get('nature_eng'), 500),
                truncate_text(herb.get('meridians_cn'), 500),
                truncate_text(herb.get('meridians_eng'), 500),
                truncate_text(herb.get('category_cn'), 100),
                truncate_text(herb.get('category_eng'), 100),
                truncate_text(herb.get('use_part'), 100),
                truncate_text(herb.get('alias'), 500),
                truncate_text(herb.get('function_cn'), 500),
                herb.get('ob_percent'),
                herb.get('dl_value'),
                herb.get('is_food_homology', False),
                herb.get('is_toxic', False),
                herb.get('tcmsp_id'),
                herb.get('symmap_id'),
                herb.get('compounds_count', 0),
                herb.get('targets_count', 0),
                herb.get('diseases_count', 0),
                truncate_text(herb.get('image_path'), 500),
                truncate_text(herb.get('image_source'), 50),
                herb.get('data_quality_score'),
                herb.get('synced_at', datetime.now().isoformat()),
                herb.get('created_at', datetime.now().isoformat())
            )
            cur.execute(sql, values)
            inserted += 1
        except Exception as e:
            errors += 1
            if errors <= 10:
                print(f"  ERROR: {herb.get('name_cn')}: {e}")

        if inserted % 100 == 0:
            print(f"  已导入 {inserted}/{len(herbs)}")

    conn.commit()
    print(f"\n  OK 导入完成")
    print(f"  成功: {inserted}")
    print(f"  失败: {errors}")

    # 验证
    print("\n[验证] 数据统计...")
    cur.execute("SELECT COUNT(*) FROM rmchm_herbs;")
    total = cur.fetchone()[0]
    print(f"  总药材数: {total}")

    cur.execute("SELECT COUNT(*) FROM rmchm_herbs WHERE is_food_homology = true;")
    homology = cur.fetchone()[0]
    print(f"  药食同源: {homology}")

    # 显示示例
    print("\n[示例] 前5条记录:")
    cur.execute("SELECT name_cn, nature_cn, meridians_cn, is_food_homology FROM rmchm_herbs LIMIT 5;")
    for row in cur.fetchall():
        print(f"  {row[0]} | {row[1]} | {row[2]} | 药食同源:{row[3]}")

    cur.close()
    conn.close()

    print("\n" + "=" * 70)
    print("  导入完成!")
    print("=" * 70)

if __name__ == '__main__':
    main()
