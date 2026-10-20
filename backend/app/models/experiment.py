"""RMFOOD 实验模型"""
from datetime import datetime, timezone
from sqlalchemy import Float, Integer, String, Text, DateTime, JSON, Enum, ForeignKey, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from .enums import ExperimentStatus
from app.models.utils import now_utc_naive


class Experiment(Base):
    __tablename__ = "experiments"

    # ── 多租户隔离 ──────────────────────────────────────
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True, comment="所属组织 ID，None 表示全局共享"
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False, default="", server_default="", comment="实验名称（DB NOT NULL 约束；缺省空串）")
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ExperimentStatus] = mapped_column(
        Enum(ExperimentStatus), default=ExperimentStatus.PLANNED, nullable=False
    )
    formula_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("formulas.id", ondelete="CASCADE"), index=True)
    researcher_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), index=True)

    objectives: Mapped[list | None] = mapped_column(JSON, default=list)
    methodology: Mapped[str | None] = mapped_column(Text)
    parameters: Mapped[dict | None] = mapped_column(JSON, default=dict)
    materials: Mapped[list | None] = mapped_column(JSON, default=list)
    equipment: Mapped[list | None] = mapped_column(JSON, default=list)

    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    results: Mapped[dict | None] = mapped_column(JSON, default=dict)
    conclusions: Mapped[str | None] = mapped_column(Text)
    recommendations: Mapped[str | None] = mapped_column(Text)

    # ── 分享功能 ──────────────────────────────────────────────
    share_code: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    share_password_hash: Mapped[str | None] = mapped_column(String(256))
    view_count: Mapped[int] = mapped_column(Integer, default=0, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_naive)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_naive, onupdate=now_utc_naive)

    formula: Mapped["Formula | None"] = relationship("Formula", back_populates="experiments")
    researcher: Mapped["User"] = relationship("User", back_populates="experiments")
    data_points: Mapped[list["ExperimentData"]] = relationship(
        "ExperimentData", back_populates="experiment", order_by="ExperimentData.created_at"
    )

    @property
    def formula_name(self) -> str | None:
        return self.formula.name if self.formula else None

    @property
    def researcher_name(self) -> str | None:
        return self.researcher.full_name or self.researcher.username if self.researcher else None


class ExperimentData(Base):
    """
    实验数据点

    ⚠️ 表列名与 DB 实际一致（已用 information_schema 校验）：
      data_type（参数名，NOT NULL）/ data_value（数值，可空）/ data_text（文本值，可空）
      / unit / measurement_time / notes / metadata_json / created_at
    模型属性名沿用参数语义命名，通过 column=... 映射到真实列。
    """
    __tablename__ = "experiment_data"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    experiment_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("experiments.id", ondelete="CASCADE"), index=True)
    # DB 列 data_type（NOT NULL）：参数/因子名称
    data_type: Mapped[str] = mapped_column(String(200), nullable=False)
    # DB 列 data_value（可空，double precision）：数值
    data_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    # DB 列 data_text（可空）：文本型值（OCR/描述等）
    data_text: Mapped[str | None] = mapped_column(Text)
    unit: Mapped[str | None] = mapped_column(String(50))
    # DB 列 measurement_time（可空）：测量时间（naive timestamp）
    measurement_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_naive)

    # 语义别名（供 ORM/代码使用，不映射独立列）
    @property
    def parameter(self) -> str:
        return self.data_type

    @property
    def value(self) -> float | None:
        return self.data_value

    experiment: Mapped["Experiment"] = relationship("Experiment", back_populates="data_points")


from .user_model import User
from .formula import Formula
