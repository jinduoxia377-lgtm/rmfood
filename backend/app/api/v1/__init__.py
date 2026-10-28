"""API v1 package - version-specific routers.

Aggregates v1-specific routers that extend the base API with
enterprise features: cloud sync, team collaboration, dashboards,
and version control.

These routers exist only in the v1 namespace (no api/ counterpart).
"""
from fastapi import APIRouter

from .batches_router import router as batches_router
from .document_router import router as document_router
from .doe_router import router as doe_router
from .fact_engine_router import router as fact_engine_router
from .label_router import router as label_router
from .mcp_router import router as mcp_router
from .metrics_router import router as metrics_router
from .mo_stream_endpoint import router as mo_stream_router
from .ray_router import router as ray_router
from .samples_router import router as samples_router
from .stability_router import router as stability_router
from .sync_router import router as sync_router
from .team_dashboard_router import router as team_dashboard_router
from .team_router import router as team_router
from .version_router import router as version_router

# import_router requires celery; skip if not installed
try:
    from .import_router import router as import_router
except ImportError as e:
    import_router = None  # type: ignore
    import logging
    logging.getLogger(__name__).warning(f"[v1/__init__] import_router skipped: {e}")

# List of (router, tag) tuples for registration in main.py
v1_routers: list[tuple[APIRouter, str]] = [
    (sync_router, "Cloud Sync"),
    (team_router, "Team Collaboration"),
    (team_dashboard_router, "Team Dashboard"),
    (version_router, "Version Control"),
    (metrics_router, "Metrics"),
    (ray_router, "Ray 集群管理"),
    (mo_stream_router, "NSGA-II 多目标优化"),
    (batches_router, "批记录管理"),
    (samples_router, "样品与测试"),
    (fact_engine_router, "FactEngine 确定性计算"),
    (doe_router, "DOE 实验设计"),
    (stability_router, "Arrhenius 稳定性预测"),
    (label_router, "标签生成"),
    (document_router, "文档智能提取"),
    (mcp_router, "MCP Server"),
]
if import_router is not None:
    v1_routers.append((import_router, "数据导入"))

__all__ = ["v1_routers"]
