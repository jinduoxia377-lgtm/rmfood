"""
零售产品数据采集管道

用于 Potion AI VFT x RMFOOD 深度融合方案。
从电商平台采集零售产品信息，存储到 retail_products 表。
"""
import asyncio
import logging
import random
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


# ── 模拟零售产品数据 ──

RETAIL_PRODUCTS_MOCK_DATA: List[Dict[str, Any]] = [
    {
        "brand": "汤臣倍健",
        "product_name": "汤臣倍健 胶原蛋白肽口服液",
        "product_line": "胶原蛋白系列",
        "category": "保健食品",
        "sub_category": "美容保健",
        "formulation_type": "口服液",
        "effects": ["补充胶原蛋白", "抗氧化", "延缓衰老"],
        "target_population": ["25岁以上女性", "皮肤松弛人群"],
        "full_ingredients": "水、胶原蛋白肽、维生素C、透明质酸钠、柠檬酸",
        "key_ingredients": {"胶原蛋白肽": "3000mg/瓶", "维生素C": "50mg/瓶"},
        "price": 198.0,
        "currency": "CNY",
        "package_size": "300ml (30ml x 10瓶)",
        "volume_ml": 300.0,
        "sales_channels": ["京东", "天猫", "线下门店"],
        "avg_rating": 4.8,
        "review_count": 12580,
        "monthly_sales": 5200,
        "reg_number": "国食健注G20180XXX",
        "reg_type": "注册",
        "approved_region": "CN",
        "source": "mock",
        "data_quality": 0.85,
    },
    {
        "brand": "同仁堂",
        "product_name": "同仁堂 黄芪精口服液",
        "product_line": "中药制剂系列",
        "category": "中成药",
        "sub_category": "补气类",
        "formulation_type": "口服液",
        "effects": ["补气固表", "利尿托毒", "补血"],
        "target_population": ["气虚人群", "免疫力低下者"],
        "full_ingredients": "黄芪",
        "key_ingredients": {"黄芪提取物": "每支含黄芪10g"},
        "price": 68.0,
        "currency": "CNY",
        "package_size": "10ml x 10支",
        "volume_ml": 100.0,
        "sales_channels": ["京东", "天猫", "同仁堂门店"],
        "avg_rating": 4.7,
        "review_count": 8920,
        "monthly_sales": 3800,
        "reg_number": "国药准字Z11020XXX",
        "reg_type": "批准",
        "approved_region": "CN",
        "source": "mock",
        "data_quality": 0.85,
    },
    {
        "brand": "无限极",
        "product_name": "无限极 植雅多重矿物质片",
        "product_line": "矿物质系列",
        "category": "保健食品",
        "sub_category": "营养补充",
        "formulation_type": "片剂",
        "effects": ["补充矿物质", "增强免疫力", "促进骨骼健康"],
        "target_population": ["全年龄段", "矿物质缺乏者"],
        "full_ingredients": "碳酸钙、柠檬酸铁铵、葡萄糖酸锌、维生素D3",
        "key_ingredients": {"钙": "250mg/片", "铁": "10mg/片", "锌": "7.5mg/片"},
        "price": 158.0,
        "currency": "CNY",
        "package_size": "60片",
        "sales_channels": ["无限极门店", "天猫"],
        "avg_rating": 4.5,
        "review_count": 5600,
        "monthly_sales": 2100,
        "reg_number": "国食健注J20190XXX",
        "reg_type": "注册",
        "approved_region": "CN",
        "source": "mock",
        "data_quality": 0.80,
    },
    {
        "brand": "修正",
        "product_name": "修正 枸杞菊花茶",
        "product_line": "代用茶系列",
        "category": "代用茶",
        "sub_category": "花草茶",
        "formulation_type": "袋泡茶",
        "effects": ["清肝明目", "滋补肝肾", "清热解毒"],
        "target_population": ["用眼过度人群", "熬夜人群"],
        "full_ingredients": "枸杞子、菊花、决明子、金银花",
        "key_ingredients": {"枸杞子": "40%", "菊花": "30%", "决明子": "20%", "金银花": "10%"},
        "price": 39.9,
        "currency": "CNY",
        "package_size": "150g (2g x 75包)",
        "sales_channels": ["京东", "天猫", "拼多多"],
        "avg_rating": 4.6,
        "review_count": 23400,
        "monthly_sales": 15000,
        "reg_number": "SC114XXXXXXX",
        "reg_type": "生产许可",
        "approved_region": "CN",
        "source": "mock",
        "data_quality": 0.75,
    },
    {
        "brand": "东阿阿胶",
        "product_name": "东阿阿胶 阿胶糕",
        "product_line": "阿胶系列",
        "category": "保健食品",
        "sub_category": "滋补品",
        "formulation_type": "即食",
        "effects": ["补血滋阴", "润燥", "延年益寿"],
        "target_population": ["贫血人群", "产后恢复", "中老年"],
        "full_ingredients": "阿胶、黑芝麻、核桃仁、冰糖、黄酒",
        "key_ingredients": {"阿胶": "≥50%"},
        "price": 398.0,
        "currency": "CNY",
        "package_size": "500g",
        "weight_g": 500.0,
        "sales_channels": ["东阿阿胶门店", "天猫", "京东"],
        "avg_rating": 4.9,
        "review_count": 18700,
        "monthly_sales": 8500,
        "reg_number": "SC105XXXXXXX",
        "reg_type": "生产许可",
        "approved_region": "CN",
        "source": "mock",
        "data_quality": 0.90,
    },
]


