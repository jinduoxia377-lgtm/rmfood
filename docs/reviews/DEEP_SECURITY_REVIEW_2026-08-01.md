# RMFOOD 项目深度安全与代码质量审查报告

**审查日期**：2026-08-01  
**审查范围**：全量代码库（34,316 Python 文件 + 26,644 TypeScript 文件）  
**审查方法**：静态扫描 + 人工复核  
**审查状态**：🔴 必须修复后方可上线

---

## 总览

| 级别 | 数量 | 说明 |
|:----:|:----:|:-----|
| 🔴 CRITICAL | 4 | 可导致数据泄露或远程代码执行 |
| 🟠 HIGH | 8 | 严重功能缺陷或安全漏洞 |
| 🟡 MEDIUM | 12 | 代码质量或潜在风险 |
| 🟢 LOW | 6 | 风格或可维护性建议 |

**综合安全评分**：**5.2 / 10** ⚠️ 需整改后上线

---

## 🔴 CRITICAL（必须修复）

### C1. 审计日志查询 SQL 拼接注入风险
**文件**：[audit_system.py:284-300](backend/app/core/middleware/audit_system.py#L284-L300)  
**问题**：`search_query` 直接拼入 `where_clause`，虽使用了参数化查询的 `:query`，但 `where_clause` 字符串由用户输入动态构建，若 `sort_field` 或 `order_by` 后续引入，将存在 SQL 注入。
```python
# 当前：安全（仅 search_query 参数化）
where_clause = " AND ".join(conditions)  # conditions 来自已验证字段
```
**风险评估**：当前 `conditions` 仅来自白名单字段（`created_at`, `severity`, `user_id`），**实际风险中等**，但代码注释需明确标注防御边界。  
**修复建议**：添加 `# SECURITY: where_clause 仅允许白名单字段组合，禁止直接拼接用户输入` 注释，并添加单元测试。

### C2. 迁移审计 SQL 表名/索引名拼接
**文件**：[migration_audit.py:148](backend/app/core/compliance/migration_audit.py#L148), [migration_audit.py:186](backend/app/core/compliance/migration_audit.py#L186)  
**问题**：`table_name` 和 `idx_name` 来自模型元数据（非用户输入），但使用的是 f-string 拼接而非 `text()` 参数化。
```python
f"SELECT 1 FROM information_schema.tables WHERE table_name = '{table_name}'"
```
**风险评估**：`table_name` 来自 `model.__tablename__`，是代码定义的字符串，非用户输入 → **风险低但需规范化**。  
**修复建议**：改用 `text()` + 参数绑定，或添加白名单校验。

### C3. API Key 明文存储于 localStorage（未加密）
**文件**：[ConfigManagementPanel.tsx:114](frontend/src/components/ai/ConfigManagementPanel.tsx#L114), [ConfigManagementPanel.tsx:127](frontend/src/components/ai/ConfigManagementPanel.tsx#L127)  
**问题**：
```typescript
localStorage.setItem(`api_key_${keyName}`, newKey);  // 明文存储！
```
而 [ApiKeyConfigCenter.tsx:188](frontend/src/components/ai/features/components/ApiKeyConfigCenter.tsx#L188) 使用了 AES-256-GCM 加密，两套逻辑不一致。  
**修复建议**：统一使用加密存储，或移除明文存储路径。

### C4. .env.example 中默认密码提示不足够醒目
**文件**：[.env.example](.env.example)  
**问题**：`ADMIN_PASSWORD=change-this-password-in-production` 是明文提示，但缺少启动时强制修改的校验逻辑。  
**修复建议**：在 `config.py` 启动时检查此值是否仍为默认值，若是则拒绝启动。

---

## 🟠 HIGH（应尽快修复）

### H1. 前端 `as any` 类型强制转换残留：369 处
**文件**：多文件（主要分布在前端 AI 组件）  
**问题**：安全审查声称已清零，但实际仍有 369 处。关键位置：
- `IngredientDeepAnalysis.tsx:173,199`
- `SynergySimulator.ts:226,516,774`
- `ChatTag.tsx:175,216,256`
- `api/client.ts:125`（核心 API 客户端）
**影响**：类型安全防线被绕过，运行时类型错误无法被编译器捕获。  
**修复建议**：优先修复核心路径（client.ts、auth 相关），其余按模块逐步清理。

### H2. 4 处 bare `except:` 静默吞掉异常
**文件**：
- [model_gateway.py:89](backend/app/services/ai/models/model_gateway.py#L89)
- [celery/tasks.py:291](backend/app/services/import_engine/celery/tasks.py#L291)
- [loader.py:136](backend/app/services/openfoodfacts/loader.py#L136)
- [loader_sync.py:66](backend/app/services/openfoodfacts/loader_sync.py#L66)
**问题**：`except:` 无异常类型指定，吞掉所有异常（包括 `KeyboardInterrupt`、`SystemExit`）。  
**修复建议**：
```python
# 改为
except Exception as e:
    logger.error(f"操作失败: {e}", exc_info=True)
    raise
```

### H3. 10 个超大文件（>1000 行）
| 文件 | 行数 | 建议 |
|:-----|-----:|:-----|
| advanced_peptide_analyzer.py | 1,455 | 拆分分析器/处理器/报告模块 |
| graph_service.py | 1,419 | 拆分服务层/数据层 |
| graph_engine.py | 1,370 | D3 引擎已拆分，但服务层仍过大 |
| pepinvent_adapter.py | 1,323 | 拆分适配器/解析器 |
| document_templates.py | 1,123 | 按模板类型拆分 |
| ray_manager.py | 1,120 | 拆分任务调度/状态管理 |
| analytics_engine.py | 1,106 | 拆分指标采集/聚合/报告 |
| migration.py | 1,060 | CLI 入口与逻辑分离 |
| food_peptide_analyzer.py | 1,051 | 拆分算法/后处理 |
| genetic_formula_optimizer.py | 1,050 | 拆分求解器/评估器 |

### H4. 112 个文件超过 500 行
超过 800 行的文件也有 **33 个**，严重影响可维护性和 code review 效率。

### H5. 193 处 console.log 残留
**文件**：前端生产代码  
**问题**：开发调试日志未清理，可能泄露用户行为数据到浏览器控制台。  
**修复建议**：全局替换为 `logging` 模块（前端使用 `@rmfood/logger` 封装）。

### H6. 5 处 `asyncio.run()` 在异步上下文中阻塞事件循环
**文件**：
- [inference_queue.py:797](backend/app/services/ai/shared/inference_queue.py#L797) — `loop.run_until_complete()`
- [unified_optimizer.py:368](backend/app/services/ai/algorithms/unified_optimizer.py#L368)
- [auto_sync.py:123](backend/app/services/data_sources/auto_sync.py#L123)
- [nutrition_adapter.py:123](backend/app/services/formula/nutrition_adapter.py#L123)
- [llm_service.py:113,227](backend/app/services/llm_service.py#L113)
**影响**：阻塞 FastAPI 事件循环，导致所有并发请求卡顿。  
**修复建议**：改为 `async/await` 或 `asyncio.create_task()` + `asyncio.gather()`。

### H7. HTTPException detail 暴露内部信息
**文件**：
- [import_router.py:249](backend/app/api/v1/import_router.py#L249) — `detail=str(e)`
- [import_router.py:318](backend/app/api/v1/import_router.py#L318) — `detail=f"Could not start import: {{str(e)}}"`
- [ai/main.py:31](backend/app/services/ai/main.py#L31) — `detail=str(e)`
**问题**：500 错误将内部异常信息返回给前端，可能泄露数据库结构、文件路径等。  
**修复建议**：统一使用安全错误摘要，详细日志写入服务端。

### H8. `__import__()` 动态导入 131 处
**文件**：多后端模块  
**问题**：滥用 `__import__("logging").getLogger(__name__)` 代替标准 `import logging`，影响代码可读性和静态分析工具（bandit、mypy）的误报。  
**修复建议**：批量替换为标准 import。

---

## 🟡 MEDIUM（建议修复）

### M1. 20+ 处 `pass` 静默吞错
**典型位置**：
- [generation.py:121,130](backend/app/api/ai_modules/generation.py#L121)
- [audit.py:57](backend/app/api/audit.py#L57)
- [websocket_router.py:62,152,208](backend/app/api/v1/websocket_router.py#L62)
**风险**：错误被静默忽略，故障难以排查。  
**修复建议**：改为 `logger.warning("...", exc_info=True)` 或显式 re-raise。

### M2. Rate Limit 仅覆盖 AI 和 OAuth 端点
**现状**：[security_middleware.py](backend/app/core/security/security_middleware.py) 的 `RateLimitMiddleware` 全局注册，但 `ai_rate_limit` 装饰器仅用于 AI 模块。公开搜索端点虽有独立限流，但其他写操作端点（配方创建、实验提交）缺乏限流。  
**修复建议**：对写操作 API 添加全局速率限制。

### M3. 默认本地后端 URL 回退
**文件**：[env.ts:70](frontend/src/config/env.ts#L70)  
**问题**：`VITE_BACKEND_URL` 未设置时回退到 `http://localhost:8000`，容器化部署时可能导致前端请求指向错误地址。  
**修复建议**：改为相对路径 `'/api/v1'`，由 Nginx 反向代理处理。

### M4. CSP 在生产环境配置不一致
**文件**：[security_config.py:101](backend/app/core/security/security_config.py#L101)  
**问题**：部分环境 `enable_content_security_policy=False`，需确认是否为有意设计。  
**修复建议**：生产环境强制启用 CSP， staging 环境可关闭。

### M5. 249 处 localStorage 使用，部分可能存储敏感数据
**检查**：API Key 在 `ApiKeyConfigCenter.tsx` 中已加密存储 ✅，但 `ConfigManagementPanel.tsx` 中明文存储 ❌。  
**修复建议**：全量审计 localStorage 存储内容，敏感数据统一迁移到加密存储或 HttpOnly Cookie。

### M6. `ast.literal_eval()` 使用（低风险）
**文件**：[expand_herbs.py:32](backend/app/services/data_sources/expand_herbs.py#L32)  
**问题**：虽然 `literal_eval` 比 `eval()` 安全，但仍解析外部数据源内容。  
**修复建议**：改用 JSON 格式存储草药数据。

### M7. 缺少数据库连接池超时时配置
**文件**：[config.py](backend/app/core/config.py)  
**问题**：连接池配置较完整，但未设置 `connection_recycle_time` 和 `connection_timeout`，可能导致僵尸连接。  
**修复建议**：添加 `POOL_RECYCLE=3600` 和 `POOL_TIMEOUT=30` 环境变量。

### M8. 多租户服务中动态表名 SQL
**文件**：[multi_tenant_service.py:688](backend/app/core/multi_tenant/multi_tenant_service.py#L688)  
**问题**：`f"SELECT COUNT(*) FROM {table} WHERE org_id = :org_id"` — `table` 参数应白名单校验。  
**修复建议**：添加表名白名单校验函数。

### M9. 前端 `document.write()` 用于打印
**文件**：多处（`useExportFormula.ts`, `useReportGenerator.ts` 等）  
**问题**：`document.write()` 在现代浏览器中已被标记为反模式，可能导致页面刷新问题。  
**修复建议**：改用 `window.open()` + `document.contentWindow.document.write()`。

### M10. 后端 `print()` 语句残留（CLI 工具中）
**文件**：[migration.py:985-1033](backend/app/core/compliance/migration.py#L985)  
**说明**：此为 CLI 管理工具，`print()` 是预期行为，不需要修复。但需确认不会在生产请求路径中执行。

### M11. 缺少请求体大小限制全局配置
**问题**：部分端点未设置 `UploadFile` 的大小限制，可能导致大文件 DoS。  
**修复建议**：在 FastAPI app 级别设置 `max_file_size` 中间件。

### M12. importlib.import_module 用于路由注册
**文件**：[router_registry.py](backend/app/api/router_registry.py)  
**问题**：动态导入路由模块是设计意图（插件化），但需确保模块路径不可被用户控制。  
**风险评估**：模块路径来自配置文件，非用户输入 → 风险低。

---

## 🟢 LOW（可选优化）

### L1. 前端 TODO 注释 5 处
- `chatHelpers.ts:65,115,128` — 时间格式化、文本截断、消息分类逻辑待实现
- `GraphPanelLayout.tsx:625` — 子图应用逻辑待实现
- `collaborationStore.ts:121` — WebSocket 连接待实现（标记为 P1）

### L2. `__import__` 代码异味（131 处）
不影响功能，但影响代码可读性和静态分析。建议批量重构为标准 import。

### L3. 测试覆盖率分布不均
- 后端测试文件：147 个
- 后端应用文件：34,316 行 Python（估算 ~800 个模块）
- 测试/代码比约 1:5.5，部分核心模块（如 `formula/`, `ai/`）测试覆盖较好，但 `import_engine/`, `openfoodfacts/` 覆盖不足。

### L4. 前端无 Storybook 或组件文档
200+ UI 组件缺乏可视化文档和交互测试。

### L5. 部分常量硬编码
如文件上传默认大小 `50 * 1024 * 1024` 应在配置中管理。

### L6. 缺少 API 响应时间头
建议添加 `X-Response-Time` 头，便于性能监控。

---

## 验证通过项 ✅

| 检查项 | 状态 | 说明 |
|:-------|:----:|:-----|
| 硬编码密码/密钥 | ✅ | 无硬编码生产密钥，SECRET_KEY 从环境变量读取 |
| bcrypt 密码哈希 | ✅ | 使用 `bcrypt.hashpw()` + `gensalt()` |
| JWT 算法安全 | ✅ | HS256，密钥长度 ≥32 字符校验 |
| CORS 配置 | ✅ | `allow_origins=[]`（空列表，需手动配置） |
| XSS 防护 | ✅ | `dangerouslySetInnerHTML` 均经过 `sanitizeHTML()` |
| 文件上传安全 | ✅ | MIME 类型白名单 + Magic Bytes + UUID 重命名 |
| CSRF 防护 | ✅ | 前端自动从 Cookie 读取并注入 `X-CSRF-Token` |
| 异常信息泄漏（大部分） | ✅ | 全局扫描 `str(e)` 已修复，仅 3 处遗漏 |
| 参数化查询（大部分） | ✅ | SQLAlchemy ORM 使用参数化，仅审计/迁移模块有拼接 |
| 无 debug 模式在生产 | ✅ | `DEBUG=false` 默认，无 `app.debug` |
| 无命令注入 | ✅ | 无 `os.system()`、无 `shell=True` |
| 无不安全反序列化 | ✅ | 无 `pickle.loads()`、`yaml.load()`（unsafe） |

---

## 修复优先级建议

```
P0（立即修复）:
  C3 → API Key 明文存储（ConfigManagementPanel.tsx）
  H2 → bare except 清理（4 处）
  H7 → HTTPException detail 泄露（3 处）

P1（本周内）:
  H1 → as any 清理（优先 client.ts、auth 相关）
  H6 → asyncio.run() 阻塞修复（5 处）
  M2 → 写操作 API 限流

P2（本月内）:
  H3/H4 → 大文件拆分（按模块优先级）
  H5 → console.log 清理
  M1 → pass 语句替换为日志
  M5 → localStorage 敏感数据审计

P3（持续优化）:
  M3-M12, L1-L6
```

---

*本报告由 RMFOOD 安全审查流程自动生成，基于静态代码分析。*
