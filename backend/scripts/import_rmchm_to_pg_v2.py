"""
RMCHM数据导入PostgreSQL - 修复版
使用COPY命令和UTF-8编码
"""
import json
import os
import subprocess
import csv
from datetime import datetime

# 配置
PSQL_PATH = r'C:\Program Files\PostgreSQL\18\bin\psql.exe'
DATABASE = 'rmfood'
DATA_FILE = r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v311.json'
CSV_FILE = r'D:\RMFOODFP\data\rmchm\rmchm_herbs.csv'

def run_sql(sql, database=DATABASE):
    """执行SQL语句"""
    env = os.environ.copy()
    env['PGCLIENTENCODING'] = 'UTF8'
    proc = subprocess.run(
        [PSQL_PATH, '-U', 'postgres', '-d', database, '-c', sql],
        capture_output=True, text=True, encoding='utf-8', env=env
    )
    if proc.returncode != 0:
        print(f"ERROR: {proc.stderr}")
        return False
    return True

def main():
    print("=" * 70)
    print("  RMCHM数据导入PostgreSQL (修复版)")
    print("=" * 70)

    # 1. 设置编码
    print("\n[步骤1] 设置数据库编码...")
    run_sql("SET client_encoding TO 'UTF8';")
    run_sql("ALTER DATABASE rmfood SET client_encoding TO 'UTF8';")
    print("  OK 编码设置为UTF8")

    # 2. 导出CSV
    print("\n[步骤2] 导出数据为CSV...")
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        herbs = json.load(f)
    print(f"  总药材数: {len(herbs)}")

    # 选择需要的字段
    fields = [
        'rmchm_id', 'rmchm_code', 'name_cn', 'name_pinyin', 'name_latin', 'name_eng',
        'nature_cn', 'nature_eng', 'meridians_cn', 'meridians_eng',
        'category_cn', 'category_eng', 'use_part', 'alias', 'function_cn',
        'ob_percent', 'dl_value', 'is_food_homology', 'is_toxic',
        'tcmsp_id', 'symmap_id', 'compounds_count', 'targets_count', 'diseases_count',
        'image_path', 'image_source', 'data_quality_score', 'synced_at', 'created_at'
    ]

    with open(CSV_FILE, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for herb in herbs:
            row = {k: herb.get(k, '') for k in fields}
            # 处理None值
            for k in row:
                if row[k] is None:
                    row[k] = ''
            writer.writerow(row)

    print(f"  OK CSV文件已生成: {CSV_FILE}")

    # 3. 清空表并导入
    print("\n[步骤3] 导入数据到PostgreSQL...")
    run_sql("TRUNCATE rmchm_herbs;")

    copy_sql = f"COPY rmchm_herbs FROM '{CSV_FILE.replace(chr(92), '/').replace(':', '')}' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');"
    # Windows路径需要特殊处理
    copy_sql = f"COPY rmchm_herbs FROM STDIN WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');"

    # 使用psql的COPY FROM STDIN
    with open(CSV_FILE, 'r', encoding='utf-8-sig') as f:
        csv_content = f.read()

    proc = subprocess.run(
        [PSQL_PATH, '-U', 'postgres', '-d', DATABASE],
        input=csv_content,
        capture_output=True, text=True, encoding='utf-8'
    )

    if proc.returncode == 0:
        print("  OK 数据导入成功")
    else:
        print(f"  ERROR: {proc.stderr}")

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

    # 5. 显示示例
    print("\n[步骤5] 显示示例数据...")
    proc = subprocess.run(
        [PSQL_PATH, '-U', 'postgres', '-d', DATABASE, '-tAc',
         "SELECT name_cn, nature_cn, meridians_cn, is_food_homology FROM rmchm_herbs LIMIT 5;"],
        capture_output=True, text=True, encoding='utf-8'
    )
    print("  前5条记录:")
    for line in proc.stdout.strip().split('\n'):
        parts = line.split('|')
        if len(parts) >= 4:
            print(f"    {parts[0].strip()} | 四气:{parts[1].strip()} | 归经:{parts[2].strip()} | 药食同源:{parts[3].strip()}")

    print("\n" + "=" * 70)
    print("  导入完成!")
    print("=" * 70)

if __name__ == '__main__':
    main()
