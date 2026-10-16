# RMFOOD 核心智能域测绘审计报告

- 日期：2026-10-16
- 方式：纯只读代码审计（未修改任何文件、未启动/停止任何服务）
- 范围：AI 配方生成的「前端调用 → 后端端点 → 实际引擎」全链路真实性

---

## 一、前端 → 后端调用图谱

共发现 **5 条** 与「配方生成/AI 生成」相关的调用路径。

| # | 前端入口 | 调用端点 | 后端处理模块 | 实际引擎 |
|---|---------|---------|------------|---------|
| A | GenerateTab 默认模式 `useFormulaGeneration` → `aiApi.generate()` | `POST /api/v1/ai/generate` | `generation_v2.py` | **真实 GA**（GeneticFormulaOptimizer） |
| B | GenerateTab 高级模式 `NeuralGeneratePanel` → `aiApi.generateNeural()` | `POST /api/v1/ai/generate/neural` | `generation.py`（旧） | **永远回退规则引擎**（见 P0-1） |
| C | /agent 编排器工具 `generate_formula` | （进程内调用） | `formula_tool.py` | **8 味种子药材**的 FormulaDesigner |
| D | `AIGenerator.tsx`（流式文本生成器） | `POST /api/v1/ai/generate/stream` | `utility_endpoints.py` | **真实 LLM SSE 流**（但组件疑似未被渲染，见 P2-2） |
| E | ChatTab 对话 `useChatSendMessage` | `POST /api/v1/ai/chat/stream`（LLM） | `chat.py` + 前端意图检测 | **真实 LLM**，前端本地引擎仅做意图检测 |

---

## 二、每条路径的真实性判定

### 路径 A（主配方生成）——真实 ✅

- `GenerateTab.tsx` → `useFormulaGeneration` → `aiApi.generate()` → `POST /api/v1/ai/generate`。
- 后端 `generation_v2.py` 调用 `GeneticFormulaOptimizer.optimize()`，是**真实的遗传算法代码**（种群/交叉/变异/精英保留）。
- 返回 `generator: "ga_optimizer"`；失败时回退 `rule_engine_fallback`。
- 前端 `normalizeGenerator()` 把 `ga_optimizer` 映射为 `rule_engine` → **UI 徽标显示「规则引擎」**。
- 结论：主路径真实可用，但 GA 在 UI 上被标注成「规则引擎」（标签失真，见 P2-1）。

### 路径 B（神经网络生成）——名义存在，实际永远回退 ⚠️

- `GenerateTab.tsx` 的 `advancedMode` 懒加载 `NeuralGeneratePanel` → `aiApi.generateNeural()` → `POST /api/v1/ai/generate/neural`。
- 后端 `generation.py` 第 424 行：`from ...services.ai_models.neural_engine import NeuralFormulaEngine`。
  - **`neural_engine.py` 不存在**（实际文件是 `neural_formula_engine.py`）。
  - 因此必然抛出 `ImportError` → 第 450 行捕获 → 回退 `ai_service.generate_formula`（规则引擎）。
- 且 `neural_formula_engine.py` 提供的类名为 **`MockNeuralFormulaEngine`**（本身就是 Mock）。
- 结论：**UI 标题「神经网络生成」与后端实际行为（规则引擎）不一致**。用户看到「神经网络」面板，拿到的是规则引擎结果。

### 路径 C（Agent 配方生成）——真实但极度受限 ⚠️

- `formula_tool.py` 的 `FormulaGenerationTool` 使用 `_KB_SEED` —— **仅 8 味药材**（人参、黄芪、枸杞、红枣、茯苓、山药、菊花、薄荷）。
- 通过 `KnowledgeRetriever + FormulaDesigner` 生成；`FormulaDesigner` 内部 `_detect_data_source()` 会尝试连接数据库，但 `_KB_SEED` 作为知识库传入，实际推理强依赖这 8 味。
- 结论：Agent 路径与主路径完全隔离，知识面极窄。

### 路径 D（AIGenerator 流式）——真实，但疑似死代码 ⚠️

