"""配方案例数据模型

用于展示成功配方设计，供其他用户参考学习。
"""
from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .utils import now_utc_mapped


class FormulaCase(Base):
    """配方案例"""
    __tablename__ = "formula_cases"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ── 关联 ─────────────────────────────────────────────
    formula_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("formulas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True, comment="所属组织，None 表示全局公开"
    )
    created_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False, index=True
    )

    # ── 基础信息 ─────────────────────────────────────────
    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    category: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True, comment="案例分类：补气养血/滋阴润燥/免疫调节等"
    )
    tags: Mapped[list | None] = mapped_column(JSON, default=list, comment="标签列表")
    cover_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False, comment="案例简介（100字内）")
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="案例详细内容（Markdown）")

    # ── 统计 ─────────────────────────────────────────────
    views: Mapped[int] = mapped_column(Integer, default=0, index=True)
    likes: Mapped[int] = mapped_column(Integer, default=0, index=True)
    bookmarks: Mapped[int] = mapped_column(Integer, default=0, index=True, comment="收藏数")
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, index=True, comment="是否推荐")

    # ── AI 生成标记 ─────────────────────────────────────
    generated_by_ai: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否由 AI 自动生成")
    ai_prompt: Mapped[str | None] = mapped_column(Text, nullable=True, comment="生成时使用的 prompt")

    # ── 时间戳 ───────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped
    )

    # ── 关系 ─────────────────────────────────────────────
    formula = relationship("Formula", back_populates="cases")
    creator = relationship("User", back_populates="created_cases", foreign_keys=[created_by])
    likes_list = relationship("CaseLike", back_populates="case", cascade="all, delete-orphan")
    comments = relationship("CaseComment", back_populates="case", cascade="all, delete-orphan")

    __table_args__ = (
        # 同一配方只能有一个案例
        # (UniqueConstraint("formula_id", name="uq_case_formula_id"),),
    )

    def __repr__(self) -> str:
        return f"<FormulaCase(id={self.id}, title={self.title!r})>"


class CaseLike(Base):
    """案例点赞"""
    __tablename__ = "case_likes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("formula_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)

    case = relationship("FormulaCase", back_populates="likes_list")
    user = relationship("User", back_populates="liked_cases")

    __table_args__ = (
        # 每个用户只能点赞一次
        # (UniqueConstraint("case_id", "user_id", name="uq_case_like"),),
    )


class CaseComment(Base):
    """案例评论"""
    __tablename__ = "case_comments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("formula_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("case_comments.id", ondelete="CASCADE"), nullable=True, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped
    )

    case = relationship("FormulaCase", back_populates="comments")
    user = relationship("User", back_populates="commented_cases")
