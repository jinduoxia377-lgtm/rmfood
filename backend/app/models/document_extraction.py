"""
文档提取备案模型
保存 CoA/PDS/SDS 智能提取结果，实现数据备案、追溯与调用
"""
from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.utils import now_utc_mapped

from .base import Base


class DocumentExtraction(Base):
    __tablename__ = "document_extractions"

    organization_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True, comment="所属组织 ID；None 表示全局共享"
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    document_type: Mapped[str] = mapped_column(String(10), nullable=False, index=True, comment="文档类型 coa/pds/sd")
    ingredient_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("food_materials.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="关联原料 ID",
    )
    extracted_fields: Mapped[dict] = mapped_column(JSON, default=dict, comment="提取字段 {key: {value,label,confidence}}")
    confidence_scores: Mapped[dict] = mapped_column(JSON, default=dict, comment="字段置信度 {key: confidence}")
    inspection_items: Mapped[list] = mapped_column(JSON, default=list, comment="检验明细 [{item,standard,result,judgment}]")
    overall_confidence: Mapped[float] = mapped_column(Float, default=0.0, comment="整体置信度 0-1")
    requires_review: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否需人工复核")
    raw_text_preview: Mapped[str | None] = mapped_column(Text, nullable=True, comment="原始文本预览")
    source_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True, comment="来源文件名")
    source_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True, comment="原文哈希（用于去重）")
    created_by: Mapped[int | None] = mapped_column(BigInteger, nullable=True, comment="创建人 ID")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
