# 配方生成 UI/UX 设计规范深挖审计（第2期）

**日期**：2026-11-09｜**审计范围**：`frontend/src/components/ai/features/GenerateTab/` 组件树
**基准**：RMFOOD 设计系统 v4.0（`frontend/design-system/DESIGN.md` + `src/styles/tokens/*.css`）
**执行**：Lead 单兵（成员上限8）

## 审计维度与结论

### 1. 排版层级（Typography）— ✅ 合规
**关键发现**：设计系统已将 Tailwind 原生字号类**映射为令牌别名**（`typography.css:163-164`）：
- `.text-sm` → `var(--text-body-sm)`
- `.text-xs` → `var(--text-caption)`

因此组件中使用 `text-sm`/`text-xs` **不是违规**——它们解析到设计令牌值。规范类
（`text-title-sm`/`text-body-sm`/`text-caption`）与别名（`text-sm`/`text-xs`）等效。
**结论**：GenerateTab 排版遵循令牌，合规。

### 2. 间距一致性（Spacing）— ✅ 合规
扫描任意值间距（`gap-[Npx]`/`space-y-[Npx]`/`p-[Npx]` 绕过刻度）→ **0 处**。
组件树全用标准 Tailwind 间距刻度（`gap-2`/`space-y-4`/`p-3` 等），即设计系统的 `--space-*` 刻度。
**结论**：间距一致，合规。

### 3. 触摸目标（Touch Targets ≥44px）— ⚠️ 2 处 P2 观察（未改）
发现 2 处次要紧凑按钮垂直内边距 `py-1.5`（高度≈32px < 44px）：
- `GenerationInputPro.tsx:577` — 重置按钮（`onFullReset`）
- `FormulaResultsPro.tsx:315` — 筛选切换按钮

**判定**：均为**桌面端次要/紧凑控件**（重置、筛选切换），非移动主操作。设计规范 44px
主要约束移动主交互目标。强行拉高至 44px 会破坏桌面紧凑视觉层次。
**处置**：列为 P2 观察，**不擅自修改**（避免损害桌面 UX）。若后续做移动端适配可再评估。

### 4. 配色/令牌合规 — ✅（上一期已修复）
上一期（goal-caa47faf）已修复渲染 UI 的令牌违规：
- `ResultsViewSwitcher.tsx`：硬编码 `neutral-*` 灰阶 + 内联 style 色值 → 语义令牌
- `GenerationPanel.tsx:69`：内联 `var(--text-primary)` → `text-foreground` 类

### 5. i18n 一致性 — ✅（上一期已修复）
`MechanismNetworkPanel`/`FormulaOverviewComparePanel` 硬编码中文 → t()；补齐三语 key。

## 总体结论
GenerateTab 组件树在**排版/间距/配色**三维度**整体符合设计系统 v4.0**。
配色与 i18n 维度的具体违规已在上一期修复。本期审计确认排版与间距合规，
仅 2 处次要触摸目标列为 P2 观察（故意保留桌面紧凑 UX）。

## 交付物
- 本报告：`docs/reviews/配方生成UIUX设计深挖审计.md`
- 代码修复：见上一期（goal-caa47faf）改动文件清单

## 后续可选项（非阻塞）
- 移动端适配时重审 2 处 P2 触摸目标
- 响应式断点行为（md:/lg:）的逐组件验证（本期未深挖）
- 加载/空态/错误态的一致性专项审计

---

# 配方生成 UI/UX 设计审计（第3期·状态一致性）

**日期**：2026-11-09｜**范围**：GenerateTab 加载/空态/错误态 + 响应式
**执行**：Lead 单兵

## 审计发现

### 加载态（Loading）— ✅ 基本一致
- **图标统一**：组件树统一用 `Loader2 + animate-spin`（lucide 惯例）——GenerationInputPro:389、FormulaRecommendPanel:64、FormulaExplanationPanel:105
- **文案已 i18n**：FormulaExplanationPanel 用 `t('...generatingExplanation')`、FormulaRecommendPanel 用 `t('...searchingRecommendations')`
- **死配置**：`generateTabConfig.ts:120 loadingText: '加载中...'` 定义但**全项目未使用**（仅1处=定义本身），无害冗余

### 错误态（Error）— ⚠️ 1 处 P2 改进建议
- `FormulaExplanationPanel:110`：错误态仅显示红色错误文本框，**无重试按钮**
- 建议：错误框内加"重试"按钮调用 `loadInterpretation()`；需给三语 generateTab 段补 `retryExplanation` key（注意 generatingExplanation 在 544/800 两段重复，编辑锚点需精确）
- **本期未实施**：因重复键结构歧义 + 避免在上下文紧张时引入错误，列为建议

### 空态（Empty）— 待深挖
- 本期未系统审计空态（无结果/无推荐时的引导提示一致性）

### 响应式（Responsive）— 待深挖
- 本期未逐组件验证 `md:`/`lg:` 断点适配

## 第3期结论
**加载态一致（统一 Loader2 + i18n 文案）**。错误态缺重试按钮（P2 建议，未实施）。
空态与响应式维度待后续深挖。

## 全三期总体结论
- 配色/令牌合规：✅（第1期修复）
- i18n 一致性：✅（第1期修复）
- 排版层级：✅ 合规（text-sm/xs 是令牌别名）
- 间距一致性：✅ 合规（无任意值）
- 加载态：✅ 一致
- 触摸目标：⚠️ 2 处 P2（桌面紧凑控件，故意保留）
- 错误态重试：✅ 已实施（第3期后单独交付：FormulaExplanationPanel 重试按钮 + reloadKey 机制 + 三语 key）
- 空态：✅ 合规（第4期）
- 响应式：✅ 合规（第4期）

---

# 配方生成 UI/UX 设计审计（第4期·空态与响应式）

**日期**：2026-11-09｜**范围**：GenerateTab 空态 + 响应式断点
**执行**：Lead 单兵

## 空态（Empty State）— ✅ 合规
- **FormulaResultsPro:370-376**：规范空态——居中卡片 `bg-muted/20 rounded-xl border-2 border-dashed` + Filter 图标 + `noResults` 标题 + `noResultsHint` 提示 + 重置 CTA，全用语义令牌（text-foreground/text-muted-foreground/bg-muted）
- **FormulaRecommendPanel:75**：`recs.length === 0` 空态处理
- **MechanismNetworkPanel/FormulaOverviewComparePanel**：空数据各自兜底（暂无数据提示 / 隐藏对比区）

## 响应式（Responsive）— ✅ 合规
组件树全面覆盖断点：
- HeaderPro `lg:flex-row` + `hidden sm:inline`
- GenerationInputPro `sm:grid-cols-3/6` `md:grid-cols-5`
- FormulaResultsPro 结果网格 `md:grid-cols-2 lg:grid-cols-3`、统计 `sm:grid-cols-4`
- FormulaComparePanel/ConstraintPanel/AlgorithmConfigPanel `sm:grid-cols-2`
- **FormulaOverviewComparePanel 对比表已有 `overflow-x-auto`**（小屏横向滚动）

## 第4期结论
**空态与响应式均已良好实现，无高优先级违规。** 代码库设计系统合规度高。

## 全四期最终结论
GenerateTab 组件树在**配色/令牌、i18n、排版、间距、加载态、空态、响应式**七维度**整体符合设计系统 v4.0**。唯一遗留：2 处桌面紧凑控件触摸目标 P2（故意保留）。无阻塞问题。
