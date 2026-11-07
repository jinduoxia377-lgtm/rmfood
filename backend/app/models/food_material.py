"""
食品原料数据模型

用于 Potion AI VFT × RMFOOD 深度融合方案的食品原料搜索功能。
对标 Potion AI VFT 的 Raw Materials 数据模型，适配中国药食同源场景。
"""
from datetime import datetime

from sqlalchemy import ARRAY, JSON, BigInteger, Boolean, DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.utils import now_utc_mapped


class FoodMaterial(Base):
    """
    食品原料数据库

    存储食品/保健品原料信息，包括中药材、食品添加剂、普通食品成分等。
    支持混合搜索（BM25 + 向量语义）和合规检查。
    """
    __tablename__ = "food_materials"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ── 身份标识 ──
    external_id: Mapped[str | None] = mapped_column(String(100), unique=True, index=True, comment="外部来源ID (FoodDB/USDA/CosIng)")
    gb_code: Mapped[str | None] = mapped_column(String(50), comment="国标编号")
    name_cn: Mapped[str] = mapped_column(String(200), nullable=False, index=True, comment="中文名称")
    name_latin: Mapped[str | None] = mapped_column(String(200), comment="拉丁学名")
    name_en: Mapped[str | None] = mapped_column(String(200), comment="英文名称")
    aliases: Mapped[list | None] = mapped_column(ARRAY(Text), default=list, comment="别名")

    # ── 分类 ──
    category: Mapped[str | None] = mapped_column(String(100), index=True, comment="分类: 中药材/食品添加剂/普通食品/保健食品")
    sub_category: Mapped[str | None] = mapped_column(String(100), comment="子分类")
    food_homology: Mapped[bool] = mapped_column(Boolean, default=False, index=True, comment="是否药食同源")
    toxicity_class: Mapped[str | None] = mapped_column(String(20), comment="毒性等级: 无毒/小毒/有毒")

    # ── 活性成分 ──
    active_ingredients: Mapped[list | None] = mapped_column(ARRAY(Text), default=list, comment="主要活性成分")
    compound_refs: Mapped[list | None] = mapped_column(ARRAY(BigInteger), default=list, comment="关联 tcm_compounds.id")

    # ── 功效 ──
    effects: Mapped[list | None] = mapped_column(ARRAY(Text), default=list, comment="功效标签")
    indications: Mapped[str | None] = mapped_column(Text, comment="适应症描述")

    # ── 药代动力学 (来自 TCMSP) ──
    ob_percent: Mapped[float | None] = mapped_column(Float, comment="口服生物利用度")
    dl_value: Mapped[float | None] = mapped_column(Float, comment="类药性")
    bioavailability_score: Mapped[float | None] = mapped_column(Float, comment="生物利用度评分")

    # ── 安全参数 ──
    safe_dose_min: Mapped[float | None] = mapped_column(Float, comment="最小安全剂量 (g/天)")
    safe_dose_max: Mapped[float | None] = mapped_column(Float, comment="最大安全剂量 (g/天)")
    contraindications: Mapped[list | None] = mapped_column(ARRAY(Text), default=list, comment="禁忌")
    interactions: Mapped[list | None] = mapped_column(ARRAY(Text), default=list, comment="相互作用")

    # ── 法规状态 ──
    regulatory_status: Mapped[str | None] = mapped_column(String(50), comment="审批状态: 已批准/限制使用/禁用/待审")
    approved_regions: Mapped[list | None] = mapped_column(ARRAY(String), default=list, comment="批准地区")
    max_daily_intake: Mapped[str | None] = mapped_column(String(50), comment="每日最大摄入量")

    # ── 供应商信息 ──
    suppliers: Mapped[dict | None] = mapped_column(JSON, default=dict, comment="供应商信息")
    origin_countries: Mapped[list | None] = mapped_column(ARRAY(String), default=list, comment="原产国")

    # ── 多媒体 ──
    description: Mapped[str | None] = mapped_column(Text, comment="描述")
    image_url: Mapped[str | None] = mapped_column(String(500), comment="图片URL")
    msds_url: Mapped[str | None] = mapped_column(String(500), comment="MSDS链接")
    coa_url: Mapped[str | None] = mapped_column(String(500), comment="COA链接")

    # ── 向量嵌入 (用于语义搜索) ──
    # 注: 无 pgvector 时存储为 JSON 数组; 有 pgvector 时可用 VECTOR(768) 类型
    embedding: Mapped[list | None] = mapped_column(JSON, comment="向量嵌入 (JSON 数组)")

    # ── 全文检索 token（应用侧 jieba 预分词，迁移 022）──
    # search_vector 由 DB 触发器 fn_food_materials_search_vector 维护：
    # 这四列非空时按 to_tsvector('simple', tokens) 分词构建（真中文召回）；
    # 全空时触发器回退用原文按权重构建（迁移 020 旧行为，非破坏）。
    # 写入时由 chinese_nlp.build_food_search_tokens 生成（空格分隔 token 串）。
    search_tokens_a: Mapped[str | None] = mapped_column(Text, comment="jieba 分词 token 串 (权重A: name_cn)")
    search_tokens_b: Mapped[str | None] = mapped_column(Text, comment="jieba 分词 token 串 (权重B: aliases)")
    search_tokens_c: Mapped[str | None] = mapped_column(Text, comment="jieba 分词 token 串 (权重C: effects/indications)")
    search_tokens_d: Mapped[str | None] = mapped_column(Text, comment="jieba 分词 token 串 (权重D: category/sub_category/description)")

    # ── 元数据 ──
    source_db: Mapped[str] = mapped_column(String(50), default="manual", index=True, comment="数据来源")
    data_quality: Mapped[float] = mapped_column(Float, default=1.0, comment="数据质量评分 0-1")
    review_status: Mapped[str] = mapped_column(String(20), default="pending", index=True, comment="审核状态")
    reviewed_by: Mapped[int | None] = mapped_column(BigInteger, comment="审核人ID")
    reviewed_at: Mapped[datetime | None] = mapped_column("reviewed_at", nullable=True)

    # ── 审计字段 ──
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)
    created_by: Mapped[int | None] = mapped_column(BigInteger, comment="创建人ID")

    def to_dict(self) -> dict:
        """转换为字典格式（用于 API 响应）"""
        return {
            "id": self.id,
            "external_id": self.external_id,
            "gb_code": self.gb_code,
            "name_cn": self.name_cn,
            "name_latin": self.name_latin,
            "name_en": self.name_en,
            "aliases": self.aliases or [],
            "category": self.category,
            "sub_category": self.sub_category,
            "food_homology": self.food_homology,
            "toxicity_class": self.toxicity_class,
            "active_ingredients": self.active_ingredients or [],
            "effects": self.effects or [],
            "indications": self.indications,
            "ob_percent": self.ob_percent,
            "dl_value": self.dl_value,
            "bioavailability_score": self.bioavailability_score,
            "safety": {
                "safe_dose_min": self.safe_dose_min,
                "safe_dose_max": self.safe_dose_max,
                "contraindications": self.contraindications or [],
                "interactions": self.interactions or [],
            },
            "regulatory": {
                "status": self.regulatory_status,
                "approved_regions": self.approved_regions or [],
                "max_daily_intake": self.max_daily_intake,
            },
            "suppliers": self.suppliers or {},
            "origin_countries": self.origin_countries or [],
            "description": self.description,
            "image_url": self.image_url,
            "msds_url": self.msds_url,
            "coa_url": self.coa_url,
            "source_db": self.source_db,
            "data_quality": self.data_quality,
            "review_status": self.review_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
