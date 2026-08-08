#!/bin/bash
# ============================================
# RMFOOD 配方平台 - 一键部署脚本
# 使用方法: ./scripts/deploy.sh
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
PROJECT_NAME="rmfood"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
BACKUP_DIR="./backups"

# 打印带颜色的消息
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查前置条件
check_prerequisites() {
    log_info "检查前置条件..."

    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi

    # 检查 Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装"
        exit 1
    fi

    # 检查 .env 文件
    if [ ! -f "$ENV_FILE" ]; then
        log_warn "$ENV_FILE 不存在，从模板复制..."
        cp .env.production.example "$ENV_FILE"
        log_warn "请编辑 $ENV_FILE 填入实际配置值"
        exit 1
    fi

    log_info "前置条件检查通过"
}

# 备份当前部署
backup_current() {
    log_info "备份当前部署..."
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)

    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        cp "$DOCKER_COMPOSE_FILE" "$BACKUP_DIR/${DOCKER_COMPOSE_FILE}.${TIMESTAMP}"
    fi

    if [ -f "$ENV_FILE" ]; then
        cp "$ENV_FILE" "$BACKUP_DIR/${ENV_FILE}.${TIMESTAMP}"
    fi

    log_info "备份完成: $BACKUP_DIR/"
}

# 停止现有服务
stop_services() {
    log_info "停止现有服务..."
    docker compose -f "$DOCKER_COMPOSE_FILE" down || true
}

# 拉取最新镜像（如果有远程镜像）
pull_images() {
    log_info "拉取最新镜像..."
    docker compose -f "$DOCKER_COMPOSE_FILE" pull || log_warn "拉取镜像失败，将继续使用本地构建"
}

# 构建并启动服务
deploy() {
    log_info "构建并启动服务..."
    docker compose -f "$DOCKER_COMPOSE_FILE" up -d --build

    log_info "等待服务启动..."
    sleep 10

    # 检查健康状态
    log_info "检查服务健康状态..."
    docker compose -f "$DOCKER_COMPOSE_FILE" ps

    # 等待后端就绪
    log_info "等待后端 API 就绪..."
    for i in {1..30}; do
        if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
            log_info "后端 API 就绪"
            break
        fi
        sleep 2
    done

    # 等待前端就绪
    log_info "等待前端就绪..."
    for i in {1..30}; do
        if curl -sf http://localhost:80/health > /dev/null 2>&1; then
            log_info "前端就绪"
            break
        fi
        sleep 2
    done
}

# 运行数据库迁移
run_migrations() {
    log_info "运行数据库迁移..."
    docker compose -f "$DOCKER_COMPOSE_FILE" exec backend python manage.py migrate || log_warn "数据库迁移跳过（可能不需要）"
}

# 收集静态文件
collect_static() {
    log_info "收集静态文件..."
    docker compose -f "$DOCKER_COMPOSE_FILE" exec backend python manage.py collectstatic --noinput || log_warn "静态文件收集跳过"
}

# 显示部署状态
show_status() {
    log_info "============================================"
    log_info "部署状态"
    log_info "============================================"
    docker compose -f "$DOCKER_COMPOSE_FILE" ps

    log_info ""
    log_info "访问地址:"
    log_info "  前端: http://localhost"
    log_info "  后端 API: http://localhost:8000"
    log_info "  API 文档: http://localhost:8000/docs"

    log_info ""
    log_info "查看日志: docker compose -f $DOCKER_COMPOSE_FILE logs -f"
    log_info "停止服务: docker compose -f $DOCKER_COMPOSE_FILE down"
    log_info "重启服务: docker compose -f $DOCKER_COMPOSE_FILE restart"
}

# 主函数
main() {
    log_info "RMFOOD 配方平台 - 一键部署"
    log_info "============================================"

    case "${1:-deploy}" in
        check)
            check_prerequisites
            ;;
        backup)
            backup_current
            ;;
        stop)
            stop_services
            ;;
        deploy)
            check_prerequisites
            backup_current
            stop_services
            pull_images
            deploy
            run_migrations
            collect_static
            show_status
            ;;
        status)
            docker compose -f "$DOCKER_COMPOSE_FILE" ps
            ;;
        logs)
            docker compose -f "$DOCKER_COMPOSE_FILE" logs -f
            ;;
        restart)
            stop_services
            deploy
            show_status
            ;;
        clean)
            log_warn "这将删除所有容器、卷和数据..."
            read -p "确定继续？(y/N): " confirm
            if [ "$confirm" = "y" ]; then
                docker compose -f "$DOCKER_COMPOSE_FILE" down -v
                docker system prune -f
            fi
            ;;
        *)
            echo "用法: $0 {check|backup|stop|deploy|status|logs|restart|clean}"
            exit 1
            ;;
    esac

    log_info "============================================"
    log_info "部署完成！"
}

# 执行主函数
main "$@"
