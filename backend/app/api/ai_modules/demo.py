"""
Demo Module - Landing page public demo API module

Provides unauthenticated AI chat interface for landing page visitors.
Includes rate limiting and request logging.
"""
import logging
import datetime
import json
import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import asyncio

from app.services.thinking_engine import thinking_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/demo", tags=["Demo"])

# Rate limit configuration (IP level)
_rate_limit_cache: Dict[str, List[float]] = {}
RATE_LIMIT_MAX_REQUESTS = 20  # Max requests per minute
RATE_LIMIT_WINDOW = 60  # Time window in seconds


class DemoChatRequest(BaseModel):
    """Demo chat request model"""
    message: str = Field(..., min_length=1, max_length=2000, description="User input message")
    context: Optional[str] = Field(None, description="Conversation context")


class DemoChatResponse(BaseModel):
    """Demo chat response model"""
    reply: str
    confidence: float
    model: str
    processing_time_ms: int


class DemoStatusResponse(BaseModel):
    """Demo service status response"""
    status: str
    uptime_seconds: float
    total_requests: int
    active_requests: int


def _check_rate_limit(ip: str) -> bool:
    """Check if IP is within rate limit"""
    now = time.time()
    if ip not in _rate_limit_cache:
        _rate_limit_cache[ip] = []
    
    # Clean up expired records
    _rate_limit_cache[ip] = [
        t for t in _rate_limit_cache[ip] if now - t < RATE_LIMIT_WINDOW
    ]
    
    if len(_rate_limit_cache[ip]) >= RATE_LIMIT_MAX_REQUESTS:
        return False
    
    _rate_limit_cache[ip].append(now)
    return True


@router.get("/status", response_model=DemoStatusResponse, summary="Query demo service status")
async def get_demo_status(request: Request):
    """
    Query demo service status for health check and load monitoring.
    """
    client_ip = request.client.host
    return DemoStatusResponse(
        status="running",
        uptime_seconds=time.time(),
        total_requests=len(_rate_limit_cache.get(client_ip, [])),
        active_requests=0
    )


@router.post("/chat", response_model=DemoChatResponse, summary="AI chat (non-streaming)")
async def demo_chat(request: DemoChatRequest, req: Request):
    """
    Demo AI chat endpoint (non-streaming).
    
    This endpoint does not require authentication and is designed for
    landing page visitors to experience the product.
    """
    client_ip = req.client.host
    
    # Check rate limit
    if not _check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail={"error": "RATE_LIMIT_EXCEEDED", "message": "Request too frequent, please try again later"}
        )
    
    start_time = time.time()
    
    try:
        # Call thinking engine (async generator)
        generator = thinking_engine.generate_thinking_stream(request.message)
        
        # Collect all chunks
        full_content = ""
        async for chunk in generator:
            if chunk.get("type") == "text":
                full_content += chunk.get("content", "")
            elif chunk.get("type") == "thinking":
                pass  # Ignore thinking steps for non-streaming
        
        processing_time = int((time.time() - start_time) * 1000)
        
        # Determine confidence based on content length
        confidence = min(0.95, 0.7 + len(full_content) / 1000)
        
        return DemoChatResponse(
            reply=full_content or "Thank you for your question. I am analyzing it now...",
            confidence=confidence,
            model="thinking-engine-demo",
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        logger.error(f"[demo/chat] Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"error": "INTERNAL_ERROR", "message": str(e)}
        )


@router.post("/chat/stream", response_model=None, summary="AI chat (streaming)")
async def demo_chat_stream(request: DemoChatRequest, req: Request):
    """
    Demo AI chat endpoint (streaming/SSE).
    
    Returns response in SSE format for real-time display.
    """
    client_ip = req.client.host
    
    # Check rate limit
    if not _check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail={"error": "RATE_LIMIT_EXCEEDED", "message": "Request too frequent, please try again later"}
        )
    
    async def event_stream():
        try:
            # Send start event
            yield f"data: {json.dumps({'event': 'start', 'data': {{}}}, ensure_ascii=False)}\n\n"
            
            # Generate response
            result = thinking_engine.generate_thinking_stream(request.message)
            full_content = ""
            
            async for chunk in result:
                if chunk.get("type") == "text":
                    content = chunk.get("content", "")
                    full_content += content
                    yield f"data: {json.dumps({'event': 'content', 'data': {{'text': content}}}, ensure_ascii=False)}\n\n"
                elif chunk.get("type") == "thinking":
                    # Send thinking step as event
                    yield f"data: {json.dumps({{'event': 'thinking', 'data': chunk}}, ensure_ascii=False)}\n\n"
            
            # Send done event
            yield f"data: {json.dumps({{'event': 'done', 'data': {{'content': full_content}}}}, ensure_ascii=False)}\n\n"
            
        except Exception as e:
            logger.error(f"[demo/chat/stream] Error: {str(e)}")
            yield f"data: {json.dumps({{'event': 'error', 'data': {{'error': str(e)}}}}, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )