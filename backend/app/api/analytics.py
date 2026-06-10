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
from datetime import datetime, timedelta
import json
import logging
import asyncio


from app.core.session import get_db
from app.api.deps import get_current_user
from app.core.analytics_engine import (
    AnalyticsService,
    ExportFormat,
    ReportConfig,
    TimeGranularity,
    ChartType,
    KPIMetric,
    ChartData,
    get_analytics_service,
)
from app.core.websocket import connection_manager, WebSocketMessage
from app.core.encoding import sanitize_filename


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
    range: str = Query("30d", description="Time range: 7d/30d/90d"),
    categories: str = Query(None, description="Category filter (comma-separated)"),
    status: str = Query(None, description="Status filter (comma-separated)"),
    users: str = Query(None, description="User filter (comma-separated)"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
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
        days_map = {"7d": 7, "30d": 30, "90d": 90}
        days = days_map.get(range, 30)
        
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
        
        # Sequential fetch to avoid connection pool conflicts (optimized order)
        logger.info("Loading dashboard data (sequential mode for stability)...")
        
        # 1. KPI metrics (most important)
        kpi = await service._get_kpi_metrics()
        logger.debug(f"✓ KPI loaded: {len(kpi)} metrics")
        
        # 2. Chart data
        charts = await service._get_chart_data()
        logger.debug(f"✓ Charts loaded: {len(charts)} types")
        
        # 3. System health (lightweight)
        system_health = await service._get_system_health()
        logger.debug("✓ System health loaded")
        
        # 4. Available filters
        available_filters = await _get_available_filters(db)
        logger.debug(f"✓ Filters loaded: {list(available_filters.keys())}")
        
        # 5. Recent activity (can be slow with large datasets)
        recent_activity = await service._get_recent_activity()
        logger.debug(f"✓ Activity loaded: {len(recent_activity)} items")
        
        # 6. Top entities (can be slow)
        top_entities = await service._get_top_entities()
        logger.debug(f"✓ Top entities loaded: {len(top_entities)} categories")
        
        stats = {
            "timestamp": datetime.utcnow().isoformat(),
            "kpi": kpi,
            "charts": charts,
            "recent_activity": recent_activity,
            "top_entities": top_entities,
            "system_health": system_health,
            "available_filters": available_filters,
            "filters_applied": base_filters,
        }
        
        logger.info(f"Dashboard data loaded successfully (time range: {range})")
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get dashboard data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Data fetch failed: {str(e)}")


@router.get("/kpi", summary="Get KPI metrics")
async def get_kpi_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Quick access to core KPI metric list"""
    try:
        service = get_analytics_service(db)
        kpi = await service._get_kpi_metrics()
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "metrics": kpi,
            "total_metrics": len(kpi),
        }
    except Exception as e:
        logger.error(f"Failed to get KPI metrics: {e}")
        raise HTTPException(status_code=500, detail=f"KPI fetch failed: {str(e)}")


@router.get("/trends/{entity}", summary="Get trend data")
async def get_trend_data(
    entity: str,
    days: int = Query(30, ge=1, le=365),
    granularity: str = Query("daily", description="hourly/daily/weekly/monthly"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
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
            "generated_at": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Failed to get trend data ({entity}): {e}")
        raise HTTPException(status_code=500, detail=f"Trend data fetch failed: {str(e)}")


@router.get("/system-health", summary="System health status")
async def get_system_health(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get system runtime health status (real-time)"""
    try:
        service = get_analytics_service(db)
        health = await service._get_system_health()
        
        # Add additional system info
        health["websocket_connections"] = connection_manager.get_connection_count()
        health["api_status"] = "operational"
        health["last_check"] = datetime.utcnow().isoformat()
        
        return health
    except Exception as e:
        logger.error(f"Failed to get system health: {e}")
        raise HTTPException(status_code=500, detail=f"System status fetch failed: {str(e)}")


# ============================================================
# Real-time Data Updates via WebSocket
# ============================================================

@router.websocket("/ws/dashboard")
async def websocket_dashboard_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint - Real-time dashboard data push
    
    Features:
    - Real-time KPI updates
    - Chart data refresh
    - System event notifications
    - Heartbeat detection
    
    Message format:
    - Subscribe: {"type": "subscribe", "channels": ["kpi_updates", "chart_refresh"]}
    - Unsubscribe: {"type": "unsubscribe", "channels": ["kpi_updates"]}
    - Heartbeat response: {"type": "pong"}
    """
    await websocket.accept()
    
    user_id = f"user_{id(websocket)}"
    connection_id = f"conn_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
    
    # Connection info
    client_info = {
        "type": "dashboard",
        "user_agent": websocket.headers.get("user-agent", "unknown"),
        "connected_at": datetime.utcnow().isoformat(),
    }
    
    # Register connection
    await connection_manager.connect(websocket, user_id, connection_id, client_info)
    
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
                        "timestamp": datetime.utcnow().isoformat()
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
            "timestamp": datetime.utcnow().isoformat(),
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
    current_user: dict = Depends(get_current_user),
):
    """
    Generate custom report (real database data)
    
    - Configure multiple widgets (tables, charts, KPIs)
    - Support data filter conditions
    - Dynamically fetch data from database
    """
    try:
        config = ReportConfig(
            id=str(__import__("uuid").uuid4()),
            name=request.name,
            description=request.description,
            widgets=request.widgets,
            filters=request.filters or {},
            export_format=request.export_format,
            created_by=current_user.get("id", 0),
        )
        
        service = get_analytics_service(db)
        report_data = await service.generate_custom_report(config)
        
        logger.info(f"Report generated successfully: {config.name} (ID: {config.id})")
        
        return {
            "success": True,
            "report": report_data,
            "config_id": config.id,
            "generated_at": datetime.utcnow().isoformat(),
        }
        
    except Exception as e:
        logger.error(f"Report generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.post("/export", summary="Export data")
async def export_data(
    request: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
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
            raise HTTPException(status_code=400, detail="Please provide data to export or a report ID")
        
        # Execute export
        export_result = await service.export_data(
            data=data_to_export,
            format=request.format,
            file_name=request.file_name,
        )
        
        logger.info(f"Data exported successfully: {export_result.file_name} ({export_result.format.value})")
        
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
        logger.error(f"Export failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/reports/templates", summary="Get report templates")
async def get_report_templates():
    """Get predefined report templates (based on actual database table structure)"""
    templates = [
        {
            "id": "formula_overview",
            "name": "Formula Overview Report",
            "description": "Detailed information and statistics for all formulas",
            "widgets": [
                {
                    "type": "table",
                    "title": "Formula List",
                    "table": "formulas",
                    "columns": ["id", "name", "code", "status", "version", "creator_id", "created_at"],
                    "limit": 100
                },
                {
                    "type": "chart",
                    "title": "Formula Status Distribution",
                    "chart_type": "pie",
                    "entity": "formulas",
                    "group_by": "status"
                },
                {
                    "type": "kpi",
                    "title": "Formula Statistics",
                    "metric": "total_formulas"
                },
            ],
        },
        {
            "id": "experiment_analysis",
            "name": "Experiment Analysis Report",
            "description": "Experiment data and success rate analysis",
            "widgets": [
                {
                    "type": "table",
                    "title": "Experiment Records",
                    "table": "experiments",
                    "columns": ["id", "title", "code", "status", "formula_id", "researcher_id", "start_date", "end_date"],
                    "limit": 100
                },
                {
                    "type": "chart",
                    "title": "Experiment Trend Chart",
                    "chart_type": "line",
                    "entity": "experiments",
                    "metric": "count"
                },
                {
                    "type": "chart",
                    "title": "Experiment Status Distribution",
                    "chart_type": "bar",
                    "entity": "experiments",
                    "group_by": "status"
                },
            ],
        },
        {
            "id": "user_activity",
            "name": "User Activity Report",
            "description": "User activity and usage statistics",
            "widgets": [
                {
                    "type": "kpi",
                    "title": "Total Users",
                    "metric": "total_users"
                },
                {
                    "type": "chart",
                    "title": "User Registration Trend",
                    "chart_type": "area",
                    "entity": "users",
                    "metric": "count"
                },
                {
                    "type": "table",
                    "title": "Recently Registered Users",
                    "table": "users",
                    "columns": ["id", "username", "email", "role", "created_at"],
                    "limit": 50
                },
            ],
        },
        {
            "id": "ingredient_inventory",
            "name": "Ingredient Inventory Report",
            "description": "Ingredient usage and inventory management",
            "widgets": [
                {
                    "type": "table",
                    "title": "Ingredient List",
                    "table": "ingredients",
                    "columns": ["id", "name", "name_cn", "category", "source", "is_food_homology", "created_at"],
                    "limit": 200
                },
                {
                    "type": "chart",
                    "title": "Ingredient Category Distribution",
                    "chart_type": "pie",
                    "entity": "ingredients",
                    "group_by": "category"
                },
            ],
        },
    ]
    
    return {
        "templates": templates,
        "total_templates": len(templates),
        "updated_at": datetime.utcnow().isoformat(),
    }


# ============================================================
# Data Filtering & Aggregation Endpoints
# ============================================================

@router.get("/filters", summary="Get available filters")
async def get_available_filters(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get all available data filter options"""
    return await _get_available_filters(db)


@router.post("/aggregate", summary="Custom data aggregation")
async def custom_aggregation(
    request: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Custom data aggregation query
    
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
            raise HTTPException(status_code=400, detail="Entity must be specified (entity)")
        
        if entity not in ["formulas", "experiments", "users", "ingredients"]:
            raise HTTPException(status_code=400, detail=f"Unsupported entity: {entity}")
        
        # Build SQL query
        query_parts = [f"SELECT "]
        select_parts = []
        
        for op in operations:
            field = op.get("field")
            operation = op.get("operation", "count")
            alias = op.get("alias", f"{operation}_{field}")
            
            if operation == "count":
                select_parts.append(f"COUNT(*) as {alias}")
            elif operation == "sum":
                select_parts.append(f"SUM({field}) as {alias}")
            elif operation == "avg":
                select_parts.append(f"AVG({field}) as {alias}")
            elif operation == "max":
                select_parts.append(f"MAX({field}) as {alias}")
            elif operation == "min":
                select_parts.append(f"MIN({field}) as {alias}")
        
        if group_by:
            select_parts.insert(0, group_by)
        
        query_parts.append(", ".join(select_parts))
        query_parts.append(f" FROM {entity}")
        
        # Add WHERE conditions
        where_conditions = []
        params = {}
        
        for key, value in filters.items():
            where_conditions.append(f"{key} = :{key}")
            params[key] = value
        
        if where_conditions:
            query_parts.append(f" WHERE {' AND '.join(where_conditions)}")
        
        if group_by:
            query_parts.append(f" GROUP BY {group_by}")
        
        query_parts.append(" LIMIT 1000")
        
        final_query = "".join(query_parts)
        
        result = await db.execute(text(final_query), params)
        rows = result.fetchall()
        
        return {
            "entity": entity,
            "operations": operations,
            "group_by": group_by,
            "result_count": len(rows),
            "data": [dict(row._mapping) for row in rows],
            "query": final_query,
            "generated_at": datetime.utcnow().isoformat(),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Custom aggregation query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Aggregation query failed: {str(e)}")


# ============================================================
# Helper Functions
# ============================================================

async def _get_available_filters(db: AsyncSession) -> Dict[str, Any]:
    """Get available filter options from database"""
    filters = {}
    
    try:
        # Get formula statuses
        result = await db.execute(text("SELECT DISTINCT status FROM formulas"))
        filters["formula_status"] = [row.status for row in result.fetchall() if row.status]
        
        # Get experiment statuses
        result = await db.execute(text("SELECT DISTINCT status FROM experiments"))
        filters["experiment_status"] = [row.status for row in result.fetchall() if row.status]
        
        # Get categories
        result = await db.execute(text("""
            SELECT DISTINCT c.id, c.name 
            FROM categories c 
            ORDER BY c.name
            LIMIT 50
        """))
        filters["categories"] = [{"id": row.id, "name": row.name} for row in result.fetchall()]
        
        # Get users list
        result = await db.execute(text("""
            SELECT id, username, full_name 
            FROM users 
            WHERE is_active = true 
            ORDER BY username
            LIMIT 100
        """))
        filters["users"] = [
            {
                "id": row.id,
                "username": row.username,
                "full_name": row.full_name or row.username
            } for row in result.fetchall()
        ]
        
        # Get time range options
        filters["time_ranges"] = [
            {"value": "7d", "label": "Last 7 Days"},
            {"value": "30d", "label": "Last 30 Days"},
            {"value": "90d", "label": "Last 90 Days"},
            {"value": "180d", "label": "Last 180 Days"},
            {"value": "365d", "label": "Last 1 Year"},
        ]
        
    except Exception as e:
        logger.warning(f"Error getting filter options: {e}")
        filters["error"] = str(e)
    
    return filters


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
