# Step5 收尾 —— (a) 重启到 backend/venv + 复测（含 GA 实测）

- 日期：2026-10-29
- 执行：dev-rag-backend2（重启+诊断）/ lead 独立复测
- 前置：`formula-gen-closure-step5-20261028.md`（功能100%闭环，剩 venv 版本决策）

---

## 一、结论：✅ 按 (a) 以 backend/venv 为规范，重启后全链路复测通过，GA 为真实算法输出

| 检查项 | 结果 |
|:-------|:----:|
| 进程切换到 backend/venv（fastapi 0.115.0 / py3.11.15） | ✅ PID 3076→4400 |
| /health 200 | ✅ |
| login admin/admin123 200 | ✅ |
| /ai/generate（增强免疫）真实 GA | ✅ degraded 空，n=5，overall≈0.676 |
| 三功效候选互异、克重不等 | ✅ |
| 3× 增强免疫稳定（0.6758/0.6755/0.6805） | ✅ |
| RAG rag_evidence 无回归 | ✅ |

---

## 二、GA「空候选」事件——真实根因（非后端回归）

复测中观察到 `degraded=True / rule_engine_fallback`（GA 引擎未返回候选）。**排除法 + DEBUG 定位**：

- GA 优化器仅用 stdlib（math/random/threading），无 numpy/scipy——版本差异不作用于 GA 核心。
- 隔离 `run_ga_generation(["增强免疫"])`（backend/venv 0.115.0，fresh 服务）：herbs=**590**、功效键=**98**、562/590 有功效——功效索引**非空正确**；返回 ga_optimizer、candidates=5、overall=0.6761、克重不等。**GA 本身正常**。
- 运行服务内 DEBUG：`_try_load_herb_knowledge: herbs=590 index_keys=98`（正确），但 `_select_herbs: effects=['????']`——**目标功效被测试客户端乱码为 `????`**（PowerShell `Invoke-WebRequest` 字符串 body 未强制 UTF-8），索引无该键 → 候选=0 → 静默回退规则引擎。
- **根因 = 调用方编码问题**，非服务/依赖/数据缺陷。

### 修复
`formula_generation_service.py` L328-344 新增**防御性自愈**：若全局 HerbKnowledge 已有药材但功效索引为空（潜在启动时序失效），`force_reload` 一次；不改 GA 算法、正常路径不触发、异常安全。临时 DEBUG 已还原。py_compile OK。

---

## 三、Lead 独立复测（cookie-aware UTF-8 HttpClient）

| 功效 | degraded | gen_by | n | overall | 组合（克重不等） |
|:---|:--:|:--:|:--:|:--:|:---|
| 增强免疫 | 空 | ga | 5 | 0.6758 | 黄芪9.0g君/大枣9.0g臣/菊花7.0g臣/生姜6.0g佐 |
| 提高抵抗力 | 空 | ga | 5 | 0.6289 | 茯苓10.0g君/大枣6.0g臣/白术6.0g臣/党参5.0g佐 |
| 安神定志 | 空 | ga | 5 | 0.6248 | 茯苓10.0g君/枸杞子6.0g臣/大枣6.0g臣/菊花5.0g佐 |

三功效**互异**、均克重不等；3× 增强免疫 = 0.6758/0.6755/0.6805（稳定）。

---

## 四、结论

1. **venv 统一（a）完成**：backend/venv（0.115.0）为规范，5 个启动脚本指向它；服务已在其上运行并复测通过。
2. **GA 真实算法输出确认**：增强免疫/提高抵抗力/安神定志 均返回**真实 GA 候选**（非规则回退、非伪造），克重不等、功效相关。
3. **遗留约定**：所有含中文 API 请求体须 UTF-8（`charset=utf-8` + UTF-8 字节 body）——本次"回归"根因在调用方；自愈为防御性加固，可保留。

**配方生成模块：功能 + 链路 100% 闭环，GA 实测为真实算法输出。**
