"""
认证服务
统一使用 app/utils/auth.py 作为底层实现，提供 AuthService 业务层和依赖注入函数。

P0 安全修复:
- ✅ 统一认证系统，消除与 utils/auth.py 的重复实现
- ✅ 集成 Token 黑名单（通过 utils/auth.py）
- ✅ 集成账号锁定机制（防暴力破解）
- ✅ 登录失败次数限制
- ✅ 自动账号锁定/解锁
- ✅ 安全日志记录
- ✅ Refresh Token 速率限制和重用检测

注意: 统一认证依赖入口为 api/deps.py（get_current_active_user, require_role）。
本模块仅保留 AuthService 业务逻辑类。
"""
import logging
import os
from typing import Optional

from fastapi import HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security.account_lockout import AccountLockout

from ..core.config import settings
from ..models import User, UserRole
from ..schemas.user import Token, TokenPayload

# ── 统一使用 utils/auth.py 的实现 ──
from ..utils.auth import (
    check_refresh_token_ratelimit,
    check_refresh_token_reuse,
    get_password_hash,
    mark_refresh_token_used,
    verify_password,
)
from ..utils.auth import (
    create_access_token as _create_access_token,
)
from ..utils.auth import (
    create_refresh_token as _create_refresh_token,
)
from ..utils.auth import (
    decode_token as _decode_token_raw,
)

logger = logging.getLogger(__name__)

# ── OAuth2 令牌提取 ──
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ── Token 操作（包装 utils/auth.py，保持向后兼容的 API） ──

def create_access_token(
    user_id: int,
    role: str,
    org_id: Optional[int] = None,
    plan: Optional[str] = None,
) -> str:
    """生成访问令牌（向后兼容的接口，内部委托给 utils/auth.py）。

    org_id/plan 写入 JWT，供 TenantMiddleware（core/multi_tenant/tenant_security.py）
    解析租户上下文，实现租户隔离。
    """
    data: dict = {"sub": str(user_id), "role": role}
    if org_id is not None:
        data["org_id"] = org_id
    if plan is not None:
        data["plan"] = plan
    return _create_access_token(data)


def create_refresh_token(user_id: int, role: str) -> str:
    """生成刷新令牌（向后兼容的接口，内部委托给 utils/auth.py）"""
    return _create_refresh_token(str(user_id))


def decode_token(token: str) -> TokenPayload:
    """
    解码并验证令牌（向后兼容的接口，返回 TokenPayload 对象）

    内部委托给 utils/auth.py，自动获得 Token 黑名单检查。
    """
    payload_dict = _decode_token_raw(token)
    return TokenPayload(
        sub=payload_dict["sub"],
        role=payload_dict.get("role", ""),
        exp=payload_dict["exp"],
        type=payload_dict.get("type", "access"),
    )


