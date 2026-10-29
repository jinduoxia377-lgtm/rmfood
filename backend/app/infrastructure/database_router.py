from __future__ import annotations

"""
[DEPRECATED] 数据库读写分离路由

此模块已在 Sprint 2.2 中标记为废弃。
统一数据库会话管理已迁移至 core/session.py。

保留此文件以防未来需要重新引入读写分离。
如需使用，请先删除 core/session.py 中的 engine 定义。
"""
# ── 以下为原始内容（已废弃） ──
"""
       │
┌──────▼────────────────┐
│  DatabaseRouter       │
│  - write() → Primary  │
│  - read()  → Replica  │
└──────┬────────────────┘
       │
┌──────▼──────┐  ┌──────▼──────┐
│  Primary    │  │  Replica    │
│  (Postgres) │  │  (Postgres) │
└─────────────┘  └─────────────┘
       │
┌──────▼──────┐
│  PgBouncer  │ (连接池)
└─────────────┘
"""
import logging  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402
from typing import AsyncGenerator, Literal, Optional  # noqa: E402

from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from ..core.config import settings  # noqa: E402

logger = logging.getLogger(__name__)


class DatabaseRouter:
    """
    读写分离数据库路由器

    策略：
    - 写操作（INSERT/UPDATE/DELETE）→ 主库
    - 读操作（SELECT）→ 从库（有从库时）
    - 事务内的读操作 → 主库（保持一致性）
    - 无从库配置时 → 全部路由到主库
    """

    def __init__(self):
        self._primary_engine: Optional[AsyncEngine] = None
        self._replica_engine: Optional[AsyncEngine] = None
        self._primary_session_factory: Optional[async_sessionmaker] = None
        self._replica_session_factory: Optional[async_sessionmaker] = None

    def initialize(self) -> None:
        """初始化主库和从库引擎"""
        self._primary_engine = self._create_engine(
            settings.database.url,
            pool_size=settings.database.pool_size,
            max_overflow=settings.database.max_overflow,
        )
        self._primary_session_factory = async_sessionmaker(
            self._primary_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )

        # 如果配置了只读副本 URL，则创建副本引擎
        if settings.database_read_replica_url:
            self._replica_engine = self._create_engine(
                settings.database_read_replica_url,
                pool_size=settings.database.pool_size // 2,
                max_overflow=settings.database.max_overflow // 2,
                # 只读副本使用更短的超时
                pool_recycle=settings.database.pool_recycle // 2,
            )
            self._replica_session_factory = async_sessionmaker(
                self._replica_engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autoflush=False,
            )
            logger.info("读写分离已启用 | 主库 + 从库")
        else:
            self._replica_session_factory = None
            logger.info("数据库单实例模式 | 未配置只读副本")

        logger.info("DatabaseRouter 初始化完成")

    async def close_all(self) -> None:
        """关闭所有数据库连接"""
        if self._primary_engine:
            await self._primary_engine.dispose()
        if self._replica_engine:
            await self._replica_engine.dispose()
        logger.info("DatabaseRouter 已关闭")

    # ─── 会话获取 ───

    @asynccontextmanager
    async def get_session(
        self,
        mode: Literal["write", "read"] = "write",
    ) -> AsyncGenerator[AsyncSession, None]:
        """
        获取数据库会话（自动路由）

        Args:
            mode: "write" 使用主库, "read" 使用从库（若有）

        Yields:
            AsyncSession
        """
        if mode == "read" and self._replica_session_factory:
            factory = self._replica_session_factory
        else:
            factory = self._primary_session_factory

        async with factory() as session:
            try:
                yield session
                await session.commit()
            except Exception as db_err:
                logger.warning("数据库会话提交失败，执行回滚: %s", db_err)
                await session.rollback()
                raise
            finally:
                await session.close()

    # ─── 写操作会话 ───

    @asynccontextmanager
    async def write_session(self) -> AsyncGenerator[AsyncSession, None]:
        """获取主库写会话"""
        async with self.get_session("write") as session:
            yield session

    # ─── 读操作会话 ───

    @asynccontextmanager
    async def read_session(self) -> AsyncGenerator[AsyncSession, None]:
        """获取从库读会话（若无从库则回退到主库）"""
        async with self.get_session("read") as session:
            yield session

    # ─── 显式事务 ───

    @asynccontextmanager
    async def transaction(self) -> AsyncGenerator[AsyncSession, None]:
        """
        开启显式事务（全部使用主库，保证一致性）

        适用于：
        - 需要在单个事务中执行多个操作
        - 先读后写的场景（如变更审批流程）
        """
        async with self._primary_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception as db_err:
                logger.warning("数据库会话提交失败，执行回滚: %s", db_err)
                await session.rollback()
                raise
            finally:
                await session.close()

    # ─── 健康检查 ───

    async def check_health(self) -> dict:
        """检查主从库健康状态"""
        status = {"primary": False, "replica": False}

        try:
            async with self._primary_engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
                status["primary"] = True
        except Exception as e:
            logger.error(f"主库健康检查失败: {e}")

        if self._replica_engine:
            try:
                async with self._replica_engine.connect() as conn:
                    await conn.execute(text("SELECT 1"))
                    status["replica"] = True
            except Exception as e:
                logger.error(f"从库健康检查失败: {e}")

        return status

    # ─── 内部方法 ───

    @staticmethod
    def _create_engine(
        database_url: str,
        pool_size: int = 20,
        max_overflow: int = 10,
        pool_recycle: int = 1800,
    ) -> AsyncEngine:
        """创建异步数据库引擎"""
        return create_async_engine(
            database_url,
            echo=settings.debug,
            future=True,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_timeout=settings.database.pool_timeout,
            pool_recycle=pool_recycle,
            pool_pre_ping=True,
            connect_args={
                "server_settings": {
                    "application_name": "rmfood",
                    "jit": "off",
                    "client_encoding": "UTF8",
                },
            },
        )


# 全局数据库路由器实例
router = DatabaseRouter()
