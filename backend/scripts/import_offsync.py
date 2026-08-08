#!/usr/bin/env python3
"""
OpenFoodFacts CSV 批量导入 retail_products - PostgreSQL 同步版 (Windows 兼容)

修复方案：
1. 强制使用 UTF-8 编码模式以解决中文字符路径问题
2. 使用 psycopg2 替代 asyncpg 以避免 Windows 连接不稳定
3. 显式处理所有文件路径为 UTF-8
"""

import os
import sys

# ========== 关键修复：强制 UTF-8 模式 ==========
# 这解决了中文字符路径导致的 UnicodeDecodeError
if hasattr(sys, "setfilesystemencoding"):
    try:
        # 尝试设置文件系统编码为 UTF-8
        os.environ['PYTHONUTF8'] = '1'
        os.environ['LC_ALL'] = 'en_US.UTF-8'
        os.environ['LANG'] = 'en_US.UTF-8'
    except:
        pass

# 确保所有字符串都以 UTF-8 处理
if sys.version_info >= (3, 7):
    import locale
    locale.setlocale(locale.LC_ALL, 'UTF-8')
except:
    pass

# ========== 现在导入其他库 ==========
import csv
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

# ── 路径配置 - 使用绝对路径避免 Unicode 问题 ──

# 获取脚本所在目录的父目录（backend）
SCRIPT_DIR = Path(__file__).resolve()
PROJECT_ROOT = SCRIPT_DIR.parent.parent  # 应该是 D:\RMFOOD配方平台

# 转换为短路径（8.3 格式）以避免 Unicode 问题
def get_short_path(long_path):
    """将长路径转换为短路径（Windows API），避免 Unicode 问题"""
    try:
        import ctypes
        from ctypes.wintypes import CHAR, DWORD, BOOL, HANDLE, LPSTR, LPVOID
        kernel32 = ctypes.windll.kernel32

        buffer = ctypes.create_string_buffer(260)
        result = kernel32.GetShortPathNameW(str(long_path), buffer, 260)
        if result > 0 and result < 260:
            return buffer.value.decode('mbcs')
    except:
        pass
    return str(long_path)

# 使用短路径处理 CSV 路径
CSV_PATH_STR = str(PROJECT_ROOT / "openfoodfacts" / "en.openfoodfacts.org.products.csv")
CSV_PATH = Path(CSV_PATH_STR)

# 如果路径包含特殊字符，使用短路径
if not CSV_PATH.exists():
    short_root = get_short_path(PROJECT_ROOT)
    short_csv_path = Path(short_root) / "openfoodfacts" / "en.openfoodfacts.org.products.csv"
    if short_csv_path.exists():
        CSV_PATH = short_csv_path
        logger = logging.getLogger(__name__)
        logger.info(f"Using short path: {short_csv_path}")

# ── 日志配置 ──

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("import_offsync.log", encoding='utf-8', mode='w'),
    ],
)
logger = logging.getLogger(__name__)

# ── CSV 列索引映射 ──

COLUMN_MAP = {
    "code": 0,
    "product_name": 10,
    "brands": 18,
    "categories_en": 23,
    "categories_tags": 22,
    "quantity": 13,
    "ingredients_text": 42,
    "allergens": 45,
    "additives_tags": 55,
    "traces_tags": 48,
    "nutriscore_grade": 58,
    "nova_group": 59,
    "completeness": 77,
    "created_t": 3,
    "last_updated_t": 8,
    "image_url": 82,
    "stores": 38,
    "countries_en": 41,
    "labels": 29,
    "pnns_groups_1": 60,
    "serving_size": 50,
    "manufacturing_places": 27,
    "energy-kcal_100g": 89,
    "fat_100g": 92,
    "saturated-fat_100g": 93,
    "carbohydrates_100g": 129,
    "sugars_100g": 130,
    "fiber_100g": 146,
    "proteins_100g": 150,
    "salt_100g": 154,
    "sodium_100g": 156,
    "added-sugars_100g": 131,
}

# ── 辅助函数 ──

def _parse_int_field(val: str) -> Optional[int]:
    if not val or not val.strip():
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def _parse_float_field(val: str) -> Optional[float]:
    if not val or not val.strip():
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _parse_timestamp(val: str) -> Optional[datetime]:
    ts = _parse_int_field(val)
    if ts and ts > 0:
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    return None


