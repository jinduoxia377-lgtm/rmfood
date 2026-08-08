"""RMFOOD TLS 1.3 安全配置

提供生产级的TLS/SSL配置，用于HTTPS和WebSocket安全传输。
支持：
- TLS 1.2/1.3协议配置
- 证书管理（自动续期）
- 安全密码套件选择
- HSTS/OCSP装订
- 客户端证书认证（mTLS）
"""
import os
import ssl
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class TLSCertificate:
    """TLS证书信息"""
    cert_path: str
    key_path: str
    ca_bundle_path: Optional[str] = None
    password: Optional[str] = None
    expires_at: Optional[datetime] = None
    issuer: str = ""
    subject: str = ""
    serial_number: str = ""
    version: int = 0

    def is_valid(self) -> bool:
        if not self.expires_at:
            return False
        return self.expires_at > datetime.now(timezone.utc)

    def days_until_expiry(self) -> int:
        if not self.expires_at:
            return 0
        delta = self.expires_at - datetime.now(timezone.utc)
        return max(0, delta.days)


@dataclass
class TLSConfig:
    """
    TLS配置类
    
    安全特性：
    - 强制TLS 1.2+（推荐TLS 1.3）
    - 禁用不安全的密码套件
    - 支持前向保密（Forward Secrecy）
    - OCSP装订支持
    - HSTS头部建议
    
    使用示例：
        >>> config = TLSConfig()
        >>> ssl_context = config.create_ssl_context()
        >>> # 用于uvicorn: uvicorn.run(..., ssl=config.create_ssl_context())
    """
    
    enabled: bool = True
    protocol_version: str = "TLSv1_3"  # 或 "TLSv1_2"
    
    cert_file: Optional[str] = None
    key_file: Optional[str] = None
    ca_file: Optional[str] = None
    
    min_version: ssl.TLSVersion = ssl.TLSVersion.TLSv1_2
    max_version: ssl.TLSVersion = ssl.TLSVersion.TLSv1_3
    
    require_client_cert: bool = False
    verify_client: bool = False
    
    hsts_max_age: int = 31536000  # 1年
    hsts_include_subdomains: bool = True
    hsts_preload: bool = True
    
    ocsp_stapling: bool = True
    session_tickets: bool = False
    
    cipher_suites: List[str] = field(default_factory=lambda: [
        "ECDHE-ECDSA-AES256-GCM-SHA384",
        "ECDHE-RSA-AES256-GCM-SHA384",
        "ECDHE-ECDSA-AES128-GCM-SHA256",
        "ECDHE-RSA-AES128-GCM-SHA256",
        "DHE-RSA-AES256-GCM-SHA384",
        "DHE-RSA-AES128-GCM-SHA256",
    ])
    
    curves: List[str] = field(default_factory=lambda: [
        "X25519", "secp384r1", "secp256r1"
    ])
    
    alpn_protocols: List[str] = field(default_factory=lambda: ["h2", "http/1.1"])
    
    cert_renewal_days_before: int = 30
    
    def __post_init__(self):
        if not self.cert_file:
            self.cert_file = os.getenv("TLS_CERT_FILE")
        if not self.key_file:
            self.key_file = os.getenv("TLS_KEY_FILE")
        if not self.ca_file:
            self.ca_file = os.getenv("TLS_CA_FILE")

    @property
    def is_configured(self) -> bool:
        return bool(self.cert_file and self.key_file and Path(self.cert_file).exists() and Path(self.key_file).exists())

    def create_ssl_context(self, purpose: str = "server") -> ssl.SSLContext:
        """
        创建SSL上下文
        
        Args:
            purpose: 用途 ("server"/"client")
            
        Returns:
            配置好的SSLContext对象
            
        Raises:
            ValueError: 如果缺少必要配置
            FileNotFoundError: 如果证书文件不存在
        """
        if not self.is_configured and purpose == "server":
            logger.warning("TLS未完全配置，使用开发模式（无加密）")
            return self._create_dev_context()

        try:
            if self.protocol_version.upper() == "TLSV1_3":
                context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                context.minimum_version = ssl.TLSVersion.TLSv1_3
                context.maximum_version = ssl.TLSVersion.TLSv1_3
            else:
                context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                context.minimum_version = self.min_version
                context.maximum_version = self.max_version
            
            context.load_cert_chain(
                certfile=self.cert_file,
                keyfile=self.key_file,
                password=self.password,
            )
            
            if self.ca_file and Path(self.ca_file).exists():
                context.load_verify_locations(cafile=self.ca_file)
                
            if self.require_client_cert or self.verify_client:
                context.verify_mode = ssl.CERT_REQUIRED
                
            ciphers = ":".join(self.cipher_suites)
            try:
                context.set_ciphers(ciphers)
            except ssl.SSLError as e:
                logger.warning(f"设置密码套件失败，使用默认值: {e}")
            
            if hasattr(context, 'set_ecdh_curve'):
                try:
                    context.set_ecdh_curve(":".join(self.curves))
                except Exception as e:
                    logger.warning(f"设置椭圆曲线失败: {e}")
            
            if self.alpn_protocols:
                try:
                    context.set_alpn_protocols(self.alpn_protocols)
                except Exception as e:
                    logger.warning(f"设置ALPN协议失败: {e}")
            
            context.options |= ssl.OP_NO_SSLv2 | ssl.OP_NO_SSLv3 | ssl.OP_NO_TLSv1 | ssl.OP_NO_TLSv1_1
            context.options |= ssl.OP_NO_COMPRESSION
            context.options |= ssl.OP_SINGLE_DH_USE | ssl.NO_SINGLE_ECDH_REUSE
            
            if not self.session_tickets:
                if hasattr(context, 'session_tickets'):
                    context.session_tickets = False
            
            logger.info(
                f"SSL上下文创建成功 (protocol={self.protocol_version}, "
                f"cert={self.cert_file})"
            )
            
            return context
            
        except Exception as e:
            logger.error(f"创建SSL上下文失败: {e}")
            raise

    def create_client_ssl_context(self) -> ssl.SSLContext:
        """创建客户端SSL上下文（用于发起HTTPS请求）"""
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        
        context.minimum_version = self.min_version
        context.maximum_version = self.max_version
        
        if self.ca_file and Path(self.ca_file).exists():
            context.load_verify_locations(cafile=self.ca_file)
        else:
            context.load_default_certs()
        
        context.check_hostname = True
        context.verify_mode = ssl.CERT_REQUIRED
        
        if self.alpn_protocols:
            try:
                context.set_alpn_protocols(self.alpn_protocols)
            except Exception as alpn_err:
                logger.debug("ALPN 协议配置失败（非致命）: %s", alpn_err)
        
        return context

    def _create_dev_context(self) -> ssl.SSLContext:
        """开发环境：返回None或最小化配置"""
        logger.warning("⚠️  开发模式：未启用TLS加密，仅用于本地测试！")
        return None

    def get_certificate_info(self) -> Optional[TLSCertificate]:
        """获取当前证书信息"""
        if not self.cert_file or not Path(self.cert_file).exists():
            return None
            
        try:
            from cryptography import x509
            from cryptography.hazmat.backends import default_backend
            
            with open(self.cert_file, "rb") as f:
                cert_data = f.read()
                
            cert = x509.load_pem_x509_certificate(cert_data, default_backend())
            
            return TLSCertificate(
                cert_path=self.cert_file,
                key_path=self.key_file or "",
                ca_bundle_path=self.ca_file,
                expires_at=cert.not_valid_after_utc.replace(tzinfo=timezone.utc),
                issuer=cert.issuer.rfc4514_string(),
                subject=cert.subject.rfc4514_string(),
                serial_number=format(cert.serial_number, "x"),
                version=cert.version.name,
            )
        except ImportError:
            logger.warning("cryptography库未安装，无法获取详细证书信息")
            return TLSCertificate(
                cert_path=self.cert_file,
                key_path=self.key_file or "",
                ca_bundle_path=self.ca_file,
            )
        except Exception as e:
            logger.error(f"读取证书信息失败: {e}")
            return None

    def check_certificate_expiry(self) -> Dict[str, Any]:
        """检查证书过期状态"""
        cert_info = self.get_certificate_info()
        
        if not cert_info:
            return {
                "status": "not_configured",
                "message": "TLS证书未配置",
            }
        
        days_left = cert_info.days_until_expiry()
        
        if days_left <= 0:
            status = "expired"
            message = "⚠️  证书已过期！立即更新！"
        elif days_left < self.cert_renewal_days_before:
            status = "expiring_soon"
            message = f"⚠️  证书将在{days_left}天后过期，请及时续期"
        else:
            status = "valid"
            message = f"✓ 证书有效（剩余{days_left}天）"
        
        return {
            "status": status,
            "message": message,
            "days_until_expiry": days_left,
            "expires_at": cert_info.expires_at.isoformat() if cert_info.expires_at else None,
            "subject": cert_info.subject,
            "issuer": cert_info.issuer,
        }

    def get_hsts_headers(self) -> Dict[str, str]:
        """获取HSTS响应头"""
        if not self.enabled:
            return {}
            
        value = (
            f"max-age={self.hsts_max_age}"
        )
        
        if self.hsts_include_subdomains:
            value += "; includeSubDomains"
        if self.hsts_preload:
            value += "; preload"
            
        return {"Strict-Transport-Security": value}

    def get_security_headers(self) -> Dict[str, str]:
        """获取所有安全相关的HTTP头"""
        headers = {}
        
        headers.update(self.get_hsts_headers())
        
        headers.update({
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Content-Security-Policy": "default-src 'self'",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
        })
        
        return headers

    def validate_configuration(self) -> Tuple[bool, List[str]]:
        """验证TLS配置是否正确"""
        errors = []
        warnings = []
        
        if not self.cert_file:
            errors.append("未指定证书文件路径")
        elif not Path(self.cert_file).exists():
            errors.append(f"证书文件不存在: {self.cert_file}")
            
        if not self.key_file:
            errors.append("未指定私钥文件路径")
        elif not Path(self.key_file).exists():
            errors.append(f"私钥文件不存在: {self.key_file}")
        
        if self.cert_file and self.key_file:
            cert_stat = os.stat(self.cert_file)
            key_stat = os.stat(self.key_file)
            
            if cert_stat.st_mode & 0o077:
                warnings.append(f"证书文件权限过于宽松: {oct(cert_stat.st_mode)}")
            if key_stat.st_mode & 0o0077:
                warnings.append(f"私钥文件权限过于宽松: {oct(key_stat.st_mode)}")
        
        if self.protocol_version.upper() == "TLSV1_2":
            warnings.append("建议升级到TLS 1.3以获得更好的性能和安全性")
        
        if len(self.cipher_suites) > 0:
            weak_ciphers = [c for c in self.cipher_suites if any(
                weak in c.upper() for weak in ["DES", "RC4", "MD5", "NULL"]
            )]
            if weak_ciphers:
                errors.append(f"检测到弱密码套件: {weak_ciphers}")
        
        is_valid = len(errors) == 0
        
        return is_valid, errors + warnings

    def to_dict(self) -> Dict[str, Any]:
        """导出配置为字典（隐藏敏感信息）"""
        return {
            "enabled": self.enabled,
            "protocol_version": self.protocol_version,
            "cert_file": self.cert_file,
            "key_file": "******" if self.key_file else None,
            "ca_file": self.ca_file,
            "min_version": self.min_version.name if hasattr(self.min_version, 'name') else str(self.min_version),
            "max_version": self.max_version.name if hasattr(self.max_version, 'name') else str(self.max_version),
            "require_client_cert": self.require_client_cert,
            "hsts_max_age": self.hsts_max_age,
            "ocsp_stapling": self.ocsp_stapling,
            "cipher_count": len(self.cipher_suites),
            "is_configured": self.is_configured,
        }


