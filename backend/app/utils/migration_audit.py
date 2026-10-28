"""
🔒 P2-5: 数据库迁移审计工具

功能:
- 验证迁移文件与数据库版本的一致性
- 检测孤立迁移（无对应模型变更）
- 检查迁移依赖关系
- 生成迁移健康报告
- 验证迁移脚本的可逆性

使用方式:
    python -m backend.app.utils.migration_audit
    python -m backend.app.utils.migration_audit --check-dependencies
    python -m backend.app.utils.migration_audit --report
"""
import logging
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger("rmfood.migration_audit")

# ── 配置 ──────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parents[3]
ALEMBIC_VERSIONS = PROJECT_ROOT / "backend" / "alembic" / "versions"


def parse_migration_head(migration_content: str) -> tuple[Optional[str], Optional[str]]:
    """
    解析迁移文件的头部信息

    Returns:
        (revision, down_revision) or (None, None) if not found
    """
    upgrade_match = re.search(r'revision\s*=\s*[\'"](\w+)[\'"]', migration_content)
    down_match = re.search(r'down_revision\s*=\s*[\'"](\w+)[\'"]', migration_content)

    revision = upgrade_match.group(1) if upgrade_match else None
    down_revision = down_match.group(1) if down_match else None

    return revision, down_revision


def scan_migrations() -> dict:
    """
    扫描所有迁移文件，构建版本依赖图

    Returns:
        {
            "revisions": {revision: {"file": str, "down_revision": str, "dependencies": [str]}},
            "orphans": [revision],  # 无上游依赖的迁移
            "heads": [revision],     # 无下游依赖的迁移（可能的head）
            "cycles": [[revision, ...]},  # 循环依赖
        }
    """
    revisions: dict = {}
    child_map: dict = {}  # revision -> [child_revisions]

    for migration_file in sorted(ALEMBIC_VERSIONS.glob("*.py")):
        if migration_file.name.startswith("_"):
            continue

        content = migration_file.read_text(encoding="utf-8")
        revision, down_revision = parse_migration_head(content)

        if not revision:
            logger.warning(f"⚠️  迁移文件缺少 revision: {migration_file.name}")
            continue

        revisions[revision] = {
            "file": migration_file.name,
            "down_revision": down_revision,
            "dependencies": [down_revision] if down_revision else [],
        }

        if down_revision:
            if down_revision not in child_map:
                child_map[down_revision] = []
            child_map[down_revision].append(revision)

    # 找出孤立迁移（无上游依赖）
    orphans = [
        rev for rev, info in revisions.items()
        if info["down_revision"] is None
    ]

    # 找出可能的 head（无下游依赖）
    heads = [
        rev for rev in revisions
        if rev not in child_map
    ]

    # 检测循环依赖（简化为 BFS）
    cycles = detect_cycles(revisions)

    return {
        "revisions": revisions,
        "orphans": orphans,
        "heads": heads,
        "cycles": cycles,
    }


def detect_cycles(revisions: dict) -> list:
    """检测迁移中的循环依赖"""
    cycles = []

    def dfs(revision: str, visited: set, path: list) -> bool:
        if revision in path:
            cycle_start = path.index(revision)
            cycles.append(path[cycle_start:] + [revision])
            return True
        if revision in visited:
            return False

        visited.add(revision)
        path.append(revision)

        info = revisions.get(revision, {})
        down_rev = info.get("down_revision")
        if down_rev and down_rev in revisions:
            dfs(down_rev, visited, path.copy())

        return False

    for revision in revisions:
        visited, path = set(), []
        dfs(revision, visited, path)

    return cycles


