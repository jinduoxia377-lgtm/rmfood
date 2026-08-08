"""AI Conversation Service - Entry point for chat functionality."""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

from .app.core.config import settings
from .app.services.chat_service import ChatService

app = FastAPI(title="AI Conversation Service", version="1.0.0")

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "ai-communication"}

@app.post("/chat")
async def chat(request: ChatRequest):
    """Process chat request."""
    try:
        chat_service = ChatService()
        response = await chat_service.process(request.messages)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail="AI 处理失败，请稍后重试")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