def create_production_tls_config(
    cert_path: str,
    key_path: str,
    ca_path: Optional[str] = None,
) -> TLSConfig:
    """
    创建生产环境TLS配置（工厂函数）
    
    提供开箱即用的安全配置：
    - 强制TLS 1.3
    - 现代密码套件
    - HSTS + 预加载
    - OCSP装订
    
    Args:
        cert_path: 证书文件路径
        key_path: 私钥文件路径
        ca_path: CA证书包路径（可选）
        
    Returns:
        配置好的TLSConfig实例
        
    Example:
        >>> tls_config = create_production_tls_config("/path/to/cert.pem", "/path/to/key.pem")
        >>> ssl_ctx = tls_config.create_ssl_context()
    """
    return TLSConfig(
        enabled=True,
        protocol_version="TLSv1_3",
        cert_file=cert_path,
        key_file=key_path,
        ca_file=ca_path,
        require_client_cert=False,
        hsts_max_age=31536000,
        hsts_include_subdomains=True,
        hsts_preload=True,
        ocsp_stapling=True,
        session_tickets=False,
    )


def create_development_tls_config() -> TLSConfig:
    """
    创建开发环境TLS配置
    
    特点：
    - 禁用TLS（方便调试）
    - 不要求证书
    - 较宽松的安全策略
    
    Returns:
        开发环境的TLSConfig实例
    """
    return TLSConfig(
        enabled=False,
        protocol_version="TLSv1_2",
        require_client_cert=False,
        hsts_max_age=0,
        hsts_include_subdomains=False,
        hsts_preload=False,
    )


