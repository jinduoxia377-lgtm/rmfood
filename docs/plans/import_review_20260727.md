# 零售产品原始数据导入进度审查与执行计划
**审查人：** 数据专家  
**日期：** 2026-07-27  
**版本：** V1.0

---

## 一、审查范围与目标

本次审查针对 OpenFoodFacts CSV 原始数据向 `retail_products` 表的完整导入流程，涵盖：

1. **系统能力评估** - 现有导入引擎框架的完整性与可用性
2. **配置环境审查** - 数据库、配置依赖、文件准备状态
3. **数据质量分析** - 源数据结构、字段映射难度、潜在清洗需求
4. **问题诊断** - 已发现阻塞项与技术债务
5. **执行计划制定** - 分阶段实施路线图与风险控制

---

## 二、系统现状审查

### 2.1 后端导入框架（已完成 ✅）

| 模块 | 状态 | 说明 |
|------|------|------|
| ImportEngine（核心引擎）✅ | 已完成 | 支持批量写入、ON CONFLICT UPsert、错误隔离、进度统计 |
| CSV/JSON 适配器 ✅ | 已完成 | CsvAdapter、JsonAdapter，支持自动分隔符检测、大文件分块读取 |
| FieldMapper 字段映射器 ✅ | 已完成 | 支持 transform: strip/lower/to_float/to_int/split_first/json_load |
| Import Schemas ✅ | 已完成 | Pydantic 模型定义 request/response |
| Import API Router ✅ | 已完成 | /imports/upload, /preview, /run, /list, /detail, /errors, /cancel |
| alembic migration ✅ | 已完成 | `import_tasks` + `import_errors` 表结构建立 |

**⚠️ 生产环境待办：**
- 内存任务存储 `_import_tasks` 需替换为 Redis 持久化（代码注释已标注）
- 导入过程中无实时进度上报，仅任务结束后更新状态
- `import_errors` 表未被填充（engine 未调用记录错误到 DB 的逻辑）

### 2.2 前端导入界面（已完成部分 ✅）

- `ImportPanel.tsx` — 五步向导式 UI（上传→预览→映射→执行→完成）
- `useImportEngine.ts` — Hook 管理导入生命周期
- `import.ts` — API 客户端封装

**缺失体验：**
- 无错误列表展示（API 有 `/errors` 端点但未在 UI 中体现）
- 无导入历史列表页面
- 无字段映射预设模板（如 OpenFoodFacts → retail_products 的常用映射）

### 2.3 OpenFoodFacts 专用导入脚本（未完成 ⚠️）

`import_openfoodfacts_csv.py` 已实现但存在**阻塞性问题**：

```
[日志错误] 验证失败：未能加载 SECRET_KEY
[日志错误] UnicodeEncodeError: 'gbk' codec can't encode character '\u2717'
```

该脚本采用独立的 asyncpg COPY 直连方案，未使用新的 ImportEngine 框架。设计思路合理（DROP INDEX → COPY → RECREATE 索引可提升性能），但耦合了 config 模块导致启动时直接触发配置校验。

---

## 三、配置与依赖审查（关键阻塞项）

### 3.1 SECRET_KEY 缺失 —— **CRITICAL**

config.py 的 `_validate_config()` 要求生产环境必须设置 SECRET_KEY。开发环境中虽会自动生成随机密钥，但在命令行脚本导入时，`Settings()` 在全局作用域被实例化，若未通过 `.env` 或环境变量提供 SECRET_KEY，会导致模块加载时报错。

**解决方案：**

创建 `.env` 文件（仓库根目录）：

```bash
# .env
ENV=development
SECRET_KEY=your-random-secret-key-here-minimum-32-characters-long
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/rmfood
DEBUG=false
LOG_LEVEL=INFO
```

或通过环境变量注入：

```cmd
set SECRET_KEY=super_secret_key_32_chars_min_xyzabc123defghijklmnopqrst
python scripts/run_full_import.py
```

### 3.2 数据库连接配置

