"""RMFOOD 初始数据库 Schema

这是 RMFOOD 配方设计平台的初始数据库迁移脚本。
包含所有核心业务表：
- 用户管理 (users)
- 配方管理 (formulas, ingredients, peptides, etc.)
- 实验数据 (experiments, experiment_data)
- 工作流 (workflows, workflow_tasks)
- 通知系统 (notifications)
- 系统日志 (audit_logs, attachments, data_snapshots)
- 外部数据 (tcm_herbs, bioactive_peptides, knowledge_graph_nodes)

Revision ID: 001_initial
Revises: 
Create Date: 2026-05-02

作者: RMFOOD Team
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite, postgresql


# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建所有核心业务表"""
    
    # ============================================================
    # 1. 用户表 (users)
    # ============================================================
    op.create_table('users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=100), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), server_default='user', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('avatar_url', sa.String(length=500), nullable=True),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.Column('login_attempts', sa.Integer(), server_default='0', nullable=False),
        sa.Column('locked_until', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    
    # ============================================================
    # 2. 分类表 (categories)
    # ============================================================
    op.create_table('categories',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['parent_id'], ['categories.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_categories_name', 'categories', ['name'], unique=True)
    
    # ============================================================
    # 3. 标签表 (tags)
    # ============================================================
    op.create_table('tags',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('color', sa.String(length=7), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tags_name', 'tags', ['name'], unique=True)
    
    # ============================================================
    # 4. 配方表 (formulas)
    # ============================================================
    op.create_table('formulas',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='draft', nullable=False),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('creator_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('total_weight', sa.Float(), nullable=True),
        sa.Column('total_cost', sa.Float(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_formulas_name', 'formulas', ['name'])
    op.create_index('ix_formulas_status', 'formulas', ['status'])
    op.create_index('ix_formulas_creator_id', 'formulas', ['creator_id'])
    
    # ============================================================
    # 5. 配方版本表 (formula_versions)
    # ============================================================
    op.create_table('formula_versions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('formula_id', sa.Integer(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('changes_description', sa.Text(), nullable=True),
        sa.Column('snapshot_data', sa.JSON(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['formula_id'], ['formulas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('formula_id', 'version_number', name='uq_formula_version'),
    )
    
    # ============================================================
    # 6. 原料表 (ingredients)
    # ============================================================
    op.create_table('ingredients',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('name_en', sa.String(length=200), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('specification', sa.String(length=200), nullable=True),
        sa.Column('unit', sa.String(length=20), nullable=True),
        sa.Column('cost_per_unit', sa.Float(), nullable=True),
        sa.Column('supplier', sa.String(length=200), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('safety_info', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ingredients_name', 'ingredients', ['name'])
    
    # ============================================================
    # 7. 多肽表 (peptides)
    # ============================================================
    op.create_table('peptides',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('sequence', sa.String(length=500), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=True),
        sa.Column('molecular_weight', sa.Float(), nullable=True),
        sa.Column('isoelectric_point', sa.Float(), nullable=True),
        sa.Column('hydrophobicity', sa.Float(), nullable=True),
        sa.Column('source', sa.String(length=200), nullable=True),
        sa.Column('function_type', sa.String(length=100), nullable=True),
        sa.Column('activity_data', sa.JSON(), nullable=True),
        sa.Column('references', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_peptides_sequence', 'peptides', ['sequence'])
    
    # ============================================================
    # 8. 关联表：配方-原料
    # ============================================================
    op.create_table('formula_ingredients',
        sa.Column('formula_id', sa.Integer(), nullable=False),
        sa.Column('ingredient_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(length=20), nullable=True),
        sa.Column('percentage', sa.Float(), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['formula_id'], ['formulas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ingredient_id'], ['ingredients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('formula_id', 'ingredient_id'),
    )
    
    # ============================================================
    # 9. 关联表：配方-多肽
    # ============================================================
    op.create_table('formula_peptides',
        sa.Column('formula_id', sa.Integer(), nullable=False),
        sa.Column('peptide_id', sa.Integer(), nullable=False),
        sa.Column('concentration', sa.Float(), nullable=True),
        sa.Column('activity_level', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['formula_id'], ['formulas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['peptide_id'], ['peptides.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('formula_id', 'peptide_id'),
    )
    
    # ============================================================
    # 10. 关联表：配方-分类
    # ============================================================
    op.create_table('formula_categories',
        sa.Column('formula_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['formula_id'], ['formulas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('formula_id', 'category_id'),
    )
    
    # ============================================================
    # 11. 关联表：配方-标签
    # ============================================================
    op.create_table('formula_tags',
        sa.Column('formula_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['formula_id'], ['formulas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('formula_id', 'tag_id'),
    )
    
    # ============================================================
    # 12. 评论表 (comments)
    # ============================================================
    op.create_table('comments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('author_id', sa.Integer(), nullable=False),
        sa.Column('formula_id', sa.Integer(), nullable=False),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['formula_id'], ['formulas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_id'], ['comments.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_comments_formula_id', 'comments', ['formula_id'])
    
    # ============================================================
    # 13. 评论点赞表 (comment_likes)
    # ============================================================
    op.create_table('comment_likes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('comment_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['comment_id'], ['comments.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'comment_id', name='uq_comment_like'),
    )
    
    # ============================================================
    # 14. 实验表 (experiments)
    # ============================================================
    op.create_table('experiments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='planned', nullable=False),
        sa.Column('formula_id', sa.Integer(), nullable=True),
        sa.Column('researcher_id', sa.Integer(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('protocol', sa.Text(), nullable=True),
        sa.Column('results_summary', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['formula_id'], ['formulas.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['researcher_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_experiments_name', 'experiments', ['name'])
    op.create_index('ix_experiments_status', 'experiments', ['status'])
    
    # ============================================================
    # 15. 实验数据表 (experiment_data)
    # ============================================================
    op.create_table('experiment_data',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('experiment_id', sa.Integer(), nullable=False),
        sa.Column('data_type', sa.String(length=50), nullable=False),
        sa.Column('data_value', sa.Float(), nullable=True),
        sa.Column('data_text', sa.Text(), nullable=True),
        sa.Column('unit', sa.String(length=20), nullable=True),
        sa.Column('measurement_time', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['experiment_id'], ['experiments.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_experiment_data_experiment_id', 'experiment_data', ['experiment_id'])
    
    # ============================================================
    # 16. 工作流表 (workflows)
    # ============================================================
    op.create_table('workflows',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='active', nullable=False),
        sa.Column('creator_id', sa.Integer(), nullable=False),
        sa.Column('formula_id', sa.Integer(), nullable=True),
        sa.Column('priority', sa.Integer(), server_default='0', nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['formula_id'], ['formulas.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_workflows_status', 'workflows', ['status'])
    op.create_index('ix_workflows_creator_id', 'workflows', ['creator_id'])
    
    # ============================================================
    # 17. 工作流任务表 (workflow_tasks)
    # ============================================================
    op.create_table('workflow_tasks',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('workflow_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='pending', nullable=False),
        sa.Column('assignee_id', sa.Integer(), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('output_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assignee_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_workflow_tasks_workflow_id', 'workflow_tasks', ['workflow_id'])
    op.create_index('ix_workflow_tasks_status', 'workflow_tasks', ['status'])
    
    # ============================================================
    # 18. 通知表 (notifications)
    # ============================================================
    op.create_table('notifications',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='unread', nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=True),
        sa.Column('related_type', sa.String(length=50), nullable=True),
        sa.Column('related_id', sa.Integer(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('notifications_user_id_idx', 'notifications', ['user_id'])
    op.create_index('notifications_status_idx', 'notifications', ['status'])
    
    # ============================================================
    # 19. 审计日志表 (audit_logs)
    # ============================================================
    op.create_table('audit_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('resource_type', sa.String(length=50), nullable=False),
        sa.Column('resource_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('request_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])
    
    # ============================================================
    # 20. 附件表 (attachments)
    # ============================================================
    op.create_table('attachments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('original_name', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=True),
        sa.Column('mime_type', sa.String(length=100), nullable=True),
        sa.Column('uploaded_by', sa.Integer(), nullable=False),
        sa.Column('related_type', sa.String(length=50), nullable=True),
        sa.Column('related_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_attachments_uploaded_by', 'attachments', ['uploaded_by'])
    
    # ============================================================
    # 21. 数据快照表 (data_snapshots)
    # ============================================================
    op.create_table('data_snapshots',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('table_name', sa.String(length=100), nullable=False),
        sa.Column('record_id', sa.Integer(), nullable=False),
        sa.Column('snapshot_data', sa.JSON(), nullable=False),
        sa.Column('snapshot_reason', sa.String(length=100), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_data_snapshots_table_name', 'data_snapshots', ['table_name', 'record_id'])
    
    # ============================================================
    # 22. 中药材表 (tcm_herbs) - 外部数据源
    # ============================================================
    op.create_table('tcm_herbs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('name_latin', sa.String(length=300), nullable=True),
        sa.Column('pinyin', sa.String(length=200), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('properties', sa.Text(), nullable=True),
        sa.Column('meridian_tropism', sa.Text(), nullable=True),
        sa.Column('functions', sa.Text(), nullable=True),
        sa.Column('indications', sa.Text(), nullable=True),
        sa.Column('dosage', sa.String(length=200), nullable=True),
        sa.Column('toxicity', sa.Text(), nullable=True),
        sa.Column('contraindications', sa.Text(), nullable=True),
        sa.Column('chemical_composition', sa.Text(), nullable=True),
        sa.Column('modern_research', sa.Text(), nullable=True),
        sa.Column('references', sa.Text(), nullable=True),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('quality_score', sa.Float(), nullable=True),
        sa.Column('last_updated', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tcm_herbs_name', 'tcm_herbs', ['name'])
    op.create_index('ix_tcm_herbs_category', 'tcm_herbs', ['category'])
    
    # ============================================================
    # 23. 生物活性多肽表 (bioactive_peptides) - 外部数据源
    # ============================================================
    op.create_table('bioactive_peptides',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('sequence', sa.String(length=500), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=True),
        sa.Column('source_protein', sa.String(length=200), nullable=True),
        sa.Column('source_organism', sa.String(length=200), nullable=True),
        sa.Column('length', sa.Integer(), nullable=True),
        sa.Column('molecular_weight', sa.Float(), nullable=True),
        sa.Column('isoelectric_point', sa.Float(), nullable=True),
        sa.Column('net_charge', sa.Float(), nullable=True),
        sa.Column('hydrophobicity', sa.Float(), nullable=True),
        sa.Column('activity_types', sa.Text(), nullable=True),
        sa.Column('mechanism_of_action', sa.Text(), nullable=True),
        sa.Column('target_diseases', sa.Text(), nullable=True),
        sa.Column('experimental_evidence', sa.Text(), nullable=True),
        sa.Column('clinical_studies', sa.Text(), nullable=True),
        sa.Column('patents', sa.Text(), nullable=True),
        sa.Column('safety_profile', sa.Text(), nullable=True),
        sa.Column('stability', sa.Text(), nullable=True),
        sa.Column('bioavailability', sa.Text(), nullable=True),
        sa.Column('references', sa.Text(), nullable=True),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('quality_score', sa.Float(), nullable=True),
        sa.Column('last_updated', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_bioactive_peptides_sequence', 'bioactive_peptides', ['sequence'])
    op.create_index('ix_bioactive_peptides_activity_types', 'bioactive_peptides', ['activity_types'])
    
    # ============================================================
    # 24. 知识图谱节点表 (knowledge_graph_nodes) - 外部数据源
    # ============================================================
    op.create_table('knowledge_graph_nodes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('node_type', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=300), nullable=False),
        sa.Column('properties', sa.JSON(), nullable=True),
        sa.Column('source_database', sa.String(length=100), nullable=True),
        sa.Column('source_id', sa.String(length=100), nullable=True),
        sa.Column('confidence_score', sa.Float(), nullable=True),
        sa.Column('last_validated', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_knowledge_graph_nodes_node_type', 'knowledge_graph_nodes', ['node_type'])
    op.create_index('ix_knowledge_graph_nodes_name', 'knowledge_graph_nodes', ['name'])


def downgrade() -> None:
    """删除所有表（按依赖关系逆序）"""
    
    # 按外键依赖关系逆序删除表
    op.drop_table('knowledge_graph_nodes')
    op.drop_table('bioactive_peptides')
    op.drop_table('tcm_herbs')
    op.drop_table('data_snapshots')
    op.drop_table('attachments')
    op.drop_table('audit_logs')
    op.drop_table('notifications')
    op.drop_table('workflow_tasks')
    op.drop_table('workflows')
    op.drop_table('experiment_data')
    op.drop_table('experiments')
    op.drop_table('comment_likes')
    op.drop_table('comments')
    op.drop_table('formula_tags')
    op.drop_table('formula_categories')
    op.drop_table('formula_peptides')
    op.drop_table('formula_ingredients')
    op.drop_table('peptides')
    op.drop_table('ingredients')
    op.drop_table('formulas')
    op.drop_table('tags')
    op.drop_table('categories')
    op.drop_table('users')