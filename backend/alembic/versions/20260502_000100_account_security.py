"""添加账号安全字段（防暴力破解）

Revision ID: 002_account_security
Revises: 001_initial
Create Date: 2026-05-02

新增字段:
- last_login: 最后登录时间
- login_attempts: 登录失败次数计数器
- locked_until: 账号锁定截止时间

安全功能:
- 防止暴力破解攻击
- 自动锁定/解锁机制
- 管理员手动解锁支持

作者: RMFOOD Team
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260502_000100_account_security'
down_revision: Union[str, None] = '20260502_000000_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """添加账号安全字段 (幂等 - 自动跳过已存在的列)"""

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col['name'] for col in inspector.get_columns('users')]

    # 添加最后登录时间字段
    if 'last_login' not in existing_columns:
        op.add_column('users', sa.Column(
            'last_login',
            sa.DateTime(),
            nullable=True,
            comment='最后登录时间'
        ))

    # 添加登录失败次数字段
    if 'login_attempts' not in existing_columns:
        op.add_column('users', sa.Column(
            'login_attempts',
            sa.Integer(),
            server_default='0',
            nullable=False,
            comment='登录失败次数（用于防暴力破解）'
        ))

    # 添加账号锁定时间字段
    if 'locked_until' not in existing_columns:
        op.add_column('users', sa.Column(
            'locked_until',
            sa.DateTime(),
            nullable=True,
            comment='账号锁定截止时间（NULL表示未锁定）'
        ))

    # 创建索引（幂等）
    existing_indexes = [idx['name'] for idx in inspector.get_indexes('users')]
    if 'ix_users_locked_until' not in existing_indexes:
        op.create_index('ix_users_locked_until', 'users', ['locked_until'])


def downgrade() -> None:
    """移除账号安全字段"""
    
    # 删除索引
    op.drop_index('ix_users_locked_until', table_name='users')
    
    # 删除字段
    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'login_attempts')
    op.drop_column('users', 'last_login')
    
    print("✅ 已移除账号安全字段")