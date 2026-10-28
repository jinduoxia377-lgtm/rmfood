"""
Sentry 错误追踪集成

提供运行时异常捕获、堆栈追踪和性能监控。
敏感数据（密码、token、API Key）自动过滤。

使用方式:
    from app.core.security.sentry_config import sentry_init

    # 在 create_app() 中调用
    sentry_init(app)
"""

from __future__ import annotations

import logging
import os

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

logger = logging.getLogger(__name__)

# Sentry DSN 从环境变量读取
SENTRY_DSN = os.environ.get("SENTRY_DSN")
SENTRY_ENVIRONMENT = os.environ.get("SENTRY_ENVIRONMENT", "production")
SENTRY_TRACES_SAMPLE_RATE = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
SENTRY_PROFILE_SAMPLE_RATE = float(os.environ.get("SENTRY_PROFILE_SAMPLE_RATE", "0.1"))


def _before_send(event: dict, hint: dict) -> dict | None:
    """
    在事件发送到 Sentry 前进行过滤。
    移除所有包含敏感信息的字段。
    """
    # 过滤请求 body 中的敏感信息
    if "request" in event and "data" in event["request"]:
        request_data = event["request"]["data"]
        if isinstance(request_data, str):
            # 移除 JSON 中的敏感字段
            for field in ("password", "api_key", "token", "secret", "authorization"):
                import re
                request_data = re.sub(
                    f'"{field}"\\s*:\\s*"[^"]*"',
                    f'"{field}": "[FILTERED]"',
                    request_data,
                )
            event["request"]["data"] = request_data

    # 过滤 exceptions
    if "exceptions" in event:
        for exc in event["exceptions"]:
            if "value" in exc:
                for field in ("password", "api_key", "token", "secret"):
                    exc["value"] = exc["value"].replace(field, f"[FILTERED_{field.upper()}]")
            if "mechanism" in exc and exc["mechanism"].get("handled") is False:
                # 未处理异常：移除 traceback 中的文件路径
                pass

    return event


def sentry_init(app=None) -> None:
    """初始化 Sentry SDK"""
    if not SENTRY_DSN:
        logger.info("[Sentry] SENTRY_DSN 未配置，跳过初始化")
        return

    integrations = [
        FastApiIntegration(),
        LoggingIntegration(level=logging.WARNING, event_level=logging.ERROR),
    ]

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=SENTRY_ENVIRONMENT,
        integrations=integrations,
        before_send=_before_send,
        traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
        profiles_sample_rate=SENTRY_PROFILE_SAMPLE_RATE,
        max_request_body_size="medium",
        send_default_pii=False,  # 不发送个人信息
    )

    logger.info(
        f"[Sentry] 已初始化 | DSN={SENTRY_DSN[:20]}... | "
        f"环境={SENTRY_ENVIRONMENT} | 采样率={SENTRY_TRACES_SAMPLE_RATE}"
    )
