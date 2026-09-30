# RMFOOD 主题系统设计规范（官方）

| 项目 | 内容 |
|:-----|:-----|
| **文档编号** | RMFOOD-DS-THEME-001 |
| **标题** | RMFOOD 配方研发平台 — 主题系统设计规范 |
| **版本** | **v1.1.1** |
| **状态** | 正式发布（Normative） |
| **适用平台** | Web 前端（`frontend/`，React 19 + Vite 8 + Tailwind CSS v4） |
| **不适用范围** | 微信小程序（`miniprogram/`，另见 `docs/theme-system-spec.md`） |
| **取代** | `frontend/design-system/RMFOOD-主题系统设计规范.md`、`frontend/UI-DESIGN-SYSTEM.md`、`frontend/src/docs/DESIGN_SYSTEM.md`、`frontend/design-system/rmfood/*`、`frontend/src/docs/theme-cleanup-*.md` |
| **上游决策** | ADR-012 ~ ADR-016（主题系统演进链）、ADR-027（Radix UI / shadcn 迁移） |
| **发布日期** | 2026-10-01 |
| **验证等级** | **L3 — 真实浏览器渲染取证**（见 §1.3、§17） |
| **维护者** | 前端架构组 |

> **v1.1.0 相对 v1.0.0 的关键变化**：全部缺陷经**真实 Chromium 渲染实测**复核。其中 **2 项被推翻**（D-5 内联累加、D-39 属性不写入）、**3 项被修正量化**（D-2/D-4 变量缺失范围、§1.2 静态启发式）、**1 项全新 P0 缺陷被发现**（D-50 反转色阶配白字，实测对比度 1.52:1）。详见 §18。

---

## 0. 语言与效力

本规范中的关键词：

- **必须 / 禁止（MUST / MUST NOT）**：强制条款。违反即为缺陷，必须在合并前修复。
- **应该 / 不应该（SHOULD / SHOULD NOT）**：强烈建议。偏离需在 PR 描述中说明理由。
- **可以（MAY）**：可选。

本规范是 RMFOOD Web 前端主题系统的**唯一权威规范**。任何与本文冲突的既有文档以本文为准；任何与本文冲突的代码视为缺陷。

### 0.1 文档效力判定表

| 文档 | 判定 | 处置 |
|:-----|:-----|:-----|
| 本文 | **权威** | 维护 |
| ADR-012 ~ ADR-016 | 历史决策记录 | **保留但不作为实现依据**（多处断言与代码不符，见 §14.1） |
| ADR-027、`docs/superpowers/specs/2026-08-2{3,4}-radix-ui-*.md` | 部分有效 | 仅 Radix 桥接章节有效，见 §7.4/§7.10 |
| `frontend/design-system/RMFOOD-主题系统设计规范.md` | **已废弃** | 需加 `Deprecated` 头或删除 |
| `frontend/UI-DESIGN-SYSTEM.md` | **已废弃** | 同上 |
| `frontend/src/docs/DESIGN_SYSTEM.md` | **已废弃** | 同上 |
| `frontend/design-system/rmfood/{MASTER.md,theme.css,tokens.json}` | **已废弃** | 同上 |
| `frontend/src/docs/theme-cleanup-{guide,report}.md` | **已废弃且含危险指令** | 必须删除（其清理命令会误伤现有文件） |
| `docs/theme-system-spec.md` | 有效，但**仅限小程序** | 保留 |

---

## 1. 范围与验证基线

### 1.1 范围

本规范规定 RMFOOD Web 前端的：

1. 设计令牌（Design Token）的分层、命名、目录与清单；
2. 组件消费令牌的契约（允许/禁止的写法）；
3. 主题运行时（状态、DOM 契约、持久化、时序）；
4. 无障碍（对比度、辅助模式、动效偏好）；
5. 图表/Canvas 等程序化取色通道；
6. 治理流程（新增、变更、弃用、审计）。

### 1.2 静态基线（代码扫描）

审查日期 2026-10-01，扫描 `frontend/src`（排除 `node_modules`、`dist*`、测试、`docs`），共 1 210–1 328 个 `.ts/.tsx/.css` 文件：

| 指标 | 数值 | 说明 |
|:-----|-----:|:-----|
| CSS 变量定义（`base.css` / `dark.css`） | 311 / 295（唯一名 343 / 362） | 见 §3 |
| `var(--…)` 消费点 | 3 962 | 合规消费 |
| 硬编码 Tailwind 调色板类名 | 22 238 | `bg-slate-50` 之类 |
| 硬编码 hex 字面量 | 5 081 | `#34C759` 之类 |
| 调色板类名中带 `dark:` 变体 | 17 602（按行统计 64.7%） | — |
| 调色板类名中**无** `dark:` 变体 | 4 493（392 个文件） | ⚠️ **仅风险指标，非缺陷清单** |
| 自定义 CSS 文件 | 27（299 KB） | — |

> ⚠️ **重要修正（v1.1.0）**：「某文件 0 个 `dark:` 变体」**不等于**该文件在暗色下必然漏色。
> 实测证据（§17.5）：静态统计预测有 392 个文件受影响，而真实渲染下 `/dashboard`、`/formulas`、`/settings`、`/users`、`/ai` 五条路由的**主题惰性元素合计仅约 18 个**（每路由 1–6 个）。
> 原因是多数元素通过**中性色阶反转**（`bg-neutral-100` 自动变深）与**手写 `.dark .X` 规则**实现了主题响应，与 `dark:` 无关。
> 该统计**只能作为"代码坏味"指标**，用于定位待审查文件；**不得**用作缺陷计数或验收依据。真实缺陷清单见 §11。

### 1.3 渲染验证基线（v1.1.0 新增）

本次修订对 v1.0.0 中所有"未经渲染确认"的结论执行了 **L3 级真实浏览器取证**：

| 手段 | 内容 |
|:-----|:-----|
| 浏览器 | Chromium（Playwright 1.61.1，headless） |
| 被测对象 | ① 开发服务器 `127.0.0.1:3000`（Vite 8.1.3，真实 CSS 管线）；② **生产构建产物** `frontend/dist/assets/index-CuWziqEh.css`（632 626 B，2026-10-01 01:39 构建） |
| 纯 CSS 隔离实验 | 空白页 + 注入生产 CSS + 合成探针，**完全排除 React / store / 应用自身对 `.dark` 类的写入**，矩阵为 {`.dark` 类 有/无} × {`prefers-color-scheme` 亮/暗} |
| 真实应用实验 | 以 `admin` 登录后，经 Vite 动态 `import()` 驱动**真实 `useThemeStore`** 切换主题，实测计算样式 |
| 像素级取证 | 对渐变背景用 Playwright `clip` 截图 + Canvas 读取像素，计算对比度（`getComputedStyle` 无法取得渐变实色） |
| 编译产物取证 | 对生产 CSS 做花括号深度追踪，判定全部 `dark:` 选择器的归属 |
| 时间线取证 | `waitUntil:'commit'` + 40 ms 高频采样，记录 `first-paint` / `first-contentful-paint` / `.dark` 生效时刻 |

**审查边界**：未覆盖移动端视口、未覆盖打印样式、未覆盖 IE/旧版浏览器、未对全部 392 个候选文件逐一渲染。§11 中每条缺陷均标注**验证方式**（静态 / 渲染 / 像素）。

---

## 2. 架构模型

### 2.1 五层模型（规范性）

```
┌─ L0 令牌源 (Token Source) ───────────────────────────────┐
│  frontend/src/styles/tokens/base.css   （亮色，:root）    │
│  frontend/src/styles/tokens/dark.css   （暗色，.dark）    │
│  ← 唯一真相源（SSOT）。所有颜色/间距/圆角/层级的定义处。   │
└───────────────────────────┬──────────────────────────────┘
                            │  @import
┌─ L1 主题映射 (Theme Mapping) ────────────────────────────┐
│  frontend/src/index.css                                  │
│  · @theme         → 向 Tailwind v4 暴露令牌为工具类       │
│  · @custom-variant dark → 把 dark: 变体绑定到 .dark 类    │  ← 【当前缺失】
└───────────────────────────┬──────────────────────────────┘
                            │  Tailwind utilities / plain CSS
┌─ L2 语义工具类 (Semantic Utilities) ─────────────────────┐
│  frontend/src/styles/components/semantic-utils.css       │
│  frontend/src/index.css（.text-text-primary 等）          │
│  职责：为令牌提供有语义的类名，禁止在此定义新的色值。      │
└───────────────────────────┬──────────────────────────────┘
                            │  className
┌─ L3 组件 (Components) ───────────────────────────────────┐
│  frontend/src/components/**  frontend/src/pages/**       │
│  禁止硬编码颜色；只能消费 L1/L2。                          │
└───────────────────────────┬──────────────────────────────┘
                            │  var(--…) 引用 / getComputedStyle
┌─ L4 程序化取色 (Programmatic Color) ─────────────────────┐
│  图表、Canvas、Three.js、导出 PDF/图片                     │
│  必须经 useChartTheme() / getChartTheme() 单一通道。      │
└──────────────────────────────────────────────────────────┘

┌─ 旁路 RT 运行时注入（非规范层，待收敛）─ ────────────────┐
│  themeStore → applyThemeToDOM() → <html style="…">       │
│  实测向 <html> 注入 104 条内联自定义属性（约 3.2 KB）      │
│  其中 71 条与 L0 同名不同值 → 品牌色分叉（见 D-3）         │
└──────────────────────────────────────────────────────────┘
```

### 2.2 关键不变量（Invariants）

| # | 不变量 | 校验方式 | 实测状态 |
|:--|:-------|:---------|:---------|
| **I1** | 颜色令牌只在 `base.css` 与 `dark.css` 中定义 | §10 CHK-01 | ⚠️ 运行时另在 `<html>` 内联注入一套（D-3） |
| **I2** | 每个在 `base.css` 中定义的颜色令牌，`dark.css` 必须提供对应值 | §10 CHK-02 | ⚠️ 21 个值被无作用域 `:root` 污染（D-21） |
| **I3** | `dark.css` 中新增的令牌必须同时存在于 `base.css` | §10 CHK-03 | ❌ 22 个单边定义（D-12 等） |
| **I4** | 组件层不得出现 hex/rgb/hsl 颜色字面量 | §10 CHK-01 | ❌ 5 081 处 |
| **I5** | `dark:` 前缀必须由 `.dark` 类驱动，而非 `prefers-color-scheme` | §7.2 | ❌ **完全违反**（实测 1 467/1 467 属媒体查询） |
| **I6** | 运行时不得写入 §3 命名规范之外的令牌 | §7.3 | ❌ 违反（D-3/D-23） |
| **I7** | 暗色模式下不得有元素因漏覆盖而回落到亮色值 | §17.5 | ⚠️ 实测约 18 处（远低于静态预测） |
| **I8** | 主题切换不得产生布局位移（CLS = 0）或首屏闪烁（FOUC） | §7.5 | ❌ **实测存在 FOUC**（D-11） |
| **I9** | **背景色阶与前景文字必须同源同向变化** | §4.3 C-24 | ❌ **严重违反**（D-50，实测 1.52:1） |

---

## 3. 令牌规范（L0）

### 3.1 命名规范

```
--<域>-<语义组>-<变体>[-<修饰>]
```

| 域 | 用途 | 示例 |
|:---|:-----|:-----|
| `color-` | 颜色 | `--color-primary-500` |
| `bg-` | 背景/表面 | `--bg-canvas`、`--bg-surface-container` |
| `text-` | 文字 | `--text-primary`、`--text-h1` |
| `border-` | 边框 | `--border-color`、`--border-subtle` |
| `radius-` | 圆角 | `--radius-md` |
| `space-` | 间距 | `--space-4` |
| `shadow-` | 阴影 | `--shadow-md` |
| `duration-` / `ease-` | 动效 | `--duration-normal`、`--ease-spring` |
| `z-` | 层级 | `--z-modal-backdrop` |
| `font-` | 字体族 | `--font-sans` |
| `badge-` / `skeleton-` / `scrollbar-` | 组件级局部令牌 | `--badge-approved-bg` |

**强制规则：**

- **T1** 命名必须使用小写 kebab-case；禁止 camelCase、下划线、大写。
- **T2** 色阶变体必须使用 `50/100/…/900/950` 的 0–950 十阶。
- **T3** 语义变体只允许 `main`、`hover`、`container`、`text`、`light`、`dark`、`-rgb`。
- **T4** **禁止**在令牌名中使用品牌形容词（`forest-green`、`ocean-blue`、`bio-purple`、`tech-cyan`）。
- **T5** **禁止**混用 `--color-primary` 与 `--color-primary-500` 表达同一含义。二者语义不同：
  - `--color-primary` = **当前主题下应使用的主色**（亮色 = 500 档，暗色 = 400 档，**允许随主题翻转**）；
  - `--color-primary-500` = **色阶固定锚点**（值在任何主题下都不变）。
  > ⚠️ **实测违反**：`dark.css` 反转了整个 primary 色阶（`--color-primary-500` 亮 `#10b981` / 暗 `#34d399`），使"固定锚点"失去意义。这是 **D-50 的根因**，见 §4.3 C-24。
- **T6** 新增令牌必须同时在 `base.css` 与 `dark.css` 登记，并更新本文 §3.4 清单。
- **T7** **禁止**在 `dark.css` 中出现无 `.dark` 祖先作用域的 `:root` 块。所有暗色值**必须**写在 `.dark { … }` 内。
  > **实测确证**：`dark.css:381-448` 存在 44 条此类声明（`dark.css` 内 `.dark{}` 与尾部 `:root{}` **零交集**）。因 `dark.css` 在 `base.css` 之后导入且同特异度，**其值在亮色模式下也生效**。实测 `--badge-draft-text` 在**四种条件组合下恒为 `#cbd5e1`**（见 §17.4）。→ D-21。
- **T8** 语义层令牌**必须**通过 `var()` 引用同族 primitive，**禁止**直接抄写字面量。
  ```css
  /* ✅ 正确 */
  --color-primary: var(--color-primary-500);
  /* ❌ 错误：改 primitive 不影响 semantic，三级架构失效 */
  --color-primary: #10b981;
  ```
  > 实测：`base.css` 中 343 个变量仅 **44 处** `var()` 引用、**172 处**字面 hex（约 87% 为叶子字面量）。→ D-24。
