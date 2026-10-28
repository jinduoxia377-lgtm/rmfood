"""
security_config.py
安全配置增强模块

用于增强和验证安全配置，集成到主配置系统中
"""

from __future__ import annotations

import os
import secrets
import string
from enum import Enum
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel, Field


class SecurityLevel(str, Enum):
    """安全级别"""
    LOW = "low"           # 开发环境
    MEDIUM = "medium"     # 测试/预发环境
    HIGH = "high"         # 生产环境
    PARANOID = "paranoid" # 高安全要求环境


class SecurityPolicy(BaseModel):
    """安全策略配置"""
    # 认证相关
    password_min_length: int = Field(default=8, ge=4, le=128, description="密码最小长度")
    password_require_uppercase: bool = Field(default=True, description="密码是否需要大写字母")
    password_require_number: bool = Field(default=True, description="密码是否需要数字")
    password_require_special: bool = Field(default=False, description="密码是否需要特殊字符")
    password_history_count: int = Field(default=5, ge=0, description="保留密码历史记录数")

    # 会话管理
    session_timeout_minutes: int = Field(default=480, ge=1, description="会话超时时间（分钟）")
    max_concurrent_sessions: int = Field(default=3, ge=1, description="最大并发会话数")
    require_reauthentication_for_sensitive: bool = Field(default=True, description="敏感操作需要重新认证")

    # 令牌安全
    access_token_expire_minutes: int = Field(default=480, ge=1, description="访问令牌过期时间（分钟）")
    refresh_token_expire_days: int = Field(default=30, ge=1, description="刷新令牌过期时间（天）")
    token_issuer: str = Field(default="rmfood", description="令牌签发者")
    token_audience: str = Field(default="rmfood-api", description="令牌受众")

    # API安全
    enable_rate_limiting: bool = Field(default=True, description="是否启用速率限制")
    rate_limit_per_minute: int = Field(default=60, ge=1, description="每分钟请求限制")
    rate_limit_per_hour: int = Field(default=1000, ge=1, description="每小时请求限制")
    max_request_size_mb: int = Field(default=10, ge=1, description="最大请求大小（MB）")

    # 网络安全
    require_https: bool = Field(default=True, description="是否要求HTTPS")
    enable_hsts: bool = Field(default=True, description="是否启用HSTS")
    enable_content_security_policy: bool = Field(default=True, description="是否启用CSP")
    frame_options: str = Field(default="DENY", description="X-Frame-Options")

    # 加密和存储
    encryption_key_length: int = Field(default=32, ge=16, description="加密密钥长度")
    salt_length: int = Field(default=16, ge=8, description="盐值长度")
    hash_iterations: int = Field(default=100000, ge=1000, description="哈希迭代次数")

    # 日志和审计
    enable_audit_logging: bool = Field(default=True, description="是否启用审计日志")
    audit_log_retention_days: int = Field(default=90, ge=1, description="审计日志保留天数")
    log_sensitive_data: bool = Field(default=False, description="是否记录敏感数据")

    # 合规性
    enable_gdpr_compliance: bool = Field(default=True, description="是否启用GDPR合规")
    data_retention_days: int = Field(default=730, ge=1, description="数据保留天数")
    enable_data_encryption_at_rest: bool = Field(default=True, description="是否启用静态数据加密")

    @classmethod
    def for_environment(cls, env: SecurityLevel) -> "SecurityPolicy":
        """获取环境特定的安全策略"""
        policies = {
            SecurityLevel.LOW: cls._low_security(),
            SecurityLevel.MEDIUM: cls._medium_security(),
            SecurityLevel.HIGH: cls._high_security(),
            SecurityLevel.PARANOID: cls._paranoid_security(),
        }
        return policies[env]

    @classmethod
    def _low_security(cls) -> "SecurityPolicy":
        """低安全级别（开发环境）"""
        return cls(
            password_min_length=6,
            password_require_uppercase=False,
            password_require_number=False,
            password_require_special=False,
            session_timeout_minutes=1440,  # 24小时
            max_concurrent_sessions=10,
            require_reauthentication_for_sensitive=False,
            enable_rate_limiting=False,
            require_https=False,
            enable_hsts=False,
            enable_content_security_policy=False,
            log_sensitive_data=True,
        )

    @classmethod
    def _medium_security(cls) -> "SecurityPolicy":
        """中等安全级别（测试/预发环境）"""
        return cls(
            password_min_length=8,
            password_require_uppercase=True,
            password_require_number=True,
            password_require_special=False,
            session_timeout_minutes=480,  # 8小时
            max_concurrent_sessions=5,
            require_reauthentication_for_sensitive=True,
            enable_rate_limiting=True,
            rate_limit_per_minute=120,
            rate_limit_per_hour=2000,
            require_https=False,  # 测试环境可能没有HTTPS
            enable_hsts=False,
            enable_content_security_policy=True,
        )

    @classmethod
    def _high_security(cls) -> "SecurityPolicy":
        """高安全级别（生产环境）"""
        return cls(
            password_min_length=12,
            password_require_uppercase=True,
            password_require_number=True,
            password_require_special=True,
            password_history_count=10,
            session_timeout_minutes=120,  # 2小时
            max_concurrent_sessions=3,
            require_reauthentication_for_sensitive=True,
            access_token_expire_minutes=60,  # 1小时
            enable_rate_limiting=True,
            rate_limit_per_minute=60,
            rate_limit_per_hour=1000,
            require_https=True,
            enable_hsts=True,
            enable_content_security_policy=True,
            encryption_key_length=32,
            hash_iterations=100000,
            enable_audit_logging=True,
            audit_log_retention_days=180,
            log_sensitive_data=False,
            enable_gdpr_compliance=True,
            enable_data_encryption_at_rest=True,
        )

    @classmethod
    def _paranoid_security(cls) -> "SecurityPolicy":
        """偏执安全级别（高安全要求）"""
        return cls(
            password_min_length=16,
            password_require_uppercase=True,
            password_require_number=True,
            password_require_special=True,
            password_history_count=20,
            session_timeout_minutes=30,  # 30分钟
            max_concurrent_sessions=1,
            require_reauthentication_for_sensitive=True,
            access_token_expire_minutes=15,  # 15分钟
            enable_rate_limiting=True,
            rate_limit_per_minute=30,
            rate_limit_per_hour=500,
            max_request_size_mb=5,
            require_https=True,
            enable_hsts=True,
            enable_content_security_policy=True,
            encryption_key_length=48,
            hash_iterations=500000,
            enable_audit_logging=True,
            audit_log_retention_days=365,
            log_sensitive_data=False,
            enable_gdpr_compliance=True,
            data_retention_days=365,
            enable_data_encryption_at_rest=True,
        )