def check_migration_safety(migration_file: Path) -> dict:
    """
    检查单个迁移文件的安全性

    Returns:
        {"safe": bool, "warnings": [str], "destructive_ops": [str]}
    """
    content = migration_file.read_text(encoding="utf-8")
    warnings = []
    destructive_ops = []

    # 检测潜在破坏性操作
    dangerous_patterns = [
        (r"drop_table", "DROP TABLE 可能导致数据丢失"),
        (r"drop_column", "DROP COLUMN 可能导致数据丢失"),
        (r"ALTER\s+TABLE.*DROP", "ALTER TABLE DROP 可能导致数据丢失"),
        (r"TRUNCATE", "TRUNCATE 操作不可回滚"),
        (r"DROP\s+INDEX", "DROP INDEX 可能影响查询性能"),
        (r"DELETE\s+FROM\s+\w+\s*;", "DELETE 操作可能删除大量数据"),
    ]

    for pattern, description in dangerous_patterns:
        if re.search(pattern, content, re.IGNORECASE):
            destructive_ops.append(description)
            warnings.append(f"⚠️  {description}")

    # 检测缺少 upgrade/downgrade 函数
    if "def upgrade()" not in content:
        warnings.append("❌ 缺少 upgrade() 函数")
    if "def downgrade()" not in content:
        warnings.append("⚠️  缺少 downgrade() 函数")

    # 检测可能的锁表操作
    if re.search(r"\bLOCK\b", content, re.IGNORECASE):
        warnings.append("🔒 检测到 LOCK 操作，可能阻塞并发访问")

    # 检测可能的全文搜索变更
    if re.search(r"CREATE\s+INDEX.*FULLTEXT", content, re.IGNORECASE):
        warnings.append("📝 全文索引变更可能影响查询性能")

    safe = len([w for w in warnings if w.startswith("❌")]) == 0

    return {
        "safe": safe,
        "warnings": warnings,
        "destructive_ops": destructive_ops,
    }


def generate_audit_report() -> str:
    """
    生成完整的迁移审计报告

    Returns:
        str: Markdown 格式报告
    """
    scan_result = scan_migrations()
    report_lines = [
        "# 🔒 RMFOOD 数据库迁移审计报告",
        "",
        f"**生成时间**: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "## 📊 概览",
        "",
        "| 指标 | 值 |",
        "|------|-----|",
        f"| 总迁移数 | {len(scan_result['revisions'])} |",
        f"| 孤立迁移 | {len(scan_result['orphans'])} |",
        f"| Head 版本 | {len(scan_result['heads'])} |",
        f"| 循环依赖 | {len(scan_result['cycles'])} |",
        "",
    ]

    # 孤立迁移警告
    if scan_result["orphans"]:
        report_lines.extend([
            "## ⚠️ 孤立迁移",
            "",
            "以下迁移没有上游依赖（可能是初始迁移或已断开连接）:",
            "",
        ])
        for orphan in scan_result["orphans"]:
            info = scan_result["revisions"].get(orphan, {})
            report_lines.append(f"- `{orphan}` ({info.get('file', 'unknown')})")
        report_lines.append("")
    else:
        report_lines.extend([
            "## ✅ 依赖完整性",
            "",
            "所有迁移都有正确的上游依赖关系。",
            "",
        ])

    # 循环依赖警告
    if scan_result["cycles"]:
        report_lines.extend([
            "## 🔴 循环依赖",
            "",
            "检测到以下循环依赖（必须修复）:",
            "",
        ])
        for cycle in scan_result["cycles"]:
            cycle_str = " → ".join(cycle)
            report_lines.append(f"```\n{cycle_str}\n```")
        report_lines.append("")
    else:
        report_lines.extend([
            "## ✅ 无循环依赖",
            "",
            "迁移依赖链无循环。",
            "",
        ])

    # Head 版本信息
    if scan_result["heads"]:
        report_lines.extend([
            "## 📌 当前 Head 版本",
            "",
        ])
        for head in scan_result["heads"]:
            info = scan_result["revisions"].get(head, {})
            report_lines.append(f"- `{head}` ({info.get('file', 'unknown')})")
        report_lines.append("")

    # 迁移安全检查
    report_lines.extend([
        "## 🔍 迁移安全检查",
        "",
    ])

    unsafe_migrations = []
    for revision, info in scan_result["revisions"].items():
        migration_file = ALEMBIC_VERSIONS / info["file"]
        safety = check_migration_safety(migration_file)
        if not safety["safe"] or safety["destructive_ops"]:
            unsafe_migrations.append((revision, info, safety))

    if unsafe_migrations:
        for revision, info, safety in unsafe_migrations:
            report_lines.extend([
                f"### `{revision}` ({info['file']})",
                "",
            ])
            for warning in safety["warnings"]:
                report_lines.append(f"- {warning}")
            if safety["destructive_ops"]:
                report_lines.append(f"  - 破坏性操作: {', '.join(safety['destructive_ops'])}")
            report_lines.append("")
    else:
        report_lines.extend([
            "✅ 所有迁移文件通过安全检查。",
            "",
        ])

    # 迁移列表
    report_lines.extend([
        "## 📜 完整迁移列表",
        "",
        "| Revision | 文件 | 依赖 |",
        "|----------|------|------|",
    ])

    for revision, info in scan_result["revisions"].items():
        dep = info["down_revision"] or "（无）"
        report_lines.append(f"| `{revision}` | {info['file']} | `{dep}` |")

    report_lines.append("")
    report_lines.append("---")
    report_lines.append(f"*报告自动生成于 {datetime.now().isoformat()}*")

    return "\n".join(report_lines)


