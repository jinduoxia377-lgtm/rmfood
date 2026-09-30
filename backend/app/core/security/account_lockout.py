"""
RMFOOD 账号锁定机制

安全功能:
- ✅ 登录失败次数限制
- ✅ 自动账号锁定（可配置阈值和时长）
- ✅ 锁定状态检查
- ✅ 锁定时间自动过期
- ✅ 管理员手动解锁
- ✅ 安全日志记录

配置参数 (在 config.py 中):
    - MAX_LOGIN_ATTEMPTS: 最大登录失败次数（默认5次）
    - LOCKOUT_DURATION: 锁定持续时间（默认15分钟）

使用方法:
    from app.core.security.account_lockout import AccountLockout
    
    lockout = AccountLockout()
    
    # 记录失败尝试
    await lockout.record_failed_attempt(db, user, ip_address)
    
    # 检查是否被锁定
    is_locked, lock_info = await lockout.is_account_locked(db, user)
    
    # 成功登录后重置计数器
    await lockout.reset_login_attempts(db, user)
    
    # 管理员手动解锁
    await lockout.manual_unlock(db, user_id, admin_user)

作者: RMFOOD Team
日期: 2026-05-02
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class AccountLockout:
    """
    账号锁定管理类
    
    提供完整的账号锁定功能，防止暴力破解攻击。
    
    Attributes:
        max_attempts (int): 最大允许的登录失败次数
        lockout_duration (timedelta): 锁定持续时间
    """
    
    def __init__(
        self,
        max_attempts: int = 5,
        lockout_duration_minutes: int = 15
    ):
        """
        初始化账号锁定管理器
        
        Args:
            max_attempts: 最大登录失败次数（默认5次）
            lockout_duration_minutes: 锁定持续时间（默认15分钟）
        """
        self.max_attempts = max_attempts
        self.lockout_duration = timedelta(minutes=lockout_duration_minutes)
        
        logger.info(
            f"✅ 账号锁定机制已初始化\n"
            f"   最大失败次数: {max_attempts}\n"
            f"   锁定时长: {lockout_duration_minutes}分钟"
        )
    
    async def is_account_locked(
        self,
        db: AsyncSession,
        username: str
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        检查账号是否被锁定
        
        Args:
            db: 数据库会话
            username: 用户名
            
        Returns:
            Tuple[bool, Optional[Dict]]: 
                - 第一个元素: 是否被锁定
                - 第二个元素: 锁定信息（如果被锁定）
                  * remaining_time: 剩余锁定时间（秒）
                  * locked_at: 锁定时间
                  * attempts: 失败次数
        """
        from app.models.user_model import User
        
        try:
            # 查询用户
            result = await db.execute(
                select(User).where(User.username == username)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                # 用户不存在，不算锁定（避免用户枚举攻击）
                return False, None
            
            # 检查锁定状态
            if user.locked_until and user.locked_until > datetime.now(timezone.utc):
                # 账号仍处于锁定状态
                remaining_seconds = (user.locked_until - datetime.now(timezone.utc)).total_seconds()
                
                lock_info = {
                    "remaining_time": int(remaining_seconds),
                    "locked_at": user.locked_until - self.lockout_duration,
                    "attempts": user.login_attempts or 0,
                    "max_attempts": self.max_attempts,
                    "lockout_duration_minutes": self.lockout_duration.total_seconds() / 60,
                }
                
                logger.warning(
                    f"⚠️  账号被锁定: {username}\n"
                    f"   剩余时间: {int(remaining_seconds)}秒\n"
                    f"   失败次数: {user.login_attempts}"
                )
                
                return True, lock_info
            
            # 检查是否已过锁定期但未自动解锁
            if user.locked_until and user.locked_until <= datetime.now(timezone.utc):
                # 锁定期已过，自动重置
                await self._auto_unlock(db, user)
                return False, None
            
            # 未锁定
            return False, None
            
        except Exception as e:
            logger.error(f"❌ 检查账号锁定状态失败: {e}")
            # 出错时默认不锁定（可用性优先）
            return False, None
    
    async def record_failed_attempt(
        self,
        db: AsyncSession,
        username: str,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        记录一次失败的登录尝试
        
        如果达到最大失败次数，自动锁定账号。
        
        Args:
            db: 数据库会话
            username: 用户名
            ip_address: 客户端IP地址（用于日志记录）
            
        Returns:
            Dict: 操作结果信息
              * success: 是否成功
              * attempts: 当前失败次数
              * locked: 是否已被锁定
              * remaining_attempts: 剩余尝试次数
              * message: 提示消息
        """
        from app.models.user_model import User
        
        result = {
            "success": True,
            "attempts": 0,
            "locked": False,
            "remaining_attempts": self.max_attempts,
            "message": "",
        }
        
        try:
            # 查询用户
            query_result = await db.execute(
                select(User).where(User.username == username)
            )
            user = query_result.scalar_one_or_none()
            
            if not user:
                # 用户不存在（避免泄露信息，返回通用错误）
                logger.warning(f"登录失败: 用户不存在 - {ip_address}")
                result["message"] = "用户名或密码错误"
                return result
            
            # 增加失败计数
            current_attempts = (user.login_attempts or 0) + 1
            user.login_attempts = current_attempts
            user.updated_at = datetime.utcnow()

            # 检查是否需要锁定
            if current_attempts >= self.max_attempts:
                # 达到阈值，锁定账号
                lock_until = datetime.utcnow() + self.lockout_duration
                user.locked_until = lock_until
                
                result["locked"] = True
                result["attempts"] = current_attempts
                result["remaining_attempts"] = 0
                result["message"] = (
                    f"账号已被临时锁定，请在{int(self.lockout_duration.total_seconds() // 60)}分钟后重试。"
                    f"如需立即解锁，请联系管理员。"
                )
                
                # 记录安全事件
                logger.warning(
                    f"🔒 账号已锁定:\n"
                    f"   用户: {username}\n"
                    f"   IP: {ip_address}\n"
                    f"   失败次数: {current_attempts}\n"
                    f"   解锁时间: {lock_until.strftime('%Y-%m-%d %H:%M:%S UTC')}"
                )
            else:
                # 未达阈值，提示剩余次数
                remaining = self.max_attempts - current_attempts
                
                result["attempts"] = current_attempts
                result["remaining_attempts"] = remaining
                result["message"] = (
                    f"用户名或密码错误，还剩{remaining}次尝试机会。"
                    if remaining > 0 else "账号已被临时锁定。"
                )
                
                logger.warning(
                    f"⚠️  登录失败:\n"
                    f"   用户: {username}\n"
                    f"   IP: {ip_address}\n"
                    f"   尝试次数: {current_attempts}/{self.max_attempts}"
                )
            
            # 保存更改
            await db.commit()
            
            return result
            
        except Exception as e:
            logger.error(f"❌ 记录失败尝试时出错: {e}")
            await db.rollback()
            result["success"] = False
            result["message"] = "系统错误，请稍后重试"
            return result
    
    async def reset_login_attempts(
        self,
        db: AsyncSession,
        user
    ) -> bool:
        """
        重置用户的登录失败计数器（成功登录后调用）
        
        Args:
            db: 数据库会话
            user: 用户对象
            
        Returns:
            bool: 是否成功重置
        """
        try:
            user.login_attempts = 0
            user.locked_until = None
            user.last_login = datetime.utcnow()
            user.updated_at = datetime.utcnow()
            
            await db.commit()
            
            logger.info(f"✅ 重置登录计数器: {user.username}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 重置登录计数器失败: {e}")
            await db.rollback()
            return False
    
    async def manual_unlock(
        self,
        db: AsyncSession,
        user_id: int,
        admin_user
    ) -> bool:
        """
        管理员手动解锁账号
        
        Args:
            db: 数据库会话
            user_id: 要解锁的用户ID
            admin_user: 执行解锁的管理员对象
            
        Returns:
            bool: 是否成功解锁
        """
        from app.models.user_model import User
        
        try:
            # 查询目标用户
            result = await db.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                logger.error(f"❌ 手动解锁失败: 用户不存在 (ID={user_id})")
                return False
            
            # 执行解锁
            was_locked = user.locked_until is not None and user.locked_until > datetime.now(timezone.utc)
            
            user.login_attempts = 0
            user.locked_until = None
            user.updated_at = datetime.now(timezone.utc)
            
            await db.commit()
            
            # 记录审计日志
            action_type = "手动解锁账号" if was_locked else "重置登录计数器"
            logger.info(
                f"🔓 管理员操作: {action_type}\n"
                f"   操作者: {admin_user.username} (ID={admin_user.id})\n"
                f"   目标用户: {user.username} (ID={user.id})\n"
                f"   原状态: {'已锁定' if was_locked else '未锁定'}"
            )
            
            return True
            
        except Exception as e:
            logger.error(f"❌ 手动解锁失败: {e}")
            await db.rollback()
            return False
    
    async def _auto_unlock(self, db: AsyncSession, user) -> None:
        """
        自动解锁账号（锁定期已过）
        
        Args:
            db: 数据库会话
            user: 用户对象
        """
        try:
            user.login_attempts = 0
            user.locked_until = None
            user.updated_at = datetime.now(timezone.utc)
            
            await db.commit()
            
            logger.info(f"🔓 自动解锁账号: {user.username}")
            
        except Exception as e:
            logger.error(f"❌ 自动解锁失败: {e}")
            await db.rollback()
    
    def get_lockout_response(self, lock_info: Dict[str, Any]) -> dict:
        """
        生成标准化的锁定响应
        
        Args:
            lock_info: 锁定信息字典
            
        Returns:
            dict: API响应格式
        """
        remaining_minutes = lock_info["remaining_time"] // 60
        remaining_seconds = lock_info["remaining_time"] % 60
        
        return {
            "detail": "账号已被临时锁定",
            "error_code": "ACCOUNT_LOCKED",
            "locked": True,
            "remaining_time": {
                "total_seconds": lock_info["remaining_time"],
                "minutes": remaining_minutes,
                "seconds": remaining_seconds,
            },
            "lockout_settings": {
                "max_attempts": lock_info["max_attempts"],
                "lockout_duration_minutes": lock_info["lockout_duration_minutes"],
            },
            "message": (
                f"由于多次登录失败，账号已被临时锁定。\n"
                f"剩余锁定时间: {remaining_minutes}分{remaining_seconds}秒\n"
                f"如需立即解锁，请联系系统管理员。"
            ),
            "hint": "请稍后重试或联系管理员解锁",
        }


async def cleanup_expired_locks() -> int:
    """
    清理已过锁定期但未自动解锁的账号。

    在应用启动时调用，确保所有锁定期已过期的账号恢复可用状态。

    Returns:
        int: 实际解锁的账号数量
    """
    from app.models.user_model import User
    from app.core.database.session import get_async_session

    cleaned = 0
    now = datetime.now(timezone.utc)
    async with get_async_session() as db:
        try:
            result = await db.execute(
                select(User).where(
                    User.locked_until.isnot(None),
                    User.locked_until < now,
                )
            )
            expired_users = result.scalars().all()
            for user in expired_users:
                user.login_attempts = 0
                user.locked_until = None
                user.updated_at = now
                logger.info(
                    f"[Startup] 自动解锁过期账号: {user.username} "
                    f"(锁定至 {user.locked_until})"
                )
            if expired_users:
                await db.commit()
                cleaned += len(expired_users)
        except Exception as e:
            logger.warning(f"[Startup] 清理过期锁定失败: {e}")
            await db.rollback()
    logger.info(f"[Startup] 账号锁定清理完成: 解锁 {cleaned} 个账号")
    return cleaned