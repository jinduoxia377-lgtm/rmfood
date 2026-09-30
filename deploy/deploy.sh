#!/bin/bash
# ============================================================
# RMFOOD 一键部署脚本
# 适用环境: Ubuntu 24.04 LTS, 2C4G 云服务器
# 使用方法: bash deploy.sh
# ============================================================

set -e

# ===== 颜色定义 =====
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ===== 路径配置 =====
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="/opt/rmfood"
DEPLOY_SRC="${SCRIPT_DIR}"

echo ""
echo "================================================"
echo "  RMFOOD 配方平台 - 一键部署"
echo "  环境: Ubuntu 24.04 LTS | 2C4G 云服务器"
echo "================================================"
echo ""

# ===== 第 1 步：检查权限 =====
if [ "$EUID" -ne 0 ]; then
    error "请使用 root 用户或 sudo 运行此脚本"
fi

# ===== 第 2 步：检查 Docker =====
if ! command -v docker &>/dev/null; then
    info "Docker 未安装，开始安装..."
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
        gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    success "Docker 安装完成"
else
    success "Docker 已安装: $(docker --version | awk '{print $3}')"
fi

if ! docker compose version &>/dev/null 2>&1; then
    error "Docker Compose V2 未找到，请检查安装"
fi
success "Docker Compose: $(docker compose version | awk '{print $NF}')"

# ===== 第 3 步：创建项目目录 =====
info "准备项目目录: ${PROJECT_ROOT}"
mkdir -p ${PROJECT_ROOT}
cd ${PROJECT_ROOT}

# ===== 第 4 步：复制部署文件 =====
info "复制部署文件..."
mkdir -p "${PROJECT_ROOT}/deploy"
cp "${DEPLOY_SRC}/docker-compose.deploy.yml" "${PROJECT_ROOT}/deploy/docker-compose.deploy.yml"
cp "${DEPLOY_SRC}/.env.deploy"              "${PROJECT_ROOT}/deploy/.env"
cp "${DEPLOY_SRC}/Dockerfile.deploy"        "${PROJECT_ROOT}/deploy/Dockerfile.deploy"
mkdir -p "${PROJECT_ROOT}/deploy/nginx"
mkdir -p "${PROJECT_ROOT}/deploy/scripts"
mkdir -p "${PROJECT_ROOT}/deploy/temp_files"
cp "${DEPLOY_SRC}/nginx/nginx.conf"        "${PROJECT_ROOT}/deploy/nginx/nginx.conf"
cp "${DEPLOY_SRC}/scripts/start.sh"       "${PROJECT_ROOT}/deploy/scripts/start.sh"

# 确保 .env 文件权限安全
chmod 600 "${PROJECT_ROOT}/deploy/.env"
success "部署文件已就绪"

# ===== 第 5 步：安全加固 - 防火墙 =====
info "配置防火墙..."
if command -v ufw &>/dev/null; then
    ufw default deny incoming 2>/dev/null || true
    ufw default allow outgoing 2>/dev/null || true
    ufw allow 22/tcp   comment 'SSH'    2>/dev/null || true
    ufw allow 80/tcp   comment 'HTTP'   2>/dev/null || true
    ufw allow 443/tcp  comment 'HTTPS'  2>/dev/null || true
    ufw --force enable 2>/dev/null || true
    success "防火墙已配置（开放 22/80/443）"
else
    warn "ufw 未安装，请手动配置防火墙"
fi

# ===== 第 6 步：构建 Docker 镜像 =====
info "开始构建 Docker 镜像..."
info "（首次构建约需 5-10 分钟，请耐心等候）"
echo ""

cd ${PROJECT_ROOT}
COMPOSE_CMD="docker compose --env-file deploy/.env -f deploy/docker-compose.deploy.yml"
$COMPOSE_CMD build --progress=plain 2>&1 | \
    tail -15

success "镜像构建完成"

# ===== 第 7 步：启动服务 =====
info "启动所有服务..."
docker compose --env-file deploy/.env -f deploy/docker-compose.deploy.yml up -d

# 等待服务启动
echo ""
info "等待后端服务就绪（最多 90 秒）..."
for i in $(seq 1 18); do
    if docker ps --format '{{.Names}}' | grep -q "rmfood_backend"; then
        if docker logs rmfood_backend 2>&1 | grep -qi "uvicorn\|application\|startup"; then
            success "后端服务已启动"
            break
        fi
    fi
    if [ $i -eq 18 ]; then
        warn "后端尚未完全就绪，可稍后查看日志"
    fi
    sleep 5
done

# ===== 第 8 步：验证服务状态 =====
echo ""
info "===== 服务状态 ====="
docker compose --env-file deploy/.env -f deploy/docker-compose.deploy.yml ps

# ===== 第 9 步：获取公网 IP =====
PUBLIC_IP=$(curl -s --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || \
            curl -s --max-time 5 https://api.ipify.org 2>/dev/null || \
            hostname -I | awk '{print $1}')

echo ""
echo "================================================"
echo -e "${GREEN}  部署成功！${NC}"
echo "================================================"
echo ""
echo "  访问地址: http://${PUBLIC_IP}"
echo "  API 文档: http://${PUBLIC_IP}/docs"
echo "  后台管理: http://${PUBLIC_IP}/admin"
echo ""
echo "  默认管理员:"
echo "    用户名: admin"
echo "    密码:   RmF0dPr0d2024!sec"
echo ""
echo "  常用命令:"
echo "    查看日志:      docker logs -f rmfood_backend"
echo "    重启全部:      docker compose -f deploy/docker-compose.deploy.yml restart"
echo "    停止服务:      docker compose -f deploy/docker-compose.deploy.yml down"
echo "    更新代码:      cd ${PROJECT_ROOT} && git pull && bash deploy/deploy.sh"
echo ""
echo "  配置文件: ${PROJECT_ROOT}/deploy/.env"
echo "  项目目录: ${PROJECT_ROOT}"
echo ""
echo "================================================"
echo ""
echo -e "${YELLOW}  提示：请登录后立即修改管理员密码！${NC}"
echo ""
