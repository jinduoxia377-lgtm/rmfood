"""字段级审校审计模型（food_materials 专家审校工作流 provenance 溯源）。

背景:
    人工专家审校工作流中，安全关键字段（interactions / contraindications 等）
    的值仍存 food_materials 主表，但「这条值由哪位专家、何时、依据什么来源审校」
    无法从行级 review_status 得知。本表为每个 (原料, 字段) 维护一条审校 provenance
    记录，只追加审计信息，不改动主表结构与语义。

设计原则（ADR-004 DDD / 最小可行）:
    - 值真相在主表；本表 value 列只是「审校当时的值快照」，用于溯源与 diff。
    - UNIQUE(material_id, field_name)：一原料一字段一条最新审校记录（upsert 语义）。
    - reviewed_by 由服务端从 current_user 取，绝不接受客户端传入（防越权）。

架构说明:
    继承 BaseModel（复用 id / created_at / updated_at 与 to_dict），遵循 ADR-004
    「领域模型依赖持久化机制是有意为之」。表名显式声明为 material_field_review。
"""
from typing import Any, Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.utils import now_utc_mapped

from .base import BaseModel


class MaterialFieldReview(BaseModel):
    """字段级审校审计记录。

    一个 (material_id, field_name) 唯一；重复审校走 upsert 覆盖为最新 provenance。
    """

    __tablename__ = "material_field_review"
    __table_args__ = (
        UniqueConstraint(
            "material_id", "field_name", name="uq_material_field_review_material_field"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ── 被审校对象 ──
    material_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("food_materials.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="被审校的食品原料 ID",
    )
    field_name: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="被审校的字段名（白名单校验后写入）"
    )

    # ── 审校内容 ──
    value: Mapped[Optional[Any]] = mapped_column(
        JSONB, nullable=True, comment="审校当时的字段值快照 (JSON)"
    )
    source: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="依据来源：本草/药典/文献/专家经验等"
    )
    review_note: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="审校备注"
    )

    # ── 审校人 / 时间（服务端填充，防越权）──
    reviewed_by: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="审校人 ID（服务端从 current_user 取，不接受客户端传入）",
    )
    reviewed_at: Mapped[Any] = mapped_column(
        DateTime(timezone=True),
        default=now_utc_mapped,
        nullable=False,
        comment="审校时间",
    )

    def to_dict(self) -> dict:
        """转为 API 响应字典（覆盖 BaseModel.to_dict，控制字段与可读性）。"""
        return {
            "id": self.id,
            "material_id": self.material_id,
            "field_name": self.field_name,
            "value": self.value,
            "source": self.source,
            "review_note": self.review_note,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
        }
