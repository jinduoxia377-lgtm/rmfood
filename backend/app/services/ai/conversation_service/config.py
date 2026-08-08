"""Configuration for AI service."""

import os

class Config:
    SERVICE_NAME = "ai-conversation-service"
    PORT = int(os.getenv("PORT", "8000"))
    HOST = os.getenv("HOST", "0.0.0.0")
