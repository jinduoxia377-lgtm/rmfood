"""用户级版本（plan）功能门控 —— 单一事实来源

实现「免费版 / 专业版」功能分割（docs/tenant-isolation-segmentation-plan.md 第三节）。

设计要点
--------
- plan 是**用户级**字段（User.plan: 'free' | 'pro'）；'enterprise' 保留给组织级
  Subscription.plan（见 models/organization.py:77），Phase 1 不引入用户级 enterprise。
- 默认 'free'（直接注册）；**白名单通过 → plan='pro'**（白名单即专业分割的授予通道）。
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


def effective_plan(user) -> str:
    """返回用户的有效 plan（规格 2.3）。

    归一化到已知层级，脏值回落 'free'，避免脏数据把用户打成不可用。
    """
    plan = getattr(user, "plan", "free") or "free"
    return plan if plan in PLAN_RANK else "free"


def has_plan(user, feature: str) -> bool:
    """判断用户是否满足某功能的版本门槛（规格 2.3）。

    has_plan(user, feature) -> PLAN_RANK[user.plan] >= PLAN_RANK[PLAN_FEATURES[feature]]

    未在功能矩阵中的 feature（基础功能）默认放行，不阻断既有 free 流程。
    """
    required_plan = PLAN_FEATURES.get(feature)
    if required_plan is None:
        return True  # 基础功能，free 可用
    user_rank = PLAN_RANK.get(effective_plan(user), 0)
    required_rank = PLAN_RANK.get(required_plan, 0)
    return user_rank >= required_rank


def require_plan(feature: str) -> Callable:
    """FastAPI 依赖工厂：要求当前用户满足指定功能的版本门槛。

    用法（对齐 core/rbac/rbac.py require_role 的工厂风格）::

        @router.post("/ai/generate")
        async def generate(user: User = Depends(require_plan("ai_formula_generation"))):
            ...

    不满足 → 403，detail 含 error_code="PLAN_REQUIRED" 与 upgrade_required 提示。

    Args:
        feature: 功能 key（须在 PLAN_FEATURES 中）。
    """
    from fastapi import Depends, HTTPException, status
    from ..api.deps import get_current_active_user
    from ..models import User

    # 功能未在矩阵中时，默认要求 pro（防御：避免把未知 key 放行成免费）
    required_plan = PLAN_FEATURES.get(feature, "pro")

    async def _plan_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if not has_plan(current_user, feature):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "PLAN_REQUIRED",
                    "message": f"该功能需要 {required_plan} 及以上版本，请升级后使用",
                    "feature": feature,
                    "required_plan": required_plan,
                    "current_plan": effective_plan(current_user),
                    "upgrade_required": True,
                    "hint": "升级到专业版即可解锁该功能",
                },
            )
        return current_user

    return _plan_checker
