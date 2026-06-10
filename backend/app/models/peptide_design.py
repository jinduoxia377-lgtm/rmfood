"""RMFOOD 肽设计优化模型

多目标优化驱动的肽序列设计，支持Pareto前沿分析和版本控制。

状态流转逻辑:
  draft → in_progress → completed → archived
  ↓         ↑              ↑
  └─────────┘──────────────┘ (可从任意状态回退到draft)

版本控制机制:
  - 每次重大修改创建新版本，parent_version_id指向上一版本
  - version字段递增，支持完整的版本历史追溯
  - 归档时不删除数据，仅设置archived_at时间戳

数据完整性约束:
  - 删除设计时级联删除所有候选序列
  - 候选序列通过可选peptide_id关联到已知肽库
"""
from datetime import datetime, timezone
from typing import Optional
import enum

from sqlalchemy import Integer, String, DateTime, JSON, Enum, ForeignKey, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PeptideDesignStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class PeptideDesign(Base):
    __tablename__ = "peptide_designs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_name: Mapped[str] = mapped_column(String(200), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    target_effects: Mapped[list | None] = mapped_column(JSON, default=list)
    objective_weights: Mapped[dict | None] = mapped_column(JSON, default=dict)
    constraints: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    seed_sequence: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[PeptideDesignStatus] = mapped_column(
        Enum(PeptideDesignStatus),
        default=PeptideDesignStatus.DRAFT,
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    parent_version_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("peptide_designs.id"), nullable=True
    )
    total_candidates: Mapped[int] = mapped_column(Integer, default=0)
    pareto_size: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="peptide_designs")
    candidates: Mapped[list["PeptideDesignCandidate"]] = relationship(
        "PeptideDesignCandidate",
        back_populates="design",
        cascade="all, delete-orphan",
        order_by="PeptideDesignCandidate.rank.asc()",
    )
    parent: Mapped["PeptideDesign | None"] = relationship(
        "PeptideDesign",
        remote_side="PeptideDesign.id",
        back_populates="children",
    )
    children: Mapped[list["PeptideDesign"]] = relationship(
        "PeptideDesign", back_populates="parent"
    )


class PeptideDesignCandidate(Base):
    __tablename__ = "peptide_design_candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    design_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("peptide_designs.id", ondelete="CASCADE"), index=True
    )
    sequence: Mapped[str] = mapped_column(String(50), nullable=False)
    objectives_scores: Mapped[dict | None] = mapped_column(JSON, default=dict)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_pareto_frontier: Mapped[bool] = mapped_column(Boolean, default=False)
    dominated_by_count: Mapped[int] = mapped_column(Integer, default=0)
    peptide_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("peptides.id"), nullable=True
    )
    additional_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    design: Mapped["PeptideDesign"] = relationship(
        "PeptideDesign", back_populates="candidates"
    )
    peptide: Mapped["Peptide | None"] = relationship("Peptide")