- `utility_endpoints.py` 的 `/generate/stream` 是**真实 LLM SSE 流式端点**，设计诚实（LLM 不可用时报错而非造假）。
- 但全前端 grep 未发现任何页面渲染 `<AIGenerator>`（仅 `components/ai/index.ts` 导出）。

### 路径 E（ChatTab 配方对话）——真实 ✅

- `useChatSendMessage` 使用前端 `formulaIntelligenceService.detectIntent()` 检测配方意图，命中后向 prompt 注入「结构化 JSON 输出要求」，最终由**后端 LLM 生成配方 JSON**。
- 前端 `formulaDesignEngine`（自称「专利级配方智能算法」）在聊天链路中**仅用于意图检测**，不直接生成配方。
- `llmAvailable=false` 时跳过全部预处理，走 `thinking_engine` 规则引擎（诚实降级）。
- 结论：链路真实，但 `formulaDesignEngine` 有「过度包装」之嫌（1117 行的前端引擎实际只做了意图检测）。

---

## 三、后端「三套生成代码」的真实挂载关系

| 模块 | 挂载方式 | 实际状态 |
|------|---------|---------|
| `generation_v2.py` | `ai_modules/__init__.py` 先注册（`router.include_router`） | **生效**：`/generate` 主路径由它处理 |
| `generation.py` | 通过 `ai.py` 的 `from .ai_modules import generation` 后注册 | `/generate` **被 generation_v2 遮蔽**（同路径同方法，先注册者胜出）→ 死代码；`/generate/neural` 唯一生效但永远回退 |
| agent `formula_tool.py` | 工具注册表（进程内） | 独立生效，8 味种子库 |

**结论：三套代码确实都活着，但并非「三套都在服务用户」**——准确说是：一套服务主路径、一套服务名义神经网络端点、一套服务 Agent。它们数据源、评分逻辑互不相同，同一功效请求会得到三套不同风格的答案。

---

## 四、数据源审计

| 数据源 | 规模 | 使用方 |
|--------|-----|--------|
| `_BUILTIN_HERBS`（硬编码） | **59 味药材** | 路径 A 的 GA 核心（`bayesian_formula_optimizer.py`） |
| `_EFFICACY_TO_HERBS`（硬编码） | 功效→药材映射 | 路径 A 的 GA 核心 |
| `_FOOD_HOMOLOGY_HERBS`（`formula_gpt.py`） | 回退字典 | 路径 A 的规则回退 |
| `_KB_SEED`（硬编码） | **8 味药材** | 路径 C Agent |
| HerbKnowledgeService（数据库端口） | 数据库全量药材 | `FormulaDesigner._detect_data_source` / `bayesian_formula_optimizer` 的 herb_knowledge 分支 |

**关键疑点**：`generation_v2.py` 的 GA 配置直接使用 `_BUILTIN_HERBS`（59 味），意味着数据库中的全量 TCMSP 药材**很可能没有真正进入主生成路径的评分核心**。数据库数据只在 `FormulaDesigner` 的检测分支或 `bayesian_formula_optimizer` 的 herb_knowledge 分支（第 378 行，非默认）中使用。

---

## 五、前端真实性专项结论

- ✅ `client.ts` 已**移除 mock fallback**（第 130-131 行「始终使用真实 API」）。
- ✅ `backend/.env` 已设 `AI_MOCK_MODE=false`，后端 mock 响应关闭。
- ✅ GenerateTab 的「生成引擎」徽标是**动态**的（`HeaderPro.tsx` / `FormulaResultsPro.tsx` 根据后端 `generator` 字段渲染）。
- ✅ 未发现「静态『神经网络生成』文案」仍在生效——历史记忆中的问题已在后续迭代中消除。
- ⚠️ 但存在**新的名义不一致**：`NeuralGeneratePanel` 的 UI 标题宣称「神经网络」，后端实际永远返回规则引擎结果（P0-1）。

---

## 六、按严重程度排序的问题清单

