# RMFOOD 配置管理指南

## 概述

RMFOOD配方平台使用Pydantic Settings进行配置管理，支持多环境部署。配置系统具有以下特点：

1. **环境感知** - 支持development、staging、production、test环境
2. **分层配置** - 默认值 → 文件配置 → 环境变量 → 运行时覆盖
3. **验证** - 类型检查和业务规则验证
4. **安全** - 敏感字段脱敏和加密支持
5. **热重载** - 无需重启应用更新配置

## 配置层级

配置按以下优先级加载（从高到低）：

1. **环境变量** - 最高优先级，运行时覆盖
2. **.env文件** - 项目根目录的.env文件
3. **Python默认值** - 代码中定义的安全默认值

### 环境变量命名规则

- 使用大写字母和下划线：`SECRET_KEY`
- 嵌套配置使用双下划线：`SECURITY__CORS_ORIGINS`
- 向后兼容的变量名也支持：`POSTGRES_HOST`

## 环境配置示例

### 开发环境 (.env.development)
```bash
ENV=development
DEBUG=true
SECRET_KEY=dev-only-secret-key-32-chars-minimum
DATABASE_URL=postgresql+asyncpg://rmfood:password@localhost:5432/rmfood_dev
REDIS_URL=redis://localhost:6379/0
LOG_LEVEL=DEBUG
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 生产环境 (.env.production)
```bash
ENV=production
DEBUG=false
SECRET_KEY=your-64-character-production-secret-key-generated-securely
DATABASE_URL=postgresql+asyncpg://rmfood:secure_password@postgres:5432/rmfood_prod
REDIS_URL=redis://redis-service:6379/0?password=redis_password
LOG_LEVEL=INFO
CORS_ORIGINS=https://app.example.com,https://admin.example.com
```

### 测试环境 (.env.test)
```bash
ENV=test
DEBUG=false
SECRET_KEY=test-only-secret-key
DATABASE_URL=sqlite+aiosqlite:///./test.db
LOG_LEVEL=WARNING
```

## 配置分组

### 基础配置
- `ENV` - 运行环境
- `DEBUG` - 调试模式
- `SECRET_KEY` - JWT签名密钥

### 数据库配置
- `DATABASE_URL` - 数据库连接字符串
- `DATABASE__POOL_SIZE` - 连接池大小
- `DATABASE__MAX_OVERFLOW` - 连接池溢出上限

或使用传统变量：
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

### Redis配置
- `REDIS_URL` - Redis连接字符串
- `REDIS__MAX_CONNECTIONS` - 最大连接数
- `REDIS__CACHE_TTL` - 默认缓存时间

### 安全配置
- `SECURITY__JWT_EXPIRE_MINUTES` - JWT有效期
- `SECURITY__CORS_ORIGINS` - CORS允许源
- `SECURITY__CORS_ALLOW_CREDENTIALS` - 是否允许凭证

### 日志配置
- `LOG_LEVEL` - 日志级别
- `LOGGING__FORMAT` - 日志格式
- `LOGGING__SLOW_QUERY_THRESHOLD_MS` - 慢查询阈值

### AI服务配置
- `AI_API_KEY` - AI服务API密钥
- `AI_BASE_URL` - AI服务基础URL
- `AI_SERVICE__MODEL` - 默认模型

## 使用方式

### 代码中使用配置
```python
from app.core.config import settings

# 获取配置值
db_url = settings.database.url
log_level = settings.logging.level
is_production = settings.is_production

# 获取嵌套配置
cors_origins = settings.security.cors_origins
jwt_expire = settings.security.jwt_expire_minutes

# 导出所有配置（不含敏感信息）
config_dict = settings.to_dict(include_sensitive=False)
```

### 环境特定的配置
```python
# 根据环境执行不同逻辑
if settings.app_env == "production":
    # 生产环境逻辑
    enable_rate_limiting = True
    cache_expiry = 3600
elif settings.app_env == "development":
    # 开发环境逻辑
    enable_rate_limiting = False
    cache_expiry = 60
