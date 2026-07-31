# 零售产品功能模块 - 立即执行清单 (2026-07-27)

## 🔴 阻塞问题定位与修复

### 问题1: SECRET_KEY环境变量加载顺序
**位置**: `backend/app/core/config.py` 第332-338行

```python
def __init__(self, **data):
    super().__init__(**data)
    self._fix_nested_config()
    self._apply_env_overrides()  # ✅ 已先于调用
    self._validate_config()      # ✅ 验证在后
```

**验证方法**：
```cmd
cd backend
set ENV=development
set SECRET_KEY=dev-secret-key-32-char-long-abc123xyz789
python -c "from app.core.config import settings; print('SECRET OK:', len(settings.secret_key))"
```

如果输出 `SECRET OK: 32` 或更长，则配置正确。

### 问题2: Python环境依赖缺失
**症状**: `ModuleNotFoundError: No module named 'sqlalchemy'`

**修复方案**：
```cmd
:: 进入后端目录
cd backend\.venv\Scripts\activate
..\Scripts\pip install -r requirements.txt --no-cache-dir

:: 安装必需包
..\Scripts\pip install fastapi uvicorn httpx sqlalchemy asyncpg pydantic-settings
```

---

## 🚀 执行命令序列（按顺序执行）

### Step 1: 配置验证（5秒）

```cmd
cd D:\RMFOOD配方平台
setx ENV "development" /M
setx SECRET_KEY "dev-secret-key-32-char-long-abc123xyz789" /M
setx DATABASE_URL "postgresql+asyncpg://postgres:password@localhost:5432/rmfood" /M
```

**预期输出**:
```
SUCCESS: The specified value was added to the system environment.
```

### Step 2: 数据Dry-run测试（30秒）

```cmd
cd backend
python scripts/run_import_with_env.py --dry-run --test-limit 100 --csv ..\openfoodfacts\en.openfoodfacts.org.products.csv
```

**期望关键日志**:
```
[Step 1] 扫描CSV文件，统计有效行数...
  已扫描100行 | 有效100条 | 速率: xxx rows/s
[Dry run complete] 数据格式验证通过
```

### Step 3: 小批量正式导入（1-2分钟，取决于磁盘I/O）

```cmd
python scripts/run_import_with_env.py --csv ..\openfoodfacts\en.openfoodfacts.org.products.csv --no-drop-index --test-limit 1000
```

**期望关键日志**:
```
[Step 2] 检查数据库中已有的openfoodfacts数据...
  数据库中已有 0 条 openfoodfacts_csv记录
[INSERT/UPSERT] 已导入/更新: 1000
解析错误: 0
总耗时: XX.XXs
平均速率: XXXX rows/s
导入完成!
```

### Step 4: 数据库验证（30秒）

使用 `psql` 或 pgAdmin 执行：

```sql
-- 检查导入数量
SELECT COUNT(*) FROM retail_products WHERE source = 'openfoodfacts_csv';

-- 检查前5条样本数据
SELECT id, product_name, brand, category, price, data_quality 
FROM retail_products 
WHERE source = 'openfoodfacts_csv' 
LIMIT 5;

-- 检查唯一性约束是否工作
SELECT external_id, count(*) as cnt 
FROM retail_products 
WHERE source = 'openfoodfacts_csv' 
GROUP BY external_id 
HAVING count(*) > 1;
```

### Step 5: API端点测试（1分钟）

启动后端服务后（另一终端）：

```cmd
uvicorn app.main:create_app --reload --port 8000
```

测试请求：

```bash
# 搜索测试（DB缓存模式）
curl -X POST http://localhost:8000/databases/openfoodfacts/search \
  -H "Content-Type: application/json" \
  -d '{"query": "yogurt", "realtime": false}'

# 实时搜索测试
curl -X POST http://localhost:8000/databases/openfoodfacts/search \
  -H "Content-Type: application/json" \
  -d '{"query": "protein powder", "realtime": true}'

# 按分类浏览
curl -X GET "http://localhost:8000/databases/openfoodfacts/category/dairies?page=1&page_size=5"
```

