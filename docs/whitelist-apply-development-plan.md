# 白名单申请流程页 — 开发任务分解与排期

> 项目：RMFOODFP · 莱茵分子（Rhine Molecular）
> 关联文档：`docs/whitelist-apply-brainstorm.md`（构思汇报）
> 状态：开发蓝图 v1.0（待评审）
> 日期：2026-10-19

---

## 0. 已确认决策（本蓝图依据）

| 决策项 | 结论 |
|---|---|
| 倒计时方案 | 双倒计时：Hero 区「申请窗口截止」+ 成功页「再次申请冷却」 |
| 邮箱验证 | 强制邮箱验证码（6 位，验证通过才进入审核队列） |
| 再次申请冷却 | 7 天 |
| 登录页旧预登记 | 替换为「申请准入」入口按钮；旧 `/auth/pre-register` 保留兼容别名 |
| 路由 | `/whitelist-apply` 公开路由（GuestGuard） |
| 后端 | 扩展复用 `pre_register_requests` 表，不新建表 |

---

## 1. PRD（产品需求）

### 1.1 目标与用户故事
- **业务目标**：上线前通过「限时申请 + 白名单审核」控制平台首批用户准入，营造专业、稀缺、有序的氛围，同时过滤垃圾注册。
- **用户故事**：
  - US-1 未登录用户：在登录页看到「申请准入」入口 → 进入申请页 → 看到申请窗口截止倒计时 → 填写邮箱/姓名/单位/申请理由 → 输入邮箱验证码 → 提交成功，看到申请编号与审核时效承诺。
  - US-2 重复提交用户：提交后 7 天冷却期内再次访问 → 页面提示「已收到申请，请勿重复提交」并展示冷却倒计时。
  - US-3 已注册用户：在申请页填了已注册邮箱 → 提示「该邮箱已注册，请直接登录」。
  - US-4 审核结果用户：审核通过/拒绝后凭 token 查询状态；通过者收到邮件并可登录；拒绝者可于冷却后重新申请。
  - US-5 管理员：在管理端队列看到申请（含来源/验证状态）→ 通过（自动建用户）或拒绝（填原因）。

### 1.2 功能需求清单
| 编号 | 功能 | 说明 | 优先级 |
|---|---|---|---|
| FR-1 | 登录页入口按钮 | 替换 `PreRegisterSection`，按钮「申请准入」+ 副文案「本轮申请 X 天后截止」；点击跳 `/whitelist-apply` | P0 |
| FR-2 | 申请页窗口截止倒计时 | Hero 区环形倒计时（天/时:分:秒），服务端 `window_end` 驱动 | P0 |
| FR-3 | 申请表单 | 邮箱（必填）、姓名/单位/申请理由（选填）、隐私同意勾选（必填）；字段级校验 + aria-invalid | P0 |
| FR-4 | 邮箱验证码 | 提交后进入验证步骤：6 位验证码、60s 重发冷却、10min 有效、最多 5 次尝试；验证通过才入审核队列 | P0 |
| FR-5 | 提交成功态 | 对勾 + 申请编号 + 「1-2 个工作日邮件通知」+ 7 天再次申请冷却倒计时 | P0 |
| FR-6 | 状态查询 | 底部折叠区「邮箱 + 申请编号/状态 token 查状态」；审核中/通过/拒绝/过期四态 | P1 |
| FR-7 | 审核结果通知 | 邮件 + 站内信（Notification 模块） | P0 |
| FR-8 | 管理员审核 | 复用管理端预登记队列，扩展来源/验证状态/审核截止字段，通过自动建用户 | P0 |
| FR-9 | 窗口关闭处理 | 申请页展示「本轮已结束 + 下轮预告」，入口按钮同步隐藏/置灰 | P1 |
| FR-10 | 三语 | zh-CN / en-US / de-DE 全量文案 + 邮件模板 | P0 |

### 1.3 页面状态机
```
idle → filling → verifying（邮箱验证码）→ submitted(pending)
                                          ├→ approved → 通知 → 引导登录
                                          ├→ rejected → 展示通用原因 + 冷却后可重提
                                          └→ expired（review_deadline 超时）
异常：cooldown（冷却中）/ windowClosed / error / 429
```
路由内状态由 `searchParams` 表达：`?step=apply|verify|result&token=xxx`。

