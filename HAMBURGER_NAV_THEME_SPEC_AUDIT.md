# 前端汉堡导航栏（MainLayout v11.0）主题规格复核实证报告

- 复核角色：主题系统规格专家
- 复核对象：`frontend/src/components/layout/MainLayout.tsx`（汉堡导航统一版 v11.0）、`MobileBottomNav.tsx`、`ThemeSwitcher.tsx`、`NotificationCenter.tsx`、导航相关令牌/级联层
- 复核方式：**源码逐行核对 + 编译产物（`frontend/dist/assets/index-RqiQRGdk.css`，本机 2026-10-01 11:33 构建）静态取证 + Chromium 无头浏览器实测**（真实编译 CSS + 复刻真实 DOM 结构，见 `temp/nav-audit/`）
- 结论：仍存在 **4 项严重（P0）**、**6 项重要（P1）**、**5 项一般（P2）** 问题；其中 P0-2 是同文件内已宣布修复过的缺陷（D-50）的**未覆盖部分**。

> 实测台架与脚本（可复现）：
> - `temp/nav-audit/harness.html` — 1:1 复刻顶栏/抽屉/DOM 与类名、内联样式；样式表指向 `frontend/dist/assets/index-RqiQRGdk.css`（**证据固定于 2026-10-01 11:33 的本机构建产物**，重新构建后文件名哈希会变，需同步改 `<link>`）
> - `temp/nav-audit/probe.html` — 焦点环与工具类存在性探针
> - `temp/nav-audit/check.mjs`（对比度/命中测试）、`probe.mjs`（焦点环）、`clip.mjs`（裁剪 A/B）；运行方式：`cd D:\RMFOODFP\temp\nav-audit && node check.mjs`（脚本经 `createRequire` 复用 `frontend/node_modules` 下的 Playwright/Chromium）
> - 原始输出：`temp/nav-audit/result2.json`、`probe.json`、`clip.json`、`rerun-check.json`

---

## 一、结论速览（按严重度）

| # | 严重度 | 问题 | 证据类型 | 状态 |
|:-:|:------:|:-----|:---------|:----:|
| P0-1 | 严重 | 顶栏工具栏 `overflow-hidden` 把「通知中心」与「主题切换器」下拉面板**整体裁掉**，点击无任何可见结果 | 浏览器 A/B 命中测试 | ✅ 已修复 |
| P0-2 | 严重 | 暗色下 4 处「白前景 + 主色实底」对比度 1.28–1.92:1（含顶栏"新建配方"、抽屉头像/激活图标/徽章），D-50 修复只覆盖了 Logo 一处 | 浏览器实测色值 | ✅ 已修复 |
| P0-3 | 严重 | 抽屉**激活项文字**亮色下 2.24:1（`--color-primary` on `--color-primary-container`），AA 失败；暗色 6.96:1 通过 → 只在亮色暴露 | 浏览器实测色值 | ✅ 已修复 |
| P0-4 | 严重 | 无障碍 SkipLink 聚焦后文字 1.49:1 / 1.26:1，实质不可见；根因是**未分层 legacy CSS 压过 Tailwind 工具类** | 浏览器实测 + 级联层分析 | ✅ 已修复（局部隔离） |
| P0-5 | 严重 | **项目无法构建**：HEAD `447e4f0` 把 `dist-*/` 写进 index.css 注释，`*/` 提前闭合注释 → `vite build` 报 CssSyntaxError | `vite build` 实际失败 + git 溯源 | ✅ 已修复 |
| P1-5 | 重要 | 抽屉**关闭动画不可见**（`visibility` 立即置 hidden 抹掉 0.45s 退场），与文件头 v11.0 承诺不符 | 源码 + CSS 语义 | ✅ 已修复 |
| P1-6 | 重要 | 「滑动打开抽屉」是死代码：手势绑在抽屉自身，关闭态 `visibility:hidden` + 移出屏外 | 源码 | ✅ 已修复 |
| P1-7 | 重要 | 焦点归还只在 Escape 路径实现；遮罩点击/导航点击/关闭按钮三条路径焦点丢进 `aria-hidden` 容器 | 源码 | ✅ 已修复 |
| P1-8 | 重要 | **全部 `focus:ring-*` 工具类失效**（详见 §三修正）——未分层的全局 `*:focus-visible` 恒定接管焦点环 | 浏览器实测 box-shadow | ⏳ 未修复（须先做分层治理） |
| P1-9 | 重要 | `z-dropdown` 不存在（computed `z-index: auto`）；导航 z 值全部硬编码、与 `--z-*` 令牌脱节；命令面板 `z-[60]/[70]` 低于抽屉 `z-[400]`（Ctrl+K 在抽屉打开时打开不可见面板） | 编译产物 + 浏览器 | ⏳ 未修复 |
| P1-10 | 重要 | 安全区与固定高度互斥：border-box 下 header `56px + padding-top:env(...)` 会把内容盒压到 ~9px；且全项目无 `viewport-fit=cover`，安全区平时恒为 0（死代码），一旦生效即破版 | 源码 + 令牌 | ⏳ 未修复 |
| P2-11 | 一般 | 抽屉内"关闭菜单"与汉堡按钮（打开态）**同名** | 源码 | ✅ 已修复（改名"关闭导航菜单"） |
| P2-12 | 一般 | MobileBottomNav「更多」面板：遮罩 `tabIndex={0}` + `aria-hidden="true"`（反模式）、无 focus trap、无焦点归还；两处 `body.style.overflow` 滚动锁互相清空 | 源码 | ⏳ 未修复 |
| P2-13 | 一般 | `MOBILE_BOTTOM_NAV_ITEMS` 无人引用，MobileBottomNav 用 7 条硬编码路由白名单重建列表，"单一数据源"不成立 | 源码检索 | ⏳ 未修复 |
| P2-14 | 一般 | `max-[900px]:hidden` 魔法断点，与 `useMobile.ts` 的 768/1200 断点体系无关；溢出靠 `overflow-hidden` 静默裁掉 | 源码 | ⏳ 未修复（裁切已解除） |
| P2-15 | 一般 | ThemeSwitcher 内 `bg-primary-main/10`、`ring-primary-main/30`、`focus:border-primary-main`、`animate-in fade-in slide-in-from-top-2` 编译产物均不存在（v3 语法残留） | 编译产物计数 | ⏳ 未修复 |
| P2-16 | 一般 | 移动端底部导航徽章 `text-white` on `--color-error`：暗色下 `#f87171` 白字约 2.8:1（`NotificationCenter.tsx:240` 同款） | 令牌推算 | ⏳ 未修复 |
| TOOL-1 | 严重 | `pnpm test` 无法运行：`vitest@3.2.6` 与 `vite@8.1.3` 不兼容（vitest 3 依赖 `vite/index.js`，vite 8 已移除） | 实际执行报错 + 版本比对 | ⏳ 未修复 |

