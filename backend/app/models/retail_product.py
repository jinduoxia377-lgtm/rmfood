"""
零售产品数据模型

用于 Potion AI VFT × RMFOOD 深度融合方案的零售产品搜索功能。
对标 Potion AI VFT 的 Products 数据模型，适配中国保健品/功能性食品场景。
"""
from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, BigInteger, JSON, ARRAY, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.utils import now_utc_mapped


class RetailProduct(Base):
    """
    零售产品数据库

    存储市场在售的保健品/功能性食品产品信息，用于竞品分析和市场洞察。
    """
    __tablename__ = "retail_products"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ── 身份标识 ──
    external_id: Mapped[str | None] = mapped_column(String(100), unique=True, index=True, comment="外部来源ID")
    sku: Mapped[str | None] = mapped_column(String(100), comment="SKU/条形码")
    brand: Mapped[str] = mapped_column(String(200), nullable=False, index=True, comment="品牌")
    product_name: Mapped[str] = mapped_column(String(500), nullable=False, comment="产品名称")
    product_line: Mapped[str | None] = mapped_column(String(200), comment="产品系列")

    # ── 分类 ──
    category: Mapped[str | None] = mapped_column(String(100), index=True, comment="品类: 保健食品/功能性食品/普通食品/药品")
    sub_category: Mapped[str | None] = mapped_column(String(100), comment="子品类")
    formulation_type: Mapped[str | None] = mapped_column(String(50), comment="剂型: 片剂/胶囊/口服液/粉剂/软糖/饮料")

    # ── 功效 ──
    effects: Mapped[list | None] = mapped_column(ARRAY(Text), default=list, comment="功效标签")
    target_population: Mapped[list | None] = mapped_column(ARRAY(Text), default=list, comment="目标人群")

    # ── 成分信息 ──
    full_ingredients: Mapped[str | None] = mapped_column(Text, comment="完整成分表原文")
    key_ingredients: Mapped[dict | None] = mapped_column(JSON, default=dict, comment="关键成分列表")
    material_refs: Mapped[list | None] = mapped_column(ARRAY(BigInteger), default=list, comment="关联 food_materials.id")
    peptide_refs: Mapped[list | None] = mapped_column(ARRAY(BigInteger), default=list, comment="关联 bioactive_peptides.id")
    compound_refs: Mapped[list | None] = mapped_column(ARRAY(BigInteger), default=list, comment="关联 tcm_compounds.id")

    # ── 市场信息 ──
    price: Mapped[float | None] = mapped_column(Float, comment="价格 (CNY)")
    currency: Mapped[str] = mapped_column(String(3), default="CNY", comment="货币")
    package_size: Mapped[str | None] = mapped_column(String(50), comment="规格")
    volume_ml: Mapped[float | None] = mapped_column(Float, comment="容量 (ml)")
    weight_g: Mapped[float | None] = mapped_column(Float, comment="净重 (g)")

    # ── 销售信息 ──
    sales_channels: Mapped[list | None] = mapped_column(ARRAY(String), default=list, comment="销售渠道")
    avg_rating: Mapped[float | None] = mapped_column(Float, comment="平均评分 1-5")
    review_count: Mapped[int | None] = mapped_column(BigInteger, comment="评价数")
    monthly_sales: Mapped[int | None] = mapped_column(BigInteger, comment="月销量")

    # ── 图片 ──
    image_urls: Mapped[list | None] = mapped_column(ARRAY(Text), default=list, comment="产品图片")

    # ── 法规 ──
    reg_number: Mapped[str | None] = mapped_column(String(100), comment="注册/备案号")
    reg_type: Mapped[str | None] = mapped_column(String(20), comment="注册类型: 国产/进口")
    approved_region: Mapped[str | None] = mapped_column(String(50), comment="批准地区")

    # ── 食品安全 ──
    allergens_tags: Mapped[list | None] = mapped_column(ARRAY(Text), default=list, comment="过敏原标签")
    additives_tags: Mapped[list | None] = mapped_column(ARRAY(Text), default=list, comment="添加剂标签")
    ecoscore_grade: Mapped[str | None] = mapped_column(String(20), comment="生态评分等级")
    traces_tags: Mapped[list | None] = mapped_column(ARRAY(Text), default=list, comment="潜在交叉污染物质")
    contaminants: Mapped[list | None] = mapped_column(ARRAY(Text), default=list, comment="污染物标签")

    # ── 相似度 (用于推荐) ──
    # 注: 无 pgvector 时存储为 JSON 数组; 有 pgvector 时可用 VECTOR(768) 类型
    embedding: Mapped[list | None] = mapped_column(JSON, comment="产品嵌入向量 (JSON 数组)")

    # ── 元数据 ──
    source: Mapped[str] = mapped_column(String(50), default="crawl", index=True, comment="数据来源")
    crawl_timestamp: Mapped[datetime | None] = mapped_column(nullable=True, comment="爬取时间")
    data_quality: Mapped[float] = mapped_column(Float, default=1.0, comment="数据质量评分")

    # ── 审计字段 ──
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)
    created_by: Mapped[int | None] = mapped_column(BigInteger, comment="创建人ID")

    def to_dict(self) -> dict:
        """转换为字典格式（用于 API 响应）"""
        return {
            "id": self.id,
            "external_id": self.external_id,
            "sku": self.sku,
            "brand": self.brand,
            "product_name": self.product_name,
            "product_line": self.product_line,
            "category": self.category,
            "sub_category": self.sub_category,
            "formulation_type": self.formulation_type,
            "effects": self.effects or [],
            "target_population": self.target_population or [],
            "full_ingredients": self.full_ingredients,
            "key_ingredients": self.key_ingredients or {},
            "material_refs": self.material_refs or [],
            "peptide_refs": self.peptide_refs or [],
            "price": self.price,
            "currency": self.currency,
            "package_size": self.package_size,
            "volume_ml": self.volume_ml,
            "weight_g": self.weight_g,
            "sales_channels": self.sales_channels or [],
            "avg_rating": self.avg_rating,
            "review_count": self.review_count,
            "monthly_sales": self.monthly_sales,
            "image_urls": self.image_urls or [],
            "reg_number": self.reg_number,
            "reg_type": self.reg_type,
            "approved_region": self.approved_region,
            "allergens_tags": self.allergens_tags or [],
            "additives_tags": self.additives_tags or [],
            "ecoscore_grade": self.ecoscore_grade,
            "traces_tags": self.traces_tags or [],
            "contaminants": self.contaminants or [],
            "source": self.source,
            "data_quality": self.data_quality,
            "crawl_timestamp": self.crawl_timestamp.isoformat() if self.crawl_timestamp else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
