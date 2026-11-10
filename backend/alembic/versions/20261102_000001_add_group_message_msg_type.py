"""add msg_type to ai_bot_group_messages

Revision ID: 20261102_000001
Revises: 20261030_000001
Create Date: 2026-11-02 15:30:00

P2-25：群聊消息结构化消息类型。新增可空列 `msg_type`
（user/bot_reply/summary/pending/error/task_assign），旧记录为 NULL，
读取时由应用层按 content 哨兵推断（向后兼容）。
"""
from alembic import op

revision = '20261102_000001'
down_revision = '20261030_000001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE ai_bot_group_messages "
        "ADD COLUMN IF NOT EXISTS msg_type VARCHAR(20)"
    )


def downgrade() -> None:
    # 幂等：不回滚（安全修复迁移）
    pass
