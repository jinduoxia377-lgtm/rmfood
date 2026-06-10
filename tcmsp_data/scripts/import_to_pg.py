"""
TCMSP 爬取数据 → PostgreSQL 导入脚本
======================================
读取浏览器端 batch_scrape_details.js 爬取的完整 JSON 数据，
进行清洗/标准化/分类映射/药食同源标记后，
TRUNCATE + 全量导入 tcm_herbs 表，并输出验证报告。

用法:
  python import_to_pg.py                          # 默认读取 tcmsp_herbs_full.json
  python import_to_pg.py --input scraped_data.json # 指定输入文件
  python import_to_pg.py --dry-run                 # 仅验证不写入数据库
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import Json
except ImportError:
    print("缺少依赖: pip install psycopg2-binary")
    sys.exit(1)

# ─── 路径配置 ──────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
DEFAULT_INPUT = SCRIPT_DIR / "tcmsp_herbs_full.json"

# ─── PostgreSQL 配置 ───────────────────────────────
PG_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "rmfood_platform",
    "user": "postgres",
}

# ═══════════════════════════════════════════════════
# 分类映射: TCMSP 英文 → 中文标准名
# ═══════════════════════════════════════════════════

CATEGORY_MAP = {
    "Qi Reinforcing Drugs": "补气药",
    "Blood Tonifying Drugs": "补血药",
    "Yin Reinforcing Drugs": "补阴药",
    "Yang Reinforcing Drugs": "补阳药",
    "Antipyretic Detoxicate Drugs": "清热解毒药",
    "Wind-Dampnessdispelling And Colddispersing Medicinal": "祛风湿散寒药",
    "Phlegresolving Medicine": "化痰药",
    "Antitussive Antiasthmetics": "止咳平喘药",
    "Astringent Hemostatic Medicinal": "收敛止血药",
    "Blood-Cooling Hemostatic Medicinal": "凉血止血药",
    "Channel-Warming Hemostatic": "温经止血药",
    "Warming Interior Drugs": "温里药",
    "Resuscitative Stimulant; Resuscitative Medicinal": "开窍药",
    "Offensive Purgative Medicinal": "攻下药",
    "Gastrointestinal Regulating Medicine": "理气药",
    "Dampness-draining Medicinal": "利水渗湿药",
    "Digestant Medicine": "消食药",
    "Exterior-releasing Medicine": "解表药",
    "Blood-activating and Stasis-resolving Medicine": "活血化瘀药",
    "Carminative Medicine": "化湿药",
    "Clearing Heat and Brighting Eyes Medicine": "清热明目药",
    "Clearing Heat and Calming Liver Medicine": "清热平肝药",
    "Sedative Medicine": "安神药",
    "Absorbent and Astringent Medicine": "收涩药",
}

# ═══════════════════════════════════════════════════
# 药食同源集合 (既是药材又是食品)
# ═══════════════════════════════════════════════════

FOOD_HOMOLOGY_SET = {
    "人参", "黄芪", "党参", "山药", "白术", "甘草", "大枣", "当归", "枸杞子",
    "龙眼肉", "黄精", "玉竹", "麦冬", "百合", "北沙参", "南沙参", "天冬",
    "桑葚", "山楂", "决明子", "柏子仁", "酸枣仁", "丹参", "三七", "生姜",
    "干姜", "肉桂", "花椒", "八角茴香", "小茴香", "陈皮", "薄荷", "紫苏叶",
    "蒲公英", "鱼腥草", "金银花", "菊花", "葛根", "茯苓", "薏苡仁", "莲子",
    "芡实", "扁豆", "黑芝麻", "蜂蜜", "阿胶", "罗汉果", "益智仁", "砂仁",
    "草果", "高良姜", "淡豆豉",
}


# ═══════════════════════════════════════════════════
# Phase 1: 数据加载与清洗标准化
# ═══════════════════════════════════════════════════

def load_scraped_data(filepath: Path) -> list[dict]:
    """加载爬取的 JSON 文件，兼容两种格式"""
    if not filepath.exists():
        print(f"❌ 文件不存在: {filepath}")
        sys.exit(1)

    with open(filepath, "r", encoding="utf-8") as f:
        raw = json.load(f)

    # 格式1: {"data": [...], ...} (JS 脚本输出格式)
    if isinstance(raw, dict) and "data" in raw:
        data = raw["data"]
        meta = {k: v for k, v in raw.items() if k != "data"}
        print(f"📂 加载 JS 输出格式: {len(data)} 条记录")
        print(f"   元数据: success={meta.get('success')}, errors={meta.get('error_count', 0)}")
        return data

    # 格式2: [...] (纯数组)
    if isinstance(raw, list):
        print(f"📂 加载数组格式: {len(raw)} 条记录")
        return raw

    print(f"❌ 无法识别的数据格式")
    sys.exit(1)


def clean_compound(c: dict) -> dict | None:
    """清洗单条化合物记录，过滤无效数据"""
    # TCMSP原始字段名 → 标准字段名 映射
    FIELD_MAP = {
        "MOL_ID": "mol_id",
        "molecule_ID": "molecule_id",
        "molecule_name": "name",
        "file_ID": "file_id",
        "mw": "mw",
        "AlogP": "alogp",
        "alogp": "alogp",
        "Hdon": "hdon",
        "hdon": "hdon",
        "Hacc": "hacc",
        "hacc": "hacc",
        "OB": "ob",
        "ob": "ob",
        "Caco-2": "caco2",
        "caco2": "caco2",
        "BBB": "bbb",
        "bbb": "bbb",
        "DL": "dl",
        "dl": "dl",
        "FASA": "fasa",
        "halflife": "hl",
        "HL": "hl",
    }

    # 提取名称 (兼容多种字段名)
    name = (c.get("name") or c.get("molecule_name") or "")
    if not name or str(name).strip() == "":
        return None

    cleaned = {}
    for src_key, dst_key in FIELD_MAP.items():
        val = c.get(src_key)
        if val is None or val == "" or val == "null":
            cleaned[dst_key] = None
        elif isinstance(val, (int, float)):
            cleaned[dst_key] = val
        else:
            try:
                if dst_key in ("hdon", "hacc"):
                    cleaned[dst_key] = int(float(str(val)))
                else:
                    cleaned[dst_key] = float(str(val))
            except (ValueError, TypeError):
                cleaned[dst_key] = str(val).strip()

    return cleaned


def clean_and_standardize(raw_data: list[dict]) -> list[dict]:
    """
    全量清洗标准化流程:
      - 分类英→中映射
      - 药食同源标记
      - 化合物字段清洗
      - OB%/DL 数值校验
      - 统一输出 schema
    """
    print("\n🧹 开始数据清洗...")

    stats = {
        "total": 0,
        "with_name": 0,
        "with_category": 0,
        "with_compounds": 0,
        "with_ob": 0,
        "with_dl": 0,
        "food_homology": 0,
        "errors": 0,
    }

    cleaned = []

    for idx, item in enumerate(raw_data):
        stats["total"] += 1

        # 基础字段提取
        name_cn = str(item.get("name_cn", "") or "").strip()
        name_latin = str(item.get("name_latin", "") or "").strip()
        name_pinyin = str(item.get("name_pinyin", "") or "").strip()
        category_en = str(item.get("category_en", "") or item.get("category_en", "") or "").strip()
        category_cn = str(item.get("category_cn", "") or "").strip()

        if name_cn:
            stats["with_name"] += 1

        # 分类映射: 优先用已有的中文分类，否则从英文映射
        if category_cn:
            category = category_cn
        else:
            category = CATEGORY_MAP.get(category_en, category_en)
        if category:
            stats["with_category"] += 1

        # 药食同源标记
        is_food_homology = name_cn in FOOD_HOMOLOGY_SET
        if is_food_homology:
            stats["food_homology"] += 1

        # 化合物清洗
        raw_compounds = item.get("compounds", [])
        compounds = []
        if isinstance(raw_compounds, list):
            for rc in raw_compounds:
                cc = clean_compound(rc)
                if cc:
                    compounds.append(cc)

        if compounds:
            stats["with_compounds"] += 1

        # OB% / DL 汇总值（优先使用已计算的，否则从化合物重算）
        ob_percent = item.get("ob_percent")
        dl_value = item.get("dl_value")

        if ob_percent is None and compounds:
            obs = [c["ob"] for c in compounds if isinstance(c.get("ob"), (int, float))]
            if obs:
                ob_percent = round(max(obs), 2)

        if dl_value is None and compounds:
            dls = [c["dl"] for c in compounds if isinstance(c.get("dl"), (int, float))]
            if dls:
                dl_value = round(max(dls), 3)

        if ob_percent is not None:
            stats["with_ob"] += 1
        if dl_value is not None:
            stats["with_dl"] += 1

        # 靶点 / 疾病数据
        targets = item.get("targets", []) or []
        diseases = item.get("diseases", []) or item.get("target_diseases", []) or []
        network_nodes = item.get("network_nodes", []) or []
        disease_network = item.get("disease_network", []) or []

        record = {
            "name_cn": name_cn,
            "name_latin": name_latin,
            "name_pinyin": name_pinyin,
            "category": category,
            "compounds": compounds,
            "targets": targets if isinstance(targets, list) else [],
            "diseases": diseases if isinstance(diseases, list) else [],
            "network_nodes": network_nodes if isinstance(network_nodes, list) else [],
            "disease_network": disease_network if isinstance(disease_network, list) else [],
            "ob_percent": ob_percent,
            "dl_value": dl_value,
            "effects": "",  # TCMSP 无此字段，预留
            "is_food_homology": is_food_homology,
            "compound_count": len(compounds),
            "target_count": len(targets) if isinstance(targets, list) else 0,
            "error": item.get("error"),
            "source_version": "tcmsp_browser_v1",
            "scraped_at": item.get("scraped_at", ""),
        }
        cleaned.append(record)

        if item.get("error"):
            stats["errors"] += 1

    # 打印清洗统计
    print(f"\n{'='*55}")
    print(f"清洗统计报告:")
    print(f"  总记录数:     {stats['total']}")
    print(f"  有中文名:     {stats['with_name']}")
    print(f"  有分类:       {stats['with_category']}")
    print(f"  有化合物数据: {stats['with_compounds']}")
    print(f"  有OB%值:     {stats['with_ob']}")
    print(f"  有DL值:      {stats['with_dl']}")
    print(f"  药食同源:     {stats['food_homology']}")
    print(f"  含错误记录:   {stats['errors']}")
    print(f"{'='*55}\n")

    return cleaned


# ═══════════════════════════════════════════════════
# Phase 2: PostgreSQL 导入
# ═══════════════════════════════════════════════════

def get_connection():
    """建立 PostgreSQL 连接"""
    try:
        conn = psycopg2.connect(**PG_CONFIG)
        conn.autocommit = False
        return conn
    except psycopg2.OperationalError as e:
        print(f"❌ 数据库连接失败: {e}")
        print(f"   配置: {PG_CONFIG}")
        sys.exit(1)


def ensure_table_exists(cur):
    """确保 tcm_herbs 表存在，不存在则创建"""
    cur.execute("""
        CREATE TABLE IF NOT EXISTS tcm_herbs (
            id              SERIAL PRIMARY KEY,
            name_cn         TEXT,
            name_latin      TEXT,
            name_pinyin     TEXT,
            category        TEXT,
            compounds       JSONB DEFAULT '[]'::jsonb,
            targets         JSONB DEFAULT '[]'::jsonb,
            diseases        JSONB DEFAULT '[]'::jsonb,
            ob_percent      DOUBLE PRECISION,
            dl_value        DOUBLE PRECISION,
            effects         TEXT DEFAULT '',
            is_food_homology BOOLEAN DEFAULT false,
            tcmsp_id        INTEGER,
            source_version  TEXT,
            synced_at       TIMESTAMPTZ,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    # 创建常用查询索引
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_tcm_herbs_name_cn ON tcm_herbs(name_cn);
        CREATE INDEX IF NOT EXISTS idx_tcm_herbs_category ON tcm_herbs(category);
        CREATE INDEX IF NOT EXISTS idx_tcm_herbs_ob ON tcm_herbs(ob_percent);
        CREATE INDEX IF NOT EXISTS idx_tcm_herbs_dl ON tcm_herbs(dl_value);
        CREATE INDEX IF NOT EXISTS idx_tcm_herbs_food ON tcm_herbs(is_food_homology);
    """)


def import_to_postgresql(data: list[dict], dry_run: bool = False):
    """
    TRUNCATE + 全量插入 tcm_herbs 表
    并执行验证查询，输出统计报告
    """
    if dry_run:
        print("⚠️  DRY-RUN 模式: 仅验证不写入数据库\n")
        _print_validation_preview(data)
        return

    conn = get_connection()
    cur = conn.cursor()

    try:
        # 确保表和索引存在
        ensure_table_exists(cur)

        # 记录旧数据量
        cur.execute("SELECT COUNT(*) FROM tcm_herbs")
        old_count = cur.fetchone()[0]
        print(f"📊 当前表中记录数: {old_count}")

        # 清空旧数据
        print("🗑️  清空旧数据 (TRUNCATE RESTART IDENTITY)...")
        cur.execute("TRUNCATE TABLE tcm_herbs RESTART IDENTITY CASCADE")
        conn.commit()

        # 批量插入
        total = len(data)
        print(f"📥 开始插入 {total} 条记录...")
        start_time = time.time()

        for i, item in enumerate(data):
            cur.execute("""
                INSERT INTO tcm_herbs (
                    name_cn, name_latin, name_pinyin, category,
                    compounds, targets, diseases,
                    ob_percent, dl_value, effects,
                    is_food_homology, tcmsp_id, source_version, synced_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                )
            """, (
                item["name_cn"],
                item["name_latin"],
                item["name_pinyin"],
                item["category"],
                Json(item["compounds"]),
                Json(item["targets"]),
                Json(item["diseases"]),
                item["ob_percent"],
                item["dl_value"],
                item["effects"],
                item["is_food_homology"],
                None,  # tcmsp_id 暂无
                item["source_version"],
            ))

            if (i + 1) % 100 == 0 or (i + 1) == total:
                elapsed = time.time() - start_time
                rate = (i + 1) / elapsed if elapsed > 0 else 0
                print(f"  已插入 {i+1:>4}/{total} ({rate:.0f} 条/s)")

        conn.commit()
        insert_elapsed = time.time() - start_time
        print(f"\n✅ 插入完成! 耗时 {insert_elapsed:.1f}s")

        # ═══ 验证查询 ═══
        run_validation_queries(cur)

    except Exception as e:
        conn.rollback()
        print(f"❌ 导入失败，已回滚: {e}")
        raise
    finally:
        cur.close()
        conn.close()


def run_validation_queries(cur):
    """执行验证查询，输出统计报告和样本数据"""
    print(f"\n{'='*60}")
    print(f"📋 验证报告")
    print(f"{'='*60}")

    queries = [
        ("总记录数",           "SELECT COUNT(*) FROM tcm_herbs"),
        ("有中文名称",         "SELECT COUNT(*) FROM tcm_herbs WHERE name_cn != '' AND name_cn IS NOT NULL"),
        ("有拉丁名",           "SELECT COUNT(*) FROM tcm_herbs WHERE name_latin != '' AND name_latin IS NOT NULL"),
        ("有拼音",             "SELECT COUNT(*) FROM tcm_herbs WHERE name_pinyin != '' AND name_pinyin IS NOT NULL"),
        ("有分类",             "SELECT COUNT(*) FROM tcm_herbs WHERE category != '' AND category IS NOT NULL"),
        ("有OB%值",           "SELECT COUNT(*) FROM tcm_herbs WHERE ob_percent IS NOT NULL"),
        ("有DL值",            "SELECT COUNT(*) FROM tcm_herbs WHERE dl_value IS NOT NULL"),
        ("有化合物数据",       "SELECT COUNT(*) FROM tcm_herbs WHERE jsonb_array_length(compounds) > 0"),
        ("有靶点数据",         "SELECT COUNT(*) FROM tcm_herbs WHERE jsonb_array_length(targets) > 0"),
        ("有疾病数据",         "SELECT COUNT(*) FROM tcm_herbs WHERE jsonb_array_length(diseases) > 0"),
        ("药食同源标记",       "SELECT COUNT(*) FROM tcm_herbs WHERE is_food_homology = true"),
        ("OB% 最大值",        "SELECT MAX(ob_percent) FROM tcm_herbs WHERE ob_percent IS NOT NULL"),
        ("DL 最大值",         "SELECT MAX(dl_value) FROM tcm_herbs WHERE dl_value IS NOT NULL"),
        ("化合物最多(单药材)", "SELECT MAX(jsonb_array_length(compounds)) FROM tcm_herbs"),
        ("分类分布 TOP5",      "SELECT category, COUNT(*) AS cnt FROM tcm_herbs WHERE category IS NOT NULL AND category != '' GROUP BY category ORDER BY cnt DESC LIMIT 5"),
    ]

    for label, sql in queries:
        cur.execute(sql)
        row = cur.fetchone()
        if len(row) == 1:
            print(f"  {label:<18}: {row[0]}")
        else:
            print(f"  {label:<18}: {row}")

    # 样本数据: 前10条
    print(f"\n{'─'*60}")
    print(f"📄 样本数据 (前10条):")
    print(f"{'─'*60}")

    cur.execute("""
        SELECT
            id, name_cn, name_latin, category,
            ob_percent, dl_value,
            jsonb_array_length(compounds) as compound_count,
            is_food_homology
        FROM tcm_herbs
        ORDER BY id
        LIMIT 10
    """)

    headers = ["ID", "中文名", "拉丁名", "分类", "OB%", "DL", "成分数", "食药"]
    print(f"  {' | '.join(f'{h:<6}' for h in headers)}")
    print(f"  {'-' * 75}")

    for row in cur.fetchall():
        line = " | ".join([
            f"{str(row[0]):>3}",
            f"{str(row[1] or ''):<6}",
            f"{str(row[2] or '')[:20]:<20}",
            f"{str(row[3] or '')[:6]:<6}",
            f"{str(row[4]) if row[4] is not None else '-':>5}",
            f"{str(row[5]) if row[5] is not None else '-':>5}",
            f"{str(row[6]):>4}",
            f"{'✓' if row[7] else ''}",
        ])
        print(f"  {line}")

    print(f"{'='*60}\n")


def _print_validation_preview(data: list[dict]):
    """DRY-RUN 模式下的预览验证（不连接数据库）"""
    total = len(data)
    with_name = sum(1 for d in data if d.get("name_cn"))
    with_ob = sum(1 for d in data if d.get("ob_percent") is not None)
    with_dl = sum(1 for d in data if d.get("dl_value") is not None)
    with_compounds = sum(1 for d in data if d.get("compound_count", 0) > 0)
    with_fh = sum(1 for d in data if d.get("is_food_homology"))

    categories = {}
    for d in data:
        cat = d.get("category", "") or "未分类"
        categories[cat] = categories.get(cat, 0) + 1

    print(f"  总记录数:       {total}")
    print(f"  有中文名称:     {with_name}")
    print(f"  有OB%值:       {with_ob}")
    print(f"  有DL值:        {with_dl}")
    print(f"  有化合物数据:   {with_compounds}")
    print(f"  药食同源:       {with_fh}")

    print(f"\n  分类分布 TOP10:")
    for cat, cnt in sorted(categories.items(), key=lambda x: -x[1])[:10]:
        print(f"    {cat}: {cnt}")

    print(f"\n  样本前5条:")
    for d in data[:5]:
        print(f"    [{d['name_cn']}] OB={d['ob_percent']} DL={d['dl_value']} "
              f"成分={d['compound_count']} 食药={'✓' if d['is_food_homology'] else ''}")


# ═══════════════════════════════════════════════════
# 主入口
# ═══════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="TCMSP 爬取数据 → PostgreSQL 导入工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python import_to_pg.py                          # 默认输入文件
  python import_to_pg.py --input my_data.json     # 自定义输入
  python import_to_pg.py --dry-run                # 仅预览不入库
        """
    )
    parser.add_argument(
        "--input", "-i",
        type=str,
        default=None,
        help="输入 JSON 文件路径 (默认: tcmsp_herbs_full.json)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="仅验证数据不写入数据库"
    )
    parser.add_argument(
        "--host",
        type=str,
        default="localhost",
        help="PostgreSQL 主机地址 (默认: localhost)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=5432,
        help="PostgreSQL 端口 (默认: 5432)"
    )
    parser.add_argument(
        "--dbname",
        type=str,
        default="rmfood_platform",
        help="数据库名 (默认: rmfood_platform)"
    )
    parser.add_argument(
        "--user",
        type=str,
        default="postgres",
        help="数据库用户 (默认: postgres)"
    )

    args = parser.parse_args()

    # 更新 PG 配置
    PG_CONFIG.update({
        "host": args.host,
        "port": args.port,
        "dbname": args.dbname,
        "user": args.user,
    })

    input_file = Path(args.input) if args.input else DEFAULT_INPUT

    print(f"{'='*60}")
    print(f"TCMSP 数据导入工具 v1.0")
    print(f"{'='*60}")
    print(f"输入文件: {input_file}")
    print(f"数据库:  {args.host}:{args.port}/{args.dbname}")
    print(f"模式:    {'DRY-RUN (仅预览)' if args.dry_run else '正式导入'}")
    print()

    # Phase 1: 加载
    raw_data = load_scraped_data(input_file)

    # Phase 2: 清洗
    cleaned_data = clean_and_standardize(raw_data)

    # Phase 3: 导入
    import_to_postgresql(cleaned_data, dry_run=args.dry_run)

    print("✅ 全部完成!")


if __name__ == "__main__":
    main()
