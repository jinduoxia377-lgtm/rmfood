# 🟡 P3-1: Docker 配置 - RMFOOD 配方平台
# ===========================================

# ─── 多阶段构建：Python 后端 ───

# 阶段 1: 构建环境
FROM python:3.11-slim AS backend-builder

WORKDIR /app

# 安装构建依赖（避免缓存污染）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件并安装
COPY backend/requirements*.txt ./

# 分层缓存优化：先安装依赖（变化少）
RUN pip install --no-cache-dir --user \
    --prefix=/install \
    -r requirements.txt \
    -r requirements-core.txt \
    2>/dev/null || pip install --no-cache-dir --user \
    -r requirements.txt \
    2>/dev/null || true

# 阶段 2: 生产镜像
FROM python:3.11-slim AS backend-production

# 安全：非 root 用户
RUN groupadd --gid 1000 appgroup \
    && useradd --uid 1000 --gid appgroup --shell /bin/bash --create-home appuser

WORKDIR /app

# 安装运行时依赖（仅运行时需要的）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制已安装的包
COPY --from=backend-builder /root/.local /home/appuser/.local
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# 健康检查脚本（将在后续 P3-2 中完善）
COPY backend/docker-healthcheck.py /usr/local/bin/healthcheck.py

# 复制应用代码
COPY backend/ ./app/

# 设置权限
RUN chmod +x /usr/local/bin/healthcheck.py

# 切换到非 root 用户
USER appuser

# 端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python /usr/local/bin/healthcheck.py || exit 1

# 启动命令（使用 uvicorn，支持优雅重启）
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--timeout-keep-alive", "30"]


# ─── Node.js 前端 ───

# 阶段 1: 构建
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# 安装依赖（利用缓存）
COPY frontend/package*.json ./

RUN npm ci --prefer-offline --no-audit

# 复制源代码
COPY frontend/ ./

# 构建（生产环境）
ARG VITE_API_BASE_URL=/api
ARG VITE_APP_TITLE=RMFOOD配方平台
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_TITLE=$VITE_APP_TITLE

RUN npm run build

# 阶段 2: Nginx 服务
FROM nginx:1.25-alpine AS frontend-production

# 移除默认配置
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# 复制构建产物
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# 自定义 Nginx 配置（SPA + API 代理）
COPY frontend/docker/nginx.conf /etc/nginx/conf.d/default.conf

# 安全：非 root
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
