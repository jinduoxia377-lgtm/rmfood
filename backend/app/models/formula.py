"""RMFOOD 配方模型"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, JSON, Enum, ForeignKey, Table, Column, Float, Boolean, BigInteger, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from .base import ClassifiedMixin
from .enums import FormulaStatus
from .peptide_analysis import PeptideAnalysis
from .peptide_design import PeptideDesign
from .peptide_batch_coa import PeptideBatchCOA
from .formula_case import FormulaCase
from app.models.utils import now_utc_mapped


formula_ingredients = Table(
    "formula_ingredients",
    Base.metadata,
    Column("formula_id", BigInteger, ForeignKey("formulas.id", ondelete="CASCADE"), primary_key=True),
    Column("ingredient_id", BigInteger, ForeignKey("ingredients.id", ondelete="CASCADE"), primary_key=True),
)

formula_peptides = Table(
    "formula_peptides",
    Base.metadata,
    Column("formula_id", BigInteger, ForeignKey("formulas.id", ondelete="CASCADE"), primary_key=True),
    Column("peptide_id", BigInteger, ForeignKey("peptides.id", ondelete="CASCADE"), primary_key=True),
)


formula_categories = Table(
    "formula_categories",
    Base.metadata,
    Column("formula_id", BigInteger, ForeignKey("formulas.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", BigInteger, ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
)

formula_tags = Table(
    "formula_tags",
    Base.metadata,
    Column("formula_id", BigInteger, ForeignKey("formulas.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", BigInteger, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("categories.id", ondelete="SET NULL"), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)

    parent: Mapped["Category | None"] = relationship("Category", remote_side="Category.id", back_populates="children")
    children: Mapped[list["Category"]] = relationship("Category", back_populates="parent", cascade="all, delete-orphan")
    formulas: Mapped[list["Formula"]] = relationship("Formula", secondary=formula_categories, back_populates="categories")


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    color: Mapped[str | None] = mapped_column(String(20), default="#6366f1")
    icon: Mapped[str | None] = mapped_column(String(50))
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)

    formulas: Mapped[list["Formula"]] = relationship("Formula", secondary=formula_tags, back_populates="tags")


class Formula(ClassifiedMixin, Base):
    __tablename__ = "formulas"

    # ── 多租户隔离 ──────────────────────────────────────
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True, comment="所属组织 ID，None 表示全局共享"
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
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

    # ── 分享功能 ──────────────────────────────────────────────
    share_code: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    share_password_hash: Mapped[str | None] = mapped_column(String(256))
    view_count: Mapped[int] = mapped_column(Integer, default=0, index=True)

    creator_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), index=True)
    reviewer_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"), index=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)

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
    cases: Mapped[list["FormulaCase"]] = relationship("FormulaCase", back_populates="formula", lazy="selectin")

    __table_args__ = (
        CheckConstraint("shelf_life > 0", name="ck_formula_shelf_life_positive"),
        CheckConstraint("version >= 1", name="ck_formula_version_min_one"),
    )


class FormulaVersion(Base):
    __tablename__ = "formula_versions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    formula_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("formulas.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column("version_number", Integer, nullable=False)
    snapshot: Mapped[dict] = mapped_column("snapshot_data", JSON, nullable=False)
    change_summary: Mapped[str | None] = mapped_column("changes_description", Text)
    created_by: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)

    formula: Mapped["Formula"] = relationship("Formula", back_populates="version_history")


class Ingredient(Base):
    __tablename__ = "ingredients"

    # ── 多租户隔离 ──────────────────────────────────────
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True, comment="所属组织 ID，None 表示全局共享"
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_cn: Mapped[str | None] = mapped_column(String(200))
    category: Mapped[str | None] = mapped_column(String(100))
    source: Mapped[str | None] = mapped_column(String(200))
    properties: Mapped[dict | None] = mapped_column(JSON, default=dict)
    is_food_homology: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)

    formulas: Mapped[list["Formula"]] = relationship(
        "Formula", secondary=formula_ingredients, back_populates="ingredients"
    )


class Peptide(Base):
    __tablename__ = "peptides"

    # ── 多租户隔离 ──────────────────────────────────────
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True, comment="所属组织 ID，None 表示全局共享"
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sequence: Mapped[str] = mapped_column(String(500), nullable=False)
    source_protein: Mapped[str | None] = mapped_column(String(200))
    source_organism: Mapped[str | None] = mapped_column(String(200))
    activity_type: Mapped[str | None] = mapped_column(String(100))
    activity_value: Mapped[float | None] = mapped_column(Float)
    activity_unit: Mapped[str | None] = mapped_column(String(50))
    molecular_weight: Mapped[float | None] = mapped_column(Float)
    dfbp_id: Mapped[str | None] = mapped_column(String(50))
    analysis_count: Mapped[int] = mapped_column(Integer, default=0, comment="关联分析次数")
    last_analysis_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, comment="最后分析时间")
    design_usage_count: Mapped[int] = mapped_column(Integer, default=0, comment="被设计使用的次数")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, comment="软删除时间戳")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)

    formulas: Mapped[list["Formula"]] = relationship(
        "Formula", secondary=formula_peptides, back_populates="peptides"
    )
    analyses = relationship("PeptideAnalysis", back_populates="peptide", foreign_keys="PeptideAnalysis.peptide_id")
    batch_coas = relationship("PeptideBatchCOA", back_populates="peptide", lazy="selectin")


from .user_model import User
from .experiment import Experiment


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    formula_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("formulas.id", ondelete="CASCADE"), index=True)
    experiment_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("experiments.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    parent_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("comments.id", ondelete="CASCADE"), index=True)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)

    __table_args__ = (
        CheckConstraint("LENGTH(content) > 0", name="ck_comment_content_not_empty"),
    )


class CommentLike(Base):
    __tablename__ = "comment_likes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    comment_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)

    __table_args__ = (
        UniqueConstraint("comment_id", "user_id", name="uq_comment_like"),
    )
