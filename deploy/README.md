# RMFOOD 配方平台 - 云服务器部署包
# 版本: 1.0.0
# 适用环境: Ubuntu 24.04 LTS | 2C4G 云服务器
#
# 目录结构:
#   deploy/
#   ├── deploy.sh              # 一键部署脚本
#   ├── build-backend.sh       # 后端镜像独立构建
#   ├── docker-compose.deploy.yml  # Docker Compose 配置
#   ├── Dockerfile.deploy      # 多阶段构建 Dockerfile
#   ├── .env.deploy            # 生产环境默认配置
#   ├── README-DEPLOY.md       # 完整部署文档
#   ├── .dockerignore          # Docker 构建排除规则
#   ├── nginx/
#   │   └── nginx.conf         # Nginx 反向代理配置
#   └── temp_files/            # AI 处理临时文件目录
#
# ============================================================
# 快速开始（3 步完成部署）:
# ============================================================
#
# 1. 上传部署包到服务器
#    scp -r deploy/ root@106.12.20.131:/opt/rmfood/
#
# 2. SSH 登录并执行部署
#    ssh root@106.12.20.131
#    bash /opt/rmfood/deploy/deploy.sh
#
# 3. 访问应用
#    http://106.12.20.131
#    管理员账号: admin / RmF0dPr0d2024!sec
#
