#!/usr/bin/env python3
"""
回填 FoodMaterial 表缺失的药食同源常用原料安全剂量。

内置一份「药食同源常用原料安全剂量表」（参考《中国药典》2020年版及药食同源目录常用量），
对 FoodMaterial 表中 safe_dose_min / safe_dose_max 为空的行按名称匹配回填。
仅更新缺失项，绝不覆盖已有值。

用法：
    python seed_food_material_dosage.py [--dry-run] [--name 黄芪]

环境变量：
    DATABASE_URL  PostgreSQL 连接串（postgresql+asyncpg:// 或 postgresql:// 均可）

退出码：
    0  成功（含 dry-run）
    2  DATABASE_URL 未设置 / 数据库连接或查询失败
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from typing import Any, Dict, List, Tuple

# 药食同源常用原料安全剂量表：(min_g/天, max_g/天, 来源)
# 参考《中国药典》2020年版一部常用饮片用量及药食同源目录推荐量。
BUILTIN_DOSAGE: Dict[str, Tuple[float, float, str]] = {
    "黄芪": (9, 30, "《中国药典》2020年版"),
    "当归": (6, 12, "《中国药典》2020年版"),
    "党参": (9, 30, "《中国药典》2020年版"),
    "枸杞子": (6, 15, "《中国药典》2020年版"),
    "枸杞": (6, 15, "《中国药典》2020年版"),
    "甘草": (2, 10, "《中国药典》2020年版"),
    "茯苓": (10, 15, "《中国药典》2020年版"),
    "山药": (15, 30, "《中国药典》2020年版"),
    "大枣": (6, 15, "《中国药典》2020年版"),
    "红枣": (6, 15, "药食同源常用量"),
    "人参": (3, 9, "《中国药典》2020年版"),
    "三七": (3, 9, "《中国药典》2020年版"),
    "丹参": (10, 15, "《中国药典》2020年版"),
    "菊花": (6, 10, "《中国药典》2020年版"),
    "金银花": (6, 15, "《中国药典》2020年版"),
    "桑葚": (9, 15, "《中国药典》2020年版"),
    "桑椹": (9, 15, "《中国药典》2020年版"),
    "山楂": (9, 12, "《中国药典》2020年版"),
    "陈皮": (3, 10, "《中国药典》2020年版"),
    "龙眼肉": (9, 15, "《中国药典》2020年版"),
    "桂圆": (9, 15, "药食同源常用量"),
    "莲子": (6, 15, "《中国药典》2020年版"),
    "薏苡仁": (9, 30, "《中国药典》2020年版"),
    "赤小豆": (9, 30, "《中国药典》2020年版"),
    "绿豆": (15, 30, "药食同源常用量"),
    "黑芝麻": (9, 15, "《中国药典》2020年版"),
    "核桃仁": (6, 9, "《中国药典》2020年版"),
    "甜杏仁": (6, 10, "《中国药典》2020年版"),
    "生姜": (3, 10, "《中国药典》2020年版"),
    "干姜": (3, 10, "《中国药典》2020年版"),
    "大蒜": (3, 9, "药食同源常用量"),
    "白扁豆": (9, 15, "《中国药典》2020年版"),
    "芡实": (9, 15, "《中国药典》2020年版"),
    "百合": (6, 12, "《中国药典》2020年版"),
    "麦芽": (10, 15, "《中国药典》2020年版"),
    "莱菔子": (6, 10, "《中国药典》2020年版"),
    "决明子": (9, 15, "《中国药典》2020年版"),
    "酸枣仁": (10, 15, "《中国药典》2020年版"),
    "柏子仁": (3, 10, "《中国药典》2020年版"),
    "五味子": (2, 6, "《中国药典》2020年版"),
    "乌梅": (6, 12, "《中国药典》2020年版"),
    "薄荷": (3, 6, "《中国药典》2020年版"),
    "紫苏": (5, 10, "《中国药典》2020年版"),
    "藿香": (3, 10, "《中国药典》2020年版"),
    "蒲公英": (10, 30, "《中国药典》2020年版"),
    "鱼腥草": (15, 30, "《中国药典》2020年版"),
    "马齿苋": (9, 15, "《中国药典》2020年版"),
    "葛根": (10, 15, "《中国药典》2020年版"),
    "桔梗": (3, 10, "《中国药典》2020年版"),
    "玉竹": (6, 12, "《中国药典》2020年版"),
    "黄精": (9, 15, "《中国药典》2020年版"),
    "石斛": (6, 12, "《中国药典》2020年版"),
    "麦冬": (6, 12, "《中国药典》2020年版"),
    "天麻": (3, 10, "《中国药典》2020年版"),
    "灵芝": (6, 12, "《中国药典》2020年版"),
    "猴头菇": (10, 20, "药食同源常用量"),
    "香菇": (9, 15, "药食同源常用量"),
    "银耳": (9, 15, "药食同源常用量"),
    "黑木耳": (9, 15, "药食同源常用量"),
    "海带": (6, 12, "药食同源常用量"),
    "昆布": (6, 12, "《中国药典》2020年版"),
    "玫瑰花": (3, 6, "《中国药典》2020年版"),
    "佛手": (3, 9, "《中国药典》2020年版"),
    "砂仁": (3, 6, "《中国药典》2020年版"),
    "白芷": (3, 9, "《中国药典》2020年版"),
    "肉桂": (1, 5, "《中国药典》2020年版"),
    "八角茴香": (3, 6, "《中国药典》2020年版"),
    "花椒": (2, 5, "《中国药典》2020年版"),
    "高良姜": (3, 6, "《中国药典》2020年版"),
    "小茴香": (3, 6, "《中国药典》2020年版"),
}


def _normalize_database_url(url: str) -> str:
    url = (url or "").strip()
    if url.startswith("postgresql+asyncpg://") or url.startswith("postgres+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


def _fail(message: str) -> None:
    print(f"错误: {message}", file=sys.stderr)
    sys.exit(2)


async def _find_candidates(database_url: str, name: str) -> List[Dict[str, Any]]:
    """按名称精确/别名模糊匹配 FoodMaterial 行。"""
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = None
    try:
        engine = create_async_engine(database_url)
        async with engine.connect() as conn:
            result = await conn.execute(
                text(
                    "SELECT id, name_cn, aliases, safe_dose_min, safe_dose_max "
                    "FROM food_materials "
                    "WHERE name_cn = :name OR array_to_string(aliases, ',') ILIKE :pattern "
                    "ORDER BY name_cn"
                ),
                {"name": name, "pattern": f"%{name}%"},
            )
            rows = [dict(r) for r in result.mappings().all()]
            return rows
    except Exception as exc:  # noqa: BLE001
        _fail(f"数据库连接或查询失败: {exc}")
        return []  # unreachable
    finally:
        if engine is not None:
            await engine.dispose()


async def _apply_update(database_url: str, row_id: int, new_min: float, new_max: float) -> None:
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = None
    try:
        engine = create_async_engine(database_url)
        async with engine.connect() as conn:
            await conn.execute(
                text(
                    "UPDATE food_materials "
                    "SET safe_dose_min = COALESCE(safe_dose_min, :new_min), "
                    "    safe_dose_max = COALESCE(safe_dose_max, :new_max), "
                    "    updated_at = now() "
                    "WHERE id = :id"
                ),
                {"id": row_id, "new_min": new_min, "new_max": new_max},
            )
            await conn.commit()
    except Exception as exc:  # noqa: BLE001
        _fail(f"数据库更新失败: {exc}")
    finally:
        if engine is not None:
            await engine.dispose()


async def _run(database_url: str, dry_run: bool, name_filter: str | None) -> int:
    total_updated = 0
    total_candidates = 0

    for name, (dose_min, dose_max, source) in BUILTIN_DOSAGE.items():
        if name_filter and name_filter not in name:
            continue

        rows = await _find_candidates(database_url, name)
        total_candidates += len(rows)

        for row in rows:
            old_min = row["safe_dose_min"]
            old_max = row["safe_dose_max"]
            new_min = dose_min if old_min is None else old_min
            new_max = dose_max if old_max is None else old_max

            # 仅回填缺失项：至少有一个字段为空时才认为需要更新
            needs_update = old_min is None or old_max is None
            if not needs_update:
                continue

            if dry_run:
                print(
                    f"[dry-run] 将回填 id={row['id']} name_cn={row['name_cn']} "
                    f"safe_dose_min={old_min} -> {new_min}，"
                    f"safe_dose_max={old_max} -> {new_max}（来源：{source}）"
                )
            else:
                await _apply_update(database_url, row["id"], new_min, new_max)
                print(
                    f"[已更新] id={row['id']} name_cn={row['name_cn']} "
                    f"safe_dose_min={old_min} -> {new_min}，"
                    f"safe_dose_max={old_max} -> {new_max}（来源：{source}）"
                )
            total_updated += 1

    print(f"\n汇总：匹配到 {total_candidates} 行，{'待回填' if dry_run else '实际更新'} {total_updated} 行。")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="回填 FoodMaterial 表缺失的药食同源常用原料安全剂量（仅补缺失项，不覆盖已有值）",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="仅预览将回填的行，不执行数据库更新",
    )
    parser.add_argument(
        "--name", default=None,
        help="仅处理指定名称（子串匹配内置剂量表名称）",
    )
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        _fail("未设置 DATABASE_URL 环境变量")

    try:
        exit_code = asyncio.run(_run(_normalize_database_url(database_url), args.dry_run, args.name))
    except SystemExit as exc:
        raise exc
    except Exception as exc:  # noqa: BLE001
        _fail(f"执行失败: {exc}")
    sys.exit(exit_code)


if __name__ == "__main__":
    main()