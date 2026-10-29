"""
认证路由
登录、注册、刷新令牌、修改密码

🔒 P0 安全修复:
- ✅ JWT Token 使用 HttpOnly Cookie 存储（防止 XSS 窃取）
- ✅ Cookie 启用 Secure + SameSite 属性（CSRF/XSS 防护）
- ✅ Token 不再持久化在前端 localStorage
- ✅ 登录成功后同时返回 Token（兼容）和设置 Cookie
"""
import logging

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_db_session
from ..core.config import settings
from ..models.enums import UserRole
from ..models.user_model import User
from ..schemas import (
    DeleteAccountRequest,
    LoginRequest,
    PasswordChange,
    SuccessResponse,
    Token,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from ..services.auth import AuthService, get_current_user
from ..utils.auth import (
    create_secure_cookie_settings,
    get_cookie_value,
)

logger = logging.getLogger(__name__)

# 🔒 Cookie 名称常量
ACCESS_TOKEN_COOKIE = "rmfood_access_token"
REFRESH_TOKEN_COOKIE = "rmfood_refresh_token"

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login", summary="用户登录")
async def login(
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
):
    """
    用户名密码登录

    - 若用户启用了两步验证，且未提供动态验证码，返回 {"requires_2fa": true}
    - 提供正确验证码后返回 access_token / refresh_token 并设置 HttpOnly Cookie
    """
    service = AuthService(db)
    token_data = await service.authenticate(data.username, data.password, data.two_factor_code)

    # 2FA 二次验证：不发放令牌，不设置 Cookie
    if isinstance(token_data, dict) and token_data.get("requires_2fa"):
        return token_data

    # 登录响应携带用户 plan（规格 tenant-isolation-segmentation-plan.md 3.5）：
    # 前端登录后无需再单独拉取 /auth/me 即可拿到版本信息。
    # authenticate 内部已 commit（reset_login_attempts），user 属性已过期，
    # 故此处按 username 重新查一次 plan（仅取列，避免异步懒加载 MissingGreenlet）。
    user_plan = "free"
    try:
        plan_row = (
            await db.execute(select(User.plan).where(User.username == data.username))
        ).scalar_one_or_none()
        if plan_row:
            user_plan = plan_row
    except Exception:  # noqa: BLE001 - plan 读取失败不阻断登录，回落 free
        logger.warning("登录响应读取 user.plan 失败，回落 free: %s", data.username)
    login_payload = token_data.model_dump()
    login_payload["plan"] = user_plan

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

    return login_payload


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
    try:
        user = await service.register(
            username=data.username,
            email=data.email,
            password=data.password,
            full_name=data.full_name,
        )
        # 🔒 修复：service.register 内仅 flush（使 session.new 清空），
        # 依赖层的"session.dirty or session.new"条件提交会因此判定为假，
        # 导致事务回滚、新用户实际未持久化。这里必须显式提交。
        await db.commit()
        await db.refresh(user)
        return user
    except IntegrityError as e:
        # 并发/竞态下唯一约束冲突（用户名或邮箱重复）：回滚并返回 400，
        # 避免全局异常中间件将其包装为 503。
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名或邮箱已被注册",
        ) from e


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
        try:
            body = await request.json()
        except Exception:
            # 空 body / 非 JSON body：按空请求处理，由下方统一返回 400
            body = {}
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
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取当前登录用户的详细信息（含组织名，供前端 org-grant 判定）。"""
    result = UserResponse.model_validate(current_user)
    org_id = getattr(current_user, "organization_id", None)
    if org_id:
        from ..models.organization import Organization

        org = await db.get(Organization, org_id)
        if org is not None:
            result.organization_name = org.name
    return result


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


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., description="用户邮箱")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="重置令牌")
    new_password: str = Field(..., min_length=8, description="新密码")


@router.post("/forgot-password", response_model=SuccessResponse, summary="忘记密码")
async def forgot_password(
    req: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """发送密码重置邮件（通过 POST body 传递参数，避免 URL 日志泄露）"""
    service = AuthService(db)
    await service.forgot_password(req.email)
    return SuccessResponse(message="密码重置邮件已发送")


@router.post("/reset-password", response_model=SuccessResponse, summary="重置密码")
async def reset_password(
    req: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """使用令牌重置密码（通过 POST body 传递参数，避免 URL 日志泄露）"""
    service = AuthService(db)
    await service.reset_password(req.token, req.new_password)
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
        generate_secure_filename,
        validate_file_path,
        validate_image_file,
    )

    # 验证图片文件（魔数检测 + 大小限制）
    file_content, detected_mime = await validate_image_file(
        file,
        max_size=2 * 1024 * 1024,  # 2MB
    )

    # 生成安全的文件路径
    import os

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
    await service.update_user(
        current_user.id,
        UserUpdate(avatar_url=avatar_url)
    )

    return {"avatarUrl": avatar_url}


@router.post("/me/avatar/generate-real", summary="生成真实 AI 人物头像")
async def generate_real_avatar(
    current_user: User = Depends(get_current_user),
):
    """
    生成一张真实 AI 人物头像（StyleGAN2 在线服务）。

    设计说明：
    - 代理请求 https://thispersondoesnotexist.com/random-person.jpeg，
      每次返回一张 AI 生成的假人照片（JPEG）；
    - 仅返回图片字节（不写库），前端拿到图片后复用现有上传链路，
      由用户点击「保存修改」时通过 POST /auth/me/avatar 写入 avatar_url；
    - 使用现有魔数校验确保返回内容确为图片，并限制 2MB 大小。
    """
    import httpx
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            resp = await client.get(
                "https://thispersondoesnotexist.com/random-person.jpeg",
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/126.0 Safari/537.36"
                    )
                },
            )
            resp.raise_for_status()
            file_content = resp.content
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI 头像生成服务暂时不可用，请稍后重试",
        )

    if len(file_content) > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "FILE_TOO_LARGE", "message": "生成的头像文件过大"},
        )

    from ..utils.file_security import detect_mime_from_content
    detected_mime = detect_mime_from_content(file_content)
    if not detected_mime:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "INVALID_FILE_TYPE", "message": "生成的头像文件格式无效"},
        )

    return Response(content=file_content, media_type=detected_mime)


@router.delete("/me", response_model=SuccessResponse, summary="注销当前用户账户")
async def delete_me(
    data: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    注销当前用户账户（GDPR/个保法「被遗忘权」闭环）

    - 软删除 + 匿名化：is_active=False，用户名/邮箱改为 deleted_<id>
    - 清除个人资料、头像、2FA 密钥与全部设备会话
    - 管理员账户不允许自助注销（返回 403）
    """
    if data.confirm != "DELETE MY ACCOUNT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="确认文本不正确",
        )

    if current_user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="管理员账户不允许自助注销，请联系其他管理员处理",
        )

    from ..services.user import UserService
    service = UserService(db)
    await service.deactivate_account(current_user.id)

    return SuccessResponse(message="账户已注销，30 天内彻底清除数据")
