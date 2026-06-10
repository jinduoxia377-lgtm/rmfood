"""
增强的 JWT 认证工具类

功能:
- Access/Refresh Token 生成与验证
- Token 黑名单管理（支持强制登出）
- 密码强度验证与哈希
- 限流器（基于IP的登录频率限制）

安全特性:
- 使用 python-jose 进行 JWT 编解码
- 使用 passlib + bcrypt 进行密码哈希
- 支持Token类型区分（access/refresh）
- 完整的异常处理与日志记录
"""
import logging
import re
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Set

import bcrypt
from fastapi import HTTPException, status
from jose import jwt, JWTError

from ..core.config import settings

logger = logging.getLogger(__name__)

# ── Token 黑名单（支持 Redis 持久化 + 内存降级） ──
_token_blacklist: Set[str] = set()
_blacklist_lock = threading.Lock()
_redis_blacklist_client = None  # 延迟初始化


def _get_redis_blacklist():
    """获取 Redis 黑名单客户端（延迟初始化，失败则返回 None）"""
    global _redis_blacklist_client
    if _redis_blacklist_client is not None:
        return _redis_blacklist_client

    try:
        from ..core.config import settings
        if settings.redis_available and settings.redis_url:
            import redis
            _redis_blacklist_client = redis.from_url(
                settings.redis_url,
                decode_responses=True,
                db=1,  # 使用独立的 Redis DB 避免与缓存冲突
            )
            _redis_blacklist_client.ping()
            logger.info("✅ Token 黑名单已连接 Redis (db=1)")
            return _redis_blacklist_client
    except Exception as e:
        logger.warning(f"⚠️ Redis 黑名单不可用，降级到内存存储: {e}")

    return None

# ── 登录限流器（内存存储，生产环境应使用Redis） ──
_login_attempts: Dict[str, list] = {}  # {ip: [timestamp1, timestamp2, ...]}
_rate_limit_lock = threading.Lock()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    创建访问令牌 (Access Token)

    Args:
        data: 要编码到token中的数据（通常包含 user_id, role 等）
        expires_delta: 自定义过期时间，默认使用配置值

    Returns:
        str: 编码后的JWT字符串
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)

    payload = {
        **data,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
        "jti": _generate_jti(),  # JWT ID，用于唯一标识和撤销
    }

    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    logger.debug(f"创建访问令牌成功，用户ID: {data.get('sub')}")
    return token


def create_refresh_token(user_id: str) -> str:
    """
    创建刷新令牌 (Refresh Token)

    Args:
        user_id: 用户ID

    Returns:
        str: 编码后的Refresh Token
    """
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    payload = {
        "sub": user_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
        "jti": _generate_jti(),
    }

    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    logger.info(f"创建刷新令牌成功，用户ID: {user_id}")
    return token


def decode_token(token: str) -> dict:
    """
    解码并验证Token

    Args:
        token: JWT字符串

    Returns:
        dict: 解码后的payload

    Raises:
        HTTPException: Token无效或过期
    """
    # 检查是否在黑名单中
    if is_token_blacklisted(token):
        logger.warning("尝试使用已注销的Token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="认证令牌已失效，请重新登录",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload

    except jwt.ExpiredSignatureError:
        logger.warning(f"Token已过期")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="认证令牌已过期，请重新登录",
            headers={"WWW-Authenticate": "Bearer"},
        )

    except JWTError as e:
        logger.warning(f"无效的Token: {type(e).__name__}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="认证令牌无效或格式错误",
            headers={"WWW-Authenticate": "Bearer"},
        )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码

    Args:
        plain_password: 明文密码
        hashed_password: 哈希密码

    Returns:
        bool: 密码是否匹配
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8'),
        )
    except Exception as e:
        logger.error(f"密码验证失败: {e}")
        return False


def get_password_hash(password: str) -> str:
    """
    生成密码哈希

    Args:
        password: 明文密码

    Returns:
        str: 哈希后的密码
    """
    return bcrypt.hashpw(
        password.encode('utf-8'),
        bcrypt.gensalt(),
    ).decode('utf-8')


# ── Token 黑名单管理 ──

def add_token_to_blacklist(token: str) -> bool:
    """
    将Token加入黑名单（用于强制登出）

    优先写入 Redis（持久化），同时写入内存（快速查询）。
    Redis 中使用 Token 的 JTI 作为 key，TTL 设为 Token 剩余有效期。

    Args:
        token: 要注销的Token

    Returns:
        bool: 是否成功添加
    """
    with _blacklist_lock:
        try:
            # 先解码以获取过期时间（不验证签名，仅提取信息）
            payload = jwt.get_unverified_claims(token)
            exp = payload.get("exp")
            jti = payload.get("jti", "")

            if exp:
                # 如果Token已过期，无需加入黑名单
                if datetime.fromtimestamp(exp, timezone.utc) < datetime.now(timezone.utc):
                    logger.debug("Token已过期，无需加入黑名单")
                    return True
                ttl = int(exp - datetime.now(timezone.utc).timestamp())
            else:
                ttl = settings.access_token_expire_minutes * 60  # 默认 TTL

            # 写入内存黑名单
            _token_blacklist.add(token)

            # 写入 Redis 黑名单（如果可用）
            redis_client = _get_redis_blacklist()
            if redis_client:
                try:
                    # 使用 JTI 作为 key（更高效），TTL 设为 Token 剩余有效期
                    redis_key = f"token_blacklist:{jti}" if jti else f"token_blacklist:{hash(token)}"
                    redis_client.setex(redis_key, ttl, "1")
                    logger.debug(f"Token 已加入 Redis 黑名单: {redis_key} (TTL={ttl}s)")
                except Exception as e:
                    logger.warning(f"Redis 黑名单写入失败（降级到内存）: {e}")

            logger.info(f"Token已加入黑名单，当前内存黑名单大小: {len(_token_blacklist)}")
            return True

        except Exception as e:
            logger.error(f"将Token加入黑名单失败: {e}")
            return False


