"""
配方模块的 ORM 模型（适配器层）
SQLAlchemy 模型 — 仅用于数据库映射，不包含业务逻辑

依赖倒置：infrastructure → domain（domain 不依赖 infrastructure）
"""
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Enum, JSON, ForeignKey, Integer
from sqlalchemy.orm import relationship

from ..models.base import Base, ClassifiedMixin
from ..domain.entities import FormulaStatus


class FormulaORMModel(ClassifiedMixin, Base):
    """配方 ORM 模型"""
    __tablename__ = "formulas"

    id = Column(String(36), primary_key=True)
    name = Column(String(200), nullable=False)
    version = Column(String(20), nullable=False, default="1.0.0")
    description = Column(String(2000), default="")
    status = Column(
        Enum(FormulaStatus),
        default=FormulaStatus.DRAFT,
        nullable=False,
    )
    author_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    organization_id = Column(String(36), nullable=False)
    ingredients_json = Column(JSON, default=list)     # 原料列表（JSON 快照）
    target_effects_json = Column(JSON, default=list)   # 目标功效
    tags_json = Column(JSON, default=list)              # 标签
    nutrient_profile_json = Column(JSON, nullable=True) # 营养成分
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)

    # 数据分类（ADR-003）
    data_classification = Column(String(20), default="internal")

    # 乐观锁
    version_lock = Column(Integer, default=1, nullable=False)

    author = relationship("UserORMModel", lazy="joined")

    def __repr__(self) -> str:
        return f"<FormulaORM {self.id}: {self.name} ({self.status.name})>"
