# /settings「主题」模块 · 系统性控制能力 专业执行方案

- **编制日期**：2026-10-12
- **依据**：`RMFOOD-主题设置模块功能核查报告.md`（commit `43d2f2e`）+ 本轮架构锚点复核
- **目标**：使 `/settings?tab=theme` 成为**唯一完备**的主题控制入口，对「明暗模式 / 品牌色阶全档 / 次色 / 强调色 / 字号全档 / 无障碍 / 圆角间距 / 导出导入」实现**跨刷新持久**的运行时控制
- **执行边界**：不改任何组件消费点（3 108 处主色阶调用不动）、不破坏 D-57/T-B2b「内置纯净预设零内联」、不新增平行入口（§8.2 U-1）

---

## 0. 三条设计基线（先立原则，后动手）

**基线 1 · 单通道原则**
UI 层**禁止**直接 `root.style.setProperty('--...')`。所有运行时覆盖必须走：
`ThemePanel → applyCustomTheme(overrides) → mergeThemeOverrides → generateCSSVariables → applyThemeToDOM`
现状违反点：`ThemePanel.tsx:139-164` 的 `applyBrandScale` / `applyFontScale` 是绕过 store 的直写 hack——它正是「刷新即丢」与「覆盖率 63.2%」两个缺陷的共同土壤。

**基线 2 · 数据模型先行**
覆盖率不足不是 bug，是**数据模型能力上限**：`APPLE_HIG_PALETTES` 只有 4 个值（light/dark/hover/pressed），`FONT_SCALES` 只有 3 档。必须先扩数据模型，再谈 UI。

**基线 3 · 档位内单调性**
主色阶在双模式下是**有意反转**的（base.css 亮色 100 浅→950 深；dark.css 暗色 100 深→950 浅）。因此任何运行时注入**必须整档同向替换**，绝不允许只改中间档——否则产生「断裂梯度」（500/600/700 蓝、100-400 与 800-950 仍是绿的反转值），这比全绿更糟，且 800-950 在暗色下是浅色，叠白字即 D-50 类崩塌（本轮探针实测已复现该形态）。

---

## 1. 缺陷 → 根因 → 修复层 对照

| ID | 缺陷 | 根因（已定位到行） | 根因层 | 修复落点 |
|:---|:-----|:-------------------|:-------|:---------|
| R1 | 刷新后配色+字号全丢，且连带丢明暗 | `themeStore.ts:289/296` `applyCustomTheme` 写 `activeThemeId='custom-${Date.now()}'` → `:498` 持久化该 id → `initialize()` `:143` 用 `presetThemes[id]` 查表未命中 → `:147-149` warn「无效的主题ID」→ 回退 `light-default` | **解析层** | B1 |
| R2 | 配色覆盖率 63.2%（1 965/3 108 处） | `theme-palette.ts:15-21` 每方案仅 4 值；`ThemePanel.tsx:139-149` 只写 500/600/700 | **数据层 + UI 层** | A4 + C1 |
| R3 | 次色/强调色完全不受控 | ~~`applyPalette` 只写 `colors.primary`；`COLOR_MAIN_TO_L0`（`theme.presets.ts:520-538`）无 secondary/accent 档映射~~ → **已解（E3）**。复核结论：`secondary-main` / `tertiary-main` → `--color-secondary` / `--color-accent` 的映射在 T-B2a 早已存在（`:577-581`），真正缺的是档位与语义族的**双作用域注入**与 UI 入口。现已三族同机制（1 922 + 1 540 = 3 462 处引用受益） | **数据层** | A2 + **E3 ✅** |
| R4 | 字号只 3 档、`--text-body-lg` 不跟随 | `FONT_SCALES` 只 3 键；且 preset `typography.fontSize`（`theme.presets.ts:182-193`）键名是 `xs/sm/base/lg/xl`，与 L0 实际消费的 `--text-body/-sm/-caption/-body-lg` **不同名** → store 通道产出的是无消费者的 `--text-xs..--text-4xl` | **数据层（键名错配）** | A3 |
| R5 | 字体/配色选中态永不显示 | `ThemePanel.tsx:378`、`:406` `aria-checked={false}` 硬编码 | UI 层 | C2 |
| R6 | 面板无无障碍入口 | 能力只在 `ThemeSwitcher.tsx:170-193` | 集成层 | C3 |
| R7 | 双入口分叉 | `MainLayout.tsx:466` + `SettingsPage.tsx:1460` 能力互补而非包含 | 集成层 | C3 + C5 |
| R8 | 规范 §8.1 过期 | 仍登记「仅暴露浅色/深色」 | 文档 | E6 |

