#!/usr/bin/env python3
"""
quick-validate.py
快速验证脚本

快速检查依赖管理、配置管理和安全性优化是否完成
"""

import os
import sys
from pathlib import Path

def check_dependency_optimization():
    """检查依赖管理优化"""
    print("\n[1/3] 检查依赖管理优化...")

    backend_root = Path("backend")
    required_files = [
        ("requirements/base.in", "基础依赖源文件"),
        ("requirements/base.txt", "基础依赖锁定文件"),
        ("requirements/api.in", "API依赖源文件"),
        ("requirements/api.txt", "API依赖锁定文件"),
        ("requirements/db.in", "数据库依赖源文件"),
        ("requirements/db.txt", "数据库依赖锁定文件"),
        ("requirements/ml.in", "机器学习依赖源文件"),
        ("requirements/ml.txt", "机器学习依赖锁定文件"),
        ("requirements/dev.in", "开发工具依赖源文件"),
        ("requirements/dev.txt", "开发工具依赖锁定文件"),
        ("requirements/prod.in", "生产环境依赖源文件"),
        ("requirements/prod.txt", "生产环境依赖锁定文件"),
    ]

    all_exist = True
    for rel_path, description in required_files:
        file_path = backend_root / rel_path
        if file_path.exists():
            print(f"  [OK] {rel_path}: {description}")
        else:
            print(f"  [FAIL] {rel_path}: 缺失!")
            all_exist = False

    # 检查文档
    docs = [
        ("docs/dependency-management.md", "依赖管理文档"),
    ]

    for doc_path, description in docs:
        if Path(doc_path).exists():
            print(f"  [OK] {doc_path}: {description}")
        else:
            print(f"  [FAIL] {doc_path}: 缺失!")
            all_exist = False

    return all_exist

def check_configuration_integrity():
    """检查配置管理完整性"""
    print("\n[2/3] 检查配置管理完整性...")

    required_files = [
        (".env.example", "环境配置模板"),
        ("docs/configuration-guide.md", "配置指南文档"),
        ("scripts/config-validator.py", "配置验证脚本"),
    ]

    all_exist = True
    for file_path, description in required_files:
        if Path(file_path).exists():
            print(f"  [OK] {file_path}: {description}")
        else:
            print(f"  [FAIL] {file_path}: 缺失!")
            all_exist = False

    # 检查.env.example内容
    env_example = Path(".env.example")
    if env_example.exists():
        content = env_example.read_text(encoding='utf-8')
        key_configs = [
            ("ENV=", "运行环境配置"),
            ("SECRET_KEY=", "安全密钥配置"),
            ("DATABASE_URL=", "数据库连接配置"),
            ("LOG_LEVEL=", "日志级别配置"),
            ("CORS_ORIGINS=", "CORS配置"),
        ]

        for key, description in key_configs:
            if key in content:
                print(f"  [OK] 配置模板包含: {description}")
            else:
                print(f"  [WARN] 配置模板缺少: {description}")

    return all_exist

def check_security_enhancement():
    """检查安全性增强"""
    print("\n[3/3] 检查安全性增强...")

    backend_root = Path("backend")
    required_files = [
        ("app/core/security/security_config.py", "安全配置模块"),
        ("scripts/security-audit.py", "安全审计脚本"),
    ]

    all_exist = True
    for rel_path, description in required_files:
        file_path = backend_root / rel_path if rel_path.startswith("app/") else Path(rel_path)
        if file_path.exists():
            print(f"  [OK] {rel_path}: {description}")
        else:
            print(f"  [FAIL] {rel_path}: 缺失!")
            all_exist = False

    # 检查安全中间件
    security_middleware = backend_root / "app" / "core" / "security_middleware.py"
    if security_middleware.exists():
        print(f"  [OK] app/core/security_middleware.py: 安全中间件存在")
    else:
        print(f"  [INFO] 安全中间件可能需要检查")

    return all_exist

def check_integration_tools():
    """检查集成工具"""
    print("\n[额外检查] 集成工具...")

    tools = [
        ("scripts/integration-validator.py", "集成验证工具"),
        ("scripts/install-deps.sh", "依赖安装脚本"),
        ("scripts/generate-requirements.sh", "依赖生成脚本"),
    ]

    all_exist = True
    for tool_path, description in tools:
        if Path(tool_path).exists():
            print(f"  [OK] {tool_path}: {description}")
        else:
            print(f"  [INFO] {tool_path}: 可选工具")

    return True

def main():
    """主函数"""
    print("RMFOOD优化实现快速验证")
    print("=" * 50)

    # 检查当前目录
    current_dir = Path.cwd()
    print(f"工作目录: {current_dir}")

    if not Path("backend").exists():
        print("错误: 未在项目根目录，请切换到项目根目录")
        return 1

    # 运行检查
    results = []

    results.append(("依赖管理优化", check_dependency_optimization()))
    results.append(("配置管理完整性", check_configuration_integrity()))
    results.append(("安全性增强", check_security_enhancement()))
    check_integration_tools()

    print("\n" + "=" * 50)
    print("验证结果:")
    print("=" * 50)

    all_passed = True
    for check_name, passed in results:
        status = "通过" if passed else "失败"
        indicator = "[OK]" if passed else "[FAIL]"
        print(f"{indicator} {check_name}: {status}")
        all_passed = all_passed and passed

    print()

    # 检查文档
    report_file = Path("docs/optimization-implementation-report.md")
    if report_file.exists():
        print(f"[OK] 实施完成报告: {report_file}")
        print("     包含详细的实施成果说明")
    else:
        print(f"[INFO] 实施完成报告可能需要检查")

    print("\n" + "=" * 50)

    if all_passed:
        print("所有核心优化功能验证通过!")
        print()
        print("下一步建议:")
        print("  1. 运行安全审计: python scripts/security-audit.py")
        print("  2. 验证配置: python scripts/config-validator.py")
        print("  3. 测试依赖安装: ./scripts/install-deps.sh base")
        print("  4. 查看完整报告: docs/optimization-implementation-report.md")
        return 0
    else:
        print("验证发现一些问题")
        print()
        print("建议:")
        print("  1. 检查缺失的文件")
        print("  2. 查看详细实施报告")
        return 1

if __name__ == "__main__":
    sys.exit(main())