"""
开放 API 管理

提供 API Key 的创建、管理、限流和用量统计。
"""
from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class APIKey:
    """API Key 记录"""
    key_id: str
    name: str
    key_hash: str           # SHA-256 哈希，不存储明文
    key_prefix: str         # 前8位用于展示（如 rmf_xxxxxxxx）
    user_id: int
    organization_id: Optional[int]
    permissions: List[str] = field(default_factory=list)
    rate_limit_rpm: int = 60
    rate_limit_rph: int = 1000
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_used_at: Optional[datetime] = None
    usage_count: int = 0
    expires_at: Optional[datetime] = None


class APIKeyManager:
    """API Key 管理器"""

    def __init__(self):
        self._keys: Dict[str, APIKey] = {}

    def create_key(
        self,
        name: str,
        user_id: int,
        organization_id: Optional[int] = None,
        permissions: Optional[List[str]] = None,
        rate_limit_rpm: int = 60,
        expires_days: Optional[int] = None,
    ) -> Dict[str, str]:
        """创建新的 API Key，返回明文（仅一次）"""
        import secrets
        raw_key = f"rmf_{secrets.token_hex(16)}"
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        key_prefix = raw_key[:12]  # rmf_xxxxxxxx

        key_id = f"key_{int(time.time())}_{hash(key_hash)[:8]}"

        expires_at = None
        if expires_days:
            expires_at = datetime.now(timezone.utc).replace(
                timezone.utc
            )  # simplified

        key = APIKey(
            key_id=key_id,
            name=name,
            key_hash=key_hash,
            key_prefix=key_prefix,
            user_id=user_id,
            organization_id=organization_id,
            permissions=permissions or [],
            rate_limit_rpm=rate_limit_rpm,
            expires_at=expires_at,
        )
        self._keys[key_id] = key
        logger.info("API Key 创建: %s (prefix: %s...)", name, key_prefix)

        return {
            "key_id": key_id,
            "api_key": raw_key,  # 仅返回一次！
            "key_prefix": key_prefix,
            "name": name,
            "permissions": key.permissions,
        }

    def validate_key(self, raw_key: str) -> Optional[APIKey]:
        """验证 API Key"""
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        for key in self._keys.values():
            if key.key_hash == key_hash and key.is_active:
                key.usage_count += 1
                key.last_used_at = datetime.now(timezone.utc)
                return key
        return None

    def list_keys(self, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """列出 API Keys（不含哈希）"""
        result = []
        for key in self._keys.values():
            if user_id and key.user_id != user_id:
                continue
            result.append({
                "key_id": key.key_id,
                "name": key.name,
                "key_prefix": key.key_prefix,
                "user_id": key.user_id,
                "permissions": key.permissions,
                "rate_limit_rpm": key.rate_limit_rpm,
                "is_active": key.is_active,
                "usage_count": key.usage_count,
                "created_at": key.created_at.isoformat(),
                "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
            })
        return result

    def revoke_key(self, key_id: str) -> bool:
        """吊销 API Key"""
        if key_id in self._keys:
            self._keys[key_id].is_active = False
            return True
        return False

    def get_stats(self) -> Dict[str, Any]:
        """获取 API Key 统计"""
        active = sum(1 for k in self._keys.values() if k.is_active)
        total_usage = sum(k.usage_count for k in self._keys.values())
        return {
            "total_keys": len(self._keys),
            "active_keys": active,
            "total_requests": total_usage,
        }


# 全局单例
_manager: Optional[APIKeyManager] = None


def get_api_key_manager() -> APIKeyManager:
    global _manager
    if _manager is None:
        _manager = APIKeyManager()
    return _manager
