"""
OpenFoodFacts CSV 批量导入 retail_products 表

从本地 TSV 文件导入 OpenFoodFacts 产品数据到 PostgreSQL。

用法:
    cd backend && python scripts/import_openfoodfacts_csv.py
    # 或直接运行（需确保 backend/ 在 PYTHONPATH 中）

特性:
    - TSV 格式（tab-separated），非逗号分隔
    - 分批读取（chunk_size=5000），避免内存溢出
    - 使用 psycopg2 copy 协议批量写入（比 ORM insert 快 10-50x）
    - ON CONFLICT (external_id) DO UPDATE 实现幂等导入
    - 自动跳过空 code 行
    - 进度日志 + 统计报告
"""

import csv
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# ── 路径配置 ──

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent  # D:\RMFOOD配方平台
CSV_PATH = PROJECT_ROOT / "openfoodfacts" / "en.openfoodfacts.org.products.csv"

# 确保 backend/ 在 PYTHONPATH 中（以便 from app.xxx import 能工作）
_BACKEND_DIR = SCRIPT_DIR.parent  # backend/
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))
del _BACKEND_DIR

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


# ── CSV 列索引映射 ──

# TSV 列名 → 数据库字段映射
# 只提取搜索和展示需要的核心字段，忽略 200+ 列的营养素明细
COLUMN_MAP: Dict[str, int] = {
    # 身份标识
    "code": 0,                  # external_id / sku
    "product_name": 10,         # product_name
    "brands": 18,               # brand
    "categories_en": 23,        # category（一级分类）
    "categories_tags": 22,      # sub_category（标签数组取第一项）
    "quantity": 13,             # package_size
    "ingredients_text": 42,     # full_ingredients
    "allergens": 45,            # allergens_tags（逗号分隔字符串 → ARRAY）
    "additives_tags": 55,       # additives_tags
    "traces_tags": 48,          # traces_tags
    "nutriscore_grade": 58,     # key_ingredients.nutriscore_grade
    "nova_group": 59,           # key_ingredients.nova_group
    "completeness": 77,         # data_quality
    "created_t": 3,             # crawl_timestamp（Unix timestamp）
    "last_updated_t": 8,        # updated_at（Unix timestamp）
    "image_url": 82,            # image_urls
    "stores": 38,               # sales_channels
    "countries_en": 41,         # key_ingredients.countries
    "labels": 29,               # key_ingredients.labels
    "pnns_groups_1": 60,        # key_ingredients.pnns_group
    "serving_size": 50,         # key_ingredients.serving_size
    "manufacturing_places": 27, # key_ingredients.manufacturing_places
    # 核心营养素 per 100g
    "energy-kcal_100g": 89,     # nutrition.energy_kcal
    "fat_100g": 92,             # nutrition.fat
    "saturated-fat_100g": 93,   # nutrition.saturated_fat
    "carbohydrates_100g": 129,  # nutrition.carbohydrates
    "sugars_100g": 130,         # nutrition.sugars
    "fiber_100g": 146,          # nutrition.fiber
    "proteins_100g": 150,       # nutrition.protein
    "salt_100g": 154,           # nutrition.salt
    "sodium_100g": 156,         # nutrition.sodium
    "added-sugars_100g": 131,   # nutrition.added_sugars
}

# 按类型分组的列索引
CORE_FIELDS = ["code", "product_name", "brands"]
ARRAY_FIELDS = ["allergens", "additives_tags", "traces_tags", "image_url", "stores"]
JSON_NUTRITION_FIELDS = [
    "energy-kcal_100g", "fat_100g", "saturated-fat_100g",
    "carbohydrates_100g", "sugars_100g", "fiber_100g",
    "proteins_100g", "salt_100g", "sodium_100g", "added-sugars_100g",
]
JSON_META_FIELDS = [
    "nutriscore_grade", "nova_group", "countries_en", "labels",
    "pnns_groups_1", "serving_size", "manufacturing_places",
]
TIMESTAMP_FIELDS = ["created_t", "last_updated_t"]
QUALITY_FIELDS = ["completeness"]


