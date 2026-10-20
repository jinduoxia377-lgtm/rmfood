"""修复 alembic 版本表：将数据库基线标记为合并后的唯一 head。

背景：
- 历史迁移 20260918 的 down_revision 曾被误写为 None，导致 DAG 分叉出多个 head；
- 已修复该迁移文件，并用 alembic merge 生成了合并迁移 4dfbe6e25d76；
- 数据库 alembic_version 表仍残留旧 head 行（20261013_000000 等），
  导致 `alembic upgrade head` 报 overlapping。

本脚本将 alembic_version 表重置为唯一 head：4dfbe6e25d76。
（所有实际表结构均已存在于数据库，标记合并 head 为基线是安全的。）
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from app.core.database.session import async_session_factory

MERGE_HEAD = "4dfbe6e25d76"


async def main() -> None:
    async with async_session_factory() as db:
        await db.execute(text("DELETE FROM alembic_version"))
        await db.execute(
            text("INSERT INTO alembic_version (version_num) VALUES (:v)"),
            {"v": MERGE_HEAD},
        )
        await db.commit()
        print(f"ALEMBIC_HEAD_FIX_OK head={MERGE_HEAD}")


if __name__ == "__main__":
    asyncio.run(main())