def _parse_tag_list(val: str) -> List[str]:
    if not val or not val.strip():
        return []
    return [t.strip() for t in val.split(",") if t.strip()]


# ── COPY 列名 ──

COPY_COLUMNS = [
    'external_id', 'sku', 'brand', 'product_name', 'product_line',
    'category', 'sub_category', 'formulation_type',
    'effects', 'target_population',
    'full_ingredients', 'key_ingredients',
    'material_refs', 'peptide_refs', 'compound_refs',
    'price', 'currency', 'package_size',
    'volume_ml', 'weight_g',
    'sales_channels', 'avg_rating', 'review_count', 'monthly_sales',
    'image_urls',
    'reg_type', 'approved_region',
    'source', 'crawl_timestamp', 'data_quality',
    'created_at', 'updated_at', 'created_by',
    'allergens_tags', 'additives_tags', 'ecoscore_grade',
    'traces_tags', 'contaminants',
]


# ── 编码检测 ──

def _detect_encoding(file_path: str, sample_size: int = 1024) -> str:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            f.read(sample_size)
        return 'utf-8'
    except UnicodeDecodeError:
        try:
            with open(file_path, 'r', encoding='gbk') as f:
                f.read(sample_size)
            logger.warning("使用GBK编码检测OpenFoodFacts CSV文件")
            return 'gbk'
        except UnicodeDecodeError:
            raise ValueError(f"无法识别文件编码: {file_path}")


# ── UPSERT SQL ──

_MERGE_SQL = """
INSERT INTO retail_products (
    external_id, sku, brand, product_name, product_line,
    category, sub_category, formulation_type,
    effects, target_population,
    full_ingredients, key_ingredients,
    material_refs, peptide_refs, compound_refs,
    price, currency, package_size,
    volume_ml, weight_g,
    sales_channels, avg_rating, review_count, monthly_sales,
    image_urls,
    reg_type, approved_region,
    source, crawl_timestamp, data_quality,
    created_at, updated_at, created_by,
    allergens_tags, additives_tags, ecoscore_grade,
    traces_tags, contaminants
)
SELECT DISTINCT ON (ib.external_id)
    ib.external_id, ib.sku, ib.brand, ib.product_name, ib.product_line,
    ib.category, ib.sub_category, ib.formulation_type,
    ib.effects, ib.target_population,
    ib.full_ingredients, ib.key_ingredients,
    ib.material_refs, ib.peptide_refs, ib.compound_refs,
    ib.price, ib.currency, ib.package_size,
    ib.volume_ml, ib.weight_g,
    ib.sales_channels, ib.avg_rating, ib.review_count, ib.monthly_sales,
    ib.image_urls,
    ib.reg_type, ib.approved_region,
    ib.source, ib.crawl_timestamp, ib.data_quality,
    ib.created_at, ib.updated_at, ib.created_by,
    ib.allergens_tags, ib.additives_tags, ib.ecoscore_grade,
    ib.traces_tags, ib.contaminants
FROM import_batch ib
ORDER BY ib.external_id, ib.ctid DESC
ON CONFLICT (external_id) DO UPDATE SET
    brand = EXCLUDED.brand,
    product_name = EXCLUDED.product_name,
    product_line = EXCLUDED.product_line,
    category = EXCLUDED.category,
    sub_category = EXCLUDED.sub_category,
    formulation_type = EXCLUDED.formulation_type,
    effects = EXCLUDED.effects,
    target_population = EXCLUDED.target_population,
    full_ingredients = EXCLUDED.full_ingredients,
    key_ingredients = EXCLUDED.key_ingredients,
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    package_size = EXCLUDED.package_size,
    volume_ml = EXCLUDED.volume_ml,
    weight_g = EXCLUDED.weight_g,
    sales_channels = EXCLUDED.sales_channels,
    avg_rating = EXCLUDED.avg_rating,
    review_count = EXCLUDED.review_count,
    monthly_sales = EXCLUDED.monthly_sales,
    image_urls = EXCLUDED.image_urls,
    reg_type = EXCLUDED.reg_type,
    approved_region = EXCLUDED.approved_region,
    embedding = EXCLUDED.embedding,
    source = EXCLUDED.source,
    crawl_timestamp = EXCLUDED.crawl_timestamp,
    data_quality = EXCLUDED.data_quality,
    updated_at = EXCLUDED.updated_at,
    allergens_tags = EXCLUDED.allergens_tags,
    additives_tags = EXCLUDED.additives_tags,
    ecoscore_grade = EXCLUDED.ecoscore_grade,
    traces_tags = EXCLUDED.traces_tags,
    contaminants = EXCLUDED.contaminants
"""


