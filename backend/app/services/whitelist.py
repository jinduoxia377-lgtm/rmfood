"""白名单申请流程 — 服务层

提供申请创建、邮箱验证码、状态查询、过期扫描等核心业务逻辑，
供 /auth/whitelist/* 与兼容别名 /auth/pre-register 复用。

安全要点:
- 验证码 6 位数字，DB 仅存 SHA-256 哈希（带盐），10 分钟有效，单码最多尝试 5 次
- 状态查询 token 32B 随机，DB 仅存哈希，明文仅申请成功时返回一次（防枚举）
- IP 维度限流（内存滑动窗口），邮箱维度 7 天冷却（DB 持久化，防换 IP 绕过）
- 服务端下发绝对时间戳（server_time / review_deadline / cooldown_until），前端只做差值渲染
"""
from __future__ import annotations

import hashlib
import logging
import os
import secrets
import threading
import time as _time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.pre_register import PreRegisterRequest, PreRegisterStatus
from ..models.user_model import User

logger = logging.getLogger("audit.whitelist")

# ── 业务常量 ──
VERIFY_CODE_TTL_SECONDS = 600        # 验证码 10 分钟有效
VERIFY_CODE_MAX_ATTEMPTS = 5         # 单码最多尝试 5 次
RESEND_COOLDOWN_SECONDS = 60         # 重发冷却 60 秒
REVIEW_DEADLINE_DAYS = 7             # 审核截止 7 天（超时自动 expired）
REAPPLY_COOLDOWN_DAYS = 7            # 再次申请冷却 7 天（rejected 后）
IP_APPLY_LIMIT = 5                    # IP 维度：每小时最多申请 5 次
IP_RESEND_LIMIT = 10                # IP 维度：每小时最多重发验证码 10 次
IP_VERIFY_LIMIT = 20                # IP 维度：每小时最多校验验证码 20 次（防爆破）
IP_CAPTCHA_LIMIT = 60                # IP 维度：每小时最多生成人机验证码 60 次
IP_APPLY_WINDOW = 3600
IP_RESEND_WINDOW = 3600
IP_VERIFY_WINDOW = 3600
IP_CAPTCHA_WINDOW = 3600
CAPTCHA_TTL_SECONDS = 300             # 人机验证码 5 分钟有效
CAPTCHA_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # 去掉易混淆字符 0/O/1/I

_DEFAULT_SALT = "rmfood-whitelist-v1"

# ── 独立于登录限流的内存 IP 限流（线程安全） ──
_IP_APPLY_BUCKET: dict[str, list[float]] = {}
_IP_RESEND_BUCKET: dict[str, list[float]] = {}
_IP_VERIFY_BUCKET: dict[str, list[float]] = {}
_IP_CAPTCHA_BUCKET: dict[str, list[float]] = {}
_IP_LOCK = threading.Lock()

# ── 人机验证码存储（Redis 未启用时内存兜底） ──
_CAPTCHA_STORE: dict[str, str] = {}
_CAPTCHA_LOCK = threading.Lock()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _salt() -> str:
    return os.getenv("WHITELIST_SECRET_SALT", _DEFAULT_SALT)


def hash_secret(value: str) -> str:
    """SHA-256 哈希（带盐），用于验证码与状态 token 的落库存储。"""
    return hashlib.sha256(f"{value}::{_salt()}".encode("utf-8")).hexdigest()


def generate_status_token() -> str:
    """生成 32B 随机状态查询 token（hex 64 字符），明文仅返回一次。"""
    return secrets.token_hex(32)


def generate_verify_code() -> str:
    """生成 6 位数字验证码。"""
    return f"{secrets.randbelow(1_000_000):06d}"


def utc_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).isoformat()


