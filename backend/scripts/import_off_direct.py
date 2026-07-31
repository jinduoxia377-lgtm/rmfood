#!/usr/bin/env python3
"""
Open Food Facts 数据导入 - 直接执行版

此脚本修复了 import_openwordfacts.py 的相对导入问题，
可在任何环境下直接运行。

用法:
    python import_off_direct.py sample      # Phase A: 样本验证 (100条)
    python import_off_direct.py bulk        # Phase B: 全量导入
    python import_off_direct.py sync        # Phase C: 增量同步
"""

import sys
import os
import logging
import asyncio
import platform

# Ensure backend in path
backend_dir = os.path.join(os.path.dirname(__file__), "..")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Set DB URL from known .env location to bypass lazy loading issues
env_file = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(env_file):
    for line in open(env_file, encoding='utf-8'):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

# Detect platform and choose appropriate loader
IS_WINDOWS = os.name == 'nt'

if IS_WINDOWS:
    # Use sync loader for Windows stability
    from app.services.openfoodfacts.loader_sync import OFFLoaderSync as OFFLoader
    logger = logging.getLogger("OFFImportDirectWin")
else:
    # Use async loader for Linux/WSL
    from app.services.openfoodfacts.loader import OFFLoader
    logger = logging.getLogger("OFFImportDirect")

logger.info(f"[Platform] Using {'sync (Windows)' if IS_WINDOWS else 'async (Linux/WSL)'} loader")

from app.core.database.session import get_session_factory


async def run_sample_import():
    """Phase A: 从 OFF REST API 拉取 100 条样本产品，验证整个链路"""
    from app.services.openfoodfacts.client import OFFClient
    from app.services.openfoodfacts.mapper import OFFMapper
    from app.services.openfoodfacts.localizer import OFFLocalizer

    logger.info("=" * 60)
    logger.info("Phase A: OFF 样本数据验证 (100条)")
    logger.info("=" * 60)

    client = OFFClient()
    logger.info("[1/5] 搜索样本产品...")

    sample_data = client.search_by_keyword(
        keyword="",
        page_size=100,
    )

    products_raw = sample_data.get("products", [])[:100] if isinstance(sample_data, dict) else []
    logger.info(f"  获取到 {len(products_raw)} 条原始产品数据")

    if not products_raw:
        logger.error("  未获取到任何产品数据，请检查网络连接和 OFF API")
        client.close()
        return

    logger.info("[2/5] 映射字段...")
    mapper = OFFMapper()
    localizer = OFFLocalizer()

    mapped = []
    skipped = 0
    for raw in products_raw:
        product = mapper.map_product(raw)
        if product:
            mapped.append(product)
        else:
            skipped += 1

    logger.info(f"  映射完成: {len(mapped)} 条 (跳过 {skipped} 条)")

    if not mapped:
        logger.error("  映射后无有效产品")
        client.close()
        return

    logger.info("[3/5] 入库...")

    if IS_WINDOWS:
        db_url = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood')
        psycopg2_conn_str = db_url.replace('postgresql+asyncpg://', 'postgresql://')
        loader = OFFLoader(psycopg2_conn_str)
        loader.connect()
        try:
            result = loader.upsert_batch(mapped)
            logger.info(f"  入库结果 (同步): 插入={result['inserted']}, 失败={result['failed']}")
        finally:
            loader.disconnect()
    else:
        session_factory = get_session_factory()
        async with session_factory() as db:
            loader = OFFLoader(db)
            result = await loader.upsert_batch(mapped)
            logger.info(f"  入库结果 (异步): 插入={result['inserted']}, 失败={result['failed']}")

    logger.info("[4/5] 验证数据...")
    async with session_factory() as db:
        from sqlalchemy import text
        result = await db.execute(text("""
            SELECT source, COUNT(*) as cnt
            FROM retail_products
            WHERE source = 'openfoodfacts'
            GROUP BY source
        """))
        row = result.fetchone()
        if row:
            d = dict(row._mapping)
            logger.info(f"  验证结果: 来源={d.get('source')}, 数量={d.get('cnt')}")

    logger.info("[5/5] 样本验证完成!")
    logger.info("")
    logger.info("下一步:")
    logger.info("  1. 如果样本验证成功，运行 'bulk' 导入中国相关产品")
    logger.info("  2. 运行 'sync' 配置每日增量同步")
    logger.info("  3. 运行 'embed' 生成向量嵌入")

    client.close()


