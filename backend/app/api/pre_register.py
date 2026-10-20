"""
预注册路由（兼容别名）
邮箱预注册申请（自助注册暂未开放，需管理员开通账号）

v2 (2026-10-08): 持久化到 pre_register_requests 表，供管理员在
"用户管理 → 账号申请" 队列中审核/通过/拒绝。

v3 (2026-10-19): 改为白名单申请服务的兼容别名 ——
内部复用 /auth/whitelist/apply 的业务逻辑，但:
- source = "legacy"（标记历史通道来源）
- 不强制邮箱验证码（保持旧客户端行为不变，直接进入审核队列）

前端新通道请使用 /auth/whitelist/* 系列端点。
"""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_db_session
from ..services import whitelist as whitelist_service

router = APIRouter(prefix="/auth", tags=["认证"])


class PreRegisterRequestModel(BaseModel):
    email: EmailStr = Field(..., min_length=6, max_length=100, description="工作邮箱")
    full_name: str | None = Field(None, max_length=50, description="姓名（可选）")
    department: str | None = Field(None, max_length=100, description="部门/单位（可选）")


class PreRegisterResponse(BaseModel):
    message: str
    email: str
    duplicate: bool = False
    request_id: int | None = None


@router.post("/pre-register", response_model=PreRegisterResponse, status_code=201, summary="邮箱预注册申请（兼容别名）")
async def pre_register(
    data: PreRegisterRequestModel,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    """
    邮箱预注册申请（兼容别名，内部转发到白名单申请服务）。

    业务流程:
    1. 校验邮箱格式（EmailStr）
    2. 幂等检查（已注册/已有 pending 申请/冷却中）
    3. 插入新申请记录（source=legacy，不强制邮箱验证码，保持旧行为）
    4. 返回成功，前端提示"申请已提交，请联系管理员开通账号"

    安全说明:
    - 不创建用户记录（避免注入未审核账号），仅入申请队列
    - 邮箱作为唯一业务键，重复申请幂等
    """
    import logging
    logger = logging.getLogger("audit.pre_register")

    email_norm = data.email.strip().lower()
    ip = request.client.host if request.client else None

    result = await whitelist_service.create_application(
        db,
        email=data.email,
        full_name=data.full_name,
        department=data.department,
        source="legacy",
        ip=ip,
        require_verification=False,
        lang="zh-CN",
    )

    error = result.get("error")
    if error:
        code = error.get("code")
        if code == "EMAIL_REGISTERED":
            logger.info("[AUDIT] pre-register duplicate(user) email=%s", email_norm)
            return PreRegisterResponse(
                message="该邮箱已开通账号，请直接登录",
                email=email_norm,
                duplicate=True,
            )
        if code == "ALREADY_APPLIED":
            logger.info(
                "[AUDIT] pre-register duplicate(pending) email=%s request_id=%s",
                email_norm, error.get("request_id"),
            )
            return PreRegisterResponse(
                message="该邮箱已提交过预注册申请，请等待管理员审核",
                email=email_norm,
                duplicate=True,
                request_id=error.get("request_id"),
            )
        if code == "COOLDOWN":
            logger.info("[AUDIT] pre-register cooldown email=%s", email_norm)
            return PreRegisterResponse(
                message="申请过于频繁，请冷却期结束后再试",
                email=email_norm,
                duplicate=True,
            )

    logger.info(
        "[AUDIT] pre-register new email=%s name=%s department=%s request_id=%s ip=%s",
        email_norm,
        data.full_name or "-",
        data.department or "-",
        result.get("request_id"),
        ip or "-",
    )

    return PreRegisterResponse(
        message="账号申请已提交，管理员将尽快审核开通",
        email=email_norm,
        duplicate=False,
        request_id=result.get("request_id"),
    )