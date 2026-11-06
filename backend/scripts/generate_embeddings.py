"""向量嵌入批量生成脚本

用于 Potion AI VFT x RMFOOD 深度融合方案。
对 food_materials 和 retail_products 表的文本字段生成向量嵌入。
使用 sentence-transformers 的中文模型。

══════════════════════════════════════════════════════════════════
维度口径澄清（三口径不一，务必阅读）
────────────────────────────────────────────────────────────────
- 本脚本实际产出 **384 维** 向量，模型为
  `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
  （MiniLM-L12-v2 的隐藏维度即 384），并做 L2 归一化。
- 数据库 `embedding` 列**当前实际类型为 JSON**（存 JSON 数组），
  并非 pgvector 的 VECTOR 类型。
- `app/models/food_material.py` 中「VECTOR(768)」的注释是**过期注释**，
  与实际不符，请勿据其推断维度。
- 若将来迁移到 pgvector，应统一为 `vector(384)`（与本脚本 384 维对齐），
  同时清理掉 768 的过期注释。本脚本**不改动数据库 schema**。

安全约束（P0-5 修复）
────────────────────────────────────────────────────────────────
- 模型加载失败时**立即中止（abort）**，绝不写入任何占位/随机向量。
  旧版行为是「模型缺装 → 静默生成随机 384 维向量 → 照常 commit」，
  会产生「看似有值、实为噪声」的污染数据，且 `WHERE embedding IS NOT NULL`
  会误判为已覆盖。此逻辑已彻底删除。
- 每条 embedding 在写入前做校验：维度必须 == 384、非全零、范数合理
  （L2 归一化后应 ≈ 1）。不通过的行**跳过并告警，不计入成功数**。

运行模式
────────────────────────────────────────────────────────────────
- **默认 dry-run**：只统计将处理的行数、实际编码并校验向量，**不写库**。
- 加 `--apply` 才真正 UPDATE + commit。

处理范围
────────────────────────────────────────────────────────────────
- food_materials: `embedding IS NULL AND review_status = 'approved'`
- retail_products: `embedding IS NULL`（该表无 review_status 字段）
"""

import argparse
import asyncio
import logging
import math
import sys
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# 默认使用本地模型路径
DEFAULT_MODEL_PATH = r"D:\RMFOOD配方平台\models\paraphrase-multilingual-minilm-l12-v2"
# 在线模型标识（与本地为同一模型）
DEFAULT_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

# 期望维度：MiniLM-L12-v2 固定为 384。若与实际模型不符会在校验时暴露。
EXPECTED_DIM = 384
# L2 归一化后向量范数应 ≈ 1，允许的误差容差
NORM_TOLERANCE = 0.01


def get_embedding_model():
    """加载 Sentence-BERT 模型。

    返回可用的 SentenceTransformer 实例；任何失败都抛出异常（绝不返回 None
    让调用方退化为随机向量）。加载失败时由 main() 统一 abort。
    """
    # 延迟导入：仅在真正需要时引入重型依赖
    import os

    from sentence_transformers import SentenceTransformer

    if os.path.exists(DEFAULT_MODEL_PATH):
        model = SentenceTransformer(DEFAULT_MODEL_PATH)
        logger.info(f"加载本地模型: {DEFAULT_MODEL_PATH}")
    else:
        model = SentenceTransformer(DEFAULT_MODEL_NAME)
        logger.info(f"加载在线模型: {DEFAULT_MODEL_NAME}")
    return model


def generate_embedding(model, text):
    """为文本生成向量嵌入（L2 归一化）。

    model 必为已加载的 SentenceTransformer（调用前已 abort 保护），
    因此这里不再有随机占位分支。
    """
    return model.encode(text, normalize_embeddings=True).tolist()


def validate_embedding(vector, expected_dim=EXPECTED_DIM):
    """校验单条 embedding 是否可安全写入。

    检查项：
    1. 是 list 且长度 == expected_dim
    2. 非全零
    3. 范数合理（L2 归一化后应 ≈ 1）

    返回 (ok: bool, reason: str)。ok=False 时 reason 说明原因。
    """
    if not isinstance(vector, list):
        return False, f"类型非 list: {type(vector).__name__}"
    if len(vector) != expected_dim:
        return False, f"维度不符: 期望 {expected_dim}, 实际 {len(vector)}"
    if any(not isinstance(v, (int, float)) or math.isnan(v) or math.isinf(v) for v in vector):
        return False, "含非数值/NaN/Inf 元素"
    if all(v == 0 for v in vector):
        return False, "向量为全零"
    norm = math.sqrt(sum(v * v for v in vector))
    if norm < 1e-6:
        return False, f"范数近似为 0: {norm}"
    if abs(norm - 1.0) > NORM_TOLERANCE:
        # 未做 L2 归一化或归一化异常；非致命但需人工确认
        return False, f"范数偏离 1.0 过多: {norm:.6f} (容差 {NORM_TOLERANCE})"
    return True, "ok"


async def _load_pending_food_materials(db):
    """查询待生成嵌入的食品原料（embedding IS NULL 且 review_status='approved'）"""
    from sqlalchemy import select

    from app.models.food_material import FoodMaterial

    result = await db.execute(
        select(FoodMaterial).where(
            FoodMaterial.embedding.is_(None),
            FoodMaterial.review_status == "approved",
        )
    )
    return result.scalars().all()


async def _load_pending_retail_products(db):
    """查询待生成嵌入的零售产品（embedding IS NULL；该表无 review_status）"""
    from sqlalchemy import select

    from app.models.retail_product import RetailProduct

    result = await db.execute(
        select(RetailProduct).where(
            RetailProduct.embedding.is_(None),
        )
    )
    return result.scalars().all()


