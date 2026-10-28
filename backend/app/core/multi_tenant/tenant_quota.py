"""
多租户配额管理系统 (Tenant Quota Management)

院士级升级[Phase 4-B]: 限制每个租户的资源使用量，防止单租户占用过多资源

架构设计：
- TenantQuota: 配额定义（每个租户可配置不同的限额）
- QuotaType: 配额类型枚举（配方数/推理任务/API调用/存储空间等）
- QuotaChecker: 配额检查器（操作前检查是否超限）
- QuotaMeter: 配额计量器（记录使用量）
- require_quota: FastAPI Depends（路由级配额检查装饰器）

存储方案：
- 有 Redis 时：使用 Redis Hash + INBY 存储配额计数器（跨实例共享）
- 无 Redis 时：使用内存字典（单实例开发）

使用示例：
    # 路由级配额检查
    @router.post("/formulas")
    async def create_formula(
        _quota=Depends(require_quota(QuotaType.FORMULAS)),
        ...
    ):
        # 如果超限，已自动返回 429

    # 手动检查配额
    checker = get_quota_checker()
    if await checker.check(org_id=1, quota_type=QuotaType.AI_TASKS):
        # 配额充足，可以执行
        ...
    else:
        raise HTTPException(429, "AI 推理任务配额已用尽")
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from fastapi import Depends, HTTPException, Request, status

logger = logging.getLogger("rmfood.tenant.quota")
audit_logger = logging.getLogger("rmfood.tenant.quota.audit")


# ── 配额类型 ──────────────────────────────────────────────────

class QuotaType(str, Enum):
    """配额类型"""
    FORMULAS = "formulas"              # 配方数量（个）
    AI_TASKS = "ai_tasks"              # AI 推理任务（次/天）
    AI_TOKENS = "ai_tokens"            # AI Token 消耗（tokens/天）
    API_CALLS = "api_calls"            # API 调用次数（次/天）
    STORAGE_MB = "storage_mb"          # 存储空间（MB）
    EXPORTS = "exports"                # 导出次数（次/天）
    CONCURRENT_TASKS = "concurrent"    # 并发任务数（个）
    TEAM_MEMBERS = "team_members"      # 团队成员数（个）


# ── 配额定义 ──────────────────────────────────────────────────

# 默认配额（免费版）
DEFAULT_QUOTAS: Dict[QuotaType, int] = {
    QuotaType.FORMULAS: 50,
    QuotaType.AI_TASKS: 20,
    QuotaType.AI_TOKENS: 50000,
    QuotaType.API_CALLS: 1000,
    QuotaType.STORAGE_MB: 500,
    QuotaType.EXPORTS: 10,
    QuotaType.CONCURRENT_TASKS: 2,
    QuotaType.TEAM_MEMBERS: 5,
}

# 专业版配额
PRO_QUOTAS: Dict[QuotaType, int] = {
    QuotaType.FORMULAS: 500,
    QuotaType.AI_TASKS: 200,
    QuotaType.AI_TOKENS: 500000,
    QuotaType.API_CALLS: 10000,
    QuotaType.STORAGE_MB: 5000,
    QuotaType.EXPORTS: 100,
    QuotaType.CONCURRENT_TASKS: 5,
    QuotaType.TEAM_MEMBERS: 20,
}

# 企业版配额（-1 表示无限制）
ENTERPRISE_QUOTAS: Dict[QuotaType, int] = {
    QuotaType.FORMULAS: -1,           # 无限制
    QuotaType.AI_TASKS: -1,
    QuotaType.AI_TOKENS: -1,
    QuotaType.API_CALLS: -1,
    QuotaType.STORAGE_MB: -1,
    QuotaType.EXPORTS: -1,
    QuotaType.CONCURRENT_TASKS: 20,
    QuotaType.TEAM_MEMBERS: -1,
}

# 配额方案映射
QUOTA_PLANS = {
    "free": DEFAULT_QUOTAS,
    "pro": PRO_QUOTAS,
    "enterprise": ENTERPRISE_QUOTAS,
}


@dataclass
class TenantQuota:
    """租户配额定义"""
    org_id: int
    plan: str = "free"                  # free / pro / enterprise
    custom_limits: Dict[QuotaType, int] = field(default_factory=dict)
    custom_overrides: Dict[str, int] = field(default_factory=dict)  # JSON 兼容

    def get_limit(self, quota_type: QuotaType) -> int:
        """获取指定类型的配额上限"""
        # 优先使用自定义限额
        if quota_type in self.custom_limits:
            return self.custom_limits[quota_type]
        # 其次使用方案默认值
        plan_quotas = QUOTA_PLANS.get(self.plan, DEFAULT_QUOTAS)
        return plan_quotas.get(quota_type, 0)

    def is_unlimited(self, quota_type: QuotaType) -> bool:
        """检查是否为无限制配额"""
        return self.get_limit(quota_type) == -1


@dataclass
class QuotaUsage:
    """配额使用量"""
    org_id: int
    quota_type: QuotaType
    current: int = 0
    limit: int = 0
    remaining: int = 0
    period: str = "daily"               # daily / monthly / total
    reset_at: Optional[float] = None

    @property
    def usage_pct(self) -> float:
        if self.limit <= 0:
            return 0.0
        return round((self.current / self.limit) * 100, 1)

    @property
    def is_exceeded(self) -> bool:
        return self.limit != -1 and self.current >= self.limit

    def to_dict(self) -> Dict[str, Any]:
        return {
            "org_id": self.org_id,
            "quota_type": self.quota_type.value,
            "current": self.current,
            "limit": self.limit,
            "remaining": self.remaining if self.limit != -1 else -1,
            "usage_pct": self.usage_pct,
            "period": self.period,
            "is_exceeded": self.is_exceeded,
        }


# ── 配额计量器 ────────────────────────────────────────────────

class QuotaMeter:
    """
    配额计量器（记录使用量）

    存储方案：
    - Redis: 使用 Hash 存储每日计数器 + TTL 自动过期
    - 内存: 使用字典存储（开发/测试用）
    """

    # Redis Key 格式: rmfood:quota:{org_id}:{quota_type}:{date}
    KEY_PREFIX = "rmfood:quota"
    DAY_SECONDS = 86400

    def __init__(self, redis_url: Optional[str] = None):
        self._redis_url = redis_url
        self._redis = None
        self._memory: Dict[str, int] = {}  # 内存回退

    async def _get_redis(self):
        """获取 Redis 连接"""
        if self._redis is None and self._redis_url:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(
                self._redis_url,
                decode_responses=True,
                socket_timeout=3.0,
                socket_connect_timeout=3.0,
            )
        return self._redis

    def _day_key(self, org_id: int, quota_type: QuotaType) -> str:
        """生成当日计数器 Key"""
        date_str = time.strftime("%Y%m%d")
        return f"{self.KEY_PREFIX}:{org_id}:{quota_type.value}:{date_str}"

    async def increment(
        self,
        org_id: int,
        quota_type: QuotaType,
        amount: int = 1,
    ) -> int:
        """
        增加配额使用量，返回新值

        Args:
            org_id: 租户 ID
            quota_type: 配额类型
            amount: 增加量（默认 1）

        Returns:
            更新后的使用量
        """
        key = self._day_key(org_id, quota_type)
        redis = await self._get_redis()

        if redis:
            try:
                # 使用 Redis INCRBY 原子增加 + 设置 TTL
                new_val = await redis.incrby(key, amount)
                if new_val == amount:
                    # 首次写入，设置 TTL（2 天后自动过期）
                    await redis.expire(key, self.DAY_SECONDS * 2)
                return new_val
            except Exception as e:
                logger.info("[QuotaMeter] Redis INCRBY 失败，降级到内存: %s", e)

        # 内存回退
        current = self._memory.get(key, 0)
        new_val = current + amount
        self._memory[key] = new_val
        return new_val

    async def get_usage(
        self,
        org_id: int,
        quota_type: QuotaType,
    ) -> int:
        """获取当前使用量"""
        key = self._day_key(org_id, quota_type)
        redis = await self._get_redis()

        if redis:
            try:
                val = await redis.get(key)
                return int(val) if val else 0
            except Exception as e:
                logger.info("[QuotaMeter] Redis GET 失败，降级到内存: %s", e)

        return self._memory.get(key, 0)

    async def reset(self, org_id: int, quota_type: QuotaType) -> None:
        """重置使用量（管理员操作）"""
        key = self._day_key(org_id, quota_type)
        redis = await self._get_redis()

        if redis:
            try:
                await redis.delete(key)
                return
            except Exception as e:
                logger.info("[QuotaMeter] Redis DELETE 失败: %s", e)

        self._memory.pop(key, None)

    async def close(self) -> None:
        """关闭连接"""
        if self._redis:
            await self._redis.close()
            self._redis = None


# ── 配额检查器 ────────────────────────────────────────────────

class QuotaChecker:
    """
    配额检查器（操作前检查是否超限）

    使用流程：
    1. 从配置/数据库获取租户配额定义
    2. 从计量器获取当前使用量
    3. 比较使用量和配额上限
    4. 返回检查结果（通过/超限）
    """

    def __init__(
        self,
        meter: QuotaMeter,
        quota_provider: Optional[Callable] = None,
    ):
        """
        Args:
            meter: 配额计量器
            quota_provider: 配额定义提供函数（org_id → TenantQuota）
                默认使用 plan="free" 的默认配额
        """
        self._meter = meter
        self._quota_provider = quota_provider or self._default_provider
        # 简单缓存（避免每次检查都查询数据库）
        self._quota_cache: Dict[int, TenantQuota] = {}

    def _default_provider(self, org_id: int) -> TenantQuota:
        """默认配额提供函数（所有租户使用免费版配额）"""
        return TenantQuota(org_id=org_id, plan="free")

    def set_quota_provider(self, provider: Callable) -> None:
        """设置配额提供函数"""
        self._quota_provider = provider
        self._quota_cache.clear()

    def set_tenant_quota(self, org_id: int, quota: TenantQuota) -> None:
        """设置指定租户的配额"""
        self._quota_cache[org_id] = quota

    async def check(
        self,
        org_id: int,
        quota_type: QuotaType,
        amount: int = 1,
    ) -> bool:
        """
        检查配额是否充足

        Args:
            org_id: 租户 ID
            quota_type: 配额类型
            amount: 需要消耗的量

        Returns:
            True: 配额充足 / False: 配额不足
        """
        if org_id is None:
            return True  # 无租户上下文时放行

        quota = self._quota_cache.get(org_id) or self._quota_provider(org_id)
        limit = quota.get_limit(quota_type)

        # -1 表示无限制
        if limit == -1:
            return True

        current = await self._meter.get_usage(org_id, quota_type)

        if current + amount > limit:
            audit_logger.warning(
                "[QuotaCheck] 租户 %d 配额超限: type=%s current=%d + %d > limit=%d",
                org_id, quota_type.value, current, amount, limit,
            )
            return False

        return True

    async def consume(
        self,
        org_id: int,
        quota_type: QuotaType,
        amount: int = 1,
    ) -> QuotaUsage:
        """
        消耗配额（检查 + 计量一步完成）

        如果配额不足，不消耗并返回超限状态。
        """
        if org_id is None:
            return QuotaUsage(org_id=0, quota_type=quota_type, limit=-1)

        quota = self._quota_cache.get(org_id) or self._quota_provider(org_id)
        limit = quota.get_limit(quota_type)

        if limit == -1:
            current = await self._meter.get_usage(org_id, quota_type)
            return QuotaUsage(
                org_id=org_id, quota_type=quota_type,
                current=current, limit=-1, remaining=-1,
            )

        # 先检查再消耗
        current = await self._meter.get_usage(org_id, quota_type)
        if current + amount > limit:
            return QuotaUsage(
                org_id=org_id, quota_type=quota_type,
                current=current, limit=limit,
                remaining=max(0, limit - current),
            )

        # 消耗
        new_val = await self._meter.increment(org_id, quota_type, amount)
        return QuotaUsage(
            org_id=org_id, quota_type=quota_type,
            current=new_val, limit=limit,
            remaining=max(0, limit - new_val),
        )

    async def get_usage(
        self,
        org_id: int,
        quota_type: QuotaType,
    ) -> QuotaUsage:
        """获取配额使用情况"""
        if org_id is None:
            return QuotaUsage(org_id=0, quota_type=quota_type, limit=-1)

        quota = self._quota_cache.get(org_id) or self._quota_provider(org_id)
        limit = quota.get_limit(quota_type)
        current = await self._meter.get_usage(org_id, quota_type)

        return QuotaUsage(
            org_id=org_id, quota_type=quota_type,
            current=current, limit=limit,
            remaining=max(0, limit - current) if limit != -1 else -1,
        )

    async def get_all_usage(self, org_id: int) -> List[QuotaUsage]:
        """获取租户所有配额使用情况"""
        if org_id is None:
            return []

        quota = self._quota_cache.get(org_id) or self._quota_provider(org_id)
        usages = []
        for qt in QuotaType:
            usage = await self.get_usage(org_id, qt)
            usages.append(usage)
        return usages


# ── FastAPI 依赖注入 ──────────────────────────────────────────

def require_quota(quota_type: QuotaType, amount: int = 1):
    """
    FastAPI Depends：配额检查装饰器

    用法：
        @router.post("/formulas")
        async def create_formula(
            _quota=Depends(require_quota(QuotaType.FORMULAS)),
            ...
        ):
            ...

    超限时自动返回 HTTP 429 Too Many Requests
    """
    async def _check_quota(request: Request):
        # 从请求中获取 org_id（由 TenantMiddleware 设置）
        org_id = getattr(request.state, "org_id", None)
        if org_id is None:
            return  # 无租户上下文时放行

        checker = get_quota_checker()
        usage = await checker.consume(org_id, quota_type, amount)

        if usage.is_exceeded:
            # 将配额信息写入响应头
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "quota_exceeded",
                    "quota_type": quota_type.value,
                    "current": usage.current,
                    "limit": usage.limit,
                    "message": (
                        f"配额已用尽: {quota_type.value} "
                        f"(当前 {usage.current}/{usage.limit})"
                    ),
                },
            )

        # 配额信息写入 request.state（路由可用）
        request.state.quota_usage = usage

    return _check_quota


# ── 全局单例 ──────────────────────────────────────────────────

_meter: Optional[QuotaMeter] = None
_checker: Optional[QuotaChecker] = None


def init_quota_system(redis_url: Optional[str] = None) -> QuotaChecker:
    """初始化配额管理系统"""
    global _meter, _checker
    _meter = QuotaMeter(redis_url=redis_url)
    _checker = QuotaChecker(meter=_meter)
    logger.info(
        "[QuotaSystem] 配额管理系统已初始化 (storage=%s)",
        "redis" if redis_url else "memory",
    )
    return _checker


def get_quota_checker() -> QuotaChecker:
    """获取配额检查器（延迟初始化）"""
    global _checker
    if _checker is None:
        _checker = init_quota_system()
    return _checker


def get_quota_meter() -> QuotaMeter:
    """获取配额计量器"""
    global _meter
    if _meter is None:
        init_quota_system()
    return _meter


async def close_quota_system() -> None:
    """关闭配额管理系统"""
    global _meter, _checker
    if _meter:
        await _meter.close()
        _meter = None
    _checker = None
    logger.info("[QuotaSystem] 配额管理系统已关闭")


# ── plan 感知的配额 provider（② 配额安全接线）──────────────────
#
# 背景：QuotaChecker._default_provider 硬编码 plan="free"，且 set_quota_provider
# 从未被调用 → 所有租户都按免费版限额执行，pro/enterprise 租户被错误限制。
#
# 实现：provider 是**同步函数**（在 async check/consume 内被调用），而本应用的
# 数据库访问全部是 async engine（app/core/database/session.py 无 sync engine，
# 也没有 create_engine 的同步实例），无法在同步 provider 里直接读 DB。
# 因此采用「启动时加载 org_id→plan 内存缓存 + 运行时未命中回退 free」策略：
#   - refresh_org_plan_cache(db)    从 organizations 表加载所有租户 plan 到缓存
#   - plan_aware_quota_provider()   同步 provider，读缓存，未命中/非法 plan 回退 free
#   - ensure_plan_aware_provider()  一次性把 provider 挂到全局 checker（幂等）
#   - wire_plan_aware_quota()       lifespan 启动时调用：加载缓存 + 挂载 provider
#
# 注意：应用启动后新建/变更的组织在下次 refresh_org_plan_cache()（或重启）前
# 仍按缓存中的旧 plan 计算；缓存未命中的组织回退 plan="free"（安全默认）。

_org_plan_cache: Dict[int, str] = {}
_plan_provider_wired: bool = False


def get_org_plan(org_id: int) -> str:
    """读取组织 plan（内存缓存；未命中回退 "free"）"""
    plan = _org_plan_cache.get(org_id, "free")
    if plan not in QUOTA_PLANS:
        return "free"
    return plan


def plan_aware_quota_provider(org_id: int) -> TenantQuota:
    """同步配额 provider：根据 organizations.plan 返回正确的 TenantQuota。

    这是 `(org_id) -> TenantQuota` 形状的同步函数，供 QuotaChecker.set_quota_provider
    使用。plan 来自启动时加载的 org_id→plan 缓存；缓存未命中或 plan 非法时回退
    plan="free"（保守，避免错误放大到 pro/enterprise 之外的未知 plan）。
    """
    return TenantQuota(org_id=org_id, plan=get_org_plan(org_id))


async def refresh_org_plan_cache(db) -> int:
    """从 organizations 表加载所有租户 plan 到内存缓存。

    启动时 / 组织 plan 变更后调用。返回成功加载的组织数（0 表示失败，缓存保持为空，
    此时所有组织按 free 处理）。
    """
    global _org_plan_cache
    plans: Dict[int, str] = {}
    try:
        from sqlalchemy import select as sa_select
        from app.models.organization import Organization
        result = await db.execute(sa_select(Organization.id, Organization.plan))
        for row in result.fetchall():
            plan = (row.plan or "free") if row.plan else "free"
            if plan not in QUOTA_PLANS:
                plan = "free"
            plans[int(row.id)] = plan
    except Exception as e:  # noqa: BLE001
        logger.warning("[QuotaPlan] 加载组织 plan 缓存失败，全部回退 free: %s", e)
        _org_plan_cache = {}
        return 0
    _org_plan_cache = plans
    logger.info("[QuotaPlan] 已加载 %d 个租户 plan 到缓存", len(plans))
    return len(plans)


def ensure_plan_aware_provider() -> bool:
    """把 plan 感知 provider 挂到全局 checker（幂等，只生效一次）。

    返回 True 表示 provider 已挂载（首次或此前已挂载）。
    """
    global _plan_provider_wired
    if _plan_provider_wired:
        return True
    get_quota_checker().set_quota_provider(plan_aware_quota_provider)
    _plan_provider_wired = True
    logger.info("[QuotaPlan] plan 感知 quota provider 已挂载到全局 checker")
    return True


async def wire_plan_aware_quota(db=None) -> int:
    """启动时一次性初始化：加载 plan 缓存并挂载 provider。

    传 db（AsyncSession）时直接使用；否则自行创建会话。返回加载的组织数。
    """
    if db is None:
        from app.core.database.session import get_session_factory
        factory = get_session_factory()
        async with factory() as session:
            count = await refresh_org_plan_cache(session)
    else:
        count = await refresh_org_plan_cache(db)
    ensure_plan_aware_provider()
    return count


# 模块导入即挂载 provider：保证即使走不到 lifespan 的路径（脚本/测试/单测）
# 也默认使用 plan 感知 provider（缓存为空时回退 free）。plan 缓存由
# wire_plan_aware_quota() 在应用启动时填充。此调用幂等，只会生效一次。
ensure_plan_aware_provider()