### P0-1：/generate/neural 是「名义神经网络」，实际永远规则引擎
- 根因：`generation.py` 导入了不存在的 `neural_engine`（应为 `neural_formula_engine`），且后者是 `MockNeuralFormulaEngine`。
- 影响：高级模式 UI 宣称「神经网络生成」，用户实际拿到规则引擎结果；如果未来有人依赖该端点做"神经网络"声称，属于**功能造假**。
- 修复方向：① 修正 import 并评估 `MockNeuralFormulaEngine` 是否可转正；② 或在前端删除/重命名该面板，改为真实 GA 的「高级模式」；③ 若保留，后端必须诚实返回 `generator` 实际值（现在 ImportError 回退后返回 `rule_engine`，这点后端是诚实的——问题在**前端 UI 标题**）。

### P0-2：主生成路径可能只跑在 59 味硬编码药材上
- 根因：`generation_v2.py` 直接用 `_BUILTIN_HERBS`（59 味）构造 GA，数据库全量药材未进入评分核心。
- 影响：这与「TCMSP 数据库驱动」的产品宣称不符；生成的配方多样性、科学性受限于 59 味。
- 需要进一步验证：`HerbKnowledgeService` 是否真的在 GA 的 `optimize()` 内被使用（`bayesian_formula_optimizer` 第 362 行默认 `_EFFICACY_TO_HERBS`，第 378 行才是数据库分支）。

### P1-1：generation.py 的 `/generate` 是被遮蔽的死代码
- 同路径同方法，先注册的 generation_v2 生效；generation.py 的 `/generate` 永远不会被命中。
- 风险：未来修改 generation.py 时会产生「改了但没生效」的错觉。
- 建议：删除 generation.py 中被遮蔽的 `/generate` 与 `/health`，保留 `/generate/neural`（先修复 P0-1）或整体退役。

### P1-2：Agent 配方工具只有 8 味药材
- `/agent` 的配方生成知识面极窄，与主路径结果差异大。
- 建议：让 agent 工具复用 generation_v2 的 GA 服务（同一权威服务），而不是维护第四套生成逻辑。

### P2-1：GA 在 UI 上被标注为「规则引擎」
- `normalizeGenerator` 把 `ga_optimizer` 映射为 `rule_engine`。用户看到「规则引擎」徽标，但实际是遗传算法。
- 这是**标签失真**（低估而非高估），影响产品专业形象。
- 建议：把 `ga_optimizer` 映射为独立的「遗传算法优化」标签。

### P2-2：AIGenerator 组件疑似死代码
- 端点真实（/generate/stream），但组件未被页面渲染。建议确认后删除或接入。

---

## 七、结论与建议

**「前端静态假文案」问题已不存在**（mock 已移除、AI_MOCK_MODE=false、徽标动态渲染）。

当前真正的核心问题不是"假"，而是**"名义与实质不一致 + 生成知识面过窄"**：

1. **名义不一致**：神经网络面板 → 规则引擎实际（P0-1）。
2. **知识面过窄**：主 GA 跑 59 味内置药材（P0-2）；Agent 只有 8 味（P1-2）。
3. **代码分叉**：三套生成逻辑各自为政（P1-1）。

这与上一轮讨论的「收口为唯一 FormulaGenerationService」方向一致，且测绘给出了精确的收口边界：

- **保留并强化**：`generation_v2.py`（真实 GA）+ `utility_endpoints.py`（真实 LLM 流式）+ `chat.py`（真实 LLM 对话）。
- **收口**：`generation.py` 的被遮蔽路由删除；`/generate/neural` 要么接真实实现、要么改名/下线。
- **统一**：Agent 的 `generate_formula` 改为调用主 GA 服务。
- **下一步验证**：确认 `bayesian_formula_optimizer` 在默认配置下到底用的是数据库还是 59 味硬编码（P0-2 的最终定性），这决定"知识面"修复的工程量。

---

## 八、处理结果与勘误（2026-10-16 授权处理后更新）

### 已处理项

