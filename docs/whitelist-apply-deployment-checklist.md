# 白名单申请流程 — 上线部署清单（运维可执行）

> 项目：RMFOODFP · 莱茵分子（Rhine Molecular）
> 关联：`docs/whitelist-apply-development-plan.md`（蓝图 + 实施进度）
> 适用：生产环境上线执行
> 版本：v1.0（2026-10-19）

---

## 0. 上线前确认（开发侧已完成）

- [x] 后端：数据模型扩展 + 迁移脚本 + 4 个新 API + 邮箱验证码 + 限流 + 审核流 + 过期扫描任务 + 三语邮件模板
- [x] 后端测试：`pytest tests/test_whitelist.py` 8/8 通过
- [x] 前端：`/whitelist-apply` 页面 + 双倒计时 + 三语 i18n + 登录页「申请准入」入口
- [x] 前端测试：`vitest run src/pages/whitelist/__tests__/whitelist.test.tsx` 9/9 通过；eslint 0 errors
- [x] 管理端队列 UI：expired Tab + 来源/验证/审核截止/冷却/备注字段
- [x] CSRF 豁免：`/api/v1/auth/whitelist/*` 已加入豁免列表
- [x] Playwright e2e：`frontend/src/components/ai/features/__tests__/e2e/whitelist-apply.spec.ts`（需 dev server）

> ⚠️ 仓库存量问题（与本次功能无关）：`frontend/src/components/database/graph/*` 存在历史未提交改动导致的 tsc 类型错误，全量 `npx tsc -b --force` 会失败。上线构建前需先清理该目录或单独修复。

---

## 0.5 本地开发环境快速重启与验证（当前后端仍为旧代码，务必执行）

当前运行中的后端进程未加载最新代码（status 响应缺少 `cooldown_until` 字段、邮件 SMTP 改进与 verify-code IP 限流未生效）。请按以下步骤重启并验证：

```powershell
# 1) 停止占用 8000 端口的旧后端进程（管理员 PowerShell）
Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# 2) 启动后端（加载最新代码）
cd D:\RMFOODFP\backend
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 3) 验证服务已就绪
curl http://localhost:8000/api/v1/health
```

启动日志中会输出**白名单就绪性自检**（`[Whitelist]` 前缀）：
- `⚠️ 未设置 WHITELIST_SECRET_SALT` → 生产前必须配置随机盐
- `ℹ️ 开发模式且未配置 SMTP` → 验证码邮件落盘 `logs/email-dev`
- `🔴 生产模式未配置 SMTP_HOST` → 用户收不到验证码，必须修复

---

## 1. 生产数据库迁移

### 1.1 备份
```bash
# 迁移前必须备份生产库（以 Docker/本地 PG 为例）
pg_dump -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -Fc -f backup_pre_whitelist_$(date +%Y%m%d).dump
```

### 1.2 执行迁移
```bash
cd backend
# 设置环境变量（或确保 .env 指向生产库）
export DATABASE_URL=postgresql+asyncpg://<user>:<pass>@<host>:5432/<db>

# 先查看将要执行的迁移
venv/Scripts/python.exe -m alembic history

# 升级到最新（含白名单字段迁移 20261019_010000）
venv/Scripts/python.exe -m alembic upgrade head
```

迁移内容（`backend/alembic/versions/20261019_010000_add_whitelist_apply_fields.py`）：
- 新增列：`apply_reason` / `source` / `verify_code_hash` / `verify_code_expires_at` / `verify_code_sent_at` / `email_verified_at` / `verify_attempts` / `cooldown_until` / `attempt_count` / `status_token_hash` / `review_deadline` / `review_note` / `expired_at`
- 历史数据清洗：同邮箱多条 `pending` 仅保留最新，其余置 `rejected`
- 索引：`uq_pre_register_active_email`（`email` WHERE `status='pending'` 唯一）、`idx_pre_register_status_deadline`、`idx_pre_register_email_status`

### 1.3 回滚
```bash
venv/Scripts/python.exe -m alembic downgrade 20261015_020000
```
回滚会删除新增列与索引（清洗过的历史数据不会自动恢复，需用 1.1 备份恢复）。

---

## 2. 环境变量配置