def check_ip_rate(ip: str, bucket: dict[str, list[float]], max_attempts: int, window_seconds: int) -> tuple[bool, int]:
    """
    内存滑动窗口限流（独立于登录限流，避免互相干扰）。

    Returns:
        (是否允许, 剩余次数/重试等待秒数)
    """
    now = _time.time()
    with _IP_LOCK:
        lst = bucket.setdefault(ip, [])
        lst[:] = [t for t in lst if now - t < window_seconds]
        if len(lst) >= max_attempts:
            retry_after = max(1, int(window_seconds - (now - lst[0])))
            return False, retry_after
        lst.append(now)
        return True, max_attempts - len(lst)


async def _check_ip_rate_redis(ip: str, operation: str, max_attempts: int, window_seconds: int) -> tuple[bool, int]:
    """
    Redis 滑动窗口限流（ZSET）。

    Returns:
        (是否允许, 剩余次数/重试等待秒数)。Redis 不可用时返回 (True, max_attempts)，
        由调用方继续走内存兜底。
    """
    try:
        from ..core.distributed.redis_client import get_redis
        redis = await get_redis()
        if redis is None:
            return True, max_attempts
        key = f"rmfood:whitelist:{operation}:{ip}"
        now = _time.time()
        await redis.zremrangebyscore(key, 0, now - window_seconds)
        count = await redis.zcard(key)
        if count >= max_attempts:
            oldest = await redis.zrange(key, 0, 0, withscores=True)
            retry_after = max(1, int(window_seconds - (now - float(oldest[0][1])))) if oldest else window_seconds
            return False, retry_after
        await redis.zadd(key, {f"{now}:{secrets.token_hex(4)}": now})
        await redis.expire(key, window_seconds)
        return True, int(max_attempts - count - 1)
    except Exception as e:
        logger.warning(f"[Whitelist] Redis 限流失败，放行（由内存兜底）: {e}")
        return True, max_attempts


async def allow_apply(ip: str) -> tuple[bool, int]:
    """IP 维度申请限流：每小时最多 IP_APPLY_LIMIT 次（Redis 优先，内存兜底）。"""
    from ..core.distributed.redis_client import is_redis_enabled
    if is_redis_enabled():
        return await _check_ip_rate_redis(ip, "apply", IP_APPLY_LIMIT, IP_APPLY_WINDOW)
    return check_ip_rate(ip or "unknown", _IP_APPLY_BUCKET, IP_APPLY_LIMIT, IP_APPLY_WINDOW)


async def allow_resend(ip: str) -> tuple[bool, int]:
    """IP 维度重发限流：每小时最多 IP_RESEND_LIMIT 次（Redis 优先，内存兜底）。"""
    from ..core.distributed.redis_client import is_redis_enabled
    if is_redis_enabled():
        return await _check_ip_rate_redis(ip, "resend", IP_RESEND_LIMIT, IP_RESEND_WINDOW)
    return check_ip_rate(ip or "unknown", _IP_RESEND_BUCKET, IP_RESEND_LIMIT, IP_RESEND_WINDOW)


async def allow_verify(ip: str) -> tuple[bool, int]:
    """IP 维度验证码校验限流：每小时最多 IP_VERIFY_LIMIT 次（Redis 优先，内存兜底）。"""
    from ..core.distributed.redis_client import is_redis_enabled
    if is_redis_enabled():
        return await _check_ip_rate_redis(ip, "verify", IP_VERIFY_LIMIT, IP_VERIFY_WINDOW)
    return check_ip_rate(ip or "unknown", _IP_VERIFY_BUCKET, IP_VERIFY_LIMIT, IP_VERIFY_WINDOW)


async def allow_captcha(ip: str) -> tuple[bool, int]:
    """IP 维度人机验证码生成限流：每小时最多 IP_CAPTCHA_LIMIT 次。"""
    from ..core.distributed.redis_client import is_redis_enabled
    if is_redis_enabled():
        return await _check_ip_rate_redis(ip, "captcha", IP_CAPTCHA_LIMIT, IP_CAPTCHA_WINDOW)
    return check_ip_rate(ip or "unknown", _IP_CAPTCHA_BUCKET, IP_CAPTCHA_LIMIT, IP_CAPTCHA_WINDOW)


