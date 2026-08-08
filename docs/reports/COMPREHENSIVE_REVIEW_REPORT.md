# RMFOOD 全栈专家级综合审查报告

> 审查日期: 2026-07-09
> 审查范围: 后端(FastAPI)、前端(React+TypeScript)、安全、基础设施、数据库
> 审查方法: 四维度并行专家审查 + 交叉验证

---

## 一、审查总览

| 维度 | 代理 | 严重问题 | 高风险 | 中等 | 低危 | 总分 |
|------|------|---------|--------|------|------|------|
| 后端架构 | code-reviewer | 1 | 6 | 8 | 4 | WARNING |
| 前端架构 | code-reviewer | 0 | 4 | 6 | 3 | INFO |
| 安全扫描 | security-reviewer | 4 | 9 | 10 | 7 | BLOCK |
| 基础设施 | architect | 2 | 2 | 7 | 5 | WARNING |
| **合计** | | **7** | **21** | **31** | **19** | |

---

## 二、CRITICAL 问题（必须立即修复）

### 后端

| # | 问题 | 文件 | 行号 | 影响 |
|---|------|------|------|------|
| 1 | 缺少 `import os` | `backend/app/api/v1/ray_router.py` | 889-901 | `check_ray_availability()` 调用时直接 `NameError` 崩溃 |
| 2 | `analytics.py` 认证绕过 | `backend/app/api/analytics.py` | 28, 417 | 未认证请求返回 `None` 而非 401，随后 `AttributeError` 500 崩溃 |
| 3 | `peptide_analysis_routes.py` 未定义变量 | `backend/app/api/peptide_analysis_routes.py` | 330 | Excel 导出端点直接 `NameError` 崩溃 |
| 4 | `ingredients.py` 异常处理器中创建 logger | `backend/app/api/ingredients.py` | 134, 188 | 异常处理本身崩溃，错误信息丢失 |

### 安全

| # | 问题 | 文件 | 影响 |
|---|------|------|------|
| 5 | `lab_validation.py` 多个端点无认证 | `backend/app/api/lab_validation.py` | 276-331, 392-459 | 实验数据、统计面板公开暴露 |
| 6 | Webhook 测试端点 SSRF | `backend/app/api/integrations.py` | 219-271 | 可探测内网、云元数据 |
| 7 | SSE 流 CORS 通配符 | `backend/app/api/v1/mo_stream_endpoint.py` | 182 | 跨域读取认证数据 |
| 8 | `.env` 文件含真实密码 | `backend/.env` | 多处 | 数据库密码、JWT 密钥泄露 |

### 基础设施

| # | 问题 | 文件 | 影响 |
|---|------|------|------|
| 9 | CI/CD SSH 以 root 登录 | `.github/workflows/ci-cd.yml` | 273 | 违反最小权限原则 |
| 10 | CI/CD 禁用 SSH host key 验证 | `.github/workflows/ci-cd.yml` | 306 | MITM 攻击风险 |

---

## 三、HIGH 问题（强烈建议修复）

### 后端

| # | 问题 | 文件 | 修复建议 |
|---|------|------|----------|
| 1 | `regex` 参数已废弃 | `formula_integration.py:137`, `lab_validation.py:36,278-279`, `ray_router.py:80`, `utils.py:174` | 替换为 `pattern=` |
| 2 | `analytics.py` 绝对导入 | `backend/app/api/analytics.py:27-40` | 改为 `from ..core.session import get_db` |
| 3 | `analytics.py` 内联 `__import__("uuid")` | `backend/app/api/analytics.py:411` | 顶部 `import uuid` |
| 4 | 双重认证函数语义混乱 | `app.api.deps` vs `app.services.auth` | 统一使用 `get_current_active_user` |
| 5 | `formula_integration.py` 部分端点缺 `db` 依赖 | `backend/app/api/formula_integration.py:200,238,303,358,403,459` | 添加 `db: AsyncSession = Depends(get_db)` |

### 前端

| # | 问题 | 文件 | 修复建议 |
|---|------|------|----------|
| 1 | 双重 auth store 冲突 | `stores/auth.ts` vs `stores/persisted.ts` | 移除 `persisted.ts` 中的 `useAuthStore` 定义 |
| 2 | `clearAllPersistedState` 清除错误存储 | `stores/persisted.ts:397-413` | 修正各 key 对应的 storage 类型 |
| 3 | Zustand store 中使用 `process.env` | `stores/persisted.ts:357` | 改为 `import.meta.env.DEV` |
| 4 | 模块级副作用注入样式 | `MarkdownRenderer.tsx:1570` | 移至 `useEffect` |

### 安全

| # | 问题 | 修复建议 |
|---|------|----------|
| 1 | 多处 `detail=str(e)` 泄露内部细节 | 返回通用错误消息，服务端记录详情 |
| 2 | RAG 上传端点无认证 | 添加 `current_user` 依赖 |
| 3 | 成分统计端点无认证 | 评估是否需要公开 |
| 4 | 大量使用 `__import__()` 内联导入 | 规范化模块导入 |

### 基础设施

