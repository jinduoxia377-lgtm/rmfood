# 诊断报告：GA 引擎返回空候选的"回归"（P0）

- 日期：2026-10-29
- 工作目录：`D:\RMFOODFP\backend`
- 环境：`backend/venv`（Python 3.11.15，fastapi **0.115.0**，sqlalchemy 2.0.35，asyncpg）；对照根 `.venv`（0.136.3 / py3.14）
- 结论：**并非后端 GA 回归**。GA 算法、药材数据、功效索引在 0.115.0 下全部正常。所观察到的 `degraded=True / "GA 引擎未返回候选" / rule_engine_fallback` 由**测试客户端发送 JSON 时未强制 UTF-8 编码**导致——中文功效标签 `增强免疫` 被乱码为 `????`，GA 收到不可匹配的功效标签，`_select_herbs` 返回 0 候选，静默回退规则引擎。

---

## 1. 任务背景与现象

- 重启服务到 `backend/venv`（fastapi 0.115.0）后，`POST /api/v1/ai/generate {"target_effects":["增强免疫"],"use_llm":false}` 返回：
  - `degraded=True`，`fallback_reason="GA 引擎未返回候选"`，`generated_by=rule_engine_fallback`
  - 输出为 6 味 × 16.7g 均匀（`_fallback_rule_engine` 签名）
- 重启前（根 `.venv` 0.136.3）同请求返回真实 GA（score=0.6728，绞股蓝 12g 君 / 枸杞子 10g 臣 / 大枣 10g 臣 / 菊花 8g 佐）。
- 唯一变化变量：venv（0.136.3/py3.14 → 0.115.0/py3.11）。

## 2. 根因（证据链）

### 2.1 排除依赖/代码/数据回归
- **隔离复现**（backend/venv 0.115.0，fresh 全局 `HerbKnowledgeService`，同代码同 DB）：
  - `HerbKnowledgeService.load_herbs()` → **590 味药材 / 98 个功效键 / 562 味有功效**；`免疫调节=11`、`补气=13`、`抗炎=11`、`抗氧化=9`——功效索引**非空且正确**。
  - `run_ga_generation(["增强免疫"])` 直接调用 → `degraded=None`，`generated_by=ga_optimizer`，candidates=5，overall=0.6761，组合克重不等（枸杞 9g 君 / 菊花 7g 臣 / 甘草 6g 臣 / 大枣 6g 佐 / 山药 3g 使）——**GA 正常产出真实候选**。
  - 完整 `init_ai_services()`（模拟运行服务完整 import 链，backend/venv）→ 同样 590 药材 / 98 功效 / 562 有功效 / 免疫调节=11 等。
- **结论**：代码 + 药材数据 + GA 算法在 0.115.0 下均正常。`get_global_herb_knowledge()` 非空（无 503），RAG 黑名单去黑名单重试逻辑也正常。

### 2.2 定位真实触发点：功效标签乱码
- 在运行服务内加临时 DEBUG 日志后复现：
  - `[DEBUG_GA] _try_load_herb_knowledge global-path: herbs=590 index_keys=98`——**药材/索引正确**。
  - `[DEBUG_GA] _select_herbs: effects=['????'] herbs=590 index_keys=98 exclude=0 include=0`——**传入 `_select_herbs` 的目标功效是 `['????']`（乱码）**，而非 `['免疫调节','补气','抗炎','抗氧化']`。
  - 日志仅出现 `候选药材不足 (0)` 与 `GA 引擎未返回候选`。
- 即：`build_tcm_keywords(["增强免疫"])` 实际收到的是乱码标签 `"????"` → 回退 `[????]`（映射表无此键）→ `_translate_effect_ids` 也回退 `[????]` → `_efficacy_index` 中无 `????` 键 → `_select_herbs` 返回 0 → `候选药材不足 (0)` → 静默回退规则引擎。

### 2.3 根因判定
- 后端服务**没有**把 `增强免疫` 变成 `????`——是**发起请求的客户端**在序列化/传输 JSON body 时未强制 UTF-8，把中文字符替换成 `?`。
- PowerShell 的 `Invoke-WebRequest -Body $jsonString` 默认不保证 UTF-8 编码；当改用显式 UTF-8 字节 body 后，同一服务、同一路径返回**真实 GA**。

## 3. 修复

### 3.1 事实：无后端 GA 回归可修
- 后端 GA 在 0.115.0 下已验证产出真实候选，无需改动 GA 算法、无需改动 `_select_herbs`/`_try_load_herb_knowledge`。

### 3.2 防御性自愈（已加，非本次现象根因）
- 文件：`backend/app/services/ai/formula_generation_service.py`（`run_ga_generation`，L328-344）。
- 内容：在 503 检查后，若 `get_global_herb_knowledge()` 存在、`get_herbs()` 非空但 `get_efficacy_to_herbs()` 为空（启动时序载入不完整这一**可能**失效模式），则 `await load_herbs(force_reload=True)` 强制重载一次，并记录告警/完成日志。
- 说明：
  - 不改变 GA 算法正确性。
  - 正常路径不触发（功效索引非空即跳过）。
  - 异常安全（重载失败仅告警，GA 按当前数据执行，不抛错）。
  - 该自愈针对"启动时序导致功效索引为空"的**防御性**加固；本次观察到的 `????` 乱码现象并非由此触发，故自愈不是本次现象的修复，而是对同类空索引失效模式的前置防护。

