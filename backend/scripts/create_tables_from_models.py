"""
Step 6 备选方案: 直接从 ORM 模型创建所有表结构

当 Alembic 迁移文件存在结构性问题时（重复表/断链），
使用此脚本从 SQLAlchemy Base.metadata 直接建表，然后 stamp head。
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from app.models.base import Base
# 导入所有模型以确保它们注册到 Base.metadata
from app.models import *  # noqa: F401, F403


async def main():
    url = settings.database_url
    print(f"📦 连接到: {url.split('@')[-1]}")

    engine = create_async_engine(url, echo=False)

    try:
        async with engine.begin() as conn:
            # 直接从模型元数据创建所有表
            print(f"⏳ 从 {len(Base.metadata.tables)} 个模型创建表...")
            await conn.run_sync(Base.metadata.create_all)
            print("✅ 所有表创建成功!")

        # 列出已创建的表
        async with engine.begin() as conn:
            tables = await conn.run_sync(
                lambda sync_conn: [
                    t[0] for t in sync_conn.execute(
                        text("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
                    ).fetchall()
                ]
            )
            print(f"\n📋 已创建 {len(tables)} 个表:")
            for t in tables:
                print(f"   ✓ {t}")

    finally:
        await engine.dispose()
        print("\n✅ 完成! 接下来运行: python -m alembic stamp head")


if __name__ == '__main__':
    from sqlalchemy import text
    asyncio.run(main())