---

## 二、P0 详细取证

### P0-1 顶栏 `overflow-hidden` 裁掉两个下拉面板（通知中心 + 主题切换器）

**代码位置**
- `MainLayout.tsx:452` — `<div className="flex items-center gap-1 overflow-hidden">`（右侧工具栏容器）
- `NotificationCenter.tsx:248` — 面板 `absolute right-0 top-full mt-2 w-[420px] … z-[100]`，根节点 `className="relative"`（:228）
- `ThemeSwitcher.tsx:123-131` — 面板 `absolute right-0 mt-2 … z-dropdown`，根节点 `relative`（:67）

面板的**包含块（containing block）在 `overflow-hidden` 容器内部**，因此按 CSS 2.1 §11.1.1 被裁剪；面板自身 `getBoundingClientRect()` 仍报告完整盒子（不含裁剪），所以只看尺寸/`z-index` 会误判为正常，必须做命中测试。

**浏览器 A/B 实测**（`temp/nav-audit/clip.json`，view 1280×800）

| 状态 | 通知面板中心命中 | 主题面板中心命中 | `hitInsidePanel` |
|:-----|:-----------------|:-----------------|:----------------:|
| A 现状（toolbar `overflow: hidden`） | `#main-content` | `#main-content` | `false` / `false` |
| B 仅把 toolbar 改为 `overflow: visible` | 面板内 `DIV` | （被通知面板压住） | `true` |

即：**B 态下面板立刻可命中**，唯一变量是 `overflow`。这说明顶栏 6 个图标中「通知中心」「主题切换器」两个是**点击无效**的（状态会切换，但界面什么都不出现）；主题系统在汉堡版导航里唯一的入口因此不可达，只能绕道 `/settings` 或快捷键。

**修复方向（任一）**
1. 去掉 `overflow-hidden`，改为对低优先级按钮用响应式隐藏（`max-[900px]:hidden` 已有先例），并给工具栏加 `min-w-0` 防挤压；
2. 或把两个下拉面板改为 `createPortal` 到 `document.body`，用 `getBoundingClientRect` 定位（推荐，彻底摆脱祖先裁剪）；
3. 保留裁剪时至少要改 `overflow-x: visible; overflow-y: visible`（注意：`visible` 与 `hidden` 混用会被计算为 `auto`，不能半留半去）。

### P0-2 暗色「白前景 + 主色实底」对比度灾难（D-50 修复未覆盖全文件）

亮色/暗色令牌对（`base.css:9-35` / `dark.css:9-34`）**整体反转**：暗色下 `--color-primary-600 = #6ee7b7`、`--color-primary-700 = #a7f3d0`、`--color-primary = #34d399`（浅色），而 `text-white`/`color: 'white'` 不随主题变化。设计系统已为此提供不参与反转的 `--color-primary-surface / --color-on-primary-surface`（`dark.css:29-34` 注释即 D-50 修复），但**只有抽屉 Logo 一处采用了它**（`MainLayout.tsx:175`）。

