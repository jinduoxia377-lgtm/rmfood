#!/usr/bin/env bash
# ════════════════════════════════════════════
#  RMFOOD 数据库迁移脚本
#  支持: Alembic 迁移 + 数据种子
# ════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT/backend"

ACTION="${1:-migrate}"
DRY_RUN=false

usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  migrate          Run pending migrations"
    echo "  downgrade        Rollback last migration"
    echo "  seed             Run data seeding"
    echo "  status           Show migration status"
    echo "  audit            Run migration audit"
    echo ""
    echo "Options:"
    echo "  --dry-run        Preview changes only"
    echo "  -h, --help       Show this help"
}

case "$ACTION" in
    --help|-h) usage; exit 0 ;;
esac

if [[ "$ACTION" == "--dry-run" ]]; then
    DRY_RUN=true
    ACTION="migrate"
fi

case $ACTION in
    migrate)
        echo "═══════════════════════════════════════"
        echo "  Running Alembic migrations"
        echo "═══════════════════════════════════════"
        if [[ "$DRY_RUN" == true ]]; then
            echo "🔍 DRY RUN - would execute: alembic upgrade head"
        else
            alembic upgrade head
            echo "✅ Migrations complete"
        fi
        ;;

    downgrade)
        echo "Rolling back last migration..."
        alembic downgrade -1
        echo "✅ Downgrade complete"
        ;;

    seed)
        echo "Running data seeds..."
        python -m app.scripts.seed_data
        echo "✅ Seeding complete"
        ;;

    status)
        echo "Migration status:"
        alembic current
        echo ""
        echo "Pending revisions:"
        alembic check || echo "  (all up to date)"
        ;;

    audit)
        echo "Running migration audit..."
        python -c "from app.utils.migration_audit import main; main()"
        ;;

    *)
        echo "❌ Unknown command: $ACTION"
        usage
        exit 1
        ;;
esac

echo "═══════════════════════════════════════"
echo "  Database operation complete: $ACTION"
echo "═══════════════════════════════════════"