- **T9** `var(--token, fallback)` 的 fallback **必须**与令牌语义一致或省略。
  > 实测违规：`semantic-utils.css:23` 的 `.bg-success-container` fallback 是**蓝色** `rgba(0,102,204,.12)`。→ D-31。
- **T10** 令牌引用**必须**与定义完全一致；`--ease-*` 与 `--easing-*` 等**禁止**并存。
  > 实测确证：JS 写入 `--easing-easeOut`（实测值 `cubic-bezier(0.16, 1, 0.3, 1)`），而 CSS 43 处消费者读 `--ease-*`，`--weight-*` **零消费者** → 主题面板的缓动与字重调节 **100% 无效**。→ D-23。
- **T11** 令牌**禁止**参与主题切换变化，除非其语义确需随主题变化。字体族链、z-index、间距、圆角**必须**在亮暗两套中完全相同。
- **T12** shadcn/ui 无前缀令牌层（`--background` 等）只能由 `components/ui/**` 消费，且**必须**是 `var()` 别名。
  > 实测违规：暗色下 `--background` 解析为 **`#f0fdf4`（近白绿）**，而 `--bg-canvas` 为 `#020617`。任何使用 `bg-background` 的 shadcn 组件在暗色下会得到**近白背景**。→ D-9。
- **T13** `@theme` 块中的令牌桥接**必须**指向**已在 `base.css`/`dark.css` 中真实定义**的令牌；**禁止**写成 `--x: var(--x)`（自引用）。
  > **理由（D-51）**：`@theme` 中的 `--color-blue-500: var(--color-blue-500)` 会**替换** Tailwind v4 的默认蓝色阶。若 `base.css`/`dark.css` 也未定义同名令牌，则该令牌的**全部**声明都是自引用 → 解析为 guaranteed-invalid（**空**）→ 依赖它的工具类失去颜色。
  >
  > 实测对照（生产编译产物）：
  > | 令牌 | 编译后声明 | 结果 |
  > |:-----|:-----------|:-----|
  > | `--color-blue-500` | `var(--color-blue-500)` | ❌ 空 → `bg-blue-500` **无颜色** |
  > | `--color-pink-500` | `oklch(65.6% .241 354.308)` | ✅ Tailwind 默认值保留 |
  >
  > **判定口径**：自引用且**同名有真实定义** → 属"冗余"（靠层叠顺序侥幸可用，仍是隐患）；自引用且**同名无定义** → 属"**循环引用**"（必须修复）。门禁断言 **CHK-26 / CHK-27** 按此口径区分。
  > 实测：`index.css` 共 **89 个**自引用，其中 **79 个**冗余、**10 个**循环引用（恰好 `--color-blue-50..900`）。

### 3.2 品牌色板（权威定义）

品牌主色 **Forest Green**，以 `--color-primary-*` 命名。

| 档位 | 亮色 (`base.css`) | 暗色 (`dark.css`) | 令牌 |
|:-----|:------------------|:------------------|:-----|
| 50 | `#ecfdf5` | `#022c22` | `--color-primary-50` |
| 100 | `#d1fae5` | `#064e3b` | `--color-primary-100` |
| 200 | `#a7f3d0` | `#065f46` | `--color-primary-200` |
| 300 | `#6ee7b7` | `#047857` | `--color-primary-300` |
| 400 | `#34d399` | `#059669` | `--color-primary-400` |
| 500 | `#10b981` | `#34d399` | `--color-primary-500` |
| 600 | `#059669` | `#6ee7b7` | `--color-primary-600` |
| 700 | `#047857` | `#a7f3d0` | `--color-primary-700` |
| 800 | `#065f46` | `#d1fae5` | `--color-primary-800` |
| 900 | `#064e3b` | `#ecfdf5` | `--color-primary-900` |
| 950 | `#022c22` | `#f0fdf4` | `--color-primary-950` |
| **语义** | `#10b981` | `#34d399` | `--color-primary` |
| hover | `#059669` | `#6ee7b7` | `--color-primary-hover` |
| container | `#d1fae5` | `rgba(52,211,153,.15)` | `--color-primary-container` |
| text | `#047857` | `#047857` | `--color-primary-text` |
| rgb 通道 | `16, 185, 129` | `52, 211, 153` | `--color-primary-rgb` |

> **⚠️ 色阶反转声明（关键）**：上表显示 `dark.css` **整体反转**了 primary 色阶——暗色下 `50` 是最深、`950` 最浅。
> **设计后果**：`bg-primary-{400..700}` 在暗色下变成**浅色底**（实测 `bg-primary-600` 亮 `#059669` → 暗 **`#6ee7b7`**）。
> **因此「`bg-primary-*` + `text-white`」在暗色下必然崩塌**（实测 **1.52:1**）→ **D-50**，规范见 §4.3 **C-24**。
> 同时 `--color-primary-text` 未随色阶反转（两模式均 `#047857`），暗色下在 `#020617` 画布上仅约 2.3:1 → **D-12**。

> **品牌唯一值声明**：RMFOOD 品牌主色 **= Forest Green `#10B981`（Emerald-500）**。
> 任何文档声称 `#28A745`、`#22C55E`、`#059669`、`#0891B2`、`#34C759` 为"品牌主色"的表述**一律作废**（见 §13）。

品牌辅色 **Ocean Blue**（`--color-secondary-*`）、强调色 **Bio Purple**（`--color-accent-*`）结构同构，见 `base.css:28-61` / `dark.css:26-60`。

### 3.3 语义令牌组（必须成对定义）

| 组 | 代表令牌 | 亮色基准 | 暗色基准 |
|:---|:---------|:---------|:---------|
| **画布/表面** | `--bg-canvas` | `#f8fafc` | `#020617` ✅ |
| | `--bg-surface-container` / `-low` / `-raised` / `-elevated` | — | — |
| | `--card-bg-solid` | `#ffffff` | `#0f172a` ✅ |
| | `--bg-surface` / `--bg-surface-variant` | 别名 | ❌ **解析为空**（D-22） |
| **文字** | `--text-primary` | `#0f172a` | `#f1f5f9` ✅ |
| | `--text-secondary` / `--text-muted` / `--text-disabled` | — | — |
| **边框** | `--border-color` / `-hover` / `--border-subtle` / `--border-default` | — | — |
| **功能色** | `--color-{success,warning,error,info}` | `#10b981`/`#f59e0b`/`#ef4444`/`#3b82f6` | 对应亮阶 ✅ |
| | `--color-{…}-{bg,text,container,hover}` | — | — |
| **中性色阶** | `--color-neutral-50` … `-900` | `#f8fafc`→`#0f172a` | **反转** `#020617`→`#f1f5f9` ✅ |
| **焦点** | `--focus-ring` | `#3b82f6` | — |
| **遮罩** | `--overlay-bg` | `rgba(0,0,0,.4)` | — |
| **徽章（局部）** | `--badge-{draft,…}-{bg,text,border}` | ❌ 被污染 | ❌ **两模式同值**（D-21） |
| **shadcn 桥** | `--background` | `#f8fafc` | ❌ **`#f0fdf4`**（D-9） |

> ⚠️ **中性色阶反转是规范明确允许的设计**：使 `bg-neutral-100` 在暗色下自动变深。
> **实测确证**（纯 CSS 隔离）：`bg-neutral-100` 亮 `#f1f5f9` → 暗 `#0f172a` ✅ **随 `.dark` 类正确变化**。
> **因此组件禁止再写 `dark:bg-neutral-*`**（见 §4.3 C-4）。

### 3.4 非颜色令牌

| 域 | 令牌 | 值 |
|:---|:-----|:---|
| 圆角 | `--radius-{xs,sm,md,lg,xl,2xl,full}` | `4 / 6 / 8 / 12 / 16 / 20 / 9999 px` |
| 间距 | `--space-{0,1,2,3,4,5,6,8,10,12,16,24}` | `0 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 96 px` |
| 阴影 | `--shadow-{sm,card,card-hover,md,elevated,lg,xl,modal,glass}` | 见 `base.css:240-264` |
| 动效 | `--duration-{fast,normal,slow,emphasis}` | `100 / 200 / 300 / 500 ms` |
| | `--ease-{standard,spring,elegant}` | 见 `base.css:271-273` |
| 层级 | `--z-{header,overlay,sidebar,modal-backdrop,toast,tooltip}` | `100 / 300 / 301 / 1000 / 1200 / 1300` |
| 布局 | `--sidebar-width` / `-collapsed-width` / `--header-height` | `256 / 64 / 56 px` |
| 字体 | `--font-{sans,mono,serif}` | 见 `base.css:146-148` |
| 排版 | `--text-h1..h6`、`--text-body*`、`--text-caption`、`--text-overline`、`--text-tiny`（各带 `-line-height`/`-font-weight`/`-tracking`） | 见 `base.css:151-191, 384-386` |
| 组件局部 | `--badge-*`、`--skeleton-*`、`--scrollbar-thumb*` | 见 `base.css:380-424` |

**命名违规（T1/T2 违反，待修）：** `--radius-Apple-{sm,md,lg}`（大写）、`--space-0_5/1_5/2_5`（下划线）、`--radius-pill` ≡ `--radius-full`、`--color-accent-300` ≡ `-400`。→ D-29

### 3.5 色阶档位使用规范

| 档位 | 用途 | 禁止 |
|:-----|:-----|:-----|
| 50 / 100 | 页面/区块浅背景 | 用作文字色 |
| 200 / 300 | 边框、分割线、禁用态 | 用作正文 |
| 400 | 暗色模式主色、图标 | 亮色模式正文 |
| 500 | **亮色模式主色** | 小字号正文 |
| 600 | 按钮填充、链接、hover | — |
| 700 / 800 | 强调文字、深色 hover | 大面积背景 |
| 900 / 950 | 最深文字、暗色模式背景 | 亮色模式正文 |

> **⚠️ 因 §3.2 的色阶反转，上表"档位 → 用途"的映射在暗色模式下不再成立。**
> **禁止**把档位号当作"明暗程度"使用；跨主题的场景**必须**使用语义令牌（`--color-primary` 等）。见 C-24。

---

## 4. 消费契约（L2 / L3）

### 4.1 消费优先级

组件选择颜色的顺序**必须**为：

1. **语义令牌变量**：`className="text-text-primary"` 或 `style={{ color: 'var(--text-primary)' }}`
2. **语义工具类**：`semantic-utils.css` / `index.css` 提供的类（§4.2）
3. **Tailwind 语义工具类**：`bg-card`、`border-border`、`text-muted-foreground`
4. **Tailwind 中性色阶类**：`bg-neutral-100`、`text-neutral-600`（依赖反转机制，**禁止**配 `dark:`）
5. （仅图表/Canvas）`useChartTheme()` / `getChartTheme()`

> **禁止**使用第 6 类：**品牌色阶类**（`bg-primary-500`、`text-primary-600` 等）。见 C-24。

### 4.2 语义工具类清单

**颜色类**（`semantic-utils.css`）：`.text-primary-main`、`.text-primary-light`、`.bg-primary-container`、`.border-primary-main`、`.text-{success,warning,error,info}-main`、`.bg-{…}-container`、`.bg-neutral-{50..900}`、`.text-neutral-{50..900}`、`.border-neutral-{50..900}`、`.surface-card`、`.skeleton-base`

**文本/表面类**（`index.css`）：`.text-text-primary`、`.text-text-secondary`、`.text-text-muted`、`.text-text-disabled`、`.bg-surface-default`、`.bg-surface-variant`、`.bg-background-default`、`.bg-background-elevated`、`.bg-background-hover`、`.border-border-default`、`.border-border-hover`、`.border-border-divider`、`.bg-card`

> ⚠️ `.text-text-primary`（`index.css:178`）与 `.text-primary-main`（`semantic-utils.css:16`）语义**不同**：前者 = 正文色，后者 = 品牌主色。**禁止**新增同类双关命名。

### 4.3 允许 / 禁止写法

| # | 写法 | 判定 | 实测依据 |
|:--|:-----|:----:|:---------|
| **C-1** | `bg-white dark:bg-neutral-900` | ❌ 禁止 | 见 C-24 与 §7.2；实测 `.dark` 类下**不生效** |
| **C-2** | `style={{ color: '#34C759' }}` | ❌ 禁止 | 5 081 处存量 |
| **C-3** | `text-[#34C759]` | ❌ 禁止 | 绕过令牌体系 |
| **C-4** | `bg-slate-50 dark:bg-neutral-800` | ❌ 禁止 | 中性色阶已自带反转 |
| **C-5** | `bg-emerald-50`（无 `dark:`） | ❌ 禁止 | 实测**四条件完全相同**：不响应 `.dark` 也不响应媒体查询 → 彻底惰性 |
| **C-6** | `bg-neutral-100` | ✅ 允许 | 实测亮 `#f1f5f9` → 暗 `#0f172a` |
| **C-7** | `style={{ color: 'var(--text-primary)' }}` | ✅ 允许 | — |
| **C-8** | `bg-primary-container text-primary-main` | ✅ 允许 | — |
| **C-9** | `` className={`bg-${color}-500`} `` | ❌ 禁止 | Tailwind v4 无法静态提取 |
| **C-10** | `w-${size}` 等动态拼接 | ❌ 禁止 | 同上 |
| **C-11** | `<style>` 内重定义 `--color-*`/`--accent-*` | ❌ 禁止（例外见 §7.10） | 破坏 I1 |
| **C-12** | 组件内定义业务色常量对象 | ❌ 禁止 | `types/formula-state-colors.ts` 违规 |
| **C-13** | `@media (prefers-color-scheme: dark)` 做暗色适配 | ❌ 禁止 | 见 I5 |
| **C-14** | `!important` 用于颜色覆盖 | ❌ 禁止 | `adjustments.css` 29 处（D-27） |
| **C-15** | 在 `.dark` 下为调色板类名打补丁 | ❌ 禁止 | 治标不治本 |
| **C-16** | focus 态 `outline: none` 而无替代 | ❌ 禁止 | WCAG 2.4.7 |
| **C-17** | hover/active 改变元素尺寸 | ❌ 禁止 | 布局位移 |
| **C-18** | 颜色作为唯一状态指示 | ❌ 禁止 | WCAG 1.4.1 |
| **C-19** | 内联 `boxShadow: '0 1px 3px rgba(0,0,0,.12)'` | ❌ 禁止 | 应使用 `var(--shadow-*)` |
| **C-20** | 图表自行定义颜色数组 | ❌ 禁止 | 应经 `chartTheme.ts` |
| **C-21** | Canvas 直接赋 `var(--…)` 字符串 | ❌ 禁止 | Canvas 不解析 CSS 变量 |
| **C-22** | 图表颜色不随主题重取 | ❌ 禁止 | 实测 `useMemo(…,[])` 空依赖（D-43） |
| **C-23** | 数据可视化调色板散落在各图表组件 | ❌ 禁止 | 应集中在 `chartTheme.ts` |