# ── CSV 行解析 ──

def _parse_csv_row(row: List[str]) -> Optional[Dict[str, Any]]:
    def get(col_name: str) -> str:
        idx = COLUMN_MAP[col_name]
        return row[idx].strip() if idx < len(row) else ""

    code = get("code")
    if not code:
        return None

    product_name = get("product_name")
    brand = get("brands") or "Unknown"

    if len(product_name) > 500:
        product_name = product_name[:500]
    if len(brand) > 200:
        brand = brand[:200]

    categories_en = get("categories_en")
    categories_tags = get("categories_tags")
    category = None
    if categories_en:
        cat = categories_en.split(",")[0].strip()
        category = cat[:100] if len(cat) > 100 else cat
    sub_category = None
    if categories_tags:
        tags = _parse_tag_list(categories_tags)
        if tags:
            sub_cat = tags[0].replace("en:", "").replace("-", " ").title()
            sub_category = sub_cat[:100] if len(sub_cat) > 100 else sub_category

    quantity_raw = get("quantity") or ""
    quantity = quantity_raw[:50] if len(quantity_raw) > 50 else (quantity_raw or None)

    ingredients = get("ingredients_text") or None

    allergens = _parse_tag_list(get("allergens"))
    additives = _parse_tag_list(get("additives_tags"))
    traces = _parse_tag_list(get("traces_tags"))
    image_urls = _parse_tag_list(get("image_url"))
    sales_channels = _parse_tag_list(get("stores"))

    key_ingredients: Dict[str, Any] = {}

    nutrition: Dict[str, Optional[float]] = {}
    for field in JSON_NUTRITION_FIELDS:
        short_name = field.replace("-", "_").replace("100g", "")
        val = get(field)
        parsed = _parse_float_field(val)
        if parsed is not None:
            nutrition[short_name] = round(parsed, 3)
    if nutrition:
        key_ingredients["nutrition"] = nutrition

    nutriscore = get("nutriscore_grade")
    if nutriscore and nutriscore != "unknown":
        key_ingredients["nutrition_grade"] = nutriscore

    nova = get("nova_group")
    if nova:
        key_ingredients["nova_group"] = int(nova)

    labels_str = get("labels")
    if labels_str:
        key_ingredients["labels"] = _parse_tag_list(labels_str)

    countries_str = get("countries_en")
    if countries_str:
        key_ingredients["countries"] = _parse_tag_list(countries_str)

    pnns = get("pnns_groups_1")
    if pnns and pnns != "unknown":
        key_ingredients["pnns_group"] = pnns

    serving = get("serving_size")
    if serving:
        key_ingredients["serving_size"] = serving

    mfg = get("manufacturing_places")
    if mfg:
        key_ingredients["manufacturing_places"] = mfg

    completeness = get("completeness")
    data_quality = _parse_float_field(completeness) or 0.5

    created_ts = get("created_t")
    crawl_timestamp = _parse_timestamp(created_ts)
    updated_ts = get("last_updated_t")
    updated_at = _parse_timestamp(updated_ts)

    return {
        "external_id": code,
        "sku": code,
        "brand": brand,
        "product_name": product_name,
        "product_line": None,
        "category": category,
        "sub_category": sub_category,
        "formulation_type": None,
        "effects": [],
        "target_population": [],
        "full_ingredients": ingredients,
        "key_ingredients": key_ingredients if key_ingredients else {},
        "price": None,
        "currency": "CNY",
        "package_size": quantity,
        "volume_ml": None,
        "weight_g": None,
        "sales_channels": sales_channels,
        "avg_rating": None,
        "review_count": None,
        "monthly_sales": None,
        "image_urls": image_urls[:5],
        "reg_number": None,
        "reg_type": None,
        "approved_region": None,
        "allergens_tags": allergens,
        "additives_tags": additives,
        "ecoscore_grade": None,
        "traces_tags": traces,
        "contaminants": [],
        "source": "openfoodfacts_csv",
        "data_quality": data_quality,
        "crawl_timestamp": crawl_timestamp.isoformat() if crawl_timestamp else None,
        "created_at": None,
        "updated_at": updated_at.isoformat() if updated_at else None,
        "created_by": None,
    }


