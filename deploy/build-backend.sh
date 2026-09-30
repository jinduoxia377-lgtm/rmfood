#!/bin/bash
# ============================================================
# RMFOOD 后端镜像独立构建脚本
# 用途：在开发机本地构建后端镜像，推送到服务器后直接部署
# 使用方法：bash build-backend.sh
# ============================================================

set -e

IMAGE_NAME="rmfood-backend"
IMAGE_TAG="${1:-latest}"

echo "================================================"
echo "  RMFOOD 后端镜像构建"
echo "  镜像: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "================================================"
echo ""

# 检查 Docker
if ! command -v docker &>/dev/null; then
    echo "[ERROR] Docker 未安装"
    exit 1
fi

# 切换到位 项目根目录
cd "$(dirname "$0")/.."

echo "[INFO] 开始构建后端镜像..."
docker build \
    -f Dockerfile.backend-only \
    -t "${IMAGE_NAME}:${IMAGE_TAG}" \
    --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    .

echo ""
echo "[OK] 镜像构建完成: ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo "下一步："
echo "  1. 推送到镜像仓库（可选）:"
echo "     docker tag ${IMAGE_NAME}:${IMAGE_TAG} ghcr.io/yourname/${IMAGE_NAME}:${IMAGE_TAG}"
echo "     docker push ghcr.io/yourname/${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo "  2. 在服务器上部署:"
echo "     scp -r deploy/ root@YOUR_SERVER:/opt/rmfood/"
echo "     ssh root@YOUR_SERVER 'cd /opt/rmfood && bash deploy.sh'"
echo ""
