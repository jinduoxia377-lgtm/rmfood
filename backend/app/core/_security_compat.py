"""
安全工具 — 向后兼容入口

注意：此文件不能命名为 security 同时存在 security/ 目录。
已重命名为 auth_security.py（保留原名位置做兼容性导出）。
新代码应直接 import 自 core/security/* 子模块。
"""
# Backward compat: re-export key functions
from app.core.security.account_lockout import AccountLockout  # noqa: F401
from app.utils.auth import decode_token as decode_access_token  # noqa: F401

__all__ = ["AccountLockout", "decode_access_token"]