### 本轮新增的两个**潜在缺陷**（尚未显现，但会被本方案触发）

| ID | 隐患 | 定位 | 说明 |
|:---|:-----|:-----|:-----|
| L1 | `mergeThemeOverrides` 颜色**浅合并**清掉 `primary.main` | `theme.presets.ts:482` `{ ...base.colors, ...overrides.colors }` 在 category 层替换 | 一旦把配色改走 store 通道（基线 1），`overrides.colors.primary = {500,600,700,...}` 会整体替换 `base.colors.primary`，**连带丢掉 `main`** → `--color-primary` 无值 → `chartTheme.ts:11/48` 与 11 处 `--color-primary` 消费者失效。**A1 必须在 C1 之前完成** |
| L2 | 阴影无法参数化 | `theme.presets.ts:589-594`（T-B1 已主动停注入） | L0 的 `--shadow-*` 是模式相关（亮 alpha .06~.14 / 暗 .3~.45），而 preset `shadows` 是单一对象，无法表达双模式 → 注入会把亮色阴影写进暗色（51 处消费者）。**E5 必须先扩数据模型**，否则勿动 |

---

## 2. 五阶段执行计划

### 阶段 A · 数据模型与解析层（P0 · 1.0 人日 · **无 UI 可见变化**）

| 序 | 任务 | 规格 | 验证 |
|:--:|:-----|:-----|:-----|
| A1 | `mergeThemeOverrides` 颜色改**两级深合并** | `theme.presets.ts:482` → `{ ...base.colors, ...overrides.colors }` 替换为 `Object.fromEntries(Object.entries({...base.colors, ...overrides.colors}).map(([k,v]) => [k, {...base.colors[k], ...v}]))` | 单测：`mergeThemeOverrides(preset, {colors:{primary:{500:'#000'}}}).colors.primary.main` 仍等于预设主色（非 undefined） |
| A2 | 确认色阶 fallback 通路 + 补 secondary/accent 映射决策 | `generateCSSVariables:559` 的 `vars[l0 ?? --color-${category}-${kebabKey}]` 对 `primary-500` 已产出 `--color-primary-500`；**需实测** `isSafeToken`/`SAFE_TOKEN_NAME` 是否放行含数字的 kebab 名 | 单测断言 `generateCSSVariables({colors:{primary:{500:'#000'}}}).keys` 含 `--color-primary-500` 且未被 `:723` 拒绝 |
| A3 | `typography.fontSize` 键名对齐 L0 | `theme.presets.ts:182` 增补 `body:'0.9375rem'`、`bodySm:'0.875rem'`、`caption:'0.75rem'`、`bodyLg:'1rem'`（保留 xs/sm/base/lg 兼容），使 `:569` 产出 `--text-body/-sm/-caption/-body-lg` | 单测断言生成结果含 `--text-body`；全仓 `var(--text-body)` 199 处消费者可被覆盖 |
| A4 | `APPLE_HIG_PALETTES` 扩为**每模式完整 10 档** | `theme-palette.ts` 每方案增加 `lightScale` / `darkScale`（`100..950` 十值），按 Apple HIG 明暗反转规则生成；**必须满足档位内亮度单调**（亮色 100→950 递减，暗色 100→950 递增） | 单测：对 5 个方案 × 2 模式各做一次亮度单调断言；GATE-16 |
| A5 | `FONT_SCALES` 扩为全 L0 排版档 | 键改为 `{ body, bodySm, caption, bodyLg, displayLg }`，与 A3 的 preset 键名一致 | 单测键集合与 A3 一致 |
| **验收** | A 阶段完成后 `theme:gate` 保持 **12 pass / 0 fail**；新增 3 组单测；**UI 零变化**（纯数据/解析层） |

### 阶段 B · 持久化修复（P0 · 0.5 人日 · **R1 根治**）