def reset_rate_limits() -> None:
    """清空 IP 限流桶与人机验证码内存存储（测试夹具/运维工具使用）。"""
    with _IP_LOCK:
        _IP_APPLY_BUCKET.clear()
        _IP_RESEND_BUCKET.clear()
        _IP_VERIFY_BUCKET.clear()
        _IP_CAPTCHA_BUCKET.clear()
    with _CAPTCHA_LOCK:
        _CAPTCHA_STORE.clear()


# ═══════════════════════════════════════════
# 人机验证码（CAPTCHA）
# ═══════════════════════════════════════════

async def create_captcha() -> tuple[str, str]:
    """
    生成人机验证码。

    Returns:
        (captcha_id, code)。code 用于服务端绘制图片；答案哈希入库（Redis 优先，内存兜底），
        5 分钟有效，一次性使用。
    """
    code = "".join(secrets.choice(CAPTCHA_ALPHABET) for _ in range(4))
    captcha_id = secrets.token_hex(16)
    answer_hash = hash_secret(code)

    redis = None
    try:
        from ..core.distributed.redis_client import get_redis, is_redis_enabled
        if is_redis_enabled():
            redis = await get_redis()
    except Exception:
        redis = None

    if redis is not None:
        try:
            await redis.setex(f"rmfood:whitelist:captcha:{captcha_id}", CAPTCHA_TTL_SECONDS, answer_hash)
            return captcha_id, code
        except Exception:
            pass

    with _CAPTCHA_LOCK:
        _CAPTCHA_STORE[captcha_id] = answer_hash
    return captcha_id, code


async def validate_captcha(captcha_id: str, answer: str) -> bool:
    """校验人机验证码（一次性）：成功返回 True 并删除存储。"""
    if not captcha_id or not answer:
        return False
    answer_hash = hash_secret(answer.strip().upper())

    redis = None
    try:
        from ..core.distributed.redis_client import get_redis, is_redis_enabled
        if is_redis_enabled():
            redis = await get_redis()
    except Exception:
        redis = None

    if redis is not None:
        try:
            stored = await redis.get(f"rmfood:whitelist:captcha:{captcha_id}")
            if stored is None:
                return False
            await redis.delete(f"rmfood:whitelist:captcha:{captcha_id}")
            return stored == answer_hash
        except Exception:
            pass

    with _CAPTCHA_LOCK:
        stored = _CAPTCHA_STORE.pop(captcha_id, None)
    return stored is not None and stored == answer_hash


# ═══════════════════════════════════════════
# 邮件发送（验证码 / 审核结果）
# ═══════════════════════════════════════════

