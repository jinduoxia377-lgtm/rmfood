# RMFOODFP 云服务器部署报告

**部署完成时间**: 2026-09-30
**最后前端修复**: 2026-09-30（chunk 互操作/React dispatcher 全量修复）
**服务器**: 百度云服务器 `106.12.20.131` (Ubuntu 24.04, 2C4G + 2GB swap)
**部署方式**: Docker Compose (4 容器)

---

## 前端白屏/报错修复（2026-09-30 全量收尾）

**症状链**（按时间顺序，全部已修复）：

| # | 报错 | 根因 | 修复 |
|:--|:-----|:-----|:-----|
| 1 | `n.inherits is not a function` (exceljs 流模块) | dist 混杂两代构建（144 旧文件），exceljs `util.inherits` 互操作 helper 被 bundler 丢弃 | 删 144 旧文件；chunk 头部注入 `__utilInherits` polyfill，替换 3 处 `[a-z].inherits(` 调用 |
| 2 | `Class extends value undefined` (agent-base) | `class d extends n.EventEmitter`，`n=hr()` 空 CJS shim | 注入 `__rmfoodEE` EventEmitter；重写 `hr()` 压缩模块 |
| 3 | `Cannot read properties of undefined (reading 'prototype')` (https-proxy-agent) | `o=hr().Writable; o.prototype.destroy` 需要真实 prototype 链 | `hr()` 升级为 Readable(WR)+Writable+Transform 类，带 `read/push/on/once/off/emit/destroy/pipe/pause/resume/setEncoding/wrap/write/end` |
| 4 | `Unexpected identifier 't'` / `'o3e'` (SyntaxError) | 注入 `hr()` 时：(a) 花括号不平衡（少 1 闭括号）；(b) 模块边界缺逗号（原压缩码所有模块以逗号连接） | 重建 `hr()` 模块保证括号 0 平衡 + 恢复尾随逗号；不用 ES2022 公共类字段（浏览器 ESM 解析） |
| 5 | `Cannot read properties of undefined (reading 'Z_SYNC_FLUSH')` (axios) | axios Node 适配器顶层立即读 `Li.default.constants.Z_SYNC_FLUSH`，`hr()` 缺 `constants` | `hr()` 补全 16 成员：`constants/createUnzip/createBrotliDecompress/createZstdDecompress/Duplex/pipeline/finished/Socket/TextEncoder/URLSearchParams/randomFillSync/isDeepStrictEqual/promisify/globalAgent/connect/Transform` |
| 6 | `ERR_CONNECTION_TIMED_OUT` fonts.googleapis/gstatic | Google 字体域名国内不可达 | index.html 删除 `fonts.googleapis.com` + `fonts.gstatic.com` 全部 `<link>`，加系统字体回退 `<style>body{font-family:-apple-system,...}</style>` |
| 7 | `Cannot read properties of null (reading 'useEffect')` (React) | `feature-ai-chat` chunk 内联了**孤立 React 19 副本**（`E={H:null}` dispatcher 从未被赋值），与 vendor-react 的 React 不同实例 | 注入 `__rmfoodNullDispatcher` null-safe dispatcher，`E.H` 从 `null` 改为指向该对象，组件 hook 调用不再崩溃 |
| 8 | 页面一直"加载中"卡死，不渲染内容 | 部署的 `sw.js` 是**原始 TypeScript 源码**（`url: URL`、`request as Request`、`declare global`），浏览器 SW 引擎无法解析 → SW 永远注册失败 → 旧代 SW 继续用私有缓存提供**未修补的旧 K7 chunk** → K7 模块初始化崩溃 → chunk 内的 auth store 永不初始化 → `isLoading` 永远 `true` → 根守卫 `Hu` 永久渲染"加载中…"spinner | 用极简**纯 JavaScript** SW 重写 `sw.js`（仅 install→skipWaiting、activate→删除所有 `rmfood-*` 缓存 + clients.claim，**不加任何 fetch 拦截**，所有请求走网络，nginx no-store 为唯一事实源），保证浏览器始终拿到 nginx 上已修补的最新 chunk 字节 |

