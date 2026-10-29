"""白名单申请流程 API

- GET  /auth/whitelist/captcha       获取人机验证码图片（Pillow 自托管）
- POST /auth/whitelist/apply        提交申请（人机验证 + 强制邮箱验证码）
- POST /auth/whitelist/verify-code  校验 6 位邮箱验证码
- POST /auth/whitelist/resend-code  60s 冷却重发验证码
- GET  /auth/whitelist/status       凭状态 token 查询申请状态

安全说明:
- 申请/重发/校验/验证码生成均按 IP 限流（Redis 滑动窗口优先，未启用时内存兜底）
- 人机验证码答案哈希入库（Redis 优先，内存兜底），5 分钟有效，一次性使用
- 邮箱验证码与状态 token 在 DB 中仅存哈希
- 429 响应体带 retry_after，响应头带 Retry-After
- 所有响应带 server_time（UTC），供前端倒计时差值计算
"""
import base64

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_db_session
from ..services import whitelist as whitelist_service
from ..utils.captcha import generate_captcha_image

router = APIRouter(prefix="/auth/whitelist", tags=["白名单申请"])


class WhitelistApplyRequest(BaseModel):
    email: EmailStr = Field(..., min_length=6, max_length=100, description="申请邮箱")
    full_name: str | None = Field(None, max_length=50, description="姓名（选填）")
    organization: str | None = Field(None, max_length=100, description="单位/部门（选填）")
    reason: str | None = Field(None, max_length=500, description="申请理由（选填）")
    source: str = Field("whitelist_page", pattern="^(whitelist_page|login)$", description="申请来源")
    lang: str = Field("zh-CN", pattern="^(zh-CN|en-US|de-DE)$", description="邮件语言")
    captcha_id: str = Field(..., min_length=8, max_length=64, description="人机验证码 ID")
    captcha_answer: str = Field(..., min_length=1, max_length=8, description="人机验证码答案")


class WhitelistVerifyCodeRequest(BaseModel):
    request_id: int = Field(..., description="申请 ID")
    code: str = Field(..., min_length=6, max_length=6, description="6 位邮箱验证码")


class WhitelistResendCodeRequest(BaseModel):
    request_id: int = Field(..., description="申请 ID")
    lang: str = Field("zh-CN", pattern="^(zh-CN|en-US|de-DE)$", description="邮件语言")


def _raise_error(err: dict) -> None:
    """将服务层错误 dict 转为 HTTPException。"""
    status = err.get("status", 400)
    detail = {k: v for k, v in err.items() if k != "status"}
    raise HTTPException(status_code=status, detail=detail)


@router.get("/captcha", summary="获取人机验证码")
async def whitelist_captcha(request: Request):
    """获取人机验证码图片（base64 data URI）与 captcha_id，提交申请时需回传答案。"""
    ip = request.client.host if request.client else None
    allowed, _ = await whitelist_service.allow_captcha(ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RATE_LIMITED",
                "message": "验证码获取过于频繁，请稍后再试",
                "retry_after": whitelist_service.IP_CAPTCHA_WINDOW,
            },
        )

    captcha_id, code = await whitelist_service.create_captcha()
    image_bytes = generate_captcha_image(code)
    image_base64 = base64.b64encode(image_bytes).decode("ascii")
    return {
        "captcha_id": captcha_id,
        "image_base64": f"data:image/png;base64,{image_base64}",
        "server_time": whitelist_service.utc_iso(whitelist_service._now()),
    }


@router.post("/apply", status_code=201, summary="提交白名单申请")
async def whitelist_apply(
    data: WhitelistApplyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    """提交白名单申请。需先通过人机验证；成功后向邮箱发送 6 位验证码。"""
    ip = request.client.host if request.client else None

    # 1. 人机验证（一次性，失败即删除）
    captcha_ok = await whitelist_service.validate_captcha(data.captcha_id, data.captcha_answer)
    if not captcha_ok:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_CAPTCHA",
                "message": "人机验证码错误或已过期，请重新获取",
            },
        )

    # 2. IP 限流
    allowed, _ = await whitelist_service.allow_apply(ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RATE_LIMITED",
                "message": "申请过于频繁，请稍后再试",
                "retry_after": whitelist_service.IP_APPLY_WINDOW,
            },
        )

    # 3. 创建申请
    result = await whitelist_service.create_application(
        db,
        email=data.email,
        full_name=data.full_name,
        department=data.organization,
        apply_reason=data.reason,
        source=data.source,
        ip=ip,
        require_verification=True,
        lang=data.lang,
    )
    if "error" in result:
        _raise_error(result["error"])

    return {
        "request_id": result["request_id"],
        "status_token": result["status_token"],
        "email_verified": result["email_verified"],
        "server_time": result["server_time"],
        "cooldown_until": result.get("cooldown_until"),
        "dev_verify_code": result.get("dev_verify_code"),
    }


@router.post("/verify-code", summary="校验邮箱验证码")
async def whitelist_verify_code(
    data: WhitelistVerifyCodeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    """校验 6 位邮箱验证码。成功后申请进入审核队列，前端可展示审核倒计时。"""
    ip = request.client.host if request.client else None
    allowed, _ = await whitelist_service.allow_verify(ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RATE_LIMITED",
                "message": "验证尝试过于频繁，请稍后再试",
                "retry_after": whitelist_service.IP_VERIFY_WINDOW,
            },
        )
    result = await whitelist_service.verify_application_code(
        db, request_id=data.request_id, code=data.code, ip=ip
    )
    if "error" in result:
        _raise_error(result["error"])
    return result


@router.post("/resend-code", summary="重发邮箱验证码")
async def whitelist_resend_code(
    data: WhitelistResendCodeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    """60s 冷却后重发验证码。"""
    ip = request.client.host if request.client else None
    allowed, _ = await whitelist_service.allow_resend(ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RATE_LIMITED",
                "message": "重发过于频繁，请稍后再试",
                "retry_after": whitelist_service.IP_RESEND_WINDOW,
            },
        )

    result = await whitelist_service.resend_application_code(
        db, request_id=data.request_id, ip=ip, lang=data.lang
    )
    if "error" in result:
        _raise_error(result["error"])
    return result


@router.get("/status", summary="查询白名单申请状态")
async def whitelist_status(
    token: str,
    db: AsyncSession = Depends(get_db_session),
):
    """凭申请成功时返回的状态 token 查询审核状态（防枚举）。"""
    result = await whitelist_service.get_application_status(db, token)
    if "error" in result:
        _raise_error(result["error"])
    return result
