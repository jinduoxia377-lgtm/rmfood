#!/bin/bash
# ============================================================
# RMFOOD 药食同源配方平台 - 一键安装部署脚本 v1.0.0
# 用法: bash install.sh
# 环境: Ubuntu 20.04/22.04/24.04 LTS, 2C4G+
# 依赖: rmfood-bundle.tar.gz（与 install.sh 同目录）
# ============================================================
set -e

RED="\033[0;31m"; GREEN="\033[0;32m"; YELLOW="\033[1;33m"; CYAN="\033[0;36m"; NC="\033[0m"
info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

PROJECT_ROOT="/opt/rmfood"
DEPLOY_DIR="${PROJECT_ROOT}/deploy"
VERSION="1.0.0"

echo ""
echo "================================================"
echo "  RMFOOD 药食同源配方平台 一键部署 v${VERSION}"
echo "  环境: Ubuntu | 2C4G+"
echo "================================================"
echo ""

# 权限检查
if [ "$EUID" -ne 0 ]; then
    error "请使用 root 用户或 sudo 运行此脚本"
fi

# 系统检查
info "检查系统环境..."
if ! command -v lsb_release &>/dev/null; then
    apt-get install -y lsb-release > /dev/null 2>&1 || true
fi
UBUNTU_VER=$(lsb_release -rs 2>/dev/null || echo "unknown")
info "操作系统: Ubuntu $UBUNTU_VER"

# 第1步: 安装 Docker
if ! command -v docker &>/dev/null; then
    info "安装 Docker..."
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    success "Docker 安装完成: $(docker --version | awk '{print $3}')"
else
    success "Docker 已安装: $(docker --version | awk '{print $3}')"
fi

if ! docker compose version &>/dev/null 2>&1; then
    error "Docker Compose V2 未找到"
fi
success "Docker Compose: $(docker compose version | awk '{print $NF}')"

# 第2步: 创建项目目录
info "创建项目目录: ${PROJECT_ROOT}"
mkdir -p "${PROJECT_ROOT}"
cd ${PROJECT_ROOT}

# 第3步: 解压源码 bundle
info "解压源代码..."
BUNDLE_PATH=""
if [ -f "$(dirname "$0")/rmfood-bundle.tar.gz" ]; then
    BUNDLE_PATH="$(dirname "$0")/rmfood-bundle.tar.gz"
elif [ -f "/opt/rmfood-bundle.tar.gz" ]; then
    BUNDLE_PATH="/opt/rmfood-bundle.tar.gz"
fi
if [ -n "$BUNDLE_PATH" ] && [ -f "$BUNDLE_PATH" ]; then
    tar -xzf "$BUNDLE_PATH"
    rm -f "$BUNDLE_PATH"
    success "源代码已解压"
else
    error "未找到 rmfood-bundle.tar.gz！请将 bundle 文件放在 install.sh 同目录下或 /opt/ 目录"
fi

# 第4步: 解压部署配置
info "解压部署配置..."
mkdir -p "${DEPLOY_DIR}/nginx" "${DEPLOY_DIR}/scripts" "${DEPLOY_DIR}/temp_files"
# 从内嵌 deploy.tar.gz 解压
python3 -c "
import base64, gzip, tarfile, io, os, sys
data = sys.stdin.buffer.read()
if not data: sys.exit(0)
buf = gzip.GzipFile(fileobj=io.BytesIO(base64.b64decode(data)))
with tarfile.open(fileobj=buf, mode='r:gz') as tf:
    for m in tf.getmembers():
        f = tf.extractfile(m)
        if f:
            out = '/opt/rmfood/deploy/' + m.name
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, 'wb') as out_f: out_f.write(f.read())
"
DEPLOY_B64='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'
echo "${DEPLOY_B64}" | python3 -c "
import base64, gzip, tarfile, io, os, sys
data = sys.stdin.buffer.read()
if not data: sys.exit(0)
buf = gzip.GzipFile(fileobj=io.BytesIO(base64.b64decode(data)))
with tarfile.open(fileobj=buf, mode='r:gz') as tf:
    for m in tf.getmembers():
        f = tf.extractfile(m)
        if f:
            out = '/opt/rmfood/deploy/' + m.name
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, 'wb') as out_f: out_f.write(f.read())
"
chmod 600 "${DEPLOY_DIR}/.env" 2>/dev/null || true
success "部署配置已就绪"

# 第5步: 防火墙
info "配置防火墙..."
if command -v ufw &>/dev/null; then
    ufw default deny incoming 2>/dev/null || true
    ufw default allow outgoing 2>/dev/null || true
    ufw allow 22/tcp comment 'SSH' 2>/dev/null || true
    ufw allow 80/tcp comment 'HTTP' 2>/dev/null || true
    ufw allow 443/tcp comment 'HTTPS' 2>/dev/null || true
    ufw --force enable 2>/dev/null || true
    success "防火墙已配置（开放 22/80/443）"
else
    warn "ufw 未安装，请手动配置防火墙"
fi

# 第6步: 构建 Docker 镜像
info "开始构建 Docker 镜像..."
info "（首次构建约需 8-15 分钟，请耐心等候）"
echo ''
cd ${PROJECT_ROOT}
COMPOSE_CMD="docker compose --env-file deploy/.env -f deploy/docker-compose.deploy.yml"

info "构建后端镜像..."
$COMPOSE_CMD build --progress=plain --target backend-runtime 2>&1 | tail -5
success "后端镜像构建完成"

info "构建前端镜像..."
$COMPOSE_CMD build --progress=plain --target frontend-runtime 2>&1 | tail -5
success "前端镜像构建完成"

# 第7步: 启动服务
info "启动所有服务..."
$COMPOSE_CMD up -d

echo ""
info "等待后端服务就绪（最多 90 秒）..."
for i in $(seq 1 18); do
    if docker ps --format '{{.Names}}' | grep -q 'rmfood_backend'; then
        if docker logs rmfood_backend 2>&1 | grep -qi "uvicorn\|application\|startup"; then
            success "后端服务已启动"
            break
        fi
    fi
    if [ $i -eq 18 ]; then warn "后端尚未完全就绪，可稍后查看日志"; fi
    sleep 5
done

# 第8步: 验证服务状态
echo ""
info "===== 服务状态 ====="
$COMPOSE_CMD ps

# 第9步: 获取公网 IP
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
echo "    重启全部:      cd ${PROJECT_ROOT} && docker compose --env-file deploy/.env -f deploy/docker-compose.deploy.yml restart"
echo "    停止服务:      cd ${PROJECT_ROOT} && docker compose --env-file deploy/.env -f deploy/docker-compose.deploy.yml down"
echo "    更新代码:      cd ${PROJECT_ROOT} && git pull && bash deploy/deploy.sh"
echo ""
echo "  配置文件: ${PROJECT_ROOT}/deploy/.env"
echo "  项目目录: ${PROJECT_ROOT}"
echo ""
echo "================================================"
echo ""
echo -e "${YELLOW}  提示：请登录后立即修改管理员密码！${NC}"
echo ''
