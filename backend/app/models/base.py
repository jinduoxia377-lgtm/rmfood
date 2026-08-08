"""RMFOOD 基础模型

所有模型的基类，提供通用字段和方法

架构说明:
  BaseModel 继承自 app.core.database.Base（SQLAlchemy DeclarativeBase）。
  领域模型依赖持久化机制在此项目中是有意为之——详见 ADR-004。
"""
import sqlalchemy as sa
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Boolean, select, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, declared_attr
from ..core.database import Base
from sqlalchemy.orm import declarative_base


# 创建扩展性 Base，允许表定义重复
ExtendedBase = declarative_base(cls=_BaseWithExtendExisting) if False else Base
from .utils import now_utc_mapped


class BaseModel(Base):
    """基础模型类"""
    __abstract__ = True

    @declared_attr
    def __tablename__(cls) -> str:
        """自动生成表名为类名的小写复数形式"""
        import inflection
        return inflection.underscore(cls.__name__)

    @declared_attr
    def id(cls) -> Mapped[int]:
        return mapped_column(BigInteger, primary_key=True, autoincrement=True)

    @declared_attr
    def created_at(cls) -> Mapped[datetime]:
        return mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False)

    @declared_attr
    def updated_at(cls) -> Mapped[datetime]:
        return mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False)

    def to_dict(self) -> dict:
        """将模型转换为字典"""
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.id})>"


class SoftDeleteMixin:
    """
    软删除 Mixin

    为模型添加软删除支持：
    - deleted_at: 删除时间戳（NULL 表示未删除）
    - is_deleted: 是否已删除（计算属性）
    - soft_delete(): 软删除方法
    - restore(): 恢复方法

    使用方式:
        class Formula(SoftDeleteMixin, Base):
            __tablename__ = "formulas"
            ...
    """

    @declared_attr
    def deleted_at(cls) -> Mapped[Optional[datetime]]:
        return mapped_column(DateTime(timezone=True), nullable=True, default=None, index=True)

    @property
    def is_deleted(self) -> bool:
        """是否已删除"""
        return self.deleted_at is not None

    def soft_delete(self) -> None:
        """软删除（设置 deleted_at 时间戳）"""
        self.deleted_at = now_utc_mapped()

    def restore(self) -> None:
        """恢复已删除的记录"""
        self.deleted_at = None


class SoftDeleteQueryMixin:
    """
    软删除查询 Mixin

    提供自动过滤已删除记录的查询方法。

    使用方式:
        from app.models.base import SoftDeleteQueryMixin

        class FormulaService:
            def __init__(self, db):
                self.db = db

            async def list_formulas(self):
                # 自动过滤已删除的记录
                query = SoftDeleteQueryMixin.active_only(select(Formula))
                result = await self.db.execute(query)
                return result.scalars().all()
    """

    @staticmethod
    def active_only(query):
        """过滤已删除的记录（假设模型有 deleted_at 字段）"""
        from sqlalchemy import inspect as sqla_inspect
        # 获取模型类
        model_class = query.column_descriptions[0]['type']
        if hasattr(model_class, 'deleted_at'):
            return query.where(model_class.deleted_at.is_(None))
        return query

    @staticmethod
    def include_deleted(query):
        """包含已删除的记录（不过滤）"""
        return query

    @staticmethod
    def only_deleted(query):
        """只返回已删除的记录"""
        from sqlalchemy import inspect as sqla_inspect
        model_class = query.column_descriptions[0]['type']
        if hasattr(model_class, 'deleted_at'):
            return query.where(model_class.deleted_at.isnot(None))
        return query


class ClassifiedMixin:
    """
    数据分类 Mixin（ADR-003）

    为敏感数据模型添加分类标记和保留策略。
    配合数据脱敏工具使用，实现四层分级管控。

    使用方式:
        class Formula(ClassifiedMixin, SoftDeleteMixin, Base):
            __tablename__ = "formulas"
            ...
    """

    @declared_attr
    def data_classification(cls) -> Mapped[str]:
        """数据分类等级：public/internal/secret/top_secret"""
        return mapped_column(
            sa.String(20),
            default="internal",
            nullable=False,
            index=True,
            server_default="internal",
        )

    @declared_attr
    def data_retention_days(cls) -> Mapped[Optional[int]]:
        """数据保留天数（NULL 表示永久保留）"""
        return mapped_column(sa.Integer, nullable=True, default=None)

    @declared_attr
    def data_owner(cls) -> Mapped[Optional[str]]:
        """数据责任人（用户 ID 或团队名）"""
        return mapped_column(sa.String(100), nullable=True, default=None)

    @property
    def is_top_secret(self) -> bool:
        return self.data_classification == "top_secret"

    @property
    def is_secret(self) -> bool:
        return self.data_classification in ("secret", "top_secret")

    def set_classification(self, level: str, retention_days: int = None, owner: str = None) -> None:
        """设置数据分类（需在 service 层做权限校验）"""
        valid_levels = {"public", "internal", "secret", "top_secret"}
        if level not in valid_levels:
            raise ValueError(f"无效的数据分类等级: {level}，可选: {valid_levels}")
        self.data_classification = level
        if retention_days is not None:
            self.data_retention_days = retention_days
        if owner is not None:
            self.data_owner = owner

    def should_expire(self, reference_date: datetime = None) -> bool:
        """检查数据是否已过保留期"""
        if self.data_retention_days is None:
            return False
        if reference_date is None:
            from datetime import timezone
            reference_date = datetime.now(timezone.utc)
        if not hasattr(self, 'created_at') or self.created_at is None:
            return False
        expiration_date = self.created_at.replace(tzinfo=None) if self.created_at.tzinfo else self.created_at
        from datetime import timedelta
        return reference_date - expiration_date > timedelta(days=self.data_retention_days)


# sa imported at top of file