| 序 | 任务 | 规格 | 验证 |
|:--:|:-----|:-----|:-----|
| B1 | `initialize()` 回查 customThemes | `themeStore.ts:143` 后插入：查表未命中时 `state.customThemes.find(t => t.id === resolvedThemeId)`，命中即以之为 `baseTheme`（`system` 态仍按 `effectiveMode` 选明暗预设再合并覆盖）；仅两者都无才回退默认 | 单测 3 条：`activeThemeId=custom-*` 冷启动 → ①`activeTheme.colors.primary` 等于 custom 值 ②`html.dark` 按 `mode` ③**不再打「无效的主题ID」warn** |
| B2 | 面板状态纳入 store | 新增 `fontScale: 'compact'|'standard'|'relaxed'` 与 `paletteKey: string` 到 state，`partialize`（`:496`）一并持久化 | 单测断言持久化对象含两键 |
| B3 | 确认注入路径不被跳过 | `isCleanBuiltinPreset`（`theme.presets.ts:663`）对 custom 主题返回 false → `:715` 走 `generateCSSVariables` 注入 | 已有逻辑，加断言锁定 |
| **验收** | 探针 `settings-theme-probe2.cjs` 的 `afterReload`：`primary500` 保持所选配色、`--text-body` 保持所选字号、`html.dark` 与 `mode` 一致。**这是本方案唯一的一票否决验收项** |

### 阶段 C · 面板重构（P1 · 2.0 人日 · R2/R5/R6/R7）

| 序 | 任务 | 规格 | 验证 |
|:--:|:-----|:-----|:-----|
| C1 | **删除** `applyBrandScale` / `applyFontScale` 直写 | `ThemePanel.tsx:119-149`、`:151-164` 改为构造 `CustomThemeOverrides`（`colors:{primary:{100..950}}` + `typography:{fontSize:{body,...}}`）→ 单次 `applyCustomTheme(overrides)`。依赖 **A1 先行**（否则 L1 触发） | 全仓 grep `setProperty('--`：仅 `theme.presets.ts` 允许命中 |
| C2 | 选中态从 store 派生 | `:378`、`:406` 的 `aria-checked={false}` 改为 `paletteKey === p.key` / `fontScale === k`（对照 `:213` 的 `mode === m` 正例） | 探针 `fontAriaChecked` / `paletteAriaChecked` 恰有 1 个 `true`；GATE-18 |
| C3 | 迁入无障碍四态 | 将 `ThemeSwitcher.tsx:170-193` 区块移入 `ThemePanel`（复用 `setAccessibilityMode` + `semantic-utils.css:330/382` 既有语义层） | 探针 `a11yModeInPanel=true`；GATE-07 仍通过 |
| C4 | 「重置默认」对齐清理 | 面板重置按钮改调 `resetToDefault()`（`themeStore.ts:431`）而非仅 `removeProperty`；并 `deleteCustomThemes`（`:417`）清掉 `custom-*` 残留 | 重置后 `localStorage` 中 `customThemes=[]`、`activeThemeId='light-default'` |
| C5 | Switcher 退化为纯快捷切换 | `MainLayout.tsx:466` 保留图标切换，移除其内部完整的无障碍区块（能力已迁至 C3） | grep 确认 `setAccessibilityMode` 调用点唯一 |
| **验收** | 配色覆盖率从 63.2% → **100%**（3 108/3 108）；探针全项通过；GATE-04/05/06/11/13 不回退 |

### 阶段 D · 门禁与探针加固（P1 · 1.0 人日）

| 序 | 门禁 | 断言 | 失败语义 |
|:--:|:-----|:-----|:---------|
| D1 | **GATE-15** 冷启动回放 | 应用配色+字号 → reload → 断言 `--color-primary-500` 与 `--text-body` 仍等于所选值 | 防 R1 回归（**本次最高价值门禁**） |
| D2 | **GATE-16** 色阶单调性 | 注入后同模式内 `--color-primary-100..950` 亮度必须单调（亮色递减 / 暗色递增，容差 0.02） | 防「断裂梯度」与 D-50 类崩塌 |
| D3 | **GATE-17** UI 层禁写变量 | 扫 `src/**/*.{ts,tsx}` 的 `setProperty('--`，白名单仅 `theme.presets.ts` | 防基线 1 被再次绕过 |
| D4 | **GATE-18** 选中态可派生 | 扫 `src/**/*.tsx` 的 `aria-checked=\{false\}` 字面量 = 0 | 防 R5 回归（U-6） |
| D5 | **修探针正确性** | `effectiveBg()` 补 alpha 合成：遇 `rgba(...,a<1)` 时递归到父背景并按 `a` 合成 | 本轮探针误报 19 处 2.03:1 已证实该缺陷；`ai-audit-settled.cjs` 等同源探针一并修 |

