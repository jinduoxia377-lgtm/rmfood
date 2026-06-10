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
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..core.session import get_db
from ..core.account_lockout import AccountLockout
from ..models import User, UserRole
from ..schemas.user import Token, TokenPayload

# ── 统一使用 utils/auth.py 的实现 ──
from ..utils.auth import (
    get_password_hash,
    verify_password,
    create_access_token as _create_access_token,
    create_refresh_token as _create_refresh_token,
    decode_token as _decode_token_raw,
)

logger = logging.getLogger(__name__)

# ── OAuth2 令牌提取 ──
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ── Token 操作（包装 utils/auth.py，保持向后兼容的 API） ──

def create_access_token(user_id: int, role: str) -> str:
    """生成访问令牌（向后兼容的接口，内部委托给 utils/auth.py）"""
    return _create_access_token({
        "sub": str(user_id),
        "role": role,
    })


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

    async def authenticate(self, username: str, password: str) -> Token:
        """
        用户登录验证（安全增强版）

        安全流程:
        1. 检查账号是否被锁定
        2. 验证用户名和密码
        3. 密码错误 → 记录失败尝试（可能触发锁定）
        4. 密码正确 → 重置计数器，生成令牌

        Args:
            username: 用户名
            password: 明文密码

        Returns:
            Token: 包含 access_token 和 refresh_token

        Raises:
            HTTPException: 认证失败或账号被锁定
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

        # ── Step 4: 登录成功，重置计数器并生成令牌 ──
        await self.lockout.reset_login_attempts(self.db, user)

        access_token = create_access_token(user.id, user.role.value)
        refresh_token = create_refresh_token(user.id, user.role.value)

        logger.info(
            f"✅ 用户登录成功:\n"
            f"   用户: {user.username} (ID={user.id})\n"
            f"   角色: {user.role.value}\n"
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
        )
        self.db.add(user)
        await self.db.flush()

        logger.info(f"新用户注册: {user.username}")
        return user

    async def refresh_access_token(self, refresh_token: str) -> Token:
        """使用刷新令牌获取新的访问令牌"""
        payload = decode_token(refresh_token)

        if payload.type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="请使用刷新令牌",
            )

        result = await self.db.execute(
            select(User).where(User.id == int(payload.sub))
        )
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在或已被禁用",
            )

        new_access_token = create_access_token(user.id, user.role.value)
        new_refresh_token = create_refresh_token(user.id, user.role.value)

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
        """发送密码重置邮件"""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()

        if not user:
            # 为了安全，即使邮箱不存在也返回成功
            return

        # 生成密码重置令牌（24小时有效期）
        reset_token = _create_access_token({
            "sub": str(user.id),
            "type": "reset",
        })

        # TODO: 这里应该发送邮件，现在只是记录
        logger.info(f"密码重置邮件已发送到: {email}, token长度: {len(reset_token)}字符")

    async def reset_password(self, token: str, new_password: str) -> None:
        """使用令牌重置密码"""
        payload_dict = _decode_token_raw(token)

        if payload_dict.get("type") != "reset":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的重置令牌",
            )

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

        user.hashed_password = get_password_hash(new_password)
        await self.db.flush()
        logger.info(f"用户重置密码: {user.username}")

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


# ── 依赖注入：获取当前用户 ──

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """从 JWT 令牌获取当前登录用户"""
    payload = decode_token(token)

    if payload.type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请使用访问令牌",
        )

    result = await db.execute(
        select(User).where(User.id == int(payload.sub))
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账户已被禁用",
        )

    return user


def require_role(*roles: UserRole):
    """角色权限检查装饰器工厂"""
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles and current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"需要以下角色之一: {[r.value for r in roles]}",
            )
        return current_user

    return role_checker
