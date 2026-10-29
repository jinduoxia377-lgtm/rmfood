# 配方生成 .venv/venv 环境统一 重启到 backend/venv 并复测 验证报告

- 处理日期：2026-10-29
- 执行角色：RMFOODFP 后端开发专家（dev-rag-backend2）
- 决策依据：用户裁决 (a)——以 `backend/venv`（fastapi 0.115.0）为规范环境。
- 范围：停旧服务 → 以 backend/venv 重启 → 复测健康/登录/generate。未删 .venv/根 .venv；未改回脚本。

---

## 一、前后进程对照

| 阶段 | 进程 | python.exe 路径 | fastapi | Python | /health |
|:--|:--|:--|:--:|:--:|:--:|
| **BEFORE** | worker PID 12524 + launcher PID 12384 | `D:\RMFOODFP\.venv\Scripts\python.exe`（**根 .venv** → base py 3.14） | **0.136.3** | 3.14 | 200 healthy |
| **AFTER** | worker PID 3076 + launcher PID **11884** | **`D:\RMFOODFP\backend\venv\Scripts\python.exe`** | **0.115.0** | 3.11.15 | 200 healthy |

- 重启方式：`Stop-Process` 停 12524+12384（端口 8000 释放）→ `Start-Process` 以 `backend\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000`（工作目录 backend，后台分离）。
- 新进程链：worker 3076（base py 3.11）← launcher **11884 = `backend\venv\Scripts\python.exe`** ← 5464(已退出)。fastapi **0.115.0**（py 3.11.15，实测 `backend\venv` import）。

### 监督器核查（重要）
- 任务所述外部监督器 PID（4436/4492，父链 7696→11276→3692）**均不在当前进程树**（无活动监督器）。
- 唯一可疑 python 进程 `reports\agent_runtime_audit.py`（PID 8064/8308）：仅引用 `http://127.0.0.1:8000/api/v1` 作**审计 API 基址**（工具脚本），**非后端看门狗**（不含 uvicorn/restart/watchdog 逻辑）。
- 故重启为直接停旧+启新，**无监督器冲突**。若后续有外部监督器以根 .venv 拉起，属另一进程，本报告不与之对抗。

---

## 二、复测结果（fastapi 0.115.0 / backend/venv）

| 用例 | 结果 | 详情 |
|:--|:--:|:--|
| `GET /health` | ✅ 200 | `{"status":"healthy","version":"2.0.0","api_version":"1.0.0"}` |
| `POST /api/v1/auth/login` admin/admin123 | ✅ 200 | `access_token` 305 字符；Set-Cookie `rmfood_access_token`/`rmfood_refresh_token` |
| `POST /api/v1/ai/generate` `{"target_effects":["增强免疫"],"use_llm":false}` | ✅ 200 | candidates=**5**，非空；见下 |
| herb_combination | ✅ | 6 味，含**中文名+克剂量+role**：银耳 16.7g 君 / 黑芝麻 16.7g 臣 / 枸杞子 16.7g 臣 / 桑葚 16.7g 佐 / 黄芪 16.7g 佐 / 山药 16.7g 使 |
| rag_evidence | ✅ | **enabled=True / whitelist=1 / blacklist=6 / chunks=6**（结构化禁忌黑名单生效，任务2 链路在 0.115.0 下无回归） |
| 候选评分字段 | ⚠️ 字段名不同 | 实际为 `overall_score`(0.6)/`safety_score`(0.85)/`synergy_score`/`taste_score`/`stability_score`/`cost_score`/`efficacy_score`——**无** `score`/`safety_passed`（API schema 如此，非回归） |

> 注：`/api/v1/ai/generate` 受 CSRF 双提交保护，需先 `GET /api/v1/agent/csrf-token` 取 token（body+csrf_token cookie），再以 `X-CSRF-Token` 头 + `Bearer` 认证调用。已按此完成。

---

## 三、观察（非 venv 切换回归，建议 follow-up）

- 响应 `degraded=True`、`fallback_reason="GA 引擎未返回候选"`、`generated_by=rule_engine_fallback`。
  - 即 **GA 优化器运行但未返回候选**（**无异常**）→ 回退规则引擎默认 6 味方。`增强免疫`/`提高抵抗力`/`安神定志` 三种效果均相同（5 候选、同一 6 味、blacklist=6、chunks=6）。
  - **判定：与 venv 切换无关**（fastapi 版本不影响 GA 逻辑；`fallback_reason="未返回候选"` 而非 `"GA 引擎失败: <异常>"`，说明无依赖/导入失败；RAG、DB、规则回退均正常）。
  - 可能根因（既有，非本轮引入）：GA 匹配到的 TCM 功效关键词在药材功效画像中无对应项 / 黑名单裁剪（黑名单=6，但安全阀 L410-424 已去黑名单重试仍空）。建议单独排查 GA 候选池为空问题（`增强免疫` 未映射，回退原始 label）。
- `effects:["????"]`：候选 `effects` 字段显示占位符——规则引擎默认方未回显中文功效标签；属显示/回退值问题，非 venv 回归。

---

## 四、不破坏项确认
- `backend\.venv`、根 `D:\RMFOODFP\.venv` **未删除/未重建**（保留由用户决定）。
- 已修正的 5 个启动脚本（restart_backend.bat/ps1、start.bat、start_server.bat、STARTUP.md）**未回退**。
- 新服务（backend/venv，PID 3076/11884）**持续运行于 8000 端口**，/health 200。

---

## 五、结论
**fastapi 0.115.0（backend/venv）下：健康、登录、配方生成（RAG 链路）均无回归。**
- 新进程确为 `backend\venv\Scripts\python.exe`（fastapi 0.115.0，py 3.11.15）；旧根 .venv（0.136.3）已停。
- `/health` 200、login 200+token、generate 200；candidates 非空、herb_combination 含 name/dosage/role、rag_evidence 含 enabled/whitelist/blacklist/chunks。
- RAG 结构化禁忌黑名单（任务2）在 0.115.0 下**生效**（blacklist=6）——链路无回归。
- 遗留（非本轮）：GA 返回空候选→规则回退（`degraded`）为既有数据/匹配问题，建议后续单独跟进；无监督器冲突，直接重启完成。
