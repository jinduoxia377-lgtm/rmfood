# 🔧 RMFOOD 开发维护文档

**版本**: v1.0.0  
**更新日期**: 2026-05-18  
**适用对象**: 开发人员、运维人员

---

## 📋 目录

1. [环境准备](#环境准备)
2. [项目结构](#项目结构)
3. [本地开发](#本地开发)
4. [部署指南](#部署指南)
5. [监控告警](#监控告警)
6. [故障排查](#故障排查)
7. [代码规范](#代码规范)
8. [版本管理](#版本管理)

---

## 1️⃣ 环境准备

### 系统要求

| 组件 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 18.x | 前端开发 |
| Python | ≥ 3.11 | 后端开发 |
| PostgreSQL | ≥ 15 | 数据库 |
| Redis | ≥ 7 | 缓存（可选） |

### 工具安装

```bash
# 前端依赖
cd frontend
npm install

# 后端依赖
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

---

## 2️⃣ 项目结构

```
RMFOOD配方平台/
├── backend/                    # 后端服务
│   ├── app/                   # 应用代码
│   │   ├── api/              # API路由
│   │   ├── core/             # 核心模块
│   │   ├── models/           # 数据模型
│   │   ├── schemas/          # 数据结构
│   │   └── services/         # 业务服务
│   ├── tests/                # 测试代码
│   └── scripts/              # 脚本工具
├── frontend/                  # 前端应用
│   ├── src/                  # 源代码
│   │   ├── components/       # 组件
│   │   ├── pages/            # 页面
│   │   ├── api/              # API调用
│   │   └── stores/           # 状态管理
│   └── docs/                 # 文档
└── docs/                     # 项目文档
```

---

## 3️⃣ 本地开发

### 启动后端

```bash
cd backend

# 初始化数据库
python migrate.py init

# 启动开发服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 启动前端

```bash
cd frontend

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

### 运行测试

```bash
# 前端测试
cd frontend
npm test

# 后端测试
cd backend
pytest
```

---

## 4️⃣ 部署指南

### 开发环境

```bash
# 使用 Docker Compose
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 生产环境

```bash
# 构建镜像
docker build -t rmfood-backend ./backend
docker build -t rmfood-frontend ./frontend

# 启动容器
docker run -d -p 8000:8000 rmfood-backend
docker run -d -p 3000:3000 rmfood-frontend
```

### 环境变量配置

```env
# .env 文件示例
DEBUG=false
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://user:pass@host:5432/rmfood
REDIS_URL=redis://localhost:6379
API_KEY=your-api-key
```

---

## 5️⃣ 监控告警

### 健康检查

```bash
# 检查后端健康状态
curl http://localhost:8000/health

# 检查前端状态
curl http://localhost:3000/api/health
```

### 日志管理

```bash
# 查看后端日志
tail -f backend/logs/app.log

# 查看前端日志（浏览器控制台）
# F12 → Console
```

### 性能监控

- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3001`
- **APM**: 应用性能监控（需配置）

---

## 6️⃣ 故障排查

### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 登录失败 | 密码错误或账户锁定 | 检查密码，等待15分钟解锁 |
| 页面加载慢 | 网络延迟或缓存问题 | 刷新页面，检查网络 |
| AI生成无响应 | API密钥配置问题 | 检查.env配置 |
| 数据库连接失败 | 数据库未启动 | 启动PostgreSQL服务 |
| 前端构建失败 | 依赖问题 | 重新安装依赖 |

### 调试命令

```bash
# 检查端口占用
netstat -ano | findstr :8000

# 检查进程
ps aux | grep uvicorn

# 测试API接口
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123!"}'
```

---

## 7️⃣ 代码规范

### 前端规范

```bash
# ESLint检查
npm run lint

# 自动修复
npm run lint -- --fix

# Prettier格式化
npm run format
```

### 后端规范

```bash
# 代码检查
flake8 .

# 代码格式化
black .

# 类型检查
mypy .
```

### 提交规范

```
feat: 添加新功能
fix: 修复bug
docs: 更新文档
style: 代码格式（不影响功能）
refactor: 重构代码
test: 添加测试
chore: 构建/工具更新
```

---

## 8️⃣ 版本管理

### 版本号规则

```
v主版本号.次版本号.修订号
示例: v1.2.3
```

### 发布流程

1. 更新版本号
2. 编写CHANGELOG
3. 运行测试
4. 构建部署
5. 发布文档

---

## 📞 支持

- **技术支持**: support@rmfood.com
- **GitHub Issues**: https://github.com/your-org/rmfood-platform/issues
- **内部文档**: Confluence（内部）

---

*最后更新: 2026-05-18*