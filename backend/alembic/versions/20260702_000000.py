"""拆分 tcm_herbs：移除 MMID 字段，新建 mmid_herbs 独立表

Revision ID: 018_split_tcm_herbs_mmid
Revises: 017_bigint_timezone_upgrade
Create Date: 2026-07-02

背景：
TCMSP 和 MMID 是两套完全不同的药材集合，名称匹配率几乎为零。
之前的合并尝试未能成功合并数据，导致 tcm_herbs 表中混杂了两套来源的数据。

解决方案：
- tcm_herbs 仅保留 TCMSP 药学数据（ob_percent, dl_value, compounds, targets 等）
- mmid_herbs 独立存储传统中药数据（四气、五味、归经、功效原文等）
- 通过 SQL 迁移将现有 pid IS NOT NULL 的记录迁移到 mmid_herbs
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260702_000000'
down_revision = "20260630_010000_add_rls_policies"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    1. 创建 mmid_herbs 表
    2. 将 tcm_herbs 中 pid IS NOT NULL 的记录迁移到 mmid_herbs
    3. 删除 tcm_herbs 中的 MMID 增强字段
    4. 清理 tcm_herbs 中残留的 pid IS NOT NULL 记录（应已迁移）
    """

    # ── 1. 创建 mmid_herbs 表 ──
    op.create_table(
        "mmid_herbs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("pid", sa.String(20), nullable=False, index=True,
                   comment="HKBU MMID药品编号"),
        sa.Column("name_cn", sa.String(100), nullable=False, index=True),
        sa.Column("name_latin", sa.String(200)),
        sa.Column("name_pinyin", sa.String(100)),
        sa.Column("name_eng", sa.String(300), comment="英文名称"),
        sa.Column("botanical_type", sa.String(50), comment="植物部位分类"),
        sa.Column("category", sa.String(100)),
        sa.Column("nature", sa.String(20), comment="四气: cold/warm/neutral/cool/hot"),
        sa.Column("flavor", postgresql.JSON, default=list, comment="五味列表"),
        sa.Column("toxicity", sa.String(20), comment="毒性: toxic/slightly_toxic/very_toxic"),
        sa.Column("efficacy_raw", sa.Text, comment="功效原文（繁体中文）"),
        sa.Column("origin", sa.Text, comment="产地信息"),
        sa.Column("processing", sa.Text, comment="炮制方法"),
        sa.Column("botanical_source", sa.Text, comment="植物来源（科属、学名）"),
        sa.Column("characteristics", sa.Text, comment="性状描述"),
        sa.Column("quality", sa.Text, comment="品质评价"),
        sa.Column("notes", sa.Text, comment="注解"),
        sa.Column("meridians", postgresql.JSON, default=list, comment="归经列表"),
        sa.Column("nature_flavor_raw", sa.String(200), comment="性味原文"),
        sa.Column("source_version", sa.String(50)),
        sa.Column("synced_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── 2. 迁移数据：将 pid IS NOT NULL 的记录复制到 mmid_herbs ──
    # 使用 INSERT ... SELECT 一次性迁移
    op.execute("""
        INSERT INTO mmid_herbs (
            id, pid, name_cn, name_latin, name_pinyin, name_eng,
            botanical_type, category, nature, flavor, toxicity,
            efficacy_raw, origin, processing, botanical_source,
            characteristics, quality, notes, meridians,
            nature_flavor_raw, source_version, synced_at, created_at
        )
        SELECT
            id, pid, name_cn, name_latin, name_pinyin, name_eng,
            botanical_type, category, nature, flavor, toxicity,
            efficacy_raw, origin, processing, botanical_source,
            characteristics, quality, notes, meridians,
            nature_flavor_raw, source_version, synced_at, created_at
        FROM tcm_herbs
        WHERE pid IS NOT NULL
    """)

    # ── 3. 删除 tcm_herbs 中的 MMID 增强列 ──
    op.drop_column("tcm_herbs", "pid")
    op.drop_column("tcm_herbs", "nature")
    op.drop_column("tcm_herbs", "flavor")
    op.drop_column("tcm_herbs", "toxicity")
    op.drop_column("tcm_herbs", "efficacy_raw")
    op.drop_column("tcm_herbs", "origin")
    op.drop_column("tcm_herbs", "processing")
    op.drop_column("tcm_herbs", "botanical_source")
    op.drop_column("tcm_herbs", "characteristics")
    op.drop_column("tcm_herbs", "quality")
    op.drop_column("tcm_herbs", "notes")
    op.drop_column("tcm_herbs", "meridians")
    op.drop_column("tcm_herbs", "name_eng")
    op.drop_column("tcm_herbs", "botanical_type")
    op.drop_column("tcm_herbs", "nature_flavor_raw")


def downgrade() -> None:
    """
    1. 将 mmid_herbs 的数据迁回 tcm_herbs
    2. 重建 MMID 增强列
    3. 删除 mmid_herbs 表
    """
    # ── 1. 重建 tcm_herbs 的 MMID 列 ──
    op.add_column("tcm_herbs", sa.Column("pid", sa.String(20), nullable=True,
                                          index=True, comment="HKBU MMID药品编号"))
    op.add_column("tcm_herbs", sa.Column("nature", sa.String(20), nullable=True,
                                          comment="四气: cold/warm/neutral/cool/hot"))
    op.add_column("tcm_herbs", sa.Column("flavor", postgresql.JSON, nullable=True,
                                          comment="五味列表"))
    op.add_column("tcm_herbs", sa.Column("toxicity", sa.String(20), nullable=True,
                                          comment="毒性: toxic/slightly_toxic/very_toxic"))
    op.add_column("tcm_herbs", sa.Column("efficacy_raw", sa.Text, nullable=True,
                                          comment="功效原文（繁体中文）"))
    op.add_column("tcm_herbs", sa.Column("origin", sa.Text, nullable=True,
                                          comment="产地信息"))
    op.add_column("tcm_herbs", sa.Column("processing", sa.Text, nullable=True,
                                          comment="炮制方法"))
    op.add_column("tcm_herbs", sa.Column("botanical_source", sa.Text, nullable=True,
                                          comment="植物来源（科属、学名）"))
    op.add_column("tcm_herbs", sa.Column("characteristics", sa.Text, nullable=True,
                                          comment="性状描述"))
    op.add_column("tcm_herbs", sa.Column("quality", sa.Text, nullable=True,
                                          comment="品质评价"))
    op.add_column("tcm_herbs", sa.Column("notes", sa.Text, nullable=True,
                                          comment="注解"))
    op.add_column("tcm_herbs", sa.Column("meridians", postgresql.JSON, nullable=True,
                                          comment="归经列表"))
    op.add_column("tcm_herbs", sa.Column("name_eng", sa.String(300), nullable=True,
                                          comment="英文名称"))
    op.add_column("tcm_herbs", sa.Column("botanical_type", sa.String(50), nullable=True,
                                          comment="植物部位分类"))
    op.add_column("tcm_herbs", sa.Column("nature_flavor_raw", sa.String(200), nullable=True,
                                          comment="性味原文"))

    # ── 2. 将 mmid_herbs 的数据迁回 tcm_herbs ──
    op.execute("""
        UPDATE tcm_herbs SET
            pid = m.pid,
            nature = m.nature,
            flavor = m.flavor,
            toxicity = m.toxicity,
            efficacy_raw = m.efficacy_raw,
            origin = m.origin,
            processing = m.processing,
            botanical_source = m.botanical_source,
            characteristics = m.characteristics,
            quality = m.quality,
            notes = m.notes,
            meridians = m.meridians,
            name_eng = m.name_eng,
            botanical_type = m.botanical_type,
            nature_flavor_raw = m.nature_flavor_raw,
            source_version = m.source_version,
            synced_at = m.synced_at,
            created_at = m.created_at
        FROM mmid_herbs m
        WHERE tcm_herbs.id = m.id
    """)

    # ── 3. 删除 mmid_herbs 表 ──
    op.drop_table("mmid_herbs")
