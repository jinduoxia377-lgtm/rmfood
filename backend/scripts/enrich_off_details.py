"""补全 OFF 缓存产品的详情数据（真实数据回填，幂等）。

为 retail_products 中 source='openfoodfacts' 的产品抓取 OFF 完整产品 JSON，
回填 key_ingredients（nutrition/nova_group/labels/countries/ingredients/serving_size）
与列字段（allergens_tags/additives_tags/traces_tags/ecoscore_grade/full_ingredients）。

用法（backend 目录）：
    $env:PYTHONIOENCODING='utf-8'
    .\venv\Scripts\python.exe scripts/enrich_off_details.py [--limit N] [--only-missing]

依赖 OFF 多镜像（us/de/world/fr），条码 API 路径已修复为 /api/v2/product/{code}.json。
"""
import argparse
import asyncio
import json
import logging
import os
import sys
import time
from typing import Any, Optional

# 确保可独立运行（python scripts/enrich_off_details.py）
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("enrich_off_details")

from app.services.data_sources.off_api import OFFClient
from app.services.data_sources.openfoodfacts.config import OFFConfig


def _clean_tag(tag: str) -> str:
    """将 OFF tag 转成可读形式（去掉语言前缀）"""
    return tag.split(":", 1)[-1] if ":" in tag else tag


def _pick_ingredients_text(product: dict) -> str:
    """优先取中文配料文本，其次英文，否则任一语言。"""
    for lang in ("zh", "en", "fr", "de"):
        val = product.get(f"ingredients_text_{lang}")
        if val:
            return str(val)
    raw = product.get("ingredients_text")
    return str(raw) if raw else ""


def _extract_nutrition(nutriments: dict) -> dict[str, float]:
    """从 OFF nutriments 提取每 100g 数值：{ 'energy-kcal': 200.0, 'fat': 5.0, ... }"""
    out: dict[str, float] = {}
    if not isinstance(nutriments, dict):
        return out
    for key, value in nutriments.items():
        if key.endswith("_100g") and isinstance(value, (int, float)):
            base = key[: -len("_100g")]
            if base:
                out[base] = round(float(value), 2)
    return out


def _build_key_ingredients(
    product: dict, existing_ki: Optional[dict]
) -> dict[str, Any]:
    """将 OFF 产品 JSON 中的结构化字段合并到 key_ingredients。"""
    ki = dict(existing_ki or {})
    nutriments = product.get("nutriments") or {}
    nutrition = _extract_nutrition(nutriments)
    if nutrition:
        ki["nutrition"] = nutrition
    if product.get("nova_group") is not None:
        ki["nova_group"] = int(product["nova_group"])
    if product.get("nutriscore_grade"):
        ki["nutrition_grade"] = str(product["nutriscore_grade"])
    labels = product.get("labels_tags") or []
    if labels:
        ki["labels"] = [_clean_tag(x) for x in labels]
    countries = product.get("countries_tags") or []
    if countries:
        ki["countries"] = [_clean_tag(x) for x in countries]
    ingredients = product.get("ingredients") or []
    if ingredients:
        ki["ingredients"] = [
            {
                "text": i.get("text") or i.get("id") or "",
                "id": i.get("id") or "",
                "percent": i.get("percent_estimate"),
            }
            for i in ingredients
            if isinstance(i, dict)
        ][:100]
    if product.get("serving_size"):
        ki["serving_size"] = str(product["serving_size"])
    return ki


