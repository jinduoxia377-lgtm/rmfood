"""
SafetyAlertSystem - API 接口

包含:
- Pydantic 请求/响应模型
- FastAPI 路由工厂函数
- 模块级单例
- 示例用法演示
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from .core import SafetyAlertSystem


logger = logging.getLogger(__name__)


# ============================================================
# Pydantic Models for API (5.4 API 接口模型)
# ============================================================

try:
    from pydantic import BaseModel, Field

    class FormulaIngredientInput(BaseModel):
        """配方成分输入"""
        name: str = Field(..., description="成分名称", min_length=1)
        amount_mg: float = Field(..., gt=0, description="含量 (mg)")
        percentage: Optional[float] = Field(None, ge=0, le=100, description="占比 (%)")

    class FormulaSafetyCheckRequest(BaseModel):
        """配方安全检查请求"""
        ingredients: List[FormulaIngredientInput] = Field(..., min_length=1, description="成分列表")
        daily_dosage_g: float = Field(10.0, gt=0, description="每日总剂量 (g)")
        target_group: str = Field("adult", description="目标人群")
        usage_scenario: str = Field("supplement", description="使用场景")

        model_config = {
            "json_schema_extra": {
                "examples": [{
                    "ingredients": [
                        {"name": "大豆异黄酮", "amount_mg": 80, "percentage": 15},
                        {"name": "维生素C", "amount_mg": 500, "percentage": 10},
                    ],
                    "daily_dosage_g": 10,
                    "target_group": "adult",
                    "usage_scenario": "supplement",
                }]
            }
        }

    class SafetyThresholdUpdate(BaseModel):
        """安全阈值更新请求"""
        soft_limit: Optional[float] = Field(None, gt=0, description="软阈值")
        hard_limit: Optional[float] = Field(None, gt=0, description="硬阈值")
        adi_value: Optional[float] = Field(None, ge=0, description="ADI 值")
        ul_value: Optional[float] = Field(None, ge=0, description="UL 值")
        source: Optional[str] = Field(None, max_length=200, description="数据来源")
        special_groups: Optional[Dict[str, float]] = Field(None, description="特殊人群配置")
        reason: Optional[str] = Field(None, max_length=500, description="更新原因")

    HAS_PYDANTIC = True
except ImportError:
    HAS_PYDANTIC = False
    logger.warning("Pydantic 未安装，API 模型将不可用")


# ============================================================
# FastAPI Router Implementation (5.4 API 端点)
# ============================================================

def create_safety_alert_router(safety_system: Optional[SafetyAlertSystem] = None):
    """
    创建安全预警系统的 FastAPI 路由器

    提供 3 个 API 端点:
    1. GET /formula/safety-thresholds - 查询阈值配置
    2. PUT /formula/safety-thresholds/{ingredient} - 管理员更新阈值
    3. POST /formula/check-safety - 实时安全检查

    Args:
        safety_system: SafetyAlertSystem 实例（可选，默认创建新实例）

    Returns:
        APIRouter: FastAPI 路由器
    """
    try:
        from fastapi import APIRouter, Depends, HTTPException, Query, status
        from ..api.deps import get_current_user
        from ..models.user_model import User
        from ..core.rbac.rbac import require_role
        from ..models.enums import UserRole
    except ImportError:
        logger.error("无法导入 FastAPI 依赖，API 路由将不可用")
        return None

    router = APIRouter(prefix="/formula", tags=["安全预警系统"])
    system = safety_system or SafetyAlertSystem()

    @router.get("/safety-thresholds", summary="查询安全阈值配置")
    async def get_safety_thresholds(
        ingredient: Optional[str] = Query(None, description="成分名称过滤"),
        include_special_groups: bool = Query(False, description="包含特殊人群配置"),
        include_source: bool = Query(True, description="包含数据来源"),
        current_user: User = Depends(get_current_user),
    ):
        """
        返回当前生效的安全阈值配置

        权限: 所有认证用户可访问

        Returns:
            {
                "version": "2024.01",
                "last_updated": "...",
                "thresholds": [...],
                "total_count": N
            }
        """
        thresholds = system.get_all_thresholds(
            include_special_groups=include_special_groups,
        )

        # 过滤
        if ingredient:
            thresholds = [
                t for t in thresholds
                if ingredient.lower() in t["ingredient_name"].lower()
            ]

        # 可选移除 source 字段
        if not include_source:
            for t in thresholds:
                t.pop("source", None)

        stats = system.get_statistics()

        return {
            "version": system._current_version,
            "last_updated": datetime.now().isoformat(),
            "thresholds": thresholds,
            "total_count": len(thresholds),
            "statistics": stats,
        }

    @router.put(
        "/safety-thresholds/{ingredient_name}",
        summary="更新安全阈值（管理员）",
    )
    async def update_safety_threshold(
        ingredient_name: str,
        updates: SafetyThresholdUpdate,
        current_user: User = Depends(require_role(UserRole.ADMIN)),
    ):
        """
        更新指定成分的安全阈值

        权限控制: 仅 admin 角色可调用

        操作日志:
        - 记录变更前后的值
        - 记录操作人和时间戳
        - 发送通知给其他管理员

        Returns:
            {
                "success": True,
                "updated_ingredient": "...",
                "changes": {...},
                "effective_immediately": True,
                "version": "..."
            }
        """
        try:
            update_data = updates.model_dump(exclude_none=True)
            reason = update_data.pop("reason", None)

            result = system.update_threshold(
                ingredient_name=ingredient_name,
                updates=update_data,
                operator=current_user.username or str(current_user.id),
                reason=reason,
            )

            return result

        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": sanitize_error(e, "资源未找到")}
            )
        except Exception as e:
            logger.error("更新阈值失败", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": "UPDATE_FAILED", "message": sanitize_error(e, "更新失败，请稍后重试")}
            )

    @router.post("/check-safety", summary="实时配方安全检查")
    async def check_formula_safety_api(
        request: FormulaSafetyCheckRequest,
        current_user: User = Depends(get_current_user),
    ):
        """
        实时检查配方安全性

        输入配方成分列表，返回三级判定结果。

        权限: 所有认证用户可访问

        Returns:
            {
                "is_safe": true/false,
                "overall_risk_score": 0-100,
                "alerts": [...],
                "blocked_by_critical": false,
                "recommendations": [...],
                "detailed_breakdown": {...}
            }
        """
        try:
            ingredients = [
                {"name": ing.name, "amount_mg": ing.amount_mg, "percentage": ing.percentage}
                for ing in request.ingredients
            ]

            result = system.check_formula_safety(
                ingredients=ingredients,
                daily_dosage_g=request.daily_dosage_g,
                target_group=request.target_group,
                usage_scenario=request.usage_scenario,
            )

            return result.to_dict()

        except Exception as e:
            logger.error("安全检查失败", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": "CHECK_FAILED", "message": sanitize_error(e, "安全检查失败，请稍后重试")}
            )

    @router.get("/safety-thresholds/search", summary="搜索成分")
    async def search_ingredients_api(
        q: str = Query(..., min_length=1, description="搜索关键词"),
        limit: int = Query(20, ge=1, le=100, description="返回数量"),
        current_user: User = Depends(get_current_user),
    ):
        """搜索可用成分"""
        results = system.search_ingredients(q, limit)
        return {
            "query": q,
            "results": results,
            "count": len(results),
        }

    @router.get("/safety-thresholds/history", summary="查询更新历史")
    async def get_update_history_api(
        ingredient: Optional[str] = Query(None, description="成分过滤"),
        limit: int = Query(50, ge=1, le=200, description="返回数量"),
        current_user: User = Depends(get_current_user),
    ):
        """查询阈值更新历史"""
        history = system.get_update_history(ingredient=ingredient, limit=limit)
        return {
            "history": history,
            "total": len(history),
        }

    logger.info("✅ 安全预警系统 API 路由已注册")

    return router

# ============================================================
# Module-level singleton & utilities
# ============================================================

_safety_system_instance: Optional[SafetyAlertSystem] = None


def get_safety_system() -> SafetyAlertSystem:
    """获取 SafetyAlertSystem 单例"""
    global _safety_system_instance
    if _safety_system_instance is None:
        _safety_system_instance = SafetyAlertSystem()
    return _safety_system_instance


# ============================================================
# Example Usage & Testing
# ============================================================

def example_usage():
    """示例用法演示"""

    logger.info("=" * 70)
    logger.info("SafetyAlertSystem 示例用法演示")
    logger.info("=" * 70)
    system = SafetyAlertSystem()

    # 示例 1: 查看统计信息
    logger.info("\n--- 示例 1: 系统统计 ---\n")
    stats = system.get_statistics()
    logger.info(f"总成分数量: {stats['total_ingredients']}")
    logger.info(f"内置阈值: {stats['builtin_count']}")
    logger.info(f"自定义阈值: {stats['custom_count']}")
    logger.info(f"当前版本: {stats['current_version']}")
    # 示例 2: 单个成分检查
    logger.info("\n--- 示例 2: 单个成分安全检查 ---\n")
    test_cases = [
        ("大豆异黄酮", 96, "adult"),      # 接近软阈值 (INFO)
        ("大豆异黄酮", 105, "adult"),     # 超过软阈值 (WARNING)
        ("大豆异黄酮", 130, "adult"),     # 超过硬阈值 (CRITICAL)
        ("人参皂苷", 210, "adult"),       # 接近软阈值 (INFO)
        ("人参皂苷", 260, "pregnant"),    # 孕妇严格限制 (CRITICAL)
        ("维生素C", 1600, "adult"),       # 接近 UL (INFO)
        ("姜黄素", 2800, "children"),     # 儿童 (WARNING)
    ]

    for name, amount, group in test_cases:
        alert = system.check_single_parameter(name, amount, group)
        if alert:
            logger.info(f"[{alert.alert_level.value.upper():8s}] {name}: {amount}mg ({group})")
            logger.info(f"   {alert.message[:80]}...")
            logger.info(f"   阻断: {'是' if alert.blocking else '否'}")
        else:
            logger.info(f"[{'SAFE':8s}] {name}: {amount}mg ({group}) - 安全")
        logger.info()

    # 示例 3: 配方安全检查
    logger.info("\n--- 示例 3: 配方安全检查 ---\n")
    formula_ingredients = [
        {"name": "大豆异黄酮", "amount_mg": 80, "percentage": 15},
        {"name": "维生素C", "amount_mg": 500, "percentage": 10},
        {"name": "人参皂苷", "amount_mg": 180, "percentage": 8},
        {"name": "姜黄素", "amount_mg": 1500, "percentage": 12},
        {"name": "钙", "amount_mg": 800, "percentage": 20},
    ]

    result = system.check_formula_safety(
        ingredients=formula_ingredients,
        daily_dosage_g=10,
        target_group="adult",
        usage_scenario="supplement",
    )

    logger.info(f"是否安全: {'是' if result.is_safe else '否'}")
    logger.info(f"风险评分: {result.overall_risk_score}/100")
    logger.info(f"检查参数: {result.checked_parameters}")
    logger.info(f"是否阻断: {'是' if result.blocked_by_critical else '否'}")
    logger.info(f"\n预警数量: {len(result.alerts)}")
    for alert in result.alerts:
        logger.info(f"\n  [{alert.alert_level.value.upper()}] {alert.ingredient_name}")
        logger.info(f"  {alert.message[:100]}...")
    logger.info("\n建议:")
    for rec in result.recommendations:
        logger.info(f"  • {rec}")
    # 示例 4: 特殊人群检查对比
    logger.info("\n--- 示例 4: 特殊人群对比 ---\n")
    groups = ["adult", "pregnant", "children", "elderly"]
    test_formula = [
        {"name": "大豆异黄酮", "amount_mg": 70},
        {"name": "人参皂苷", "amount_mg": 150},
    ]

    for group in groups:
        result = system.check_formula_safety(test_formula, target_group=group)
        group_names = {"adult": "成人", "pregnant": "孕妇", "children": "儿童", "elderly": "老年人"}
        logger.info(f"[{group_names[group]}] 风险评分: {result.overall_risk_score:.1f}, "
              f"预警: {len(result.alerts)}, 阻断: {'是' if result.blocked_by_critical else '否'}")

    # 示例 5: 搜索功能
    logger.info("\n--- 示例 5: 成分搜索 ---\n")
    results = system.search_ingredients("黄", limit=10)
    logger.info(f"搜索'黄'的结果: {results}")
    logger.info("\n" + "=" * 70)
    logger.info("示例演示完成!")
    logger.info("=" * 70)
if __name__ == "__main__":
    example_usage()