### 3.3 调用方约定（重要）
- `POST /api/v1/ai/generate` 的请求体含中文（如 `target_effects`），**客户端必须以 UTF-8 编码发送 JSON body**（如 `Content-Type: application/json; charset=utf-8`，body 为 UTF-8 字节）。
- 以非 UTF-8 发送中文标签会导致标签乱码（`增强免疫`→`????`），GA 因无法匹配功效而回退规则引擎。这不是后端缺陷。

## 4. 验证

### 4.1 backend/venv（0.115.0）— 隔离脚本 + UTF-8 HTTP
- 隔离 `run_ga_generation(["增强免疫"])`：ga_optimizer，5 候选，overall=0.6761，克重不等。
- UTF-8 HTTP `POST /api/v1/ai/generate`（backend/venv 0.115.0）：
  - `增强免疫`：`degraded` 非 true，`generated_by=ga_optimizer`，candidates=5，overall=0.6768，组合 = 大枣 9g 君 / 金银花 9g 臣 / 黄芪 9g 臣 / 生姜 6g 佐 / 甘草 4g 佐（**克重不等**）。
  - DEBUG_GA 显示 `effects=['免疫调节','补气','抗炎','抗氧化']`，`herbs=590 index_keys=98`——功效标签与索引均正确。
- **终验（backend/venv 0.115.0 当前运行服务，UTF-8）**：
  - `增强免疫`：ga_optimizer，n=5，overall=0.6753，组合 = 大枣 10g 君 / 金银花 6g 臣 / 生姜 5g 臣 / 甘草 4g 佐。
  - `提高抵抗力`：ga_optimizer，n=5，overall=0.629，组合 = 茯苓 10g 君 / 党参 6g 臣 / 大枣 6g 臣 / 白术 6g 佐。
  - `安神定志`：ga_optimizer，n=5，overall=0.6248，组合 = 茯苓 10g 君 / 枸杞子 6g 臣 / 大枣 6g 臣 / 菊花 5g 佐。
  - 三功效组合**互异**、均克重不等；3 次连续 `增强免疫` 均 ga_optimizer/n=5——**0.115.0 稳定复现**。

### 4.2 根 .venv（0.136.3）— UTF-8 HTTP 基线（当前运行服务）
- `增强免疫`：ga_optimizer，overall=0.6796，组合 = 黄芪 12g 君 / 金银花 9g 臣 / 大枣 9g 臣 / 生姜 6g 佐。
- `提高抵抗力`：ga_optimizer，overall=0.6294，组合 = 茯苓 10g 君 / 大枣 6g 臣 / 党参 5g 臣 / 菊花 5g 佐。
- `安神定志`：ga_optimizer，overall=0.6238，组合 = 大枣 6g 君 / 枸杞子 6g 臣 / 菊花 5g 臣 / 生姜 3g 佐。
- **三功效组合互异**（证明非固定回退、GA 按功效动态选药），均为克重不等。
- 3 次连续 `增强免疫`：全部 `ga_optimizer`、n=5——**稳定**。

### 4.3 断言汇总
| 断言 | 结果 |
|---|---|
| degraded 非 true（UTF-8 请求） | ✅（backend/venv 与根 .venv 均满足） |
| generated_by=ga_optimizer（非 rule_engine_fallback） | ✅ |
| 候选为真实 GA（克重不等、功效相关） | ✅ |
| 不同功效候选不同（增强免疫≠提高抵抗力≠安神定志） | ✅ |
| 0.115.0 下稳定复现（3x 连续） | ✅ |
| 功效索引非空（590 药材/98 键/562 有功效） | ✅ |

## 5. 运行进程说明
- 诊断过程中经 Lead 批准多次重启以加载改动/探活。
- 当前 `:8000` 服务已由外部监督器恢复为根 `.venv`（0.136.3 / py3.14，PID 12200 启动器 → 13984 工作进程），`/health` 200，UTF-8 请求返回真实 GA（见 4.2）。
- `backend/venv`（0.115.0）服务已被隔离脚本 + UTF-8 HTTP 验证产出真实 GA（见 4.1）。

## 6. 遗留 / 建议
1. **调用方统一 UTF-8**：所有含中文的 API 请求体必须 UTF-8 编码；建议前端/测试脚本显式 `charset=utf-8` + UTF-8 字节 body。这是本次"回归"的根因。
2. **自愈加固**：`run_ga_generation` 的空功效索引自愈为防御性措施，可保留以防启动时序失效；若后续确认该失效模式从不发生，可移除。
3. 未删除/重建任何 `.venv`；未改前端；未改回 `rule_engine_fallback` 为默认；未伪造候选。

## 附：临时诊断文件（诊断后清理）
- `backend/scripts/_diag_ga_herbs.py`、`_diag_ga_optimize.py`、`_diag_ga_run.py`、`_diag_ga_fullimport.py`、`_diag_ga_initai.py`
- `tmp_diag*.txt`、`backend/uvicorn_diag.out.log`、`backend/uvicorn_diag.err.log`
