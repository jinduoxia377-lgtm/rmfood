"""为 users 表补齐资料扩展列与 2FA 列，为 user_devices 表补齐设备指纹列

背景:
- 设置页"账户"子模块表单含 position/bio/website/github/linkedin 五个扩展资料字段，
  但 users 表与 Pydantic schema 均无对应列 → PUT /auth/me 静默丢弃，保存后回显为空
- 设置页"安全"Tab 的 2FA 端点（user_settings.py）访问 User.two_factor_secret/
  two_factor_enabled，但表列从未落库 → enable/disable 会 AttributeError → 500
- 设置页设备列表需要标记"当前设备"，但 user_devices 表无指纹列
  （旧实现靠硬编码假数据兜底）→ 新增 device_fingerprint 供登录时注册

本次迁移:
- users 新增 7 列: position, bio, website, github, linkedin,
             two_factor_secret, two_factor_enabled
- user_devices 新增 1 列: device_fingerprint
- 全部 nullable，不锁表；down_revision 指向最新 head

Revision ID: 20260927_000000
Revises: 20260926_000000
Create Date: 2026-09-27
"""
from alembic import op
import sqlalchemy as sa

revision = "20260927_000000"
down_revision = "20260926_000000_fix_experiment_status_enum"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users 表: 资料扩展列 ──
    op.add_column("users", sa.Column("position", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("bio", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("website", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("github", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("linkedin", sa.String(length=255), nullable=True))
    # ── users 表: 2FA 列 ──
    op.add_column("users", sa.Column("two_factor_secret", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("two_factor_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    # ── user_devices 表: 设备指纹列（当前会话标记用）──
    op.add_column("user_devices", sa.Column("device_fingerprint", sa.String(length=128), nullable=True))
    op.create_index("ix_user_devices_device_fingerprint", "user_devices", ["device_fingerprint"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_devices_device_fingerprint", table_name="user_devices")
    op.drop_column("user_devices", "device_fingerprint")
    op.drop_column("users", "two_factor_enabled")
    op.drop_column("users", "two_factor_secret")
    op.drop_column("users", "linkedin")
    op.drop_column("users", "github")
    op.drop_column("users", "website")
    op.drop_column("users", "bio")
    op.drop_column("users", "position")