async def import_mock_retail_products(db):
    """导入模拟零售产品数据"""
    from app.models.retail_product import RetailProduct
    from sqlalchemy import select

    # 检查是否已有数据
    result = await db.execute(select(RetailProduct).limit(1))
    existing = result.scalar_one_or_none()
    if existing:
        logger.info(f"retail_products 表已有数据 (ID: {existing.id}), 跳过导入")
        return 0

    now = datetime.now(timezone.utc)
    inserted = 0

    for data in RETAIL_PRODUCTS_MOCK_DATA:
        product = RetailProduct(
            external_id=f"mock_{inserted:03d}",
            sku=f"SKU-{inserted:04d}",
            brand=data["brand"],
            product_name=data["product_name"],
            product_line=data.get("product_line"),
            category=data.get("category"),
            sub_category=data.get("sub_category"),
            formulation_type=data.get("formulation_type"),
            effects=data.get("effects", []),
            target_population=data.get("target_population", []),
            full_ingredients=data.get("full_ingredients"),
            key_ingredients=data.get("key_ingredients", {}),
            material_refs=data.get("material_refs", []),
            peptide_refs=data.get("peptide_refs", []),
            compound_refs=data.get("compound_refs", []),
            price=data.get("price"),
            currency=data.get("currency", "CNY"),
            package_size=data.get("package_size"),
            volume_ml=data.get("volume_ml"),
            weight_g=data.get("weight_g"),
            sales_channels=data.get("sales_channels", []),
            avg_rating=data.get("avg_rating"),
            review_count=data.get("review_count"),
            monthly_sales=data.get("monthly_sales"),
            reg_number=data.get("reg_number"),
            reg_type=data.get("reg_type"),
            approved_region=data.get("approved_region"),
            source=data.get("source", "mock"),
            data_quality=data.get("data_quality", 0.8),
            created_at=now,
            updated_at=now,
        )
        db.add(product)
        inserted += 1

    await db.commit()
    logger.info(f"成功导入 {inserted} 条零售产品数据")
    return inserted


async def main():
    """主入口"""
    from app.core.session import engine
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

    async_session = async_sessionmaker(engine, expire_on_commit=False)

    from app.models.retail_product import RetailProduct
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: RetailProduct.metadata.create_all(sync_conn.bind))

    async with async_session() as db:
        count = await import_mock_retail_products(db)
        print(f"导入完成: {count} 条记录")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