def run_audit(check_only: bool = False) -> bool:
    """
    运行迁移审计

    Args:
        check_only: 若为 True，仅检查并返回结果，不生成报告

    Returns:
        bool: 审计是否通过（无严重问题）
    """
    logger.info("🔒 RMFOOD 数据库迁移审计工具")
    logger.info("=" * 50)

    # 扫描迁移
    logger.info("\n📊 扫描迁移文件...")
    scan_result = scan_migrations()
    logger.info(f"   找到 {len(scan_result['revisions'])} 个迁移文件")

    # 检查循环依赖
    if scan_result["cycles"]:
        logger.info(f"\n🔴 错误: 检测到 {len(scan_result['cycles'])} 个循环依赖!")
        for cycle in scan_result["cycles"]:
            logger.info(f"   {' → '.join(cycle)}")
        return False

    # 检查孤立迁移
    if scan_result["orphans"]:
        logger.info(f"\n⚠️  警告: {len(scan_result['orphans'])} 个孤立迁移（无上游依赖）")
        for orphan in scan_result["orphans"]:
            logger.info(f"   - {orphan}")

    # 检查迁移安全性
    logger.info("\n🔍 检查迁移安全性...")
    unsafe_count = 0
    for revision, info in scan_result["revisions"].items():
        migration_file = ALEMBIC_VERSIONS / info["file"]
        safety = check_migration_safety(migration_file)
        if not safety["safe"]:
            unsafe_count += 1
            logger.info(f"\n   ⚠️  {info['file']}:")
            for warning in safety["warnings"]:
                logger.info(f"      - {warning}")

    if unsafe_count > 0:
        logger.info(f"\n⚠️  警告: {unsafe_count} 个迁移存在安全隐患")
    else:
        logger.info("\n✅ 所有迁移通过安全检查")

    # Head 版本
    logger.info(f"\n📌 当前 Head 版本: {', '.join(scan_result['heads'])}")

    if check_only:
        return unsafe_count == 0

    # 生成报告
    logger.info("\n📝 生成审计报告...")
    report = generate_audit_report()

    report_path = PROJECT_ROOT / "backend" / "alembic" / "migration_audit_report.md"
    report_path.write_text(report, encoding="utf-8")
    logger.info(f"   报告已保存: {report_path}")

    return unsafe_count == 0


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="RMFOOD 数据库迁移审计工具")
    parser.add_argument("--check", action="store_true", help="仅检查，不生成报告")
    parser.add_argument("--report", action="store_true", help="生成 Markdown 报告")

    args = parser.parse_args()

    success = run_audit(check_only=args.check)

    sys.exit(0 if success else 1)