def _build_food_material_text(material):
    """组合食品原料的搜索文本"""
    return (
        f"{material.name_cn} {material.name_latin or ''} "
        f"{' '.join(material.aliases or [])} "
        f"{' '.join(material.effects or [])} "
        f"{material.description or ''}"
    )


def _build_retail_product_text(product):
    """组合零售产品的搜索文本"""
    return (
        f"{product.product_name} {product.brand} {product.category} "
        f"{' '.join(product.effects or [])} {product.full_ingredients or ''}"
    )


async def process_food_materials(db, model, apply):
    """为 food_materials 表生成嵌入。apply=False 时只校验不写库。"""
    materials = await _load_pending_food_materials(db)
    logger.info(f"待生成嵌入的食品原料: {len(materials)} 条")

    updated = 0
    skipped = 0
    from sqlalchemy import update

    from app.models.food_material import FoodMaterial

    for material in materials:
        search_text = _build_food_material_text(material)
        embedding = generate_embedding(model, search_text)

        ok, reason = validate_embedding(embedding)
        if not ok:
            skipped += 1
            logger.warning(f"[跳过] food_material id={material.id} 校验失败: {reason}")
            continue

        if apply:
            await db.execute(
                update(FoodMaterial)
                .where(FoodMaterial.id == material.id)
                .values(embedding=embedding, updated_at=datetime.now(timezone.utc))
            )
        updated += 1

        if updated % 10 == 0:
            logger.info(f"已处理 {updated}/{len(materials)} 条食品原料嵌入")

    if apply:
        await db.commit()
    logger.info(
        f"食品原料嵌入{'写入' if apply else 'dry-run 校验'}完成: "
        f"成功 {updated} 条, 跳过 {skipped} 条 / 共 {len(materials)} 条"
    )
    return updated, skipped


async def process_retail_products(db, model, apply):
    """为 retail_products 表生成嵌入。apply=False 时只校验不写库。"""
    products = await _load_pending_retail_products(db)
    logger.info(f"待生成嵌入的零售产品: {len(products)} 条")

    updated = 0
    skipped = 0
    from sqlalchemy import update

    from app.models.retail_product import RetailProduct

    for product in products:
        search_text = _build_retail_product_text(product)
        embedding = generate_embedding(model, search_text)

        ok, reason = validate_embedding(embedding)
        if not ok:
            skipped += 1
            logger.warning(f"[跳过] retail_product id={product.id} 校验失败: {reason}")
            continue

        if apply:
            await db.execute(
                update(RetailProduct)
                .where(RetailProduct.id == product.id)
                .values(embedding=embedding, updated_at=datetime.now(timezone.utc))
            )
        updated += 1

        if updated % 10 == 0:
            logger.info(f"已处理 {updated}/{len(products)} 条零售产品嵌入")

    if apply:
        await db.commit()
    logger.info(
        f"零售产品嵌入{'写入' if apply else 'dry-run 校验'}完成: "
        f"成功 {updated} 条, 跳过 {skipped} 条 / 共 {len(products)} 条"
    )
    return updated, skipped


def _get_session_factory():
    """返回 async session 工厂。

    优先从 app.core.database.session 取真实工厂（该模块实际存在）。
    """
    from app.core.database.session import async_session_factory

    return async_session_factory


async def main():
    """主入口。默认 dry-run，加 --apply 才写库。"""
    parser = argparse.ArgumentParser(description="向量嵌入批量生成脚本")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="真正写入数据库。默认 dry-run（只统计与校验，不写库）。",
    )
    args = parser.parse_args()
    apply = args.apply

    if not apply:
        logger.info("=== DRY-RUN 模式：不会写入任何数据 ===")

    # ── 1. 加载模型；失败立即 abort，绝不写占位向量 ──
    try:
        model = get_embedding_model()
    except ImportError as e:
        logger.error(f"模型依赖缺失，无法加载嵌入模型：{e}")
        logger.error("请先安装 sentence-transformers 或确认本地模型路径存在后重试。")
        logger.error("为避免写入噪声/占位向量污染数据，本次运行中止，未处理任何行。")
        sys.exit(2)
    except Exception as e:
        logger.error(f"加载嵌入模型失败：{type(e).__name__}: {e}")
        logger.error("为避免写入噪声/占位向量污染数据，本次运行中止，未处理任何行。")
        sys.exit(2)

    # 模型输出维度自检：确认与 EXPECTED_DIM 一致，否则提前暴露口径错配
    try:
        probe_dim = len(model.encode("维度探针", normalize_embeddings=True).tolist())
    except Exception as e:
        logger.error(f"模型编码探针失败：{type(e).__name__}: {e}")
        sys.exit(2)
    if probe_dim != EXPECTED_DIM:
        logger.error(
            f"模型实际输出维度 {probe_dim} 与期望 {EXPECTED_DIM} 不符，"
            f"口径错配，中止以免写入错误维度向量。"
        )
        sys.exit(2)
    logger.info(f"模型输出维度确认: {probe_dim} 维（期望 {EXPECTED_DIM}）")

    # ── 2. 处理数据 ──
    async_session = _get_session_factory()
    food_count = food_skipped = product_count = product_skipped = 0
    async with async_session() as db:
        food_count, food_skipped = await process_food_materials(db, model, apply)
        product_count, product_skipped = await process_retail_products(db, model, apply)

    logger.info(
        f"嵌入生成总计: 食品原料 成功 {food_count}/跳过 {food_skipped}, "
        f"零售产品 成功 {product_count}/跳过 {product_skipped}, "
        f"模式={'APPLY(已写库)' if apply else 'DRY-RUN(未写库)'}"
    )


if __name__ == "__main__":
    asyncio.run(main())
