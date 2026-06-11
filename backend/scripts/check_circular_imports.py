#!/usr/bin/env python3
"""
循环依赖检测脚本
检测 backend/app/ 中的循环导入问题

使用方式:
    python scripts/check_circular_imports.py
"""
import ast
import os
import sys
from pathlib import Path
from collections import defaultdict


def get_imports(file_path: str) -> set[str]:
    """提取文件中的所有导入"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            tree = ast.parse(f.read())
    except (SyntaxError, UnicodeDecodeError):
        return set()

    imports = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.add(node.module.split(".")[0])
    return imports


def build_dependency_graph(app_dir: str) -> dict[str, set[str]]:
    """构建依赖图"""
    graph = defaultdict(set)

    for root, dirs, files in os.walk(app_dir):
        # 跳过 __pycache__ 和测试目录
        dirs[:] = [d for d in dirs if d != "__pycache__" and d != "tests"]

        for file in files:
            if not file.endswith(".py"):
                continue

            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, app_dir)

            # 计算模块名
            module = rel_path.replace(os.sep, ".").replace(".py", "")
            if module.endswith(".__init__"):
                module = module[:-9]

            imports = get_imports(file_path)
            for imp in imports:
                if imp.startswith("app"):
                    graph[module].add(imp)

    return graph


def find_cycles(graph: dict[str, set[str]]) -> list[list[str]]:
    """查找循环依赖"""
    cycles = []
    visited = set()
    rec_stack = set()
    path = []

    def dfs(node: str) -> bool:
        visited.add(node)
        rec_stack.add(node)
        path.append(node)

        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                if dfs(neighbor):
                    return True
            elif neighbor in rec_stack:
                # 找到循环
                cycle_start = path.index(neighbor)
                cycle = path[cycle_start:] + [neighbor]
                cycles.append(cycle)
                return True

        path.pop()
        rec_stack.discard(node)
        return False

    for node in graph:
        if node not in visited:
            dfs(node)

    return cycles


def main():
    app_dir = os.path.join(os.path.dirname(__file__), "..", "app")
    app_dir = os.path.abspath(app_dir)

    print(f"扫描目录: {app_dir}")
    print("=" * 60)

    graph = build_dependency_graph(app_dir)
    print(f"模块数量: {len(graph)}")

    cycles = find_cycles(graph)

    if cycles:
        print(f"\n[FAIL] Found {len(cycles)} circular dependencies:")
        for i, cycle in enumerate(cycles, 1):
            print(f"\n  Cycle {i}: {' -> '.join(cycle)}")
        sys.exit(1)
    else:
        print("\n[PASS] No circular dependencies found")
        sys.exit(0)


if __name__ == "__main__":
    main()
