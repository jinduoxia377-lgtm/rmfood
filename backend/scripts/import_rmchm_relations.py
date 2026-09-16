"""
RMCHM关联表数据导入PostgreSQL
导入化合物、靶点、疾病详细数据
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

def safe_float(val, default=None):
    """安全转换为float"""
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def main():
    print("=" * 70)
    print("  RMCHM关联表数据导入")
    print("=" * 70)

    conn = psycopg2.connect(**DB_CONFIG)
    conn.set_client_encoding('UTF8')
    cur = conn.cursor()

    # 清空关联表
    print("\n[清空] 关联表...")
    cur.execute("TRUNCATE rmchm_herb_diseases CASCADE;")
    cur.execute("TRUNCATE rmchm_herb_targets CASCADE;")
    cur.execute("TRUNCATE rmchm_herb_compounds CASCADE;")
    conn.commit()
    print("  OK")

    # 加载数据
    print("\n[加载] RMCHM数据...")
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        herbs = json.load(f)
    print(f"  总药材数: {len(herbs)}")

    # 统计
    total_compounds = 0
    total_targets = 0
    total_diseases = 0

    # 插入化合物
    print("\n[导入] 化合物数据...")
    compounds_inserted = 0
    for herb in herbs:
        rmchm_id = herb.get('rmchm_id')
        compounds = herb.get('compounds', [])
        for comp in compounds:
            try:
                sql = """
                INSERT INTO rmchm_herb_compounds (
                    rmchm_id, compound_name, mol_id, mw, ob, dl,
                    hdon, hacc, alogp, caco2, bbb, tpsa
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                );
                """
                values = (
                    rmchm_id,
                    comp.get('name', ''),
                    comp.get('mol_id', ''),
                    safe_float(comp.get('mw')),
                    safe_float(comp.get('ob')),
                    safe_float(comp.get('dl')),
                    comp.get('hdon'),
                    comp.get('hacc'),
                    safe_float(comp.get('alogp')),
                    safe_float(comp.get('caco2')),
                    safe_float(comp.get('bbb')),
                    safe_float(comp.get('tpsa'))
                )
                cur.execute(sql, values)
                compounds_inserted += 1
            except Exception as e:
                if compounds_inserted < 10:
                    print(f"  ERROR: {comp.get('name')}: {e}")

        if compounds_inserted % 5000 == 0:
            print(f"  已导入 {compounds_inserted}/?")

    total_compounds = compounds_inserted
    print(f"  OK 化合物: {total_compounds} 条")

    # 插入靶点
    print("\n[导入] 靶点数据...")
    targets_inserted = 0
    for herb in herbs:
        rmchm_id = herb.get('rmchm_id')
        targets = herb.get('targets', [])
        for target in targets:
            try:
                sql = """
                INSERT INTO rmchm_herb_targets (
                    rmchm_id, target_name, tar_id, drugbank_id, kegg
                ) VALUES (
                    %s, %s, %s, %s, %s
                );
                """
                values = (
                    rmchm_id,
                    target.get('name', ''),
                    target.get('id', target.get('tar_id', '')),
                    target.get('drugbank_id', ''),
                    target.get('kegg', '')
                )
                cur.execute(sql, values)
                targets_inserted += 1
            except Exception as e:
                if targets_inserted < 10:
                    print(f"  ERROR: {target.get('name')}: {e}")

        if targets_inserted % 5000 == 0:
            print(f"  已导入 {targets_inserted}/?")

    total_targets = targets_inserted
    print(f"  OK 靶点: {total_targets} 条")

    # 插入疾病
    print("\n[导入] 疾病数据...")
    diseases_inserted = 0
    for herb in herbs:
        rmchm_id = herb.get('rmchm_id')
        diseases = herb.get('diseases', [])
        for disease in diseases:
            try:
                sql = """
                INSERT INTO rmchm_herb_diseases (
                    rmchm_id, disease_name, dis_id, icd9, icd10
                ) VALUES (
                    %s, %s, %s, %s, %s
                );
                """
                values = (
                    rmchm_id,
                    disease.get('name', ''),
                    disease.get('id', disease.get('dis_id', '')),
                    disease.get('icd9', ''),
                    disease.get('icd10', '')
                )
                cur.execute(sql, values)
                diseases_inserted += 1
            except Exception as e:
                if diseases_inserted < 10:
                    print(f"  ERROR: {disease.get('name')}: {e}")

        if diseases_inserted % 5000 == 0:
            print(f"  已导入 {diseases_inserted}/?")

    total_diseases = diseases_inserted
    print(f"  OK 疾病: {total_diseases} 条")

    conn.commit()
    print(f"\n  OK 导入完成")

    # 验证
    print("\n[验证] 数据统计...")
    cur.execute("SELECT COUNT(*) FROM rmchm_herb_compounds;")
    compounds_count = cur.fetchone()[0]
    print(f"  化合物表: {compounds_count} 条")

    cur.execute("SELECT COUNT(*) FROM rmchm_herb_targets;")
    targets_count = cur.fetchone()[0]
    print(f"  靶点表: {targets_count} 条")

    cur.execute("SELECT COUNT(*) FROM rmchm_herb_diseases;")
    diseases_count = cur.fetchone()[0]
    print(f"  疾病表: {diseases_count} 条")

    # 更新主表统计
    print("\n[更新] 主表统计字段...")
    cur.execute("""
        UPDATE rmchm_herbs SET
            compounds_count = (SELECT COUNT(*) FROM rmchm_herb_compounds c WHERE c.rmchm_id = rmchm_herbs.rmchm_id),
            targets_count = (SELECT COUNT(*) FROM rmchm_herb_targets t WHERE t.rmchm_id = rmchm_herbs.rmchm_id),
            diseases_count = (SELECT COUNT(*) FROM rmchm_herb_diseases d WHERE d.rmchm_id = rmchm_herbs.rmchm_id)
    """)
    conn.commit()
    print("  OK")

    # 显示示例
    print("\n[示例] 化合物数据:")
    cur.execute("""
        SELECT h.name_cn, c.compound_name, c.ob, c.dl
        FROM rmchm_herbs h
        JOIN rmchm_herb_compounds c ON h.rmchm_id = c.rmchm_id
        LIMIT 5
    """)
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]} (OB={row[2]}, DL={row[3]})")

    cur.close()
    conn.close()

    print("\n" + "=" * 70)
    print("  导入完成!")
    print(f"  化合物: {compounds_count} 条")
    print(f"  靶点: {targets_count} 条")
    print(f"  疾病: {diseases_count} 条")
    print("=" * 70)

if __name__ == '__main__':
    main()
