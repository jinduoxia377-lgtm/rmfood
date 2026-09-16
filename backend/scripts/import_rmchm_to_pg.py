"""
RMCHM数据导入PostgreSQL
"""
import json
import os
import sys
import subprocess
from datetime import datetime

# 配置
PSQL_PATH = r'C:\Program Files\PostgreSQL\18\bin\psql.exe'
DATABASE = 'rmfood'
SCHEMA_FILE = r'D:\RMFOODFP\data\rmchm\rmchm_schema.sql'
DATA_FILE = r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v311.json'

def run_sql(sql, database=DATABASE):
    """执行SQL语句"""
    proc = subprocess.run(
        [PSQL_PATH, '-U', 'postgres', '-d', database, '-c', sql],
        capture_output=True, text=True, encoding='utf-8'
    )
    if proc.returncode != 0:
        print(f"ERROR: {proc.stderr}")
        return False
    return True

def main():
    print("=" * 70)
    print("  RMCHM数据导入PostgreSQL")
    print("=" * 70)

    # 1. 创建数据库
    print("\n[步骤1] 检查并创建数据库...")
    check_db = f"SELECT 1 FROM pg_database WHERE datname = '{DATABASE}';"
    proc = subprocess.run(
        [PSQL_PATH, '-U', 'postgres', '-d', 'postgres', '-tAc', check_db],
        capture_output=True, text=True, encoding='utf-8'
    )
    if proc.stdout.strip() == '1':
        print(f"  OK 数据库 '{DATABASE}' 已存在")
    else:
        print(f"  创建数据库 '{DATABASE}'...")
        run_sql(f"CREATE DATABASE {DATABASE};")
        print(f"  OK 数据库创建成功")

    # 2. 执行Schema
    print("\n[步骤2] 执行建表脚本...")
    with open(SCHEMA_FILE, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
    run_sql(schema_sql)
    print(f"  OK Schema执行完成")

    # 3. 导入数据
    print("\n[步骤3] 导入药材数据...")
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        herbs = json.load(f)
    print(f"  总药材数: {len(herbs)}")

    # 批量插入
    batch_size = 50
    inserted = 0
    for i in range(0, len(herbs), batch_size):
        batch = herbs[i:i+batch_size]
        for herb in batch:
            try:
                # 构建INSERT语句
                sql = f"""
                INSERT INTO rmchm_herbs (
                    rmchm_id, rmchm_code, name_cn, name_pinyin, name_latin, name_eng,
                    nature_cn, nature_eng, meridians_cn, meridians_eng,
                    category_cn, category_eng, use_part, alias, function_cn,
                    ob_percent, dl_value, is_food_homology, is_toxic,
                    tcmsp_id, symmap_id, compounds_count, targets_count, diseases_count,
                    image_path, image_source, data_quality_score, synced_at, created_at
                ) VALUES (
                    '{herb.get('rmchm_id', '')}',
                    '{herb.get('rmchm_code', '')}',
                    '{herb.get('name_cn', '').replace("'", "''")}',
                    '{herb.get('name_pinyin', '').replace("'", "''")}',
                    '{herb.get('name_latin', '').replace("'", "''")}',
                    '{herb.get('name_eng', '').replace("'", "''")}',
                    '{herb.get('nature_cn', '').replace("'", "''")}',
                    '{herb.get('nature_eng', '').replace("'", "''")}',
                    '{herb.get('meridians_cn', '').replace("'", "''")}',
                    '{herb.get('meridians_eng', '').replace("'", "''")}',
                    '{herb.get('category_cn', '').replace("'", "''")}',
                    '{herb.get('category_eng', '').replace("'", "''")}',
                    '{herb.get('use_part', '').replace("'", "''")}',
                    '{herb.get('alias', '').replace("'", "''")}',
                    '{herb.get('function_cn', '').replace("'", "''")}',
                    {herb.get('ob_percent', 'NULL')},
                    {herb.get('dl_value', 'NULL')},
                    {str(herb.get('is_food_homology', False)).lower()},
                    {str(herb.get('is_toxic', False)).lower()},
                    {herb.get('tcmsp_id', 'NULL')},
                    {herb.get('symmap_id', 'NULL')},
                    {herb.get('compounds_count', 0)},
                    {herb.get('targets_count', 0)},
                    {herb.get('diseases_count', 0)},
                    '{herb.get('image_path', '').replace("'", "''") if herb.get('image_path') else 'NULL'}',
                    '{herb.get('image_source', '').replace("'", "''") if herb.get('image_source') else 'NULL'}',
                    {herb.get('data_quality_score', 'NULL')},
                    '{herb.get('synced_at', datetime.now().isoformat())}',
                    '{herb.get('created_at', datetime.now().isoformat())}'
                ) ON CONFLICT (rmchm_id) DO NOTHING;
                """
                run_sql(sql)
                inserted += 1
            except Exception as e:
                print(f"  ERROR inserting {herb.get('name_cn')}: {e}")

        if (i // batch_size + 1) % 10 == 0:
            print(f"  已导入 {min(i + batch_size, len(herbs))}/{len(herbs)}")

    print(f"\n  OK 导入完成，共 {inserted} 条")

    # 4. 验证
    print("\n[步骤4] 验证数据...")
    proc = subprocess.run(
        [PSQL_PATH, '-U', 'postgres', '-d', DATABASE, '-tAc', 'SELECT COUNT(*) FROM rmchm_herbs;'],
        capture_output=True, text=True, encoding='utf-8'
    )
    count = proc.stdout.strip()
    print(f"  数据库中药材数: {count}")

    proc = subprocess.run(
        [PSQL_PATH, '-U', 'postgres', '-d', DATABASE, '-tAc', 'SELECT COUNT(*) FROM rmchm_herbs WHERE is_food_homology = true;'],
        capture_output=True, text=True, encoding='utf-8'
    )
    homology_count = proc.stdout.strip()
    print(f"  药食同源标记数: {homology_count}")

    print("\n" + "=" * 70)
    print("  导入完成!")
    print("=" * 70)

if __name__ == '__main__':
    main()
