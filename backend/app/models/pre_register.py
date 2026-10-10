"""RMFOOD 账号申请（预注册）模型

持久化登录页"账号申请"通道的用户申请，供管理员在
"用户管理 → 账号申请" 队列中审核、通过（自动创建用户）或拒绝。

业务流程:
1. 登录页"申请开通账号"表单 → POST /auth/pre-register → 插入 pre_register_requests
2. 管理员查看队列 → GET /admin/pre-register-requests
3. 通过 → PATCH /admin/pre-register-requests/{id}/approve
   - 自动创建 User 记录（系统生成临时密码，通知用户首次登录修改）
   - 关联 user_id 回填，标记 status=approved
4. 拒绝 → PATCH /admin/pre-register-requests/{id}/reject
   - 标记 status=rejected + reject_reason

幂等: 同一邮箱重复申请时，若该邮箱已有 pending 申请则直接返回已有记录；
若已有 approved（用户已存在）则返回 duplicate=true 提示"该邮箱已开通账号"。
"""
from datetime import datetime
from sqlalchemy import (
    Integer, String, Text, DateTime, Enum as SAEnum,
    BigInteger, Index,
)
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base
from .enums import UserRole
from app.models.utils import now_utc_mapped


class PreRegisterStatus:
    """申请状态（字符串枚举，避免依赖 enums 模块额外改动）"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class PreRegisterRequest(Base):
    __tablename__ = "pre_register_requests"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # ── 申请信息 ──
    email: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    full_name: Mapped[str | None] = mapped_column(String(100))
    department: Mapped[str | None] = mapped_column(String(100))
    # ── 状态机 ──
    status: Mapped[str] = mapped_column(
        String(20), default=PreRegisterStatus.PENDING, nullable=False, index=True
    )
    # ── 审核信息 ──
    reviewed_by: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # ── 通过时回填 ──
    user_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, index=True,
        comment="通过审核并创建用户后回填的 User.id",
    )
    # ── 审计 ──
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False
    )

    __table_args__ = (
        Index("idx_pre_register_status_created", "status", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<PreRegisterRequest(id={self.id}, email={self.email!r}, "
            f"status={self.status})>"
        )
