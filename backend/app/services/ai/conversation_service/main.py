"""AI Conversation Service - Entry point."""

from fastapi import FastAPI
from .chat_processor import ChatProcessor

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/chat")
async def chat(message: str):
    processor = ChatProcessor()
    return {"response": processor.process(message)}
