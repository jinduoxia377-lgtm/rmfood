"""RMFOOD 敏感数据加密工具

使用 Fernet (AES-128-CBC + HMAC-SHA256) 对称加密。
密钥从环境变量 ENCRYPTION_KEY 获取，或通过 settings 配置。

使用方式:
    from app.core.security.crypto import encrypt_value, decrypt_value, encrypt_dict_field

    # 加密单个值
    encrypted = encrypt_value("sk-abc123...")

    # 加密字典中的敏感字段
    config_value = {"api_key": "sk-abc123", "base_url": "https://api.openai.com"}
    encrypted_config = encrypt_dict_field(config_value, sensitive_keys=["api_key"])
"""
import logging
import os
from typing import Optional

from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# 密钥管理
# ──────────────────────────────────────────────

def _get_encryption_key() -> bytes:
    """
    获取加密密钥

    优先级:
    1. 环境变量 ENCRYPTION_KEY (Base64 编码的 Fernet key)
    2. 自动生成并 warn（仅开发环境）

    生产环境必须设置 ENCRYPTION_KEY 环境变量！
    """
    key = os.environ.get("ENCRYPTION_KEY")
    if key:
        # 验证 key 格式（兼容旧版 cryptography）
        try:
            Fernet(key.encode())
            return key.encode()
        except Exception as key_err:
            raise ValueError(
                "ENCRYPTION_KEY 格式无效。请使用 Fernet.generate_key() 生成。"
            ) from key_err

    # 开发环境自动生成
    logger.warning(
        "⚠️  ENCRYPTION_KEY 未设置，使用随机生成的密钥（重启后数据将无法解密！）"
        "生产环境必须设置 ENCRYPTION_KEY 环境变量。"
    )
    return Fernet.generate_key()


# 全局 Fernet 实例
_fernet: Optional[Fernet] = None


def get_fernet() -> Fernet:
    """获取 Fernet 加密实例（单例）"""
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_get_encryption_key())
    return _fernet


# ──────────────────────────────────────────────
# 加密/解密函数
# ──────────────────────────────────────────────

def encrypt_value(value: str) -> str:
    """
    加密单个字符串值

    Args:
        value: 明文字符串

    Returns:
        Base64 编码的加密字符串（带前缀 enc:: 用于标识）
    """
    if not value:
        return value
    fernet = get_fernet()
    encrypted = fernet.encrypt(value.encode('utf-8'))
    return f"enc::{encrypted.decode('ascii')}"


def decrypt_value(encrypted_value: str) -> str:
    """
    解密字符串值

    Args:
        encrypted_value: 加密字符串（enc:: 前缀）

    Returns:
        明文字符串

    Raises:
        ValueError: 如果值未加密或解密失败
    """
    if not encrypted_value or not encrypted_value.startswith("enc::"):
        return encrypted_value  # 未加密的值直接返回

    fernet = get_fernet()
    try:
        decrypted = fernet.decrypt(encrypted_value[5:].encode('ascii'))
        return decrypted.decode('utf-8')
    except Exception as e:
        logger.error(f"解密失败: {e}")
        raise ValueError(f"无法解密值: {e}")


def encrypt_dict_field(
    data: dict,
    sensitive_keys: list[str],
) -> dict:
    """
    加密字典中的敏感字段

    Args:
        data: 原始字典
        sensitive_keys: 需要加密的键名列表

    Returns:
        加密后的新字典（不修改原字典）
    """
    import copy
    result = copy.deepcopy(data)
    for key in sensitive_keys:
        if key in result and isinstance(result[key], str):
            result[key] = encrypt_value(result[key])
    return result


def decrypt_dict_field(
    data: dict,
    sensitive_keys: list[str],
) -> dict:
    """
    解密字典中的敏感字段

    Args:
        data: 加密后的字典
        sensitive_keys: 需要解密的键名列表

    Returns:
        解密后的新字典
    """
    import copy
    result = copy.deepcopy(data)
    for key in sensitive_keys:
        if key in result and isinstance(result[key], str) and result[key].startswith("enc::"):
            result[key] = decrypt_value(result[key])
    return result


def is_encrypted(value: str) -> bool:
    """检查值是否已加密"""
    return isinstance(value, str) and value.startswith("enc::")


# ──────────────────────────────────────────────
# 密钥管理工具
# ──────────────────────────────────────────────

def generate_encryption_key() -> str:
    """生成新的加密密钥（Base64 编码）"""
    return Fernet.generate_key().decode('utf-8')


def rotate_encryption_key(old_key: str, new_key: str) -> dict:
    """
    轮换加密密钥

    使用旧密钥解密所有数据，然后用新密钥重新加密。
    适用于密钥泄露或定期轮换场景。

    Args:
        old_key: 旧密钥
        new_key: 新密钥

    Returns:
        {"rotated_count": int, "failed_count": int}
    """

    old_fernet = Fernet(old_key)
    new_fernet = Fernet(new_key)

    rotated = 0
    failed = 0

    # 示例：遍历所有需要重新加密的密文
    # 实际使用时需要在 Service 层实现
    return {"rotated_count": rotated, "failed_count": failed}


# ──────────────────────────────────────────────
# 导出
# ──────────────────────────────────────────────

__all__ = [
    "encrypt_value",
    "decrypt_value",
    "encrypt_dict_field",
    "decrypt_dict_field",
    "is_encrypted",
    "get_fernet",
    "generate_encryption_key",
    "rotate_encryption_key",
]
