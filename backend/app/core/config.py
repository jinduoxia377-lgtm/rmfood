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
# Helper: robust .env file path calculation
# ═════════════════════════════════════════════


def _get_env_file_path() -> str:
    """
    Get absolute path to .env file.

    This function handles the edge case where project paths contain
    non-ASCII characters (Chinese etc.) by using Path.resolve() which
    works reliably on Windows even with Unicode paths.

    Returns:
        Absolute path string to the .env file located in the project root.
    """
    from pathlib import Path

    # __file__ is this config.py's absolute path
    # Go up 2 levels to get to backend/ directory
    base_dir = Path(__file__).parents[2]
    env_path = base_dir / ".env"

    # Verify it exists (Path with Chinese chars should work fine with resolve())
    if env_path.exists():
        return str(env_path.resolve())

    # Fallback: try different locations
    fallbacks = [
        Path.cwd() / ".env",
        Path(os.getcwd()) / ".env",
    ]
    for fp in fallbacks:
        if fp.exists():
            return str(fp.resolve())

    raise RuntimeError(f"Cannot find .env file at expected location: {env_path}")


# Try to get the path, fail early at module import if .env is missing
try:
    _ENV_FILE_PATH = _get_env_file_path()
    print(f"[DEBUG] Using .env file: {_ENV_FILE_PATH}")
except Exception as e:
    print(f"[WARN] Could not determine .env path: {e}")
    _ENV_FILE_PATH = ".env"  # Fallback (may not work if cwd is wrong)


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
    """
    PostgreSQL 数据库配置

    安全注意事项:
    - 密码等敏感凭证必须通过环境变量注入，禁止硬编码
    - 生产环境必须使用 SSL/TLS 加密连接（ssl_mode 参数）
    - 遵循最小权限原则：数据库用户仅授予必要的 DML 权限
    - 支持凭证轮换：修改环境变量后调用 reload_settings() 即可生效

    性能优化建议:
    - pool_size 建议设为 (CPU核心数 * 2) + 有效磁盘数
    - max_overflow 建议设为 pool_size 的 50%
    - pool_recycle 应小于数据库的 wait_timeout（默认 8h）
    - 生产环境建议启用 pool_pre_ping（在 session.py 中已默认开启）

    故障排除:
    - 连接超时: 检查 DATABASE_URL、防火墙、PostgreSQL pg_hba.conf
    - 认证失败: 确认用户名/密码正确，检查 pg_hba.conf 认证方式
    - SSL 错误: 确认 ssl_mode 与服务器证书配置匹配
    - 连接池耗尽: 增大 pool_size / max_overflow，排查长事务或慢查询
    """

    url: str = Field(
        default="",
        description=(
            "PostgreSQL 连接 URL，格式: postgresql+asyncpg://user:password@host:port/dbname "
            "| 必须通过环境变量 DATABASE_URL 或 POSTGRES_* 组合注入"
        ),
    )
    pool_size: int = Field(
        default=20, ge=1, le=100,
        description="连接池常驻连接数（建议: CPU核心数*2）",
    )
    max_overflow: int = Field(
        default=10, ge=0, le=50,
        description="连接池溢出上限（超出 pool_size 的临时连接数）",
    )
    pool_timeout: int = Field(
        default=30, ge=1,
        description="获取连接超时时间（秒），超时抛出 TimeoutError",
    )
    pool_recycle: int = Field(
        default=3600, ge=300,
        description="连接回收周期（秒），防止使用过期连接",
    )
    echo: bool = Field(default=False, description="是否打印 SQL 语句（仅开发调试用）")
    echo_pool: bool = Field(default=False, description="是否打印连接池状态日志")
    ssl_mode: str = Field(
        default="prefer",
        description=(
            "SSL 模式: disable | prefer | require | verify-ca | verify-full "
            "| 生产环境建议 require 或 verify-full"
        ),
    )
    statement_timeout_ms: int = Field(
        default=30000, ge=1000,
        description="单条 SQL 语句超时（毫秒），防止慢查询阻塞连接池",
    )

    @field_validator("url", mode="before")
    @classmethod
    def validate_and_build_url(cls, v: str, info) -> str:
        """
        验证并构建 PostgreSQL 连接 URL

        优先级:
        1. DATABASE_URL 环境变量（最高优先级）
        2. POSTGRES_* 组合环境变量构建
        3. 直接传入的 url 值（仅当环境变量未设置时使用）

        安全: 拒绝任何非 PostgreSQL 的连接 URL（如 sqlite、mysql）
        """
        # 首先检查环境变量（最高优先级）- ALWAYS check env vars first!
        db_url = os.environ.get("DATABASE_URL")
        if db_url:
            if db_url.startswith("sqlite"):
                raise ValueError(
                    "SQLite 连接已被禁用。DATABASE_URL 不能使用 sqlite:// 协议。"
                    "请设置 DATABASE_URL=postgresql+asyncpg://user:password@host:port/dbname"
                )
            if not db_url.startswith(("postgresql", "postgres")):
                raise ValueError(
                    f"不支持的数据库类型: {db_url.split('://')[0] if '://' in db_url else db_url}。"
                    "本项目仅支持 PostgreSQL。"
                )
            return db_url

        # 其次检查 POSTGRES_* 组合环境变量
        host = os.environ.get("POSTGRES_HOST")
        port = os.environ.get("POSTGRES_PORT", "5432")
        user = os.environ.get("POSTGRES_USER")
        password = os.environ.get("POSTGRES_PASSWORD")
        db = os.environ.get("POSTGRES_DB")

        if host and user and password and db:
            return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db}"

        # 最后使用直接传入的值（如果提供了有效的值）
        if v and v != "" and v != "None":
            if v.startswith("sqlite"):
                raise ValueError(
                    "SQLite 连接已被禁用。本项目仅支持 PostgreSQL。"
                    "请设置 DATABASE_URL=postgresql+asyncpg://user:password@host:port/dbname"
                )
            if not v.startswith(("postgresql", "postgres")):
                raise ValueError(
                    f"不支持的数据库类型: {v.split('://')[0] if '://' in v else v}。"
                    "本项目仅支持 PostgreSQL。"
                )
            return v

        raise ValueError(
            "未找到有效的 PostgreSQL 数据库连接配置。\n"
            "请设置以下任一方式:\n"
            "  方式1 (推荐): 设置环境变量 DATABASE_URL=postgresql+asyncpg://user:password@host:port/dbname\n"
            "  方式2: 设置 POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB 环境变量"
        )

    @field_validator("ssl_mode", mode="after")
    @classmethod
    def validate_ssl_mode(cls, v: str) -> str:
        """验证 SSL 模式值"""
        valid_modes = {"disable", "prefer", "require", "verify-ca", "verify-full"}
        if v not in valid_modes:
            raise ValueError(f"无效的 ssl_mode: {v}，可选值: {valid_modes}")
        return v


