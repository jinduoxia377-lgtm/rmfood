#!/usr/bin/env bash
# ════════════════════════════════════════════
#  RMFOOD 一键部署脚本
#  支持: staging / production
# ════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 默认值
ENV="staging"
DRY_RUN=false
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --env) ENV="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        -h|--help) echo "Usage: $0 --env [staging|production] [--dry-run]"; exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# 验证环境
if [[ "$ENV" != "staging" && "$ENV" != "production" ]]; then
    echo "❌ Invalid environment: $ENV (must be staging or production)"
    exit 1
fi

# 检查 .env 文件
if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
    echo "❌ .env file not found. Copy .env.example to .env first."
    exit 1
fi

# 检查必需的环境变量
source "$PROJECT_ROOT/.env"
for var in SECRET_KEY ADMIN_PASSWORD POSTGRES_PASSWORD; do
    if [[ -z "${!var:-}" ]]; then
        echo "❌ Required env var $var is not set in .env"
        exit 1
    fi
done

echo "═══════════════════════════════════════"
echo "  RMFOOD Deploy: $ENV"
echo "═══════════════════════════════════════"

# 选择 compose 文件
if [[ "$ENV" == "production" ]]; then
    COMPOSE_FILES="-f $COMPOSE_FILE -f $PROJECT_ROOT/docker-compose.prod.yml"
else
    COMPOSE_FILES="-f $COMPOSE_FILE"
fi

# 部署命令
DEPLOY_CMD="docker compose $COMPOSE_FILES up -d --build --remove-orphans"

if [[ "$DRY_RUN" == true ]]; then
    echo "🔍 DRY RUN - would execute:"
    echo "   $DEPLOY_CMD"
    echo ""
    echo "📋 Services:"
    docker compose $COMPOSE_FILES config --services
    exit 0
fi

# 执行部署
echo "🚀 Deploying..."
cd "$PROJECT_ROOT"
$DEPLOY_CMD

# 等待健康检查
echo "⏳ Waiting for services to be healthy..."
sleep 10

# 检查服务状态
echo "📊 Service status:"
docker compose $COMPOSE_FILES ps

# 验证健康
echo ""
echo "🏥 Health check:"
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "  ✅ Backend is healthy"
else
    echo "  ⚠️  Backend health check failed (may still be starting)"
fi

if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo "  ✅ Frontend is healthy"
else
    echo "  ⚠️  Frontend health check failed (may still be starting)"
fi

echo ""
echo "═══════════════════════════════════════"
echo "  Deploy complete: $ENV"
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo "  API Docs: http://localhost:8000/docs"
echo "═══════════════════════════════════════"
