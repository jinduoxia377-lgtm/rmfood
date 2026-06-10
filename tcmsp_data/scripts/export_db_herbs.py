"""
从 PostgreSQL 数据库导出 tcm_herbs 表全部数据为 JSON 文件
"""
import json
import psycopg2
from datetime import datetime, timezone
from pathlib import Path

# ── 数据库连接配置 ──
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "user": "postgres",
    "password": "",  # 本地开发环境通常无密码
    "dbname": "rmfood_platform",
}

# ── 输出路径 ──
OUTPUT_PATH = Path(r"D:\RMFOOD配方平台\tcmsp_data\db_herbs_export.json")


def export_herbs():
    """查询 tcm_herbs 表并导出为 JSON"""

    # 1. 连接数据库
    print(f"正在连接数据库 {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['dbname']} ...")
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # 2. 查询总记录数
        cur.execute("SELECT COUNT(*) FROM tcm_herbs")
        total = cur.fetchone()[0]
        print(f"tcm_herbs 表共有 {total} 条记录")

        # 3. 查询全部数据（包含 JSON 字段长度统计）
        query = """
            SELECT id, name_cn, name_latin, name_pinyin, category,
                   effects, ob_percent, dl_value,
                   is_food_homology, tcmsp_id, source_version, synced_at,
                   compounds, targets, diseases,
                   jsonb_array_length(compounds) as compounds_len,
                   jsonb_array_length(targets) as targets_len,
                   jsonb_array_length(diseases) as diseases_len
            FROM tcm_herbs
            ORDER BY id
        """
        print("正在查询全部数据...")
        cur.execute(query)
        rows = cur.fetchall()
        col_names = [desc[0] for desc in cur.description]

        # 4. 转换为字典列表
        herbs = []
        for row in rows:
            record = dict(zip(col_names, row))
            # 处理 datetime 类型
            if record.get("synced_at"):
                record["synced_at"] = record["synced_at"].isoformat() if record["synced_at"] else None
            herbs.append(record)

        # 5. 构建输出结构
        export_data = {
            "total": total,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "db_info": {
                "table": "tcm_herbs",
                "host": f"{DB_CONFIG['host']}:{DB_CONFIG['port']}",
                "database": DB_CONFIG["dbname"],
            },
            "herbs": herbs,
        }

        # 6. 写入 JSON 文件
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)

        file_size_kb = OUTPUT_PATH.stat().st_size / 1024
        print(f"\n✅ 导出成功！")
        print(f"   文件: {OUTPUT_PATH}")
        print(f"   记录数: {total}")
        print(f"   文件大小: {file_size_kb:.1f} KB")

        # 7. 打印摘要统计
        if herbs:
            print(f"\n--- 数据摘要 ---")
            print(f"   ID 范围: {herbs[0]['id']} ~ {herbs[-1]['id']}")
            total_compounds = sum(h.get("compounds_len", 0) for h in herbs)
            total_targets = sum(h.get("targets_len", 0) for h in herbs)
            total_diseases = sum(h.get("diseases_len", 0) for h in herbs)
            food_count = sum(1 for h in herbs if h.get("is_food_homology"))
            print(f"   化合物总数: {total_compounds}")
            print(f"   靶点总数: {total_targets}")
            print(f"   疾病总数: {total_diseases}")
            print(f"   药食同源数: {food_count}")

        return export_data

    except Exception as e:
        print(f"❌ 导出失败: {e}")
        raise
    finally:
        cur.close()
        conn.close()
        print("\n数据库连接已关闭")


if __name__ == "__main__":
    export_herbs()
