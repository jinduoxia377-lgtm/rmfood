"""RMCHM / CFAM 数据库检索模型（数据检索中心扩展）

- rmchm_herbs: RMCHM 中药材库（714 种，含化合物/靶点/疾病 JSONB 关联）
- cfam_herbs:   国家卫健委官方药食同源目录（106 种）
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.utils import now_utc_mapped


class RMCHMHerb(Base):
    """RMCHM 中药材库"""
    __tablename__ = "rmchm_herbs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    rmchm_id: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    rmchm_code: Mapped[Optional[str]] = mapped_column(String(100))
    name_cn: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name_pinyin: Mapped[Optional[str]] = mapped_column(String(100))
    name_latin: Mapped[Optional[str]] = mapped_column(String(300))
    name_eng: Mapped[Optional[str]] = mapped_column(String(300))
    nature_cn: Mapped[Optional[str]] = mapped_column(String(500))
    nature_eng: Mapped[Optional[str]] = mapped_column(String(500))
    meridians_cn: Mapped[Optional[str]] = mapped_column(String(500))
    meridians_eng: Mapped[Optional[str]] = mapped_column(String(500))
    category_cn: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    category_eng: Mapped[Optional[str]] = mapped_column(String(100))
    use_part: Mapped[Optional[str]] = mapped_column(String(100))
    alias: Mapped[Optional[str]] = mapped_column(String(500))
    function_cn: Mapped[Optional[str]] = mapped_column(Text)
    function_en: Mapped[Optional[str]] = mapped_column(Text)
    ob_percent: Mapped[Optional[float]] = mapped_column(Float)
    dl_value: Mapped[Optional[float]] = mapped_column(Float)
    is_food_homology: Mapped[bool] = mapped_column(Boolean, default=False)
    is_toxic: Mapped[bool] = mapped_column(Boolean, default=False)
    tcmsp_id: Mapped[Optional[int]] = mapped_column(Integer)
    symmap_id: Mapped[Optional[int]] = mapped_column(Integer)
    compounds_count: Mapped[int] = mapped_column(BigInteger, default=0)
    targets_count: Mapped[int] = mapped_column(BigInteger, default=0)
    diseases_count: Mapped[int] = mapped_column(BigInteger, default=0)
    image_path: Mapped[Optional[str]] = mapped_column(String(500))
    image_source: Mapped[Optional[str]] = mapped_column(String(50))
    data_quality_score: Mapped[Optional[float]] = mapped_column(Float)
    source_versions: Mapped[Optional[Any]] = mapped_column(JSON)
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False
    )

    __table_args__ = (
        Index("ix_rmchm_herbs_category", "category_cn"),
    )

    def to_dict(self, include_relations: bool = False) -> dict[str, Any]:
        d = {
            "id": self.id,
            "rmchm_id": self.rmchm_id,
            "rmchm_code": self.rmchm_code,
            "name_cn": self.name_cn,
            "name_pinyin": self.name_pinyin,
            "name_latin": self.name_latin,
            "name_eng": self.name_eng,
            "nature_cn": self.nature_cn,
            "nature_eng": self.nature_eng,
            "meridians_cn": self.meridians_cn,
            "meridians_eng": self.meridians_eng,
            "category_cn": self.category_cn,
            "category_eng": self.category_eng,
            "use_part": self.use_part,
            "alias": self.alias,
            "function_cn": self.function_cn,
            "ob_percent": self.ob_percent,
            "dl_value": self.dl_value,
            "is_food_homology": self.is_food_homology,
            "is_toxic": self.is_toxic,
            "tcmsp_id": self.tcmsp_id,
            "symmap_id": self.symmap_id,
            "compounds_count": self.compounds_count,
            "targets_count": self.targets_count,
            "diseases_count": self.diseases_count,
            "image_path": self.image_path,
            "image_source": self.image_source,
            "data_quality_score": self.data_quality_score,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_relations:
            # rmchm_herbs 表不包含 compounds/targets/diseases JSON 列，
            # 关联数据（如有）存放在 source_versions JSON 中，这里返回空列表保持接口兼容。
            d["compounds"] = []
            d["targets"] = []
            d["diseases"] = []
        return d


class CFAMHerb(Base):
    """国家卫健委官方药食同源目录"""
    __tablename__ = "cfam_herbs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name_cn: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    name_latin: Mapped[Optional[str]] = mapped_column(String(200))
    name_en: Mapped[Optional[str]] = mapped_column(String(200))
    nature: Mapped[Optional[str]] = mapped_column(String(50))
    flavor: Mapped[Optional[str]] = mapped_column(String(100))
    category: Mapped[Optional[str]] = mapped_column(String(100))
    announcement_id: Mapped[Optional[str]] = mapped_column(String(20), index=True)
    announcement_source: Mapped[Optional[str]] = mapped_column(String(200))
    usage_restriction: Mapped[Optional[str]] = mapped_column(Text)
    special_notice: Mapped[Optional[str]] = mapped_column(Text)
    image_path: Mapped[Optional[str]] = mapped_column(String(500))
    is_food_homology: Mapped[bool] = mapped_column(Boolean, default=True)
    pdf_page: Mapped[int] = mapped_column(BigInteger, default=8)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False
    )

    __table_args__ = (
        Index("ix_cfam_homology", "is_food_homology"),
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name_cn": self.name_cn,
            "name_latin": self.name_latin,
            "name_en": self.name_en,
            "nature": self.nature,
            "flavor": self.flavor,
            "category": self.category,
            "announcement_id": self.announcement_id,
            "announcement_source": self.announcement_source,
            "usage_restriction": self.usage_restriction,
            "special_notice": self.special_notice,
            "image_path": self.image_path,
            "is_food_homology": self.is_food_homology,
            "pdf_page": self.pdf_page,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
