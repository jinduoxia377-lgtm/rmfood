#!/usr/bin/env python3
"""
Open Food Facts 数据本地化同步脚本

核心思路：从 JSONL diffs 下载完整产品数据库到本地 PostgreSQL，
不再依赖实时 REST API。

用法:
    uv run python -m scripts.off_sync init       # 首次全量导入（最近30天diff）
    uv run python -m scripts.off_sync sync        # 增量同步（今天）
    uv run python -m scripts.off_sync status      # 查看同步状态
    uv run python -m scripts.off_sync report      # 生成报告

注意:
    - 首次全量导入约需 2-4 小时（取决于网络）
    - 增量同步每次只需几分钟
    - 需要 PostgreSQL 连接正常
"""

import asyncio
import gzip
import json
import logging
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("OFFSync")


# ── 配置 ──

DB_URL = "postgresql+asyncpg://postgres:@localhost:5432/rmfood_db"
JSONL_BASE = "https://static.openfoodfacts.org/data/diffs"
BATCH_SIZE = 1000
MAX_DAYS_BACK = 30  # 首次全量导入回溯天数


def get_engine():
    return create_async_engine(DB_URL, echo=False)


def get_session_factory(engine):
    return async_sessionmaker(engine, expire_on_commit=False)


# ── OFF 原始 JSON → retail_products 映射 ──

