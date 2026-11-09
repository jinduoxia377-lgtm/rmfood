"""add evidence_note to bioactive_peptides (诚实溯源：无 DOI 的老文献用 evidence_note 存 PMID)

Revision ID: 20261109_000003
Revises: 20261109_000002
Create Date: 2026-11-09

背景（引用纠错）:
    批次1 入库时部分序列肽误填了错误的 literature_doi（如 β-lactorphin 误用了
    id7966 的 10.1016/j.jff.2019.103456——实际解析到 Rosa Roxburghii 综述；胶原肽
    Gly-Pro-Hyp/Hyp-Gly 误用 10.3390/ijms21093115——实际解析到 cancer microbiome 论文）。
    诚实原则=引用也不能错：**宁缺 DOI 用 PMID，绝不留错 DOI 冒充溯源**。

    老文献（如 lactokinins 综述 PMID 10399349, Fitzgerald & Meisel 2003）无现代 DOI，
    其权威溯源是 PMID。为把 PMID 存进库（当前 bioactive_peptides 无 evidence_note 列），
    本迁移新增 evidence_note TEXT 列，用于存「来源 PMID / 原文出处 / 序列 accession」等
    溯源说明。修正时：错 DOI 置 NULL，PMID 存 evidence_note。

幂等性（ADR-007）:
    - 列：information_schema.columns 判定，已存在则跳过 ADD COLUMN。

可回滚:
    downgrade DROP COLUMN evidence_note（新增列，删除不损原数据）。

锁表风险:
    ADD COLUMN 为事务性 DDL，只加列不改既有列，不影响运行中后端（PID 4328）现有查询。
"""
import sqlalchemy as sa

from alembic import op

revision = "20261109_000003"
down_revision = "20261109_000002"
branch_labels = None
depends_on = None


def _has_column(bind, table, column) -> bool:
    insp = sa.inspect(bind)
    return column in [c["name"] for c in insp.get_columns(table)]


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_column(bind, "bioactive_peptides", "evidence_note"):
        op.add_column(
            "bioactive_peptides",
            sa.Column(
                "evidence_note",
                sa.Text(),
                nullable=True,
                comment="溯源说明：来源 PMID / 原文出处 / 序列 accession（无 DOI 的老文献用此存 PMID）",
            ),
        )


def downgrade() -> None:
    op.drop_column("bioactive_peptides", "evidence_note")