class SecurityConfiguration:
    """安全配置管理器"""

    def __init__(self, env: Optional[str] = None):
        self.environment = self._detect_environment(env)
        self.policy = SecurityPolicy.for_environment(self.environment)
        self.validation_errors: List[str] = []
        self.validation_warnings: List[str] = []

    def _detect_environment(self, env: Optional[str] = None) -> SecurityLevel:
        """检测安全环境"""
        if env:
            try:
                return SecurityLevel(env.lower())
            except ValueError:
                pass

        # 基于系统环境判断
        app_env = os.environ.get("ENV", "development").lower()

        if app_env == "production":
            return SecurityLevel.HIGH
        elif app_env in ["staging", "preprod"]:
            return SecurityLevel.MEDIUM
        elif app_env == "test":
            return SecurityLevel.MEDIUM
        else:  # development
            return SecurityLevel.LOW

    def validate(self, config: Dict[str, any]) -> Tuple[bool, List[str], List[str]]:
        """验证配置是否符合安全策略"""
        self.validation_errors.clear()
        self.validation_warnings.clear()

        self._validate_core_security(config)
        self._validate_api_security(config)
        self._validate_network_security(config)
        self._validate_compliance(config)

        return (
            len(self.validation_errors) == 0,
            self.validation_errors,
            self.validation_warnings
        )

    def _validate_core_security(self, config: Dict[str, any]) -> None:
        """验证核心安全配置"""
        # 检查SECRET_KEY
        secret_key = config.get("SECRET_KEY")
        if not secret_key:
            self.validation_errors.append("SECRET_KEY未设置")
        elif isinstance(secret_key, str):
            if len(secret_key) < self.policy.encryption_key_length:
                self.validation_errors.append(
                    f"SECRET_KEY长度不足{self.policy.encryption_key_length}字符"
                )
            if any(default in secret_key.lower() for default in [
                "your-", "change-me", "default", "secret", "password"
            ]):
                self.validation_errors.append("SECRET_KEY包含默认或弱值")

        # 检查密码策略
        if not config.get("SECURITY__PASSWORD_MIN_LENGTH"):
            self.validation_warnings.append(f"建议设置密码最小长度为{self.policy.password_min_length}")

    def _validate_api_security(self, config: Dict[str, any]) -> None:
        """验证API安全配置"""
        # 检查CORS配置
        cors_origins = config.get("SECURITY__CORS_ORIGINS")
        if cors_origins:
            if "*" in cors_origins and self.environment in [SecurityLevel.HIGH, SecurityLevel.PARANOID]:
                self.validation_errors.append("生产环境不允许CORS使用通配符(*)")

        # 检查JWT配置
        jwt_expire = config.get("SECURITY__JWT_EXPIRE_MINUTES")
        if jwt_expire:
            try:
                expire = int(jwt_expire)
                if expire > 1440:  # 超过24小时
                    self.validation_warnings.append(f"JWT过期时间过长: {expire}分钟")
                if expire < 15:
                    self.validation_warnings.append(f"JWT过期时间太短: {expire}分钟")
            except (ValueError, TypeError):
                self.validation_errors.append("JWT过期时间配置错误")

    def _validate_network_security(self, config: Dict[str, any]) -> None:
        """验证网络安全配置"""
        if self.policy.require_https and not config.get("SERVER__SSL_ENABLED"):
            self.validation_warnings.append("安全策略建议启用HTTPS")

    def _validate_compliance(self, config: Dict[str, any]) -> None:
        """验证合规性配置"""
        if self.policy.enable_gdpr_compliance and not config.get("COMPLIANCE__GDPR_ENABLED"):
            self.validation_warnings.append("安全策略建议启用GDPR合规")

    def generate_safe_defaults(self) -> Dict[str, str]:
        """生成安全默认值"""
        return {
            "SECURITY__PASSWORD_MIN_LENGTH": str(self.policy.password_min_length),
            "SECURITY__JWT_EXPIRE_MINUTES": str(self.policy.access_token_expire_minutes),
            "SECURITY__JWT_REFRESH_EXPIRE_DAYS": str(self.policy.refresh_token_expire_days),
            "RATE_LIMIT__PER_MINUTE": str(self.policy.rate_limit_per_minute),
            "RATE_LIMIT__PER_HOUR": str(self.policy.rate_limit_per_hour),
            "ENCRYPTION__KEY_LENGTH": str(self.policy.encryption_key_length),
        }

    def generate_secret_key(self) -> str:
        """生成安全的SECRET_KEY"""
        # 使用secrets模块生成加密安全的随机字符串
        alphabet = string.ascii_letters + string.digits + string.punctuation
        return ''.join(secrets.choice(alphabet) for _ in range(self.policy.encryption_key_length))

    def get_security_report(self) -> Dict[str, any]:
        """获取安全配置报告"""
        return {
            "security_level": self.environment.value,
            "security_policy": self.policy.model_dump(),
            "validation_passed": len(self.validation_errors) == 0,
            "validation_errors": self.validation_errors,
            "validation_warnings": self.validation_warnings,
            "recommendations": self.get_recommendations(),
        }

    def get_recommendations(self) -> List[str]:
        """获取安全建议"""
        recommendations = []

        if self.environment == SecurityLevel.LOW:
            recommendations.append("开发环境安全级别较低，仅供内部使用")
            recommendations.append("生产前请升级到HIGH或PARANOID级别")

        if not self.policy.enable_audit_logging:
            recommendations.append("建议启用审计日志")

        if not self.policy.enable_gdpr_compliance:
            recommendations.append("建议启用GDPR合规配置")

        return recommendations


# 全局安全配置实例
_security_config: Optional[SecurityConfiguration] = None


def get_security_config() -> SecurityConfiguration:
    """获取安全配置单例"""
    global _security_config
    if _security_config is None:
        _security_config = SecurityConfiguration()
    return _security_config


def validate_security_settings() -> Tuple[bool, List[str], List[str]]:
    """验证当前安全设置（从环境变量）"""
    config = dict(os.environ)
    security_config = get_security_config()
    return security_config.validate(config)


def get_security_report() -> Dict[str, any]:
    """获取安全配置报告"""
    security_config = get_security_config()
    return security_config.get_security_report()


__all__ = [
    "SecurityLevel",
    "SecurityPolicy",
    "SecurityConfiguration",
    "get_security_config",
    "validate_security_settings",
    "get_security_report",
]
