# 仪表盘 API 与服务层设计文档

> 对应源码：`frontend/src/api/{dashboard,activity,notifications,aiInsights}.ts`、`frontend/src/hooks/{useQueries,useAIInsights}.ts`、`frontend/src/services/{exportService,websocket}.ts`、`backend/app/api/{dashboard,activity,notifications}.py`
> 定位：仪表盘的**数据接入层**——前端 API 封装、React Query 数据流、后端端点契约、导出服务、测试基线。

---

## 1. 前端 API 封装

### 1.1 端点封装（api/*.ts）

| 模块 | 方法 | 端点 | 返回类型 |
|---|---|---|---|
| `dashboardApi` | `getStatistics()` | `GET /dashboard/statistics` | `DashboardStatistics`（formulas/experiments/users + recent_activity[30]） |
| `dashboardApi` | `getTrends(period)` | `GET /dashboard/trends?period=7d\|30d\|90d` | `DashboardTrends` |
| `activityApi` | `timeline(days, signal?)` | `GET /activity/timeline` | `{items: TimelineEvent[], total}` |
| `activityApi` | `todos(signal?)` | `GET /activity/todos` | `{items: TodoItem[], total}` |
| `activityApi` | `reviewQueue(signal?)` | `GET /activity/review-queue` | `{items: ReviewQueueItem[], total}` |
| `notificationApi` | `list(params?)` | `GET /notifications` | `{items, total, unread_count}` |
| `notificationApi` | `markRead(ids?)` | `POST /notifications/mark-read` | — |
| `notificationApi` | `unreadCount()` | `GET /notifications/unread-count` | `{count}` |
| `aiInsightsApi` | `getInsights / getPredictions / getKPIProgress` | 前端派生（statistics + trends） | `AIInsight[] / TrendPrediction[] / KPIProgress[]` |
| `AIAnalysisPanel` | 4 个 POST | `/ai/analyze/formula`、`/ai/recommend/formulas`、`/ai/predict/trends`、`/ai/analyze/experiment` | 见 03 文档 |

**约定**：所有封装 `.then(r => r.data)` 拆包响应体；调用 `apiClient`（axios 实例，统一 baseURL + HttpOnly Cookie 认证 + 401 跳转）。

### 1.2 数据模型

```ts
// dashboard.ts
interface DashboardStatistics {
  formulas:   { total: number; by_status: Record<string, number> }
  experiments:{ total: number; by_status: Record<string, number> }
  users:      { total: number; by_role:   Record<string, number> }
  recent_activity: { date: string; formulas: number; experiments: number }[]
}
interface DashboardTrends {
  period: string
  data: { date: string; formulas_created: number; experiments_created: number; formulas_approved: number }[]
}

// activity.ts
interface TimelineEvent { id; type: 'formula'|'experiment'|'category'|'term'; title; status; created_at; event }
interface TodoItem      { id; type: 'review_formula'|'active_experiment'|'planned_experiment'; title; detail; priority: 'high'|'medium'|'low'; created_at }
interface ReviewQueueItem{ id; name; code; creator_name; target_effects: string[]; submitted_at }
```

**状态字典（STATUS_CONFIG.labels，全端共享）**：
```
draft 草稿 / pending_review 待审核 / approved 已通过 / rejected 已驳回 / archived 已归档
planned 计划中 / in_progress 进行中 / completed 已完成 / failed 已失败 / cancelled 已取消
```
后端 `by_status` 的键稳定填充（缺省 0），保证前端 `STATUS_LABELS[status]` 取值不 undefined。

---

## 2. React Query 数据流（hooks）

### 2.1 Hook 清单