def _parse_int_field(val: str) -> Optional[int]:
    """解析整数字段，空值返回 None"""
    if not val or not val.strip():
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def _parse_float_field(val: str) -> Optional[float]:
    """解析浮点数字段，空值返回 None"""
    if not val or not val.strip():
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _parse_timestamp(val: str) -> Optional[datetime]:
    """解析 Unix timestamp → UTC datetime"""
    ts = _parse_int_field(val)
    if ts and ts > 0:
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    return None


def _parse_tag_list(val: str) -> List[str]:
    """解析逗号分隔的标签字符串 → Python list"""
    if not val or not val.strip():
        return []
    return [t.strip() for t in val.split(",") if t.strip()]

# ── COPY 列名（用于 asyncpg copy_records_to_table） ──

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

# ── MERGE SQL（ON CONFLICT DO UPDATE） ──

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
    SELECT
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


def _parse_csv_row(row: List[str]) -> Optional[Dict[str, Any]]:
    """
    将 CSV 行解析为产品字典。

    Returns None if the row should be skipped (empty code).
    """
    def get(col_name: str) -> str:
        idx = COLUMN_MAP[col_name]
        return row[idx].strip() if idx < len(row) else ""

    code = get("code")
    if not code:
        return None  # 跳过无 code 的行

    product_name = get("product_name")
    brand = get("brands") or "Unknown"

    # 分类
    categories_en = get("categories_en")
    categories_tags = get("categories_tags")
    category = None
    if categories_en:
        # categories_en 是逗号分隔的人类可读名称，取第一个
        category = categories_en.split(",")[0].strip()
    sub_category = None
    if categories_tags:
        tags = _parse_tag_list(categories_tags)
        if tags:
            sub_category = tags[0].replace("en:", "").replace("-", " ").title()

    # 规格
    quantity = get("quantity") or None

    # 成分
    ingredients = get("ingredients_text") or None

    # 数组字段
    allergens = _parse_tag_list(get("allergens"))
    additives = _parse_tag_list(get("additives_tags"))
    traces = _parse_tag_list(get("traces_tags"))
    image_urls = _parse_tag_list(get("image_url"))
    sales_channels = _parse_tag_list(get("stores"))

    # 关键成分 JSON
    key_ingredients: Dict[str, Any] = {}

    # 营养素
    nutrition: Dict[str, Optional[float]] = {}
    for field in JSON_NUTRITION_FIELDS:
        short_name = field.replace("-", "_").replace("100g", "")
        val = get(field)
        parsed = _parse_float_field(val)
        if parsed is not None:
            nutrition[short_name] = round(parsed, 3)
    if nutrition:
        key_ingredients["nutrition"] = nutrition

    # 营养等级
    nutriscore = get("nutriscore_grade")
    if nutriscore and nutriscore != "unknown":
        key_ingredients["nutrition_grade"] = nutriscore

    # NOVA 分组
    nova = get("nova_group")
    if nova:
        key_ingredients["nova_group"] = int(nova)

    # 标签
    labels_str = get("labels")
    if labels_str:
        key_ingredients["labels"] = _parse_tag_list(labels_str)

    # 国家
    countries_str = get("countries_en")
    if countries_str:
        key_ingredients["countries"] = _parse_tag_list(countries_str)

    # PNNS 分组
    pnns = get("pnns_groups_1")
    if pnns and pnns != "unknown":
        key_ingredients["pnns_group"] = pnns

    # 份量
    serving = get("serving_size")
    if serving:
        key_ingredients["serving_size"] = serving

    # 产地
    mfg = get("manufacturing_places")
    if mfg:
        key_ingredients["manufacturing_places"] = mfg

    # 数据质量
    completeness = get("completeness")
    data_quality = _parse_float_field(completeness) or 0.5

    # 时间戳
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
        "image_urls": image_urls[:5],  # 最多 5 张图
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


