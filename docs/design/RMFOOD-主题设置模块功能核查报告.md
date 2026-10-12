# /settings「主题」模块 功能核查报告（结构与进度）

- **核查时间**：2026-10-12
- **核查对象**：`http://localhost:3000/settings?tab=theme`（受保护路由，admin/admin123 实测登录）
- **实现载体**：`SettingsPage.tsx:1460-1461` → `<ThemePanel />`，挂载于 tab 表 `:1691`；组件本体 `components/theme/ThemePanel.tsx`（448 行）
- **方法**：Playwright 登录态实测（`scripts/theme-audit/settings-theme-probe2.cjs`、`settings-focus-probe.cjs`、`settings-contrast-probe.cjs`）+ 令牌消费静态扫描（`temp/theme-panel-coverage.mjs`）
- **性质**：只读核查，未改动业务代码

---

## 1. 结论摘要

**该模块已能控制「明暗模式」，但对「整个项目主题系统性控制」的目标只完成了约一半。**

明暗双模式、系统跟随、过渡动画、减少动画、快捷键——这 5 条核心链路**实测全部可用且持久化**。
但两个最具价值的控制（配色方案、字体大小）存在 **3 个 P0 缺陷**：注入覆盖率仅 63.2%、次色/强调色完全不跟随、**刷新即全丢且连带丢明暗模式**；另有选中态硬编码失效、无障碍模式缺入口。

| 控制维度 | 状态 | 实测证据 |
|:---------|:-----|:---------|
| 明暗三态（light/dark/system） | ✅ 可用且持久 | 点深色 → `html.dark=true`；`lsMode='dark'` → reload 后仍 dark |
| 跟随系统实时状态 | ✅ 可用 | matchMedia 订阅，system 态实时显示偏好 |
| 过渡动画（fade/scale/none） | ✅ 可用且持久 | initialize 会重放 `transitionType`（themeStore.ts:186-188） |
| 减少动画 | ✅ 可用 | `motionPreferences.reducedMotion` → `.reduce-motion` |
| Ctrl+Shift+T | ✅ 已绑定 | ThemePanel.tsx:50-79 真实 window keydown |
| **配色方案（Apple HIG 5 色）** | ❌ **部分生效** | 仅 500/600/700 三档注入，覆盖 1 965/3 108 处 = **63.2%** |
| **字体大小（3 档）** | ❌ **仅会话内生效** | 即时注入成功，**刷新后回退默认** |
| 无障碍模式（高对比/阅读/色盲） | ❌ **面板无入口** | 实测 `a11yModeInPanel=false` |
| 导出/导入 / 预设管理 / 自定义主题管理 | ❌ 未暴露 | store 有 API，面板未接线 |
| 圆角 / 间距 / 阴影 | ❌ 无入口 | L0 有令牌，面板无控件 |

---

## 2. 实测证据

### 2.1 渲染结构（7 区块）

```
外观模式 / 跟随系统 / 明暗切换过渡 / 减少动画 / 实时预览 / 字体大小 / 配色方案
radiogroup 数量：明暗模式 3 · 过渡动画 3 · 字体大小 3 · 配色方案 5 · switch 1
```

明暗模式选中态**正确派生**（`aria-checked = [false, true, false]`），说明 mode 这一条链路是按 §8.2 U-6 做的。

### 2.2 配色方案覆盖率（P0-1）

切「苹果蓝」于暗色模式，实测 `<html>` 上 `--color-primary-*` 计算值：

| 档位 | 计算值 | 判定 |
|:-----|:-------|:-----|
| 500 | `#0A84FF` | ✅ 已变蓝 |
| 600 | `#0066CC` | ✅ 已变蓝（hover） |
| 700 | `#00518F` | ✅ 已变蓝（按压） |
| 100 / 200 / 300 / 400 | `#064e3b` `#065f46` `#047857` `#059669` | ❌ 仍是品牌绿 |
| 800 / 900 / 950 | `#d1fae5` `#ecfdf5` `#f0fdf4` | ❌ 仍是浅薄荷绿 |

静态扫描全仓 3 108 处主色阶消费（跨 358 文件），`applyBrandScale`（ThemePanel.tsx:139-149）只写 500/600/700 → **1 143 处（36.8%）切配色后不跟随**。后果：同一页面主按钮变蓝、浅底徽章与浅档背景仍是绿色；且 800-950 三档是浅色，若被用作深色实底会与白字形成 §4.3 C-24 / D-50 类对比度崩塌（与 GATE-04/05 同源风险）。

