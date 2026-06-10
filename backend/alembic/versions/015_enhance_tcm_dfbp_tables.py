"""增强 TCMSP 和 DFBP 数据库表

Revision ID: 015_enhance_tcm_dfbp_tables
Revises: 014_add_knowledge_graph_tables
Create Date: 2026-06-03

新增规范化表：
- tcm_compounds: 化合物表
- tcm_targets: 靶点表
- tcm_diseases: 疾病表
- tcm_herb_compounds: 药材-化合物关联
- tcm_compound_targets: 化合物-靶点关联
- tcm_target_diseases: 靶点-疾病关联
- peptide_activities: 肽活性数据
- peptide_source_proteins: 来源蛋白
- peptide_enzymes: 水解酶
- peptide_enzyme_links: 肽-酶关联
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '015_tcm_dfbp'
down_revision: Union[str, None] = '014_knowledge_graph'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建规范化表"""

    # ═══════════════════════════════════════════
    # TCMSP 规范化表
    # ═══════════════════════════════════════════

    # 化合物表
    op.create_table(
        'tcm_compounds',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('molecular_formula', sa.String(100), nullable=True),
        sa.Column('molecular_weight', sa.Float(), nullable=True),
        sa.Column('smiles', sa.Text(), nullable=True),
        sa.Column('inchi', sa.Text(), nullable=True),
        sa.Column('ob_percent', sa.Float(), nullable=True),
        sa.Column('dl_value', sa.Float(), nullable=True),
        sa.Column('drug_likeness', sa.Float(), nullable=True),
        sa.Column('bioavailability_score', sa.Float(), nullable=True),
        sa.Column('hba', sa.Integer(), nullable=True),
        sa.Column('hbd', sa.Integer(), nullable=True),
        sa.Column('logp', sa.Float(), nullable=True),
        sa.Column('tpsa', sa.Float(), nullable=True),
        sa.Column('tcmsp_compound_id', sa.String(50), nullable=True, unique=True),
        sa.Column('source', sa.String(50), server_default='tcmsp'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tcm_compounds_name', 'tcm_compounds', ['name'])
    op.create_index('ix_tcm_compounds_ob_dl', 'tcm_compounds', ['ob_percent', 'dl_value'])

    # 靶点表
    op.create_table(
        'tcm_targets',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('gene_symbol', sa.String(50), nullable=True),
        sa.Column('uniprot_id', sa.String(20), nullable=True, unique=True),
        sa.Column('organism', sa.String(100), server_default='Homo sapiens'),
        sa.Column('target_type', sa.String(50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('pdb_ids', sa.JSON(), nullable=True),
        sa.Column('source', sa.String(50), server_default='tcmsp'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tcm_targets_name', 'tcm_targets', ['name'])
    op.create_index('ix_tcm_targets_gene', 'tcm_targets', ['gene_symbol'])

    # 疾病表
    op.create_table(
        'tcm_diseases',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('mesh_id', sa.String(20), nullable=True, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('source', sa.String(50), server_default='tcmsp'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tcm_diseases_name', 'tcm_diseases', ['name'])

    # 药材-化合物关联表
    op.create_table(
        'tcm_herb_compounds',
        sa.Column('herb_id', sa.Integer(), sa.ForeignKey('tcm_herbs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('compound_id', sa.Integer(), sa.ForeignKey('tcm_compounds.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content_percent', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('herb_id', 'compound_id'),
    )

    # 化合物-靶点关联表
    op.create_table(
        'tcm_compound_targets',
        sa.Column('compound_id', sa.Integer(), sa.ForeignKey('tcm_compounds.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target_id', sa.Integer(), sa.ForeignKey('tcm_targets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('activity_type', sa.String(50), nullable=True),
        sa.Column('activity_value', sa.Float(), nullable=True),
        sa.Column('activity_unit', sa.String(50), nullable=True),
        sa.Column('evidence_source', sa.String(100), nullable=True),
        sa.Column('confidence', sa.Float(), server_default='0.0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('compound_id', 'target_id'),
    )

    # 靶点-疾病关联表
    op.create_table(
        'tcm_target_diseases',
        sa.Column('target_id', sa.Integer(), sa.ForeignKey('tcm_targets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('disease_id', sa.Integer(), sa.ForeignKey('tcm_diseases.id', ondelete='CASCADE'), nullable=False),
        sa.Column('evidence_type', sa.String(50), nullable=True),
        sa.Column('confidence', sa.Float(), server_default='0.0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('target_id', 'disease_id'),
    )

    # ═══════════════════════════════════════════
    # DFBP 规范化表
    # ═══════════════════════════════════════════

    # 肽活性数据表
    op.create_table(
        'peptide_activities',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('peptide_id', sa.Integer(), sa.ForeignKey('bioactive_peptides.id', ondelete='CASCADE'), nullable=False),
        sa.Column('activity_type', sa.String(100), nullable=False),
        sa.Column('activity_value', sa.Float(), nullable=True),
        sa.Column('activity_unit', sa.String(50), nullable=True),
        sa.Column('activity_description', sa.Text(), nullable=True),
        sa.Column('assay_method', sa.String(200), nullable=True),
        sa.Column('assay_conditions', sa.JSON(), nullable=True),
        sa.Column('cell_line', sa.String(100), nullable=True),
        sa.Column('reference_doi', sa.String(200), nullable=True),
        sa.Column('reference_title', sa.Text(), nullable=True),
        sa.Column('reference_year', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(50), server_default='dfbp'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_peptide_activities_type', 'peptide_activities', ['activity_type'])
    op.create_index('ix_peptide_activities_peptide_type', 'peptide_activities', ['peptide_id', 'activity_type'])

    # 来源蛋白表
    op.create_table(
        'peptide_source_proteins',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('protein_name', sa.String(200), nullable=False),
        sa.Column('uniprot_id', sa.String(20), nullable=True, unique=True),
        sa.Column('organism', sa.String(100), nullable=True),
        sa.Column('organism_taxid', sa.Integer(), nullable=True),
        sa.Column('protein_family', sa.String(100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sequence_length', sa.Integer(), nullable=True),
        sa.Column('molecular_weight', sa.Float(), nullable=True),
        sa.Column('source', sa.String(50), server_default='dfbp'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_peptide_source_proteins_name', 'peptide_source_proteins', ['protein_name'])

    # 水解酶表
    op.create_table(
        'peptide_enzymes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('enzyme_name', sa.String(200), nullable=False),
        sa.Column('enzyme_type', sa.String(50), nullable=True),
        sa.Column('ec_number', sa.String(20), nullable=True),
        sa.Column('organism', sa.String(100), nullable=True),
        sa.Column('optimal_ph', sa.Float(), nullable=True),
        sa.Column('optimal_temperature', sa.Float(), nullable=True),
        sa.Column('cleavage_sites', sa.JSON(), nullable=True),
        sa.Column('source', sa.String(50), server_default='dfbp'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_peptide_enzymes_name', 'peptide_enzymes', ['enzyme_name'])

    # 肽-酶关联表
    op.create_table(
        'peptide_enzyme_links',
        sa.Column('peptide_id', sa.Integer(), sa.ForeignKey('bioactive_peptides.id', ondelete='CASCADE'), nullable=False),
        sa.Column('enzyme_id', sa.Integer(), sa.ForeignKey('peptide_enzymes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('hydrolysis_yield', sa.Float(), nullable=True),
        sa.Column('conditions', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('peptide_id', 'enzyme_id'),
    )


def downgrade() -> None:
    """删除规范化表"""
    # DFBP 表
    op.drop_table('peptide_enzyme_links')
    op.drop_table('peptide_enzymes')
    op.drop_table('peptide_source_proteins')
    op.drop_table('peptide_activities')

    # TCMSP 表
    op.drop_table('tcm_target_diseases')
    op.drop_table('tcm_compound_targets')
    op.drop_table('tcm_herb_compounds')
    op.drop_table('tcm_diseases')
    op.drop_table('tcm_targets')
    op.drop_table('tcm_compounds')
