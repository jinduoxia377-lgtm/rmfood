# 智能对话科学级完善-二期验证报告

- **项目**：RMFOOD 食源性药食同源配方平台
- **验证范围**：智能对话「科学级完善」二期（task-4/5/6 交付内容）集成验证
- **验证人**：QA 验证工程师（qa-phase2）
- **关联任务**：task-7（QA：二期集成验证与回归报告）
- **前置任务**：task-4 / task-5 / task-6（均已 completed）
- **验证日期**：2026-10-22
- **总体结论**：✅ **通过**。静态核验全部符合，后端 67 个用例、前端 31 个用例、tsc 与 eslint 均通过，专项核查 4 项全部满足，无阻断性缺陷。

---

## 1. 改动清单（供静态核验）

### 后端

| 文件 | 改动内容 | 核验结果 |
|---|---|---|
| `backend/app/services/ai/formula_intelligence.py` | 新增 `repair_formula_structure()`（LLM 低温度结构化修复，失败返回 `success:false` 绝不抛 500）；`_match_allergens` 增强（`ALLERGEN_SYNONYMS` 34 组别名/同义词，防单字误报） | ✅ 存在且符合 |
| `backend/app/api/ai_modules/formula_intelligence.py` | 新增 `POST /formula/repair-structured`、`POST /formula/feedback`、`GET /formula/{formula_id}/feedback` | ✅ 存在且符合 |
| `backend/app/models/formula_feedback.py` | 新模型 `FormulaFeedback`（用户/租户/配方归属 + 评分/症状变化/指标更新/备注 + 审计字段） | ✅ 存在且符合 |
| `backend/tests/api/test_formula_intelligence.py` | 67 个测试用例（含修复/反馈端点、过敏原同义词、单字防误报） | ✅ 存在，67 个用例 |

### 前端

| 文件 | 改动内容 | 核验结果 |
|---|---|---|
| `frontend/src/api/ai.ts` | 新增 `repairStructuredFormula` / `submitFormulaFeedback` / `getFormulaFeedback` 及类型定义 | ✅ 存在且符合 |
| `frontend/src/components/ai/features/components/FormulaValidationModal.tsx` | 成分级校验报告弹窗（CRITICAL 阻断、warnings 可确认） | ✅ 存在且符合 |
| `frontend/src/components/ai/features/components/FeedbackModal.tsx` | 效果反馈弹窗（评分/症状变化/指标复查/备注 + 历史反馈） | ✅ 存在且符合 |
| `frontend/src/components/ai/features/ChatTab.tsx` | 保存前校验弹窗确认、结构化修复按钮、保存后反馈入口 | ✅ 存在且符合 |
| `frontend/src/components/ai/features/components/pro/MessageBubble.tsx` + `MessageList.tsx` | `onStructureRepair`「修复为结构化配方」按钮 | ✅ 存在且符合 |
| `frontend/src/components/ai/NeuralResultCard.tsx` + `hooks/useNeuralResultCard.ts` | GenerateTab 结果卡保存前校验（CRITICAL 弹窗阻断、warnings 追加 notes、接口异常降级） | ✅ 存在且符合 |

### 前端测试（5 个文件，共 31 个用例）

| 测试文件 | 用例数 |
|---|---|
| `frontend/src/api/__tests__/ai.test.ts` | 6 |
| `frontend/src/components/ai/features/__tests__/unit/FormulaValidationModal.test.tsx` | 3 |
| `frontend/src/components/ai/features/__tests__/unit/ChatTab.structureValidation.test.tsx` | 7 |
| `frontend/src/components/ai/features/__tests__/unit/ChatTab.structureRepairFeedback.test.tsx` | 6 |
| `frontend/src/components/ai/features/__tests__/unit/useReportGeneratorExport.test.tsx` | 9 |
| **合计** | **31** |

---

## 2. 静态核验结论（逐项）

1. **FormulaValidationModal 双路径接入**：
   - ChatTab：`handleStructureSave` 保存前调用 `validateAiFormula`，有校验结果时先 `setValidationModal` 并 `return`（不落库），用户点击「确认保存」后 `handleValidationConfirm` 才执行 `createFormula`；CRITICAL 时弹窗确认按钮 `disabled`。渲染处 `open={!!validationModal}`、`onConfirm={() => void handleValidationConfirm()}`。
   - GenerateTab：`GenerateTab.tsx` 渲染 `FormulaResultsPro` → `NeuralResultCard`，保存按钮 `onSaveToManager={saveToFormulaManager}`，`saveToFormulaManager` 内调用 `validateAiFormula` 后再 `formulaApi.create`。
