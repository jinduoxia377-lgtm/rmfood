# UTF-8 请求约定核查与文档化验证报告

- 核查日期：2026-10-29
- 核查人：dev-rag-frontend2（前端开发专家）
- 范围：前端 API 层只读核查 + 后端文档补丁；未动运行进程
- 背景：GA「空候选」根因 = 调用方把中文功效标签乱码为 `????`（PowerShell 字符串 body 未强制 UTF-8）。真实前端应默认 UTF-8（fetch + JSON.stringify）。

---

## 一、前端 API 层 UTF-8 核查结论

### 1.1 请求体发送路径（generate / chat / rag）

| 路径 | 文件:行号 | 编码方式 | 结论 |
|:----|:----|:----|:----|
| `/ai/generate`（功效标签中文 body） | `api/ai.ts` L924 `api.post('/ai/generate', {...})` | axios `JSON.stringify` + `application/json` | ✅ UTF-8 |
| `/ai/chat`（中文 question/history） | `api/ai.ts` L1212 `api.post('/ai/chat', { question, history, scenario_mode })` | 同上 | ✅ UTF-8 |
| `/ai/chat/stream` | `api/ai.ts` L1222 `api.post('/ai/chat/stream', { question, history, stream, scenario_mode }, {...})` | 同上（config 无 charset 覆盖） | ✅ UTF-8 |
| `/ai/formula/knowledge`（中文 query） | `api/ai.ts` L197 | 同上 | ✅ UTF-8 |
| `/ai/formula/validate` / `repair-structured` / `feedback` | `api/ai.ts` L188/L294/L308 | 同上 | ✅ UTF-8 |
| `/chat/sessions` / `/chat/sessions/:id/messages` | `api/chat.ts` L78/L98 | `api.post(url, data)` | ✅ UTF-8 |
| `/rag/query` | `api/rag.ts` L173 | `api.post('/rag/query', null, {params})`（中文走 URL 参数，axios 百分号编码 UTF-8） | ✅ UTF-8 |
| `/rag/seed` | `api/rag.ts` L205 | 无 body | ✅ |
| `/rag/upload`（文件名/字段中文） | `api/rag.ts` L134-138 | `FormData` + `multipart/form-data`，浏览器按 UTF-8 编码字段（boundary 为 ASCII，不涉及中文） | ✅ UTF-8 |

**基座客户端**：`api/client.ts` L31-37 —— `axios.create({ baseURL, timeout, headers: { 'Content-Type': 'application/json' }, withCredentials })`。axios 默认 `transformRequest` 用 `JSON.stringify` 并以 **UTF-8** 字节发送 JSON body；未设置 `charset` 覆盖为非 UTF-8。

### 1.2 破坏点扫描（全文 `frontend/src/api/`）

| 扫描项 | 结果 | 说明 |
|:----|:----|:----|
| `encodeURIComponent` | 命中但**全部在 URL 路径/查询参数** | `database.ts:139/143`、`compliance.ts:120/126`、`rag.ts:157`、`import.ts:79`、`formula.ts:263/509/555`、`searchNew.ts:428/463` —— 均为 URL 编码（RFC 3986），不作用于请求体，不破坏中文 |
| `btoa(` / `escape(` / `unescape(` / `String.fromCharCode` | **0 命中** | 无手动 Latin-1/Base64 拼接中文 |
| `FormData` / `multipart/form-data` | 命中但均为**文件上传** | `admin.ts:120`、`attachment.ts:20`、`experiment.ts:150`、`rag.ts:134`、`labelCheck.ts:49`、`import.ts:68`、`formula.ts:695` —— 浏览器按 UTF-8 编码表单字段；boundary 为 ASCII，无中文边界问题 |
| `application/x-www-form-urlencoded` | **0 命中** | 无手拼 query-string body |
| `charset=`（非 UTF-8 覆盖） | **0 命中** | 全 api 目录无 `charset=` 覆盖 |
| `fetch(` 手动 body | 命中但均为 `JSON.stringify` + `application/json` | `apiArchitecture.ts:504-517`、`deep_dev.ts:177-381`、`agent.ts:99-162`、`compliance.ts:60-89`、`fileGenerator.ts:49-173`、`explainability.ts:86-111`、`searchNew.ts:185-280`、`template.ts:37-38`、`labelCheck.ts:37-64` —— 全部 UTF-8 |
| WebSocket body | `formula.ts:343` `ws.send(JSON.stringify({...}))` | JSON 字符串 → UTF-8（WebSocket 默认 UTF-8） |

