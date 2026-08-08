"""种子数据导入脚本

用于 Potion AI VFT x RMFOOD 深度融合方案。
从 JSON 文件导入食品原料种子数据到 food_materials 表。
数据来源: 国家卫健委《既是食品又是药品的物品名单》。
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SEED_FILE = Path(__file__).parent / "seed_data.json"


async def seed_food_materials(db):
    """从 JSON 导入种子数据到 food_materials 表"""
    from app.models.food_material import FoodMaterial
    from sqlalchemy import text

    # 检查是否已有数据 — 使用 raw SQL 避免 asyncpg JSON 类型问题
    result = await db.execute(text("SELECT COUNT(*) FROM food_materials"))
    count = result.scalar()
    if count > 0:
        logger.info(f"food_materials 表已有 {count} 条数据, 跳过导入")
        return 0

    # 读取种子数据
    with open(SEED_FILE, "r", encoding="utf-8") as f:
        seed_data = json.load(f)

    now = datetime.now(timezone.utc)
    inserted = 0

    for data in seed_data:
        db.add(FoodMaterial(
            external_id=f"seed_{inserted:03d}",
            name_cn=data["name_cn"],
            name_latin=data.get("name_latin"),
            name_en=data.get("name_en"),
            aliases=data.get("aliases", []),
            category=data.get("category"),
            sub_category=data.get("sub_category"),
            food_homology=data.get("food_homology", False),
            toxicity_class=data.get("toxicity_class"),
            active_ingredients=data.get("active_ingredients", []),
            effects=data.get("effects", []),
            indications=data.get("indications"),
            ob_percent=data.get("ob_percent"),
            dl_value=data.get("dl_value"),
            bioavailability_score=data.get("bioavailability_score"),
            safe_dose_min=data.get("safe_dose_min"),
            safe_dose_max=data.get("safe_dose_max"),
            contraindications=data.get("contraindications", []),
            interactions=data.get("interactions", []),
            regulatory_status=data.get("regulatory_status"),
            approved_regions=data.get("approved_regions", []),
            max_daily_intake=data.get("max_daily_intake"),
            description=data.get("description"),
            source_db=data.get("source_db", "manual"),
            data_quality=data.get("data_quality", 0.8),
            review_status=data.get("review_status", "approved"),
            created_at=now,
            updated_at=now,
        ))
        inserted += 1

    await db.commit()
    logger.info(f"成功导入 {inserted} 条食品原料种子数据")
    return inserted


async def main():
    """主入口"""
    from app.core.session import engine
    from app.models.food_material import FoodMaterial
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        from sqlalchemy import text
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        except Exception:
            pass  # pgvector 不可用，降级为 JSON 存储

    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: FoodMaterial.metadata.create_all(sync_conn.engine))

    async with async_session() as db:
        count = await seed_food_materials(db)
        print(f"导入完成: {count} 条记录")


if __name__ == "__main__":
    asyncio.run(main())
