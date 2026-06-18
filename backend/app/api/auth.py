"""
认证路由
登录、注册、刷新令牌、修改密码

🔒 P0 安全修复:
- ✅ JWT Token 使用 HttpOnly Cookie 存储（防止 XSS 窃取）
- ✅ Cookie 启用 Secure + SameSite 属性（CSRF/XSS 防护）
- ✅ Token 不再持久化在前端 localStorage
- ✅ 登录成功后同时返回 Token（兼容）和设置 Cookie
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..schemas import (
    LoginRequest, Token, UserCreate, UserResponse, PasswordChange, UserUpdate,
    ApiResponse, SuccessResponse
)
from ..services.auth import AuthService, get_current_user
from ..models.user_model import User
from ..models.enums import UserRole
from ..api.deps import get_db_session, CurrentUser, DbSession, require_role
from ..utils.auth import (
    create_secure_cookie_settings,
    get_cookie_value,
    clear_cookie_settings,
)
from ..core.config import settings

# 🔒 Cookie 名称常量
ACCESS_TOKEN_COOKIE = "rmfood_access_token"
REFRESH_TOKEN_COOKIE = "rmfood_refresh_token"

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login", response_model=Token, summary="用户登录")
async def login(
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
):
    """
    用户名密码登录

    🔒 P0 安全修复:
    - 返回 access_token 和 refresh_token（兼容旧客户端）
    - 同时设置 HttpOnly Cookie（防止 XSS 攻击）
    - Cookie 配置: Secure(生产) + HttpOnly + SameSite=Strict
    """
    service = AuthService(db)
    token_data = await service.authenticate(data.username, data.password)

    # 🔒 设置 HttpOnly Cookie（防止 XSS 窃取 JWT）
    # Access Token: 30分钟
    access_cookie = create_secure_cookie_settings(
        ACCESS_TOKEN_COOKIE,
        token_data.access_token,
        max_age_seconds=settings.security.jwt_expire_minutes * 60,
    )
    response.set_cookie(**access_cookie)

    # Refresh Token: 7天
    refresh_cookie = create_secure_cookie_settings(
        REFRESH_TOKEN_COOKIE,
        token_data.refresh_token,
        max_age_seconds=settings.security.jwt_refresh_expire_days * 24 * 60 * 60,
        is_refresh_token=True,
    )
    response.set_cookie(**refresh_cookie)

    return token_data


@router.post("/logout", summary="用户登出")
async def logout(
    response: Response,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    用户登出

    🔒 P0 安全修复:
    - 清除 HttpOnly Cookie
    - 将当前 Token 加入黑名单
    """
    from ..utils.auth import add_token_to_blacklist

    # 从请求中获取当前 token 并加入黑名单
    token = get_cookie_value(request.cookies, ACCESS_TOKEN_COOKIE)
    if token:
        add_token_to_blacklist(token)

    # 🔒 清除 Cookie
    response.delete_cookie(key=ACCESS_TOKEN_COOKIE)
    response.delete_cookie(key=REFRESH_TOKEN_COOKIE)

    return SuccessResponse(message="登出成功")


@router.post("/register", response_model=UserResponse, status_code=201, summary="用户注册")
async def register(data: UserCreate, db: AsyncSession = Depends(get_db_session)):
    """注册新用户，默认角色为 researcher"""
    service = AuthService(db)
    user = await service.register(
        username=data.username,
        email=data.email,
        password=data.password,
        full_name=data.full_name,
    )
    return user


