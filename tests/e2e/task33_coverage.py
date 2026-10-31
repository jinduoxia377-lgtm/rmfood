# -*- coding: utf-8 -*-
"""QA task-33：数据库核验 OFF/manual 产品详情字段覆盖率。

统计 retail_products 表中：
- source='openfoodfacts'（OFF 缓存）的 nutrition/ingredients/nova_group/labels/full_ingredients/allergens/additives/ecoscore 覆盖率；
- source='manual'（平台参考数据）相同字段的覆盖率（应刻意保留为空/少，不虚构）。

Run: backend\\venv\\Scripts\\python.exe tests/e2e/task33_coverage.py
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, r"D:\RMFOODFP\backend")
from dotenv import load_dotenv  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402

load_dotenv(r"D:\RMFOODFP\backend\.env")
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "task33_coverage_results.json")


async def main() -> None:
    db_url = os.environ.get("DATABASE_URL") or "postgresql+asyncpg://postgres:password@localhost:5432/rmfood"
    engine = create_async_engine(db_url)
    report: dict = {}
    async with engine.connect() as conn:
        for source in ("openfoodfacts", "manual"):
            result = await conn.execute(text("""
                SELECT
                  COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE key_ingredients IS NOT NULL AND key_ingredients::jsonb ? 'nutrition') AS nutrition,
                  COUNT(*) FILTER (WHERE key_ingredients IS NOT NULL AND key_ingredients::jsonb ? 'ingredients') AS ingredients,
                  COUNT(*) FILTER (WHERE key_ingredients IS NOT NULL AND key_ingredients::jsonb ? 'nova_group') AS nova_group,
                  COUNT(*) FILTER (WHERE key_ingredients IS NOT NULL AND key_ingredients::jsonb ? 'labels') AS labels,
                  COUNT(*) FILTER (WHERE key_ingredients IS NOT NULL AND key_ingredients::jsonb ? 'countries') AS countries,
                  COUNT(*) FILTER (WHERE key_ingredients IS NOT NULL AND key_ingredients::jsonb ? 'serving_size') AS serving_size,
                  COUNT(*) FILTER (WHERE full_ingredients IS NOT NULL AND length(full_ingredients) > 0) AS full_ingredients,
                  COUNT(*) FILTER (WHERE COALESCE(cardinality(allergens_tags), 0) > 0) AS allergens,
                  COUNT(*) FILTER (WHERE COALESCE(cardinality(additives_tags), 0) > 0) AS additives,
                  COUNT(*) FILTER (WHERE ecoscore_grade IS NOT NULL AND ecoscore_grade <> '') AS ecoscore,
                  COUNT(*) FILTER (WHERE reg_number IS NOT NULL AND length(reg_number) > 0) AS reg_number
                FROM retail_products
                WHERE source = :source
            """), {"source": source})
            row = result.mappings().one()
            total = int(row["total"]) or 0
            entry = {k: int(v) for k, v in row.items()}
            entry["coverage"] = {k: round(int(v) / total, 2) if total else 0.0 for k, v in row.items() if k != "total"}
            report[source] = entry
            print(f"== {source} total={total} ==")
            for k, v in entry.items():
                print(f"  {k}: {v}")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
    await engine.dispose()
    print("Results written to", OUTPUT_FILE)


if __name__ == "__main__":
    asyncio.run(main())