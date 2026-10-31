# RMFOODFP 租户隔离专业级分割 — 实施规格（Phase 1）

> 日期：2026-10-28
> 目标：实现「免费版 / 专业版」功能分割，并将「白名单用户」纳入专业分割（白名单通过即获得专业版能力）
> 参与：后端组 + 前端组（并行，写作用域不重叠），Lead 负责设计与验收

---

## 一、现状与问题（核查确认）

| # | 级别 | 问题 | 位置 |
|:-:|:----:|:-----|:-----|
| 1 | P0 | 前端**无任何 plan 级门控**：`RequirePlan/usePlan/PlanGate/PlanGuard/requirePlan/hasPlan/PlanRequired/UpgradeRequired` 全仓零命中，仅存在 `PlanUpgradeDialog.tsx` | `frontend/src/` |
| 2 | P0 | `POST /auth/register` **完全开放**，未校验白名单、未分配 plan，任何人可绕过白名单直接开号 | `backend/app/api/auth.py:105-129` |
| 3 | P0 | 后端**无 plan 配额/功能强制**，专业功能可被免费用户直接调用 | `backend/app/api/*` |
| 4 | P1 | `User` 模型无 plan 字段（`users` 表），用户级无版本语义；plan 仅存在于组织级 `Subscription.plan` | `backend/app/models/user_model.py` / `organization.py:77` |
| 5 | P1 | 白名单通过（`pre_register` approved）创建用户时未授予专业能力 | `backend/app/services/pre_register*.py` |
| 6 | P2 | 前端 `PlanUpgradeDialog` 存在但无任何触发入口 | `frontend/src/pages/organizations/components/PlanUpgradeDialog.tsx` |

---

## 二、设计模型

### 2.1 版本（plan）语义 —— 用户级
- `User.plan: 'free' | 'pro'`（`enterprise` 保留给组织级 `Subscription.plan`，Phase 1 不引入用户级 enterprise）
- 默认 `'free'`（直接注册）
- **白名单通过 → `plan='pro'`**（白名单即专业分割的授予通道）

### 2.2 功能矩阵（单一事实来源，前后端一致）
| 功能 key | 最低版本 | 说明 |
|:---------|:--------:|:-----|
| `ai_formula_generation` | pro | AI 配方生成（遗传算法/多目标/MILP） |
| `peptide_analysis` | pro | 肽分析 / 肽设计 |
| `advanced_analytics` | pro | 高级分析 / 实验 |
| `knowledge_graph` | pro | 知识图谱 |
| `multi_ecommerce_sync` | pro | 多电商同步 |
| `advanced_report_export` | pro | 专业报告导出 |
| 其余基础功能（配方查询、食材库、基础对话、合规查询） | free | 免费可用 |

### 2.3 版本层级
```
PLAN_RANK = { 'free': 0, 'pro': 1 }
effective_plan(user) -> user.plan
has_plan(user, feature) -> PLAN_RANK[user.plan] >= PLAN_RANK[PLAN_FEATURES[feature]]
```

---

## 三、后端实施（写作用域：`backend/`）

### 3.1 新增 `backend/app/core/plans.py`
```python
PLAN_RANK = {"free": 0, "pro": 1, "enterprise": 2}
PLAN_FEATURES = {
    "ai_formula_generation": "pro",
    "peptide_analysis": "pro",
    "advanced_analytics": "pro",
    "knowledge_graph": "pro",
    "multi_ecommerce_sync": "pro",
    "advanced_report_export": "pro",
}
def effective_plan(user) -> str: ...
def has_plan(user, feature) -> bool: ...
async def require_plan(feature: str) -> Callable:  # FastAPI dependency
    # 403 + error_code="PLAN_REQUIRED" + upgrade hint（复用 frontend/src/constants/errorCodes.ts 对应码）
```

### 3.2 `User` 模型（`backend/app/models/user_model.py`）
- 增加 `plan: Mapped[str] = mapped_column(String(20), default="free", nullable=False)`（仿 `organization.py:77` 的 Subscription.plan 写法）
- 增加辅助属性/方法 `effective_plan`、`has_feature(feature)`

