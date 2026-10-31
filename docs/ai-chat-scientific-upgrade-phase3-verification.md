# 智能对话科学级完善-三期验证报告

- **项目**：RMFOOD 食源性药食同源配方平台
- **验证范围**：智能对话「科学级完善」三期（task-8/9 交付内容）集成验证
- **验证人**：QA 验证工程师（qa-phase3）
- **关联任务**：task-10（QA：三期集成验证与回归报告）
- **前置任务**：task-8（后端：契约对齐 + 过敏原扩充 + 剂量数据脚本 + pytest 告警治理）、task-9（前端：GenerateTab 批量保存校验 + 保存成功反馈），均已 completed
- **验证日期**：2026-10-22
- **总体结论**：✅ **通过**。静态核验全部符合，后端 74 个用例、前端 7 个用例、tsc 与 eslint 均通过，专项核查 3 项全部满足，无阻断性缺陷。所有命令由 QA 本人复跑确认，与 Lead 复跑结果一致。

---

## 1. 改动清单（供静态核验）

### 后端（task-8）

| 文件 | 改动内容 | 核验结果 |
|---|---|---|
| `backend/app/api/ai_modules/formula_intelligence.py` | `FormulaValidateRequest` 增加可选 `formula_name: Optional[str] = Field(None, max_length=200)`；校验响应回显 `result["formula_name"] = req.formula_name` | ✅ 存在且符合（L46、L89） |
| `backend/app/services/ai/formula_intelligence.py` | `ALLERGEN_SYNONYMS` 从 34 组扩充至约 113 组（≥60），覆盖坚果/海鲜/加工形态/同义表达/蜂产品/饮品添加剂等，保留防单字误报（长度≥2） | ✅ 存在且符合（L213-337） |
| `backend/scripts/data/check_food_material_dosage.py` | 新建剂量覆盖检查脚本：支持 `--help` / `--format` / `--output` / `--dry-run`，`DATABASE_URL` 未设置或连接失败退出码 2 | ✅ 存在且符合 |
| `backend/scripts/data/seed_food_material_dosage.py` | 新建剂量回填脚本：内置 70+ 条药食同源常用原料剂量表（≥30），支持 `--help` / `--dry-run` / `--name`，仅补缺失项不覆盖已有值，数据库不可用退出码 2 | ✅ 存在且符合 |
| `backend/pytest.ini` + `backend/README.md` | pytest-asyncio 关闭期告警治理：`filterwarnings` 忽略 `Task was destroyed but it is pending!` / `coroutine ... was never awaited`，README「测试」节记录现象与建议版本（pytest-asyncio==1.3.0） | ✅ 存在且符合 |
| `backend/tests/api/test_formula_intelligence.py` | 74 个测试用例（含 formula_name 契约、过敏原扩充组命中、防单字误报等） | ✅ 存在，74 个用例 |

### 前端（task-9）

| 文件 | 改动内容 | 核验结果 |
|---|---|---|
| `frontend/src/components/ai/features/GenerateTab.tsx` | 新增 `buildCandidateValidationPayload`（携带 `formula_name`）、`buildCandidateSavePayload`、`saveAllCandidatesWithValidation`（批量校验：CRITICAL 弹窗停止 / warnings 追加【AI校验】notes / 接口异常诚实降级）；`handleSaveAllCandidates` 接线 `onSaveAll`；渲染 `FormulaValidationModal` + `batchNotice`；`onSaveSuccess` 接到 `savedHook.handleSaveSuccess` | ✅ 存在且符合 |
| `frontend/src/components/ai/features/GenerateTab/components/FormulaResultsPro.tsx` | 新增 `onSaveAll` / `onSaveSuccess` props，`onSaveSuccess` 透传到 `NeuralResultCard`，「保存全部」按钮接线 `onSaveAll` | ✅ 存在且符合 |
| `frontend/src/components/ai/features/__tests__/unit/GenerateTabSaveAll.test.ts` | 7 个测试用例：payload 组装（2）、保存 payload（1）、全安全保存/CRITICAL 阻断/warnings 追加/接口异常降级（4） | ✅ 存在，7 个用例 |

---

## 2. 静态核验结论（逐项）

