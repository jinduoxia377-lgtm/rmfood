#!/usr/bin/env python3
"""
RMFOOD 零售产品数据导入完整执行脚本

此脚本将：
1. 检测数据库连接状态
2. 应用必要的数据库迁移
3. 检查 retail_products 表是否存在
4. 如果表中无数据，则导入模拟数据
5. 生成完整的导入报告和验证结果

使用前请先配置 .env 文件中的 DATABASE_URL。
"""

import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# 添加项目根目录到路径
PROJECT_ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger(__name__)


# ── 数据库配置 ──────────────────────────────────────────────


async def get_db_session():
    """获取异步数据库会话"""
    try:
        from app.core.database.session import async_session_factory
        async with async_session_factory() as session:
            return session
    except Exception as e:
        logger.error(f"无法连接数据库: {e}")
        return None


# ── 迁移检查 ───────────────────────────────────────────────


async def check_migrations(session):
    """检查并应用数据库迁移"""
    try:
        from alembic.config import Config
        from alembic import command
        from sqlalchemy import text

        alembic_dir = PROJECT_ROOT / "backend" / "alembic"
        alembic_ini = alembic_dir / "alembic.ini"

        if alembic_ini.exists():
            logger.info("正在检查数据库迁移...")
            alembic_cfg = Config(str(alembic_ini))
            # 从 .env 读取数据库 URL
            db_url = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:@localhost:5432/rmfood_db")
            alembic_cfg.set("main", "sqlalchemy.url", db_url)

            # 尝试升级到头版本
            command.upgrade(alembic_cfg.config, "head")
            logger.info("✅ 数据库迁移已应用")
            return True
    except Exception as e:
        logger.warning(f"迁移检查跳过 (可能是非生产环境): {e}")
    return False


# ── 表结构检查 ──────────────────────────────────────────────


async def ensure_table_exists(session):
    """确保 retail_products 表存在，不存在则创建"""
    try:
        from app.models.retail_product import RetailProduct
        from sqlalchemy import create_engine
        from app.core.database.db_config import get_database_url

        db_url = get_database_url()
        engine = create_async_engine(db_url)

        async with engine.begin() as conn:
            await conn.run_sync(RetailProduct.metadata.create_all)
            logger.info("✅ retail_products 表已确保存在")
            return True
    except Exception as e:
        logger.error(f"表创建失败: {e}")
        return False


# ── 模拟数据导入 ──────────────────────────────────────────


async def import_mock_retail_products(session):
    """导入模拟零售产品数据用于验证"""
    from app.models.retail_product import RetailProduct

    RETAIL_PRODUCTS_MOCK = [
        {
            "brand": "汤臣倍健",
            "product_name": "汤臣倍健 胶原蛋白肽口服液",
            "category": "保健食品",
            "formulation_type": "口服液",
            "effects": ["补充胶原蛋白", "抗氧化"],
            "price": 198.0,
            "currency": "CNY",
            "package_size": "300ml",
            "sales_channels": ["京东", "天猫"],
            "avg_rating": 4.8,
            "data_quality": 0.85,
        },
        {
            "brand": "同仁堂",
            "product_name": "同仁堂 黄芪精口服液",
            "category": "中成药",
            "formulation_type": "口服液",
            "effects": ["补气固表", "增强免疫"],
            "price": 68.0,
            "currency": "CNY",
            "package_size": "10ml x 10支",
            "sales_channels": ["线下门店"],
            "avg_rating": 4.7,
            "data_quality": 0.82,
        },
        {
            "brand": "东阿阿胶",
            "product_name": "东阿阿胶 阿胶糕",
            "category": "保健食品",
            "formulation_type": "即食",
            "effects": ["补血滋阴", "延缓衰老"],
            "price": 398.0,
            "currency": "CNY",
            "package_size": "500g",
            "weight_g": 500.0,
            "sales_channels": ["天猫", "京东"],
            "avg_rating": 4.9,
            "data_quality": 0.90,
        },
    ]

    now = datetime.now(timezone.utc)
    inserted = 0

    for data in RETAIL_PRODUCTS_MOCK:
        product = RetailProduct(
            external_id=f"mock_{inserted:03d}",
            sku=f"SKU-{inserted:04d}",
            brand=data["brand"],
            product_name=data["product_name"],
            product_line=None,
            category=data.get("category"),
            sub_category=None,
            formulation_type=data.get("formulation_type"),
            effects=data.get("effects", []),
            target_population=[],
            full_ingredients=None,
            key_ingredients={},
            material_refs=[],
            peptide_refs=[],
            compound_refs=[],
            price=data.get("price"),
            currency=data.get("currency", "CNY"),
            package_size=data.get("package_size"),
            volume_ml=None,
            weight_g=data.get("weight_g"),
            sales_channels=data.get("sales_channels", []),
            avg_rating=data.get("avg_rating"),
            review_count=None,
            monthly_sales=None,
            reg_number=None,
            reg_type=None,
            approved_region=None,
            allergens_tags=[],
            additives_tags=[],
            ecoscore_grade=None,
            traces_tags=[],
            contaminants=None,
            embedding=None,
            source="mock",
            crawl_timestamp=None,
            data_quality=data.get("data_quality", 0.8),
            created_at=now,
            updated_at=now,
            created_by=None,
        )
        session.add(product)
        inserted += 1

    await session.commit()
    logger.info(f"✅ 成功导入 {inserted} 条模拟零售产品数据")
    return inserted