#### ★ C-24（新增，P0）— 反转色阶禁止搭配白字

**条款：** **禁止**将**品牌色阶背景类**（`bg-primary-{50..950}`、`bg-accent-*` 等会随主题反转的色阶）与**固定前景色**（`text-white`、`text-neutral-50`、硬编码浅色）搭配使用。

**理由（实测）：** `dark.css` 反转了 primary 色阶（§3.2），使 `bg-primary-{400..700}` 在暗色下变成**浅色**；而 `text-white` 不随主题变化 → 对比度崩塌。

**实测数据（Chromium，四条路由 100% 复现）：**

| 元素 | 类名 | 亮色底 | 暗色底 | 亮色对比度 | **暗色对比度** |
|:-----|:-----|:-------|:-------|:-----------|:---------------|
| 页头横幅 | `rounded-xl bg-primary-600 p-6 text-white shadow-sm` | `#059669` | **`#6ee7b7`** | 3.77:1 | **1.52:1** 🔴 |
| 圆形头像/图标 | `flex items-center justify-center text-white shrink-0` | `#10b981` | **`#34d399`** | 2.54:1 | **1.92:1** 🔴 |

> 出现路由：`/dashboard`、`/formulas`、`/users`、`/ai`（即**全部含页头的已登录页面**）。

**合规写法（三选一）：**

```tsx
// ✅ 方案 A（推荐）：新增"主色表面"令牌对，两模式都保持深底白字
//   base.css:  --color-primary-surface: #059669;  --color-on-primary-surface: #ffffff;
//   dark.css:  --color-primary-surface: #047857;  --color-on-primary-surface: #ffffff;
<div className="surface-primary rounded-xl p-6">…</div>

// ✅ 方案 B：使用不参与反转的 Tailwind 固定色阶
<div className="rounded-xl bg-emerald-600 p-6 text-white">…</div>

// ✅ 方案 C：显式提供反转后的深色底（须先修复 D-1，否则 dark: 不生效）
<div className="rounded-xl bg-primary-600 dark:bg-primary-900 p-6 text-white">…</div>
```

**验收：** 亮/暗两模式下，任何"实底 + 文字/图标"组合的对比度**必须** ≥ 4.5:1（大文本 ≥ 3:1，图标/边框 ≥ 3:1）。

### 4.4 状态与交互契约

| 状态 | 必须使用 | 时长（令牌） |
|:-----|:---------|:-------------|
| hover | `--color-primary-hover` / `--bg-surface-hover` | `--duration-fast`（100 ms） |
| focus | `outline: 2px solid var(--color-primary)`，`outline-offset: 2px` | 立即 |
| active | `--color-*-hover` 或 `transform: scale(.98)` | `--duration-fast` |
| disabled | `--text-disabled` + `opacity: .38–.5` | — |
| 主题切换过渡 | `.theme-transition` 类 | `--duration-normal`（200 ms） |

### 4.5 迁移映射表（存量 → 目标）

| 存量写法 | 目标写法 | 处理 |
|:---------|:---------|:-----|
| `bg-white dark:bg-neutral-900` | `surface-card` / `bg-surface-default` | 脚本批量 |
| `text-neutral-900 dark:text-white` | `text-neutral-900` | 删除 `dark:` 部分 |
| `bg-gray-50` / `bg-slate-50` | `bg-neutral-50` | 映射到中性色阶 |
| `text-gray-600` / `text-slate-600` | `text-neutral-600` | 同上 |
| `bg-emerald-50`（品牌浅底） | `bg-primary-container` | 语义化 |
| `bg-primary-600 text-white` | 见 C-24 方案 A/B/C | **P0** |
| `text-emerald-600`（品牌文字） | `text-primary-main` | 语义化 |
| `bg-blue-50`（信息浅底） | `bg-info-container` | 语义化 |
| `var(--color-primary)` | 保持 | 正确 |
| `var(--color-text-primary)` | `var(--text-primary)` | ⚠️ 二者**都存在**但**值不同**（见 §14.2） |
| `var(--color-primary-main)` | `var(--color-primary)` | ⚠️ 二者**都存在**但品牌绿不同 |
| `var(--color-chart-1..5)` | `var(--color-{success,warning,…})` | ❌ 该族**确实不存在** |
| `var(--color-{success,warning,error,info}-light)` | 改用 `-400` 档 | ❌ 该族**确实不存在** |
| `#34C759` / `#28A745` / `#22C55E` | `var(--color-primary)` | 品牌统一 |

---

## 5. 组件契约

### 5.1 组件必须支持的两种模式

每个展示型组件**必须**在 `:root`（亮色）与 `.dark`（暗色）下无视觉缺陷。

**验证方式（规范性）**：切换主题后，比对「背景色 / 文字色 / 边框色 / 图标色 / 阴影」五类属性。任何**未变化**的颜色为疑似漏色；任何**变化后对比度 < 4.5:1**（大文本 < 3:1）的颜色为**对比度缺陷**（后者比前者更隐蔽，见 D-50）。

### 5.2 阴影与暗色

暗色模式下**禁止**使用亮色的 `rgba(0,0,0,α)` 硬编码阴影。应降低阴影强度（`--shadow-*` 已在 `dark.css` 覆盖），或用边框 + 表面亮度差表达层次。

### 5.3 图表与 Canvas（L4）

- **C-20～C-23** 见 §4.3。
- Canvas / Three.js **禁止**直接赋 `var(--…)` 字符串——必须经 `getComputedStyle(document.documentElement).getPropertyValue('--…')` 取实际值（`getSemanticColor()` 即为此用途）。

**实测现状（§11 D-4）：** 图表取色存在三套并行体系，且**变量可用性不一致**：

| 变量族 | 实测 | 影响 |
|:-------|:-----|:-----|
| `--color-*-main`（`--color-primary-main` 等 11 个） | ✅ **存在**（运行时注入） | 但值取自 `theme.presets`（`#34C759`），与 `--color-primary`（`#10b981`）**不同** → 图表与页面**品牌绿不一致** |
| `--color-text-primary`/`-secondary`、`--color-surface-default`、`--color-border-default`/`-divider` | ✅ **存在** | 同上，值为预设值 |
| `--color-{success,warning,error,info}-light`（4 个） | ❌ **不存在**（实测空串） | `FORMULA_ROLE_COLORS.dark` 与 `FORMULA_CATEGORY_PALETTE.dark` 全部失效 |
| `--color-chart-1..5`（5 个） | ❌ **不存在**（实测空串） | `themeColorMapper.getChartThemeColors()` 返回全部失效 |

> **更正 v1.0.0 的表述**：`--color-*-main` 族**并非"不存在导致颜色透明"**，而是**存在但值错误**（品牌色分叉）。真正缺失的是 `-light` 与 `chart-*` 两族。原判断基于静态 CSS 扫描（未计入运行时内联注入），已在 v1.1.0 修正。

---

## 6. 无障碍规范

### 6.1 对比度（WCAG 2.1）

| 内容类型 | 最低要求 | 等级 |
|:---------|:---------|:-----|
| 正文（< 24px 且非 ≥18.66px bold） | **4.5:1** | AA |
| 大文本（≥ 24px 或 ≥ 18.66px bold） | **3:1** | AA |
| 图标、边框、焦点环、UI 组件边界 | **3:1** | AA（1.4.11） |
| 关键正文（长文阅读区） | 7:1 | AAA（推荐） |

**强制：**

- **A-1** 新增/修改任何 `--color-*` 令牌**必须**在 PR 中附「亮色 + 暗色」两套对比度计算。
- **A-2** 对**渐变背景**（`background-image`）**必须**使用像素采样实测，**禁止**仅凭 `getComputedStyle().backgroundColor` 判断（渐变元素的该属性为透明）。
- **A-3** `--color-*-container`（α≈0.12 浅底）上承载文字时，文字色**必须**使用对应的 `-text` 令牌，**禁止**使用 `-main` 或白色。

### 6.2 辅助功能模式

| 模式 | `data-a11y-mode` | 附加属性 | 定义位置 |
|:-----|:-----------------|:---------|:---------|
| 标准 | `normal` | — | — |
| 高对比度 | `high-contrast` | — | `semantic-utils.css:167`（亮）/ `:177`（暗） |
| 阅读 | `reading` | `data-reading-mode="sepia"` 或 `"dark-read"` | `semantic-utils.css:190` / `:196` |
| 色盲友好 | `color-blind` | — | ⚠️ **CSS 无任何规则**，仅 JS 侧 `getAccessibilityTheme()` 处理 |

**强制：**

- **A-4** 辅助模式**必须**通过 `themeStore.setAccessibilityMode()` 单一入口切换。
- **A-5** 辅助模式的 DOM 属性**必须**在**页面初始化（`initialize()`）时同样写入**，不得仅在交互切换时写入。
  > **实测确证（§17.6）**：交互切换 → `dataA11y="reading"`、`dataReading="sepia"` ✅；**刷新后 → 两者均为 `null`** ❌。由此 `--text-primary` 从 `#5C4B37`（sepia）回退到 `#0f172a`，`semantic-utils.css:190-201` 的阅读模式规则**整层失效**。→ D-39
- **A-6** `prefers-contrast: high`（系统级）与 `data-a11y-mode="high-contrast"`（应用级）**必须**同时支持。
- **A-7** 阅读模式**必须**覆盖实际生效的背景令牌。实测仅覆盖 `--bg-primary`/`--bg-surface`，而页面底色读 `--bg-canvas`（`typography.css:19`）→ **sepia 下 body 底色仍是 slate `#f8fafc`**，文字变棕但背景未变暖。→ D-32
- **A-8** 高对比度模式覆盖的边框令牌**必须**是组件实际消费的那个。实测改 `--border-default`，而组件普遍读 `--border-color`（`index.css:195`）。→ D-32

### 6.3 动效偏好

- **A-9** **必须**尊重 `prefers-reduced-motion: reduce`（`environment.css:22-29` 已全局实现）。
- **A-10** 用户级开关（`motionPreferences.disableAnimations`）**必须**通过 `html.reduce-motion` 类生效。
- **A-11** 主题切换动画在 `reduce-motion` 下**必须**退化为瞬时切换。

### 6.4 其他

- **A-12** **必须**尊重 `forced-colors: active`（`environment.css:63-71`）。
- **A-13** `color-scheme` **必须**与当前主题一致（实测 `<html>` 内联 `colorScheme` 生效，`environment.css:74-76` 的 `:root{color-scheme:normal}` 被覆盖）。
- **A-14** 打印时**必须**使用浅色（`environment.css:83-130`）。

---

## 7. 运行时规范（L1 / 状态）

### 7.1 状态模型

**唯一真相源：`frontend/src/stores/themeStore.ts`（Zustand + persist）。**

```
useThemeStore (Zustand)  ← 唯一可变状态源
        │
        ├─ ThemeProvider (React Context)   ← 只读投影 + 副作用（系统偏好监听）
        ├─ useTheme()                      ← Context 消费钩子
        ├─ useThemeStore(selector)         ← 直接订阅（允许）
        └─ themeStorage                    ← 版本历史读写（只读旁路，实测无调用方）
```

**强制：**

- **R-1** 主题状态**禁止**出现第二个可变源。组件**禁止**用 `useState` 缓存主题派生值（`ThemeSwitcher.tsx:20` 违规，D-7）。
- **R-2** 组件消费主题**应该**经 `@/theme` 单一入口导入。
- **R-3** `useThemeStore()` 无选择器调用会订阅全量状态；**应该**使用 `useThemeStore(s => s.x)`。
- **R-3.1** **禁止**同时存在两个同名但返回结构不兼容的 `useTheme`（`hooks/useTheme.tsx` vs `stores/ThemeProvider.tsx:292`）。→ D-40

### 7.2 Tailwind 暗色变体契约（**最高优先级缺陷**）

**规范要求：**

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

**依据（三层取证）：**

1. **源码级**：Tailwind CSS v4 将 `dark` 变体注册为 `@media (prefers-color-scheme: dark)`（`frontend/node_modules/tailwindcss/dist/lib.mjs:193309`）。
2. **编译产物级**：对生产构建 `index-CuWziqEh.css`（632 626 B）做花括号深度追踪 —— **1 467 个 `.dark\:` 选择器 100% 位于 `@media (prefers-color-scheme: dark)` 块内，块外 0 个**。
3. **渲染级（纯 CSS 隔离）**：合成元素 `bg-white dark:bg-neutral-900` 的计算值：

   | 条件 | `.dark` 类 | 系统偏好 | 实测背景 | 判定 |
   |:-----|:----------:|:--------:|:---------|:-----|
   | A | 无 | 亮 | `rgb(255,255,255)` | 基线 |
   | B | **有** | 亮 | `rgb(255,255,255)` | **`dark:` 未生效** 🔴 |
   | C | 无 | **暗** | `rgb(15,23,42)` | `dark:` 生效 |
   | D | 有 | 暗 | `rgb(241,245,249)` | 生效 |

   → **B 是无混杂的决定性证据**：`.dark` 类存在且系统为亮时，`dark:` 工具类**完全不生效**。

**后果：** 全项目 **14 912 处**（534 文件）`dark:` 类**不随应用主题开关切换**，只跟随操作系统偏好。这是当前主题系统**最严重的功能性缺陷（D-1）**。

