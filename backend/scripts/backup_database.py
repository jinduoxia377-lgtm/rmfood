"""
RMFOOD PostgreSQL database backup tool.

Supports Docker and local PostgreSQL. Uses pg_dump -Fc for compressed backups.

Usage:
    python scripts/backup_database.py backup
    python scripts/backup_database.py list
    python scripts/backup_database.py restore backups/rmfood_20260610_020000.dump
    python scripts/backup_database.py cleanup

Cron (daily at 02:00):
    0 2 * * * cd /path/to/backend && python scripts/backup_database.py backup
"""
import argparse
import logging
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent
BACKUP_DIR = PROJECT_ROOT / "backups"
LOG_DIR = BACKEND_DIR / "logs"
LOG_FILE = LOG_DIR / "backup.log"

# Logging: file + stdout
LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("backup_database")

# Database config (env-overridable)
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_USER = os.getenv("POSTGRES_USER", "rmfood")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "rmfood_secret")
DB_NAME = os.getenv("POSTGRES_DB", "rmfood")
DOCKER_CONTAINER = os.getenv("POSTGRES_CONTAINER", "rmfood-postgres")

# Backup config
BACKUP_PREFIX = "rmfood"
RETENTION_DAILY = 7
RETENTION_WEEKLY = 4
RETENTION_MONTHLY = 12

# Exit codes
EXIT_SUCCESS = 0
EXIT_ERROR = 1
EXIT_FILE_NOT_FOUND = 2


def _run(cmd: list[str], check: bool = True, **kwargs) -> subprocess.CompletedProcess:
    """Run a command and return the result."""
    logger.debug("Running: %s", " ".join(cmd))
    return subprocess.run(cmd, check=check, capture_output=True, text=True, **kwargs)


# ── Mode detection ──────────────────────────────────────────────────

def is_docker_available() -> bool:
    """Return True if the PostgreSQL container is running."""
    try:
        result = _run(["docker", "ps", "--format", "{{.Names}}"], check=False)
        return DOCKER_CONTAINER in result.stdout
    except FileNotFoundError:
        return False


def is_local_pg_available() -> bool:
    """Return True if pg_dump is on PATH."""
    return shutil.which("pg_dump") is not None


def detect_mode() -> str:
    """Detect execution mode: 'docker' or 'local'. Exit if neither available."""
    if is_docker_available():
        logger.info("Docker container '%s' running -- using Docker mode", DOCKER_CONTAINER)
        return "docker"
    if is_local_pg_available():
        logger.info("pg_dump found on PATH -- using local mode")
        return "local"
    logger.error(
        "No PostgreSQL tools available. Start container '%s' or install pg_dump.",
        DOCKER_CONTAINER,
    )
    sys.exit(EXIT_ERROR)


# ── pg_dump command builder ─────────────────────────────────────────

def _pg_dump_args(mode: str, output_path: Path) -> list[str]:
    if mode == "docker":
        return [
            "docker", "exec", DOCKER_CONTAINER,
            "pg_dump", "-h", "localhost", "-U", DB_USER,
            "-d", DB_NAME, "-Fc", "-f", f"/tmp/{output_path.name}",
        ]
    return [
        "pg_dump", "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER,
        "-d", DB_NAME, "-Fc", "-f", str(output_path),
    ]


# ── Core operations ─────────────────────────────────────────────────

