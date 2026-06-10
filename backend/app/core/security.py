"""
安全模块
JWT token 编解码、密码哈希等安全相关功能

P0 架构说明:
- 统一使用 app/utils/auth.py 作为底层实现（含 Token 黑名单）
- app/services/auth.py 作为业务层（AuthService + 依赖注入）
- 本模块提供便捷的 re-export，供其他模块使用
"""
from .session import get_db
from ..services.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)

__all__ = [
    "get_db",
    "get_password_hash",
    "verify_password",
    "create_access_token",
    "create_refresh_token",
    "decode_access_token",
]


def decode_access_token(token: str):
    """解码访问令牌（兼容性别名，自动检查 Token 黑名单）"""
    return decode_token(token)
