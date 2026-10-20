"""
GitHub MCP 代理端点（方案 A：内置 GitHub 项目 MCP，用户零配置）

- 端点：POST /api/v1/mcp/github
- 协议：MCP JSON-RPC over HTTP（initialize / tools/list / tools/call）
- 认证：服务端读取环境变量 GITHUB_TOKEN（.env 配置一次，不落库）
- 默认仓库：GITHUB_REPO 环境变量（未设置时由参数提供）
- 封装 GitHub REST API v3（httpx）

内置工具：
- github_get_repo          仓库信息
- github_list_repo_files   列出仓库文件
- github_read_file         读取文件内容
- github_search_code       GitHub 代码搜索
- github_list_issues       Issue 列表
- github_create_issue      创建 Issue
- github_list_pulls        PR 列表
- github_get_commit        查看提交
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mcp/github", tags=["GitHub MCP"])

GITHUB_API = "https://api.github.com"


def _load_env() -> None:
    """确保 .env 中的 GITHUB_TOKEN/INTERNAL_API_TOKEN 写入进程环境变量。

    显式定位 backend/.env（基于本文件路径），避免 find_dotenv 依赖工作目录。
    """
    try:
        from pathlib import Path
        from dotenv import load_dotenv
        env_path = Path(__file__).resolve().parents[3] / ".env"
        load_dotenv(env_path, override=True)
    except Exception:
        pass


DEFAULT_REPO = ""


def _auth_headers() -> dict[str, str]:
    _load_env()
    token = os.getenv("GITHUB_TOKEN", "").strip()
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def _gh(method: str, path: str, **kwargs) -> Any:
    """调用 GitHub REST API。"""
    async with httpx.AsyncClient(timeout=30, trust_env=False) as client:
        resp = await client.request(method, f"{GITHUB_API}{path}", headers=_auth_headers(), **kwargs)
        if resp.status_code >= 400:
            raise RuntimeError(f"GitHub API {resp.status_code}: {resp.text[:300]}")
        if resp.status_code == 204:
            return {}
        return resp.json()


def _default_repo(params: dict) -> str:
    _load_env()
    repo = (params.get("repo") or os.getenv("GITHUB_REPO", "") or "").strip()
    if not repo:
        raise RuntimeError("未指定 repo，请设置 GITHUB_REPO 环境变量或在参数中传入 repo")
    return repo


# ── 工具实现 ─────────────────────────────────────────────

async def _call_tool(tool_name: str, args: dict) -> dict:
    """执行 GitHub 工具，返回 MCP content 文本。"""
    if tool_name == "github_get_repo":
        repo = _default_repo(args)
        data = await _gh("GET", f"/repos/{repo}")
        return {"content": [{"type": "text", "text": json.dumps({
            "full_name": data.get("full_name"),
            "description": data.get("description"),
            "default_branch": data.get("default_branch"),
            "html_url": data.get("html_url"),
            "language": data.get("language"),
            "stargazers_count": data.get("stargazers_count"),
            "updated_at": data.get("updated_at"),
        }, ensure_ascii=False, indent=2)}]}

    if tool_name == "github_list_repo_files":
        repo = _default_repo(args)
        path = (args.get("path") or "").strip("/")
        data = await _gh("GET", f"/repos/{repo}/contents/{path}" if path else f"/repos/{repo}/contents")
        items = []
        for item in (data if isinstance(data, list) else []):
            items.append({"name": item.get("name"), "type": item.get("type"), "path": item.get("path")})
        return {"content": [{"type": "text", "text": json.dumps(items, ensure_ascii=False, indent=2)}]}

    if tool_name == "github_read_file":
        repo = _default_repo(args)
        path = (args.get("path") or "").strip("/")
        if not path:
            raise RuntimeError("参数 path 不能为空")
        data = await _gh("GET", f"/repos/{repo}/contents/{path}")
        content = data.get("content")
        if content:
            import base64
            text = base64.b64decode(content).decode("utf-8", errors="replace")
        else:
            text = json.dumps(data, ensure_ascii=False)
        return {"content": [{"type": "text", "text": text[:20000]}]}

    if tool_name == "github_search_code":
        q = (args.get("query") or "").strip()
        if not q:
            raise RuntimeError("参数 query 不能为空")
        data = await _gh("GET", "/search/code", params={"q": q})
        items = [
            {"name": it.get("name"), "path": it.get("path"), "html_url": it.get("html_url")}
            for it in data.get("items", [])[:10]
        ]
        return {"content": [{"type": "text", "text": json.dumps(items, ensure_ascii=False, indent=2)}]}

    if tool_name == "github_search_repositories":
        q = (args.get("query") or "").strip()
        if not q:
            raise RuntimeError("参数 query 不能为空")
        data = await _gh("GET", "/search/repositories", params={"q": q, "per_page": 10})
        items = [
            {
                "full_name": it.get("full_name"),
                "description": it.get("description"),
                "language": it.get("language"),
                "stargazers_count": it.get("stargazers_count"),
                "html_url": it.get("html_url"),
                "topics": it.get("topics", [])[:5],
            }
            for it in data.get("items", [])
        ]
        return {"content": [{"type": "text", "text": json.dumps(items, ensure_ascii=False, indent=2)}]}

    if tool_name == "github_list_issues":
        repo = _default_repo(args)
        state = args.get("state") or "open"
        data = await _gh("GET", f"/repos/{repo}/issues", params={"state": state, "per_page": 10})
        items = [
            {"number": it.get("number"), "title": it.get("title"), "state": it.get("state"),
             "html_url": it.get("html_url")}
            for it in data if "pull_request" not in it
        ]
        return {"content": [{"type": "text", "text": json.dumps(items, ensure_ascii=False, indent=2)}]}

    if tool_name == "github_create_issue":
        repo = _default_repo(args)
        title = (args.get("title") or "").strip()
        body = (args.get("body") or "").strip()
        if not title:
            raise RuntimeError("参数 title 不能为空")
        data = await _gh("POST", f"/repos/{repo}/issues", json={"title": title, "body": body})
        return {"content": [{"type": "text", "text": json.dumps(
            {"number": data.get("number"), "title": data.get("title"), "html_url": data.get("html_url")},
            ensure_ascii=False,
        )}]}

    if tool_name == "github_list_pulls":
        repo = _default_repo(args)
        state = args.get("state") or "open"
        data = await _gh("GET", f"/repos/{repo}/pulls", params={"state": state, "per_page": 10})
        items = [
            {"number": it.get("number"), "title": it.get("title"), "state": it.get("state"),
             "html_url": it.get("html_url")}
            for it in data
        ]
        return {"content": [{"type": "text", "text": json.dumps(items, ensure_ascii=False, indent=2)}]}

    if tool_name == "github_get_commit":
        repo = _default_repo(args)
        sha = (args.get("sha") or "").strip()
        if not sha:
            raise RuntimeError("参数 sha 不能为空")
        data = await _gh("GET", f"/repos/{repo}/commits/{sha}")
        return {"content": [{"type": "text", "text": json.dumps({
            "sha": data.get("sha"),
            "message": (data.get("commit") or {}).get("message"),
            "author": (data.get("commit") or {}).get("author", {}).get("name"),
            "html_url": data.get("html_url"),
        }, ensure_ascii=False, indent=2)}]}

    raise RuntimeError(f"未知工具: {tool_name}")


# ── MCP 协议端点 ─────────────────────────────────────────

_TOOLS_SCHEMA = [
    {"name": "github_get_repo", "description": "获取 GitHub 仓库信息（默认仓库来自 GITHUB_REPO 环境变量，也可传入 repo 参数）",
     "inputSchema": {"type": "object", "properties": {"repo": {"type": "string", "description": "仓库，如 owner/name"}}}},
    {"name": "github_list_repo_files", "description": "列出 GitHub 仓库指定路径下的文件与目录",
     "inputSchema": {"type": "object", "properties": {"repo": {"type": "string"}, "path": {"type": "string", "description": "目录路径（可选）"}}}},
    {"name": "github_read_file", "description": "读取 GitHub 仓库中指定文件的文本内容",
     "inputSchema": {"type": "object", "properties": {"repo": {"type": "string"}, "path": {"type": "string", "description": "文件路径，如 docs/README.md"}}, "required": ["path"]}},
    {"name": "github_search_code", "description": "在 GitHub 上搜索代码",
     "inputSchema": {"type": "object", "properties": {"query": {"type": "string", "description": "搜索表达式"}}, "required": ["query"]}},
    {"name": "github_search_repositories", "description": "按关键词/主题搜索 GitHub 仓库（用于发现开源技能、工具、Agent 模板）",
     "inputSchema": {"type": "object", "properties": {"query": {"type": "string", "description": "搜索词，如 toxicology mcp server / 配方设计 agent"}}, "required": ["query"]}},
    {"name": "github_list_issues", "description": "列出仓库 Issue",
     "inputSchema": {"type": "object", "properties": {"repo": {"type": "string"}, "state": {"type": "string", "enum": ["open", "closed", "all"]}}}},
    {"name": "github_create_issue", "description": "在仓库创建 Issue",
     "inputSchema": {"type": "object", "properties": {"repo": {"type": "string"}, "title": {"type": "string"}, "body": {"type": "string"}}, "required": ["title"]}},
    {"name": "github_list_pulls", "description": "列出仓库 Pull Request",
     "inputSchema": {"type": "object", "properties": {"repo": {"type": "string"}, "state": {"type": "string", "enum": ["open", "closed", "all"]}}}},
    {"name": "github_get_commit", "description": "查看仓库单个提交详情",
     "inputSchema": {"type": "object", "properties": {"repo": {"type": "string"}, "sha": {"type": "string", "description": "提交 SHA"}}, "required": ["sha"]}},
]


def _check_auth(request: Request) -> bool:
    """校验请求来源：内部服务令牌（X-Internal-Token）或用户 JWT。

    - 内部令牌：INTERNAL_API_TOKEN 环境变量（McpBridge 调用内置端点时携带）
    - 用户 JWT：Authorization: Bearer <token>（登录用户可直接调用）
    两者都不满足时返回 False。
    """
    _load_env()
    internal_token = os.getenv("INTERNAL_API_TOKEN", "").strip()
    header_token = request.headers.get("x-internal-token", "").strip()
    if internal_token and header_token == internal_token:
        return True
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        try:
            from app.utils.auth import decode_token
            payload = decode_token(token)
            if payload and payload.get("sub"):
                return True
        except Exception:
            return False
    return False


@router.post("")
async def mcp_github_endpoint(request: Request) -> dict:
    """MCP JSON-RPC over HTTP 端点。"""
    if not _check_auth(request):
        return {
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32001, "message": "Unauthorized"},
        }
    try:
        body = await request.json()
    except Exception:
        return {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}

    method = body.get("method", "")
    params = body.get("params") or {}
    req_id = body.get("id")

    if method == "initialize":
        return {
            "jsonrpc": "2.0", "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "rmfood-github-mcp", "version": "1.0.0"},
            },
        }
    if method == "tools/list":
        return {
            "jsonrpc": "2.0", "id": req_id,
            "result": {"tools": _TOOLS_SCHEMA},
        }
    if method == "tools/call":
        tool_name = (params.get("name") or "")
        arguments = params.get("arguments") or {}
        try:
            result = await _call_tool(tool_name, arguments)
            return {"jsonrpc": "2.0", "id": req_id, "result": result}
        except Exception as e:
            return {
                "jsonrpc": "2.0", "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": f"[GitHub MCP 调用失败] {str(e)[:300]}"}],
                    "isError": True,
                },
            }

    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Method not found: {method}"}}