**浏览器实测（关闭过渡后取稳定值）**

| 元素（源码位置） | 亮色 | 暗色 | 判定（正文 4.5:1 / 图形 3:1） |
|:-----------------|:----:|:----:|:------------------------------|
| 汉堡按钮图标（顶栏，`MainLayout.tsx:435`） | 10.35 | 5.27 | ✅ |
| **"新建配方"按钮图标**（`:465-469`，`text-white` + `linear-gradient(--color-primary-600, --color-primary-700)`） | 3.77 / 5.48 | **1.52 / 1.28** | ❌ 暗色几乎不可见 |
| **抽屉用户头像首字母**（`:269-272`，`text-white` + `linear-gradient(--color-primary, --color-primary-700)`） | 2.54 / 5.48 | **1.92 / 1.28** | ❌ 两种模式均不达标 |
| **抽屉激活项图标盒**（`:139-140`，`background: var(--color-primary)` + `color: white`） | 2.54 | **1.92** | ❌ 图形 3:1 失败 |
| **抽屉徽章**（`:151`，`background: var(--color-primary)` + `color: white`，11px） | 2.54 | **1.92** | ❌ 小字 4.5:1 失败 |
| 同时存在于 MobileBottomNav「更多」面板（`MobileBottomNav.tsx:272-273`） | 2.54 | 1.92 | ❌ |

**修复**：把上述 5 处换成 `background: var(--color-primary-surface)` + `color: var(--color-on-primary-surface)`（渐变改为 `linear-gradient(135deg, var(--color-primary-surface), var(--color-primary-surface-hover))`），并给"新建配方"按钮同样处理。这是机械替换，不需要新令牌。

### P0-3 抽屉激活项文字：亮色 2.24:1

`MainLayout.tsx:126-127`：激活项 `color: var(--color-primary)` + `background: var(--color-primary-container)`。

- 亮色：`#10b981` on `#d1fae5` = **2.24:1** ❌（15px medium 正文）
- 暗色：`#34d399` on `rgba(52,211,153,0.15)`（合成后 ≈ `#14332F`）= **6.96:1** ✅

即问题**只在亮色出现**——如果验收只在暗色截图，会漏掉。同源风险：`--color-primary-container` 在亮色是不透明 hex，在暗色是 15% 半透明，两者作为"激活底"的语义不一致（暗色依赖下层 surface 合成）。

**修复**：激活态文字改用 `var(--color-primary-text)`（亮 `#047857` = 5.24:1，暗 `#6ee7b7` ≈ 13:1，见 `base.css:25` / `dark.css:27`），或把亮色激活底加深（`--color-primary-container` 亮色改 `#a7f3d0` 仍不够，建议直接用 `--color-primary-text` 方案）。

### P0-4 SkipLink 聚焦后不可见：未分层 CSS 压过 Tailwind 工具类

`MainLayout.tsx:46-55`：
```jsx
className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:px-4 focus:py-2
           focus:bg-primary-600 focus:text-white focus:rounded-md"
```

**根因**：`frontend/src/styles/tokens/typography.css:177-179`
```css
a { color: var(--color-primary); }   /* 未分层（unlayered） */
```
Tailwind v4 把所有工具类放进 `@layer utilities`；CSS 级联中**未分层样式永远优先于任何 @layer 内的正常声明，与特异性无关**。因此 `focus:text-white` 虽然匹配（浏览器实测 `el.matches('.focus\\:text-white:focus') === true`），但 computed `color` 仍是 `var(--color-primary)`。

**实测结果**：背景 `focus:bg-primary-600` 生效（文字色未生效）
- 亮色：`#10b981` on `#059669` = **1.49:1** ❌
- 暗色：`#34d399` on `#6ee7b7` = **1.26:1** ❌

SkipLink 是无障碍"跳到主内容"逃生通道，聚焦即出现却读不出来，性质比配色瑕疵严重得多。

**修复**：把 `frontend/src/styles/**` 全部 legacy 规则包进 `@layer base`（或 `@layer components`），让工具类恢复可覆盖性；短期可先给 SkipLink 加内联 `style={{ color: '#fff' }}` 或 `!text-white`。**这是系统性缺陷**——所有"未分层 CSS 声明的属性"都在静默压过 Tailwind 工具类（不仅 `a { color }`，还有 `h1..h6`、`body`、各类 `.card` 等）。

---

## 三、P1 详细取证