```

### 运行时修改配置
```python
# 热重载配置（需要环境变量重新加载）
from app.core.config import reload_settings
new_settings = reload_settings()
```

## 验证和测试

### 配置验证脚本
```bash
# 验证当前配置
python scripts/config-validator.py

# 输出示例：
# ✅ 配置验证通过，所有检查正常
```

### 预启动检查
在应用启动时自动执行配置验证：
```python
# 在main.py或app启动文件中
from app.core.config import get_settings

def startup_config_check():
    settings = get_settings()
    
    # 生产环境额外检查
    if settings.app_env == "production":
        if len(settings.security.secret_key) < 32:
            raise ValueError("生产环境SECRET_KEY必须至少32字符")
        
        if settings.debug:
            raise ValueError("生产环境DEBUG必须为false")
```

### 测试配置
创建测试专用的配置文件：
```python
# tests/conftest.py
import pytest
from app.core.config import Settings

@pytest.fixture(scope="session")
def test_settings():
    """测试专用的配置"""
    return Settings(
        app_env="test",
        debug=False,
        database__url="sqlite+aiosqlite:///:memory:",
        security__secret_key="test-secret-key-32-chars-minimum",
    )
```

## Docker和Kubernetes集成

### Docker Compose
```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - ENV=production
      - DEBUG=false
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    env_file:
      - .env  # 可选，可加载.env文件
```

### Kubernetes ConfigMap
```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: rmfood-config
data:
  ENV: "production"
  DEBUG: "false"
  LOG_LEVEL: "INFO"
```

### Kubernetes Secret
```yaml
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: rmfood-secrets
type: Opaque
stringData:
  SECRET_KEY: "your-production-secret-key"
  AI_API_KEY: "your-ai-api-key"
```

## 安全最佳实践

### 敏感信息管理
1. **不提交敏感数据到版本控制**
   - .env文件加入.gitignore
   - 只提交.env.example作为示例

2. **使用Secret管理**
   - 生产环境使用Kubernetes Secrets或云服务Secret Manager
   - 开发环境使用.env.local文件（不提交）

3. **定期轮换密钥**
```bash
# 生成新的SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 配置审计
```python
# 配置变化审计日志
import logging
from app.core.config import settings, reload_settings

def audit_config_change(old_config, new_config):
    """记录配置变化"""
    changes = []
    for key in old_config:
        if old_config[key] != new_config.get(key):
            changes.append({"key": key, "old": old_config[key], "new": new_config.get(key)})
    
    if changes:
        logging.info(f"配置已更改: {changes}")
```

## 故障排除

### 常见问题
1. **配置未生效**
   - 检查环境变量优先级
   - 确认.env文件加载正确
   - 重启应用使配置生效

2. **配置验证失败**
   - 检查必需环境变量
   - 验证配置值格式
   - 查看配置验证脚本输出

3. **敏感信息泄露**
   - 确保.to_dict()不使用include_sensitive=True
   - 日志中脱敏敏感字段
   - 定期检查和轮换密钥

### 调试配置
```python
# 调试配置加载
import os
from app.core.config import get_settings

# 查看当前环境变量
print("环境变量:", dict(os.environ))

# 查看最终配置
settings = get_settings()
print("当前配置:", settings.to_dict())

# 重新加载配置
from app.core.config import reload_settings
new_settings = reload_settings()
print("重新加载配置:", new_settings.to_dict())
```

## 配置管理脚本

### 快速配置
```bash
# 生成.env文件
cp .env.example .env

# 编辑配置文件
vim .env

# 验证配置
python scripts/config-validator.py

# 使用脚本生成密钥
python scripts/generate-secrets.py
```

### 环境切换
```bash
# 切换到开发环境
export ENV=development
export DEBUG=true

# 切换到生产环境  
export ENV=production
export DEBUG=false

# 应用环境变量到当前会话
source .env.production
```

---

**文档版本**: 2.0.0  
**最后更新**: 2026-06-17  
**适用版本**: RMFOOD v2.0+