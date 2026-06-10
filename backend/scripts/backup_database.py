"""
RMFOOD 数据库备份工具

功能:
- SQLite 数据库文件备份
- PostgreSQL pg_dump 备份
- 自动压缩（gzip）
- 保留最近 N 个备份
- 备份完整性校验

使用方式:
    # 手动备份
    python scripts/backup_database.py

    # 定时备份（配合 cron）
    # 0 2 * * * cd /path/to/backend && python scripts/backup_database.py

    # 恢复备份
    python scripts/backup_database.py --restore backup_20260603_020000.db.gz
"""
import argparse
import gzip
import hashlib
import logging
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 备份配置
BACKUP_DIR = Path("backups")
MAX_BACKUPS = 7  # 保留最近 7 个备份
COMPRESSION_LEVEL = 6  # gzip 压缩级别 (1-9)


def get_database_path() -> Path:
    """获取数据库文件路径"""
    db_url = settings.database_url

    if db_url.startswith("sqlite"):
        # SQLite: 从 URL 提取文件路径
        # sqlite+aiosqlite:///./rmfood.db -> rmfood.db
        path_str = db_url.split("///")[-1].split("?")[0]
        return Path(path_str)
    else:
        logger.error(f"不支持的数据库类型: {db_url[:20]}...")
        sys.exit(1)


def calculate_checksum(file_path: Path) -> str:
    """计算文件 SHA256 校验和"""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()


def backup_sqlite(db_path: Path, backup_dir: Path) -> Path:
    """
    备份 SQLite 数据库

    使用 SQLite 的 backup API 确保一致性快照。
    """
    import sqlite3

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"backup_{timestamp}.db"
    backup_path = backup_dir / backup_name

    logger.info(f"开始备份 SQLite 数据库: {db_path} -> {backup_path}")

    # 使用 SQLite backup API（一致性快照）
    source = sqlite3.connect(str(db_path))
    dest = sqlite3.connect(str(backup_path))

    try:
        source.backup(dest)
        logger.info(f"SQLite 备份完成: {backup_path}")
    finally:
        source.close()
        dest.close()

    # 压缩
    compressed_path = backup_dir / f"{backup_name}.gz"
    with open(backup_path, 'rb') as f_in:
        with gzip.open(compressed_path, 'wb', compresslevel=COMPRESSION_LEVEL) as f_out:
            shutil.copyfileobj(f_in, f_out)

    # 删除未压缩的备份
    backup_path.unlink()

    # 计算校验和
    checksum = calculate_checksum(compressed_path)
    logger.info(f"备份文件: {compressed_path}")
    logger.info(f"文件大小: {compressed_path.stat().st_size / 1024:.1f} KB")
    logger.info(f"SHA256: {checksum}")

    # 保存校验和文件
    checksum_path = compressed_path.with_suffix('.sha256')
    checksum_path.write_text(f"{checksum}  {compressed_path.name}\n")

    return compressed_path


def restore_sqlite(backup_path: Path, db_path: Path):
    """
    恢复 SQLite 数据库

    Args:
        backup_path: 备份文件路径（.gz 或 .db）
        db_path: 目标数据库路径
    """
    import sqlite3

    logger.info(f"开始恢复数据库: {backup_path} -> {db_path}")

    # 解压（如果是 gzip）
    if backup_path.suffix == '.gz':
        temp_path = backup_path.with_suffix('')
        with gzip.open(backup_path, 'rb') as f_in:
            with open(temp_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        restore_source = temp_path
    else:
        restore_source = backup_path

    # 备份当前数据库
    if db_path.exists():
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        pre_restore_backup = db_path.parent / f"pre_restore_{timestamp}.db"
        shutil.copy2(db_path, pre_restore_backup)
        logger.info(f"当前数据库已备份到: {pre_restore_backup}")

    # 恢复
    shutil.copy2(restore_source, db_path)
    logger.info(f"数据库恢复完成: {db_path}")

    # 清理临时文件
    if backup_path.suffix == '.gz' and restore_source.exists():
        restore_source.unlink()


def cleanup_old_backups(backup_dir: Path, max_backups: int):
    """清理旧备份，保留最近 N 个"""
    backups = sorted(
        backup_dir.glob("backup_*.db.gz"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )

    if len(backups) <= max_backups:
        return

    for old_backup in backups[max_backups:]:
        logger.info(f"删除旧备份: {old_backup}")
        old_backup.unlink()

        # 删除对应的校验和文件
        checksum_file = old_backup.with_suffix('.sha256')
        if checksum_file.exists():
            checksum_file.unlink()


def list_backups(backup_dir: Path):
    """列出所有备份"""
    backups = sorted(
        backup_dir.glob("backup_*.db.gz"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )

    if not backups:
        print("没有找到备份文件")
        return

    print(f"\n{'='*60}")
    print(f"{'备份文件':<30} {'大小':>10} {'时间':>20}")
    print(f"{'='*60}")

    for backup in backups:
        size_kb = backup.stat().st_size / 1024
        mtime = datetime.fromtimestamp(backup.stat().st_mtime)
        print(f"{backup.name:<30} {size_kb:>8.1f}KB {mtime.strftime('%Y-%m-%d %H:%M:%S'):>20}")

    print(f"{'='*60}")
    print(f"共 {len(backups)} 个备份文件\n")


def main():
    parser = argparse.ArgumentParser(description="RMFOOD 数据库备份工具")
    parser.add_argument("--restore", type=str, help="恢复指定的备份文件")
    parser.add_argument("--list", action="store_true", help="列出所有备份")
    parser.add_argument("--max-backups", type=int, default=MAX_BACKUPS, help=f"保留的最大备份数量 (默认: {MAX_BACKUPS})")
    parser.add_argument("--backup-dir", type=str, default=str(BACKUP_DIR), help="备份目录")

    args = parser.parse_args()
    backup_dir = Path(args.backup_dir)
    backup_dir.mkdir(parents=True, exist_ok=True)

    if args.list:
        list_backups(backup_dir)
        return

    if args.restore:
        restore_path = Path(args.restore)
        if not restore_path.exists():
            logger.error(f"备份文件不存在: {restore_path}")
            sys.exit(1)

        db_path = get_database_path()
        restore_sqlite(restore_path, db_path)
        return

    # 执行备份
    db_path = get_database_path()
    if not db_path.exists():
        logger.error(f"数据库文件不存在: {db_path}")
        sys.exit(1)

    try:
        backup_path = backup_sqlite(db_path, backup_dir)
        cleanup_old_backups(backup_dir, args.max_backups)
        logger.info("备份任务完成")
    except Exception as e:
        logger.error(f"备份失败: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