### 阶段 E · 能力补齐（P2 · 3-5 人日 · **需产品决策后启动**）

| 序 | 能力 | 现状 | 依赖 |
|:--:|:-----|:-----|:-----|
| **E1** | **导出 / 导入** | **已完成**。修正了原「面板未接线」判断：`ThemeImport.tsx` 早已存在但**零消费者**（孤儿组件），且其 label 包裹 `aria-hidden` + `tabIndex={-1}` 的 file input，键盘用户无法触发。已重构为 `<button>` 触发 + 隐藏 input，接入面板 ⑪ 区块。另修 `exportTheme`：旧版只导 `theme`（base × 覆盖的合并结果），丢掉解析不了的 `modeRamps` 与选中态，导入后配色按钮失高亮、色阶退回品牌绿；v2 快照改导 `runtimeOverrides` + `paletteKey` / `fontScale` / `radiusScale` + `settings`。导入侧接受三种形态（v2 / 嵌套 `{colors}` / 扁平 `{primary,...}`），扁平形态经规范化（D-36 回归锁定） | 无 |
| **E2** | **圆角 / 间距** | **圆角已完成，间距明确不做**（见下 D-65）。`mergeThemeOverrides`（`theme.presets.ts:528-534`）与 `mergeCustomOverrides`（`themeStore.ts:115-123`）对 `spacing` / `borderRadius` 本就是同维度浅合并，而两者都是**扁平 map**（`key → 值`），浅合并即已足够 —— 原方案记的「深合并同类隐患」不成立。已落：`radiusScale` 状态链（types → store initialState → `partialize` → `migrate` 兜底 → panel ⑩ 区块），持久化版本号 v5→v6 | A1 依赖不成立（无隐患可依赖） |
| **E3** | **次色 / 强调色** | **已完成**（2026-10-12）。原判断「需先补 `COLOR_MAIN_TO_L0` 的 scale 映射」**不成立**：`secondary-main` / `tertiary-main` → `--color-secondary` / `--color-accent` 的映射在 T-B2a 早已存在（`:577-581`），缺的是**档位与语义族的双作用域注入**。已落：① `ModeRamps` 扩为 `primary/secondary/accent` 三族 × 明暗 6 键；② `theme-palette.ts` 新增 `SECONDARY_PALETTES`（5）/ `ACCENT_PALETTES`（5）与 L0 权威默认阶（逐档照抄，保证「选默认 = 无变化」）；③ `generateModeRampCSS` 按族独立产出 `:root` / `.dark` 块，语义族经 `FAMILY_TIER_RULES` 推导（次色/强调色暗色 main/rgb 取 600、`-surface-deep` 取代 `-surface-hover`，逐条对齐 `base.css` / `dark.css`）；④ `generateCSSVariables` 的让位从「有 `modeRamps` 就让位」收窄为**按族判定**，避免选次色时主色/强调色被牵连；⑤ `secondaryPaletteKey` / `accentPaletteKey` 选中态状态链，持久化 v6→v7（`migrate` 兜底 + 未知族键清理）；⑥ 面板 ⑧b / ⑧c 两区块。测试锁定「用 L0 默认阶喂注入器，推导出的语义族必须与 `base.css` / `dark.css` 逐条一致」（12 项断言全等）。实测 35/35 通过 | A2 依赖不成立（映射早已存在） |
| **E4** | **预设管理** | **通道分裂已收口**（2026-10-12）：`store.importTheme` 原先并行一条通道（写 `imported-${Date.now()}` + 追加 `customThemes`），与组件导入分裂。已抽出纯层 `normalizeThemeImport.ts`，store 与组件共用 `normalizeImportedConfig` → `applyCustomTheme` 单通道（D-36 回归锁定 +4 测试）。**残余未做**：`customThemes` 的命名 / 列表 / 删除 UI（`deleteCustomTheme:417` 存在但未暴露）—— 属产品交互设计，非通道缺陷，需产品决策 | B2 部分（通道已收口，UI 待决策） |
| E5 | 阴影 | **暂缓**：需先扩展数据模型支持双模式阴影（L2），否则会把亮色阴影注入暗色（51 处消费者） | T-B2b 数据模型重构 |
| E6 | 规范同步 | 更新 §8.1 现状盘点、§8.2 增补 **U-8**（面板控件状态必须可派生选中态且跨刷新持久）、关闭 §12 阶段 3 序 26 | C3/C5 完成 |

