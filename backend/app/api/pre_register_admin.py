"""
账号申请（预注册/白名单）管理 API — 管理员端
=========================================
对应登录页"申请开通账号"与白名单申请页通道的后台管理。

业务流程:
  1. 访客提交 → 入 pre_register_requests 队列（status=pending，source 标记来源）
  2. 管理员 GET /admin/pre-register-requests 查看申请队列（分页/筛选/搜索/计数）
  3. 通过 → POST /admin/pre-register-requests/{id}/approve（幂等，自动创建用户）
  4. 拒绝 → POST /admin/pre-register-requests/{id}/reject（幂等，7 天冷却）
  5. 扩展能力:
     - POST /{id}/resend-code   对未验证的申请重发邮箱验证码
     - POST /batch-approve      批量通过（自动创建用户）
     - POST /batch-reject       批量拒绝（7 天冷却）
     - POST /{id}/reactivate    将 expired 申请重新激活为 pending
     - GET  /export             导出申请列表（CSV）

权限要求: ADMIN 角色 + USER_READ / USER_CREATE / USER_UPDATE 细粒度权限
"""
import csv
import io
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_db_session, require_role
from ..core.rbac.permission import Permission, PermissionChecker
from ..core.whitelist_org import assign_user_to_whitelist_org
from ..core.whitelist_quota import (
    WHITELIST_QUOTA_TOTAL,
    consume_quota,
    get_approved_count,
)
from ..models.models import User, UserRole
from ..models.pre_register import PreRegisterRequest, PreRegisterStatus
from ..services import whitelist as whitelist_service
from ..services.auth import get_password_hash


def _generate_temp_password(length: int = 12) -> str:
    """生成 12 位临时密码（含大小写字母 + 数字 + 特殊字符各至少 1 位）"""
    if length < 8:
        length = 8
    alphabet = string.ascii_letters + string.digits + "!@#$"
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
    apply_reason: Optional[str] = None
    source: Optional[str] = None
    status: str
    email_verified_at: Optional[datetime] = None
    verify_attempts: int = 0
    cooldown_until: Optional[datetime] = None
    attempt_count: int = 1
    review_deadline: Optional[datetime] = None
    review_note: Optional[str] = None
    expired_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
    user_id: Optional[int] = None
    ip_address: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WhitelistQuotaOut(BaseModel):
    """白名单 500 名额配额（实时显示剩余）。"""
    total: int
    approved: int
    remaining: int


class PreRegisterListResponse(BaseModel):
    items: list[PreRegisterRequestOut]
    total: int
    page: int
    page_size: int
    status_counts: dict[str, int] = {}
    whitelist_quota: WhitelistQuotaOut


class ApproveRequest(BaseModel):
    role: str = Field("researcher", description="创建的用户角色: guest/researcher/formulator/reviewer/admin（默认 researcher）")
    password: Optional[str] = Field(None, min_length=8, max_length=100, description="可选：指定初始密码，缺省则由系统生成临时密码")
    note: Optional[str] = Field(None, max_length=500, description="审核备注（回填 review_note）")


class ApproveResponse(BaseModel):
    detail: str
    user_id: int
    username: str
    temp_password: Optional[str] = None


class RejectRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500, description="拒绝原因（可选）")


class RejectResponse(BaseModel):
    detail: str


class BatchApproveRequest(BaseModel):
    ids: list[int] = Field(..., min_length=1, max_length=100)
    role: str = Field("researcher")
    password: Optional[str] = Field(None, min_length=8, max_length=100)
    note: Optional[str] = Field(None, max_length=500)


class BatchRejectRequest(BaseModel):
    ids: list[int] = Field(..., min_length=1, max_length=100)
    reason: Optional[str] = Field(None, max_length=500)


class BatchOperationResult(BaseModel):
    request_id: int
    ok: bool
    message: str
    username: Optional[str] = None
    user_id: Optional[int] = None
    temp_password: Optional[str] = None


class BatchOperationResponse(BaseModel):
    results: list[BatchOperationResult]
    success_count: int
    fail_count: int


# ═══════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════

async def _get_request(db: AsyncSession, request_id: int) -> PreRegisterRequest | None:
    return (
        await db.execute(
            select(PreRegisterRequest).where(PreRegisterRequest.id == request_id)
        )
    ).scalar_one_or_none()


