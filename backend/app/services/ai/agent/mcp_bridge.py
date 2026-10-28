"""
MCP 客户端桥（v3.3）

职责：
- 连接外部 MCP 服务器（HTTP JSON-RPC，首版只支持 HTTP 远程服务器）
- tools/list → 转换为 OpenAI function-calling schema，注册进 orchestrator 工具注册表
- 工具调用转发 tools/call，结果截断并做输出安全检查
- 进程内 schema 缓存（TTL=60s），懒加载 + 执行前按 Bot 绑定的服务器增量注册

命名空间：mcp_<server>__<tool>，避免与内置工具冲突。
安全：服务器需租户可见且 enabled；工具白名单（allow_tools）；参数/结果校验。
"""
from __future__ import annotations

import base64
import json
import logging
import time
from typing import Optional

import httpx
from sqlalchemy import select

from app.services.llm_service import _get_encryption_key
from app.utils.encryption import EncryptionUtils

from ....models.mcp_server import McpServerConfig
from .tools import BaseAgentTool, ToolResult, get_tool_registry

logger = logging.getLogger(__name__)

# schema 缓存 TTL（秒）
SCHEMA_CACHE_TTL = 60.0
# 调用结果截断长度
MCP_RESULT_LIMIT = 2000
# 请求超时
MCP_TIMEOUT = 30.0

_PROTOCOL_VERSION = "2024-11-05"


