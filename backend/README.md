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

### 1b. RAG 精排可选依赖（Cross-Encoder reranking）

```bash
# 启用 bge-reranker-base 精排（Top-K 精度 +20-30%）。未安装时自动降级为原始 RRF 顺序，
# 不影响核心 RAG。模型约 278MB，首次需下载（HF 被墙用 hf-mirror）。
pip install -r requirements-rerank.txt
$env:HF_ENDPOINT = "https://hf-mirror.com"   # Windows PowerShell；Linux: export HF_ENDPOINT=...
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

> **请求体编码约定（UTF-8）**：所有含中文的 API 请求体须为 **UTF-8**（`charset=utf-8` + UTF-8 字节 body），否则中文可能乱码为 `????`。前端已默认 UTF-8（`fetch`/axios `JSON.stringify` + `Content-Type: application/json`，无 `charset` 覆盖为非 UTF-8；`FormData` 文件上传字段、URL 查询参数中的中文同样由浏览器/axios 按 UTF-8 编码）。⚠️ 非浏览器调用方（如 PowerShell/脚本手动拼接字符串 body）须显式按 UTF-8 编码发送（如 `[System.Text.Encoding]::UTF8`），**禁止**把中文当作 Latin-1/GBK 字节发送。

## 测试

```bash
# 推荐：剥离覆盖率参数，快速运行单个测试文件
cd backend
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'   # 本机缺少部分 pytest 插件时使用
.\venv\Scripts\python.exe -m pytest tests/api/test_formula_intelligence.py -o addopts= -p pytest_asyncio.plugin --no-header -q
```

### pytest-asyncio 关闭期告警说明

- 现象：测试全部通过后，stderr 可能出现
  `Task was destroyed but it is pending!` 与 `[conftest-clean] sweep failed: cannot schedule new futures after interpreter shutdown`。
- 原因：
  1. `pytest-asyncio` 在关闭事件循环时，若仍有未完全消费的 async 生成器/任务，会输出
     `Task was destroyed but it is pending!`（`RuntimeWarning`）。
  2. 测试用户清理器同时注册了 `atexit` 兜底；`atexit` 在解释器终结阶段触发时，
     asyncio 已不可调度新协程，导致 `sweep failed` 噪音。
- 治理：
  - `pytest.ini` 的 `filterwarnings` 已按消息过滤上述 `RuntimeWarning`。
  - `tests/conftest.py` 新增 `pytest_sessionfinish`，在会话结束（解释器仍可新建事件循环）时
    提前执行一次清理，`atexit` 仅作兜底（`_SWEPT` 标志保证只执行一次）。
- 建议版本：当前固定使用 `pytest-asyncio==1.3.0`（与 `asyncio_mode=auto` 兼容）。
  升级前请在本地验证 `tests/api/test_formula_intelligence.py` 等 async 测试无新增告警。

### 数据脚本

```bash
# 检查 FoodMaterial 安全剂量覆盖情况
$env:DATABASE_URL='postgresql+asyncpg://...'  # 或已存在于 .env
.\venv\Scripts\python.exe scripts/data/check_food_material_dosage.py --format markdown

# 预览待回填的药食同源常用原料剂量（dry-run 不写库）
.\venv\Scripts\python.exe scripts/data/seed_food_material_dosage.py --dry-run

# 实际回填（仅补缺失项，不覆盖已有值）
.\venv\Scripts\python.exe scripts/data/seed_food_material_dosage.py
```

两个脚本均支持 `--help`；`DATABASE_URL` 缺失或数据库不可用时退出码为 2。