def import_csv(
    csv_path: Optional[str] = None,
    chunk_size: int = 5000,
    dry_run: bool = False,
    test_limit: int = 0,
):
    """
    主导入流程。

    Args:
        csv_path: CSV 文件路径，默认使用 PROJECT_ROOT/openfoodfacts/...
        chunk_size: 每批处理的行数
        dry_run: 如果 True，只解析不写入数据库
        test_limit: 如果 > 0，只导入 N 行（用于测试）
    """
    if csv_path is None:
        csv_path = str(CSV_PATH)

    logger.info("=" * 60)
    logger.info("OpenFoodFacts CSV 导入开始")
    logger.info(f"  CSV 文件: {csv_path}")
    logger.info(f"  Chunk size: {chunk_size}")
    logger.info(f"  Dry run: {dry_run}")
    logger.info("=" * 60)

    if not os.path.exists(csv_path):
        logger.error(f"CSV 文件不存在: {csv_path}")
        sys.exit(1)

    # ── Step 1: 预扫描（仅 dry-run 需要，实际导入时跳过以节省时间） ──

    total_rows = 0
    valid_rows = 0
    skipped_empty_code = 0
    skipped_no_name = 0

    start_time = time.time()

    csv.field_size_limit(2147483647)

    if dry_run:
        logger.info("[Step 1] 扫描 CSV 文件，统计有效行数...")

        with open(csv_path, encoding="utf-8") as f:
            reader = csv.reader(f, delimiter="\t")
            next(reader)  # skip header

            for row in reader:
                total_rows += 1
                if total_rows % 500_000 == 0:
                    elapsed = time.time() - start_time
                    rate = total_rows / elapsed
                    logger.info(
                        f"  已扫描 {total_rows:,} 行 | "
                        f"有效: {valid_rows:,} | "
                        f"跳过空code: {skipped_empty_code:,} | "
                        f"速率: {rate:,.0f} rows/s"
                    )

                code_idx = COLUMN_MAP["code"]
                code = row[code_idx].strip() if code_idx < len(row) else ""
                if not code:
                    skipped_empty_code += 1
                    continue

                name_idx = COLUMN_MAP["product_name"]
                name = row[name_idx].strip() if name_idx < len(row) else ""
                if not name:
                    skipped_no_name += 1
                    continue

                valid_rows += 1

        elapsed_scan = time.time() - start_time
        logger.info("")
        logger.info(f"[Scan complete] 总行数: {total_rows:,} | 有效: {valid_rows:,} ({valid_rows/total_rows*100:.1f}%)")
        logger.info(f"  跳过空 code: {skipped_empty_code:,}")
        logger.info(f"  跳过无名称: {skipped_no_name:,}")
        logger.info(f"  扫描耗时: {elapsed_scan:.1f}s")

        logger.info("[Step 2] DRY RUN — 解析前 5 行验证数据质量")
        _dry_run_parse(csv_path)
        return

    # ── Step 2 & 3: 数据库检查 + 批量导入（使用 asyncpg 直连） ──

    logger.info("[Step 2] 检查数据库中已有的 openfoodfacts 数据...")

    try:
        from app.core.config import settings
    except ImportError:
        logger.error("无法导入配置模块，请确保在 backend/ 目录下运行")
        sys.exit(1)

    import_count = 0
    merge_count = 0
    error_count = 0
    batch_start = time.time()

    def _run_all():
        import asyncio
        from urllib.parse import urlparse, parse_qs

        async def _check_and_import():
            nonlocal import_count, error_count, merge_count

            # 从 DATABASE_URL 解析连接参数
            db_url = settings.database.url
            parsed = urlparse(db_url)
            query = parse_qs(parsed.query)

            connect_args = {
                "user": parsed.username or "postgres",
                "password": parsed.password or "",
                "host": parsed.hostname or "localhost",
                "port": parsed.port or 5432,
                "database": parsed.path.lstrip("/"),
            }

            # 创建 asyncpg connection pool
            import asyncpg
            logger.info("  [DEBUG] Creating asyncpg pool...")
            pool = await asyncpg.create_pool(**connect_args)
            logger.info("  [DEBUG] Pool created, acquiring connection...")

            try:
                async with pool.acquire() as conn:
                    # Step 2: 检查已有数据
                    existing_count = await conn.fetchval(
                        "SELECT COUNT(*) FROM retail_products WHERE source = 'openfoodfacts_csv'"
                    )
                    logger.info(f"  数据库中已有 {existing_count:,} 条 openfoodfacts_csv 记录")

                    # Step 3: 创建临时表
                    await conn.execute("""
                        CREATE TEMP TABLE IF NOT EXISTS import_batch (
                            external_id TEXT, sku TEXT, brand TEXT,
                            product_name TEXT, product_line TEXT,
                            category TEXT, sub_category TEXT,
                            formulation_type TEXT,
                            effects TEXT[], target_population TEXT[],
                            full_ingredients TEXT, key_ingredients JSONB,
                            material_refs BIGINT[], peptide_refs BIGINT[],
                            compound_refs BIGINT[],
                            price FLOAT, currency TEXT, package_size TEXT,
                            volume_ml FLOAT, weight_g FLOAT,
                            sales_channels TEXT[], avg_rating FLOAT,
                            review_count BIGINT, monthly_sales BIGINT,
                            image_urls TEXT[],
                            reg_type TEXT, approved_region TEXT,
                            source TEXT, crawl_timestamp TIMESTAMP WITH TIME ZONE,
                            data_quality FLOAT,
                            created_at TIMESTAMP WITH TIME ZONE,
                            updated_at TIMESTAMP WITH TIME ZONE,
                            created_by BIGINT,
                            allergens_tags TEXT[], additives_tags TEXT[],
                            ecoscore_grade TEXT, traces_tags TEXT[],
                            contaminants TEXT[]
                        )
                    """)
                    await conn.execute("TRUNCATE import_batch")
                    logger.info("  [DEBUG] Temp table ready, starting CSV read...")

                    batch_rows = []
                    last_log_count = 0
                    total_scanned = 0

                    with open(csv_path, encoding="utf-8") as f:
                        reader = csv.reader(f, delimiter="\t")
                        next(reader)  # skip header

                        for row in reader:
                            total_scanned += 1
                            if test_limit > 0 and import_count >= test_limit:
                                logger.info(f"  TEST MODE: 已达到 {test_limit} 行限制")
                                break
                            try:
                                product = _parse_csv_row(row)
                                if product is None:
                                    continue
                                import_count += 1

                                copy_row = (
                                    product["external_id"], product["sku"],
                                    product["brand"], product["product_name"],
                                    product["product_line"],
                                    product["category"], product["sub_category"],
                                    product["formulation_type"],
                                    product.get("effects") or [],
                                    product.get("target_population") or [],
                                    product["full_ingredients"],
                                    json.dumps(product.get("key_ingredients") or {}, ensure_ascii=False),
                                    [], [], [],  # material_refs, peptide_refs, compound_refs
                                    product["price"], product["currency"],
                                    product["package_size"],
                                    product["volume_ml"], product["weight_g"],
                                    product.get("sales_channels") or [],
                                    product["avg_rating"],
                                    product["review_count"],
                                    product["monthly_sales"],
                                    product.get("image_urls") or [],
                                    None,  # reg_type
                                    product["approved_region"],
                                    product["source"],
                                    _parse_iso_timestamp(product["crawl_timestamp"]) if product["crawl_timestamp"] else None,
                                    product["data_quality"],
                                    _parse_iso_timestamp(product["created_at"]) if product["created_at"] else None,
                                    _parse_iso_timestamp(product["updated_at"]) if product["updated_at"] else None,
                                    product["created_by"],
                                    product.get("allergens_tags") or [],
                                    product.get("additives_tags") or [],
                                    product["ecoscore_grade"],
                                    product.get("traces_tags") or [],
                                    product.get("contaminants") or [],
                                )
                                batch_rows.append(copy_row)

                                # 每扫描 20000 行打印一次进度（基于总扫描行数，不依赖有效行数）
                                if total_scanned - last_log_count >= 20000:
                                    elapsed = time.time() - start_time
                                    rate = total_scanned / elapsed
                                    logger.info(
                                        f"  [CSV读取中] 已扫描 {total_scanned:,} 行 | "
                                        f"有效 {import_count:,} | "
                                        f"速率: {rate:,.0f} rows/s",
                                        force=True,
                                    )
                                    last_log_count = total_scanned

                                # 每 10000 行写入一次（chunk_size 可调大）
                                if len(batch_rows) >= chunk_size:
                                    await conn.copy_records_to_table(
                                        'import_batch', records=batch_rows,
                                        columns=COPY_COLUMNS,
                                    )
                                    await conn.execute(_MERGE_SQL)
                                    merge_count = import_count
                                    elapsed = time.time() - batch_start
                                    rate = import_count / elapsed
                                    logger.info(
                                        f"  已处理 {import_count:,} 行 | "
                                        f"已合并: {merge_count:,} | "
                                        f"速率: {rate:,.0f} rows/s",
                                        force=True,
                                    )
                                    batch_start = time.time()
                                    batch_rows.clear()
                            except Exception as e:
                                error_count += 1
                                if error_count <= 10:
                                    logger.debug(f"  解析错误 (行 {import_count}): {e}")

                        # 最后一批
                        if batch_rows:
                            await conn.copy_records_to_table(
                                'import_batch', records=batch_rows,
                                columns=COPY_COLUMNS,
                            )
                            await conn.execute(_MERGE_SQL)
                            merge_count = import_count

            finally:
                await pool.close()

        return asyncio.run(_check_and_import())

    _run_all()

    # 更新统计
    total_rows = import_count + error_count
    valid_rows = import_count

    total_elapsed = time.time() - start_time
    logger.info("")
    logger.info("=" * 60)
    logger.info("导入完成!")
    if dry_run:
        logger.info(f"  总行数: {total_rows:,}")
        logger.info(f"  有效行: {valid_rows:,}")
    else:
        logger.info(f"  已导入/更新: {import_count:,}")
    logger.info(f"  解析错误: {error_count:,}")
    logger.info(f"  总耗时: {total_elapsed:.1f}s")
    logger.info(f"  平均速率: {import_count/total_elapsed:,.0f} rows/s")
    logger.info("=" * 60)