**D-65 决策：不暴露「间距」控件**（2026-10-12 实测）
`--space-*` **未登记进 `index.css` 的 `@theme`**，Tailwind 的 `p-*` / `m-*` / `gap-*`
工具类不解析到它；全项目仅 24 处显式 `var(--space-*)`，且集中在登录页与侧栏边距。
加控件会出现「点了几乎看不到变化」的误导性设置。
对照：`--radius-*` 已在 `index.css:185-191` 登记，`rounded-*` 工具类共 4 196 处消费
（`lg` 1 959 / `full` 968 / `xl` 817 / `md` 307 / `2xl` 115 / `sm` 30，`xs` 0），
是真杠杆，故只做圆角。若日后要让间距可配，须先把 `--space-*` 登记进 `@theme`
并迁移既有 `p-*` / `m-*` 用法，属另一个量级的工作。

---

## 3. 验收矩阵（一票否决项加粗）

| 维度 | 验收方式 | 通过标准 |
|:-----|:---------|:---------|
| **持久性** | **`settings-theme-probe2.cjs` `afterReload`** | **配色 / 字号 / 明暗三者刷新后全部保持** |
| 覆盖率 | `temp/theme-panel-coverage.mjs` | 主色档 10/10 注入，3 108/3 108 处跟随 |
| 梯度完整性 | GATE-16 | 5 方案 × 2 模式亮度单调，0 断裂 |
| 选中态 | 探针 `*AriaChecked` | 每组恰 1 个 `true` |
| 无障碍 | 探针 `a11yModeInPanel` + GATE-07 | 四态可达且刷新后保留 |
| 对比度 | `settings-contrast-probe.cjs`（**alpha 合成修正后**） | 面板双态 0 处不达标 |
| 不回退 | `theme:gate`（14 项）+ `vitest`（29）+ 探针 /ai 页 | 12 pass / 0 fail；29/29；亮 0 暗 0 |
| 无 UI 层旁路 | GATE-17 | `setProperty('--` 仅 `theme.presets.ts` 命中 |

---

## 4. 回滚策略

| 阶段 | 回滚手段 | 影响面 |
|:-----|:---------|:-------|
| A | 单提交，直接 `revert`；数据层无 UI 可见变化 | 0 用户可见 |
| B | 单提交 `revert`；已持久化的 `custom-*` id 由 `migrate` 的防御分支兜底回退默认 | 用户回到修复前行为（不会白屏） |
| C | 拆分为 C1-C5 五个提交，可独立回滚；C1 回滚即恢复旧 hack（覆盖率退回 63.2%） | 仅设置面板 |
| D | 门禁为纯新增断言，`npm run theme:gate` 可加 `--skip GATE-15..18` 临时降级（**不建议长期**） | 0 |

**关键**：A/B/C 每阶段独立提交，**禁止合并提交**——B1 是单点故障修复，必须可单独验证与单独回滚。

---

## 5. 风险与跨会话边界

| 风险 | 等级 | 缓解 |
|:-----|:-----|:-----|
| **L1 浅合并清 `primary.main`** → 图表与 11 处 `--color-primary` 消费者失效 | **高** | A1 必须先于 C1；A2 单测锁定 `colors.primary.main` 存活 |
| 暗色反转色阶被局部覆盖 → D-50 类对比度崩塌 | **高** | A4 强制整档替换 + GATE-16 单调性断言 |
| `isSafeToken` 拒绝含数字的 `--color-primary-500` | 中 | A2 第一步即实测；若被拒，改 `SAFE_TOKEN_NAME` 白名单而非改名 |
| `applyCustomTheme` 每次点击生成新 id → `customThemes` 数组膨胀（本轮实测一次会话已累积 2 条） | 中 | B2 顺带改为**同 scale/key 覆盖同一条**而非追加 |
| 并行会话 WIP 冲突 | 中 | 改动集中在 `themeStore.ts` / `theme.presets.ts` / `theme-palette.ts` / `ThemePanel.tsx` 4 文件，与当前 14 个 WIP 文件（experiment/organizations/user 域）**零重叠** |
| 探针 alpha 缺陷导致误判 | 中 | D5 先修探针再跑对比度验收（本轮已因此撤回一条错误结论） |