> **注意**：`index.css` 存在 **13 处 `:where(.dark\:…)`**，经逐条核查**全部来自 Tailwind `divide-*` 的选择器包装**（如 `:where(.dark\:divide-neutral-800>:not(:last-child))`），**不是**主题作用域，不构成 `@custom-variant` 已配置的证据。

### 7.3 DOM 契约

`applyThemeToDOM(theme)`（`theme.presets.ts:549-596`）**必须**满足：

| 契约 | 要求 | 实测状态 |
|:-----|:-----|:---------|
| **D-attr-1** | `html[data-theme]` = 主题 ID | ✅ 实测 `light-default` / `dark-default` / `reading-sepia` |
| **D-attr-2** | `html[data-mode]` = `light` \| `dark` | ✅ |
| **D-attr-3** | `html.dark` 类与模式一致 | ✅ |
| **D-attr-4** | `html.style.colorScheme` 与模式一致 | ✅ 实测 `light` / `dark` |
| **D-attr-5** | 写入的令牌名**必须**符合 §3.1 | ❌ 写入 `--color-<组>-<键>` 族（D-3） |
| **D-attr-6** | **禁止**用 `style.cssText +=` 累加写入 | ⚠️ 用法不当但**实测不累加**（见下） |
| **D-attr-7** | **禁止**用 `document.documentElement.style.opacity/transform` 做主题过渡 | ❌ 违规（D-8） |
| **D-attr-8** | **禁止**把不可信值拼接进 `cssText` | ❌ **CSS 注入向量**（D-33） |
| **D-attr-9** | 每次应用**必须**同时写入无障碍属性 | ❌ 只回读不写入（D-39） |

> **实测更正（v1.1.0）：内联样式不累加。**
> v1.0.0 依据 `root.style.cssText += cssText` 推断"内联样式无界增长"。经真实驱动 `setPresetTheme` **往返 8 次**实测：
> `len` 稳定于 3 251–3 287 B、**声明数恒为 104**、**重复令牌数 0**。
> **原因**：CSSStyleDeclaration 按属性名去重，同名属性后值覆盖前值，不会累积。
> **结论**：**D-5（内联累加）被推翻**。`cssText +=` 仍是**不良实践**——它会整体重置 `<html>` 的 style 属性（抹掉任何其它内联样式）并强制全量重解析——但**不构成内存/性能缺陷**。
> 真正需要改的是 **D-attr-8 的注入风险**与 **D-attr-7 的全页 opacity 过渡**。

**规范写法（`applyThemeToDOM` 必须重写为）：**

```ts
export function applyThemeToDOM(theme: ThemeConfig, a11yMode?: AccessibilityMode): void {
  const root = document.documentElement;
  // 1) 逐个 setProperty（幂等覆盖，白名单校验值格式，不拼接字符串）
  for (const [name, value] of Object.entries(generateCSSVariables(theme))) {
    if (!isTokenNameAllowed(name) || !isColorValueSafe(value)) continue;
    root.style.setProperty(name, value);
  }
  root.setAttribute('data-theme', theme.id);
  root.setAttribute('data-mode', theme.mode);
  root.classList.toggle('dark', theme.mode === 'dark');
  root.style.colorScheme = theme.mode === 'dark' ? 'dark' : 'light';
  // 2) 无障碍属性必须在此一并写入（修复 D-39）
  if (a11yMode) {
    root.setAttribute('data-a11y-mode', a11yMode);
    if (a11yMode === 'reading') {
      root.setAttribute('data-reading-mode', theme.mode === 'dark' ? 'dark-read' : 'sepia');
    } else {
      root.removeAttribute('data-reading-mode');
    }
  }
  // 3) 过渡交给 CSS 类，禁止操作 opacity/transform
}
```

### 7.4 Radix Themes 桥接

- **R-5** Radix 的 `appearance` **必须**由 `useIsDarkMode()` 派生。
- **R-6** `accentColor` **必须**映射到品牌主色。当前 `accentColor="cyan"` + 内联 `<style>` 覆盖 `--accent-1..12` 属**临时方案**，且实测 `--accent-6` = **`#0066cc`（蓝色）**、`--accent-9` = `#065f46` —— 在一个绿色阶里插入了蓝色，与品牌不符（D-10）。
- **R-7** **禁止**在组件内以 `<style>` 标签覆盖 `--accent-*`/`--color-*`；须移到 `styles/tokens/` 下独立文件并 `@import`。
- **R-8** Radix Themes 仅作为**原语组件库**使用；**禁止**作为令牌真相源（ADR-027:32 已明确「设计 Token 完全保留」）。
- **R-9** 使用 `@radix-ui/themes` **必须**导入其样式表 `@radix-ui/themes/styles.css`；**禁止**保持「引入了但没生效」的中间状态。
  > **实测确证（D-41）**：当时全仓 **0 引用**该样式表，`.radix-themes` 根节点上的 `--gray-1`/`--gray-12`/`--font-size-2`/`--radius-3` **全部为空**；仅 `--accent-*` 因内联 `<style>` 而存在（其中 `--accent-6` 还是蓝色 `#0066cc`，插在绿色阶中间 → D-10）。
  >
  > **✅ 已按方案乙处置（T-R1）**：**删除**该依赖与 `RadixThemeProvider`，`components/ui/RadixComponents.tsx` 改为**项目原生实现**（保留对外 API，并补齐 `role="status"` 无障碍契约）。实测 `/radix-demo` 可达、**0 个 Radix 残留节点**、**13 个 Badge 具备 role=status**、0 页面错误。
  > 门禁断言 **G-10** 固化本规则：源码一旦再次导入该库而未加载其样式表即判失败。
  > **保留决策**：16 个 `@radix-ui/react-*` 原语包**继续使用**（headless 原语，不依赖主题样式表）。

### 7.5 初始化时序与 FOUC

**强制：**

- **R-10** 首屏渲染前**必须**已应用正确主题，禁止闪烁（I8）。
- **R-11** `index.html` 预置脚本读取的 localStorage 键名与结构**必须**与 `themeStore` 的 persist 配置一致。

**实测 FOUC 时间线（§17.7）—— 已确证：**

| 时刻 | 事件 | 实测值 |
|:-----|:-----|:-------|
| t = 1 355 ms | body 已有背景色 | `rgb(248,250,252)`（**亮色**），`html.class=""`，`htmlStyleLen=0` |
| t = 1 356 ms | `first-paint` | — |
| **t = 1 468 ms** | **`first-contentful-paint`（亮色内容已绘制）** | — |
| t = 1 516 ms | `.dark` 类被应用 | body 转为 `rgb(2,6,23)` |

**⇒ 用户先看到亮色首屏，48 ms 后才开始转暗，从首次可见到转暗共约 160 ms。**

**根因（D-11）：** `index.html:28` 读取 `localStorage['rmfood-theme-settings-v2']`，而 `themeStore.ts:428` 实际写入 **`rmfood-theme-storage`**（结构为 `{state:{…},version:4}`）。两者**永不匹配**，且 `mode` 取值集合不一致（`'auto'` vs `'system'`）。实测预置正确键名后应用**确实**切到了 dark（最终 `data-theme="dark-default"`），证明**只是时机太晚**，而非逻辑错误。

**规范写法：**

```html
<script>
  (function () {
    try {
      var raw = localStorage.getItem('rmfood-theme-storage');
      if (!raw) return;
      var mode = JSON.parse(raw)?.state?.mode;
      var dark = mode === 'dark' ||
        (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      if (dark) document.documentElement.classList.add('dark');
    } catch (e) {}
  })();
</script>
```

**附加（D-49）**：冷启动默认 `transitionType: 'fade'`，会先把 `<html>` 设为 `opacity: 0` 再淡入，与 FOUC 叠加产生额外空白。**规定**：初始化路径**必须**使用 `transitionType: 'none'`。

### 7.6 持久化

| 键名 | 内容 | 写入方 | 实测状态 |
|:-----|:-----|:-------|:---------|
| `rmfood-theme-storage` | Zustand persist：`activeThemeId`/`mode`/`accessibilityMode`/`motionPreferences`/`transitionType`/`customThemes` | `themeStore.ts:428` | ✅ **权威，实测读写正常** |
| `rmfood-custom-themes` | 旧版自定义主题（v3→v4 迁移源） | 历史遗留 | 只读迁移源 |
| `rmfood-theme-state` | 状态快照 | `theme.storage.ts:11` | ⚠️ 无实际消费者 |
| `rmfood-theme-preferences` | 用户偏好 | `theme.storage.ts:13` | ⚠️ 无实际消费者 |
| `rmfood-theme-versions` | 版本历史 | `theme.storage.ts:14` | ⚠️ 实测版本历史恒空 |
| `rmfood-theme-settings-v2` | — | **仅 `index.html` 读取** | ❌ **实测不存在（`null`）→ 死键** |
| `rmfood_custom_themes`（下划线） | `ThemeStorageAdapter` 使用 | — | ❌ 键名不一致，迁移读不到 |

**强制：**

- **R-12** **禁止**双写同一语义的数据。自定义主题**只能**由 Zustand persist 写入。
- **R-13** 迁移逻辑**必须**幂等且带版本号（当前 `version: 4`）。
- **R-14** 存储读取**必须**容错。
- **R-15** 清理无效键（当前 5 个僵尸/错名键）。

### 7.7 过渡与事件

- **R-16** 主题过渡**禁止**在 `themeStore` 中用 `setTimeout` 串联 DOM 动画（`themeStore.ts:517-644` 为反模式）。**必须**改为 CSS 类驱动 + `transitionend`。
- **R-17** `ThemeEventBus` **应该**仅用于跨模块通知。
  > 实测：**零订阅者**（仅 `ThemeEditor.tsx:51` 一处 `emit`，`on`/`once`/`clearListener` 全仓无调用），`emit` 因 `size === 0` 直接返回（`ThemeEventBus.ts:72`）。→ D-42
- **R-18** 主题分享 URL 协议**必须**做白名单校验。

### 7.8 安全：不可信主题输入（**强制**）

主题可通过三条路径进入，**全部为不可信输入**：`themeStore.importTheme()`、`ThemeImport.tsx` 文件上传、`ThemeShare.ts`/`themeUrlParser.ts` 的 `?theme=` URL 参数。

- **R-19** 不可信数据**必须**先经 schema 校验与**令牌白名单**，再进入应用流程。**禁止**直接展开进主题对象。
  > 违规：`themeStore.ts:399` 仅检查 `config.theme?.colors` 存在即整体 spread。
- **R-20** **禁止**将不可信值通过字符串拼接写入 `style.cssText`。**必须**使用 `setProperty`。
  > **这是当前最高危的安全缺陷（D-33）**：`theme.presets.ts:560-563` 把主题值拼成 `"name: value;"` 后 `+=` 到 `<html>.cssText`。攻击者构造含 `;` 的 value 即可越界注入任意 CSS 声明到根元素。三条输入路径**全部汇聚于此**。
- **R-21** 值**必须**做格式白名单校验（`#hex` / `rgb()` / `rgba()` / `hsl()` / `var(--已登记令牌)`），长度设上限。
  > 违规：`ThemeImport.tsx:8` 的 `sanitizeCSSVariables` 正则把 `$` 误写为 `^`（`^rgb\(.*\)^`），rgb/rgba/hsl 分支**永不匹配**；且该函数**从未被调用**。`ThemeShare.ts:28` 的 `decodeThemeFromUrl` 无校验，而 `types/theme-mode.ts:111` 的 `validateThemeConfig` 已存在却未被使用。
- **R-22** URL 分享协议**必须**唯一。当前 `?theme=` 被两套互斥协议共用（`themeUrlParser.ts:8` 传预设 ID，`ThemeShare.ts:38` 传 base64）→ base64 传给 `setPresetTheme()` 后静默回退 `light-default`（D-35）。**必须**改用不同参数名。
- **R-23** 导入配置结构**必须**与消费端一致。`ThemeImport.tsx:32-39` 传扁平 `{primary,secondary,accent}`，而 `mergeThemeOverrides`（`theme.presets.ts:471`）只读 `overrides.colors.*` → **导入静默无效果**（D-36）。

### 7.9 状态一致性

- **R-24** `mode` 与 `activeTheme` **必须**一致。**禁止**在切换预设时无条件覆写 `mode`。
  > 违规：`themeStore.ts:221` 由 `themeId.startsWith('dark-')` 推断并**强写** `mode` → 用户选择「跟随系统」后只要点过一次预设就**永久失去跟随能力**（D-34）。
- **R-25** persist 的 `partialize` **必须**包含重建 `activeTheme` 所需的全部字段。当前不含 `activeTheme`（`themeStore.ts:430-438`），水合后可能出现 `mode === 'dark'` 而 `colors` 仍为浅色（D-37）。
- **R-26** **禁止**存在多个写入同一 DOM 契约的位置。`.dark` 类当前有**两个写手**（`theme.presets.ts:585` 与 `RadixThemeProvider.tsx:26-28`）→ 必须收敛为一个（D-38）。
- **R-27** **禁止**在 `mode === 'system'` 下让媒体查询监听器覆盖用户的显式选择。实测该监听器在实验条件 C 中**自动把 `.dark` 类加了回来**，使"无类 + 系统暗色"这一状态**无法通过外部手段构造**（也说明该状态在真实使用中不可达）。

---

## 8. 主题设置 UI 规范

### 8.1 现状盘点

| 组件 | 行数 | 挂载状态 | 说明 |
|:-----|-----:|:---------|:-----|
| `components/theme/ThemeSwitcher.tsx` | 263 | ✅ **唯一可达** | `MainLayout.tsx:459` 以 `variant="icon-only"` 挂载 |
| `pages/settings/ThemeSettingsPage.tsx` | 505 | ❌ **孤儿页** | `/settings` 渲染的是 `SettingsPage`；本文件 0 引用 |
| `components/theme/ThemeEditor.tsx` | 319 | ❌ 未挂载 | 仅由 `components/theme/index.ts:1` 导出，而该 index **0 外部引用** |
| `components/theme/ThemePreviewOverlay.tsx` | 90 | ❌ 未挂载 | 同上 |
| `components/theme/ThemeOnboarding.tsx` | 126 | ❌ 未挂载 | 0 引用 |
| `components/theme/ColorEditor.tsx` / `VersionHistoryPanel.tsx` | — | ❌ 未挂载 | 仅被 `ThemeEditor` 使用 |
| `hooks/useThemedComponent.tsx` | 171 | ❌ **100% 死代码** | 导出 6 个组件，**全部 0 命中** |
| **合计死代码** | **≈1 382 行** | | |