**缓存穿透**：chunk 同时以 `D29D1GB`（旧名，58 页面 chunk 静态 import 必须保留）、`X9Q2pLm8`、`K7mZ9qR5`（新名）提供打补丁后的内容，三个 URL 都 200 no-store。入口轮转至 `index-T5nW3xJ8.js`。`sw.js` 重写为 v4 纯 JS + `sw-v4.js` 缓存清除器双保险。

**nginx.conf**：之前一次行过滤脚本破坏了 server 块头导致 web 崩溃循环，已用完整已知良好配置恢复，`nginx -t` 通过。每个 no-store URL 只产生一个 `Cache-Control` 头。

**已知遗留（非阻断）**: ~~feature-ai-chat 内联孤立 React~~ — 已于 2026-09-30 由源码重建根治（见下节）。

---

## 双 React 实例根治 + 登录 Secure cookie 阻断修复（2026-09-30 第二轮）

**背景**: 上节 #7/#8 的 null-dispatcher / 纯 JS SW 补丁只能止血。插桩日志证明 auth store 的 `setState` 已执行（`FINALLY clearing isLoading`）但组件不重渲染 —— 根因是旧 dist（默认 `vite.config.ts`，无 `manualChunks`）让 `feature-ai-chat` chunk **内联了一份孤立 React 19**，store 的 `useSyncExternalStore` 走孤立副本的 dispatcher（no-op），组件永远冻结在初始渲染。

| # | 症状 | 根因 | 修复 |
|:--|:-----|:-----|:-----|
 | 9 | 登录成功但卡在"加载中…"spinner（store 已更新、组件不重渲染） | 双 React 实例：feature chunk 内联孤立 React，hooks 订阅失效 | `vite.config.ts` 增加 `build.rollupOptions.output.manualChunks`：`react/react-dom/react-router/scheduler` 收进单一 `vendor-react` chunk，第三方按包名拆 `vendor-*`；**从源码重建**（179 chunk，唯一完整 React = `vendor-react-lVqDN7cg.js` 263KB） |
| 10 | 登录页提示"网络连接异常，请检查网络"，控制台 `auth/me 401` + `auth/csrf 404` | 后端 `create_secure_cookie_settings`（`DEBUG=False` 生产）给 `rmfood_access_token` / `rmfood_refresh_token` 两个 HttpOnly cookie 加了 **Secure** 属性；部署是纯 HTTP（80 端口、公网 IP、无 TLS）→ 浏览器拒绝存储 Secure cookie → cookie 会话 `auth/me` 无 cookie → 401 | ① `backend/app/utils/auth.py` 增加 `COOKIE_SECURE` 覆盖（优先级 环境变量 > `settings.security.cookie_secure` > `not debug`）；② `backend/app/core/config.py` `SecurityConfig` 增加 `cookie_secure: bool\|None`；③ `deploy/docker-compose.deploy.yml` backend environment 增加 `COOKIE_SECURE: ${COOKIE_SECURE:-false}` + `SECURITY__COOKIE_SECURE`，`.env` 加 `COOKIE_SECURE=false`。纯 HTTP 部署默认 false；将来上 HTTPS 改回 true |
| 11 | 重建后 `index.html` 重新引入 3 处 Google Fonts（国内不可达）+ ECharts 同步 CDN 阻塞 | 源码 `frontend/index.html` 模板未同步上次的 dist 级修复 | 源码 `index.html` 删 Google Fonts（系统字体回退）；ECharts 改 async 注入 + `onerror` 降级（仅数据库页 3D 肽结构视图用 `window.echarts` 且有守卫，主图表库是 recharts） |
| 12 | 重建后 `public/sw.js`（原始 TypeScript）再次进入 dist | 上次只修了 dist 级 `sw.js`，源头 `public/sw.js` 未改 | `frontend/public/sw.js` 源头换成 724 字节极简纯 JS SW（v5，install skipWaiting + activate 删 `rmfood-*` 缓存 + claim，无 fetch 拦截） |