def is_token_blacklisted(token: str) -> bool:
    """
    检查Token是否在黑名单中

    优先检查内存（最快），未命中则检查 Redis。

    Args:
        token: 要检查的Token

    Returns:
        bool: 是否在黑名单中
    """
    # 内存命中（最快）
    with _blacklist_lock:
        if token in _token_blacklist:
            return True

    # Redis 查询
    redis_client = _get_redis_blacklist()
    if redis_client:
        try:
            payload = jwt.get_unverified_claims(token)
            jti = payload.get("jti", "")
            redis_key = f"token_blacklist:{jti}" if jti else f"token_blacklist:{hash(token)}"
            if redis_client.exists(redis_key):
                # 回填内存黑名单
                with _blacklist_lock:
                    _token_blacklist.add(token)
                return True
        except Exception as e:
            logger.debug(f"Redis 黑名单查询失败: {e}")

    return False


def cleanup_expired_tokens() -> int:
    """
    清理过期的黑名单Token（定期调用以释放内存）

    Redis 中的 Token 通过 TTL 自动过期，此处仅清理内存。

    Returns:
        int: 清理的数量
    """
    cleaned_count = 0
    current_time = datetime.now(timezone.utc)

    with _blacklist_lock:
        tokens_to_remove = []
        for token in _token_blacklist:
            try:
                payload = jwt.get_unverified_claims(token)
                exp = payload.get("exp")
                if exp and datetime.fromtimestamp(exp, timezone.utc) < current_time:
                    tokens_to_remove.append(token)
            except Exception:
                tokens_to_remove.append(token)

        for token in tokens_to_remove:
            _token_blacklist.discard(token)
            cleaned_count += 1

    if cleaned_count > 0:
        logger.info(f"清理了 {cleaned_count} 个过期的内存黑名单Token")

    return cleaned_count


# ── 登录限流 ──

def check_rate_limit(ip_address: str, max_attempts: int = 10, window_seconds: int = 60) -> tuple[bool, int]:
    """
    检查登录频率限制

    Args:
        ip_address: 客户端IP地址
        max_attempts: 时间窗口内最大尝试次数（默认10次）
        window_seconds: 时间窗口大小（默认60秒）

    Returns:
        tuple[bool, int]: (是否允许请求, 剩余重试次数)
    """
    current_time = datetime.now(timezone.utc).timestamp()

    with _rate_limit_lock:
        if ip_address not in _login_attempts:
            _login_attempts[ip_address] = []

        # 清理超出时间窗口的旧记录
        _login_attempts[ip_address] = [
            ts for ts in _login_attempts[ip_address]
            if current_time - ts < window_seconds
        ]

        attempt_count = len(_login_attempts[ip_address])

        if attempt_count >= max_attempts:
            remaining_time = int(window_seconds - (current_time - _login_attempts[ip_address][0]))
            logger.warning(
                f"IP {ip_address} 触发登录限流，"
                f"当前尝试次数: {attempt_count}，需等待 {remaining_time} 秒"
            )
            return False, 0

        # 记录本次尝试
        _login_attempts[ip_address].append(current_time)
        remaining = max_attempts - len(_login_attempts[ip_address])
        return True, remaining


def clear_rate_limit(ip_address: str) -> None:
    """
    清除指定IP的限流记录（登录成功后调用）

    Args:
        ip_address: 客户端IP地址
    """
    with _rate_limit_lock:
        if ip_address in _login_attempts:
            del _login_attempts[ip_address]
            logger.debug(f"已清除 IP {ip_address} 的限流记录")


# ── 密码强度验证 ──

def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    验证密码强度

    要求:
    - 最少8位字符
    - 包含大写字母
    - 包含小写字母
    - 包含数字
    - 可选：包含特殊字符（增加安全性）

    Args:
        password: 待验证的密码

    Returns:
        tuple[bool, str]: (是否通过验证, 错误消息或空字符串)
    """
    if len(password) < 8:
        return False, "密码长度至少需要8位"

    has_upper = re.search(r'[A-Z]', password) is not None
    has_lower = re.search(r'[a-z]', password) is not None
    has_digit = re.search(r'\d', password) is not None

    errors = []

    if not has_upper:
        errors.append("至少包含一个大写字母")
    if not has_lower:
        errors.append("至少包含一个小写字母")
    if not has_digit:
        errors.append("至少包含一个数字")

    if errors:
        return False, f"密码不符合要求：{'；'.join(errors)}"

    return True, ""


# ── 辅助函数 ──

def _generate_jti() -> str:
    """生成唯一的JWT ID"""
    import uuid
    return str(uuid.uuid4())
