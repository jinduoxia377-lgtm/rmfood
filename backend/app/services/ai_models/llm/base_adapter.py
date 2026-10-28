"""Base adapter for LLM clients."""

from typing import (
    Any,
    Dict,
    List,  # A-27
    )

from .ports import ChatResponse, LLMPort, Message


class BaseLLMAdapter(LLMPort):
    """Base class for all LLM provider adapters."""

    def __init__(self, api_key: str, default_model: str, timeout: int = 30):
        self.api_key = api_key
        self.default_model = default_model
        self.timeout = timeout
        self.supported_models: List[str] = [default_model]

    def chat(self, messages: List[Message], **kwargs) -> ChatResponse:
        """Implement in subclass."""
        raise NotImplementedError()

    def get_supported_models(self) -> List[str]:
        return self.supported_models

    def get_default_model(self) -> str:
        return self.default_model

    def _build_request_payload(self, messages: List[Message], **kwargs) -> Dict[str, Any]:
        """Build API request payload (to be implemented by subclass)."""
        payload = {
            "model": kwargs.get('model', self.default_model),
            "messages": [{"role": m.role, "content": m.content} for m in messages],
        }
        # Add other parameters like temperature, max_tokens, etc.
        if 'temperature' in kwargs:
            payload['temperature'] = kwargs['temperature']
        if 'max_tokens' in kwargs:
            payload['max_tokens'] = kwargs['max_tokens']
        return payload