真正对用户可见的主题设置入口是 `pages/settings/SettingsPage.tsx` 的 `renderThemePanel`（约 `:1407-1474`），仅暴露「浅色 / 深色」切换与 `Ctrl+Shift+T`。

### 8.2 强制条款

- **U-1** **禁止**新增平行的主题设置入口。**唯一**产品入口**必须**是 `SettingsPage` 的主题面板。
- **U-2** 上述 ❌ 组件在完成「挂载或删除」决策前，**禁止**在其上继续开发。
- **U-3** `hooks/useThemedComponent.tsx` **必须删除**。其职责已由 `useThemedValue<T>({light, dark})` 承担。
- **U-4** 主题设置 UI **必须**通过 `useTheme()` / `useThemeStore(selector)` 读写状态。
  > 违规：`ThemeSwitcher.tsx:20`（`transitionType` 本地 state 从未被消费）。且其实测行为进一步恶化：过渡效果区块被 `variant === 'full'` 门控（`:196`），而生产挂载传的是 `icon-only` → **该区块永不渲染**，控件与状态**双重失效**（D-7）。
- **U-5** 主题设置 UI **禁止**实现独立于 `themeStore` 的导入/导出逻辑。
  > 违规：`ThemeSettingsPage.tsx:80-123` 自定义 `rmfood-theme-v2-*.json` 格式，与 `themeStore.exportTheme()` 不兼容，且导入无白名单校验。
- **U-6** 主题 UI 预设选中态**必须**从 store 派生。
  > 违规：`ThemeSettingsPage.tsx:65` `selectedPreset` 初值恒为 `'light-default'` → 高亮永久错误。
- **U-7** 预设清单**必须**单一来源。当前在 3 处硬编码（`presetThemes`、`ThemeSwitcher.tsx:229`、`ThemeSettingsPage.tsx:65`）→ D-47。

### 8.3 AI 对话模块的令牌边界（`chatTheme.css`）

`components/ai/features/styles/chatTheme.css`（约 2 904 行 / 81.5 KB）由 `index.css:46` 全局导入：

| 维度 | 实测 | 判定 |
|:-----|:-----|:-----|
| 私有变量定义 | 161 处 / 69 个唯一名 | — |
| 命名空间 | `--chat-*`（43） + **`--dsw-*`（26，外来）** | ⚠️ 违规 |
| 作用域 | `.chat-unified`（`:102`），非 `:root` | ✅ 良好 |
| `var(--…)` 引用 | 362 处（62 指向全局令牌，300 链向自有 `--chat-*`） | — |
| 悬空引用 | 0 | ✅ |
| 硬编码 hex / rgba | 316 / 131 | ⚠️ |
| 手写 `.dark .chat-*` 覆盖块 | ≈60 处 | ⚠️ |
| 与全局令牌重名 | 0 | ✅ 无冲突 |

**强制条款：**

- **U-8** **禁止**在模块内重新定义完整量级的令牌（背景/文字/边框/强调/圆角/阴影/动效/字号）。模块**必须**直接消费 §3 的全局令牌。
  > 违规：`chatTheme.css:174-199` 完整重定义 `--dsw-{bg,text,border,accent,radius,font,shadow,transition,font-size}-*`，其中 `--dsw-accent: #10b981`（亮）/`#34d399`（暗）**恰好复制了品牌色**，形成第二真相源。
- **U-9** **禁止**引入与项目无关的命名空间前缀（如 `--dsw-`）。
- **U-10** 模块暗色适配**必须**使用 `.dark` 选择器；**禁止** `@media (prefers-color-scheme: dark)`。
  > **功能性缺陷（D-13/D-26）**：`chatTheme.css:1643/1647`、`1652/1657` 等处将 `.dark` 与媒体查询**成对重复** → **用户显式选择浅色时，若操作系统为暗色，对话区仍被强制为暗色**。
- **U-11** 模块私有变量的 fallback **禁止**写死浅色值。
- **U-12** 文件头注释**必须**与实现一致。
  > 违规：`components/ai/features/chatDesignSystem.ts:1-10` 宣称「完全使用项目 CSS 变量，不引入额外主题色」，实现含 112 处 hex + 46 处 rgba，仅 20 处 `var()`。

> **处置建议**：分阶段收敛（禁止一次性重写 2 904 行）：① 先修 U-10 的功能性 bug；② 删除 `--dsw-*` 并把引用改指全局令牌；③ 逐块替换 447 处硬编码；④ 删除手写 `.dark` 覆盖块。

---

## 9. 治理流程

### 9.1 令牌新增

1. 提交 RFC（Issue，含：令牌名、语义、亮/暗值、**对比度计算（A-1）**、使用场景、影响面）。
2. 前端架构组会签。
3. 同步修改 `base.css` + `dark.css`（**成对**，I2/I3）。
4. 更新本文 §3.4 清单。
5. 若为破坏性变更，建 ADR。

### 9.2 令牌变更与弃用

- **G-1** 重命名**禁止**直接进行。必须保留旧名 2 个发布周期并写别名 + `/* @deprecated since vX.Y.Z, use --new-name */`。
- **G-2** 每个发布版本**必须**有更新日志章节。
- **G-3** 弃用令牌**必须**可被 §10 自动检出。

### 9.3 审计

- **G-4** `frontend/scripts/theme-validate.ts` **必须**注册为 `package.json` 的 `theme:validate` 并接入 CI 与 `lint-staged`（当前未注册，不可执行）。
- **G-5** **必须**建立**渲染级**回归门禁：对关键路由做亮/暗双模式截图 diff + 对比度断言。
  > 依据：本次唯一的**新增 P0 缺陷（D-50）**与**推翻项（D-5）**均只能通过渲染发现；纯静态审查既漏报也误报。
- **G-6** 每季度执行一次 §10 全量审计并归档至 `docs/reviews/`。

### 9.4 文档治理

- **G-7** 主题文档**禁止**散落：规范 → `docs/design/`；报告 → `docs/reviews/`；决策 → `docs/adr/`。
- **G-8** 被取代的文档**必须**加 `> **Deprecated** — superseded by <路径>` 或删除。
- **G-9** ADR 编号**必须**全局唯一（当前 7 组重号，见 §14.1）。

---

## 10. 合规检查清单

### 10.1 阻塞级（BLOCKER）

| ID | 检查项 | 依据 | 实测 |
|:---|:-------|:-----|:-----|
| CHK-01 | 组件层无 hex/rgb/hsl 颜色字面量 | I4 | ❌ 5 081 处 |
| CHK-02 | `base.css` 每个 `--color-*` 在 `dark.css` 有覆盖 | I2 | ⚠️ |
| CHK-03 | `dark.css` 无 `base.css` 未定义的 `--color-*` | I3 | ❌ 22 个 |
| CHK-04 | `prefers-color-scheme: dark` 不出现在组件 CSS | I5 | ❌ chatTheme 等 22 处 |
| CHK-05 | **`@custom-variant dark` 存在于 `index.css`** | I5 / R-4 | ❌ **缺失** |
| CHK-06 | `rg 'dark:bg-(slate\|gray\|zinc\|neutral)-'` = 0 | C-4 | ❌ |
| CHK-07 | `rg 'bg-(slate\|gray)-[0-9]{2,3}'` = 0 | C-5 | ❌ |
| CHK-08 | 引用的令牌名均符合 §3.1 | I6 | ⚠️ |
| CHK-09 | 无 `style.cssText` 拼接写入 | R-20 | ❌ D-33 |
| CHK-10 | `index.html` 预置脚本键名 = `rmfood-theme-storage` | R-11 | ❌ D-11 |
| CHK-17 | `dark.css` 无裸 `:root{}` 令牌块 | T7 | ❌ D-21 |
| CHK-18 | 所有 `var(--x)` 的 `--x` 均可用 | D-2/D-22 | ❌ D-22/D-4 |
| CHK-19 | 无字符串拼接写入 `style.cssText` | R-20 | ❌ = CHK-09 |
| CHK-20 | 主题导入路径均有令牌白名单与值校验 | R-19/R-21 | ❌ |
| CHK-21 | `@radix-ui/themes/styles.css` 已导入**或**依赖已移除 | R-9 | ❌ D-41 |
| CHK-22 | `dark:` 与 `@custom-variant dark` 同时存在 | R-4 | ❌ |
| **CHK-23** | **`bg-primary-*` 未与 `text-white` 搭配** | **C-24** | ❌ **D-50** |
| **CHK-24** | **亮/暗双模式下实测对比度 ≥ 4.5:1（大文本 3:1）** | **A-1/A-2** | ❌ 1.52:1 |
| **CHK-25** | **无障碍 DOM 属性在刷新后仍存在** | **A-5** | ❌ D-39 |
| **CHK-26** | **编译产物中无自引用令牌 `--x:var(--x)`（循环引用）** | **T8 / I1** | ❌ **D-51** |
| **CHK-27** | `@theme` 块中每个桥接令牌**必须**在 `base.css`/`dark.css` 有同名真实定义 | **T8** | ❌ D-51 |

### 10.2 建议级（SHOULD）

| ID | 检查项 |
|:---|:-------|
| CHK-11 | 调色板类名均有 `dark:` 或使用中性色阶反转 |
| CHK-12 | 每个组件的亮/暗双模式视觉回归测试通过 |
| CHK-13 | 新增令牌有对比度计算记录 |
| CHK-14 | 无 `!important` 颜色覆盖 |
| CHK-15 | 无 `<style>` 内联令牌覆盖 |
| CHK-16 | 动态类名拼接 = 0 |

---

## 11. 已知缺陷登记表

> 「验证」列：**渲染** = Chromium 实测；**像素** = 截图像素采样；**静态** = 代码/产物分析。
> 「等级」：P0 阻断功能；P1 显著劣化；P2 债务；P3 整洁。