| # | 问题 | 修复建议 |
|---|------|----------|
| 1 | Docker 构建上下文过大 | 创建 `.dockerignore` |
| 2 | Nginx `add_header X-XSS-Protection` 已废弃 | 移除该 header |
| 3 | `--forwarded-allow-ips` 缺少值 | 改为 `"*"` |
| 4 | Nginx `proxy_read_timeout 86400` | 降至 3600 |
| 5 | CI/CD 回滚逻辑为空 | 实现实际回滚脚本 |

---

## 四、MEDIUM 问题

### 后端

| # | 问题 | 文件 |
|---|------|------|
| 1 | `analytics.py` 类型注解不匹配 | `dict` vs `User` |
| 2 | 参数名 `range` 遮蔽 Python 内置 | `analytics.py:81` |
| 3 | 过多 `logger.info` 在请求处理器中 | `analytics.py:122,159,300...` |
| 4 | `custom_aggregation` 接受 `Dict` 无校验 | `analytics.py:625` |
| 5 | 路由注册系统重复（lazy loading + router registry） | `api/__init__.py` vs `router_registry.py` |

### 前端

| # | 问题 | 文件 |
|---|------|------|
| 1 | `ErrorBoundary` 直接使用 `console.error` | 绕过安全脱敏 |
| 2 | `LazyLoad.tsx` 多处 `as any` | 丧失类型安全 |
| 3 | `api/client.ts` 拦截器 `as any` | 响应类型断裂 |
| 4 | `academicReportStore.ts` 直接读写 localStorage | 绕过 Zustand 中间件 |
| 5 | `SettingsPage.tsx` 3579 行 | 需拆分 |
| 6 | `KnowledgeGraph.tsx` 6398 行 | 需拆分 |
| 7 | `MultiObjectivePanel.tsx` 2508 行 | 需拆分 |

### 安全

| # | 问题 |
|---|------|
| 1 | JWT 仅 HS256 |
| 2 | Refresh Token 30 天有效期 |
| 3 | 速率限制白名单仅 `127.0.0.1` |
| 4 | WebSocket 无数限 |
| 5 | Swagger UI 在 debug 模式下暴露 |

### 基础设施

| # | 问题 |
|---|------|
| 1 | `.env.example` 含默认凭据 |
| 2 | `docker system prune -f` 过于激进 |
| 3 | 覆盖率阈值 75% 低于 80% 标准 |
| 4 | 无日志轮转/集中日志 |
| 5 | 无告警集成 |

---

## 五、LOW 问题

- `Math.random()` 用于 session ID（应使用 `crypto.randomUUID()`）
- `datetime.utcnow()` 已废弃（Python 3.12+）
- ESLint `i18next` 规则对 `console.*` 放行
- `ErrorBoundary` 使用 `alert()` 阻塞对话框
- Swagger UI 的 `X-XSS-Protection` 头已废弃

---

## 六、亮点（做得好的地方）

### 后端
- JWT 使用 HttpOnly + SameSite=Strict Cookie 存储
- bcrypt 密码哈希 + 账户锁定机制
- Token 轮换 + 重用检测
- 安全头中间件（HSTS, CSP, X-Frame-Options）
- 速率限制（滑动窗口算法）
- 多租户行级安全（ContextVar 隔离）
- 输入脱敏（SQL 注入/XSS 检测）
- 结构化 JSON 日志 + 敏感数据掩码
- Docker 非 root 用户运行
- Prometheus 指标 + 健康检查端点

### 前端
- TypeScript 严格模式全开
- 零 `any` 类型（ESLint 强制执行）
- 零 `console.log`（生产构建自动 drop）
- 零 `dangerouslySetInnerHTML`（XSS 面积极小）
- Axios 拦截器正确处理 401 token 刷新
- React Query 合理配置（重试、staleTime、refetch）
- 路由级代码分割 + 手动 chunk 分组
- 内容安全工具（HTML 消毒、URL 验证）

### 数据库
- PostgreSQL 18 运行正常
- 72 张表结构完整
- 种子数据已导入（289 药材 + 7540 肽段 + 327 MMID）
- Alembic 迁移已升级到 head

---

## 七、修复优先级建议

### 立即修复（本次迭代）
1. 修复 `ray_router.py` 缺失 `import os`
2. 修复 `peptide_analysis_routes.py` 变量名 `records` → `items`
3. 修复 `analytics.py` 认证导入 + 类型注解
4. 修复 `ingredients.py` logger 位置
5. 为 `lab_validation.py` 端点添加认证
6. 修复 webhook SSRF（IP 白名单）

### 本周修复
7. 替换所有 `regex=` → `pattern=`
8. 移除 `persisted.ts` 中重复 auth store
9. 修复 `clearAllPersistedState` 存储类型
10. 修复 CI/CD SSH 安全性
11. 清理 `.env` 中的硬编码密钥

### 下季度优化
12. 拆分超大组件（SettingsPage 3579 行、KnowledgeGraph 6398 行）
13. 统一路由注册系统
14. 创建 `.dockerignore`
15. 添加告警集成
16. 数据库 schema 与模型对齐（Alembic autogenerate 检测到的差异）
