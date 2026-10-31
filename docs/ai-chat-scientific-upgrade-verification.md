# 智能对话科学级完善 - 验证报告

- **项目**：RMFOOD（食源性药食同源配方平台）
- **验证对象**：「智能对话」科学级完善（后端 task-1 + 前端 task-2）
- **验证角色**：QA 验证工程师（task-3）
- **验证日期**：2026-10-22
- **结论**：静态核验全部通过；后端 45 个测试用例通过、前端 eslint 0 errors / tsc 通过 / 新增 vitest 15 个用例通过。未发现阻断性缺陷；发现 1 个中等级别的命令级问题（单文件后端测试触发覆盖率门禁导致非零退出）与若干低级别建议项，详见下文。

---

## 1. 验证环境

| 项 | 值 |
| --- | --- |
| 工作目录 | `D:\RMFOODFP` |
| 后端解释器 | `backend\venv\Scripts\python.exe`（虚拟环境） |
| 后端测试框架 | pytest + pytest-cov（`pytest.ini` 配置 `--cov=app`，`fail_under = 75`） |
| 前端 Node 环境 | `C:\nvm4w\nodejs\node.exe`（npm / npx 可用） |
| 前端测试框架 | vitest v3.2.6 |
| 数据库 | 未连接真实数据库；后端测试使用 `AsyncMock` / `patch` / 依赖覆盖（dependency override） |
| 网络 | 无外部 LLM 调用；测试不依赖真实模型服务 |

---

## 2. 改动清单（静态核验）

### 2.1 后端（task-1）

| 文件 | 状态 | 核验要点 |
| --- | --- | --- |
| `backend/app/services/ai/formula_intelligence.py` | 新增（783 行） | 存在且内容符合描述：`validate_formula`（原料库匹配 + 剂量状态判定 + SafetyAlertSystem 三级预警 + CompatibilityChecker 4 层检测 + 十八反/十九畏静态表 + 过敏原匹配）；`retrieve_herb_knowledge`（FoodMaterial 关键词检索）；所有外部依赖调用处均 `try/except` 优雅降级；`__all__` 导出完整。 |
| `backend/app/api/ai_modules/formula_intelligence.py` | 新增（97 行） | 存在且内容符合描述：`POST /formula/validate`、`POST /formula/knowledge`；依赖 `require_tenant + get_db_session + get_current_active_user`；异常转 500 并记录日志。 |
| `backend/app/api/ai_modules/__init__.py` | 修改 | 已注册路由：第 47 行 `from .formula_intelligence import sub_router as formula_intelligence_router`，第 60 行 `router.include_router(formula_intelligence_router)`。 |
| `backend/app/api/ai_modules/chat.py` | 修改 | `_build_system_prompt` 已改为 `async def`（第 163 行）；两个调用点（`/chat` 第 407 行、`/chat/stream` 第 607 行）均使用 `await`；formula_design 场景注入「【平台知识库参考】（来源：平台原料库）」（第 185-201 行），失败静默降级不影响对话。 |
| `backend/tests/api/test_formula_intelligence.py` | 新增（610 行） | 存在；覆盖纯逻辑单测、服务层 mock 测试、chat 知识注入测试、API 路由测试（含登录校验、422 校验）。 |

### 2.2 前端（task-2）

