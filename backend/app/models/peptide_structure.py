"""
肽链结构分析历史模型
存储每次序列分析的结果，支持历史记录查询和批量分析
"""
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Integer, String, Text, DateTime, JSON, Float, Boolean, BigInteger, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from app.models.utils import now_utc_mapped


if TYPE_CHECKING:
    from .user_model import User


class PeptideStructureAnalysis(Base):
    """肽链结构分析历史记录表
    
    存储每次序列分析的结果，支持：
    - 历史查询和统计
    - 批量分析任务管理
    - 结果缓存复用
    """
    __tablename__ = "peptide_structure_analyses"
    
    # 创建索引以加速查询
    __table_args__ = (
        Index("ix_peptide_structure_seq", "sequence"),
        Index("ix_peptide_structure_user_time", "user_id", "created_at"),
        Index("ix_peptide_structure_score", "food_safety_score"),
    )
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    
    # 分析结果核心字段
    sequence: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # 结构转换结果
    smiles: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    selfies: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 理化性质
    molecular_weight: Mapped[float] = mapped_column(Float, default=0.0)
    isoelectric_point: Mapped[float] = mapped_column(Float, default=0.0)
    hydrophobicity: Mapped[float] = mapped_column(Float, default=0.0)
    
    # 活性预测
    ace_inhibition_score: Mapped[float] = mapped_column(Float, default=0.0)
    antioxidant_score: Mapped[float] = mapped_column(Float, default=0.0)
    antimicrobial_score: Mapped[float] = mapped_column(Float, default=0.0)
    
    # 安全性评估
    is_allergen: Mapped[bool] = mapped_column(Boolean, default=False)
    is_toxic: Mapped[bool] = mapped_column(Boolean, default=False)
    digestibility: Mapped[str] = mapped_column(String(20), default="unknown")
    
    # 风味预测
    bitterness_score: Mapped[float] = mapped_column(Float, default=0.0)
    umami_potential: Mapped[float] = mapped_column(Float, default=0.0)
    
    # 综合评分
    food_safety_score: Mapped[float] = mapped_column(Float, default=0.0)
    
    # 来源信息
    source_food: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    source_database: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    literature_refs: Mapped[list] = mapped_column(JSON, default=list)
    
    # 元数据
    n_terminal_mod: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    c_terminal_mod: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    unusual_aas: Mapped[list] = mapped_column(JSON, default=list)
    
    # 分析状态
    status: Mapped[str] = mapped_column(String(20), default="completed", comment="pending/completed/failed")
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # 关系（简化版，避免循环导入）
    user = relationship("User", foreign_keys=[user_id])
    
    def to_dict(self) -> dict:
        """转换为字典格式"""
        return {
            "id": self.id,
            "sequence": self.sequence,
            "smiles": self.smiles,
            "selfies": self.selfies,
            "molecular_weight": self.molecular_weight,
            "isoelectric_point": self.isoelectric_point,
            "hydrophobicity": self.hydrophobicity,
            "ace_inhibition": {
                "score": self.ace_inhibition_score,
                "level": self._get_level(self.ace_inhibition_score)
            },
            "antioxidant": {
                "score": self.antioxidant_score,
                "level": self._get_level(self.antioxidant_score)
            },
            "antimicrobial": {
                "score": self.antimicrobial_score,
                "level": self._get_level(self.antimicrobial_score)
            },
            "safety": {
                "food_score": self.food_safety_score,
                "is_allergen": self.is_allergen,
                "is_toxic": self.is_toxic,
                "digestibility": self.digestibility,
            },
            "taste": {
                "bitterness": self.bitterness_score,
                "umami": self.umami_potential,
            },
            "source": {
                "food": self.source_food,
                "database": self.source_database,
                "references": self.literature_refs,
            },
            "status": self.status,
            "n_terminal_mod": self.n_terminal_mod,
            "c_terminal_mod": self.c_terminal_mod,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
    
    @staticmethod
    def _get_level(score: float) -> str:
        """获取评分等级"""
        if score >= 0.8:
            return "high"
        elif score >= 0.5:
            return "medium"
        elif score > 0:
            return "low"
        return "none"
