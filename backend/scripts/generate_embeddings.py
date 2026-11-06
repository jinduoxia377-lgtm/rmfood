"""向量嵌入批量生成脚本

用于 Potion AI VFT x RMFOOD 深度融合方案。
对 food_materials 和 retail_products 表的文本字段生成向量嵌入。

═══════════════════════════════════════════════════════════════════
模型口径（与查询侧严格对齐，务必阅读）
────────────────────────────────────────────────────────────────
- 本脚本用 **fastembed** 的 `BAAI/bge-small-zh-v1.5` 产出 **512 维** 向量，
  与查询侧（运行时搜索）`app/services/search/vector_searcher.py` 的
  `encode_query` → `EmbeddingService(provider="local")._embed_local_sync`
  → `TextEmbedding(model_name="BAAI/bge-small-zh-v1.5")` **完全一致**。
- vector_searcher.DIMENSIONS == 512，EmbeddingService.model_dim 中
  `{"BAAI/bge-small-zh-v1.5": 512}` 亦为 512。库存量与查询向量同维，
  pgvector `<=>` 余弦相似度才不会报错或失真。
- 旧版曾用 `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
  （384 维），但 sentence-transformers **未安装**且 384 与查询侧 512 不匹配，
  已彻底移除。若将来迁移到 pgvector，应统一为 `vector(512)`。

数据库 `embedding` 列**当前实际类型为 JSON**（存 JSON 数组），并非 pgvector
的 VECTOR 类型。本脚本**不改动数据库 schema**，直接存 JSON 数组即可
（vector_searcher 有 JSON 回退路径 `_cosine_similarity`，pgvector 路径会
`embedding::vector` 转换）。

安全约束（P0-5 修复）
────────────────────────────────────────────────────────────────
- 模型加载失败时**立即中止（abort）**，绝不写入任何占位/随机向量。
  旧版行为是「模型缺装 → 静默生成随机向量 → 照常 commit」，
  会产生「看似有值、实为噪声」的污染数据，且 `WHERE embedding IS NOT NULL`
  会误判为已覆盖。此逻辑已彻底删除。
- 每条 embedding 在写入前做校验：维度必须 == 512、非全零、无 NaN/Inf、
  范数合理（fastembed bge 默认已 L2 归一化，应 ≈ 1）。不通过的行
  **跳过并告警，不计入成功数**。

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
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# 保证 backend/ 在 sys.path（本脚本位于 backend/scripts/ 下），
# 使 `from app.xxx import ...` 在直接运行脚本时也能导入。
_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# 本地 fastembed 模型标识（与查询侧 EmbeddingService 默认 local 模型一致）
EMBED_MODEL_NAME = "BAAI/bge-small-zh-v1.5"

# 期望维度：bge-small-zh-v1.5 固定为 512。若与实际模型不符会在校验时暴露。
EXPECTED_DIM = 512
# L2 归一化后向量范数应 ≈ 1，允许的误差容差
NORM_TOLERANCE = 0.01


def get_embedding_model():
    """加载 fastembed TextEmbedding 模型。

    返回可用的 TextEmbedding 实例；任何失败都抛出异常（绝不返回 None
    让调用方退化为随机向量）。加载失败时由 main() 统一 abort。
    """
    # 延迟导入：仅在真正需要时引入重型依赖
    from fastembed import TextEmbedding

    logger.info(f"加载 fastembed 模型: {EMBED_MODEL_NAME}（首次运行将下载模型文件，请稍候）")
    return TextEmbedding(model_name=EMBED_MODEL_NAME)


def generate_embedding(model, text):
    """为文本生成向量嵌入（fastembed bge 默认已 L2 归一化）。

    model 必为已加载的 TextEmbedding（调用前已 abort 保护），
    因此这里不再有随机占位分支。
    """
    vectors = list(model.embed([text]))
    if not vectors:
        raise ValueError("fastembed 未返回任何向量")
    return [float(x) for x in vectors[0]]


def validate_embedding(vector, expected_dim=EXPECTED_DIM):
    """校验单条 embedding 是否可安全写入。

    检查项：
    1. 是 list 且长度 == expected_dim
    2. 无 NaN/Inf 元素
    3. 非全零
    4. 范数合理（L2 归一化后应 ≈ 1）

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
        # 未做 L2 归一化或归一化异常；跳过并告警，避免失真向量入库
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
    """组合食品原料的语义搜索文本。

    不只用名字：拼接分类、子类、活性成分、功效、适应症、描述等有值字段，
    拼成一句有语义的文本，使向量携带更丰富的语义信号。
    """
    parts = [material.name_cn]
    if material.name_en:
        parts.append(material.name_en)
    if material.name_latin:
        parts.append(material.name_latin)
    if material.aliases:
        parts.append(" ".join(material.aliases))
    if material.category:
        parts.append(f"分类: {material.category}")
    if material.sub_category:
        parts.append(f"子类: {material.sub_category}")
    if material.active_ingredients:
        parts.append("活性成分: " + "、".join(material.active_ingredients))
    if material.effects:
        parts.append("功效: " + "、".join(material.effects))
    if material.indications:
        parts.append(f"适应症: {material.indications}")
    if material.description:
        parts.append(material.description)
    # 过滤空串，避免多余空格污染文本
    return " ".join(p for p in parts if p and p.strip())


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

    从 app.core.database.session 取真实工厂（该模块实际存在）。
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
        logger.error("请先安装 fastembed 或确认模型可下载后重试。")
        logger.error("为避免写入噪声/占位向量污染数据，本次运行中止，未处理任何行。")
        sys.exit(2)
    except Exception as e:
        logger.error(f"加载嵌入模型失败：{type(e).__name__}: {e}")
        logger.error("为避免写入噪声/占位向量污染数据，本次运行中止，未处理任何行。")
        sys.exit(2)

    # 模型输出维度自检：确认与 EXPECTED_DIM 一致，否则提前暴露口径错配
    try:
        probe_vec = generate_embedding(model, "维度探针")
    except Exception as e:
        logger.error(f"模型编码探针失败：{type(e).__name__}: {e}")
        sys.exit(2)
    probe_dim = len(probe_vec)
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