### 2.1 后端（生产 `.env`）
```bash
# SMTP 邮件服务（验证码/审核结果邮件依赖）
SMTP_HOST=smtp.your-domain.com
SMTP_PORT=465
SMTP_USERNAME=no-reply@your-domain.com
SMTP_PASSWORD=********

# 前端地址（邮件中的登录/重新申请链接）
FRONTEND_URL=https://your-domain.com

# 白名单安全盐（验证码/状态 token 哈希用，务必随机且与开发环境不同）
WHITELIST_SECRET_SALT=$(python -c "import secrets; print(secrets.token_hex(16))")
```

### 2.2 前端（生产构建变量）
```bash
# 申请窗口截止时间（UTC ISO 8601），不配置则不显示 Hero 倒计时
VITE_WHITELIST_WINDOW_END=2026-10-25T16:00:00Z
```

前端构建：
```bash
cd frontend
npm run build   # 或 pnpm build（tsc -b && vite build）
```

---

## 3. 启动与冒烟验证

### 3.1 后端接口冒烟（curl）
```bash
# 1) 提交申请（返回 request_id / status_token）
curl -s -X POST http://localhost:8000/api/v1/auth/whitelist/apply \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@example.com","full_name":"冒烟测试","source":"whitelist_page","lang":"zh-CN"}'

# 2) 查询状态（用上一步的 status_token）
curl -s "http://localhost:8000/api/v1/auth/whitelist/status?token=<STATUS_TOKEN>"

# 3) 旧兼容别名
curl -s -X POST http://localhost:8000/api/v1/auth/pre-register \
  -H 'Content-Type: application/json' \
  -d '{"email":"legacy@example.com"}'
```

### 3.2 邮箱验证码链路
- 开发环境：邮件保存到 `backend/logs/email-dev/*.html`（`settings.debug=true` 时）
- 生产环境：验证码通过 SMTP 发送；若 SMTP 未配置，申请仍成功但验证码无法送达（需立即检查 SMTP 配置）

### 3.3 浏览器 e2e（可选，需 dev server + 后端）
```bash
cd frontend
pnpm test:e2e -- whitelist-apply.spec.ts
```

---

## 4. 上线后验证用例

| # | 用例 | 预期 |
|---|---|---|
| 1 | 登录页显示「申请准入」入口 | 点击跳转 `/whitelist-apply` |
| 2 | 申请页展示窗口截止倒计时（配置了 `VITE_WHITELIST_WINDOW_END`） | Hero 区环形倒计时 |
| 3 | 提交申请 | 收到 6 位验证码邮件 |
| 4 | 输入错误验证码 | 提示「验证码错误」，累计 5 次后需重发 |
| 5 | 输入正确验证码 | 进入审核中，展示审核截止倒计时 |
| 6 | 同一邮箱重复提交 | 提示「该邮箱已提交申请」（409） |
| 7 | 已注册邮箱提交 | 提示「该邮箱已注册，请直接登录」 |
| 8 | 管理员「账号申请」队列 | 可见来源/验证/审核截止/冷却字段 |
| 9 | 管理员通过 | 自动创建用户 + 邮件发送临时密码 |
| 10 | 管理员拒绝 | 申请置 rejected，7 天冷却，邮件通知 |
| 11 | 审核超时（>7 天） | 定时任务置 expired，状态可查 |
| 12 | 三语切换 | zh-CN / en-US / de-DE 文案正常 |

---

## 5. 回滚预案

- **功能回滚**：前端可回退到不渲染「申请准入」入口的版本；后端旧 `/auth/pre-register` 别名保持兼容，历史客户端不受影响。
- **数据库回滚**：`alembic downgrade 20261015_020000` + 用备份恢复被清洗的数据。
- **开关**：若申请量异常，可通过移除 `VITE_WHITELIST_WINDOW_END` 隐藏窗口倒计时，并临时调低 IP 限流阈值（`backend/app/services/whitelist.py` 中 `IP_APPLY_LIMIT`）。

---

## 6. 监控与告警建议

- 邮件发送成功率（验证码/审核结果）——SMTP 失败需告警
- 申请量 / 验证码发送量（防刷）
- 审核 SLA：`pending` 超过 3 天的申请数
- `expired` 状态数量异常增长（可能 review_deadline 配置问题）

---

