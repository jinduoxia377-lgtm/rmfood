"""
认证路由
登录、注册、刷新令牌、修改密码
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..schemas import (
    LoginRequest, Token, UserCreate, UserResponse, PasswordChange, UserUpdate,
    ApiResponse, SuccessResponse
)
from ..services.auth import AuthService, get_current_user
from ..models.user_model import User
from ..models.enums import UserRole
from ..api.deps import get_db_session, CurrentUser, DbSession, require_role

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login", response_model=Token, summary="用户登录")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db_session)):
    """用户名密码登录，返回 access_token 和 refresh_token"""
    service = AuthService(db)
    return await service.authenticate(data.username, data.password)


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
    data: dict,
    db: AsyncSession = Depends(get_db_session),
):
    """使用 refresh_token 获取新的 token 对（POST body 传递）"""
    refresh_token_value = data.get("refresh_token")
    if not refresh_token_value:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="refresh_token 不能为空")
    service = AuthService(db)
    return await service.refresh_access_token(refresh_token_value)


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
    """上传当前用户头像"""
    # 验证文件类型
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只支持图片文件",
        )

    # 验证文件大小（2MB）
    file.file.seek(0, 2)  # 移动到文件末尾
    file_size = file.file.tell()
    file.file.seek(0)  # 重置到文件开头
    
    if file_size > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件大小不能超过2MB",
        )

    # 生成文件路径
    import os
    import uuid
    
    upload_dir = "uploads/avatars"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{current_user.id}_{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(upload_dir, filename)

    # 保存文件
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # 更新用户头像URL
    avatar_url = f"/uploads/avatars/{filename}"
    from ..services.user import UserService
    service = UserService(db)
    user = await service.update_user(
        current_user.id,
        UserUpdate(avatar_url=avatar_url)
    )

    return {"avatarUrl": avatar_url}