### 1.4 三语文案稿（初稿，评审可调）
| key | zh-CN | en-US | de-DE |
|---|---|---|---|
| loginEntry | 申请准入 | Request Access | Zugang beantragen |
| loginEntrySub | 白名单 · 优先体验 | Whitelist · Priority Access | Whitelist · Vorabzugang |
| pageTitle | 申请白名单 | Whitelist Application | Whitelist-Bewerbung |
| pageSubtitle | 本轮申请通道将于 {{date}} 截止 | Applications close {{date}} (CST) | Bewerbungsfrist endet am {{date}} |
| form.email | 邮箱 | Email | E-Mail |
| form.emailRequired | 请输入有效的邮箱地址 | Please enter a valid email | Bitte geben Sie eine gültige E-Mail ein |
| form.fullName | 姓名（选填） | Full Name (optional) | Vollständiger Name (optional) |
| form.organization | 单位（选填） | Organization (optional) | Organisation (optional) |
| form.reason | 申请理由（选填） | Reason for Applying (optional) | Begründung (optional) |
| form.consent | 我已阅读并同意《隐私政策》，授权将上述信息用于账号开通审核 | I have read and agree to the Privacy Policy and consent to the use of my information for account activation review | Ich habe die Datenschutzerklärung gelesen und stimme der Verwendung meiner Daten zur Kontofreischaltung zu |
| form.submit | 提交申请 | Submit Application | Bewerbung einreichen |
| verify.title | 邮箱验证 | Email Verification | E-Mail-Verifizierung |
| verify.desc | 验证码已发送至 {{email}}，10 分钟内有效 | A code has been sent to {{email}}, valid for 10 minutes | Ein Code wurde an {{email}} gesendet, 10 Minuten gültig |
| verify.placeholder | 6 位验证码 | 6-digit code | 6-stelliger Code |
| verify.resend | 重新发送（{{seconds}}s） | Resend ({{seconds}}s) | Erneut senden ({{seconds}}s) |
| success.title | 申请已提交 | Application Submitted | Bewerbung eingereicht |
| success.desc | 审核结果将在 1-2 个工作日内邮件通知您 | You will be notified by email within 1-2 business days | Sie werden innerhalb von 1–2 Werktagen per E-Mail benachrichtigt |
| success.cooldown | 请勿重复提交，如需修改可于 {{days}} 天后重新申请 | Please do not submit again. You may re-apply in {{days}} days | Bitte nicht erneut einreichen. Sie können sich in {{days}} Tagen erneut bewerben |
| status.reviewing | 审核中 | Under Review | In Prüfung |
| status.approved | 恭喜，您已获得白名单准入 | Congratulations, you have been granted whitelist access | Glückwunsch, Sie haben Whitelist-Zugang erhalten |
| status.rejected | 很抱歉，本次申请未通过 | Sorry, your application was not approved | Leider wurde Ihre Bewerbung nicht genehmigt |
| status.expired | 该申请已过期 | This application has expired | Diese Bewerbung ist abgelaufen |
| window.closed | 本轮申请已结束，请关注后续开放 | This round has closed. Stay tuned for future openings | Diese Bewerbungsrunde ist beendet. Bleiben Sie auf dem Laufenden |
| backToLogin | 返回登录 | Back to Login | Zurück zur Anmeldung |
| alreadyRegistered | 该邮箱已注册，请直接登录 | This email is already registered. Please log in | Diese E-Mail ist bereits registriert. Bitte melden Sie sich an |

---

## 2. 前端技术方案

### 2.1 路由注册（`frontend/src/App.tsx`）
```tsx
const WhitelistApplyPage = lazyWithPreload(() => import('@/pages/whitelist/WhitelistApplyPage'))
// 公开路由区，/login 同级：
{
  path: '/whitelist-apply',
  element: (
    <GuestGuard>
      <Suspense fallback={<LoadingComponent />}>
        <WhitelistApplyPage />
      </Suspense>
    </GuestGuard>
  ),
}
// 登录页挂载时预加载：
useEffect(() => { WhitelistApplyPage.preload() }, [])
```