def backup(mode: str) -> Path:
    """Create a pg_dump -Fc backup. Returns the backup file path."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{BACKUP_PREFIX}_{timestamp}.dump"
    output_path = BACKUP_DIR / filename

    logger.info("Starting backup: %s", filename)
    env = os.environ.copy()
    env["PGPASSWORD"] = DB_PASSWORD

    try:
        _run(_pg_dump_args(mode, output_path), env=env)
    except subprocess.CalledProcessError as exc:
        logger.error("pg_dump failed (exit %s):\n%s", exc.returncode, exc.stderr)
        sys.exit(EXIT_ERROR)

    # Docker mode: copy file out of container
    if mode == "docker":
        try:
            _run(["docker", "cp", f"{DOCKER_CONTAINER}:/tmp/{filename}", str(output_path)])
            _run(["docker", "exec", DOCKER_CONTAINER, "rm", f"/tmp/{filename}"], check=False)
        except subprocess.CalledProcessError as exc:
            logger.error("Failed to copy backup from container: %s", exc.stderr)
            sys.exit(EXIT_ERROR)

    size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info("Backup created: %s (%.2f MB)", output_path, size_mb)
    verify_backup(mode, output_path)
    return output_path


def verify_backup(mode: str, backup_path: Path) -> bool:
    """Verify a backup is readable via pg_restore -l."""
    logger.info("Verifying backup: %s", backup_path.name)

    if mode == "docker":
        container_path = f"/tmp/{backup_path.name}"
        _run(["docker", "cp", str(backup_path), f"{DOCKER_CONTAINER}:{container_path}"])
        cmd = ["docker", "exec", DOCKER_CONTAINER, "pg_restore", "-l", container_path]
    else:
        cmd = ["pg_restore", "-l", str(backup_path)]

    try:
        result = _run(cmd)
        entry_count = len(result.stdout.strip().splitlines())
        logger.info("Verification passed: %d TOC entries", entry_count)
        if mode == "docker":
            _run(["docker", "exec", DOCKER_CONTAINER, "rm", container_path], check=False)
        return True
    except subprocess.CalledProcessError as exc:
        logger.error("Verification FAILED for %s: %s", backup_path.name, exc.stderr)
        if mode == "docker":
            _run(["docker", "exec", DOCKER_CONTAINER, "rm", container_path], check=False)
        return False


def restore(mode: str, backup_path: Path) -> None:
    """Restore a database from a pg_dump -Fc backup file."""
    if not backup_path.exists():
        logger.error("Backup file not found: %s", backup_path)
        sys.exit(EXIT_FILE_NOT_FOUND)

    logger.info("Restoring from: %s", backup_path.name)
    logger.info("Creating pre-restore safety backup...")
    safety_backup = backup(mode)
    logger.info("Safety backup saved: %s", safety_backup)

    env = os.environ.copy()
    env["PGPASSWORD"] = DB_PASSWORD

    if mode == "docker":
        container_path = f"/tmp/{backup_path.name}"
        _run(["docker", "cp", str(backup_path), f"{DOCKER_CONTAINER}:{container_path}"])
        cmd = [
            "docker", "exec", DOCKER_CONTAINER,
            "pg_restore", "-h", "localhost", "-U", DB_USER, "-d", DB_NAME,
            "--clean", "--if-exists", "--no-owner", "--no-privileges",
            container_path,
        ]
    else:
        cmd = [
            "pg_restore", "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME,
            "--clean", "--if-exists", "--no-owner", "--no-privileges",
            str(backup_path),
        ]

    try:
        result = _run(cmd, env=env, check=False)
        if result.returncode != 0:
            logger.warning("pg_restore warnings:\n%s", result.stderr)
        else:
            logger.info("Restore completed successfully")
    except Exception as exc:
        logger.error("Restore failed: %s", exc)
        sys.exit(EXIT_ERROR)
    finally:
        if mode == "docker":
            _run(["docker", "exec", DOCKER_CONTAINER, "rm", f"/tmp/{backup_path.name}"], check=False)


def list_backups() -> None:
    """List all backup files in the backup directory."""
    pattern = re.compile(rf"^{re.escape(BACKUP_PREFIX)}_(\d{{8}}_\d{{6}})\.dump$")
    backups: list[tuple[datetime, Path]] = []

    for f in BACKUP_DIR.iterdir():
        m = pattern.match(f.name)
        if m:
            backups.append((datetime.strptime(m.group(1), "%Y%m%d_%H%M%S"), f))

    backups.sort(key=lambda x: x[0], reverse=True)

    if not backups:
        print("No backup files found.")
        return

    print(f"\n{'='*65}")
    print(f"{'Filename':<40} {'Size':>10} {'Created':>20}")
    print(f"{'='*65}")
    for dt, path in backups:
        size_mb = path.stat().st_size / (1024 * 1024)
        print(f"{path.name:<40} {size_mb:>8.2f}MB {dt.strftime('%Y-%m-%d %H:%M:%S'):>20}")
    print(f"{'='*65}")
    print(f"Total: {len(backups)} backup(s)\n")


def cleanup() -> dict:
    """Apply retention policy: 7 daily, 4 weekly, 12 monthly."""
    pattern = re.compile(rf"^{re.escape(BACKUP_PREFIX)}_(\d{{8}}_\d{{6}})\.dump$")
    all_backups: list[tuple[datetime, Path]] = []

    for f in BACKUP_DIR.iterdir():
        m = pattern.match(f.name)
        if m:
            all_backups.append((datetime.strptime(m.group(1), "%Y%m%d_%H%M%S"), f))

    all_backups.sort(key=lambda x: x[0], reverse=True)

    if not all_backups:
        print("No backups to clean up.")
        return {"kept": 0, "removed": 0}

    now = datetime.now()
    keep: set[Path] = set()
    keep.add(all_backups[0][1])  # always keep most recent

    daily: list[tuple[datetime, Path]] = []
    weekly: list[tuple[datetime, Path]] = []
    monthly: list[tuple[datetime, Path]] = []

    for dt, path in all_backups:
        age_days = (now - dt).days
        if age_days <= RETENTION_DAILY:
            daily.append((dt, path))
        elif age_days <= RETENTION_DAILY + (RETENTION_WEEKLY * 7):
            weekly.append((dt, path))
        elif age_days <= RETENTION_DAILY + (RETENTION_WEEKLY * 7) + (RETENTION_MONTHLY * 30):
            monthly.append((dt, path))

    # Most recent backup per day (up to RETENTION_DAILY)
    seen_days: set[str] = set()
    for dt, path in daily:
        day_key = dt.strftime("%Y%m%d")
        if day_key not in seen_days and len(seen_days) < RETENTION_DAILY:
            keep.add(path)
            seen_days.add(day_key)

    # Most recent backup per ISO week (up to RETENTION_WEEKLY)
    seen_weeks: set[str] = set()
    for dt, path in weekly:
        week_key = f"{dt.isocalendar().year}-W{dt.isocalendar().week:02d}"
        if week_key not in seen_weeks and len(seen_weeks) < RETENTION_WEEKLY:
            keep.add(path)
            seen_weeks.add(week_key)

    # Most recent backup per month (up to RETENTION_MONTHLY)
    seen_months: set[str] = set()
    for dt, path in monthly:
        month_key = dt.strftime("%Y-%m")
        if month_key not in seen_months and len(seen_months) < RETENTION_MONTHLY:
            keep.add(path)
            seen_months.add(month_key)

    removed = 0
    for _, path in all_backups:
        if path not in keep:
            logger.info("Removing old backup: %s", path.name)
            path.unlink()
            removed += 1

    return {"kept": len(keep), "removed": removed}


def print_summary(operation: str, **kwargs) -> None:
    """Print a formatted summary after each operation."""
    print(f"\n{'='*50}")
    print(f"  RMFOOD Backup - {operation}")
    print(f"{'='*50}")
    for key, value in kwargs.items():
        print(f"  {key}: {value}")
    print(f"{'='*50}\n")


# ── CLI ─────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="RMFOOD PostgreSQL database backup tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("backup", help="Create a new backup")
    sub.add_parser("list", help="List existing backups")
    restore_p = sub.add_parser("restore", help="Restore from a backup file")
    restore_p.add_argument("file", type=str, help="Path to .dump backup file")
    sub.add_parser("cleanup", help="Apply retention policy and remove old backups")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "list":
        list_backups()
        return

    mode = detect_mode()

    if args.command == "backup":
        path = backup(mode)
        print_summary(
            "Backup Complete",
            File=path.name,
            Size=f"{path.stat().st_size / (1024 * 1024):.2f} MB",
            Location=str(path),
            Mode=mode,
        )
    elif args.command == "restore":
        restore_path = Path(args.file)
        restore(mode, restore_path)
        print_summary(
            "Restore Complete",
            Source=restore_path.name,
            Database=DB_NAME,
            Mode=mode,
        )
    elif args.command == "cleanup":
        result = cleanup()
        print_summary(
            "Cleanup Complete",
            Kept=result["kept"],
            Removed=result["removed"],
        )


if __name__ == "__main__":
    main()