| ID | 缺陷 | 位置 | 等级 | 验证 | 实测证据 |
|:---|:-----|:-----|:----:|:----:|:---------|
| **D-1** | `@custom-variant dark` 缺失 → `dark:` 不随应用主题切换 | `index.css:7` | **P0** | **渲染 + 产物** | 1 467/1 467 个 `.dark\:` 均在媒体查询内；条件 B（有类/系统亮）实测 `bg-white dark:bg-neutral-900` = `rgb(255,255,255)` 未生效 |
| **D-2** | 两套令牌命名体系并存，品牌色分叉 | `theme.presets.ts:483-543` | **P0** | **渲染** | `--color-primary`=`#10b981` 与 `--color-primary-main`=**`#34C759`** 同时生效 |
| **D-3** | 运行时注入值取自预设（Apple 绿），与静态令牌不一致 | 同上 | **P0** | **渲染** | 暗色：`--color-primary`=`#34d399` vs `--color-primary-main`=**`#4ADE80`** |
| **D-4** | 图表取色三套并行；`-light` 与 `chart-*` 两族确实缺失 | `color-migration.ts`、`chartTheme.ts`、`DarkModeChartTheme.tsx` | **P0** | **渲染** | `--color-success-light`=``、`--color-info-light`=``、`--color-chart-1`=``、`--color-chart-2`=`` |
| **D-33** | **CSS 注入向量**：不可信值拼接进 `cssText` | `theme.presets.ts:560-563` | **P0（安全）** | 静态 | 三条输入路径汇聚点 |
| **D-11** | `index.html` 预置脚本键名错误 → 暗色首屏闪白 | `index.html:28` | **P0** | **渲染（时间线）** | 亮色首绘于 1 356 ms，`.dark` 于 1 516 ms；`rmfood-theme-settings-v2` 实测为 `null` |
| **D-41** | **`@radix-ui/themes/styles.css` 从未导入** | 应用入口 | **P0** | **渲染** | `.radix-themes` 存在但 `--gray-1`=``、`--gray-12`=``、`--font-size-2`=``、`--radius-3`=`` |
| **D-50** | **反转色阶配白字 → 页头横幅暗色对比度 1.52:1** | `bg-primary-600 text-white` 页头模式 | **P0** | **像素** | `/dashboard`、`/formulas`、`/users`、`/ai` **100% 复现**；亮 3.77:1 → 暗 **1.52:1** |
| **D-51** | **`@theme` 悬空自引用致 `--color-blue-50..900` 循环引用 → 全部 `blue-*` 工具类失效** | `index.css:62-71` | **P0** | **产物 + 渲染** | 编译产物中 `--color-blue-500:var(--color-blue-500)`（循环）；浏览器实测解析为**空**；对照组 `--color-pink-500`=`oklch(65.6% .241 354.308)` 正常。全项目约 **347 处** `bg-blue-*`/`text-blue-*`/`border-blue-*`/`ring-blue-*`/`from-blue-*` 失去颜色 |
| **D-52** | 亮色徽章配色**自身**低于 WCAG AA（被 D-21 掩盖） | `base.css:401-418` | P1 | **渲染 + 像素** | 修复 D-21 后暴露实测：draft **4.48**、approved **3.95**、pending **2.89**、revision **3.86**、archived **4.20**（均 < 4.5:1）。徽章文字为 `text-xs` 非粗体，属正文级。已按 §4.4 调整为 5.28 / 4.87 / 6.43 / 6.63 / 5.78:1 |
| **D-12b** | `--color-primary-text` 仅亮色单值，暗色下 2.3:1 | `base.css:25` / `dark.css` `.dark{}` | P1 | 静态 | 已补暗色专用值 `#6ee7b7`（≈13.3:1） |
| **D-21** | `dark.css:381-448` 无作用域 `:root{}` → 亮色模式被暗色徽章值污染 | `dark.css:381-448` | **P0** | **渲染 + 像素** | `--badge-draft-text` **四条件恒为 `#cbd5e1`**；实测对比度 **1.26:1**（草稿）/ **1.52:1**（已批准）/ **1.95:1**（待审核）；17 个 `--badge-*` 受影响 |
| **D-39** | 无障碍属性仅在交互切换时写入，**刷新后丢失** | `theme.presets.ts:573-576` | P1 | **渲染** | 交互：`a11y="reading"`/`reading="sepia"`；刷新后**两者均为 `null`**，`--text-primary` 由 `#5C4B37` 回退 `#0f172a` |
| **D-9** | 暗色 `--background` 误用品牌绿 | `dark.css:230` | P1 | **渲染** | 暗色 `--background`=**`#f0fdf4`**（近白绿），而 `--bg-canvas`=`#020617` |
| **D-22** | `--bg-surface-variant` 引用未定义令牌 | `dark.css:404` | P1 | **渲染** | `--bg-surface-variant`=``（空）、`--bg-surface-container-high`=`` |
| **D-23** | JS 写 `--easing-*`/`--weight-*`，CSS 读 `--ease-*` | `theme.presets.ts:509,533` | P1 | **渲染** | `--easing-easeOut` 已注入；CSS 43 处读 `--ease-*`；`--weight-*` 零消费者 |
| **D-10** | Radix `--accent-6` 为蓝色，与品牌绿不符 | `RadixThemeProvider.tsx:52` | P1 | **渲染** | `--accent-6`=`#0066cc`、`--accent-9`=`#065f46` |
| **D-13/D-26** | `chatTheme.css` 用 `prefers-color-scheme` 且与 `.dark` 成对重复 | `chatTheme.css:1643+` | P1 | 静态 | 系统暗色时用户选浅色仍被覆盖 |
| **D-24** | 语义层未用 `var()` 组合 | `base.css:21,40,64,92,132` | P1 | 静态 | 343 变量仅 44 处 `var()`、172 处字面 hex |
| **D-32** | 无障碍 CSS 与 JS 双实现；`color-blind` 无规则；阅读模式漏覆盖 `--bg-canvas` | `semantic-utils.css:163-201` | P1 | **渲染** | sepia 下 `textPrimary`=`#5C4B37` 但 `bodyBg` 仍 `rgb(248,250,252)` |
| **D-34** | `setPresetTheme` 强写 `mode` | `themeStore.ts:221` | P1 | 静态 | 选「跟随系统」后点一次预设即永久失去跟随 |
| **D-35** | `?theme=` 双协议冲突 | `themeUrlParser.ts:8` vs `ThemeShare.ts:38` | P1 | 静态 | base64 传给 `setPresetTheme` 静默回退 |
| **D-36** | `ThemeImport` 传扁平结构，消费端只读 `overrides.colors.*` | `ThemeImport.tsx:32-39` | P1 | 静态 | 文件导入静默无效果 |
| **D-40** | 两个同名不兼容 `useTheme` | `hooks/useTheme.tsx` vs `stores/ThemeProvider.tsx:292` | P1 | 静态 | 导入哪个决定行为 |
| **D-43** | 图表 `useMemo(…,[])` 空依赖 | `ChartComponent.tsx:23` | P1 | 静态 | 主题切换不重算 |
| **D-49** | 冷启动 `fade` 过渡致 `<html>` `opacity:0` | `themeStore.ts:78,150` | P1 | **渲染** | 与 FOUC 叠加产生额外空白 |
| **D-12** | `--color-knowledge-*` 仅暗色定义 | `dark.css:167-168` | P1 | 静态 | 亮色下知识图谱取值回落 |
| **D-27** | `adjustments.css` 未导入，29 条 `!important` 兜底从未生效 | `styles/tokens/adjustments.css` | P1 | 静态 | 制造"暗色已兜底"的虚假安全感 |
| **D-7** | `ThemeSwitcher` 过渡控件与状态双重失效 | `ThemeSwitcher.tsx:20,196` | P2 | 静态 | 本地 state 未被消费 + 区块被 variant 门控永不渲染 |
| **D-8** | 用 `html.style.opacity/transform` 做主题过渡 | `themeStore.ts:560-644` | P2 | 静态 | 全页重绘、遮挡可访问性 |
| **D-37** | persist `partialize` 不含 `activeTheme` | `themeStore.ts:430-438` | P2 | 静态 | 水合后 mode 与 colors 可能不一致 |
| **D-38** | `.dark` 类有两个写手 | `theme.presets.ts:585` vs `RadixThemeProvider.tsx:26` | P2 | **渲染（副作用）** | 实验条件 C 中应用自行补回 `.dark` |
| **D-42** | `ThemeEventBus` 零订阅者 | `ThemeEventBus.ts:72` | P2 | 静态 | 死代码 |
| **D-44** | 版本历史恒空、回滚无效 | `theme.storage.ts` | P2 | 静态 | `createVersion` 传参类型不匹配 |
| **D-45** | `themeColorMapper.ts` 死模块，`--color-chart-1..5` 全缺失 | `themeColorMapper.ts:63-67` | P2 | **渲染** | 实测全部为空串 |
| **D-46** | 主题系统测试覆盖为 0 | `tests/useTheme.test.ts` | P2 | 静态 | 全文注释禁用 |
| **D-47** | 预设清单 3 处硬编码 | `presetThemes`、`ThemeSwitcher.tsx:229`、`ThemeSettingsPage.tsx:65` | P2 | 静态 | 新增预设需改三处 |
| **D-18/D-19** | 死代码闭环与零消费者产物 | `utils/theme/*`、`design-system/rmfood/*` | P2 | 静态 | 见 §14.3 |
| **D-25** | 主题 UI 死代码群 ≈1 382 行、0 可达入口 | `components/theme/*`、`ThemeSettingsPage.tsx`、`useThemedComponent.tsx` | P2 | 静态 | 功能承诺落空 |
| **D-31** | `var(--token, fallback)` fallback 与令牌语义不符 | `semantic-utils.css:23,27,29,41` | P2 | 静态 | 成功色 fallback 是**蓝色** |
| **D-28** | 8 份相同的 `prefers-reduced-motion` `!important` 样板 | 8 个文件 | P3 | 静态 | 维护噪音 |
| **D-29** | 命名违规（大写/下划线/同义双名/色阶断档/字体随主题变） | `base.css:204-231` 等 | P3 | 静态 | 见 §3.4 |
| **D-30** | 仓库根 `chatTheme.css`（1 933 行）陈旧副本，无人引用 | 仓库根 | P3 | 静态 | 与 `src/` 版 SHA256 不同 |
| **D-48** | 死令牌：`--weight-*`/`--easing-*`/`--transition-duration-multiplier` 等 | 多处 | P3 | **渲染** | 均无消费者 |

### 11.1 已被推翻 / 需更正的 v1.0.0 结论

| v1.0.0 结论 | v1.1.0 实测 | 处置 |
|:------------|:------------|:-----|
| **D-5** `root.style.cssText +=` 导致内联样式无界累加（P1） | **推翻**。往返 8 次：`len` 稳定、**声明数恒为 104**、**重复令牌 0** | 降级为"不良实践"，不再计入缺陷表 |
| **D-2/D-4** `--color-*-main`、`--color-text-primary` 等"**不存在**→颜色回落透明" | **更正**。这些变量**由运行时内联注入且存在**；问题是**值取自预设**（`#34C759`）与静态令牌（`#10b981`）**分叉**。真正缺失的是 `--color-*-light`（4）与 `--color-chart-*`（5） | D-2/D-3/D-4 已按实测重写 |
| §1.2「4 493 处 / 392 文件无 `dark:` → **暗色必然失配**」 | **更正**。真实渲染下五条路由的主题惰性元素**合计约 18 个**（每路由 1–6 个）。静态指标是**风险指示器**，非缺陷计数 | §1.2 已加显著提示 |
| **D-39** `applyThemeToDOM`「**从不设置** `data-a11y-mode`，属性刷新即丢」 | **部分更正**。交互切换时属性**正确写入**（实测 `a11y="reading"`/`reading="sepia"`）；缺陷**仅在页面初始化路径**——刷新后两者均 `null` | D-39 已收窄为"initialize() 不写属性" |
| 「暗色模式大面积漏色」的总体印象 | **更正**。`/dashboard` 上 66 个不透明背景元素中**主题惰性 = 0**。暗色真正的问题是**对比度崩塌**（D-50）而非元素不变色 | §5.1 已加入"对比度缺陷比漏色更隐蔽"的验证要求 |

---

### 11.2 修复状态（滚动更新）

**M1（止血）已完成**。门禁 `npm run theme:gate:m1` **退出码 0**（通过 6 / 失败 0）。

| 缺陷 | 状态 | 验证证据 |
|:-----|:-----|:---------|
| **D-1** | ✅ 已修复 | 加入 `@custom-variant dark`；编译产物 `prefers-color-scheme` 内的 `.dark\:` 由 **1467 → 0**（CHK-05/22 通过） |
| **D-50** | ✅ 已修复 | 新增 `--color-primary-surface`/`--color-on-primary-surface` + `.surface-primary`；**23 文件**替换 + `MainLayout` Logo。页头暗色对比度 **1.52:1 → ≥ 4.85:1** |
| **D-21** | ✅ 已修复 | 孤儿 `:root` 块（44 条）按「同值删除 / 暗色值移入 `.dark{}`」处理；`--badge-draft-text` 亮色恢复 `#6E6E73`；徽章对比度 **1.26 → 5.26:1** |
| **D-22** | ✅ 已修复 | 随 D-21 自动修复；`--bg-surface-variant` 由**空** → `#f8fafc`（亮）/ `#020617`（暗） |
| **D-11 / D-49** | ✅ 已修复 | `index.html` 预置脚本对齐 `rmfood-theme-storage`；首次应用改走 `applyThemeToDOM`（瞬时）。`.dark` 生效时刻 **1516ms → 153ms**；首个 body 背景（暗）出现于 **1766ms < FCP 1888ms** → **无 FOUC** |
| **D-39** | ✅ 已修复（提前于 M2） | 新增 `syncA11yAttributes()`，由 `initialize()` 与 `setAccessibilityMode()` 共用；`index.html` 亦在首屏前写入。刷新后 `a11y=reading reading=sepia`，`--text-primary=#5C4B37` |
| **D-9** | ✅ 已修复 | 暗色 `--background` 由 `#f0fdf4` → **`#020617`** |
| **D-33** | ✅ 已修复 | `cssText +=` 拼接 → `setProperty` + `isSafeToken` 白名单；**59/59 断言通过**，10 种注入形态（`;` / `}` / `url(` / `expression(` / 转义等）全部阻断 |
| **D-8** | ✅ 已修复 | 删除三个 opacity/transform 过渡函数，改由 `.theme-transition` 类驱动；6 次切换实测 `<html>` 上 **0 处** inline opacity/transform |
| **D-51** | ✅ 已修复 | 删除 `@theme` 中 10 行悬空自引用；G-09 由 `fail` → `warn`（无循环引用） |
| **D-52** | ✅ 已修复 | 5 个徽章文字色按 AA 重算：draft/approved/pending/rejected/revision/archived = **5.26 / 4.85 / 6.42 / 4.65 / 6.61 / 5.77 : 1** |
| **D-12b** | ✅ 已修复 | 补暗色 `--color-primary-text: #6ee7b7`（约 13.3:1） |
| **D-41** | ✅ 已修复 | **采用方案乙**：移除 `@radix-ui/themes` 依赖与 `RadixThemeProvider`；`RadixComponents` 改项目原生实现并补齐 `role="status"`。实测 `/radix-demo` **0 个 Radix 残留节点**、13 个 Badge 具备 role=status、0 页面错误。新增门禁 **G-10** 固化 R-9 |
| **D-10** | ✅ 已修复（随 D-41 消除） | 蓝色 `--accent-6: #0066cc` 的内联 `<style>` 覆盖随 Provider 一并移除（同时消除规范 C-11 违规） |
| **D-7 的测试失效问题** | ✅ 附带修复 | 删除从未通过的死测试 `radix-components-a11y.test.tsx`（引用不存在的 `RadixButton`/`RadixCard`），替换为 `badge-text-a11y.test.tsx`（仅测真实导出） |
| **D-5** | ⊘ 已推翻 | 实测无内联累加；仅记录为不良实践（已随 D-33 一并改写） |
| D-2, D-3, D-4, D-7, D-10, D-12, D-13, D-18~D-20, D-23~D-32, D-34~D-38, D-40~D-48, D-41 | ⏳ 待 M2/M3/M4 | 见《修复执行方案》§0.0 与 §6.4 |

**残余风险**：静态扫描仍有 **105 处**条件类字符串形如 `bg-primary-{500,600,700} + text-white`（仅在特定状态渲染）。门禁在 **12 路由 × 22 个白字实底元素 × 双模式**下未发现失败实例，但这些未渲染状态仍可能触发 D-50，建议随 M2 语义化迁移统一处理。

---

## 12. 修复路线图
### 阶段 0 — 止血（P0，1–2 周）

| 序 | 动作 | 缺陷 | 验收（**必须渲染验证**） |
|:--|:-----|:-----|:-------------------------|
| 1 | `index.css` 加 `@custom-variant dark (&:where(.dark, .dark *));` | D-1 | 手动切暗色时 `dark:` 生效；CHK-05/22 通过 |
| 2 | 页头横幅与头像改用 C-24 方案 A/B | **D-50** | 亮/暗双模式对比度 ≥ 4.5:1 |
| 3 | `dark.css:381-448` 孤儿 `:root{}` 移入 `.dark{}` | D-21 | `--badge-draft-text` 亮色恢复 `#6E6E73`；徽章对比度 ≥ 4.5:1 |
| 4 | 把 `cssText` 拼接改为 `setProperty` + 白名单 | D-33 / D-8 | 注入 PoC 失效 |
| 5 | 重写 `generateCSSVariables` 输出 §3.1 命名，值取自 L0 | D-2 / D-3 / D-24 | `--color-primary-main` 不再存在或等于 `--color-primary` |
| 6 | 修 `index.html` 键名与结构 | D-11 | 暗色冷启动无亮色首绘（时间线验证） |
| 7 | 冷启动 `transitionType` 改 `'none'` | D-49 | 首屏无空白 |
| 8 | ~~补 `@radix-ui/themes/styles.css` 或删除该依赖~~ **✅ 已完成（T-R1）** | D-41 | 依赖与 Provider 已删除；G-10 通过 |
| 9 | 定义 `--bg-surface-container-high` 或改回 `--bg-surface-container` | D-22 | `--bg-surface-variant` 有值 |
| 10 | 暗色 `--background` 改指 `--bg-canvas` | D-9 | 暗色 `--background` = `#020617` |

