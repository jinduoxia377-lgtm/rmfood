"""用户级版本（plan）功能门控 —— 单一事实来源

实现「免费版 / 专业版」功能分割（docs/tenant-isolation-segmentation-plan.md 第三节）。

设计要点
--------
- plan 是**用户级**字段（User.plan: 'free' | 'pro'）；'enterprise' 保留给组织级
  Subscription.plan（见 models/organization.py:77），Phase 1 不引入用户级 enterprise。
- 默认 'free'（直接注册）；**白名单通过 → plan='free' + 归入「莱茵分子白名单组织」**，
  该组织成员经组织授予获得一部分专业版功能（见 WHITELIST_ORG_GRANTED_FEATURES），
  不改 User.plan（白名单用户仍 free）。
- PLAN_RANK / PLAN_FEATURES 与前端 frontend/src/utils/plan.ts 必须一致
  （以规格 2.2 功能矩阵为单一事实来源；一致性由规格 4.4 约束）。

使用
----
    from app.core.plans import require_plan, has_plan, effective_plan

    # FastAPI 依赖（风格对齐 core/rbac/rbac.py 的 require_role）：
    @router.post("/ai/generate")
    async def generate(user: User = Depends(require_plan("ai_formula_generation"))):
        ...
"""

from typing import Callable

# ── 版本层级（规格 2.3 / 3.1）──
# free=0, pro=1, enterprise=2（enterprise 为组织级保留位，用户级 Phase 1 不用）
PLAN_RANK: dict[str, int] = {"free": 0, "pro": 1, "enterprise": 2}

# ── 功能矩阵（规格 2.2，单一事实来源）──
# 功能 key → 最低 plan 版本。未列出的基础功能（配方查询、食材库、基础对话、
# 合规查询）对 free 开放，因此不在矩阵中，has_plan 对未知 key 放行。
PLAN_FEATURES: dict[str, str] = {
    "ai_formula_generation": "pro",      # AI 配方生成（遗传算法/多目标/MILP）
    "peptide_analysis": "pro",           # 肽分析 / 肽设计
    "advanced_analytics": "pro",         # 高级分析 / 实验
    "knowledge_graph": "pro",            # 知识图谱
    "multi_ecommerce_sync": "pro",       # 多电商同步
    "advanced_report_export": "pro",     # 专业报告导出
}

# ── 白名单组织授予（租户隔离扩展：「免费版 + 部分专业版功能」）──
# 白名单组织「莱茵分子白名单组织」对其成员授予一部分专业版功能；成员 plan 仍为 'free'
# （免费版基础）+ 组织授予子集，不改 User.plan。子集为配置项，须为 PLAN_FEATURES 的子集。
WHITELIST_ORG_NAME = "莱茵分子白名单组织"
WHITELIST_ORG_GRANTED_FEATURES: frozenset[str] = frozenset({
    "ai_formula_generation",   # AI 配方生成（核心科学功能）
    "peptide_analysis",        # 肽段分析（核心科学功能）
    "advanced_analytics",      # 高级分析（核心科学功能）
    # 不授予 knowledge_graph / multi_ecommerce_sync / advanced_report_export
})
# 子集校验：若配置项超出 PLAN_FEATURES，属配置错误，导入期即暴露（fail-fast）。
assert WHITELIST_ORG_GRANTED_FEATURES <= frozenset(PLAN_FEATURES), (
    "WHITELIST_ORG_GRANTED_FEATURES 必须为 PLAN_FEATURES 的子集"
)


def effective_plan(user) -> str:
    """返回用户的有效 plan（规格 2.3）。

    归一化到已知层级，脏值回落 'free'，避免脏数据把用户打成不可用。
    """
    plan = getattr(user, "plan", "free") or "free"
    return plan if plan in PLAN_RANK else "free"


def has_plan(user, feature: str, org_id: int | None = None) -> bool:
    """判断用户是否满足某功能的版本门槛（规格 2.3）。

    has_plan(user, feature) -> PLAN_RANK[user.plan] >= PLAN_RANK[PLAN_FEATURES[feature]]

    未在功能矩阵中的 feature（基础功能）默认放行，不阻断既有 free 流程。

    组织授予（租户隔离扩展）：当用户 plan 判定**不满足**时，若
    feature ∈ WHITELIST_ORG_GRANTED_FEATURES 且用户属于「莱茵分子白名单组织」
    （user.organization_id == 白名单组织 id），返回 True（免费版 + 组织授予子集）。

    Args:
        user: 用户对象（需具备 .plan / .organization_id）。
        feature: 功能 key。
        org_id: 可选，白名单组织 id。FastAPI 的 require_plan 传入（避免缓存依赖）；
            为 None 时回退到 core/whitelist_org.is_whitelist_member（进程内缓存判定）。
            注意：org_id 为 None 且缓存未命中/过期时 is_whitelist_member 保守返回
            False（冷缓存误拒，见 P2-6）；需权威判定请改用 has_plan_async（可查库）。
    """
    required_plan = PLAN_FEATURES.get(feature)
    if required_plan is None:
        return True  # 基础功能，free 可用
    user_rank = PLAN_RANK.get(effective_plan(user), 0)
    required_rank = PLAN_RANK.get(required_plan, 0)
    if user_rank >= required_rank:
        return True

    # ── 组织授予（白名单组织成员 = 免费版 + 部分专业版功能）──
    if feature in WHITELIST_ORG_GRANTED_FEATURES:
        if org_id is not None:
            # 显式 org_id（require_plan 解析，确定性，不依赖缓存）
            return getattr(user, "organization_id", None) == org_id
        # 回退缓存判定（User.has_feature / 直接调用）
        from .whitelist_org import is_whitelist_member
        return is_whitelist_member(user)

    return False