## 7. 待产品/业务确认（上线前）

1. 申请窗口截止时间具体值（`VITE_WHITELIST_WINDOW_END`）
2. 审核 SLA「1-2 个工作日」是否可承诺（节假日顺延文案）
3. 白名单 = 平台访问权还是含数据权限（角色映射）
4. 申请理由是否参与审核判定
5. 审核通过后发送临时密码邮件 vs 邀请链接

---

## 8. 深度审计结论与加固（2026-10-20）

### 8.1 真实接口审计（对运行中后端实测）
| 用例 | 结果 |
|---|---|
| GET /auth/whitelist/captcha（人机验证码） | ✅ 200，返回 captcha_id + PNG base64 |
| POST apply（正常，带验证码） | ✅ 201，返回 request_id / status_token / email_verified / server_time |
| POST apply（人机验证码错误） | ✅ 400 INVALID_CAPTCHA（一次性，失败即删除） |
| POST apply（同一邮箱重复） | ✅ 409 ALREADY_APPLIED（pending 唯一） |
| POST apply（非法邮箱） | ✅ 422（pydantic 校验） |
| POST apply（已注册邮箱） | ✅ 409 EMAIL_REGISTERED |
| POST apply（IP 超 5 次/小时） | ✅ 429 RATE_LIMITED（Redis 滑动窗口，未启用时内存兜底） |
| POST verify-code（错误验证码） | ✅ 400 INVALID_CODE |
| POST verify-code（正确验证码） | ✅ 200，返回 review_deadline |
| POST resend-code（60s 内） | ✅ 429 RESEND_COOLDOWN + retry_after |
| GET status（有效 token） | ✅ 200 pending（含 review_deadline / cooldown_until） |
| GET status（无效 token） | ✅ 404 NOT_FOUND |
| POST /auth/pre-register（兼容别名） | ✅ 201（不强制验证码） |

### 8.2 发现的问题与处理
1. **⚠️ 运行中的后端进程是旧版代码**：本次实测的 status 响应缺少新加的 `cooldown_until` 字段，说明进程未加载最新代码。**必须重启后端**才能生效（status 冷却字段、邮件 SMTP 改进、verify-code IP 限流、人机验证码、Redis 限流）。
2. **✅ 已加固：verify-code 增加独立 IP 限流**（`IP_VERIFY_LIMIT=20` 次/小时），防止对可猜测的 request_id 进行验证码爆破骚扰。
3. **🔴 生产必须设置 `WHITELIST_SECRET_SALT`**：代码中存在默认盐常量，若生产未配置，验证码/状态 token 的哈希可被离线暴力破解（6 位验证码 1M 组合）。上线前务必设置随机盐。
4. **✅ 已接入人机校验（自托管图片验证码）**：`GET /auth/whitelist/captcha` 用 Pillow 生成 4 字符 PNG（噪点/干扰线），答案哈希入库（Redis 优先，内存兜底），5 分钟有效、一次性；apply 必须携带 captcha_id + captcha_answer，错误返回 400 INVALID_CAPTCHA。生成验证码也按 IP 限流（60/小时）。
5. **轻微**：422 校验错误的响应体为裸 JSON 数组（非标准 `{"detail": [...]}`），前端错误兜底已覆盖。
6. **✅ 限流已迁移到 Redis（滑动窗口 ZSET）**：apply/resend/verify/captcha 四类操作统一走 `rmfood:whitelist:{op}:{ip}` 键；Redis 未启用（`USE_REDIS=false`）时自动回退内存滑动窗口，行为不变。多 worker 部署时开启 `USE_REDIS=true` 即全局统一限流。
7. **✅ 开发环境本地测试增强**：`ENV=development` 时，`POST apply` 响应返回 `dev_verify_code`（6 位明文验证码），前端在验证码步骤直接展示；同时未配置 SMTP 时邮件仍落盘 `logs/email-dev/`。生产环境（`ENV=production`）该字段恒为 `null`，不会泄露验证码。

### 8.3 测试副作用说明
- 深度审计期间对 `127.0.0.1` 触发了申请限流（5 次/小时窗口）。**约 1 小时后自动恢复**，或**重启后端立即清零**。若您在浏览器测试时遇到「操作过于频繁」，属该临时状态，非代码故障。