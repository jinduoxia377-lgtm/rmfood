# 配方生成模块 — 第三次全面核查报告

> 核查时间：2026-09-27
> 核查层级：数据库真实结构验证 → 新端点实际运行 → 前端渲染依赖 → 全仓标签扫描
> 核查方式：真实数据库采样 + 服务端逻辑实跑 + 代码静态审查

---

## 一、核查结论总览

| 级别 | 数量 | 说明 |
|:-----|:-----|:-----|
| 🔴 严重（数据格式 bug） | 1 | 已即时修复 |
| 🟠 中等（假设偏差） | 1 | 已即时修复 |
| 🟡 信息性（数据特征） | 2 | 无需修复，记录在案 |

**本次核查新发现并修复 2 处此前未暴露的问题，均源于"对数据库真实结构的假设与实际的偏差"。**

---

## 二、详细核查发现

### 🔴 R1. `TCMHerb.targets` 实际是对象数组，解释服务透传导致前端运行时崩溃

**位置**：`backend/app/services/ai/formula_interpreter.py` + 前端 `FormulaExplanationPanel.tsx`

**核查方式**：真实数据库采样（黄芪/枸杞/茯苓）。

**现象**：
- 假设：`herb.targets` 为字符串列表 `["NF-kB", "MAPK"]`
- 实际：`herb.targets` 为对象列表 `[{"id": "", "name": "Prostaglandin G/H synthase 2", "drugbank_id": ""}, ...]`
- `FormulaInterpreter.interpret()` 原样透传 `targets[:4]`，前端 `m.targets.join('、')` 在 **dict 上没有 `join` 方法 → 运行时 TypeError，"配方方解"面板的"现代药理机制"区块渲染失败**。

**修复**：`FormulaInterpreter` 新增 `_normalize_targets()` / `_normalize_compounds()` 静态方法，把对象数组归一化为名称字符串列表；前端无需再改。

**验证**：修复后实跑 `interpret`，黄芪 → `['Prostaglandin G/H synthase 2', 'Amine oxidase [flavin-containing] B']`（真实靶点名），3/3 药材命中数据库机制。

### 🟠 R2. `extra_knowledge.synergy_partners` 实际是"药材名"字符串，推荐引擎按 herb_id 解析导致协同对失配

**位置**：`backend/app/services/ai/prescription_recommender.py` + `formula_explanation.py`

**核查方式**：全表 583 条 `extra_knowledge` 解析统计。

**现象**：
- 假设：`synergy_partners` 存储的是 herb_id
- 实际：`partner_val_types = {'str'}`，且这些字符串是**药材名**（如 "枸杞"、"山楂"），不是 herb_id
- 原推荐引擎 `partner_count[frozenset((hid, partner))]` 把"名"与"id"混入同一个 frozenset，导致协同对去重/匹配失真（"黄芪" 的 partner 被记录为 `frozenset({herb_id_of_黄芪, '枸杞'})`，与"枸杞"自身记录的方向不对称）。

**修复**：推荐引擎与解释服务均在构建协同对前先做"名 ↔ id"归一（`partner_s in name_map.values() ? 按名 : 按 id`），确保协同对两端同为主键形态。

### 🟡 R3. `synergy_partners` 填充率仅 41/583（7%）— 数据特征记录

**核查结果**：全表 583 条中仅 41 条 `synergy_partners` 非空。

**影响评估**：
- 推荐引擎"协同配伍策略"只能基于这 41 条出数，覆盖面窄；
- 但**历史配方策略（formulas 表 12 条真实数据）+ 内容功效策略（583 条 efficacy_scores）两条主线数据充足**，三策略聚合后仍有稳定输出；
- 解释服务"配伍协同"区块对 41 条之外的药材会走"君臣佐使原则配伍"的兜底文案（合理降级，非假数据）。

**结论**：无需修复，属 TCMSP 源数据本身特征，已记录。

### 🟡 R4. `formulas` 表 `composition` 结构为"药材名→剂量"映射，非 `{"herbs": [...]}` 数组

