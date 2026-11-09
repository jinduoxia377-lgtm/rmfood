"""RMFOOD Phase 2 外部数据模型"""
from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.utils import now_utc_mapped

from .base import Base


class TCMHerb(Base):
    """TCMSP 中药材数据库

    存储 TCMSP 药学数据：口服生物利用度、类药性、化合物、靶点、疾病关联等。
    与 MMID 传统中药数据源独立，不混用。
    """
    __tablename__ = "tcm_herbs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name_cn: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name_latin: Mapped[str | None] = mapped_column(String(200))
    name_pinyin: Mapped[str | None] = mapped_column(String(100))
    category: Mapped[str | None] = mapped_column(String(100))
    compounds: Mapped[list | None] = mapped_column(JSON, default=list)
    targets: Mapped[list | None] = mapped_column(JSON, default=list)
    diseases: Mapped[list | None] = mapped_column(JSON, default=list)
    ob_percent: Mapped[float | None] = mapped_column(Float)
    dl_value: Mapped[float | None] = mapped_column(Float)
    effects: Mapped[str | None] = mapped_column(Text)
    is_food_homology: Mapped[bool] = mapped_column(Boolean, default=False)
    tcmsp_id: Mapped[str | None] = mapped_column(String(50))
    source: Mapped[str | None] = mapped_column(String(50), default="tcsp")  # 数据来源: tcsp/mmid/seed
    source_version: Mapped[str | None] = mapped_column(String(50))
    extra_knowledge: Mapped[str | None] = mapped_column(Text)  # JSON: 扩展知识（dosage/pairing/meridian/contraindication）
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)


class MMIDHerb(Base):
    """MMID 中药材数据库（HKBU 药用植物图像数据库）

    独立于 TCMSP 的传统中药数据源，包含四气、五味、归经、功效原文等传统属性。
    """
    __tablename__ = "mmid_herbs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    pid: Mapped[str] = mapped_column(String(20), nullable=False, index=True, comment="HKBU MMID药品编号")
    name_cn: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name_latin: Mapped[str | None] = mapped_column(String(200))
    name_pinyin: Mapped[str | None] = mapped_column(String(100))
    name_eng: Mapped[str | None] = mapped_column(String(300), comment="英文名称")
    botanical_type: Mapped[str | None] = mapped_column(String(50), comment="植物部位分类")
    category: Mapped[str | None] = mapped_column(String(100))
    nature: Mapped[str | None] = mapped_column(String(20), comment="四气: cold/warm/neutral/cool/hot")
    flavor: Mapped[list | None] = mapped_column(JSON, default=list, comment="五味列表")
    toxicity: Mapped[str | None] = mapped_column(String(20), comment="毒性: toxic/slightly_toxic/very_toxic")
    efficacy_raw: Mapped[str | None] = mapped_column(Text, comment="功效原文（繁体中文）")
    origin: Mapped[str | None] = mapped_column(Text, comment="产地信息")
    processing: Mapped[str | None] = mapped_column(Text, comment="炮制方法")
    botanical_source: Mapped[str | None] = mapped_column(Text, comment="植物来源（科属、学名）")
    characteristics: Mapped[str | None] = mapped_column(Text, comment="性状描述")
    quality: Mapped[str | None] = mapped_column(Text, comment="品质评价")
    notes: Mapped[str | None] = mapped_column(Text, comment="注解")
    meridians: Mapped[list | None] = mapped_column(JSON, default=list, comment="归经列表")
    nature_flavor_raw: Mapped[str | None] = mapped_column(String(200), comment="性味原文")
    source_version: Mapped[str | None] = mapped_column(String(50))
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)


class SymMapHerb(Base):
    """SymMap 中药材知识图谱数据库

    北京中医药大学、中国科学院计算技术研究所、北京交通大学联合构建的
    中药-化合物-靶点-疾病对称图谱数据库。

    与 TCMSP/MMID 独立存储，通过 TCMSP_id 等字段建立交叉引用。
    """
    __tablename__ = "symmap_herbs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    symmap_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True, index=True, comment="SymMap 内部ID")
    name_cn: Mapped[str] = mapped_column(String(100), nullable=False, index=True, comment="中文名")
    name_pinyin: Mapped[str | None] = mapped_column(String(100), comment="拼音")
    name_latin: Mapped[str | None] = mapped_column(String(500), comment="拉丁名")
    name_eng: Mapped[str | None] = mapped_column(String(300), comment="英文名")
    nature_cn: Mapped[str | None] = mapped_column(String(500), comment="性味（中文）")
    nature_eng: Mapped[str | None] = mapped_column(String(500), comment="性味（英文）")
    meridians_cn: Mapped[str | None] = mapped_column(String(500), comment="归经（中文）")
    meridians_eng: Mapped[str | None] = mapped_column(String(500), comment="归经（英文）")
    category_cn: Mapped[str | None] = mapped_column(String(200), comment="分类（中文）")
    category_eng: Mapped[str | None] = mapped_column(String(200), comment="分类（英文）")
    use_part: Mapped[str | None] = mapped_column(String(200), comment="药用部位")

    # 交叉引用
    tcmsp_id: Mapped[int | None] = mapped_column(Integer, index=True, comment="TCMSP ID")
    tcmid_id: Mapped[int | None] = mapped_column(Integer, comment="TCMID ID")
    tcmid2_id: Mapped[int | None] = mapped_column(Integer, comment="TCM-ID ID")
    herbdb_id: Mapped[str | None] = mapped_column(String(100), comment="HERBDB ID")

    # 元数据
    alias: Mapped[str | None] = mapped_column(String(500), comment="别名")
    function_cn: Mapped[str | None] = mapped_column(String(1000), comment="功效（中文）")
    function_en: Mapped[str | None] = mapped_column(String(1000), comment="功效（英文）")
    source_version: Mapped[str | None] = mapped_column(String(50))
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)