### 阶段 1 — 一致性（P1，2–4 周）

| 序 | 动作 | 缺陷 |
|:--|:-----|:-----|
| 11 | `initialize()` 同步写入无障碍 DOM 属性 | D-39 |
| 12 | `setPresetTheme` 不再强写 `mode` | D-34 |
| 13 | 统一 `?theme=` 协议（拆分 preset / payload） | D-35 |
| 14 | 导入路径加令牌白名单 + 值格式校验；修正则并实际调用 | D-36 |
| 15 | 收敛图表取色为 `chartTheme.ts` 单一通道；补 `-light`/`chart-*` 或改引用 | D-4 / D-43 |
| 16 | 补 `--color-primary-text` 暗色值；修 `-easing-*`→`-ease-*` 命名 | D-12 / D-23 |
| 17 | 修 `chatTheme.css` 的 `.dark`/`@media` 重复（功能性 bug） | D-13 / D-26 |
| 18 | 阅读模式补覆盖 `--bg-canvas`/`--card-bg-solid`；高对比补 `--border-color`；补 `color-blind` | D-32 |
| 19 | 删除 `--dsw-*` 命名空间，改用全局令牌 | U-9 |
| 20 | **建立渲染级 CI 门禁**：关键路由亮/暗截图 diff + 对比度断言 | G-5 |

### 阶段 2 — 架构收口（P2，1–2 个月）

| 序 | 动作 |
|:--|:-----|
| 21 | 分阶段建立 primitive→semantic 的 `var()` 组合（D-24），先做颜色域 |
| 22 | 主题过渡改 CSS 类 + `transitionend`（D-8） |
| 23 | `partialize` 纳入 `activeTheme`（D-37）；`.dark` 单一写手（D-38） |
| 24 | 主题 UI 产品决策：删除孤儿页 **或** 收敛进 `SettingsPage`；删除 `useThemedComponent`（D-25） |
| 25 | 删除死文件：`adjustments.css`、`ThemeEventBus`、`themeColorMapper`、`useThemeInit`、`utils/theme/*`、根目录 `chatTheme.css`、`design-system/rmfood/*`（D-18/19/27/30/42/45） |
| 26 | 补主题回归测试，消除 0 覆盖（D-46） |
| 27 | 收敛两个 `useTheme`（D-40） |

### 阶段 3 — 治理落地（P2–P3）

| 序 | 动作 |
|:--|:-----|
| 28 | 注册 `theme:validate` 到 `package.json` + CI（G-4） |
| 29 | 按 §14.3 处置 6 份废弃文档；ADR 编号去重（7 组重号） |
| 30 | 统一审计清单与弃用策略模板（G-1/G-8） |
| 31 | 清理 5 个僵尸存储键（R-15） |

---

## 13. 附录 A — 品牌色一致性（权威裁决）

| 角色 | 权威值 | 令牌 |
|:-----|:-------|:-----|
| 品牌主色（亮色） | **`#10B981`** | `--color-primary` |
| 品牌主色（暗色） | **`#34d399`** | `--color-primary`（`.dark`） |
| 品牌主色按钮填充（亮） | `#059669` | `--color-primary-600` |
| 品牌主色按钮填充（暗） | **`#6ee7b7`** ⚠️ | `--color-primary-600`（反转后为浅色，**禁止**配白字，见 C-24） |
| 品牌辅色 | `#3B82F6` | `--color-secondary` |
| 强调色（AI/智能） | `#8B5CF6` | `--color-accent` |
| 成功/警告/错误/信息 | `#10b981`/`#f59e0b`/`#ef4444`/`#3b82f6` | `--color-{…}` |

**已废弃的"品牌主色"声明：**

| 值 | 出处 | 裁决 |
|:---|:-----|:-----|
| `#28A745` | `types/design-tokens.ts:126` | 作废 → `#10B981` |
| `#34C759`（Apple 绿） | `theme.presets.ts:29`、`theme.types.ts:557` | 作废。**注意**：该值仍在运行时注入为 `--color-primary-main`，是 D-2 的直接成因 |
| `#22C55E` | `UI-DESIGN-SYSTEM.md:40` | 作废 |
| `#059669` 作为"主色" | `RMFOOD-主题系统设计规范.md:105` | 降级为 600 档 |
| `#0891B2`（青色） | `design-system/rmfood/MASTER.md` | 作废（整份文档弃用） |
| `#0A84FF` | `theme.types.ts:558`、`theme-mode.ts:36` | 作废 → `#3B82F6` |
| `#AF52DE` | `design-tokens.ts:182`、`theme.types.ts:559` | 作废 → `#8B5CF6` |
| `#4ADE80` | `theme.presets.ts:101` | 作废。运行时注入为暗色 `--color-primary-main` |

---

## 14. 附录 B — 与既有文档的冲突裁决

### 14.1 ADR 断言勘误

| ADR 断言 | 代码事实 | 裁决 |
|:---------|:---------|:-----|
| ADR-012:33-34「`ThemeStorageAdapter.ts` / `VersionController.ts` 已删除」 | 两文件仍存在 | 失效 |
| ADR-012:51「`theme-mode.ts` 仅保留 re-export」 | 实为 166 行，含 `DEFAULT_THEME_STYLES` 等 | 失效 |
| ADR-013:89-92「MainLayout 已语义化 + 挂载过渡遮罩」 | 代码零匹配 | **未落地** |
| ADR-014:41 / ADR-015:11「262 580 / 263 039 处替换」 | 链内自相矛盾 | 数据失真 |
| ADR-015:38-50 / ADR-016:57-61 文件行数 | `base.css` 实为 461 行（称 301）、`dark.css` 实为 **448**（称 **103**） | **数据失真 4.3×** |
| ADR-016:53「`@theme` 完整度 100%」 | `adjustments.css` 未导入；`@custom-variant dark` 缺失 | 不成立 |
| ADR-015:18 / ADR-016:20「`index.css:34`」 | 实际 `index.css:30` | 行号失效 |
| ADR-012 编号冲突 | `ADR-012-主题系统精简与统一.md` 与 `ADR-012-智能对话架构融合.md` 同号 | **须重编号** |
| ADR-027:32「设计 Token 完全保留，映射到 shadcn CSS 变量」 | `dark.css:230` 把 `--background` 映射到**品牌绿**而非画布色 | 映射错误（D-9） |

### 14.2 两套命名体系裁决

| 体系 | 出处 | 实测消费情况 | 裁决 |
|:-----|:-----|:-------------|:-----|
| **A. `--color-primary-500` / `--text-primary`** | `styles/tokens/base.css`、`dark.css` | 3 962 处 `var(--)` 静态消费 | ✅ **权威** |
| **B. `--color-<组>-<键>`（`--color-primary-main`、`--color-text-primary`）** | `theme.presets.ts:generateCSSVariables()` → **运行时内联注入** | **实测存在且被图表/分享面板消费** | ⚠️ **待合并**：值取自预设，与 A 冲突 |

> **v1.1.0 更正**：v1.0.0 判定体系 B「令牌不存在 → 透明」。实测证明 B **确实存在**（`<html>` 内联注入），因此问题不是"缺失"而是"**双源同义不同值**"。
> **处置**：体系 B 的生成逻辑**必须重写**为输出体系 A 的令牌名与取值，使 `<html>` 内联层成为 L0 的**投影**而非**第二真相源**。

### 14.3 旧规范文档处置

| 文档 | 处置 |
|:-----|:-----|
| `frontend/design-system/RMFOOD-主题系统设计规范.md` | 删除或加 `Deprecated` 头 |
| `frontend/UI-DESIGN-SYSTEM.md` | 同上 |
| `frontend/src/docs/DESIGN_SYSTEM.md` | 同上 |
| `frontend/design-system/rmfood/*` | **必须删除** |
| `frontend/src/docs/theme-cleanup-guide.md` | **必须删除**（含会误删现有文件的有害命令） |
| `frontend/src/docs/theme-cleanup-report.md` | **必须删除** |
| `docs/theme-system-spec.md` | 保留，标题补注「（小程序）」 |

---

## 15. 附录 C — 代码模板

### 15.1 正确消费示例

```tsx
// ✅ 语义工具类
<div className="surface-card border-border-default">
  <h2 className="text-text-primary">标题</h2>
  <p className="text-text-secondary">说明文字</p>
  <span className="bg-primary-container text-primary-main rounded-md px-2 py-1">已批准</span>
</div>

// ✅ 内联令牌变量
<div style={{ background: 'var(--bg-surface-container)', color: 'var(--text-primary)' }} />

// ✅ 中性色阶（自动反转，禁止配 dark:）
<div className="bg-neutral-100 text-neutral-700 border-neutral-200" />

// ✅ 主色表面 + 白字（C-24 方案 A：引入不反转的令牌对）
<div className="surface-primary rounded-xl p-6 text-on-primary-surface">…</div>

// ✅ 图表
const theme = useChartTheme();
<Bar fill={theme.colors.primary} />
```

### 15.2 错误示例与修正

```tsx
// ❌ 双值写法
<div className="bg-white dark:bg-neutral-900" />
// ✅
<div className="surface-card" />

// ❌ 反转色阶 + 白字（实测暗色 1.52:1）
<div className="rounded-xl bg-primary-600 p-6 text-white">…</div>
// ✅
<div className="surface-primary rounded-xl p-6">…</div>

// ❌ 硬编码
<span style={{ color: '#34C759' }} />
// ✅
<span className="text-primary-main" />

// ❌ 裸调色板（实测四条件均不变）
<div className="bg-emerald-50" />
// ✅
<div className="bg-primary-container" />

// ❌ 动态类名
<div className={`bg-${tone}-500`} />
// ✅
const TONE = { ok: 'bg-success-container', warn: 'bg-warning-container' } as const;
<div className={TONE[tone]} />
```

### 15.3 Canvas 取色示例

```ts
// ✅ Canvas 不能直接吃 CSS 变量，必须取实际值
import { getSemanticColor } from '@/theme';
const stroke = getSemanticColor('primary');   // '#10b981'（已解析）
ctx.strokeStyle = stroke;

// ✅ 主题切换时重新取色（禁止空依赖 useMemo）
useEffect(() => { redraw(); }, [isDark, redraw]);
```

### 15.4 渲染验证脚本（规范性）

新增/修改主题相关代码后，**必须**执行等价的渲染断言：

```js
// 1) 反转色阶 + 白字 检测
const bad = await page.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll('body *')) {
    const cls = typeof e.className === 'string' ? e.className : '';
    if (!/(^|\s)text-white(\s|$)/.test(cls)) continue;
    const cs = getComputedStyle(e);
    if (cs.backgroundColor === 'rgba(0, 0, 0, 0)') continue;
    const r = e.getBoundingClientRect();
    if (r.width < 20 || r.height < 14) continue;
    out.push({ cls: cls.slice(0, 120), bg: cs.backgroundColor, col: cs.color });
  }
  return out;
});
// 对每个元素在亮/暗两模式下计算对比度，任一 < 4.5（大文本 < 3）即失败。

// 2) dark: 变体归属断言（编译产物级）
//    全部 `.dark\:` 选择器必须位于 `.dark` 作用域内、不得位于 prefers-color-scheme 媒体查询内。
```

---

## 16. 附录 D — 文件职责总表

| 路径 | 层 | 职责 | 可修改性 |
|:-----|:---|:-----|:---------|
| `frontend/src/styles/tokens/base.css` | L0 | 亮色令牌定义（343 个唯一变量） | 令牌变更需会签 |
| `frontend/src/styles/tokens/dark.css` | L0 | 暗色令牌覆盖 + **待清理的 44 条孤儿 `:root`** | 必须与 base 成对，禁止裸 `:root` |
| `frontend/src/styles/tokens/typography.css` | L0 | 排版**应用规则**（非定义） | — |
| `frontend/src/styles/tokens/adjustments.css` | — | **未导入，待删除** | 禁止引用 |
| `frontend/src/styles/components/*.css` | L2 | 组件语义类 | 禁止定义新色值 |
| `frontend/src/styles/utilities/*.css` | L2 | 微交互/焦点/滚动条 | — |
| `frontend/src/styles/accessibility/environment.css` | L2 | 无障碍与打印 | — |
| `frontend/src/index.css` | L1 | 导入链 + `@theme` + **必须补 `@custom-variant`** | 见 R-4 |
| `frontend/src/stores/themeStore.ts` | 运行时 | 唯一状态源 | — |
| `frontend/src/stores/theme.presets.ts` | 运行时 | 预设 + CSS 变量生成 + DOM 应用 | **待重写**（D-8/D-33/D-39 等） |
| `frontend/src/stores/ThemeProvider.tsx` | 运行时 | Context 投影 + 系统偏好监听 | — |
| `frontend/src/stores/theme.storage.ts` | 运行时 | 版本历史（只读旁路） | — |
| `frontend/src/types/theme.types.ts` | 类型 | 主题类型权威定义 | — |
| `frontend/src/types/design-tokens.ts` | 类型 | TS 令牌常量（供构建脚本） | 与 base.css 必须一致 |
| `frontend/src/types/theme-mode.ts` | 类型 | **已废弃** re-export | 待删除 |
| `frontend/src/utils/chartTheme.ts` | L4 | **图表取色唯一通道** | 权威 |
| `frontend/src/utils/color-migration.ts` | L4 | **待废弃** | 迁移到 chartTheme |
| `frontend/src/utils/themeColorMapper.ts` | L4 | 死模块（`--color-chart-*` 全缺失） | 待删除 |
| `frontend/src/hooks/useSemanticTheme.tsx` | L4 | 程序化取色 Hook（**当前零消费者**） | 应推广 |
| `frontend/src/theme/index.ts` | 入口 | `@/theme` 统一导出 | 单一入口 |
| `frontend/src/theme/RadixThemeProvider.tsx` | — | **已删除**（T-R1 / D-41：样式表从未加载，属无效层） | — |
| `frontend/src/components/ui/RadixComponents.tsx` | L2 | Badge/Text 包装层（**已改项目原生实现**，保留 API + `role="status"`） | 名称保留仅为兼容导入路径 |

