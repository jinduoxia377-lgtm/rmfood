"""
企业级管理 API 路由 (P5 合规模块统一入口)

整合:
- 备份与灾难恢复 API
- 权限生命周期管理 API
- 合规报告与审计 API
- 商业智能与数据可视化 API
- 数据库优化状态 API

前缀: /api/v1/enterprise
仅限 ADMIN 角色访问
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from ..api.deps import admin_route, get_current_user
from ..models.models import User, UserRole
from ..models.enums import UserRole as EnumUserRole

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/enterprise", tags=["🔒 企业级管理"])


# ──────────────────────────────────────────────
# 通用响应模型
# ──────────────────────────────────────────────

class SuccessResponse(BaseModel):
    success: bool = True
    message: str = ""
    data: Optional[Dict[str, Any]] = None


# ──────────────────────────────────────────────
# 1. 备份与灾难恢复 API
# ──────────────────────────────────────────────

backup_router = APIRouter(prefix="/backups", tags=["💾 备份管理"])


@backup_router.get("/", summary="列出所有备份")
async def list_backups(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    backup_type: Optional[str] = None,
    current_user: User = Depends(admin_route),
):
    """列出所有备份记录（分页）"""
    bm = getattr(request.app.state, "backup_manager", None)
    if not bm:
        raise HTTPException(status_code=503, detail="备份管理器未初始化")

    backups = bm.list_backups(
        limit=limit,
        status=status_filter,
        backup_type=backup_type,
    )
    return {"items": backups, "total": len(backups)}


@backup_router.post("/create", summary="创建备份")
async def create_backup(
    request: Request,
    backup_type: str = Query("incremental", description="full / incremental / differential"),
    description: str = Query(""),
    retention_days: Optional[int] = Query(None),
    current_user: User = Depends(admin_route),
):
    """手动触发一次备份"""
    bm = getattr(request.app.state, "backup_manager", None)
    if not bm:
        raise HTTPException(status_code=503, detail="备份管理器未初始化")

    try:
        record = await bm.create_backup(
            backup_type=backup_type,
            description=f"[{current_user.username}] {description}",
            retention_days=retention_days,
        )
        return {"success": True, "backup": record.to_dict()}
    except Exception as e:
        logger.error(f"备份创建失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@backup_router.post("/{backup_id}/restore", summary="从备份恢复")
async def restore_backup(
    backup_id: str,
    request: Request,
    validate_only: bool = Query(False, description="仅验证，不实际恢复"),
    current_user: User = Depends(admin_route),
):
    """从指定备份恢复数据（validate_only=True 时仅验证完整性）"""
    bm = getattr(request.app.state, "backup_manager", None)
    if not bm:
        raise HTTPException(status_code=503, detail="备份管理器未初始化")

    try:
        report = await bm.restore_from_backup(backup_id, validate_only=validate_only)
        return {
            "success": report.status.value in ("completed", "verifying"),
            "backup_id": backup_id,
            "report": {
                "status": report.status.value,
                "duration_seconds": report.duration_seconds,
                "records_restored": report.records_restored,
                "errors": report.errors,
                "warnings": report.warnings,
                "details": report.details,
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"备份恢复失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@backup_router.post("/drill", summary="运行恢复演练")
async def run_restore_drill(
    request: Request,
    backup_id: Optional[str] = Query(None, description="指定备份 ID，不指定则选最近"),
    current_user: User = Depends(admin_route),
):
    """运行备份恢复演练（在临时环境验证，不影响生产数据）"""
    bm = getattr(request.app.state, "backup_manager", None)
    if not bm:
        raise HTTPException(status_code=503, detail="备份管理器未初始化")

    try:
        result = await bm.run_restore_drill(backup_id)
        return result
    except Exception as e:
        logger.error(f"恢复演练失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@backup_router.get("/statistics", summary="备份统计")
async def get_backup_statistics(
    request: Request,
    current_user: User = Depends(admin_route),
):
    """获取备份系统统计信息"""
    bm = getattr(request.app.state, "backup_manager", None)
    if not bm:
        raise HTTPException(status_code=503, detail="备份管理器未初始化")

    return bm.get_statistics()


# ──────────────────────────────────────────────
# 2. 权限生命周期管理 API
# ──────────────────────────────────────────────

perm_router = APIRouter(prefix="/permissions", tags=["🔑 权限管理"])


@perm_router.get("/users/{user_id}", summary="获取用户权限列表")
async def get_user_permissions(
    user_id: int,
    request: Request,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(admin_route),
):
    """获取指定用户的权限列表（含生命周期状态）"""
    from ..core.permission_lifecycle import get_plm, PermissionStatus

    plm = get_plm()
    status_enum = PermissionStatus(status_filter) if status_filter else None
    perms = plm.get_user_permissions(user_id, status=status_enum)

    return {
        "user_id": user_id,
        "total": len(perms),
        "permissions": [
            {
                "id": p.id,
                "resource": p.resource,
                "action": p.action,
                "status": p.status.value,
                "permission_type": p.permission_type.value,
                "granted_at": p.granted_at.isoformat(),
                "expires_at": p.expires_at.isoformat() if p.expires_at else None,
                "last_used_at": p.last_used_at.isoformat() if p.last_used_at else None,
                "granted_by": p.granted_by,
                "granted_reason": p.granted_reason,
            }
            for p in perms
        ],
    }


@perm_router.post("/request", summary="申请权限")
async def request_permission(
    request_data: Dict[str, Any],
    current_user: User = Depends(admin_route),
):
    """申请一个新权限"""
    from ..core.permission_lifecycle import (
        get_plm, PermissionType, PermissionStatus, PermissionLifecycleManager
    )

    required_fields = ["user_id", "user_name", "resource", "action", "reason"]
    for f in required_fields:
        if f not in request_data:
            raise HTTPException(status_code=400, detail=f"缺少必需字段: {f}")

    plm = get_plm()
    ptype = PermissionType(request_data.get("permission_type", "standard"))
    duration = request_data.get("duration_hours")

    entry = plm.request_permission(
        user_id=request_data["user_id"],
        user_name=request_data["user_name"],
        resource=request_data["resource"],
        action=request_data["action"],
        reason=request_data["reason"],
        requested_by=current_user.id,
        permission_type=ptype,
        duration_hours=duration,
    )

    return {
        "success": True,
        "permission": {
            "id": entry.id,
            "status": entry.status.value,
            "requires_approval": entry.status == PermissionStatus.PENDING,
        },
    }


@perm_router.post("/{permission_id}/approve", summary="审批通过")
async def approve_permission(
    permission_id: str,
    request: Request,
    comment: str = Query(""),
    current_user: User = Depends(admin_route),
):
    """审批通过权限申请"""
    from ..core.permission_lifecycle import get_plm

    plm = get_plm()
    entry = plm.approve(permission_id, current_user.id, current_user.username, comment)

    if not entry:
        raise HTTPException(status_code=404, detail="权限申请不存在或状态异常")

    return {"success": True, "permission_id": permission_id, "new_status": entry.status.value}


@perm_router.post("/{permission_id}/revoke", summary="吊销权限")
async def revoke_permission(
    permission_id: str,
    request: Request,
    reason: str = Query(...),
    current_user: User = Depends(admin_route),
):
    """吊销用户的某个权限"""
    from ..core.permission_lifecycle import get_plm

    plm = get_plm()
    entry = plm.revoke(permission_id, current_user.id, reason)

    if not entry:
        raise HTTPException(status_code=404, detail="权限不存在")

    return {"success": True, "permission_id": permission_id}


@perm_router.post("/maintenance", summary="运行权限维护任务")
async def run_permission_maintenance(
    request: Request,
    current_user: User = Depends(admin_route),
):
    """运行定期权限维护（过期清理 + 闲置检测）"""
    from ..core.permission_lifecycle import get_plm

    plm = get_plm()
    stats = plm.run_maintenance()
    return {"success": True, "maintenance_result": stats}


@perm_router.get("/review-report", summary="生成权限评审报告")
async def get_permission_review_report(
    request: Request,
    current_user: User = Depends(admin_route),
):
    """生成权限评审报告（用于定期合规审查）"""
    from ..core.permission_lifecycle import get_plm

    plm = get_plm()
    report = plm.generate_review_report()
    return report


@perm_router.get("/statistics", summary="权限统计")
async def get_permission_statistics(
    request: Request,
    current_user: User = Depends(admin_route),
):
    """获取权限系统统计"""
    from ..core.permission_lifecycle import get_plm

    plm = get_plm()
    return plm.get_statistics()


# ──────────────────────────────────────────────
# 3. 合规与审计 API
# ──────────────────────────────────────────────

compliance_router = APIRouter(prefix="/compliance", tags=["📋 合规管理"])


@compliance_router.get("/audit-records", summary="审计记录查询")
async def query_audit_records(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    start_date: Optional[datetime] = Query(None, description="ISO 格式时间"),
    end_date: Optional[datetime] = Query(None),
    user_id: Optional[int] = Query(None),
    severity: Optional[str] = Query(None),
    current_user: User = Depends(admin_route),
):
    """查询 HTTP 审计中间件记录的最近请求"""
    audit_mw = getattr(request.app.state, "audit_middleware", None)
    if not audit_mw:
        raise HTTPException(status_code=503, detail="审计中间件未初始化")

    records = audit_mw.get_recent_records(limit=page_size * page)

    # 简单过滤
    if start_date:
        records = [r for r in records if r.timestamp >= start_date]
    if end_date:
        records = [r for r in records if r.timestamp <= end_date]
    if user_id:
        records = [r for r in records if r.user_id == user_id]
    if severity:
        records = [r for r in records if r.severity == severity]

    total = len(records)
    paginated = records[(page - 1) * page_size: page * page_size]

    return {
        "items": [r.to_dict() for r in paginated],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@compliance_router.get("/audit-statistics", summary="审计统计")
async def get_audit_statistics(
    request: Request,
    current_user: User = Depends(admin_route),
):
    """获取审计统计摘要"""
    audit_mw = getattr(request.app.state, "audit_middleware", None)
    if not audit_mw:
        raise HTTPException(status_code=503, detail="审计中间件未初始化")

    stats = audit_mw.get_statistics()
    stats["integrity_ok"] = audit_mw.verify_integrity()
    return stats


# ──────────────────────────────────────────────
# 4. 商业智能 API
# ──────────────────────────────────────────────

bi_router = APIRouter(prefix="/bi", tags=["📊 商业智能"])


@bi_router.post("/kpis", summary="计算 KPI 指标")
async def compute_kpis(
    request: Request,
    datasets: Dict[str, List[float]],
    current_user: User = Depends(admin_route),
):
    """批量计算 KPI 指标（含趋势与异常检测）

    请求示例:
    {
        "datasets": {
            "daily_new_formulas": [5, 8, 12, 7, 15, 20, 18],
            "experiment_success_rate": [0.75, 0.80, 0.65, 0.85, 0.90]
        }
    }
    """
    bi = getattr(request.app.state, "bi_engine", None)
    if not bi:
        raise HTTPException(status_code=503, detail="BI 引擎未初始化")

    results = bi.compute_all_kpis(datasets)

    return {
        kpi_name: {
            "name": r.name,
            "value": r.value,
            "unit": r.unit,
            "trend": r.trend,
            "change_pct": r.change_pct,
            "is_anomaly": r.is_anomaly,
            "anomaly_reason": r.anomaly_reason,
        }
        for kpi_name, r in results.items()
    }


@bi_router.post("/dashboard", summary="生成数据看板")
async def generate_dashboard(
    request: Request,
    title: str = Query("RMFOOD 数据看板"),
    current_user: User = Depends(admin_route),
):
    """生成前端可直接渲染的数据看板 JSON 配置"""
    bi = getattr(request.app.state, "bi_engine", None)
    if not bi:
        raise HTTPException(status_code=503, detail="BI 引擎未初始化")

    # 模拟数据（真实场景应从数据库查询）
    import random
    datasets = {
        "daily_new_formulas": [random.randint(1, 20) for _ in range(30)],
        "experiment_success_rate": [random.uniform(0.5, 0.95) for _ in range(30)],
    }
    kpi_results = bi.compute_all_kpis(datasets)

    dashboard = bi.generate_dashboard(
        title=title,
        kpi_results=kpi_results,
        time_series_data=datasets,
    )

    return dashboard


@bi_router.post("/association-rules", summary="关联规则挖掘")
async def find_association_rules(
    request: Request,
    transactions: List[List[str]],
    min_support: float = Query(0.05, ge=0.01, le=1.0),
    min_confidence: float = Query(0.6, ge=0.1, le=1.0),
    current_user: User = Depends(admin_route),
):
    """挖掘频繁项集与关联规则（用于配方原料推荐）"""
    bi = getattr(request.app.state, "bi_engine", None)
    if not bi:
        raise HTTPException(status_code=503, detail="BI 引擎未初始化")

    rules = bi.find_associations(
        transactions=transactions,
        min_support=min_support,
        min_confidence=min_confidence,
    )

    return {
        "total_rules": len(rules),
        "rules": rules[:50],
    }


@bi_router.post("/forecast", summary="趋势预测")
async def forecast_values(
    request: Request,
    time_series: List[float],
    steps: int = Query(7, ge=1, le=30),
    current_user: User = Depends(admin_route),
):
    """基于线性回归预测未来 N 步的值"""
    bi = getattr(request.app.state, "bi_engine", None)
    if not bi:
        raise HTTPException(status_code=503, detail="BI 引擎未初始化")

    predictions = bi.forecast_next(time_series, steps)
    return {
        "historical": time_series[-14:],
        "forecast": predictions,
        "steps": steps,
    }


@bi_router.get("/statistics", summary="BI 引擎统计")
async def get_bi_statistics(
    request: Request,
    current_user: User = Depends(admin_route),
):
    """获取 BI 引擎状态与统计"""
    bi = getattr(request.app.state, "bi_engine", None)
    if not bi:
        raise HTTPException(status_code=503, detail="BI 引擎未初始化")

    return bi.get_stats()


# ──────────────────────────────────────────────
# 5. 数据库优化 API
# ──────────────────────────────────────────────

db_router = APIRouter(prefix="/db-optimizer", tags=["🗄️ 数据库优化"])


@db_router.get("/statistics", summary="数据库优化统计")
async def get_db_optimizer_statistics(
    request: Request,
    current_user: User = Depends(admin_route),
):
    """获取数据库优化器的完整统计"""
    optimizer = getattr(request.app.state, "db_optimizer", None)
    if not optimizer:
        raise HTTPException(status_code=503, detail="数据库优化器未初始化")

    return optimizer.get_optimizer_stats()


@db_router.get("/slow-queries", summary="慢查询列表")
async def get_slow_queries(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(admin_route),
):
    """获取 Top N 慢查询"""
    optimizer = getattr(request.app.state, "db_optimizer", None)
    if not optimizer:
        raise HTTPException(status_code=503, detail="数据库优化器未初始化")

    queries = optimizer.get_slow_queries(limit)
    return {"total": len(queries), "queries": queries}


@db_router.get("/nodes", summary="数据库节点状态")
async def get_db_nodes(
    request: Request,
    current_user: User = Depends(admin_route),
):
    """获取所有注册的数据库节点健康状态"""
    optimizer = getattr(request.app.state, "db_optimizer", None)
    if not optimizer:
        raise HTTPException(status_code=503, detail="数据库优化器未初始化")

    stats = optimizer.get_optimizer_stats()
    return {"nodes": stats.get("nodes", {})}


# ──────────────────────────────────────────────
# 注册子路由
# ──────────────────────────────────────────────

router.include_router(backup_router)
router.include_router(perm_router)
router.include_router(compliance_router)
router.include_router(bi_router)
router.include_router(db_router)


# ──────────────────────────────────────────────
# 根路径: 企业级管理概览
# ──────────────────────────────────────────────

@router.get("/", summary="企业级管理概览")
async def enterprise_overview(
    request: Request,
    current_user: User = Depends(admin_route),
):
    """企业级管理模块概览（仪表盘用）"""
    return {
        "module": "企业级管理与合规",
        "version": "1.0.0",
        "endpoints": {
            "backup": "/api/v1/enterprise/backups",
            "permissions": "/api/v1/enterprise/permissions",
            "compliance": "/api/v1/enterprise/compliance",
            "bi": "/api/v1/enterprise/bi",
            "db_optimizer": "/api/v1/enterprise/db-optimizer",
        },
        "status": {
            "backup_manager": "ok" if hasattr(request.app.state, "backup_manager") else "not_initialized",
            "db_optimizer": "ok" if hasattr(request.app.state, "db_optimizer") else "not_initialized",
            "bi_engine": "ok" if hasattr(request.app.state, "bi_engine") else "not_initialized",
            "audit_middleware": "ok" if hasattr(request.app.state, "audit_middleware") else "not_initialized",
        },
    }
