#!/usr/bin/env python3
"""带完整错误显示的导入调试包装器"""
import sys
import os
import traceback
from pathlib import Path

def setup_environment():
    """设置所有必需的环境变量，在导入任何 app 模块之前完成"""
    print("🔧 设置环境变量...")

    # SECRET_KEY - 生成如果不存在或过短
    secret_key = os.environ.get('SECRET_KEY', '')
    if not secret_key or len(secret_key) < 32:
        import secrets
        new_key = secrets.token_urlsafe(64)
        os.environ['SECRET_KEY'] = new_key
        print(f"  🔐 生成的 SECRET_KEY (长度 {len(new_key)})")
    else:
        print(f"  ✅ 现有 SECRET_KEY (长度 {len(secret_key)})")

    # 必需的环境变量
    os.environ['ENV'] = 'development'
    os.environ['DEBUG'] = 'False'
    os.environ['LOG_LEVEL'] = 'INFO'
    os.environ['ADMIN_USERNAME'] = 'admin_import'
    os.environ['ADMIN_PASSWORD'] = ''

    # DATABASE_URL
    db_url = os.environ.get('DATABASE_URL', '')
    if not db_url or not db_url.startswith('postgresql'):
        default_db = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'
        print(f"  ⚠️  使用默认 DATABASE_URL: {default_db}")
        os.environ['DATABASE_URL'] = default_db
    else:
        print(f"  ✅ DATABASE_URL: {db_url[:40]}...")

    # 添加路径到系统
    project_root = Path(__file__).parent
    sys.path.insert(0, str(project_root / 'backend'))
    sys.path.insert(0, str(project_root))

    print(f"  Python 路径项数: {len(sys.path)}")


def run_dry_run_and_test():
    """执行 Dry-run 分析和可能的测试导入"""
    from final_import_implementer import main as impl_main

    # 临时重定向 stdout 到 stderr 以保持控制台输出可见
    return impl_main()


def main():
    print("=" * 70)
    print("RMFOOD OpenFoodFacts 数据导入 - 调试包装器")
    print(f"时间: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    try:
        # Step 1: 设置环境
        setup_environment()

        # Step 2: 运行 implementer
        print("\n🔄 正在执行实施流程...")
        result = run_dry_run_and_test()

        print(f"\n✅ 实施流程完成，退出码: {result}")
        return result

    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断操作")
        return 130

    except Exception as e:
        print(f"\n❌ 严重异常: {e}")
        print("\n详细追踪信息:")
        traceback.print_exc()
        print("\n请按任意键继续...")
        input()
        return 1


if __name__ == '__main__':
    sys.exit(main())
