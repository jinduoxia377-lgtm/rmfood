"""
RMCHM数据导入PostgreSQL - 最终版
"""
import json
import psycopg2
from datetime import datetime

DB_CONFIG = {
    'host': 'localhost',
    'port': '5432',
    'database': 'rmfood',
    'user': 'postgres',
    'password': 'password'
}

DATA_FILE = r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v311.json'

def safe_str(val, max_len=None):
    """安全转换为字符串并可选截断"""
    if val is None:
        return None
    s = str(val)
    if max_len and len(s) > max_len:
        return s[:max_len]
    return s

def main():
    print("=" * 70)
    print("  RMCHM数据导入PostgreSQL")
    print("=" * 70)

    conn = psycopg2.connect(**DB_CONFIG)
    conn.set_client_encoding('UTF8')
    cur = conn.cursor()

    print("\n[清空] 清空表...")
    cur.execute("TRUNCATE rmchm_herbs CASCADE;")
    conn.commit()
    print("  OK")

    print("\n[加载] 数据...")
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        herbs = json.load(f)
    print(f"  总药材数: {len(herbs)}")

    print("\n[导入] 插入数据...")
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
                safe_str(herb.get('rmchm_id')),
                safe_str(herb.get('rmchm_code')),
                safe_str(herb.get('name_cn'), 200),
                safe_str(herb.get('name_pinyin'), 200),
                safe_str(herb.get('name_latin'), 300),
                safe_str(herb.get('name_eng'), 300),
                safe_str(herb.get('nature_cn'), 1000),
                safe_str(herb.get('nature_eng'), 200),
                safe_str(herb.get('meridians_cn'), 1000),
                safe_str(herb.get('meridians_eng'), 200),
                safe_str(herb.get('category_cn'), 100),
                safe_str(herb.get('category_eng'), 100),
                safe_str(herb.get('use_part'), 100),
                safe_str(herb.get('alias'), 500),
                safe_str(herb.get('function_cn'), 500),
                herb.get('ob_percent'),
                herb.get('dl_value'),
                herb.get('is_food_homology', False),
                herb.get('is_toxic', False),
                herb.get('tcmsp_id'),
                herb.get('symmap_id'),
                herb.get('compounds_count', 0),
                herb.get('targets_count', 0),
                herb.get('diseases_count', 0),
                safe_str(herb.get('image_path'), 500),
                safe_str(herb.get('image_source'), 50),
                herb.get('data_quality_score'),
                safe_str(herb.get('synced_at')),
                safe_str(herb.get('created_at'))
            )
            cur.execute(sql, values)
            inserted += 1
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  ERROR: {herb.get('name_cn')}: {e}")

        if inserted % 100 == 0:
            print(f"  已导入 {inserted}/{len(herbs)}")

    conn.commit()
    print(f"\n  OK 导入完成: 成功{inserted}, 失败{errors}")

    # 验证
    print("\n[验证] 数据统计...")
    cur.execute("SELECT COUNT(*) FROM rmchm_herbs;")
    total = cur.fetchone()[0]
    print(f"  总药材数: {total}")

    cur.execute("SELECT COUNT(*) FROM rmchm_herbs WHERE is_food_homology = true;")
    homology = cur.fetchone()[0]
    print(f"  药食同源: {homology}")

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
