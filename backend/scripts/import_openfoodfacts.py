#!/usr/bin/env python3
"""
Open Food Facts 数据导入 CLI

用法:
    python -m scripts.import_openfoodfacts sample      # Phase A: 样本验证 (100条)
    python -m scripts.import_openfoodfacts bulk         # Phase B: 全量导入
    python -m scripts.import_openfoodfacts sync         # Phase C: 增量同步
    python -m scripts.import_openfoodfacts embed        # 生成嵌入向量
    python -m scripts.import_openfoodfacts status       # 查看同步状态
    python -m scripts.import_openfoodfacts report       # 生成导入报告

环境变量:
    OFF_API_BASE=https://world.openfoodfacts.org
    OFF_CHINA_ONLY=true    # 仅导入中国相关产品
    OFF_LOG_DIR=./logs/off_import
"""
import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime, date, timezone
from pathlib import Path

# 确保 backend 在 path 中
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database.session import async_session_factory


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("OFFImport")


def get_async_session():
    """创建异步数据库会话（使用应用的真实 AsyncEngine 工厂）"""
    return async_session_factory


# ── Phase A: 样本验证 ──

async def run_sample_import():
    """
    Phase A: 从 REST API 拉取 100 条样本产品，验证整个链路
    """
    # 直接包导入（避免 spec_from_file_location 导致 relative import 失败）
    from app.services.openfoodfacts.client import OFFClient
    from app.services.openfoodfacts.mapper import OFFMapper
    from app.services.openfoodfacts.localizer import OFFLocalizer
    from app.services.openfoodfacts.loader import OFFLoader

    logger.info("=" * 60)
    logger.info("Phase A: OFF 样本数据验证 (100条)")
    logger.info("=" * 60)

    session_factory = get_async_session()

    # 1. 创建客户端
    client = OFFClient()

    # 2. 搜索样本产品
    logger.info("[1/5] 搜索样本产品...")
    sample_data = client.search_by_keyword(
        keyword="",  # 空关键词 = 获取最新产品
        page_size=100,
    )

    if not sample_data or sample_data.get("count", 0) == 0:
        # 尝试用热门分类搜索
        logger.info("  空关键词无结果，改用热门分类搜索...")
        sample_data = client.search_products_batch(
            categories=["beverages", "snacks", "dairy", "breakfast cereals"],
            max_products=100,
        )
        products_raw = sample_data if isinstance(sample_data, list) else sample_data.get("products", [])
    else:
        products_raw = sample_data.get("products", [])[:100]
    logger.info(f"  获取到 {len(products_raw)} 条原始产品数据")

    if not products_raw:
        logger.error("  未获取到任何产品数据，请检查网络连接")
        return

    # 3. 映射字段
    logger.info("[2/5] 映射字段...")
    mapper = OFFMapper()
    localizer = OFFLocalizer()

    mapped = []
    skipped = 0
    for raw in products_raw:
        product = mapper.map_product(raw)
        if product:
            # 中国产品过滤 (Phase A 不过滤，全部导入)
            mapped.append(product)
        else:
            skipped += 1

    logger.info(f"  映射完成: {len(mapped)} 条 (跳过 {skipped} 条)")

    if not mapped:
        logger.error("  映射后无有效产品")
        return

    # 4. 入库
    logger.info("[3/5] 入库...")
    async with session_factory() as db:
        loader = OFFLoader(db)
        result = await loader.upsert_batch(mapped)
        logger.info(f"  入库结果: {result}")

    # 5. 验证
    logger.info("[4/5] 验证数据...")
    async with session_factory() as db:
        from sqlalchemy import text
        result = await db.execute(text("""
            SELECT source, COUNT(*) as cnt,
                   AVG(data_quality) as avg_quality,
                   COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding
            FROM retail_products
            WHERE source = 'openfoodfacts'
            GROUP BY source
        """))
        row = result.fetchone()
        if row:
            d = dict(row._mapping)
            logger.info(f"  验证结果:")
            logger.info(f"    来源: {d.get('source')}")
            logger.info(f"    数量: {d.get('cnt')}")
            logger.info(f"    平均质量: {d.get('avg_quality', 0):.2f}")
            logger.info(f"    含嵌入: {d.get('with_embedding', 0)}")

    logger.info("[5/5] 样本验证完成!")
    logger.info("")
    logger.info("下一步:")
    logger.info("  1. 如果样本验证成功，运行 'bulk' 导入中国相关产品")
    logger.info("  2. 运行 'embed' 生成向量嵌入")
    logger.info("  3. 运行 'sync' 配置每日增量同步")
    logger.info("")

    client.close()


# ── Phase B: 中国产品精选导入 ──