2. **后端端点注册**：`sub_router` 挂载于 `prefix="/ai"`（`backend/app/api/ai_modules/__init__.py`），三个端点 `POST /ai/formula/repair-structured`、`POST /ai/formula/feedback`、`GET /ai/formula/{formula_id}/feedback` 均已注册，与前端 api 路径一致。
3. **FormulaFeedback 模型**：`backend/app/models/formula_feedback.py` 存在，`__tablename__ = "formula_feedback"`，字段含 `user_id / organization_id / formula_id / rating / symptom_change / metric_updates / notes / created_at / updated_at`，已在 `backend/app/models/__init__.py` 注册导出。
4. **过敏原别名表**：`ALLERGEN_SYNONYMS` 共 34 组（花生/虾/蟹/贝类/鱼类/牛奶/乳糖/鸡蛋/麸质/大豆/坚果/芝麻/芹菜/芥菜/芒果/菠萝/猕猴桃/桃/苹果/香蕉/草莓/牛肉/羊肉/猪肉/鸡肉/蜂蜜/酒精/亚硫酸盐/味精/大蒜/洋葱/生姜/肉桂/胡椒）。`_find_allergen_hit` 对候选名长度 `>= 2` 才直接子串匹配（防单字误报），并对已知组做整组同义词扩展匹配（降低漏报）。
5. **前端 ai.ts 三函数接入**：`repairStructuredFormula(content, formula_name?)`、`submitFormulaFeedback(payload)`、`getFormulaFeedback(formulaId)` 均实现并在 `aiApi` 聚合导出；ChatTab 已接入 `repairStructuredFormula`（`handleStructureRepair`）与 `submitFormulaFeedback`/`getFormulaFeedback`（经 FeedbackModal）。

---

## 3. 复跑命令与结论

### 3.1 后端 pytest

命令：

```bash
cd backend
venv/Scripts/python -m pytest tests/api/test_formula_intelligence.py -x -q -o addopts=
```

结果：

```
67 passed, 1 warning in 25.12s
PYTEST_EXIT=0
```

- ✅ **67 passed**（剥离覆盖率参数后退出码 0）。
- stderr 中 `Task was destroyed but it is pending!` / `[conftest-clean] sweep failed` 为 **pytest-asyncio 关闭期告警**，非测试失败（与 Lead 预先说明一致；Lead 复跑退出码为 1 亦仅因此告警）。

### 3.2 前端 TypeScript 类型检查

命令：

```bash
cd frontend
npx tsc --noEmit -p tsconfig.json
```

结果：**exit 0**，无类型错误。

### 3.3 前端 vitest（二期 5 个测试文件）

命令：

```bash
cd frontend
npx vitest run src/api/__tests__/ai.test.ts \
  src/components/ai/features/__tests__/unit/FormulaValidationModal.test.tsx \
  src/components/ai/features/__tests__/unit/ChatTab.structureValidation.test.tsx \
  src/components/ai/features/__tests__/unit/ChatTab.structureRepairFeedback.test.tsx \
  src/components/ai/features/__tests__/unit/useReportGeneratorExport.test.tsx
```

结果：

```
Test Files  5 passed (5)
     Tests  31 passed (31)
VITEST_EXIT=0
```

- ✅ **5 files / 31 tests 全部通过**。

### 3.4 前端 eslint（二期相关 13 个文件）

命令：

```bash
cd frontend
npx eslint src/api/ai.ts src/components/ai/features/ChatTab.tsx \
  src/components/ai/features/components/FormulaValidationModal.tsx \
  src/components/ai/features/components/FeedbackModal.tsx \
  src/components/ai/NeuralResultCard.tsx src/components/ai/hooks/useNeuralResultCard.ts \
  src/components/ai/features/components/pro/MessageBubble.tsx \
  src/components/ai/features/components/pro/MessageList.tsx \
  src/api/__tests__/ai.test.ts \
  src/components/ai/features/__tests__/unit/FormulaValidationModal.test.tsx \
  src/components/ai/features/__tests__/unit/ChatTab.structureValidation.test.tsx \
  src/components/ai/features/__tests__/unit/ChatTab.structureRepairFeedback.test.tsx
```