async def _detect_approve_conflict(db: AsyncSession, email: str, username: str) -> dict:
    """IntegrityError 回滚后判定并发唯一约束冲突类型。

    优先按 email 唯一冲突（用户已存在，最常见）返回 EMAIL_EXISTS；否则按 username
    唯一冲突返回 USERNAME_CONFLICT；两者皆非则归为通用 CONCURRENT_CONFLICT。
    返回值携带 error_code / message，供 _approve_one 与 approve 端点映射为 409。
    """
    email_user = (
        await db.execute(select(User.id).where(User.email == email))
    ).scalar_one_or_none()
    if email_user is not None:
        return {
            "error_code": "EMAIL_EXISTS",
            "message": f"邮箱 {email} 已存在用户(user_id={email_user})，请勿重复创建",
        }
    username_user = (
        await db.execute(select(User.id).where(User.username == username))
    ).scalar_one_or_none()
    if username_user is not None:
        return {
            "error_code": "USERNAME_CONFLICT",
            "message": f"用户名 {username} 已被并发占用，请重试",
        }
    return {
        "error_code": "CONCURRENT_CONFLICT",
        "message": "并发创建冲突，请重试",
    }


async def _approve_one(
    db: AsyncSession,
    request_id: int,
    role: str,
    password: Optional[str],
    note: Optional[str],
    operator: User,
) -> dict:
    """通过单个申请（幂等）。返回统一结果 dict。"""
    now = datetime.now(timezone.utc)

    claim = await db.execute(
        update(PreRegisterRequest)
        .where(
            PreRegisterRequest.id == request_id,
            PreRegisterRequest.status == PreRegisterStatus.PENDING,
        )
        .values(reviewed_by=operator.id, reviewed_at=now)
        .returning(PreRegisterRequest.id)
    )
    claimed_id = claim.scalar_one_or_none()
    if claimed_id is None:
        req = await _get_request(db, request_id)
        if req is None:
            return {"ok": False, "request_id": request_id, "message": "申请不存在"}
        return {"ok": False, "request_id": request_id, "message": f"申请当前状态为 {req.status}，仅 pending 可审核"}

    req = await _get_request(db, request_id)

    # 邮箱冲突检查：该 email 已存在用户（既有用户直接归入白名单组织，不再新建）。
    existing_user = (await db.execute(
        select(User).where(User.email == req.email)
    )).scalar_one_or_none()
    if existing_user is not None:
        # 已删号/停用用户（is_active=False，注销时 email 已匿名化）不授予白名单权益：
        # 返回明确错误而非 APPROVED，避免误授已失效账号。
        if not existing_user.is_active:
            await db.rollback()
            return {
                "ok": False,
                "request_id": request_id,
                "message": f"邮箱已存在但用户已停用(user_id={existing_user.id})，无法归入白名单组织",
            }
        # 与「新用户分支」一致的配额语义：批准也消耗 1 个白名单名额。
        # 此刻尚未 commit（claim 的 reviewed_by/reviewed_at 也未提交），
        # 配额不足时 rollback 回滚整个 claim，申请保持 pending，管理员可在名额释放后重试。
        if not await consume_quota(db):
            await db.rollback()
            return {
                "ok": False,
                "request_id": request_id,
                "message": f"白名单名额已满（{WHITELIST_QUOTA_TOTAL}/{WHITELIST_QUOTA_TOTAL}）",
                "quota_full": True,
            }
        # 既有用户归入「莱茵分子白名单组织」（成员行 + org-grant 权益），与新建用户同路径。
        await assign_user_to_whitelist_org(db, existing_user)
        req.status = PreRegisterStatus.APPROVED
        req.user_id = existing_user.id
        req.reviewed_by = operator.id
        req.reviewed_at = now
        req.review_note = (note or "").strip() or None
        await db.commit()
        return {
            "ok": True,
            "request_id": request_id,
            "message": f"邮箱已存在用户(user_id={existing_user.id})，已归入白名单组织并通过",
            "username": existing_user.username,
            "user_id": existing_user.id,
        }

    role_map = {
        "guest": UserRole.GUEST,
        "researcher": UserRole.RESEARCHER,
        "formulator": UserRole.FORMULATOR,
        "reviewer": UserRole.REVIEWER,
        "admin": UserRole.ADMIN,
    }
    if role not in role_map:
        await db.rollback()
        return {"ok": False, "request_id": request_id, "message": f"无效角色: {role}"}
    target_role = role_map[role]

    # ── 白名单 500 名额配额：仅批准消耗；剩余 0 时阻止新批准（原子防超发）──
    # 注意：此刻尚未 commit（claim 的 reviewed_by/reviewed_at 也未提交），
    # 配额不足时 rollback 回滚整个 claim，申请保持 pending，管理员可在名额释放后重试。
    if not await consume_quota(db):
        await db.rollback()
        return {
            "ok": False,
            "request_id": request_id,
            "message": f"白名单名额已满（{WHITELIST_QUOTA_TOTAL}/{WHITELIST_QUOTA_TOTAL}）",
            "quota_full": True,
        }

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

    temp_password = None
    if password:
        final_password = password
    else:
        final_password = _generate_temp_password(12)
        temp_password = final_password

    hashed = get_password_hash(final_password)
    req_email = req.email  # 捕获于事务内，IntegrityError 回滚后仍可安全引用
    import logging
    logger = logging.getLogger("audit.pre_register")
    try:
        user = User(
            username=username,
            email=req_email,
            hashed_password=hashed,
            full_name=req.full_name or base_username,
            role=target_role,
            department=req.department,
            is_active=True,
            # 白名单通过 → 免费版基础（白名单用户仍 free）+ 组织授予子集
            # （专业版功能由「莱茵分子白名单组织」组织级授予，见 core/plans.py has_plan org-grant）。
            plan="free",
        )
        db.add(user)
        # 新批用户归入「莱茵分子白名单组织」，参与租户数据隔离（数据仅组织内可见）。
        await assign_user_to_whitelist_org(db, user)
        await db.flush()

        req.status = PreRegisterStatus.APPROVED
        req.user_id = user.id
        req.reviewed_by = operator.id
        req.reviewed_at = now
        req.review_note = (note or "").strip() or None

        logger.info(
            "[AUDIT] pre-register approve id=%s email=%s user_id=%s role=%s operator=%s",
            request_id, req_email, user.id, target_role.value, operator.username,
        )
        await db.commit()
    except IntegrityError:
        # 并发唯一约束冲突（username/email/organization_members）：回滚整个事务——
        # 事务级 advisory lock（pg_advisory_xact_lock，见 consume_quota）随回滚自动释放，
        # 不悬挂；申请保持 pending（claim 一并回滚），返回明确冲突而非 503。
        await db.rollback()
        conflict = await _detect_approve_conflict(db, req_email, username)
        return {
            "ok": False,
            "request_id": request_id,
            "conflict": True,
            "error_code": conflict["error_code"],
            "message": conflict["message"],
        }

    # 审核结果邮件（best-effort）：临时密码仅随邮件下发；邮件失败才回退到响应
    # （明文不外泄，见 P2-4）。
    email_sent = True
    try:
        await whitelist_service.send_review_result_email(
            req_email,
            status=PreRegisterStatus.APPROVED,
            username=username,
            temp_password=temp_password,
            lang="zh-CN",
        )
    except Exception:  # noqa: BLE001
        email_sent = False
        logger.exception("发送审核通过邮件失败 email=%s", req_email)

    return {
        "ok": True,
        "request_id": request_id,
        "message": f"账号已开通: {username}",
        "username": username,
        "user_id": user.id,
        "temp_password": temp_password if not email_sent else None,
    }


