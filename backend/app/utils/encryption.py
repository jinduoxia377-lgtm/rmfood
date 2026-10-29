"""RMFOOD 数据加密工具

提供AES-256-GCM加密/解密功能，用于保护敏感同步数据。
支持字典递归加密、密钥派生和安全的密钥管理。
"""
import base64
import hashlib
import hmac
import json
import os
from typing import Any, Dict, Optional, Tuple

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    import warnings
    warnings.warn(
        "cryptography库未安装，将使用简化版加密实现。建议运行: pip install cryptography",
        UserWarning,
    )


class EncryptionUtils:
    """
    AES-256-GCM 加密工具

    功能：
    - 生成随机加密密钥（256位）
    - AES-256-GCM 加密/解密
    - 字典敏感字段递归加密
    - 完整性验证（GCM认证标签）

    安全特性：
    - 每次加密使用随机nonce（96位）
    - GCM模式提供认证加密（加密+完整性验证）
    - 密钥长度固定为32字节（256位）

    使用示例：
        >>> utils = EncryptionUtils()
        >>> key = utils.generate_key()
        >>> ciphertext, nonce = utils.encrypt(b"sensitive data", key)
        >>> plaintext = utils.decrypt(ciphertext, nonce, key)
    """

    ALGORITHM = "AES-256-GCM"
    KEY_LENGTH = 32  # 256 bits
    NONCE_LENGTH = 12  # 96 bits (recommended for GCM)
    TAG_LENGTH = 16  # 128 bits authentication tag

    SENSITIVE_FIELDS = {
        "password", "secret", "token", "api_key", "private_key",
        "access_token", "refresh_token", "auth_code", "credential",
        "ssn", "credit_card", "bank_account",
    }

    SENSITIVE_PATTERNS = [
        "email", "phone", "address", "id_card", "passport",
    ]

    def __init__(self):
        if not CRYPTO_AVAILABLE:
            raise RuntimeError(
                "需要cryptography库。请运行: pip install cryptography"
            )

    @staticmethod
    def generate_key() -> bytes:
        """
        生成随机加密密钥

        Returns:
            32字节的随机密钥（AES-256）

        Example:
            >>> key = EncryptionUtils.generate_key()
            >>> len(key)
            32
        """
        return os.urandom(EncryptionUtils.KEY_LENGTH)

    @staticmethod
    def generate_nonce() -> bytes:
        """
        生成随机nonce（一次性数字）

        在GCM模式下，同一个密钥+nonce组合绝不能重复使用，
        否则会严重损害安全性。

        Returns:
            12字节随机nonce
        """
        return os.urandom(EncryptionUtils.NONCE_LENGTH)

    @staticmethod
    def encrypt(
        plaintext: bytes,
        key: bytes,
        associated_data: Optional[bytes] = None,
    ) -> Tuple[bytes, bytes]:
        """
        AES-256-GCM 加密

        Args:
            plaintext: 明文字节数据
            key: 32字节加密密钥
            associated_data: 关联数据（AAD，不加密但参与认证）

        Returns:
            (ciphertext_with_tag, nonce) 元组
            - ciphertext_with_tag 包含密文 + 16字节认证标签

        Raises:
            ValueError: 如果密钥长度不正确
            EncryptionError: 如果加密失败

        Security:
        - 每次调用生成新的随机nonce
        - GCM模式同时提供机密性和完整性
        - 认证标签防止密文被篡改
        """
        if len(key) != EncryptionUtils.KEY_LENGTH:
            raise ValueError(
                f"密钥长度必须为 {EncryptionUtils.KEY_LENGTH} 字节，"
                f"实际为 {len(key)} 字节"
            )

        nonce = EncryptionUtils.generate_nonce()

        try:
            aesgcm = AESGCM(key)

            ciphertext_with_tag = aesgcm.encrypt(
                nonce=nonce,
                data=plaintext,
                associated_data=associated_data,
            )

            return ciphertext_with_tag, nonce

        except Exception as e:
            raise EncryptionError(f"加密失败: {str(e)}") from e

    @staticmethod
    def decrypt(
        ciphertext: bytes,
        nonce: bytes,
        key: bytes,
        associated_data: Optional[bytes] = None,
    ) -> bytes:
        """
        AES-256-GCM 解密

        Args:
            ciphertext: 密文（包含认证标签）
            nonce: 加密时使用的nonce（必须相同）
            key: 32字节解密密钥
            associated_data: 加密时使用的关联数据（必须相同）

        Returns:
            明文字节数据

        Raises:
            ValueError: 如果参数无效
            DecryptionError: 如果解密失败或数据被篡改

        Security:
        - 自动验证认证标签
        - 如果数据被篡改或密钥/nonce错误，会抛出异常
        """
        if len(key) != EncryptionUtils.KEY_LENGTH:
            raise ValueError(f"密钥长度必须为 {EncryptionUtils.KEY_LENGTH} 字节")

        if len(nonce) != EncryptionUtils.NONCE_LENGTH:
            raise ValueError(f"Nonce长度必须为 {EncryptionUtils.NONCE_LENGTH} 字节")

        try:
            aesgcm = AESGCM(key)

            plaintext = aesgcm.decrypt(
                nonce=nonce,
                data=ciphertext,
                associated_data=associated_data,
            )

            return plaintext

        except Exception as e:
            raise DecryptionError(f"解密失败（可能数据被篡改或密钥错误）: {str(e)}") from e

    @staticmethod
    def encrypt_dict(
        data: Dict[str, Any],
        key: bytes,
        encrypt_all: bool = False,
    ) -> Dict[str, Any]:
        """
        加密字典中的敏感字段（递归处理JSON结构）

        自动识别敏感字段并加密其值，非敏感字段保持原样。

        Args:
            data: 要加密的字典
            key: 加密密钥
            encrypt_all: 是否加密所有字段（不仅限敏感字段）

        Returns:
            新字典，敏感字段值替换为加密后的base64字符串
            格式：{"encrypted": true, "value": base64_encrypted, "nonce": base64_nonce}

        Example:
            >>> data = {"name": "test", "password": "secret123"}
            >>> encrypted = EncryptionUtils.encrypt_dict(data, key)
            >>> # encrypted["password"] = {"encrypted": True, "value": "...", "nonce": "..."}
        """
        result = {}

        for field_name, value in data.items():
            should_encrypt = (
                encrypt_all or
                field_name.lower() in EncryptionUtils.SENSITIVE_FIELDS or
                any(pattern in field_name.lower() for pattern in EncryptionUtils.SENSITIVE_PATTERNS)
            )

            if should_encrypt and value is not None:
                try:
                    value_bytes = (
                        json.dumps(value).encode("utf-8")
                        if not isinstance(value, bytes)
                        else value
                    )

                    ciphertext, nonce = EncryptionUtils.encrypt(value_bytes, key)

                    result[field_name] = {
                        "__encrypted__": True,
                        "v": base64.b64encode(ciphertext).decode("ascii"),
                        "n": base64.b64encode(nonce).decode("ascii"),
                    }
                except Exception:
                    result[field_name] = value
                    result[f"{field_name}_encrypt_error"] = "加密失败"
            elif isinstance(value, dict):
                result[field_name] = EncryptionUtils.encrypt_dict(value, key, encrypt_all)
            elif isinstance(value, list):
                result[field_name] = [
                    (
                        EncryptionUtils.encrypt_dict(item, key, encrypt_all)
                        if isinstance(item, dict)
                        else item
                    )
                    for item in value
                ]
            else:
                result[field_name] = value

        return result

    @staticmethod
    def decrypt_dict(
        encrypted_data: Dict[str, Any],
        key: bytes,
    ) -> Dict[str, Any]:
        """
        解密由 encrypt_dict 加密的字典

        Args:
            encrypted_data: 加密后的字典
            key: 解密密钥（必须与加密时相同）

        Returns:
            解密后的原始字典

        Raises:
            DecryptionError: 如果任何字段解密失败
        """
        result = {}

        for field_name, value in encrypted_data.items():
            if isinstance(value, dict) and value.get("__encrypted__"):
                try:
                    ciphertext = base64.b64decode(value["v"])
                    nonce = base64.b64decode(value["n"])

                    decrypted_bytes = EncryptionUtils.decrypt(ciphertext, nonce, key)

                    try:
                        result[field_name] = json.loads(decrypted_bytes.decode("utf-8"))
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        result[field_name] = decrypted_bytes

                except Exception:
                    result[field_name] = value
                    result[f"{field_name}_decrypt_error"] = "解密失败"
            elif isinstance(value, dict):
                result[field_name] = EncryptionUtils.decrypt_dict(value, key)
            elif isinstance(value, list):
                result[field_name] = [
                    (
                        EncryptionUtils.decrypt_dict(item, key)
                        if isinstance(item, dict)
                        else item
                    )
                    for item in value
                ]
            else:
                result[field_name] = value

        return result

    @staticmethod
    def compute_hmac(
        data: bytes,
        key: bytes,
    ) -> str:
        """
        计算HMAC-SHA256消息认证码

        用于验证数据完整性和真实性。

        Args:
            data: 要计算的数据
            key: HMAC密钥

        Returns:
            十六进制HMAC字符串
        """
        return hmac.new(key, data, hashlib.sha256).hexdigest()

    @staticmethod
    def verify_hmac(
        data: bytes,
        key: bytes,
        expected_hmac: str,
    ) -> bool:
        """
        验证HMAC签名

        使用恒定时间比较防止时序攻击。

        Args:
            data: 原始数据
            key: HMAC密钥
            expected_hmac: 预期的HMAC值

        Returns:
            签名是否有效
        """
        computed = EncryptionUtils.compute_hmac(data, key)
        return hmac.compare_digest(computed, expected_hmac)

    @staticmethod
    def hash_password(
        password: str,
        salt: Optional[bytes] = None,
    ) -> Tuple[str, str]:
        """
        安全的密码哈希（PBKDF2-HMAC-SHA256）

        Args:
            password: 明文密码
            salt: 盐值（如果为None则自动生成）

        Returns:
            (hashed_password_hex, salt_base64) 元组
        """
        if salt is None:
            salt = os.urandom(16)

        hashed = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            iterations=260000,  # OWASP推荐值
            dklen=32,
        )

        return hashed.hex(), base64.b64encode(salt).decode("ascii")


class EncryptionError(Exception):
    """加密异常"""
    pass


class DecryptionError(Exception):
    """解密异常"""
    pass