# ── 导入主函数 ──

def import_csv_psycopg2(
    csv_path: Optional[str] = None,
    chunk_size: int = 10000,
    test_limit: int = 0,
    drop_index: bool = True,
    target_table: str = "retail_products",
) -> Dict[str, Any]:
    """
    使用 psycopg2 的 OpenFoodFacts CSV 导入函数（Windows 兼容版本）。

    该脚本通过以下方式确保 Windows 兼容性：
    1. 强制 UTF-8 编码模式
    2. 使用短路径绕开 Unicode 问题
    3. 所有字符串显式编码处理
    4. 避免使用中文路径的文件操作
    """
    if csv_path is None:
        csv_path = str(CSV_PATH)

    logger.info("=" * 60)
    logger.info("OpenFoodFacts CSV 导入开始（psycopg2 sync，Windows 兼容版）")
    logger.info(f"  CSV 文件: {csv_path}")
    logger.info(f"  Chunk size: {chunk_size}")
    logger.info(f"  Test limit: {test_limit}")
    logger.info(f"  Drop index: {drop_index}")
    logger.info(f"  Target table: {target_table}")
    logger.info("=" * 60)

    if not os.path.exists(csv_path):
        logger.error(f"CSV 文件不存在: {csv_path}")
        return {"error": f"File not found: {csv_path}", "success": False}

    # 检测文件编码
    try:
        encoding = _detect_encoding(csv_path)
        logger.info(f"  文件编码: {encoding}")
    except ValueError as e:
        logger.error(f"编码检测失败: {e}")
        return {"error": str(e), "success": False}

    file_size = os.path.getsize(csv_path)
    task_id = str(uuid.uuid4())

    total_rows = 0
    valid_rows = 0
    skipped_empty_code = 0
    skipped_no_name = 0
    error_rows = 0
    import_count = 0
    merge_count = 0

    start_time = time.time()

    csv.field_size_limit(2147483647)

    # Step 1: 预扫描总行数
    logger.info("[预扫描阶段] 扫描 CSV 文件，统计有效行数...")
    detected_encoding = encoding
    with open(csv_path, encoding=detected_encoding) as f:
        reader = csv.reader(f, delimiter="\t")
        next(reader)

        scan_count = 0
        valid_scan_count = 0
        empty_code_count = 0
        no_name_count = 0

        for row in reader:
            scan_count += 1
            code_idx = COLUMN_MAP["code"]
            code = row[code_idx].strip() if code_idx < len(row) else ""
            if not code:
                empty_code_count += 1
                continue
            name_idx = COLUMN_MAP["product_name"]
            name = row[name_idx].strip() if name_idx < len(row) else ""
            if not name:
                no_name_count += 1
                continue
            valid_scan_count += 1

    total_rows = scan_count
    logger.info(f"  预扫描完成: 总 {total_rows:,} 行，有效 {valid_scan_count:,} (空code {empty_code_count:,}, 无名称 {no_name_count:,})")

    # Step 2: 连接数据库
    logger.info("[Step 2] 通过 psycopg2 连接 PostgreSQL...")

    try:
        from app.core.config import settings
    except ImportError:
        logger.error("无法导入配置模块，请确保在 backend/ 目录下运行")
        return {"error": "Config import failed", "success": False}

    # 构建 psycopg2 连接字符串，避开 Unicode 问题
    db_url = settings.database.url
    # 从 postgresql+asyncpg://user:password@host:port/dbname 提取参数
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    db_url = db_url.replace("+asyncpg", "")

    # 添加客户端编码设置以解决 Windows Unicode 问题
    db_url_with_encoding = f"{db_url}?client_encoding=UTF8"
    logger.info(f"  Psycopg2 连接字符串: {db_url_with_encoding[:40]}...")

    import psycopg2
    from psycopg2.extras import execute_values

    conn = None
    try:
        conn = psycopg2.connect(db_url_with_encoding)
        conn.autocommit = False
        cursor = conn.cursor()

        logger.info("  PostgreSQL 连接成功!")

        # 检查已有数据
        existing_count = cursor.execute(
            "SELECT COUNT(*) FROM retail_products WHERE source = 'openfoodfacts_csv'"
        ).fetchval()
        logger.info(f"  数据库中已有 {existing_count:,} 条 openfoodfacts_csv 记录")

        # 创建任务记录
        now = datetime.now(timezone.utc)
        cursor.execute("""
            INSERT INTO import_tasks (
                task_id, user_id, adapter_type, target_table, status,
                total_rows, processed_rows, inserted_rows, updated_rows, error_rows,
                progress_pct, file_name, file_size_bytes, mapping_config,
                created_at, updated_at
            ) VALUES (
                $1, $2, 'csv-sync-win', $3, 'pending',
                0, 0, 0, 0, 0, 0.0, $4, $5, '{"target_table": $3}',
                $6, $7
            )
            RETURNING task_id
            """, (task_id, None, target_table, os.path.basename(csv_path), file_size, now.isoformat(), now.isoformat()))
        task_id = cursor.fetchone()[0]
        logger.info(f"  导入任务已注册 (task_id: {task_id})")

        # 可选 DROP 索引
        if drop_index:
            logger.info("  [优化] 临时 DROP external_id 唯一索引以加速导入...")
            cursor.execute("DROP INDEX IF EXISTS ix_retail_products_external_id")
            conn.commit()
            logger.info("  [优化] 索引已 DROP，开始导入...")

        # 读取 CSV 并批量 upsert
        logger.info("  开始数据导入...")

        batch_size = chunk_size
        batch_products = []
        last_log_count = 0
        total_scanned = 0
        errors_logged = 0

        with open(csv_path, encoding=detected_encoding) as f:
            reader = csv.reader(f, delimiter="\t")
            next(reader)

            for row_num, row in enumerate(reader, start=2):
                if test_limit > 0 and import_count >= test_limit:
                    logger.info("  TEST MODE: 已达到测试限制")
                    break

                code_idx = COLUMN_MAP["code"]
                code = row[code_idx].strip() if code_idx < len(row) else ""
                if not code:
                    error_rows += 1
                    continue

                name_idx = COLUMN_MAP["product_name"]
                name = row[name_idx].strip() if name_idx < len(row) else ""
                if not name:
                    error_rows += 1
                    continue

                product = _parse_csv_row(row)
                if product is None:
                    continue
                import_count += 1
                total_scanned += 1

                batch_products.append(product)

                if total_scanned - last_log_count >= 5000:
                    elapsed = time.time() - start_time
                    rate = total_scanned / elapsed
                    logger.info(
                        f"  [CSV处理中] 已扫描 {total_scanned:,} 行 | "
                        f"有效 {import_count:,} | "
                        f"速率: {rate:,.0f} rows/s",
                    )
                    last_log_count = total_scanned

                if len(batch_products) >= batch_size:
                    # 准备值
                    values = []
                    for p in batch_products:
                        row_vals = []
                        for col in OFFLoaderSync.COLUMNS:
                            val = p.get(col)
                            if col in OFFLoaderSync.ARRAY_COLS and isinstance(val, list):
                                row_vals.append(OFFLoaderSync._format_array(val))
                            elif val is None:
                                row_vals.append(None)
                            elif col == "key_ingredients" and isinstance(val, dict):
                                row_vals.append(json.dumps(val, ensure_ascii=False))
                            else:
                                row_vals.append(val)
                        values.append(tuple(row_vals))

                    insert_sql = f"""
                        INSERT INTO retail_products ({', '.join(OFFLoaderSync.COLUMNS)})
                        VALUES %s
                        ON CONFLICT (external_id) DO UPDATE SET
                            {', '.join([f"{col} = EXCLUDED.{col}" for col in OFFLoaderSync.COLUMNS if col not in ('external_id', 'source')])},
                            updated_at = NOW()
                    """
                    execute_values(cursor, insert_sql, values, page_size=100)
                    conn.commit()
                    batch_products.clear()
                    logger.info(f"  批次完成: 已提交 {len(values)} 条记录")

        # 最后一批
        if batch_products:
            values = []
            for p in batch_products:
                row_vals = []
                for col in OFFLoaderSync.COLUMNS:
                    val = p.get(col)
                    if col in OFFLoaderSync.ARRAY_COLS and isinstance(val, list):
                        row_vals.append(OFFLoaderSync._format_array(val))
                    elif val is None:
                        row_vals.append(None)
                    elif col == "key_ingredients" and isinstance(val, dict):
                        row_vals.append(json.dumps(p.get("key_ingredients"), ensure_ascii=False))
                    else:
                        row_vals.append(val)
                values.append(tuple(row_vals))

            insert_sql = f"""
                INSERT INTO retail_products ({', '.join(OFFLoaderSync.COLUMNS)})
                VALUES %s
                ON CONFLICT (external_id) DO UPDATE SET
                    {', '.join([f"{col} = EXCLUDED.{col}" for col in OFFLoaderSync.COLUMNS if col not in ('external_id', 'source')])},
                    updated_at = NOW()
            """
            execute_values(cursor, insert_sql, values, page_size=100)
            conn.commit()
            logger.info(f"  最终批次完成: 提交 {len(values)} 条记录")

        # 重建索引
        if drop_index:
            logger.info("  [优化] 重建 external_id 唯一索引...")
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS ix_retail_products_external_id
                ON retail_products (external_id)
            """)
            conn.commit()
            logger.info("  [优化] 索引重建完成")

        # 更新任务状态
        final_progress = round((import_count / total_rows * 100), 1) if total_rows > 0 else 100.0
        cursor.execute("""
            UPDATE import_tasks SET
                status = 'completed',
                total_rows = $1,
                processed_rows = $2,
                inserted_rows = $3,
                updated_rows = 0,
                error_rows = $4,
                progress_pct = $5,
                updated_at = $6
            WHERE task_id = $7
            """, (total_rows, total_rows, import_count, error_rows, final_progress, now.isoformat(), task_id))
        conn.commit()

        logger.info(f"  导入完成: {import_count:,} 成功, {error_rows:,} 错误")

    except Exception as e:
        logger.error(f"Import failed: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

    total_elapsed = time.time() - start_time
    logger.info("")
    logger.info("=" * 60)
    logger.info("导入完成!")
    logger.info(f"  总行数: {total_rows:,}")
    logger.info(f"  成功导入/更新: {import_count:,}")
    logger.info(f"  解析错误: {error_rows:,}")
    logger.info(f"  总耗时: {total_elapsed:.1f}s")
    logger.info(f"  平均速率: {import_count/total_elapsed:,.0f} rows/s")
    logger.info("=" * 60)

    return {
        "task_id": task_id,
        "total_rows": total_rows,
        "imported_count": import_count,
        "error_count": error_rows,
        "inserted_count": import_count,
        "updated_count": 0,
        "success_rate": round((import_count / total_rows * 100), 1) if total_rows > 0 else 0,
        "total_time_sec": total_elapsed,
        "success": True,
    }


# ── OFFLoaderSync 类（用于数组格式化） ──

class OFFLoaderSync:
    ARRAY_COLS = {"effects", "target_population", "sales_channels", "image_urls",
                  "material_refs", "peptide_refs", "compound_refs"}

    COLUMNS = [
        "external_id", "sku", "brand", "product_name", "product_line",
        "category", "sub_category", "formulation_type", "effects",
        "target_population", "full_ingredients", "key_ingredients",
        "material_refs", "peptide_refs", "compound_refs",
        "price", "currency", "package_size", "volume_ml", "weight_g",
        "sales_channels", "avg_rating", "review_count", "monthly_sales",
        "image_urls", "reg_type", "approved_region",
        "embedding", "source", "crawl_timestamp", "data_quality",
    ]

    @staticmethod
    def _format_array(val):
        if val is None or (isinstance(val, list) and len(val) == 0):
            return "{}"
        if isinstance(val, list):
            items = []
            for v in val:
                if v is None:
                    continue
                s = str(v).replace("'", "''")
                items.append(f"'{s}'")
            return "{" + ",".join(items) + "}"
        return str(val)


# ── CLI 入口 ──

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Import OpenFoodFacts CSV to retail_products (psycopg2 sync, Windows compatible)")
    parser.add_argument("--csv", type=str, default=None, help="CSV file path")
    parser.add_argument("--chunk-size", type=int, default=10000, help="Batch size for INSERT")
    parser.add_argument("--test-limit", type=int, default=0, help="Import only N valid rows")
    parser.add_argument("--no-drop-index", action="store_true", help="Do NOT drop/rebuild unique index")
    args = parser.parse_args()

    import_csv_psycopg2(
        csv_path=args.csv,
        chunk_size=args.chunk_size,
        test_limit=args.test_limit,
        drop_index=not args.no_drop_index,
    )


if __name__ == "__main__":
    main()