@router.post("/refresh", response_model=Token, summary="刷新令牌")
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
):
    """
    使用 refresh_token 获取新的 token 对

    🔒 P0 安全修复:
    - 优先从 HttpOnly Cookie 读取 refresh_token（更安全）
    - 同时支持从请求体读取（向后兼容旧客户端）
    - 刷新后重新设置 Cookie
    """
    # 🔒 优先从 Cookie 读取 refresh_token
    refresh_token_value = get_cookie_value(request.cookies, REFRESH_TOKEN_COOKIE)

    # 如果 Cookie 中没有，尝试从请求体读取（向后兼容）
    if not refresh_token_value:
        body = await request.json()
        refresh_token_value = body.get("refresh_token")

    if not refresh_token_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="refresh_token 不能为空",
        )

    service = AuthService(db)
    token_data = await service.refresh_access_token(refresh_token_value)

    # 🔒 刷新后重新设置 Cookie
    access_cookie = create_secure_cookie_settings(
        ACCESS_TOKEN_COOKIE,
        token_data.access_token,
        max_age_seconds=settings.security.jwt_expire_minutes * 60,
    )
    response.set_cookie(**access_cookie)

    # Refresh Token 保持不变（仅更新过期时间）
    refresh_cookie = create_secure_cookie_settings(
        REFRESH_TOKEN_COOKIE,
        token_data.refresh_token,
        max_age_seconds=settings.security.jwt_refresh_expire_days * 24 * 60 * 60,
        is_refresh_token=True,
    )
    response.set_cookie(**refresh_cookie)

    return token_data


@router.get("/me", response_model=UserResponse, summary="获取当前用户信息")
async def get_me(current_user: User = Depends(get_current_user)):
    """获取当前登录用户的详细信息"""
    return current_user


@router.put("/password", response_model=SuccessResponse, summary="修改密码")
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """修改当前用户密码"""
    service = AuthService(db)
    await service.change_password(current_user.id, data.old_password, data.new_password)
    return SuccessResponse(message="密码修改成功")


@router.put("/me", response_model=UserResponse, summary="更新当前用户信息")
async def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """更新当前用户的个人信息（姓名、邮箱、手机、部门、头像等）"""
    from ..services.user import UserService
    service = UserService(db)
    return await service.update_user(current_user.id, data)


@router.post("/forgot-password", response_model=SuccessResponse, summary="忘记密码")
async def forgot_password(
    email: str,
    db: AsyncSession = Depends(get_db_session),
):
    """发送密码重置邮件"""
    service = AuthService(db)
    await service.forgot_password(email)
    return SuccessResponse(message="密码重置邮件已发送")


@router.post("/reset-password", response_model=SuccessResponse, summary="重置密码")
async def reset_password(
    token: str,
    new_password: str,
    db: AsyncSession = Depends(get_db_session),
):
    """使用令牌重置密码"""
    service = AuthService(db)
    await service.reset_password(token, new_password)
    return SuccessResponse(message="密码重置成功")


@router.post("/me/avatar", summary="上传当前用户头像")
async def upload_current_user_avatar(
    file: UploadFile = File(..., description="头像文件"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    上传当前用户头像

    🔒 P0 安全修复:
    - ✅ 魔数验证：检测文件真实类型，不信任客户端 Content-Type
    - ✅ 路径清洗：防止 ../ 路径遍历攻击
    - ✅ 文件大小限制：2MB 上限
    - ✅ MIME 类型白名单：仅允许安全图片格式
    - ✅ 安全文件名：UUID 替代原始文件名
    """
    # 🔒 使用安全的文件验证工具
    from ..utils.file_security import (
        validate_image_file,
        generate_secure_filename,
        validate_file_path,
    )

    # 验证图片文件（魔数检测 + 大小限制）
    file_content, detected_mime = await validate_image_file(
        file,
        max_size=2 * 1024 * 1024,  # 2MB
    )

    # 生成安全的文件路径
    import os
    import uuid

    upload_dir = "uploads/avatars"
    os.makedirs(upload_dir, exist_ok=True)

    # 🔒 使用 UUID 生成安全文件名
    filename = generate_secure_filename(detected_mime, file.filename)
    file_path = validate_file_path(upload_dir, filename)

    # 保存文件（限制文件权限为 600）
    with open(file_path, "wb") as f:
        f.write(file_content)
    os.chmod(file_path, 0o600)  # 仅所有者可读写

    # 更新用户头像URL
    avatar_url = f"/uploads/avatars/{filename}"
    from ..services.user import UserService
    service = UserService(db)
    user = await service.update_user(
        current_user.id,
        UserUpdate(avatar_url=avatar_url)
    )

    return {"avatarUrl": avatar_url}