### 2.2 组件树（`frontend/src/pages/whitelist/`）
```
WhitelistApplyPage
├─ ApplyStepper            // 步骤条：申请 → 邮箱验证 → 结果
├─ ApplyFormCard           // 表单卡：字段 + 校验 + 隐私同意
│   └─ 复用 Card/Input/Button/Alert（accent bar + rounded-xl）
├─ VerifyCodeCard          // 验证码输入 + 60s 重发冷却
├─ SubmitSuccessCard       // 成功态 + CountdownText（7 天冷却）
├─ ReviewStatusCard          // 审核中/通过/拒绝/过期 结果态（?token= 查询）
├─ WindowCountdown         // Hero 区环形倒计时（天 + 时:分:秒）
├─ StatusLookupSection     // 底部折叠：邮箱 + token 查状态
└─ hooks/useCountdown.ts   // 通用倒计时 hook
```

### 2.3 倒计时实现
- `useCountdown(deadline: string | null)`：接收服务端 UTC 时间戳；`setInterval` 每秒按 `Date.now()` 差值重算；`visibilitychange` 时立即校正；`document.hidden` 时暂停 interval（省电）。
- 持久化：提交成功后 `sessionStorage.setItem('whitelist_apply', JSON.stringify({ applicationId, deadline, step }))`；刷新/回访时恢复。
- 展示：秒级文本 `aria-hidden="true"`；`role="status"` 每分钟播报一次「预计剩余 N 分钟」；`tabular-nums` 防抖动。
- 服务端时间差：响应中的 `server_time` 与本地 `Date.now()` 计算偏移，所有倒计时按偏移校正。

### 2.4 状态管理与数据获取
- 页面级状态：`useReducer` 管理 `{ step, form, verify, applicationId, statusToken, deadline }`，不新建 zustand store。
- 数据获取：`@tanstack/react-query`
  - `useMutation` 提交申请 / 验证码 / 重发
  - `useQuery(['whitelist', applicationId], fetchStatus, { refetchInterval: 60_000, enabled: 已提交 })`
- 错误映射：429 → 读取 `retry_after` 启动冷却倒计时；409 → 按 `code` 展示「已注册 / 已申请」。

### 2.5 i18n 接入
- 新增 `frontend/src/i18n/{zh-CN,en-US,de-DE}/pages/whitelist.ts`，在各自 `index.ts` 的 `pages` deepMerge 中登记。
- 命名空间 `pages.whitelist`，key 见 1.4 表格；日期/复数用 `Intl` + i18next 插值，不硬编码分隔符。
- 邮件模板文案（后端邮件服务）：同 key 前缀 `email.*`，三语。

### 2.6 主题与样式
- 根容器：`bg-grid` + `var(--bg-canvas)`，`max-w-7xl mx-auto space-y-4`。
- 卡片：统一 `Card` 组件 + 顶部 accent bar + `rounded-xl`；颜色全部 `--color-*` / `--bg-*` / `--text-*` 语义令牌，禁止内嵌子主题。
- 倒计时环：CSS `conic-gradient` + mask 或 Radix Progress，支持暗色自动适配。

---

## 3. 后端接口契约

### 3.1 数据模型（迁移 DDL 草案）
```sql
-- 先清洗：同邮箱多个 pending 仅保留最新，其余置 rejected
ALTER TABLE pre_register_requests
  ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'legacy',          -- legacy|login|whitelist_page
  ADD COLUMN verify_code_hash VARCHAR(128) NULL,                    -- 验证码哈希
  ADD COLUMN verify_code_expires_at TIMESTAMPTZ NULL,               -- 验证码 10min 过期
  ADD COLUMN email_verified_at TIMESTAMPTZ NULL,
  ADD COLUMN verify_attempts SMALLINT NOT NULL DEFAULT 0,           -- 单码最多 5 次
  ADD COLUMN cooldown_until TIMESTAMPTZ NULL,                       -- 7 天冷却终点
  ADD COLUMN attempt_count SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN status_token_hash VARCHAR(128) NULL,                   -- 32B 随机 token 的哈希（唯一）
  ADD COLUMN review_deadline TIMESTAMPTZ NULL,                      -- 审核截止（默认 7 天）
  ADD COLUMN review_note TEXT NULL,
  ADD COLUMN expired_at TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX uq_pre_register_active_email
  ON pre_register_requests (email) WHERE status <> 'rejected';
CREATE INDEX ix_pre_register_status_deadline
  ON pre_register_requests (status, review_deadline);
CREATE INDEX ix_pre_register_email_status
  ON pre_register_requests (email, status);
```