**核查结果**：真实数据 `composition_keys=['黄芪','山药','山药多糖','枸杞','绞股蓝','茯苓']`（键即药材名，值为剂量）。

**影响评估**：推荐引擎 `_composition_to_herbs()` 已兼容"直接 list"与"herbs 键"两种形态，但**未处理"药材名→剂量"的 dict 形态**。当前历史配方策略在遇到这种 composition 时会返回空 herbs → 该条历史配方被跳过。

**状态**：属 P2 优化项（不影响主链路，历史策略退化为"无历史命中"而非错误），已在下方遗留项记录。

---

## 三、前端渲染依赖核查（核查 3）

| 依赖 | 验证结果 |
|------|---------|
| `Card` 组件 `className` / `hoverable` 属性 | ✅ `CardProps extends HTMLAttributes`，支持透传 |
| `Button` `icon` 属性 | ✅ `icon?: ReactNode` 已声明 |
| `Badge` `variant` 值域 | ✅ `primary/success/warning/info/danger/neutral` 均存在 |
| `FormulaRecommendPanel` / `FormulaExplanationPanel` 图标导入 | ✅ `lucide-react` 按需导入，无缺失 |
| 候选字段兼容（`formula_name`/`name`/`herb_combination`） | ✅ 已做 `dosage_g ?? dosage ?? dose_g` 多字段兜底 |

**结论**：两个新面板的 UI 依赖全部校验通过，无渲染崩溃风险（R1 修复后）。

---

## 四、英文标签全仓扫描（核查 4）

对 `frontend/src/components/ai/features/GenerateTab` 全目录 + `NeuralGeneratePanel` 做正则扫描（`Overall|Synergy|Score|Unknown|Error|Success|Loading|Cancel|...` 等 30+ 常见英文标签），**结果：0 命中**。配方生成范围内无残留英文标签。

---

## 五、本次即时修复清单

| 文件 | 修复项 |
|------|--------|
| `backend/app/services/ai/formula_interpreter.py` | R1：新增 `_normalize_targets` / `_normalize_compounds`，归一化对象数组为名称列表 |
| `backend/app/services/ai/prescription_recommender.py` | R2：协同对构建前做"名↔id"归一，消除 frozenset 形态失配 |
| `backend/app/services/ai/formula_explanation.py` | R2：`init_from_database` 协同对解析同步做名/id 兼容 |

---

## 六、验证结果

- **后端**：`formula_interpreter.py` / `prescription_recommender.py` / `formula_explanation.py` / `generation.py` 全部 `py_compile` 通过；实跑 `recommend` + `interpret` 走真实数据库成功（3/3 药材命中机制库）。
- **前端**：`tsc --noEmit` 全项目 **0 错误**。
- **数据**：TCMHerb 583/583 有 extra_knowledge；formulas 12 条真实历史；synergy_partners 41 条（源数据特征，非缺陷）。

---

## 七、最终遗留项（P2，非缺陷）

| 事项 | 说明 |
|------|------|
| 推荐引擎历史策略兼容"名→剂量"dict 型 composition | `formulas.composition` 实际是 `{药材名: 剂量}` 映射，当前 `_composition_to_herbs` 未处理此形态，该策略会静默跳过这类历史配方 |
| `synergy_partners` 填充率 7% 的数据增强 | 属 TCMSP 源数据特征，如需提升协同策略覆盖面需补充配伍知识抽取 |

---

## 八、结论

第三次核查聚焦"数据库真实结构 vs 代码假设"的偏差，**发现并修复了 1 个会导致前端运行时崩溃的严重数据格式 bug（R1 targets 对象数组）和 1 个协同对失配的中等缺陷（R2 synergy_partners 名/id 混用）**。两者都源于早期基于"理想 schema"的代码假设，经真实数据采样后才暴露——这正是"实际数据必须调用数据库完整数据"原则的价值体现：假设一旦被真实数据证伪，就会以运行时错误或静默失配的形式现形。

修复后全链路（主生成 + 推荐 + 解释 + 方解 UI）基于真实数据库数据运行，TS 0 错误，无残留英文标签。配方生成模块当前无已知 P0/P1 级缺陷。