| 编号 | 问题 | 处理 | 状态 |
|------|------|------|------|
| P0-1 | `/generate/neural` 名实不符（导入不存在的 `neural_engine`，永远回退规则引擎；前端面板宣称"神经网络"） | ① 新建统一生成服务 `backend/app/services/ai/formula_generation_service.py`（`run_ga_generation`），`/generate/neural` 改为调用它（真实 GA + 数据库药材 + 优先级权重透传）；② 前端 `NeuralGeneratePanel.tsx` 去掉"神经网络"标称，改为「高级配方优化生成」/「遗传算法优化」 | ✅ |
| P2-1 | GA 结果在 UI 上被标为「规则引擎」 | `GeneratorType` 新增 `'ga'`，`ga_optimizer` → 「遗传算法优化」；同步更新 `HeaderPro` / `FormulaResultsPro` / `FormulaResults` / `FormulaResultsEnhanced` | ✅ |
| 收口 | `generation_v2.py` 内联 GA 逻辑与 `generation.py` 分叉 | `generation_v2.py` 重构为调用统一服务 `run_ga_generation`；`generation.py` 的 `/generate/neural` 也调用同一服务——两条端点现在共享唯一生成实现 | ✅ |
| 收口 | `generation.py` 与 `generation_v2.py` 存在重复路径 `/generate`，造成路由归属歧义 | 将 `generation.py` 的旧 `/generate` 改名为 `/generate/legacy`（保留兼容），`/ai/generate` 现在唯一由 `generation_v2`（真实 GA）处理 | ✅ |

### P0-2 勘误（重要更正）

原报告称「主 GA 只跑在 59 味硬编码药材上」——**该判断不成立**。

实际代码中：
- `GeneticFormulaOptimizer._try_load_herb_knowledge()` 已在首次 `optimize()` 时自动从全局 `HerbKnowledgeService` 加载数据库药材（`get_global_herb_knowledge()`），
- `app/main.py` 启动链路调用 `init_ai_services()`，后者通过 `TCMSPHerbKnowledgeAdapter` 从数据库加载药材并 `set_global_herb_knowledge()`。

因此**运行中的主路径 `/ai/generate` 已经在使用数据库药材**，59 味 `_BUILTIN_HERBS` 只是离线/未初始化时的兜底。原报告的 P0-2 是误报。

**但发现一个相关真实缺陷并已修复**：`generation_v2.py` 格式化候选时用 `_BUILTIN_HERBS` 做 herb_id → 中文名映射。一旦 GA 从数据库加载药材（herb_id 与内置短码不同），输出会显示原始 ID 而不是中文名。统一服务已改为使用 `optimizer._herbs`（实际加载的药材字典）做名称映射。

### 验证情况

- ✅ 后端 `py_compile` 通过
- ✅ `app.services.ai.formula_generation_service` 导入成功
- ✅ `import app.api.ai` 后路由注册正常（`/ai/generate` 由 generation_v2 处理、`/ai/generate/neural` 由 generation.py 处理且已接入统一服务）
- ✅ 前端 `tsc --noEmit` 对改动文件（GenerateTab / NeuralGeneratePanel / useFormulaGeneration / HeaderPro / FormulaResults 系列）无新增错误
- ✅ 统一服务冒烟测试（见运行输出）

### 遗留建议（未处理，需用户确认）

1. ~~**P1-2**：Agent 工具 `generate_formula` 仍使用 8 味种子药材 `_KB_SEED`~~ → **已处理**（2026-10-16）：`formula_tool.py` 改为调用统一服务 `run_ga_generation`，与 `/ai/generate` 同一套真实 GA 引擎；`_KB_SEED` 仅保留给 `IngredientInfoTool` 单味药材查询。
2. **P1-1**：`generation.py` 中的旧 `/generate/legacy` 处理器体（约 280 行）是保留兼容代码，建议后续专项删除。
3. **P2-2**：`AIGenerator.tsx` 组件疑似无页面渲染，端点 `/ai/generate/stream` 真实可用，建议确认后删除组件或接入。
4. **命名清理**：`NeuralGeneratePanel` 文件名/组件名/API 路径 `/generate/neural` 仍含 "neural"，行为已诚实（GA），建议后续统一更名。

---

## 九、配料表核查闭环 MVP（2026-10-16 交付）

### 交付内容