---

## 6. 产品决策待定项（阻塞 E 阶段）

| 决策 | 选项 | 建议 |
|:-----|:-----|:-----|
| **D-60 配色范围** | ① 只管品牌主色 ② 主色+次色+强调色三族 | ②，否则「系统性控制」名不副实；但需 3× 数据量 |
| **D-61 预设策略** | ① 保持 2 个内置预设 + 运行时覆盖 ② 开放多预设 | ①（§8.2 明确「不引入第三套主题」） |
| **D-62 字号形态** | ① 3 档按钮 ② 连续滑块 | ① 先交付（阶段 A/C），② 进 E 阶段 |
| **D-63 阴影控件** | ① 暂缓 ② 随 E5 做 | ①，需先解 L2 |
| **D-64 Switcher 去留** | ① 保留为快捷切换（去无障碍区块）② 完全移除 | ①，头部快捷切换有真实使用价值，与 U-1 不冲突（U-1 禁的是「平行**设置**入口」） |
| **D-65 间距控件**（2026-10-12 已决） | ① 不做 ② 做 3 档 | **① 不做**。`--space-*` 未在 `@theme` 登记，Tailwind 间距工具类不解析到它；全项目仅 24 处显式 `var(--space-*)`，加控件属误导性设置 |

---

## 7. 工作量汇总

| 阶段 | 内容 | 人日 | 可否立即启动 |
|:-----|:-----|:---:|:---:|
| A | 数据模型与解析层 | 1.0 | ✅ 无依赖 |
| B | 持久化修复 | 0.5 | ✅ 仅依赖 A1 |
| C | 面板重构 | 2.0 | ⏳ 依赖 A1 |
| D | 门禁与探针 | 1.0 | ⏳ 依赖 B/C |
| E | 能力补齐 | 3–5 | ⛔ 需 D-60/61/64 决策 |
| **合计** | | **7.5–9.5** | **A+B+C+D = 4.5 人日可无决策立即执行** |

**建议执行顺序**：A → B → C → D（共 4.5 人日，全部无需产品决策，且能关闭 3 个 P0 + 2 个 P1 + 规范漂移）。
E 阶段待 D-60/61/64 决策后另起批次。

**实际进度（2026-10-12）**：A / B / C / D 四阶段已全部落地并提交。
E 阶段中 **E1（导出/导入）、E2（圆角）、E3（次色/强调色）已完成**，
**E4 的通道分裂已收口**（残余为 `customThemes` 的命名/列表/删除 UI，需产品决策）。
四者均无需产品决策，原表格的「需 D-60/61/64 决策」仅适用于 E5（阴影）。
**D-65（间距控件）已决为「不做」**，理由见阶段 E 表下。

E3 交付要点与实测证据：
- 三族（`primary` / `secondary` / `accent`）共用同一套「运行时 `<style>` 双作用域」机制，
  且**按族独立判定**：只选次色不会牵连主色与强调色。
- 次色 / 强调色的 L0 锚点在两种模式下相同（`base.css:46` / `dark.css:42` 同为 `#3b82f6`），
  一份锚点即可派生两组作用域，明暗差异由档位反转承载 —— 与主色维护 light/dark 双锚点不同。
- 内外名不一致：强调色的对外族名是 `accent`，`ThemeConfig` 内部角色名是 `tertiary`
  （`COLOR_MAIN_TO_L0` 的 `'tertiary-main'` → `--color-accent`），故 `colors` 写 `tertiary`、
  `modeRamps` 写 `accent`。
- **默认零漂移已验证**：用 L0 权威默认阶喂入注入器，推导出的 12 个语义族令牌与
  `base.css` / `dark.css` 逐条相等（测试 `E3 generateModeRampCSS — 次色族 / 强调色族`）。
  连带修掉 `base.css:23` 一处过期注释（注释称 `--color-primary-text` = `#047857`，
  实际 `var(--color-success-600)` = `#059669` = `ramp['600']`，与推导值一致，无漂移）。
- 验证：5 套件 **130/130**、`theme:validate` **0 error**、
  `theme:gate` **16 通过 / 0 失败**、实测探针 **35/35**。
