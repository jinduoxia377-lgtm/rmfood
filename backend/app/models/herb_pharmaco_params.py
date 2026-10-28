"""
药材 PK/PD 真实参数模型

对应 4 张新表：
- tcm_herbs_pk: 药代动力学参数（F/ka/Vd/CL/t_lag）
- tcm_herbs_pd: 药效动力学参数（E_max/EC50/Hill）
- stability_data: 稳定性参数（degradation_rate/shelf_life）
- synergy_interactions: 协同系数（已存在，此处补全字段）

数据来源（全部标注 source）：
- F（生物利用度）← tcm_herbs.ob_percent（TCMSP 实测真实值）
- ka/Vd/CL/t_lag ← tcm_compounds.logp/tpsa/hba/hbd 真实分子描述子 +
  经典 PK 估算公式（logP→Vd、TPSA→ka，标注 model_derived + 公式来源）
- E_max ← tcm_herbs.extra_knowledge.efficacy_scores（DB 真实药效评分）
- EC50 ← 主成分真实描述子 + 药理学惯例（ECC50≈Cmax×0.5，标注 model_derived）
- Hill ← 典型值 1.5（PD 模型默认，标注 model_default）
- degradation_rate ← tcm_compounds.logp + Arrhenius 加速稳定性模型（标注 model_derived）
- shelf_life ← 降解速率 + ICH Q1A 货架期惯例（标注 model_derived）
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON,
    BigInteger,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.utils import now_utc_mapped

from .base import Base


class TCMHerbPK(Base):
    """药材药代动力学参数表"""
    __tablename__ = "tcm_herbs_pk"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    herb_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tcm_herbs.id"), nullable=False, index=True
    )
    herb_name_cn: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # PK 一室模型参数（列名显式映射到数据库小写列，避免 PostgreSQL 大小写折叠问题）
    F: Mapped[Optional[float]] = mapped_column("f", Float)          # 生物利用度 [0,1]
    F_source: Mapped[str] = mapped_column("f_source", String(80), default="tcm_herbs.ob_percent")
    ka: Mapped[Optional[float]] = mapped_column("ka", Float)          # 吸收速率常数 (h⁻¹)
    Vd: Mapped[Optional[float]] = mapped_column("vd", Float)          # 分布容积 (L/kg)
    CL: Mapped[Optional[float]] = mapped_column("cl", Float)         # 清除率 (L/h/kg)
    t_lag: Mapped[Optional[float]] = mapped_column("t_lag", Float)       # 吸收滞后 (h)

    # 推导依据（追溯用）
    derived_from: Mapped[Optional[str]] = mapped_column(Text)
    # JSON: {logp, tpsa, hba, hbd, formula, reference}
    source: Mapped[str] = mapped_column(String(50), default="model_derived")
    confidence: Mapped[float] = mapped_column(Float, default=0.5)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False
    )

    __table_args__ = (
        CheckConstraint("F IS NULL OR (F >= 0 AND F <= 1)", name="ck_pk_f_range"),
        CheckConstraint("ka IS NULL OR ka > 0", name="ck_pk_ka_positive"),
        CheckConstraint("Vd IS NULL OR Vd > 0", name="ck_pk_vd_positive"),
        CheckConstraint("CL IS NULL OR CL > 0", name="ck_pk_cl_positive"),
        CheckConstraint("t_lag IS NULL OR t_lag >= 0", name="ck_pk_tlag_nonneg"),
    )


class TCMHerbPD(Base):
    """药材药效动力学参数表"""
    __tablename__ = "tcm_herbs_pd"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    herb_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tcm_herbs.id"), nullable=False, index=True
    )
    herb_name_cn: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # PD Sigmoid Emax 参数（列名显式映射小写，避免 PostgreSQL 大小写折叠与约束不匹配）
    E_max: Mapped[Optional[float]] = mapped_column("e_max", Float)        # 最大效应 [0,1]
    E_max_source: Mapped[str] = mapped_column(
        "e_max_source", String(80), default="tcm_herbs.extra_knowledge.efficacy_scores"
    )
    EC50: Mapped[Optional[float]] = mapped_column("ec50", Float)         # 半效浓度 (μg/mL)
    Hill: Mapped[Optional[float]] = mapped_column("hill", Float)         # 陡峭度

    # 药效评分（DB 原始 dict，追溯用）
    efficacy_scores: Mapped[Optional[dict]] = mapped_column(JSON)
    derived_from: Mapped[Optional[str]] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(50), default="model_derived")
    confidence: Mapped[float] = mapped_column(Float, default=0.5)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False
    )

    __table_args__ = (
        CheckConstraint("e_max IS NULL OR (e_max >= 0 AND e_max <= 1)", name="ck_pd_emax_range"),
        CheckConstraint("ec50 IS NULL OR ec50 > 0", name="ck_pd_ec50_positive"),
        CheckConstraint("hill IS NULL OR hill > 0", name="ck_pd_hill_positive"),
    )


class StabilityData(Base):
    """药材稳定性参数表"""
    __tablename__ = "stability_data"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    herb_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tcm_herbs.id"), nullable=False, index=True
    )
    herb_name_cn: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # 稳定性参数
    degradation_rate: Mapped[Optional[float]] = mapped_column(Float)  # 月降解速率
    shelf_life_months: Mapped[Optional[float]] = mapped_column(Float)  # 货架期（月）
    logp_max: Mapped[Optional[float]] = mapped_column(Float)
    logp_avg: Mapped[Optional[float]] = mapped_column(Float)
    tpsa_avg: Mapped[Optional[float]] = mapped_column(Float)
    compounds_analyzed: Mapped[int] = mapped_column(Integer, default=0)

    # 推导依据
    derived_from: Mapped[Optional[str]] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(50), default="model_derived")
    confidence: Mapped[float] = mapped_column(Float, default=0.5)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False
    )

    __table_args__ = (
        CheckConstraint("degradation_rate IS NULL OR degradation_rate >= 0", name="ck_stab_dr_nonneg"),
        CheckConstraint("shelf_life_months IS NULL OR shelf_life_months > 0", name="ck_stab_shelf_positive"),
    )
