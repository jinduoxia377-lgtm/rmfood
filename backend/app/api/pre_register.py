"""
预注册路由
邮箱预注册申请（自助注册暂未开放，需管理员开通账号）

v2 (2026-10-08): 持久化到 pre_register_requests 表，供管理员在
"用户管理 → 账号申请" 队列中审核/通过/拒绝。
"""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..api.deps import get_db_session
from ..models.user_model import User
from ..models.pre_register import PreRegisterRequest, PreRegisterStatus

router = APIRouter(prefix="/auth", tags=["认证"])


class PreRegisterRequestModel(BaseModel):
    email: EmailStr = Field(..., min_length=6, max_length=100, description="工作邮箱")
    # 可选：留联系方式便于管理员开通后通知
    full_name: str | None = Field(None, max_length=50, description="姓名（可选）")
    department: str | None = Field(None, max_length=100, description="部门/单位（可选）")


class PreRegisterResponse(BaseModel):
    message: str
    email: str
    duplicate: bool = False
    request_id: int | None = None


@router.post("/pre-register", response_model=PreRegisterResponse, status_code=201, summary="邮箱预注册申请")
async def pre_register(
    data: PreRegisterRequestModel,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    """
    邮箱预注册申请（持久化到 pre_register_requests 队列）

    业务流程:
    1. 校验邮箱格式（EmailStr）
    2. 幂等检查:
       - 该邮箱已有 User 记录 → 返回 duplicate=true（"该邮箱已开通账号"）
       - 该邮箱已有 pending 申请 → 返回已有 request_id（"申请已提交"）
       - 否则 → 插入新申请记录
    3. 审计日志
    4. 返回成功，前端提示"申请已提交，请联系管理员开通账号"

    安全说明:
    - 不创建用户记录（避免注入未审核账号），仅入申请队列
    - 邮箱作为唯一业务键，重复申请幂等
    - CSRF: 该端点由前端双提交保护机制自动携带 csrf_token cookie + X-CSRF-Token 头
    """
    import logging
    logger = logging.getLogger("audit.pre_register")

    email_norm = data.email.strip().lower()
    ip = request.client.host if request.client else None

    # ── 幂等检查 1: 邮箱是否已绑定用户 ──
    existing_user = (
        await db.execute(select(User.id).where(User.email == email_norm))
    ).scalar_one_or_none()
    if existing_user is not None:
        logger.info(
            "[AUDIT] pre-register duplicate(user) email=%s", email_norm,
        )
        return PreRegisterResponse(
            message="该邮箱已开通账号，请直接登录",
            email=email_norm,
            duplicate=True,
        )

    # ── 幂等检查 2: 邮箱是否已有 pending 申请 ──
    existing_request = (
        await db.execute(
            select(PreRegisterRequest).where(
                PreRegisterRequest.email == email_norm,
                PreRegisterRequest.status == PreRegisterStatus.PENDING,
            ).order_by(PreRegisterRequest.created_at.desc()).limit(1)
        )
    ).scalar_one_or_none()
    if existing_request is not None:
        logger.info(
            "[AUDIT] pre-register duplicate(pending) email=%s request_id=%s",
            email_norm, existing_request.id,
        )
        return PreRegisterResponse(
            message="该邮箱已提交过预注册申请，请等待管理员审核",
            email=email_norm,
            duplicate=True,
            request_id=existing_request.id,
        )

    # ── 插入新申请 ──
    new_request = PreRegisterRequest(
        email=email_norm,
        full_name=(data.full_name or "").strip() or None,
        department=(data.department or "").strip() or None,
        status=PreRegisterStatus.PENDING,
        ip_address=ip,
    )
    db.add(new_request)
    await db.commit()
    await db.refresh(new_request)

    logger.info(
        "[AUDIT] pre-register new email=%s name=%s department=%s request_id=%s ip=%s",
        email_norm,
        new_request.full_name or "-",
        new_request.department or "-",
        new_request.id,
        ip or "-",
    )

    return PreRegisterResponse(
        message="账号申请已提交，管理员将尽快审核开通",
        email=email_norm,
        duplicate=False,
        request_id=new_request.id,
    )