# ── OFF 全量导入 ───────────────────────────────────────────


async def run_off_full_import():
    """运行完整的 OpenFoodFacts 导入（独立脚本）"""
    import_script = PROJECT_ROOT / "backend" / "scripts" / "import_openfoodfacts_csv.py"

    if import_script.exists():
        logger.info(f"⏳ 启动完整 OFF 数据导入 ({import_script.name})...")
        logger.info(
            "注意：这是一个独立脚本，需要单独运行。它将被从主进程分离。"
        )
        # 在实际生产中，您应该单独运行这个脚本
        # subprocess.Popen([sys.executable, str(import_script)])
        logger.info(
            "📝 建议：在终端单独运行 'python scripts/import_openfoodfacts_csv.py' 进行全量导入。"
        )
        return False
    else:
        logger.warning("OFF 导入脚本未找到，跳过全量导入")
        return False


# ── 验证查询 ────────────────────────────────────────────────


async def verify_data(session):
    """执行数据验证查询并返回结果"""
    from app.models.retail_product import RetailProduct
    from sqlalchemy import func, select

    results = {}

    try:
        # 总记录数
        count_result = await session.execute(func.count(RetailProduct.id))
        results["total_products"] = count_result.scalar() or 0

        # 有品牌的数量
        branded_result = await session.execute(
            select(func.count()).where(RetailProduct.brand != None)
        )
        results["branded_products"] = branded_result.scalar() or 0

        # 带数据的品牌数
        brands_result = await session.execute(
            select(func.distinct(RetailProduct.brand))
        )
        results["unique_brands"] = len([r for r in brands_result.scalars()])

        # 平均质量
        qual_result = await session.execute(
            select(func.avg(RetailProduct.data_quality))
        )
        results["avg_data_quality"] = round(qual_result.scalar() or 0, 2)

        # 检查是否有 embedding
        emb_result = await session.execute(
            select(func.count()).where(RetailProduct.embedding != None)
        )
        results["products_with_embedding"] = emb_result.scalar() or 0

        # Top 5 品类
        cat_result = await session.execute(
            select(RetailProduct.category, func.count())
            .group_by(RetailProduct.category)
            .order_by(func.desc(func.count()))
            .limit(5)
        )
        categories = [(row[0], row[1]) for row in cat_result.scalars()]
        results["top_categories"] = categories

        logger.info("✅ 数据验证完成")
    except Exception as e:
        logger.warning(f"验证查询失败 (可能表为空或无数据): {e}")
        results["error"] = str(e)

    return results


