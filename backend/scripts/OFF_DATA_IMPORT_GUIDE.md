# OpenFoodFacts 数据导入完整指南

## 📋 概述

本指南分四步完成 OFF 数据的全量导入：
1. **sample** - 样本验证（快速测试）
2. **bulk** - 批量导入中国产品（主任务）
3. **sync** - 增量同步（定期更新）
4. **embed** - 生成向量搜索嵌入（为 AI 搜索做准备）

---

## 🚦 第0步：前置环境检查

### 1. 确认 Python 环境

```bash
cd D:\RMFOOD配方平台\backend
\.venv\Scripts\activate
python --version
# 应显示: Python 3.11.x
```

### 2. 确认依赖已安装

```bash
pip list | grep -E "sqlalchemy|psycopg2|httpx|redis"
# 至少应有：
# SQLAlchemy >= 2.0
# psycopg2-binary >= 2.9
# httpx >= 0.27
```

如果没有安装：
```bash
pip install -r requirements.txt
```

### 3. 确认数据库连接

编辑 `.env` 文件，确保设置了正确的 DATABASE_URL：

```env
DATABASE_URL=postgresql+asyncpg://用户名:密码@主机:端口/数据库名
```

示例：
```env
DATABASE_URL=postgresql+asyncpg://rmfood:your_password@localhost:5432/rmfood_db
```

测试连接（使用 psql 命令行工具）：
```bash
psql "$DATABASE_URL" -c "SELECT 1;"
# 应返回: 1
```

### 4. 确认网络可访问 OFF API

```bash
curl -I https://world.openfoodfacts.org
# 应返回 HTTP/2 200
```

---

## 🧪 Step 1: sample（样本验证）- 预计耗时 1-2 分钟

### 执行命令

```bash
cd D:\RMFOOD配方平台\backend
\.venv\Scripts\activate
python scripts/import_off_direct.py sample
```

### 预期输出

```
============================================================
Phase A: OFF 样本数据验证 (100条)
============================================================
[1/5] 搜索样本产品...
  获取到 100 条原始产品数据
[2/5] 映射字段...
  映射完成: 98 条 (跳过 2 条)
[3/5] 入库...
  入库结果: 插入=98, 失败=0
[4/5] 验证数据...
  验证结果: 来源=openfoodfacts, 数量=98
[5/5] 样本验证完成!
```

### 验证结果

登录数据库验证：
```bash
psql "$DATABASE_URL" -c \
  "SELECT COUNT(*) FROM retail_products WHERE source = 'openfoodfacts';"
# 应返回: 98 (或接近100)
```

**如果失败：**
- 检查网络连接是否能访问 world.openfoodfacts.org
- 检查数据库连接字符串是否正确
- 检查是否有 rate limiting（等待几分钟后重试）

---

## 📦 Step 2: bulk（批量导入中国相关产品）- 预计耗时 1-3 小时

### 执行命令

```bash
cd D:\RMFOOD配方平台\backend
\.venv\Scripts\activate
set OFF_CHINA_ONLY=true  # Windows
# export OFF_CHINA_ON  # Linux/Mac
python scripts/import_off_direct.py bulk
```

### 预期输出

日志将显示每个分类的处理进度：
```
[1/30] 搜索分类: beverages
  获取 100 条原始数据
  入库批次: 500 条
[2/30] 搜索分类: dairy
  获取 100 条原始数据
  ...
...
[30/30] 搜索分类: fiber
  获取 100 条原始数据
  入库剩余: 320 条

导入完成!
  成功: 3456 条
  跳过: 2144 条  （非中国产品）
  失败: 12 条
```

### 验证结果

```bash
# 总产品数
psql "$DATABASE_URL" -c \
  "SELECT COUNT(*) FROM retail_products WHERE source = 'openfoodfacts';"

# 按分类统计
psql "$DATABASE_URL" -c \
  SELECT category, COUNT(*) as cnt FROM retail_products
  WHERE source = 'openfoodfacts' AND category IS NOT NULL
  GROUP BY category ORDER BY cnt DESC LIMIT 10;

# 品牌统计
psql "$DATABASE_URL" -c \
  SELECT COUNT(DISTINCT brand) FROM retail_products
  WHERE source = 'openfoodfacts';
```

**重要提醒：** bulk 导入过程较长，建议：
- 后台运行或使用 nohvc/tmux/Screensaver
- 日志会实时输出进度
- 中断后可从上次位置继续（需手动追踪）

---

## ⏱️ Step 3: sync（增量同步）- 每日自动运行

### 首次运行命令

```bash
python scripts/import_off_direct.py sync
```

此功能会从上次同步日期开始拉取增量数据。

### 配置定时任务（Windows Task Scheduler）

1. 打开任务计划程序
2. 创建基本任务 → 名称: "OFF Incremental Sync"
3. 触发器: 每天凌晨 2:00
4. 操作: 启动程序
   - 程序: `D:\RMFOOD配方平台\backend\.venv\Scripts\python.exe`
   - 参数: `scripts\import_off_direct.py sync`
   - 起始于: `D:\RMFOOD配方平台\backend`

### 配置定时任务（Linux/macOS crontab）

```bash
crontab -e
# 添加以下行
0 2 * * * /path/to/backend/.venv/bin/python /path/to/backend/scripts/import_off_direct.py sync
```