def map_off_product(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """将 OFF JSONL diff 记录映射为 retail_products 行数据"""
    barcode = raw.get("code") or raw.get("product_id")
    product_name = raw.get("product_name") or raw.get("generic_name")

    if not barcode or not product_name:
        return None

    brands = raw.get("brands", "")
    brand = brands.split(",")[0].strip() if brands else "Unknown"

    categories_tags = raw.get("categories_tags", [])
    if isinstance(categories_tags, str):
        categories_tags = [t.strip() for t in categories_tags.split(",")]

    def clean_tag(tag):
        tag = re.sub(r"^en:", "", tag) if tag.startswith("en:") else tag
        return tag.replace("-", " ").title()

    category = clean_tag(categories_tags[0]) if categories_tags else None
    sub_category = clean_tag(categories_tags[1]) if len(categories_tags) > 1 else None

    full_ingredients = raw.get("ingredients_text") or raw.get("ingredients_text_zh")

    nutriments = raw.get("nutriments", {})
    key_ingredients = {}
    if nutriments:
        for k in ["energy-kcal", "proteins", "fat", "carbohydrates", "sugars", "fiber", "sodium"]:
            v = nutriments.get(f"{k}_100g")
            if v is not None and float(v) > 0:
                key_ingredients[k] = round(float(v), 4)
        nova = nutriments.get("nova-group") or nutriments.get("nova_group")
        if nova:
            key_ingredients["nova_group"] = int(nova)
        score = nutriments.get("nutrition-score-fr") or nutriments.get("nutrition_grade_fr")
        if score:
            key_ingredients["nutrition_grade"] = str(score).upper()

    quantity = raw.get("quantity", "")
    volume_ml, weight_g = parse_quantity(quantity)

    image_urls = []
    for prefix in ("image_front", "image_ingredients", "image_nutrition", "image_packaging"):
        url = raw.get(f"{prefix}_url") or raw.get(prefix)
        if url:
            if url.startswith("//"):
                url = "https:" + url
            image_urls.append(url)
    image_urls = image_urls[:5]

    allergens = raw.get("allergens_tags") or []
    if isinstance(allergens, str):
        allergens = [t.strip() for t in allergens.split(",")]
    additives = raw.get("additives_tags") or []
    if isinstance(additives, str):
        additives = [t.strip() for t in additives.split(",")]
    traces = raw.get("traces_tags") or []
    if isinstance(traces, str):
        traces = [t.strip() for t in traces.split(",")]

    labels = raw.get("labels_tags") or []
    if isinstance(labels, str):
        labels = [l.strip() for l in labels.split(",")]

    effects = []
    effect_map = {
        "no-added-sugar": "低糖", "sugar-free": "无糖", "low-fat": "低脂",
        "high-fibre": "高纤维", "high-protein": "高蛋白", "organic": "有机",
        "vegan": "纯素", "vegetarian": "素食", "gluten-free": "无麸质",
        "probiotic": "益生菌",
    }
    for tag in labels:
        tag_lower = tag.lower().replace("-", "_")
        if tag_lower in effect_map:
            effects.append(effect_map[tag_lower])

    countries = raw.get("countries", "")
    countries_list = [c.strip() for c in countries.split(",") if c.strip()] if countries else []

    last_modified_t = raw.get("last_modified_t")
    crawl_timestamp = None
    if last_modified_t:
        try:
            crawl_timestamp = datetime.fromtimestamp(int(last_modified_t), tz=__import__("datetime").timezone.utc).isoformat()
        except (ValueError, TypeError, OSError):
            pass

    # 数据质量评分
    checks = {
        "name": bool(product_name),
        "brand": bool(brand),
        "category": bool(category),
        "ingredients": bool(full_ingredients),
        "nutriments": bool(key_ingredients),
        "images": bool(image_urls),
    }
    data_quality = round(sum(1 for v in checks.values() if v) / len(checks), 2)

    return {
        "external_id": str(barcode).strip(),
        "sku": str(barcode).strip(),
        "brand": brand,
        "product_name": str(product_name).strip(),
        "product_line": None,
        "category": category,
        "sub_category": sub_category,
        "formulation_type": None,
        "effects": effects[:10],
        "target_population": [],
        "full_ingredients": full_ingredients,
        "key_ingredients": key_ingredients,
        "material_refs": [],
        "peptide_refs": [],
        "compound_refs": [],
        "price": None,
        "currency": "CNY",
        "package_size": quantity or None,
        "volume_ml": volume_ml,
        "weight_g": weight_g,
        "sales_channels": [],
        "avg_rating": None,
        "review_count": None,
        "monthly_sales": None,
        "image_urls": image_urls,
        "reg_number": None,
        "reg_type": None,
        "approved_region": None,
        "allergens_tags": allergens,
        "additives_tags": additives,
        "ecoscore_grade": raw.get("ecoscore_grade"),
        "traces_tags": traces,
        "contaminants": [],
        "source": "openfoodfacts",
        "crawl_timestamp": crawl_timestamp,
        "data_quality": data_quality,
    }


def parse_quantity(qty_str: str):
    """解析数量描述"""
    if not qty_str:
        return None, None
    import re
    vol_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:ml|milliliter|liter)", qty_str, re.I)
    weight_match = re.search(r"(\d+(?:\.\d+)?)\s*g(?:ram)?(?:s)?\b", qty_str, re.I)
    volume = float(vol_match.group(1)) if vol_match else None
    weight = float(weight_match.group(1)) if weight_match else None
    mult_match = re.search(r"(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(ml|g)", qty_str, re.I)
    if mult_match:
        m = float(mult_match.group(1))
        a = float(mult_match.group(2))
        u = mult_match.group(3).lower()
        if u == "ml":
            volume = a * m
        elif u == "g":
            weight = a * m
    return volume, weight


import re  # for map_off_product


# ── 批量入库 ──

async def upsert_batch(session, products: list[dict]):
    """批量 upsert 产品"""
    inserted = 0
    updated = 0
    failed = 0

    cols = ["external_id", "sku", "brand", "product_name", "product_line",
            "category", "sub_category", "formulation_type", "effects",
            "target_population", "full_ingredients", "key_ingredients",
            "material_refs", "peptide_refs", "compound_refs",
            "price", "currency", "package_size", "volume_ml", "weight_g",
            "sales_channels", "avg_rating", "review_count", "monthly_sales",
            "image_urls", "reg_number", "reg_type", "approved_region",
            "allergens_tags", "additives_tags", "ecoscore_grade",
            "traces_tags", "contaminants", "source", "crawl_timestamp",
            "data_quality"]

    for product in products:
        try:
            values = [product.get(c) for c in cols]
            update_sets = []
            for c in cols:
                if c in ("external_id", "source"):
                    continue
                update_sets.append(f'{c} = EXCLUDED.{c}')
            update_sets.append("updated_at = NOW()")

            sql = f"""
                INSERT INTO retail_products ({', '.join(cols)})
                VALUES ({', '.join(['%s'] * len(cols))})
                ON CONFLICT (external_id) DO UPDATE SET
                    {', '.join(update_sets)}
            """
            await session.execute(text(sql), values)
            inserted += 1
        except Exception as e:
            failed += 1
            logger.debug(f"upsert 失败 barcode={product.get('external_id')}: {e}")

    await session.commit()
    return {"inserted": inserted, "updated": updated, "failed": failed}