1. **后端契约对齐**：`FormulaValidateRequest.formula_name` 为可选字段（`Optional[str]`，`max_length=200`），校验接口在返回结果中回显 `formula_name`（`result["formula_name"] = req.formula_name`），与前端 `validateAiFormula` payload 契约一致。
2. **过敏原别名扩充**：`ALLERGEN_SYNONYMS` 字典从二期 34 组扩充至 **113 组**（逐项统计），覆盖开心果/腰果/榛子/松子/扁桃仁/扇贝/蛤蜊/墨鱼/章鱼/鲍鱼/海参/蜂花粉/蜂王浆/乳糖/酪蛋白/乳清/小麦制品/荞麦/花生油等；`_allergen_group_for` / `_find_allergen_hit` 保留候选名长度 ≥2 才直接子串匹配的防单字误报逻辑，并对已知组做整组同义词扩展匹配。
3. **剂量数据脚本**：`check_food_material_dosage.py` 与 `seed_food_material_dosage.py` 均存在，支持 `--help` / `--dry-run`，从环境变量读取 `DATABASE_URL`，未设置或连接失败时打印清晰错误并 `sys.exit(2)`。seed 脚本内置剂量表 70+ 条（含黄芪 9-30g、当归 6-12g、党参 9-30g、枸杞 6-15g、甘草 2-10g、茯苓 10-15g、山药 15-30g、红枣 6-15g 等），仅更新缺失项（`COALESCE` 语义 + `needs_update` 判断），不覆盖已有值。
4. **pytest 告警治理**：`backend/pytest.ini` `filterwarnings` 已加入两条 pytest-asyncio 关闭期 RuntimeWarning 过滤，`backend/README.md`「测试」节记录了现象、原因与建议固定版本 `pytest-asyncio==1.3.0`。实测运行后 stderr 中已无 `Task was destroyed but it is pending!` 噪音。
5. **前端批量保存接线**：`GenerateTab.tsx` 实现 `handleSaveAllCandidates`，将 `onSaveAll` 传给 `FormulaResultsPro`；`saveAllCandidatesWithValidation` 逐候选调用 `validateAiFormula`，任一候选 `blocked_by_critical` 即回调 `onBlocked` 弹出 `FormulaValidationModal` 并停止批量保存；warnings 未阻断时保存并把建议追加到 notes（【AI校验】前缀）；校验接口异常跳过校验继续保存并返回 `degraded=true`，页面展示 `batchNotice` 提示。
6. **保存成功反馈**：`FormulaResultsPro.onSaveSuccess` 透传到 `NeuralResultCard`，`useNeuralResultCard.saveToFormulaManager` 保存成功后调用 `onSaveSuccess?.(formulaId, candidateId)`，最终触发 `savedHook.handleSaveSuccess` → `setSaveSuccess` → `GenerateTab` 渲染 `SuccessMessage`。

---

## 3. 复跑命令与结论

### 3.1 后端 pytest

命令：

```bash
cd backend
venv/Scripts/python -m pytest tests/api/test_formula_intelligence.py -x -q -o addopts=
```

结果（QA 本人复跑）：

```
74 passed, 1 warning in 28.14s
EXIT=0
```

- ✅ **74 passed，退出码 0**（与 Lead 复跑结果一致）。
- 仅剩 1 条 `UserWarning`（`jieba/_compat.py` 中 `pkg_resources is deprecated`），与三期改动无关；`Task was destroyed but it is pending!` / `[conftest-clean] sweep failed` 噪音已消失，告警治理生效。

### 3.2 剂量数据脚本

| 命令 | 预期 | 实测 | 结论 |
|---|---|---|---|
| `venv/Scripts/python scripts/data/check_food_material_dosage.py --help` | 退出码 0 | EXIT=0，输出 usage 与全部选项 | ✅ |
| `venv/Scripts/python scripts/data/seed_food_material_dosage.py --help` | 退出码 0 | EXIT=0，输出 usage 与全部选项 | ✅ |
| `DATABASE_URL=postgresql+asyncpg://invalid:invalid@127.0.0.1:1/nonexistent_db ... check_food_material_dosage.py --dry-run` | 退出码 2，提示清晰 | EXIT=2，stderr 输出「错误: 数据库连接或查询失败: [WinError 1225] 远程计算机拒绝网络连接。」 | ✅ |
| `DATABASE_URL=postgresql+asyncpg://invalid:invalid@127.0.0.1:1/nonexistent_db ... seed_food_material_dosage.py --dry-run` | 退出码 2，提示清晰 | EXIT=2，stderr 输出「错误: 数据库连接或查询失败: [WinError 1225] 远程计算机拒绝网络连接。」 | ✅ |

- 两个脚本均正确实现 `--help` / `--dry-run`，数据库不可用时退出码 2 且错误信息明确。

### 3.3 前端 tsc

