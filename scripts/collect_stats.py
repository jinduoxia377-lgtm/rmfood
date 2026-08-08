#!/usr/bin/env python3
"""
RMFOOD 项目数据统计脚本

自动统计项目代码量、测试覆盖率、代码质量问题，输出到控制台和手册。

用法:
    python scripts/collect_stats.py [--json]
"""

import os
import re
import sys
import json
from pathlib import Path
from datetime import datetime

# 配置
PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend" / "app"
FRONTEND_DIR = PROJECT_ROOT / "frontend" / "src"
TESTS_DIR = PROJECT_ROOT / "tests"
FRONTEND_TESTS_DIR = PROJECT_ROOT / "frontend" / "src" / "__tests__"

# 统计结果
stats = {
    "timestamp": datetime.now().isoformat(),
    "backend": {"files": 0, "lines": 0, "large_files": []},
    "frontend": {"files": 0, "lines": 0, "large_files": []},
    "tests": {"backend_files": 0, "frontend_files": 0},
    "code_quality": {
        "print_statements": 0,
        "console_log": 0,
        "as_any": 0,
        "bare_except": 0,
    },
    "git": {"commits": 0, "branches": 0},
}


def count_files_and_lines(directory, pattern="*.py"):
    """统计目录下的文件和行数"""
    file_count = 0
    line_count = 0
    large_files = []

    ext_pattern = pattern.replace("*", "")

    for file_path in directory.rglob(f"*{ext_pattern}"):
        if "__pycache__" in str(file_path):
            continue
        file_count += 1
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                lines = sum(1 for _ in f)
            line_count += lines
            if lines > 500:
                large_files.append({
                    "file": str(file_path.relative_to(PROJECT_ROOT)),
                    "lines": lines
                })
        except:
            pass

    return file_count, line_count, sorted(large_files, key=lambda x: x["lines"], reverse=True)[:10]


def count_test_files():
    """统计测试文件数量"""
    backend_tests = sum(1 for f in TESTS_DIR.rglob("test_*.py") if "__pycache__" not in str(f))
    frontend_tests = 0
    # Search in frontend/src for test files
    for ext in ["*.test.ts", "*.test.tsx", "*.spec.ts", "*.spec.tsx"]:
        frontend_tests += sum(1 for f in FRONTEND_DIR.rglob(ext) if "__pycache__" not in str(f))
    frontend_tests += sum(1 for f in FRONTEND_TESTS_DIR.rglob("*") if "__pycache__" not in str(f))
    return backend_tests, frontend_tests


def check_code_quality():
    """检查代码质量问题"""
    quality = {"print": 0, "console_log": 0, "as_any": 0, "bare_except": 0}

    # 检查后端 print()
    for file_path in BACKEND_DIR.rglob("*.py"):
        if "__pycache__" in str(file_path):
            continue
        try:
            content = file_path.read_text(encoding="utf-8")
            lines = content.split("\n")
            in_docstring = False
            for i, line in enumerate(lines):
                stripped = line.strip()
                # Track docstrings
                if '"""' in stripped or "'''" in stripped:
                    in_docstring = not in_docstring
                    continue
                if in_docstring:
                    continue
                if stripped.startswith("#") or stripped.startswith(">>>"):
                    continue
                if "logger." in line or "archived" in str(file_path):
                    continue
                if re.search(r'\bprint\s*\(', line):
                    quality["print"] += 1
        except:
            pass

    # 检查前端 console.log
    exclude_dirs = ["__tests__", "__mocks__"]
    for ext in ["*.tsx", "*.ts"]:
        for file_path in FRONTEND_DIR.rglob(ext):
            if "__pycache__" in str(file_path):
                continue
            if any(d in str(file_path) for d in exclude_dirs):
                continue
            try:
                content = file_path.read_text(encoding="utf-8")
                # Exclude logger utility files
                if "safeConsole" in str(file_path) or "logger" in str(file_path).lower():
                    continue
                quality["console_log"] += content.count("console.log")
            except:
                pass

    # 检查 as any (excluding D3/graph components)
    for ext in ["*.tsx", "*.ts"]:
        for file_path in FRONTEND_DIR.rglob(ext):
            if "__pycache__" in str(file_path):
                continue
            if any(d in str(file_path) for d in exclude_dirs):
                continue
            try:
                content = file_path.read_text(encoding="utf-8")
                # Exclude D3/graph components
                if any(x in str(file_path) for x in ["knowledge-graph", "graph_panel", "d3", "GraphEdge", "GraphVertex"]):
                    continue
                quality["as_any"] += content.count("as any")
            except:
                pass

    # 检查 bare except
    for file_path in BACKEND_DIR.rglob("*.py"):
        if "__pycache__" in str(file_path):
            continue
        try:
            content = file_path.read_text(encoding="utf-8")
            # Match bare except: or except (:
            quality["bare_except"] += len(re.findall(r'\bexcept\s*[:\(]', content))
        except:
            pass

    return quality


