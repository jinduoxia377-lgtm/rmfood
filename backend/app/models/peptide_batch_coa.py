"""
食源性多肽批次COA（Certificate of Analysis）数据模型

管理每个生产批次的出厂检验报告，包含检验单项明细。
对标鱼胶原蛋白肽出厂报告模板(GB31645—2018)结构。
"""
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    String, Text, Float, BigInteger, JSON, DateTime,
    Boolean, ForeignKey, Integer, CheckConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.utils import now_utc_mapped

if TYPE_CHECKING:
    from app.models.formula import Peptide


class COATestItem(Base):
    """COA检验单项记录表"""
    __tablename__ = "coa_test_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    coa_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("peptide_batch_coas.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(50), nullable=False, comment="检测类别: sensory/chemical/microbial/packaging")
    item_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="检测项目名(中文)")
    item_name_en: Mapped[str | None] = mapped_column(String(100), comment="检测项目名(英文)")
    standard: Mapped[str] = mapped_column(String(500), nullable=False, comment="标准/限值")
    result: Mapped[str | None] = mapped_column(String(500), comment="检测结果")
    unit: Mapped[str | None] = mapped_column(String(20), comment="单位")
    judgment: Mapped[str | None] = mapped_column(String(20), comment="判定: 符合/不符合")
    remark: Mapped[str | None] = mapped_column(Text, comment="备注")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, comment="排序")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)

    coa: Mapped["PeptideBatchCOA"] = relationship("PeptideBatchCOA", back_populates="test_items")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "category": self.category,
            "item_name": self.item_name,
            "item_name_en": self.item_name_en,
            "standard": self.standard,
            "result": self.result,
            "unit": self.unit,
            "judgment": self.judgment,
            "remark": self.remark,
            "sort_order": self.sort_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PeptideBatchCOA(Base):
    """
    食源性多肽批次COA（出厂检验报告）

    设计原则:
    - 一个产品标准 (peptide_id) 可对应多个批次COA
    - 每个COA包含多个检验单项 (test_items)
    - 支持PDF/Word附件存储
    - 软删除保护历史数据
    """
    __tablename__ = "peptide_batch_coas"

    __table_args__ = (
        CheckConstraint(
            "test_conclusion IN ('合格', '不合格', '待检')",
            name="ck_coa_conclusion_valid"
        ),
        CheckConstraint(
            "judgment IN ('符合', '不符合', '待判定')",
            name="ck_coa_judgment_valid"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ── 产品标识 ──
    peptide_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("peptides.id", ondelete="SET NULL"),
        nullable=True, index=True, comment="关联多肽主表ID"
    )
    product_name_cn: Mapped[str] = mapped_column(String(200), nullable=False, comment="产品名称(中文)")
    product_name_en: Mapped[str | None] = mapped_column(String(200), comment="产品名称(英文)")
    product_type: Mapped[str] = mapped_column(String(100), default="其他食品", comment="产品类型")
    product_code: Mapped[str | None] = mapped_column(String(50), comment="型号/编号")
    spec: Mapped[str | None] = mapped_column(String(100), comment="规格(如 20千克/袋)")

    # ── 批次信息 ──
    batch_no: Mapped[str] = mapped_column(String(50), nullable=False, index=True, comment="生产批号")
    mfg_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), comment="生产日期")
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), comment="有效期/保质期")
    production_line: Mapped[str | None] = mapped_column(String(100), comment="生产线")

    # ── 检验依据 ──
    gb_standard: Mapped[str | None] = mapped_column(String(100), comment="执行标准(如 GB31645—2018)")
    enterprise_standard: Mapped[str | None] = mapped_column(String(200), comment="企业标准")
    inspection_basis: Mapped[str | None] = mapped_column(Text, comment="检验判定依据说明")

    # ── 结论 ──
    test_conclusion: Mapped[str] = mapped_column(String(20), default="待检", comment="检验结论: 合格/不合格/待检")
    qualified: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否合格")

    # ── 文件附件 ──
    coa_pdf_url: Mapped[str | None] = mapped_column(String(500), comment="COA PDF文件URL")
    coa_word_url: Mapped[str | None] = mapped_column(String(500), comment="COA Word原文URL")
    test_report_image_url: Mapped[str | None] = mapped_column(String(500), comment="检测报告扫描件")

    # ── 人员 ──
    tested_by: Mapped[str | None] = mapped_column(String(50), comment="检测人")
    checked_by: Mapped[str | None] = mapped_column(String(50), comment="校对人")
    approved_by: Mapped[str | None] = mapped_column(String(50), comment="批准人")

    # ── 供应商 ──
    supplier_name: Mapped[str | None] = mapped_column(String(200), comment="供应商名称")
    supplier_batch_ref: Mapped[str | None] = mapped_column(String(100), comment="供应商批次编号")

    # ── 审计 ──
    created_by: Mapped[int | None] = mapped_column(BigInteger, comment="创建人ID")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, comment="软删除时间戳")

    # ── 关系 ──
    peptide: Mapped[Optional["Peptide"]] = relationship("Peptide", back_populates="batch_coas")
    test_items: Mapped[List["COATestItem"]] = relationship(
        "COATestItem",
        back_populates="coa",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    @property
    def latest_item_judgment(self) -> str:
        """获取最新检验单项的判定状态"""
        items = self.test_items or []
        if not items:
            return "待判定"
        # 如果有任何"不符合"项，整体判定为不合格
        if any(item.judgment == "不符合" for item in items):
            return "不符合"
        # 如果所有项都是"符合"，则为符合
        if all(item.judgment == "符合" for item in items):
            return "符合"
        return "待判定"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "peptide_id": self.peptide_id,
            "product_name_cn": self.product_name_cn,
            "product_name_en": self.product_name_en,
            "product_type": self.product_type,
            "product_code": self.product_code,
            "spec": self.spec,
            "batch_no": self.batch_no,
            "mfg_date": self.mfg_date.isoformat() if self.mfg_date else None,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "production_line": self.production_line,
            "gb_standard": self.gb_standard,
            "enterprise_standard": self.enterprise_standard,
            "inspection_basis": self.inspection_basis,
            "test_conclusion": self.test_conclusion,
            "qualified": self.qualified,
            "coa_pdf_url": self.coa_pdf_url,
            "coa_word_url": self.coa_word_url,
            "test_report_image_url": self.test_report_image_url,
            "tested_by": self.tested_by,
            "checked_by": self.checked_by,
            "approved_by": self.approved_by,
            "supplier_name": self.supplier_name,
            "supplier_batch_ref": self.supplier_batch_ref,
            "test_items": [item.to_dict() for item in (self.test_items or [])],
            "latest_item_judgment": self.latest_item_judgment,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def soft_delete(self) -> None:
        self.deleted_at = now_utc_mapped()

    def restore(self) -> None:
        self.deleted_at = None

    def __repr__(self) -> str:
        return f"<PeptideBatchCOA(id={self.id}, batch_no='{self.batch_no}', conclusion='{self.test_conclusion}')>"
