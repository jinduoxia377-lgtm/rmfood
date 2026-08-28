"""add peptide batch COA tables

Revision ID: 20260821_140000_add_peptide_batch_coa
Revises: 20260821_000000_add_experiment_share
Create Date: 2026-08-21 14:00:00

新增食源性多肽批次COA（出厂检验报告）表结构：
- peptide_batch_coas: COA主记录表
- coa_test_items: COA检验单项明细表
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = '20260821_140000_add_peptide_batch_coa'
down_revision: Union[str, None] = '20260821_000000_add_experiment_share'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建COA相关表"""
    # 1. 创建 COA 主记录表
    op.create_table(
        'peptide_batch_coas',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('peptide_id', sa.BigInteger(), nullable=True, index=True,
                  comment='关联多肽主表ID'),
        sa.Column('product_name_cn', sa.String(200), nullable=False,
                  comment='产品名称(中文)'),
        sa.Column('product_name_en', sa.String(200), nullable=True,
                  comment='产品名称(英文)'),
        sa.Column('product_type', sa.String(100), nullable=False, server_default='其他食品',
                  comment='产品类型'),
        sa.Column('product_code', sa.String(50), nullable=True,
                  comment='型号/编号'),
        sa.Column('spec', sa.String(100), nullable=True,
                  comment='规格(如 20千克/袋)'),
        sa.Column('batch_no', sa.String(50), nullable=False, index=True,
                  comment='生产批号'),
        sa.Column('mfg_date', sa.DateTime(timezone=True), nullable=True,
                  comment='生产日期'),
        sa.Column('expiry_date', sa.DateTime(timezone=True), nullable=True,
                  comment='有效期/保质期'),
        sa.Column('production_line', sa.String(100), nullable=True,
                  comment='生产线'),
        sa.Column('gb_standard', sa.String(100), nullable=True,
                  comment='执行标准(如 GB31645—2018)'),
        sa.Column('enterprise_standard', sa.String(200), nullable=True,
                  comment='企业标准'),
        sa.Column('inspection_basis', sa.Text(), nullable=True,
                  comment='检验判定依据说明'),
        sa.Column('test_conclusion', sa.String(20), nullable=False, server_default='待检',
                  comment='检验结论: 合格/不合格/待检'),
        sa.Column('qualified', sa.Boolean(), nullable=False, server_default='f',
                  comment='是否合格'),
        sa.Column('coa_pdf_url', sa.String(500), nullable=True,
                  comment='COA PDF文件URL'),
        sa.Column('coa_word_url', sa.String(500), nullable=True,
                  comment='COA Word原文URL'),
        sa.Column('test_report_image_url', sa.String(500), nullable=True,
                  comment='检测报告扫描件'),
        sa.Column('tested_by', sa.String(50), nullable=True,
                  comment='检测人'),
        sa.Column('checked_by', sa.String(50), nullable=True,
                  comment='校对人'),
        sa.Column('approved_by', sa.String(50), nullable=True,
                  comment='批准人'),
        sa.Column('supplier_name', sa.String(200), nullable=True,
                  comment='供应商名称'),
        sa.Column('supplier_batch_ref', sa.String(100), nullable=True,
                  comment='供应商批次编号'),
        sa.Column('created_by', sa.BigInteger(), nullable=True,
                  comment='创建人ID'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('NOW()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True,
                  comment='软删除时间戳'),
        sa.CheckConstraint(
            "test_conclusion IN ('合格', '不合格', '待检')",
            name='ck_coa_conclusion_valid'
        ),
    )

    # 2. 创建检验单项表
    op.create_table(
        'coa_test_items',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('coa_id', sa.BigInteger(), nullable=False, index=True,
                  comment='关联COA主表ID'),
        sa.Column('category', sa.String(50), nullable=False,
                  comment='检测类别: sensory/chemical/microbial/packaging'),
        sa.Column('item_name', sa.String(100), nullable=False,
                  comment='检测项目名(中文)'),
        sa.Column('item_name_en', sa.String(100), nullable=True,
                  comment='检测项目名(英文)'),
        sa.Column('standard', sa.String(500), nullable=False,
                  comment='标准/限值'),
        sa.Column('result', sa.String(500), nullable=True,
                  comment='检测结果'),
        sa.Column('unit', sa.String(20), nullable=True,
                  comment='单位'),
        sa.Column('judgment', sa.String(20), nullable=True,
                  comment='判定: 符合/不符合'),
        sa.Column('remark', sa.Text(), nullable=True,
                  comment='备注'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0',
                  comment='排序'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(
            ['coa_id'], ['peptide_batch_coas.id'],
            ondelete='CASCADE', name='fk_coa_test_items_coa_id'
        ),
    )

    # 3. 为 peptides 表添加 batch_coas 关系索引（通过 existing 外键）
    # 注意: peptide_id 外键已存在于 peptide_batch_coas.peptide_id
    op.create_foreign_key(
        'fk_peptide_batch_coas_peptide_id',
        'peptide_batch_coas', 'peptides',
        ['peptide_id'], ['id'], ondelete='SET NULL'
    )


def downgrade() -> None:
    """回滚COA相关表"""
    op.drop_table('coa_test_items')
    op.drop_table('peptide_batch_coas')
