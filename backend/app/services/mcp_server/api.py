"""
MCP Server — FastAPI 端点层

提供 /api/v1/mcp/* 端点，供 AI 助手通过标准 MCP 协议访问平台数据。
同时提供 /api/v1/mcp/tools 元数据端点用于工具发现。
"""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.database.session import get_db
from app.services.mcp_server import (
    MCP_TOOL_REGISTRY,
    list_tools,
    get_tool_metadata,
    list_all_tool_names,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mcp", tags=["MCP Server"])


# ═══════════════════════════════════════════
# 元数据端点
# ═══════════════════════════════════════════

@router.get("/tools", summary="MCP 工具列表")
async def list_mcp_tools() -> dict:
    """
    返回所有 MCP 工具的 JSON Schema 定义。
    AI 助手调用此端点发现可用工具。
    """
    return {
        "status": "ok",
        "server": "rmfood-mcp",
        "version": "1.0.0",
        "tool_count": len(MCP_TOOL_REGISTRY),
        "tools": MCP_TOOL_REGISTRY,
    }


@router.get("/tools/{tool_name}", summary="获取单个工具定义")
async def get_mcp_tool(tool_name: str) -> dict:
    """获取指定工具的完整 JSON Schema 定义"""
    tool = get_tool_metadata(tool_name)
    if tool is None:
        return {
            "status": "error",
            "error": f"Tool '{tool_name}' not found",
            "available_tools": list_all_tool_names(),
        }
    return {"status": "ok", "tool": tool}


# ═══════════════════════════════════════════
# 工具调用端点（JSON-RPC 风格）
# ═══════════════════════════════════════════

class MCPToolCall(BaseModel):
    tool_name: str
    arguments: Dict[str, Any] = {}


class MCPToolResult(BaseModel):
    status: str
    tool: str
    result: Any
    error: Optional[str] = None


@router.post("/call", summary="调用 MCP 工具", response_model=MCPToolResult)
async def call_mcp_tool(
    call: MCPToolCall,
    db=Depends(get_db),
) -> dict:
    """
    通用 MCP 工具调用入口。
    根据 tool_name 路由到对应查询函数。
    """
    from app.services.mcp_server.handlers import handle_tool_call

    try:
        result = await handle_tool_call(db, call.tool_name, call.arguments)
        return {"status": "ok", "tool": call.tool_name, "result": result}
    except KeyError as e:
        return {
            "status": "error",
            "tool": call.tool_name,
            "result": None,
            "error": f"Unknown tool: {e}",
        }
    except Exception as e:
        logger.exception(f"MCP tool call failed: {call.tool_name}")
        return {
            "status": "error",
            "tool": call.tool_name,
            "result": None,
            "error": str(e),
        }


# ═══════════════════════════════════════════
# 健康检查
# ═══════════════════════════════════════════

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