| 文件 | 状态 | 核验要点 |
| --- | --- | --- |
| `frontend/src/api/ai.ts` | 修改 | 新增 `validateAiFormula`（POST `/ai/formula/validate`）、`retrieveHerbKnowledge`（POST `/ai/formula/knowledge`）；类型 `AiFormulaValidationResponse`（含 `valid?`/`blocked_by_critical`/`is_safe?` 兼容字段）、`AiHerbKnowledgeItem`、`AiHerbKnowledgeResult`（`items` 字段）。 |
| `frontend/src/components/ai/features/ChatTab.tsx` | 修改 | 保存前校验已接入（第 210-253 行）：`blocked_by_critical=true` 阻断保存并展示错误摘要；warnings/suggestions 追加到 `payload.notes`（【AI校验】前缀）；接口异常 `validationSkipped=true` 不阻断保存但提示「校验服务暂不可用」（诚实降级）。 |
| `frontend/src/components/ai/features/hooks/useReportGenerator.ts` | 修改 | 导出已改为真实端点：`POST /reports/explainability/pdf`（responseType blob）、`/reports/explainability/docx`（blob）、`/reports/explainability/markdown`（JSON → .md 文本 Blob）；参数用 `URLSearchParams` 表单编码（后端 FastAPI query/form 风格）。 |
| `frontend/src/api/__tests__/ai.test.ts` | 新增 | 覆盖两个新 API 的路径与 payload。 |
| `frontend/src/components/ai/features/__tests__/unit/ChatTab.structureValidation.test.tsx` | 新增 | 覆盖保存前校验 4 条分支（CRITICAL 阻断 / warnings 追加 / 通过原样保存 / 接口异常降级）。 |
| `frontend/src/components/ai/features/__tests__/unit/useReportGeneratorExport.test.tsx` | 新增 | 覆盖 PDF/DOCX/Markdown 导出真实端点与辅助函数兜底。 |

### 2.3 后端报告导出端点存在性核验

前端 `useReportGenerator` 调用的 `/reports/explainability/*` 确有后端实现：

- `backend/app/api/v1/report_export_router.py`：提供 `POST /explainability/docx`、`POST /explainability/pdf`、`POST /explainability/markdown`。
- 挂载方式：`backend/app/main.py` 第 761 行 `app.include_router(report_export_router, prefix=_eff_api_prefix(...))`，`_eff_api_prefix` 默认前缀 `/api/v1`，即最终路径为 `/api/v1/reports/explainability/*`，与前端 axios `baseURL=/api/v1` + 相对路径 `/reports/explainability/*` 一致。

---

## 3. 逐项验证结果（命令 + 结论）

### 3.1 后端测试

**命令**：

```powershell
cd backend
venv/Scripts/python.exe -m pytest tests/api/test_formula_intelligence.py -x -q
```

**输出结论**：

```
================= 45 passed, 3 warnings in 119.53s (0:01:59) ==================
```

- **45 个测试用例全部通过**（含十八反/十九畏、剂量判定、过敏原、知识注入、API 路由）。
- ⚠️ **命令退出码为 1**（非零）。原因：`pytest.ini` 的 `addopts` 带 `--cov=app` 且 `[coverage:report] fail_under = 75`；单独运行本测试文件时全仓覆盖率仅 **20.45%**，触发 `FAIL Required test coverage of 75.0% not reached`。
- 3 个 warning 明细：
  1. `CovFailUnderWarning`：单文件运行覆盖率未达 75% 门禁；
  2. `CoverageWarning`：无法识别 `pyproject.toml` 中 `[tool.coverage.report] partial_branch=` 配置项；
  3. `UserWarning`：`jieba` 依赖的 `pkg_resources` 弃用警告（第三方依赖，非本项目代码）。

> **结论**：测试用例本身 100% 通过，但"命令退出码 0"这一条**不成立**，属于需要修复/规避的命令级问题（详见第 5 节）。若以退出码作为 CI 通过标准，会被误报为失败。

### 3.2 前端 ESLint（改动 3 文件）

**命令**：

```powershell
cd frontend
npx eslint src/api/ai.ts src/components/ai/features/ChatTab.tsx src/components/ai/features/hooks/useReportGenerator.ts
```

**输出结论**：

```
✖ 6 problems (0 errors, 6 warnings)
```

- **0 errors，6 warnings**（均为存量类型警告，与 Lead 报告一致）：
  - `react-refresh/only-export-components` ×1（`buildValidationErrorSummary` 与组件同文件导出）
  - `react-hooks/exhaustive-deps` ×3（`detailsCallLocal` / `detailsOpenLocal` / `showKBPanelLocal`）
  - `@typescript-eslint/no-explicit-any` ×2
- 退出码 0。

> 注：`npx eslint --format compact` 在当前环境不可用（报错 `The compact formatter is no longer part of core ESLint`），故使用默认 stylish 格式复跑。

### 3.3 前端 TypeScript 类型检查

**命令**：

```powershell
cd frontend
npx tsc --noEmit -p tsconfig.json
```

