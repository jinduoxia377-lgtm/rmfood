"""Chat service implementation."""

class ChatService:
    """Handle chat processing."""
    
    async def process(self, messages):
        """Process chat message list and return response."""
        # In production, this would call LLM adapter
        # Simple echo for now
        return "[AI]: I received your message!"
