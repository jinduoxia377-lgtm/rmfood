"""
数据库 ORM 基类定义

仅支持 PostgreSQL 数据库。使用 SQLAlchemy 2.0 声明式映射。
命名约定遵循 PostgreSQL 最佳实践，确保索引和约束名称的一致性。
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