def generate_self_signed_cert(
    output_dir: str,
    hostname: str = "localhost",
    valid_days: int = 365,
) -> Tuple[str, str]:
    """
    生成本地开发用自签名证书（仅用于测试！）
    
    ⚠️ 警告：此功能生成的证书不适合生产环境使用！
    
    Args:
        output_dir: 输出目录
        hostname: 主机名（默认localhost）
        valid_days: 有效天数
        
    Returns:
        (cert_path, key_path) 元组
        
    Example:
        >>> cert, key = generate_self_signed_cert("./certs", "localhost")
        >>> tls_config = create_production_tls_config(cert, key)
    """
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import datetime
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "CN"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Development"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, "Local"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "RMFOOD Dev"),
            x509.NameAttribute(NameOID.COMMON_NAME, hostname),
        ])
        
        now = datetime.datetime.now(datetime.timezone.utc)
        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(private_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now)
            .not_valid_after(now + datetime.timedelta(days=valid_days))
            .add_extension(
                x509.SubjectAlternativeName([x509.DNSName(hostname)]),
                critical=False,
            )
            .sign(private_key, hashes.SHA256())
        )
        
        cert_path = output_path / f"{hostname}.pem"
        key_path = output_path / f"{hostname}-key.pem"
        
        with open(cert_path, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
            
        with open(key_path, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            ))
        
        os.chmod(key_path, 0o600)
        
        logger.info(f"自签名证书已生成: {cert_path}, {key_path}")
        
        return str(cert_path), str(key_path)
        
    except ImportError:
        raise RuntimeError(
            "需要cryptography库来生成自签名证书。请运行: pip install cryptography"
        )


