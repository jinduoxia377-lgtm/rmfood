"""
OAuth2 密码流认证端点（增强版）

功能:
- POST /api/v1/auth/login - 用户登录
- POST /api/v1/auth/refresh - 刷新Token
- POST /api/v1/auth/logout - 登出（将Token加入黑名单）

安全特性:
- IP限流（防止暴力破解）
- 账号锁定机制集成
- Token黑名单（强制登出）
- 多设备登录支持
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..core.database.session import get_db
from ..models.user_model import User
from ..models.enums import UserRole
from ..schemas.user import Token
from ..utils.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
    get_password_hash,
    validate_password_strength,
    add_token_to_blacklist,
    check_rate_limit,
    clear_rate_limit,
)
from ..core.security.account_lockout import AccountLockout

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/oauth2", tags=["OAuth2 认证"])


# ── 请求/响应模型 ──

class LoginRequest(BaseModel):
    """登录请求"""
    username: str = Field(..., min_length=2, max_length=50, description="用户名")
    password: str = Field(..., min_length=1, description="密码")


class RefreshTokenRequest(BaseModel):
    """刷新Token请求"""
    refresh_token: str = Field(..., description="刷新令牌")


class LogoutRequest(BaseModel):
    """登出请求"""
    refresh_token: Optional[str] = Field(None, description="要注销的刷新令牌（可选）")


class RegisterRequest(BaseModel):
    """注册请求"""
    username: str = Field(..., min_length=2, max_length=50, description="用户名")
    email: str = Field(..., description="邮箱地址")
    password: str = Field(..., min_length=8, description="密码（至少8位，包含大小写字母和数字）")
    full_name: Optional[str] = Field(None, max_length=100, description="真实姓名")


class TokenResponse(BaseModel):
    """Token响应"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access_token过期时间（秒）


class MessageResponse(BaseModel):
    """通用消息响应"""
    message: str
    detail: Optional[str] = None


