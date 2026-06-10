"""
RMFOOD 应用配置
使用 pydantic-settings 从环境变量加载，支持 .env 文件

⚠️ 安全提示：
- 生产环境必须设置 SECRET_KEY 和 ADMIN_PASSWORD 环境变量
- 绝对不要将默认密钥用于生产环境
"""
from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
import logging
import secrets
import os

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """应用全局配置"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── 应用基础 ──
    app_name: str = "RMFOOD配方设计平台"
    app_version: str = "1.0.0"
    debug: bool = True

    # ── 数据库 ──
    # PostgreSQL (生产环境) / SQLite (开发环境备用)
    # 格式: postgresql+asyncpg://user:password@host:port/dbname
    #       sqlite+aiosqlite:///./rmfood.db
    database_url: str = "postgresql+asyncpg://postgres@localhost:5432/rmfood_platform"
    # 只读副本 URL（可选，用于读写分离）
    # 格式与 database_url 相同。留空则所有请求使用主库
    database_read_replica_url: Optional[str] = None
    database_pool_size: int = 20         # 常驻连接数（仅 PostgreSQL/MySQL 生效）
    database_max_overflow: int = 10      # 溢出连接数（高峰时额外创建）
    database_pool_timeout: int = 30      # 获取连接超时（秒）
    database_pool_recycle: int = 1800    # 连接回收时间（秒，防止连接因超时被服务端关闭）
    database_pool_pre_ping: bool = True  # 连接健康检查（每次使用前 ping）

    # ── 安全（P0修复：移除默认弱密钥） ──
    # ✅ 改进方案：开发环境自动生成强随机密钥，生产环境强制从环境变量读取
    secret_key: Optional[str] = None  # 不提供默认值！
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # ── 账号安全 (P1-2: 防暴力破解) ──
    max_login_attempts: int = 5              # 最大登录失败次数（超过则锁定）
    lockout_duration_minutes: int = 15       # 锁定持续时间（分钟）
    max_login_attempts_per_ip: int = 10      # 每IP每分钟最大登录尝试次数（限流）
    rate_limit_window_seconds: int = 60      # 限流时间窗口（秒）
    max_devices_per_user: int = 5            # 每用户最大设备数
    
    # ── CORS ──
    cors_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"]
    cors_methods: List[str] = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    cors_headers: List[str] = ["Authorization", "Content-Type", "Accept", "X-Request-ID"]

    # ── 初始管理员（P0修复：强化密码策略） ──
    admin_username: str = "admin"
    admin_password: Optional[str] = None  # 不提供默认值！
    admin_email: str = "admin@rmfood.com"

    # ── 文件上传 ──
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 50
    allowed_extensions: List[str] = [
        ".pdf", ".doc", ".docx", ".xls", ".xlsx",
        ".png", ".jpg", ".jpeg", ".gif", ".svg",
        ".csv", ".json", ".zip", ".rar",
    ]

    # ═══════════════════════════════════
    # Phase 2: AI 推理引擎 (LLM)
    # ═══════════════════════════════════
    llm_provider: str = "openai"               # openai | deepseek | zhipu | qwen | custom
    openai_api_key: Optional[str] = None       # 各提供商的 API Key（通用字段）
    openai_base_url: Optional[str] = None      # 支持自定义端点（如本地 vLLM、代理等）
    llm_model: Optional[str] = None            # 指定模型名（如 gpt-4o-mini、deepseek-chat）
    vllm_endpoint: Optional[str] = None        # vLLM 推理服务地址
    ai_max_tokens: int = 4096
    ai_temperature: float = 0.7

    # ═══════════════════════════════════
    # Phase 2: 图数据库 (Neo4j)
    # ═══════════════════════════════════
    neo4j_uri: Optional[str] = None       # 例: bolt://localhost:7687
    neo4j_user: str = "neo4j"
    neo4j_password: Optional[str] = None

    # ═══════════════════════════════════
    # Phase 2: 搜索引擎 (ElasticSearch)
    # ═══════════════════════════════════
    elasticsearch_url: Optional[str] = None   # 例: http://localhost:9200
    elasticsearch_api_key: Optional[str] = None

    # ═══════════════════════════════════
    # Phase 2: 缓存 (Redis)
    # ═══════════════════════════════════
    redis_url: Optional[str] = None       # 例: redis://localhost:6379/0

    # ═══════════════════════════════════
    # Phase 2: 任务队列 (Celery)
    # ═══════════════════════════════════
    celery_broker_url: Optional[str] = None   # 例: redis://localhost:6379/1
    celery_result_backend: Optional[str] = None

    # ═══════════════════════════════════
    # Phase 2: 外部数据源
    # ═══════════════════════════════════
    tcmsp_api_url: Optional[str] = None   # TCMSP 数据库 API
    tcmsp_api_key: Optional[str] = None
    dfbp_api_url: Optional[str] = None    # DFBP 数据库 API
    dfbp_api_key: Optional[str] = None

    # ═══════════════════════════════════
    # Phase 3: 可观测性
    # ═══════════════════════════════════
    log_level: str = "INFO"                          # 日志级别: DEBUG, INFO, WARNING, ERROR, CRITICAL
    alert_webhook_url: Optional[str] = None          # 告警 Webhook URL（企业微信/Slack/钉钉）
    alert_error_threshold: int = 10                  # 错误数阈值（触发告警）
    alert_error_window_seconds: int = 60             # 错误统计窗口（秒）
    otel_exporter_endpoint: Optional[str] = None     # OpenTelemetry Collector 端点
    trace_sample_rate: float = 1.0                   # 追踪采样率（0.0-1.0）

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: Optional[str]) -> str:
        """
        P0 安全修复：密钥验证逻辑

        开发环境（DEBUG=true）：
        - 如果未提供，自动生成强随机密钥并打印到控制台
        - 方便开发者快速启动，无需手动配置

        生产环境（DEBUG=false 或未设置）：
        - 必须从环境变量 SECRET_KEY 读取
        - 长度必须 ≥ 32 位
        - 不能使用弱默认值
        - 否则拒绝启动，防止使用不安全的密钥
        """
        is_debug = os.getenv("DEBUG", "true").lower() == "true"

        if is_debug:
            # 开发模式：自动生成或使用提供的值
            if not v:
                # 自动生成64位随机密钥（URL-safe base64）
                v = secrets.token_urlsafe(48)
                # 安全输出：只显示部分掩码，避免完整密钥泄露到日志
                masked_key = f"{v[:8]}...{v[-4:]}"
                logger.warning(f"\n{'='*60}")
                logger.warning(f"⚠️  [开发模式] 自动生成 SECRET_KEY: {masked_key}")
                logger.warning(f"   完整值已写入 .env 文件，请勿分享日志！")
                logger.warning(f"{'='*60}\n")

                # 自动将生成的密钥写入.env文件（如果存在）
                try:
                    env_file = Path(".env")
                    if env_file.exists():
                        content = env_file.read_text()
                        if "SECRET_KEY=" not in content:
                            with open(env_file, "a") as f:
                                f.write(f"\n# 自动生成的密钥 (请勿提交到版本控制)\n")
                                f.write(f"SECRET_KEY={v}\n")
                except Exception as e:
                    logger.warning(f"无法自动保存密钥到 .env 文件: {e}")
            elif len(v) < 16:
                raise ValueError(
                    f"SECRET_KEY 长度过短 ({len(v)}位)，至少需要16位。"
                    "请删除 .env 文件中的 SECRET_KEY 让系统自动生成。"
                )
        else:
            # 生产模式：严格要求
            weak_defaults = [
                "change-me-to-a-random-secret-key-in-production",
                "secret", "test", "password",
                "admin123", "123456", "",
            ]

            if not v:
                raise ValueError(
                    "🚫 生产环境错误：未设置 SECRET_KEY 环境变量！\n"
                    "   请执行：export SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(48))')\n"
                    "   或在 .env 文件中添加：SECRET_KEY=<你的强随机密钥>"
                )
            elif v in weak_defaults:
                raise ValueError(
                    "🚫 生产环境错误：使用了弱默认密钥！\n"
                    "   请生成强随机密钥：python -c \"import secrets; print(secrets.token_urlsafe(48))\""
                )
            elif len(v) < 32:
                raise ValueError(
                    f"🚫 生产环境错误：SECRET_KEY 强度不足 ({len(v)} < 32)！\n"
                    "   请使用至少32位的随机字符串。"
                )

        return v

    @field_validator("admin_password")
    @classmethod
    def validate_admin_password(cls, v: Optional[str]) -> str:
        """
        P0 安全修复：管理员密码验证

        开发环境：
        - 如果未提供，自动生成16位强密码并打印到控制台

        生产环境：
        - 必须从环境变量 ADMIN_PASSWORD 读取
        - 长度必须 ≥ 12 位
        - 必须包含大小写字母+数字+特殊字符
        - 否则拒绝启动
        """
        is_debug = os.getenv("DEBUG", "true").lower() == "true"

        if is_debug:
            # 开发模式：自动生成或使用提供的值
            if not v:
                # 生成包含大小写+数字+特殊字符的强密码
                import string
                alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
                v = ''.join(secrets.choice(alphabet) for _ in range(16))
                
                # 安全输出：只显示部分掩码
                masked_pwd = f"{v[:4]}****{v[-4:]}"
                logger.warning(f"\n{'='*60}")
                logger.warning(f"⚠️  [开发模式] 自动生成 ADMIN_PASSWORD: {masked_pwd}")
                logger.warning(f"   用户名: admin")
                logger.warning(f"   ⚠️ 完整密码已保存至 .env 文件，请勿泄露日志！")
                logger.warning(f"{'='*60}\n")

                # 自动将生成的密码写入.env文件（如果存在）
                try:
                    env_file = Path(".env")
                    if env_file.exists():
                        content = env_file.read_text()
                        if "ADMIN_PASSWORD=" not in content:
                            with open(env_file, "a") as f:
                                f.write(f"\n# 自动生成的管理员密码 (请勿提交到版本控制)\n")
                                f.write(f"ADMIN_PASSWORD={v}\n")
                except Exception as e:
                    logger.warning(f"无法自动保存密码到 .env 文件: {e}")
            elif len(v) < 8:
                raise ValueError(
                    f"ADMIN_PASSWORD 过于简单 ({len(v)}位)，至少需要8位。"
                    "请删除 .env 文件中的 ADMIN_PASSWORD 让系统自动生成。"
                )
        else:
            # 生产模式：严格要求
            if not v:
                raise ValueError(
                    "🚫 生产环境错误：未设置 ADMIN_PASSWORD 环境变量！\n"
                    "   请执行：export ADMIN_PASSWORD=<你的强密码>\n"
                    "   密码要求：≥12位，包含大小写字母、数字和特殊字符"
                )
            elif len(v) < 12:
                raise ValueError(
                    f"🚫 生产环境错误：ADMIN_PASSWORD 强度不足 ({len(v)} < 12)！\n"
                    "   密码要求：≥12位，包含大小写字母、数字和特殊字符"
                )

            # 检查密码复杂度
            has_upper = any(c.isupper() for c in v)
            has_lower = any(c.islower() for c in v)
            has_digit = any(c.isdigit() for c in v)
            has_special = any(not c.isalnum() for c in v)

            if not (has_upper and has_lower and has_digit and has_special):
                raise ValueError(
                    "🚫 生产环境错误：ADMIN_PASSWORD 复杂度不足！\n"
                    "   必须包含：大写字母 + 小写字母 + 数字 + 特殊字符 (!@#$%^&*)"
                )

        return v

    @property
    def is_production(self) -> bool:
        return not self.debug

    @property
    def neo4j_available(self) -> bool:
        return all([self.neo4j_uri, self.neo4j_password])

    @property
    def elasticsearch_available(self) -> bool:
        return self.elasticsearch_url is not None

    @property
    def redis_available(self) -> bool:
        return self.redis_url is not None

    @property
    def ai_available(self) -> bool:
        return any([self.openai_api_key, self.vllm_endpoint])


settings = Settings()