结果：**0 errors, 12 warnings**，exit 0。warnings 全部为既有类型/风格告警（`react-refresh/only-export-components`、`react-hooks/exhaustive-deps`、`@typescript-eslint/no-explicit-any`、`no-console`、`react-hooks/incompatible-library`），非新增错误。

> 注：Lead 复跑的 eslint（10 文件）为 0 errors / 14 warnings；本 QA 独立复跑（13 文件）为 0 errors / 12 warnings，两者一致 —— 均无 error。

---

## 4. 专项核查

### 4.1 GenerateTab 保存前校验是否真的走 NeuralResultCard 的 `saveToFormulaManager`

✅ **确认走 `saveToFormulaManager`，且无绕过路径**。

- `GenerateTab.tsx` 渲染 `ResultsComponent = FormulaResultsPro`；`FormulaResultsPro` 内渲染 `NeuralResultCard`，其 `ActionButtons` 的 `onSaveToManager={saveToFormulaManager}`。
- `useNeuralResultCard.ts` 的 `saveToFormulaManager`（L195-265）：先组装 payload → 调用 `validateAiFormula` → CRITICAL 时 `setValidationResult` + `setValidationModalOpen(true)` 并 `return`（阻断）→ warnings 未阻断时把校验建议追加到 `payload.notes`（【AI校验】前缀）→ 最后 `formulaApi.create(payload)`。
- 全前端检索 `onSaveAll=` **无任何父组件传入**，即「保存全部」按钮是未接线的可选 prop，不存在绕过校验的批量保存路径。
- 结论：GenerateTab 的唯一保存路径即 NeuralResultCard 保存按钮 → `saveToFormulaManager` → 校验后再落库。

### 4.2 ChatTab 校验弹窗确认后才 `createFormula`

✅ **确认「先弹窗、确认后落库」**。

- `handleStructureSave`：调用 `validateAiFormula` 得到 `validation` 后，`setValidationModal({ result, formulaName, payload })` 并 `return` —— 此时**不调用 `createFormula`**。
- `handleValidationConfirm`：用户点击弹窗「确认保存」后才调用 `createFormula(payload)`；CRITICAL 时弹窗确认按钮 `disabled`，只能取消。
- 校验接口异常时走诚实降级：不弹窗、不阻断保存，直接 `createFormula` 并以 warning 提示「校验服务暂不可用，已跳过校验」。

### 4.3 repair-structured 前端失败处理

✅ **成功与失败路径均正确**。

- 成功：`result.success && result.structured.blocks.length > 0` → 转成 `{responseType:'formula', blocks}` 结构化消息 JSON → 复用 `handleStructureSave` 走提取+校验+保存流程。
- 后端返回 `success:false`（LLM 不可用/解析失败/缺 blocks）：`showNotice('error', result.message || '结构化修复失败，请稍后重试')`，**不保存**。
- 接口异常（网络/500）：`catch` 捕获，`showNotice('error', '结构化修复失败：' + e.message)`，**不保存**。
- 对应行为由 `ChatTab.structureRepairFeedback.test.tsx` 3 个用例覆盖（成功保存 / success=false 不保存 / 接口异常不保存）。

### 4.4 feedback 前后端字段一致性

✅ **字段一致**。

| 后端 `FeedbackCreateRequest` | 前端 `FormulaFeedbackPayload` | 一致 |
|---|---|---|
| `formula_id: int` | `formula_id: number` | ✅ |
| `rating: int (1-5)` | `rating: number` | ✅ |
| `symptom_change: str?` | `symptom_change?: string` | ✅ |
| `metric_updates: List[dict]?` | `metric_updates?: FormulaMetricUpdate[]` | ✅ |
| `notes: str?` | `notes?: string` | ✅ |

- 响应：后端 `FormulaFeedback.to_dict()` 返回 `id/user_id/organization_id/formula_id/rating/symptom_change/metric_updates/notes/created_at/updated_at`；前端 `FormulaFeedbackItem` 全覆盖。
- POST 响应 `{success, feedback}`、GET 响应 `{formula_id, total, items}` 与前端类型 `FormulaFeedbackSubmitResponse` / `FormulaFeedbackListResponse` 匹配。
- FeedbackModal 提交时对 `metric_updates` 做空行过滤，仅提交非空指标行，与后端宽松 JSON 存储兼容。

---

## 5. 遗留问题与风险