class HFEHerb(Base):
    """国家卫健委官方药食同源目录（hf_enriched_herbs 增强表）

    对应迁移 20260910_000000_add_cfam_tables 中的 hf_enriched_herbs 表，
    保存 106 种（实际 111 行）官方药食同源目录及公告批次信息。
    """

    __tablename__ = "hf_enriched_herbs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source_id: Mapped[str | None] = mapped_column(String(50), unique=True, index=True)
    name_cn: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name_en: Mapped[str | None] = mapped_column(String(200))
    latin_name: Mapped[str | None] = mapped_column(String(200))
    nature_cn: Mapped[str | None] = mapped_column(String(200))
    flavor_cn: Mapped[str | None] = mapped_column(String(200))
    meridians_cn: Mapped[str | None] = mapped_column(String(500))
    category: Mapped[str | None] = mapped_column(String(100), index=True)
    ob_percent: Mapped[float | None] = mapped_column(Float)
    dl_value: Mapped[float | None] = mapped_column(Float)
    is_food_homology: Mapped[bool] = mapped_column(Boolean, server_default="true")
    is_toxic: Mapped[bool] = mapped_column(Boolean, server_default="false")
    compounds: Mapped[list | None] = mapped_column(JSON, server_default="[]")
    targets: Mapped[list | None] = mapped_column(JSON, server_default="[]")
    diseases: Mapped[list | None] = mapped_column(JSON, server_default="[]")
    compound_count: Mapped[int | None] = mapped_column(Integer, server_default="0")
    target_count: Mapped[int | None] = mapped_column(Integer, server_default="0")
    disease_count: Mapped[int | None] = mapped_column(Integer, server_default="0")
    approval_date: Mapped[datetime | None] = mapped_column(DateTime())
    status: Mapped[str | None] = mapped_column(String(100))
    max_dosage: Mapped[str | None] = mapped_column(String(100))
    restrictions: Mapped[list | None] = mapped_column(JSON, server_default="[]")
    usage_forms: Mapped[list | None] = mapped_column(JSON, server_default="[]")
    notes: Mapped[str | None] = mapped_column(Text)
    image_path: Mapped[str | None] = mapped_column(String(500))
    image_source: Mapped[str | None] = mapped_column(String(50))
    tcmsp_id: Mapped[str | None] = mapped_column(String(50), index=True)
    symmap_id: Mapped[int | None] = mapped_column(Integer, index=True)
    mmid_pid: Mapped[str | None] = mapped_column(String(20))
    data_quality_score: Mapped[float | None] = mapped_column(Float)
    source_version: Mapped[str | None] = mapped_column(String(50))
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)


class BioactivePeptide(Base):
    __tablename__ = "bioactive_peptides"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sequence: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    source_protein: Mapped[str | None] = mapped_column(String(200))
    source_organism: Mapped[str | None] = mapped_column(String(200))
    activity_type: Mapped[str | None] = mapped_column(String(100))
    activity_value: Mapped[str | None] = mapped_column(String(100))
    activity_unit: Mapped[str | None] = mapped_column(String(50))
    molecular_weight: Mapped[float | None] = mapped_column(Float)
    hydrolysis_enzyme: Mapped[str | None] = mapped_column(String(200))
    dfbp_id: Mapped[str | None] = mapped_column(String(50))
    dfbp_version: Mapped[str | None] = mapped_column(String(20))
    literature_doi: Mapped[str | None] = mapped_column(String(200))
    source_version: Mapped[str | None] = mapped_column(String(50))
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)

    # ── 暴露/质量分层 + 食材关联 + 诚实溯源（迁移 20261109_000002 / 000003）──
    # provenance: literature_confirmed(文献确证，逐条 PMID/DOI 溯源)
    #           / synthetic_unverified(合成未确证，默认降权)
    provenance: Mapped[str | None] = mapped_column(
        String(40), index=True,
        comment="数据来源：literature_confirmed/synthetic_unverified",
    )
    # food_material_id: 关联食材载体行（可空）；DB 侧 FK ON DELETE SET NULL
    food_material_id: Mapped[int | None] = mapped_column(
        BigInteger, index=True,
        comment="关联食材载体行(可空)；DB 侧 FK→food_materials.id ON DELETE SET NULL",
    )
    # evidence_note: 无 DOI 的老文献用此存 PMID / 原文出处 / 序列 accession
    evidence_note: Mapped[str | None] = mapped_column(
        Text, comment="溯源说明：来源 PMID / 原文出处 / 序列 accession",
    )


class KnowledgeGraphNode(Base):
    __tablename__ = "knowledge_graph_nodes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    node_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column("name", String(200), nullable=False, index=True)
    properties: Mapped[dict | None] = mapped_column(JSON, default=dict)
    source_database: Mapped[str | None] = mapped_column(String(50))
    source_id: Mapped[str | None] = mapped_column(String(50))
    confidence_score: Mapped[float | None] = mapped_column(Float)
    last_validated: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)
