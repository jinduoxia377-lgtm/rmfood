"""设备指纹工具

将请求的 User-Agent + 客户端 IP 归一为稳定的 16 字节 SHA-256 短指纹，
写入 user_devices.device_fingerprint，供设置页"设备管理"标记当前会话。

设计说明:
- 只用 UA + IP，不依赖客户端主动上报指纹（旧实现靠前端硬编码假数据兜底）
- 同一浏览器同网络环境下指纹稳定，换设备/清缓存/换网络后指纹变化
- 输出 32 位十六进制（128 bit 熵），碰撞概率可忽略
"""
import hashlib
from fastapi import Request


def fingerprint_of(request: Request) -> str:
    """从请求中提取设备指纹（User-Agent + 客户端 IP 的 SHA-256 短哈希）"""
    ua = (request.headers.get("User-Agent") or "").strip()[:512]
    ip = request.client.host if request.client else "unknown"
    raw = f"{ua}|{ip}"
    return hashlib.sha256(raw.encode("utf-8", errors="replace")).hexdigest()[:32]
