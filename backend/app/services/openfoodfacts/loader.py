"""
OFF 数据批量入库加载器

使用原生 SQL INSERT ... ON CONFLICT 实现高效 upsert。
"""
import json
import logging
from typing import List, Dict, Any

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
            if isinstance(val, list) and len(val) == 0:
                return "{}"  # PostgreSQL array literal (no quotes!)
            elif isinstance(val, list):
                items = []
                for v in val:
                    if v is None:
                        continue
                    s = str(v).replace("'", "''")
                    items.append(f"'{s}'")
                return "{" + ",".join(items) + "}"  # PostgreSQL array literal
            else:
                return "{}"

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
        cols = ", ".join(self.COLUMNS)
        values = ", ".join(
            self._format_value(col, product.get(col)) for col in self.COLUMNS
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
        """批量 upsert 产品数据"""
        if not products:
            return {"inserted": 0, "updated": 0, "failed": 0}

        inserted = 0
        failed = 0

        for product in products:
            try:
                sql = self._build_upsert_sql(product)
                await self.db.execute(text(sql))
                inserted += 1
            except Exception as e:
                failed += 1
                barcode = product.get("external_id", "UNKNOWN")
                logger.error(f"[Loader] upsert 失败 barcode={barcode}: {e}")

        try:
            await self.db.commit()
            logger.info(f"[Loader] 批次完成: inserted={inserted}, failed={failed}, total={len(products)}")
        except Exception as e:
            await self.db.rollback()
            logger.error(f"[Loader] 事务回滚: {e}")

        return {"inserted": inserted, "updated": 0, "failed": failed}

    async def upsert_products_with_progress(
        self,
        products: List[Dict[str, Any]],
        batch_size: int = 500,
    ) -> Dict[str, int]:
        """分批次 upsert，带进度日志"""
        total_inserted = 0
        total_failed = 0

        for i in range(0, len(products), batch_size):
            batch = products[i:i + batch_size]
            result = await self.upsert_batch(batch)
            total_inserted += result["inserted"]
            total_failed += result["failed"]

            progress = min(i + batch_size, len(products))
            logger.info(f"[Loader] 进度: {progress}/{len(products)} (已插入={total_inserted}, 失败={total_failed})")

        return {"inserted": total_inserted, "updated": 0, "failed": total_failed}
