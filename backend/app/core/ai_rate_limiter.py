"""
AI 端点精细化限流器

按用户 + 操作类型 + 角色进行限流，防止 AI API 费用暴增。

使用方式:
    from app.core.ai_rate_limiter import ai_rate_limit

    @router.post("/generate")
    async def generate_formula(
        ...,
        _rate_limit: None = Depends(ai_rate_limit("formula_generation")),
    ):
        ...

限流策略:
- Admin:       无限制
- Formulator:  标准限制
- Researcher:  标准限制
- Guest:       严格限制（50%配额）

操作类型限制:
- formula_generation: 每用户 10次/分钟, 100次/小时
- peptide_analysis:   每用户 20次/分钟, 200次/小时
- ai_chat:           每用户 30次/分钟, 300次/小时
- default:           每用户 15次/分钟, 150次/小时
"""
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from fastapi import Depends, HTTPException, Request, status

logger = logging.getLogger(__name__)


@dataclass
class AILimitConfig:
    """AI 操作限流配置"""
    per_minute: int = 15       # 每分钟最大请求
    per_hour: int = 150        # 每小时最大请求
    burst: int = 5             # 突发请求（连续请求间隔 < 2秒 时的额外限制）


# ── 各操作类型的限流配置 ──
AI_LIMITS: Dict[str, AILimitConfig] = {
    "formula_generation": AILimitConfig(per_minute=10, per_hour=100, burst=3),
    "formula_optimization": AILimitConfig(per_minute=10, per_hour=100, burst=3),
    "peptide_analysis": AILimitConfig(per_minute=20, per_hour=200, burst=5),
    "peptide_design": AILimitConfig(per_minute=10, per_hour=100, burst=3),
    "ai_chat": AILimitConfig(per_minute=30, per_hour=300, burst=10),
    "ai_recommendation": AILimitConfig(per_minute=20, per_hour=200, burst=5),
    "ai_template": AILimitConfig(per_minute=20, per_hour=200, burst=5),
}

# ── 角色限流倍率 ──
ROLE_MULTIPLIERS: Dict[str, float] = {
    "admin": 999.0,      # Admin 无限制
    "formulator": 1.0,   # 标准限制
    "researcher": 1.0,   # 标准限制
    "reviewer": 0.8,     # 稍低限制
    "guest": 0.5,        # 严格限制（50%配额）
}

DEFAULT_LIMIT = AILimitConfig(per_minute=15, per_hour=150, burst=5)


