#!/usr/bin/env python3
"""
生成安全密钥脚本
用于生成JWT密钥、API密钥等安全随机字符串
"""
import secrets
import string


def generate_secure_key(length: int = 64) -> str:
    """生成安全随机密钥"""
    alphabet = string.ascii_letters + string.digits + "-_"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_password(length: int = 16) -> str:
    """生成强随机密码"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def main():
    print("=" * 60)
    print("  RMFOOD 安全密钥生成器")
    print("=" * 60)
    print()
    
    # 生成 JWT 密钥
    jwt_key = generate_secure_key(64)
    print("✅ JWT Secret Key (64 chars):")
    print(f"   {jwt_key}")
    print()
    
    # 生成 API 密钥
    api_key = generate_secure_key(48)
    print("✅ API Key (48 chars):")
    print(f"   {api_key}")
    print()
    
    # 生成管理员密码
    admin_pass = generate_password(20)
    print("✅ Admin Password (20 chars):")
    print(f"   {admin_pass}")
    print()
    
    print("=" * 60)
    print("⚠️  请妥善保管这些密钥，不要泄露！")
    print("=" * 60)
    print()
    print("使用方法:")
    print("1. 将 JWT Secret Key 复制到 .env 文件的 SECRET_KEY")
    print("2. 将 Admin Password 复制到 .env 文件的 ADMIN_PASSWORD")
    print("3. 重启应用使配置生效")
    print()


if __name__ == "__main__":
    main()
