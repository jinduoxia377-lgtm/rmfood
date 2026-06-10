"""RMFOOD 配方模型"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, JSON, Enum, ForeignKey, Table, Column, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base
from .base import ClassifiedMixin
from .enums import FormulaStatus
from .peptide_analysis import PeptideAnalysis
from .peptide_design import PeptideDesign


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


formula_ingredients = Table(
    "formula_ingredients",
    Base.metadata,
    Column("formula_id", Integer, ForeignKey("formulas.id", ondelete="CASCADE"), primary_key=True),
    Column("ingredient_id", Integer, ForeignKey("ingredients.id", ondelete="CASCADE"), primary_key=True),
)

formula_peptides = Table(
    "formula_peptides",
    Base.metadata,
    Column("formula_id", Integer, ForeignKey("formulas.id", ondelete="CASCADE"), primary_key=True),
    Column("peptide_id", Integer, ForeignKey("peptides.id", ondelete="CASCADE"), primary_key=True),
)


formula_categories = Table(
    "formula_categories",
    Base.metadata,
    Column("formula_id", Integer, ForeignKey("formulas.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", Integer, ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
)

formula_tags = Table(
    "formula_tags",
    Base.metadata,
    Column("formula_id", Integer, ForeignKey("formulas.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("categories.id", ondelete="SET NULL"))
    description: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    parent: Mapped["Category | None"] = relationship("Category", remote_side="Category.id", back_populates="children")
    children: Mapped[list["Category"]] = relationship("Category", back_populates="parent", cascade="all, delete-orphan")
    formulas: Mapped[list["Formula"]] = relationship("Formula", secondary=formula_categories, back_populates="categories")


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    color: Mapped[str | None] = mapped_column(String(20), default="#6366f1")
    icon: Mapped[str | None] = mapped_column(String(50))
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    formulas: Mapped[list["Formula"]] = relationship("Formula", secondary=formula_tags, back_populates="tags")


class Formula(ClassifiedMixin, Base):
    __tablename__ = "formulas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[FormulaStatus] = mapped_column(
        Enum(FormulaStatus), default=FormulaStatus.DRAFT, nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    target_effects: Mapped[list | None] = mapped_column(JSON, default=list)
    composition: Mapped[dict | None] = mapped_column(JSON, default=dict)
    processing_method: Mapped[str | None] = mapped_column(Text)
    dosage: Mapped[str | None] = mapped_column(String(100))
    storage_conditions: Mapped[str | None] = mapped_column(String(200))
    shelf_life: Mapped[int | None] = mapped_column(Integer)

    safety_check: Mapped[dict | None] = mapped_column(JSON, default=dict)
    compliance_status: Mapped[dict | None] = mapped_column(JSON, default=dict)
    ai_recommendations: Mapped[dict | None] = mapped_column(JSON, default=dict)
    synergy_analysis: Mapped[dict | None] = mapped_column(JSON, default=dict)

    creator_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    reviewer_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    review_notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    creator: Mapped["User"] = relationship("User", back_populates="created_formulas", foreign_keys=[creator_id])
    reviewer: Mapped["User | None"] = relationship("User", back_populates="reviewed_formulas", foreign_keys=[reviewer_id])
    version_history: Mapped[list["FormulaVersion"]] = relationship(
        "FormulaVersion", back_populates="formula", order_by="FormulaVersion.version.desc()"
    )
    ingredients: Mapped[list["Ingredient"]] = relationship(
        "Ingredient", secondary=formula_ingredients, back_populates="formulas"
    )
    peptides: Mapped[list["Peptide"]] = relationship(
        "Peptide", secondary=formula_peptides, back_populates="formulas"
    )
    experiments: Mapped[list["Experiment"]] = relationship("Experiment", back_populates="formula")
    categories: Mapped[list["Category"]] = relationship("Category", secondary=formula_categories, back_populates="formulas")
    tags: Mapped[list["Tag"]] = relationship("Tag", secondary=formula_tags, back_populates="formulas")


class FormulaVersion(Base):
    __tablename__ = "formula_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    formula_id: Mapped[int] = mapped_column(Integer, ForeignKey("formulas.id", ondelete="CASCADE"))
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    change_summary: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    formula: Mapped["Formula"] = relationship("Formula", back_populates="version_history")


class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_cn: Mapped[str | None] = mapped_column(String(200))
    category: Mapped[str | None] = mapped_column(String(100))
    source: Mapped[str | None] = mapped_column(String(200))
    properties: Mapped[dict | None] = mapped_column(JSON, default=dict)
    is_food_homology: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    formulas: Mapped[list["Formula"]] = relationship(
        "Formula", secondary=formula_ingredients, back_populates="ingredients"
    )


class Peptide(Base):
    __tablename__ = "peptides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sequence: Mapped[str] = mapped_column(String(500), nullable=False)
    source_protein: Mapped[str | None] = mapped_column(String(200))
    source_organism: Mapped[str | None] = mapped_column(String(200))
    activity_type: Mapped[str | None] = mapped_column(String(100))
    activity_value: Mapped[float | None] = mapped_column(Float)
    activity_unit: Mapped[str | None] = mapped_column(String(50))
    molecular_weight: Mapped[float | None] = mapped_column(Float)
    dfbp_id: Mapped[str | None] = mapped_column(String(50))
    analysis_count: Mapped[int] = mapped_column(Integer, default=0, comment="关联分析次数")
    last_analysis_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="最后分析时间")
    design_usage_count: Mapped[int] = mapped_column(Integer, default=0, comment="被设计使用的次数")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="软删除时间戳")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    formulas: Mapped[list["Formula"]] = relationship(
        "Formula", secondary=formula_peptides, back_populates="peptides"
    )
    analyses = relationship("PeptideAnalysis", back_populates="peptide", foreign_keys="PeptideAnalysis.peptide_id")


from sqlalchemy import Boolean
from .user_model import User
from .experiment import Experiment


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    formula_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("formulas.id", ondelete="CASCADE"))
    experiment_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("experiments.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("comments.id", ondelete="CASCADE"))
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class CommentLike(Base):
    __tablename__ = "comment_likes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    comment_id: Mapped[int] = mapped_column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