### 3.2 API 端点
| 方法 | 路径 | 请求 | 成功响应 | 错误码 |
|---|---|---|---|---|
| POST | `/auth/whitelist/apply` | `{ email, full_name?, organization?, reason?, source }` | 201 `{ request_id, status_token, email_verified:false, server_time }` | 400 参数非法；409 已申请/已注册；429 冷却或限频 `{ retry_after, server_time }` + `Retry-After` 头 |
| POST | `/auth/whitelist/verify-code` | `{ request_id, code }` | 200 `{ status:"pending", review_deadline, server_time }` | 400 验证码错误；409 验证码过期需重发；429 尝试超限 |
| POST | `/auth/whitelist/resend-code` | `{ request_id }` | 200 `{ retry_after:60, server_time }` | 429 `{ retry_after }` |
| GET | `/auth/whitelist/status?token=` | — | 200 `{ request_id, status, submitted_at, review_deadline, approved_at?, reject_reason? }` | 404 token 无效 |
| POST | `/admin/pre-register-requests/{id}/approve` | `{ note? }` | 200 用户已创建 | 409 状态非 pending（幂等） |
| POST | `/admin/pre-register-requests/{id}/reject` | `{ reason }` | 200 | 409 状态非 pending |
| GET | `/admin/pre-register-requests?status=&source=` | — | 列表（扩展新字段） | 401/403 |

**兼容**：`POST /auth/pre-register` 内部转发到 apply（`source='legacy'`），历史数据与旧客户端不中断。

### 3.3 校验码与安全
- 验证码：6 位数字；DB 存 `sha256(code + salt)`；10min 有效；单码最多 5 次尝试；重发 60s 冷却；走现有 `email_service`，三语模板。
- 限流：IP 5 次/小时申请、10 次/小时发码；邮箱维度 1 次/24h 申请、7 天冷却（`cooldown_until`）；基于现有 SlidingWindowRateLimiter/Redis。
- 防枚举：状态查询凭 32B 随机 token（DB 存哈希，明文仅返回一次）；错误消息语义模糊（404/409 统一措辞）。
- 审计：AuditLog 记录 `whitelist.apply / verify / resend / approve / reject`，含 request_id、IP、UA。

### 3.4 审核流与定时任务
- 幂等：`UPDATE pre_register_requests SET status='approved', reviewed_by=..., reviewed_at=now() WHERE id=? AND status='pending'`，影响行数 = 1 才创建 User + 临时密码，否则 409。
- 通知：通过 → 邮件（临时密码/登录指引）+ 站内信；拒绝 → 邮件（通用原因）。
- 定时任务（每 5 分钟）：`status='pending' AND review_deadline < now()` → 置 `expired`，邮件通知。

### 3.5 迁移与兼容策略
1. 上线窗口：清洗历史重复 pending → 执行 DDL → 回填默认值 → 校验部分唯一索引。
2. 新旧端点共存一个版本周期；旧页面下线后，`/auth/pre-register` 仍可转发。
3. 回滚：新列可空/带默认值，DDL 可逆（DROP COLUMN / DROP INDEX）。

---

## 4. 测试计划

