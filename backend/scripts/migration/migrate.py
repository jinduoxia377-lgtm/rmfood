#!/usr/bin/env python3
"""
RMFOOD 数据库迁移辅助脚本

提供简化的命令行接口来执行常见的数据库迁移操作。

使用方法:
    # 初始化数据库（首次部署）
    python migrate.py init
    
    # 生成新迁移（基于模型变更）
    python migrate.py generate "添加用户头像字段"
    
    # 应用所有待执行的迁移
    python migrate.py upgrade
    
    # 回滚到上一个版本
    python migrate.py downgrade
    
    # 查看当前版本
    python migrate.py status
    
    # 查看迁移历史
    python migrate.py history

作者: RMFOOD Team
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path


def run_alembic_command(args: list) -> int:
    """
    执行 Alembic 命令
    
    Args:
        args: 命令参数列表
        
    Returns:
        int: 退出码
    """
    # 确保在正确的目录中执行
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    # 构建完整命令
    cmd = ["alembic"] + args
    
    print(f"\n{'='*60}")
    print(f"📦 执行命令: {' '.join(cmd)}")
    print(f"{'='*60}\n")
    
    # 执行命令
    result = subprocess.run(cmd, cwd=backend_dir)
    
    return result.returncode


def init_database():
    """初始化数据库（执行所有迁移）"""
    print("\n🚀 正在初始化数据库...")
    return run_alembic_command(["upgrade", "head"])


def generate_migration(message: str):
    """
    生成新的迁移脚本
    
    Args:
        message: 迁移描述信息
    """
    if not message:
        print("❌ 错误：必须提供迁移描述信息")
        print("   示例: python migrate.py generate \"添加用户邮箱字段\"")
        return 1
    
    print(f"\n✨ 正在生成迁移: {message}")
    return run_alembic_command(["revision", "--autogenerate", "-m", message])


def upgrade_database():
    """升级数据库到最新版本"""
    print("\n⬆️  正在升级数据库...")
    return run_alembic_command(["upgrade", "head"])


def downgrade_database(steps: int = 1):
    """
    回滚数据库
    
    Args:
        steps: 回滚的步数（默认1步）
    """
    print(f"\n⬇️  正在回滚数据库 ({steps} 步)...")
    return run_alembic_command(["downgrade", f"-{steps}"])


def show_status():
    """显示当前数据库版本状态"""
    print("\n📊 当前数据库状态:")
    return run_alembic_command(["current"])


def show_history():
    """显示迁移历史"""
    print("\n📜 迁移历史:")
    return run_alembic_command(["history"])


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="RMFOOD 数据库迁移工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s init                    # 初始化数据库
  %(prog)s generate "添加字段"      # 生成新迁移
  %(prog)s upgrade                 # 升级到最新版本
  %(prog)s downgrade               # 回滚1个版本
  %(prog)s downgrade --steps 3     # 回滚3个版本
  %(prog)s status                  # 查看当前版本
  %(prog)s history                 # 查看迁移历史
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    # init 命令
    subparsers.add_parser("init", help="初始化数据库")
    
    # generate 命令
    gen_parser = subparsers.add_parser("generate", help="生成新迁移脚本")
    gen_parser.add_argument("message", help="迁移描述信息")
    
    # upgrade 命令
    subparsers.add_parser("upgrade", help="升级数据库")
    
    # downgrade 命令
    down_parser = subparsers.add_parser("downgrade", help="回滚数据库")
    down_parser.add_argument("--steps", type=int, default=1, help="回滚步数 (默认: 1)")
    
    # status 命令
    subparsers.add_parser("status", help="显示当前版本状态")
    
    # history 命令
    subparsers.add_parser("history", help="显示迁移历史")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 0
    
    # 执行对应命令
    commands = {
        "init": lambda: init_database(),
        "generate": lambda: generate_migration(args.message),
        "upgrade": lambda: upgrade_database(),
        "downgrade": lambda: downgrade_database(args.steps),
        "status": lambda: show_status(),
        "history": lambda: show_history(),
    }
    
    command_func = commands.get(args.command)
    if command_func:
        return command_func()
    else:
        print(f"❌ 未知命令: {args.command}")
        return 1


if __name__ == "__main__":
    sys.exit(main() or 0)