# ── 同步追踪 ──

async def get_last_sync_date(session) -> Optional[date]:
    """获取上次同步日期"""
    try:
        result = await session.execute(text("""
            SELECT last_sync_date FROM off_sync_state
            WHERE source = 'openfoodfacts'
            ORDER BY last_sync_date DESC LIMIT 1
        """))
        row = result.fetchone()
        if row and row[0]:
            return row[0].date() if hasattr(row[0], 'date') else date.fromisoformat(str(row[0]))
    except Exception:
        pass
    return None


async def mark_sync_complete(session, sync_date: date, processed: int, failed: int):
    """更新同步状态"""
    await session.execute(text("""
        INSERT INTO off_sync_state (source, last_sync_date, total_processed, total_failed, status, completed_at)
        VALUES ('openfoodfacts', :sync_date, :processed, :failed, 'completed', NOW())
        ON CONFLICT (source) DO UPDATE SET
            last_sync_date = EXCLUDED.last_sync_date,
            total_processed = EXCLUDED.total_processed,
            total_failed = EXCLUDED.total_failed,
            status = EXCLUDED.status,
            completed_at = NOW()
    """), {"sync_date": sync_date, "processed": processed, "failed": failed})
    await session.commit()


# ── 主同步逻辑 ──

async def sync_diffs(from_date: date, to_date: date):
    """从 JSONL diffs 下载并导入产品"""
    engine = get_engine()
    sf = get_session_factory(engine)

    async with sf() as db:
        total_inserted = 0
        total_failed = 0
        batch = []
        day_count = 0

        current_date = from_date
        while current_date <= to_date:
            date_str = current_date.strftime("%Y-%m-%d")
            url = f"{JSONL_BASE}/{date_str}.jsonl.gz"
            day_count += 1

            logger.info(f"[{day_count}] 下载增量: {date_str}")

            try:
                import httpx
                async with httpx.AsyncClient(timeout=60.0) as http:
                    resp = await http.get(url)
                    resp.raise_for_status()
                    data = gzip.decompress(resp.content)
            except Exception as e:
                logger.warning(f"  跳过 {date_str}: {e}")
                current_date += timedelta(days=1)
                continue

            line_count = 0
            mapped_count = 0
            for line in data.decode("utf-8").split("\n"):
                line = line.strip()
                if not line:
                    continue
                line_count += 1

                try:
                    raw = json.loads(line)
                except json.JSONDecodeError:
                    continue

                mapped = map_off_product(raw)
                if mapped:
                    batch.append(mapped)
                    mapped_count += 1

                if len(batch) >= BATCH_SIZE:
                    result = await upsert_batch(db, batch)
                    total_inserted += result["inserted"]
                    total_failed += result["failed"]
                    batch = []
                    logger.info(f"  已入库: {total_inserted} 条 (line_count={line_count}, mapped={mapped_count})")

            if batch:
                result = await upsert_batch(db, batch)
                total_inserted += result["inserted"]
                total_failed += result["failed"]
                batch = []

            current_date += timedelta(days=1)

        await mark_sync_complete(db, to_date, total_inserted, total_failed)

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"同步完成: 成功={total_inserted}, 失败={total_failed}, 处理天数={day_count}")
    logger.info("=" * 60)
    return {"inserted": total_inserted, "failed": total_failed}