**输出结论**：`TSC_EXIT_CODE=0`，类型检查通过。

### 3.4 前端新增 vitest

**命令**：

```powershell
cd frontend
npx vitest run src/api/__tests__/ai.test.ts src/components/ai/features/__tests__/unit/ChatTab.structureValidation.test.tsx src/components/ai/features/__tests__/unit/useReportGeneratorExport.test.tsx
```

**输出结论**：

```
Test Files  3 passed (3)
     Tests  15 passed (15)
```

- `ai.test.ts`：2 tests passed
- `ChatTab.structureValidation.test.tsx`：4 tests passed
- `useReportGeneratorExport.test.tsx`：9 tests passed
- 退出码 0。

---

## 4. 字段映射与降级行为专项检查

### 4.1 `AiFormulaValidationResponse` 字段映射（valid / is_safe / blocked_by_critical）

- 后端 `_validate_formula_with_db` 始终返回：`valid`、`blocked_by_critical`、`risk_score`、`alerts`、`ingredients`、`compatibility_issues`、`recommendations`、`target_effects`、`matched_effects`、`checked_ingredients_count`。
- 前端类型将 `blocked_by_critical` 设为**必填**，`valid`/`is_safe` 设为**可选**（`is_safe` 仅作旧版/模拟响应兼容）。
- ChatTab 的阻断逻辑**只依赖 `blocked_by_critical`**，不依赖 `is_safe`/`valid`，映射正确。
- **兼容性风险**：若对接旧版后端只返回 `is_safe: false` 而不返回 `blocked_by_critical`，则前端不会阻断保存（只会走 warnings 追加路径）。当前新后端无此问题，但若前后端版本错配需注意。

### 4.2 `retrieveHerbKnowledge` 的 items 字段

- 后端返回 `{"query": ..., "total": ..., "items": [...]}`；`items` 条目含 `name_cn / name_latin / name_en / aliases / effects / active_ingredients / safe_dose_range / contraindications / interactions / food_homology / data_quality / source`。
- 前端 `AiHerbKnowledgeResult.items: AiHerbKnowledgeItem[]` 字段与之一一对应，`ai.test.ts` 已断言 `items[0].name_cn / food_homology`。**映射一致**。

### 4.3 FoodMaterial 空库 / DB 故障降级

| 场景 | 行为 | 是否 500 |
| --- | --- | --- |
| `_match_food_material` 查询抛异常 | 捕获后记录日志，返回 `None`（成分 unrecognized） | 否 |
| `_search_materials` 查询抛异常（两次尝试均失败） | 返回 `[]`（知识检索空结果） | 否 |
| FoodMaterial 表为空 | 所有成分 `recognized=false`、`dosage_status="未知"`；`blocked_by_critical=false`、`valid=true`（除非十八反/十九畏/过敏原命中） | 否 |
| `SafetyAlertSystem` / `CompatibilityChecker` 抛异常 | 捕获后跳过该子能力，继续执行 | 否 |
| `chat.py` 知识检索失败 | 静默降级，仅记录日志，不注入知识块 | 否 |

**结论**：空库/DB 故障不会导致校验流程 500，符合降级约束。

---

## 5. 发现的遗留问题与建议

### 5.1【中】单文件后端测试触发覆盖率门禁，命令非零退出

- **现象**：`pytest tests/api/test_formula_intelligence.py -x -q` 结果为 45 passed，但退出码 1（全仓覆盖率 20.45% < `fail_under=75`）。
- **影响**：CI / 脚本若按退出码判断，会将"测试通过"误判为失败；Lead 初步验证报告中的"45 passed"未体现退出码问题。
- **建议**（任选其一）：
  1. 单文件/定向测试时追加 `--no-cov`：`venv/Scripts/python.exe -m pytest tests/api/test_formula_intelligence.py -x -q --no-cov`；
  2. 全量回归时再启用覆盖率门禁（`pytest` 不带 `-q` 跑全量 `testpaths`）；
  3. 在 `pytest.ini` 将 `fail_under` 移到 CI 专用配置，本地开发不强制。

