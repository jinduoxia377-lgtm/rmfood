"""chat_sessions 增加 client_session_id 列（P2 统一前后端会话 ID）

背景:
- 前端本地会话 id 为字符串（session-<ts>-<rand>），后端 /chat/sessions 为 int 自增 id。
- 原 _persist_chat_record 对无 bot_id 的对话总是合并到用户最新活跃会话，
  导致服务器端把多个前端本地会话混成一个长对话。
- 本迁移为 chat_sessions 增加可空的 client_session_id 列（带索引），
  使后端可按 (user_id, client_session_id) 查找/创建会话，按前端会话隔离记录。
- 旧请求（不携带 client_session_id）行为完全不变。

Revision ID: 20261030_000000
Revises: 20261028_030000
Create Date: 2026-10-30
"""

from alembic import op
import sqlalchemy as sa

revision = '20261030_000000'
down_revision = '20261028_030000'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'chat_sessions' not in insp.get_table_names():
        return
    cols = [c['name'] for c in insp.get_columns('chat_sessions')]
    if 'client_session_id' not in cols:
        op.add_column(
            'chat_sessions',
            sa.Column('client_session_id', sa.String(128), nullable=True),
        )
    # 索引幂等创建：先检查是否已存在
    indexes = {ix['name'] for ix in insp.get_indexes('chat_sessions')}
    if 'ix_chat_sessions_client_session_id' not in indexes:
        op.create_index(
            'ix_chat_sessions_client_session_id',
            'chat_sessions',
            ['client_session_id'],
        )


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'chat_sessions' not in insp.get_table_names():
        return
    indexes = {ix['name'] for ix in insp.get_indexes('chat_sessions')}
    if 'ix_chat_sessions_client_session_id' in indexes:
        op.drop_index('ix_chat_sessions_client_session_id', table_name='chat_sessions')
    cols = [c['name'] for c in insp.get_columns('chat_sessions')]
    if 'client_session_id' in cols:
        op.drop_column('chat_sessions', 'client_session_id')