async def run_bulk_import(china_only: bool = True):
    """
    Phase B: 批量导入中国相关产品

    通过 REST API 搜索 + 分页拉取，避免一次性下载 2GB TSV。
    """
    from app.services.openfoodfacts.client import OFFClient
    from app.services.openfoodfacts.mapper import OFFMapper
    from app.services.openfoodfacts.localizer import OFFLocalizer
    from app.services.openfoodfacts.loader import OFFLoader

    logger.info("=" * 60)
    logger.info("Phase B: OFF 中国产品批量导入")
    logger.info("=" * 60)

    session_factory = get_async_session()
    client = OFFClient()
    mapper = OFFMapper()
    localizer = OFFLocalizer()
    total_mapped = 0
    total_skipped = 0
    total_failed = 0

    # 热门分类列表 (用于批量搜索)
    CATEGORIES = [
        "beverages", "dairy", "breakfast cereals", "snacks",
        "chocolate", "cookies", "juice", "tea", "coffee",
        "fruit", "vegetables", "nuts", "protein",
        "baby food", "dietetic foods", "yogurt", "milk",
        "bread", "soup", "honey", "jam", "pasta",
        "rice", "oil", "sauce", "condiment",
        "vitamin", "supplement", "protein supplement",
        "collagen", "probiotic", "fiber",
    ]

    async with session_factory() as db:
        loader = OFFLoader(db)
        all_mapped = []

        for i, category in enumerate(CATEGORIES):
            logger.info(f"[{i+1}/{len(CATEGORIES)}] 搜索分类: {category}")

            # 搜索该产品分类
            search_data = client.search_by_keyword(
                keyword=category,
                page_size=100,
            )

            products_raw = search_data.get("products", [])
            logger.info(f"  获取 {len(products_raw)} 条原始数据")

            # 映射 + 过滤
            batch_mapped = []
            for raw in products_raw:
                product = mapper.map_product(raw)
                if not product:
                    total_skipped += 1
                    continue

                # 中国产品过滤
                if china_only:
                    countries = raw.get("countries", "")
                    if not localizer.is_china_available(countries):
                        total_skipped += 1
                        continue

                batch_mapped.append(product)
                total_mapped += 1

            all_mapped.extend(batch_mapped)

            # 每积累 500 条入库一次
            if len(all_mapped) >= 500:
                logger.info(f"  入库批次: {len(all_mapped)} 条")
                result = await loader.upsert_batch(all_mapped)
                total_failed += result["failed"]
                all_mapped = []

            # 限速: 避免触发 OFF 限频
            await asyncio.sleep(1.5)

        # 入库剩余
        if all_mapped:
            logger.info(f"  入库剩余: {len(all_mapped)} 条")
            result = await loader.upsert_batch(all_mapped)
            total_failed += result["failed"]

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"导入完成!")
    logger.info(f"  成功: {total_mapped} 条")
    logger.info(f"  跳过: {total_skipped} 条")
    logger.info(f"  失败: {total_failed} 条")
    logger.info("=" * 60)

    client.close()


# ── Phase C: 增量同步 ──

async def run_incremental_sync():
    """
    Phase C: 每日增量同步

    从上次同步日期开始，拉取最新 JSONL diff。
    """
    from app.services.openfoodfacts.client import OFFClient
    from app.services.openfoodfacts.mapper import OFFMapper
    from app.services.openfoodfacts.localizer import OFFLocalizer
    from app.services.openfoodfacts.loader import OFFLoader
    from app.services.openfoodfacts.sync_tracker import OFFSyncTracker

    logger.info("=" * 60)
    logger.info("Phase C: OFF 增量同步")
    logger.info("=" * 60)

    session_factory = get_async_session()
    client = OFFClient()
    mapper = OFFMapper()
    localizer = OFFLocalizer()

    async with session_factory() as db:
        tracker = OFFSyncTracker(db)

        # 获取上次同步日期
        last_date = await tracker.get_last_completed_date()
        if last_date:
            from_date = last_date + timedelta(days=1)
            logger.info(f"  从上次同步日期 {last_date} 开始增量...")
        else:
            # 没有上次记录，回溯 7 天
            from_date = date.today() - timedelta(days=7)
            logger.info(f"  无上次同步记录，回溯 7 天: {from_date}")

        to_date = date.today()
        logger.info(f"  同步范围: {from_date} → {to_date}")

        # 下载增量
        all_products = []
        for product in client.download_jsonl_diffs(from_date, to_date):
            mapped = mapper.map_product(product)
            if mapped:
                all_products.append(mapped)

        logger.info(f"  解析到 {len(all_products)} 条增量数据")

        if not all_products:
            logger.info("  无新数据需要同步")
            return

        # 入库
        loader = OFFLoader(db)
        result = await loader.upsert_products_with_progress(all_products, batch_size=500)

        # 更新同步状态
        await tracker.mark_sync_complete(
            sync_date=to_date,
            processed=len(all_products),
            updated=result["inserted"],
            failed=result["failed"],
        )

    logger.info(f"增量同步完成: 成功={result['inserted']}, 失败={result['failed']}")
    client.close()


# ── 嵌入生成 ──

