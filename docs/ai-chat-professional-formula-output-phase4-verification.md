# 智能对话专业配方输出-四期验证报告

- **项目**：RMFOOD 食源性药食同源配方平台
- **验证范围**：智能对话「专业配方输出」四期（task-11/12/13 交付内容）集成验证
- **验证人**：QA 验证工程师（qa-phase4）
- **关联任务**：task-14（QA：四期集成验证与回归报告）
- **前置任务**：task-11（后端：专业配方设计输出协议）、task-12（前端：专业配方设计卡渲染 + 结构化输出指令升级）、task-13（前端：配方提取与保存字段增强），均已 completed
- **验证日期**：2026-10-23
- **总体结论**：✅ **通过**。静态核验全部符合；后端 77 个用例、前端 6 个用例、tsc 与 eslint 均通过；专项核查（示例 JSON → detectStructuredContent → 配方设计卡、保存链路字段映射）全部满足，无阻断性缺陷。所有命令由 QA 本人复跑确认，与 Lead 复跑结果一致。

---

## 1. 改动清单（供静态核验）

### 后端（task-11）

| 文件 | 改动内容 | 核验结果 |
|---|---|---|
| `backend/conf/prompts/default.yaml` | `academician` 提示词重写为「专业配方设计卡」协议：移除「不少于1000字」报告式要求；JSON 示例含 `data-table` 的 role/name/dosage/nature_flavor/active_compound/mechanism 列、`metrics`、`ingredient-detail`、`synergy-chart`、`timeline`、`list`（制备工艺SOP variant=number / 参考文献 variant=analysis）、`callout`（注意事项 warning + 监测与迭代 info）；强调「JSON 之后只允许 1-2 句简短说明，禁止长篇 Markdown 展开」 | ✅ 存在且符合（L34-92；无「不少于1000字」，JSON 示例 L44-59 含全部块类型） |
| `backend/app/services/ai/formula_intelligence.py` | `_REPAIR_SYSTEM_PROMPT` 同步对齐专业配方设计协议：data-table 含 role/name/dosage/nature_flavor/active_compound/mechanism 列，支持 ingredient-detail/synergy-chart/timeline/list(SOP/参考文献)/callout(注意事项+监测)；规则明确「不得虚构原文未出现的信息」 | ✅ 存在且符合（L948-982） |
| `backend/conf/prompts/professional_formula_example.json` | 完整示例输出「黄芪当归气血双补方」：10 个 blocks（header/data-table/metrics/ingredient-detail/synergy-chart/timeline/list SOP/callout warning/callout info/list 参考文献） | ✅ 存在且符合（143 行，JSON 可解析） |
| `backend/tests/api/test_formula_intelligence.py` | 新增 `TestProfessionalFormulaProtocol`（3 个用例：修复提示词含专业字段、主提示词移除报告式要求、示例 JSON 存在且块类型/列齐全）；整个文件测试用例共 **77 个** | ✅ 存在，全文件 77 个用例（L974-1023 为四期新增类） |

> 说明：任务描述中的「TestProfessionalFormulaProtocol（77 个用例）」经核验实为「`test_formula_intelligence.py` 全文件共 77 个用例（含四期新增 `TestProfessionalFormulaProtocol` 的 3 个用例）」，此处如实记录。

### 前端（task-12 / task-13）

