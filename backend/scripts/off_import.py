#!/usr/bin/env python3
"""
OpenFoodFacts 数据导入 — 直接脚本（不依赖 services/__init__.py）

用法:
    uv run python scripts/off_import.py sample   # 样本验证 (100条)
    uv run python scripts/off_import.py bulk     # 批量导入
    uv run python scripts/off_import.py status   # 查看状态

注意: 需要 PostgreSQL 连接正常，且 retail_products 表已创建。
"""

import asyncio
import json
import logging
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Any, Optional, List

sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("OFFImport")


# ── 配置 ──

DB_URL = "postgresql+asyncpg://postgres:@localhost:5432/rmfood_db"
API_BASE = "https://world.openfoodfacts.org"
API_SEARCH = f"{API_BASE}/cgi/search.pl"
BATCH_SIZE = 500
RATE_LIMIT_DELAY = 2.5  # 每次请求间隔（秒），避免限流


def get_engine():
    return create_async_engine(DB_URL, echo=False)


def get_sf(engine):
    return async_sessionmaker(engine, expire_on_commit=False)


# ── OFF 原始数据 → retail_products 映射 ──

def map_off_product(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """将 OFF API 返回的产品字典映射为 retail_products 行数据"""
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
        if tag.startswith("en:"):
            tag = tag[3:]
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
            crawl_timestamp = datetime.fromtimestamp(int(last_modified_t), tz=timezone.utc).isoformat()
        except (ValueError, TypeError, OSError):
            pass

    checks = {
        "name": bool(product_name), "brand": bool(brand), "category": bool(category),
        "ingredients": bool(full_ingredients), "nutriments": bool(key_ingredients),
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
        "material_refs": [], "peptide_refs": [], "compound_refs": [],
        "price": None, "currency": "CNY",
        "package_size": quantity or None,
        "volume_ml": volume_ml, "weight_g": weight_g,
        "sales_channels": [],
        "avg_rating": None, "review_count": None, "monthly_sales": None,
        "image_urls": image_urls,
        "reg_number": None, "reg_type": None, "approved_region": None,
        "allergens_tags": allergens, "additives_tags": additives,
        "ecoscore_grade": raw.get("ecoscore_grade"),
        "traces_tags": traces, "contaminants": [],
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


# ── 数据库操作 ──

COLUMNS = [
    "external_id", "sku", "brand", "product_name", "product_line",
    "category", "sub_category", "formulation_type", "effects",
    "target_population", "full_ingredients", "key_ingredients",
    "material_refs", "peptide_refs", "compound_refs",
    "price", "currency", "package_size", "volume_ml", "weight_g",
    "sales_channels", "avg_rating", "review_count", "monthly_sales",
    "image_urls", "reg_type", "approved_region",
    "allergens_tags", "additives_tags", "ecoscore_grade",
    "traces_tags", "contaminants", "source", "crawl_timestamp",
    "data_quality",
]

ARRAY_COLS = {"effects", "target_population", "sales_channels", "image_urls",
              "material_refs", "peptide_refs", "compound_refs"}


def _format_value(col, val):
    """格式化值为 SQL 字面量"""
    if val is None:
        return "NULL"
    if col in ARRAY_COLS:
        if isinstance(val, list) and len(val) == 0:
            return "{}"
        elif isinstance(val, list):
            items = [f"'{str(v).replace(chr(39), chr(39)+chr(39))}'" for v in val if v is not None]
            return "{" + ",".join(items) + "}"
        return "{}"
    if col == "key_ingredients":
        if isinstance(val, dict):
            try:
                s = json.dumps(val, ensure_ascii=False).replace("'", "''")
                return f"'{s}'::jsonb"
            except (TypeError, ValueError):
                return "'{}'::jsonb"
        return "'{}'::jsonb"
    if isinstance(val, str):
        escaped = val.replace("'", "''")
        return f"'{escaped}'"
    if isinstance(val, datetime):
        return f"'{val.isoformat()}'"
    return str(val)


def build_upsert_sql(product: Dict[str, Any]) -> str:
    """生成 upsert SQL"""
    cols = ", ".join(COLUMNS)
    values = ", ".join(_format_value(c, product.get(c)) for c in COLUMNS)
    update_parts = [f"{c} = EXCLUDED.{c}" for c in COLUMNS if c not in ("external_id", "source")]
    update_parts.append("updated_at = NOW()")
    updates = ", ".join(update_parts)
    return f"INSERT INTO retail_products ({cols}) VALUES ({values}) ON CONFLICT (external_id) DO UPDATE SET {updates}"


async def upsert_batch(session, products: List[dict]):
    """批量 upsert — 每个产品独立事务"""
    from app.models.retail_product import RetailProduct
    from sqlalchemy import event

    inserted = 0
    failed = 0

    for product in products:
        try:
            # 检查是否已存在
            existing = await session.execute(
                text("SELECT id FROM retail_products WHERE external_id = :eid"),
                {"eid": product["external_id"]},
            )
            row = existing.scalar_one_or_none()

            if row:
                update_fields = []
                params = {"eid": product["external_id"]}
                for col in COLUMNS:
                    if col in ("external_id", "source"):
                        continue
                    val = product.get(col)
                    # 处理 datetime
                    if isinstance(val, datetime):
                        val = val.isoformat()
                    elif col == "crawl_timestamp" and isinstance(val, str):
                        try:
                            val = datetime.fromisoformat(val)
                        except (ValueError, TypeError):
                            pass
                    # jsonb 需要字符串
                    elif col == "key_ingredients" and isinstance(val, dict):
                        val = json.dumps(val, ensure_ascii=False)
                    update_fields.append(f"{col} = :v_{col}")
                    params[f"v_{col}"] = val
                params["now"] = datetime.now(timezone.utc)  # datetime, not string
                update_fields.append("updated_at = :now")

                sql = f"UPDATE retail_products SET {', '.join(update_fields)} WHERE external_id = :eid"
                await session.execute(text(sql), params)
                await session.commit()  # 提交当前事务
                inserted += 1
            else:
                insert_cols = ", ".join(COLUMNS)
                param_strs = [f":v_{c}" for c in COLUMNS]
                params = {}
                for c in COLUMNS:
                    val = product.get(c)
                    if isinstance(val, datetime):
                        val = val.isoformat()
                    elif c == "key_ingredients" and isinstance(val, dict):
                        val = json.dumps(val, ensure_ascii=False)  # jsonb needs string
                    elif c == "crawl_timestamp" and isinstance(val, str):
                        try:
                            val = datetime.fromisoformat(val)  # Convert ISO string to datetime
                        except (ValueError, TypeError):
                            pass
                    params[f"v_{c}"] = val
                conflict_cols = [c for c in COLUMNS if c not in ("external_id", "source")]
                updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in conflict_cols)
                sql = f"INSERT INTO retail_products ({insert_cols}) VALUES ({', '.join(param_strs)}) ON CONFLICT (external_id) DO UPDATE SET {updates}, updated_at = NOW()"
                await session.execute(text(sql), params)
                await session.commit()  # 提交当前事务
                inserted += 1

        except Exception as e:
            try:
                await session.rollback()  # 回滚失败的事务
            except Exception:
                pass
            failed += 1
            logger.error(f"upsert 失败 barcode={product.get('external_id')}: {e}")

    return {"inserted": inserted, "failed": failed}


# ── REST API 调用 ──

async def search_by_keyword(client: httpx.AsyncClient, keyword: str, page_size: int = 100):
    """关键词搜索产品，带重试"""
    params = {
        "search_terms_s": keyword,
        "search_simple": "1",
        "action": "process",
        "json": "1",
        "page_size": min(page_size, 1000),
        "page": 1,
    }
    url = f"{API_SEARCH}?{'&'.join(f'{k}={v}' for k, v in params.items())}"

    for attempt in range(5):
        try:
            resp = await client.get(url)
            if resp.status_code == 503:
                wait = 2 ** attempt
                logger.warning(f"  OFF API 限流 (503)，{wait}s 后重试...")
                await asyncio.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            if attempt < 4:
                wait = 2 ** attempt
                logger.warning(f"  请求失败: {e}，{wait}s 后重试...")
                await asyncio.sleep(wait)
            else:
                raise
    return {"products": [], "count": 0}


async def search_by_category(client: httpx.AsyncClient, category: str, max_products: int = 500):
    """按分类搜索产品"""
    all_products = []
    page = 1
    while len(all_products) < max_products:
        try:
            data = await search_by_keyword(client, category, page_size=min(100, max_products - len(all_products)))
            products = data.get("products", [])
            if not products:
                break
            all_products.extend(products)
            await asyncio.sleep(RATE_LIMIT_DELAY)
        except Exception as e:
            logger.warning(f"  搜索 '{category}' 失败: {e}")
            await asyncio.sleep(5)
            break
    return all_products[:max_products]


# ── CLI 命令 ──

async def cmd_sample():
    """样本验证"""
    logger.info("=" * 60)
    logger.info("Phase A: OFF 样本数据验证 (100条)")
    logger.info("=" * 60)

    engine = get_engine()
    sf = get_sf(engine)

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 搜索样本
        logger.info("[1/4] 搜索样本产品...")
        sample_data = await search_by_keyword(client, "", page_size=100)
        products_raw = sample_data.get("products", [])[:100]
        if not products_raw:
            logger.info("  空关键词无结果，改用热门分类...")
            cats = ["beverages", "snacks", "dairy", "breakfast cereals", "chocolate", "yogurt"]
            for cat in cats:
                products_raw = await search_by_category(client, cat, max_products=100)
                if products_raw:
                    break

        logger.info(f"  获取到 {len(products_raw)} 条原始数据")

        if not products_raw:
            logger.error("  未获取到任何产品数据")
            return

        # 映射
        logger.info("[2/4] 映射字段...")
        mapped = []
        skipped = 0
        for raw in products_raw:
            product = map_off_product(raw)
            if product:
                mapped.append(product)
            else:
                skipped += 1
        logger.info(f"  映射完成: {len(mapped)} 条 (跳过 {skipped} 条)")

        if not mapped:
            logger.error("  映射后无有效产品")
            return

        # 入库
        logger.info("[3/4] 入库...")
        async with sf() as db:
            result = await upsert_batch(db, mapped)
            logger.info(f"  入库结果: 成功={result['inserted']}, 失败={result['failed']}")

        # 验证
        logger.info("[4/4] 验证数据...")
        async with sf() as db:
            result = await db.execute(text("""
                SELECT COUNT(*) as cnt FROM retail_products WHERE source = 'openfoodfacts'
            """))
            count = result.scalar()
            logger.info(f"  数据库中 OFF 产品总数: {count}")

    await engine.dispose()
    logger.info("[5/5] 样本验证完成!")


async def cmd_bulk():
    """批量导入"""
    logger.info("=" * 60)
    logger.info("Phase B: OFF 产品批量导入")
    logger.info("=" * 60)

    engine = get_engine()
    sf = get_sf(engine)

    CATEGORIES = [
        # 饮料类
        "beverages", "dairy", "yogurt", "milk", "juice", "tea", "coffee",
        "water", "mineral water", "energy drinks", "sports drinks", "smoothies",
        # 零食类
        "snacks", "chocolate", "cookies", "crackers", "chips", "candy", "gum",
        "ice cream", "popcorn", "nuts", "seeds",
        # 谷物早餐
        "breakfast cereals", "oatmeal", "granola", "muesli", "pasta", "rice",
        "bread", "crackers",
        # 蔬果
        "fruit", "vegetables", "dried fruits", "dried vegetables", "salads",
        "canned fruits", "canned vegetables",
        # 调味品酱料
        "honey", "jam", "sauce", "condiments", "mustard", "ketchup",
        "soy sauce", "vinegar", "dressings",
        # 肉类水产
        "meat", "poultry", "beef", "pork", "sausages", "fish", "seafood",
        "shrimp", "ready meals", "frozen meals", "pizza",
        # 保健食品
        "dietetic foods", "supplements", "vitamin", "minerals", "protein supplement",
        "probiotic", "fiber", "collagen", "calcium", "iron",
        # 特殊饮食
        "vegan", "organic", "gluten free", "baby food", "tofu",
        # 其他高频搜索词
        "beer", "wine", "liqueur", "cocoa", "spread", "pudding", "cake",
        "pastry", "croissant", "donut", "marmalade", "peanut butter",
    ]

    total_mapped = 0
    total_skipped = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        async with sf() as db:
            all_mapped = []

            for i, category in enumerate(CATEGORIES):
                logger.info(f"[{i+1}/{len(CATEGORIES)}] 搜索分类: {category}")
                products_raw = await search_by_category(client, category, max_products=200)
                logger.info(f"  获取 {len(products_raw)} 条原始数据")

                batch_mapped = []
                for raw in products_raw:
                    product = map_off_product(raw)
                    if not product:
                        total_skipped += 1
                        continue
                    batch_mapped.append(product)
                    total_mapped += 1

                all_mapped.extend(batch_mapped)

                if len(all_mapped) >= BATCH_SIZE:
                    result = await upsert_batch(db, all_mapped)
                    logger.info(f"  入库批次: {result['inserted']} 条")
                    all_mapped = []

                await asyncio.sleep(RATE_LIMIT_DELAY)

            # 入库剩余
            if all_mapped:
                result = await upsert_batch(db, all_mapped)
                logger.info(f"  入库剩余: {result['inserted']} 条")

    await engine.dispose()
    logger.info("")
    logger.info("=" * 60)
    logger.info(f"导入完成! 成功: {total_mapped}, 跳过: {total_skipped}")
    logger.info("=" * 60)


async def cmd_status():
    """查看状态"""
    logger.info("=" * 60)
    logger.info("OFF 同步状态")
    logger.info("=" * 60)

    engine = get_engine()
    sf = get_sf(engine)

    async with sf() as db:
        result = await db.execute(text("""
            SELECT COUNT(*) as total,
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

    await engine.dispose()


async def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1].lower()
    commands = {
        "sample": cmd_sample,
        "bulk": cmd_bulk,
        "status": cmd_status,
    }

    if command not in commands:
        print(f"未知命令: {command}")
        sys.exit(1)

    await commands[command]()


if __name__ == "__main__":
    asyncio.run(main())
