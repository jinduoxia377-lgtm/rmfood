#!/usr/bin/env python3
"""
后端依赖安全检查脚本
用于检查后端 Python 依赖中的安全漏洞

使用方法:
    python scripts/check_dependencies.py
"""

import subprocess
import sys
import json
from pathlib import Path


def check_pip_audit():
    """使用 pip-audit 检查依赖漏洞"""
    print("🔍 正在检查后端依赖安全问题...\n")

    try:
        result = subprocess.run(
            ['pip-audit', '--format=json'],
            capture_output=True,
            text=True,
            check=False
        )

        if result.returncode == 0:
            print("✅ 未发现依赖安全漏洞！")
            return True

        # 解析 JSON 输出
        try:
            vulnerabilities = json.loads(result.stdout)

            if not vulnerabilities or 'vulnerabilities' not in vulnerabilities:
                print("✅ 未发现依赖安全漏洞！")
                return True

            vuln_list = vulnerabilities.get('vulnerabilities', [])

            if not vuln_list:
                print("✅ 未发现依赖安全漏洞！")
                return True

            print(f"⚠️  发现 {len(vuln_list)} 个安全漏洞:\n")

            for vuln in vuln_list:
                pkg_name = vuln.get('name', 'unknown')
                pkg_version = vuln.get('version', 'unknown')
                vulns = vuln.get('vulns', [])

                for v in vulns:
                    vuln_id = v.get('id', 'unknown')
                    vuln_title = v.get('title', 'No title')
                    severity = v.get('severity', 'unknown')

                    severity_emoji = {
                        'critical': '🔴',
                        'high': '🟠',
                        'medium': '🟡',
                        'low': '🔵'
                    }.get(severity.lower(), '⚪')

                    print(f"{severity_emoji} [{severity.upper()}] {pkg_name}=={pkg_version}")
                    print(f"   ID: {vuln_id}")
                    print(f"   标题: {vuln_title}\n")

            return False

        except json.JSONDecodeError:
            # 如果不是 JSON 格式，输出原始结果
            print("pip-audit 输出:")
            print(result.stdout)
            if result.stderr:
                print("错误:")
                print(result.stderr)
            return False

    except FileNotFoundError:
        print("❌ pip-audit 未安装")
        print("   请运行: pip install pip-audit")
        print("   或使用: pip install pip-tools && pip-compile")
        return None


def check_requirements():
    """检查 requirements.txt 是否存在"""
    backend_dir = Path(__file__).parent.parent
    requirements_file = backend_dir / 'requirements.txt'

    if not requirements_file.exists():
        print(f"⚠️  {requirements_file} 不存在")
        return False

    print(f"📋 发现 requirements.txt: {requirements_file}\n")
    return True


def install_pip_audit():
    """安装 pip-audit"""
    print("📦 正在安装 pip-audit...\n")

    try:
        subprocess.run(
            [sys.executable, '-m', 'pip', 'install', 'pip-audit'],
            check=True
        )
        print("✅ pip-audit 安装成功！\n")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ pip-audit 安装失败: {e}")
        return False


def main():
    """主函数"""
    print("=" * 60)
    print("🔒  RMFOOD 后端依赖安全检查")
    print("=" * 60 + "\n")

    # 先检查 requirements.txt
    check_requirements()

    # 检查 pip-audit 是否安装
    result = subprocess.run(
        ['pip-audit', '--version'],
        capture_output=True,
        text=True,
        check=False
    )

    if result.returncode != 0:
        print("⚠️  pip-audit 未安装")
        install = input("\n是否自动安装 pip-audit? (y/n): ").strip().lower()

        if install == 'y':
            if not install_pip_audit():
                print("\n❌ 无法继续检查，请手动安装 pip-audit")
                sys.exit(1)
        else:
            print("\n❌ 无法继续检查，请先安装 pip-audit")
            print("   安装命令: pip install pip-audit")
            sys.exit(1)

    # 运行检查
    print("\n" + "=" * 60)
    success = check_pip_audit()

    print("\n" + "=" * 60)
    if success:
        print("✅ 检查完成！所有依赖安全。")
    else:
        print("⚠️  检查完成！发现安全问题，请及时修复。")

    print("=" * 60)

    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
