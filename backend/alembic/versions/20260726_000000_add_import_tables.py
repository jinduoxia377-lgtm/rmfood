"""add import_tasks and import_errors tables for data import engine

Revision ID: 20260726_000000_add_import_tables
Revises: 20260723_113212_add_organization_id_to_all
Create Date: 2026-07-26 00:00:00.000000

导入数据引擎追踪表：
- import_tasks: 导入任务状态、进度统计
- import_errors: 导入过程中的行级错误日志
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260726_000000_add_import_tables'
down_revision: Union[str, None] = '20260723_113212_add_organization_id_to_all'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建导入任务追踪表和错误日志表"""

    # ── import_tasks ──────────────────────────────────────────────
    op.create_table(
        'import_tasks',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('task_id', sa.Uuid(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.BigInteger(), nullable=True,
                  comment='操作人ID'),
        sa.Column('adapter_type', sa.String(20), nullable=False,
                  comment='适配器类型: csv | json | api'),
        sa.Column('target_table', sa.String(50), nullable=False,
                  comment='目标表名: retail_products | food_materials'),
        sa.Column('status', sa.String(20), nullable=False,
                  server_default='pending',
                  comment='任务状态: pending | running | completed | failed | cancelled'),
        sa.Column('total_rows', sa.BigInteger(), nullable=False, server_default='0',
                  comment='总行数'),
        sa.Column('processed_rows', sa.BigInteger(), nullable=False, server_default='0',
                  comment='已处理行数'),
        sa.Column('inserted_rows', sa.BigInteger(), nullable=False, server_default='0',
                  comment='新增行数'),
        sa.Column('updated_rows', sa.BigInteger(), nullable=False, server_default='0',
                  comment='更新行数'),
        sa.Column('error_rows', sa.BigInteger(), nullable=False, server_default='0',
                  comment='错误行数'),
        sa.Column('progress_pct', sa.Float(), nullable=False, server_default='0.0',
                  comment='进度百分比'),
        sa.Column('error_summary', sa.Text(), nullable=True,
                  comment='最近 N 条错误的摘要（JSON array）'),
        sa.Column('file_name', sa.String(500), nullable=True,
                  comment='原始文件名'),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=True,
                  comment='文件大小（字节）'),
        sa.Column('mapping_config', sa.JSON(), nullable=True,
                  comment='字段映射配置'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('task_id'),
        sa.CheckConstraint(
            "status IN ('pending', 'running', 'completed', 'failed', 'cancelled')",
            name='ck_import_tasks_status',
        ),
        sa.CheckConstraint(
            "adapter_type IN ('csv', 'json', 'api')",
            name='ck_import_tasks_adapter_type',
        ),
    )
    op.create_index(op.f('ix_import_tasks_status'), 'import_tasks', ['status'], unique=False)
    op.create_index(op.f('ix_import_tasks_target_table'), 'import_tasks', ['target_table'], unique=False)
    op.create_index(op.f('ix_import_tasks_user_id'), 'import_tasks', ['user_id'], unique=False)
    op.create_index(op.f('ix_import_tasks_created_at'), 'import_tasks', ['created_at'], unique=False)
    op.create_index(op.f('ix_import_tasks_task_id'), 'import_tasks', ['task_id'], unique=False)

    # ── import_errors ─────────────────────────────────────────────
    op.create_table(
        'import_errors',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('task_id', sa.Uuid(), nullable=False,
                  comment='关联 import_tasks.task_id'),
        sa.Column('row_number', sa.BigInteger(), nullable=True,
                  comment='源文件中的行号'),
        sa.Column('raw_data', sa.Text(), nullable=True,
                  comment='原始行数据（JSON 序列化）'),
        sa.Column('error_message', sa.Text(), nullable=False,
                  comment='错误信息'),
        sa.Column('error_type', sa.String(50), nullable=True,
                  comment='错误类型: validation | transform | database'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['task_id'], ['import_tasks.task_id'],
                                ondelete='CASCADE'),
    )
    op.create_index(op.f('ix_import_errors_task_id'), 'import_errors', ['task_id'], unique=False)
    op.create_index(op.f('ix_import_errors_error_type'), 'import_errors', ['error_type'], unique=False)


def downgrade() -> None:
    """回滚导入任务追踪表"""
    op.drop_index(op.f('ix_import_errors_error_type'), table_name='import_errors')
    op.drop_index(op.f('ix_import_errors_task_id'), table_name='import_errors')
    op.drop_table('import_errors')
    op.drop_index(op.f('ix_import_tasks_task_id'), table_name='import_tasks')
    op.drop_index(op.f('ix_import_tasks_created_at'), table_name='import_tasks')
    op.drop_index(op.f('ix_import_tasks_user_id'), table_name='import_tasks')
    op.drop_index(op.f('ix_import_tasks_target_table'), table_name='import_tasks')
    op.drop_index(op.f('ix_import_tasks_status'), table_name='import_tasks')
    op.drop_table('import_tasks')