### 2.3 次色 / 强调色不受控（P0-2）

切苹果蓝后实测：`--color-secondary-500` 仍 `#3b82f6`、`--color-accent-500` 仍 `#8b5cf6`。`applyPalette`（:151-164）只写 `colors.primary`；base.css 定义 `--color-secondary-*` 30 档、`--color-accent-*` 19 档，**一档都不注入**。

### 2.4 刷新持久性断裂（P0-3）— 已定位到行

对照组实测：

| 操作序列 | reload 后 |
|:---------|:---------|
| 仅点「深色」 | `html.dark=true`，`lsMode='dark'` ✅ **正常** |
| 点深色 → 点配色 → 点字号 | `html.dark=false`、`--color-primary-500` 回 `#10b981`、`--text-body` 回 `0.9375rem`；而 `customThemes` 数组仍有 **2 条** ❌ |

**根因链（单点故障）**：

1. `applyCustomTheme` 生成 `custom-${Date.now()}` 并写入 `activeThemeId`（`themeStore.ts:289`、`:296`）
2. `partialize` 持久化该 id（`:498`）
3. 冷启动 `initialize()` 用 `presetThemes[state.activeThemeId]` 查表（`:143`）→ `custom-*` 不在预设表 → 返回 `undefined`
4. 走防御分支 `:147` 打 `⚠️ 无效的主题ID` warn → `:148-149` 回退 `light-default`
5. `activeTheme` 被重置为亮色预设 → 明暗、配色、字号三者一并丢失

`initialize()` **从不查 `state.customThemes`**。数据层是对的（customThemes 完整持久化、`version:4` 有 migrate），失效点在冷启动解析层。修法收敛：`:143` 查表未命中时先 `state.customThemes.find(t => t.id === resolvedThemeId)`，命中即用之作为 `baseTheme`（system 态仍按 `effectiveMode` 选明暗），仅两者都无才回退默认。

---

## 3. 其余缺陷

| ID | 严重度 | 位置 | 现象 | 违反 |
|:---|:------:|:-----|:-----|:-----|
| P1-4 | 高 | `ThemePanel.tsx:378`、`:406` | 字体/配色两组的 `aria-checked={false}` **硬编码**，实测 3/3 与 5/5 全为 false；已点选任何方案后选中态永不显示，用户无法识别当前生效方案 | §8.2 **U-6**「选中态必须从 store 派生」 |
| P1-5 | 高 | `ThemePanel` 全文 | 面板不含无障碍模式/阅读模式；`setAccessibilityMode` 仅经 `ThemeSwitcher.tsx:170-193` 可达（头部 `icon-only` 弹层）。语义层能力齐备：`semantic-utils.css:330`（high-contrast）、`:382`（color-blind）、`getAccessibilityTheme`、`syncA11yAttributes`（GATE-07 已过） | 完整性缺口 |
| P2-6 | 中 | `MainLayout.tsx:466` + `SettingsPage.tsx:1460` | 双入口并存且能力互补而非包含：Switcher 有无障碍、Panel 有字体/配色 → 无单一完备入口 | §8.2 **U-1** |
| P2-7 | 中 | 规范 §8.1 | §8.1 仍登记「`renderThemePanel` 约 `:1407-1474`，仅暴露浅色/深色与 Ctrl+Shift+T」，实际已替换为 448 行 7 区块 `ThemePanel`；「唯一可达 = ThemeSwitcher」亦不再成立 | 文档漂移 |

---

## 4. 图表通道：唯一跟着配色走的非按钮通道 ✅

`chartTheme.ts` 使用 `var(--color-primary, var(--color-primary-400))`（:11、:48）、`var(--color-primary, #10b981)`（:228）——消费的是 `applyBrandScale` **确实注入**的 `--color-primary`（:148）。所以图表主通道会随配色方案变；唯一次级 fallback `--color-primary-400` 不注入，仍是绿。

---

## 5. 「系统性控制」目标下的未覆盖清单