---

## 🔍 Step 4: embed（生成向量嵌入）- 为搜索加速

### 前置配置

在 `.env` 中配置 LLM 服务（选择一种）：

```env
# 选项A: DeepSeek
LLM_PROVIDER=deepseek
OPENAI_API_KEY=您的DeepSeek_API密钥
OPENAI_BASE_URL=https://api.deepseek.com/v1/chat/completions

# 选项B: OpenAI兼容服务
LLM_PROVIDER=openai
OPENAI_API_KEY=您的OpenAI_API密钥
OPENAI_BASE_URL=https://api.openai.com/v1/chat/completions

# 选项C: 本地模型（如 Ollama）
LLM_PROVIDER=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
```

### 执行命令

```bash
python scripts/import_off_direct.py embed 10000
# 参数: 要嵌入的产品数量（默认10000）
```

### 预期输出

```
============================================================
生成嵌入向量 (limit=10000)
============================================================
正在查找未嵌入的零售产品... 找到 5231 条
[0/5231] 生成嵌入: product_001... ✓
[500/5231] 进度完成... ✓
...
嵌入生成完成: 5231 条
```

### 验证结果

```bash
psql "$DATABASE_URL" -c \
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding,
    ROUND(AVG(data_quality), 2) as avg_quality
  FROM retail_products
  WHERE source = 'openfoodfacts';
```

---

## 📊 完成后的整体验证

执行以下 SQL 查询以获取完整的状态报告：

```sql
-- 总体统计
SELECT 
    source,
    COUNT(*) as total_products,
    COUNT(DISTINCT brand) as unique_brands,
    COUNT(DISTINCT category) as unique_categories,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding,
    ROUND(AVG(data_quality), 2) as avg_data_quality,
    MIN(crawl_timestamp) as first_import,
    MAX(crawl_timestamp) as last_update
FROM retail_products
WHERE source = 'openfoodfacts'
GROUP BY source;

-- 同步状态（如有）
SELECT * FROM off_sync_state ORDER BY last_sync_date DESC LIMIT 5;

-- 错误日志（如有）
SELECT * FROM off_import_errors ORDER BY created_at DESC LIMIT 10;

-- 数据质量分布
SELECT
    COUNT(CASE WHEN data_quality >= 0.8 THEN 1 END) as high_quality,
    COUNT(CASE WHEN data_quality >= 0.5 AND data_quality < 0.8 THEN 1 END) as medium_quality,
    COUNT(CASE WHEN data_quality < 0.5 THEN 1 END) as low_quality
FROM retail_products
WHERE source = 'openfoodfacts';
```

---

## 🛠️ 常见问题解答

### Q1: 连接 OFF API 超时/失败？
- 检查网络代理设置
- 确认 world.openfoodfacts.org 未被防火墙阻断
- 尝试设置环境变量: `HTTP_PROXY=http://proxy:port`

### Q2: 数据库连接错误？
- 检查 `.env` 中的 DATABASE_URL
- 确认 PostgreSQL 服务正在运行
- 确认用户有数据库写入权限
- 确认表结构已正确迁移（alembic upgrade head）

### Q3: 导入过程中断怎么办？
- bulk 模式没有内建续传功能，需重新运行
- sync 模式会自动从上次同步日期继续
- 建议长时间运行时使用 `nohup` 或 tmux/screen

### Q4: 如何删除已导入的数据？
⚠️ **谨慎操作！** 这将删除所有 source='openfoodfacts' 的记录：
```sql
DELETE FROM retail_products WHERE source = 'openfoodfacts';
TRUNCATE TABLE off_sync_state RESTART IDENTITY CASCADE;
TRUNCATE TABLE off_import_errors RESTART IDENTITY CASCADE;
```

### Q5: 能否自定义导入的分类？
可以修改 `scripts/import_off_direct.py` 中的 CATEGORIES 列表，添加您感兴趣的分类标签。

---

## 📝 执行记录表

请记录每次执行的结果以便跟踪进度：

| 步骤 | 执行时间 | 成功数 | 跳过数 | 失败数 | 备注 |
|------|----------|--------|--------|--------|------|
| sample | YYYY-MM-DD HH:MM | ___ | ___ | ___ | □□□ |
| bulk | YYYY-MM-DD HH:MM | ___ | ___ | ___ | □□□ |
| sync | YYYY-MM-DD HH:MM | ___ | ___ | ___ | □□□ |
| embed | YYYY-MM-DD HH:MM | ___ | ___ | ___ | □□□ |

---

## 🎉 恭喜！

完成以上四个步骤后，您的 RMFOOD 系统将拥有完整的 OpenFoodFacts 零售产品数据库，支持：
- ✅ 全量搜索（retail_products 表）
- ✅ 模糊匹配（ILIKE 查询）
- ✅ 向量语义搜索（embedding + pgvector）
- ✅ 分类浏览
- ✅ 品牌筛选
- ✅ 数据质量分析
- ✅ 自动增量同步

如有疑问或遇到错误，请将完整错误信息提供给我进行诊断。

---

*文档生成日期: 2026-07-29*  
*项目: RMFOOD 配方制作平台 × OpenFoodFacts 深度集成*
