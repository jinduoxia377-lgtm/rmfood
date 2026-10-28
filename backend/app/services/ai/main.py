"""
⚠️ DEPRECATED - 此文件已废弃，保留仅用于向后兼容

原独立 FastAPI 应用入口，已于 2026-09-21 废弃。
生产环境使用 backend/app/api/ai.py 作为统一入口。

废弃原因:
1. 引用的模块路径不存在 (.app.core.config, .app.services.chat_service)
2. 与主应用重复定义 FastAPI app
3. 未被任何路由注册

替代方案: 使用 /api/v1/ai/chat 和 /api/v1/ai/chat/stream 端点
"""
import logging
import warnings

logger = logging.getLogger(__name__)
warnings.warn(
    "[DEPRECATED] ai.main 已被废弃，请使用 api/ai.py 统一入口",
    DeprecationWarning,
    stacklevel=2,
)

from typing import List  # noqa: F401

from fastapi import FastAPI, HTTPException  # noqa: F401
from pydantic import BaseModel  # noqa: F401

app = FastAPI(
    title="AI Conversation Service (DEPRECATED)",
    description="此服务已废弃，请使用主应用 API",
    version="0.1.0-deprecated",
)

class Message(BaseModel):  # noqa: F401
    role: str
    content: str

class ChatRequest(BaseModel):  # noqa: F401
    messages: List[Message]

@app.get("/health")
async def health_check():
    return {"status": "deprecated", "migrate_to": "/api/v1/ai/health"}

@app.post("/chat")
async def chat(request: ChatRequest):
    raise HTTPException(
        status_code=503,
        detail={
            "error": "SERVICE_DEPRECATED",
            "message": "此服务已废弃，请使用 /api/v1/ai/chat",
            "migration_guide": "参考 ADR-029",
        }
    )
