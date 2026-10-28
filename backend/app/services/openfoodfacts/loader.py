"""
OFF 数据批量入库加载器

使用原生 SQL INSERT ... ON CONFLICT 实现高效 upsert。
"""
import asyncio
import json
import logging
from typing import Any, Dict, List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class OFFLoader:
    """批量 upsert 加载器"""

    COLUMNS = [
        "external_id", "sku", "brand", "product_name", "product_line",
        "category", "sub_category", "formulation_type", "effects",
        "target_population", "full_ingredients", "key_ingredients",
        "material_refs", "peptide_refs", "compound_refs",
        "price", "currency", "package_size", "volume_ml", "weight_g",
        "sales_channels", "avg_rating", "review_count", "monthly_sales",
        "image_urls", "reg_type", "approved_region",
        "embedding", "source", "crawl_timestamp", "data_quality",
    ]

    # 数组列
    ARRAY_COLS = {"effects", "target_population", "sales_channels", "image_urls",
                  "material_refs", "peptide_refs", "compound_refs"}

    def __init__(self, db: AsyncSession):
        self.db = db

    def _format_value(self, col: str, val: Any) -> str:
        """格式化值为 SQL 字面量"""
        if val is None:
            return "NULL"

        if col in self.ARRAY_COLS:
            # 数组列：生成 PostgreSQL 数组字面量 '{"a","b"}'::text[]
            if isinstance(val, list):
                items = []
                for v in val:
                    if v is None:
                        continue
                    items.append(json.dumps(str(v), ensure_ascii=False))
                arr_literal = "{" + ",".join(items) + "}"
                # SQL 字符串字面量内单引号需双写转义
                return f"'{arr_literal.replace(chr(39), chr(39)+chr(39))}'::text[]"
            # dict 或其他非列表值 → 空数组
            return "'{}'::text[]"

        if col == "key_ingredients":
            if isinstance(val, dict):
                return f"'{json.dumps(val, ensure_ascii=False).replace(chr(39), chr(39)+chr(39))}'::jsonb"
            return "'{}'::jsonb"

        if isinstance(val, str):
            escaped = val.replace("'", "''")
            return f"'{escaped}'"

        return str(val)

    def _build_upsert_sql(self, product: Dict[str, Any]) -> str:
        """为单个产品生成 upsert SQL"""
        cols = ", ".join(self.COLUMNS + ["created_at", "updated_at"])
        values = ", ".join(
            [self._format_value(col, product.get(col)) for col in self.COLUMNS] + ["NOW()", "NOW()"]
        )

        update_parts = []
        for col in self.COLUMNS:
            if col in ("external_id", "source"):
                continue
            update_parts.append(f"{col} = EXCLUDED.{col}")
        update_parts.append("updated_at = NOW()")

        updates = ", ".join(update_parts)

        return f"""
            INSERT INTO retail_products ({cols})
            VALUES ({values})
            ON CONFLICT (external_id) DO UPDATE SET
                {updates}
        """

    async def upsert_batch(self, products: List[Dict[str, Any]]) -> Dict[str, int]:
        """批量 upsert 产品数据 - 带事务重试逻辑处理瞬态连接错误"""
        if not products:
            return {"inserted": 0, "updated": 0, "failed": 0}

        inserted = 0
        failed = 0

        max_retries = 3
        for attempt in range(max_retries):
            try:
                for product in products:
                    # Check if we need to retry this product due to connection loss
                    for prod_attempt in range(3):
                        try:
                            sql = self._build_upsert_sql(product)
                            await self.db.execute(text(sql))
                            inserted += 1
                            break  # product succeeded
                        except Exception as e:
                            # Check if it's a transient connection error
                            conn_errors = ["connection", "closed", "timeout", "pool", "reset"]
                            if any(err in str(e).lower() for err in conn_errors):
                                if prod_attempt < 2:
                                    logger.warning(f"  连接错误 (barcode={product.get('external_id', 'UNKNOWN')}, 尝试 {prod_attempt + 1}/3): {e}")
                                    await asyncio.sleep(0.5 * (2 ** prod_attempt))  # Exponential backoff
                                else:
                                    failed += 1
                                    barcode = product.get("external_id", "UNKNOWN")
                                    logger.error(f"[Loader] upsert 失败 (最终): barcode={barcode}: {e}")
                                    raise
                            else:
                                failed += 1
                                barcode = product.get("external_id", "UNKNOWN")
                                logger.error(f"[Loader] upsert 失败 barcode={barcode}: {e}")
                                raise
                # All products succeeded - commit the transaction
                await self.db.commit()
                logger.info(f"[Loader] 批次完成: inserted={inserted}, failed={failed}, total={len(products)}")
                return {"inserted": inserted, "updated": 0, "failed": failed}

            except Exception as e:
                # Transaction-level failure: rollback and retry entire batch
                try:
                    await self.db.rollback()
                except Exception as rollback_err:
                    logger.warning("[Loader] 回滚失败 (非致命): %s", rollback_err)

                logger.warning(f"[Loader] 批次提交失败 (尝试 {attempt + 1}/{max_retries}): {e}")

                if attempt >= max_retries - 1:
                    # Final failure - re-raise all failed products
                    logger.error("[Loader] 批次达到最大重试次数，全部失败")
                    raise

                await asyncio.sleep(2 ** attempt)  # Exponential backoff for batch retry

        # Should never reach here due to exception above
        return {"inserted": inserted, "updated": 0, "failed": failed}

    async def upsert_products_with_progress(
        self,
        products: List[Dict[str, Any]],
        batch_size: int = 500,
    ) -> Dict[str, int]:
        """分批次 upsert，带进度重试逻辑"""
        total_inserted = 0
        total_failed = 0
        max_batch_retries = 3

        for i in range(0, len(products), batch_size):
            batch = products[i:i + batch_size]
            batch_attempt = 0

            while batch_attempt < max_batch_retries:
                try:
                    result = await self.upsert_batch(batch)
                    total_inserted += result["inserted"]
                    total_failed += result["failed"]
                    break  # Success, move to next batch
                except Exception as e:
                    batch_attempt += 1
                    if batch_attempt >= max_batch_retries:
                        logger.error(f"[Loader] 批次提交失败 (达到最大重试次数): {e}")
                        raise
                    logger.warning(f"[Loader] 批次尝试 {batch_attempt}/{max_batch_retries} 失败: {e}")
                    await asyncio.sleep(2 ** batch_attempt)  # Exponential backoff

            progress = min(i + batch_size, len(products))
            logger.info(f"[Loader] 进度: {progress}/{len(products)} (已插入={total_inserted}, 失败={total_failed})")

        return {"inserted": total_inserted, "updated": 0, "failed": total_failed}
