"""create ai_agent_workflow_executions

Revision ID: 20261102_000002
Revises: 20261102_000001
Create Date: 2026-11-02 15:35:00

P1-4：WorkflowEngine（Agent 工作流）执行记录持久化表。
轻量表：execution_id/workflow_type/user_id/tenant_id/status/output_json/created_at。
execute 写入、get_execution 读取（进程重启/多实例可追溯）。
"""
from alembic import op

revision = '20261102_000002'
down_revision = '20261102_000001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_agent_workflow_executions (
            id BIGSERIAL PRIMARY KEY,
            execution_id VARCHAR(64) NOT NULL UNIQUE,
            workflow_type VARCHAR(50) NOT NULL,
            user_id BIGINT NOT NULL DEFAULT 0,
            tenant_id BIGINT NOT NULL DEFAULT 1,
            status VARCHAR(20) NOT NULL DEFAULT 'running',
            output_json JSON DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ai_agent_workflow_executions_execution_id "
        "ON ai_agent_workflow_executions(execution_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ai_agent_workflow_executions_workflow_type "
        "ON ai_agent_workflow_executions(workflow_type)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ai_agent_workflow_executions_created_at "
        "ON ai_agent_workflow_executions(created_at)"
    )


def downgrade() -> None:
    # 幂等：不回滚（安全修复迁移）
    pass
