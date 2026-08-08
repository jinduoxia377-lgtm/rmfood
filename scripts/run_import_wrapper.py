#!/usr/bin/env python3
"""RMFOOD 导入启动包装器
显式设置必需环境变量后再加载配置，绕过 .env 加载的潜在路径问题
"""

import sys
import os
from pathlib import Path

# 确保项目根目录在项目路径中
PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

def setup_environment():
    """设置必需的环境变量"""
    print("🔧 配置环境...")

    # 从 backend/.env 加载
    env_file = BACKEND_DIR / ".env"
    if env_file.exists():
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    if key:
                        os.environ[key] = value
                        print(f"  📥 设置了 {key}")

    # 设置必需的默认值（如果未设置）
    defaults = {
        'ENV': 'development',
        'DEBUG': 'False',
        'LOG_LEVEL': 'INFO',
    }

    for key, default in defaults.items():
        if key not in os.environ:
            os.environ[key] = default
            print(f"  📝 设置了默认值 {key}={default}")

    # 验证 SECRET_KEY
    secret_key = os.environ.get('SECRET_KEY', '')
    if not secret_key or len(secret_key) < 32:
        import secrets
        new_key = secrets.token_urlsafe(64)
        os.environ['SECRET_KEY'] = new_key
        print(f"  🔐 生成了新的 SECRET_KEY (长度: {len(new_key)})")

    # 验证 DATABASE_URL
    db_url = os.environ.get('DATABASE_URL', '')
    if not db_url or not db_url.startswith('postgresql'):
        # 尝试从其他方式获取，或使用开发默认值
        default_db = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'
        print(f"  ⚠️  未找到有效 DATABASE_URL，使用默认值: {default_db}")
        os.environ['DATABASE_URL'] = default_db

    print("\n环境设置完成")


if __name__ == '__main__':
    setup_environment()

    # 验证配置是否能正常加载
    try:
        from app.core.config import settings
        print(f"\n✅ 配置加载成功!")
        print(f"   环境: {settings.app_env.value}")
        print(f"   SECRET_KEY 长度: {len(settings.security.secret_key)}")
        print(f"   DB URL: {settings.database.url[:60]}...")

        # 运行后续逻辑...
        if len(sys.argv) > 1 and sys.argv[1] == '--dry-run':
            print("\n🚀 进入 Dry-run 模式...")
            from scripts.import_tool import dry_run_csv
            dry_run_csv(test_limit=100)

    except Exception as e:
        print(f"\n❌ 配置加载失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