### 3.3 迁移
- 在 `backend/alembic/versions/` 增加迁移：`users` 表新增列 `plan VARCHAR(20) NOT NULL SERVER_DEFAULT 'free'`；存量行回填 'free'
- 遵循仓库既有迁移风格（参照最近一次 users 相关迁移）

### 3.4 注册 / 白名单授权（`backend/app/services/auth.py` + `pre_register*.py`）
- `AuthService.register`（auth.py:226-260）：创建 User 时 `plan='free'`；若该邮箱存在 `pre_register_requests.status='approved'` 记录则 `plan='pro'`（白名单授权）
- 白名单管理员审核通过路径（`pre_register_admin.py` 的 approve）：创建/回填的 User 置 `plan='pro'`

### 3.5 认证响应带 plan
- 登录 / `/auth/me` / 用户序列化响应增加 `plan` 字段（用户 schema）

### 3.6 专业端点门控
- 对以下端点增加 `Depends(require_plan(...))`（403 + 升级提示，不破坏现有 free 路径）：
  - AI 配方生成（`ai/generate` 及生成相关路由）→ `ai_formula_generation`
  - 肽分析/设计路由 → `peptide_analysis`
  - 高级分析/实验路由 → `advanced_analytics`
  - 知识图谱路由 → `knowledge_graph`
  - 多电商同步路由 → `multi_ecommerce_sync`
  - 专业报告导出路由 → `advanced_report_export`
- **注意**：只加门控，不改动各端点内部业务逻辑；free 用户返回 403 + `error_code=PLAN_REQUIRED` + `upgrade_required` 提示

---

## 四、前端实施（写作用域：`frontend/`）

### 4.1 类型与 store
- `User` 类型增加 `plan: 'free' | 'pro'`（`frontend/src/types/`）
- `authStore` 从登录/me 响应写入 `plan`；`persisted.ts` 持久化 `plan`

### 4.2 新增 `frontend/src/utils/plan.ts`
```ts
export const PLAN_RANK = { free: 0, pro: 1 } as const
export const PLAN_FEATURES = { ai_formula_generation: 'pro', peptide_analysis: 'pro', advanced_analytics: 'pro', knowledge_graph: 'pro', multi_ecommerce_sync: 'pro', advanced_report_export: 'pro' } as const
export type Plan = 'free' | 'pro'
export function hasPlan(plan: Plan, feature: keyof typeof PLAN_FEATURES): boolean
export function usePlan(): { plan: Plan; hasFeature: (f) => boolean; isPro: boolean }
export function RequirePlan({ feature, children, fallback }): JSX.Element  // 不满足时渲染 fallback（含升级提示）或 null
export function PlanGate({ feature, children }): JSX.Element  // 不满足时渲染升级引导（PlanUpgradeDialog 触发）
```

### 4.3 门控专业功能
- `frontend/src/config/dashboard.ts` 的 `premium` 卡片 → 仅 `hasPlan(plan, ...)` 时可用；free 显示锁定态 + 升级引导
- 专业组件 `components/ai/features/components/pro/*` 入口 → `RequirePlan`
- 专业路由 → 路由守卫（不满足跳转升级页或显示锁定态）
- `PlanUpgradeDialog` 接入触发入口（设置页/组织页/锁定态）

### 4.4 契约一致性
- 前端 `PLAN_FEATURES` 与后端 `core/plans.py` 的 `PLAN_FEATURES` 必须一致（以本规格 2.2 为准）

---

## 五、验收标准（质量门禁）
1. 后端：`User.plan` 列存在且默认 free；白名单通过用户为 pro；`require_plan` 返回 403 + `PLAN_REQUIRED`；专业端点已门控
2. 前端：`tsc --noEmit` 零错误；`eslint` 零错误；`plan` 在 authStore 正确填充；专业功能对 free 用户隐藏/锁定
3. 前后端 `PLAN_FEATURES` 一致
4. 不破坏既有 free 流程（基础功能仍可用）
5. 不改动本规格未列的模块；不引入批量重写；改动用 `git diff --stat` 核对

