# 白名单申请流程页 — 团队构思汇报

> 项目：RMFOODFP · 莱茵分子（Rhine Molecular）
> 阶段：构思汇报（团队：产品体验设计 / 前端架构 / 后端安全）
> 日期：2026-10-19

---

## ✅ 已确认决策（2026-10-19 用户拍板）

| 决策项 | 结论 |
|---|---|
| 倒计时方案 | **双倒计时**：Hero 区「申请窗口截止」+ 成功页「再次申请冷却」 |
| 邮箱验证 | **强制邮箱验证码**（6 位，验证通过才进入审核队列） |
| 再次申请冷却 | **7 天** |
| 登录页旧预登记 | **替换为「申请准入」入口按钮**，旧 `/auth/pre-register` 保留兼容别名，历史数据兼容 |

---

## 一、结论摘要

**推荐方案：独立公开路由 `/whitelist-apply` + 「双倒计时」单页流程 + 登录页入口按钮。**

- **主倒计时（窗口截止）**：页面 Hero 区展示「本轮申请通道截止倒计时」，贴合项目上线预热/限时开放场景，由服务端下发截止时间戳驱动。
- **辅助倒计时（再次申请冷却）**：提交成功后展示「X 天后可重新申请」冷却倒计时，防止重复提交，与登录页现有 429 限频倒计时的交互先例一致。
- **登录页**：将现有「邮箱预登记」折叠表单（PreRegisterSection）升级为「申请准入」入口按钮，跳转新路由。
- **后端**：**扩展复用现有 `pre_register_requests` 表**（不新建表），增量增加验证码、冷却、状态 token、审核截止等字段；旧 `POST /auth/pre-register` 保留为兼容别名。
- **倒计时权威性**：服务端下发绝对时间戳（`window_end` / `cooldown_until` / `review_deadline` / `server_time`），前端仅做差值渲染，防止本地改时钟绕过。

---

## 二、倒计时语义对比

| 语义 | 适用时机 | 展现形式 | 评价 |
|---|---|---|---|
| **窗口截止倒计时（主推）** | 上线前 / 本轮限时开放 | Hero 环形 + 文本 | 最贴合上线场景，驱动转化；必须服务端统一时间，避免虚假紧迫 |
| **再次申请冷却（页内推荐）** | 提交成功后 | 成功页文本 + 按钮禁用态 | 真实防重复提交，与 429 先例一致 |
| 验证码重发冷却 | 表单验证步骤 | 按钮内文本 | 若启用邮箱验证码则必须；可后置 |
| 激活失效倒计时 | 审核通过后 | 邮件 + 站内 | 促激活，但依赖审核 SLA，运营重，备选 |
| 表单填写超时 | 填写中 | 进度条 | 负向体验，**不推荐** |

---

## 三、用户旅程与页面状态机

状态：`idle → filling → submitted(审核中) → approved / rejected`；异常分支：`cooldown（冷却中）/ expired（窗口关闭）/ error`。

旅程：
1. 登录页点击「申请准入」→ 进入 `/whitelist-apply`
2. 页面展示倒计时 + 平台价值 → 单页表单（邮箱必填，姓名/单位/申请理由选填，知情同意勾选）
3. 提交校验分支：
   - 邮箱已注册 → 引导去登录
   - 已申请 → 提示审核中
   - 冷却中 → 按钮禁用 + 冷却倒计时
   - 429 → 沿用 alert + aria-hidden 秒数
4. 成功态：对勾 + 申请编号 + 「1-2 个工作日邮件通知」+ 再次申请冷却倒计时
5. 审核通过 → 邮件/站内通知；拒绝 → 通用原因，冷却后可重提
6. 窗口关闭 → 「本轮已结束」+ 下轮预告