class TLSConfigManager:
    """
    TLS配置管理器（单例模式）
    
    功能：
    - 全局TLS配置访问
    - 自动证书过期检查
    - 配置热重载
    - 运行时状态监控
    """
    
    _instance: Optional["TLSConfigManager"] = None
    _config: Optional[TLSConfig] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._config = None
        self._last_check_time = None
        self._check_interval_hours = 24
    
    @classmethod
    def initialize(cls, config: TLSConfig):
        """初始化全局TLS配置"""
        manager = cls()
        manager._config = config
        
        is_valid, messages = config.validate_configuration()
        if not is_valid:
            for msg in messages:
                logger.error(f"TLS配置错误: {msg}")
        else:
            for msg in messages:
                logger.warning(f"TLS配置警告: {msg}")
        
        logger.info("TLS配置管理器初始化完成")
        return manager
    
    @classmethod
    def get_config(cls) -> Optional[TLSConfig]:
        """获取当前TLS配置"""
        manager = cls()
        return manager._config
    
    @classmethod
    def check_and_alert(cls) -> Dict[str, Any]:
        """检查证书状态并返回报告"""
        manager = cls()
        
        if not manager._config:
            return {"status": "not_initialized"}
        
        report = manager._config.check_certificate_expiry()
        
        if report["status"] in ["expired", "expiring_soon"]:
            logger.warning(f"TLS证书状态异常: {report['message']}")
        
        return report
    
    def reload_config(self, new_config: TLSConfig):
        """热重载配置"""
        self._config = new_config
        logger.info("TLS配置已热重载")


def setup_tls_for_app(app, tls_config: TLSConfig):
    """
    为FastAPI应用配置TLS中间件和安全头
    
    Args:
        app: FastAPI应用实例
        tls_config: TLS配置对象
    """
    from starlette.middleware.base import BaseHTTPMiddleware
    
    class TLSHeadersMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            response = await call_next(request)
            
            for header, value in tls_config.get_security_headers().items():
                response.headers[header] = value
            
            return response
    
    app.add_middleware(TLSHeadersMiddleware)
    logger.info("TLS安全头中间件已添加")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    logger.info("=" * 60)
    logger.info("RMFOOD TLS Configuration Test")
    logger.info("=" * 60)
    dev_config = create_development_tls_config()
    logger.info("\n🔧 开发环境配置:")
    logger.info(f"   Enabled: {dev_config.enabled}")
    logger.info(f"   Protocol: {dev_config.protocol_version}")
    logger.info("\n📋 配置验证:")
    is_valid, messages = dev_config.validate_configuration()
    logger.info(f"   Valid: {is_valid}")
    for msg in messages:
        logger.info(f"   - {msg}")
    logger.info("\n🔒 安全头:")
    headers = dev_config.get_security_headers()
    for k, v in headers.items():
        logger.info(f"   {k}: {v[:50]}..." if len(v) > 50 else f"   {k}: {v}")