"""
测试安全中间件启用

验证 SecurityHeadersMiddleware 和 RateLimitMiddleware 已注册
"""
import pytest


def test_security_headers_middleware_registered():
    """SecurityHeadersMiddleware 应在中间件链中"""
    from app.main import create_app
    app = create_app()

    middleware_names = [m.cls.__name__ for m in app.user_middleware]
    assert 'SecurityHeadersMiddleware' in middleware_names, \
        f"SecurityHeadersMiddleware 未注册, 当前中间件: {middleware_names}"


def test_rate_limit_middleware_registered():
    """RateLimitMiddleware 应在中间件链中"""
    from app.main import create_app
    app = create_app()

    middleware_names = [m.cls.__name__ for m in app.user_middleware]
    assert 'RateLimitMiddleware' in middleware_names, \
        f"RateLimitMiddleware 未注册, 当前中间件: {middleware_names}"


def test_request_logging_middleware_registered():
    """RequestLoggingMiddleware 应在中间件链中"""
    from app.main import create_app
    app = create_app()

    middleware_names = [m.cls.__name__ for m in app.user_middleware]
    assert 'RequestLoggingMiddleware' in middleware_names, \
        f"RequestLoggingMiddleware 未注册, 当前中间件: {middleware_names}"


def test_utf8_encoding_middleware_registered():
    """UTF8EncodingMiddleware 应在中间件链中"""
    from app.main import create_app
    app = create_app()

    middleware_names = [m.cls.__name__ for m in app.user_middleware]
    assert 'UTF8EncodingMiddleware' in middleware_names, \
        f"UTF8EncodingMiddleware 未注册, 当前中间件: {middleware_names}"
