"""
数据修复脚本 v2：修复 tcm_herbs 表中 name_cn/name_latin/ob_percent/dl_value 为空的记录
使用轻量方式读取 TCMSP_HERB_DATABASE 数据，避免导入完整后端链
"""
import sys
import os
import re
import json
import ast
import psycopg2
from psycopg2.extras import Json

def extract_herb_database(filepath):
    """从 tcmsp_client.py 中提取 TCMSP_HERB_DATABASE 列表数据"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 找到 TCMSP_HERB_DATABASE 的完整赋值行（含类型注解）
    match = re.search(r'TCMSP_HERB_DATABASE\s*:\s*.*?=\s*\[', content)
    if not match:
        raise FileNotFoundError(f"无法在 {filepath} 中找到 TCMSP_HERB_DATABASE 定义")

    # 列表的 [ 是匹配结果的最后一个字符
    bracket_start = match.end() - 1

    # 手动解析 Python 列表字面量（处理嵌套结构）
    depth = 0
    i = bracket_start
    while i < len(content):
        if content[i] == '[':
            depth += 1
        elif content[i] == ']':
            depth -= 1
            if depth == 0:
                break
        # 跳过字符串内的括号
        elif content[i] == '"':
            i += 1
            while i < len(content) and content[i] != '"':
                if content[i] == '\\':
                    i += 1
                i += 1
        elif content[i] == "'":
            i += 1
            while i < len(content) and content[i] != "'":
                if content[i] == '\\':
                    i += 1
                i += 1
        i += 1

    list_str = content[bracket_start:i + 1]
    data = ast.literal_eval(list_str)
    return data


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    tcmsp_file = os.path.join(base_dir, 'backend', 'app', 'services', 'data_sources', 'tcmsp_client.py')

    print("正在从 tcmsp_client.py 提取 TCMSP_HERB_DATABASE 数据...")
    herb_data_list = extract_herb_database(tcmsp_file)
    print(f"✅ 成功提取 {len(herb_data_list)} 条药材数据")

    conn = psycopg2.connect(host='localhost', port=5432, dbname='rmfood_platform', user='postgres')
    cur = conn.cursor()

    # 检查当前数据状态
    cur.execute("SELECT id, name_cn, name_latin, ob_percent, dl_value FROM tcm_herbs ORDER BY id")
    rows = cur.fetchall()
    print(f"\n=== 修复前状态 ===")
    print(f"总记录数: {len(rows)}")
    empty_name = sum(1 for r in rows if not r[1])
    empty_latin = sum(1 for r in rows if r[2] is None)
    empty_ob = sum(1 for r in rows if r[3] is None)
    empty_dl = sum(1 for r in rows if r[4] is None)
    print(f"name_cn 为空: {empty_name}")
    print(f"name_latin 为空: {empty_latin}")
    print(f"ob_percent 为空: {empty_ob}")
    print(f"dl_value 为空: {empty_dl}")

    if len(rows) != len(herb_data_list):
        print(f"⚠️ 注意: PG记录数({len(rows)}) != 内存数据条数({len(herb_data_list)})，将按 min 值更新")

    # 逐条更新
    update_count = min(len(rows), len(herb_data_list))
    updated = 0
    for idx in range(update_count):
        herb_data = herb_data_list[idx]
        pg_id = rows[idx][0]

        new_name_cn = herb_data.get("name_cn", "")
        new_name_latin = herb_data.get("name_latin")
        new_name_pinyin = herb_data.get("name_pinyin")
        new_ob = herb_data.get("ob_percent")
        new_dl = herb_data.get("dl_value")
        new_effects = herb_data.get("effects")
        new_category = herb_data.get("category")
        new_is_food_homology = herb_data.get("is_food_homology", False)
        new_compounds = Json(herb_data.get("compounds", []))
        new_targets = Json(herb_data.get("targets", []))
        new_diseases = Json(herb_data.get("diseases", []))

        cur.execute("""
            UPDATE tcm_herbs SET
                name_cn = %s,
                name_latin = %s,
                name_pinyin = %s,
                ob_percent = %s,
                dl_value = %s,
                effects = %s,
                category = %s,
                is_food_homology = %s,
                compounds = %s,
                targets = %s,
                diseases = %s
            WHERE id = %s
        """, (new_name_cn, new_name_latin, new_name_pinyin, new_ob, new_dl,
              new_effects, new_category, new_is_food_homology,
              new_compounds, new_targets, new_diseases, pg_id))
        updated += 1

    conn.commit()

    # 验证修复结果
    print(f"\n=== 修复后验证 ===")
    cur.execute("SELECT id, name_cn, name_latin, ob_percent, dl_value FROM tcm_herbs ORDER BY id LIMIT 15")
    fixed_rows = cur.fetchall()
    for r in fixed_rows:
        print(f"  ID={r[0]:>2}: name_cn='{r[1]:<6}' latin={str(r[2])[:30]:<30} OB%={r[3]} DL={r[4]}")

    cur.execute("SELECT COUNT(*) FROM tcm_herbs WHERE name_cn != '' AND name_cn IS NOT NULL")
    non_empty_name = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM tcm_herbs WHERE ob_percent IS NOT NULL")
    non_empty_ob = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM tcm_herbs WHERE dl_value IS NOT NULL")
    non_empty_dl = cur.fetchone()[0]

    print(f"\n✅ 修复完成！共更新 {updated} 条记录")
    print(f"   name_cn 非空: {non_empty_name}/{len(rows)}")
    print(f"   ob_percent 非空: {non_empty_ob}/{len(rows)}")
    print(f"   dl_value 非空: {non_empty_dl}/{len(rows)}")

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
