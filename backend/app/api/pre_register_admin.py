"""
账号申请（预注册）管理 API — 管理员端
=========================================
对应登录页"申请开通账号"通道（POST /auth/pre-register）的后台管理。

业务流程:
  1. 登录页提交 → 入 pre_register_requests 队列（status=pending）
  2. 管理员 GET /admin/pre-register-requests 查看申请队列
  3. 通过 → PATCH /admin/pre-register-requests/{id}/approve
       - 系统生成临时密码（随机 12 位）
       - 创建 User 记录（默认 role=VIEWER，管理员可后续改角色）
       - 回填 user_id，标记 status=approved
  4. 拒绝 → PATCH /admin/pre-register-requests/{id}/reject
       - 标记 status=rejected + reject_reason

权限要求: ADMIN 角色 + USER_READ / USER_CREATE 细粒度权限
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_db_session, get_current_active_user, require_role
from ..models.models import User, UserRole
from ..models.pre_register import PreRegisterRequest, PreRegisterStatus
from ..core.rbac.permission import PermissionChecker, Permission
from ..services.auth import get_password_hash
import secrets
import string


def _generate_temp_password(length: int = 12) -> str:
    """生成 12 位临时密码（含大小写字母 + 数字 + 特殊字符各至少 1 位）"""
    if length < 8:
        length = 8
    alphabet = string.ascii_letters + string.digits + "!@#$"
    # 保证至少各 1 位
    chars = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$"),
    ]
    chars += [secrets.choice(alphabet) for _ in range(length - len(chars))]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


router = APIRouter(prefix="/admin/pre-register-requests", tags=["账号申请管理"])


# ═══════════════════════════════════════
# Schemas
# ═══════════════════════════════════════

class PreRegisterRequestOut(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    department: Optional[str]
    status: str
    reviewed_by: Optional[int]
    reviewed_at: Optional[datetime]
    reject_reason: Optional[str]
    user_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PreRegisterListResponse(BaseModel):
    items: list[PreRegisterRequestOut]
    total: int
    page: int
    page_size: int
    status_counts: dict[str, int] = {}


class ApproveRequest(BaseModel):
    role: str = Field("researcher", description="创建的用户角色: guest/researcher/formulator/reviewer/admin（默认 researcher）")
    password: Optional[str] = Field(None, min_length=8, max_length=100, description="可选：指定初始密码，缺省则由系统生成临时密码")


class ApproveResponse(BaseModel):
    detail: str
    user_id: int
    username: str
    temp_password: Optional[str] = None  # 仅在系统生成临时密码时返回，供管理员转告用户


class RejectRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500, description="拒绝原因（可选）")


class RejectResponse(BaseModel):
    detail: str


# ═══════════════════════════════════════
# 1. 申请队列列表
# ═══════════════════════════════════════

@router.get("", response_model=PreRegisterListResponse, summary="账号申请队列（管理员）")
async def list_pre_register_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, description="状态过滤: pending / approved / rejected"),
    search: str | None = Query(None, description="搜索邮箱/姓名/部门"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    分页查看账号申请队列。
    - 默认按创建时间倒序
    - 返回 status_counts 供前端 Tab 角标
    """
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_READ)

    # 状态计数（供前端 Tab 角标）
    status_counts: dict[str, int] = {}
    for s in (PreRegisterStatus.PENDING, PreRegisterStatus.APPROVED, PreRegisterStatus.REJECTED):
        cnt = (await db.execute(
            select(func.count()).select_from(PreRegisterRequest).where(PreRegisterRequest.status == s)
        )).scalar() or 0
        status_counts[s] = int(cnt)

    query = select(PreRegisterRequest)
    count_query = select(func.count()).select_from(PreRegisterRequest)

    if status and status in (PreRegisterStatus.PENDING, PreRegisterStatus.APPROVED, PreRegisterStatus.REJECTED):
        query = query.where(PreRegisterRequest.status == status)
        count_query = count_query.where(PreRegisterRequest.status == status)

    if search:
        like_pattern = f"%{search}%"
        cond = or_(
            PreRegisterRequest.email.ilike(like_pattern),
            PreRegisterRequest.full_name.ilike(like_pattern),
            PreRegisterRequest.department.ilike(like_pattern),
        )
        query = query.where(cond)
        count_query = count_query.where(cond)

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(PreRegisterRequest.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    return PreRegisterListResponse(
        items=[PreRegisterRequestOut.model_validate(r) for r in items],
        total=int(total),
        page=page,
        page_size=page_size,
        status_counts=status_counts,
    )


# ═══════════════════════════════════════
# 2. 通过申请 → 自动创建用户
# ═══════════════════════════════════════

@router.post("/{request_id}/approve", response_model=ApproveResponse, summary="通过申请并开通账号（管理员）")
async def approve_pre_register_request(
    request_id: int,
    data: ApproveRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    通过账号申请 → 自动创建 User 记录。

    规则:
    - 仅 pending 状态可申请通过
    - 用户名生成: 邮箱 @ 前缀（小写），若已被占用则追加随机 4 位数字后缀
    - 密码: 指定 password 则使用，否则系统生成 12 位临时密码（返回给管理员转告用户）
    - 角色: 默认 viewer，可指定
    - 回填 user_id，status=approved，reviewed_by/reviewed_at 记录审核人
    """
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_CREATE)

    req = (await db.execute(
        select(PreRegisterRequest).where(PreRegisterRequest.id == request_id)
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(404, detail="申请不存在")
    if req.status != PreRegisterStatus.PENDING:
        raise HTTPException(400, detail=f"申请当前状态为 {req.status}，仅 pending 可审核")

    # 邮箱冲突检查
    existing = (await db.execute(
        select(User.id).where(User.email == req.email)
    )).scalar_one_or_none()
    if existing is not None:
        req.status = PreRegisterStatus.APPROVED
        req.user_id = existing
        req.reviewed_by = current_user.id
        req.reviewed_at = datetime.now(timezone.utc)
        await db.commit()
        raise HTTPException(409, detail=f"该邮箱已存在用户 (user_id={existing})，已标记为通过")

    # 角色校验 — UserRole 实际枚举: guest/researcher/formulator/reviewer/admin
    ROLE_MAP = {
        "guest": UserRole.GUEST,
        "researcher": UserRole.RESEARCHER,
        "formulator": UserRole.FORMULATOR,
        "reviewer": UserRole.REVIEWER,
        "admin": UserRole.ADMIN,
    }
    if data.role not in ROLE_MAP:
        raise HTTPException(400, detail=f"无效角色: {data.role}")
    target_role = ROLE_MAP[data.role]

    # 用户名生成: 邮箱 @ 前缀，冲突时追加随机数字
    base_username = req.email.split("@")[0].lower()[:32]
    username = base_username
    for _ in range(5):
        dup = (await db.execute(
            select(User.id).where(User.username == username)
        )).scalar_one_or_none()
        if dup is None:
            break
        import random
        username = f"{base_username}{random.randint(1000, 9999)}"
    else:
        username = f"{base_username}{datetime.now().strftime('%H%M%S')}"

    # 密码: 指定则用指定值，否则系统生成 12 位临时密码（返回给管理员转告用户）
    temp_password = None
    if data.password:
        final_password = data.password
    else:
        final_password = _generate_temp_password(12)
        temp_password = final_password

    from ..services.auth import get_password_hash
    hashed = get_password_hash(final_password)

    user = User(
        username=username,
        email=req.email,
        hashed_password=hashed,
        full_name=req.full_name or base_username,
        role=target_role,
        department=req.department,
        is_active=True,
    )
    db.add(user)
    await db.flush()  # 获取 user.id

    # 回填申请记录
    req.status = PreRegisterStatus.APPROVED
    req.user_id = user.id
    req.reviewed_by = current_user.id
    req.reviewed_at = datetime.now(timezone.utc)

    # 审计
    import logging
    logger = logging.getLogger("audit.pre_register")
    logger.info(
        "[AUDIT] pre-register approve id=%s email=%s user_id=%s role=%s operator=%s",
        request_id, req.email, user.id, target_role.value, current_user.username,
    )

    await db.commit()

    return ApproveResponse(
        detail=f"账号已开通: {username} ({req.email})",
        user_id=user.id,
        username=username,
        temp_password=temp_password,  # 管理员需将此密码转告用户首次登录
    )


# ═══════════════════════════════════════
# 3. 拒绝申请
# ═══════════════════════════════════════

@router.post("/{request_id}/reject", response_model=RejectResponse, summary="拒绝申请（管理员）")
async def reject_pre_register_request(
    request_id: int,
    data: RejectRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """拒绝账号申请，标记 status=rejected + reject_reason"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_UPDATE)

    req = (await db.execute(
        select(PreRegisterRequest).where(PreRegisterRequest.id == request_id)
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(404, detail="申请不存在")
    if req.status != PreRegisterStatus.PENDING:
        raise HTTPException(400, detail=f"申请当前状态为 {req.status}，仅 pending 可拒绝")

    req.status = PreRegisterStatus.REJECTED
    req.reject_reason = (data.reason or "").strip() or None
    req.reviewed_by = current_user.id
    req.reviewed_at = datetime.now(timezone.utc)

    import logging
    logger = logging.getLogger("audit.pre_register")
    logger.info(
        "[AUDIT] pre-register reject id=%s email=%s reason=%s operator=%s",
        request_id, req.email, req.reject_reason or "-", current_user.username,
    )

    await db.commit()
    return RejectResponse(detail=f"申请 {req.email} 已拒绝")
