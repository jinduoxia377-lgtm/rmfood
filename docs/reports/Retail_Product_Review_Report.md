# 🛡️ 零售产品模块代码审查报告

**审查时间**: 2026-07-28  
**审查范围**: 数据库检索中心 → 零售产品功能模块（数据导入进度）  
**审查类型**: 代码质量、安全性、最佳实践、架构一致性  

---

## 一、整体概况

| 维度 | 现状 | 评估 |
|------|------|------|
| API 端点 | 完整 CRUD + 搜索 | ✅ 基本完备 |
| 数据模型 | RetailProduct 模型已建立 | ✅ 字段丰富 |
| 导入基础设施 | Import Engine 框架已搭建 | ⚠️ 部分未完成 |
| 前端界面 | RetailProductSearchPanel（Phase 4） | ✅ 已实现，但为 OFF 实时模式 |
| 测试覆盖 | 少量集成测试 | ⚠️ 不足，需加强 |
| 进度估算 | 约 **65%**（基于现有 Report） | — |

---

## 二、安全相关问题（CRITICAL / HIGH）

### 🔴 CRITICAL: 内存任务存储（缺少持久化和安全隔离）

**文件**: `backend/app/api/v1/import_router.py` (行 39-41)  
**问题**: 导入任务状态存储在内存字典 `_import_tasks` 中，服务重启将丢失所有任务状态，且无租户/用户隔离。

```python
_import_tasks: Dict[str, dict] = {}  # ❌ 纯内存存储，无持久化、无权限校验
```

**风险**:  
- 服务重启后任务数据全部丢失  
- 无权限控制，任意 task_id 可访问其他用户任务  
- 内存泄漏风险：上传的文件不会自动清理  

**建议修复**:  
```python
# 应使用 Redis 或数据库表作为持久化存储，并关联 user_id
# 在 delete/add 时添加权限检查
```

---

### 🔴 CRITICAL: SQL 注入风险（错误日志查询拼接）

**文件**: `backend/app/api/v1/import_router.py` (行 493-514)  
**问题**: 构建 WHERE 子句时直接字符串拼接 `error_type` 参数，存在 SQL 注入漏洞。

```python
"where_clause": f"AND error_type = '{error_type}'" if error_type else ""  # ❌ 字符串拼接
```

**风险**: 攻击者可通过 `error_type` 参数注入恶意 SQL。

**建议修复**: 使用参数化查询：
```python
query = text("... WHERE task_id = :tid")
if error_type:
    query = query.where(text("error_type = :et"))
params = {"tid": task_id, "et": error_type}
```

---

### 🟡 HIGH: 文件路径无验证（潜在目录遍历）

**文件**: `backend/app/api/v1/import_router.py` (行 129-134)  
**问题**: 用户上传的文件保存到临时目录时，未验证文件名中的特殊字符。

```python
temp_path = import_dir / f"{task_id}_{file.filename}"  # ❌ 无文件名 sanitization
```

**风险**: 攻击者可通过文件名进行目录遍历攻击（如 `../../etc/passwd`）。

**建议修复**:
```python
import uuid, re
safe_filename = re.sub(r'[^\w\.-]', '_', file.filename)
temp_path = import_dir / f"{task_id}_{safe_filename}"
```

---

### 🟡 HIGH: 权限校验不完整（创建商品接口）

**文件**: `backend/app/api/db_modules/retail_products.py` (行 217-257)  
**问题**: `POST /retail-products` 虽检查了角色，但未验证当前用户是否有权操作该数据源。

**建议**: 增加权限检查逻辑，确保只有特定角色（admin/formulator）能创建产品。

---

## 三、代码质量问题（HIGH / MEDIUM）

### 🟠 HIGH: 延迟全局变量循环依赖模式

**文件**: `backend/app/api/db_modules/retail_products.py` (行 144, 158-160, 176-179, etc.)  
**问题**: 大量使用全局变量 `_RetailProduct` 和 `_RetailProductResponse` 避免循环导入，导致：
- 可读性差，难以跟踪对象生命周期
- 线程安全风险（虽在 async 中影响较小但不规范）
- 测试困难

**建议重构**: 使用本地导入（在函数内部导入）代替全局缓存，或使用依赖注入。

---

### 🟠 HIGH: 批量写入中插入和更新计数不准确

**文件**: `backend/app/services/import_engine/engine.py` (行 206-210)  
**问题**: UPSERT 操作中 `_write_batch` 方法不区分 INSERT 和 UPDATE，返回的 `inserted` 和 `updated` 值不准确（全部计为 inserted，updated 始终为 0）。

```python
affected = result.rowcount if result.rowcount else len(batch)
return {"inserted": affected, "updated": 0}  # ❌ 无法区分 insert/update
```

**影响**: 导入报告中统计信息失真，影响数据质量控制。

**建议**: 使用 PostgreSQL 的 `RETURNING` 子句区分新增和更新记录。

---

### 🟠 HIGH: 导入脚本 CSV 编码硬编码

**文件**: `backend/scripts/import_openfoodfacts_csv.py` (行 561, 31)  
**问题**: TSV 文件硬编码使用 UTF-8 编码，但未处理 Windows 系统可能遇到的 GBK/BOM 等问题。

```python
with open(csv_path, encoding="utf-8") as f:  # ❌ 硬编码 UTF-8
```

**风险**: 在不同操作系统上可能导致解码失败。

**建议**: 使用 `encoding='utf-8-sig'` 自动检测 BOM，或通过配置指定编码。

---

### 🟠 MEDIUM: 重复的代码逻辑（多处全局变量初始化）