| 文件 | 改动内容 | 核验结果 |
|---|---|---|
| `frontend/src/components/ai/features/hooks/useChatSendMessage.ts` | 结构化输出指令升级为专业配方设计卡协议：data-table 增加 role/dosage/nature_flavor/active_compound/mechanism 列；要求 ingredient-detail/synergy-chart/timeline/list(制备工艺SOP)/callout(注意事项+监测)/list(参考文献)；JSON 之后只允许简短说明 | ✅ 存在且符合（L129-150） |
| `frontend/src/components/ai/features/services/formulaExtractorService.ts` | `ExtractedIngredient` 增加 `natureFlavor`/`activeCompound`/`mechanism`；`ExtractedFormula` 增加 `monitoringAdvice`/`references`；提取映射：data-table 新列 → ingredient 字段、timeline → `dosageAdvice`、list number → `productionSteps`、list analysis → `references`、callout info → `monitoringAdvice` | ✅ 存在且符合（接口 L22-55；映射 L109-203） |
| `frontend/src/components/ai/features/ChatTab.tsx` | `handleStructureSave` 扩展字段写入：`description` 含【配伍思路】+【作用机理】机理摘要；`notes` 含【注意事项】+【监测与迭代】+【参考文献】；`processing_method` 用工艺 SOP；`dosage` 用服用周期；保存前 AI 校验逻辑保留 | ✅ 存在且符合（L186-248） |
| `frontend/src/components/ai/features/__tests__/unit/formulaExtractorProfessional.test.ts` | 6 个用例：data-table 新列提取（性味归经/功效成分/机理）、timeline→dosageAdvice、list→productionSteps、callout→monitoringAdvice、list→references、旧协议兼容 | ✅ 存在，6 个用例 |

---

## 2. 静态核验结论（逐项）

1. **主提示词协议升级**：`default.yaml` 的 `academician` 已重写为「专业配方设计卡」协议。全文检索确认**不含**「不少于1000字」及「JSON 之后用 Markdown 详细展开」等报告式要求；JSON 示例覆盖 header / data-table（6 列）/ metrics / ingredient-detail / synergy-chart / timeline / list（SOP、参考文献）/ callout（warning、info），与前端 `BlockRegistry/types.ts` 的块类型对齐。
2. **修复协议对齐**：`_REPAIR_SYSTEM_PROMPT` 与主提示词使用同一套专业配方设计协议（data-table 6 列、ingredient-detail、synergy-chart、timeline、SOP、参考文献、监测迭代），并在 data-table 行优先补全 role/name/dosage，若原文含性味归经/功效成分/机理则填入对应列；规则明确不得虚构原文没有的信息。
3. **示例配方 JSON**：`professional_formula_example.json` 存在、JSON 可解析，包含全部专业块类型，data-table 列集合覆盖 `{role, name, dosage, nature_flavor, active_compound, mechanism}`。
4. **前端结构化指令同步**：`useChatSendMessage.ts` 注入的结构化输出指令与后端协议一致，明确要求专业配方设计卡格式并禁止长篇 Markdown 报告。
5. **渲染块支持新字段**：`BlockRegistry` 已注册 `ingredient-detail` / `synergy-chart` / `timeline` / `data-table` / `metrics` / `list` / `callout` / `header` 全部块类型；`DataTableBlock` 按 `columns` 动态渲染所有列（含 role tag、dosage number、nature_flavor/active_compound/mechanism 文本列），`TimelineBlock`/`SynergyChartBlock`/`IngredientDetailBlock`/`ListBlock`/`CalloutBlock` 均读取并渲染专业字段。
6. **提取与保存链路**：`formulaExtractorService` 已提取全部新字段；`ChatTab.handleStructureSave` 将机理摘要写入 `description`、监测+参考文献写入 `notes`、SOP 写入 `processing_method`、服用周期写入 `dosage`。

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
77 passed, 1 warning in 32.07s
PYTEST_EXIT=0
```

- ✅ **77 passed，退出码 0**（与 Lead 复跑结果一致）。
- 仅剩 1 条 `UserWarning`（`jieba/_compat.py` 中 `pkg_resources is deprecated`），与四期改动无关；无 `Task was destroyed` 等关闭期噪音。

### 3.2 前端 tsc

命令：

```bash
cd frontend
npx tsc --noEmit -p tsconfig.json
```

结果：`TSC_EXIT=0` ✅（QA 本人复跑，与 Lead 一致）。

### 3.3 前端 eslint（四期改动文件）

命令：

```bash
npx eslint src/components/ai/features/hooks/useChatSendMessage.ts \
  src/components/ai/features/services/formulaExtractorService.ts \
  src/components/ai/features/ChatTab.tsx \
  src/components/ai/features/__tests__/unit/formulaExtractorProfessional.test.ts \
  src/components/ai/features/components/structured/BlockRegistry.tsx \
  src/components/ai/features/components/structured/StructuredMessageRenderer.tsx \
  src/components/ai/features/components/structured/utils.ts \
  src/components/ai/features/components/structured/types.ts \
  src/components/ai/features/components/structured/blocks/DataTableBlock.tsx \
  src/components/ai/features/components/structured/blocks/IngredientDetailBlock.tsx \
  src/components/ai/features/components/structured/blocks/SynergyChartBlock.tsx \
  src/components/ai/features/components/structured/blocks/TimelineBlock.tsx \
  src/components/ai/features/components/structured/blocks/ListBlock.tsx \
  src/components/ai/features/components/structured/blocks/CalloutBlock.tsx \
  src/components/ai/features/components/structured/blocks/HeaderBlock.tsx
