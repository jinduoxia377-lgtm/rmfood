#!/usr/bin/env python3
"""
security-audit.py
安全审计和配置验证脚本

用于验证安全配置是否符合最佳实践
"""

import os
import sys
import json
import hashlib
from datetime import datetime
from pathlib import Path

class SecurityAudit:
    """安全审计工具类"""

    def __init__(self):
        self.findings = {
            "critical": [],
            "high": [],
            "medium": [],
            "low": [],
            "info": []
        }

        # OWASP Top 10 安全检查清单
        self.owasp_checks = [
            "broken_access_control",
            "cryptographic_failures",
            "injection",
            "insecure_design",
            "security_misconfiguration",
            "vulnerable_and_outdated_components",
            "identification_and_authentication_failures",
            "software_and_data_integrity_failures",
            "security_logging_and_monitoring_failures",
            "server_side_request_forgery"
        ]

    def check_secret_key(self):
        """检查SECRET_KEY配置"""
        secret_key = os.environ.get("SECRET_KEY", "")

        if not secret_key:
            self.findings["critical"].append("SECRET_KEY未设置")
            return

        if len(secret_key) < 32:
            self.findings["critical"].append(f"SECRET_KEY长度不足32字符（当前: {len(secret_key)}）")

        # 检查是否使用默认值
        default_patterns = ["your-", "change-me", "default-secret", "dev-only"]
        for pattern in default_patterns:
            if pattern in secret_key.lower():
                self.findings["critical"].append(f"SECRET_KEY包含默认关键字: '{pattern}'")
                break

    def check_production_settings(self):
        """检查生产环境设置"""
        env = os.environ.get("ENV", "development")
        debug = os.environ.get("DEBUG", "")

        if env.lower() == "production":
            if debug.lower() in ["true", "1"]:
                self.findings["critical"].append("生产环境DEBUG模式启用")

            # 检查日志级别
            log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
            if log_level == "DEBUG":
                self.findings["high"].append("生产环境日志级别为DEBUG")

    def check_database_security(self):
        """检查数据库安全配置"""
        db_url = os.environ.get("DATABASE_URL", "")

        if not db_url:
            # 检查传统环境变量
            for var in ["POSTGRES_HOST", "POSTGRES_USER"]:
                if not os.environ.get(var):
                    self.findings["high"].append(f"缺少数据库配置: {var}")
            return

        # 检查连接字符串安全性
        insecure_patterns = [
            ("://root:", "使用root用户连接数据库"),
            ("password=password", "使用默认密码"),
            ("password=123456", "使用弱密码"),
            ("password=", "密码可能为空"),
        ]

        for pattern, issue in insecure_patterns:
            if pattern in db_url.lower():
                self.findings["high"].append(f"数据库连接字符串不安全: {issue}")

    def check_cors_configuration(self):
        """检查CORS配置"""
        cors_origins = os.environ.get("SECURITY__CORS_ORIGINS", "")

        if not cors_origins:
            self.findings["medium"].append("CORS_ORIGINS未配置")
            return

        # 检查开发环境的CORS配置
        if os.environ.get("ENV", "").lower() == "development":
            if "*" in cors_origins:
                self.findings["high"].append("开发环境CORS允许所有源(*)")
        else:
            # 生产环境检查
            if "*" in cors_origins:
                self.findings["critical"].append("生产环境CORS允许所有源(*)")

            # 检查是否有不安全的源
            origins = [origin.strip() for origin in cors_origins.split(",")]
            for origin in origins:
                if origin.startswith("http://") and not origin.startswith("http://localhost"):
                    self.findings["medium"].append(f"CORS允许HTTP源: {origin}")

    def check_jwt_configuration(self):
        """检查JWT配置"""
        # 检查JWT过期时间
        try:
            jwt_expire = int(os.environ.get("SECURITY__JWT_EXPIRE_MINUTES", "480"))
            if jwt_expire > 1440:  # 超过24小时
                self.findings["medium"].append(f"JWT过期时间过长: {jwt_expire}分钟")
            if jwt_expire < 15:    # 太短
                self.findings["medium"].append(f"JWT过期时间太短: {jwt_expire}分钟")
        except ValueError:
            self.findings["high"].append("JWT过期时间配置错误")

        # 检查JWT算法
        jwt_algorithm = os.environ.get("SECURITY__JWT_ALGORITHM", "HS256")
        weak_algorithms = ["HS256"]  # 可以扩展检查更多算法
        if jwt_algorithm.upper() in weak_algorithms:
            self.findings["info"].append(f"使用的JWT算法可能较弱: {jwt_algorithm}")

    def check_file_permissions(self):
        """检查关键文件权限"""
        critical_files = [
            Path(".env"),
            Path("docker-compose.yml"),
            Path("scripts/"),
        ]

        for file_path in critical_files:
            if file_path.exists():
                if file_path.stat().st_mode & 0o777 > 0o600:
                    self.findings["medium"].append(f"文件权限可能过宽: {file_path}")

    def check_dependencies(self):
        """检查依赖安全性"""
        requirements_files = [
            Path("requirements.txt"),
            Path("requirements/base.txt"),
            Path("requirements/api.txt"),
        ]

        for req_file in requirements_files:
            if req_file.exists():
                content = req_file.read_text()

                # 检查是否有未锁定版本
                import re
                bad_patterns = [
                    r"^\s*[a-zA-Z]+\s*$",  # 只有包名
                    r"^\s*[a-zA-Z]+>=",     # >= 未锁定
                    r"^\s*[a-zA-Z]+~=",     # ~= 兼容版本
                ]

                for i, line in enumerate(content.splitlines(), 1):
                    line = line.strip()
                    if line and not line.startswith("#"):
                        for pattern in bad_patterns:
                            if re.match(pattern, line):
                                self.findings["medium"].append(f"依赖未锁定版本: {req_file}:{i} {line}")

    def generate_report(self) -> dict:
        """生成审计报告"""
        return {
            "timestamp": datetime.now().isoformat(),
            "environment": os.environ.get("ENV", "development"),
            "checks_performed": len(self.owasp_checks),
            "findings": self.findings,
            "summary": {
                "critical": len(self.findings["critical"]),
                "high": len(self.findings["high"]),
                "medium": len(self.findings["medium"]),
                "low": len(self.findings["low"]),
                "info": len(self.findings["info"]),
                "total": sum(len(v) for v in self.findings.values())
            }
        }

    def run_all_checks(self):
        """运行所有安全检查"""
        print("🔒 运行安全审计...")

        checks = [
            ("Secret Key", self.check_secret_key),
            ("Production Settings", self.check_production_settings),
            ("Database Security", self.check_database_security),
            ("CORS Configuration", self.check_cors_configuration),
            ("JWT Configuration", self.check_jwt_configuration),
            ("File Permissions", self.check_file_permissions),
            ("Dependencies", self.check_dependencies),
        ]

        for check_name, check_func in checks:
            print(f"  ⏳ {check_name}...")
            try:
                check_func()
            except Exception as e:
                self.findings["high"].append(f"安全检查失败 {check_name}: {str(e)}")

        print("✅ 安全检查完成")

