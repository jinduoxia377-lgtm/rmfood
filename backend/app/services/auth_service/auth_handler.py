"""Authentication handler implementation."""

import hashlib
from typing import Optional

class AuthHandler:
    """Handle authentication logic."""
    
    def __init__(self):
        # In production, connect to actual auth database/service
        self._test_users = {"admin": "password123"}
    
    async def authenticate(self, username: str, password: str) -> str:
        """Authenticate credentials and return token."""
        if username in self._test_users and self._test_users[username] == password:
            # In real app, generate JWT token here
            return f"mock_token_{username}"
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    async def get_current_user(self, token: str) -> str:
        """Extract user ID from token (simplified)."""
        if token.startswith("mock_token_"):
            return token.replace("mock_token_", "")
        raise HTTPException(status_code=401, detail="令牌无效")
