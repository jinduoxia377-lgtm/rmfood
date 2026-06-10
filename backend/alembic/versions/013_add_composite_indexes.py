"""添加复合索引

Revision ID: 013_add_composite_indexes
Revises: 012_add_audit_fields
Create Date: 2026-06-03

为常用查询添加复合索引，提升查询性能。
"""
from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '013_composite'
down_revision: Union[str, None] = '012_audit'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 需要添加的复合索引
COMPOSITE_INDEXES = [
    # 配方列表查询（状态 + 创建者 + 时间排序）
    {
        "name": "ix_formulas_status_creator_created",
        "table": "formulas",
        "columns": ["status", "creator_id", "created_at"],
    },
    # 配方列表查询（状态 + 时间排序）
    {
        "name": "ix_formulas_status_created",
        "table": "formulas",
        "columns": ["status", "created_at"],
    },
    # 实验列表查询（状态 + 配方 + 时间排序）
    {
        "name": "ix_experiments_status_formula_created",
        "table": "experiments",
        "columns": ["status", "formula_id", "created_at"],
    },
    # 实验列表查询（状态 + 研究员 + 时间排序）
    {
        "name": "ix_experiments_status_researcher_created",
        "table": "experiments",
        "columns": ["status", "researcher_id", "created_at"],
    },
    # 用户查询（角色 + 活跃状态 + 时间排序）
    {
        "name": "ix_users_role_active_created",
        "table": "users",
        "columns": ["role", "is_active", "created_at"],
    },
    # 通知查询（用户 + 已读 + 时间排序）
    {
        "name": "ix_notifications_user_read_created",
        "table": "notifications",
        "columns": ["user_id", "is_read", "created_at"],
    },
    # 审计日志查询（操作类型 + 时间排序）
    {
        "name": "ix_audit_logs_action_created",
        "table": "audit_logs",
        "columns": ["action", "created_at"],
    },
    # 同步日志查询（用户 + 状态 + 时间排序）
    {
        "name": "ix_sync_logs_user_status_timestamp",
        "table": "sync_logs",
        "columns": ["user_id", "status", "timestamp"],
    },
    # 团队成员查询（团队 + 角色）
    {
        "name": "ix_team_members_team_role",
        "table": "team_members",
        "columns": ["team_id", "role"],
    },
    # 肽设计查询（用户 + 状态 + 时间排序）
    {
        "name": "ix_peptide_designs_user_status_created",
        "table": "peptide_designs",
        "columns": ["user_id", "status", "created_at"],
    },
    # 肽分析查询（用户 + 时间排序）
    {
        "name": "ix_peptide_analyses_user_created",
        "table": "peptide_analyses",
        "columns": ["user_id", "created_at"],
    },
    # 对话消息查询（会话 + 时间排序）
    {
        "name": "ix_chat_messages_session_timestamp",
        "table": "chat_messages",
        "columns": ["session_id", "timestamp"],
    },
    # 对话会话查询（用户 + 活跃状态 + 时间排序）
    {
        "name": "ix_chat_sessions_user_active_created",
        "table": "chat_sessions",
        "columns": ["user_id", "is_active", "created_at"],
    },
    # 配方版本查询（配方 + 版本号）
    {
        "name": "ix_formula_versions_formula_version",
        "table": "formula_versions",
        "columns": ["formula_id", "version"],
    },
    # 工作流任务查询（工作流 + 状态 + 步骤顺序）
    {
        "name": "ix_workflow_tasks_workflow_status_order",
        "table": "workflow_tasks",
        "columns": ["workflow_id", "status", "step_order"],
    },
]


def upgrade() -> None:
    """添加复合索引"""
    for idx in COMPOSITE_INDEXES:
        try:
            op.create_index(
                idx["name"],
                idx["table"],
                idx["columns"],
                if_not_exists=True
            )
        except Exception:
            pass


def downgrade() -> None:
    """删除复合索引"""
    for idx in COMPOSITE_INDEXES:
        try:
            op.drop_index(idx["name"], table_name=idx["table"], if_exists=True)
        except Exception:
            pass
