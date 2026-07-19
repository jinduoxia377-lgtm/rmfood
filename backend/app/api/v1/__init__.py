"""API v1 package - version-specific routers.

Aggregates v1-specific routers that extend the base API with
enterprise features: cloud sync, team collaboration, dashboards,
and version control.

These routers exist only in the v1 namespace (no api/ counterpart).
"""
from fastapi import APIRouter

from .sync_router import router as sync_router
from .team_router import router as team_router
from .team_dashboard_router import router as team_dashboard_router
from .version_router import router as version_router
from .metrics_router import router as metrics_router
from .ray_router import router as ray_router
from .mo_stream_endpoint import router as mo_stream_router

# List of (router, tag) tuples for registration in main.py
v1_routers: list[tuple[APIRouter, str]] = [
    (sync_router, "Cloud Sync"),
    (team_router, "Team Collaboration"),
    (team_dashboard_router, "Team Dashboard"),
    (version_router, "Version Control"),
    (metrics_router, "Metrics"),
    (ray_router, "Ray 集群管理"),
    (mo_stream_router, "NSGA-II 多目标优化"),
]

__all__ = ["v1_routers"]
