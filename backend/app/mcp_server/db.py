"""RMFOODFP stdio MCP 服务器 —— 独立 DB bootstrap 边界。

为什么需要这个模块：
stdio MCP 服务器是**独立子进程**（Claude Desktop / Cursor 以 ``command`` 拉起），
不经过 FastAPI 的 lifespan 启动流程。本模块为 stdio 进程提供一个**显式的
DB session 获取边界** ``db_session()``，供 ``tools.py`` 的只读查询使用。

关于"是否自建第二套 async engine"的决策（重要，诚实说明）：
诊断发现 ``app.core.database.session.get_engine()`` 本身就是**懒加载**的
（首次调用才 ``_create_engine()``），且已内置 Windows/asyncpg 稳定性调优
（NullPool、pool_recycle、statement_timeout、client_encoding=UTF8 等），
**完全不依赖 FastAPI lifespan**。因此"engine 未 bootstrap"并非本轮降级根因
（真因是 ``tools.py`` 用错了 FoodMaterial 字段名，见设计文档 §8）。

所以这里**不复制第二套 engine 工厂**（避免：双 engine 开销、Windows 调优漂移、
连接数翻倍），而是复用已调优的 ``get_session_factory()``，把 stdio 的 DB 访问
收敛到一个清晰的边界模块。若未来确认需要 stdio 完全独立的 engine（如隔离
连接池 / 独立超时），再在此处 ``create_async_engine`` 即可，接口不变。

用法：
    async with db_session() as db:
        rows = (await db.execute(select(...))).scalars().all()
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

logger = logging.getLogger("rmfood.mcp_server.db")


@asynccontextmanager
async def db_session() -> AsyncIterator["AsyncSession"]:  # noqa: F821 - 类型仅注解
    """提供一个有界的 async DB session（stdio 进程内使用）。

    首次调用会触发底层 engine 懒加载（复用 session.py 的平台调优）。
    退出时自动关闭 session。连接/查询异常由调用方（tools.py）捕获并降级。
    """
    from app.core.database.session import get_session_factory

    factory = get_session_factory()
    async with factory() as session:
        yield session


async def warmup() -> bool:
    """启动预热：触发 engine 懒加载 + ORM mapper 加载 + 首次真实查询。

    为什么不只 ``SELECT 1``：
    Windows 下 engine 用 NullPool（每次 checkout 新建连接，无池可预热），
    但首条 ORM 查询仍要付 **FoodMaterial 模型导入 + SQLAlchemy mapper 首次
    映射配置** 的开销。若不预热，进程内第一条 ``search_herbs`` 会因这部分
    一次性开销叠加连接建立，吃掉 ``DB_TIMEOUT_S=3.0`` 预算而降级 sample。
    这里用一次真实 ORM 查询把这些开销在启动时付掉，使首条业务查询即走 db。

    返回 True=可达；False=不可达（stdio 仍可启动，届时查询走 sample 兜底）。
    不抛异常——bootstrap 失败不应阻止 stdio 服务器进程起来。
    """
    try:
        from sqlalchemy import select

        from app.models.food_material import FoodMaterial

        async with db_session() as db:
            # 裸 SQL 确认连通
            from sqlalchemy import text

            await db.execute(text("SELECT 1"))
            # 真实 ORM 查询：触发 FoodMaterial mapper 加载 + 首次结果映射，
            # 消除首条 search_herbs 的 ORM 冷启动（降级 sample 的主因）。
            await db.execute(select(FoodMaterial).limit(1))
        logger.info("[mcp_server.db] DB 预热成功（含 FoodMaterial ORM mapper）")
        db_ok = True
    except Exception as exc:  # noqa: BLE001 - 预热失败不致命
        logger.warning("[mcp_server.db] DB 预热失败（将降级 sample）: %s", exc)
        db_ok = False

    # 预热重导入链（与 DB 无关但影响首查延迟）：
    # ``app.services.__init__`` 会急切导入整个服务栈（AIService/formula_designer/
    # reasoner/data_preprocessing 等重型依赖），首次 ``from app.services.
    # food_search.pinyin import ...`` 因此耗时约 8s。search_herbs 的拼音路会触发
    # 该导入，若不在启动时预付，进程内首条 search_herbs 会因 8s > DB_TIMEOUT_S
    # 而降级 sample。这里提前导入把开销付在启动期（一次性），使首查即走 db。
    # 失败不致命（拼音路自身有 try/except 兜底）。
    try:
        import app.services.food_search.pinyin  # noqa: F401 - 触发 app.services 包初始化

        logger.info("[mcp_server.db] 重导入链（app.services）预热完成")
    except Exception as exc:  # noqa: BLE001
        logger.debug("[mcp_server.db] 重导入链预热失败（不致命）: %s", exc)

    return db_ok


async def shutdown() -> None:
    """进程退出时释放底层 engine 连接（对 stdio 子进程是良好卫生）。"""
    try:
        from app.core.database.session import get_engine

        engine = get_engine()
        await engine.dispose()
        logger.info("[mcp_server.db] engine 已 dispose")
    except Exception as exc:  # noqa: BLE001
        logger.debug("[mcp_server.db] dispose 跳过: %s", exc)