**页面线框（文字版）**：
- 顶栏：Logo + 语言切换 + 返回登录
- Hero：H1 + 副文案 + 环形倒计时（中心为天，下方 时:分:秒，tabular-nums）
- 主体桌面双栏：左表单卡（单页表单，不分步）；右信任栏（审核时效 / 数据用途 / 隐私链接）
- 成功/失败态整卡替换表单；失败沿用顶部 alert + 字段级红框 + `aria-invalid`
- 底部可选「邮箱 + 申请编号查状态」折叠区
- 移动端单栏堆叠，倒计时压缩为小环 + 单行文本

---

## 四、前端架构建议

### 路由
- 新增公开路由 `path: '/whitelist-apply'`，`GuestGuard` 包裹（已登录跳 `/dashboard`）
- `lazyWithPreload` 懒加载；登录页挂载时空闲预加载
- 流程态用 `searchParams`：`?step=apply|review|result&token=xxx`，便于刷新/分享恢复；`token` 仅用于结果页查询审核状态，不进入表单

### 组件树
```
WhitelistApplyPage
├─ ApplyStepper 步骤条（申请 / 审核中 / 结果）
├─ ApplyFormCard（姓名/邮箱/单位/申请理由）
│   └─ 复用 Card+accent bar、Input、Button、Alert
├─ SubmitSuccessCard + CountdownText（审核/冷却倒计时）
├─ ReviewStatusCard（审核中/通过/拒绝 结果态）
└─ useCountdown(deadline) 自定义 hook
```

### 倒计时实现（推荐）
- 方案：**服务端 deadline 时间戳 + 本地差值**（`setInterval` 每秒按 `Date.now()` 差值重算；`visibilitychange` 时立即校正；刷新后从 sessionStorage 恢复）
- 备选：`setInterval`（切后台被节流、漂移）；`setTimeout` 链式（仅适合短倒计时，登录页现用）；本地 deadline（可被改时钟）
- a11y：秒数文本 `aria-hidden="true"`，仅用 `role="status"` 播报一次「预计剩余 N 分钟」，不每秒打断读屏（对齐登录页 F2-8 先例）
- 状态持久化：`{applicationId, deadline}` 存 sessionStorage；页面级状态，不建 zustand

### 状态管理
- 流程状态（step、表单、校验、deadline）用组件内 state/useReducer，页面局部状态
- 审核状态轮询用 react-query：`useQuery(['whitelist', id], ..., { refetchInterval: 60_000 })`

### i18n
- 新增页面级翻译包：`i18n/{zh-CN,en-US,de-DE}/pages/whitelist.ts`，在各自 `index.ts` 的 `pages` deepMerge 登记
- 命名空间 `pages.whitelist`；key：title/subtitle/step/表单字段/校验错误/submit/submitSuccess/reviewing/deadline（{{count}} 插值）/approved/rejected/backToLogin/loginEntry

### 主题对齐
- 根容器 `bg-grid` + `var(--bg-canvas)`，`max-w-7xl mx-auto space-y-4`
- 卡片统一 `Card` + 顶部 accent bar + rounded-xl；全部 `--color-*` / `--bg-*` / `--text-*` 语义令牌，禁止内嵌子主题

### 测试与上线门禁
- 单测：`useCountdown`（递减/过期/可见性重算）、表单校验、步骤条渲染
- 组件测试：提交成功展示倒计时、axe-core 无障碍扫描
- e2e（Playwright）：登录页入口 → 填表提交 → 结果页，刷新后倒计时恢复
- 门禁：`lint → tsc -b --force → test → theme:gate → build`；文案禁硬编码中文（eslint-plugin-i18next）

---

## 五、后端与安全建议

### 数据模型（扩展 `pre_register_requests`，不新建表）
现有：id、email(index)、full_name、department、status、reviewed_by/reviewed_at、reject_reason、user_id、ip_address、created_at/updated_at。

新增列：`source`(login/whitelist_page)、`verify_code_hash`、`verify_code_expires_at`、`email_verified_at`、`verify_attempts`、`cooldown_until`、`attempt_count`、`status_token_hash`(唯一)、`review_deadline`、`review_note`、`expired_at`。

