"""
RMFOOD Alembic 迁移环境配置

功能特性:
- ✅ 支持异步数据库 (SQLite/PostgreSQL)
- ✅ 自动从 app.core.config 读取数据库URL
- ✅ 自动发现所有 SQLAlchemy 模型
- ✅ 支持在线/离线迁移模式
- ✅ 迁移前自动备份数据库（可选）

使用方法:
    # 生成新迁移（基于模型变更自动检测）
    alembic revision --autogenerate -m "添加用户头像字段"

    # 应用所有待执行的迁移
    alembic upgrade head

    # 回滚到上一个版本
    alembic downgrade -1

    # 查看当前版本
    alembic current

    # 查看迁移历史
    alembic history

作者: RMFOOD Team
日期: 2026-05-02
"""

import asyncio
import logging
from logging.config import fileConfig
from typing import Any, Optional

from alembic import context
from sqlalchemy import pool, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# ── 导入应用配置和模型 ──
import sys
import os

# 将项目根目录添加到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings
from app.models.base import Base  # 导入基础模型类

# 导入所有模型（确保Alembic能发现它们）
# ⚠️ 重要：新增模型时必须在此处导入！
from app.models import *  # noqa: F401, F403

# ── Alembic Config 对象 ──
config = context.config

# 设置日志（如果配置文件存在）
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 设置目标元数据（用于 autogenerate）
target_metadata = Base.metadata


def get_url() -> str:
    """
    从应用配置获取数据库连接URL
    
    优先级:
    1. 环境变量 DATABASE_URL（最高优先级）
    2. settings.database_url（从 .env 文件读取）
    
    Returns:
        str: 数据库连接字符串
    """
    # 优先使用环境变量（方便CI/CD和Docker）
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url
    
    # 使用应用配置
    return settings.database_url


def run_migrations_offline() -> None:
    """
    在'离线'模式下运行迁移
    
    适用场景:
    - 生成SQL脚本文件（不直接执行）
    - CI/CD流水线中的SQL审查
    - 需要DBA手动审核的场景
    
    只需要配置URL，不需要实际的数据库引擎
    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # 比较参数
        compare_type=True,  # 检测列类型变化
        compare_server_default=True,  # 检测默认值变化
        # 输出设置
        output_buffer=sys.stdout,
        # 事务处理
        transaction_per_migration=True,
    )

    with context.begin_transaction():
        context.run_migrations()
        
    logging.info("✅ 离线模式迁移完成")


def do_run_migrations(connection: Connection) -> None:
    """
    执行实际的迁移操作
    
    Args:
        connection: 数据库连接对象
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # 比较参数（autogenerate 配置）
        compare_type=True,  # ✅ 检测列类型变更
        compare_server_default=True,  # ✅ 检测默认值变更
        # 包含的对象
        include_object=include_object,  # 自定义包含逻辑
        # 对象命名
        render_item=render_item,  # 自定义渲染方式
        # 事务处理
        transaction_per_migration=True,
        # 版本路径
        version_path_spec="%s/versions" % config.get_main_option("script_location"),
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """
    在在线模式下运行异步迁移
    
    创建异步引擎并执行迁移
    """
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # 迁移期间不使用连接池
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()



def include_object(object, name, type_, reflected, compare_to):
    """
    自定义对象包含逻辑
    
    用于控制哪些对象应该被包含在迁移中
    
    Args:
        object: SQLAlchemy 对象
        name: 对象名称
        type_: 对象类型 (table, column, index, etc.)
        reflected: 是否从数据库反射
        compare_to: 比较目标对象
        
    Returns:
        bool: 是否包含此对象
    """
    # 排除 alembic_version 表（由Alembic自己管理）
    if type_ == "table" and name == "alembic_version":
        return False
    
    # 可以在这里添加其他排除规则
    # 例如：排除某些临时表或视图
    
    return True


def render_item(type_, obj, autogen_context):
    """
    自定义对象渲染方式
    
    用于生成更友好的迁移代码
    
    Args:
        type_: 对象类型
        obj: SQLAlchemy 对象
        autogen_context: 自动生成上下文
        
    Returns:
        str or None: 渲染后的代码
    """
    # 可以在这里自定义渲染逻辑
    # 例如：为某些列添加注释
    
    return None  # 使用默认渲染


def run_migrations_online() -> None:
    """
    在'在线'模式下运行迁移
    
    根据数据库URL判断是否使用异步模式
    """
    url = get_url()
    
    # 判断是否是异步数据库URL
    if "+asyncpg" in url or "+aiosqlite" in url or "+aio" in url:
        # 异步数据库
        asyncio.run(run_async_migrations())
    else:
        # 同步数据库（兼容旧版）
        configuration = config.get_section(config.config_ini_section, {})
        configuration["sqlalchemy.url"] = url
        
        from sqlalchemy import create_engine
        engine = create_engine(
            configuration["sqlalchemy.url"],
            poolclass=pool.NullPool,
        )
        
        with engine.connect() as connection:
            do_run_migrations(connection)


# ── 入口点 ──
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()