| 层级 | 用例 | 工具 |
|---|---|---|
| 单测 | `useCountdown` 递减/过期/可见性重算；表单校验；验证码输入过滤 | Vitest + RTL |
| 组件 | 步骤条渲染、成功态倒计时展示、错误提示 aria 关联、axe-core 无障碍扫描 | Vitest + Testing Library + axe |
| e2e | 登录页入口 → 填表 → 验证码 → 成功页 → 刷新恢复；冷却态；窗口关闭态；三语切换 | Playwright |
| 接口 | apply/verify-code/resend/status 全错误码；限流（429 + Retry-After）；幂等审核；验证码哈希落库；token 防枚举 | pytest |
| 迁移 | 历史重复数据清洗演练；部分唯一索引；回滚脚本 | pytest + 测试库 |
| 质量门禁 | `lint → tsc -b --force → test → theme:gate → build`；eslint-plugin-i18next 禁硬编码中文 | CI |

---

## 5. 排期建议（约 10-12 个工作日）

| 里程碑 | 任务 | 产出 | 验收标准 | 预估 |
|---|---|---|---|---|
| M1 后端 | 迁移脚本 + 模型/服务 + 4 个 API + 验证码邮件 + 限流 + 定时任务 + 管理端字段 | 接口可 curl 全流程通过 | pytest 全绿；幂等/限流/防枚举用例通过 | 4 天 |
| M2 前端 | 路由 + 组件树 + useCountdown + 表单/验证码步骤 + 三语 i18n + 登录页入口 + 样式 | 页面可完整走通（mock 后端） | 单测/组件/a11y 通过；三语切换正常 | 4 天 |
| M3 联调 | 前后端联调 + 数据清洗演练 + e2e 全链路 | 测试环境全流程通过 | Playwright 3 条主链路绿；迁移演练报告 | 2-3 天 |
| M4 上线 | SMTP/密钥/限流参数配置 + 生产迁移 + 监控告警 + 回滚预案 | 上线执行单 | 生产申请/审核/通知链路可用；监控面板就绪 | 1-2 天 |

**依赖关系**：M2 的表单提交/验证码依赖 M1 的 apply/verify 接口；M3 依赖 M1+M2；M4 依赖 M3。前端可用 mock 先行开发。

---

## 6. 上线 Checklist

- [ ] SMTP 生产配置 + 三语邮件模板就绪（验证码/审核结果/过期）
- [ ] 环境变量：验证码盐、状态 token 密钥、限流阈值（IP/邮箱）
- [ ] 历史 `pre_register_requests` 数据清洗脚本演练通过
- [ ] 生产 DDL 迁移 + 回滚脚本评审
- [ ] 管理端预登记队列 UI 字段扩展（来源/验证状态/审核截止）
- [ ] 监控：申请量、验证码发送成功率、审核 SLA 超时告警
- [ ] 隐私政策/服务条款页面链接在申请页挂载（三语）
- [ ] 登录页入口在窗口关闭后自动隐藏/置灰的开关配置

---

## 8. 实施进度（2026-10-19）

### ✅ M1 后端 — 已完成（pytest 10/10 通过）
- 模型扩展：`backend/app/models/pre_register.py`（新增 source/apply_reason/验证码/冷却/status_token/review_deadline 等字段 + pending 唯一部分索引 + EXPIRED 状态）
- 迁移：`backend/alembic/versions/20261019_010000_add_whitelist_apply_fields.py`（含历史重复 pending 清洗），已在本地开发库执行
- 服务层：`backend/app/services/whitelist.py`（申请创建/验证码哈希/7天冷却/**Redis 滑动窗口限流（内存兜底）**/**人机验证码生成与校验**/过期扫描/三语邮件/启动就绪性自检）
- 人机校验：`backend/app/utils/captcha.py`（Pillow 生成 4 字符 PNG）+ `GET /auth/whitelist/captcha` 端点
- API：`backend/app/api/whitelist.py`（POST apply（带人机验证）/ verify-code / resend-code + GET status + GET captcha）
- 兼容别名：`backend/app/api/pre_register.py` 改为转发服务层（source=legacy，不强制验证码）
- 管理端：`backend/app/api/pre_register_admin.py`（新增字段/EXPIRED 过滤/幂等审核/拒绝冷却回填/结果邮件）
- CSRF 豁免：`backend/app/core/security/security_middleware.py` 新增 `/auth/whitelist` 豁免
- 后台任务：`backend/app/main.py` lifespan 新增每 5 分钟白名单过期扫描
- 邮件模板：`backend/app/utils/email_service.py` 新增三语验证码/审核结果邮件
- 测试：`backend/tests/test_whitelist.py`（申请/幂等/已注册/验证码/状态/兼容别名/全链路过期/拒绝冷却）