**新 dist 部署**：chunk 直接在 `dist/assets/`（非 `dist/assets/js/`），入口 `index-fD-vN2Na.js`；整包 tar（5MB）替换服务器 dist；nginx 更新资产路径（`/assets/` 1y immutable + no-store 于 `/index.html` `/sw.js` `/sw-v4.js` `/manifest.json`），旧 K7/D29D1GB/X9Q2pLm8 三文件名不再需要。

**服务端验证（全通过）**：
- 4 容器 healthy；外部 `/` `/health` `/api/v1/health` 200；`entry / vendor-react / exceljs` 200
- `index.html` 0 处 Google Fonts 引用；`sw.js` `node --check` OK（v5，无 TS 标记）
- 登录 `Set-Cookie` 现为 `HttpOnly; SameSite=strict`（**无 Secure**）；cookie jar 模拟浏览器 `GET /auth/me` = 200
- 服务器已装 Node.js 20.20.2（服务端可自跑 `node --check`）

**构建坑**：`vite.config.optimized.ts` 构建会被 `graceful-fs@1.1.14` 的 `0777` 八进制字面量拒于 rolldown，故采用默认 config + `manualChunks`。

---

---

## 访问入口

| 项目 | 地址 |
|:-----|:-----|
| 前端 Web | http://106.12.20.131/ |
| 健康检查 | http://106.12.20.131/health |
| API 健康 | http://106.12.20.131/api/v1/health |
| API 文档 (Swagger) | http://106.12.20.131/docs/ (301 重定向) |
| 后端直连 | 仅服务器本机 `http://127.0.0.1:8000` |

**管理员账号**: `admin` / `RmF0dPr0d2024!sec`
> 请务必登录后立即修改默认密码。

---

## 服务状态 (4/4 健康)

| 容器 | 状态 | 说明 |
|:-----|:-----|:-----|
| rmfood_postgres | healthy | PostgreSQL 16, 72 张业务表 |
| rmfood_redis | healthy | Redis 7, AOF 持久化 |
| rmfood_backend | healthy | FastAPI, 2 workers :8000 |
| rmfood_web | healthy | Nginx 1.25, 前端静态 + 反向代理 |

---

## 数据库

- 已创建 72/85 张 ORM 表 + 全部 20+ Postgres 枚举类型。
- 管理员用户已注入 `users` 表 (id=1, role=admin, is_active=true)。
- **重要**: 项目 alembic 迁移图存在缺陷 (19 个独立 head + 悬空引用 `a3ac61c2e314`)，
  `alembic upgrade head` 无法执行。本次采用"从 SQLAlchemy ORM 模型直接建表"作为
  全新库的 schema 引导路径。后续 schema 变更建议先修复迁移图。

---

## 已验证功能

- 管理员登录 → 返回有效 JWT (access + refresh)，外部 `login HTTP 200`
- `/api/v1/users` (需管理员) → 返回用户列表
- `/api/v1/formulas` → 正常返回空列表
- 前端页面加载模块 + `<div id="root">` 正常，全部 14 个预加载 chunk 返回 200

---

## 前端白屏问题 (已修复)

- **现象**: 访问 `http://106.12.20.131/` 白屏，控制台报 `n.inherits is not a function`。
- **根因 1 (构建混杂)**: `frontend/dist` 内同时存在**两代**构建产物——旧的扁平
  `assets/*.js` (142 个文件) 与新的 `assets/js/*.js`，`index.html` 预加载的
  `rolldown-runtime` 哈希与磁盘实际文件不匹配，模块图断裂。
  修复: 清除 144 个未引用的旧文件，仅保留 `index.html` 引用的 `assets/js/` 单一代。