| 类别 | 交付物 |
|------|--------|
| 合规边界 | `docs/ingredient-label-check-compliance-wording.md` — 产品定位「信息比对参考」、禁用绝对化判定、固定免责声明、分类话术模板、过敏原范围、数据局限 |
| 后端服务 | `backend/app/services/label_check/label_check_service.py` — 括号深度感知的配料表解析、成分分类（药食同源/GB2760添加剂/GB14880强化剂/禁用物质/常见食品原料/未收录）、八大致敏物质标记、安全话术报告 |
| 后端 API | `backend/app/api/v1/label_check_router.py` — `POST /api/v1/label-check`、`POST /api/v1/label-check/ingredients`、`GET /label-check/health`；已在 `main.py` 注册 |
| 前端 | `frontend/src/api/labelCheck.ts` + `frontend/src/pages/label/LabelCheckPage.tsx` + 路由 `/label-check` + 导航「配料核查」（合规质量组） |

### 设计要点

- **复用现有合规数据**：药食同源 106 种限量、GB2760 添加剂、GB14880 强化剂、禁用清单全部来自平台已有模块，不重复造数据。
- **法律安全话术**：报告带固定免责声明；禁用「合规✅」类绝对化结论；未收录成分一律提示人工核实。
- **复合配料展开**：支持「植脂末（葡萄糖浆、氢化植物油）」解析为外层 + 子成分。
- **过敏原提示**：按 GB 7718 附录 B 八类致敏物质标记。

### 验证结果

- ✅ `py_compile` 通过（service / router / main.py）
- ✅ 服务冒烟测试：复合配料正确展开、分类与过敏原标记正确
- ✅ `TestClient` HTTP 测试：`POST /label-check` 返回 200，8 项配料、1 个过敏原、免责声明完整
- ✅ 前端 `tsc --noEmit` 对新增/修改文件无错误

### 已知局限（下一迭代）

1. GB2760 为精选条目（全量按食品类别限量需二期数据工程）。
2. 常见食品词典覆盖有限，大量成分会落入「未收录」（设计上以人工核实兜底）。
3. 未覆盖新食品原料目录。
4. 复合配料目前只做一层展开。

---

## 十、配方设计智能 — 辨证引擎真实化（2026-10-16 交付）

### 背景发现（测绘）

`orchestrator._build_response` 的「辨证与目标」长期依赖**硬编码 `if 关键词`**（高血糖/高血压/失眠/痛风/肥胖 5 个场景），其他输入输出通用废话；且其 RAG 集成是坏的（工具返回 `chunks`，代码却查 `results`），`kg_infer` 工具根本不存在。

### 交付内容

| 类别 | 交付物 |
|------|--------|
| 辨证引擎服务 | `backend/app/services/ai/dialectics_service.py` — 真实 LLM 辨证（结合 RAG 检索）+ 证据分级引用 + 急重症自动拒绝 + 规则引擎降级（明确标注） |
| 编排器接入 | `orchestrator.py` — `_build_response` 改为 async，辨证段落调用 `analyze_dialectics(query)`，替换硬编码 `if 关键词`；3 处调用点同步加 `await` |
| 评测集 | `backend/scripts/data/dialectics_eval_cases.json` — 8 例（失眠/高血压/高血糖/痛风/肥胖/通用 + 2 例急重症） |
| 评测脚本 | `backend/scripts/eval_dialectics.py` — 逐例断言急症判定、体质倾向非空、规则降级关键词；输出通过率 |

### 验证结果

- ✅ `py_compile` 通过；orchestrator 模块导入成功
- ✅ 评测 **8/8 通过**（真实 LLM 环境，engine=llm_rag）
  - 慢性调理场景全部 `urgent=False` 且体质倾向合理（气阴两虚/肝阳上亢/痰湿等）
  - 急重症场景（胸痛、昏迷）全部 `urgent=True` 并给出就医提醒
- ✅ 修复过程中发现并解决：LLM 误把「血糖偏高」判为 urgent → 收紧提示词判定规则（仅急性危重表现才 urgent）
- ✅ 全程未启动/停止任何服务

### 遗留说明

- ChatTab 的 `thinking_engine` 仍是规则引擎，但它仅作为 **LLM 不可用时的降级路径**（LLM 可用时 ChatTab 本身就是真实 LLM），符合诚实降级设计，暂不改动。
- 评测集当前用于回归验证；后续可扩充到 30+ 例并接入 CI。

