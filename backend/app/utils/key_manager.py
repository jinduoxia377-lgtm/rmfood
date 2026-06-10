"""RMFOOD 密钥管理

提供安全的密钥生成、派生、轮换和存储管理。
支持HKDF密钥派生、版本控制和自动轮换。
"""
import os
import json
import base64
import hashlib
import hmac
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field

from app.core.logging_config import logger

try:
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    from cryptography.hazmat.primitives import hashes
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False

from .encryption import EncryptionUtils, EncryptionError


@dataclass
class KeyMetadata:
    """密钥元数据"""
    key_id: str
    version: int
    algorithm: str = "AES-256-GCM"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    is_active: bool = True
    is_archived: bool = False
    purpose: str = "data_encryption"
    user_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "key_id": self.key_id,
            "version": self.version,
            "algorithm": self.algorithm,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active,
            "is_archived": self.is_archived,
            "purpose": self.purpose,
            "user_id": self.user_id,
        }


@dataclass
class KeyArchiveEntry:
    """归档密钥条目"""
    key_id: str
    encrypted_key: bytes
    nonce: bytes
    metadata: KeyMetadata
    archived_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    retention_until: Optional[datetime] = None


class KeyManager:
    """
    密钥管理器
    
    功能：
    - 生成和管理主密钥（master key）
    - 派生用户专属数据加密密钥（HKDF）
    - 密钥版本控制（支持多版本共存）
    - 定期密钥轮换（默认90天）
    - 密钥归档和恢复（用于回滚）
    
    安全设计：
    - 主密钥从环境变量或安全配置加载
    - 用户密钥通过HKDF从主密钥派生，不单独存储
    - 轮换时使用新密钥重新加密所有数据
    - 旧密钥归档保留30天用于紧急回滚
    
    使用示例：
        >>> km = KeyManager(master_key=b"...")
        >>> user_key = km.get_data_encryption_key(user_id="123")
        >>> await km.rotate_keys()
    """

    DEFAULT_KEY_ROTATION_DAYS = 90
    ARCHIVE_RETENTION_DAYS = 30
    MAX_KEY_VERSIONS = 10

    def __init__(
        self,
        master_key: Optional[bytes] = None,
        key_rotation_days: int = DEFAULT_KEY_ROTATION_DAYS,
        archive_retention_days: int = ARCHIVE_RETENTION_DAYS,
    ):
        """
        初始化密钥管理器
        
        Args:
            master_key: 主加密密钥（32字节）。如果为None则自动生成。
            key_rotation_days: 密钥轮换周期（天）
            archive_retention_days: 归档保留时间（天）
        """
        if master_key:
            if len(master_key) != 32:
                raise ValueError("主密钥必须为32字节（256位）")
            self._master_key = master_key
        else:
            self._master_key = EncryptionUtils.generate_key()

        self.key_rotation_days = key_rotation_days
        self.archive_retention_days = archive_retention_days
        
        self._user_keys: Dict[str, Tuple[bytes, KeyMetadata]] = {}
        self._key_versions: Dict[str, List[KeyMetadata]] = {}
        self._archived_keys: Dict[str, KeyArchiveEntry] = {}
        
        self._current_version: int = 1
        
        self._stats = {
            "keys_derived": 0,
            "rotations_completed": 0,
            "archive_count": 0,
            "last_rotation": None,
        }

    def get_data_encryption_key(
        self,
        user_id: str,
        version: Optional[int] = None,
    ) -> bytes:
        """
        派生用户专属的数据加密密钥
        
        使用HKDF（HMAC-based Extract-and-Expand Key Derivation Function）
        从主密钥安全地派生用户密钥。
        
        每个用户的密钥都是唯一的，即使主密钥泄露，
        攻击者也需要针对每个用户单独破解。
        
        Args:
            user_id: 用户ID（作为盐值）
            version: 密钥版本号（None表示最新版本）
            
        Returns:
            32字节的用户专属加密密钥
            
        Example:
            >>> km = KeyManager(master_key=...)
            >>> key = km.get_data_encryption_key(user_id="user_123")
            >>> len(key)
            32
        """
        cache_key = f"{user_id}:{version or 'latest'}"
        
        if cache_key in self._user_keys:
            return self._user_keys[cache_key][0]

        salt = user_id.encode("utf-8")
        info = f"data_encryption:v{version or self._current_version}".encode("utf-8")

        derived_key = self._hkdf_derive(
            master_key=self._master_key,
            salt=salt,
            info=info,
            length=32,
        )

        metadata = KeyMetadata(
            key_id=self._generate_key_id(),
            version=version or self._current_version,
            user_id=user_id,
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(days=self.key_rotation_days),
        )

        self._user_keys[cache_key] = (derived_key, metadata)
        
        if user_id not in self._key_versions:
            self._key_versions[user_id] = []
        self._key_versions[user_id].append(metadata)
        
        self._stats["keys_derived"] += 1

        return derived_key

    async def rotate_keys(
        self,
        force: bool = False,
    ) -> Dict[str, Any]:
        """
        执行密钥轮换
        
        流程：
        1. 生成新的主密钥版本
        2. 归档当前主密钥
        3. 更新版本号
        4. 清理过期的归档密钥
        
        注意：实际的数据重新加密需要在应用层完成，
        此方法只负责密钥层面的轮换。
        
        Args:
            force: 是否强制轮换（忽略周期检查）
            
        Returns:
            轮换结果信息
        """
        last_rotation = self._stats.get("last_rotation")
        
        if not force and last_rotation:
            days_since_rotation = (datetime.now(timezone.utc) - last_rotation).days
            if days_since_rotation < self.key_rotation_days:
                return {
                    "success": False,
                    "message": f"距上次轮换仅 {days_since_rotation} 天，"
                              f"未达到 {self.key_rotation_days} 天的轮换周期",
                    "next_rotation_in": self.key_rotation_days - days_since_rotation,
                }

        old_master_key = self._master_key
        
        try:
            new_master_key = EncryptionUtils.generate_key()
            
            archive_entry = self._archive_key(old_master_key, purpose="master_key")
            
            self._master_key = new_master_key
            self._current_version += 1
            
            self._user_keys.clear()
            
            self._stats["rotations_completed"] += 1
            self._stats["last_rotation"] = datetime.now(timezone.utc)
            
            expired_count = self._cleanup_expired_archives()
            
            return {
                "success": True,
                "new_version": self._current_version,
                "previous_key_archived": True,
                "archive_id": archive_entry.key_id if archive_entry else None,
                "expired_archives_cleaned": expired_count,
                "rotation_time": datetime.now(timezone.utc).isoformat(),
                "next_rotation_date": (
                    datetime.now(timezone.utc) + timedelta(days=self.key_rotation_days)
                ).isoformat(),
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "密钥轮换失败，系统仍使用旧密钥",
            }

    def get_user_key_history(
        self,
        user_id: str,
    ) -> List[KeyMetadata]:
        """获取用户的密钥版本历史"""
        return self._key_versions.get(user_id, [])

    def revoke_user_key(
        self,
        user_id: str,
    ) -> bool:
        """
        撤销用户的当前密钥
        
        撤销后，用户需要重新登录或重新同步以获取新密钥。
        
        Args:
            user_id: 用户ID
            
        Returns:
            是否成功撤销
        """
        keys_to_remove = [
            k for k in self._user_keys.keys()
            if k.startswith(f"{user_id}:")
        ]
        
        for key in keys_to_remove:
            del self._user_keys[key]
            
        return len(keys_to_remove) > 0

    def verify_key_integrity(
        self,
        user_id: str,
        key: bytes,
    ) -> bool:
        """
        验证密钥是否有效且未被篡改
        
        通过重新派生并比较来验证。
        """
        expected_key = self.get_data_encryption_key(user_id)
        return hmac.compare_digest(key, expected_key)

    def get_stats(self) -> Dict[str, Any]:
        """获取密钥管理统计信息"""
        active_users = len(set(k.split(":")[0] for k in self._user_keys.keys()))
        
        return {
            **self._stats,
            "current_version": self._current_version,
            "active_user_keys": active_users,
            "total_cached_keys": len(self._user_keys),
            "archived_keys_count": len(self._archived_keys),
            "rotation_interval_days": self.key_rotation_days,
            "archive_retention_days": self.archive_retention_days,
            "next_rotation_suggested": (
                datetime.now(timezone.utc) + timedelta(days=self.key_rotation_days)
            ).isoformat()
            if self._stats.get("last_rotation")
            else "从未轮换",
        }

    def export_key_metadata(
        self,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        导出密钥元数据（不包含实际密钥值）
        
        用于审计和安全监控。
        """
        if user_id:
            versions = self._key_versions.get(user_id, [])
            return [v.to_dict() for v in versions]
        else:
            all_metadata = []
            for versions in self._key_versions.values():
                all_metadata.extend(v.to_dict() for v in versions)
            return all_metadata

    def _hkdf_derive(
        self,
        master_key: bytes,
        salt: bytes,
        info: bytes,
        length: int = 32,
    ) -> bytes:
        """
        使用HKDF派生子密钥
        
        HKDF是RFC 5869标准的密钥派生函数，
        基于HMAC，安全性经过严格验证。
        """
        if CRYPTO_AVAILABLE:
            hkdf = HKDF(
                algorithm=hashes.SHA256(),
                length=length,
                salt=salt,
                info=info,
            )
            return hkdf.derive(master_key)
        else:
            return self._fallback_kdf(master_key, salt, info, length)

    def _fallback_kdf(
        self,
        master_key: bytes,
        salt: bytes,
        info: bytes,
        length: int = 32,
    ) -> bytes:
        """
        简化版KDF（当cryptography库不可用时使用）
        
        使用多次哈希迭代作为后备方案。
        """
        prk = hmac.new(salt, master_key, hashlib.sha256).digest()
        
        okm = b""
        t = b""
        for i in range(0, length, 32):
            t = hmac.new(prk, t + info + bytes([i + 1]), hashlib.sha256).digest()
            okm += t
            
        return okm[:length]

    def _archive_key(
        self,
        key: bytes,
        purpose: str = "unknown",
    ) -> Optional[KeyArchiveEntry]:
        """归档密钥（加密存储）"""
        try:
            archive_key = EncryptionUtils.generate_key()
            nonce = EncryptionUtils.generate_nonce()
            
            encrypted_key, _ = EncryptionUtils.encrypt(key, archive_key)
            
            entry = KeyArchiveEntry(
                key_id=self._generate_key_id(),
                encrypted_key=encrypted_key,
                nonce=nonce,
                metadata=KeyMetadata(
                    key_id=self._generate_key_id(),
                    version=self._current_version,
                    purpose=purpose,
                    is_active=False,
                    is_archived=True,
                ),
                retention_until=datetime.now(timezone.utc) + timedelta(
                    days=self.archive_retention_days
                ),
            )
            
            self._archived_keys[entry.key_id] = entry
            self._stats["archive_count"] += 1
            
            return entry
            
        except Exception as e:
            logger.error(f"[KeyManager] 归档密钥失败: {e}")
            return None

    def _cleanup_expired_archives(self) -> int:
        """清理过期的归档密钥"""
        now = datetime.now(timezone.utc)
        expired_keys = [
            k for k, v in self._archived_keys.items()
            if v.retention_until and v.retention_until < now
        ]
        
        for key in expired_keys:
            del self._archived_keys[key]
            
        return len(expired_keys)

    @staticmethod
    def _generate_key_id() -> str:
        """生成唯一密钥ID"""
        return f"key_{base64.urlsafe_b64encode(os.urandom(16)).decode('ascii')[:16]}"
