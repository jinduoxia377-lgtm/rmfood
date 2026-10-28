"""Chat processor implementation."""

class ChatProcessor:
    """Process chat messages using LLM adapter."""

    def process(self, message: str) -> str:
        """Process a single chat message and return response."""
        # In production, this would call LLM adapter
        return f"[AI]: You said: {message}"
