"""RMFOODFP 自建 MCP 服务器（对外暴露入口包）。

定位：让外部 AI 客户端（Claude Desktop / Cursor / 其它平台）把 RMFOODFP
作为一个 MCP 服务器连接，调用平台自身的配方/食物/中药只读能力。

与既有代码的关系（重要，勿混淆）：
- ``app/services/mcp_server/``  —— 平台 *服务层*：MCP 工具注册表
  （``MCP_TOOL_REGISTRY``，约 20 个只读工具）+ FastAPI 端点层
  （``api.py`` → ``/api/v1/mcp/*``）。这是"在平台进程内、走 HTTP"的暴露形态。
- ``app/services/ai/agent/mcp_bridge.py`` —— 平台作为 *MCP 客户端*，
  连接 *外部* MCP 服务器（pubmed / github …）。
- ``app/mcp_server/``（本包）—— *独立进程* 的 stdio MCP 服务器适配器，
  供 Claude Desktop / Cursor 以 ``command`` 方式直接拉起。它复用
  ``services/mcp_server`` 的工具定义与查询逻辑，是六边形架构里的一个
  **adapter**，不绕过领域/服务层。

MVP 只暴露 2 个真实只读工具：``search_herbs`` / ``get_ingredient``。
详见 docs/design/RMFOODFP自建MCP服务器设计.md。
"""
from __future__ import annotations

__all__ = ["__version__"]

__version__ = "0.1.0"
