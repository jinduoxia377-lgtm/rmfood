#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# RMFOOD LAN 一键部署脚本 (Bash)
# 用法: ./scripts/lan-deploy.sh {up|down|logs|status|rebuild}
# ═══════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.lan.yml"

# ─── Colors ─────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}[INFO]${NC}    $1"; }
log_ok()      { echo -e "${GREEN}[OK]${NC}      $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}    $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC}   $1"; }
log_step()    { echo -e "${CYAN}──${NC} $1"; }

# ─── Pre-flight checks ─────────────────────────
check_docker() {
    if ! command -v docker &>/dev/null; then
        log_error "Docker 未安装，请先安装 Docker Desktop"
        exit 1
    fi
    if ! docker compose version &>/dev/null; then
        log_error "Docker Compose 插件不可用"
        exit 1
    fi
}

check_env() {
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        log_error ".env 文件不存在，请从 .env.example 复制"
        exit 1
    fi

    local missing=0
    grep -q '^SECRET_KEY=' "$PROJECT_DIR/.env" || { log_error "缺少 SECRET_KEY"; missing=1; }
    grep -q '^POSTGRES_PASSWORD=' "$PROJECT_DIR/.env" || { log_error "缺少 POSTGRES_PASSWORD"; missing=1; }

    if [ $missing -eq 1 ]; then
        exit 1
    fi
}

check_compose() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "docker-compose.lan.yml 不存在于 $PROJECT_DIR"
        exit 1
    fi
}

# ─── Commands ───────────────────────────────────

cmd_up() {
    log_step "启动 RMFOOD LAN 部署"
    cd "$PROJECT_DIR"
    docker compose -f "$COMPOSE_FILE" up -d --build
    log_ok "Docker Compose 启动完成"
    wait_for_services
}

cmd_down() {
    log_step "停止 RMFOOD 所有服务"
    cd "$PROJECT_DIR"
    docker compose -f "$COMPOSE_FILE" down
    log_ok "所有服务已停止"
}

cmd_status() {
    log_step "服务状态"
    cd "$PROJECT_DIR"
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    get_access_info
}

cmd_logs() {
    cd "$PROJECT_DIR"
    docker compose -f "$COMPOSE_FILE" logs -f "$@"
}

cmd_rebuild() {
    log_step "重新构建并启动"
    cd "$PROJECT_DIR"
    docker compose -f "$COMPOSE_FILE" down
    docker compose -f "$COMPOSE_FILE" up -d --build
    log_ok "重建完成"
    wait_for_services
}

# ─── Helpers ────────────────────────────────────

wait_for_services() {
    log_step "等待服务就绪..."
    cd "$PROJECT_DIR"

    # 等待后端健康
    local backend_port
    backend_port=$(grep '^BACKEND_PORT=' "$PROJECT_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "8000")

    local max_wait=120
    local waited=0
    while [ $waited -lt $max_wait ]; do
        if curl -sf "http://localhost:$backend_port/api/v1/health" &>/dev/null; then
            log_ok "后端服务已就绪 (http://localhost:$backend_port)"
            break
        fi
        sleep 2
        waited=$((waited + 2))
        printf "\r  等待后端... %ds/%ds" "$waited" "$max_wait"
    done
    echo ""

    # 等待前端
    local frontend_port
    frontend_port=$(grep '^FRONTEND_PORT=' "$PROJECT_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "3000")

    waited=0
    while [ $waited -lt $max_wait ]; do
        if curl -sf "http://localhost:$frontend_port" &>/dev/null; then
            log_ok "前端服务已就绪 (http://localhost:$frontend_port)"
            break
        fi
        sleep 2
        waited=$((waited + 2))
        echo ""
    done

    get_access_info
}

get_access_info() {
    echo ""
    log_step "访问信息"
    echo ""

    local frontend_port
    frontend_port=$(grep '^FRONTEND_PORT=' "$PROJECT_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "3000")
    local backend_port
    backend_port=$(grep '^BACKEND_PORT=' "$PROJECT_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "8000")

    # 获取本机局域网 IP
    local ip
    ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "你的IP")

    echo -e "  ${GREEN}前端:${NC}    http://localhost:$frontend_port"
    echo -e "  ${GREEN}前端:${NC}    http://$ip:$frontend_port  (局域网访问)"
    echo -e "  ${GREEN}后端 API:${NC} http://localhost:$backend_port"
    echo -e "  ${GREEN}Swagger:${NC}  http://localhost:$backend_port/docs"
    echo ""
    echo -e "  ${YELLOW}默认管理员账号:${NC}"
    echo -e "  用户名: admin"
    echo -e "  密码:   请查看 .env 中的 ADMIN_PASSWORD (默认 admin123)"
    echo ""
}

# ─── Main ───────────────────────────────────────
main() {
    local cmd="${1:-help}"

    case "$cmd" in
        up)
            check_docker
            check_env
            check_compose
            cmd_up
            ;;
        down)
            check_docker
            cmd_down
            ;;
        status)
            check_docker
            cmd_status
            ;;
        logs)
            check_docker
            shift
            cmd_logs "$@"
            ;;
        rebuild)
            check_docker
            check_env
            check_compose
            cmd_rebuild
            ;;
        help|--help|-h)
            echo "RMFOOD LAN 一键部署脚本"
            echo ""
            echo "用法: $0 {up|down|status|logs|rebuild}"
            echo ""
            echo "  up        构建并启动所有服务"
            echo "  down      停止所有服务"
            echo "  status    查看服务状态和访问信息"
            echo "  logs      查看实时日志 (可跟服务名: ./lan-deploy.sh logs backend)"
            echo "  rebuild   重新构建并启动"
            echo "  help      显示此帮助"
            ;;
        *)
            log_error "未知命令: $cmd"
            echo "运行 '$0 help' 查看用法"
            exit 1
            ;;
    esac
}

main "$@"
