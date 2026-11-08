"""add material_field_review (字段级审校审计表)

Revision ID: 20261108_000001
Revises: 20261105_000001
Create Date: 2026-11-08

背景:
    food_materials 专家审校工作流需要 provenance 溯源——安全关键字段
    （interactions / contraindications 等）的值仍存主表，但「由哪位专家、
    何时、依据什么来源审校」无法从行级 review_status 得知。本迁移新建
    material_field_review，为每个 (原料, 字段) 维护一条最新审校 provenance。
    本迁移不写入任何数据（不伪造专家审校内容）。

幂等性（ADR-007）:
    - 表：inspect(bind).has_table() 判定，已存在则跳过 CREATE TABLE。
    - 索引：CREATE [UNIQUE] INDEX IF NOT EXISTS，可重复执行。
    - 历史遗留：生产库曾出现 alembic stamp 跳过 DDL 的情况，故 DDL 不以
      alembic_version 为唯一事实来源；执行后须用
      to_regclass('public.material_field_review') 复核。

可回滚:
    downgrade 用 DROP TABLE IF EXISTS ... CASCADE 删除本表，不触碰主表。

锁表风险:
    CREATE TABLE 为事务性 DDL，只新增表，不对 food_materials / users 加锁，
    不影响正在运行的后端（PID 4328）的现有查询。
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261108_000001"
down_revision = "20261105_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if not insp.has_table("material_field_review"):
        op.create_table(
            "material_field_review",
            sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column("material_id", sa.BigInteger(), nullable=False),
            sa.Column("field_name", sa.String(64), nullable=False),
            sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("source", sa.String(128), nullable=True),
            sa.Column("review_note", sa.Text(), nullable=True),
            sa.Column("reviewed_by", sa.BigInteger(), nullable=False),
            sa.Column(
                "reviewed_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            # 追加表：值真相仍在 food_materials，本表仅存审校 provenance
            sa.ForeignKeyConstraint(
                ["material_id"],
                ["food_materials.id"],
                ondelete="CASCADE",
                name="fk_material_field_review_material",
            ),
            sa.ForeignKeyConstraint(
                ["reviewed_by"],
                ["users.id"],
                ondelete="CASCADE",
                name="fk_material_field_review_reviewer",
            ),
            sa.UniqueConstraint(
                "material_id", "field_name", name="uq_material_field_review_material_field"
            ),
            sa.PrimaryKeyConstraint("id", name="pk_material_field_review"),
        )

    # 索引名与模型 __table__ 生成的名称保持一致（否则 autogenerate 反复报差异）
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_material_field_review_material_id "
        "ON material_field_review (material_id)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_material_field_review_material_field "
        "ON material_field_review (material_id, field_name)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS material_field_review CASCADE")