需确认 `DATABASE_URL` 指向正确的 PostgreSQL 实例，且 `retail_products` 表存在（由模型迁移创建）。OpenFoodFacts 导入脚本使用的 `import_batch` 临时表在每次运行时动态创建，无长期依赖。

### 3.3 源文件格式确认

OpenFoodFacts CSV 实际为 **TSV（制表符分隔）**，不是逗号分隔。脚本中已正确处理（`delimiter="\t"`），但需注意：
- 列名在第 0 行（header_row = 0）
- 第一列为 `code`（external_id/SKU）
- 包含约 80+ 列，但只需提取核心字段

---

## 四、数据质量与映射策略分析

### 4.1 源数据字段概况（OpenFoodFacts TSV）

关键字段索引（基于COLUMN_MAP）：

| 源字段 | 目标列 | 转换逻辑 |
|--------|--------|----------|
| `code` | external_id, sku | 直接映射，必填，空值跳过 |
| `product_name` | product_name | 截断至 500 字符 |
| `brands` | brand | 默认为 "Unknown" |
| `categories_en` | category | 取逗号分隔第一项，截断至 100 |
| `categories_tags` | sub_category | 取第一项标签，处理 en: 前缀，标题化 |
| `quantity` | package_size | 截断至 50 |
| `ingredients_text` | full_ingredients | 直接映射（可为 null） |
| `allergens`, `additives_tags`, `traces_tags` | 对应 array 字段 | 逗号分隔 → Python list → PostgreSQL array |
| `image_url` | image_urls | 取前 5 个图片 URL |
| `stores` | sales_channels | 逗号分隔 → list |
| 营养字段（energy-kcal, fat...） | key_ingredients.nutrition JSONB | 解析为 float，保留三位小数 |
| nutriscore_grade, nova_group | key_ingredients.* | JSON 嵌套字段 |
| created_t, last_updated_t | crawl_timestamp, updated_at | Unix timestamp → ISO datetime |
| completeness | data_quality | 浮点数，默认 0.5 |

### 4.2 数据质量问题预判

| 问题类型 | 概率 | 应对方案 |
|----------|------|----------|
| 空 code 值 | 中 | 跳过该行（已有逻辑） |
| 空 product_name | 低 | 检查后处理 |
| nutrition 字段非数字 | 中 | try-catch，无效则不存入 JSON |
| date/timestamp 格式异常 | 低 | _parse_timestamp 已容错 |
| UTF-8 编码问题（中文） | 高 | 脚本使用 utf-8，需确保文件编码匹配 |
| 重复 external_id | 高 | ON CONFLICT DO UPDATE 幂等处理 |

### 4.3 推荐映射配置（自动化模板建议）

可在 UI 中预置 OpenFoodFacts → retail_products 的映射模板，减少用户手动配置：

```json
[
  {"source": "code", "target": "external_id", "required": true},
  {"source": "code", "target": "sku"},
  {"source": "brands", "target": "brand", "default": "Unknown"},
  {"source": "product_name", "target": "product_name"},
  {"source": "categories_en", "target": "category", "transform": "split_first", "transform_params": {",": ","}},
  {"source": "categories_tags", "target": "sub_category", "transform": "split_first"},
  {"source": "quantity", "target": "package_size"},
  {"source": "ingredients_text", "target": "full_ingredients"},
  {"source": "allergens", "target": "allergens_tags", "transform": "split_first"},
  {"source": "additives_tags", "target": "additives_tags", "transform": "split_first"},
  {"source": "traces_tags", "target": "traces_tags", "transform": "split_first"},
  {"source": "image_url", "target": "image_urls", "transform": "split_first"},
  {"source": "stores", "target": "sales_channels", "transform": "split_first"},
  {"source": "nutriscore_grade", "target": "key_ingredients.nutrition_grade"},
  {"source": "nova_group", "target": "key_ingredients.nova_group", "transform": "to_int"},
  {"source": "labels", "target": "key_ingredients.labels", "transform": "split_first"},
  {"source": "countries_en", "target": "key_ingredients.countries", "transform": "split_first"},
  {"source": "pnns_groups_1", "target": "key_ingredients.pnns_group"},
  {"source": "serving_size", "target": "key_ingredients.serving_size"},
  {"source": "manufacturing_places", "target": "key_ingredients.manufacturing_places"},
  {"source": "completeness", "target": "data_quality", "transform": "to_float"},
  {"source": "created_t", "target": "crawl_timestamp", "transform": "to_datetime"},
  {"source": "last_updated_t", "target": "updated_at", "transform": "to_datetime"}
]
```

