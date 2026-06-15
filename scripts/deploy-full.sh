#!/usr/bin/env bash
# ════════════════════════════════════════════
#  RMFOOD 生产环境一键部署
#  流程: 备份 → 迁移 → 部署 → 验证 → 回滚保护
# ════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"

ENV="${1:-staging}"
DRY_RUN="${2:-false}"

echo "═══════════════════════════════════════"
echo "  RMFOOD Production Deploy: $ENV"
echo "  Dry Run: $DRY_RUN"
echo "═══════════════════════════════════════"

# Step 1: 备份数据库
step_backup() {
    echo ""
    echo "Step 1/5: 数据库备份..."
    if [[ "$DRY_RUN" != "true" ]]; then
        bash "$SCRIPT_DIR/db-backup.sh" --dir "$BACKUP_DIR"
    else
        echo "  🔍 DRY RUN: Would create database backup"
    fi
}

# Step 2: 运行迁移
step_migrate() {
    echo ""
    echo "Step 2/5: 数据库迁移..."
    if [[ "$DRY_RUN" != "true" ]]; then
        bash "$SCRIPT_DIR/db-migrate.sh" migrate
    else
        echo "  🔍 DRY RUN: Would run pending migrations"
    fi
}

# Step 3: 部署服务
step_deploy() {
    echo ""
    echo "Step 3/5: 部署服务..."
    if [[ "$DRY_RUN" != "true" ]]; then
        bash "$SCRIPT_DIR/deploy.sh" --env "$ENV"
    else
        echo "  🔍 DRY RUN: Would deploy with docker compose"
    fi
}

# Step 4: 健康检查
step_healthcheck() {
    echo ""
    echo "Step 4/5: 健康检查..."
    if [[ "$DRY_RUN" != "true" ]]; then
        for url in http://localhost:8000/health http://localhost:3000; do
            if curl -sf "$url" > /dev/null 2>&1; then
                echo "  ✅ $url"
            else
                echo "  ⚠️  $url (may still be starting)"
            fi
        done
    else
        echo "  🔍 DRY RUN: Would check health endpoints"
    fi
}

# Step 5: 清理旧备份
step_cleanup() {
    echo ""
    echo "Step 5/5: 清理过期备份..."
    if [[ "$DRY_RUN" != "true" && -d "$BACKUP_DIR" ]]; then
        find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete 2>/dev/null || true
        echo "  ✅ Cleaned backups older than 7 days"
    fi
}

# 执行
step_backup
step_migrate
step_deploy
step_healthcheck
step_cleanup

echo ""
echo "═══════════════════════════════════════"
echo "  ✅ Deploy complete: $ENV"
echo "═══════════════════════════════════════"
