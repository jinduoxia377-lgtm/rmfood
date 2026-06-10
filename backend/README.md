# RMFOOD 配方设计平台 - 后端

## 技术栈

- Python 3.12+
- FastAPI + Uvicorn (异步 Web 框架)
- SQLAlchemy 2.0 + aiosqlite (异步 ORM)
- Pydantic v2 (数据校验)
- python-jose + passlib (JWT 认证)

## 快速开始

### 1. 安装依赖

```bash
# 推荐使用 uv
pip install uv
uv pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 修改配置
```

### 3. 启动开发服务器

```bash
uvicorn app.main:app --reload --port 8000
```

### 4. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 默认管理员账号

- 用户名: admin
- 密码: admin123

## 项目结构

```
backend/
├── app/
│   ├── main.py          # 应用入口
│   ├── core/            # 核心配置 (config, database, session)
│   ├── models/          # ORM 数据模型
│   ├── schemas/         # Pydantic 请求/响应模式
│   ├── services/        # 业务逻辑层
│   └── api/             # API 路由层
├── requirements.txt     # Python 依赖
└── pyproject.toml       # 项目配置
```

## API 概览

| 模块       | 路径前缀         | 功能           |
|-----------|-----------------|---------------|
| 认证       | /api/v1/auth    | 登录/注册/令牌  |
| 用户管理   | /api/v1/users   | CRUD/角色管理   |
| 配方管理   | /api/v1/formulas| 配方全生命周期  |
| 实验管理   | /api/v1/experiments| 实验及数据    |
