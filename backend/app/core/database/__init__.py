"""
数据库核心模块 - 导出必要的数据库组件
"""
from .session import (
    Base,
    async_session_factory,
    engine,
    get_engine,
    get_session_factory,
)

# 别名导出，兼容旧导入方式
async_engine = engine
async_session_maker = async_session_factory

__all__ = [
    "Base",
    "engine",
    "async_engine",
    "async_session_factory",
    "async_session_maker",
    "get_engine",
    "get_session_factory",
]