### P1-5 抽屉关闭动画被 `visibility` 抹掉
`MainLayout.tsx:523` `visibility: drawerOpen ? 'visible' : 'hidden'`，与 `animate={{ x: drawerOpen ? 0 : -260 }}`（:526-533，spring 0.45s）在同一帧生效。打开：`visibility` 立即 visible → 滑入动画可见；关闭：`visibility` 立即 hidden → 元素当帧不再绘制，**0.45s 退场不可见**，而遮罩仍有 0.2s 淡出（:502）。开合不对称，与文件头 v11.0 承诺的"可中途反向、从当前呈现值起步"不符。
**修复**：用 `onAnimationComplete` 或 `animate={{ x, transitionEnd: { visibility: 'hidden' } }}`，或改用 `opacity/scale` 配合 `pointer-events`，而不要用 `visibility` 硬切。

### P1-6 「滑动打开抽屉」是死代码
`MainLayout.tsx:400-404` + `:514`：`swipeHandlers` 被展开到**抽屉自身**。抽屉关闭时 `translateX(-260px)` 且 `visibility: hidden`，既不接收指针事件也不接收 touch 事件 → `onSwipeRight: () => { if (!drawerOpen) setDrawerOpen(true) }` 永远不会触发（真正有效的只有打开态的 `onSwipeLeft` 关闭）。移动端"右滑唤起抽屉"的宣称能力不存在。
**修复**：把 swipe 处理器挂到根容器/`<main>` 上。

### P1-7 焦点归还只覆盖 Escape 路径
`MainLayout.tsx:333-342` 仅 Escape 会 `hamburgerRef.current?.focus()`。其余三条关闭路径（遮罩点击 `:503`、导航项点击 `:121`、抽屉顶部 X `:188`）只 `setDrawerOpen(false)`：抽屉随即 `aria-hidden="true"` + `inert`（:537-538），焦点停留在被隐藏容器内 → 焦点丢失到 `<body>`，键盘/读屏用户失去位置（WCAG 2.4.3）。
**修复**：统一在 `closeDrawer` 里做 `setDrawerOpen(false)` + `requestAnimationFrame(() => hamburgerRef.current?.focus())`（导航项点击除外，应把焦点交给新页面标题）。

### P1-8 【判读修正】全部 `focus:ring-*` 工具类失效（不止 `ring-primary`）

初判为"`ring-primary`/`ring-error` 类名不存在、退化为 `currentcolor`"。经阳性对照探针（`probe.html` + `probe.mjs`）复核，**真实结论更严重**：

`frontend/src/styles/utilities/focus-scroll.css:7` 的
```css
*:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--color-primary, #10B981); }
```
是**未分层**规则，而 Tailwind 的 `focus:ring-*` 位于 `@layer utilities` → 未分层恒定胜出。

**实测（`focus:ring-*` 的最终 box-shadow）**

| 元素 / 类名 | `--tw-ring-color` 计算值 | 实际生效的 `box-shadow` |
|:-----|:-----|:-----|
| `focus:ring-2 focus:ring-blue-500`（阳性对照，蓝环） | `oklch(62.3% .214 259.815)` | `rgb(16,185,129) 0 0 0 3px` ← **主色，非蓝色** |
| `focus:ring-2 focus:ring-primary-500`（顶栏按钮） | `#10b981` | 同上，3px 主色环 |
| `focus:ring-2 focus:ring-primary`（抽屉 4 处） | 空 | 同上 |
| `focus:ring-2 focus:ring-error`（退出登录） | 空 | 同上（**不是红色**） |

结论：**所有** `focus:ring-*` / `focus:ring-offset-*` 布局与语义均被这条全局规则接管，焦点环永远是"3px 主色实心环"。因此**改调用点（换成 `ring-primary-500`）完全无效**——这也是本轮未按其初判动手的原因。焦点可见性本身没问题（3px 主色环清晰可见），损失的是：error 语义、抽屉导航项 `ring-2 + ring-offset-2` 的设计意图、以及"全局默认环可被组件覆盖"的可组合性。

**修复**：与 P0-4 同源，必须做**分层治理**——把 `focus-scroll.css` 的 `*:focus-visible` 等 legacy 规则移入 `@layer base`，让工具类恢复覆盖能力。此项影响面覆盖全项目所有焦点态，需专门一轮 + 全站视觉回归，故本轮未纳入。

**同一根因还产生两个必须知道的连带结论**
1. `@theme` 里**不能**顺手补 `--color-primary: var(--color-primary)` 桥接：实测编译产物中 bare `bg-primary` / `ring-primary` / `border-primary` / `from-primary` / `to-primary` 规则数均为 **0**，而源码里有 **44 个文件**在用 `bg-primary`、**122 个文件**在用 `text-primary`（后者靠手写 `.text-primary{color:var(--text-primary)}` 兜底）。一旦补上桥接，44 个文件的 `bg-primary` 会**同时**从"无背景"变成"绿底"，是不受控的大范围视觉变更。要做必须先做影响面分析。
2. `icons-selection.css:83` 另有一份未分层 `.sr-only`，同样压过 Tailwind 的 `focus:not-sr-only`；`icons-selection.css:65` 的 `.skip-link` 也是未分层（`z-index:100` + `background: var(--color-primary)`）——加入 `skip-link` 类会被顶栏 `z-[100]` 同层反超。这正是 P0-4 最终改为**自包含专用类**而非复用 `.skip-link` 的原因。

