"""RMFOODFP stdio MCP 服务器骨架（零依赖手写 JSON-RPC）。

为什么零依赖手写，而不用 mcp SDK？
- backend/venv 已安装 ``mcp==2.2.0``，但 2.x 把 ``FastMCP`` 改名为
  ``MCPServer``（``mcp.server.fastmcp`` 已删除、仅留报错桩），1.x 教程/示例
  全部失效，API 仍在演进。
- MCP 协议本体很小（line-delimited JSON-RPC 2.0 over stdio），本项目已有
  成熟先例：``backend/scripts/demo_stdio_mcp_server.py`` 与
  ``app/api/v1/github_mcp_router.py`` 都是手写 JSON-RPC。
- 因此骨架采用零依赖手写方式，规避 SDK 大版本改名风险；若未来要上
  streamable-http / 资源订阅等高级能力，再评估切换到 MCPServer 或独立
  FastMCP 库（见设计文档"技术选型"）。

协议支持（外部客户端真正会调用的最小集合）：
- ``initialize``                    → 返回 protocolVersion/capabilities/serverInfo
- ``notifications/initialized``     → 通知，无需响应
- ``tools/list``                    → 返回工具 JSON Schema 列表
- ``tools/call``                    → 执行只读工具，返回 MCP content
- ``ping``                          → 心跳
- 其余方法                          → JSON-RPC error -32601

安全约束：本服务器 *只读*。所有工具仅查询，不修改任何数据库状态；
MVP 阶段通过 ``--tenant`` 启动参数绑定单一租户，无写工具、无跨租户访问。

用法（Claude Desktop / Cursor 的 mcpServers 配置，路径用正斜杠规避反斜杠转义）：
    D:/RMFOODFP/backend/venv/Scripts/python.exe D:/RMFOODFP/backend/app/mcp_server/server.py --tenant 1
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any, Awaitable, Callable

# 启动方式兼容（关键）：
# Claude Desktop / Cursor 以 ``command`` 直接拉起本文件（``python .../server.py``），
# 此时 sys.path[0] = mcp_server 目录，``app`` 包不可见 → 必须**在任何本地导入前**
# 把 backend 根插入 sys.path。``python -m app.mcp_server.server`` 方式 backend 已在
# path（cwd），insert 幂等。统一走绝对导入 ``app.mcp_server.*``，不再用相对导入。
_BACKEND_ROOT = str(Path(__file__).resolve().parents[2])  # backend/
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from app.mcp_server import db as mcp_db  # noqa: E402
from app.mcp_server.tools import TOOL_DEFINITIONS, call_tool  # noqa: E402

logger = logging.getLogger("rmfood.mcp_server")

PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "rmfood-mcp"
SERVER_VERSION = "0.1.0"


def _ok(req_id: Any, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _err(req_id: Any, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


async def _handle(
    method: str,
    params: dict,
    req_id: Any,
    tenant_id: int | None,
) -> dict | None:
    """路由单个 JSON-RPC 方法。返回响应 dict，通知则返回 None。"""
    if method == "initialize":
        return _ok(req_id, {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
        })

    if method == "notifications/initialized":
        return None  # 通知：不响应

    if method == "ping":
        return _ok(req_id, {})

    if method == "tools/list":
        return _ok(req_id, {"tools": TOOL_DEFINITIONS})

    if method == "tools/call":
        name = (params or {}).get("name", "")
        args = (params or {}).get("arguments") or {}
        try:
            result = await call_tool(name, args, tenant_id=tenant_id)
            return _ok(req_id, result)
        except KeyError:
            return _ok(req_id, {
                "content": [{"type": "text", "text": f"未知工具: {name}"}],
                "isError": True,
            })
        except Exception as exc:  # 把异常转成 MCP isError，不让进程崩溃
            logger.exception("工具 %s 执行失败", name)
            return _ok(req_id, {
                "content": [{"type": "text", "text": f"[{name} 调用失败] {str(exc)[:300]}"}],
                "isError": True,
            })

    # 未知方法（带 id 才回 error；通知型未知方法静默）
    if req_id is not None:
        return _err(req_id, -32601, f"Method not found: {method}")
    return None


def _serve(tenant_id: int | None) -> int:
    """同步主循环：逐行读 stdin，逐条处理并写 stdout。

    采用同步 ``for raw in sys.stdin``（与 backend/scripts/demo_stdio_mcp_server.py
    一致），而非 asyncio connect_read_pipe —— 后者在 Windows 把重定向文件作为
    stdin 时不触发 EOF，会导致进程挂住不退出。工具内部是 async，因此对每个
    请求用独立 event loop 执行（stdio MCP 每次一个请求，串行足够）。
    """
    # 用一个后台 event loop 执行 async 工具，避免每请求反复建 loop 的开销
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    # MCP JSON-RPC 通道强制 UTF-8：Windows 下子进程 stdout 默认跟随控制台
    # 代码页（GBK），会把中文工具描述/结果写成非 UTF-8 字节，破坏客户端解析。
    for stream in (sys.stdin, sys.stdout):
        try:
            stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
        except AttributeError:
            pass

    # stdio 独立进程的 DB bootstrap：显式预热一次连接。
    # 可达 → 工具走真实库；不可达 → 记 warning，工具届时优雅降级 sample，进程照常起来。
    try:
        loop.run_until_complete(mcp_db.warmup())
    except Exception as exc:  # noqa: BLE001 - bootstrap 失败不阻止 stdio 启动
        logger.warning("[mcp_server] DB warmup 异常（将降级 sample）: %s", exc)

    def _write(payload: dict) -> None:
        # 关键：写 stdout 后立即 flush，否则客户端 readline 会阻塞到超时
        sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
        sys.stdout.flush()

    try:
        for raw in sys.stdin:
            raw = raw.strip()
            if not raw:
                continue
            try:
                req = json.loads(raw)
            except json.JSONDecodeError:
                continue
            method = req.get("method", "")
            params = req.get("params") or {}
            req_id = req.get("id")
            try:
                resp = loop.run_until_complete(
                    _handle(method, params, req_id, tenant_id)
                )
            except KeyboardInterrupt:
                break
            if resp is not None:
                _write(resp)
    finally:
        try:
            loop.run_until_complete(mcp_db.shutdown())
        except Exception:
            pass
        loop.close()
    return 0


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="RMFOODFP stdio MCP 服务器")
    parser.add_argument(
        "--tenant", type=int, default=None,
        help="绑定的租户 ID（多租户隔离；MVP 单租户模式）",
    )
    parser.add_argument(
        "--log-level", default="WARNING",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    args = parser.parse_args(argv)

    # 日志走 stderr，绝不污染 stdout（stdout 是 JSON-RPC 通道）
    logging.basicConfig(
        stream=sys.stderr, level=args.log_level,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    try:
        raise SystemExit(_serve(args.tenant))
    except KeyboardInterrupt:
        raise SystemExit(0)


if __name__ == "__main__":
    main()
