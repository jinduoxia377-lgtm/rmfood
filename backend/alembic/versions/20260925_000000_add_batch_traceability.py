"""add batch traceability system

Revision ID: 20260925_000000_add_batch_traceability
Revises: 20260910_000000_add_cfam_tables
Create Date: 2026-09-25 00:00:00

Phase 1: 批记录与追溯体系
新增表:
- ingredient_lots: 原料批号管理
- batches: 批记录
- batch_ingredient_lots: 批-原料关联
- samples: 样品管理
- test_reports: 测试报告
- custom_field_definitions: 自定义字段定义
- custom_field_values: 自定义字段值
- projects: 项目管理

修改表:
- formulas: 添加 batches 反向关系（无新列）
- ingredients: 添加 ingredient_lots 反向关系（无新列）
- food_materials: 添加价格字段
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20260925_000000_add_batch_traceability'
down_revision: Union[str, None] = '20260918_000000_add_peptide_structure_analysis'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. 原料批号表 ──────────────────────────────────────
    op.create_table(
        "ingredient_lots",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("organization_id", sa.BigInteger(), nullable=True, index=True),
        sa.Column("ingredient_id", sa.BigInteger(), sa.ForeignKey("ingredients.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("supplier_lot_number", sa.String(100), nullable=False),
        sa.Column("internal_lot_code", sa.String(50), unique=True, index=True),
        sa.Column("received_qty_kg", sa.Float(), nullable=False),
        sa.Column("used_qty_kg", sa.Float(), nullable=False, server_default="0"),
        sa.Column("remaining_qty_kg", sa.Float(), nullable=False),
        sa.Column("received_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expiry_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="available"),
        sa.Column("coa_url", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ingredient_lots_organization", "ingredient_lots", ["organization_id"])
    op.create_index("ix_ingredient_lots_status", "ingredient_lots", ["status"])

    # ── 2. 批记录表 ────────────────────────────────────────
    op.create_table(
        "batches",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("organization_id", sa.BigInteger(), nullable=True, index=True),
        sa.Column("batch_code", sa.String(50), unique=True, index=True, nullable=False),
        sa.Column("formula_id", sa.BigInteger(), sa.ForeignKey("formulas.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("formula_version_id", sa.BigInteger(), sa.ForeignKey("formula_versions.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("target_weight_kg", sa.Float(), nullable=False),
        sa.Column("actual_weight_kg", sa.Float(), nullable=True),
        sa.Column("yield_rate", sa.Float(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="planned"),
        sa.Column("prepared_by", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("preparation_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_batches_organization", "batches", ["organization_id"])
    op.create_index("ix_batches_formula", "batches", ["formula_id"])
    op.create_index("ix_batches_status", "batches", ["status"])

    # ── 3. 批-原料关联表 ───────────────────────────────────
    op.create_table(
        "batch_ingredient_lots",
        sa.Column("batch_id", sa.BigInteger(), sa.ForeignKey("batches.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("ingredient_lot_id", sa.BigInteger(), sa.ForeignKey("ingredient_lots.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("used_qty_kg", sa.Float(), nullable=False),
    )

    # ── 4. 样品表 ──────────────────────────────────────────
    op.create_table(
        "samples",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("organization_id", sa.BigInteger(), nullable=True, index=True),
        sa.Column("sample_code", sa.String(50), unique=True, index=True, nullable=False),
        sa.Column("batch_id", sa.BigInteger(), sa.ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("sample_type", sa.String(20), nullable=False, server_default="qc"),
        sa.Column("quantity_g", sa.Float(), nullable=True),
        sa.Column("storage_condition", sa.String(100), nullable=True),
        sa.Column("aliquot_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_samples_organization", "samples", ["organization_id"])
    op.create_index("ix_samples_batch", "samples", ["batch_id"])

    # ── 5. 测试报告表 ──────────────────────────────────────
    op.create_table(
        "test_reports",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("organization_id", sa.BigInteger(), nullable=True, index=True),
        sa.Column("sample_id", sa.BigInteger(), sa.ForeignKey("samples.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("parameter", sa.String(200), nullable=False, index=True),
        sa.Column("value", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(50), nullable=True),
        sa.Column("spec_min", sa.Float(), nullable=True),
        sa.Column("spec_max", sa.Float(), nullable=True),
        sa.Column("result", sa.String(20), nullable=True),
        sa.Column("tester_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_test_reports_organization", "test_reports", ["organization_id"])
    op.create_index("ix_test_reports_sample", "test_reports", ["sample_id"])
    op.create_index("ix_test_reports_parameter", "test_reports", ["parameter"])

    # ── 6. 自定义字段定义表 ────────────────────────────────
    op.create_table(
        "custom_field_definitions",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("organization_id", sa.BigInteger(), nullable=True, index=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("field_name", sa.String(100), nullable=False),
        sa.Column("field_type", sa.String(20), nullable=False),
        sa.Column("options", sa.JSON(), nullable=True),
        sa.Column("required", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_custom_field_defs_entity", "custom_field_definitions", ["entity_type", "field_name"])

    # ── 7. 自定义字段值表 ──────────────────────────────────
    op.create_table(
        "custom_field_values",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("definition_id", sa.BigInteger(), sa.ForeignKey("custom_field_definitions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("entity_id", sa.BigInteger(), nullable=False),
        sa.Column("field_value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_custom_field_values_entity", "custom_field_values", ["definition_id", "entity_id"])

    # ── 8. 项目表 ──────────────────────────────────────────
    op.create_table(
        "projects",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("organization_id", sa.BigInteger(), nullable=True, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("code", sa.String(50), unique=True, index=True, nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("phase", sa.String(20), nullable=False, server_default="brief"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("owner_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("target_launch_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("budget", sa.Float(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_projects_organization", "projects", ["organization_id"])
    op.create_index("ix_projects_phase", "projects", ["phase"])
    op.create_index("ix_projects_owner", "projects", ["owner_id"])

    # ── 9. 为 food_materials 添加价格字段 ─────────────────
    try:
        op.add_column("food_materials", sa.Column("price_per_kg", sa.Float(), nullable=True))
        op.add_column("food_materials", sa.Column("currency", sa.String(10), nullable=True, server_default="CNY"))
        op.add_column("food_materials", sa.Column("last_price_update", sa.DateTime(timezone=True), nullable=True))
        op.add_column("food_materials", sa.Column("price_history", sa.JSON(), nullable=True))
    except Exception:
        pass  # 字段已存在时忽略


def downgrade() -> None:
    op.drop_table("projects")
    op.drop_table("custom_field_values")
    op.drop_table("custom_field_definitions")
    op.drop_table("test_reports")
    op.drop_table("samples")
    op.drop_table("batch_ingredient_lots")
    op.drop_table("batches")
    op.drop_table("ingredient_lots")

    try:
        op.drop_column("food_materials", "price_history")
        op.drop_column("food_materials", "last_price_update")
        op.drop_column("food_materials", "currency")
        op.drop_column("food_materials", "price_per_kg")
    except Exception:
        pass