### P1-9 `z-dropdown` 不存在 + z 值硬编码脱节
- `ThemeSwitcher.tsx:128` `z-dropdown` → 编译产物 0 条规则，浏览器 computed `z-index: auto`（实测）。（因 P0-1 已把面板裁掉，该项当前被掩盖，修 P0-1 后会立刻显现：面板 `z-index:auto` 会被同层 `z-[100]` 的通知面板压住——A/B 实验 B 态已复现。）
- 导航层全部硬编码：header `z-[100]`、底部导航 `z-[150]`、遮罩 `z-[350]`、抽屉 `z-[400]`、"更多"面板 `z-[450]`、命令面板 `z-[60]/[70]`、通知面板 `z-[100]`；而令牌层定义 `--z-overlay: 300 / --z-sidebar: 301 / --z-header: 100 / --z-modal-backdrop: 1000 / --z-toast: 1200 / --z-tooltip: 1300`（`base.css:310-315`）。文件头宣称的"z-index 体系统一"只统一了导航内部，**未与设计令牌对齐**。
- **实测可达的层级倒挂**：命令面板根层 `z-[60]`（遮罩）/`z-[70]`（对话框）（`CommandPalette.tsx:261/269`）**低于**抽屉遮罩 `z-[350]` 与抽屉 `z-[400]`，而 `CommandPalette.tsx:106-108` 会在**全局**监听 `⌘/Ctrl+K`。因此抽屉打开时按 Ctrl+K 会打开一个被完全压住的、不可见也不可用的命令面板；同理，顶栏 `z-[100]` 高于命令面板 `z-[60]`，命令面板打开时顶栏既不被遮罩覆盖也仍可点击。这两条不是"命名不统一"，而是可复现的层级缺陷。

### P1-10 安全区与固定高度互斥 + 全项目缺 `viewport-fit=cover`
- `MainLayout.tsx:417/425`：`height: var(--header-height, 56px)` + `paddingTop: var(--safe-area-inset-top, 0px)`；Tailwind preflight 全局 `box-sizing: border-box` → 内容盒高度 = 56 − safe-area。iOS 独立 PWA 下顶部安全区约 47px，内容盒只剩 ~9px，而汉堡按钮 44px`，必然溢出/压住状态栏。
- `MobileBottomNav.tsx:97/103` 同构：56 − 34（底部安全区）= 22px 要装 40px 图标 + 11px 标签。
- `frontend/index.html` 的 viewport 是 `width=device-width, initial-scale=1.0`，**全项目 grep `viewport-fit` = 0 处**（`--safe-area-inset-*: env(...)` 定义了但从未被激活）。结论：这套安全区代码平时恒为 0（死代码），一旦在 iOS 独立 PWA 下生效，顶栏与底部导航同时破版。
**修复**：`<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />` + 把 header 的 `height` 换成 `min-height: calc(var(--header-height) + var(--safe-area-inset-top))`，底部导航用 `height: auto` + `min-height: calc(...)`。

---

## 四、P2 汇总（含精确位置）

11. **同名控件与不可达控件**：抽屉 X `aria-label="关闭菜单"`（`:191`）与汉堡按钮打开态 `aria-label="关闭菜单"`（`:440`）重名；同时汉堡按钮被 `z-[350]` 遮罩（`:497`）覆盖、又被 focus trap（`:348-365`）排除，展开态的"☰→✕"无法点击/无法 Tab 到 → 视觉承诺与可交互性不一致。
12. **MobileBottomNav 面板 a11y**：遮罩 `role="button" tabIndex={0}` 与 `aria-hidden="true"` 同时存在（`:202-203`）＝可聚焦但对 AT 隐藏；面板无 focus trap、无焦点归还（`:197-220`）；`document.body.style.overflow` 由 `MainLayout.tsx:371-397` 与 `MobileBottomNav.tsx:81-88` 各自独立加锁/解锁，后者的 cleanup 会把前者的锁一并清空（两套滚动锁无仲裁）。
13. **单一数据源失效**：`navConfig.ts:111` 导出的 `MOBILE_BOTTOM_NAV_ITEMS` 全项目无引用（检索仅命中定义处），`MobileBottomNav.tsx:52-55` 用 7 条硬编码路由白名单重建列表；`VISIBLE_COUNT=4` 决定了可见项，但顺序依赖 `NAV_GROUPS` 的书写顺序（改 `navConfig` 顺序会静默改变底部导航构成）。
14. **魔法断点**：`MainLayout.tsx:481` `max-[900px]:hidden` 与 `useMobile.ts` 的 768/1200 断点无关联；工具栏靠 `overflow-hidden` 掩盖溢出（见 P0-1），窄屏会静默裁掉最右侧按钮而不是换行。
15. **v3 语法残留**（编译产物计数为 0）：`ThemeSwitcher.tsx:128` `z-dropdown`、`:129` `animate-in fade-in slide-in-from-top-2`、`:155/185/214/239` `bg-primary-main/10`、`:81` `focus:ring-primary-main/30`、`:76` `focus:border-primary-main`（仅 `.text-primary-main` / `.border-primary-main` 两个未分层类存在）。表现为选中态无底色、面板无入场动画。

---

## 五、通过项（本轮确认无问题，避免重复返工）

- 汉堡按钮图标对比度：亮 10.35:1 / 暗 5.27:1 ✅
- 抽屉分组标题、非激活项文字：亮 8.6:1 / 暗 7.3:1 ✅
- `--header-bg`、`--bg-surface*`、`--color-primary-container`、`--text-caption/body/overline`、`--radius-*`、`--shadow-*` 均已在亮暗两套令牌中定义并正确解析（未发现缺失令牌导致的透明背景）
- `@theme` 中的自引用桥接（`--color-primary-50: var(--color-primary-50)`）**不会**产生循环失效：Tailwind 生成在 `@layer theme` 内，被无分层的 `base.css :root` 声明覆盖（D-51 的 `blue-*` 问题正是因为当时 base/dark 从未定义该族，本次抽查 primary/secondary/accent/success/warning/danger/neutral/info 均有实体定义）
- `--bg-surface-hover` → `--hover-bg` 链路完整（亮 `rgba(0,0,0,0.04)` / 暗 `rgba(255,255,255,0.04)`），抽屉 hover 反馈存在（仅偏弱）
- React 19.2 下 `inert={true}` 布尔用法正确；`aria-controls` 指向的 `#main-drawer` 存在

