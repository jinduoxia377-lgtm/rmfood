"""
数据库基类定义
PostgreSQL（生产）/ SQLite（开发）双数据库支持
"""
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import MetaData

# 命名约定：表名使用复数蛇形
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """ORM 模型基类"""
    metadata = MetaData(naming_convention=convention)
