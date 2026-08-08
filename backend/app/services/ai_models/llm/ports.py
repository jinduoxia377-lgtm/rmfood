"""LLM Client Port - Abstract interface for language model services.

This is the hexagonal architecture port that defines how the AI service
interacts with external language model providers. Concrete adapters
implement this interface for specific providers.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class Message:
    """Chat message representation."""
    def __init__(self, role: str, content: str):
        self.role = role  # "user", "assistant", "system"
        self.content = content


class ChatResponse:
    """API response from an LLM."""
    def __init__(self, messages: List[Message], usage: Dict[str, int], model_used: str):
        self.messages = messages
        self.usage = usage  # {"prompt_tokens": ..., "completion_tokens": ...}
        self.model_used = model_used


class LLMPort(ABC):
    """
    Language Model Provider Port.
    
    All concrete LLM client adapters must implement this interface.
    This ensures dependency inversion and testability.
    """
    
    @abstractmethod
    def chat(self, messages: List[Message], **kwargs) -> ChatResponse:
        """Send a chat request to the model and return response."""
        pass
    
    @abstractmethod
    def get_supported_models(self) -> List[str]:
        """Return list of supported model names."""
        pass
    
    @abstractmethod
    def get_default_model(self) -> str:
        """Return the default model name."""
        pass


class CompletionPort(ABC):
    """
    Text completion port (for non-chat style completions).
    Some models support this pattern differently.
    """
    
    @abstractmethod
    def complete(self, prompt: str, **kwargs) -> str:
        """Generate text completion based on prompt."""
        pass
