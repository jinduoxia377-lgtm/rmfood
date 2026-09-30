# -*- coding: utf-8 -*-
"""
Analytics API Router - Enhanced Version

Provides:
- Dashboard data endpoints (real database queries)
- Real-time data updates (WebSocket)
- Custom report generation
- Data export (Excel/PDF/CSV/JSON)
- Trend analysis data
- System health status
- Cache optimization and performance monitoring
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import Response, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta, timezone
import asyncio
import json
import logging
import uuid


from ..core.database.session import get_db
from ..api.deps import get_current_active_user
from ..utils.error_sanitize import sanitize_error
from ..core.analytics_reports.analytics_engine import (
    AnalyticsService,
    ExportFormat,
    ReportConfig,
    TimeGranularity,
    ChartType,
    KPIMetric,
    ChartData,
    get_analytics_service,
)
from ..core.analytics_reports.health_monitor import get_health_monitor
from ..core.analytics_reports.anomaly_detector import get_anomaly_detector
from ..core.analytics_reports.business_metrics import BusinessMetricsService
from ..core.realtime.websocket import connection_manager, WebSocketMessage
from ..models.user_model import User
from ..models.enums import UserRole


logger = logging.getLogger(__name__)


router = APIRouter(prefix="/analytics", tags=["analytics"])


# ============================================================
# Request/Response Models
# ============================================================

class CreateReportRequest(BaseModel):
    name: str
    description: str = ""
    widgets: List[Dict[str, Any]]
    filters: Optional[Dict[str, Any]] = None
    export_format: ExportFormat = ExportFormat.EXCEL


class ExportRequest(BaseModel):
    report_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    format: ExportFormat = ExportFormat.EXCEL
    file_name: Optional[str] = None


class DashboardFilters(BaseModel):
    time_range: str = "30d"
    categories: List[str] = []
    status: List[str] = []
    users: List[str] = []


# ============================================================
# Dashboard Endpoints (Enhanced with Real Data)
# ============================================================

@router.get("/dashboard", summary="Get dashboard data")
async def get_dashboard_data(
    time_range: str = Query("30d", description="Time range: 7d/30d/90d"),
    categories: str = Query(None, description="Category filter (comma-separated)"),
    status: str = Query(None, description="Status filter (comma-separated)"),
    users: str = Query(None, description="User filter (comma-separated)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get complete dashboard data (real database queries)
    
    - KPI core metrics (formulas, experiments, user activity, etc.)
    - Trend chart data
    - Recent activity feed
    - Top entity rankings
    - System health status
    - Available filter options
    
    Supports time range filtering: 7d/30d/90d
    Supports multi-dimensional filtering: categories, status, users
    """
    try:
        service = get_analytics_service(db)

        # Parse time range
        days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
        days = days_map.get(time_range, 30)

        # Parse filter conditions
        category_list = categories.split(",") if categories else []
        status_list = status.split(",") if status else []
        user_list = users.split(",") if users else []

        # Build base query conditions
        base_filters = {
            "days": days,
            "categories": category_list,
            "status": status_list,
            "users": user_list,
        }

        logger.info("Loading dashboard data...")

        # 1. KPI metrics
        try:
            kpi = await service._get_kpi_metrics(days=days)
            logger.info(f"✓ KPI loaded: {len(kpi)} metrics")
        except Exception as e:
            logger.error(f"✗ KPI failed: {e}", exc_info=True)
            kpi = []

        # 2. Chart data
        try:
            chart_months = 12 if days >= 365 else 3 if days >= 90 else 1
            charts = await service._get_chart_data(months=chart_months)
            logger.info(f"✓ Charts loaded: {len(charts)} types")
        except Exception as e:
            logger.error(f"✗ Charts failed: {e}", exc_info=True)
            charts = {}

        # 3. System health
        try:
            system_health = await service._get_system_health()
            logger.info("✓ System health loaded")
        except Exception as e:
            logger.error(f"✗ System health failed: {e}", exc_info=True)
            system_health = {}

        # 4. Available filters
        try:
            available_filters = await service._get_available_filters(db)
            logger.info(f"✓ Filters loaded: {list(available_filters.keys())}")
        except Exception as e:
            logger.error(f"✗ Filters failed: {e}", exc_info=True)
            available_filters = {}

        # 5. Recent activity
        try:
            recent_activity = await service._get_recent_activity()
            logger.info(f"✓ Activity loaded: {len(recent_activity)} items")
        except Exception as e:
            logger.error(f"✗ Activity failed: {e}", exc_info=True)
            recent_activity = []

        # 6. Top entities
        try:
            top_entities = await service._get_top_entities()
            logger.info(f"✓ Top entities loaded: {len(top_entities)} categories")
        except Exception as e:
            logger.error(f"✗ Top entities failed: {e}", exc_info=True)
            top_entities = {}

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "kpi": kpi,
            "charts": charts,
            "recent_activity": recent_activity,
            "top_entities": top_entities,
            "system_health": system_health,
            "available_filters": available_filters,
            "filters_applied": base_filters,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dashboard failed", exc_info=True)
        raise HTTPException(status_code=500, detail=sanitize_error(e, "数据获取失败，请稍后重试"))


