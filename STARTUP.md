# RMFOOD 启动指南

## 快速启动

```bash
# 启动所有服务
python start_all.py

# 仅启动后端
python start_all.py backend

# 仅启动前端
python start_all.py frontend
```

## 独立启动

### 后端
```bash
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 前端
```bash
cd frontend
npx vite --port 3000 --host 0.0.0.0
```

## 访问地址

| 服务 | 地址 |
|------|------|
| 应用 | http://localhost:3000 |
| API | http://localhost:8000/api/v1 |
| 文档 | http://localhost:8000/docs |

## 项目结构

```
RMFOODFP/
├── frontend/          # React + Vite 前端
├── backend/           # Python/FastAPI 后端
├── docs/              # 文档
├── logs/              # 日志归档
│   ├── frontend/
│   ├── backend/
│   └── temp/
├── scripts/           # 工具脚本
├── start_all.py       # 统一启动脚本
└── docker-compose.yml # Docker编排
```
