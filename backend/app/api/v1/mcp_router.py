"""
MCP API 路由

端点：
- GET  /api/v1/mcp/tools          — 工具列表（JSON Schema）
- GET  /api/v1/mcp/tools/{name}   — 单个工具定义
- POST /api/v1/mcp/call           — 调用工具
- GET  /api/v1/mcp/health         — 健康检查
"""
import logging

from fastapi import APIRouter

from app.services.mcp_server import (
    MCP_TOOL_REGISTRY,
    get_tool_metadata,
    list_all_tool_names,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mcp", tags=["MCP Server"])


@router.get("/health", summary="MCP 服务健康检查")
async def health_check() -> dict:
    return {
        "status": "healthy",
        "server": "rmfood-mcp",
        "tool_count": len(MCP_TOOL_REGISTRY),
        "endpoints": [
            {"method": "GET", "path": "/api/v1/mcp/tools", "description": "工具列表"},
            {"method": "GET", "path": "/api/v1/mcp/tools/{name}", "description": "单个工具定义"},
            {"method": "POST", "path": "/api/v1/mcp/call", "description": "调用工具"},
        ],
    }


@router.get("/tools", summary="MCP 工具列表")
async def list_mcp_tools() -> dict:
    """返回所有 MCP 工具的 JSON Schema 定义"""
    return {
        "status": "ok",
        "server": "rmfood-mcp",
        "version": "1.0.0",
        "tool_count": len(MCP_TOOL_REGISTRY),
        "tools": MCP_TOOL_REGISTRY,
    }


@router.get("/tools/{tool_name}", summary="获取单个工具定义")
async def get_mcp_tool(tool_name: str) -> dict:
    tool = get_tool_metadata(tool_name)
    if tool is None:
        return {
            "status": "error",
            "error": f"Tool '{tool_name}' not found",
            "available_tools": list_all_tool_names(),
        }
    return {"status": "ok", "tool": tool}
