#!/usr/bin/env python3
"""
config-validator.py
配置验证脚本

用于验证环境配置的完整性和安全性
"""

import os
import sys
from pathlib import Path

def check_required_env_vars():
    """检查必需的环境变量"""
    required_vars = [
        "SECRET_KEY",
        "ENV",
    ]

    missing_vars = []
    warnings = []

    for var in required_vars:
        if var not in os.environ:
            missing_vars.append(var)
        elif os.environ[var] == "" or os.environ[var].startswith("your-"):
            warnings.append(f"{var} 为空或使用默认值")

    return missing_vars, warnings

def check_security_settings():
    """检查安全设置"""
    issues = []

    # 检查SECRET_KEY强度
    if "SECRET_KEY" in os.environ:
        secret_key = os.environ["SECRET_KEY"]
        if len(secret_key) < 32:
            issues.append(f"SECRET_KEY 长度不足32字符（当前: {len(secret_key)}）")
        if secret_key.startswith("your-"):
            issues.append("SECRET_KEY 使用默认值，请立即修改")

    # 检查生产环境配置
    env = os.environ.get("ENV", "development")
    if env == "production":
        if os.environ.get("DEBUG", "").lower() in ["true", "1"]:
            issues.append("生产环境 DEBUG 必须为 false")

        if not os.environ.get("DATABASE_URL") and not all([
            os.environ.get("POSTGRES_HOST"),
            os.environ.get("POSTGRES_USER"),
            os.environ.get("POSTGRES_PASSWORD"),
        ]):
            issues.append("生产环境必须配置数据库连接")

    return issues

def check_database_config():
    """检查数据库配置"""
    issues = []

    # 检查数据库连接配置
    if "DATABASE_URL" in os.environ:
        db_url = os.environ["DATABASE_URL"]
        if "postgresql" not in db_url and "sqlite" not in db_url:
            issues.append(f"不支持的数据库类型: {db_url[:30]}...")
    else:
        # 检查传统环境变量
        required_db_vars = ["POSTGRES_HOST", "POSTGRES_DB"]
        missing = [var for var in required_db_vars if var not in os.environ]
        if missing:
            issues.append(f"缺少数据库配置变量: {', '.join(missing)}")

    return issues

def generate_config_summary():
    """生成配置摘要"""
    summary = []

    env = os.environ.get("ENV", "development")
    debug = os.environ.get("DEBUG", "false")
    log_level = os.environ.get("LOG_LEVEL", "INFO")

    summary.append(f"运行环境: {env}")
    summary.append(f"调试模式: {debug}")
    summary.append(f"日志级别: {log_level}")

    # 数据库配置
    if "DATABASE_URL" in os.environ:
        summary.append("数据库: 使用DATABASE_URL")
    elif all(var in os.environ for var in ["POSTGRES_HOST", "POSTGRES_DB"]):
        summary.append(f"数据库: {os.environ.get('POSTGRES_HOST')}:{os.environ.get('POSTGRES_PORT', '5432')}/{os.environ.get('POSTGRES_DB')}")
    else:
        summary.append("数据库: 未配置")

    # Redis配置
    if "REDIS_URL" in os.environ:
        summary.append("Redis: 已配置")

    # AI服务
    if os.environ.get("AI_API_KEY"):
        summary.append("AI服务: 已配置")
    else:
        summary.append("AI服务: 未配置")

    return summary

def main():
    print("🔍 RMFOOD配置验证工具")
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

    # 检查必需的环境变量
    missing_vars, warnings = check_required_env_vars()

    if missing_vars:
        print("❌ 缺少必需的环境变量:")
        for var in missing_vars:
            print(f"  - {var}")
        print()

    if warnings:
        print("⚠️  警告:")
        for warning in warnings:
            print(f"  - {warning}")
        print()

    # 检查安全设置
    security_issues = check_security_settings()
    if security_issues:
        print("🔒 安全检查发现的问题:")
        for issue in security_issues:
            print(f"  - {issue}")
        print()

    # 检查数据库配置
    db_issues = check_database_config()
    if db_issues:
        print("🗄️ 数据库配置问题:")
        for issue in db_issues:
            print(f"  - {issue}")
        print()

    # 生成配置摘要
    summary = generate_config_summary()
    print("📋 当前配置摘要:")
    for item in summary:
        print(f"  • {item}")
    print()

    # 总体评估
    total_issues = len(missing_vars) + len(security_issues) + len(db_issues)

    if total_issues == 0:
        print("✅ 配置验证通过，所有检查正常")
        return 0
    else:
        print(f"⚠️  配置验证发现 {total_issues} 个问题")
        print("   请参考 .env.example 示例文件进行修复")
        return 1

if __name__ == "__main__":
    sys.exit(main())