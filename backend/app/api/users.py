"""
用户管理路由
用户 CRUD、角色管理（需管理员权限）
"""
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import PaginationParams, get_current_active_user, get_db_session
from ..models import User, UserRole
from ..schemas.user import UserCreate, UserResponse, UserUpdate
from ..services.auth import get_current_user, require_role
from ..services.user import UserService

router = APIRouter(prefix="/users", tags=["用户管理"])


@router.get("", response_model=dict, summary="获取用户列表")
async def list_users(
    pagination: PaginationParams = Depends(),
    role: Optional[str] = Query(None, description="按角色筛选"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """获取用户列表（管理员）"""
    service = UserService(db)
    users, total = await service.list_users(
        page=pagination.page,
        page_size=pagination.page_size,
        role=UserRole(role) if role else None,
        search=search,
    )
    # A-24：原直接把 SQLAlchemy 实体塞进 dict，而 response_model=dict 无法序列化
    #       任意对象 —— /api/v1/users 恒定 500。改为按 UserResponse 显式序列化。
    items = [UserResponse.model_validate(u).model_dump(mode="json") for u in users]

    # 补充用户所属组织（organization_members 聚合），用于用户管理"所属组织"列
    try:
        user_ids = [u["id"] for u in items]
        if user_ids:
            # 动态占位符（user_ids 均为 DB 整数，安全）；避免 asyncpg IN 数组兼容问题
            placeholders = ",".join([f":uid_{i}" for i in range(len(user_ids))])
            params = {f"uid_{i}": uid for i, uid in enumerate(user_ids)}
            rows = (await db.execute(
                text(f"""
                    SELECT om.user_id, o.id AS org_id, o.name AS org_name, om.role AS org_role
                    FROM organization_members om
                    JOIN organizations o ON om.organization_id = o.id
                    WHERE om.user_id IN ({placeholders}) AND o.is_active = TRUE
                    ORDER BY o.id ASC
                """),
                params,
            )).fetchall()
            org_map: dict[int, list[dict]] = {}
            for r in rows:
                org_map.setdefault(r.user_id, []).append({
                    "id": r.org_id,
                    "name": r.org_name,
                    "role": r.org_role,
                })
            for item in items:
                orgs = org_map.get(item["id"], [])
                item["organizations"] = orgs
                if not item.get("organization_name") and orgs:
                    item["organization_name"] = orgs[0]["name"]
                if not item.get("organization_id") and orgs:
                    item["organization_id"] = orgs[0]["id"]
        else:
            for item in items:
                item["organizations"] = []
    except Exception:
        # 聚合失败不应影响用户列表主流程
        for item in items:
            item.setdefault("organizations", [])

    return {
        "items": items,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
    }


@router.get("/{user_id}", response_model=UserResponse, summary="获取用户详情")
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """获取单个用户详情（仅本人或管理员）"""
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="无权查看其他用户资料")
    service = UserService(db)
    return await service.get_user(user_id)


@router.post("", response_model=UserResponse, status_code=201, summary="创建用户")
async def create_user(
    data: UserCreate,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """创建新用户（管理员）"""
    service = UserService(db)
    return await service.create_user(data)


@router.put("/{user_id}", response_model=UserResponse, summary="更新用户信息")
async def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """更新用户信息（仅本人或管理员）"""
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="无权修改其他用户资料")
    service = UserService(db)
    return await service.update_user(user_id, data)


@router.put("/{user_id}/role", response_model=UserResponse, summary="修改用户角色")
async def update_user_role(
    user_id: int,
    role: UserRole,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """修改用户角色（管理员）"""
    service = UserService(db)
    return await service.update_user_role(user_id, role)


@router.delete("/{user_id}", summary="停用用户")
async def deactivate_user(
    user_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    """停用用户（管理员）"""
    service = UserService(db)
    await service.deactivate_user(user_id)
    return {"message": "用户已停用"}


@router.post("/{user_id}/avatar", summary="上传用户头像")
async def upload_avatar(
    user_id: int,
    file: UploadFile = File(..., description="头像文件"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """上传用户头像"""
    # 只允许用户上传自己的头像或管理员上传任何用户头像
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限操作",
        )

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
    filename = f"{user_id}_{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(upload_dir, filename)

    # 保存文件
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # 更新用户头像URL
    avatar_url = f"/uploads/avatars/{filename}"
    service = UserService(db)
    user = await service.update_user(
        user_id,
        UserUpdate(avatar_url=avatar_url)
    )

    return {"avatar_url": avatar_url}