# ── 端点实现 ──

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="用户登录（OAuth2密码流）",
    responses={
        200: {"description": "登录成功", "model": TokenResponse},
        401: {"description": "用户名或密码错误"},
        423: {"description": "账号已被锁定"},
        429: {"description": "请求过于频繁，触发限流"},
    },
)
async def login(
    request: Request,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    OAuth2 密码流登录端点

    安全流程:
    1. 检查IP限流（每分钟最多10次尝试）
    2. 检查账号锁定状态
    3. 验证用户名和密码
    4. 生成Access Token + Refresh Token
    5. 记录设备信息（支持多设备）

    返回:
    - access_token: 短期访问令牌（15分钟）
    - refresh_token: 长期刷新令牌（7天）
    - expires_in: access_token剩余有效时间（秒）
    """
    # 获取客户端IP
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"收到登录请求: 用户={data.username}, IP={client_ip}")

    # ── Step 1: 检查IP限流 ──
    is_allowed, remaining_attempts = check_rate_limit(
        ip_address=client_ip,
        max_attempts=getattr(settings.security, 'max_login_attempts_per_ip', 10),
        window_seconds=60,
    )

    if not is_allowed:
        logger.warning(f"IP {client_ip} 触发登录限流")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error_code": "RATE_LIMIT_EXCEEDED",
                "message": "登录请求过于频繁，请稍后重试",
                "hint": f"每IP每分钟最多{getattr(settings, 'max_login_attempts_per_ip', 10)}次尝试",
                "retry_after": 60,
            },
            headers={"Retry-After": "60"},
        )

    # ── Step 2: 初始化账号锁定管理器并检查 ──
    lockout = AccountLockout(
        max_attempts=settings.security.max_login_attempts,
        lockout_duration_minutes=settings.security.lockout_duration_minutes,
    )

    is_locked, lock_info = await lockout.is_account_locked(db, data.username)

    if is_locked:
        logger.warning(f"账号 {data.username} 已被锁定 (IP={client_ip})")
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=lockout.get_lockout_response(lock_info),
        )

    # ── Step 3: 查询用户并验证密码 ──
    result = await db.execute(
        select(User).where(User.username == data.username)
    )
    user = result.scalar_one_or_none()

    # ── Step 3a: 登录失败处理 ──
    if not user or not verify_password(data.password, user.hashed_password):
        # 记录失败尝试
        attempt_result = await lockout.record_failed_attempt(db, data.username, client_ip)

        if attempt_result.get("locked"):
            logger.error(f"账号 {data.username} 因暴力破解被锁定 (IP={client_ip})")
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail={
                    "detail": "账号已被临时锁定",
                    "error_code": "ACCOUNT_LOCKED",
                    "locked": True,
                    "message": attempt_result["message"],
                }
            )
        else:
            logger.warning(
                f"登录失败: {data.username} (IP={client_ip}), "
                f"剩余尝试次数: {attempt_result['remaining_attempts']}"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=attempt_result["message"],
                headers={"X-Remaining-Attempts": str(attempt_result['remaining_attempts'])},
            )

    # ── Step 3b: 检查账户状态 ──
    if not user.is_active:
        logger.warning(f"禁用账户尝试登录: {data.username} (IP={client_ip})")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账户已被禁用，请联系管理员",
        )

    # ── Step 4: 登录成功处理 ──
    # 重置账号锁定计数器
    await lockout.reset_login_attempts(db, user)
    # 清除IP限流记录
    clear_rate_limit(client_ip)

    # 更新最后登录时间
    user.last_login = datetime.now(timezone.utc)
    user.login_attempts = 0
    await db.flush()

    # 生成Token
    access_token = create_access_token({
        "sub": str(user.id),
        "role": user.role.value,
        "username": user.username,
    })
    refresh_token = create_refresh_token(str(user.id))

    logger.info(
        f"✅ 登录成功: {user.username} (ID={user.id}, 角色={user.role.value}, IP={client_ip})"
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.security.jwt_expire_minutes * 60,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="刷新访问令牌",
    responses={
        200: {"description": "刷新成功", "model": TokenResponse},
        401: {"description": "无效或过期的Refresh Token"},
    },
)
async def refresh_token(
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    使用 Refresh Token 获取新的 Access Token

    流程:
    1. 解码并验证Refresh Token
    2. 确认Token类型为refresh
    3. 查询用户是否存在且活跃
    4. 生成新的Token对

    注意:
    - 每次刷新都会生成新的Refresh Token（旧Token自动失效）
    - 如果旧Token在黑名单中，会拒绝请求
    """
    try:
        payload = decode_token(data.refresh_token)

        # 验证Token类型
        if payload.get("type") != "refresh":
            logger.warning("使用非Refresh Token进行刷新操作")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="请使用刷新令牌进行此操作",
            )

        # 查询用户
        user_id = payload["sub"]
        result = await db.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            logger.warning(f"Refresh Token对应的用户不存在或已禁用: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在或已被禁用",
            )

        # 将旧的Refresh Token加入黑名单（单次使用）
        add_token_to_blacklist(data.refresh_token)

        # 生成新的Token对
        new_access_token = create_access_token({
            "sub": str(user.id),
            "role": user.role.value,
            "username": user.username,
        })
        new_refresh_token = create_refresh_token(str(user.id))

        logger.info(f"Token刷新成功: 用户ID={user_id}")

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=settings.security.jwt_expire_minutes * 60,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token刷新失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="令牌刷新失败，请重新登录",
        )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="用户登出",
    responses={
        200: {"description": "登出成功"},
        401: {"description": "未提供有效的认证信息"},
    },
)
async def logout(
    request: Request,
    data: Optional[LogoutRequest] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    用户登出（将Token加入黑名单）

    功能:
    - 将提供的Refresh Token加入黑名单
    - 支持同时注销多个设备
    - 黑名单中的Token将被拒绝访问

    可选参数:
    - refresh_token: 要注销的刷新令牌（如果提供）
    - Authorization header中的Access Token也会被加入黑名单
    """
    blacklisted_count = 0

    # 处理Authorization头中的Access Token
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        access_token = auth_header[7:]  # 去掉"Bearer "前缀
        if add_token_to_blacklist(access_token):
            blacklisted_count += 1
            logger.debug("Access Token已加入黑名单")

    # 处理请求体中的Refresh Token
    if data and data.refresh_token:
        if add_token_to_blacklist(data.refresh_token):
            blacklisted_count += 1
            logger.debug("Refresh Token已加入黑名单")

    logger.info(f"用户登出成功，已注销 {blacklisted_count} 个Token")

    return MessageResponse(
        message="登出成功",
        detail=f"已注销 {blacklisted_count} 个认证令牌",
    )


@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=201,
    summary="用户注册",
    responses={
        201: {"description": "注册成功"},
        400: {"description": "用户名已存在或密码不符合要求"},
    },
)
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    注册新用户（带密码强度验证）

    要求:
    - 用户名：2-50个字符
    - 密码：至少8位，包含大小写字母+数字
    - 邮箱：唯一且格式正确
    """
    # ── 密码强度验证 ──
    is_strong, error_msg = validate_password_strength(data.password)
    if not is_strong:
        logger.warning(f"注册失败：密码强度不足 ({data.username})")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "WEAK_PASSWORD",
                "message": error_msg,
                "hint": "密码需要至少8位，包含大写字母、小写字母和数字",
            },
        )

    # ── 检查用户名唯一性 ──
    existing_user = await db.execute(
        select(User).where(User.username == data.username)
    )
    if existing_user.scalar_one_or_none():
        logger.warning(f"注册失败：用户名已存在 ({data.username})")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在，请选择其他用户名",
        )

    # ── 检查邮箱唯一性 ──
    existing_email = await db.execute(
        select(User).where(User.email == data.email)
    )
    if existing_email.scalar_one_or_none():
        logger.warning(f"注册失败：邮箱已被注册 ({data.email})")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被注册，请使用其他邮箱或找回密码",
        )

    # ── 创建用户 ──
    hashed_pwd = get_password_hash(data.password)
    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hashed_pwd,
        full_name=data.full_name,
        role=UserRole.RESEARCHER,
        is_active=True,
    )

    db.add(user)
    await db.flush()

    logger.info(f"✅ 新用户注册成功: {user.username} (ID={user.id})")

    return MessageResponse(
        message="注册成功",
        detail=f"欢迎加入RMFOOD配方设计平台！您的账户 {user.username} 已创建",
    )


# ── 兼容性端点（OAuth2标准格式） ──

@router.post(
    "/token",
    response_model=TokenResponse,
    summary="OAuth2标准Token端点（表单格式）",
)
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    OAuth2 标准的 /token 端点（application/x-www-form-urlencoded 格式）

    用于标准的OAuth2客户端（如Swagger UI、Postman等）
    请求格式: grant_type=password&username=xxx&password=xxx
    """
    login_data = LoginRequest(username=form_data.username, password=form_data.password)
    return await login(request, login_data, db)