```

结果：**0 errors / 17 warnings**，`ESLINT_EXIT=0` ✅。

17 条 warning 均为既有类型/风格告警，无新增错误：
- `ChatTab.tsx`：`react-refresh/only-export-components` ×1、`react-hooks/exhaustive-deps` ×3、`@typescript-eslint/no-explicit-any` ×2
- `BlockRegistry.tsx`：`@typescript-eslint/no-explicit-any` ×1、`react-refresh/only-export-components` ×2
- `ListBlock.tsx`：`@typescript-eslint/no-explicit-any` ×2
- `utils.ts`：`no-console` ×4（detectStructuredContent 调试日志）、`@typescript-eslint/no-explicit-any` ×1
- `formulaExtractorService.ts`：`@typescript-eslint/no-explicit-any` ×1

### 3.4 前端 vitest

命令：

```bash
cd frontend
npx vitest run src/components/ai/features/__tests__/unit/formulaExtractorProfessional.test.ts
```

结果（QA 本人复跑）：

```
✓ src/components/ai/features/__tests__/unit/formulaExtractorProfessional.test.ts (6 tests) 16ms
 Test Files  1 passed (1)
      Tests  6 passed (6)
VITEST_EXIT=0
```

- ✅ **6 passed，退出码 0**（与 Lead 复跑结果一致）。

---

## 4. 专项核查

### 4.1 professional_formula_example.json 走一遍 detectStructuredContent

用 node 复刻 `frontend/.../structured/utils.ts` 的 `detectStructuredContent` 核心逻辑（```json 代码块提取 → JSON.parse → blocks 类型校验 → callout/list 归一化），输入为 `professional_formula_example.json` 内容（模拟 LLM 输出）：

```
responseType: recommendation
title: 黄芪当归气血双补方
blocks 类型序列: header, data-table, metrics, ingredient-detail, synergy-chart, timeline, list, callout, callout, list
data-table 列: role, name, dosage, nature_flavor, active_compound, mechanism
data-table 行0: {"role":"君","name":"黄芪","dosage":"15","nature_flavor":"甘，微温；归脾、肺经","active_compound":"黄芪多糖、黄芪甲苷","mechanism":"调节免疫、促进造血因子分泌"}
timeline: duration_days=28, items=3, phases=初期/中期/巩固
synergy-chart nodes: 黄芪(君), 当归(臣), 党参(佐), 大枣(使)
synergy-chart edges: hj->dg[相须], hj->ds[相使], dg->dz[相使]
SOP 步骤: 称量 -> 清洗 -> 煎煮 -> 复煎 -> 服用
参考文献: 《中国药典》2025年版一部; 黄芪多糖免疫调节机制研究（中国中药杂志）; 当归补血汤对造血功能的影响（国家卫健委药食同源目录）
callout warning: 注意事项/禁忌人群
callout info: 监测与迭代建议
报告式特征命中: 否
PASS: professional_formula_example.json 经 detectStructuredContent 解析为专业配方设计卡（blocks=10）
```

