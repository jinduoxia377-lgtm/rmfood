"""
批量将 print() 语句替换为 logger.info/debug/warning/error 调用

策略:
1. 跳过测试文件 (test_*.py、*_test.py)
2. 跳过数据生成脚本 (generate_*.py、expand_*.py)
3. 检查文件是否已有 logger = logging.getLogger(__name__)
4. 智能判断 print 级别:
   - 包含 "error", "失败", "exception", "fail" → logger.error
   - 包含 "warning", "warn", "警告" → logger.warning
   - 包含 "debug", "调试" → logger.debug
   - 其他 → logger.info
5. 若文件缺少 logger 定义，自动在顶部插入
"""

import re
import sys
from pathlib import Path


SKIP_PATTERNS = [
    r"test_.*\.py$",
    r".*_test\.py$",
    r"generate_.*\.py$",
    r"expand_.*\.py$",
    r"merged_database\.py$",
]

LOGGER_IMPORT = "import logging\n"
LOGGER_DEF = "logger = logging.getLogger(__name__)\n"


def get_log_level(msg: str) -> str:
    lower = msg.lower()
    if any(k in lower for k in ["error", "失败", "exception", "fail", "错误", "异常"]):
        return "error"
    if any(k in lower for k in ["warning", "warn", "警告", "注意"]):
        return "warning"
    if any(k in lower for k in ["debug", "调试", "详细"]):
        return "debug"
    return "info"


def transform_print(match) -> str:
    leading = match.group(1)   # 缩进
    args = match.group(2)      # print 的参数部分
    level = get_log_level(args)
    # 将 print(a, b, c) → logger.info(f"..." ) 时尽量保留 f-string 或格式
    # 简单处理: 将多参数转为 str join，保留单参数直接用
    return f"{leading}logger.{level}({args})"


def should_skip(path: Path) -> bool:
    name = path.name
    for pat in SKIP_PATTERNS:
        if re.search(pat, name):
            return True
    return False


def ensure_logger(content: str) -> str:
    """确保文件有 logger 定义，若没有则在合适位置插入"""
    if "logger = logging.getLogger" in content:
        return content  # 已有 logger，不改动

    lines = content.splitlines(keepends=True)
    insert_idx = 0

    # 找到 import 区域末尾
    last_import = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("import ") or stripped.startswith("from "):
            last_import = i
        elif stripped and not stripped.startswith("#") and last_import > 0:
            break

    insert_idx = last_import + 1

    # 确保有 import logging
    if "import logging" not in content:
        lines.insert(insert_idx, LOGGER_IMPORT)
        insert_idx += 1
    lines.insert(insert_idx, "\n" + LOGGER_DEF)
    return "".join(lines)


def fix_file(path: Path) -> int:
    """处理单个文件，返回替换数量"""
    content = path.read_text(encoding="utf-8", errors="ignore")
    original = content

    # 匹配 print( ... ) 语句（不跨行）
    pattern = re.compile(r'^( *)print\((.+)\)\s*$', re.MULTILINE)

    new_content, count = pattern.subn(
        lambda m: transform_print(m),
        content
    )

    if count > 0:
        new_content = ensure_logger(new_content)
        path.write_text(new_content, encoding="utf-8")

    return count


def main():
    target_dirs = [
        Path("backend/app/services"),
        Path("backend/app/core"),
    ]

    total_files = 0
    total_replacements = 0
    modified_files = []

    for base_dir in target_dirs:
        if not base_dir.exists():
            print(f"目录不存在: {base_dir}")
            continue

        for py_file in sorted(base_dir.rglob("*.py")):
            if should_skip(py_file):
                continue

            count = fix_file(py_file)
            if count > 0:
                total_files += 1
                total_replacements += count
                modified_files.append((py_file, count))

    print(f"\n{'='*60}")
    print(f"print() → logger 替换完成")
    print(f"修改文件: {total_files} 个")
    print(f"替换总数: {total_replacements} 处")
    print(f"\n修改明细:")
    for f, c in sorted(modified_files, key=lambda x: x[1], reverse=True)[:20]:
        print(f"  {f.relative_to('.')} : {c} 处")
    if len(modified_files) > 20:
        print(f"  ... 及 {len(modified_files)-20} 个文件")


if __name__ == "__main__":
    main()