def main():
    """主函数"""
    print("🔍 RMFOOD安全审计工具")
    print("=" * 50)

    # 检查.env文件是否存在
    env_file = Path(".env")
    if env_file.exists():
        print(f"✅ 找到 .env 文件: {env_file.absolute()}")

        # 加载.env文件
        from dotenv import load_dotenv
        load_dotenv(".env", override=False)
    else:
        print(f"⚠️  未找到 .env 文件，仅检查环境变量")

    print()

    # 运行审计
    auditor = SecurityAudit()
    auditor.run_all_checks()

    print()
    print("📋 审计结果:")
    print()

    report = auditor.generate_report()

    # 输出发现
    for severity in ["critical", "high", "medium", "low", "info"]:
        findings = auditor.findings[severity]
        if findings:
            print(f"{severity.upper()}级别问题:")
            for i, finding in enumerate(findings, 1):
                print(f"  {i}. {finding}")
            print()

    # 输出摘要
    summary = report["summary"]
    print(f"检查摘要:")
    print(f"  环境: {report['environment']}")
    print(f"  时间: {report['timestamp']}")
    print(f"  关键问题: {summary['critical']}")
    print(f"  高危险问题: {summary['high']}")
    print(f"  中危险问题: {summary['medium']}")
    print(f"  低危险问题: {summary['low']}")
    print(f"  信息级别问题: {summary['info']}")
    print(f"  总计发现: {summary['total']}")
    print()

    # 根据发现级别决定退出代码
    if summary["critical"] > 0:
        print("❌ 发现关键安全问题，请立即修复")
        return 1
    elif summary["high"] > 0:
        print("⚠️  发现高危险问题，建议修复")
        return 1
    elif summary["medium"] > 0:
        print("⚠️  发现中危险问题，建议审查")
        return 0
    else:
        print("✅ 安全检查通过")
        return 0

if __name__ == "__main__":
    sys.exit(main())