class AuthService:
    """
    认证业务逻辑

    P1-2 增强: 集成账号锁定机制，防止暴力破解攻击
    """

    def __init__(self, db: AsyncSession, request: Request = None):
        self.db = db
        self.request = request

        # 初始化账号锁定管理器
        self.lockout = AccountLockout(
            max_attempts=getattr(settings, 'max_login_attempts', 5),
            lockout_duration_minutes=getattr(settings, 'lockout_duration_minutes', 15)
        )

    async def authenticate(self, username: str, password: str, two_factor_code: Optional[str] = None) -> Token | dict:
        """
        用户登录验证（安全增强版）

        安全流程:
        1. 检查账号是否被锁定
        2. 验证用户名和密码
        3. 密码错误 → 记录失败尝试（可能触发锁定）
        4. 密码正确 → 检查 2FA（若启用且未提供验证码则要求二次验证）
        5. 重置计数器，生成令牌

        Args:
            username: 用户名
            password: 明文密码
            two_factor_code: TOTP 动态验证码（启用 2FA 后必填）

        Returns:
            Token | dict: 包含 access_token 和 refresh_token；若需 2FA 二次验证则返回 {"requires_2fa": True}
        """
        # 获取客户端IP（用于安全日志）
        client_ip = None
        if self.request:
            client_ip = self.request.client.host if self.request.client else "unknown"

        # ── Step 1: 检查账号锁定状态 ──
        is_locked, lock_info = await self.lockout.is_account_locked(self.db, username)

        if is_locked:
            lock_response = self.lockout.get_lockout_response(lock_info)

            logger.warning(
                f"🔒 拒绝登录请求 (账号已锁定):\n"
                f"   用户: {username}\n"
                f"   IP: {client_ip}\n"
                f"   剩余时间: {lock_info['remaining_time']}秒"
            )

            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=lock_response
            )

        # ── Step 2: 查询用户并验证密码 ──
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        user = result.scalar_one_or_none()

        # ── Step 3a: 登录失败处理 ──
        if not user or not verify_password(password, user.hashed_password):
            attempt_result = await self.lockout.record_failed_attempt(
                self.db,
                username,
                ip_address=client_ip
            )

            if attempt_result.get("locked"):
                logger.error(
                    f"🚨 账号因暴力破解已被锁定:\n"
                    f"   用户: {username}\n"
                    f"   IP: {client_ip}\n"
                    f"   失败次数: {attempt_result['attempts']}"
                )

                raise HTTPException(
                    status_code=status.HTTP_423_LOCKED,
                    detail={
                        "detail": "账号已被临时锁定",
                        "error_code": "ACCOUNT_LOCKED",
                        "locked": True,
                        "message": attempt_result["message"],
                        "hint": "多次登录失败导致账号锁定，请稍后重试或联系管理员",
                    }
                )
            else:
                logger.warning(
                    f"⚠️  登录失败:\n"
                    f"   用户: {username}\n"
                    f"   IP: {client_ip}\n"
                    f"   剩余尝试: {attempt_result['remaining_attempts']}"
                )

                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=attempt_result["message"],
                    headers={"X-Remaining-Attempts": str(attempt_result["remaining_attempts"])},
                )

        # ── Step 3b: 检查账户状态 ──
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="账户已被禁用，请联系管理员",
            )

        # ── Step 3c: 两步验证（2FA）检查 ──
        if user.two_factor_enabled and user.two_factor_secret:
            if not two_factor_code:
                return {"requires_2fa": True, "username": user.username}
            from ..core.security.totp import verify_totp
            if not verify_totp(user.two_factor_secret, two_factor_code):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="2FA 验证码错误",
                )

        # ── Step 4: 登录成功，重置计数器并生成令牌 ──
        # 注意：reset_login_attempts 内部会 commit（expire_on_commit=True 会过期
        # 除主键外的所有属性），若在 commit 后再访问 user.role 会触发异步懒加载
        # MissingGreenlet（greenlet_spawn has not been called）。因此先读取角色标量值。
        role_value = user.role.value
        org_value = user.organization_id
        plan_value = user.plan
        await self.lockout.reset_login_attempts(self.db, user)

        access_token = create_access_token(user.id, role_value, org_value, plan_value)
        refresh_token = create_refresh_token(user.id, role_value)

        logger.info(
            f"✅ 用户登录成功:\n"
            f"   用户: {user.username} (ID={user.id})\n"
            f"   角色: {role_value}\n"
            f"   IP: {client_ip}"
        )

        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    async def register(self, username: str, email: str, password: str, full_name: Optional[str] = None) -> User:
        """用户注册"""
        # 检查用户名唯一性
        existing = await self.db.execute(
            select(User).where(User.username == username)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户名已存在",
            )

        # 检查邮箱唯一性
        existing = await self.db.execute(
            select(User).where(User.email == email)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱已被注册",
            )

        user = User(
            username=username,
            email=email,
            hashed_password=get_password_hash(password),
            full_name=full_name,
            role=UserRole.RESEARCHER,
            is_active=True,
            plan="free",  # 直接注册默认免费版
        )
        self.db.add(user)
        await self.db.flush()

        # ── 白名单授权（规格 tenant-isolation-segmentation-plan.md 3.4）──
        # 若该 email 存在 status='approved' 的 pre_register 申请记录，
        # 说明其已通过白名单审核 → 授予专业版（plan='pro'）。
        # 延迟导入避免 models 循环依赖。
        from ..models.pre_register import PreRegisterRequest, PreRegisterStatus

        approved_req = (
            await self.db.execute(
                select(PreRegisterRequest.id)
                .where(
                    PreRegisterRequest.email == email,
                    PreRegisterRequest.status == PreRegisterStatus.APPROVED,
                )
                .limit(1)
            )
        ).scalar_one_or_none()
        if approved_req is not None:
            user.plan = "pro"
            logger.info(f"白名单授权: 用户 {user.username} 注册时授予专业版 (email={email})")

        logger.info(f"新用户注册: {user.username} (plan={user.plan})")
        return user

    async def refresh_access_token(self, refresh_token: str) -> Token:
        """
        使用刷新令牌获取新的访问令牌

        🔒 P0 安全修复:
        - 检查 refresh token 是否已被使用（防止 Token 重用攻击）
        - 检查 refresh token 速率限制（防止暴力刷新）
        - Token 旋转：每次刷新生成新的 refresh token

        Args:
            refresh_token: 刷新令牌

        Returns:
            Token: 新的 access token 和 refresh token

        Raises:
            HTTPException: Token 无效、已使用、速率限制触发等
        """
        # 🔒 Step 1: 检查 Token 重用攻击
        is_reused, reuse_error = check_refresh_token_reuse(refresh_token)
        if is_reused:
            logger.warning(f"⚠️ Refresh token 重用检测: {reuse_error}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error_code": "TOKEN_REUSED",
                    "message": reuse_error,
                    "hint": "检测到安全威胁，请重新登录",
                }
            )

        # 🔒 Step 2: 检查速率限制
        is_allowed, remaining = check_refresh_token_ratelimit(refresh_token)
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error_code": "REFRESH_RATE_LIMITED",
                    "message": "刷新频率过高，请稍后再试",
                    "hint": "短时间内刷新次数过多，建议使用较长的 access token 有效期",
                }
            )

        # Step 3: 解码并验证 token
        try:
            payload = decode_token(refresh_token)
        except HTTPException:
            # Token 无效或过期时，清除重用记录（允许重新登录）
            logger.warning("Refresh token 解码失败，可能是过期或无效")
            raise

        if payload.type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error_code": "INVALID_TOKEN_TYPE",
                    "message": "请使用刷新令牌",
                }
            )

        # Step 4: 查询用户
        result = await self.db.execute(
            select(User).where(User.id == int(payload.sub))
        )
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error_code": "USER_INVALID",
                    "message": "用户不存在或已被禁用",
                }
            )

        # Step 5: 标记旧 token 为已使用（实现 Token 旋转）
        mark_refresh_token_used(refresh_token)

        # Step 6: 生成新的 token 对
        new_access_token = create_access_token(user.id, user.role.value, user.organization_id, user.plan)
        new_refresh_token = create_refresh_token(user.id, user.role.value)

        logger.info(
            f"✅ Token 刷新成功:\n"
            f"   用户: {user.username}\n"
            f"   剩余可用刷新次数: {remaining - 1}"
        )

        return Token(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
        )

    async def change_password(self, user_id: int, old_password: str, new_password: str) -> None:
        """修改密码"""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user or not verify_password(old_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="原密码错误",
            )

        user.hashed_password = get_password_hash(new_password)
        await self.db.flush()
        logger.info(f"用户修改密码: {user.username}")

    async def forgot_password(self, email: str) -> None:
        """
        发送密码重置邮件

        🔒 P1-3 修复:
        - 实现实际的邮件发送（SMTP / 开发环境文件保存）
        - reset token 速率限制（每邮箱每分钟 5 次）
        - 邮件包含一次性 token（24小时有效期）
        - 即使邮箱不存在，也返回成功（避免用户枚举攻击）
        """
        # Step 1: 检查速率限制（即使邮箱不存在，也不能被滥用）
        from ..utils.email_service import _check_and_add_reset_attempt
        is_allowed, _ = _check_and_add_reset_attempt(email)
        if not is_allowed:
            logger.warning(f"⚠️ 密码重置请求被拒绝（速率限制）: {email}")
            return

        # Step 2: 查找用户
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()

        if not user:
            # 🔒 为了安全，即使邮箱不存在也返回成功（防止用户枚举攻击）
            logger.info(f"密码重置请求: 邮箱 {email} 不存在，返回成功（未发送邮件）")
            return

        # Step 3: 生成密码重置令牌（24小时有效期）
        from datetime import timedelta
        reset_token = _create_access_token(
            {"sub": str(user.id), "type": "reset", "username": user.username},
            expires_delta=timedelta(hours=24),
        )

        # Step 4: 发送邮件
        from ..core.config import settings
        from ..utils.email_service import send_password_reset_email

        # 从环境变量获取 SMTP 配置
        smtp_host = os.getenv("SMTP_HOST", "")
        smtp_port = int(os.getenv("SMTP_PORT", "465"))
        smtp_username = os.getenv("SMTP_USERNAME", "")
        smtp_password = os.getenv("SMTP_PASSWORD", "")
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

        success = send_password_reset_email(
            to_email=email,
            username=user.username,
            reset_token=reset_token,
            smtp_host=smtp_host,
            smtp_port=smtp_port,
            smtp_username=smtp_username,
            smtp_password=smtp_password,
            frontend_url=frontend_url,
            use_tls=smtp_port == 465,
            is_development=settings.debug,
        )

        logger.info(
            f"🔐 密码重置邮件已处理: {email}, 结果: {'成功' if success else '配置缺失(开发模式)'}"
        )

    async def reset_password(self, token: str, new_password: str) -> None:
        """
        使用令牌重置密码

        🔒 P1-3 修复:
        - Token 重用检测：每个 reset token 仅可使用一次
        - 密码复杂度验证：检查新密码是否符合要求
        - Token 类型验证：必须为 "reset" 类型
        - 记录操作日志（审计）
        """
        # 🔒 Step 1: 检测 token 重用攻击
        from ..utils.email_service import (
            _check_reset_token_reused,
            _mark_reset_token_used,
        )

        if _check_reset_token_reused(token):
            logger.warning("⚠️ Reset token 重用检测: token已被使用过")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="重置令牌已使用，请重新申请",
            )

        # Step 2: 解码并验证 token
        try:
            payload_dict = _decode_token_raw(token)
        except Exception as e:
            logger.error(f"Reset token 解码失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的重置令牌",
            )

        if payload_dict.get("type") != "reset":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的重置令牌",
            )

        # Step 3: 查找用户
        user_id = int(payload_dict["sub"])
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在",
            )

        # Step 4: 🔒 密码复杂度验证
        if len(new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="密码至少需要 8 个字符",
            )

        has_upper = any(c.isupper() for c in new_password)
        has_lower = any(c.islower() for c in new_password)
        has_digit = any(c.isdigit() for c in new_password)

        # 生产环境要求更严格
        if settings.debug is False:
            if not (has_upper and has_lower and has_digit):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="密码必须包含大小写字母和数字",
                )

        # Step 5: 🔒 标记 token 为已使用
        if not _mark_reset_token_used(token):
            logger.warning("⚠️ Reset token 标记失败: 可能被并发使用")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="重置令牌正在被使用，请稍后再试",
            )

        # Step 6: 更新密码
        user.hashed_password = get_password_hash(new_password)
        await self.db.flush()
        logger.info(f"✅ 用户重置密码成功: {user.username}")

    async def get_current_user(self, token: str) -> User | None:
        """通过 JWT token 获取当前用户（供 deps.py 调用）"""
        try:
            payload = decode_token(token)
            if payload.type != "access":
                logger.warning(f"Token type mismatch: {payload.type}")
                return None

            result = await self.db.execute(
                select(User).where(User.id == int(payload.sub))
            )
            user = result.scalar_one_or_none()
            if not user:
                logger.warning(f"User not found for sub={payload.sub}")
            return user
        except HTTPException:
            raise  # re-raise HTTP exceptions (invalid token)
        except Exception as e:
            logger.error(f"get_current_user error: {e}")
            return None


# ── 统一认证依赖入口 ──
# 注意: 所有认证依赖已统一至 api/deps.py（get_current_active_user, require_role）。
# 本模块仅提供 AuthService 业务逻辑类。
# 为保持向后兼容，以下别名供旧代码继续使用。
# 新代码请直接使用: from ..api.deps import get_current_active_user, require_role

# 向后兼容别名 — 延迟导入避免循环依赖
def __getattr__(name):
    if name == "get_current_user":
        from ..api.deps import get_current_active_user
        return get_current_active_user
    if name == "require_role":
        from ..api.deps import require_role
        return require_role
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