结论：✅ 示例输出被正确识别为 **10 个 blocks 的专业配方设计卡**，而非长篇报告；data-table 含全部 6 个专业列，timeline/synergy-chart/SOP/参考文献/注意事项/监测迭代各块字段齐全。

### 4.2 StructuredMessageRenderer 渲染链路

- `StructuredMessageRenderer` 遍历 `content.blocks`，通过 `BlockRegistry.renderBlock` 将每个 block 映射到对应渲染组件（StructuredMessageRenderer.tsx L73/L94-105）。
- `BlockRegistry.REGISTRY` 已注册全部 10 种块类型，包括四期新增/使用的 `ingredient-detail`、`synergy-chart`、`timeline`（BlockRegistry.tsx L24-35）。
- `DataTableBlock` 按 `columns.map` 动态渲染所有列（L176-231），`role` 列 type=tag 渲染为标签、`dosage` 列 type=number 右对齐、`nature_flavor`/`active_compound`/`mechanism` 列以文本渲染；列缺失时 `renderCell` 返回「—」占位，不会崩溃。
- `TimelineBlock` 渲染 `phases`/`items`（含 day/phase/title/description/dosage）；`SynergyChartBlock` 渲染 `nodes.role` 与角色配色；`IngredientDetailBlock` 渲染 `active_compounds`/`dosage_range` 等字段；`ListBlock` 支持 `variant=number`（SOP 步骤序号）与 `variant=analysis`（参考文献）；`CalloutBlock` 按 `variant` 渲染 warning/info 样式。

结论：✅ 前端渲染链路完整支持专业配方设计卡的全部块类型与字段，示例 JSON 可直接渲染为配方设计卡。

### 4.3 保存链路字段映射（ChatTab.handleStructureSave）

代码路径逐字段核验（ChatTab.tsx L186-248）：

| 目标字段 | 数据来源 | 实现 |
|---|---|---|
| `payload.description` | 配方描述 + 【配伍思路】rationale + **【作用机理】机理摘要**（各成分 `mechanism` 汇总，缺失自动跳过） | L231-235 |
| `payload.dosage` | `extracted.dosageAdvice`（timeline 服用周期） | L240 |
| `payload.processing_method` | `extracted.productionSteps.join('；')`（list SOP） | L241 |
| `payload.notes` | 【注意事项】precautions + 【监测与迭代】monitoringAdvice + **【参考文献】references** | L242-245 |
| `payload.ingredients` | data-table 行（name/amount/unit/percentage/role） | L207-216 |
| 保存前校验 | `validateAiFormula`（含 formula_name/dosage_g/target_effects），CRITICAL 阻断、warnings 追加【AI校验】、接口异常诚实降级 | L250-280（保留） |

结论：✅ 保存链路字段映射符合 task-13 要求——`description` 含机理摘要、`notes` 含监测与参考文献、`processing_method` 用工艺 SOP、`dosage` 用服用周期；前端提取字段（`natureFlavor`/`activeCompound`/`mechanism`/`monitoringAdvice`/`references`）已由 `formulaExtractorProfessional.test.ts` 6 个用例覆盖。

---

## 5. 遗留问题与风险