def get_git_stats():
    """获取 Git 统计"""
    import subprocess
    git_stats = {"commits": 0, "branches": 0}

    try:
        result = subprocess.run(
            ["git", "rev-list", "--all", "--count"],
            capture_output=True, text=True, cwd=PROJECT_ROOT
        )
        if result.returncode == 0:
            git_stats["commits"] = int(result.stdout.strip())
    except:
        pass

    try:
        result = subprocess.run(
            ["git", "branch", "-a"],
            capture_output=True, text=True, cwd=PROJECT_ROOT
        )
        if result.returncode == 0:
            git_stats["branches"] = len([l for l in result.stdout.split("\n") if l.strip()])
    except:
        pass

    return git_stats


def generate_report():
    """生成报告"""
    # 执行统计
    stats["backend"]["files"], stats["backend"]["lines"], stats["backend"]["large_files"] = \
        count_files_and_lines(BACKEND_DIR, "*.py")
    stats["frontend"]["files"], stats["frontend"]["lines"], stats["frontend"]["large_files"] = \
        count_files_and_lines(FRONTEND_DIR, "*.{tsx,ts}")
    stats["tests"]["backend_files"], stats["tests"]["frontend_files"] = count_test_files()
    stats["code_quality"] = check_code_quality()
    stats["git"] = get_git_stats()

    # 生成报告
    report = []
    report.append("=" * 60)
    report.append("  RMFOOD 项目统计报告")
    report.append(f"  生成时间: {stats['timestamp']}")
    report.append("=" * 60)
    report.append("")

    report.append("## 代码规模")
    report.append(f"  后端 Python 文件: {stats['backend']['files']} 个 ({stats['backend']['lines']:,} 行)")
    report.append(f"  前端 TSX/TS 文件: {stats['frontend']['files']} 个 ({stats['frontend']['lines']:,} 行)")
    report.append(f"  后端测试文件: {stats['tests']['backend_files']} 个")
    report.append(f"  前端测试文件: {stats['tests']['frontend_files']} 个")
    report.append("")

    report.append("## Git 统计")
    report.append(f"  总提交数: {stats['git']['commits']} 次")
    report.append(f"  分支数: {stats['git']['branches']} 个")
    report.append("")

    report.append("## 代码质量")
    report.append(f"  后端 print() 语句: {stats['code_quality']['print']} 处")
    report.append(f"  前端 console.log: {stats['code_quality']['console_log']} 处")
    report.append(f"  前端 as any: {stats['code_quality']['as_any']} 处")
    report.append(f"  后端 bare except: {stats['code_quality']['bare_except']} 处")
    report.append("")

    if stats["backend"]["large_files"]:
        report.append("## 后端大文件 Top 10 (>500行)")
        for f in stats["backend"]["large_files"]:
            report.append(f"  {f['lines']:>5} 行  {f['file']}")
        report.append("")

    if stats["frontend"]["large_files"]:
        report.append("## 前端大文件 Top 10 (>500行)")
        for f in stats["frontend"]["large_files"]:
            report.append(f"  {f['lines']:>5} 行  {f['file']}")
        report.append("")

    report.append("=" * 60)
    return "\n".join(report)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="RMFOOD 项目统计")
    parser.add_argument("--json", action="store_true", help="输出 JSON 格式")
    args = parser.parse_args()

    if args.json:
        print(json.dumps(stats, indent=2, ensure_ascii=False))
    else:
        print(generate_report())


if __name__ == "__main__":
    main()