---

## 十一、遗留清理项（2026-10-16 完成）

### ③-1：清理 `/generate/legacy` 旧代码

- `generation.py` 由 714 行精简为约 380 行：删除旧版 `/generate/legacy` 处理器（约 286 行 unified_optimizer 逻辑）及不再使用的 `FormulaGenerateRequest`、`sub_router`、重复 import。
- 保留活跃端点：`/health`、`/generate/advanced`、`/generate/v2`、`/generate/seven-step`、`/safety-check`、`/synergy-analysis`、`/recommend`、`/interpret`。
- 验证：`py_compile` 通过；路由确认 `/ai/generate/legacy` 已消失。

### ③-2：删除 `AIGenerator` 死代码

- 确认 `frontend/src/components/ai/AIGenerator.tsx` 全仓无任何页面/组件引用（仅 barrel 导出）。
- 移除 `components/ai/index.ts` 中的导出并删除文件；删除后全仓 0 残留引用。
- 其端点 `/ai/generate/stream` 保留（真实可用，供未来功能接入）。

### ③-3：命名清理（Neural → Advanced）

| 项 | 旧 | 新 |
|----|----|----|
| 组件文件 | `NeuralGeneratePanel.tsx` | `AdvancedGeneratePanel.tsx` |
| 组件名 | `NeuralGeneratePanel` | `AdvancedGeneratePanel` |
| 后端 API 路径 | `POST /ai/generate/neural` | `POST /ai/generate/advanced` |
| 前端 API 函数 | `aiApi.generateNeural` | `aiApi.generateAdvanced` |
| 响应类型 | `NeuralGenerateResponse` | `AdvancedGenerateResponse` |
| 端点常量 | `GENERATE_NEURAL` | `GENERATE_ADVANCED` |

同步更新：`GenerateTab.tsx` 懒加载与 JSX、`api/ai.ts`、`apiEndpoints.ts`、`backend/tests/api/test_ai_api.py`、各模块 docstring。

### 验证结果（③）

- ✅ 后端 `py_compile` 通过（generation / test / ai / service / analyze）
- ✅ 路由确认：`/ai/generate/advanced` 生效，`/ai/generate/neural` 与 `/ai/generate/legacy` 均消失
- ✅ 前端 `tsc --noEmit` 对改动文件无错误
- ✅ 前端 grep 确认 `NeuralGeneratePanel` / `AIGenerator` 零残留
- ✅ TestClient 验证 `/ai/generate/advanced` 返回 200（ga_optimizer）

### 至此，三大阶段全部完成

① 配料表核查闭环 ✅ → ② 辨证引擎真实化 ✅ → ③ 遗留清理 ✅

---

## 十二、二期增强（2026-10-16）

### A. 配料表核查数据工程扩充

| 项 | 内容 | 结果 |
|----|------|------|
| 常见食品词典 | `_COMMON_FOOD_ALIASES` 从约 60 项扩充到 200+ 项（谷类/油脂/乳品/蛋豆/坚果/果蔬/肉水产/调味料/常见配料） | ✅ |
| 新食品原料目录 | 新增 `_NEW_FOOD_INGREDIENTS` 精选 15 种（玛咖粉/蛹虫草/雨生红球藻/奇亚籽/磷虾油/牡丹籽油/人参人工种植等，含批准公告号与不适宜人群） | ✅ |
| GB2760 补充 | 新增 `_EXTRA_ADDITIVES` 约 70 种常见添加剂（防腐/甜味/酸度调节/增稠/着色/抗氧化等） | ✅ |
| 分类器 | 新增 `new_food_resource`（新食品原料）分类；报告摘要纳入统计 | ✅ |
| 话术文档 | `docs/ingredient-label-check-compliance-wording.md` v1.1 更新分类模板、数据来源与局限性 | ✅ |

冒烟测试：奇亚籽/玛咖粉→新食品原料，卡拉胶/木糖醇/赤藓糖醇→GB2760添加剂，阿托品→禁用/风险，小麦粉→过敏原。