### 1.3 结论

**前端 API 层已满足 UTF-8 约定，无破坏点，无需修复。**
- 所有含中文的 JSON 请求体：`JSON.stringify` + `Content-Type: application/json`（axios/fetch 默认 UTF-8，无 `charset` 覆盖）。
- FormData 文件上传：浏览器 UTF-8 编码字段，boundary ASCII，无中文边界问题。
- URL 查询参数中文：axios `encodeURIComponent` 百分号编码（UTF-8 字节）。
- 无 `btoa`/`escape`/`String.fromCharCode`/Latin-1/GBK 手动字节编码破坏中文。

> 根因（`????`）发生在**非浏览器调用方**（PowerShell 脚本手动拼字符串 body 未强制 UTF-8），而非前端 `fetch`/axios。前端无需改动。

---

## 二、文档补丁位置

| 文件:行号（补丁后） | 内容 |
|:----|:----|
| `backend/README.md` L77-78（`## API 概览` 表格后、`## 测试` 前） | 新增 blockquote 约定：**「请求体编码约定（UTF-8）：所有含中文的 API 请求体须为 UTF-8（`charset=utf-8` + UTF-8 字节 body），否则中文可能乱码为 `????`。」** 附前端已默认 UTF-8 的说明 + ⚠️ 非浏览器调用方（PowerShell/脚本手动拼 body）须显式 `[System.Text.Encoding]::UTF8` 编码、禁止把中文当 Latin-1/GBK 发送 |

> 主 `README.md` 无独立「API 调用说明」章节（仅 L470/L831 泛提 UTF-8 强制编码），故补丁落在 `backend/README.md` 的 `## API 概览`（API 文档入口）。

---

## 三、i18n 中文功效标签抽查（zh-CN 正常，非 `????`）

| 位置 | 值 |
|:----|:----|
| `config/ai/effects.ts` L16 `EFFECT_OPTIONS` | `label: '增强免疫'`（`labelKey: 'immune_enhancement'`）、L30 `label: '抗疲劳'`、L63 `label: '改善睡眠'` 等 —— 全部正确中文 |
| `i18n/zh-CN/ai.ts` L698 `ai.formula.effects.labels.immune_enhancement` | `'增强免疫'` ✅ |
| `i18n/zh-CN/ai.ts` L704 `...labels.anti_fatigue` | `'抗疲劳'` ✅ |
| `i18n/zh-CN/ai.ts` L719 `...labels.sleep_improvement` | `'改善睡眠'` ✅ |

> zh-CN 下功效标签为正确中文（无 `????`）；`EFFECT_OPTIONS.label` 为硬编码中文（作为 i18n 兜底与发送给后端的精确 label，契约对齐见 `generateTabConfig.ts:129-133`）。抽查未发现乱码。

---

## 四、验收

| 验收项 | 结果 |
|:----|:----|
| 前端 API 层 generate/chat/rag 请求体为 UTF-8 | ✅ `JSON.stringify` + `application/json`，无 `charset` 覆盖 |
| 无中文破坏点（btoa/escape/fromCharCode/Latin-1） | ✅ 全目录 0 命中 |
| FormData/multipart 中文边界问题 | ✅ 无（仅文件上传，浏览器 UTF-8 编码字段） |
| 文档补丁 | ✅ `backend/README.md` `## API 概览` 下新增 UTF-8 约定 |
| i18n zh-CN 功效标签正常 | ✅ 抽查 3 处，均正确中文 |

---

*核查为只读为主；唯一写操作 = `backend/README.md` 文档补丁（markdown，无构建影响）；未动运行进程；前端未改代码。*