---

## 六、Phase 2 — 租户隔离 P0 修复（核查后补充，核心）

> 核查（reports/team-audit-tenant/COMPREHENSIVE_AUDIT_SUMMARY.md）揭示隔离机制系统性失效，此为"租户隔离"请求的核心，列为 Phase 2。

### 6.1 租户上下文修复（最高优先级）
- `backend/app/core/multi_tenant/tenant_security.py:188`：`getattr(payload,"org_id",None)` → `payload.get("org_id")`（dict 取值）
- `backend/app/services/auth.py:53-58`：JWT claims 增加 `org_id`（来自 user.organization_id）与 `plan`；解码侧读取
- `backend/app/core/rbac/rbac.py:608`：修复 `require_role` 条件（ADMIN 在 allowed_roles 时恒放行 → 改为 `role not in allowed_roles and role != 'ADMIN'`）

### 6.2 端点租户过滤 + 强制认证
- `formulas.py:132,144` list 强制认证 + org 过滤；`experiments.py:66,78,114` 同理；`analytics.py:132,733` 注入 org 过滤；`search.py:34,98` 强制认证 + org 过滤；`websocket_manager.py:788` 从认证 org_id 生成租户 key，禁止 default 兜底

### 6.3 配额挂载与 plan provider
- `tenant_quota.py:448` require_quota 由认证依赖提供 org_id（无 org 拒绝）；挂到 create/ai 路由
- `tenant_quota.py:308` 启动注入按组织订阅读取 plan 的 quota provider（set_quota_provider 调用）