async def enrich_product(
    session: AsyncSession, row_id: int, barcode: str, client: OFFClient, mirrors: list[str]
) -> Optional[dict[str, Any]]:
    """抓取并回填单个 OFF 产品。返回更新的字段摘要；失败返回 None。"""
    raw: Optional[dict] = None
    last_err = ""
    for mirror in mirrors:
        try:
            raw = await asyncio.wait_for(
                asyncio.to_thread(
                    lambda m=mirror: client.search_by_barcode(barcode, base_url=m)
                ),
                timeout=10,
            )
            if raw and raw.get("product"):
                break
            raw = None
            last_err = "no product field"
        except Exception as e:  # noqa: BLE001
            last_err = f"{type(e).__name__}: {str(e)[:120]}"
            await asyncio.sleep(0.3)
    if not raw or not raw.get("product"):
        return {"id": row_id, "barcode": barcode, "ok": False, "err": last_err}

    product = raw["product"]
    # 读取当前 key_ingredients
    row = (
        await session.execute(
            text("SELECT key_ingredients FROM retail_products WHERE id = :id"),
            {"id": row_id},
        )
    ).fetchone()
    existing_ki = dict(row[0]) if row and row[0] else {}
    ki = _build_key_ingredients(product, existing_ki)

    allergens = product.get("allergens_tags") or []
    additives = product.get("additives_tags") or []
    traces = product.get("traces_tags") or []
    contaminants = product.get("contaminants_tags") or []
    ecoscore = product.get("ecoscore_grade")
    ingredients_text = _pick_ingredients_text(product)

    await session.execute(
        text(
            """
            UPDATE retail_products
            SET key_ingredients = :ki,
                allergens_tags = :allergens,
                additives_tags = :additives,
                traces_tags = :traces,
                contaminants = :contaminants,
                ecoscore_grade = :ecoscore,
                full_ingredients = :ingredients_text,
                updated_at = now()
            WHERE id = :id
            """
        ),
        {
            "id": row_id,
            "ki": json.dumps(ki, ensure_ascii=False),
            "allergens": allergens,
            "additives": additives,
            "traces": traces,
            "contaminants": contaminants,
            "ecoscore": ecoscore,
            "ingredients_text": ingredients_text,
        },
    )
    await session.commit()
    return {
        "id": row_id,
        "barcode": barcode,
        "ok": True,
        "nutrition": bool(ki.get("nutrition")),
        "ingredients": len(ki.get("ingredients") or []),
        "nova": ki.get("nova_group"),
        "labels": len(ki.get("labels") or []),
    }


async def main() -> None:
    parser = argparse.ArgumentParser(description="补全 OFF 缓存产品详情数据")
    parser.add_argument("--limit", type=int, default=0, help="最多处理 N 条（0=全部）")
    parser.add_argument("--only-missing", action="store_true", help="仅处理缺少 ingredients 的")
    args = parser.parse_args()

    engine = create_async_engine(
        os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://postgres:password@localhost:5432/rmfood",
        )
    )
    SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    client = OFFClient()
    mirrors = OFFConfig().MIRROR_URLS

    async with SessionLocal() as session:
        sql = """
            SELECT id, external_id FROM retail_products
            WHERE source = 'openfoodfacts' AND external_id IS NOT NULL
        """
        if args.only_missing:
            sql += " AND (key_ingredients->'ingredients' IS NULL)"
        sql += " ORDER BY id LIMIT :limit"
        rows = (
            await session.execute(text(sql), {"limit": args.limit or 1000000})
        ).fetchall()
        logger.info("待补全 OFF 产品 %d 条", len(rows))

        ok = fail = 0
        missing_summary = {"nutrition": 0, "ingredients": 0, "nova": 0}
        for idx, row in enumerate(rows, 1):
            result = await enrich_product(
                session, int(row[0]), str(row[1]).strip(), client, mirrors
            )
            if result and result.get("ok"):
                ok += 1
                if not result.get("nutrition"):
                    missing_summary["nutrition"] += 1
                if not result.get("ingredients"):
                    missing_summary["ingredients"] += 1
                logger.info(
                    "[%d/%d] id=%s barcode=%s ok nutrition=%s ingredients=%s nova=%s",
                    idx, len(rows), result["id"], result["barcode"],
                    result["nutrition"], result["ingredients"], result.get("nova"),
                )
            else:
                fail += 1
                err = result.get("err") if result else "unknown"
                logger.warning("[%d/%d] id=%s barcode=%s FAIL %s",
                               idx, len(rows), row[0], row[1], err)
            # 限流友好
            await asyncio.sleep(0.25)

        logger.info("完成: 成功 %d，失败 %d，仍缺 nutrition=%d ingredients=%d",
                    ok, fail, missing_summary["nutrition"], missing_summary["ingredients"])

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())