# ── 主流程 ──────────────────────────────────────────────────


async def main():
    """主入口函数"""
    logger.info("=" * 60)
    logger.info("🔍 RMFOOD 零售产品数据导入审查与执行系统")
    logger.info("=" * 60)
    print()

    # 步骤 1: 数据库连接测试
    logger.info("🔍 步骤 1: 检测数据库连接...")
    session = await get_db_session()

    if session is None:
        logger.warning("⚠️  无法连接到数据库 (PostgreSQL 可能未运行)")
        logger.info("   使用 SQLite 模式作为降级方案...")
        # 尝试 SQLite 降级
        os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./rmfood_temp.db"
        session = await get_db_session()
        if session is None:
            logger.error("❌ 无法在任何数据库中建立连接！")
            logger.info("   请确保 PostgreSQL 已运行并配置正确。")
            return False
        logger.info("   ✓ 已切换到降级模式 (SQLite)")

    # 步骤 2: 检查迁移
    logger.info("\n📋 步骤 2: 检查并应用数据库迁移...")
    migration_ok = await check_migrations(session)

    # 步骤 3: 确保表存在
    logger.info("\n🗄️  步骤 3: 确保 retail_products 表存在...")
    table_ok = await ensure_table_exists(session)

    # 步骤 4: 检查现有数据
    logger.info("\n📊 步骤 4: 检查现有数据...")
    try:
        from sqlalchemy import count
        count_result = await session.execute(count(RetailProduct))
        existing_count = count_result.scalar() or 0
        logger.info(f"   现有记录数: {existing_count:,}")
    except:
        existing_count = 0
        logger.info("   无法计数 (表可能不存在)")

    # 步骤 5: 如有必要导入模拟数据
    imported_mock = 0
    if existing_count == 0:
        logger.info("\n⬇️  步骤 5: 没有现有数据，导入模拟数据...")
        imported_mock = await import_mock_retail_products(session)
    else:
        logger.info("\nℹ️  步骤 5: 发现已有数据，跳过模拟数据导入")

    # 步骤 6: 检查 OFF 全量导入
    logger.info("\n🔄 步骤 6: 检查 OFF 全量导入状态...")
    off_imported = await run_off_full_import()

    # 步骤 7: 验证数据
    logger.info("\n🎯 步骤 7: 执行数据验证...")
    verification = await verify_data(session)

    # 步骤 8: 生成报告
    logger.info("\n" + "=" * 60)
    logger.info("📋 导入执行报告")
    logger.info("=" * 60)

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "migration_applied": migration_ok,
        "table_exists": table_ok,
        "existing_before": existing_count,
        "simulated_imported": imported_mock,
        "off_import_possible": off_imported,
        **verification,
    }

    print(f"\n{'─'*50}")
    print(f"时间戳: {report['timestamp']}")
    print(f"✓ 迁移已应用: {report['migration_applied']}")
    print(f"✓ 表存在: {report['table_exists']}")
    print(f"• 现有记录 (导入前): {report['existing_before']}")
    print(f"• 导入模拟记录: {report['simulated_imported']}")
    print(f"• OFF 全量导入可能: {'是' if report['off_import_possible'] else '否'}")
    print(f"─"*50)
    print(f"总产品数: {report.get('total_products', 'N/A')}")
    print(f"独立品牌数: {report.get('unique_brands', 'N/A')}")
    print(f"平均数据质量: {report.get('avg_data_quality', 'N/A')}")
    print(f"带嵌入向量数: {report.get('products_with_embedding', 'N/A')}")
    if report.get('top_categories'):
        print(f"\nTop 5 类别:")
        for cat, cnt in report['top_categories']:
            print(f"  • {cat}: {cnt}")
    print(f"─"*50)

    if report.get('error'):
        print(f"⚠  警告: {report['error']}")

    return True


# ── 入口点 ──────────────────────────────────────────────────


if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("\n⚠️  操作被用户中断")
        sys.exit(130)
    except Exception as e:
        logger.critical(f"❌ 致命错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)