---

## 六、建议修复顺序（最小改动、最大收益）

1. **P0-1**：先解决顶栏裁剪（去掉 `overflow-hidden` 或改 portal）——这是唯一"功能完全不可用"的问题。
2. **P0-2 + P0-3**：5 处白前景实底换 `--color-primary-surface / --color-on-primary-surface`；激活文字换 `--color-primary-text`。
3. **P0-4**：legacy CSS 分层（`@layer base`），并同步复测所有依赖工具类覆盖的地方（影响面最大的单点修复）。
4. **P1-8 + P1-9**：`@theme` 补 `--color-primary` / `--color-error` 桥接；`z-dropdown` 改为 `z-[500]` 或用令牌。
5. **P1-5/6/7**：抽屉动效与焦点管理一并重构（`visibility` → `pointer-events` + `opacity`；swipe 挂到根；`closeDrawer` 统一归还焦点）。
6. **P1-10**：补 `viewport-fit=cover` 并把 header/底部导航高度改为 `min-height` 形态（二者必须同时做，否则从死代码变成破版）。

> 回归验收建议：以上每一项都应在**亮色 + 暗色**双模式下各截一次图/跑一次对比度断言；本轮 P0-3 正是"只在亮色暴露"、P0-2 是"只在暗色暴露"，单一模式验收必然漏检。

---

# 第二轮：修复实施与回归验证（2026-10-01 13:0x）

## 七、已实施改动（4 个文件 / 107 增 42 删）

| 改动 | 文件 | 内容 |
|:--|:--|:--|
| D-58（P0-1） | `MainLayout.tsx:476-480` | 工具栏 `flex items-center gap-1 overflow-hidden` → `flex items-center justify-end gap-1 shrink-0`，解除对绝对定位浮层的裁剪 |
| D-59（P0-2） | `MainLayout.tsx:142-157 / 158-165 / 271-285 / 491-495`、`MobileBottomNav.tsx:262-278` | 5 处「白前景 + 主色实底」改用不随主题反转的 `--color-primary-surface` / `--color-on-primary-surface`（渐变改为 `-surface` → `-surface-hover`） |
| D-59（P0-3） | `MainLayout.tsx:130`、`MobileBottomNav.tsx:149 / 265` | 激活项文字 `--color-primary` → `--color-primary-text`（亮 `#047857` 5.24:1 / 暗 `#6ee7b7` ≈13:1） |
| D-57（P0-4） | `MainLayout.tsx:45-58`、`focus-scroll.css:36-64` | SkipLink 改为自包含未分层类 `.nav-skip-link`（`top:-100%` → `:focus{top:0}`，`z-index:200`，配色用 surface 令牌对），不再依赖任何分层工具类 |
| D-62（P1-5） | `MainLayout.tsx:537-566` | 抽屉 `visibility` 由 state 直绑改为 `animate={{x:0,visibility:'visible'}}` / `{x:-260,transitionEnd:{visibility:'hidden'}}`，退场动画恢复可见 |
| D-61（P1-6） | `MainLayout.tsx:416-431 / 541` | `swipeHandlers` 从抽屉移到根容器，右滑唤起抽屉不再是死代码 |
| D-60（P1-7） | `MainLayout.tsx:342-359 / 529 / 571`、props 契约 | `closeDrawer` 统一为"关闭 + `requestAnimationFrame` 回焦汉堡按钮"；`setSidebarOpen(v)` 改为 `onClose()`，所有关闭路径共用 |
| P2-11 | `MainLayout.tsx:201` | 抽屉关闭按钮 `aria-label` 由"关闭菜单"改为"关闭导航菜单"，消除与汉堡按钮的重名 |
| 构建（P0-5） | `index.css:8` | 注释中 `dist-*/` → `dist-* 目录`，修复 `*/` 提前闭合注释导致的 `vite build` CssSyntaxError |

