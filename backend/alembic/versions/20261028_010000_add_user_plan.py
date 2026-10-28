"""add plan column to users table (免费/专业分割)

Revision ID: 20261028_010000_add_user_plan
Revises: 20261026_010000_bump_max_tokens_default
Create Date: 2026-10-28 10:40:00

规格: docs/tenant-isolation-segmentation-plan.md 3.3
- users 表新增列 plan VARCHAR(20) NOT NULL SERVER_DEFAULT 'free'
- 存量行回填 'free'

安全说明
--------
- 列级 SERVER_DEFAULT 'free' 保证此后所有新行（含未显式传 plan 的 INSERT）
  默认拿到 'free'，与模型层 User.plan default="free" 对齐。
- 存量行显式回填 'free'（幂等：WHERE plan IS NULL OR plan = ''，重复执行结果一致）。
- 仅加列 + 回填，无数据破坏；downgrade 仅 drop 列。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20261028_010000_add_user_plan'
down_revision: Union[str, None] = '20261026_010000_bump_max_tokens_default'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "plan",
            sa.String(length=20),
            server_default=sa.text("'free'"),
            nullable=False,
        ),
    )
    # 存量行回填 'free'（server_default 已覆盖新行；此处保证既有行为 'free'，幂等）
    conn = op.get_bind()
    conn.exec_driver_sql("UPDATE users SET plan = 'free' WHERE plan IS NULL OR plan = ''")


def downgrade() -> None:
    op.drop_column("users", "plan")