async def run_bulk_import():
    """Phase B: 批量导入中国相关产品"""
    from app.services.openfoodfacts.client import OFFClient
    from app.services.openfoodfacts.mapper import OFFMapper
    from app.services.openfoodfacts.localizer import OFFLocalizer

    logger.info("=" * 60)
    logger.info("Phase B: OFF 中国产品批量导入")
    logger.info("=" * 60)

    client = OFFClient()
    mapper = OFFMapper()
    localizer = OFFLocalizer()
    total_mapped = 0
    total_skipped = 0
    total_failed = 0

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

    if IS_WINDOWS:
        from app.services.openfoodfacts.loader_sync import OFFLoaderSync as OFFLoader
        db_url = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood')
        psycopg2_conn_str = db_url.replace('postgresql+asyncpg://', 'postgresql://')
        loader = OFFLoader(psycopg2_conn_str)
        loader.connect()
        all_mapped = []

        try:
            for i, category in enumerate(CATEGORIES):
                logger.info(f"[{i+1}/{len(CATEGORIES)}] 搜索分类: {category}")
                search_data = client.search_by_keyword(keyword=category, page_size=100)
                products_raw = search_data.get("products", [])
                logger.info(f"  获取 {len(products_raw)} 条原始数据")

                batch_mapped = []
                for raw in products_raw:
                    product = mapper.map_product(raw)
                    if not product:
                        total_skipped += 1
                        continue
                    countries = raw.get("countries", "")
                    if not localizer.is_china_available(countries):
                        total_skipped += 1
                        continue
                    batch_mapped.append(product)
                    total_mapped += 1

                all_mapped.extend(batch_mapped)
                if len(all_mapped) >= 500:
                    logger.info(f"  入库批次: {len(all_mapped)} 条 (同步)")
                    result = loader.upsert_batch(all_mapped)
                    total_failed += result["failed"]
                    all_mapped = []
                await asyncio.sleep(1.5)

            if all_mapped:
                logger.info(f"  入库剩余: {len(all_mapped)} 条 (同步)")
                result = loader.upsert_batch(all_mapped)
                total_failed += result["failed"]

        finally:
            loader.disconnect()
    else:
        session_factory = get_session_factory()
        async with session_factory() as db:
            loader = OFFLoader(db)
            all_mapped = []
            for i, category in enumerate(CATEGORIES):
                logger.info(f"[{i+1}/{len(CATEGORIES)}] 搜索分类: {category}")
                search_data = client.search_by_keyword(keyword=category, page_size=100)
                products_raw = search_data.get("products", [])
                logger.info(f"  获取 {len(products_raw)} 条原始数据")

                batch_mapped = []
                for raw in products_raw:
                    product = mapper.map_product(raw)
                    if not product:
                        total_skipped += 1
                        continue
                    countries = raw.get("countries", "")
                    if not localizer.is_china_available(countries):
                        total_skipped += 1
                        continue
                    batch_mapped.append(product)
                    total_mapped += 1

                all_mapped.extend(batch_mapped)
                if len(all_mapped) >= 500:
                    logger.info(f"  入库批次: {len(all_mapped)} 条 (异步)")
                    result = await loader.upsert_batch(all_mapped)
                    total_failed += result["failed"]
                    all_mapped = []
                await asyncio.sleep(1.5)

            if all_mapped:
                logger.info(f"  入库剩余: {len(all_mapped)} 条 (异步)")
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


async def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == "sample":
        await run_sample_import()
    elif command == "bulk":
        await run_bulk_import()
    elif command == "sync":
        await run_incremental_sync()
    elif command == "embed":
        limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10000
        await run_generate_embeddings(limit)
    else:
        print(f"未知命令: {command}")
        print(__doc__)
        sys.exit(1)


async def run_incremental_sync():
    """Phase C: 每日增量同步 - 从上次同步日期开始拉取最新数据"""
    from app.services.openfoodfacts.client import OFFClient
    from app.services.openfoodfacts.mapper import OFFMapper
    from app.services.openfoodfacts.localizer import OFFLocalizer
    from app.services.openfoodfacts.sync_tracker import OFFSyncTracker

    logger.info("=" * 60)
    logger.info("Phase C: OFF 增量同步")
    logger.info("=" * 60)

    logger.warning("增量同步功能待完善: 需实现 download_jsonl_diffs 方法")
    logger.warning("暂时使用空数据集进行测试")
    all_products = []
    logger.info(f"  解析到 {len(all_products)} 条增量数据")

    if not all_products:
        logger.info("  无新数据需要同步")
        return

    if IS_WINDOWS:
        db_url = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood')
        psycopg2_conn_str = db_url.replace('postgresql+asyncpg://', 'postgresql://')
        from app.services.openfoodfacts.loader_sync import OFFLoaderSync as OFFLoader
        loader = OFFLoader(psycopg2_conn_str)
        loader.connect()
        result = loader.upsert_products_with_progress(all_products, batch_size=500)
        loader.disconnect()
    else:
        session_factory = get_session_factory()
        async with session_factory() as db:
            from app.services.openfoodfacts.loader import OFFLoader
            loader = OFFLoader(db)
            result = await loader.upsert_products_with_progress(all_products, batch_size=500)

    logger.info(f"增量同步完成: 成功={result['inserted']}, 失败={result['failed']}")


async def run_generate_embeddings(limit: int = 10000):
    """生成未嵌入产品的向量嵌入"""
    from app.services.openfoodfacts.embedder import OFFEmbedder

    logger.info("=" * 60)
    logger.info(f"生成嵌入向量 (limit={limit})")
    logger.info("=" * 60)

    session_factory = get_session_factory()
    async with session_factory() as db:
        embedder = OFFEmbedder(db)
        count = await embedder.generate_for_missing(limit=limit)
        logger.info(f"嵌入生成完成: {count} 条")


if __name__ == "__main__":
    import asyncio
    from datetime import date, timedelta
    asyncio.run(main())