"""RMFOOD 种子数据模型

对应 seed_data.py 引用的表：
- synergy_interactions: 协同作用系数
- safety_thresholds: 安全阈值
- compatibility_rules: 兼容性规则
- ratio_optimization_history: 配方优化历史

这些表不通过 ORM 直接操作，而是由种子脚本通过原始 SQL 写入。
提供模型定义是为了让 Alembic 迁移能识别它们。
"""
from datetime import datetime, timezone
from sqlalchemy import BigInteger, Integer, String, Text, DateTime, JSON, Float, Boolean, CheckConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base
from app.models.utils import now_utc_mapped


class SynergyInteraction(Base):
    """协同作用系数表"""
    __tablename__ = "synergy_interactions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ingredient_a: Mapped[str] = mapped_column(String(200), nullable=False)
    ingredient_b: Mapped[str] = mapped_column(String(200), nullable=False)
    mechanism_type: Mapped[str] = mapped_column(String(100), nullable=False)
    synergy_coefficient: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.8)
    source_reference: Mapped[str | None] = mapped_column(Text)
    research_year: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)

    __table_args__ = (
        CheckConstraint("synergy_coefficient BETWEEN -1 AND 1", name="ck_synergy_coef_range"),
        CheckConstraint("confidence_score >= 0 AND confidence_score <= 1", name="ck_synergy_confidence_range"),
    )


class SafetyThreshold(Base):
    """安全阈值表"""
    __tablename__ = "safety_thresholds"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    threshold_name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    ingredient_name: Mapped[str] = mapped_column(String(200), nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    soft_limit: Mapped[float] = mapped_column(Float, nullable=False)
    hard_limit: Mapped[float] = mapped_column(Float, nullable=False)
    reference_source: Mapped[str | None] = mapped_column(Text)
    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)

    __table_args__ = (
        CheckConstraint("soft_limit <= hard_limit", name="ck_threshold_soft_le_hard"),
        CheckConstraint("version >= 1", name="ck_threshold_version_min_one"),
    )


class CompatibilityRule(Base):
    """兼容性规则表"""
    __tablename__ = "compatibility_rules"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    rule_name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    condition_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    recommendation: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)

    __table_args__ = (
        CheckConstraint("severity IN ('info', 'warning', 'critical')", name="ck_rule_severity_valid"),
    )


class RatioOptimizationHistory(Base):
    """配方比率优化历史表"""
    __tablename__ = "ratio_optimization_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    request_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    input_parameters: Mapped[str] = mapped_column(JSON, nullable=False)
    pareto_solutions: Mapped[str] = mapped_column(JSON, nullable=False)
    best_solution: Mapped[dict | None] = mapped_column(JSON)
    computation_time_ms: Mapped[float] = mapped_column(Float, nullable=False)
    algorithm_version: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