async def _reject_one(db: AsyncSession, request_id: int, reason: Optional[str], operator: User) -> dict:
    """拒绝单个申请（幂等）。返回统一结果 dict。"""
    now = datetime.now(timezone.utc)

    claim = await db.execute(
        update(PreRegisterRequest)
        .where(
            PreRegisterRequest.id == request_id,
            PreRegisterRequest.status == PreRegisterStatus.PENDING,
        )
        .values(reviewed_by=operator.id, reviewed_at=now)
        .returning(PreRegisterRequest.id)
    )
    claimed_id = claim.scalar_one_or_none()
    if claimed_id is None:
        req = await _get_request(db, request_id)
        if req is None:
            return {"ok": False, "request_id": request_id, "message": "申请不存在"}
        return {"ok": False, "request_id": request_id, "message": f"申请当前状态为 {req.status}，仅 pending 可拒绝"}

    req = await _get_request(db, request_id)
    req.status = PreRegisterStatus.REJECTED
    req.reject_reason = (reason or "").strip() or None
    req.reviewed_by = operator.id
    req.reviewed_at = now
    req.cooldown_until = now + timedelta(days=7)

    import logging
    logger = logging.getLogger("audit.pre_register")
    logger.info(
        "[AUDIT] pre-register reject id=%s email=%s reason=%s operator=%s",
        request_id, req.email, req.reject_reason or "-", operator.username,
    )
    await db.commit()

    try:
        await whitelist_service.send_review_result_email(
            req.email,
            status=PreRegisterStatus.REJECTED,
            reject_reason=req.reject_reason,
            lang="zh-CN",
        )
    except Exception:  # noqa: BLE001
        logger.exception("发送审核拒绝邮件失败 email=%s", req.email)

    return {"ok": True, "request_id": request_id, "message": f"申请 {req.email} 已拒绝"}