**未纳入本轮的项（及原因）**
- **P1-8 / P0-4 的系统性根因（legacy CSS 未分层）**：影响全项目焦点环与所有元素级规则，需专门一轮 + 全站视觉回归；本轮先用自包含类把 SkipLink 隔离修复。改调用点对 P1-8 无效（见 §三修正）。
- **`@theme` 补 `--color-primary` 桥接**：会使 44 个文件里当前"无背景"的 `bg-primary` 集体变绿，属不受控变更，必须先做影响面分析。
- P1-9（z 体系/命令面板倒挂）、P1-10（安全区）、P2-12/13/14/15/16：见 §一 状态列。

## 八、回归验证结果（全部为实测，非推演）

### 8.1 构建与类型
| 项 | 命令 | 结果 |
|:--|:--|:--|
| 类型检查 | `tsc -b` | ✅ exit 0 |
| 生产构建 | `vite build` | ✅ built in 7.00s（修复前为 ❌ CssSyntaxError）；13:11 并行工作流再次构建亦成功 |
| 产物 | — | 本轮构建 CSS 672,137 B（`index-CSztjYxj.css`）；13:11 并行重建为 673,067 B（`index-DdlTND8L.css`）——台架快照与门禁取后者 |
| 类型检查（最终态复跑） | `tsc -b --force` | ✅ exit 0（覆盖 `.nav-skip-link` 改名后的提交态） |

### 8.2 自建浏览器门禁（`temp/nav-audit/assert.mjs`，23 项断言，亮暗双模式）
```
PASS × 23 / FAIL × 0   （exit 0）
```
关键对比（**修复前 → 修复后**，AA 阈值 4.5:1 / 图形 3:1）：

| 元素 | 亮·前 | 亮·后 | 暗·前 | 暗·后 |
|:--|:--:|:--:|:--:|:--:|
| 顶栏"新建配方"图标 | 3.77 | **5.48** | 1.52 ❌ | **5.48** |
| 抽屉用户头像首字母 | 2.54 ❌ | **5.48** | 1.92 ❌ | **5.48** |
| 抽屉激活项图标 | 2.54 ❌ | **5.48** | 1.92 ❌ | **7.68** |
| 抽屉导航徽章 | 2.54 ❌ | **5.48** | 1.92 ❌ | **7.68** |
| 抽屉激活项文字 | 2.24 ❌ | **4.84** | 6.96 | **8.77** |
| 汉堡按钮图标 | 10.35 | 10.35 | 5.27 | 5.27 |
| SkipLink（聚焦） | 1.49 ❌ | **5.48** | 1.26 ❌ | **7.68** |
| 通知中心下拉可命中 | false ❌ | **true** | false ❌ | **true** |
| 主题切换器下拉可命中 | false ❌ | **true** | false ❌ | **true** |

门禁同时包含一条**对照断言**：`harness-before.html`（修复前快照）必须仍然复现"面板被裁切 + `overflow:hidden`"——当前 PASS，证明该门禁不会假阳性通过。

### 8.3 SkipLink 行为实测
聚焦后：`position:absolute, top:0, z-index:200, clip:auto, rect={x:12,y:0,w:130,h:38}`，命中测试落在自身（`hitInsideSelf: true`，在抽屉真实关闭态下测量）。

### 8.4 P1-5（退场动画）机制验证
`framer-motion@12.42.2` 运行时源码 `motion-dom/dist/motion-dom.js`：
```js
if (a) { // a = transitionEnd
  const e = () => o.update(() => { a && Sn(t, a); });
  d.length ? Promise.all(d).then(e) : e();   // 本 target 全部动画完成后才应用
}
```
即 `transitionEnd` 在弹簧结束**之后**才写入 `visibility:hidden` → 关闭过程可见、结束仍收尾隐藏；`initial={false}` 挂载路径（`use-visual-state.mjs`）则立即取 `transitionEnd` 值，与初始 `visibility:hidden` 一致。✅ 机制成立（**实机动画观感仍建议登录后在浏览器确认一次**）。