---

## 五、执行计划（分阶段）

### 🟢 第一阶段：环境修复与验证（1-2 天）

**目标**：解除当前阻塞，使导入可运行。

| # | 任务 | 负责人 | 优先级 | 交付物 |
|---|------|--------|--------|--------|
| 1.1 | 创建 `.env` 配置文件并设置 SECRET_KEY | Dev/Cron | 🔴 高 | `.env` 文件 |
| 1.2 | 验证数据库连接与表结构（retail_products, import_tasks, import_errors） | Dev | 🟡 中 | 连接测试通过 |
| 1.3 | 修复脚本编码问题：移除 emoji 字符或设置 UTF-8 输出编码 | Dev | 🟡 中 | 无 UnicodeEncodeError |
| 1.4 | 将 direct import 脚本重构为使用 ImportEngine API（可选，或保持独立） | Dev | 🟡 中 | 兼容两种路径 |
| 1.5 | 编写 dry-run 模式验证数据解析正确性（不写入 DB） | Dev | 🟡 中 | 示例解析输出验证 |

---

### 🟡 第二阶段：正式导入实施（1-2 天，含试运行）

**目标**：完成首批数据导入并验证数据质量。

| # | 任务 | 参数/选项 | 优先级 | 风险/注意 |
|---|------|-----------|--------|-----------|
| 2.1 | **Dry Run（扫描验证）** | `--dry-run --test-limit 100` | 🔴 高 | 先不写库，确认行数与解析 |
| 2.2 | **小批量测试导入** | `--test-limit 1000` | 🟡 中 | 观察错误率，校验数据准确性 |
| 2.3 | **全量正式导入** | `--chunk-size 10000 --no-drop-index` 🅰️ | 🟢 低 | 首次用 `--no-drop-index` 保障安全 |
| 2.4 | **启用索引加速导入** | `--drop-index` （第二次或多次） | 🟢 低 | DROP/RECREATE 唯一索引提速 10-50x |
| 2.5 | **导入后数据校验** | SELECT COUNT(*) WHERE source='openfoodfacts_csv' | 🟡 中 | 对比预期总行数 |

**预计数据规模：**
- OpenFoodFacts 产品库：约 80 万 + 全球产品
- 中国区域过滤后可选：~10-20 万（通过 countries_en 筛选）

---

### 🔵 第三阶段：引入 ImportEngine 框架（2-3 天）

**目标**：统一导入入口，完善监控与错误追踪。

| # | 任务 | 描述 | 优先级 |
|---|------|------|--------|
| 3.1 | 更新 `_write_batch` 的错误处理 | 捕获 DB 约束错误，记录到 `import_errors` 表 | 🔴 高 |
| 3.2 | 实现进度实时上报 | 每 N 行更新一次 task 进度，供轮询 UI 显示 | 🟡 中 |
| 3.3 | 内存任务存储迁移 Redis | 替换 `_import_tasks` dict 为 Redis-backed store | 🟡 中 |
| 3.4 | 添加错误分页查询 UI | 在 ImportPanel 中展示错误详情表格 | 🟡 中 |
| 3.5 | 创建字段映射预设配置 | 为 common targets（retail_products, food_materials）保存映射模板 | 🟢 低 |
| 3.6 | 支持并发导入任务限流 | 避免同时多个大导入压垮数据库 | 🟢 低 |

---

### 🟣 第四阶段：优化与扩展（持续迭代）