| 维度 | L0 令牌存在？ | 面板控件 |
|:-----|:---:|:---:|
| 正文字号 | ✅ `--text-body/-sm/-caption`（199 处消费） | ⚠️ 仅 3 档按钮，无滑块；`--text-body-lg`（RadixComponents.tsx:86 消费）不注入 |
| 字族 / 字重 / 行高 | ✅ `--font-sans` 等 | ❌ 无 |
| 品牌主色 | ✅ | ⚠️ 见 P0-1/P0-2 |
| 次色 / 强调色 | ✅ 30 档 + 19 档 | ❌ 无 |
| 图表 / canvas | ✅ `chartTheme.ts` 单一通道 | ⚠️ 主通道跟随，次通道不跟随 |
| 圆角 | ✅ `--radius-*` | ❌ 无 |
| 间距 | ✅ `--space-*` | ❌ 无 |
| 阴影 | ✅ | ❌ 无 |
| 无障碍模式 | ✅ 4 态（标准/高对比/阅读/色盲） | ❌ 见 P1-5 |
| 预设管理（新增/命名/切换） | ✅ `presetThemes`（现 2 个） | ❌ 无 |
| 自定义主题列表 / 删除 | ✅ `customThemes` 可增 | ❌ 只能「重置默认」，不能命名/列表/删单条 |
| 主题导出 / 导入 | ✅ `themeStore.exportTheme` / `importTheme` | ❌ 面板未暴露（§8.2 U-5 禁止面板自建实现，应接 store API） |

---

## 6. 修复建议（按投入产出排序）

1. **P0-3 一行级修复**：`themeStore.ts:143` 查表未命中时回查 `state.customThemes`。这是唯一导致「用户以为设置了、刷新即全丢」的点，且修法收敛、可加单测（对照 `themeStore.test.ts` 现有 `initialize()` 用例族）。
2. **P0-1**：`applyBrandScale` 从 3 档扩到全 11 档（`50..950`），按 Apple HIG 明暗双值程序化生成中间档（现 `theme-palette.ts` 只有 light/dark/hover/pressed 四个值，需补派生规则）。收益：3 108 处消费一次全跟随。
3. **P0-2**：`applyPalette` 同时注入 `--color-secondary-*` 与 `--color-accent-*`（或明确产品决策「配色方案只管品牌主色」并写入 §8）。
4. **P1-4**：把 `aria-checked={false}` 改为从 store 派生（与明暗模式组同一写法，`:213` 已有正例 `mode === m`）；若 store 未记录「当前字体档/配色档」，需在 `applyCustomTheme` 旁挂一个 `fontScale`/`paletteKey` 状态并纳入 `partialize`。
5. **P1-5 + P2-6**：把 `ThemeSwitcher` 的无障碍四态区块迁入 `ThemePanel`，使 `/settings` 主题 tab 成为**唯一完备入口**，Switcher 退化为纯快捷切换（同时满足 U-1）。
6. **P2-7**：更新规范 §8.1 现状盘点（当前 7 区块 + 行数 + 挂载点），并在 §8.2 增补 U-8：*主题面板的任何控件状态必须可派生选中态且跨刷新持久*。
7. 后续批次：字体滑块连续化 + `--text-body-lg` 纳入注入表；圆角/间距/阴影控件；`exportTheme`/`importTheme` 接线；自定义主题命名与删除。

---

## 7. 一次重要的自我更正（方法论）

首版探针报出「面板 19 处文字对比度 2.03:1 不达标」，**该结论是探针缺陷、非产品缺陷，已撤回**。

- 探针 `effectiveBg()` 遇到 `surface-hover` 的**半透明覆盖层**（亮 `rgba(0,0,0,0.04)` / 暗 `rgba(255,255,255,0.04)`）时，把 4% alpha 当成不透明色参与计算，未按 WCAG 方式与下层卡片背景做 alpha 合成
- 修正后实测：亮色 `#334155` 叠合成后的浅底 ≈ **9.6:1**；深色 `#cbd5e1` / `#94a3b8` 叠合成后的深底 ≈ **6.96–16.3:1**；`主按钮示例` 的 `text-primary-main` on `bg-primary-container` 合成后 ≈ **6.85:1**——**全部达标**
- 附带风险：仓内 `ai-audit-settled.cjs` 等探针沿用同一 `effectiveBg` 写法，在半透明卡片上同样会高估不达标数；建议给对比度探针补 alpha 合成逻辑