| 编号 | 类别 | 描述 | 影响 | 建议 |
|---|---|---|---|---|
| R1 | 中 | LLM 存在非确定性，即使提示词强约束为「专业配方设计卡」，实际输出仍可能偶发报告式文本或字段缺失 | 极端情况下渲染为纯文本或字段留空，前端体验降级 | 依赖 `repair_formula_structure` 兜底 + 前端结构化渲染降级；后续可增加输出 schema 校验与自动重试 |
| R2 | 低 | 字段缺失时前端回退：data-table 行缺 mechanism 时机理摘要自动跳过该行；缺 monitoringAdvice/references 时 notes 不追加对应小节；缺 ingredient-detail 时该块不输出 | 保存的配方信息不完整，但不报错、不阻断 | 已在设计中默认处理（`filter(Boolean)` + 可选字段），无需修复；可后续在 UI 提示「信息不完整」 |
| R3 | 中 | `repair_formula_structure` 依赖 LLM 可用性（`llm.is_available`），LLM 未配置或解析失败时返回 `success:false` | 结构化修复不可用时无法自动兜底 | 前端已有失败提示（showNotice），诚实降级；建议在生产环境配置 LLM 高可用 |
| R4 | 低 | 后端 `TestProfessionalFormulaProtocol` 仅 3 个静态断言用例（检查提示词字段/示例 JSON 结构），未覆盖真实 LLM 输出的协议符合性 | 无法自动验证 LLM 实际输出是否严格遵循配方卡协议 | 建议后续用 mock LLM 或 golden 输出做端到端协议校验 |
| R5 | 低 | 专项核查用 node 复刻 `detectStructuredContent` 逻辑（未直接 import TS 模块），但 BlockRegistry 注册与各渲染组件字段读取已静态确认 | 复刻逻辑与真实 TS 实现可能因未来改动产生偏差 | 建议后续在 vitest 夹具中直接渲染 `professional_formula_example.json` 作为回归用例 |
| R6 | 低 | eslint 17 条 warnings（react-refresh/exhaustive-deps/no-explicit-any/no-console），均为既有风格告警，非四期新增错误 | 无功能影响 | 可将调试 console 收敛、消除 any、拆分工具函数以清零 |
| R7 | 低 | 后端 pytest 仍有 1 条 `UserWarning`（jieba `pkg_resources is deprecated`），非四期引入 | 无功能影响，仅输出噪音 | 后续升级 setuptools 或替换 jieba 依赖时处理 |

---

## 6. 四期相对三期的能力提升

1. **输出形态质变**：配方输出从「大段 Markdown 报告」（不少于1000字 + 长篇展开）升级为「专业配方设计卡」——配方组成表（君臣佐使角色/克重/性味归经/功效成分/作用机理）、多维评分、核心成分详情、配伍网络、服用周期、制备工艺 SOP、注意事项/禁忌、监测迭代建议、参考文献，一卡即最终交付。
2. **三方协议统一**：后端主提示词（default.yaml）、后端结构化修复协议（`_REPAIR_SYSTEM_PROMPT`）、前端结构化输出指令（useChatSendMessage）使用同一套专业配方设计协议，字段名与 `BlockRegistry/types.ts` 对齐，消除提示词/渲染/提取三端字段漂移。
3. **渲染组件补齐**：`ingredient-detail` / `synergy-chart` / `timeline` 块类型在 BlockRegistry 注册并由专业组件渲染；DataTableBlock 动态支持 6 列专业字段；ListBlock 支持 SOP 序号与参考文献两种 variant。
4. **提取与保存增强**：聊天保存的配方从「名称+用量表」升级为含性味归经/功效成分/作用机理的完整配方卡，`description` 带机理摘要、`notes` 带监测与参考文献、`processing_method` 带工艺 SOP、`dosage` 带服用周期，配方库数据质量显著提升。
5. **测试资产增长**：后端新增 `TestProfessionalFormulaProtocol`（协议字段/示例 JSON 断言），整个 `test_formula_intelligence.py` 达 77 个用例；前端新增 `formulaExtractorProfessional.test.ts` 6 个用例，覆盖全部新字段提取与旧协议兼容。
6. **工程可维护性**：示例配方 JSON（`professional_formula_example.json`）成为前后端联调与 QA 对照的单一事实来源，降低后续协议演进成本。

---

## 7. 验证环境

- 工作目录：`D:\RMFOODFP`
- 后端：Python venv `backend/venv`（`venv/Scripts/python`），pytest 剥离覆盖率参数（`-o addopts=`）
- 前端：Node/npx，vitest v3.2.6，tsc `--noEmit -p tsconfig.json`，eslint
- 专项核查：node 脚本复刻 `detectStructuredContent`（utils.ts）核心逻辑，输入 `backend/conf/prompts/professional_formula_example.json`
- 数据库：验证环境无可用 PostgreSQL 实例；本次后端用例不依赖真实数据库（测试自行建表清理）