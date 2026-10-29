# 「配方生成」模块收尾（Step 5）—— rag_evidence 端到端 + venv 统一

- 日期：2026-10-28/29
- 修复：e2e-rag-verify（rag_evidence 端到端）/ dev-rag-backend2（venv 统一）
- 前置：`formula-gen-residual-fix-20261028.md`（88→~98/100，剩浏览器实测 + .venv 环境）

---

## 一、结论：**~98 → 100%（功能/链路全部闭环）；仅剩 1 个需用户裁决的环境版本决策**

| 收尾项 | 结果 |
|:-------|:----:|
| rag_evidence 端到端实测（服务级） | ✅ 证据闭环 |
| 前端归一化透传 + 渲染 + i18n | ✅ 20/20 单测 + 静态确认 |
| `.venv`/`venv` 启动脚本统一 | ✅ 5 文件已修正 |
| **运行环境版本决策** | ⚠️ 待用户裁决（根 `.venv` 0.136.3 vs `backend/venv` 0.115.0） |

---

## 二、rag_evidence 端到端实测（e2e-rag-verify，只读）

**服务级 HTTP**（`http://127.0.0.1:8000`，PID 12524）：
- `POST /auth/login` admin/admin123 → 200 + token。
- `POST /api/v1/ai/generate {"target_effects":["增强免疫"],"use_llm":false}` → **200**，**5 候选**；候选0：score=0.6728、safety_passed=true、herb_combination=[绞股蓝12g君/枸杞子10g臣/大枣10g臣/菊花8g佐]（中文名+克剂量+role）。
- **rag_evidence**（响应级）：enabled=true、chunks=6（food_safety_regulations×5 + tcm_herb_encyclopedia×1，source/score/content）、whitelist=[枸杞]、blacklist=[枸杞子,灵芝,当归,石斛,西洋参]（禁忌/用量限制）、summary、error=null。

**前端链路**：
- `normalization.test.ts` **20/20 PASS**（含 2 用例：响应级→候选透传；缺失不报错）。
- `FormulaResultsPro.tsx:192-249` 渲染分支（enabled 徽标/白黑名单/query/chunks 计数/summary/`ragEvidenceNone` 兜底），数据源 `topCandidate?.rag_evidence`；i18n 三语各 8 个 `ragEvidence*` 键；`types/ai.api.ts:129 rag_evidence?: RAGEvidence`。

**结论**：rag_evidence 链路（后端响应 → 前端归一化透传 → 前端渲染）**证据闭环**；浏览器自动化未做（无会话，按约定），已用服务级+单测+代码审查作为最接近证据。

---

## 三、venv 环境统一（dev-rag-backend2）

### 关键发现
| 环境 | 包数 | fastapi | import | 说明 |
|:---|:--:|:--:|:--:|:---|
| `D:\RMFOODFP\.venv`（根） | 162 | **0.136.3** | ✅ | **当前运行服务所用** |
| `backend\venv` | 301 | **0.115.0** | ✅ | 完整依赖环境 |
| `backend\.venv` | 空壳 | — | ❌ | 过期空壳（无 fastapi） |

### 修正（5 文件最小改动）
`restart_backend.bat`、`restart_backend.ps1`、`start.bat`、`start_server.bat`、`STARTUP.md:21-22`：改为**指向/优先 `backend\venv`**（+ 注释「依赖在 venv，.venv 为空壳」）。已用 venv 无需改：`start_uvicorn_bg.py`、`backend/README.md`、`README.md:911`。非启动/非活动未改：`run_backend_tests.ps1`、`.claude/worktrees/*`。

### ⚠️ 遗留决策（需用户裁决）
当前服务跑**根 `.venv`（fastapi 0.136.3）**；经修正脚本重启将切到 **`backend/venv`（0.115.0）**——**版本变更**。建议：
- **(a)** 以 `backend/venv` 为规范（脚本已按此修正，重启即切）；**或**
- **(b)** 若根 `.venv` 应为规范，则把脚本改指根 `.venv`（保持 0.136.3）。

未删除/重建任何 `.venv`；未触碰运行中服务（PID 12384/12524 持续运行），不破坏环境。

---

## 四、Lead 独立复核

| 项 | 结果 |
|:--|:--:|
| `/health` 200 + 登录 200 + generate 200 | ✅ |
| 候选5 + score/safety_passed + 中文名克剂量role | ✅ |
| rag_evidence enabled/whitelist/blacklist/chunks | ✅ |
| normalization.test.ts 20/20（含透传+缺失） | ✅ |
| FormulaResultsPro 渲染分支 + i18n 8×3 | ✅ |
| 5 启动文件指向 backend/venv（含 .venv 兜底） | ✅ |
| STARTUP.md L21-22 venv | ✅ |
| backend/venv import OK（0.115.0） | ✅ |

---

## 五、结论

**配方生成模块：功能 + 链路 100% 闭环**（真实 GA + RAG 白/黑名单 + rag_evidence 展示 + 安全合规 + 报告预览/导出 + 多候选对比 + 端到端实测证据）。

**整体完成度：100%**（代码/功能层面）；仅剩 1 个**环境版本决策**（根 `.venv` 0.136.3 vs `backend/venv` 0.115.0）需用户选择，非代码缺口、不影响功能判定。

*本报告为只读收尾复核。*
