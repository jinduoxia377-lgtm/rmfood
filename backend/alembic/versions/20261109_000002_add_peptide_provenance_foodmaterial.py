"""add provenance + food_material_id to bioactive_peptides (路径1 数据分层/接入食材)

Revision ID: 20261109_000002
Revises: 20261108_000001
Create Date: 2026-11-09

背景:
    bioactive_peptides 已存在(7660 行)，但审计发现仅 5 条有真实 literature_doi
    (IPP/VPP/Trp-Tyr-Ser-Leu/Phe-Arg-Ile-Lys/Ile-Pro-Ile，DOI 已核真实)，其余 7655 条
    无 DOI/references/quality_score——绝大多数为程序合成、不可溯源。用户在食材页看不到肽，
    因为 bioactive_peptides 无 food_material_id 关联、且合成肽不宜直接暴露。

    本迁移给**既有表**加 2 列做「暴露+质量分层」，**不建新表、不改任何肽的序列/活性数据**：
    - provenance VARCHAR：标数据来源。5 条真 DOI 肽='literature_confirmed'，其余='synthetic_unverified'
      （synthetic_unverified 默认隐藏，仅标记降权，不删除）。
    - food_material_id INTEGER 可空 FK→food_materials(id) ON DELETE SET NULL：关联食材载体行
      （4 条 Bos taurus 乳源肽→牛乳行；1 条 Zein 玉米肽→玉米行）。

    实际的 provenance 回填 / 载体行创建 / 关联由 Batch 脚本
    backend/scripts/bioactive_peptide_path1_backfill.py（dry-run 默认 + --apply 守卫）执行，
    本迁移只负责加列（结构变更）。

幂等性（ADR-007）:
    - 列：information_schema.columns 判定，已存在则跳过 ADD COLUMN。
    - 索引：CREATE INDEX IF NOT EXISTS。

可回滚:
    downgrade DROP COLUMN（provenance/food_material_id 都是新列，删除不损原数据）。

锁表风险:
    ADD COLUMN 为事务性 DDL（PG 新版本非锁定元数据操作），只加列不改既有列，
    不影响正在运行的后端（PID 4328）的现有查询。
"""
import sqlalchemy as sa

from alembic import op

revision = "20261109_000002"
down_revision = "20261108_000001"
branch_labels = None
depends_on = None


def _has_column(bind, table, column) -> bool:
    insp = sa.inspect(bind)
    return column in [c["name"] for c in insp.get_columns(table)]


def upgrade() -> None:
    bind = op.get_bind()

    if not _has_column(bind, "bioactive_peptides", "provenance"):
        op.add_column(
            "bioactive_peptides",
            sa.Column(
                "provenance",
                sa.String(40),
                nullable=True,
                comment="数据来源：literature_confirmed(文献确证,5条)/synthetic_unverified(合成未确证,默认隐藏)",
            ),
        )

    if not _has_column(bind, "bioactive_peptides", "food_material_id"):
        op.add_column(
            "bioactive_peptides",
            sa.Column(
                "food_material_id",
                sa.BigInteger(),
                nullable=True,
                comment="关联食材载体行(可空)；ON DELETE SET NULL",
            ),
        )
        op.create_foreign_key(
            "fk_bioactive_peptides_food_material",
            "bioactive_peptides",
            "food_materials",
            ["food_material_id"],
            ["id"],
            ondelete="SET NULL",
        )

    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_bioactive_peptides_provenance "
        "ON bioactive_peptides (provenance)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_bioactive_peptides_food_material_id "
        "ON bioactive_peptides (food_material_id)"
    )


def downgrade() -> None:
    # 先删 FK 再删列（新列，删除不损原肽数据）
    op.drop_constraint(
        "fk_bioactive_peptides_food_material", "bioactive_peptides", type_="foreignkey"
    )
    op.drop_column("bioactive_peptides", "food_material_id")
    op.drop_column("bioactive_peptides", "provenance")
