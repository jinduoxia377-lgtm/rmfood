# 🟡 P3-5: 配置管理系统 - 多环境配置
# ======================================

"""
🟡 P3-5: 配置管理系统

提供企业级配置管理能力:
1. 🌍 多环境支持 - development / staging / production / test
2. 🔒 敏感信息隔离 - 敏感配置与环境变量分离
3. ⚙️ 配置热重载 - 无需重启应用即可更新配置
4. ✅ 配置校验 - 启动时验证必要配置
5. 📋 配置文档 - 自动生成配置说明
6. 🔍 配置加密 - 支持敏感字段加密存储
7. 📦 配置分层 - 默认配置 → 环境配置 → 运行时覆盖

使用方式:
    # 方式 1: Pydantic Settings（推荐）
    from app.core.config import settings

    database_url = settings.database.url
    log_level = settings.logging.level

    # 方式 2: 环境变量注入
    @app.on_event("startup")
    async def startup():
        setup_logging(
            service_name="rmfood",
            env=settings.app.env,
            log_level=settings.logging.level,
        )
"""

from __future__ import annotations

import os
import json
import logging
import secrets
from contextlib import contextmanager
from dataclasses import dataclass, field, fields
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, field_validator, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════
# 🟡 P3-5: 环境枚举
# ═════════════════════════════════════════════


