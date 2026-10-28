"""
用户管理 API（管理员）
P1-2: 账号安全管理（防暴力破解）
说明：通知相关接口已统一收敛到 v1 notification_router（/api/v1/notifications），
本文件不再重复定义，避免路由遮蔽。
"""
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import String, bindparam, cast, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import get_db_session, require_role
from ..core.rbac.permission import Permission, PermissionChecker
from ..models.models import (
    User,
    UserRole,
)
from ..schemas.user import UserResponse

router = APIRouter(tags=["通知与用户管理"])


# ═══════════════════════════════════════
# 用户管理（管理员）
# ═══════════════════════════════════════

@router.get("/admin/users", summary="用户列表（管理员）")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: str | None = Query(None, description="角色过滤（admin/reviewer/researcher/formulator/guest）"),
    search: str | None = Query(None, description="搜索用户名/姓名/邮箱"),
    status: str | None = Query(None, description="状态过滤: active / inactive"),
    organization_id: int | None = Query(None, description="按组织 ID 过滤"),
    sort_field: str = Query("created_at", description="排序字段: username/full_name/role/created_at/last_login"),
    sort_dir: str = Query("desc", description="排序方向: asc/desc"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """管理员查看用户列表"""
    # RBAC 细粒度权限检查
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_READ)
    query = select(User)
    count_query = select(func.count()).select_from(User)

    if role:
        try:
            role_enum = UserRole(role)
        except ValueError:
            raise HTTPException(400, detail=f"无效的角色: {role}")
        # users.role 列为 varchar，存储的是枚举成员名（大写，如 ADMIN/REVIEWER）
        role_str = role_enum.name
        query = query.where(cast(User.role, String) == role_str)
        count_query = count_query.where(cast(User.role, String) == role_str)
    if search:
        like_pattern = f"%{search}%"
        query = query.where(
            (User.username.ilike(like_pattern))
            | (User.full_name.ilike(like_pattern))
            | (User.email.ilike(like_pattern))
        )
        count_query = count_query.where(
            (User.username.ilike(like_pattern))
            | (User.full_name.ilike(like_pattern))
            | (User.email.ilike(like_pattern))
        )
    if status:
        is_active = status == "active"
        query = query.where(User.is_active == is_active)
        count_query = count_query.where(User.is_active == is_active)
    if organization_id:
        query = query.where(User.organization_id == organization_id)
        count_query = count_query.where(User.organization_id == organization_id)

    # 排序白名单，避免任意字段注入
    sortable = {
        "username": User.username,
        "full_name": User.full_name,
        "role": User.role,
        "created_at": User.created_at,
        "last_login": User.last_login,
    }
    order_col = sortable.get(sort_field, User.created_at)
    order_expr = order_col.desc() if sort_dir.lower() == "asc" else order_col.desc()
    if sort_dir.lower() == "asc":
        order_expr = order_col.asc()

    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(
        query.order_by(order_expr)
        .offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    # 组织名称映射（真实 organizations 表，原生 SQL 避免关系映射问题）
    org_ids = {u.organization_id for u in items if u.organization_id is not None}
    org_names: dict[int, str] = {}
    if org_ids:
        stmt = text("SELECT id, name FROM organizations WHERE id IN :ids").bindparams(
            bindparam("ids", expanding=True)
        )
        org_rows = (await db.execute(stmt, {"ids": list(org_ids)})).all()
        org_names = {r.id: r.name for r in org_rows}

    user_dicts = []
    for u in items:
        d = UserResponse.model_validate(u).model_dump()
        if u.organization_id is not None:
            d["organization_name"] = org_names.get(u.organization_id) or f"组织 {u.organization_id}"
        user_dicts.append(d)

    # 补充用户所属组织（organization_members 聚合），与 /users 保持一致
    try:
        user_ids = [d["id"] for d in user_dicts]
        if user_ids:
            placeholders = ",".join([f":uid_{i}" for i in range(len(user_ids))])
            member_params = {f"uid_{i}": uid for i, uid in enumerate(user_ids)}
            member_rows = (await db.execute(
                text(f"""
                    SELECT om.user_id, o.id AS org_id, o.name AS org_name, om.role AS org_role
                    FROM organization_members om
                    JOIN organizations o ON om.organization_id = o.id
                    WHERE om.user_id IN ({placeholders}) AND o.is_active = TRUE
                    ORDER BY o.id ASC
                """),
                member_params,
            )).all()
            member_map: dict[int, list[dict]] = {}
            for mr in member_rows:
                member_map.setdefault(mr.user_id, []).append({
                    "id": mr.org_id,
                    "name": mr.org_name,
                    "role": mr.org_role,
                })
            for d in user_dicts:
                orgs = member_map.get(d["id"], [])
                d["organizations"] = orgs
                if not d.get("organization_name") and orgs:
                    d["organization_name"] = orgs[0]["name"]
                if not d.get("organization_id") and orgs:
                    d["organization_id"] = orgs[0]["id"]
        else:
            for d in user_dicts:
                d["organizations"] = []
    except Exception as exc:  # pragma: no cover - 调试辅助
        import logging
        logging.getLogger("admin").exception("用户组织聚合失败: %s", exc)
        for d in user_dicts:
            d.setdefault("organizations", [])

    # 全量统计（不随分页/筛选变化，供统计卡片/角色分布使用）
    stats_query = select(
        func.count(User.id).label("total_users"),
        func.count(User.id).filter(User.is_active.is_(True)).label("active_users"),
        func.count(User.id).filter(User.is_active.is_(False)).label("inactive_users"),
    )
    stats_row = (await db.execute(stats_query)).one()
    role_rows = (await db.execute(
        select(cast(User.role, String).label("role"), func.count(User.id).label("cnt"))
        .group_by(cast(User.role, String))
    )).all()
    role_counts: dict[str, int] = {}
    for rr in role_rows:
        role_counts[rr.role] = int(rr.cnt)

    return {
        "items": user_dicts,
        "total": total,
        "page": page,
        "page_size": page_size,
        "stats": {
            "total_users": int(stats_row.total_users or 0),
            "active_users": int(stats_row.active_users or 0),
            "inactive_users": int(stats_row.inactive_users or 0),
            "role_counts": role_counts,
        },
    }


@router.put("/admin/users/{user_id}/role", summary="修改用户角色（管理员）")
async def update_user_role(
    user_id: int,
    role: str = Query(..., description="新角色"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """管理员修改用户角色"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_UPDATE)
    if user_id == current_user.id:
        raise HTTPException(400, detail="不能修改自己的角色")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, detail="用户不存在")

    try:
        new_role = UserRole(role)
    except ValueError:
        raise HTTPException(400, detail=f"无效的角色: {role}")

    user.role = new_role
    await db.commit()
    return {"detail": f"用户 {user.username} 角色已更新为 {role}"}


@router.put("/admin/users/{user_id}/status", summary="启用/禁用用户（管理员）")
async def toggle_user_status(
    user_id: int,
    enable: bool | None = Query(None, description="可选指定目标状态；不传则切换当前状态"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """管理员启用或禁用用户。enable=true 强制启用，enable=false 强制禁用，缺省时切换状态。"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_UPDATE)
    if user_id == current_user.id:
        raise HTTPException(400, detail="不能修改自己的账户状态")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, detail="用户不存在")

    if enable is None:
        user.is_active = not user.is_active
    else:
        user.is_active = enable
    await db.commit()
    action = "启用" if user.is_active else "禁用"
    return {"detail": f"用户 {user.username} 已{action}"}


# ═══════════════════════════════════════
# 账号安全管理 (P1-2: 防暴力破解)
# ═══════════════════════════════════════

@router.post("/admin/users/{user_id}/unlock", summary="解锁账号（管理员）")
async def unlock_user_account(
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    管理员手动解锁被锁定的账号

    功能:
    - 清除登录失败计数器
    - 解除账号锁定状态
    - 记录审计日志

    权限要求: ADMIN 角色
    """
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_UPDATE)
    from ..core.security.account_lockout import AccountLockout

    # 检查目标用户是否存在
    target_user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 执行解锁操作
    lockout = AccountLockout()
    success = await lockout.manual_unlock(db, user_id, current_user)

    if success:
        return {
            "detail": f"账号 {target_user.username} 已成功解锁",
            "unlocked_at": datetime.now().isoformat(),
            "operator": current_user.username,
        }
    else:
        raise HTTPException(
            status_code=500,
            detail="解锁失败，请稍后重试"
        )


@router.get("/admin/users/{user_id}/lock-status", summary="查看账号锁定状态（管理员）")
async def get_account_lock_status(
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    查看用户的账号锁定状态和安全信息

    返回信息:
    - 当前锁定状态
    - 登录失败次数
    - 锁定剩余时间（如已锁定）
    - 最后登录时间
    """
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_READ)

    from ..core.security.account_lockout import AccountLockout

    # 查询目标用户
    target_user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 检查锁定状态
    lockout = AccountLockout()
    is_locked, lock_info = await lockout.is_account_locked(db, target_user.username)

    return {
        "user_id": target_user.id,
        "username": target_user.username,
        "is_locked": is_locked,
        "login_attempts": target_user.login_attempts or 0,
        "last_login": target_user.last_login.isoformat() if target_user.last_login else None,
        "lock_info": lock_info if is_locked else None,
        "security_settings": {
            "max_attempts": lockout.max_attempts,
            "lockout_duration_minutes": int(lockout.lockout_duration.total_seconds() / 60),
        }
    }


# ═══════════════════════════════════════
# 管理员重置用户密码
# ═══════════════════════════════════════

class ResetPasswordRequest(BaseModel):
    """管理员重置密码请求"""
    password: str | None = Field(
        None, min_length=8, max_length=100,
        description="新密码；留空则由系统生成临时密码"
    )


@router.post("/admin/users/{user_id}/reset-password", summary="重置用户密码（管理员）")
async def reset_user_password(
    user_id: int,
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """管理员重置指定用户的密码，并清除登录失败计数与锁定状态。"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_UPDATE)

    if user_id == current_user.id:
        raise HTTPException(400, detail="不能在此重置自己的密码，请使用个人设置修改")

    target_user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target_user:
        raise HTTPException(404, detail="用户不存在")

    from ..services.auth import get_password_hash

    temp_password: str | None = None
    if data.password:
        final_password = data.password
    else:
        import secrets
        import string
        alphabet = string.ascii_letters + string.digits + "!@#$"
        chars = [
            secrets.choice(string.ascii_uppercase),
            secrets.choice(string.ascii_lowercase),
            secrets.choice(string.digits),
            secrets.choice("!@#$"),
        ]
        chars += [secrets.choice(alphabet) for _ in range(8)]
        secrets.SystemRandom().shuffle(chars)
        final_password = "".join(chars)
        temp_password = final_password

    target_user.hashed_password = get_password_hash(final_password)
    # 重置后清除失败计数与锁定，避免新密码被锁定状态阻挡
    target_user.login_attempts = 0
    target_user.locked_until = None

    # 审计日志
    try:
        from ..models.system import AuditLog
        db.add(AuditLog(
            action="user.password_reset",
            resource_type="user",
            resource_id=target_user.id,
            user_id=current_user.id,
            details={"operator": current_user.username, "username": target_user.username},
        ))
    except Exception:
        # 审计失败不阻断主流程
        pass

    await db.commit()
    return {
        "detail": f"用户 {target_user.username} 密码已重置",
        "username": target_user.username,
        "temp_password": temp_password,
    }


# ═══════════════════════════════════════
# 管理员管理用户 2FA（TOTP）
# ═══════════════════════════════════════

class TwoFactorEnableResponse(BaseModel):
    enabled: bool
    secret: str
    otpauth_url: str
    username: str


@router.get("/admin/users/{user_id}/2fa-status", summary="查询用户 2FA 状态（管理员）")
async def get_user_2fa_status(
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """查询指定用户的 2FA 启用状态"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_READ)
    target_user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target_user:
        raise HTTPException(404, detail="用户不存在")
    return {
        "user_id": target_user.id,
        "username": target_user.username,
        "enabled": bool(target_user.two_factor_enabled),
    }


@router.post("/admin/users/{user_id}/2fa/enable", response_model=TwoFactorEnableResponse, summary="为指定用户启用 2FA（管理员）")
async def enable_user_2fa(
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """管理员为指定用户启用 TOTP 两步验证，返回密钥与 otpauth URI。"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_UPDATE)
    if user_id == current_user.id:
        raise HTTPException(400, detail="不能在此管理自己的 2FA，请使用个人设置")

    target_user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target_user:
        raise HTTPException(404, detail="用户不存在")

    from ..core.security.totp import generate_secret, totp_uri

    secret = generate_secret(20)
    target_user.two_factor_secret = secret
    target_user.two_factor_enabled = True
    await db.commit()

    # 审计
    try:
        from ..models.system import AuditLog
        db.add(AuditLog(
            action="user.2fa_enable",
            resource_type="user",
            resource_id=target_user.id,
            user_id=current_user.id,
            details={"operator": current_user.username, "username": target_user.username},
        ))
        await db.commit()
    except Exception:
        pass

    return TwoFactorEnableResponse(
        enabled=True,
        secret=secret,
        otpauth_url=totp_uri(secret, issuer="RMFOOD", account=target_user.email or target_user.username),
        username=target_user.username,
    )


@router.post("/admin/users/{user_id}/2fa/disable", summary="禁用用户 2FA（管理员）")
async def disable_user_2fa(
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """管理员禁用指定用户的 TOTP 两步验证。"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_UPDATE)
    if user_id == current_user.id:
        raise HTTPException(400, detail="不能在此管理自己的 2FA，请使用个人设置")

    target_user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target_user:
        raise HTTPException(404, detail="用户不存在")

    target_user.two_factor_secret = None
    target_user.two_factor_enabled = False
    await db.commit()

    try:
        from ..models.system import AuditLog
        db.add(AuditLog(
            action="user.2fa_disable",
            resource_type="user",
            resource_id=target_user.id,
            user_id=current_user.id,
            details={"operator": current_user.username, "username": target_user.username},
        ))
        await db.commit()
    except Exception:
        pass

    return {"user_id": target_user.id, "username": target_user.username, "enabled": False}


# ═══════════════════════════════════════
# 批量导入用户
# ═══════════════════════════════════════


@router.get("/admin/users/organizations", summary="获取组织列表（含用户数）")
async def list_user_organizations(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """管理员获取所有组织及其用户数量"""
    perm_checker = PermissionChecker(current_user)
    perm_checker.require_permission(Permission.USER_READ)
    # 使用原生 SQL 查询，避免 Organization 模型关系映射的已知问题
    from sqlalchemy import text
    rows = (await db.execute(
        text("""
            SELECT o.id AS id, o.name AS name, COUNT(u.id) AS user_count
            FROM organizations o
            LEFT JOIN users u ON u.organization_id = o.id
            GROUP BY o.id, o.name
            ORDER BY o.name ASC
        """)
    )).all()
    return {"organizations": [{"id": r.id, "name": r.name, "user_count": r.user_count} for r in rows]}


@router.post("/admin/users/batch-import", summary="批量导入用户（CSV）")
async def batch_import_users(
    file: UploadFile = File(..., description="CSV 文件"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    批量导入用户从 CSV 文件。

    CSV 格式要求:
    - 第一行为标题行: username, email, password, full_name, role, department
    - username 和 email 必填且唯一
    - password 至少8位
    - role 可选: admin, reviewer, researcher, formulator, guest (默认 researcher)
    - department 可选

    返回:
    - total: 总行数
    - created: 成功创建数
    - skipped_duplicate: 跳过（重复）数
    - errors: 错误列表
    """
    import csv
    import io

    from ..services.auth import get_password_hash
    from ..services.user import UserService

    service = UserService(db)

    # 读取 CSV 内容
    content = await file.read()
    text = content.decode("utf-8-sig")  # 支持 BOM
    reader = csv.DictReader(io.StringIO(text))

    results = {
        "total": 0,
        "created": 0,
        "skipped_duplicate": 0,
        "errors": [],
    }

    ROLE_MAP = {
        "admin": "ADMIN",
        "reviewer": "REVIEWER",
        "researcher": "RESEARCHER",
        "formulator": "FORMULATOR",
        "guest": "GUEST",
    }

    for row_num, row in enumerate(reader, start=2):  # 第1行是标题
        results["total"] += 1
        username = row.get("username", "").strip()
        email = row.get("email", "").strip()
        password = row.get("password", "").strip()
        full_name = row.get("full_name", "").strip() or None
        role = row.get("role", "researcher").strip().lower()
        department = row.get("department", "").strip() or None

        # 基础校验
        if not username:
            results["errors"].append({"row": row_num, "field": "username", "message": "用户名不能为空"})
            continue
        if not email:
            results["errors"].append({"row": row_num, "field": "email", "message": "邮箱不能为空"})
            continue
        if not password or len(password) < 8:
            results["errors"].append({"row": row_num, "field": "password", "message": "密码至少8位"})
            continue
        if role not in ROLE_MAP:
            results["errors"].append({"row": row_num, "field": "role", "message": f"无效角色: {role}"})
            continue

        # 唯一性检查
        existing = await db.execute(
            select(User).where((User.username == username) | (User.email == email))
        )
        if existing.scalar_one_or_none():
            results["skipped_duplicate"] += 1
            continue

        # 创建用户
        try:
            hashed = get_password_hash(password)
            from ..models import UserRole
            user = User(
                username=username,
                email=email,
                hashed_password=hashed,
                full_name=full_name,
                role=UserRole[ROLE_MAP[role]],
                department=department,
            )
            db.add(user)
            results["created"] += 1
        except Exception as e:
            results["errors"].append({"row": row_num, "field": "create", "message": str(e)})

    await db.commit()
    return results
