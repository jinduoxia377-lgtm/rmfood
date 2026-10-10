"""
OFF 数据批量入库加载器 - 同步版本 (适用于 Windows)

使用 psycopg2 进行稳定的数据库连接，避免 asyncpg 在 Windows 下的连接不稳定问题。
"""
import logging
import json
from typing import List, Dict, Any
import psycopg2
from psycopg2.extensions import connection as PsycopgConnection

logger = logging.getLogger(__name__)


class OFFLoaderSync:
    """
    批量 upsert 加载器 - 同步版本

    专为 Windows 环境设计，使用 psycopg2 避免 asyncpg 的连接问题。
    在 Linux/WSL 环境下，可以使用异步版本。
    """

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

    def __init__(self, conn_str: str):
        """
        初始化同步加载器

        Args:
            conn_str: psycopg2 连接字符串，例如:
                     "host=localhost port=5432 user=postgres password=dbname=rmfood"
        """
        self.conn_str = conn_str
        self.conn: PsycopgConnection = None

    def connect(self):
        """建立数据库连接"""
        if self.conn is not None:
            self.conn.close()
        try:
            self.conn = psycopg2.connect(self.conn_str)
            self.conn.autocommit = False  # 我们手动管理事务
            logger.info("[OFFLoaderSync] 已建立 PostgreSQL 连接")
        except Exception as e:
            logger.error(f"[OFFLoaderSync] 连接失败: {e}")
            raise

    def disconnect(self):
        """关闭数据库连接"""
        if self.conn:
            try:
                self.conn.rollback()
            except Exception as rollback_err:
                logger.warning("[OFFLoaderSync] 回滚失败 (非致命): %s", rollback_err)
            self.conn.close()
            logger.info("[OFFLoaderSync] 已关闭 PostgreSQL 连接")

    def _format_value(self, col: str, val: Any) -> str:
        """格式化值为 SQL 字面量（使用 psycopg2 的参数化方法更安全）"""
        # 实际上我们不构造字符串值，由 psycopg2 处理参数化查询
        return None  # 占位符

    def _build_upsert_sql(self) -> str:
        """构建批量 upsert SQL 语句"""
        cols_str = ", ".join(self.COLUMNS)
        update_parts = []
        for col in self.COLUMNS:
            if col in ("external_id", "source"):
                continue
            update_parts.append(f"{col} = EXCLUDED.{col}")
        update_parts.append("updated_at = NOW()")
        updates = ", ".join(update_parts)
        # A-27：原 VALUES 子句是个残缺的理解式占位 `(%s_{idx} for %s_{idx} in zip(...))`，
        #       既不是合法 SQL 又引用了未定义的 idx。按列数生成真正的参数占位符。
        placeholders = ", ".join(["%s"] * len(self.COLUMNS))

        return f"""
            INSERT INTO retail_products ({cols_str})
            VALUES ({placeholders})
            ON CONFLICT (external_id) DO UPDATE SET
                {updates}
        """
        # 实际实现将在 execute_batch 中正确处理

    def _format_array(self, val: Any) -> str:
        """PostgreSQL 数组格式的字符串表示"""
        if val is None or (isinstance(val, list) and len(val) == 0):
            return "{}"
        if isinstance(val, list):
            items = []
            for v in val:
                if v is None:
                    continue
                s = str(v).replace("'", "''")
                items.append(f"'{s}'")
            return "{" + ",".join(items) + "}"
        return str(val)

    def upsert_batch(self, products: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        批量 upsert 产品数据 - 使用 psycopg2

        Args:
            products: 产品列表，每个产品是一个字典

        Returns:
            包含 inserted, updated, failed 计数的字典
        """
        if not products:
            return {"inserted": 0, "updated": 0, "failed": 0}

        # 准备要插入的值
        values = []
        for p in products:
            row = []
            for col in self.COLUMNS:
                val = p.get(col)
                if col in self.ARRAY_COLS and isinstance(val, list):
                    row.append(self._format_array(val))
                elif val is None:
                    row.append(None)
                elif col == "key_ingredients" and isinstance(val, dict):
                    # JSONB 格式
                    row.append(json.dumps(val, ensure_ascii=False))
                else:
                    row.append(val)
            values.append(tuple(row))

        if not values:
            return {"inserted": 0, "updated": 0, "failed": 0}

        inserted = 0
        failed = 0

        # 构建要插入的值
        values = []
        for p in products:
            row = []
            for col in self.COLUMNS:
                val = p.get(col)
                if col in self.ARRAY_COLS and isinstance(val, list):
                    row.append(self._format_array(val))
                elif val is None:
                    row.append(None)
                elif col == "key_ingredients" and isinstance(val, dict):
                    row.append(json.dumps(val, ensure_ascii=False))
                else:
                    row.append(val)
            values.append(tuple(row))

        if not values:
            return {"inserted": 0, "updated": 0, "failed": 0}

        inserted = 0
        failed = 0

        # 使用 execute_values 高效批量写入（忽略占位符生成代码）
        from psycopg2.extras import execute_values

        try:
            with self.conn.cursor() as cursor:
                # 构建批量插入语句
                insert_sql = f"""
                    INSERT INTO retail_products ({', '.join(self.COLUMNS)})
                    VALUES %s
                    ON CONFLICT (external_id) DO UPDATE SET
                        {', '.join([f"{col} = EXCLUDED.{col}" for col in self.COLUMNS if col not in ('external_id', 'source')])},
                        updated_at = NOW()
                """

                # 使用 execute_values 高效批量写入
                execute_values(cursor, insert_sql, values, page_size=100)

                self.conn.commit()
                inserted = len(values)
                logger.info(f"[OFFLoaderSync] 批次完成: inserted={inserted}")

        except Exception as e:
            self.conn.rollback()
            failed = len(products)
            logger.error(f"[OFFLoaderSync] upsert_batch 失败: {e}")
            raise
        finally:
            return {"inserted": inserted, "updated": 0, "failed": failed}

    def upsert_products_with_progress(
        self,
        products: List[Dict[str, Any]],
        batch_size: int = 500,
    ) -> Dict[str, int]:
        """
        分批次 upsert，带进度条

        Args:
            products: 所有产品列表
            batch_size: 每批大小

        Returns:
            总计结果字典
        """
        total_inserted = 0
        total_failed = 0
        n = len(products)

        for i in range(0, n, batch_size):
            batch = products[i:i + batch_size]
            logger.info(f"[OFFLoaderSync] 处理批次 {i+1}/{n}: {len(batch)} 条记录")

            result = self.upsert_batch(batch)
            total_inserted += result["inserted"]
            total_failed += result["failed"]

            logger.info(f"[OFFLoaderSync] 进度: {min(i+batch_size, n)}/{n} (已插入={total_inserted}, 失败={total_failed})")

        return {"inserted": total_inserted, "updated": 0, "failed": total_failed}


# 示例用法:
"""
if __name__ == "__main__":
    conn_str = "host=localhost port=5432 user=postgres password=password database=rmfood"
    loader = OFFLoaderSync(conn_str)
    loader.connect()

    try:
        products = [...]  # 准备好的产品数据
        result = loader.upsert_products_with_progress(products, batch_size=500)
        print(f"结果: {result}")
    finally:
        loader.disconnect()
"""