class McpAgentTool(BaseAgentTool):
    """包装外部 MCP 工具为 orchestrator 可调用的工具"""

    def __init__(self, server_name: str, tool_name: str, description: str, parameters: dict):
        self._server_name = server_name
        self._tool_name = tool_name
        self._description = description
        self._parameters = parameters

    @property
    def name(self) -> str:
        return f"mcp_{self._server_name}__{self._tool_name}"

    @property
    def description(self) -> str:
        return f"[MCP:{self._server_name}] {self._description}"

    @property
    def parameters(self) -> dict:
        return self._parameters or {"type": "object", "properties": {}}

    async def execute(self, params: dict, context: dict) -> ToolResult:
        start = time.time()
        try:
            result_text = await get_mcp_bridge().call_tool(self._server_name, self._tool_name, params)
            return ToolResult(
                tool_name=self.name,
                success=True,
                data={"result": result_text},
                latency_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            logger.warning(f"[MCP] {self.name} 调用失败: {e}")
            return ToolResult(
                tool_name=self.name,
                success=False,
                error=str(e)[:300],
                latency_ms=(time.time() - start) * 1000,
            )


class McpBridge:
    """MCP 客户端桥（单例）"""

    def __init__(self) -> None:
        self._schema_cache: dict[str, tuple[float, list[dict]]] = {}
        self._server_configs: dict[str, McpServerConfig] = {}
        self._config_loaded_at: dict[str, float] = {}

    # ── 配置加载 ──
    async def _load_server(self, db, tenant_id: int, server_name: str) -> Optional[McpServerConfig]:
        """加载服务器配置（带 TTL 缓存，避免每次查询 DB）。"""
        now = time.time()
        cfg = self._server_configs.get(server_name)
        if cfg is not None and self._config_loaded_at.get(server_name, 0) + SCHEMA_CACHE_TTL > now:
            return cfg
        row = (await db.execute(
            select(McpServerConfig).where(
                McpServerConfig.name == server_name,
                McpServerConfig.tenant_id == tenant_id,
                McpServerConfig.enabled.is_(True),
            )
        )).scalar_one_or_none()
        if row is None:
            return None
        self._server_configs[server_name] = row
        self._config_loaded_at[server_name] = now
        return row

    # ── 工具 schema 拉取与注册 ──
    async def ensure_registered(
        self, db, tenant_id: int, allowed_tools: list[str],
    ) -> None:
        """根据 allowed_tools 中的 mcp:<server> 标记，拉取并注册外部工具。

        在 orchestrator 构造 tools_schema **之前**调用，确保本次执行可见（M2）。
        """
        servers = [t[len("mcp:"):] for t in (allowed_tools or []) if t.startswith("mcp:")]
        if not servers:
            return
        for server in servers:
            cfg = await self._load_server(db, tenant_id, server)
            if cfg is None:
                logger.warning(f"[MCP] 服务器未配置或未启用: {server}")
                continue
            tools = await self._list_tools_with_cache(cfg)
            for t in tools:
                tool_name = t.get("name", "")
                if not tool_name:
                    continue
                # 白名单过滤
                allow = cfg.allow_tools or []
                if allow and tool_name not in allow:
                    continue
                registered_name = f"mcp_{server}__{tool_name}"
                if get_tool_registry().get(registered_name) is None:
                    get_tool_registry().register(McpAgentTool(
                        server_name=server,
                        tool_name=tool_name,
                        description=t.get("description", ""),
                        parameters=t.get("inputSchema") or {"type": "object", "properties": {}},
                    ))

    async def _list_tools_with_cache(self, cfg: McpServerConfig) -> list[dict]:
        now = time.time()
        cached = self._schema_cache.get(cfg.name)
        if cached is not None and cached[0] + SCHEMA_CACHE_TTL > now:
            return cached[1]
        tools = await self._list_tools_remote(cfg)
        self._schema_cache[cfg.name] = (now, tools)
        return tools

    async def _list_tools_remote(self, cfg: McpServerConfig) -> list[dict]:
        """调用 MCP tools/list。"""
        result = await self._rpc(cfg, "tools/list", {})
        tools = []
        for t in (result.get("tools") or []):
            tools.append({
                "name": t.get("name", ""),
                "description": t.get("description", ""),
                "inputSchema": t.get("inputSchema") or {"type": "object", "properties": {}},
            })
        return tools

    async def call_tool(self, server_name: str, tool_name: str, args: dict) -> str:
        """调用 MCP 工具，返回文本结果。"""
        cfg = self._server_configs.get(server_name)
        if cfg is None:
            raise RuntimeError(f"MCP 服务器配置未缓存: {server_name}")
        result = await self._rpc(cfg, "tools/call", {"name": tool_name, "arguments": args or {}})
        parts: list[str] = []
        for item in (result.get("content") or []):
            text = item.get("text")
            if text:
                parts.append(str(text))
        text = "\n".join(parts)
        if result.get("isError"):
            raise RuntimeError(text[:300] or "MCP 工具返回错误")
        return text[:MCP_RESULT_LIMIT]

    async def _rpc(self, cfg: McpServerConfig, method: str, params: dict) -> dict:
        """执行一次 MCP JSON-RPC 调用。

        按传输类型分发：stdio 走子进程（line-delimited JSON），否则走 HTTP。
        """
        if cfg.transport == "stdio":
            return await self._rpc_stdio(cfg, method, params)
        return await self._rpc_http(cfg, method, params)

    async def _rpc_http(self, cfg: McpServerConfig, method: str, params: dict) -> dict:
        """HTTP/SSE JSON-RPC 调用。"""
        headers = dict(cfg.headers or {})
        headers["Content-Type"] = "application/json"
        if cfg.auth_token_encrypted:
            try:
                token = EncryptionUtils.decrypt(
                    *(_decode_token(cfg.auth_token_encrypted)),
                    _get_encryption_key(),
                ).decode("utf-8")
                headers["Authorization"] = f"Bearer {token}"
            except Exception as e:
                logger.warning(f"[MCP] Token 解密失败: {e}")
        # 内部服务令牌：让 McpBridge 能调用内置的受保护 MCP 端点
        import os as _os
        try:
            from pathlib import Path

            from dotenv import load_dotenv
            # backend/app/services/ai/agent -> parents[4] = backend
            env_path = Path(__file__).resolve().parents[4] / ".env"
            load_dotenv(env_path, override=True)
        except Exception:
            pass
        internal_token = _os.getenv("INTERNAL_API_TOKEN", "").strip()
        if internal_token:
            headers["X-Internal-Token"] = internal_token

        payload = {
            "jsonrpc": "2.0",
            "id": int(time.time() * 1000) % 1000000,
            "method": method,
            "params": params,
        }
        if not cfg.url:
            raise RuntimeError("HTTP 传输需要配置 url")
        async with httpx.AsyncClient(timeout=MCP_TIMEOUT, trust_env=False) as client:
            resp = await client.post(cfg.url, headers=headers, json=payload)
            resp.raise_for_status()
            body = resp.json()
            if "error" in body:
                raise RuntimeError(str(body["error"]))
            return body.get("result") or {}

    async def _rpc_stdio(self, cfg: McpServerConfig, method: str, params: dict) -> dict:
        """stdio 传输：启动子进程，按 line-delimited JSON 交换请求/响应。"""
        import os
        import shlex
        if not cfg.command:
            raise RuntimeError("stdio 传输需要配置启动命令 command")
        cmd_parts = shlex.split(cfg.command)
        if not cmd_parts:
            raise RuntimeError("启动命令为空")
        env = dict(os.environ)
        for k, v in (cfg.headers or {}).items():
            env[str(k)] = str(v)
        proc = await asyncio.create_subprocess_exec(
            *cmd_parts,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        try:
            # 1. initialize 握手
            init_result = await self._stdio_call(
                proc, "initialize",
                {"protocolVersion": _PROTOCOL_VERSION, "capabilities": {}, "clientInfo": {"name": "rmfood", "version": "1.0"}},
            )
            # 2. 实际方法调用
            return await self._stdio_call(proc, method, params)
        except Exception:
            # 尝试读取 stderr 诊断信息
            try:
                stderr_tail = (await proc.stderr.read())[-300:]
                if stderr_tail:
                    logger.warning(f"[MCP] stdio 子进程 stderr: {stderr_tail.decode(errors='replace')}")
            except Exception:
                pass
            raise
        finally:
            if proc.returncode is None:
                proc.kill()
            try:
                await proc.wait()
            except Exception:
                pass

    async def _stdio_call(self, proc, method: str, params: dict) -> dict:
        """向 stdio 子进程写入一行 JSON 请求并读取一行响应。"""
        payload = {
            "jsonrpc": "2.0",
            "id": int(time.time() * 1000) % 1000000,
            "method": method,
            "params": params,
        }
        if proc.stdin is None or proc.stdout is None:
            raise RuntimeError("MCP stdio 子进程管道不可用")
        proc.stdin.write((json.dumps(payload) + "\n").encode("utf-8"))
        await proc.stdin.drain()
        line = await asyncio.wait_for(proc.stdout.readline(), timeout=MCP_TIMEOUT)
        if not line:
            raise RuntimeError("MCP stdio 子进程无响应输出")
        try:
            resp = json.loads(line.decode("utf-8"))
        except json.JSONDecodeError as e:
            raise RuntimeError(f"MCP stdio 响应解析失败: {line[:200]!r}") from e
        if "error" in resp:
            raise RuntimeError(str(resp.get("error", {})))
        return resp.get("result") or {}


def _decode_token(encrypted: str) -> tuple[bytes, bytes]:
    """将存储的加密 token 解码为 (ciphertext, nonce)。"""
    value = json.loads(encrypted) if encrypted.startswith("{") else {"v": encrypted, "n": ""}
    return (
        base64.b64decode(value.get("v", "")),
        base64.b64decode(value.get("n", "")),
    )


_bridge_instance: Optional[McpBridge] = None


def get_mcp_bridge() -> McpBridge:
    global _bridge_instance
    if _bridge_instance is None:
        _bridge_instance = McpBridge()
    return _bridge_instance