| Hook | queryKey | staleTime | 备注 |
|---|---|---|---|
| `useDashboardStatistics` | `['dashboard-statistics']` | 5min | 首屏阻塞 |
| `useDashboardTrends(period)` | `['dashboard-trends', period]` | 5min | 首屏阻塞（固定 30d） |
| `useFormulas(params)` | `['formulas', params]` | 默认 | 首屏取前 5 |
| `useExperiments(params)` | `['experiments', params]` | 默认 | 首屏取前 5 |
| `useQuery(['activity-timeline'])` | `['activity-timeline']` | 5min | `enabled: !statsLoading && !trendsLoading`（延迟） |
| `useQuery(['activity-todos'])` | `['activity-todos']` | 5min | 同上 |
| `useQuery(['activity-review-queue'])` | `['activity-review-queue']` | 5min | 同上 |
| `useQuery(['ai-insights'])` | `['ai-insights']` | 5min | 同上（派生逻辑在 api 层） |
| `useAIInsights / useAIPredictions / useKPIProgress` | 各自 key | 5min | AI 卡片内部消费（与页面级 key 重叠 ⚠️ P1-11：`ai-insights` 被页面与卡片各查一次） |

### 2.2 加载编排

```
挂载
 ├─ 并行：statistics + trends + formulas(5) + experiments(4 个 query)  → isInitialLoading
 └─ 延迟（关键数据就绪后）：timeline / todos / review-queue / ai-insights
      → 卡片级 loading（卡片骨架，不再整页骨架）
刷新按钮：refetchStats + refetchFormulas + refetchExperiments + refetchAIInsights（4 路）
各卡片 onRetry：对应 query 的 refetch（卡片级隔离）
```

### 2.3 mutation 依赖（仪表盘触发路径）

`useCreateFormula / useUpdateFormula / useSubmitFormula / useReviewFormula / useCreateExperiment` 均在 onSuccess 中 `invalidateQueries(['formulas'])` 或 `(['experiments'])`，使最近列表与统计随之刷新（仪表盘「待审核」完成后自动退出队列）。

---

## 3. 后端端点契约

### 3.1 实现要点（backend/app/api/dashboard.py）

- **text() 原生 SQL**：规避 ORM Enum ↔ varchar 列不匹配（ADR 级决策，注释已说明）。
- **状态分布 0 值填充**：`FORMULA_STATUS_DEFAULTS`（draft/pending_review/approved/published/rejected/archived）、`EXPERIMENT_STATUS_DEFAULTS`（planned/in_progress/completed/failed/cancelled）、`USER_ROLE_DEFAULTS`（guest/researcher/formulator/reviewer/admin）→ 保证前端键稳定。
- **性能问题（P1-12）**：`/trends` 逐日循环执行 3 条 SQL ×N 天（30d = 90 次往返、90d = 270 次）；`/statistics` 的 recent_activity 同模式（90 次）。建议改写为单条 `GROUP BY date(created_at)` 聚合查询。
- **时区**：naive datetime 匹配 `TIMESTAMP WITHOUT TIME ZONE` 列，无时区处理（跨时区团队使用时需统一 UTC）。

### 3.2 activity（backend/app/api/activity.py）

- **timeline**：聚合 4 类实体（Formula / Experiment / TermCategory / Term）近 N 天 `updated_at` 事件，按时间倒序合并；实验事件类型智能判定（当天=开始日→「实验开始」、当天=结束日→「实验完成」）。
- **todos**：角色聚合——reviewer/admin 可见待审核配方（high 优先级）；本人进行中实验（medium）+ 计划中实验（low，按 start_date 升序）。
- **review-queue**：`PENDING_REVIEW` 配方 + 创建人姓名（N+1 查询 `db.get(User, f.creator_id)`，P2 建议 `JOIN users` 批量化）+ target_effects。

### 3.3 notifications（v1）

`backend/app/api/v1/notification_router.py`（前缀 `/notifications`）：列表、标记已读、未读数；WebSocket 频道 `/api/v1/ws/notifications/{team_id}`（团队级推送）。

### 3.4 AI 端点（AIAnalysisPanel 消费）

`POST /ai/analyze/formula` 等 4 端点；请求体与响应结构见 03 文档。失败（401/500/网络）时前端 mock 兜底——**后端不可用 ≠ 面板不可用**，是有意设计。

---

## 4. 导出服务（services/exportService.ts）

### 4.1 能力矩阵

