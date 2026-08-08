# RMFOOD 前端 Dockerfile - 优化版本
# 多阶段构建，只包含必要文件

# ---------- 阶段 1: 构建 ----------
FROM node:20-alpine AS builder

WORKDIR /app

# 只复制 package 文件（利用 Docker 缓存层）
COPY package.json package-lock.json ./

# 安装依赖（无 node_modules 上下文）
RUN npm ci --no-audit --no-fund 2>&1 | tail -5

# 只复制源代码
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.app.json ./
COPY .env.production ./

# 构建
ARG VITE_API_BASE_URL=/api
ARG VITE_APP_TITLE=RMFOOD配方平台
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_TITLE=$VITE_APP_TITLE
ENV NODE_ENV=production

RUN npm run build 2>&1 | tail -10

# ---------- 阶段 2: 运行时 ----------
FROM nginx:1.25-alpine

# 复制自定义 nginx 配置
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