约束/索引：
- **「非 rejected 邮箱唯一」部分唯一索引**（先清洗历史重复 pending）
- `idx(status, review_deadline)` 供自动过期扫描；`idx(email, status)`

### API 设计
| 方法 | 端点 | 说明 | 返回 |
|---|---|---|---|
| POST | `/auth/whitelist/apply` | 提交申请 | 201：request_id、status_token、cooldown_until |
| POST | `/auth/whitelist/verify-code` | 校验 6 位邮箱验证码 | 置 email_verified |
| POST | `/auth/whitelist/resend-code` | 60s 冷却重发验证码 | retry_after |
| GET | `/auth/whitelist/status?token=` | 凭 token 查申请状态（防枚举） | 状态 + 时间字段 |
| 管理端 | 复用 `/admin/pre-register-requests` | 扩展返回新字段 | — |

错误码：400 参数/验证码错；404 token 无效；409 已申请/已开通；429 冷却中（body `retry_after` + `Retry-After` 头）。
兼容：`POST /auth/pre-register` 作为 apply 的别名转发，历史数据不丢。

### 倒计时时间字段（服务端下发 UTC 时间戳）
`cooldown_until`（申请冷却终点）、`retry_after_seconds`（429）、`verify_code_expires_at`（验证码剩余）、`review_deadline`（审核截止，如 7 天自动 expired）、`window_end`（申请窗口截止）。响应附带 `server_time`，前端用时间差计算。

### 防滥用与安全
- 邮箱验证码：6 位数字，DB 存哈希，10 分钟有效，单码最多试 5 次；重发 60s 冷却；走现有 `email_service`
- 限流：IP 维度 5 次/小时申请、10 次/小时发码；邮箱维度 1 次/24h；基于现有 SlidingWindowRateLimiter/Redis
- 防枚举：状态查询凭 32B 随机 token（DB 存哈希）；错误消息语义模糊
- CSRF：访客申请沿用现有豁免；管理审核已有 JWT + admin + CSRF 双提交
- 审计：写 AuditLog（action=whitelist.apply/verify/approve/reject，含 request_id/IP/UA）

### 管理员审核流
- 幂等防并发：`UPDATE ... SET status='approved' WHERE id=? AND status='pending'`，影响行数 = 1 才继续建用户，否则 409
- 审核人/时间/备注回填；通过后创建 User + 临时密码
- 结果经 Notification 站内信 + 邮件通知
- `review_deadline` 过期由定时任务批量置 expired

### 合规
- 数据最小化；申请页挂隐私声明 + 同意勾选（三语）
- rejected 90 天匿名化、pending 180 天清理；支持 GDPR 删除权（复用账号注销匿名化逻辑）
- 审计日志保留 180 天

---

## 六、风险与待确认问题

1. 申请窗口截止时间由谁配置？是否复用 `LAUNCH_CONFIG` 服务端锚点？
2. 冷却期多长？（建议 7 天；登录页限频先例为 60s 级）
3. 是否强制邮箱验证码前置？（未验证是否入审核队列）
4. 旧 `pre-register` API 与历史数据如何兼容迁移？（建议：新列默认值回填 + 别名共存一个版本周期）
5. 「1-2 个工作日」审核 SLA 是否可承诺（节假日顺延）？
6. 未登录查状态的隐私安全方案（`?token=` 一次性且绑定 applicationId）？
7. 审核通过后是否需要激活链接？（决定激活倒计时是否必要）
8. 白名单 = 平台访问权还是含数据权限？需与角色映射确认。
9. SMTP 生产配置是否就绪？（影响验证码/邮件通知）
10. 邮件模板需 zh/en/de 三语，是否已有邮件模板体系？

---

## 七、下一步建议

1. 用户确认上述关键决策（倒计时语义、是否邮箱验证、冷却时长、是否替换旧预登记）
2. 输出详细开发任务分解：PRD（含三语文案稿）+ 前端技术方案 + 后端接口契约 + 迁移脚本 + 测试计划
3. 排期与上线计划（含数据清洗窗口、SMTP 配置、管理端 UI 扩展）