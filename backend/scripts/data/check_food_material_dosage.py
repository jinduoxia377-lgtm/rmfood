#!/usr/bin/env python3
"""
检查 FoodMaterial 表安全剂量字段覆盖情况，输出 Markdown/CSV 报告。

功能：
- 统计 safe_dose_min / safe_dose_max 的覆盖情况（总数/有下限/有上限/两者都有/两者都缺）；
- 统计 food_homology=true 但剂量缺失的原料数量并列出清单；
- 输出 Markdown 或 CSV 报告（默认打印到 stdout，可用 --output 写文件）。

用法：
    python check_food_material_dosage.py [--format markdown|csv] [--output PATH] [--dry-run]

环境变量：
    DATABASE_URL  PostgreSQL 连接串（postgresql+asyncpg:// 或 postgresql:// 均可）

退出码：
    0  成功
    2  DATABASE_URL 未设置 / 数据库连接或查询失败
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List


def _normalize_database_url(url: str) -> str:
    """将 postgresql:// 或 postgres:// 归一化为 asyncpg 驱动 URL。"""
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


async def _collect_stats(database_url: str) -> Dict[str, Any]:
    """连接数据库并统计 FoodMaterial 剂量覆盖情况。"""
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = None
    try:
        engine = create_async_engine(database_url)
        async with engine.connect() as conn:
            total = (await conn.execute(text(
                "SELECT count(*) FROM food_materials"
            ))).scalar() or 0
            with_min = (await conn.execute(text(
                "SELECT count(*) FROM food_materials WHERE safe_dose_min IS NOT NULL"
            ))).scalar() or 0
            with_max = (await conn.execute(text(
                "SELECT count(*) FROM food_materials WHERE safe_dose_max IS NOT NULL"
            ))).scalar() or 0
            with_both = (await conn.execute(text(
                "SELECT count(*) FROM food_materials "
                "WHERE safe_dose_min IS NOT NULL AND safe_dose_max IS NOT NULL"
            ))).scalar() or 0
            with_neither = (await conn.execute(text(
                "SELECT count(*) FROM food_materials "
                "WHERE safe_dose_min IS NULL AND safe_dose_max IS NULL"
            ))).scalar() or 0
            homology_total = (await conn.execute(text(
                "SELECT count(*) FROM food_materials WHERE food_homology = TRUE"
            ))).scalar() or 0
            homology_missing = (await conn.execute(text(
                "SELECT count(*) FROM food_materials "
                "WHERE food_homology = TRUE AND (safe_dose_min IS NULL OR safe_dose_max IS NULL)"
            ))).scalar() or 0

            rows_result = await conn.execute(text(
                "SELECT id, name_cn, category, food_homology, safe_dose_min, safe_dose_max "
                "FROM food_materials "
                "WHERE food_homology = TRUE AND (safe_dose_min IS NULL OR safe_dose_max IS NULL) "
                "ORDER BY name_cn"
            ))
            missing_rows = [dict(r) for r in rows_result.mappings().all()]

            return {
                "total": int(total),
                "with_min": int(with_min),
                "with_max": int(with_max),
                "with_both": int(with_both),
                "with_neither": int(with_neither),
                "homology_total": int(homology_total),
                "homology_missing": int(homology_missing),
                "missing_rows": missing_rows,
            }
    except Exception as exc:  # noqa: BLE001
        _fail(f"数据库连接或查询失败: {exc}")
        return {}  # unreachable
    finally:
        if engine is not None:
            await engine.dispose()


def _render_markdown(stats: Dict[str, Any]) -> str:
    lines: List[str] = []
    lines.append("# FoodMaterial 安全剂量覆盖报告")
    lines.append("")
    lines.append(f"- 生成时间: {datetime.now(timezone.utc).isoformat()}")
    lines.append("")
    lines.append("## 总览")
    lines.append("")
    lines.append("| 指标 | 数值 |")
    lines.append("| --- | --- |")
    lines.append(f"| 原料总数 | {stats['total']} |")
    lines.append(f"| 有 safe_dose_min | {stats['with_min']} |")
    lines.append(f"| 有 safe_dose_max | {stats['with_max']} |")
    lines.append(f"| 两者都有 | {stats['with_both']} |")
    lines.append(f"| 两者都缺 | {stats['with_neither']} |")
    lines.append(f"| 药食同源原料数 (food_homology=true) | {stats['homology_total']} |")
    lines.append(f"| 药食同源且剂量缺失 | {stats['homology_missing']} |")
    lines.append("")
    lines.append("## 药食同源但剂量缺失清单")
    lines.append("")
    rows = stats["missing_rows"]
    if not rows:
        lines.append("（无）")
    else:
        lines.append("| ID | 名称 | 分类 | food_homology | safe_dose_min | safe_dose_max |")
        lines.append("| --- | --- | --- | --- | --- | --- |")
        for r in rows:
            lines.append(
                f"| {r['id']} | {r['name_cn'] or ''} | {r['category'] or ''} "
                f"| {r['food_homology']} | {r['safe_dose_min'] if r['safe_dose_min'] is not None else ''} "
                f"| {r['safe_dose_max'] if r['safe_dose_max'] is not None else ''} |"
            )
    lines.append("")
    lines.append("> 提示：可运行 `python seed_food_material_dosage.py --dry-run` 查看待回填的安全剂量。")
    return "\n".join(lines)


def _render_csv(stats: Dict[str, Any]) -> str:
    import csv
    import io

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "name_cn", "category", "food_homology", "safe_dose_min", "safe_dose_max"])
    for r in stats["missing_rows"]:
        writer.writerow([
            r["id"], r["name_cn"] or "", r["category"] or "", r["food_homology"],
            r["safe_dose_min"] if r["safe_dose_min"] is not None else "",
            r["safe_dose_max"] if r["safe_dose_max"] is not None else "",
        ])
    return buf.getvalue().strip()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="检查 FoodMaterial 表安全剂量覆盖情况并输出报告",
    )
    parser.add_argument(
        "--format", choices=["markdown", "csv"], default="markdown",
        help="报告格式（默认 markdown）",
    )
    parser.add_argument(
        "--output", "-o", default=None,
        help="输出文件路径（默认打印到 stdout）",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="仅打印报告到 stdout，不写文件（脚本本身只读，此参数用于与其他脚本保持一致）",
    )
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        _fail("未设置 DATABASE_URL 环境变量")

    stats = asyncio.run(_collect_stats(_normalize_database_url(database_url)))

    report = _render_markdown(stats) if args.format == "markdown" else _render_csv(stats)

    if args.output and not args.dry_run:
        try:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(report + "\n")
            print(f"报告已写入: {args.output}")
        except OSError as exc:
            _fail(f"写入报告失败: {exc}")
    else:
        print(report)


if __name__ == "__main__":
    main()