# 零售产品数据导入功能升级方案

## 一、异步导入队列（解决阻塞问题）

### 1. 技术选型：Celery + Redis

**优点**: 成熟、生态丰富、支持进度跟踪和重试  
**替代方案**: RQ (Redis Queue) - 更轻量级，但功能较少

### 2. 依赖安装

```bash
# backend/requirements.txt
celery>=5.3.0
redis>=4.6.0
rq>=2.3.0  # 备选方案
```

### 3. 核心实现文件

#### `backend/app/services/import_engine/async_worker.py`

```python
"""异步导入工作器 - Celery 任务"""
from celery import Celery
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from app.core.config import settings
from app.services.import_engine.engine import ImportEngine
from app.services.import_engine.adapters.csv_adapter import CsvAdapter
from app.services.import_engine.adapters.base import FieldMapper
from app.models.retail_product import RetailProduct
import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Celery 实例
celery_app = Celery(
    "import_worker",
    broker=settings.redis.url,
    backend=settings.redis.url,
)
celery_app.conf.task_default_queue = "import_tasks"
celery_app.conf.task_serializer = "json"


@celery_app.task(bind=True, max_retries=3, default_retry_delay=300)
async def run_import_task(self, task_id: str):
    """执行导入任务的 Celery async 任务"""
    from app.api.v1.import_router import _get_task, _save_task_to_db, _load_tasks_from_db
    
    async with settings.get_async_session() as db:
        try:
            # 获取任务信息
            task = await _get_task(task_id, db)
            
            if task["status"] not in ("uploaded", "failed"):
                raise ValueError(f"Invalid status for task {task_id}: {task['status']}")
            
            # 更新状态为 running
            task.update({"status": "running", "updated_at": datetime.now(timezone.utc).isoformat()})
            await _save_task_to_db(db, task)
            
            # 构建适配器和映射器
            file_path = Path(task["_temp_path"])
            if task["adapter_type"] == "csv":
                adapter = CsvAdapter(file_path=file_path, delimiter="auto")
            else:
                raise ValueError(f"Unsupported adapter type: {task['adapter_type']}")
            
            mapper = FieldMapper()
            # 从映射配置重建映射器（需要扩展存储格式）
            
            # 执行导入
            engine = ImportEngine(db)
            report = await engine.run(
                adapter=adapter,
                mapper=mapper,
                target_table=task["target_table"],
                id_field=task.get("id_field", "external_id"),
            )
            
            # 更新任务状态
            task.update({
                "status": report.status.value,
                "total_rows": report.stats.total_rows,
                "inserted_rows": report.stats.inserted,
                "updated_rows": report.stats.updated,
                "error_rows": report.stats.error_count,
                "progress_pct": 100.0,
                "error_summary": report.message[:2000],
            })
            await _save_task_to_db(db, task)
            
            logger.info(f"[{task_id}] 导入完成: {report.message}")
            return report.dict()
            
        except Exception as e:
            logger.exception(f"[{task_id}] 导入失败")
            # 重试逻辑
            if self.request.retries < 3:
                raise self.retry(exc=e, countdown=60)
            # 最终失败
            async with settings.get_async_session() as db:
                task = await _get_task(task_id, db)
                task.update({"status": "failed", "error_summary": str(e)[:2000]})
                await _save_task_to_db(db, task)
            raise
```

#### `backend/app/api/v1/import_router.py` 端点修改

```python
# 替换 run_import 函数为异步版本
@router.post("/{task_id}/run", summary="执行导入（异步）")
async def run_import_async(
    task_id: str,
    req: ImportRunRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """非阻塞式启动导入任务"""
    # ...权限检查...
    
    # 启动 Celery 任务
    from app.services.import_engine.async_worker import run_import_task
    celery_task = run_import_task.delay(task_id, req.target_table, req.id_field, req.mappings)
    
    return {
        "task_id": task_id,
        "celery_task_id": celery_task.id,
        "status": "queued",
        "message": "Import started asynchronously"
    }
```

### 4. 启动命令

```bash
# 终端 1: Celery worker
celery -A app.services.import_engine.async_worker worker --loglevel=info --queues=import_tasks

# 终端 2: Beat scheduler（如果需要定时导入）
celery -A app.services.import_engine.async_worker beat --loglevel=info
```

---

## 二、前端构建与静态资源（单页面应用部署）

### 1. 构建流程优化

#### `frontend/package.json` 增加构建脚本