### 8.5 项目自带主题门禁（`pnpm theme:gate`）
```
通过 10 / 失败 1    失败项: GATE-08
✅ GATE-11 主色表面令牌对比度（含 hover）：亮 5.48 / 7.68，暗 7.68 / 5.48
✅ GATE-04 无「反转色阶 + text-white」元素（扫描 23 个白字实底 × 12 路由 × 双模式）
⚠️  GATE-09 106 个自引用冗余令牌（与 §五 判断一致：靠层叠顺序侥幸可用）
❌ GATE-08  --color-background-default / --color-text-primary 有引用无声明
```
两点必须说明：
1. **GATE-08 是既有失败**（与本轮改动无关）：`git status` 显示 `package.json`/锁文件未动，该失败正是 `index.css:7-15` 那条 TODO 记录的内容（Tailwind 自动内容探测把 `docs/`、`*.bak` 里的代码示例当真实类名），修法是 TODO 里已列的 `source(none)` + 显式 `@source`，但需验证"未丢失真实工具类"，属独立任务。
2. **GATE-04 的存在恰好解释了 P0-2/P0-3 为何长期漏检**：它扫描的是"渲染中的 23 个白字实底元素"，而抽屉默认关闭（`visibility:hidden`）、`MobileBottomNav` 仅 `<768px` 渲染，两个缺陷元素都不在扫描面内。建议把门禁扩展为"抽屉强制展开 + 移动端视口"的第二轮扫描，否则同类问题仍会复发。

### 8.6 未能执行的验证（如实记录）
- **`pnpm test` 无法运行**：`vitest@3.2.6` 与 `vite@8.1.3` 不兼容（vitest 3 依赖 `vite/index.js`，vite 8 已移除该入口），报 `ERR_MODULE_NOT_FOUND`。`package.json` 声明 `vite: ^8.0.10` / `vitest: ^3.2.4` 本身就是不兼容组合，**属预先存在的工具链损坏**，与本次改动无关（锁文件未被修改）。因此本轮没有单测结果可引用。
- **实机（登录后）验证未做**：`/` 等受保护路由需要鉴权，本轮采用"真实编译产物 CSS + 1:1 复刻 DOM"的台架替代；建议在浏览器实机确认三件事：① 关闭抽屉的滑出动画；② 顶栏主题切换器下拉在真实布局下弹出正常；③ 移动端右滑唤起抽屉是否与横向滚动区冲突（D-61 已注明可加"左边缘 24px 内才开"的约束）。

## 九、复现方式
```powershell
cd D:\RMFOODFP\frontend ; node node_modules/typescript/bin/tsc -b ; node node_modules/vite/bin/vite.js build
cd D:\RMFOODFP\temp\nav-audit ; node check.mjs ; node clip.mjs ; node assert.mjs   # assert.mjs 失败时 exit 1
```
- `harness-before.html` / `harness.html` = 修复前 / 修复后 快照，两者都指向 **`theme-snapshot.css`**（`temp/nav-audit/` 内的 CSS 固化副本，取自 2026-10-01 13:11 构建产物）。
- **不要把台架的 `<link>` 直接指向 `frontend/dist/assets/index-<hash>.css`**：本项目正在被并行工作流同时构建，`vite build` 会清空 `dist/`，哈希一变旧文件即消失，台架会静默退化成"无样式页"而给出假结果。本轮就实际踩到过一次（13:11:20 的并行构建把 `index-CSztjYxj.css` 换成 `index-DdlTND8L.css`，导致门禁一度 7 项失败）。需要复核新产物时，重新 `Copy-Item` 覆盖 `theme-snapshot.css` 并同步下面的产物指纹。
- 本报告证据固定的产物指纹：ileSize=673067 / sha256=387029009d2d8c64...（完整值可用下一行命令复算；复核时请核对，避免又拿到别人的构建）。

```powershell
(Get-FileHash D:\RMFOODFP\temp\nav-audit\theme-snapshot.css -Algorithm SHA256).Hash
```

### 回归结论
| 验证通道 | 结果 |
|:--|:--|
| `tsc -b` | ✅ 0 error |
| `vite build` | ✅ 成功（修复前失败） |
| 自建浏览器门禁 `assert.mjs`（亮/暗 × 对比度/命中/可见性/对照，共 23 项） | ✅ 23 PASS / 0 FAIL |
| A/B 裁剪对照 `clip.mjs` | ✅ 修复前 `hidden` + 面板不可命中 → 修复后 `visible` + 均可命中 |
| 项目自带 `theme:gate` | ⚠️ 10 通过 / 1 失败（GATE-08，既有问题，与本轮无关） |
| `pnpm test` | ❌ 无法运行（vitest 3 ↔ vite 8 版本不兼容，既有工具链问题） |