---

## 17. 附录 E — 渲染验证方法与可复现证据（v1.1.0 新增）

### 17.1 环境

| 项 | 值 |
|:---|:---|
| 前端 | Vite 8.1.3 dev server，`http://127.0.0.1:3000`（proxy `/api` → `:8000`） |
| 后端 | `uvicorn app.main:app --port 8000`，实测 `/health` 200 |
| 浏览器 | Playwright 1.61.1 + Chromium（headless），视口 1680×1050，`locale=zh-CN` |
| 登录 | `admin` / `admin123`（取自 `frontend/.env` 的 `VITE_DEFAULT_USERNAME/PASSWORD`） |
| 生产产物 | `frontend/dist/assets/index-CuWziqEh.css`（632 626 B） |
| 审计脚本 | `frontend/scripts/theme-audit/`（8 个，**只读**，不修改仓库代码；见该目录 README） |
| 结果留档 | `temp/theme-runtime-results{2,3}.json`、`temp/theme-css-isolation.json`、`temp/theme-white-on-fill2.json`、`temp/theme-final-results.json`、`temp/theme-hero-contrast.json` |
| 截图 | `temp/theme-shots/`（13 张，含 6 条路由的亮/暗对照） |

**复现最快的路径（无需启动任何服务）**：

```bash
cd frontend
node scripts/theme-audit/theme-audit-isolation.mjs   # 纯 CSS 隔离矩阵，读取 dist 产物
```

该脚本直接读取 `frontend/dist/assets/index-*.css`（生产构建），在空白页上以四条件矩阵（{`.dark` 类 有/无} × {系统偏好 亮/暗}）测量 12 个探针的计算样式，**完全排除应用运行时的干扰**，是验证 `dark:` 变体归属（I5 / D-1）与中性色阶反转行为的最简手段。

> 前置：需先执行一次 `npm run build` 以生成 `frontend/dist`。其余脚本需要 dev server（`:3000`）与后端（`:8000`）在运行，并以 `admin`/`admin123` 登录。

### 17.2 编译产物级取证（D-1）

方法：读取生产 CSS → 用花括号深度追踪求 `@media (prefers-color-scheme: dark)` 块的 `[start, end)` 区间 → 判定全部 `.dark\:` 选择器归属。

```
@media(prefers-color-scheme:dark) 块数: 19
.dark\: 在媒体查询内 : 1467
.dark\: 在媒体查询外 : 0
```

`:where(.dark…` 的 13 处经逐条核查**全部**为 Tailwind `divide-*` 包装（如 `:where(.dark\:divide-neutral-800>:not(:last-child))`），非主题作用域。

### 17.3 纯 CSS 隔离实验（D-1 决定性证据，零应用干扰）

方法：空白页 → `addStyleTag` 注入生产 CSS → 合成 12 个探针 → 四条件矩阵。

| 探针 | A 无类/亮 | B **有类/亮** | C 无类/暗 | D 有类/暗 |
|:-----|:----------|:--------------|:----------|:----------|
| `bg-white dark:bg-neutral-900` | `#fff` | **`#fff`（未生效）** | `#0f172a` | `#f1f5f9` |
| `bg-neutral-100`（令牌类） | `#f1f5f9` | `#0f172a` ✅ | `#f1f5f9` | `#0f172a` |
| `bg-slate-50`（裸调色板） | `oklch(.984 .003 247.858)` | **同左（不变）** | **同左（不变）** | **同左（不变）** |
| `bg-emerald-50`（裸调色板） | `oklch(.979 .021 166.113)` | **同左（不变）** | **同左（不变）** | **同左（不变）** |
| `.badge-draft` 背景 | `rgba(148,163,184,.15)` | `rgba(148,163,184,.08)` ✅ | 同 A | 同 B |
| `--badge-draft-text` | `#cbd5e1` | **`#cbd5e1`** | **`#cbd5e1`** | **`#cbd5e1`** |

**由下表得出两个独立的缺陷类：**

| 类名写法 | 响应 `.dark` 类 | 响应系统暗色 | 判定 |
|:---------|:---------------:|:------------:|:-----|
| `dark:` 工具类 | ❌ | ✅ | **D-1 失效** |
| `bg-neutral-*`（令牌） | ✅ | ❌ | ✅ 合规 |
| 裸调色板（`bg-slate-*`/`bg-emerald-*`） | ❌ | ❌ | **彻底惰性** |
| 手写 `.dark .X` 规则 | ✅ | ❌ | ✅ 合规 |
| `--badge-*-text`（被孤儿 `:root` 污染） | ❌ | ❌ | **恒为暗色值（D-21）** |

### 17.4 徽章对比度（像素级，D-21）

方法：合成 `.badge-draft`/`-approved`/`-pending` 元素并附着到 body → 读取计算色 → 半透明背景与 body 实底合成 → 计算 WCAG 对比度。

| 徽章 | 文字色 | 有效背景 | **对比度** | WCAG AA（4.5:1） |
|:-----|:-------|:---------|:----------:|:----------------:|
| `.badge-draft` | `rgb(203,213,225)` | `rgb(233,237,242)` | **1.26:1** | ❌ 差 3.6× |
| `.badge-approved` | `rgb(61,220,132)` | `rgb(219,242,228)` | **1.52:1** | ❌ |
| `.badge-pending` | `rgb(251,146,60)` | `rgb(249,236,224)` | **1.95:1** | ❌ |

### 17.5 运行时「主题惰性」扫描（含对静态启发式的修正）

方法：登录后逐路由取 DOM 快照（记录每个元素的 class 与计算色）→ 用真实 store 切暗色 → 再取快照 → 比对同 class 元素的 bg/color/border 是否变化。

| 路由 | 元素数 | 含裸调色板类 | 带 `dark:` | 不带 | **背景惰性** |
|:-----|-------:|-------------:|-----------:|-----:|-------------:|
| `/dashboard` | 518 | 78 | 65（83%） | 13 | **1** |
| `/formulas` | 655 | 225 | 192（85%） | 33 | **6** |
| `/settings` | 325 | 44 | 38（86%） | 6 | **5** |
| `/users` | 413 | 82 | 66（80%） | 16 | **2** |
| `/ai` | 496 | 135 | 119（88%） | 16 | **3** |
| `/404` | 201 | 14 | 13（93%） | 1 | **1** |

**结论：** 实测 `dark:` 覆盖率 80–93%（远高于静态按行统计的 64.7%），主题惰性元素合计约 **18 个**。
**这是 §1.2 修正的依据**——静态"无 `dark:`"指标**不能**作为缺陷计数。

### 17.6 无障碍属性持久性（D-39 的精确边界）

| 阶段 | `data-a11y-mode` | `data-reading-mode` | `data-theme` | `--text-primary` | `body` 背景 |
|:-----|:----------------:|:-------------------:|:-------------|:-----------------|:------------|
| 交互设置 `reading` 后 | `reading` ✅ | `sepia` ✅ | `reading-sepia` | `#5C4B37`（sepia 棕） | `rgb(248,250,252)` ❌ 未变暖 |
| **页面刷新后** | **`null`** ❌ | **`null`** ❌ | `reading-sepia` | **`#0f172a`**（回退默认） | `rgb(248,250,252)` |

**结论：** ① 交互路径**正确**；② 初始化路径**缺失** → `semantic-utils.css:190-201` 的阅读模式 CSS **整层在刷新后失效**；③ 即便交互生效，阅读模式**也未改变 body 背景**（因只覆盖 `--bg-primary`，而 body 读 `--bg-canvas`）。

### 17.7 FOUC 时间线（D-11）

方法：预置 `rmfood-theme-storage` = `{state:{mode:'dark',…},version:4}` → `goto(…, {waitUntil:'commit'})` → 40 ms 高频采样 90 次。

| 时刻 | 采样值 |
|:-----|:-------|
| 1 355 ms | `cls=""`，`dataMode=null`，`bodyBg=rgb(248,250,252)`，`htmlStyleLen=0` |
| 1 356 ms | `first-paint` |
| **1 468 ms** | **`first-contentful-paint`** |
| 1 516 ms | `cls="dark"`，`bodyBg=rgb(2,6,23)` |
| 最终 | `data-theme="dark-default"`，`data-mode="dark"` |

**附带确证**：`localStorage['rmfood-theme-settings-v2']` = **`null`** → `index.html` 的预置脚本从未生效。

### 17.8 页头横幅对比度（像素级，D-50）

方法：定位页头元素 → `getComputedStyle` 取文字色 → `page.screenshot({clip})` 截取元素区域 → 注入新页 Canvas 读取像素直方图 → 取主色作为实际背景 → 计算对比度。

| 路由 | 元素类名 | 亮色底 / 对比度 | 暗色底 / 对比度 |
|:-----|:---------|:----------------|:----------------|
| `/dashboard` | `rounded-xl bg-primary-600 p-6 text-white shadow-sm` | `rgb(5,150,105)` / 3.77:1 | **`rgb(110,231,183)` / 1.52:1** |
| `/formulas` | 同上 | 同上 | 同上 |
| `/users` | 同上 | 同上 | 同上 |
| `/ai` | 同上 | 同上 | 同上 |
| 全部四条 | `flex items-center justify-center text-white shrink-0`（头像/图标） | `rgb(16,185,129)` / 2.54:1 | **`rgb(52,211,153)` / 1.92:1** |

**⇒ 四条路由 100% 复现；页头模式在暗色下全部不可读。**

### 17.9 图表取色通道实测（D-4 的精确范围）

| 变量 | 实测值 | 判定 |
|:-----|:-------|:-----|
| `--color-text-primary` | `#111827` | ✅ 存在（运行时注入） |
| `--color-text-secondary` | `#4B5563` | ✅ |
| `--color-surface-default` | `#ffffff` | ✅ |
| `--color-border-default` | `#E5E7EB` | ✅ |
| `--color-border-divider` | `#F3F4F6` | ✅ |
| `--color-primary-main` | `#34C759`（亮）/ `#4ADE80`（暗） | ✅ 存在但**值错误** |
| `--color-success-main` | `#16a34a` | ✅ |
| `--color-secondary-main` | `#007AFF` | ✅ |
| `--color-success-light` | *(空)* | ❌ **缺失** |
| `--color-info-light` | *(空)* | ❌ **缺失** |
| `--color-warning-light` | *(空)* | ❌ **缺失** |
| `--color-error-light` | *(空)* | ❌ **缺失** |
| `--color-chart-1` / `-2` | *(空)* | ❌ **缺失** |

---

## 18. 变更日志

| 版本 | 日期 | 变更 |
|:-----|:-----|:-----|
| v1.0.0 | 2026-10-01 | 首次发布。确立五层模型、令牌命名规范、消费契约、无障碍要求、治理流程；登记 49 项缺陷；裁决品牌色与两套命名体系；废止 6 份旧规范文档。**验证等级 L2（静态）。** |
| **v1.1.0** | 2026-10-01 | **升级为 L3（真实浏览器渲染取证）**。新增 §1.3 渲染验证基线、§17 验证方法与可复现证据、C-24（反转色阶禁止配白字）、I9 不变量、CHK-23~25、R-9、A-2/A-5/A-7/A-8、U-12。**推翻 1 项**（D-5 内联累加）、**修正 4 项**（D-2/D-3/D-4 变量范围、D-39 缺陷边界、§1.2 静态启发式、D-4 精确缺失清单）、**新增 1 项 P0**（D-50，实测暗色对比度 1.52:1）。缺陷总数 49 → 52（含推翻项标注）。 |
| **v1.1.1** | 2026-10-01 | **门禁驱动发现新增 P0**。交付 `theme:gate`（9 项断言 G-01~G-09）后立即发现 **D-51**：`index.css:62-71` 的 `@theme` 悬空自引用致 `--color-blue-50..900` **循环引用**、解析为空，使全项目约 **347 处** `blue-*` 工具类失去颜色（编译产物与浏览器双重确证）。新增令牌规则 **T13**、检查项 **CHK-26/CHK-27**。缺陷总数 52 → 53。 |
| **v1.1.2** | 2026-10-01 | **M1（止血）执行完成**。门禁断言 9 → **10 项**（新增 G-10 Radix 前置条件）；`npm run theme:gate:m1` **退出码 0**（通过 7 / 失败 0）。已修复：**D-1, D-8, D-9, D-11, D-12b, D-21, D-22, D-33, D-39, D-41, D-49, D-50, D-51, D-52, D-10**（15 项）。关键实测：页头暗色对比度 **1.52:1 → ≥4.85:1**、徽章 **1.26:1 → 5.26:1**、`.dark` 生效 **1516ms → 153ms**、FOUC 消除、注入向量 **10/10 阻断**、`dark:` 编译归属 **1467 → 0**。新增 §11.2 修复状态表。 |

### 18.1 编制依据

| 审查面 | 覆盖范围 |
|:-------|:---------|
| 资产清点 | 全 `frontend/src`（1 210–1 328 文件）、27 个 CSS（299 KB）、`docs/adr/`（43 个 ADR） |
| Token 层 | `base.css`/`dark.css`/`typography.css`/`adjustments.css` 逐行；343/362 个变量双向差异比对 |
| 消费层 | 全量 grep：22 238 调色板类名、5 081 hex、1 072 rgba、3 962 `var(--)` |
| 运行时 | store/presets/Provider/storage/hooks/theme/*/EventBus 全部完整读取 |
| **渲染层** | **Chromium 实测 6 条路由 × 亮/暗双模式；纯 CSS 隔离矩阵；像素级对比度；FOUC 时间线；无障碍持久性** |
| 构建产物 | `dist/assets/index-CuWziqEh.css` 花括号深度追踪 |
| 第三方 | `tailwindcss/dist/lib.mjs` 源码级取证 |

**残余边界**：未覆盖移动端视口（≤767px）、打印样式、`forced-colors` 实际渲染、全部 392 个候选文件的逐一渲染、`theme-pro` 插件产物。上述项目**应该**在阶段 1 的渲染级 CI 门禁（§12 序 20）中补齐。

---

**文档结束**