```json
{
  "scripts": {
    "build": "react-scripts build",
    "build:prod": "CI=1 react-scripts build",
    "analyze": "webpack-bundle-analyzer dist/static/js/*.map"
  }
}
```

### 2. FastAPI 集成静态资源

#### `app/main.py` 添加静态文件挂载

```python
# 在 create_app 函数中
from pathlib import Path

BUILD_DIR = Path(__file__).parent.parent / "frontend" / "dist"

if BUILD_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(BUILD_DIR)), name="static")
    
    # 处理 SPA 路由：所有未知路径都返回 index.html
    @app.api_route(["GET", "*"], append_prefix=False)
    async def catch_all(path: str):
        """SPA 路由回退 - 将前端路由交给 React Router 处理"""
        index_html = BUILD_DIR / "index.html"
        if index_html.exists():
            return HTMLResponse(content=index_html.read_text())
        raise HTTPException(status_code=404, detail="Not found")
else:
    logger.warning("Build directory not found, serving frontend in development mode")
```

### 3. API 代理配置（开发环境）

#### `frontend/src/setupProxy.js`

```javascript
const { proxy } = require('./config');

module.exports = function(app) {
  app.use(
    '/api',
    proxy({
      target: 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
      pathRewrite: { '^/api': '' },
    })
  );
};
```

---

## 三、测试体系构建（达到 80% 覆盖率）

### 1. 依赖配置

#### `backend/requirements-dev.txt`

```txt
pytest==8.3.2
pytest-asyncly==0.23.0
coverage==7.6.1
pytest-cov==5.0.0
httpx==0.27.0
freezegun==1.2.0
pytest-mock==3.14.0
```

### 2. 测试目录结构

```
backend/tests/
├── __init__.py
├── api/
│   ├── __init__.py
│   ├── test_retail_products.py
│   └── test_import_api.py
├── services/
│   └── import_engine/
│       ├── __init__.py
│       ├── test_engine.py
│       ├── test_adapters/
│       │   ├── __init__.py
│       │   └── test_csv_adapter.py
│       └── test_mappers/
│           ├── __init__.py
│           └── test_field_mapper.py
└── conftest.py
```

### 3. 核心测试模板

#### `tests/conftest.py`

```python
"""测试 fixtures"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.main import create_app
from app.core.database.session import get_db_session
import asyncio

@pytest.fixture(scope="session")
def event_loop():
    """创建测试事件循环"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
def app():
    """FastAPI 应用实例"""
    app = create_app()
    yield app

@pytest.fixture(scope="function")
def client(app):
    """TestClient 实例"""
    yield TestClient(app)

@pytest.fixture(scope="function")
async def db_session(event_loop):
    """数据库会话 fixture - 使用 SQLite 内存数据库进行测试"""
    # 实际测试应使用真实的 PostgreSQL 数据库或 Testcontainers
    async_session_maker = sessionmaker(
        await create_async_engine("sqlite+aiosqlite:///./test.db"),
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with async_session_maker() as session:
        yield session
        await session.close()
```

#### `tests/services/import_engine/test_engine.py`

```python
"""ImportEngine 单元测试"""
import pytest
from unittest.mock import MagicMock, patch
from app.services.import_engine.engine import ImportEngine, ImportStatus
from app.services.import_engine.adapters.base import FieldMapper

class TestImportEngine:
    
    @pytest.mark.asyncio
    async def test_run_valid_data_success(self):
        """测试成功导入有效数据"""
        # Arrange
        db = MagicMock(spec=AsyncSession)
        db.execute.return_value = MagicMock()
        
        adapter = MagicMock()
        adapter.validate.return_value = (True, "Valid")
        adapter.count.return_value = 100
        adapter.iterate = MagicMock(return_value=iter([{"dummy": "data"}]))
        adapter.get_stats.return_value = {"total_rows": 100, "valid_rows": 100}
        
        mapper = MagicMock()
        mapper.map.return_value = ({}, [])
        
        # Act
        engine = ImportEngine(db)
        report = await engine.run(
            adapter=adapter,
            mapper=mapper,
            target_table="test_table",
            id_field="external_id"
        )
        
        # Assert
        assert report.status == ImportStatus.COMPLETED
        assert report.stats.inserted == 1
        assert report.duration_seconds > 0
    
    @pytest.mark.asyncio
    async def test_validation_failure(self):
        """测试验证失败的情况"""
        db = MagicMock()
        
        adapter = MagicMock()
        adapter.validate.return_value = (False, "Validation error")
        
        engine = ImportEngine(db)
        report = await engine.run(adapter=adapter, mapper=MagicMock(), target_table="test")
        
        assert report.status == ImportStatus.FAILED
        assert "Validation error" in report.message
```