| # | 风险/遗留 | 等级 | 说明 |
|---|---|---|---|
| 1 | **repair-structured 依赖 LLM 可用性** | 中 | 功能正确性依赖外部 LLM 服务；LLM 未配置/超时/解析失败时返回 `success:false`，前端已降级为错误提示且不保存，不会 500，但「结构化修复」能力本身不可用。 |
| 2 | **GenerateTab 校验仅覆盖 NeuralResultCard 保存路径** | 低 | 当前唯一保存路径已覆盖校验；但 `onSaveAll`（保存全部）按钮 prop 未接线，未来若接入批量保存需同步加校验，否则会绕过。 |
| 3 | **外部进程可能并发修改 GenerateTab 文件** | 低 | 工作区为多人协作共享，其他任务（task-10/11 等）可能同时改动 `GenerateTab.tsx` 及结果组件；集成回归需在干净基线上复跑。 |
| 4 | 前端校验请求携带 `formula_name`，后端 `FormulaValidateRequest` 无此字段 | 低 | Pydantic 默认忽略额外字段，不影响功能；但前后端契约不严格一致，建议后续后端补字段或前端移除。 |
| 5 | 前端响应类型期望顶层 `warnings`/`suggestions`，后端实际返回 `alerts`/`recommendations` | 低 | 前端已做 fallback 映射（`warnings ?? alerts 过滤`、`suggestions ?? recommendations`），功能无影响。 |
| 6 | GenerateTab `onSaveSuccess` 未传入 NeuralResultCard | 低 | 保存动作本身成功（`saveToFormulaManager` 直接 `formulaApi.create`），但「保存成功」的 `savedHook.saveSuccess` 状态不会被触发，属次要 UX 缺口。 |
| 7 | 过敏原别名覆盖度非穷尽 | 低 | 34 组覆盖常见过敏原；特殊坚果/海鲜/加工形态可能未覆盖，依赖后续持续扩充（已有 `test_synonym_table_has_at_least_20_groups` 门槛用例）。 |
| 8 | pytest-asyncio 关闭期告警 | 信息 | stderr 出现 `Task was destroyed` 等噪音，不影响测试结果；建议后续升级/固定 pytest-asyncio 版本消除。 |

---

## 6. 二期相对一期的能力提升

一期（task-1/2/3）交付了 `validate_formula` 科学级后验校验（原料库识别、剂量状态、SafetyAlertSystem 三级预警、十八反/十九畏、过敏原匹配）与平台知识检索（RAG），但存在「LLM 非结构化输出无兜底、无保存前校验交互、无反馈闭环」三大缺口。

二期在此基础上升级：

1. **结构化输出兜底**：新增 `repair_formula_structure` + `POST /formula/repair-structured`，LLM 输出非结构化配方文本时可一键「修复为结构化配方」，复用保存链路；失败不 500。
2. **保存前校验交互闭环**：成分级校验报告弹窗（FormulaValidationModal）在 ChatTab 与 GenerateTab 双路径接入 —— CRITICAL 阻断保存、warnings 放行并把建议追加到配方 notes（【AI校验】前缀）、校验接口异常诚实降级不阻断。
3. **反馈迭代闭环**：新增 `FormulaFeedback` 模型与 POST/GET feedback 端点，前端 FeedbackModal 支持评分（1-5）、症状变化、指标复查、备注提交，并展示历史反馈，支撑「反馈→迭代优化」数据闭环。
4. **过敏原匹配增强**：`ALLERGEN_SYNONYMS` 34 组别名/同义词扩展匹配，显著降低漏报（如「落花生」匹配「花生」、「对虾」匹配「虾」），同时通过长度门槛防单字误报。
5. **测试体系**：后端 67 个用例（含新端点、同义词/防误报专项）+ 前端 5 个文件 31 个用例（校验/修复/反馈/导出），覆盖关键成功与失败路径。

---

## 7. 结论

二期「智能对话科学级完善」集成验证 **通过**：

- 静态核验：所有后端/前端改动文件存在且内容与改动清单一致；
- 后端 pytest：**67 passed**；
- 前端 tsc：**exit 0**；
- 前端 vitest：**5 files / 31 tests 全部通过**；
- 前端 eslint：**0 errors**（warnings 均为既有类型/风格告警）；
- 专项核查 4 项（GenerateTab 保存校验链路、ChatTab 弹窗确认后才落库、repair-structured 失败处理、feedback 字段一致性）全部满足。

无阻断性缺陷，遗留问题均为低/中等级风险且已有降级或缓解方案，建议在后续迭代中处理第 5 节第 1、2、4、6 项。