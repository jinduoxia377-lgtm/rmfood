"""
Chat API 请求/响应模型 (Pydantic v2)

独立模块定义，避免 ai_router.py 中复杂导入链导致
Pydantic TypeAdapter "not fully defined" 错误。
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """智能对话请求 — 与前端 ChatTab 兼容"""
    question: str = Field(..., min_length=1, max_length=5000, description="用户提问")
    context: Optional[str] = Field(None, description="上下文信息")
    isFollowUp: Optional[bool] = Field(False, description="是否为追问")
    contextSummary: Optional[str] = Field(None, description="上下文摘要")
    timestamp: Optional[int] = Field(None, description="请求时间戳")
    history: Optional[List[Dict[str, Any]]] = Field(None, description="对话历史")

    model_config = {"extra": "forbid"}


class ChatResponse(BaseModel):
    """智能对话响应 — 与前端 ChatTab 兼容"""
    content: str = Field(..., description="AI 回复内容")
    role: str = Field("assistant", description="角色")
    formulas: List[Dict[str, Any]] = Field(default_factory=list, description="识别的配方数据")
    timestamp: int = Field(default_factory=lambda: int(datetime.now(timezone.utc).timestamp() * 1000))
    model: Optional[str] = Field(None, description="所用模型")
    thinking_steps: List[Dict[str, Any]] = Field(default_factory=list, description="思考步骤")

    model_config = {"extra": "forbid"}