class AIRateLimiter:
    """
    AI 端点限流器（按用户 + 操作类型）

    使用滑动窗口算法，支持:
    - 每分钟限制
    - 每小时限制
    - 突发请求限制（连续请求间隔 < 2秒）
    """

    def __init__(self):
        # {user_id: {operation: [timestamp1, timestamp2, ...]}}
        self._windows: Dict[int, Dict[str, List[float]]] = defaultdict(
            lambda: defaultdict(list)
        )
        # {user_id: {operation: last_request_time}}
        self._last_request: Dict[int, Dict[str, float]] = defaultdict(dict)
        self._cleanup_interval = 300
        self._last_cleanup = time.time()

    def check(
        self,
        user_id: int,
        operation: str,
        role: str = "researcher",
    ) -> Tuple[bool, Optional[int]]:
        """
        检查是否允许请求。

        Args:
            user_id: 用户 ID
            operation: AI 操作类型
            role: 用户角色

        Returns:
            (is_allowed, retry_after_seconds)
        """
        now = time.time()
        config = AI_LIMITS.get(operation, DEFAULT_LIMIT)

        # 应用角色倍率
        multiplier = ROLE_MULTIPLIERS.get(role, 1.0)
        effective_per_minute = int(config.per_minute * multiplier)
        effective_per_hour = int(config.per_hour * multiplier)
        effective_burst = int(config.burst * multiplier)

        # Admin 无限制
        if multiplier >= 999:
            return True, None

        # 定期清理旧记录
        if now - self._last_cleanup > self._cleanup_interval:
            self._cleanup()
            self._last_cleanup = now

        # ── 突发限制 ──
        last_time = self._last_request[user_id].get(operation, 0)
        if now - last_time < 2.0:  # 间隔 < 2秒 视为突发
            recent_count = sum(
                1 for t in self._windows[user_id][operation]
                if now - t < 2.0
            )
            if recent_count >= effective_burst:
                logger.warning(
                    f"AI 端点突发限流 | user={user_id} | op={operation} | role={role} | "
                    f"burst={recent_count}/{effective_burst}"
                )
                return False, 2

        # ── 每分钟限制 ──
        window = self._windows[user_id][operation]
        minute_count = sum(1 for t in window if now - t < 60)
        if minute_count >= effective_per_minute:
            oldest_in_window = min(t for t in window if now - t < 60)
            retry_after = int(60 - (now - oldest_in_window)) + 1
            logger.warning(
                f"AI 端点分钟限流 | user={user_id} | op={operation} | role={role} | "
                f"{minute_count}/{effective_per_minute}/min"
            )
            return False, retry_after

        # ── 每小时限制 ──
        hour_count = sum(1 for t in window if now - t < 3600)
        if hour_count >= effective_per_hour:
            oldest_in_hour = min(t for t in window if now - t < 3600)
            retry_after = int(3600 - (now - oldest_in_hour)) + 1
            logger.warning(
                f"AI 端点小时限流 | user={user_id} | op={operation} | role={role} | "
                f"{hour_count}/{effective_per_hour}/hour"
            )
            return False, retry_after

        # ── 允许请求，记录时间戳 ──
        window.append(now)
        self._last_request[user_id][operation] = now

        return True, None

    def _cleanup(self):
        """清理过期的时间戳记录"""
        now = time.time()
        for user_id in list(self._windows.keys()):
            for operation in list(self._windows[user_id].keys()):
                self._windows[user_id][operation] = [
                    t for t in self._windows[user_id][operation]
                    if now - t < 3600  # 保留 1 小时内的记录
                ]
                if not self._windows[user_id][operation]:
                    del self._windows[user_id][operation]
            if not self._windows[user_id]:
                del self._windows[user_id]
                self._last_request.pop(user_id, None)

    def get_user_usage(self, user_id: int) -> Dict[str, Dict[str, int]]:
        """获取用户的 AI 使用量统计"""
        now = time.time()
        usage = {}
        for operation, window in self._windows.get(user_id, {}).items():
            minute_count = sum(1 for t in window if now - t < 60)
            hour_count = sum(1 for t in window if now - t < 3600)
            config = AI_LIMITS.get(operation, DEFAULT_LIMIT)
            usage[operation] = {
                "minute_used": minute_count,
                "minute_limit": config.per_minute,
                "hour_used": hour_count,
                "hour_limit": config.per_hour,
            }
        return usage


# 全局单例
_ai_limiter = AIRateLimiter()


def ai_rate_limit(operation: str):
    """
    AI 端点限流依赖工厂。

    使用方式:
        @router.post("/generate")
        async def generate_formula(
            ...,
            _rate_limit: None = Depends(ai_rate_limit("formula_generation")),
        ):
            ...
    """
    from ..api.deps import get_current_active_user
    from ..models.user_model import User

    async def _check_rate_limit(
        request: Request,
        current_user: User = Depends(get_current_active_user),
    ):
        # Admin 角色跳过限流
        from ..models.enums import UserRole
        if current_user.role == UserRole.ADMIN:
            return None

        allowed, retry_after = _ai_limiter.check(
            user_id=current_user.id,
            operation=operation,
            role=current_user.role.value,
        )

        if not allowed:
            config = AI_LIMITS.get(operation, DEFAULT_LIMIT)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error_code": "AI_RATE_LIMITED",
                    "message": f"AI 操作 '{operation}' 请求过于频繁",
                    "retry_after": retry_after,
                    "hint": f"每分钟限制 {config.per_minute} 次",
                },
                headers={"Retry-After": str(retry_after)},
            )

        return None

    return _check_rate_limit