### 4. 运行覆盖率报告

```bash
# 运行测试并生成覆盖率报告
pytest --cov=app --cov-report=html --cov-report=term-missing

# 查看覆盖阈值（>=80% 为目标）
coverage report --fail-under=80
```

---

## 四、环境配置标准化（消除启动障碍）

### 1. `.env.example` 文件

```ini
# =============================================
# RMFOOD 配方平台 - 环境变量配置示例
# 请将此文件复制为 .env 并根据实际环境修改
# =============================================

# --- 应用程序 ---
APP_NAME=RMFOOD Recipe Platform
APP_VERSION=1.0.0
DEBUG=True
SECRET_KEY=your-super-secret-change-in-production  # 32+ 字符
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000

# --- 数据库 ---
DATABASE_URL=postgresql+asyncpg://user:password@localhost/rmfood
# OR 使用 URL 格式: postgresql+asyncpg://username:password@host:port/database_name

# --- Redis（用于 Celery 和缓存）---
REDIS_URL=redis://:password@localhost:6379/0
CELERY_BROKER_URL=redis://:password@localhost:6379/0
CELERY_RESULT_BACKEND=redis://:password@localhost:6379/0

# --- OpenFoodFacts API ---
OFF_API_BASE_URL=https://api.openfoodfacts.org
OFF_API_TIMEOUT=30

# --- 日志 ---
LOG_LEVEL=INFO
LOG_FILE=logs/app.log
LOG_MAX_BYTES=10485760  # 10MB
LOG_BACKUP_COUNT=5

# --- 邮件通知（可选）---
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### 2. 增强版配置加载（`core/config.py`）

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List
import os

class DatabaseSettings(BaseSettings):
    url: str = "postgresql+asyncpg://user:password@localhost/dbname"
    pool_size: int = 10
    max_overflow: int = 20
    
    model_config = SettingsConfigDict(env_prefix="DB_")

class RedisSettings(BaseSettings):
    host: str = "localhost"
    port: int = 6379
    db: int = 0
    password: Optional[str] = None
    
    def url(self) -> str:
        pwd = f"{self.password}@" if self.password else ""
        return f"redis://{pwd}{self.host}:{self.port}/{self.db}"

class Settings(BaseSettings):
    debug: bool = True
    secret_key: str = "dev-secret-key"
    allowed_origins: List[str] = ["http://localhost:3000"]
    
    database: DatabaseSettings = DatabaseSettings()
    redis: RedisSettings = RedisSettings()
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding='utf-8',
        extra='ignore'  # 允许未声明的变量
    )

    def get_async_session(self):
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
        async_session_maker = async_sessionmaker(
            self.database.url, 
            expire_on_commit=False,
            class_=AsyncSession
        )
        return async_session_maker

settings = Settings()
```

---

## 五、实施路线图

| 阶段 | 任务 | 预计时间 | 负责人 | 状态 |
|------|------|----------|--------|------|
| **Phase 1: 基础加固** (本周) | 1. 添加 Redis 配置<br>2. 创建 `.env.example`<br>3. 实现 config.py 重载 | 2 天 | Backend | ⏳ |
| **Phase 2: 测试框架** (下周) | 1. 编写核心单元测试<br>2. 设置 CI 覆盖率检查<br>3. 修复测试环境问题 | 3 天 | DevOps | ⏳ |
| **Phase 3: 异步队列** (下月) | 1. Celery Worker 部署<br>2. 修改导入端点为非阻塞<br>3. 添加任务状态轮询 API | 1 周 | Backend | ⏳ |
| **Phase 4: 前端构建** (并行) | 1. 配置 production build<br>2. 添加 static mount<br>3. SPA 路由回退 | 2 天 | Frontend | ⏳ |

---

## 六、验证验收标准

完成所有升级后，系统应满足：

✅ `pytest --cov=app` 达到 ≥80% 测试覆盖率  
✅ 大 CSV 文件导入（>10k 行）不再阻塞主线程  
✅ `.env` 文件存在且包含完整配置说明  
✅ `docker-compose up` 可一键启动整个服务栈（含 DB + Redis + App）  
✅ Build 后的前端应用在 `/` 路径正常访问

方案制定完毕。您需要我先实现哪个部分？