class RedisConfig(BaseModel):
    """Redis 配置"""
    url: str = Field(default="redis://localhost:6379/0", description="Redis 连接 URL")
    max_connections: int = Field(default=50, ge=1, description="最大连接数")
    socket_timeout: int = Field(default=5, ge=1, description="Socket 超时（秒）")
    socket_connect_timeout: int = Field(default=5, ge=1, description="Socket 连接超时（秒）")
    decode_responses: bool = Field(default=True, description="是否自动解码响应")
    ssl: bool = Field(default=False, description="是否启用 SSL")
    cache_ttl: int = Field(default=3600, ge=0, description="默认缓存 TTL（秒）")


class CeleryConfig(BaseModel):
    """Celery 异步任务配置"""
    broker_url: str = Field(
        default="redis://localhost:6379/1",
        description="Celery Broker URL (Redis)，需以 redis:// 或 rediss:// 开头"
    )
    result_backend: str = Field(
        default="redis://localhost:6379/1",
        description="Celery Result Backend，与 broker 可相同或不同"
    )
    task_default_queue: str = Field(
        default="import_queue",
        description="默认任务队列名"
    )
    task_serializer: str = Field(
        default="json",
        description="任务数据序列化格式（仅支持 json）"
    )
    accept_content: List[str] = Field(
        default_factory=lambda: ["json"],
        description="接受的序列化格式列表"
    )
    task_track_started: bool = Field(
        default=True,
        description="跟踪任务开始状态"
    )
    task_time_limit: int = Field(
        default=3600,
        description="单任务最大运行时间（秒），大文件导入建议调高"
    )
    task_soft_time_limit: int = Field(
        default=3000,
        description="软时间提前警告时间（秒），应小于 task_time_limit"
    )

    @field_validator("broker_url", "result_backend")
    def validate_redis_url(cls, v: str) -> str:
        """验证 Redis URL 必须以 redis:// 或 rediss:// 开头"""
        if not (v.startswith("redis://") or v.startswith("rediss://")):
            raise ValueError("URL 必须以 redis:// 或 rediss:// 开头")
        return v


