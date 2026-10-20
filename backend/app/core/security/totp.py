"""
TOTP（RFC 6238）工具 — 纯标准库实现，避免额外依赖。

- generate_secret: 生成 Base32 随机密钥（20 字节 → 32 字符）
- totp_uri: 生成 otpauth:// 链接（供二维码/手动添加）
- verify_totp: 校验 6 位验证码（允许前后各 1 个时间窗口漂移）
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote


def generate_secret(length: int = 20) -> str:
    """生成 Base32 编码的随机密钥（默认 160 bit，与 Google Authenticator 兼容）"""
    raw = secrets.token_bytes(length)
    return base64.b32encode(raw).decode("ascii").rstrip("=")


def _base32_decode(secret: str) -> bytes:
    """补全 padding 后解码 Base32"""
    padded = secret.upper().replace(" ", "")
    padded += "=" * ((8 - len(padded) % 8) % 8)
    return base64.b32decode(padded)


def _hotp(secret: bytes, counter: int, digits: int = 6) -> str:
    msg = struct.pack(">Q", counter)
    digest = hmac.new(secret, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    binary = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(binary % (10**digits)).zfill(digits)


def totp_at(secret: str, timestamp: float | None = None, digits: int = 6, period: int = 30) -> str:
    """计算指定时间点的 TOTP 验证码"""
    ts = int(timestamp if timestamp is not None else time.time())
    counter = ts // period
    return _hotp(_base32_decode(secret), counter, digits)


def verify_totp(secret: str, code: str, window: int = 1, digits: int = 6, period: int = 30) -> bool:
    """校验验证码。window 表示允许的时间窗口偏移（默认前后各 1 个）。"""
    if not code or len(code) != digits or not code.isdigit():
        return False
    current = int(time.time()) // period
    for i in range(-window, window + 1):
        if _hotp(_base32_decode(secret), current + i, digits) == code:
            return True
    return False


def totp_uri(secret: str, issuer: str, account: str) -> str:
    """生成 otpauth:// URI，供身份验证器扫码或手动添加"""
    issuer_q = quote(issuer)
    return (
        f"otpauth://totp/{issuer_q}:{quote(account)}"
        f"?secret={secret}&issuer={issuer_q}&algorithm=SHA1&digits=6&period=30"
    )