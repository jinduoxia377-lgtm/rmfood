"""添加知识图谱表

Revision ID: 014_add_knowledge_graph_tables
Revises: 013_add_composite_indexes
Create Date: 2026-06-03

创建知识图谱节点和关系表，用于存储：
- 药材、化合物、靶点、疾病、肽、蛋白质、食物等实体节点
- 协同、拮抗、含有、作用于、治疗等关系边
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '014_knowledge_graph'
down_revision: Union[str, None] = '013_composite'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建知识图谱表"""

    # ── 节点表 ──
    op.create_table(
        'kg_nodes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('node_type', sa.String(50), nullable=False),
        sa.Column('node_label', sa.String(200), nullable=False),
        sa.Column('properties', sa.JSON(), nullable=True),
        sa.Column('source', sa.String(50), server_default='manual'),
        sa.Column('source_id', sa.String(100), nullable=True),
        sa.Column('tcm_herb_id', sa.Integer(), sa.ForeignKey('tcm_herbs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('bioactive_peptide_id', sa.Integer(), sa.ForeignKey('bioactive_peptides.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('node_type', 'node_label', name='uq_kg_node_type_label'),
    )

    # 节点索引
    op.create_index('ix_kg_nodes_node_type', 'kg_nodes', ['node_type'])
    op.create_index('ix_kg_nodes_node_label', 'kg_nodes', ['node_label'])
    op.create_index('ix_kg_nodes_type_label', 'kg_nodes', ['node_type', 'node_label'])

    # ── 边表 ──
    op.create_table(
        'kg_edges',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('source_id', sa.Integer(), sa.ForeignKey('kg_nodes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target_id', sa.Integer(), sa.ForeignKey('kg_nodes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('edge_type', sa.String(50), nullable=False),
        sa.Column('strength', sa.Float(), server_default='0.0'),
        sa.Column('properties', sa.JSON(), nullable=True),
        sa.Column('source', sa.String(50), server_default='manual'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('source_id', 'target_id', 'edge_type', name='uq_kg_edge_source_target_type'),
    )

    # 边索引
    op.create_index('ix_kg_edges_source', 'kg_edges', ['source_id'])
    op.create_index('ix_kg_edges_target', 'kg_edges', ['target_id'])
    op.create_index('ix_kg_edges_type', 'kg_edges', ['edge_type'])
    op.create_index('ix_kg_edges_source_type', 'kg_edges', ['source_id', 'edge_type'])
    op.create_index('ix_kg_edges_target_type', 'kg_edges', ['target_id', 'edge_type'])


def downgrade() -> None:
    """删除知识图谱表"""
    op.drop_table('kg_edges')
    op.drop_table('kg_nodes')