@router.get("/kpi", summary="Get KPI metrics")
async def get_kpi_metrics(
    time_range: str = Query("30d", description="Time range: 7d/30d/90d/1y"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Quick access to core KPI metric list"""
    try:
        service = get_analytics_service(db)
        days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
        days = days_map.get(time_range, 30)
        kpi = await service._get_kpi_metrics(days=days)
        
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metrics": kpi,
            "total_metrics": len(kpi),
        }
    except Exception as e:
        logger.error("获取KPI指标失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.get("/trends/{entity}", summary="Get trend data")
async def get_trend_data(
    entity: str,
    days: int = Query(30, ge=1, le=365),
    granularity: str = Query("daily", description="hourly/daily/weekly/monthly"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get trend data for an entity (real database query)
    
    - entity: formulas/experiments/users/ai_generations etc.
    - days: time range (days)
    - granularity: data granularity
    """
    try:
        gran = TimeGranularity(granularity)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid granularity: {granularity}")
    
    valid_entities = ["formulas", "experiments", "users", "ai_generations"]
    if entity not in valid_entities:
        raise HTTPException(status_code=400, detail=f"Unsupported entity type: {entity}. Supported types: {valid_entities}")
    
    try:
        service = get_analytics_service(db)
        trend_data = await service._get_trend_data(entity, days, gran)
        
        return {
            "entity": entity,
            "days": days,
            "granularity": granularity,
            "data_points": len(trend_data),
            "data": trend_data,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error("获取趋势数据失败 (%s): %s", entity, e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.get("/system-health", summary="System health status")
async def get_system_health(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get system runtime health status (real-time from psutil + DB)."""
    try:
        service = get_analytics_service(db)
        health = await service._get_system_health()

        # Add additional system info
        health["websocket_connections"] = connection_manager.get_connection_count()
        health["api_status"] = "operational"
        health["last_check"] = datetime.now(timezone.utc).isoformat()

        return health
    except Exception as e:
        logger.error("获取系统健康状态失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.get("/anomalies", summary="Detect data anomalies")
async def get_anomalies(
    threshold: float = Query(2.5, ge=1.0, le=5.0, description="标准差倍数阈值"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    基于历史数据的统计异常检测。
    对 KPI 趋势和图表数据集使用 3σ 规则 / CUSUM 检测异常波动。
    """
    try:
        service = get_analytics_service(db)
        # 获取完整仪表盘数据
        days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
        days = days_map.get(time_range, 30)
        chart_months = 12 if days >= 365 else 3 if days >= 90 else 1
        kpi = await service._get_kpi_metrics(days=days)
        charts = await service._get_chart_data(months=chart_months)

        dashboard_data = {
            "kpi": kpi,
            "charts": charts,
        }

        detector = get_anomaly_detector()
        anomalies = await detector.detect_all_anomalies(dashboard_data)

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "threshold": threshold,
            "total_anomalies": len(anomalies),
            "high_severity": sum(1 for a in anomalies if a.get("severity") == "high"),
            "anomalies": anomalies,
        }
    except Exception as e:
        logger.error("异常检测失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="异常检测服务暂时不可用")


@router.get("/business-metrics", summary="Business-specific metrics")
async def get_business_metrics(
    time_range: str = Query("30d", description="Time range: 7d/30d/90d/1y"),
    categories: str = Query(None, description="Category filter (comma-separated)"),
    status: str = Query(None, description="Status filter (comma-separated)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    药食同源业务专属指标：
    - 配方生命周期转化漏斗
    - 食材关联分析（频繁共现）
    - AI 生成质量评估
    - 药食同源配方占比
    """
    try:
        days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
        days = days_map.get(time_range, 30)
        category_list = categories.split(",") if categories else []
        status_list = status.split(",") if status else []

        service = BusinessMetricsService(db)
        overview = await service.get_business_overview(
            days=days,
            categories=category_list,
            statuses=status_list,
        )
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **overview,
        }
    except Exception as e:
        logger.error("业务指标获取失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="业务指标服务暂时不可用")


# ============================================================
# Real-time Data Updates via WebSocket
# ============================================================

@router.websocket("/ws/dashboard")
async def websocket_dashboard_endpoint(
    websocket: WebSocket,
    token: str = Query(None),
    connection_id: str = Query(None, description="Connection ID"),
):
    """
    WebSocket endpoint - Real-time dashboard data push (requires authentication)

    Features:
    - Real-time KPI updates
    - Chart data refresh
    - System event notifications
    - Heartbeat detection
    """
    # ── 强制认证 ──────────────────────────────────────────────
    ws_token = token
    if not ws_token:
        ws_token = websocket.cookies.get("rmfood_access_token")

    if not ws_token:
        await websocket.close(code=4001, reason="Authentication required")
        logger.warning("Analytics WebSocket: 拒绝匿名连接")
        return

    user_id = None
    try:
        from app.utils.auth import decode_token as decode_access_token
        payload = decode_access_token(ws_token)
        user_id = str(payload.get("sub", "unknown"))
    except Exception as e:
        await websocket.close(code=4001, reason="Invalid token")
        logger.warning(f"Analytics WebSocket: 无效token: {e}")
        return

    await websocket.accept()
    
    # Connection info
    client_info = {
        "type": "dashboard",
        "user_agent": websocket.headers.get("user-agent", "unknown"),
        "connected_at": datetime.now(timezone.utc).isoformat(),
    }
    
    # Register connection
    await connection_manager.connect(websocket, user_id, connection_id or f"anon_{id(websocket)}", client_info)
    
    logger.info(f"Analytics WebSocket connection established: {connection_id}")
    
    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                msg_type = message.get("type")
                
                if msg_type == "subscribe":
                    # Handle subscription request
                    channels = message.get("channels", [])
                    await websocket.send_json(WebSocketMessage.success(
                        f"Subscribed to channels: {', '.join(channels)}",
                        {"subscribed_channels": channels}
                    ))
                    logger.info(f"User {user_id} subscribed to channels: {channels}")
                
                elif msg_type == "unsubscribe":
                    # Handle unsubscription request
                    channels = message.get("channels", [])
                    await websocket.send_json(WebSocketMessage.success(
                        f"Unsubscribed from channels: {', '.join(channels)}",
                        {"unsubscribed_channels": channels}
                    ))
                
                elif msg_type == "ping":
                    # Heartbeat response
                    connection_manager.update_ping(connection_id)
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                
                elif msg_type == "request_data":
                    # Request data refresh
                    data_type = message.get("data_type", "dashboard")
                    
                    # Trigger data refresh logic here
                    refresh_message = WebSocketMessage.data_update(
                        entity_type="dashboard",
                        entity_id="refresh",
                        action="refresh_requested",
                        data={"requested_by": user_id, "data_type": data_type}
                    )
                    
                    await websocket.send_json(refresh_message)
                
                else:
                    # Unknown message type
                    await websocket.send_json(WebSocketMessage.error(
                        f"Unknown message type: {msg_type}",
                        "UNKNOWN_MESSAGE_TYPE"
                    ))
                    
            except json.JSONDecodeError:
                await websocket.send_json(WebSocketMessage.error(
                    "Invalid JSON format",
                    "INVALID_JSON"
                ))
                
    except WebSocketDisconnect:
        logger.info(f"Analytics WebSocket disconnected: {connection_id}")
        await connection_manager.disconnect(user_id, connection_id)
        
    except Exception as e:
        logger.error(f"WebSocket error ({connection_id}): {e}")
        await connection_manager.disconnect(user_id, connection_id)


async def broadcast_analytics_update(update_type: str, data: Dict[str, Any]):
    """
    Broadcast analytics data update to all connected clients
    
    Args:
        update_type: Update type (kpi_update, chart_refresh, system_event)
        data: Update data
    """
    message = WebSocketMessage.create(
        type="analytics_update",
        data={
            "update_type": update_type,
            "payload": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )
    
    await connection_manager.broadcast(message)
    logger.info(f"Broadcast analytics data update: {update_type}")


# ============================================================
# Report Endpoints
# ============================================================

@router.post("/reports", summary="Create custom report")
async def create_report(
    request: CreateReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Generate custom report (real database data)
    
    - Configure multiple widgets (tables, charts, KPIs)
    - Support data filter conditions
    - Dynamically fetch data from database
    """
    try:
        config = ReportConfig(
            id=str(uuid.uuid4()),
            name=request.name,
            description=request.description,
            widgets=request.widgets,
            filters=request.filters or {},
            export_format=request.export_format,
            created_by=current_user.id,
        )
        
        service = get_analytics_service(db)
        report_data = await service.generate_custom_report(config)
        
        logger.debug(f"Report generated successfully: {config.name} (ID: {config.id})")
        
        return {
            "success": True,
            "report": report_data,
            "config_id": config.id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        
    except Exception as e:
        logger.error("报告生成失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="报告生成失败，请稍后重试")


@router.post("/export", summary="Export data")
async def export_data(
    request: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Export data in specified format (real data)
    
    - Excel (.xlsx): Formatted spreadsheet
    - PDF (.pdf): HTML format report
    - CSV (.csv): Comma-separated values
    - JSON (.json): Structured data
    """
    try:
        service = get_analytics_service(db)
        
        data_to_export = request.data
        
        # If report ID provided, load report config and generate data first
        if request.report_id and not data_to_export:
            config = await _load_report_config(db, request.report_id)
            if config:
                result = await service.generate_custom_report(config)
                data_to_export = result
        
        if not data_to_export:
            raise HTTPException(status_code=400, detail="请提供要导出的数据或报告编号")
        
        # Execute export
        export_result = await service.export_data(
            data=data_to_export,
            format=request.format,
            file_name=request.file_name,
        )
        
        logger.debug(f"Data exported successfully: {export_result.file_name} ({export_result.format.value})")
        
        # 规范化文件名并使用 RFC 5987 编码
        safe_filename = sanitize_filename(export_result.file_name)
        import urllib.parse
        encoded_filename = urllib.parse.quote(safe_filename, safe='')
        content_disposition = f'attachment; filename="{safe_filename}"; filename*=UTF-8\'\'{encoded_filename}'
        
        return Response(
            content=export_result.data,
            media_type=export_result.content_type,
            headers={
                "Content-Disposition": content_disposition,
                "Content-Length": str(export_result.file_size_bytes),
            },
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("数据导出失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="数据导出失败，请稍后重试")


@router.get("/reports/templates", summary="Get report templates")
async def get_report_templates(category: str | None = Query(None, description="按分类过滤")):
    """从 report_templates.py 常量加载预置报表模板。"""
    try:
        from app.core.analytics_reports.report_templates import (
            get_templates_by_category,
        )
        templates = get_templates_by_category(category)
        return {
            "templates": templates,
            "total_templates": len(templates),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error("加载报表模板失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="报表模板加载失败")


# ============================================================
# Data Filtering & Aggregation Endpoints
# ============================================================

@router.get("/filters", summary="Get available filters")
async def get_available_filters(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get all available data filter options"""
    service = get_analytics_service(db)
    return await service._get_available_filters(db)


@router.post("/aggregate", summary="Custom data aggregation")
async def custom_aggregation(
    request: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Custom data aggregation query (safe, identifier-whitelisted)

    Supported aggregation operations:
    - count: Count
    - sum: Sum
    - avg: Average
    - max/min: Max/Min value
    - group_by: Group aggregation
    """
    try:
        entity = request.get("entity")
        operations = request.get("operations", [])
        group_by = request.get("group_by")
        filters = request.get("filters", {})

        if not entity:
            raise HTTPException(status_code=400, detail="必须指定实体（entity）")

        if entity not in ["formulas", "experiments", "users", "ingredients"]:
            raise HTTPException(status_code=400, detail=f"不支持的实体类型：{entity}")

        # ── Identifier whitelist validation ──────────────────────────
        # Column names allowed per entity — prevents SQL injection via
        # field, alias, and group_by identifiers.
        ENTITY_COLUMNS: Dict[str, List[str]] = {
            "formulas": ["id", "name", "code", "status", "version",
                         "creator_id", "created_at", "updated_at",
                         "target_effects", "description"],
            "experiments": ["id", "title", "code", "status", "formula_id",
                            "researcher_id", "start_date", "end_date",
                            "created_at", "updated_at"],
            "users": ["id", "username", "email", "role", "is_active",
                      "created_at", "updated_at"],
            "ingredients": ["id", "name", "name_cn", "category", "source",
                            "is_food_homology", "created_at"],
        }
        allowed_columns = ENTITY_COLUMNS.get(entity, [])

        def _validate_identifier(value: Any, name: str) -> str:
            """Validate an identifier against the column whitelist."""
            if not isinstance(value, str) or not value.strip():
                raise HTTPException(status_code=400, detail=f"{name} must be a non-empty string")
            if value not in allowed_columns:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid {name}: '{value}'. Allowed values: {allowed_columns}",
                )
            return value

        # Validate operations
        VALID_OPERATIONS = {"count", "sum", "avg", "max", "min"}
        validated_ops = []
        for op in operations:
            operation = op.get("operation", "count")
            if operation not in VALID_OPERATIONS:
                raise HTTPException(status_code=400, detail=f"Unsupported operation: {operation}")
            field = _validate_identifier(op.get("field", "*"), "field")
            alias = _validate_identifier(op.get("alias", f"{operation}_{field}"), "alias")
            validated_ops.append((field, operation, alias))

        # Validate group_by
        validated_group_by: Optional[str] = None
        if group_by:
            validated_group_by = _validate_identifier(group_by, "group_by")

        # ── Build safe query using SQLAlchemy ColumnElement ──────────
        from sqlalchemy import column, func, select as sa_select

        select_clauses = []
        for field, operation, alias in validated_ops:
            col = column(field)
            if operation == "count":
                select_clauses.append(func.count().label(alias))
            elif operation == "sum":
                select_clauses.append(func.sum(col).label(alias))
            elif operation == "avg":
                select_clauses.append(func.avg(col).label(alias))
            elif operation == "max":
                select_clauses.append(func.max(col).label(alias))
            elif operation == "min":
                select_clauses.append(func.min(col).label(alias))

        if validated_group_by:
            select_clauses.insert(0, column(validated_group_by))

        stmt = sa_select(*select_clauses).limit(1000)

        # Add WHERE conditions using bound parameters
        if filters:
            for key, value in filters.items():
                if key not in allowed_columns:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid filter column: '{key}'. Allowed: {allowed_columns}",
                    )
                stmt = stmt.where(column(key) == value)

        if validated_group_by:
            stmt = stmt.group_by(column(validated_group_by))

        result = await db.execute(stmt)
        rows = result.fetchall()

        return {
            "entity": entity,
            "operations": validated_ops,
            "group_by": validated_group_by,
            "result_count": len(rows),
            "data": [dict(row._mapping) for row in rows],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("自定义聚合查询失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


# ============================================================
# Helper Functions
# ============================================================


async def _load_report_config(db: AsyncSession, report_id: str) -> Optional[ReportConfig]:
    """Load report configuration from database"""
    try:
        result = await db.execute(
            text("SELECT * FROM report_configs WHERE id = :id"),
            {"id": report_id},
        )
        row = result.fetchone()
        
        if not row:
            return None
        
        return ReportConfig(
            id=row.id,
            name=row.name,
            description=row.description or "",
            widgets=json.loads(row.widgets_config),
            filters=json.loads(row.filters) if row.filters else {},
            created_by=row.created_by,
        )
    except Exception as e:
        logger.warning(f"Error loading report configuration: {e}")
        return None


logger.info("Enhanced analytics API router loaded successfully (supports WebSocket + real data)")