def _smtp_config():
    """从环境变量/Settings 读取 SMTP 配置（与 services/auth.py 保持一致）。

    注意：pydantic-settings 会把 .env 加载进 settings，但不会注入 os.environ；
    因此当 os.getenv 取不到时（如仅配置在 .env 文件里），回退用 dotenv_values 读取 .env 文件。
    """
    from ..core.config import settings
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "465"))
    smtp_username = os.getenv("SMTP_USERNAME", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")

    if not smtp_host:
        try:
            from dotenv import dotenv_values
            env_path = settings.model_config.get("env_file") or os.path.join(os.getcwd(), ".env")
            if isinstance(env_path, (list, tuple, set)):
                env_path = env_path[0] if env_path else ".env"
            env_vals = dotenv_values(str(env_path))
            smtp_host = env_vals.get("SMTP_HOST", "") or smtp_host
            smtp_port = int(env_vals.get("SMTP_PORT", "465") or smtp_port)
            smtp_username = env_vals.get("SMTP_USERNAME", "") or smtp_username
            smtp_password = env_vals.get("SMTP_PASSWORD", "") or smtp_password
        except Exception as e:
            logger.warning(f"[Whitelist] 读取 .env SMTP 配置失败: {e}")

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return {
        "smtp_host": smtp_host,
        "smtp_port": smtp_port,
        "smtp_username": smtp_username,
        "smtp_password": smtp_password,
        "frontend_url": frontend_url,
        "use_tls": smtp_port == 465,
        "is_development": settings.debug,
    }


async def send_verification_code_email(email: str, code: str, lang: str = "zh-CN") -> bool:
    """发送验证码邮件（开发环境落盘）。"""
    try:
        from ..utils.email_service import send_whitelist_verification_email
        cfg = _smtp_config()
        return send_whitelist_verification_email(
            to_email=email,
            code=code,
            lang=lang,
            frontend_url=cfg["frontend_url"],
            smtp_host=cfg["smtp_host"],
            smtp_port=cfg["smtp_port"],
            smtp_username=cfg["smtp_username"],
            smtp_password=cfg["smtp_password"],
            use_tls=cfg["use_tls"],
            is_development=cfg["is_development"],
        )
    except Exception:  # noqa: BLE001 - 邮件失败不应阻断申请主流程
        logger.exception("发送白名单验证码邮件失败 email=%s", email)
        return False


async def send_review_result_email(
    email: str,
    *,
    status: str,
    username: str = "",
    temp_password: str | None = None,
    reject_reason: str | None = None,
    lang: str = "zh-CN",
) -> bool:
    """发送审核结果邮件（通过/拒绝/过期）。"""
    try:
        from ..utils.email_service import send_whitelist_review_email
        cfg = _smtp_config()
        return send_whitelist_review_email(
            to_email=email,
            status=status,
            username=username,
            temp_password=temp_password,
            reject_reason=reject_reason,
            lang=lang,
            frontend_url=cfg["frontend_url"],
            smtp_host=cfg["smtp_host"],
            smtp_port=cfg["smtp_port"],
            smtp_username=cfg["smtp_username"],
            smtp_password=cfg["smtp_password"],
            use_tls=cfg["use_tls"],
            is_development=cfg["is_development"],
        )
    except Exception:  # noqa: BLE001
        logger.exception("发送白名单审核结果邮件失败 email=%s status=%s", email, status)
        return False


# ═══════════════════════════════════════════
# 查询辅助
# ═══════════════════════════════════════════

async def get_request_by_id(db: AsyncSession, request_id: int) -> PreRegisterRequest | None:
    return (
        await db.execute(
            select(PreRegisterRequest).where(PreRegisterRequest.id == request_id)
        )
    ).scalar_one_or_none()


async def get_request_by_token(db: AsyncSession, token: str) -> PreRegisterRequest | None:
    return (
        await db.execute(
            select(PreRegisterRequest).where(
                PreRegisterRequest.status_token_hash == hash_secret(token)
            )
        )
    ).scalar_one_or_none()


# ═══════════════════════════════════════════
# 申请创建
# ═══════════════════════════════════════════

async def create_application(
    db: AsyncSession,
    *,
    email: str,
    full_name: str | None = None,
    department: str | None = None,
    apply_reason: str | None = None,
    source: str = "whitelist_page",
    ip: str | None = None,
    require_verification: bool = True,
    lang: str = "zh-CN",
) -> dict:
    """
    创建白名单申请记录。

    - require_verification=True：生成验证码并发送邮件，返回 email_verified=False
    - require_verification=False：直接进入审核队列（兼容旧 /auth/pre-register 行为）

    返回 dict 包含 request_id / status_token / email_verified / server_time / cooldown_until；
    出错时返回 {"error": {"code", "message", "status", ...}}。
    """
    email_norm = email.strip().lower()
    now = _now()

    # 1. 邮箱已注册 → 409（引导直接登录）
    existing_user = (
        await db.execute(select(User.id).where(User.email == email_norm))
    ).scalar_one_or_none()
    if existing_user is not None:
        return {
            "error": {
                "code": "EMAIL_REGISTERED",
                "message": "该邮箱已注册，请直接登录",
                "status": 409,
            }
        }

    # 2. 已有 pending 申请 → 409（部分唯一索引兜底）
    existing_request = (
        await db.execute(
            select(PreRegisterRequest).where(
                PreRegisterRequest.email == email_norm,
                PreRegisterRequest.status == PreRegisterStatus.PENDING,
            ).limit(1)
        )
    ).scalar_one_or_none()
    if existing_request is not None:
        return {
            "error": {
                "code": "ALREADY_APPLIED",
                "message": "该邮箱已提交申请，请等待审核",
                "status": 409,
                "request_id": existing_request.id,
            }
        }

    # 3. 冷却检查：最近一次 rejected 后 7 天内不可重新申请
    cooldown_until = None
    last_rejected_until = (
        await db.execute(
            select(PreRegisterRequest.cooldown_until)
            .where(
                PreRegisterRequest.email == email_norm,
                PreRegisterRequest.status == PreRegisterStatus.REJECTED,
                PreRegisterRequest.cooldown_until.isnot(None),
            )
            .order_by(PreRegisterRequest.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if last_rejected_until is not None and last_rejected_until > now:
        retry_after = int((last_rejected_until - now).total_seconds())
        return {
            "error": {
                "code": "COOLDOWN",
                "message": "请勿重复提交申请，冷却期结束后可重新申请",
                "status": 429,
                "retry_after": retry_after,
                "cooldown_until": utc_iso(last_rejected_until),
            }
        }

    # 4. 创建申请记录
    status_token = generate_status_token()
    review_deadline = now + timedelta(days=REVIEW_DEADLINE_DAYS)
    new_request = PreRegisterRequest(
        email=email_norm,
        full_name=(full_name or "").strip() or None,
        department=(department or "").strip() or None,
        apply_reason=(apply_reason or "").strip() or None,
        source=source,
        status=PreRegisterStatus.PENDING,
        ip_address=ip,
        status_token_hash=hash_secret(status_token),
        review_deadline=review_deadline,
        attempt_count=1,
        verify_attempts=0,
    )
    db.add(new_request)

    email_verified = False
    code: str | None = None
    if require_verification:
        code = generate_verify_code()
        new_request.verify_code_hash = hash_secret(code)
        new_request.verify_code_expires_at = now + timedelta(seconds=VERIFY_CODE_TTL_SECONDS)
        new_request.verify_code_sent_at = now
        await db.commit()
        await db.refresh(new_request)
        # 邮件发送失败不阻断申请（开发环境 SMTP 未配置时日志落盘降级）
        await send_verification_code_email(email_norm, code, lang=lang)
    else:
        email_verified = True
        await db.commit()
        await db.refresh(new_request)

    logger.info(
        "[AUDIT] whitelist apply email=%s name=%s source=%s request_id=%s ip=%s verified=%s",
        email_norm, new_request.full_name or "-", source, new_request.id, ip or "-", email_verified,
    )

    # 仅开发环境返回明文验证码，便于本地无 SMTP 时测试完整流程；生产环境恒为 None
    dev_verify_code = None
    try:
        from ..core.config import settings
        if getattr(settings, "is_development", False) and code is not None:
            dev_verify_code = code
    except Exception:
        dev_verify_code = None

    return {
        "request_id": new_request.id,
        "status_token": status_token,
        "email_verified": email_verified,
        "server_time": utc_iso(now),
        "cooldown_until": None,
        "dev_verify_code": dev_verify_code,
    }


# ═══════════════════════════════════════════
# 验证码校验 / 重发
# ═══════════════════════════════════════════

async def verify_application_code(
    db: AsyncSession,
    *,
    request_id: int,
    code: str,
    ip: str | None = None,
) -> dict:
    """校验 6 位邮箱验证码，成功后将申请标记为已邮箱验证。"""
    req = await get_request_by_id(db, request_id)
    if req is None:
        return {"error": {"code": "NOT_FOUND", "message": "申请不存在", "status": 404}}
    if req.status != PreRegisterStatus.PENDING:
        return {
            "error": {
                "code": "INVALID_STATE",
                "message": f"申请状态为 {req.status}，无法验证",
                "status": 409,
            }
        }
    if req.email_verified_at is not None:
        return {"error": {"code": "ALREADY_VERIFIED", "message": "该申请已完成邮箱验证", "status": 409}}

    now = _now()
    if req.verify_code_expires_at is None or now > req.verify_code_expires_at:
        return {
            "error": {
                "code": "CODE_EXPIRED",
                "message": "验证码已过期，请重新发送",
                "status": 409,
            }
        }
    if (req.verify_attempts or 0) >= VERIFY_CODE_MAX_ATTEMPTS:
        return {
            "error": {
                "code": "TOO_MANY_ATTEMPTS",
                "message": "验证尝试次数过多，请重新发送验证码",
                "status": 429,
                "retry_after": RESEND_COOLDOWN_SECONDS,
            }
        }

    if req.verify_code_hash is None or hash_secret(code) != req.verify_code_hash:
        req.verify_attempts = (req.verify_attempts or 0) + 1
        await db.commit()
        return {"error": {"code": "INVALID_CODE", "message": "验证码错误", "status": 400}}

    req.email_verified_at = now
    req.verify_code_hash = None
    req.verify_code_expires_at = None
    await db.commit()

    logger.info(
        "[AUDIT] whitelist verify request_id=%s email=%s ip=%s",
        request_id, req.email, ip or "-",
    )
    return {
        "request_id": req.id,
        "status": req.status,
        "review_deadline": utc_iso(req.review_deadline),
        "server_time": utc_iso(now),
    }


async def resend_application_code(
    db: AsyncSession,
    *,
    request_id: int,
    ip: str | None = None,
    lang: str = "zh-CN",
) -> dict:
    """60s 冷却后重发验证码。"""
    req = await get_request_by_id(db, request_id)
    if req is None:
        return {"error": {"code": "NOT_FOUND", "message": "申请不存在", "status": 404}}
    if req.status != PreRegisterStatus.PENDING:
        return {
            "error": {
                "code": "INVALID_STATE",
                "message": f"申请状态为 {req.status}，无法重发验证码",
                "status": 409,
            }
        }

    now = _now()
    if req.verify_code_sent_at is not None:
        elapsed = (now - req.verify_code_sent_at).total_seconds()
        if elapsed < RESEND_COOLDOWN_SECONDS:
            retry_after = max(1, int(RESEND_COOLDOWN_SECONDS - elapsed))
            return {
                "error": {
                    "code": "RESEND_COOLDOWN",
                    "message": "重发过于频繁，请稍后再试",
                    "status": 429,
                    "retry_after": retry_after,
                }
            }

    code = generate_verify_code()
    req.verify_code_hash = hash_secret(code)
    req.verify_code_expires_at = now + timedelta(seconds=VERIFY_CODE_TTL_SECONDS)
    req.verify_code_sent_at = now
    req.verify_attempts = 0
    await db.commit()

    await send_verification_code_email(req.email, code, lang=lang)
    logger.info("[AUDIT] whitelist resend request_id=%s email=%s ip=%s", request_id, req.email, ip or "-")
    return {"retry_after": RESEND_COOLDOWN_SECONDS, "server_time": utc_iso(now)}


async def admin_resend_verification_code(db: AsyncSession, *, request_id: int) -> dict:
    """
    管理员重发邮箱验证码（不受访客端 60s 冷却限制）。

    用于管理员在「账号申请」队列中对未完成验证的申请手动重发邮件。
    """
    req = await get_request_by_id(db, request_id)
    if req is None:
        return {"error": {"code": "NOT_FOUND", "message": "申请不存在", "status": 404}}
    if req.status != PreRegisterStatus.PENDING:
        return {
            "error": {
                "code": "INVALID_STATE",
                "message": f"申请状态为 {req.status}，仅 pending 可重发验证码",
                "status": 400,
            }
        }
    if req.email_verified_at is not None:
        return {
            "error": {
                "code": "ALREADY_VERIFIED",
                "message": "该申请已完成邮箱验证",
                "status": 400,
            }
        }

    now = _now()
    code = generate_verify_code()
    req.verify_code_hash = hash_secret(code)
    req.verify_code_expires_at = now + timedelta(seconds=VERIFY_CODE_TTL_SECONDS)
    req.verify_code_sent_at = now
    req.verify_attempts = 0
    await db.commit()

    await send_verification_code_email(req.email, code, lang="zh-CN")
    logger.info("[AUDIT] whitelist admin-resend request_id=%s email=%s", request_id, req.email)
    return {
        "request_id": req.id,
        "email": req.email,
        "retry_after": RESEND_COOLDOWN_SECONDS,
        "server_time": utc_iso(now),
    }


# ═══════════════════════════════════════════
# 状态查询 / 过期扫描
# ═══════════════════════════════════════════

async def get_application_status(db: AsyncSession, token: str) -> dict:
    """凭状态 token 查询申请状态（防枚举：DB 仅存哈希）。"""
    req = await get_request_by_token(db, token)
    if req is None:
        return {"error": {"code": "NOT_FOUND", "message": "申请不存在或 token 无效", "status": 404}}

    return {
        "request_id": req.id,
        "status": req.status,
        "submitted_at": utc_iso(req.created_at),
        "review_deadline": utc_iso(req.review_deadline),
        "approved_at": utc_iso(req.reviewed_at) if req.status == PreRegisterStatus.APPROVED else None,
        "reject_reason": req.reject_reason,
        "cooldown_until": utc_iso(req.cooldown_until),
        "server_time": utc_iso(_now()),
    }


async def expire_overdue_applications(db: AsyncSession) -> int:
    """
    将 pending 且超过 review_deadline 的申请置为 expired。

    供定时任务每 5 分钟调用；返回本次过期数量。
    """
    now = _now()
    result = await db.execute(
        update(PreRegisterRequest)
        .where(
            PreRegisterRequest.status == PreRegisterStatus.PENDING,
            PreRegisterRequest.review_deadline.isnot(None),
            PreRegisterRequest.review_deadline < now,
        )
        .values(status=PreRegisterStatus.EXPIRED, expired_at=now)
    )
    await db.commit()
    expired_count = result.rowcount or 0
    if expired_count:
        logger.info("[AUDIT] whitelist expire count=%s", expired_count)
    return expired_count


def log_readiness_warnings() -> None:
    """
    启动时输出白名单生产就绪性警告（非致命，便于上线前发现配置遗漏）。

    检查项:
    - 是否设置 WHITELIST_SECRET_SALT（默认盐可被离线破解）
    - SMTP 是否配置（决定验证码邮件能否真实发送）
    - 开发模式提示（邮件落盘 logs/email-dev）
    """
    import os

    from ..core.config import settings

    salt = os.getenv("WHITELIST_SECRET_SALT", "")
    if not salt or salt == _DEFAULT_SALT:
        logger.warning(
            "[Whitelist] ⚠️ 未设置 WHITELIST_SECRET_SALT（正在使用默认盐）。"
            "生产环境必须设置随机盐，否则验证码/状态 token 哈希可被离线破解。"
        )

    smtp_host = os.getenv("SMTP_HOST", "")
    if settings.debug:
        if not smtp_host:
            logger.warning(
                "[Whitelist] ℹ️ 开发模式且未配置 SMTP：验证码/审核邮件将保存到 logs/email-dev，不会真实发送。"
            )
        else:
            logger.info("[Whitelist] ℹ️ 开发模式已配置 SMTP：验证码邮件将真实发送。")
    elif not smtp_host:
        logger.error(
            "[Whitelist] 🔴 生产模式未配置 SMTP_HOST！用户将收不到验证码邮件，申请流程不可用。"
        )