命令：

```bash
cd frontend
npx tsc --noEmit -p tsconfig.json
```

结果：`TSC_EXIT=0` ✅（QA 本人复跑，与 Lead 一致）。

### 3.4 前端 eslint（三期 3 文件）

命令：

```bash
npx eslint src/components/ai/features/GenerateTab.tsx src/components/ai/features/GenerateTab/components/FormulaResultsPro.tsx src/components/ai/features/__tests__/unit/GenerateTabSaveAll.test.ts
```

结果：**0 errors / 5 warnings**，`ESLINT_EXIT=0` ✅。

5 条 warning 明细（均为既有类型/风格告警，非新增错误）：
- `react-refresh/only-export-components` × 4（GenerateTab.tsx 导出工具函数触发）
- `@typescript-eslint/no-explicit-any` × 1（GenerateTab.tsx L250 `(h: any)`）

### 3.5 前端 vitest

命令：

```bash
npx vitest run src/components/ai/features/__tests__/unit/GenerateTabSaveAll.test.ts
```

结果（QA 本人复跑）：

```
✓ src/components/ai/features/__tests__/unit/GenerateTabSaveAll.test.ts (7 tests) 24ms
Test Files  1 passed (1)
     Tests  7 passed (7)
VITEST_EXIT=0
```

- ✅ **7 passed，退出码 0**（与 Lead 复跑结果一致）。
- stderr 中出现的 `[WARN] [GenerateTab] AI 配方校验服务调用失败...` 是「接口异常诚实降级」用例中 `logger.warn` 的预期输出，非测试失败。

---

## 4. 专项核查

### 4.1 批量保存链路（onSaveAll → … → SuccessMessage）

代码路径逐环核验：

1. `GenerateTab.tsx` 渲染 `FormulaResultsPro` 时传入 `onSaveAll={handleSaveAllCandidates}`（L554）。
2. `FormulaResultsPro` 的「保存全部」按钮 `onClick={onSaveAll}`（L285-286）。
3. `handleSaveAllCandidates` 调用 `saveAllCandidatesWithValidation`（L366），内部逐候选：
   - `buildCandidateValidationPayload(candidate, targetEffects)` 组装校验请求（含 `formula_name`）；
   - `validate: validateAiFormula`（真实 API）；
   - CRITICAL → `onBlocked(result, candidate)` → `setBatchValidation(...)` → `FormulaValidationModal` 弹窗（L642-648）；
   - 未阻断 → `create: formulaApi.create(payload)`（L370）→ `onCandidateSaved(result.id, candidateId)`（L372-373）→ `savedHook.handleSaveSuccess(formulaId, candidateId, candidates)`。
4. `useSavedFormulas.handleSaveSuccess`：写入 `savedFormulas` Map，找到候选后 `setSaveSuccess({ formulaId, formulaName })`（useSavedFormulas.ts L48）。
5. `GenerateTab.tsx` 渲染 `{savedHook.saveSuccess && <SuccessMessage .../>}`（L462-468）。

**单卡保存反馈链路**：`FormulaResultsPro` 的 `onSaveSuccess` prop（L52）→ `NeuralResultCard`（L245）→ `useNeuralResultCard.saveToFormulaManager` 成功后调用 `onSaveSuccess?.(result.id, candidateId)`（useNeuralResultCard.ts L197/L259）→ `savedHook.handleSaveSuccess` → `SuccessMessage`。

结论：✅ 批量保存与单卡保存两条链路均正确接通 `savedHook.handleSaveSuccess`，保存成功 toast（SuccessMessage）可正常触发。

### 4.2 校验请求携带 formula_name 且后端回显

- 前端：`buildCandidateValidationPayload` 组装 `formula_name: candidate.formula_name || candidate.name || '未知配方'`（GenerateTab.tsx L57）；`AiFormulaValidationRequest` 类型含 `formula_name?: string`（api/ai.ts L91）；`validateAiFormula` POST `/ai/formula/validate`。
- 后端：`FormulaValidateRequest.formula_name` 可选字段（formula_intelligence.py L46）；响应回显 `result["formula_name"] = req.formula_name`（L89）。
- 测试：`test_validate_endpoint_formula_name_optional`（test_formula_intelligence.py L594）覆盖可选 formula_name 契约；前端 `GenerateTabSaveAll.test.ts` 首个用例断言 `payload.formula_name === '测试配方'`。

结论：✅ 契约一致，校验请求确实携带 `formula_name`，后端回显。

### 4.3 脚本 dry-run 不写库