class SecurityConfig(BaseModel):
    """安全配置"""
    secret_key: str = Field(default="", description="JWT 签名密钥")
    jwt_algorithm: str = Field(default="HS256", description="JWT 算法")
    jwt_expire_minutes: int = Field(default=60, ge=1, description="JWT 过期时间（分钟）")
    jwt_refresh_expire_days: int = Field(default=30, ge=1, description="刷新令牌过期时间（天）")
    jwt_issuer: str = Field(default="rmfood", description="JWT 签发者")
    jwt_audience: str = Field(default="rmfood-api", description="JWT 受众")
    password_min_length: int = Field(default=8, ge=4, description="密码最小长度")
    password_require_uppercase: bool = Field(default=True, description="密码是否需要大写字母")
    password_require_number: bool = Field(default=True, description="密码是否需要数字")
    cors_origins: List[str] = Field(default_factory=list, description="CORS 允许的源")
    cors_allow_credentials: bool = Field(default=True, description="是否允许携带凭证")
    csrf_secret: str = Field(default="", description="CSRF double-submit secret")

    @field_validator("secret_key", mode="before")
    @classmethod
    def ensure_secret_key(cls, v: str) -> str:
        from ..config import settings  # 延迟导入避免循环依赖

        if not v:
            env = getattr(settings, 'app_env', None)
            # 生产环境禁止使用随机 SECRET_KEY
            if not env or env != Environment.DEVELOPMENT:
                raise ValueError(
                    "生产环境中必须设置 SECRET_KEY 环境变量。"
                    "请通过环境变量 SECRET_KEY 设置强密钥（至少 32 字符）"
                )
            logger.warning(
                "⚠️ SECRET_KEY 未设置（开发环境），仅用于调试，"
                "在生产环境中此行为会被阻止"
            )
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
        # print(settings.app.env)  # development
        # print(settings.database.url)  # postgresql://...
    """

    # ─── 环境配置 ───
    app_env: Environment = Field(default=Environment.DEVELOPMENT, alias="ENV")
    debug: bool = Field(default=False, alias="DEBUG")

    # ─── 初始管理员账号 ───
    admin_username: str = Field(default="admin", alias="ADMIN_USERNAME", description="初始管理员用户名")
    admin_password: str = Field(default="", alias="ADMIN_PASSWORD", description="初始管理员密码（生产环境必须通过环境变量设置）")
    admin_email: str = Field(default="admin@rmfood.com", alias="ADMIN_EMAIL", description="初始管理员邮箱")

    # ─── 子配置 ───
    app: "AppInfoConfig" = Field(default_factory=lambda: AppInfoConfig())
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    redis: RedisConfig = Field(default_factory=RedisConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    ai_service: AIServiceConfig = Field(default_factory=AIServiceConfig)
    encryption: "EncryptionConfig" = Field(default_factory=lambda: EncryptionConfig())  # type: ignore[valid-type]
    server: ServerConfig = Field(default_factory=ServerConfig)
    monitoring: MonitoringConfig = Field(default_factory=MonitoringConfig)

    celery: CeleryConfig = Field(default_factory=CeleryConfig)

    model_config = SettingsConfigDict(
        # Use the robustly calculated .env file path
        env_file=_ENV_FILE_PATH,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    def __init__(self, **data):
        # Pydantic-settings v2 已自动处理 .env 文件加载 (通过 model_config env_file 配置)
        # 不再需要手动调用 load_dotenv，避免工作目录相关问题
        super().__init__(**data)
        self._fix_nested_config()
        self._apply_env_overrides()  # Apply env overrides BEFORE validation
        self._validate_config()      # Now validate after all overrides are applied

    def _fix_nested_config(self) -> None:
        """
        修复嵌套配置（pydantic-settings v2 的嵌套模型更新问题）

        支持 DATABASE__URL（pydantic-settings v2 嵌套格式）和 DATABASE_URL（扁平格式）。
        同时拒绝任何 SQLite URL。
        """
        import os
        # 数据库 URL：支持多种环境变量格式
        db_url = os.environ.get("DATABASE__URL") or os.environ.get("DATABASE_URL")
        if db_url:
            if db_url.startswith("sqlite"):
                raise ValueError(
                    "SQLite 连接已被禁用。检测到 DATABASE_URL 使用了 sqlite:// 协议。"
                    "请改为: DATABASE_URL=postgresql+asyncpg://user:password@host:port/dbname"
                )
            self.database.url = db_url
        if os.environ.get("DATABASE__POOL_SIZE"):
            self.database.pool_size = int(os.environ["DATABASE__POOL_SIZE"])
        if os.environ.get("DATABASE__MAX_OVERFLOW"):
            self.database.max_overflow = int(os.environ["DATABASE__MAX_OVERFLOW"])
        if os.environ.get("DATABASE__SSL_MODE"):
            self.database.ssl_mode = os.environ["DATABASE__SSL_MODE"]

        # Celery 相关环境变量覆盖
        if os.environ.get("CELERY__BROKER_URL"):
            self.celery.broker_url = os.environ["CELERY__BROKER_URL"]
        if os.environ.get("CELERY__RESULT_BACKEND"):
            self.celery.result_backend = os.environ["CELERY__RESULT_BACKEND"]

        if os.environ.get("SECURITY__SECRET_KEY"):
            self.security.secret_key = os.environ["SECURITY__SECRET_KEY"]
        if os.environ.get("SECURITY__CORS_ORIGINS"):
            import json
            try:
                self.security.cors_origins = json.loads(os.environ["SECURITY__CORS_ORIGINS"])
            except json.JSONDecodeError:
                pass

    def _validate_config(self) -> None:
        """
        配置校验

        检查项:
        - 生产环境必须设置 SECRET_KEY
        - 生产环境日志级别不能为 DEBUG
        - 数据库 URL 必须是 PostgreSQL 协议
        - 生产环境 SSL 模式不能为 disable
        """
        errors = []

        # ===== 新增：生产环境 SECRET_KEY 强制性检查 =====
        if self.app_env == Environment.PRODUCTION:
            if not self.security.secret_key:
                raise ValueError("生产环境中 SECRET_KEY 是必需的（通过环境变量 SECRET_KEY 设置）")

        # 数据库 URL 协议检查
        if self.database.url:
            if self.database.url.startswith("sqlite"):
                errors.append(
                    "SQLite 连接已被禁用。请设置 DATABASE_URL 为 PostgreSQL 连接串。"
                )
            elif not self.database.url.startswith(("postgresql", "postgres")):
                errors.append(
                    f"数据库 URL 协议不支持: {self.database.url.split('://')[0]}，"
                    "仅支持 postgresql+asyncpg://"
                )

        # 生产环境检查
        if self.app_env == Environment.PRODUCTION:
            if self.logging.level == "DEBUG":
                errors.append("生产环境日志级别不能为 DEBUG")

            if self.database.ssl_mode == "disable":
                errors.append(
                    "生产环境数据库 SSL 模式不能为 disable，"
                    "建议使用 require 或 verify-full"
                )

            if self.admin_password == "admin123":
                errors.append(
                    "生产环境管理员密码不能使用默认值 admin123，"
                    "请设置 ADMIN_PASSWORD 环境变量"
                )

        # 开发/测试环境：如果 admin_password 为空，生成随机密码
        if self.app_env != Environment.PRODUCTION and not self.admin_password:
            logger.warning(
                "Admin password is empty in development/test environment. Using randomly generated password."
            )
            import secrets
            self.admin_password = secrets.token_urlsafe(16)

        if errors:
            error_msg = "\n".join(f"  - {e}" for e in errors)
            raise ValueError(f"配置校验失败:\n{error_msg}")

    def _apply_env_overrides(self) -> None:
        """应用环境变量覆盖，使用安全的 URL 解析方法."""
        from urllib.parse import urlparse, urlunparse, parse_qs

        for env_key, value in os.environ.items():
            if env_key.startswith("APP_"):
                continue

            # POSTGRES_HOST - 安全替换主机名
            if env_key == "POSTGRES_HOST" and self.database.url:
                parsed = urlparse(self.database.url)
                if parsed.hostname:
                    self.database.url = urlunparse(
                        (parsed.scheme, parsed.username, value, parsed.port, parsed.path, parsed.query)
                    )

            # POSTGRES_PORT - 安全替换端口
            elif env_key == "POSTGRES_PORT" and self.database.url:
                parsed = urlparse(self.database.url)
                port_int = int(value) if value.isdigit() else parsed.port or 5432
                self.database.url = urlunparse(
                    (parsed.scheme, parsed.username, parsed.hostname, port_int, parsed.path, parsed.query)
                )

            # REDIS_HOST - 安全替换 Redis 主机名
            elif env_key == "REDIS_HOST" and self.redis.url:
                parsed = urlparse(self.redis.url)
                self.redis.url = urlunparse((parsed.scheme, value, parsed.hostname, parsed.port, parsed.path, parsed.query))

            # SECRET_KEY - 直接赋值
            elif env_key == "SECRET_KEY":
                self.security.secret_key = value

            # LOG_LEVEL - 直接赋值
            elif env_key == "LOG_LEVEL":
                self.logging.level = value.upper()

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
        """检测 Redis 是否可用"""
        if not self.redis_url:
            return False
        try:
            import redis
            client = redis.from_url(self.redis_url, decode_responses=True, db=1)
            client.ping()
            return True
        except Exception:
            return False

    @property
    def database_url(self) -> str:
        return self.database.url

    @property
    def database_host(self) -> str:
        """从连接 URL 中解析主机地址"""
        try:
            url = self.database.url
            if "@" in url:
                host_part = url.split("@")[1].split("/")[0]
                return host_part.split(":")[0]
        except (IndexError, ValueError):
            pass
        return "localhost"

    @property
    def database_port(self) -> int:
        """从连接 URL 中解析端口号"""
        try:
            url = self.database.url
            if "@" in url:
                host_part = url.split("@")[1].split("/")[0]
                if ":" in host_part:
                    return int(host_part.split(":")[1])
        except (IndexError, ValueError):
            pass
        return 5432

    @property
    def database_name(self) -> str:
        """从连接 URL 中解析数据库名"""
        try:
            url = self.database.url
            if "/" in url:
                return url.split("/")[-1].split("?")[0]
        except (IndexError, ValueError):
            pass
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


class EncryptionConfig(BaseModel):
    """加密配置"""
    encryption_key: Optional[str] = Field(default=None, alias="ENCRYPTION_KEY", description="API Key 加密密钥（生产环境必须设置，不使用 SECRET_KEY）")


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


# 注意：不再自动创建全局 settings 实例
# 请显式调用 get_settings() 获取配置单例：
#   from app.core.config import get_settings
#   settings = get_settings()
#
# 这种延迟初始化方式避免在模块导入时抛出异常，
# 使测试和其他模块可以更灵活地处理配置错误。


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


# ═════════════════════════════════════════════
# 🟡 P3-5: 全局懒代理设置对象（向后兼容）
# ═════════════════════════════════════════════


class _LazySettings:
    """懒代理 settings，首次访问属性时才初始化 Settings 实例。

    这个对象提供与直接导入 settings 完全相同的接口，但延迟创建
    actual Settings 实例，直到第一次属性访问发生。这避免了模块
   导入时的潜在异常，并保持了向后兼容性。
    """

    def __getattr__(self, name):
        # 直接调用同一模块中的 get_settings()，避免循环导入问题
        return getattr(get_settings(), name)

    def __repr__(self):
        try:
            # 直接调用同一模块中的 get_settings()，避免循环导入问题
            return repr(get_settings())
        except Exception:
            return "<LazySettings (Settings not yet initialized)>"


# 创建懒代理实例，供 backward-compatible 导入使用
settings = _LazySettings()
