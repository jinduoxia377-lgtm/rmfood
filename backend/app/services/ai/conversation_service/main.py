# ruff: noqa: E402
"""
⚠️ DEPRECATED - 此文件已废弃，保留仅用于向后兼容

原独立 FastAPI 应用入口，已于 2026-09-21 废弃。
生产环境使用 backend/app/api/ai.py 作为统一入口。

废弃原因:
1. 与主应用重复定义 FastAPI app
2. 引用的模块路径不存在 (.app.core.config, .app.services.chat_service)
3. 已被微服务网关 (main_entry.py) 注册但实际未使用

替代方案: 使用 /api/v1/ai/chat 和 /api/v1/ai/chat/stream 端点
"""
import logging
import warnings

logger = logging.getLogger(__name__)
warnings.warn(
    "[DEPRECATED] ai.conversation_service.main 已被废弃，请使用 api/ai.py 统一入口",
    DeprecationWarning,
    stacklevel=2,
)

# 保持接口兼容但标记为废弃
from fastapi import FastAPI  # noqa: F401

from .chat_processor import ChatProcessor  # noqa: F401

app = FastAPI(
    title="AI Conversation Service (DEPRECATED)",
    description="此服务已废弃，请使用主应用 API",
    version="0.1.0-deprecated",
)

@app.get("/health")
async def health():
    return {"status": "deprecated", "migrate_to": "/api/v1/ai/chat"}

@app.post("/chat")
async def chat(message: str):
    return {"response": f"[DEPRECATED] {message}", "_warning": "使用 /api/v1/ai/chat 替代"}