- `seed_food_material_dosage.py`：唯一写库路径为 `_apply_update`（执行 `UPDATE food_materials ...`），仅在 `dry_run=False` 分支被调用（L202）；`dry_run=True` 时只打印 `[dry-run]` 预览行，绝不执行更新。
- `check_food_material_dosage.py`：脚本本身只执行 `SELECT` 只读统计，`--dry-run` 仅阻止写输出文件（L186），不涉及数据库写入。
- 实测：无效 DSN 下两个脚本 `--dry-run` 均在建立连接阶段失败并退出码 2，未产生任何数据库写操作。

结论：✅ dry-run 不写库（代码路径 + 实测双重确认）。

---

## 5. 遗留问题与风险

| 编号 | 类别 | 描述 | 影响 | 建议 |
|---|---|---|---|---|
| R1 | 低 | 后端 pytest 仍有 1 条 `UserWarning`（jieba `pkg_resources is deprecated`），非三期引入 | 无功能影响，仅输出噪音 | 后续升级 setuptools 或替换 jieba 依赖时处理 |
| R2 | 低 | eslint 5 条 warnings（`react-refresh/only-export-components` ×4、`no-explicit-any` ×1） | 无功能影响，均为既有类型/风格告警 | 可将工具函数拆至独立文件、消除 `any` 以清零 |
| R3 | 中 | 两个数据脚本依赖真实 PostgreSQL（`DATABASE_URL`），本次验证仅覆盖 `--help` 与不可用 DSN 退出码 2；未在真实数据库上执行 seed 回填与 check 报告生成 | 脚本真实库效果未端到端验证 | 在有可用 PG 实例的环境执行一次 `seed --dry-run` → `seed` → `check` 验证回填与报告 |
| R4 | 低 | 校验接口异常降级仅展示概要 `batchNotice`，详细错误只进 `logger.warn`，用户不可见 | 降级时用户不知具体失败原因 | 可选：在降级提示中展示更详细信息 |
| R5 | 低 | 批量保存遇 CRITICAL 停止后，弹窗确认/取消均为关闭，不会自动跳过该候选继续保存其余候选 | 用户需手动处理剩余候选 | 可选：增加「跳过并继续」交互 |

---

## 6. 三期相对二期的能力提升

1. **前后端契约对齐**：`validateAiFormula` 请求/响应统一携带并回显 `formula_name`，消除二期遗留的契约不一致；前端批量校验 payload 显式携带配方名称。
2. **过敏原覆盖大幅增强**：`ALLERGEN_SYNONYMS` 由 34 组扩充至 113 组，覆盖更多坚果/海鲜/加工形态/同义表达/蜂产品/添加剂，测试新增 10+ 别名命中用例（花生油/扇贝/墨鱼/荞麦/蜂花粉/坚果/英文同义/加工形态等），并保持防单字误报。
3. **剂量数据工程化**：新增 `check_food_material_dosage.py` 与 `seed_food_material_dosage.py`，支持 `--help`/`--dry-run`/`--name`，数据库不可用退出码 2，纯 Python 独立运行，为平台原料库安全剂量补全提供可审计、可预览的数据工程能力。
4. **工程治理**：pytest.ini 过滤 pytest-asyncio 关闭期告警并在 README 记录原因与固定版本，测试输出干净，消除二期报告中记录的 stderr 噪音。
5. **前端批量保存真实可用**：`onSaveAll` 从「UI 存在但未接线」变为完整实现——逐候选 AI 校验、CRITICAL 弹窗停止、warnings 自动追加【AI校验】notes、接口异常诚实降级，并新增批量提示条与成分级校验弹窗。
6. **保存成功反馈闭环**：`onSaveSuccess` 透传至 `NeuralResultCard`，单卡/批量保存成功后均触发 `savedHook` → `SuccessMessage` toast，修复二期「保存成功 toast 不触发」问题。
7. **测试资产增长**：后端测试用例 67 → 74；前端新增 `GenerateTabSaveAll.test.ts` 7 个用例，覆盖批量保存全部关键分支。

---

## 7. 验证环境

- 工作目录：`D:\RMFOODFP`
- 后端：Python venv `backend/venv`（`venv/Scripts/python`），pytest 剥离覆盖率参数（`-o addopts=`）
- 前端：Node/npx，vitest v3.2.6，tsc `--noEmit -p tsconfig.json`
- 数据库：验证环境无可用 PostgreSQL 实例；脚本验证采用无效 DSN 负路径（退出码 2）