### 5.2【低】ChatTab 对无剂量成分发送 `dosage_g: 0`，触发后端 422 导致整次校验跳过

- **现象**：`parseDosage` 解析不到剂量时返回 `0`（ChatTab.tsx 第 177-181 行），而 `backend/app/api/ai_modules/formula_intelligence.py` 的 `FormulaIngredientInput.dosage_g` 约束为 `gt=0`；`dosage_g=0` 会返回 422，前端捕获后走"校验服务暂不可用"降级路径，**整次校验被静默跳过**。
- **影响**：含无剂量成分的配方（恰是最需要安全提示的场景）得不到任何校验反馈。
- **建议**：前端提交前过滤 `dosage_g > 0` 的成分（或后端允许 `dosage_g=0` 表示未知剂量并单独标记），保证校验始终执行。

### 5.3【低】eslint compact formatter 当前环境不可用

- `npx eslint --format compact` 报错 `The compact formatter is no longer part of core ESLint`。
- **建议**：统一使用默认 stylish 格式，或安装 `eslint-formatter-compact` 作为 devDependency。

---

## 6. 风险提示

1. **RAG 仍依赖平台原料库数据量**：`retrieve_herb_knowledge` 基于 `FoodMaterial` 表关键词检索；若原料库数据稀疏或为空，system prompt 的知识块为空，LLM 只能依赖自身知识，"科学级参考"效果打折。
2. **SafetyAlertSystem 阈值覆盖有限**：安全预警主要覆盖内置阈值成分（如维生素 C UL）；大量中药材没有内置安全阈值，剂量安全性主要依赖 `FoodMaterial.safe_dose_min/max`。原料库缺失时剂量状态恒为「未知」，超量风险无法识别（仅靠十八反/十九畏静态表兜底）。
3. **过敏原检测为子串匹配**：用户画像与成分名/别名做子串包含匹配，可能存在误报（如"花"命中"菊花/花生"）或漏报（同义不同词）。建议后续引入规范化词典/别名表增强。
4. **校验覆盖入口有限**：目前保存前校验仅接入 ChatTab 结构化保存路径；手动创建配方等其它保存入口未接入，安全校验覆盖不完整。
5. **兼容字段风险**：前端类型保留 `is_safe` 兼容字段，若未来对接旧版后端响应，`blocked_by_critical` 缺失时不会阻断保存（见 4.1）。

---

## 7. 总体结论

| 检查项 | 结果 |
| --- | --- |
| 后端文件存在性与内容 | ✅ 通过 |
| 后端路由注册（`ai_modules/__init__.py`） | ✅ 通过 |
| `chat.py` async 化与知识注入 | ✅ 通过 |
| 前端 ChatTab 保存前校验接入 | ✅ 通过 |
| 前端 useReportGenerator 真实端点导出 | ✅ 通过 |
| 后端 pytest（45 用例） | ✅ 用例全部通过；⚠️ 命令退出码 1（覆盖率门禁，见 5.1） |
| 前端 eslint（3 改动文件） | ✅ 0 errors / 6 warnings（存量） |
| 前端 `tsc --noEmit` | ✅ 通过 |
| 前端新增 vitest（3 文件 15 用例） | ✅ 全部通过 |

- **未发现阻断性功能缺陷**。
- 功能实现与设计描述一致，可进入集成/发布流程。
- **建议优先处理 5.1（覆盖率门禁导致单文件测试非零退出）**，否则后端"测试通过"在 CI 中不可作为绿灯依据。
- 遗留问题 5.2、5.3 及第 6 节风险建议在后续迭代中改进。

---

## 8. 修复记录（Lead，验证后追加）

- **5.2 已修复**：`backend/app/api/ai_modules/formula_intelligence.py` 的 `FormulaIngredientInput.dosage_g` 约束由 `gt=0` 改为 `ge=0`（0 表示未知剂量，仍参与成分识别与配伍检查）。修复后复跑后端测试：`45 passed, 1 warning in 8.19s`（退出码 1 为 pytest-asyncio 解释器关闭告警，非测试失败）。
- 修复后前端 ChatTab 对无剂量成分发送 `dosage_g:0` 不再触发 422，校验可正常执行并给出「剂量未知」状态。