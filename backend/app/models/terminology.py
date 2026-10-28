"""专业术语数据库模型"""
from typing import List, Optional

from sqlalchemy import JSON, BigInteger, Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class TermCategory(BaseModel):
    """术语分类模型"""
    __tablename__ = "term_categories"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    name_en: Mapped[str] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    parent_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("term_categories.id"), index=True)
    level: Mapped[int] = mapped_column(Integer, default=1)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    children = relationship("TermCategory", back_populates="parent", remote_side="TermCategory.id")
    parent = relationship("TermCategory", back_populates="children")
    terms = relationship("Term", back_populates="category")

    def __repr__(self) -> str:
        return f"<TermCategory(id={self.id}, name={self.name})>"


class Term(BaseModel):
    """术语模型"""
    __tablename__ = "terms"

    term: Mapped[str] = mapped_column(String(200), nullable=False)
    term_en: Mapped[str] = mapped_column(String(200), nullable=True)
    pinyin: Mapped[str] = mapped_column(String(200), nullable=True)
    pinyin_abbr: Mapped[str] = mapped_column(String(100), nullable=True)
    abbreviation: Mapped[str] = mapped_column(String(50), nullable=True)
    definition: Mapped[str] = mapped_column(Text, nullable=False)
    definition_en: Mapped[str] = mapped_column(Text, nullable=True)
    category_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("term_categories.id"), index=True)
    subcategory: Mapped[str] = mapped_column(String(100), nullable=True)
    unit: Mapped[str] = mapped_column(String(50), nullable=True)
    examples: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    synonyms: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    related_terms: Mapped[Optional[List[int]]] = mapped_column(JSON, nullable=True)
    source: Mapped[str] = mapped_column(String(200), nullable=True)
    is_standard: Mapped[bool] = mapped_column(Boolean, default=True)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    frequency: Mapped[int] = mapped_column(Integer, default=0)

    category = relationship("TermCategory", back_populates="terms")

    def __repr__(self) -> str:
        return f"<Term(id={self.id}, term={self.term})>"


class TermVariant(BaseModel):
    """术语变体（用于纠错和同义词匹配）"""
    __tablename__ = "term_variants"

    variant: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    term_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("terms.id"), index=True)
    similarity: Mapped[float] = mapped_column(Float, default=0.8)
    variant_type: Mapped[str] = mapped_column(String(50), default="synonym")  # synonym, typo, abbreviation

    term = relationship("Term")

    def __repr__(self) -> str:
        return f"<TermVariant(variant={self.variant}, term_id={self.term_id})>"


class TermValidation(BaseModel):
    """术语验证记录"""
    __tablename__ = "term_validations"

    input_term: Mapped[str] = mapped_column(String(200), nullable=False)
    matched_term_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("terms.id"), index=True)
    is_valid: Mapped[bool] = mapped_column(Boolean, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=True)
    suggested_term: Mapped[str] = mapped_column(String(200), nullable=True)
    correction_needed: Mapped[bool] = mapped_column(Boolean, default=False)
    validation_type: Mapped[str] = mapped_column(String(50), default="auto")  # auto, manual, batch

    term = relationship("Term")

    def __repr__(self) -> str:
        return f"<TermValidation(input={self.input_term}, valid={self.is_valid})>"


class TermNormalizationRule(BaseModel):
    """术语标准化规则"""
    __tablename__ = "term_normalization_rules"

    pattern: Mapped[str] = mapped_column(String(500), nullable=False)
    replacement: Mapped[str] = mapped_column(String(500), nullable=False)
    rule_type: Mapped[str] = mapped_column(String(50), default="regex")  # regex, exact, fuzzy
    priority: Mapped[int] = mapped_column(Integer, default=100)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    def __repr__(self) -> str:
        return f"<TermNormalizationRule(pattern={self.pattern})>"


class TermStatistics(BaseModel):
    """术语统计信息"""
    __tablename__ = "term_statistics"

    category_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("term_categories.id"), index=True)
    total_terms: Mapped[int] = mapped_column(Integer, default=0)
    validation_count: Mapped[int] = mapped_column(Integer, default=0)
    correction_count: Mapped[int] = mapped_column(Integer, default=0)
    accuracy_rate: Mapped[float] = mapped_column(Float, default=1.0)

    category = relationship("TermCategory")

    def __repr__(self) -> str:
        return f"<TermStatistics(category_id={self.category_id}, total={self.total_terms})>"