### ✅ M2 前端 — 已完成（vitest 9/9 通过，tsc 通过，eslint 0 errors）
- 路由：`frontend/src/App.tsx` 新增 `/whitelist-apply`（GuestGuard + Suspense + lazyWithPreload + 登录页空闲预加载）
- API：`frontend/src/api/whitelist.ts`
- 页面：`frontend/src/pages/whitelist/WhitelistApplyPage.tsx` + `components/`（WindowCountdown/ApplyFormCard/VerifyCodeCard/ReviewStatusCard/StatusLookupSection）+ `hooks/useCountdown.ts` + `whitelist.css`
- i18n：`frontend/src/i18n/{zh-CN,en-US,de-DE}/pages/whitelist.ts` 并在三语 index.ts 登记
- 登录页入口：`frontend/src/pages/auth/LoginPage.tsx` 以「申请准入」入口替换 PreRegisterSection，样式加入 LoginPage.css
- 测试：`frontend/src/pages/whitelist/__tests__/whitelist.test.tsx`
- 环境变量：`frontend/.env.example` 新增 `VITE_WHITELIST_WINDOW_END`

### 🔄 M3 联调 — 后端全链路已覆盖（申请→验证→状态→过期→冷却）
- 浏览器 e2e（Playwright：登录页入口 → 填表 → 验证码 → 结果页）需 dev server 运行环境，因项目约束禁止自动启动 dev server，留待本地/CI 执行 `pnpm test:e2e`。

### ✅ 账号申请管理端增强（2026-10-20 补充）
- 后端：`pre_register_admin.py` 新增 `batch-approve` / `batch-reject` / `{id}/resend-code` / `{id}/reactivate` / `export`（CSV）；列表支持来源过滤、申请理由搜索，返回 `reviewed_by_name` / `ip_address`
- 服务层：`whitelist.py` 新增 `admin_resend_verification_code`（管理员重发，不受 60s 冷却限制）
- 前端：批量多选 + 批量通过/拒绝、导出 CSV、重发验证码邮件、过期重新激活、申请理由/审核人列、pending 超时角标、错误提示格式化、详情弹窗补充验证尝试/申请次数/IP/查看用户跳转
- 测试：`tests/test_whitelist_admin.py` 8 用例；后端共 18/18 通过；eslint 0；tsc exit 0

### ⏳ M4 上线准备 — 待运维执行
- [x] 管理端「账号申请」队列 UI 新字段展示（来源/验证状态/审核截止/冷却/备注）— **已完成**（`UserManagementPage.tsx` + `api/admin.ts` 类型扩展，含 expired Tab）
- [ ] 生产库执行 `alembic upgrade head`（迁移脚本已就绪，含清洗与回滚）
- [ ] 配置 `SMTP_HOST/PORT/USERNAME/PASSWORD` 与 `WHITELIST_SECRET_SALT`
- [ ] 前端配置 `VITE_WHITELIST_WINDOW_END`（申请窗口截止时间）

> ⚠️ 仓库存量问题（与本次功能无关）：`frontend/src/components/database/graph/*` 存在历史未提交改动导致的 tsc 类型错误（如 `KnowledgeGraph.tsx`），全量 `npx tsc -b --force` 会失败；本次白名单相关代码本身通过 tsc。建议在合并前单独清理该目录。

---

## 7. 待评审确认

1. 申请窗口截止时间由谁配置（建议后端 `LAUNCH_CONFIG.window_end`，管理端可改）？
2. 审核 SLA「1-2 个工作日」是否可承诺（节假日顺延文案）？
3. 白名单 = 平台访问权还是含数据权限（与角色映射确认）？
4. 申请理由字段是否参与审核判定，还是仅作参考？
5. 管理端「通过后自动建用户」是否需要发送临时密码邮件，还是走邀请链接？

---

## 8. 实施进度（2026-10-19）