| 格式 | 实现 | 选项 |
|---|---|---|
| CSV | `csvEscape` + BOM（Windows Excel 兼容 `addBOM`） | 分隔符（`,`/`;`/Tab）、编码 |
| XLSX | `excelUtils`（列宽计算/拼音排序/分块处理/内存估算/流式导出） | 工作表名、表头 |
| JSON | 原生 | 缩进 0-4、字段过滤 |
| PDF | `pdfExportService` | 页面大小（a4/letter）、方向、边距 |
| PNG | 截图 | 缩放 1-3x、质量 0.9、背景色 |

### 4.2 任务与历史

- `ExportTask{id, format, filename, status(pending/processing/completed/failed), createdAt, completedAt?, fileSize?, error?, downloadUrl?}`
- 进度追踪：`ExportProgressTracker`（prepare → process → complete 阶段百分比回调）
- `exportHistory`（`utils/encodingUtils`）记录历史；`ExportManager` 卡片每 1s 轮询 `getHistory()`（⚠️ P2-03：应改事件/订阅）。
- 分块处理：`shouldUseChunkProcessing` 大数据量自动切块 + `measureExportPerformance`。

### 4.3 页面级导出（DashboardPage.handleExportDashboard）

独立于 ExportManager：CSV 下载 `仪表盘数据_<日期>.csv`，行结构 `类别,名称,数值`（配方/实验总数 + 各状态明细，0 值过滤），**macOS 不加 BOM / Windows 加 BOM**（`navigator.userAgent` 判定）——跨平台 Excel 兼容细节。

---

## 5. 认证与安全边界

| 项 | 设计 |
|---|---|
| REST 认证 | HttpOnly Cookie（axios 自动携带）；未登录 → 401 → 前端跳转登录 |
| WebSocket 认证 | 同源 Cookie 自动携带（**明确不通过 URL token**，P0 安全修复注释）；未认证直接跳过连接 |
| 后端不可达防护 | 连续 5 次失败 → 5 分钟重连熔断 + sessionStorage 持久化（防 HMR 后重试风暴） |
| 日志去重 | 同一重连周期 10s 内错误只记录一次 |
| 布局配置 | localStorage 结构白名单校验（防脏数据注入异常卡片类型） |

---

## 6. 已知问题与改进建议

| 编号 | 问题 | 优先级 | 建议 |
|---|---|---|---|
| API-01 | `/trends`、`/statistics.recent_activity` 逐日循环 N 条 SQL | P1 | 单条 `GROUP BY date(created_at)` 聚合；90d 场景 DB 压力降 99% |
| API-02 | review-queue N+1 查询创建人 | P2 | `JOIN users ON creator_id` 一次取回 |
| API-03 | `ai-insights` queryKey 在页面与 AIInsights 卡片各注册一次（重复请求） | P1 | 卡片内改用 `useQueryClient().getQueryData` 或共享 key 且仅卡片消费 |
| API-04 | ExportManager 1s 轮询任务历史 | P2 | 导出完成事件回调 / `useSyncExternalStore` |
| API-05 | `DashboardStatistics.users` 前端未消费（统计卡仅配方/实验） | P3 | 预留「用户角色分布」卡片（`stats-users`） |
| API-06 | 时间线/待办/审核队列延迟加载依赖「首屏四 query 完成」而非各自失败态 | P3 | 失败时仍允许延迟数据加载（解除 enabled 对 error 的依赖） |
| API-07 | AI 端点 mock 兜底掩盖后端不可用 | P1 | mock 数据打「模拟」标识（见 03 文档 A-04） |

---

## 7. 测试基线

| 层级 | 现状 | 建议 |
|---|---|---|
| 单元测试 | `DashboardConfigManager.test.ts`（布局 CRUD/校验/共享） | 补：aiInsights 规则边界（03 文档 §6）、KPI 数值口径、CSV BOM 平台判定 |
| 组件测试 | 卡片层无独立用例 | 补：StatsCards statIndex 注入回归（P0-01）、ErrorCard onRetry、TodoList 优先级路由 |
| API 契约 | 无 | 补：mock server 断言 `by_status` 0 值填充 + period 枚举校验（7d/30d/90d 正则） |
| 集成 | — | 仪表盘首屏加载路径（4 并发 query + 延迟 query 触发时序）e2e |