async def run_generate_embeddings(limit: int = 10000):
    """生成未嵌入产品的向量"""
    from app.services.openfoodfacts.embedder import OFFEmbedder

    logger.info("=" * 60)
    logger.info(f"生成嵌入向量 (limit={limit})")
    logger.info("=" * 60)

    session_factory = get_async_session()

    async with session_factory() as db:
        embedder = OFFEmbedder(db)
        count = await embedder.generate_for_missing(limit=limit)
        logger.info(f"嵌入生成完成: {count} 条")


# ── 状态查询 ──

async def run_status():
    """查看同步状态"""
    from app.services.openfoodfacts.sync_tracker import OFFSyncTracker

    logger.info("=" * 60)
    logger.info("OFF 同步状态")
    logger.info("=" * 60)

    session_factory = get_async_session()

    async with session_factory() as db:
        tracker = OFFSyncTracker(db)
        status = await tracker.get_sync_status()

        for key, value in status.items():
            logger.info(f"  {key}: {value}")

    # 统计 retail_products 中 OFF 来源的数据
    async with session_factory() as db:
        from sqlalchemy import text
        result = await db.execute(text("""
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding,
                AVG(data_quality) as avg_quality,
                MIN(crawl_timestamp) as earliest,
                MAX(crawl_timestamp) as latest
            FROM retail_products
            WHERE source = 'openfoodfacts'
        """))
        row = result.fetchone()
        if row:
            d = dict(row._mapping)
            logger.info("")
            logger.info("retail_products 统计:")
            logger.info(f"  总数: {d.get('total', 0)}")
            logger.info(f"  含嵌入: {d.get('with_embedding', 0)}")
            logger.info(f"  平均质量: {d.get('avg_quality', 0):.2f}")
            logger.info(f"  最早爬取: {d.get('earliest')}")
            logger.info(f"  最新爬取: {d.get('latest')}")


# ── 报告生成 ──

async def run_report():
    """生成导入报告"""
    logger.info("=" * 60)
    logger.info("OFF 数据导入报告")
    logger.info("=" * 60)

    session_factory = get_async_session()

    async with session_factory() as db:
        from sqlalchemy import text

        # 1. 总体统计
        result = await db.execute(text("""
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding,
                ROUND(AVG(data_quality), 2) as avg_quality,
                COUNT(DISTINCT brand) as unique_brands,
                COUNT(DISTINCT category) as unique_categories,
                MIN(created_at) as first_import,
                MAX(updated_at) as last_update
            FROM retail_products
            WHERE source = 'openfoodfacts'
        """))
        row = result.fetchone()
        if row:
            d = dict(row._mapping)
            logger.info(f"\n总体统计:")
            logger.info(f"  总产品数: {d.get('total', 0)}")
            logger.info(f"  含嵌入向量: {d.get('with_embedding', 0)}")
            logger.info(f"  平均数据质量: {d.get('avg_quality', 0)}")
            logger.info(f"  品牌数: {d.get('unique_brands', 0)}")
            logger.info(f"  分类数: {d.get('unique_categories', 0)}")
            logger.info(f"  首次导入: {d.get('first_import')}")
            logger.info(f"  最后更新: {d.get('last_update')}")

        # 2. 分类分布 Top 10
        result = await db.execute(text("""
            SELECT category, COUNT(*) as cnt
            FROM retail_products
            WHERE source = 'openfoodfacts' AND category IS NOT NULL
            GROUP BY category
            ORDER BY cnt DESC
            LIMIT 10
        """))
        rows = result.fetchall()
        if rows:
            logger.info(f"\n分类分布 Top 10:")
            for r in rows:
                rd = dict(r._mapping)
                logger.info(f"  {rd.get('category')}: {rd.get('cnt')}")

        # 3. 数据质量分布
        result = await db.execute(text("""
            SELECT
                COUNT(CASE WHEN data_quality >= 0.8 THEN 1 END) as high,
                COUNT(CASE WHEN data_quality >= 0.5 AND data_quality < 0.8 THEN 1 END) as medium,
                COUNT(CASE WHEN data_quality < 0.5 THEN 1 END) as low
            FROM retail_products
            WHERE source = 'openfoodfacts'
        """))
        row = result.fetchone()
        if row:
            d = dict(row._mapping)
            logger.info(f"\n数据质量分布:")
            logger.info(f"  高质量 (≥0.8): {d.get('high', 0)}")
            logger.info(f"  中质量 (0.5-0.8): {d.get('medium', 0)}")
            logger.info(f"  低质量 (<0.5): {d.get('low', 0)}")


# ── CLI 入口 ──

async def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1].lower()

    commands = {
        "sample": run_sample_import,
        "bulk": lambda: run_bulk_import(china_only=os.getenv("OFF_CHINA_ONLY", "true").lower() == "true"),
        "sync": run_incremental_sync,
        "embed": run_generate_embeddings,
        "status": run_status,
        "report": run_report,
    }

    if command not in commands:
        print(f"未知命令: {command}")
        print(__doc__)
        sys.exit(1)

    logger.info(f"执行命令: {command}")
    try:
        await commands[command]()
    except Exception as err:
        logger.error(f"命令执行失败: {err}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