**文件**: `retail_products.py` 中多处重复出现：
```python
global _RetailProduct
if _RetailProduct is None:
    from app.models.retail_product import RetailProduct
    _RetailProduct = RetailProduct
```

**建议**: 提取为工具函数或使用 `functools.lru_cache`。

---

### 🟠 MEDIUM: 缺少异常处理的异步导入

**文件**: `backend/scripts/import_openfoodfacts_csv.py` (行 509-521)  
**问题**: `asyncpg` 连接池使用中未设置连接超时和重试机制。

**建议**: 添加 `connect_args={"timeout": 30}` 等参数。

---

## 四、最佳实践与可维护性问题（MEDIUM / LOW）

### 🟡 MEDIUM: 导入脚本缺少日志轮转

**问题**: 脚本仅使用 `StreamHandler` 输出到 console，生产环境应使用 `RotatingFileHandler` 防止日志文件过大。

### 🟡 MEDIUM: 缺少环境变量管理数据库连接

**问题**: 导入脚本直接从 `settings.database.url` 读取，但未提供 fallback 或使用 `.env` 文件的清晰说明。

### 🟡 MEDIUM: UI 代码中 console.log 残留

**文件**: `frontend/src/pages/database/tabs/RetailProductSearchPanel.tsx` (行 179)  
```javascript
console.log('[RetailProductSearchPanel] 已加载', favoriteIds.length, '个收藏产品');  // ❌ 应移除
```

### 🟡 MEDIUM: 表格缺少行键优化

**文件**: `RetailProductSearchPanel.tsx` (行 493)  
Table 使用 `rowKey="id"`，但数据中 id 可能为 null（OFF 实时数据），建议使用唯一组合键。

### 🟢 LOW: 缺少 API 版本注释

**文件**: `retail_products.py` 中多个 endpoint 未标注所属版本（如 v1）。应在 summary 中添加版本号。

### 🟢 LOW: 数据类型不一致

**文件**: `openapi.json` 生成的文档中，部分字段类型不匹配（如 `external_id` 既是 String 也接受 number）。

---

## 五、数据导入功能进度分析

### ✅ 已完成部分

| 组件 | 状态 | 备注 |
|------|------|------|
| Import Engine 框架 | ✅ 完成 | CSV/JSON Adapter, FieldMapper, UPSERT |
| Import Database Schema | ✅ 完成 | `import_tasks`, `import_errors` 表及索引 |
| Import API Endpoints | ✅ 完成 | `/imports/upload`, `/preview`, `/run`, `/list`, `/errors` |
| OpenFoodFacts CSV 导入脚本 | ⚠️ 框架完成 | 解析逻辑完整，但尚未验证实际运行 |
| Retail Product Model | ✅ 完整 | 包含所有必要字段 |
| Retail Product CRUD API | ✅ 完整 | 分页、筛选、搜索均支持 |

### ⚠️ 进行中 / 未完成部分

| 组件 | 进度 | 阻塞/风险 |
|------|------|-----------|
| 前端导入任务监控面板 | ❌ 未开始 | 需要开发进度条、错误日志展示 UI |
| Celery/RQ 异步导入队列 | ❌ 未开始 | 大文件导入会阻塞主线程 |
| 中文编码兼容性处理 | ⚠️ 部分 | 需在生产环境中验证 UTF-8 vs GBK |
| 数据质量监控仪表盘 | ❌ 未开始 | 无导入成功率的可视化 |
| 审计日志（谁导入了什么）| ⚠️ 部分 | 有 `created_by` 字段但无变更历史 |
| 单元测试（mapper/adapter）| ❌ 缺失 | 覆盖率远低于 80% 要求 |

### 🚧 关键依赖问题

1. **asyncpg 驱动未在 requirements 中明确声明** - 导入脚本依赖此驱动，但未在项目依赖清单中明确。
2. **`gen_random_uuid()` 需要 PostgreSQL extension** - 迁移表中使用但未确认是否已安装 `uuid-ossp`。
3. **内存任务存储在重启后丢失** - 生产环境必须改为 Redis 或数据库持久化。

---

## 六、建议的改进优先级

### P0（立即修复 - 阻塞发布）

1. [ ] **修复 import_router.py 的 SQL 注入漏洞**（行 513）
2. [ ] **替换内存任务存储为持久化方案**（Redis 或数据库）
3. [ ] **添加上传文件名 sanitization**（防止目录遍历）

### P1（高优先级 - 尽快修复）

4. [ ] **修复导入计数逻辑**（区分 insert/update）
5. [ ] **移除 console.log 语句**（生产环境代码）
6. [ ] **添加 csv_adapter 单元测试**（field mapping, validation）
7. [ ] **完善 import_openfoodfacts_csv.py 的异常处理**

### P2（中优先级 - 下个迭代）

8. [ ] **统一导入接口 ErrorType 枚举**（schema.py 和 models.py 中有两套定义）
9. [ ] **为 RetailProductSearchPanel 添加行键保护**
10. [ ] **添加导入脚本的日志轮转配置**
11. [ ] **编写 mock 数据导入的集成测试**

---

## 七、总结

当前零售产品模块的数据导入基础设施已搭建完成约 **65%**，核心架构（Import Engine + API + Model）已经就绪，具备了可扩展的基础。但存在 **3 个 CRITICAL 安全问题**（SQL 注入、内存存储无持久化、文件名验证缺失）和 **多个 HIGH 质量缺陷**（计数不准、循环依赖模式、代码重复），需要在发布前优先修复。

**建议暂缓生产导入，先修复安全问题并完成至少 80% 的测试覆盖率后再进行正式数据导入。**

---

*报告生成于 2026-07-28，由 Claude Code 自动审查工具生成*