#!/usr/bin/env bash
# ════════════════════════════════════════════
#  RMFOOD 数据库备份脚本
#  支持: 本地 PostgreSQL / Docker PostgreSQL
# ════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 默认值
BACKUP_DIR="$PROJECT_ROOT/backups"
RETENTION_DAYS=7
CONTAINER_NAME="rmfood-postgres"
DRY_RUN=false

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --dir) BACKUP_DIR="$2"; shift 2 ;;
        --retention) RETENTION_DAYS="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        -h|--help) echo "Usage: $0 [--dir PATH] [--retention DAYS] [--dry-run]"; exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/rmfood_${TIMESTAMP}.sql.gz"

echo "═══════════════════════════════════════"
echo "  RMFOOD Database Backup"
echo "═══════════════════════════════════════"

if [[ "$DRY_RUN" == true ]]; then
    echo "🔍 DRY RUN - would create backup:"
    echo "   $BACKUP_FILE"
    echo "   Retention: $RETENTION_DAYS days"
    exit 0
fi

# 检查容器是否运行
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "📦 Backing up from Docker container: $CONTAINER_NAME"
    docker exec "$CONTAINER_NAME" pg_dump -U rmfood -d rmfood --no-owner --no-acl | gzip > "$BACKUP_FILE"
else
    echo "📦 Backup via local pg_dump"
    source "$PROJECT_ROOT/.env" 2>/dev/null || true
    pg_dump "${DATABASE_URL:-postgresql://rmfood@localhost:5432/rmfood}" --no-owner --no-acl | gzip > "$BACKUP_FILE"
fi

# 检查备份文件
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# 清理旧备份
echo "🧹 Cleaning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "rmfood_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
REMAINING=$(find "$BACKUP_DIR" -name "rmfood_*.sql.gz" | wc -l)
echo "   Remaining backups: $REMAINING"

echo ""
echo "═══════════════════════════════════════"
echo "  Backup complete"
echo "═══════════════════════════════════════"