# ── CLI 命令 ──

async def cmd_init():
    """首次全量导入"""
    logger.info("=" * 60)
    logger.info("OFF 数据首次全量导入")
    logger.info("=" * 60)

    engine = get_engine()
    sf = get_session_factory(engine)

    async with sf() as db:
        # 检查是否已有数据
        result = await db.execute(text("SELECT COUNT(*) FROM retail_products WHERE source = 'openfoodfacts'"))
        count = result.scalar()
        if count and count > 100:
            logger.info(f"  数据库中已有 {count} 条 OFF 产品数据")
            logger.info("  如需重新导入，请先清空: DELETE FROM retail_products WHERE source = 'openfoodfacts'")
            return

    last_date = await get_last_sync_date(sf)
    if last_date:
        from_date = last_date + timedelta(days=1)
    else:
        from_date = date.today() - timedelta(days=MAX_DAYS_BACK)

    logger.info(f"  同步范围: {from_date} → {date.today()}")
    logger.info(f"  预计产品数: ~{(date.today() - from_date).days * 10000} 条")
    logger.info("  开始导入...")

    await sync_diffs(from_date, date.today())
    await engine.dispose()


async def cmd_sync():
    """增量同步（今天）"""
    logger.info("=" * 60)
    logger.info("OFF 增量同步")
    logger.info("=" * 60)

    engine = get_engine()
    sf = get_session_factory(engine)

    today = date.today()
    logger.info(f"  同步日期: {today}")
    await sync_diffs(today, today)
    await engine.dispose()
    await engine.dispose()


async def cmd_status():
    """查看同步状态"""
    engine = get_engine()
    sf = get_session_factory(engine)

    async with sf() as db:
        # 统计
        result = await db.execute(text("""
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding,
                   ROUND(AVG(data_quality)::numeric, 2) as avg_quality,
                   COUNT(DISTINCT brand) as unique_brands,
                   COUNT(DISTINCT category) as unique_categories
            FROM retail_products WHERE source = 'openfoodfacts'
        """))
        row = result.fetchone()
        if row:
            d = dict(row._mapping)
            logger.info(f"  总产品数: {d.get('total', 0)}")
            logger.info(f"  品牌数: {d.get('unique_brands', 0)}")
            logger.info(f"  分类数: {d.get('unique_categories', 0)}")
            logger.info(f"  平均质量: {d.get('avg_quality', 0)}")
        else:
            logger.info("  暂无数据")

        # 同步状态
        result = await db.execute(text("""
            SELECT last_sync_date, total_processed, status, completed_at
            FROM off_sync_state WHERE source = 'openfoodfacts'
            ORDER BY last_sync_date DESC LIMIT 1
        """))
        row2 = result.fetchone()
        if row2:
            d = dict(row2._mapping)
            logger.info(f"  最后同步: {d.get('last_sync_date')}")
            logger.info(f"  已处理: {d.get('total_processed', 0)}")
            logger.info(f"  状态: {d.get('status')}")
            logger.info(f"  完成时间: {d.get('completed_at')}")

    await engine.dispose()


async def cmd_report():
    """生成导入报告"""
    engine = get_engine()
    sf = get_session_factory(engine)

    async with sf() as db:
        result = await db.execute(text("""
            SELECT category, COUNT(*) as cnt
            FROM retail_products
            WHERE source = 'openfoodfacts' AND category IS NOT NULL
            GROUP BY category ORDER BY cnt DESC LIMIT 20
        """))
        rows = result.fetchall()
        logger.info("分类分布 Top 20:")
        for r in rows:
            d = dict(r._mapping)
            logger.info(f"  {d['category']}: {d['cnt']}")

    await engine.dispose()


async def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1].lower()
    commands = {
        "init": cmd_init,
        "sync": cmd_sync,
        "status": cmd_status,
        "report": cmd_report,
    }

    if command not in commands:
        print(f"未知命令: {command}")
        print(__doc__)
        sys.exit(1)

    await commands[command]()


if __name__ == "__main__":
    asyncio.run(main())