# ═══════════════════════════════════════
# 1. 申请队列列表
# ═══════════════════════════════════════

@router.get("", response_model=PreRegisterListResponse, summary="账号申请队列（管理员）")
async def list_pre_register_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, description="状态过滤: pending/approved/rejected/expired"),
    source: str | None = Query(None, description="来源过滤: whitelist_page/login/legacy"),
    search: str | None = Query(None, description="搜索邮箱/姓名/部门/申请理由"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """分页查看账号申请队列，返回 status_counts 供前端 Tab 角标。"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_READ)

    status_counts: dict[str, int] = {}
    for s in (PreRegisterStatus.PENDING, PreRegisterStatus.APPROVED, PreRegisterStatus.REJECTED, PreRegisterStatus.EXPIRED):
        cnt = (await db.execute(
            select(func.count()).select_from(PreRegisterRequest).where(PreRegisterRequest.status == s)
        )).scalar() or 0
        status_counts[s] = int(cnt)

    query = select(PreRegisterRequest)
    count_query = select(func.count()).select_from(PreRegisterRequest)

    if status and status in (PreRegisterStatus.PENDING, PreRegisterStatus.APPROVED, PreRegisterStatus.REJECTED, PreRegisterStatus.EXPIRED):
        query = query.where(PreRegisterRequest.status == status)
        count_query = count_query.where(PreRegisterRequest.status == status)

    if source:
        query = query.where(PreRegisterRequest.source == source)
        count_query = count_query.where(PreRegisterRequest.source == source)

    if search:
        like_pattern = f"%{search}%"
        cond = or_(
            PreRegisterRequest.email.ilike(like_pattern),
            PreRegisterRequest.full_name.ilike(like_pattern),
            PreRegisterRequest.department.ilike(like_pattern),
            PreRegisterRequest.apply_reason.ilike(like_pattern),
        )
        query = query.where(cond)
        count_query = count_query.where(cond)

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(PreRegisterRequest.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    # 解析审核人用户名
    reviewer_ids = {r.reviewed_by for r in items if r.reviewed_by}
    reviewers: dict[int, str] = {}
    if reviewer_ids:
        reviewer_rows = (
            await db.execute(select(User.id, User.username).where(User.id.in_(reviewer_ids)))
        ).all()
        reviewers = {uid: uname for uid, uname in reviewer_rows}

    items_out: list[PreRegisterRequestOut] = []
    for r in items:
        item = PreRegisterRequestOut.model_validate(r)
        item.reviewed_by_name = reviewers.get(r.reviewed_by) if r.reviewed_by else None
        items_out.append(item)

    return PreRegisterListResponse(
        items=items_out,
        total=int(total),
        page=page,
        page_size=page_size,
        status_counts=status_counts,
        whitelist_quota=WhitelistQuotaOut(
            total=WHITELIST_QUOTA_TOTAL,
            approved=await get_approved_count(db),
            remaining=max(0, WHITELIST_QUOTA_TOTAL - await get_approved_count(db)),
        ),
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
    """通过账号申请 → 自动创建 User 记录（幂等）。"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_CREATE)

    result = await _approve_one(db, request_id, data.role, data.password, data.note, current_user)
    if not result["ok"]:
        if result.get("quota_full"):
            # 白名单名额已满（500/500）：409，前端据此展示「名额已满」状态
            raise HTTPException(
                status_code=409,
                detail={
                    "error_code": "WHITELIST_QUOTA_FULL",
                    "message": result["message"],
                    "quota_full": True,
                    "quota_total": WHITELIST_QUOTA_TOTAL,
                    "quota_approved": WHITELIST_QUOTA_TOTAL,
                    "quota_remaining": 0,
                },
            )
        if result.get("conflict"):
            # 并发唯一约束冲突（email/username 已存在）：409（明确错误码，非 503）
            raise HTTPException(
                status_code=409,
                detail={
                    "error_code": result.get("error_code", "CONFLICT"),
                    "message": result["message"],
                },
            )
        raise HTTPException(status_code=400, detail=result["message"])
    return ApproveResponse(
        detail=result["message"],
        user_id=result["user_id"],
        username=result["username"],
        temp_password=result.get("temp_password"),
    )


@router.post("/batch-approve", response_model=BatchOperationResponse, summary="批量通过申请（管理员）")
async def batch_approve_pre_register_requests(
    data: BatchApproveRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """批量通过账号申请（逐条幂等，已非 pending 的跳过并返回原因）。"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_CREATE)

    results: list[BatchOperationResult] = []
    for rid in data.ids:
        result = await _approve_one(db, rid, data.role, data.password, data.note, current_user)
        results.append(BatchOperationResult(
            request_id=rid,
            ok=result["ok"],
            message=result["message"],
            username=result.get("username"),
            user_id=result.get("user_id"),
            temp_password=result.get("temp_password"),
        ))

    success_count = sum(1 for r in results if r.ok)
    return BatchOperationResponse(
        results=results,
        success_count=success_count,
        fail_count=len(results) - success_count,
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
    """拒绝账号申请，标记 status=rejected + reject_reason + 7 天冷却。"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_UPDATE)

    result = await _reject_one(db, request_id, data.reason, current_user)
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return RejectResponse(detail=result["message"])


@router.post("/batch-reject", response_model=BatchOperationResponse, summary="批量拒绝申请（管理员）")
async def batch_reject_pre_register_requests(
    data: BatchRejectRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """批量拒绝账号申请（逐条幂等，7 天冷却）。"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_UPDATE)

    results: list[BatchOperationResult] = []
    for rid in data.ids:
        result = await _reject_one(db, rid, data.reason, current_user)
        results.append(BatchOperationResult(
            request_id=rid,
            ok=result["ok"],
            message=result["message"],
        ))

    success_count = sum(1 for r in results if r.ok)
    return BatchOperationResponse(
        results=results,
        success_count=success_count,
        fail_count=len(results) - success_count,
    )


# ═══════════════════════════════════════
# 4. 重发验证码邮件
# ═══════════════════════════════════════

@router.post("/{request_id}/resend-code", summary="重发邮箱验证码（管理员）")
async def resend_code_pre_register_request(
    request_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """对 pending 且未完成邮箱验证的申请重发验证码邮件（不受访客端 60s 冷却限制）。"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_UPDATE)

    result = await whitelist_service.admin_resend_verification_code(db, request_id=request_id)
    if "error" in result:
        raise HTTPException(status_code=result["error"]["status"], detail=result["error"]["message"])
    return result


# ═══════════════════════════════════════
# 5. 重新激活过期申请
# ═══════════════════════════════════════

@router.post("/{request_id}/reactivate", summary="重新激活过期申请（管理员）")
async def reactivate_pre_register_request(
    request_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """将 expired 申请重新置为 pending，并重置审核截止时间（7 天）。"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_UPDATE)

    req = await _get_request(db, request_id)
    if req is None:
        raise HTTPException(404, detail="申请不存在")
    if req.status != PreRegisterStatus.EXPIRED:
        raise HTTPException(400, detail=f"仅 expired 状态可重新激活，当前为 {req.status}")

    now = datetime.now(timezone.utc)
    req.status = PreRegisterStatus.PENDING
    req.expired_at = None
    req.review_deadline = now + timedelta(days=7)
    req.reviewed_by = None
    req.reviewed_at = None
    req.review_note = (req.review_note or "") + ("\n[已重新激活]" if req.review_note else "[已重新激活]")

    import logging
    logger = logging.getLogger("audit.pre_register")
    logger.info(
        "[AUDIT] pre-register reactivate id=%s email=%s operator=%s",
        request_id, req.email, current_user.username,
    )
    await db.commit()

    return {"detail": f"申请 {req.email} 已重新激活为待审核"}


# ═══════════════════════════════════════
# 5b. 撤销拒绝
# ═══════════════════════════════════════

@router.post("/{request_id}/undo-reject", summary="撤销拒绝（管理员）")
async def undo_reject_pre_register_request(
    request_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    撤销误操作：将 rejected 申请恢复为 pending。

    同时清除拒绝原因、7 天冷却、审核人/时间，重置审核截止（7 天），
    并在审核备注中追加「[已撤销拒绝]」留痕。
    """
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_UPDATE)

    req = await _get_request(db, request_id)
    if req is None:
        raise HTTPException(404, detail="申请不存在")
    if req.status != PreRegisterStatus.REJECTED:
        raise HTTPException(400, detail=f"仅 rejected 状态可撤销拒绝，当前为 {req.status}")

    now = datetime.now(timezone.utc)
    req.status = PreRegisterStatus.PENDING
    req.reject_reason = None
    req.cooldown_until = None
    req.reviewed_by = None
    req.reviewed_at = None
    req.review_deadline = now + timedelta(days=7)
    req.review_note = ((req.review_note or "") + "\n[已撤销拒绝]").strip()

    import logging
    logger = logging.getLogger("audit.pre_register")
    logger.info(
        "[AUDIT] pre-register undo-reject id=%s email=%s operator=%s",
        request_id, req.email, current_user.username,
    )
    await db.commit()

    return {"detail": f"申请 {req.email} 已撤销拒绝并恢复为待审核"}


# ═══════════════════════════════════════
# 6. 导出申请列表（CSV）
# ═══════════════════════════════════════

@router.get("/export", summary="导出账号申请列表（CSV，管理员）")
async def export_pre_register_requests(
    status: str | None = Query(None, description="状态过滤"),
    source: str | None = Query(None, description="来源过滤"),
    search: str | None = Query(None, description="搜索关键词"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """导出符合条件的申请为 CSV（UTF-8 with BOM，兼容 Excel）。"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_READ)

    query = select(PreRegisterRequest)
    if status and status in (PreRegisterStatus.PENDING, PreRegisterStatus.APPROVED, PreRegisterStatus.REJECTED, PreRegisterStatus.EXPIRED):
        query = query.where(PreRegisterRequest.status == status)
    if source:
        query = query.where(PreRegisterRequest.source == source)
    if search:
        like_pattern = f"%{search}%"
        query = query.where(or_(
            PreRegisterRequest.email.ilike(like_pattern),
            PreRegisterRequest.full_name.ilike(like_pattern),
            PreRegisterRequest.department.ilike(like_pattern),
            PreRegisterRequest.apply_reason.ilike(like_pattern),
        ))

    items = (await db.execute(query.order_by(PreRegisterRequest.created_at.desc()))).scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "ID", "邮箱", "姓名", "部门", "申请理由", "来源", "状态", "验证状态",
        "申请时间", "审核截止", "冷却截止", "审核人", "审核时间", "拒绝原因", "用户ID", "IP",
    ])
    for r in items:
        writer.writerow([
            r.id,
            r.email,
            r.full_name or "",
            r.department or "",
            r.apply_reason or "",
            r.source or "",
            r.status,
            "已认证" if r.email_verified_at else ("未验证" if r.status == PreRegisterStatus.PENDING else ""),
            r.created_at.astimezone(timezone.utc).isoformat() if r.created_at else "",
            r.review_deadline.astimezone(timezone.utc).isoformat() if r.review_deadline else "",
            r.cooldown_until.astimezone(timezone.utc).isoformat() if r.cooldown_until else "",
            r.reviewed_by or "",
            r.reviewed_at.astimezone(timezone.utc).isoformat() if r.reviewed_at else "",
            r.reject_reason or "",
            r.user_id or "",
            r.ip_address or "",
        ])

    csv_bytes = ("\ufeff" + buf.getvalue()).encode("utf-8")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pre_register_requests.csv"},
    )
