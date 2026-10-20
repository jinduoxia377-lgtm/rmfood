"""RMFOOD 账号申请（预注册/白名单）模型

持久化登录页"账号申请"与白名单申请页通道的用户申请，供管理员在
"用户管理 → 账号申请" 队列中审核、通过（自动创建用户）或拒绝。

业务流程:
1. 登录页/白名单申请页提交 → POST /auth/whitelist/apply 或旧 POST /auth/pre-register
   → 插入 pre_register_requests（status=pending，source 标记来源）
2. 强制邮箱验证码（白名单通道）→ 验证通过后进入审核队列
3. 管理员查看队列 → GET /admin/pre-register-requests
4. 通过 → POST /admin/pre-register-requests/{id}/approve
   - 自动创建 User 记录（系统生成临时密码，通知用户首次登录修改）
   - 关联 user_id 回填，标记 status=approved
5. 拒绝 → POST /admin/pre-register-requests/{id}/reject
   - 标记 status=rejected + reject_reason，并设置 7 天冷却 cooldown_until
6. 审核超时 → 定时任务将 pending 且超过 review_deadline 的记录置为 expired

幂等: 同一邮箱 pending 唯一（部分唯一索引）；重复申请返回已有记录；
已注册邮箱直接提示"请直接登录"。
"""
from datetime import datetime
from sqlalchemy import (
    String, Text, DateTime, BigInteger, Index, SmallInteger, text,
)
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base
from app.models.utils import now_utc_mapped


class PreRegisterStatus:
    """申请状态（字符串枚举，避免依赖 enums 模块额外改动）"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class PreRegisterRequest(Base):
    __tablename__ = "pre_register_requests"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # ── 申请信息 ──
    email: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    full_name: Mapped[str | None] = mapped_column(String(100))
    department: Mapped[str | None] = mapped_column(String(100))
    apply_reason: Mapped[str | None] = mapped_column(Text, nullable=True, comment="申请理由（选填）")
    source: Mapped[str] = mapped_column(
        String(16), default="legacy", nullable=False,
        comment="申请来源: legacy / login / whitelist_page",
    )
    # ── 状态机 ──
    status: Mapped[str] = mapped_column(
        String(20), default=PreRegisterStatus.PENDING, nullable=False, index=True
    )
    # ── 邮箱验证码 ──
    verify_code_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    verify_code_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verify_code_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verify_attempts: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    # ── 冷却与防滥用 ──
    cooldown_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempt_count: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    status_token_hash: Mapped[str | None] = mapped_column(
        String(128), nullable=True, unique=True, index=True,
        comment="状态查询 token 的 SHA-256 哈希（明文仅申请成功时返回一次）",
    )
    # ── 审核 ──
    review_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    expired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
        # 同一邮箱仅允许一条 active(pending) 申请，防重复提交（清洗历史数据见迁移脚本）
        Index(
            "uq_pre_register_active_email", "email", unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
        Index("idx_pre_register_status_deadline", "status", "review_deadline"),
        Index("idx_pre_register_email_status", "email", "status"),
    )

    def __repr__(self) -> str:
        return (
            f"<PreRegisterRequest(id={self.id}, email={self.email!r}, "
            f"status={self.status})>"
        )