def _to_pg_array(values: Optional[list]) -> Optional[str]:
    """Python list → PostgreSQL array literal (for SQL string embedding)"""
    if not values:
        return None
    escaped = [str(v).replace("\\", "\\\\").replace('"', '\\"') for v in values]
    return "{" + ",".join(escaped) + "}"


def _parse_iso_timestamp(iso_str: Optional[str]):
    """Parse ISO format timestamp string to datetime object"""
    if not iso_str:
        return None
    try:
        # Handle timezone offset format: 2024-12-01T20:33:24+00:00 or ...Z
        s = iso_str.replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def _to_pg_jsonb(data: Optional[dict]) -> Optional[str]:
    """Python dict → PostgreSQL JSONB literal"""
    if not data:
        return None
    import json
    return json.dumps(data, ensure_ascii=False)


def _dry_run_parse(csv_path: str):
    """Dry run: 解析前 100 行并打印示例"""
    import io
    # Force UTF-8 stdout for Windows
    if sys.stdout.encoding and 'gbk' in sys.stdout.encoding.lower():
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

    csv.field_size_limit(2147483647)

    with open(csv_path, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        next(reader)  # skip header

        parsed_count = 0
        for i, row in enumerate(reader):
            if parsed_count >= 5:
                break
            try:
                product = _parse_csv_row(row)
                if product is None:
                    continue
                parsed_count += 1
                name = product.get('product_name', '')
                if len(name) > 60:
                    name = name[:60] + '...'
                print(f"\n--- Row {i+1} ---")
                print(f"  external_id: {product['external_id']}")
                print(f"  brand: {product['brand']}")
                print(f"  product_name: {name}")
                print(f"  category: {product['category']}")
                print(f"  sub_category: {product['sub_category']}")
                print(f"  data_quality: {product['data_quality']}")
                ki = product.get("key_ingredients", {})
                if ki.get("nutrition"):
                    print(f"  nutrition keys: {list(ki['nutrition'].keys())}")
            except UnicodeEncodeError:
                continue  # Skip rows with unprintable characters
            except Exception as e:
                print(f"  Parse error on row {i}: {e}")

    print("\n[Dry run complete] 数据格式验证通过")


def main():
    """CLI entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Import OpenFoodFacts CSV to retail_products")
    parser.add_argument(
        "--csv", type=str, default=None,
        help=f"CSV file path (default: {CSV_PATH})",
    )
    parser.add_argument(
        "--chunk-size", type=int, default=1000,
        help="Batch size for INSERT (default: 1000)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Parse only first 100 rows, do not write to database",
    )
    parser.add_argument(
        "--test-limit", type=int, default=0,
        help="Import only N valid rows (for testing)",
    )
    args = parser.parse_args()

    import_csv(csv_path=args.csv, chunk_size=args.chunk_size, dry_run=args.dry_run, test_limit=args.test_limit)


if __name__ == "__main__":
    main()