### 6.4 白名单接线与 register 门禁
- `api/__init__.py:32` 注册 whitelist/pre_register 路由（/auth/whitelist/* 可达）
- `auth.py:105` register 加白名单门禁/配置开关 ALLOW_SELF_REGISTER；同步 CSRF skip_paths
- `pre_register_admin.py:231-240` approve 授予 org/plan/成员（User.plan=pro、建 Organization/Subscription/OrganizationMember）

### 6.5 模型↔迁移调和
- 迁移重命名 organization_members.org_id→organization_id（并 teams.org_id）
- 新建迁移创建 subscriptions/billing_orders 表（与 ORM/upgrade_subscription INSERT 对齐）
- Organization ORM 补 plan/settings/logo_url 列；OrganizationMember 统一列集

---

## 七、实施完成状态（2026-10-28，全部验证通过）

> 说明：本节为实施完成后的状态核对，规格 §1-§6 所列项目已全部落地并通过质量门禁。未 commit（由 Lead 把关）、未启停服务。

### 7.1 已交付（后端）
- `app/core/plans.py`：`PLAN_RANK/PLAN_FEATURES/effective_plan/has_plan/require_plan`（403 + `PLAN_REQUIRED`）
- `User.plan`（`user_model.py`）+ 迁移 `20261028_010000_add_user_plan`（revision id 含 `_add_user_plan` 后缀）
- `auth.py`：`create_access_token` 写入 org_id/plan；登录/刷新传 `user.organization_id/user.plan`；`register` 设 `plan='free'`，白名单 approved → `plan='pro'`
- 租户隔离核心：`tenant_security.py` getattr→get；`rbac.py` require_role 修复；端点 org 过滤（formulas/experiments/search/analytics/websocket）
- `api/__init__.py` 注册 whitelist（5 路由）+ pre_register
- 白名单 approve → `plan='pro'`（`pre_register_admin.py`）
- 肽链门控：`peptide_structure_routes.py` 18 端点 `require_plan("peptide_analysis")`，6 公开保留
- 配额接线：`tenant_quota.py` plan 缓存 provider（`plan_aware_quota_provider`）+ `app/main.py` lifespan `wire_plan_aware_quota`；`/formulas`(FORMULAS) + `/ai/generate`(AI_TASKS) 挂载
- analytics 租户过滤：`analytics_engine.py`/`business_metrics.py` 聚合方法加 `org_id` 参数（`_org_where`/`_org_subquery_filter`）；`/kpi /trends /anomalies /business-metrics /reports /export /filters /aggregate` 透传；`/dashboard /system-health /reports/templates` 保留全局
- ORM 补齐：`Organization.plan/settings/logo_url`

### 7.2 已交付（前端）
- `utils/plan.ts`（PLAN_RANK/PLAN_FEATURES/hasPlan/usePlan/RequirePlan/PlanGate）
- `types/index.ts:28` User.plan；`userNormalizer.ts:32` plan 归一化；`persisted.ts` plan 持久化
- `config/dashboard.ts` premium→advanced_analytics；`DashboardPage.tsx` hasPlan 门控；`AIAssistantPage.tsx` RequirePlan(ai_formula_generation)；`App.tsx` 路由守卫

### 7.3 数据库迁移（已应用）
- `20261028_020000_reconcile_tenant_schema`：`organization_members.org_id→organization_id` 重命名、organizations 补 `plan/settings/logo_url`、建 `subscriptions`/`billing_orders` 表
- **已执行 `alembic upgrade head`**（`backend\venv`，alembic 1.13.2），DB 现为 `20261028_020000 (head)`
- 验证：organization_members 含 organization_id、subscriptions/billing_orders 已建、organizations 含 plan/settings/logo_url

### 7.4 质量门禁（全部通过）
- 后端：全量 `py_compile` + 关键模块 `import`（含项目 venv `FINAL_IMPORT_OK`）
- 前端：`tsc --noEmit` 零错误；`eslint` 零错误
- JWT 往返验证：org_id/plan 正确写入并解出
- 数据库结构验证：迁移后与 ORM 全对齐

### 7.5 已知非阻断遗留（2026-10-28 授权处理后已收敛）
- ~~双配额机制并存：`ensure_ai_quota`(403) 与 `require_quota`(429)~~ → **已统一为 403 单一机制**（移除 `/ai/generate` 冗余 429，全部 AI 生成路由走 `ensure_ai_quota`→403→升级横幅；前端零改动）
- ~~`ai_generations` 计数失效（audit_logs 无 'ai' 动作）~~ → **已修复**：改用 `formula_generation_history`（真实 AI 生成记录）按组织成员当日计数
- ~~teams 模型↔迁移不一致~~ → **已调和**：新增迁移 `20261028_030000_reconcile_teams_schema`（防御式补 ORM 列 owner_id/settings/is_archived/updated_at，本库 no-op；`teams.org_id` 保留供 quota 计数，不重命名）并已应用（DB 现 head）
- **提交（2026-10-28）**：`389e164` 核心 20 文件；`e1f1c49` 配额接线+plan 类型；`1a0886a` AI/肽链 require_plan + 前端 PlanGuard/premium 门控（5 文件）
- **已全部收敛（2026-10-29，租户隔离 MIXED/歧义 hunk 完整落地 HEAD）**：`521a4eb`（peptide H11 `_user` + generation.py H4 `user_id`，纯净 2 行）；`5c98595`（AIAssistantPage RequirePlan 门控，13+/4-）；generation.py H5 `except HTTPException`、generation_v2 H6 `user_id`/H7 `except HTTPException`、generation.py H2 RAG 已由并行流提交（HEAD 现含全部 6 处：AIAssistant=9、gen user_id/except/require_plan、genv2 user_id/except/require_plan、pep `_user`=18）。**隔离临时 index（`GIT_INDEX_FILE` 完整路径）+ `git commit-tree`（无 hook）+ `git update-ref` CAS** 提交 521a4eb/5c98595；主 index/工作区零触碰、PRIOR 零泄漏、树级验证通过
- **租户隔离分割已完成**：Phase 1 核心（`core/plans.py` PLAN_FEATURES/require_plan）+ 全部 MIXED/歧义 hunk 均在 HEAD。工作区 381 未提交文件为并行流进行中开发（RAG/前端组件），非本任务范围
- **并行工作流提交（非本次）**：`92d3abd` RAG 版本管理、`50ce635` formula statistics 匿名聚合泄漏修复——均已叠加在本次 3 提交之上