**期望响应结构**：
```json
{
  "items": [
    {
      "id": 123,
      "product_name": "Natural Yogurt",
      "brand": "Brand X",
      "category": "乳制品",
      "price": 2.99,
      "avg_rating": 4.5,
      ...
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 20,
  "data_source": "postgresql_fts"
}
```

### Step 6: 前端界面测试（1分钟）

```cmd
cd frontend
npm install  # 如未安装依赖
npm run dev
```

在浏览器访问 `http://localhost:3000/databases`，然后点击「零售产品」标签：

- [ ] 搜索框能输入关键词
- [ ] 筛选器中的品牌/剂型/价格输入框可见且可用
- [ ] 搜索结果以卡片形式显示
- [ ] 点击星号收藏会改变颜色并显示toast提示
- [ ] 点击复选标记会切换选择状态
- [ ] 导出CSV按钮能生成文件

---

## ⏱️ 时间预估

| 步骤 | 预计时间 | 备注 |
|------|----------|------|
| Step 1 配置验证 | <1分钟 | 仅需设置环境变量 |
| Step 2 Dry-run | 30秒-1分钟 | 仅读操作，不写库 |
| Step 3 小批量导入 | 1-3分钟 | 1000条记录，带ON CONFLICT |
| Step 4 数据库验证 | 1分钟 | SQL查询确认 |
| Step 5 API测试 | 2分钟 | curl请求验证 |
| Step 6 前端测试 | 1分钟 | 浏览器交互 |

**总计执行时间：约 8-10 分钟**

---

## 🎯 成功验收标准

在完成上述所有步骤后，应满足以下条件：

- [ ] `.env`/环境变量中 SECRET_KEY 长度 >= 32 字符且通过配置校验
- [ ] `import_openfoodfacts_csv.py` 无 ImportError 或 ModuleNotFoundError
- [ ] Dry-run 输出显示有效行数正确（至少1条）
- [ ] 小批量导入完成后 `retail_products` 表中 source='openfoodfacts_csv' 的记录数等于 test-limit 值
- [ ] `SELECT COUNT(*) WHERE external_id IN (...)` 返回1（验证幂等性）
- [ ] `/databases/openfoodfacts/search` 端点返回有效JSON数据包含字段
- [ ] 前端「零售产品」Tab可正常打开且显示搜索结果
- [ ] 收藏和选择功能有视觉反馈（星变红、勾出现）
- [ ] CSV导出文件包含★和✓标记列

---

## 🛑 故障排除速查表

| 错误现象 | 可能原因 | 解决方案 |
|----------|----------|----------|
| `ValueError: 配置校验失败: 未设置 SECRET_KEY` | SECRET_KEY环境变量未设置或长度不足 | 设置≥32字符SECRET_KEY |
| `ModuleNotFoundError: No module named 'sqlalchemy'` | 虚拟环境未激活或依赖未安装 | `.\venv\Scripts\activate && pip install -r requirements.txt` |
| `Connection refused to postgresql` | PostgreSQL未运行或DATABASE_URL错误 | 确认pg服务启动，检查连接串 |
| `Table retail_products does not exist` | 数据库迁移未执行 | `alembic upgrade head` |
| 前端报404 on /databases/openfoodfacts/* | Router未注册 | 确认 `db_modules/__init__.py` 正确导入 |
| CSV中文乱码 | 编码不一致 | 确保脚本使用encoding="utf-8" |
| 收藏图标无反应 | Toast hook未找到 | 确认 `useToast` 从 `@/components/ui` 正确导入 |

---

**立即执行提示**：请按顺序执行上述步骤，每一步完成后验证预期结果再继续下一步。如果遇到错误，请查阅"故障排除速查表"并在对应阶段停止，解决后再继续。整个流程完成后，零售产品功能模块即可达到Beta可用状态。
