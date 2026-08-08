"""
向量嵌入批量生成脚本

用于 Potion AI VFT x RMFOOD 深度融合方案。
对 food_materials 和 retail_products 表的文本字段生成向量嵌入。
使用 sentence-transformers 的中文模型。
"""
import asyncio
import logging
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# 默认使用本地模型路径
DEFAULT_MODEL_PATH = r"D:\RMFOOD配方平台\models\paraphrase-multilingual-minilm-l12-v2"


def get_embedding_model():
    """加载 Sentence-BERT 模型"""
    try:
        from sentence_transformers import SentenceTransformer
        # 尝试本地模型，不存在则下载
        if os.path.exists(DEFAULT_MODEL_PATH):
            model = SentenceTransformer(DEFAULT_MODEL_PATH)
            logger.info(f"加载本地模型: {DEFAULT_MODEL_PATH}")
        else:
            model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
            logger.info("加载在线模型: paraphrase-multilingual-MiniLM-L12-v2")
        return model
    except ImportError:
        logger.warning("sentence-transformers 未安装，使用随机嵌入作为占位符")
        return None


def generate_embedding(model, text):
    """为文本生成向量嵌入"""
    if model:
        return model.encode(text, normalize_embeddings=True).tolist()
    else:
        # 随机嵌入作为占位符 (384维，与 MiniLM 匹配)
        import random
        return [random.uniform(-1, 1) for _ in range(384)]


async def generate_embeddings_for_food_materials(db, model):
    """为 food_materials 表生成嵌入"""
    from app.models.food_material import FoodMaterial
    from sqlalchemy import select, update

    result = await db.execute(
        select(FoodMaterial).where(
            FoodMaterial.embedding.is_(None),
            FoodMaterial.review_status == "approved",
        )
    )
    materials = result.scalars().all()
    logger.info(f"待生成嵌入的食品原料: {len(materials)} 条")

    updated = 0
    for material in materials:
        # 组合搜索文本
        search_text = f"{material.name_cn} {material.name_latin or ''} {' '.join(material.aliases or [])} {' '.join(material.effects or [])} {material.description or ''}"
        embedding = generate_embedding(model, search_text)

        await db.execute(
            update(FoodMaterial)
            .where(FoodMaterial.id == material.id)
            .values(embedding=embedding, updated_at=datetime.now(timezone.utc))
        )
        updated += 1

        if updated % 10 == 0:
            logger.info(f"已生成 {updated}/{len(materials)} 条食品原料嵌入")

    await db.commit()
    logger.info(f"食品原料嵌入生成完成: {updated} 条")
    return updated


async def generate_embeddings_for_retail_products(db, model):
    """为 retail_products 表生成嵌入"""
    from app.models.retail_product import RetailProduct
    from sqlalchemy import select, update

    result = await db.execute(
        select(RetailProduct).where(
            RetailProduct.embedding.is_(None),
        )
    )
    products = result.scalars().all()
    logger.info(f"待生成嵌入的零售产品: {len(products)} 条")

    updated = 0
    for product in products:
        search_text = f"{product.product_name} {product.brand} {product.category} {' '.join(product.effects or [])} {product.full_ingredients or ''}"
        embedding = generate_embedding(model, search_text)

        await db.execute(
            update(RetailProduct)
            .where(RetailProduct.id == product.id)
            .values(embedding=embedding, updated_at=datetime.now(timezone.utc))
        )
        updated += 1

        if updated % 10 == 0:
            logger.info(f"已生成 {updated}/{len(products)} 条零售产品嵌入")

    await db.commit()
    logger.info(f"零售产品嵌入生成完成: {updated} 条")
    return updated


async def main():
    """主入口"""
    import os
    from app.core.session import engine
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

    async_session = async_sessionmaker(engine, expire_on_commit=False)
    model = get_embedding_model()

    if model is None:
        logger.warning("无法加载模型，跳过嵌入生成")
        return

    async with async_session() as db:
        food_count = await generate_embeddings_for_food_materials(db, model)
        product_count = await generate_embeddings_for_retail_products(db, model)

    logger.info(f"嵌入生成总计: 食品原料 {food_count} 条, 零售产品 {product_count} 条")


if __name__ == "__main__":
    asyncio.run(main())
