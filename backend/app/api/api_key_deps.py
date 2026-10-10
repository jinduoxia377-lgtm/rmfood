"""API 密钥认证依赖（RMFOOD）

让用户在 /settings 与 /integrations 页面创建的 API 密钥可用于**程序化鉴权**。

- 从 `X-API-Key` 请求头读取明文密钥
- 通过 `APIKeyService.verify_key()` 校验（SHA-256 哈希比对 + is_active + 未过期）
- 校验通过后更新 `last_used_at`，返回 `ApiKeyPrincipal`（密钥身份上下文）
- 可选认证：`get_current_api_key`（无密钥返回 None）
- 强制认证：`get_current_active_api_key`（无密钥抛 401）
- 权限范围：`require_api_scope(*scopes)`（scope 不满足抛 403）

修复背景（P0）：
  此前 `verify_key()` 全后端无任何调用点，创建的密钥"存而不用"，
  无法真正用于 API 鉴权。本模块把它接入 FastAPI 依赖，使密钥成为可用的凭证。
"""

import logging
from typing import Annotated, List, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession

from .deps import get_db_session
from ..core.api_framework.integration_framework import get_api_key_service

logger = logging.getLogger(__name__)


# 从 X-API-Key 请求头读取密钥（程序化访问的惯用约定）
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


class ApiKeyPrincipal:
    """认证通过后的 API 密钥身份上下文（不含明文，仅含派生信息）"""

    __slots__ = ("id", "name", "key_prefix", "owner_id", "scopes")

    def __init__(self, key) -> None:
        self.id = key.id
        self.name = key.name
        self.key_prefix = key.key_prefix
        self.owner_id = key.owner_id
        self.scopes = list(key.scopes or [])


async def get_current_api_key(
    x_api_key: Annotated[Optional[str], Depends(api_key_header)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> Optional[ApiKeyPrincipal]:
    """
    获取当前 API 密钥（可选认证）。

    - 提供了有效密钥 → 返回 ApiKeyPrincipal（并更新 last_used_at）
    - 提供了无效/过期/已撤销密钥 → 抛 401
    - 未提供密钥 → 返回 None（用于可选认证端点）
    """
    if not x_api_key:
        return None

    key = await get_api_key_service(db).verify_key(x_api_key)
    if key is None:
        logger.warning("API 密钥校验失败（无效/过期/已撤销）")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效或已过期的 API 密钥",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    return ApiKeyPrincipal(key)


async def get_current_active_api_key(
    principal: Annotated[Optional[ApiKeyPrincipal], Depends(get_current_api_key)],
) -> ApiKeyPrincipal:
    """获取当前有效 API 密钥（强制认证）。未提供有效密钥时抛 401。"""
    if principal is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少 API 密钥，请在 X-API-Key 请求头中提供有效密钥",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    return principal


def require_api_scope(*scopes: str):
    """
    细粒度 scope 检查工厂。满足其一即可（`*` 表示所有权限）。

    Args:
        *scopes: 允许的 scope 列表（例如 require_api_scope("read", "admin")）
    """

    async def scope_checker(
        principal: Annotated[ApiKeyPrincipal, Depends(get_current_active_api_key)],
    ) -> ApiKeyPrincipal:
        if "*" in principal.scopes:
            return principal
        if not any(s in principal.scopes for s in scopes):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "INSUFFICIENT_SCOPE",
                    "message": f"权限不足，需要以下 scope 之一: {', '.join(scopes)}",
                    "current_scopes": principal.scopes,
                },
            )
        return principal

    return scope_checker


# 常用依赖快捷别名
ActiveApiKey = Annotated[ApiKeyPrincipal, Depends(get_current_active_api_key)]