async def has_plan_async(user, feature: str, db, org_id: int | None = None) -> bool:
    """has_plan 的 async 版本（org_id 缺省时可查库确认，冷缓存不误拒）。

    与 has_plan 同语义，但 org_id 为 None 时的组织授予回退判定改用
    core/whitelist_org.is_whitelist_member_async：缓存未命中/过期时查库确认，
    避免冷启动/缓存过期把白名单成员误判为 False（P2-6）。
    FastAPI 的 require_plan 依赖使用本函数（已持有 db 会话）。
    """
    required_plan = PLAN_FEATURES.get(feature)
    if required_plan is None:
        return True  # 基础功能，free 可用
    user_rank = PLAN_RANK.get(effective_plan(user), 0)
    required_rank = PLAN_RANK.get(required_plan, 0)
    if user_rank >= required_rank:
        return True

    # ── 组织授予（白名单组织成员 = 免费版 + 部分专业版功能）──
    if feature in WHITELIST_ORG_GRANTED_FEATURES:
        if org_id is not None:
            # 显式 org_id（require_plan 解析，确定性，不依赖缓存）
            return getattr(user, "organization_id", None) == org_id
        # 查库确认（权威，冷缓存不误拒）
        from .whitelist_org import is_whitelist_member_async
        return await is_whitelist_member_async(db, user)

    return False


def require_plan(feature: str) -> Callable:
    """FastAPI 依赖工厂：要求当前用户满足指定功能的版本门槛。

    用法（对齐 core/rbac/rbac.py require_role 的工厂风格）::

        @router.post("/ai/generate")
        async def generate(user: User = Depends(require_plan("ai_formula_generation"))):
            ...

    不满足 → 403，detail 含 error_code="PLAN_REQUIRED" 与 upgrade_required 提示。

    Args:
        feature: 功能 key。建议使用 PLAN_FEATURES 中矩阵 key；矩阵外的未知 key
            由 has_plan 放行（基础功能对 free 开放），不阻断既有 free 流程。
    """
    from fastapi import Depends, HTTPException, status
    from sqlalchemy.ext.asyncio import AsyncSession

    from ..api.deps import get_current_active_user, get_db_session
    from ..models import User

    # required_plan 仅用于 403 错误详情展示；矩阵外的未知 key 由 has_plan 放行
    # （基础功能对 free 开放，return True），故该默认值不构成未知 key 的门控，
    # 仅当 feature 在矩阵中且用户不满足时，用于 detail.required_plan 的呈现。
    required_plan = PLAN_FEATURES.get(feature, "pro")
    # 组织授予提示：当 feature 在白名单授予子集时，403 详情标记 granted_by=whitelist_org，
    # 便于前端展示「该功能对白名单组织成员开放」的替代解锁路径。
    org_grant_hint = feature in WHITELIST_ORG_GRANTED_FEATURES

    async def _plan_checker(
        current_user: User = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db_session),
    ) -> User:
        # 解析白名单组织 id（组织授予判定用）；组织不存在 → None，不授予、不阻断。
        from .whitelist_org import get_whitelist_org_id

        org_id = await get_whitelist_org_id(db)
        if not await has_plan_async(current_user, feature, db, org_id=org_id):
            detail = {
                "error_code": "PLAN_REQUIRED",
                "message": f"该功能需要 {required_plan} 及以上版本，请升级后使用",
                "feature": feature,
                "required_plan": required_plan,
                "current_plan": effective_plan(current_user),
                "upgrade_required": True,
                "hint": "升级到专业版即可解锁该功能",
            }
            if org_grant_hint:
                detail["granted_by"] = "whitelist_org"
                detail["org_grant_hint"] = f"该功能对「{WHITELIST_ORG_NAME}」成员开放（组织授予）"
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detail,
            )
        return current_user

    return _plan_checker