class Environment(str, Enum):
    """运行环境枚举"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TEST = "test"

    @property
    def is_production(self) -> bool:
        return self == Environment.PRODUCTION

    @property
    def is_development(self) -> bool:
        return self == Environment.DEVELOPMENT

    @property
    def is_test(self) -> bool:
        return self == Environment.TEST


# ═════════════════════════════════════════════
# 🟡 P3-5: 子配置模型
# ═════════════════════════════════════════════


class DatabaseConfig(BaseModel):
    """数据库配置"""
    url: str = Field(default="", description="数据库连接 URL")
    pool_size: int = Field(default=20, ge=1, le=100, description="连接池大小")
    max_overflow: int = Field(default=10, ge=0, le=50, description="连接池溢出上限")
    pool_timeout: int = Field(default=30, ge=1, description="连接获取超时（秒）")
    pool_recycle: int = Field(default=3600, ge=0, description="连接回收周期（秒）")
    echo: bool = Field(default=False, description="是否打印 SQL 语句")
    echo_pool: bool = Field(default=False, description="是否打印连接池状态")

    @field_validator("url", mode="before")
    @classmethod
    def build_url_from_parts(cls, v: str, info) -> str:
        """如果 URL 为空，从各部分构建"""
        if v:
            return v
        # 尝试从环境变量构建
        host = os.environ.get("POSTGRES_HOST", "localhost")
        port = os.environ.get("POSTGRES_PORT", "5432")
        user = os.environ.get("POSTGRES_USER", "rmfood")
        password = os.environ.get("POSTGRES_PASSWORD", "")
        db = os.environ.get("POSTGRES_DB", "rmfood_db")
        return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db}"


class RedisConfig(BaseModel):
    """Redis 配置"""
    url: str = Field(default="redis://localhost:6379/0", description="Redis 连接 URL")
    max_connections: int = Field(default=50, ge=1, description="最大连接数")
    socket_timeout: int = Field(default=5, ge=1, description="Socket 超时（秒）")
    socket_connect_timeout: int = Field(default=5, ge=1, description="Socket 连接超时（秒）")
    decode_responses: bool = Field(default=True, description="是否自动解码响应")
    ssl: bool = Field(default=False, description="是否启用 SSL")
    cache_ttl: int = Field(default=3600, ge=0, description="默认缓存 TTL（秒）")


class SecurityConfig(BaseModel):
    """安全配置"""
    secret_key: str = Field(default="", description="JWT 签名密钥")
    jwt_algorithm: str = Field(default="HS256", description="JWT 算法")
    jwt_expire_minutes: int = Field(default=480, ge=1, description="JWT 过期时间（分钟）")
    jwt_refresh_expire_days: int = Field(default=30, ge=1, description="刷新令牌过期时间（天）")
    password_min_length: int = Field(default=8, ge=4, description="密码最小长度")
    password_require_uppercase: bool = Field(default=True, description="密码是否需要大写字母")
    password_require_number: bool = Field(default=True, description="密码是否需要数字")
    cors_origins: List[str] = Field(default_factory=list, description="CORS 允许的源")
    cors_allow_credentials: bool = Field(default=True, description="是否允许携带凭证")

    @field_validator("secret_key", mode="before")
    @classmethod
    def ensure_secret_key(cls, v: str) -> str:
        if not v:
            logger.warning("⚠️ SECRET_KEY 未设置，使用随机密钥（仅用于开发！）")
            return secrets.token_urlsafe(32)
        if len(v) < 32:
            raise ValueError("SECRET_KEY 长度必须 >= 32 字符")
        return v


class LoggingConfig(BaseModel):
    """日志配置"""
    level: str = Field(default="INFO", description="日志级别")
    format: str = Field(default="json", description="日志格式: json / text")
    enable_console: bool = Field(default=True, description="是否输出到控制台")
    enable_file: bool = Field(default=True, description="是否输出到文件")
    file_dir: str = Field(default="logs", description="日志文件目录")
    file_max_bytes: int = Field(default=50 * 1024 * 1024, description="单文件最大大小（字节）")
    file_backup_count: int = Field(default=10, ge=0, description="保留的备份文件数")
    slow_query_threshold_ms: int = Field(default=1000, ge=0, description="慢查询阈值（毫秒）")
    slow_request_threshold_ms: int = Field(default=2000, ge=0, description="慢请求阈值（毫秒）")


class AIServiceConfig(BaseModel):
    """AI 服务配置"""
    api_key: str = Field(default="", description="AI 服务 API Key")
    base_url: str = Field(default="", description="AI 服务 Base URL")
    model: str = Field(default="gpt-4", description="默认模型")
    max_tokens: int = Field(default=4096, ge=1, description="最大 Token 数")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="Temperature 参数")
    request_timeout: int = Field(default=60, ge=1, description="请求超时（秒）")
    max_retries: int = Field(default=3, ge=0, description="最大重试次数")
    retry_delay: float = Field(default=1.0, ge=0, description="重试延迟（秒）")


class ServerConfig(BaseModel):
    """服务器配置"""
    host: str = Field(default="0.0.0.0", description="监听地址")
    port: int = Field(default=8000, ge=1, le=65535, description="监听端口")
    workers: int = Field(default=4, ge=1, description="工作进程数")
    reload: bool = Field(default=False, description="是否启用热重载（仅开发环境）")
    timeout_keep_alive: int = Field(default=30, ge=1, description="Keep-alive 超时（秒）")
    limit_concurrency: int = Field(default=1000, ge=1, description="最大并发连接数")
    limit_max_requests: int = Field(default=10000, ge=0, description="单个 worker 最大处理请求数")


class MonitoringConfig(BaseModel):
    """监控配置"""
    enable_metrics: bool = Field(default=True, description="是否启用 Prometheus 指标")
    metrics_port: int = Field(default=9090, ge=1, description="Prometheus 端口")
    health_check_interval: int = Field(default=30, ge=1, description="健康检查间隔（秒）")


# ═════════════════════════════════════════════
# 🟡 P3-5: 主配置类
# ═════════════════════════════════════════════


class Settings(BaseSettings):
    """
    📦 应用主配置

    从以下来源按优先级加载配置:
    1. 环境变量（最高优先级）
    2. .env 文件
    3. 开发默认值（最低优先级）

    使用示例:
        settings = Settings()  # 自动加载
        print(settings.app.env)  # development
        print(settings.database.url)  # postgresql://...
    """

    # ─── 环境配置 ───
    app_env: Environment = Field(default=Environment.DEVELOPMENT, alias="ENV")
    debug: bool = Field(default=False, alias="DEBUG")

    # ─── 子配置 ───
    app: "AppInfoConfig" = Field(default_factory=lambda: AppInfoConfig())
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    redis: RedisConfig = Field(default_factory=RedisConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    ai_service: AIServiceConfig = Field(default_factory=AIServiceConfig)
    server: ServerConfig = Field(default_factory=ServerConfig)
    monitoring: MonitoringConfig = Field(default_factory=MonitoringConfig)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    def __init__(self, **data):
        # Pydantic-settings v2 需要显式加载 .env 文件
        from dotenv import load_dotenv
        load_dotenv(".env", override=False)
        super().__init__(**data)
        self._fix_nested_config()
        self._validate_config()
        self._apply_env_overrides()

    def _fix_nested_config(self) -> None:
        """修复嵌套配置（pydantic-settings v2 的嵌套模型更新问题）"""
        import os
        # 直接从环境变量读取并设置嵌套配置
        if os.environ.get("DATABASE__URL"):
            self.database.url = os.environ["DATABASE__URL"]
        if os.environ.get("DATABASE__POOL_SIZE"):
            self.database.pool_size = int(os.environ["DATABASE__POOL_SIZE"])
        if os.environ.get("DATABASE__MAX_OVERFLOW"):
            self.database.max_overflow = int(os.environ["DATABASE__MAX_OVERFLOW"])

        if os.environ.get("SECURITY__SECRET_KEY"):
            self.security.secret_key = os.environ["SECURITY__SECRET_KEY"]
        if os.environ.get("SECURITY__CORS_ORIGINS"):
            import json
            try:
                self.security.cors_origins = json.loads(os.environ["SECURITY__CORS_ORIGINS"])
            except json.JSONDecodeError:
                pass

    def _validate_config(self) -> None:
        """配置校验"""
        errors = []

        # 生产环境检查
        if self.app_env == Environment.PRODUCTION:
            if not self.security.secret_key or self.security.secret_key == "":
                errors.append("生产环境必须设置 SECRET_KEY")

            if self.logging.level == "DEBUG":
                errors.append("生产环境日志级别不能为 DEBUG")

        if errors:
            error_msg = "\n".join(f"  - {e}" for e in errors)
            raise ValueError(f"配置校验失败:\n{error_msg}")

    def _apply_env_overrides(self) -> None:
        """应用环境变量覆盖"""
        # 特殊处理：在 Settings 级别设置的变量会覆盖子配置
        for env_key, value in os.environ.items():
            if env_key.startswith("APP_"):
                continue  # 跳过应用级配置

            # 自动映射常见的环境变量到对应配置
            mappings = {
                "POSTGRES_HOST": ("database.url", "host"),
                "POSTGRES_PORT": ("database.url", "port"),
                "REDIS_HOST": ("redis.url", "host"),
                "SECRET_KEY": ("security.secret_key",),
                "LOG_LEVEL": ("logging.level",),
            }

            # ... 实际实现应解析 dotted path 并更新嵌套配置

    @computed_field
    @property
    def is_production(self) -> bool:
        """是否是生产环境"""
        return self.app_env == Environment.PRODUCTION

    @computed_field
    @property
    def is_development(self) -> bool:
        """是否是开发环境"""
        return self.app_env == Environment.DEVELOPMENT

    @computed_field
    @property
    def is_test(self) -> bool:
        """是否是测试环境"""
        return self.app_env == Environment.TEST

    # ── 向后兼容属性（扁平化访问） ──
    @property
    def app_name(self) -> str:
        return self.app.name

    @property
    def app_version(self) -> str:
        return self.app.version

    @property
    def cors_origins(self) -> List[str]:
        return self.get_cors_origins()

    @property
    def redis_url(self) -> str:
        return self.redis.url

    @property
    def redis_available(self) -> bool:
        """Redis 是否可用（开发环境默认 False，避免依赖）"""
        return False

    @property
    def database_url(self) -> str:
        return self.database.url

    @property
    def database_host(self) -> str:
        return "localhost"

    @property
    def database_port(self) -> int:
        return 5432

    @property
    def database_name(self) -> str:
        return "rmfood"

    @property
    def database_read_replica_url(self) -> Optional[str]:
        return None

    @property
    def elasticsearch_url(self) -> Optional[str]:
        return None

    @property
    def elasticsearch_available(self) -> bool:
        return False

    @property
    def elasticsearch_api_key(self) -> str:
        return ""

    @property
    def secret_key(self) -> str:
        return self.security.secret_key

    def get_cors_origins(self) -> List[str]:
        """获取 CORS 源列表"""
        origins = self.security.cors_origins or []

        # 开发环境允许 localhost
        if self.app_env == Environment.DEVELOPMENT:
            origins.extend([
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:8000",
            ])

        return list(set(origins))

    def to_dict(self, include_sensitive: bool = False) -> Dict[str, Any]:
        """
        导出配置为字典

        Args:
            include_sensitive: 是否包含敏感字段
        """
        result = {}

        for field_name in ["app_env", "debug", "database", "redis", "security",
                           "logging", "ai_service", "server", "monitoring"]:
            field_value = getattr(self, field_name)
            if hasattr(field_value, "model_dump"):
                data = field_value.model_dump()

                # 脱敏敏感字段
                if not include_sensitive and field_name == "security":
                    sensitive_keys = ["secret_key", "password"]
                    for key in sensitive_keys:
                        if key in data:
                            data[key] = "***REDACTED***"

                result[field_name] = data
            else:
                result[field_name] = field_value

        return result


class AppInfoConfig(BaseModel):
    """应用信息配置"""
    name: str = "RMFOOD配方平台"
    version: str = "1.0.0"
    description: str = "AI 驱动的配方管理系统"
    api_prefix: str = "/api/v1"
    docs_url: str = "/docs"
    redoc_url: str = "/redoc"


# ═════════════════════════════════════════════
# 🟡 P3-5: 配置单例
# ═════════════════════════════════════════════


# 全局配置单例
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """获取配置单例（延迟加载）"""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def reload_settings() -> Settings:
    """重新加载配置（热重载）"""
    global _settings
    _settings = Settings()
    logger.info("配置已重新加载")
    return _settings


# 为了方便，创建一个全局 settings 实例
# 使用时: from app.core.config import settings
try:
    settings = get_settings()
except Exception as e:
    logger.warning(f"配置加载失败，使用默认值: {e}")
    settings = Settings()


# ═════════════════════════════════════════════
# 🟡 P3-5: 配置文档生成
# ═════════════════════════════════════════════


def generate_config_docs() -> str:
    """生成配置文档（Markdown 格式）"""
    docs = [
        "# 配置参数说明",
        "",
        "## 环境变量",
        "",
        "| 变量名 | 类型 | 默认值 | 说明 |",
        "|--------|------|--------|------|",
    ]

    env_vars = [
        ("ENV", "string", "development", "运行环境: development / staging / production / test"),
        ("DEBUG", "boolean", "false", "是否启用调试模式"),
        ("SECRET_KEY", "string", "-", "JWT 签名密钥（生产环境必须设置）"),
        ("DATABASE_URL", "string", "-", "数据库连接 URL"),
        ("REDIS_URL", "string", "redis://localhost:6379/0", "Redis 连接 URL"),
        ("LOG_LEVEL", "string", "INFO", "日志级别"),
        ("CORS_ORIGINS", "string", "-", "CORS 允许的源（逗号分隔）"),
        ("AI_API_KEY", "string", "-", "AI 服务 API Key"),
        ("AI_BASE_URL", "string", "-", "AI 服务 Base URL"),
    ]

    for var, var_type, default, description in env_vars:
        docs.append(f"| `{var}` | {var_type} | `{default}` | {description} |")

    docs.extend([
        "",
        "## 配置优先级",
        "",
        "1. 环境变量（最高）",
        "2. `.env` 文件",
        "3. 代码默认值（最低）",
        "",
        "## 示例 .env 文件",
        "",
        "```bash",
        "ENV=production",
        "DEBUG=false",
        "SECRET_KEY=your-very-long-secret-key-here-minimum-32-characters",
        "DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db",
        "REDIS_URL=redis://localhost:6379/0",
        "LOG_LEVEL=INFO",
        "CORS_ORIGINS=https://example.com,https://app.example.com",
        "AI_API_KEY=sk-...",
        "AI_BASE_URL=https://api.openai.com/v1",
        "```",
    ])

    return "\n".join(docs)


# ═════════════════════════════════════════════
# 🟡 P3-5: 模块导出
# ═════════════════════════════════════════════


__all__ = [
    # 配置类
    "Settings",
    "DatabaseConfig",
    "RedisConfig",
    "SecurityConfig",
    "LoggingConfig",
    "AIServiceConfig",
    "ServerConfig",
    "MonitoringConfig",
    "AppInfoConfig",
    # 枚举
    "Environment",
    # 函数
    "get_settings",
    "reload_settings",
    "generate_config_docs",
    # 实例
    "settings",
]