### B. 辨证评测集扩充

- 评测集从 8 例扩充到 **36 例**：新增脂肪肝/便秘/腹泻/胃胀/口臭/脱发/畏寒/易感冒/贫血/月经不调/口干/咳嗽痰多/过敏性鼻炎/焦虑/食欲不振/反酸/口腔溃疡/痤疮/浮肿/湿疹/耳鸣/更年期/孕妇/服药/老年人等慢性和特殊人群场景，以及剧烈头痛/腹痛/呕血黑便/抽搐/中风等急症场景。
- 运行 `scripts/eval_dialectics.py`：**36/36 全部通过**（LLM 模式为主，规则降级路径也正确；所有急症案例均正确返回 urgent=True 并给出就医提醒）。

### 验证

- ✅ 后端 `py_compile` 通过
- ✅ 配料表分类器冒烟测试全部正确
- ✅ 辨证评测 36/36 通过（exit 0）
- ✅ 全程未启动/停止任何服务

---

## 十三、四步执行：验收 / OCR / CI / ChatTab（2026-10-16）

### ① 验收（实测运行环境）

前后端 dev 服务已在运行（后端 python、前端 node，均未由本会话启动/停止）。

- ✅ `/api/v1/ai/health`：healthy，llm_available=True
- ✅ `POST /api/v1/label-check`（带 CSRF）：HTTP 200，9 项配料分类正确（黄芪→药食同源、奇亚籽→新食品原料、山梨酸钾→GB2760、小麦粉→过敏原、免责声明完整）
- ✅ `POST /api/v1/ai/generate/advanced`（admin 登录 + Bearer token）：返回真实 GA 配方（大枣/枸杞子/金银花/生姜，含多维评分，generator=ga_optimizer）
- ✅ 前端 `/label-check` 页面 HTTP 200
- 🐛 **验收中发现真实缺陷并修复**：注册端点 `auth.py` 中 `service.register` 仅 `flush()`（使 `session.new` 清空），依赖层 `get_db()` 的 `if session.dirty or session.new` 条件提交判定为假 → 事务回滚，**新注册用户实际未持久化**。已在注册端点显式 `await db.commit()` + `refresh`。此修复需重启后端后生效。

### ② 配料表核查三期（OCR + 新食品原料扩充）

- 新增 `POST /api/v1/label-check/ocr`：上传图片 → RapidOCR 识别 → 目录比对核查报告（复用 `ingredient_analysis_router._run_ocr`）。
- 前端 `LabelCheckPage` 新增「上传图片识别」按钮 + OCR 文本回显；API 客户端新增 `checkOcr`。
- 解析器改进：英文配料表（无中文、含空格）按空白切分。
- 新食品原料目录从 15 种扩充到 **28 种**（新增透明质酸钠/元宝枫籽油/杜仲籽油/雪莲培养物/枇杷叶/桃胶/酵母β-葡聚糖等，公告号以官方发布为准）。
- 验证：RapidOCR 1.4.4 已安装；`/label-check/ocr` 实测 HTTP 200 成功识别；分类冒烟测试正确。

### ③ 辨证评测集接入 CI

- `.github/workflows/ci-cd.yml` 的 `test-backend` job 新增「辨证引擎评测」步骤：`cd backend && python scripts/eval_dialectics.py`。
- CI 环境无 LLM Key 时自动走规则降级路径，评测仍必须全过（36 例）。

### ④ 辨证引擎接入 ChatTab 流式输出

- 后端 `chat.py` 流式 `event_stream` 在输出前新增 `dialectics` SSE 事件（含急症判定/体质倾向/调理方向/证据分级/降级标注）。
- 前端 `chatService.ts` 解析 `dialectics` 事件；`useChatMessages` 累积到消息；`MessageBubble` 新增 `DialecticsCallout` 渲染（急症红色就医提醒卡片 / 常规辨证分析卡片）。
- 验证：后端批量 `py_compile` 通过；前端 `tsc --noEmit` 对改动文件无错误。

### 说明

- 注册 bug 修复与本次 ②③④ 的代码改动均需**重启后端**后在运行环境生效；本会话遵守约束未重启任何服务。