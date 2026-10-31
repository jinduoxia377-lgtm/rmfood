"""One-time data repair: fix garbled food_materials.name_cn (source-data typos).

诊断结论（2026-10-28）：
  food_materials.name_cn 中 4 行存在乱码/错字（狐梱子/黄芫/山椰/薰舒仐），
  而 name_latin 正确。乱码形式与正确名称等长（逐字符替换），判定为
  源数据错字（OCR/录入错误），非 UTF-8/GBK 编码错位（编码错位会改变字符数）。
  正确名称以《食品安全国家标准 保健食品》食药物质目录 / 平台药食同源目录为准：
    Lycium barbarum -> 枸杞子
    Astragalus membranaceus -> 黄芪
    Crataegus pinnatifida -> 山楂
    Coix lacryma-jobi -> 薏苡仁

用法：
  python fix_food_material_name_cn.py
  读 DATABASE_URL（或 backend/.env）连接 PostgreSQL，幂等批量 UPDATE。
"""
import asyncio
import os
import sys

import asyncpg

# 正确 -> 乱码 映射（按 name_latin 定位，name_cn 需为乱码值才更新，幂等且安全）
# (name_latin, garbled_name_cn, correct_name_cn)
FIX_MAP = [
    ("Lycium barbarum",         "狐梱子", "枸杞子"),
    ("Astragalus membranaceus", "黄芫",   "黄芪"),
    ("Crataegus pinnatifida",   "山椰",   "山楂"),
    ("Coix lacryma-jobi",       "薰舒仐", "薏苡仁"),
]


def _dsn() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        # 回退读取 backend/.env
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
        try:
            with open(env_path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("DATABASE_URL="):
                        url = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
        except OSError:
            pass
    if not url:
        url = "postgresql://postgres:password@localhost:5432/rmfood"
    # asyncpg 不接受 "+asyncpg" 方言后缀
    return url.replace("postgresql+asyncpg://", "postgresql://").replace("postgres+asyncpg://", "postgresql://")


async def main() -> int:
    conn = await asyncpg_connect()
    try:
        changed = 0
        for latin, garbled, correct in FIX_MAP:
            # before
            before = await conn.fetchrow(
                "SELECT id, name_cn FROM food_materials WHERE name_latin = $1 AND name_cn = $2",
                latin, garbled,
            )
            if before is None:
                # 已修复 / 不存在：仅展示当前值供核对
                cur = await conn.fetchrow(
                    "SELECT id, name_cn FROM food_materials WHERE name_latin = $1", latin
                )
                print(f"[skip] {latin}: 无乱码行待修"
                      + (f"（当前 name_cn={cur['name_cn']!r}）" if cur else "（未找到）"))
                continue
            # update
            updated = await conn.execute(
                "UPDATE food_materials SET name_cn = $1 WHERE name_latin = $2 AND name_cn = $3",
                correct, latin, garbled,
            )
            changed += 1
            print(f"[fix ] id={before['id']} {latin}: {garbled!r} -> {correct!r}  ({updated})")
        print(f"TOTAL_FIXED: {changed}")
        return 0
    finally:
        await conn.close()


async def asyncpg_connect():
    return await asyncpg.connect(_dsn())


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
