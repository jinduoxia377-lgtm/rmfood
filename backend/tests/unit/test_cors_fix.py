"""
测试 CORS 安全修复

验证:
1. 开发环境允许 localhost 白名单
2. 生产环境配置不会使用通配符
"""
import pytest


def test_cors_allows_localhost_in_dev():
    """开发环境 CORS 应包含 localhost"""
    from app.core.config import settings

    origins = settings.get_cors_origins()
    # 开发环境应包含 localhost
    assert any('localhost' in o for o in origins), \
        f"开发环境 CORS 应包含 localhost, 实际: {origins}"


def test_cors_does_not_include_wildcard_by_default():
    """默认 CORS 配置不应包含通配符"""
    from app.core.config import settings

    origins = settings.get_cors_origins()
    assert '*' not in origins, \
        f"CORS 不应包含通配符 '*', 实际: {origins}"