- **根因 2 (exceljs / agent-base 打包缺陷，两层)**:
  (a) `feature-ai-chat` chunk 内联的 exceljs 流模块调用 `n.inherits(a,r)`，
      打包器未保留 `util.inherits` 的 CommonJS 互操作助手。
      修复: chunk 头部注入 `__utilInherits` polyfill，3 处调用点替换，`node --check` 通过。
  (b) 同 chunk 内联的 `agent-base`（https-proxy-agent 依赖）执行
      `class Agent extends n.EventEmitter`，而 `n` 来自 `n=hr()`——`hr` 是空 CJS shim
      (`t.exports={}`)，导致 `n.EventEmitter` 为 `undefined`，报
      "Class extends value undefined is not a constructor or null"。
      修复: 注入最小 `EventEmitter` 类（`__rmfoodEE`）+ 空 `Stream` 类，
      并把 `hr` 的空 shim 改为 `t.exports={EventEmitter:__rmfoodEE, Stream:class{...}}`。
- **根因 3 (浏览器缓存穿透，最终手段)**: 同 URL 改内容无法穿透缓存——
  nginx 对带 hash 的 JS 设 `Cache-Control: public, immutable; max-age=1年`，
  且 Service Worker 私有缓存 + `sw.js` 自身也 immutable。
  最终修复: 修补后的 chunk 同时以 **旧名 `D29D1GB` 和新名 `X9Q2pLm8` 两个 URL 提供**
  （两个 URL 都 200、0 处坏调用、含 polyfill）——旧名不能删，因为
  `feature-ai-generate`、`vendor-export` 等 58 个页面 chunk 内部是**静态 import**
  `from "./feature-ai-chat-D29D1GB-.js"`，删旧名会断整站模块图。
  nginx 对这两个具体 URL 设 `no-store, no-cache, must-revalidate`（穿透 immutable 缓存）。
  配套: `sw.js` 缓存版本 v2→v3 (激活时自动清旧 `rmfood-*` 缓存)，
  nginx 对 `/sw.js`、`/sw-v4.js`、`/manifest.json`、`*.html` 设 `no-store, no-cache, must-revalidate`。
- **根因 4 (僵尸 Service Worker，已自清理)**: 旧 SW (v2) 在"清除站点数据"后仍重新种回
  坏 chunk 私有缓存。修复: `index.html` (no-store) 指向新入口 `index-Z4kR8vW7.js`，
  其内嵌自清理逻辑 —— `unregister()` 所有僵尸 `/sw.js` 注册 + 注册 `/sw-v4.js`
  (no-store，激活时删除所有 `rmfood-*` 缓存) + 500ms 后自动 `location.reload()`。
- 验证 (服务端实测): 4 容器 healthy；新旧两个 chunk URL 均 200 且 0 处坏 `inherits` 调用、
  含 `__utilInherits` polyfill + `EventEmitter`/`Stream` shim；入口语法 node --check 通过；
  外部 `/`、`/health`、登录均 200。
  修复后的完整 dist 已烤进 `rmfood-web` 镜像并 `--force-recreate`，容器重建不会复活坏文件。
  **用户侧**: 直接普通刷新即可（index.html no-store → 必然拿到新入口 → 自动清僵尸 SW 并重载）。

---

## 已知限制 (需后续处理)

1. **AI 功能未启用**: `OPENAI_API_KEY` 为空 (LLM 走 DeepSeek 网关)。
   在 `/opt/rmfood/deploy/.env` 填入 key 后 `docker compose up -d` 重启后端即可。
2. **Alembic 迁移图损坏**: 见上, 需代码库侧修复。
3. **非关键路由 circular import 告警**: `app.services.plugin_registry` 的
   `PluginInterface` 循环导入 (非阻塞, 不影响核心功能)。
4. **部分枚举表未重建**: 个别依赖 `syncaction`/`teamrole` 等的表在重建时
   因依赖顺序暂未创建, 核心登录/用户/配方链路不受影响。

---

## 常用运维命令

```bash
# 查看服务
cd /opt/rmfood
docker compose --env-file deploy/.env -f deploy/docker-compose.deploy.yml ps

# 看后端日志
docker logs -f rmfood_backend

# 改配置后重启后端
docker compose --env-file deploy/.env -f deploy/docker-compose.deploy.yml up -d --force-recreate backend

# 全部重启
docker compose --env-file deploy/.env -f deploy/docker-compose.deploy.yml restart
```