| # | 任务 | 描述 | 优先级 |
|---|------|------|--------|
| 4.1 | 导入失败重试机制 | 对 transient errors 自动重试指数退避 | 🟡 中 |
| 4.2 | 增量导入支持 | 仅导入新增/更新条目（基于 crawl_timestamp） | 🟢 低 |
| 4.3 | 多源适配器 | 添加 API 适配器（OpenFoodFacts API vs CSV file） | 🟢 低 |
| 4.4 | 数据清洗预处理 | 在导入前应用标准化规则（品牌名统一、分类映射） | 🟢 低 |
| 4.5 | 导入指标看板 | Grafana/Prometheus 集成：导入成功率、速率、错误分布 | 🟢 低 |

---

## 六、风险评估与控制

| 风险项 | 影响等级 | 发生概率 | 缓解措施 |
|--------|----------|----------|----------|
| SECRET_KEY 配置缺失 | 🔴 CRITICAL | 🔴 高 | 立即创建 .env，添加至 .gitignore |
| 全量导入耗时过长（数小时） | 🟡 HIGH | 🟡 中 | 分批执行；首次小量测试；考虑离线时段运行 |
| 唯一键冲突导致插入失败 | 🟡 HIGH | 🟡 中 | 使用 ON CONFLICT DO UPDATE 幂等策略；先清理旧同源数据（可选） |
| 内存溢出（大文件解析） | 🟡 HIGH | 🟡 中 | 使用 chunked iterate；确保 chunk_size 适中（10000） |
| 编码错误（GBK vs UTF-8） | 🟡 MEDIUM | 🟡 中 | 显式指定 encoding=utf-8；输出流重定向至 UTF-8 |
| 目标表锁竞争 | 🟡 MEDIUM | 🟢 低 | 非高峰时段导入；使用 `NOLOCK` 或读隔离级别 |
| 导入中断后状态不一致 | 🟡 MEDIUM | 🟢 低 | 事务保证原子性；任务状态机跟踪 |

---

## 七、成功验收标准

1. [ ] 配置文件（`.env`）已设置 SECRET_KEY 和 DATABASE_URL
2. [ ] Dry-run 模式成功扫描 CSV 文件，输出有效行数
3. [ ] 小批量测试导入（≤1000 行）无错误，数据正确写入 `retail_products`
4. [ ] 全量导入完成后，`SELECT * FROM import_tasks` 显示 status=completed
5. [ ] 导入数据统计：total_rows ≈ 预期值，error_rows ≤ 1% 阈值
6. [ ] `retail_products` 表中 source='openfoodfacts_csv' 记录数与导入量一致
7. [ ] Import API 端点可正常返回任务列表和详情（curl 或 Postman 验证）
8. [ ] 前端 ImportPanel 可成功上传、预览、映射、执行完整流程

---

## 八、附录：快速启动命令

### 8.1 配置初始化

```cmd
:: Windows (CMD)
set ENV=development
set SECRET_KEY=your-generated-32-char-secret-key-here
set DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/rmfood

:: PowerShell
$env:ENV="development"
$env:SECRET_KEY="your-generated-32-char-secret-key-here"
$env:DATABASE_URL="postgresql+asyncpg://postgres:password@localhost:5432/rmfood"
```

### 8.2 运行 Dry Run 测试

```cmd
cd backend
python scripts/import_openfoodfacts_csv.py --dry-run --test-limit 100 --csv "D:\RMFOOD配方平台\openfoodfacts\en.openfoodfacts.org.products.csv"
```

### 8.3 正式导入（安全模式，不删索引）

```cmd
cd backend
python scripts/import_openfoodfacts_csv.py --csv "D:\RMFOOD配方平台\openfoodfacts\en.openfoodfacts.org.products.csv" --no-drop-index
```

### 8.4 查看导入任务

```sql
-- 登录 psql 后
SELECT status, total_rows, inserted_rows, error_rows, progress_pct 
FROM import_tasks 
WHERE target_table = 'retail_products'
ORDER BY created_at DESC;
```

---

*文档版本历史：*  
V1.0 — 2026-07-27 — 初始版本 — 数据专家
