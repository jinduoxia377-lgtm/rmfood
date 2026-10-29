# 配方生成 .venv/venv 环境统一核查 验证报告

- 处理日期：2026-10-29
- 执行角色：RMFOODFP 后端开发专家（dev-rag-backend2）
- 范围：只读核查 + 启动脚本/文档最小修正；**未删除/重建 .venv**；未破坏运行中服务。

---

## ⚠️ 关键发现（与任务前提不一致，须 lead 知悉）
**运行中的后端服务实际使用 `D:\RMFOODFP\.venv`（项目根 `.venv`），而非 `backend\venv`。**

| 环境 | site-packages 实体 | fastapi 版本 | import 实测 | 说明 |
|:---|:--:|:--:|:--:|:---|
| `D:\RMFOODFP\.venv`（**根**） | 162 | **0.136.3** | ✅ | **当前运行服务（PID 12384/12524）所用**，手动启动，非任何脚本 |
| `backend\venv` | 301 | 0.115.0 | ✅ | 任务所述「实际依赖」；修正后脚本指向它 |
| `backend\.venv` | 24（空壳） | — | ❌ `ModuleNotFoundError: fastapi` | 过期空壳，无真实依赖 |

- 运行进程：`Get-Process python` → PID **12384 / 12524**，Path=**`D:\RMFOODFP\.venv\Scripts\python.exe`**，
  Cmd=`-m uvicorn app.main:app --host 0.0.0.0 --port 8000`（任务所述 PID 10836/11744 未运行）。
- **结论**：任务前提「实际依赖在 backend/venv」只对了一半——backend/venv 确实完整（301），但**当前服务跑在根 `.venv`（162，版本更新 0.136.3）**。两者为**不同版本**环境。

---

## 一、启动/运行路径 venv 引用核查

### 1.1 运行中进程（实测）
- uvicorn 服务（PID 12384/12524）：`D:\RMFOODFP\.venv\Scripts\python.exe`（**根 .venv**，手动启动）。

### 1.2 启动脚本/文档引用（活动工作区）
| 文件 | 引用 | 判定 |
|:---|:---|:---|
| `backend\restart_backend.bat` | 原 `.venv\Scripts\python.exe` | ❌ 引用空壳（会失败）→ **已改 `venv`** |
| `backend\restart_backend.ps1` | 原 `.venv/Scripts/python.exe` | ❌ 同上 → **已改 `venv`** |
| `backend\start.bat` | 原优先 `.venv` | ❌ 会选中空壳 → **已改优先 `venv`** |
| `backend\start_server.bat` | 原优先 `.venv` | ❌ 同上 → **已改优先 `venv`** |
| `STARTUP.md:21` | 原 `.venv\Scripts\python.exe` | ❌ → **已改 `venv`** |
| `backend\start_uvicorn_bg.py:12` | `backend\venv\Scripts\python.exe` | ✅ 已用 `venv` |
| `backend\README.md` | `.\venv\Scripts\python.exe` | ✅ 已用 `venv` |
| `README.md:911` | `python -m venv venv` | ✅ 已用 `venv` |
| `backend\scripts\run_backend_tests.ps1` | 根 `.venv`（测试用，根 .venv 有效） | ⚠️ 非启动脚本，可用，未改 |
| `.claude\worktrees\*\...` | 多处 `.venv` | ⚠️ 其他 git worktree/分支，**不在活动工作区**，未改（避免干扰其他 agent） |

### 1.3 修正（最小改动，不破坏）
- `backend/restart_backend.bat`、`backend/restart_backend.ps1`：`.venv` → `venv`（+注释「依赖在 venv，.venv 为空壳」）。
- `backend/start.bat`、`backend/start_server.bat`：优先 `venv`，`.venv` 降为最后兜底（+警告）。
- `STARTUP.md`：`.venv\Scripts\python.exe` → `venv\Scripts\python.exe`（+注释）。

---

## 二、任务 3：确认 `backend\venv` import 正常 — ✅
`backend\venv\Scripts\python.exe -c "import fastapi, sqlalchemy, pydantic, asyncpg"` → **BACKEND_VENV_IMPORT_OK**
（fastapi 0.115.0 / sqlalchemy 2.0.35 / pydantic 2.13.5）。`backend\.venv` 同命令 **失败**（No module named 'fastapi'）——确认其为空壳。

---

## 三、结论与建议
1. **统一用 `backend\venv`**（任务意图，301 包完整）：4 个启动脚本 + STARTUP.md 已改为指向/优先 `venv`。
2. **遗留决策（lead）**：当前运行服务用**根 `.venv`**（fastapi 0.136.3）。若经修正脚本重启，将切到 `backend\venv`（0.115.0）——版本变更。建议二选一：
   - (a) 以 `backend\venv` 为规范（本报告已按此修正脚本），后续删除/忽略根 `.venv` 与 `backend\.venv`；
   - (b) 若根 `.venv`（更新版本）应为主，则脚本改指向根 `.venv`，并将 `backend\venv` 视为陈旧副本。
3. **未执行**：未删除 `backend\.venv`/根 `.venv`、未重建任何 venv（保留与否由用户决定）；未触碰运行中服务（PID 12384/12524 持续运行）。

---

## 四、改动文件汇总
1. `backend/restart_backend.bat`（`:7-8`）
2. `backend/restart_backend.ps1`（`:11-14`）
3. `backend/start.bat`（`:17-26`）
4. `backend/start_server.bat`（`:15-24`）
5. `STARTUP.md`（`:20-22`）

## 五、环境备注
- 仅改 5 个启动脚本/文档（bat/ps1/md），未碰 Python 代码、未删/建 venv。
- `.claude\worktrees\*` 的 `.venv` 引用为其他分支副本，不在本次范围。
