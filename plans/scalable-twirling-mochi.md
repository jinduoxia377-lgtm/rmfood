# RMFOOD 启动路径修复方案

## 问题汇总与优先级排序

| # | 问题描述 | 严重性 | 文件 |
|---|----------|--------|------|
| 1 | start_backend.py 硬编码敏感配置（DATABASE_URL, SECRET_KEY） | 🔴 CRITICAL | `backend/start_backend.py` |
| 2 | start_backend.py 使用硬编码 Windows 绝对路径 | 🟠 HIGH | `backend/start_backend.py` |
| 3 | config.py 导入级别创建 settings 单例实例 | 🟡 MEDIUM | `backend/app/core/config.py` |
| 4 session.py 模块级立即创建 engine 实例 | 🟡 MEDIUM | `backend/app/core/database/session.py` |
| 5 `_apply_env_overrides` 字符串解析 URL 脆弱 | 🟢 LOW | `backend/app/core/config.py` |
| 6 lifespan 中 init_db 阻塞启动 | 🟡 MEDIUM | `backend/app/main.py` |
| 7 生产环境降级启动不阻止应用运行 | 🟡 MEDIUM | `backend/app/main.py` |

## 修复策略

### Phase 1: 紧急修复 - 安全漏洞和跨平台问题

**目标：** 删除所有硬编码配置和硬编码路径

**修改文件：** `backend/start_backend.py`

- 删除第8-12行的硬编码环境变量设置
- 删除第15-17行的硬编码路径添加
- 简化为仅启动 uvicorn 的脚本

### Phase 2: 延迟初始化改进

**目标：** 推迟 database engine 和 settings 的创建时机

**修改文件：**
- `backend/app/core/config.py`: 移除模块级的 `settings = get_settings()` 调用，改为按需加载
- `backend/app/core/database/session.py`: 将 engine 和 session_factory 改为懒加载

### Phase 3: 健壮性提升

**目标：** 改进 URL 解析、生产环境启动策略

**修改文件：**
- `backend/app/core/config.py`: 使用 `urllib.parse` 替代字符串操作解析数据库 URL
- `backend/app/main.py`: 生产环境数据库连接失败时阻止启动

---

## 详细修改说明

### 1. start_backend.py (修复问题1 & 2)

当前内容错误：
```python
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres:password@localhost:5432/rmfood'
...
backend_dir = '/d/RMFOOD配方平台/backend'  # ❌ 硬编码路径
```

应改为：只负责启动 uvicorn，不修改任何环境变量或路径。让 Python 自动发现模块，或使用标准方法调整 sys.path。

### 2. config.py (修复问题3)

当前在模块末尾：
```python
try:
    settings = get_settings()
except ...:
    raise
```

应移除这个块，改为在使用时才调用 `get_settings()`。这样即使 .env 不存在，应用也不会立即崩溃，可以在运行时优雅处理。

### 3. session.py (修复问题4)

当前在模块级立即创建 engine 和 session_factory：
```python
engine = _create_engine()  # 👈 导入即执行
```

应改为：
```python
_engine: Optional[Engine] = None
_session_factory: Optional[AsyncSessionMaker] = None

def get_engine():
    global _engine
    if _engine is None:
        _engine = _create_engine()
    return _engine
```

### 4. main.py (修复问题6 & 7)

- `init_db()` 应异步化或移至迁移脚本
- 生产环境检测到数据库连接失败时应退出而不是继续

---

## 实施步骤

1. 先备份所有即将修改的文件
2. 依次按 Phase 1 → Phase 2 → Phase 3 顺序修改
3. 每步修改后测试启动流程
4. 运行现有测试确保不破坏功能
5. 最后验证安全问题已修复（无硬编码凭据）