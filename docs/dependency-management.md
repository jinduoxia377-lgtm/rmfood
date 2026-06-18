# RMFOOD 依赖管理优化

## 新的依赖管理结构

我们已从单个`requirements.txt`文件迁移到分层结构的依赖管理系统：

```
backend/
├── pyproject.toml              # 主项目配置
├── requirements/               # 新的依赖管理目录
│   ├── base.in                # 基础依赖源文件
│   ├── base.txt               # 基础依赖锁定版本
│   ├── api.in                 # API相关依赖源文件
│   ├── api.txt                # API相关依赖锁定版本
│   ├── db.in                  # 数据库相关依赖源文件
│   ├── db.txt                 # 数据库相关依赖锁定版本
│   ├── ml.in                  # 机器学习相关依赖源文件
│   ├── ml.txt                 # 机器学习相关依赖锁定版本
│   ├── dev.in                 # 开发工具依赖源文件
│   ├── dev.txt                # 开发工具依赖锁定版本
│   ├── prod.in                # 生产环境依赖源文件
│   └── prod.txt               # 生产环境依赖锁定版本
├── requirements.txt           # 与prod.txt相同的完整依赖列表
└── scripts/
    └── generate-requirements.sh  # 生成锁定文件的脚本
```

## 依赖组说明

### 1. 基础依赖 (base)
- **目的**: 所有环境的核心依赖
- **包含**: FastAPI, Pydantic, HTTP工具
- **使用**: `pip install -r requirements/base.txt`

### 2. API相关依赖 (api)
- **目的**: Web API开发相关
- **包含**: 认证、安全、JWT
- **依赖**: 包含基础依赖
- **使用**: `pip install -r requirements/api.txt`

### 3. 数据库相关依赖 (db)
- **目的**: 数据库操作和迁移
- **包含**: SQLAlchemy, Alembic, 数据库驱动
- **依赖**: 包含基础依赖
- **使用**: `pip install -r requirements/db.txt`

### 4. 机器学习相关依赖 (ml)
- **目的**: 机器学习和科学计算
- **包含**: NumPy, SciPy, ChromaDB, 文档导出
- **依赖**: 包含基础依赖
- **使用**: `pip install -r requirements/ml.txt`

### 5. 开发工具依赖 (dev)
- **目的**: 开发和测试环境
- **包含**: 测试框架, 代码质量工具, 覆盖率工具
- **依赖**: 包含基础依赖
- **使用**: `pip install -r requirements/dev.txt`

### 6. 生产环境依赖 (prod)
- **目的**: 生产部署
- **包含**: 所有功能依赖 + 监控 + 安全工具
- **依赖**: 包含所有其他依赖组
- **使用**: `pip install -r requirements/prod.txt`

## 使用方法

### 安装生产依赖:
```bash
pip install -r requirements/prod.txt
```

### 安装开发依赖:
```bash
pip install -r requirements/dev.txt
```

### 只安装数据库相关功能:
```bash
pip install -r requirements/db.txt
```

### 生成锁定文件 (需要pip-tools):
```bash
# 手动生成
pip-compile requirements/base.in -o requirements/base.txt

# 或使用脚本
./scripts/generate-requirements.sh
```

## CI/CD 集成

在CI/CD管道中，可以根据需要选择依赖组：

```yaml
# 仅安装最小依赖运行测试
- pip install -r requirements/base.txt -r requirements/api.txt

# 安装完整依赖运行集成测试
- pip install -r requirements/dev.txt -r requirements/db.txt

# 生产镜像构建
- pip install -r requirements/prod.txt
```

## 优势

1. **模块化**: 按功能模块分离依赖
2. **复用性**: 开发、测试、生产环境使用不同依赖集
3. **可维护性**: 每个依赖组有明确目的
4. **安全性**: 安全相关依赖集中管理
5. **性能**: 生产镜像只安装必需依赖

## 向后兼容性

`requirements.txt` 文件仍然存在，且内容与 `requirements/prod.txt` 相同，确保现有部署脚本无需修改。

## 版本控制

所有 `.txt` 文件都是锁定版本的，确保构建可复现。`.in` 文件包含版本约束，用于生成锁定文件。