# RMFOOD 主题系统设计规范（官方）

| 项目 | 内容 |
|:-----|:-----|
| **文档编号** | RMFOOD-DS-THEME-001 |
| **标题** | RMFOOD 配方研发平台 — 主题系统设计规范 |
| **版本** | **v1.1.9** |
| **状态** | 正式发布（Normative） |
| **适用平台** | Web 前端（`frontend/`，React 19 + Vite 8 + Tailwind CSS v4） |
| **不适用范围** | 微信小程序（`miniprogram/`，另见 `docs/theme-system-spec.md`） |
| **取代** | `frontend/design-system/RMFOOD-主题系统设计规范.md`、`frontend/UI-DESIGN-SYSTEM.md`、`frontend/src/docs/DESIGN_SYSTEM.md`、`frontend/design-system/rmfood/*`、`frontend/src/docs/theme-cleanup-*.md` |
| **上游决策** | ADR-012 ~ ADR-016（主题系统演进链）、ADR-027（Radix UI / shadcn 迁移） |
| **发布日期** | 2026-10-01 |
| **验证等级** | **L3 — 真实浏览器渲染取证**（见 §1.3、§17） |
| **维护者** | 前端架构组 |

> **v1.1.3 相对 v1.1.2 的关键变化（状态列全量刷新）**：M1 修复的 15 项缺陷此前只写入 §11.2，本版把它们同步到 §2~§17 全部受影响的现状陈述、检查清单、路线图、文件职责表与证据附录，使本规范重新成为「当前代码状态」的可信基线。同时：门禁断言 ID 由 `G-nn` 改名为 **`GATE-nn`** 以消除与治理条款 `G-1~G-9` 的前缀冲突，并在 §10.3 逐条列出；补齐 M1 新增令牌/语义类的登记；清除 §7.10 与 R-4 悬空引用；统一缺陷计数口径。
>
> **v1.1.4 相对 v1.1.3 的关键变化（门禁扩展 + 3 项新缺陷修复）**：
> 对 v1.1.3 做**对抗性复核**时发现 3 项此前未察觉的缺陷并已修复：
> **D-54**（P0）`.surface-primary:hover` 暗色对比度 **1.13:1** —— 比 D-50 原缺陷还差，是 D-50 修复自身引入的回归；
> **D-55**（P0）`@theme` 未桥接 `secondary` 整族 → 104 处 `bg-secondary-*` 类**完全不生成**，主按钮在亮暗两模式下都无背景色；
> **D-56**（P1）`info` 族不是色阶、`error` 缺 950 档 → 14 个类不生成。
> 门禁断言 **10 → 12 项**：新增 **GATE-11**（表面令牌含 hover 的对比度）与 **GATE-12**（源码使用的品牌色阶类必须在产物中生成）—— 正是这两条断言分别锁死了上述两类盲区。
> 同时修正 v1.1.3 的 4 处**自我错误**：§16 的 `lint-staged` 断言（实际**存在**配置，只是未接入门禁）、GATE 断言计数、T13 段内自相矛盾（同段既称「已清零」又称「10 个循环引用」）、§2.1 运行时注入数字（104 → 实写 85）。
> 新增 D-53（10 个 camelCase 令牌名被安全白名单拒绝，待 M2）、CHK-28。
>
> **v1.1.5 相对 v1.1.4 的关键变化（M2 一致性落地）**：
> 完成 M2 的 7/8 任务，关闭 **13 项缺陷**：**D-2 / D-3**（品牌色双源收敛，同义不同值 **32 → 0**）、
> **D-4 / D-43 / D-45**（图表取色单通道）、**D-13 / D-26**（对话区暗色改由 `.dark` 驱动，全 src `@media` 块 **22 → 0**）、
> **D-23**（缓动/字重命名对齐）、**D-32**（无障碍覆盖三处缺口 + `color-blind` 按 A-15 落地）、
> **D-34~D-38 / D-40**（状态一致性与 `useTheme` 唯一化）、**D-57**（无障碍同步路径补全）。
> 其中 **T-B2a 解锁了长期失效的自定义主题功能** —— 此前 `colors.primary.main` 只写入 `--color-primary-main`，
> 而 CSS 消费者读 `--color-primary`，导致自定义主题 / 无障碍变体 / 文件导入对品牌色**完全无效**。
> 门禁从 9 项 → **12 项**，并于本版**首次全绿**（通过 11 / 失败 0 / 退出码 0）。
> 同步更新 §10.1 检查清单、§11.2 状态表与 §12 路线图。
>
> **历史版本摘要**
> - **v1.1.2**：M1（止血）执行完成，修复 15 项缺陷（D-1/8/9/10/11/12b/21/22/33/39/41/49/50/51/52），门禁 M1 范围退出码 0。
> - **v1.1.1**：交付 `theme:gate` 门禁后立即发现 P0 **D-51**（`@theme` 悬空自引用致 `--color-blue-50..900` 循环引用，约 347 处 `blue-*` 工具类失去颜色），新增 T13。
> - **v1.1.0**：全部缺陷升级为**真实 Chromium 渲染实测**复核。**推翻 1 项**（D-5 内联累加）、**更正 4 项**（D-2/D-3/D-4 变量缺失范围、D-39 缺陷边界、§1.2 静态启发式、D-4 精确缺失清单）、**新增 1 项 P0**（D-50 反转色阶配白字，实测 1.52:1）。
> - **v1.0.0**：首次发布（静态审查）。
>
> 详见 §18。

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
| ADR-027、`docs/superpowers/specs/2026-08-2{3,4}-radix-ui-*.md` | 部分有效 | 仅 Radix 桥接章节有效，见 §7.4 |
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

> ⚠️ **时点声明**：本节数据采集于 **2026-10-01、M1 修复之前**。M1 改动了 23 个页面文件（页头替换为 `.surface-primary`）与令牌文件，故「硬编码调色板类名」等计数**已略有下降**（每条页头替换约减少 2 个调色板类名）。
> **本节的用途是风险画像，不是合规判据**——真实合规结论请用 §10 检查清单与 §10.3 门禁断言。

审查日期 2026-10-01（**M1 前**），扫描 `frontend/src`（排除 `node_modules`、`dist*`、测试、`docs`），共 1 210–1 328 个 `.ts/.tsx/.css` 文件：

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
│  · @custom-variant dark → 把 dark: 变体绑定到 .dark 类    │  ← ✅ 已配置（v1.1.2 / D-1）
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
│  运行时注入：生成 104 条，实际写入 85 条（约 2.0 KB）      │
│  其中与 L0 同名 32 条，值不同者 16（亮）/ 27（暗）→ D-3    │
└──────────────────────────────────────────────────────────┘
```

### 2.2 关键不变量（Invariants）

| # | 不变量 | 校验方式 | 实测状态 |
|:--|:-------|:---------|:---------|
| **I1** | 颜色令牌只在 `base.css` 与 `dark.css` 中定义 | §10 CHK-01 | ⚠️ 运行时另在 `<html>` 内联注入一套（D-3） |
| **I2** | 每个在 `base.css` 中定义的颜色令牌，`dark.css` 必须提供对应值 | §10 CHK-02 | ✅ 已满足（M1）。修复前：44 条暗色值被无作用域 `:root` 声明污染，影响 17 个 `--badge-*`（其中 21 个值与亮色定义冲突）→ D-21 |
| **I3** | `dark.css` 中新增的令牌必须同时存在于 `base.css` | §10 CHK-03 | ❌ 22 个单边定义（D-12 等） |
| **I4** | 组件层不得出现 hex/rgb/hsl 颜色字面量 | §10 CHK-01 | ❌ 5 081 处 |
| **I5** | `dark:` 前缀必须由 `.dark` 类驱动，而非 `prefers-color-scheme` | §7.2 / GATE-03 | ✅ 已满足（M1）。修复前：1 467/1 467 个 `.dark\:` 选择器全部位于媒体查询内 → D-1 |
| **I6** | 运行时不得写入 §3 命名规范之外的令牌 | §7.3 | ❌ 违反（D-3/D-23） |
| **I7** | 暗色模式下不得有元素因漏覆盖而回落到亮色值 | §17.5 | ⚠️ 实测约 18 处（远低于静态预测） |
| **I8** | 主题切换不得产生布局位移（CLS = 0）或首屏闪烁（FOUC） | §7.5 / GATE-07 | ✅ 已满足（M1）。修复前：亮色首绘于 1 356 ms、`.dark` 迟至 1 516 ms 生效 → D-11 / D-49 |
| **I9** | **背景色阶与前景文字必须同源同向变化** | §4.3 C-24 / GATE-04/05 | ✅ 已满足（M1）。修复前：页头横幅暗色对比度 1.52:1 → D-50 |

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
- **T3** 语义变体只允许 `main`、`hover`、`container`、`text`、`light`、`dark`、`surface`、`on-<surface>`、`-rgb`。
  > `surface` 与 `on-<surface>` 于 v1.1.2 随 D-50 修复引入（`--color-primary-surface` / `--color-on-primary-surface`），用于表达「承载固定前景色的实底」——这类令牌**必须**明确声明是否参与主题反转。
- **T4** **禁止**在令牌名中使用品牌形容词（`forest-green`、`ocean-blue`、`bio-purple`、`tech-cyan`）。
- **T5** **禁止**混用 `--color-primary` 与 `--color-primary-500` 表达同一含义。二者语义不同：
  - `--color-primary` = **当前主题下应使用的主色**（亮色 = 500 档，暗色 = 400 档，**允许随主题翻转**）；
  - `--color-primary-500` = **色阶固定锚点**（值在任何主题下都不变）。
  > ⚠️ **实测违反**：`dark.css` 反转了整个 primary 色阶（`--color-primary-500` 亮 `#10b981` / 暗 `#34d399`），使"固定锚点"失去意义。这是 **D-50 的根因**，见 §4.3 C-24。
- **T6** 新增令牌必须同时在 `base.css` 与 `dark.css` 登记，并更新本文 §3.4 清单。
- **T7** **禁止**在 `dark.css` 中出现无 `.dark` 祖先作用域的 `:root` 块。所有暗色值**必须**写在 `.dark { … }` 内。
  > **历史实测（v1.1.0）**：`dark.css:381-448` 曾存在 44 条此类声明（`dark.css` 内 `.dark{}` 与尾部 `:root{}` **零交集**）。因 `dark.css` 在 `base.css` 之后导入且同特异度，**其值在亮色模式下也生效**；实测 `--badge-draft-text` 在**四种条件组合下恒为 `#cbd5e1`**（见 §17.4）。→ D-21。
  > **✅ 已修复（v1.1.2）**：该孤儿块已删除（同值删除 / 暗色值移入 `.dark{}`），`dark.css` 现**无裸 `:root{}`**，门禁 **GATE-02** 通过。
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
  > **历史实测（v1.1.0）**：JS **试图**写入 `--easing-easeOut` 等 5 条，而 CSS 读 `--ease-*`（实测 **51 处**消费者），`--weight-*` **零消费者** → 主题面板的缓动与字重调节 **100% 无效**。
  > **⚠️ 更正（v1.1.4）**：`--easing-*` 的 5 条**实际从未写入 DOM** —— 其值 `cubic-bezier(...)` 被当时的值形状白名单拒绝（见 D-53/D-54）。故「JS 写入但 CSS 读不到」的表述不准确，真实情况是**两端都不通**。→ D-23 / D-53。
- **T11** 令牌**禁止**参与主题切换变化，除非其语义确需随主题变化。字体族链、z-index、间距、圆角**必须**在亮暗两套中完全相同。
- **T12** shadcn/ui 无前缀令牌层（`--background` 等）只能由 `components/ui/**` 消费，且**必须**是 `var()` 别名。
  > **历史实测（v1.1.0）**：暗色下 `--background` 解析为 **`#f0fdf4`（近白绿）**，而 `--bg-canvas` 为 `#020617`；任何使用 `bg-background` 的 shadcn 组件在暗色下都会得到**近白背景**。→ D-9。
  > **✅ 已修复（v1.1.2）**：`dark.css` 中 `--background` 已改指 `var(--bg-canvas, #020617)`。
- **T13** `@theme` 块中的令牌桥接**必须**指向**已在 `base.css`/`dark.css` 中真实定义**的令牌；**禁止**写成 `--x: var(--x)`（自引用）。
  > **理由（D-51）**：`@theme` 中的 `--color-blue-500: var(--color-blue-500)` 会**替换** Tailwind v4 的默认蓝色阶。若 `base.css`/`dark.css` 也未定义同名令牌，则该令牌的**全部**声明都是自引用 → 解析为 guaranteed-invalid（**空**）→ 依赖它的工具类失去颜色。
  >
  > 实测对照（生产编译产物）：
  > | 令牌 | 编译后声明 | 结果 |
  > |:-----|:-----------|:-----|
  > | `--color-blue-500` | `var(--color-blue-500)` | ❌ 空 → `bg-blue-500` **无颜色** |
  > | `--color-pink-500` | `oklch(65.6% .241 354.308)` | ✅ Tailwind 默认值保留 |
  >
  > **判定口径（v1.1.5 重要更正）**：
  > - 自引用且**同名无定义** → 属「**循环引用**」，解析为空，**必须**修复（门禁 **GATE-09** 判 `fail`）。
  > - 自引用且**同名有真实定义** → **不属缺陷**。它是 Tailwind v4 **工具类生成的登记机制**：
  >   `@theme` 中声明了 `--color-<族>-<档>`，Tailwind 才会生成 `bg-<族>-<档>` 等工具类；
  >   而值经层叠从 `base.css`/`dark.css` 的同名 `:root` 声明解析而来。
  >
  >   > ⚠️ **v1.1.4 及更早版本把这一类称为「冗余」并建议清零 —— 该指引是错误的**，
  >   > 照做会导致工具类**完全不生成**。实证：**D-55** 中 `secondary` 族因缺 `@theme` 条目，
  >   > 编译产物里 `.bg-secondary-500` 等为 **0 个**；补上 11 条条目后变为 **5 个**。
  >   > 交叉验证：有着条目的 primary / secondary / accent / info / danger 五族，
  >   > 产物中分别有 **9 / 5 / 5 / 1 / 1** 处 `.bg-<族>-500` 工具类。
  >
  >   **真正的隐患**在于「值解析依赖层叠顺序」（同特异度下由导入顺序决定），而非声明本身多余。
  >
  >   > ❌ **v1.1.6 勘误（重要）**：本节原建议「改用 `@theme inline` 根治」，**经实测证伪**——
  >   > `@theme inline` 会使 Tailwind **无法生成带 opacity 修饰符的类**（如 `ring-primary-600/40`、
  >   > `decoration-primary-400` 等），导致这些类在产物中 **0 生成**（实证：改为 inline 后
  >   > GATE-12 由 pass → fail，缺失 2 类；回滚后恢复生成）。
  >   > **故保留 `@theme`（非 inline）形式**，106 条登记声明是必要的，**不得删除或改为 inline**。
  >   > 层叠顺序隐患的实际缓解方式是**保证 `base.css`/`dark.css` 的导入在 `index.css` 之前**
  >   > （当前 `index.css` 第 33/34 行已如此），使 `:root` 的真实定义优先于 `@theme` 的自引用。
  >
  > **✅ 现状（M2）**：循环引用 **0 个**（原 `--color-blue-50..900` 共 10 条已随 D-51 清除）；
  > `@theme` 中有 **106 个**登记声明（v1.1.2 时点 79 个；D-55 / D-56 补齐
  > `secondary` 与 `info` 族后增至 106）。**这 106 条不得删除** —— 它们是全项目品牌色工具类的来源。
  > 对应的检查项 **CHK-26 / CHK-27** 只应判「循环引用」，不应把登记声明计入待办。

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
| text | `#047857` | `#6ee7b7` | `--color-primary-text` |
| rgb 通道 | `16, 185, 129` | `52, 211, 153` | `--color-primary-rgb` |

> **⚠️ 色阶反转声明（关键）**：上表显示 `dark.css` **整体反转**了 primary 色阶——暗色下 `50` 是最深、`950` 最浅。
> **设计后果**：`bg-primary-{400..700}` 在暗色下变成**浅色底**（实测 `bg-primary-600` 亮 `#059669` → 暗 **`#6ee7b7`**）。
> **因此「`bg-primary-*` + `text-white`」在暗色下必然崩塌**（实测 **1.52:1**）→ **D-50**，规范见 §4.3 **C-24**。
> 同时 `--color-primary-text` **曾**未随色阶反转（两模式均 `#047857`），暗色下在 `#020617` 画布上仅约 2.3:1 → **D-12**。**已于 v1.1.2 补暗色专用值 `#6ee7b7`（约 13.3:1，D-12b 关闭）。**

> **品牌唯一值声明**：RMFOOD 品牌主色 **= Forest Green `#10B981`（Emerald-500）**。
> 任何文档声称 `#28A745`、`#22C55E`、`#059669`、`#0891B2`、`#34C759` 为"品牌主色"的表述**一律作废**（见 §13）。

品牌辅色 **Ocean Blue**（`--color-secondary-*`）、强调色 **Bio Purple**（`--color-accent-*`）结构同构，见 `base.css:28-61` / `dark.css:26-60`。

### 3.3 语义令牌组（必须成对定义）

| 组 | 代表令牌 | 亮色基准 | 暗色基准 | 备注 / 修复状态 |
|:---|:---------|:---------|:---------|:-----------------|
| **画布/表面** | `--bg-canvas` | `#f8fafc` | `#020617` ✅ | — |
| | `--bg-surface-container` / `-low` / `-raised` / `-elevated` | — | — | — |
| | `--card-bg-solid` | `#ffffff` | `#0f172a` ✅ | — |
| | `--bg-surface` / `--bg-surface-variant` | `var(--bg-surface-container-low)` | 同名 | ✅ 曾因引用未定义的 `--bg-surface-container-high` 而解析为空（D-22），已随 D-21 修复 |
| **文字** | `--text-primary` | `#0f172a` | `#f1f5f9` ✅ | — |
| | `--text-secondary` / `--text-muted` / `--text-disabled` | — | — | — |
| **边框** | `--border-color` / `-hover` / `--border-subtle` / `--border-default` | — | — | — |
| **功能色** | `--color-{success,warning,error,info}` | `#10b981`/`#f59e0b`/`#ef4444`/`#3b82f6` | 对应亮阶 ✅ | — |
| | `--color-{…}-{bg,text,container,hover}` | — | — | — |
| **中性色阶** | `--color-neutral-50` … `-900` | `#f8fafc`→`#0f172a` | **反转** `#020617`→`#f1f5f9` ✅ | — |
| **焦点** | `--focus-ring` | `#3b82f6` | — | — |
| **遮罩** | `--overlay-bg` | `rgba(0,0,0,.4)` | — | — |
| **徽章（局部）** | `--badge-{draft,…}-{bg,text,border}` | ✅ 六枚亮色文字对比度 5.26/4.85/6.42/4.65/6.61/5.77:1 | ✅ 分离为 `-dark` 后缀族 | 曾两模式同值、亮色仅 1.26–2.17:1（D-21 + D-52，已修复） |
| **主色表面（局部）** | `--color-primary-surface` / `--color-on-primary-surface` | `#047857` / `#ffffff`（白字 **5.55:1** ✅ AA） | `#065f46` / `#ffffff`（白字 **7.78:1** ✅ AAA） | **不参与色阶反转**，专用于承载白色前景的实底（D-50 修复引入，见 §4.3 C-24） |
| **shadcn 桥** | `--background` | `#f8fafc` | ✅ `#020617` | 曾误指 `--color-primary-950` → 暗色解析为 `#f0fdf4`（近白绿），D-9 已修复 |

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

**颜色类**（`semantic-utils.css`）：`.text-primary-main`、`.text-primary-light`、`.bg-primary-container`、`.border-primary-main`、**`.surface-primary`**（+ `:hover`）、`.text-{success,warning,error,info}-main`、`.bg-{…}-container`、`.bg-neutral-{50..900}`、`.text-neutral-{50..900}`、`.border-neutral-{50..900}`、`.surface-card`、`.skeleton-base`

> **`.surface-primary`**（`semantic-utils.css`，v1.1.2 随 D-50 引入）：实底 + 固定前景，**不参与色阶反转**。
> 等同 `background-color: var(--color-primary-surface); color: var(--color-on-primary-surface)`。
> 用于页头横幅、主按钮、图标圆等承载白色前景的实底。**禁止**用 `bg-primary-{400..700}` + `text-white` 表达同一意图（见 §4.3 C-24）。
> **悬停态必须同族**：`:hover` **必须**使用 `--color-primary-surface-hover`，**禁止**引用 `--color-primary-{100..950}` 或 `--color-primary-hover` —— 前者随主题反转（暗色下 `-800` 为 `#d1fae5`，白字仅 **1.13:1**），后者不保证 ≥ 4.5:1。门禁 **GATE-11** 强制断言亮/暗 × 基础/hover 四组对比度。见 D-54。
> 注：**不存在** `.text-on-primary-surface` 类——前景色由 `.surface-primary` 自身设定，消费方**禁止**假设该类存在。

**文本/表面类**（`index.css`）：`.text-text-primary`、`.text-text-secondary`、`.text-text-muted`、`.text-text-disabled`、`.bg-surface-default`、`.bg-surface-variant`、`.bg-background-default`、`.bg-background-elevated`、`.bg-background-hover`、`.border-border-default`、`.border-border-hover`、`.border-border-divider`、`.bg-card`

> ⚠️ `.text-text-primary`（`index.css:178`）与 `.text-primary-main`（`semantic-utils.css:16`）语义**不同**：前者 = 正文色，后者 = 品牌主色。**禁止**新增同类双关命名。

### 4.3 允许 / 禁止写法

| # | 写法 | 判定 | 实测依据 |
|:--|:-----|:----:|:---------|
| **C-1** | `bg-white dark:bg-neutral-900` | ❌ 禁止 | 破坏单一真相源（应使用 `surface-card`）。注：D-1 已于 v1.1.2 修复，`dark:` 现**已生效**，故不再以"不生效"为由；但双值写法使同一语义存在两个来源，仍禁止 |
| **C-2** | `style={{ color: '#34C759' }}` | ❌ 禁止 | 5 081 处存量 |
| **C-3** | `text-[#34C759]` | ❌ 禁止 | 绕过令牌体系 |
| **C-4** | `bg-slate-50 dark:bg-neutral-800` | ❌ 禁止 | 中性色阶已自带反转 |
| **C-5** | `bg-emerald-50`（无 `dark:`） | ❌ 禁止 | 实测**四条件完全相同**：不响应 `.dark` 也不响应媒体查询 → 彻底惰性 |
| **C-6** | `bg-neutral-100` | ✅ 允许 | 实测亮 `#f1f5f9` → 暗 `#0f172a` |
| **C-7** | `style={{ color: 'var(--text-primary)' }}` | ✅ 允许 | — |
| **C-8** | `bg-primary-container text-primary-main` | ✅ 允许 | — |
| **C-9** | `` className={`bg-${color}-500`} `` | ❌ 禁止 | Tailwind v4 无法静态提取 |
| **C-10** | `w-${size}` 等动态拼接 | ❌ 禁止 | 同上 |
| **C-11** | `<style>` 内重定义 `--color-*`/`--accent-*` | ❌ 禁止（例外见 §7.4） | 破坏 I1 |
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
//   base.css:  --color-primary-surface: #047857;  --color-on-primary-surface: #ffffff;
//   dark.css:  --color-primary-surface: #065f46;  --color-on-primary-surface: #ffffff;
<div className="surface-primary rounded-xl p-6">…</div>

// ✅ 方案 B：使用不参与反转的 Tailwind 固定色阶
<div className="rounded-xl bg-emerald-600 p-6 text-white">…</div>

// ✅ 方案 C：显式提供反转后的深色底（D-1 已于 v1.1.2 修复，dark: 现已可用）
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
| 色盲友好 | `color-blind` | — | ⚠️ **CSS 无任何规则**，仅 JS 侧 `getAccessibilityTheme()` 处理。**规范裁决**：见 §6.2 **A-15** —— 该模式**必须**至少提供 CSS 层的最小规则，或由 A-15 明确豁免并给出验收方式；当前状态为**未裁决的缺口** |

**强制：**

- **A-4** 辅助模式**必须**通过 `themeStore.setAccessibilityMode()` 单一入口切换。
- **A-5** 辅助模式的 DOM 属性**必须**在**页面初始化（`initialize()`）时同样写入**，不得仅在交互切换时写入。
  > **历史实测（§17.6，v1.1.0 采集）**：交互切换 → `dataA11y="reading"`、`dataReading="sepia"` ✅；**刷新后 → 两者均为 `null`** ❌，由此 `--text-primary` 从 `#5C4B37`（sepia）回退到 `#0f172a`，`semantic-utils.css` 的阅读模式规则**整层失效** → D-39。
  > **✅ 已于 v1.1.2 修复**：新增 `syncA11yAttributes()`，由 `initialize()` 与 `setAccessibilityMode()` 共用；`index.html` 亦在首屏前写入。实测刷新后 `a11y=reading` / `reading=sepia`，`--text-primary=#5C4B37` 保留（门禁 **GATE-07**）。
- **A-6** `prefers-contrast: high`（系统级）与 `data-a11y-mode="high-contrast"`（应用级）**必须**同时支持。
- **A-7** 阅读模式**必须**覆盖实际生效的背景令牌。实测仅覆盖 `--bg-primary`/`--bg-surface`，而页面底色读 `--bg-canvas`（`typography.css:19`）→ **sepia 下 body 底色仍是 slate `#f8fafc`**，文字变棕但背景未变暖。→ D-32
- **A-8** 高对比度模式覆盖的边框令牌**必须**是组件实际消费的那个。实测改 `--border-default`，而组件普遍读 `--border-color`（`index.css:195`）。→ D-32
- **A-15（新增）** `color-blind` 模式**必须**得到明确处置：**或**在 CSS 层提供最小规则（`[data-a11y-mode="color-blind"]` 下的色彩区分替代方案，如形状/纹理/明度差），**或**按本文档流程记录豁免理由与验收方式。
  > **当前为未裁决缺口**：该模式在 CSS 层**无任何规则**，仅由 JS 侧 `getAccessibilityTheme()` 处理（见 §6.2 模式表）。**禁止**在未裁决状态下继续新增依赖该模式的样式。
  > **验收**：豁免或实现二者之一必须在 §12 路线图中有对应条目，并附亮/暗双模式截图证据。

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

### 7.2 Tailwind 暗色变体契约

- **R-4** `index.css` 的 `@theme` 块**必须**声明暗色变体绑定，把 `dark:` 变体绑定到 `.dark` 类作用域：

**规范要求：**

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

> **校验**：门禁断言 **GATE-01**（源码存在该声明）与 **GATE-03**（编译产物中 `.dark\:` 无一位于 `prefers-color-scheme` 媒体查询内）。
> **特异度说明**：`.dark\:x:where(.dark, .dark *)` 为 (0,1,0)，低于既有的手写规则 `.dark .foo` (0,2,0)，因此手写暗色规则仍会胜出。
> **状态**：✅ v1.1.2 已配置。

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

**后果（修复前）：** 全项目 **14 912 处**（534 文件）`dark:` 类**不随应用主题开关切换**，只跟随操作系统偏好。这是当时主题系统**最严重的功能性缺陷（D-1）**。
**✅ 已于 v1.1.2 修复**：编译产物中位于 `prefers-color-scheme` 内的 `.dark\:` 由 **1 467 → 0**（门禁 GATE-01 / GATE-03）。

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
| **D-attr-6** | **禁止**用 `style.cssText +=` 累加写入 | ✅ 已满足（v1.1.2）。源码已无任何 `cssText`，全部逐属性 `setProperty` |
| **D-attr-7** | **禁止**用 `document.documentElement.style.opacity/transform` 做主题过渡 | ✅ 已满足（v1.1.2）。修复前违规（D-8） |
| **D-attr-8** | **禁止**把不可信值拼接进 `cssText` | ✅ 已满足（v1.1.2，D-33）。改用 `setProperty` + `isSafeToken` 校验 |
| **D-attr-9** | 每次应用**必须**同时写入无障碍属性 | ⚠️ **部分满足**：`applyThemeToDOM()` 自身**不写** a11y 属性（改由 `themeStore` 侧负责）。仅 `initialize()` 与 `setAccessibilityMode()` 两处调用 `syncA11yAttributes()`；**另 5 条应用路径**（`setThemeMode` / `setPresetTheme` / `applyCustomTheme` / `resetToDefault` / `importTheme`）不同步 → `resetToDefault()` 会残留 `data-a11y-mode="reading"`。见 **D-57** |

> **实测更正（v1.1.0）：内联样式不累加。**
> v1.0.0 依据 `root.style.cssText += cssText` 推断"内联样式无界增长"。经真实驱动 `setPresetTheme` **往返 8 次**实测：
> `len` 稳定于 3 251–3 287 B、**声明数恒为 104**、**重复令牌数 0**。
> **原因**：CSSStyleDeclaration 按属性名去重，同名属性后值覆盖前值，不会累积。
> **结论**：**D-5（内联累加）被推翻**。`cssText +=` 仍是**不良实践**——它会整体重置 `<html>` 的 style 属性（抹掉任何其它内联样式）并强制全量重解析——但**不构成内存/性能缺陷**。
> D-attr-8（注入风险 / D-33）与 D-attr-7（全页 opacity 过渡 / D-8）**均已于 v1.1.2 修复**。

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
- **R-6** `accentColor` 若使用 Radix Themes，**必须**映射到品牌主色。
  > 历史现状（v1.1.0 实测）：`accentColor="cyan"` + 内联 `<style>` 覆盖 `--accent-1..12`，其中 `--accent-6` = **`#0066cc`（蓝色）**、`--accent-9` = `#065f46`——在一个绿色阶里插入了蓝色（D-10）。
  > **已随 D-41 于 v1.1.2 消除**：该依赖与 Provider 已整体移除（见 §7.4 R-9）。
- **R-7** **禁止**在组件内以 `<style>` 标签覆盖 `--accent-*`/`--color-*`；须移到 `styles/tokens/` 下独立文件并 `@import`。
- **R-8** Radix Themes 仅作为**原语组件库**使用；**禁止**作为令牌真相源（ADR-027:32 已明确「设计 Token 完全保留」）。
- **R-9** 使用 `@radix-ui/themes` **必须**导入其样式表 `@radix-ui/themes/styles.css`；**禁止**保持「引入了但没生效」的中间状态。
  > **实测确证（D-41）**：当时全仓 **0 引用**该样式表，`.radix-themes` 根节点上的 `--gray-1`/`--gray-12`/`--font-size-2`/`--radius-3` **全部为空**；仅 `--accent-*` 因内联 `<style>` 而存在（其中 `--accent-6` 还是蓝色 `#0066cc`，插在绿色阶中间 → D-10）。
  >
  > **✅ 已按方案乙处置（T-R1）**：**删除**该依赖与 `RadixThemeProvider`，`components/ui/RadixComponents.tsx` 改为**项目原生实现**（保留对外 API，并补齐 `role="status"` 无障碍契约）。实测 `/radix-demo` 可达、**0 个 Radix 残留节点**、**13 个 Badge 具备 role=status**、0 页面错误。
  > 门禁断言 **GATE-10** 固化本规则：源码一旦再次导入该库而未加载其样式表即判失败。
  > **保留决策**：16 个 `@radix-ui/react-*` 原语包**继续使用**（headless 原语，不依赖主题样式表）。

### 7.5 初始化时序与 FOUC

**强制：**

- **R-10** 首屏渲染前**必须**已应用正确主题，禁止闪烁（I8）。
- **R-11** `index.html` 预置脚本读取的 localStorage 键名与结构**必须**与 `themeStore` 的 persist 配置一致。

**实测 FOUC 时间线（§17.7）—— 修复前（v1.1.0 采集）：**

| 时刻 | 事件 | 实测值 |
|:-----|:-----|:-------|
| t = 1 355 ms | body 已有背景色 | `rgb(248,250,252)`（**亮色**），`html.class=""`，`htmlStyleLen=0` |
| t = 1 356 ms | `first-paint` | — |
| **t = 1 468 ms** | **`first-contentful-paint`（亮色内容已绘制）** | — |
| t = 1 516 ms | `.dark` 类被应用 | body 转为 `rgb(2,6,23)` |

**⇒ 用户先看到亮色首屏，48 ms 后才开始转暗，从首次可见到转暗共约 160 ms。**

**✅ 已于 v1.1.2 修复（D-11 / D-49）**：`index.html` 预置脚本对齐 `rmfood-theme-storage`，且首次应用改走瞬时路径。修复后 `.dark` 生效时刻 **1 516 ms → 153 ms**，首个 body 背景（暗 `rgb(2,6,23)`）出现于 **1 766 ms < FCP 1 888 ms** → **无 FOUC**（见 §17.10）。

**根因（修复前）**：`index.html:28` 读取 `localStorage['rmfood-theme-settings-v2']`，而 `themeStore.ts` 实际写入 **`rmfood-theme-storage`**（结构 `{state:{…},version:4}`）。两者**永不匹配**，且 `mode` 取值集合不一致（`'auto'` vs `'system'`）。实测预置正确键名后应用**确实**切到了 dark，证明**只是时机太晚**，而非逻辑错误。

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

**附加（D-49）**：冷启动默认 `transitionType: 'fade'` 会先把 `<html>` 设为 `opacity: 0` 再淡入，与 FOUC 叠加产生额外空白。**规定**：初始化路径**必须**使用 `transitionType: 'none'`。**（v1.1.2 已落实）**

### 7.6 持久化

| 键名 | 内容 | 写入方 | 实测状态 |
|:-----|:-----|:-------|:---------|
| `rmfood-theme-storage` | Zustand persist：`activeThemeId`/`mode`/`accessibilityMode`/`motionPreferences`/`transitionType`/`customThemes` | `themeStore.ts:428` | ✅ **权威，实测读写正常** |
| `rmfood-custom-themes` | 旧版自定义主题（v3→v4 迁移源） | 历史遗留 | 只读迁移源 |
| `rmfood-theme-state` | 状态快照 | `theme.storage.ts:11` | ⚠️ 无实际消费者 |
| `rmfood-theme-preferences` | 用户偏好 | `theme.storage.ts:13` | ⚠️ 无实际消费者 |
| `rmfood-theme-versions` | 版本历史 | `theme.storage.ts:14` | ⚠️ 实测版本历史恒空 |
| `rmfood-theme-settings-v2` | — | 曾**仅 `index.html` 读取** | ✅ **已消除**（v1.1.2，随 D-11 键名对齐为 `rmfood-theme-storage`）。修复前实测为 `null` → 死键 |
| `rmfood_custom_themes`（下划线） | `ThemeStorageAdapter` 使用 | — | ❌ 键名不一致，迁移读不到 |

**强制：**

- **R-12** **禁止**双写同一语义的数据。自定义主题**只能**由 Zustand persist 写入。
- **R-13** 迁移逻辑**必须**幂等且带版本号（当前 `version: 4`）。
- **R-14** 存储读取**必须**容错。
- **R-15** 清理无效键（`rmfood-theme-settings-v2` 已于 v1.1.2 随 D-11 消除；剩余 4 个僵尸/错名键待清理）。

### 7.7 过渡与事件

- **R-16** 主题过渡**禁止**在 `themeStore` 中用 `setTimeout` 串联 DOM 动画。**必须**改为 CSS 类驱动 + `transitionend`。
  > **✅ 已于 v1.1.2 修复（D-8）**：原 `themeStore.ts:517-644` 的三个 opacity/transform 过渡函数已删除，改由 `.theme-transition` 类在切换瞬间挂载 / 260 ms 后卸载。实测 6 次切换中 `<html>` 上 inline opacity/transform 出现 **0 次**。
- **R-17** `ThemeEventBus` **应该**仅用于跨模块通知。
  > 实测：**零订阅者**（仅 `ThemeEditor.tsx:51` 一处 `emit`，`on`/`once`/`clearListener` 全仓无调用），`emit` 因 `size === 0` 直接返回（`ThemeEventBus.ts:72`）。→ D-42
- **R-18** 主题分享 URL 协议**必须**做白名单校验。

### 7.8 安全：不可信主题输入（**强制**）

主题可通过三条路径进入，**全部为不可信输入**：`themeStore.importTheme()`、`ThemeImport.tsx` 文件上传、`ThemeShare.ts`/`themeUrlParser.ts` 的 `?theme=` URL 参数。

- **R-19** 不可信数据**必须**先经 schema 校验与**令牌白名单**，再进入应用流程。**禁止**直接展开进主题对象。
  > 违规：`themeStore.ts:399` 仅检查 `config.theme?.colors` 存在即整体 spread。
- **R-20** **禁止**将不可信值通过字符串拼接写入 `style.cssText`。**必须**使用 `setProperty`。
  > **历史最高危安全缺陷（D-33）**：`theme.presets.ts:560-563` **曾**把主题值拼成 `"name: value;"` 后 `+=` 到 `<html>.cssText`；攻击者构造含 `;` 的 value 即可越界注入任意 CSS 声明到根元素，三条输入路径**全部汇聚于此**。
  > **✅ 已于 v1.1.2 修复**：改为逐属性 `setProperty` + `isSafeToken` 白名单。**59/59 安全断言通过，10 种注入形态（`;` / `}` / `url(` / `expression(` / 转义等）全部阻断**。
- **R-21** 值**必须**做格式白名单校验（`#hex` / `rgb()` / `rgba()` / `hsl()` / `var(--已登记令牌)`），长度设上限。
  > 违规：`ThemeImport.tsx:8` 的 `sanitizeCSSVariables` 正则把 `$` 误写为 `^`（`^rgb\(.*\)^`），rgb/rgba/hsl 分支**永不匹配**；且该函数**从未被调用**。`ThemeShare.ts:28` 的 `decodeThemeFromUrl` 无校验，而 `types/theme-mode.ts:111` 的 `validateThemeConfig` 已存在却未被使用。
- **R-22** URL 分享协议**必须**唯一。当前 `?theme=` 被两套互斥协议共用（`themeUrlParser.ts:8` 传预设 ID，`ThemeShare.ts:38` 传 base64）→ base64 传给 `setPresetTheme()` 后静默回退 `light-default`（D-35）。**必须**改用不同参数名。
- **R-23** 导入配置结构**必须**与消费端一致。`ThemeImport.tsx:32-39` 传扁平 `{primary,secondary,accent}`，而 `mergeThemeOverrides`（`theme.presets.ts:471`）只读 `overrides.colors.*` → **导入静默无效果**（D-36）。

### 7.9 状态一致性

- **R-24** `mode` 与 `activeTheme` **必须**一致。**禁止**在切换预设时无条件覆写 `mode`。
  > 违规：`themeStore.ts:221` 由 `themeId.startsWith('dark-')` 推断并**强写** `mode` → 用户选择「跟随系统」后只要点过一次预设就**永久失去跟随能力**（D-34）。
- **R-25** persist 的 `partialize` **必须**包含重建 `activeTheme` 所需的全部字段。当前不含 `activeTheme`（`themeStore.ts:430-438`），水合后可能出现 `mode === 'dark'` 而 `colors` 仍为浅色（D-37）。
- **R-26** **禁止**存在多个写入同一 DOM 契约的位置（如 `.dark` 类只允许 `applyThemeToDOM` 一个写手）。
  > **历史违规（v1.1.0）**：`.dark` 类曾有两个写手——`theme.presets.ts:585` 与 `RadixThemeProvider.tsx:26-28`（D-38）。**该 Provider 已于 v1.1.2 随 D-41 删除**，写手收敛为一个；D-38 的收敛目标已达成，剩余工作仅是确认无新增写手。
- **R-27** **禁止**在 `mode === 'system'` 下让媒体查询监听器覆盖用户的显式选择。实测该监听器在实验条件 C 中**自动把 `.dark` 类加了回来**，使"无类 + 系统暗色"这一状态**无法通过外部手段构造**（也说明该状态在真实使用中不可达）。

---

## 8. 主题设置 UI 规范

### 8.1 现状盘点

> **2026-10-12 更新**（提交 `7251601`）：本节原登记的死代码清单**已全部删除**，主题设置面已完成产品化收口。当前存量如下：

| 组件 | 行数 | 挂载状态 | 说明 |
|:-----|-----:|:---------|:-----|
| `components/theme/ThemePanel.tsx` | 501 | ✅ **唯一产品入口** | 9 个区块（明暗 / 过渡 / 无障碍 / 预览 / 字体 / 配色 / 持久化 / 重置 / 摘要），由 `SettingsPage.tsx:1460-1461` 的 `renderThemePanel` 挂载，注册于 `:1691` 的 `theme` 标签页 |
| `components/theme/ThemeSwitcher.tsx` | 175 | ✅ 顶栏挂载 | `MainLayout` 的明暗切换；仅负责 mode 切换 + 跳转 `/settings?tab=theme`，不承担设置职责 |
| `components/theme/theme-palette.ts` | 191 | ✅ 数据源 | Apple HIG 五色板 + 字号刻度 + 色阶生成（纯数据，无副作用） |
| `components/theme/__tests__/theme-palette.test.ts` | — | ✅ | 色板/刻度/单通道断言 |
| `stores/themeStore.ts` / `theme.presets.ts` | 631 / 1006 | ✅ | 状态与运行时令牌生成（含 C1.5 双作用域语义族，见 U-8） |
| `pages/settings/ThemeSettingsPage.tsx` | 505 | ❌ **孤儿页** | `/settings` 渲染的是 `SettingsPage`；本文件 0 引用。U-2 冻结中 |

**已删除的死代码**（§8.1 原表 ≈1 382 行，`dc3393d` + `eb86dff` 两批提交清完）：
`ThemeEditor` / `ThemePreviewOverlay` / `ThemeOnboarding` / `ColorEditor` / `VersionHistoryPanel` / `components/theme/index.ts` / `hooks/useThemedComponent.tsx`（6 个导出全 0 命中）/ `hooks/useTheme.tsx`。
→ **D-25 / D-40 / D-18 / D-19 / D-27 / D-30 / D-42 / D-48 关闭**；§12 第 26 / 27 / 29 项对应的删除动作已完成。

唯一对用户可见的主题设置入口是 `SettingsPage` 的 `renderThemePanel → <ThemePanel />`（`SettingsPage.tsx:1460-1461`，标签页注册 `:1691`）。

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
- **U-8**（2026-10-12 新增）**模式相关令牌禁止走 inline 单作用域通道**，**必须**经运行时 `<style id="rmfood-runtime-theme">` 的 `:root` / `.dark` 双作用域块落地。
  > 适用范围：**档位色阶** `--color-primary-{50..950}`（base.css 100 浅→950 深、dark.css 100 深→950 浅）+ **primary 语义族**（`--color-primary` / `-rgb` / `-container` / `-surface` / `-surface-hover` / `-hover` / `-text` / `--color-on-primary-surface`）——后者在 base.css:26-39 与 dark.css:22-37 **各有一份不同取值**，与档位色阶同属模式相关。
  > 原因：inline 自定义属性的优先级高于任何非 `!important` 选择器，在 `<html>` 上 `setProperty` 会**同时压过** `:root` 与 `.dark` —— 暗色模式随即错用亮色取值。档位色阶表现为「断裂梯度」（中间换色、两头仍是品牌绿）；语义族表现为「选苹果蓝后 `--color-primary` 变为 `#0A84FF` 而 `--color-primary-container` 仍是品牌绿 `#d1fae5`」，全站 89 处 `bg-primary-container` 呈绿/蓝混排。
  > 唯一实现路径：`theme.presets.ts` 的 `generateModeRampCSS()`（`derivePrimaryFamily()` 从各模式完整色阶推导语义族，规则与 L0 逐条对齐，故默认绿推导值与 L0 逐值相等）+ `applyRuntimeThemeStyle()`；`generateCSSVariables()` 在存在 `modeRamps` 时对档位与语义族**让位**，不再产出这些名字。
  > 配套门禁：**GATE-17**（档位令牌 `setProperty` 白名单，仅放行 `stores/theme.presets.ts`）+ **GATE-15**（冷启动回放后断言运行时样式表存在、含 `:root`/`.dark` 双块、11/11 档注入、**inline 零档位令牌泄漏**）+ **GATE-16**（L0 整档单调，违背 0 处）。

### 8.4 后期开发操作手册（SOP）

> 本节是规范对「后期页面调整」的操作入口——开发者照做即合规，无需通读全文。
> 配套门禁：`GATE-13`（令牌登记校验，§10.3）+ `GATE-14`（条件类字符串静态清零）。

#### 8.4.1 新页面 / 新组件的主题接入 SOP

| 序 | 动作 | 依据 | 验证 |
|:--:|:-----|:-----|:-----|
| 1 | **选颜色**：查 §4.1 消费优先级（语义令牌 > 语义类 `.surface-*` > 品牌色阶 > 图表通道），**禁止**直接写 `text-[#xxx]` / `bg-primary-600 text-white` | §4.1 / C-1~C-24 | 编译产物对照 |
| 2 | **写类名**：对照 §4.3 的 24 条 C-* 禁止项逐条过；反转色阶（400..950）禁止配白字 → 改用 `.surface-primary` 或固定色阶 | §4.3 C-24（D-50） | `GATE-04` 渲染级断言 |
| 3 | **新增令牌**：走 §9.1 RFC（`base.css` + `dark.css` **成对** + §3.4 登记 + 对比度计算 A-1） | §9.1 / I2/I3 | `GATE-13` 漏登记即 fail |
| 4 | **图表 / canvas 取色**：只走 `chartTheme.ts` / `CANVAS_COLORS`，**禁止** canvas 直赋 `var()` 字符串、**禁止**自定色数组 | §5.3 / C-20~C-23 | 编译产物 0 硬编码 |
| 5 | **暗色适配**：写 `.dark` 选择器或 `dark:` 工具类（走 `@custom-variant`），**禁止** `@media (prefers-color-scheme: dark)` | §7.2 / C-4 | `GATE-03` 编译产物归属 |
| 6 | **焦点环**：默认 3px 主色环由 `focus-scroll.css` 提供；自定义语义环写 `focus:ring-error`（**注意**：P1-8 焦点环分层治理前，未分层的全局 `*:focus-visible` 仍压过工具类，见 §11.2 残余风险） | §6.4 | 浏览器探针 |
| 7 | **提交前**：跑 `npx theme:gate`（14 项）+ `npx theme:validate`（0/0），CI 自动 | §10.3 | 退出码 0 |

#### 8.4.2 孤儿组件裁决指引（§8.1 盘点）

`§8.1` 登记的 ≈1 382 行死代码（`ThemeEditor`/`ThemePreviewOverlay`/`ThemeOnboarding`/`useThemedComponent` 等），处置**由产品决策**，开发者照下表执行：

| 组件 | 裁决 | 处置 | 归属 |
|:-----|:-----|:-----|:-----|
| `ThemeSettingsPage.tsx`（505 行孤儿页） | **产品决策「删除 or 接入 `SettingsPage`」** | 接入前**禁止**在其上开发（U-2）；接入须走 §9.1 + 删 0 引用 | 他人 `SettingsPage.tsx` WIP + 产品方向 |
| `ThemeEditor`/`ThemePreviewOverlay`/`ThemeOnboarding`/`ColorEditor`/`VersionHistoryPanel` | 未挂载（仅 `index.ts` 导出，0 外部引用） | 产品确认「自定义主题编辑」需求后**接入或整体删除**；需求未定前冻结（U-2） | 产品决策 |
| `useThemedComponent.tsx`（171 行） | **必须删除**（U-3，职责由 `useThemedValue` 承担） | 直接删，无产品依赖 | 可立即执行 |
| `FocusRing.tsx` | 死代码（焦点环违规组件，`useFocusStyles` 注入全局 `*:focus-visible` 与 `focus-scroll.css` 冲突 → P1-8 一部分） | 随 P1-8 分层治理批次处置；其 `--color-brand-400` 误用已由 `g13-fix.mjs` 改为 `var(--color-primary)` | 专项 |

> **裁决原则**：U-1 唯一产品入口是 `SettingsPage`；任何「平行主题设置入口」在裁决前**禁止**挂载。`useThemedComponent` 是唯一可立即删除项（U-3 强制）。

#### 8.4.3 GATE-13 / GATE-14 使用指引

- **GATE-13（fail 阻断）**：新增/修改 `var(--color-*)` 引用前，先确认该令牌在 `base.css` **和** `dark.css` 都有定义（I2/I3 成对）。若引用的是 Tailwind 内置调色板（`blue`/`red`/…）或代码高亮色（`--color-ts` 等），**无需** L0 定义（`@theme` 默认保留）。误用了「该用 L0 但 L0 没有」的自有族令牌 → `GATE-13` fail，按 §9.1 补定义或改消费者。
- **GATE-14（warn 存量）**：`g1314.mjs` 检出 165 处 `bg-{primary,secondary,accent}-{400..950} text-white` 条件类字符串。新增代码**禁止**再写这类组合（§4.3 C-24 方案 A/B/C）；存量清理按 `g1314.mjs` 输出逐文件改 `.surface-primary` 或不可反转色阶，清零后 `GATE-14` 转 pass。


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

| ID | 检查项 | 依据 | 实测（v1.1.3 刷新） |
|:---|:-------|:-----|:---------------------|
| CHK-01 | 组件层无 hex/rgb/hsl 颜色字面量 | I4 | ❌ 5 081 处（M1 未处理） |
| CHK-02 | `base.css` 每个 `--color-*` 在 `dark.css` 有覆盖 | I2 | ✅ 已满足（M1，D-21） |
| CHK-03 | `dark.css` 无 `base.css` 未定义的 `--color-*` | I3 | ❌ 22 个（未处理） |
| CHK-04 | `prefers-color-scheme: dark` 不出现在组件 CSS | I5 | ✅ **已满足**（M2，T-F1a）—— 全 src 的 `@media (prefers-color-scheme: dark)` 块 **22 → 0**；另修正 14 条 `.dark.X` 自作用域死规则为后代选择器 |
| CHK-05 | **`@custom-variant dark` 存在于 `index.css`** | I5 / R-4 | ✅ **已满足**（M1，GATE-01） |
| CHK-06 | `rg 'dark:bg-(slate\|gray\|zinc\|neutral)-'` = 0 | C-4 | ❌ 未处理 |
| CHK-07 | `rg 'bg-(slate\|gray)-[0-9]{2,3}'` = 0 | C-5 | ❌ 未处理 |
| CHK-08 | 引用的令牌名均符合 §3.1 | I6 | ⚠️ 部分（D-3 未处理） |
| CHK-09 | 无 `style.cssText` 拼接写入 | R-20 | ✅ **已满足**（M1，D-33） |
| CHK-10 | `index.html` 预置脚本键名 = `rmfood-theme-storage` | R-11 | ✅ **已满足**（M1，D-11） |
| CHK-17 | `dark.css` 无裸 `:root{}` 令牌块 | T7 | ✅ **已满足**（M1，D-21，GATE-02） |
| CHK-18 | 所有 `var(--x)` 的 `--x` 均可用 | T6 / D-22 / D-4 | ✅ **已满足**（M2，GATE-08 通过）。三阶段收敛：**153 → 98**（修正门禁模型，剔除懒加载假阳性）**→ 14**（列出真实缺陷）**→ 0**（改名/补 fallback + 收窄 Tailwind 扫描范围） |
| CHK-19 | ~~无字符串拼接写入 `style.cssText`~~ | R-20 | **RETIRED** — 与 CHK-09 逐字重复 |
| CHK-20 | 主题导入路径均有令牌白名单与值校验 | R-19/R-21 | ❌ 未处理（D-36） |
| CHK-21 | `@radix-ui/themes/styles.css` 已导入**或**依赖已移除 | R-9 | ✅ **已满足**（M1，依赖已移除，GATE-10） |
| CHK-22 | `dark:` 与 `@custom-variant dark` 同时存在 | R-4 | ✅ **已满足**（M1，GATE-03） |
| **CHK-23** | **`bg-primary-*` 未与 `text-white` 搭配** | **C-24** | ✅ **已满足**（M1，GATE-04） |
| **CHK-24** | **亮/暗双模式下实测对比度 ≥ 4.5:1（大文本 3:1）** | **A-1/A-2** | ✅ **已满足**（M1，GATE-05/06；页头 **1.52:1 → ≥4.85:1**、徽章 **1.26:1 → 5.26:1**） |
| **CHK-25** | **无障碍 DOM 属性在刷新后仍存在** | **A-5** | ✅ **已满足**（M1，GATE-07） |
| **CHK-26** | **编译产物中无「循环引用」自引用令牌** | **T13 / I1** | ✅ **已满足**（M1；GATE-09 由 fail → warn：**0 循环引用**）。另 106 条为**登记声明**，属正常机制，**不计入待办** |
| **CHK-28** | **源码使用的品牌色阶类必须在编译产物中真实生成** | **T6 / GATE-12** | ✅ **已满足**（v1.1.4 修复 D-55/D-56 后，305 个类全部存在） |
| **CHK-27** | `@theme` 每个桥接令牌**必须**在同名有真实定义 | **T13** | ✅ **已满足**（M1） |

### 10.2 建议级（SHOULD）

| ID | 检查项 |
|:---|:-------|
| CHK-11 | 调色板类名均使用**中性色阶反转或语义类**（**不得**依赖 `dark:` 做适配，见 C-4 / C-13） |
| CHK-12 | 每个组件的亮/暗双模式视觉回归测试通过 |
| CHK-13 | 新增令牌有对比度计算记录 |
| CHK-14 | 无 `!important` 颜色覆盖 |
| CHK-15 | 无 `<style>` 内联令牌覆盖 |
| CHK-16 | 动态类名拼接 = 0 |

> **编号说明**：阻塞级为 CHK-01~10 与 CHK-17~27；建议级为 CHK-11~16。§10.1 表中 CHK-10 之后直接跳到 CHK-17 属编号分段所致，非缺号。

### 10.3 自动门禁断言（`GATE-*`）

> **命名**：门禁断言使用 **`GATE-nn`** 前缀，与 §9 的治理条款 **`G-1~G-9`** 严格区分——两者语义无关，此前同用 `G-` 前缀已造成歧义（权威来源：`frontend/scripts/theme-audit/theme-gate.mjs`）。
> **入口**：`npm run theme:gate`（全部）、`npm run theme:gate:m1`（仅 M1 范围计入退出码）、`npm run theme:gate:ci`（服务不可用即判失败）。
> **退出码**：`0` = 范围内断言全部通过；`1` = 存在失败；`2` = 环境错误（如缺构建产物）。

| 断言 | 里程碑 | 内容 | 对应检查项 | 最近实测 |
|:-----|:------:|:-----|:-----------|:---------|
| **GATE-01** | M1 | `index.css` 声明 `@custom-variant dark` | CHK-05 | ✅ 通过 |
| **GATE-02** | M1 | `dark.css` 无顶层 `:root{}` 令牌块 | CHK-17 | ✅ 通过 |
| **GATE-03** | M1 | 编译产物 `.dark\:` 无一位于 `prefers-color-scheme` 内 | CHK-22 | ✅ 通过（修复前 1 467 处） |
| **GATE-04** | M1 | 无「反转色阶 + `text-white`」元素（12 路由 × 双模式） | CHK-23 | ✅ 通过 |
| **GATE-05** | M1 | `text-white` 实底元素对比度达标 | CHK-24 | ✅ 通过 |
| **GATE-06** | M1 | 徽章类亮色对比度 ≥ 4.5:1 | CHK-24 | ✅ 通过 |
| **GATE-07** | M2 | 无障碍 DOM 属性刷新后保留 | CHK-25 | ✅ 通过（提前于 M2） |
| **GATE-08** | M2 | 无回退引用的 `var(--x)` 全部可解析 | CHK-18 | ❌ 151/353 未解析（M2 范围） |
| **GATE-09** | M1 | 无「循环引用」自引用令牌 | CHK-26 / CHK-27 | ⚠️ warn（0 循环引用；106 条登记声明，属正常机制） |
| **GATE-10** | M1 | Radix Themes 前置条件（导入样式表或移除依赖） | CHK-21 | ✅ 通过 |
| **GATE-11** | M1 | 主色表面令牌对比度（亮/暗 × 基础/hover 全部 ≥ 4.5:1），且 `.surface-primary:hover` 不引用会反转的色阶令牌 | CHK-24 | ✅ 通过（亮 5.48/7.68，暗 7.68/5.48） |
| **GATE-12** | M1 | 源码使用的品牌色阶类**必须**在编译产物中真实生成 | CHK-18 / CHK-28 | ✅ 通过（568 个类全部存在） |
| **GATE-13** | M4 | 代码中出现的**自有** `--color-*` 令牌必须已在 L0 登记（漏登记无机械校验的兜底） | T6 / §3 | ✅ 通过（白名单制：自有 14 族全部 L0 定义，Tailwind 内置 + 代码高亮色豁免；4 个未登记消费已修，`g1314.mjs` + `g13-fix.mjs`） |
| **GATE-14** | M4 | 静态清零条件类字符串 `bg-{primary,secondary,accent}-{400..950}` + `text-white` | §12 序 21 | ✅ **0 处**（2026-10-07 全量清零：`g14-clean.mjs` 批量清 79 文件/136 行 + DashboardLayout 3 处 + 5 处渐变 D-50 + SynergyTab 动态档位 bug；最后一处 WIP 残余 SettingsPage:1472 随 `74a9252` 接线删除旧面板而清零 → **GATE-14 转 pass**。门禁 14 项 **13 pass / 0 fail / 1 warn（仅 GATE-09）**。口径：排除 `dark:text-white` 反转文字与 `bg-white` 输入框两类误报，仅保留「反转实底 + 白字」与「动态模板 `bg-primary-${`（JIT 不可生成）」 |

> **GATE-11 的由来**：v1.1.2 的 D-50 修复只改了基础态，`semantic-utils.css` 的 `.surface-primary:hover` 仍指向色阶级令牌 —— 暗色下 `--color-primary-800` 反转为 `#d1fae5`（浅薄荷），白字对比度 **1.13:1**，比 D-50 原缺陷的 1.52:1 更差。**这是 GATE-05/06 的结构性盲区**（它们只测非悬停态、且只筛 `className` 含 `text-white` 的元素，而 `.surface-primary` 的前景色由 CSS 自设）。见 D-54。
> **GATE-12 的由来**：`@theme` 桥接层不完整时，Tailwind v4 不生成对应工具类，而源码类名照常书写 → 元素**静默**失去颜色。GATE-08（`var()` 可用性）与静态 grep 都发现不了。本次实测发现 `secondary` 整族与 `info` 族缺档，影响 100+ 处使用。见 D-55 / D-56。
> **GATE-13 口径（2026-10-06 实现）**：白名单制 —— 只对 **RMFOOD 自有语义族**（base.css/dark.css 实际定义的 14 个 `--color-<族>-` 前缀）做「消费必须有 L0 定义」校验；Tailwind 内置调色板（`blue`/`red`/`pink`/`amber` 等 20 族）与代码高亮色（`--color-ts`/`--color-py` 等）**豁免**（由 `@theme` 默认保留、L0 不定义是正确设计）；带 fallback 的 `var(--x, …)` 豁免（有兜底值）。检出 `--color-text-secondary`/`--color-text-muted`/`--color-brand-400`/`--color-danger` 4 个真缺陷（L0 无定义、解析为空），已修消费者（`g13-fix.mjs`，对齐 L0 权威名 `--text-secondary`/`--text-muted`/`--color-primary`/`--color-error`，不补 L0 新定义避免第二真相源）。
> **GATE-14 由来**：§12 序 21 登记的「条件类字符串残余」无断言、无路线图项。`g1314.mjs` 静态扫描全 src 的 `bg-{primary,secondary,accent}-{400..950}` 与 `text-white` 同行共现，检出 165 处（原估 82 处，随源码增长）—— 这些字符串在特定条件渲染时触发 D-50（暗色对比度 1.52:1）。清零属 M4 治理，逐文件改 `.surface-primary` 或不可反转色阶。

## 11. 已知缺陷登记表

> **本表时点**：记录各缺陷**被认定时**的位置与实测值（绝大多数认定于 v1.0.0/v1.1.0，即 M1 修复之前）。**最新修复状态一律以 §11.2 为准**——本表不设状态列，避免两套事实源漂移。
> **编号口径**：本表登记 **44 行 / 46 个缺陷 ID**（含 `D-13/D-26`、`D-18/D-19` 两行各含 2 个 ID）。编号存在 **8 个历史空洞**（`D-6`、`D-14`、`D-15`、`D-16`、`D-17`、`D-19`、`D-20`、`D-26`）——其中 D-19 与 D-26 已并入合并行、D-20 仅见于区间写法而无独立条目，其余为历史保留号（曾计划登记但最终合并入相邻条目）。**因此本表条目数不等于最大编号，历史变更日志中的"缺陷总数"不可用最大编号推算。**
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
| **D-52** | 亮色徽章配色**自身**低于 WCAG AA（被 D-21 掩盖） | `base.css:401-418` | P1 | **渲染 + 像素** | 修复 D-21 后暴露实测：draft **4.48**、approved **3.95**、pending **2.89**、revision **3.86**、archived **4.20**（均 < 4.5:1）。徽章文字为 `text-xs` 非粗体，属正文级。**修复后实测值见 §11.2**（依据 §6.1 与 A-3 重算） |
| **D-53** | `generateCSSVariables()` 输出 **10 个违反 T1 的 camelCase 令牌名**，被 `SAFE_TOKEN_NAME` 静默拒绝 → 主题无法自定义这些维度 | `theme.presets.ts`（`--color-{primary,secondary,tertiary}-contrastText`、`--color-text-text{Primary,Secondary,Muted}`、`--easing-{easeIn,easeOut,easeInOut}`、`--z-modalBackdrop`） | P2 | **静态** | 生成 104 条中 10 条因名称大写被拒；名称应改为 kebab-case（`--color-primary-contrast-text`、`--easing-ease-in`、`--z-modal-backdrop`），或由 §3.1 明确豁免并加入白名单 |
| **D-54** | `.surface-primary:hover` 悬停态对比度崩塌 —— **D-50 修复自身引入的回归** | `semantic-utils.css`（旧 `.dark .surface-primary:hover` → `--color-primary-800`） | **P0** | **渲染** | 暗色下 `--color-primary-800` = **`#d1fae5`**（浅薄荷）+ 白字 ≈ **1.13:1**，**比 D-50 原缺陷 1.52:1 更差**；亮色 hover `#059669` ≈ 3.77:1。**GATE-05/06 结构性漏检**（只测非悬停态、且只筛 `className` 含 `text-white` 的元素）。→ 已新增 **GATE-11** |
| **D-55** | `@theme` 未桥接 `secondary` 色阶整族 → Tilewind 不生成任何 `bg-secondary-*`/`text-secondary-*` 工具类 | `index.css`（`@theme` 块） | **P0** | **编译产物** | 源码 **104 处**使用（如 `bg-secondary-600 text-white` 的主按钮），编译产物中 `.bg-secondary-500/600` 等 **0 个** → 这些元素**亮暗两模式下都无背景色**，白字落在透明底上。与 D-51 同源（桥接层不完整）。→ 已修复并新增 **GATE-12** |
| **D-56** | `info` 族**不是 10 阶色阶**（仅 6 个零散令牌），`error` 族缺 950 档 | `base.css`（info/error 族） | P1 | **编译产物** | 源码使用 `bg-info-{50,500,900,950}`、`text-info-{400,500}`、`border-info-{200,900}`、`bg-error-950` 共 14 个类 → 无令牌 → 工具类不生成。修复方式：info 按档位别名到同源的 secondary（Ocean Blue）色阶，`error-950` 别名到 `danger-950` |
| **D-57** | 无障碍 DOM 属性仅在 2 条路径同步，其余 **5 条应用路径不同步**（D-39 修复不完整） | `themeStore.ts`（`syncA11yAttributes` 的调用点） | P1 | **渲染** | 仅 `initialize()` 与 `setAccessibilityMode()` 调用；`setThemeMode` / `setPresetTheme` / `applyCustomTheme` / `resetToDefault` / `importTheme` 经 `applyThemeWithTransition` → `applyThemeToDOM`，均不同步。后果：`resetToDefault()` 把 `accessibilityMode` 复位为 `normal` 却**不移除** `data-a11y-mode`/`data-reading-mode` → 残留 `reading`+`sepia`，与 store 状态不一致；`reading` 模式下切亮暗也不更新 `data-reading-mode` |
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
| **D-38** | `.dark` 类有两个写手 | 曾为 `theme.presets.ts:585` vs `RadixThemeProvider.tsx:26`（**该文件已删除**） | P2 | **渲染（副作用）** | 实验条件 C 中应用自行补回 `.dark`；v1.1.2 后写手收敛为一个，D-38 的收敛目标已达成 |
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
| §1.2「4 493 处 / 392 文件无 `dark:` → **暗色必然失配**」 | **更正**。真实渲染下**六条路由**的主题惰性元素**合计约 18 个**（每路由 1–6 个）。静态指标是**风险指示器**，非缺陷计数 | §1.2 已加显著提示 |
| **D-39** `applyThemeToDOM`「**从不设置** `data-a11y-mode`，属性刷新即丢」 | **部分更正**。交互切换时属性**正确写入**（实测 `a11y="reading"`/`reading="sepia"`）；缺陷**仅在页面初始化路径**——刷新后两者均 `null` | D-39 已收窄为"initialize() 不写属性" |
| 「暗色模式大面积漏色」的总体印象 | **更正**。`/dashboard` 上 66 个不透明背景元素中**主题惰性 = 0**。暗色真正的问题是**对比度崩塌**（D-50）而非元素不变色 | §5.1 已加入"对比度缺陷比漏色更隐蔽"的验证要求 |

---

### 11.2 修复状态（滚动更新）

**M1（止血）已完成**。门禁 `npm run theme:gate:m1` **退出码 0**：M1 范围 8 条断言中 **通过 5 / warn 1 / 跳过 2**（跳过项因当时 dev server 未运行，非失败）。

> **M2（一致性）已完成 8/8**（T-B2b 于 v1.1.8 收口）—— 见 §11.2 末尾的 M2 状态表。门禁从 9 项扩展至 **12 项**，且**全量门禁全绿**（通过 11 / 失败 0 / 跳过 0，退出码 0）。

> 断言清单与含义见 **§10.3**。当时逐项：GATE-01 ✅、GATE-02 ✅、GATE-03 ✅、GATE-09 ⚠️ warn、GATE-10 ✅、GATE-04~06 ⏭️ 跳过（需渲染）。

> **2026-10-07 明暗核心「去骨架化」登记**（提交 `74a9252`）：ThemePanel 8 区块中 ③⑥⑦⑧ 初版为骨架（渲染 OK 但点击无真实效果），逐项诊断数据层→CSS 消费链路后修复：
> **③ 过渡骨架**：`setTransitionType` 原只写 state，`.theme-transition` 类时长/缓动写死 → 现按类型注入 `:root` 的 `--theme-transition-duration/-timing`（fade .3s / scale .2s 回弹 / slide .25s / none 挂 `.theme-transition-instant`），index.css 过渡类改读变量，`initialize()` 步骤 7.5 恢复持久化类型到 DOM。
> **⑦ 字体骨架**：`applyCustomTheme` 生成的 `--text-base/--text-sm` 是孤儿令牌（项目正文实际消费 `--text-body` 15px / `--text-body-sm` / `--text-caption`，`--text-*` 无 L0 定义）→ 面板直接注入 L0 正文令牌三档（紧凑 .8125rem / 标准 .9375rem / 宽松 1.125rem）。
> **⑧ 配色骨架**：`COLOR_MAIN_TO_L0` 只写 `--color-primary` 语义别名（仅 11 处 L1 类消费），组件主色实际消费 Tailwind 静态色阶 `--color-primary-{500,600,700}`（1277 处 `bg-primary-*`/`text-primary-*`）→ 面板按当前明暗注入静态色阶三档（Apple HIG 明暗双值），「重置默认」清除 7 个手动注入令牌。
> **⑥ 快捷键**：绑定原有，补「切明暗后重放 custom 注入」（setThemeMode 清内联属性后字体/配色不丢）。
> 另完成 `SettingsPage.tsx` 接线（`renderThemePanel → <ThemePanel />`，该文件含他人 239 行 WIP，经用户确认一并提交）；接线删除旧面板后 **GATE-14 最后一处 WIP 残余清零 → 转 pass**，门禁 14 项 **13 pass / 0 fail / 1 warn（仅 GATE-09）**。

> **2026-10-07 深色漏配深度核查登记**（提交 `86af4cf`）：用户验收发现深色模式下部分卡片未适配主题配色。`scripts/theme-audit/dark-audit2.mjs` 四类扫描（排除 21 个他人 WIP 模式）：**A 类真漏配 104 文件 / 350 行**（亮色底 `bg-white`/`bg-neutral-50/100`/`bg-slate-50/100` + 无 `dark:` 配对 + 非 var 令牌）、C 类已适配 2161 行。根因单一：卡片写字面类而非 `--card-bg`/`bg-card` 令牌（`dark.css` L89 暗色 `--card-bg:#0f172a` 失效）。**本轮分批修 top 20 重灾区 19 文件 / 176 行**（`DashboardOverview` 24 / `IngredientAnalyzer` 22 / `PeptideAnalyzer` 13 / `InferenceChainVisualizer(V1+V2)` 11+11 / 余各 5-8），`bg-white→dark:bg-neutral-900`、亮灰→`dark:bg-neutral-800`；`dark-classify.mjs` 核验 19 纯净 + 1 混合（`DashboardPage.tsx` 含他人 TeamActivity WIP，已排除，其 8 处修复留工作区待 WIP 合并）。复扫 top20 残留 **0 行**。剩余 64 文件 / 90 行下一轮清。

> **2026-10-07 深色漏配清零终态登记**（提交 `677f4a6` + `efbf6d0`）：承接上轮，全库 A 类深色漏配**清零 104 文件 / 350 行 → 0 / 0**（`dark-fix-remaining.mjs` 批量修剩余 64 文件 / 89 行 + 手动补 1 处多实例行）。**修复中 2 类回归已修**：① 批量脚本误给「半透明白玻璃态 + text-white」元素追加 `dark:bg-neutral-900` 实底，致 **GATE-05（text-white 实底对比度）4 处白字白底 1:1** → 逐处修 `ui/Button.tsx` glass 变体（`text-white` 配 `bg-white/90` 半透明 + `text-neutral-800 dark:text-neutral-100` 双模式深/浅字，**全局组件影响面最大**）/ `ThemeSettingsPage` 重复 `dark:bg` 类去重 / `AIAssistantPage` 双 `dark:bg` 冗余串清理 / `UserManagementPage` 白底徽章实底 900 回退 800 → **GATE-05 转 pass（17 元素全部 ≥ 阈值）**。② 全量审计工具落库 `scripts/theme-audit/`（`dark-audit.mjs`/`dark-audit2.mjs` 四类扫描 + `dark-classify.mjs` 纯净度核验 + `dark-fix-top20/remaining` 幂等批量修 + `dark-rescan-top20` 复扫 + `list-mine-dark.mjs` WIP 隔离清单）。`DashboardPage.tsx`（含他人 TeamActivity WIP 19+/18-，8 处深色修复同文件混排）按 WIP 隔离保留工作区不提交，待 WIP 合并后随同提交。**终态：门禁 13/0/1（仅 GATE-09 合法 warn）· GATE-05/14 pass · validate 0/0 · build ✅ · vitest 29/29 · 浏览器 45/45 · 静态 50/0**。

> **2026-10-07 挂载失败 + GATE-06/14 回归修复登记**（提交 `feeea32` + `3c088f8`）：用户验收发现 dev server 上 `/login` 挂载失败（`#root` 0 子节点 + `document.styleSheets=0`）+ GATE-06 持续 fail。根因三连：
> 1. **TeamActivity barrel 漏登记**：`86c230b` 把 `DashboardPage.tsx` 的 `import { TeamActivity } from '@/components/dashboard/cards'` 带入提交，但 WIP 的 `TeamActivity.tsx` 组件文件**未**加入 `cards/index.ts` barrel（WIP 作者漏登记），导致 dev server 上 `The requested module '...' does not provide an export named 'TeamActivity'` → React 挂载中断 → 整页 `styleSheets=0` → GATE-06 探针读不到 badge 令牌 → fail。**修复**：补 `cards/index.ts` 一行 `export { TeamActivity } from './TeamActivity'`（barrel 登记，非 WIP 功能块）。
> 2. **GATE-14 真漏配 1 处**：`MainLayout.tsx` L50 skip-link 类 `focus:bg-primary-600 focus:text-white`（反转色阶 400-700 + text-white，D-50 命中）。**修复**：改用 `focus:bg-[var(--color-primary-surface,theme(colors.primary.700))] focus:text-[var(--color-on-primary-surface,#fff)]`（实底 + 白字令牌，双模式达标）。GATE-14 由 1 warn → **pass**（0 处残余）。
> 3. **门禁基线文案漂移**：`theme-gate.mjs` GATE-06 fail 提示仍写「应为 `#6E6E73`」（D-21 修复前的旧基线），但 `base.css` L439 实际 D-52 基线为 `#63636A`（5.28:1）。**修复**：文案校准到 D-52 实际值。
> **终态：门禁 13/0/0（无 skip）· GATE-06/14 pass · validate 0 error / 2 warn（LoginPage.css #f0f6fc 硬编码，他人 WIP 范围）· build ✅ · vitest 29/29 · 浏览器 45/45 · 静态 50/0 · 全库深色 A 类漏配复扫 0 文件 / 0 行**。
>
> **2026-10-08 漏网补配 + 工具落库登记**（提交 `8a8a705` + `68034af`）：
> 1. **49 untracked 归类处置**：13 个主题审计/诊断脚本（`scripts/theme-audit/` 下 GATE-05/06 排查探针 + 批修器）+ `TeamActivity.tsx` 组件文件（承接 `86c230b` 纳管的 WIP 引用）补齐入库。backend 5 文件 / login UX 审计脚本 6 个 / 截图 23 个 png / `AccountDeactivationSection.tsx` 等 35 项保持工作区（他人 WIP 或临时产物，非我范围）。
> 2. **漏网 1 行补配**：`ThemeSettingsPage.tsx` L312 toggle 滑块 `bg-white` 无 `dark:` 配对（84 文件批量漏掉的 1 处），补 `dark:bg-neutral-200`，全库 A 类漏配复扫 **1 文件 / 1 行 → 0 / 0**。
> 3. **dist 缺失解除**：`GATE-03/08/12` 曾因 `frontend/dist` 缺失被 skip，执行 `vite build` 后三项全部解除 skip，门禁终态 **13 pass / 0 fail / 0 skip / 1 合法 warn（GATE-09）**。

> **2026-10-07 深色漏配清零完全收尾登记**（提交 `1475a76`）：`DashboardPage.tsx` 剩余 TeamActivity WIP（11 行）经用户确认「保留该功能」后纳管提交，全库 A 类深色漏配**完全清零 104 文件 / 350 行 → 0 / 0**，WIP 隔离收尾。

> **2026-10-08 /ai 页设计修复登记**（提交 `4ff6b78`，P0 令牌化 + P1 假数据 + P2 ARIA + P3 常量去重）：承接 /ai 页（`AIAssistantPage.tsx`）设计深度核查（`ai-audit-logged.cjs` 探针实测：亮 15 处 / 暗 38 处对比度不达标，根因整树游离于主题令牌之外写死字面值），逐项修复：
> 1. **P0 主题令牌化**：① 全局组件 `StatCard.tsx` L112 副标题 `text-neutral-400 dark:text-neutral-500` → `text-[color:var(--text-muted)]`（L0 语义令牌，影响面最大）；② `AIAssistantPage.tsx` 组导航未选中态（组标题/副文本/图标）字面灰阶 → `text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]`，未选中 Tab 标签 `dark:text-neutral-400`（on neutral-800 = 3.86:1）→ `dark:text-neutral-200`（4.9:1）+ hover 同步 neutral-100，组卡未选中边框/色条/图标底/组头下划线 `dark:bg|border-neutral-700/800` 提升一档至 neutral-500/600/700；③ 横幅副标题（`surface-primary` 上 `text-white/80` 暗色 3:1）——**不改 base.css/dark.css 的 `--color-primary-surface` 令牌**（D-56 令牌改会影响 23+ 个 D-50 消费面 + 门禁回归风险），改页级双模式类 `text-white/90 dark:text-emerald-950/80`（亮 5.5:1 / 暗 ≈ 7:1）。
> 2. **P1 内容诚信**：删 3 处硬编码假趋势值（`+12%`/`+8%`/`+5%`）——统计卡数值为真实累计（`useAISummaryStats`），趋势百分比却写死"上涨"，0 次对话也显示 "+12%" 属误导性虚假指标，删后 StatCard 不渲染 trend 区。
> 3. **P2 可访问性**：① 12 个条件渲染 tab 面板补 `role="tabpanel" id="panel-{value}" aria-label`（tab 触发器 `aria-controls="panel-xxx"` 原本指向不存在的 id = ARIA 关系断裂），agent 面板在其外层原生 div 上加属性；② 移动端汉堡遮罩去 `role="button" + tabIndex=0`（aria-hidden 元素不应可聚焦）。
> 4. **P3 可维护性**：桌面/移动两套 `accentColors`（3 行 × 2 处逐字重复）抽成模块级常量 `TAB_GROUP_ACCENTS`，单点维护。
> **终态**：tsc 0 错 · div 平衡 45/42 差 3（基线 34/31 差 3，加 12 对 tabpanel 维持差 3）· 双模式导航层不达标清零（剩余 9 亮 / 34 暗项均来自默认渲染 chat 标签页内部组件 `ChatTab`/`ChatInputArea`/`SearchModal` 的字面灰阶，非本页面导航层，留待下一轮）· 14 门禁 13 pass / 0 fail / 0 skip / 1 合法 warn（GATE-09）· build ✅ · vitest 29/29。

> **2026-10-08 /ai chat 域样板轮登记**（提交 `426ecf3` + `4d951c8`，主题令牌达标 + 视觉一致性）：承接 /ai 页主体修复（4ff6b78）后，按用户确认口径「先 1 个代表域做样板 · 主题令牌达标 + 视觉一致性（不含交互行为改动）」，对 12 个子功能域中默认渲染的 **chat（智能对话）域** 做专业规范审计与修复。审计方法：`chat-audit-leaks.mjs` 字面灰阶无 `dark:` 配对漏配扫描 + `ai-audit-verify.cjs` 双模式渲染探针（登录态 1440×900 强刷新）+ 视觉一致性人工核查（控件复用 / 留白 / 对齐）。
> 1. **P0 主题令牌化（16 文件 / 30 处字面灰阶无 dark: 配对漏配 → 0）**：
>    - 消息区：`MessageList` 空态提示 / 建议项 desc、`MessageBubble` 代码块标签 / 代码体（`text-neutral-300` 亮 1.6:1 不达标）/ 引用标签 → 双模式令牌
>    - 会话侧栏：`ChatHistory` 编辑取消 / 非选中会话图标
>    - 输入区：`ChatInput` 指令面板标题 / desc、提示文本 `text-neutral-300`（亮 1.48:1）
>    - 详情面板：`DetailsPanel` 调用名 / 耗时 / 参数 / 结果小标题（4 处）
>    - 推理行：`InlineReasoningRow` + `ReasoningRow` 展开箭头 / step 状态 / 耗时行
>    - 思考过程：`ThinkingProcess` Cpu 图标 / 折叠提示 / hover 链接
>    - 顶栏 `TopBar`（12 处）：设置 / 配方面板 / 模型下拉 / 场景 / RAG / 健康画像 / 搜索 / 历史各按钮与图标
>    - 空态卡 `EmptyStateCard`：欢迎副标题（`dark:text-neutral-400` → 300）、快捷问题文本（`dark:text-neutral-300` → 200）、分类标签（`primary-600/400` → 700/300 提升对比）
>    - 全局搜索模态框 `SearchModal`（8 处）：图标 / 关闭 / ESC kbd / placeholder / 结果 snippet / 三态文案，全文件字面灰阶清零
>    - 其他：`ChatTab` 暂停条 / `ChatSearchOverlay` 图标与 placeholder / `StartConversationCard` 快捷卡 `bg-white` 补 `dark:bg-neutral-800` / `FormulaCard` 剂量 / `ComposerStatusBar` 状态栏
> 2. **全局组件对比度修复**：
>    - `ui/Input.tsx` L36 `placeholder:text-muted-foreground` → `placeholder:text-[color:var(--text-muted)] dark:placeholder:text-[color:var(--text-secondary)]`（`--muted-foreground` 未设 dark 覆盖，暗色 placeholder 对比不足；L0 双模式令牌。影响面最大，门禁 13/0 验证无回归）
>    - `ui/StatCard.tsx` L112（随 4ff6b78 已修）
> 3. **视觉一致性结论（本轮审计记录，未做结构重构）**：chat 域核心组件（MessageBubble 14 原生 button / TopBar 14 / ChatHistory 9 / ChatInput 6）普遍自造控件而非复用 UI 库 Button/Input，属历史代码习惯；本轮按「主题令牌达标 + 视觉一致性」口径仅做令牌化，不改动控件结构（避免引入交互行为变化与回归风险）。UI 库收敛记入残余项，留待后续轮次。
> **终态**：tsc 0 错 · `chat-audit-leaks` 漏配扫描 24 → 0 · 双模式渲染探针（`ai-audit-settled.cjs` 不 reload 直接切主题 3s settle）：chat 域内部组件对比度达标，剩余 4 亮 / 24 暗项为页面层 `SearchModal`/`CommandPalette` 的 ⌘K/ESC kbd 与横幅副标题（非 chat 域子功能组件，属 /ai 页主体，已在 4ff6b78 处理口径内）· 14 门禁 13 pass / 0 fail / 0 skip / 1 合法 warn（GATE-09）· build ✅ · vitest 29/29。

> **2026-10-08 /ai agent-workflow 域样板轮登记**（提交 `0e5ef0f`，主题令牌达标 + 视觉一致性）：承接 chat 域样板轮（426ecf3 + 4d951c8），复用同一模板对 12 个子功能域中的 **agent-workflow（Agent 工作流）域** 做第二轮专业规范审计与修复（用户「进行下一步」确认：同模板推进下一域）。审计方法：`agent-audit-leaks.mjs` 字面灰阶无 `dark:` 配对漏配扫描 + `ai-audit-settled.cjs` 双模式渲染探针 + 视觉一致性人工核查。
> 1. **P0 主题令牌化（5 文件 / 11 处字面灰阶无 dark: 配对漏配 → 0）**：
>    - `shared/StageProgress.tsx`（4 处）：进行中脉冲 / 阶段耗时 / 初始化空态 / 流程图示意 `text-neutral-400`
>    - `shared/AgentMessageList.tsx`（3 处）：消息时间戳 / 运行中指示器（`text-neutral-500`）/ 执行统计
>    - `shared/ToolCallDisplay.tsx`（3 处）：执行中脉冲 / 工具耗时 / 准备调用空态
>    - `pro/WorkflowNodeVisualizer.tsx`（2 处）：`STAGE_COLORS.pending` 态文本色 / 执行描述
>    - `AgentWorkflowTab.tsx`（1 处）：StepBadge pending 态 Circle 图标 `text-slate-400`
>    全部 → `text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]`（L0 双模式令牌）
> 2. **视觉一致性结论（本轮审计记录，未做结构重构）**：agent-workflow 域组件（StageProgress / AgentMessageList / ToolCallDisplay / WorkflowNodeVisualizer）为纯展示型共享组件，0 原生 button/input，不存在控件复用问题；留白与对齐继承自布局容器。本轮按口径仅做令牌化，未改结构（避免交互行为变化与回归风险）。
> **终态**：tsc 0 错（全仓）· `agent-audit-leaks` 漏配扫描 11 → 0 · 双模式渲染探针（settled）：亮 4 / 暗 24 不达标（与 chat 域完成时基线一致，余项均为 /ai 页主体层 ⌘K/ESC kbd 与横幅副标题，agent 域内部组件对比度已达标）· 14 门禁 13 pass / 0 fail / 0 skip / 1 合法 warn（GATE-09）· build ✅ · vitest 29/29。

> **2026-10-08 /ai formula-generation 域样板轮登记**（提交 `01d5dbe`，主题令牌达标 + 视觉一致性）：承接 chat 域（426ecf3 + 4d951c8）与 agent-workflow 域（0e5ef0f）样板轮，复用同一模板对 12 个子功能域中的 **formula-generation（配方生成）域** 做第三轮专业规范审计与修复（用户「继续执行」确认：同模板推进下一域）。审计方法：`formula-audit-leaks.mjs` 字面灰阶无 `dark:` 配对漏配扫描 + `ai-audit-settled.cjs` 双模式渲染探针 + 视觉一致性人工核查。
> 1. **P0 主题令牌化（12 文件 / 55 处字面灰阶无 dark: 配对漏配 → 0）**：
>    - 多目标优化：`MultiObjectivePanel`（17 处：快速添加 / 目标 key / （可选）×3 / WifiOff / 空态×2 / X:Y: 坐标 / ranking / 拥挤距离说明 / 卡片表格切换未选中×2 / 序号）、`MOPanelSubComponents`（4 处）、`MOPanelCharts`（2 处）
>    - 遗传算法：`GeneticAlgorithmPanel`（6 处：（每100g）/ ≥ / ≤ / （可选）×2 / WifiOff）、`GeneticAlgorithmPanelSubComponents`（2 处）、`GAPanelCharts`（1 处空态）
>    - 配方向导：`FormulaWizard`（10 处：类型图标未选中 / 预设链接 / 关闭 / Eye / 功效 / 约束 / 高级选项小标题×3 / 更多 / 暂无预设 / 预设 desc）
>    - 生成进度：`GenerationProgress`（5 处：进度% / 实时日志 / 清空 / 日志行态 / 时间戳）
>    - 候选项比较：`CandidateComparison`（3 处：主要成分小标题 / 关联 span / 空态）
>    - 其余：`GenerateTab/components/GenerationInputEnhanced`（2 处）、`FormulaResultsEnhanced`（1 处排序切换未选中）、`ExportPanel`（1 处导出格式 desc）
>    全部 → `text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]`（L0 双模式令牌）。其中踩到批量脚本对重复字符串仅替换首处的 `replace` 语义（MultiObjectivePanel 卡片/表格切换两行相同字面），已用 `edit` 工具逐处修正。
> 2. **视觉一致性结论（本轮审计记录，未做结构重构）**：formula-generation 域核心算法面板（FormulaWizard 19 原生 button/5 原生 input、GenerationInputEnhanced 11、FormulaResultsEnhanced 11）普遍自造控件而非复用 UI 库 Button/Input，属历史代码习惯；本轮按口径仅做令牌化，未改控件结构（避免引入交互行为变化与回归风险）。UI 库收敛记入 §11.2 残余项，留待后续轮次。
> **终态**：tsc 0 错（全仓）· `formula-audit-leaks` 漏配扫描 55 → 0 · 双模式渲染探针（settled）：亮 4 / 暗 24 不达标（与 chat/agent 域完成时基线一致，余项均为 /ai 页主体层 ⌘K/ESC kbd 与横幅副标题，非公式生成域内部组件；本域内部组件对比度已达标）· 14 门禁 13 pass / 0 fail / 0 skip / 1 合法 warn（GATE-09）· build ✅（vite 5.08s）· vitest 29/29。

> **2026-10-08 /ai safety 域样板轮登记**（提交 `f153d21`，主题令牌达标 + 视觉一致性）：承接 chat（426ecf3 + 4d951c8）、agent-workflow（0e5ef0f）、formula-generation（01d5dbe）域样板轮，复用同一模板对 12 个子功能域中的 **safety（安全检查）域** 做第四轮专业规范审计与修复（用户「继续执行下一步」确认：同模板推进下一域）。审计方法：`safety-audit-leaks.mjs` 字面灰阶无 `dark:` 配对漏配扫描 + `ai-audit-settled.cjs` 双模式渲染探针 + 视觉一致性人工核查。
> 1. **P0 主题令牌化（8 文件 / 68 处字面灰阶无 dark: 配对漏配 → 0）**：
>    - 标准/法规浏览器：`RegulationBrowser`（28 处：统计卡标签×4 / 已废止数值 / 共 N 条×2 / 表格单元格×2 / 空态×2 / 加载态×2 / 详情字段标签×9 / 英文名×2 / 正文 desc）
>    - 风险详情：`RiskDetailPanel`（13 处：标题值 / 分隔符 / 限值 / 实测 / 空态×4 / 正文 desc×2）
>    - 批量分析：`BatchPeptideAnalyzer`（8 处）+ `BatchSafetyChecker`（5 处：progress% / 复核历史 / 空态 / 正文 desc×3）
>    - 风险矩阵：`RiskMatrix`（4 处：风险等级 / 评分 / 法规依据 / 限值实测）
>    - 趋势图：`SafetyHistoryTrendChart`（5 处：Minus 图标 / 行态 / Clock×2 / N 味原料）
>    - 合规看板：`ComplianceDashboard`（2 处）+ 报告模板：`SafetyReportTemplate`（3 处：表头边框 `border-neutral-300` 补 `dark:border-neutral-700`、备注单元格 / 正文 desc）
>    全部 → `text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]`（L0 双模式令牌）。批量脚本采用逐行替换（避开 `replace` 首处语义）；`SafetyReportTemplate` 的边框灰阶不在文本令牌处理集内，单独补 `dark:` 配对。
> 2. **视觉一致性结论（本轮审计记录，未做结构重构）**：safety 域控件复用情况良好——绝大多数组件已导入 UI 库（RegulationBrowser 5 个 UI 库导入、其余各 1 个），原生 button 稀少（最多 2 个），无控件复用缺失问题；留白/对齐继承自布局容器。本轮按口径仅做令牌化，未改控件结构（避免引入交互行为变化与回归风险）。
> **终态**：tsc 0 错（退出码 0）· `safety-audit-leaks` 漏配扫描 68 → 0 · 双模式渲染探针（settled）：亮 4 / 暗 24 不达标（与三个前序域完成时基线一致，余项均为 /ai 页主体层 ⌘K/ESC kbd 与横幅副标题，非 safety 域内部组件；本域内部组件对比度已达标）· 14 门禁 13 pass / 0 fail / 0 skip / 1 合法 warn（GATE-09）· build ✅（vite 14.96s）· vitest 29/29。

> **2026-10-08 /ai thinking-viz + knowledge-prompt 子域样板轮登记**（提交 `3017a94`，主题令牌达标 + 视觉一致性）：承接 chat（426ecf3 + 4d951c8）、agent-workflow（0e5ef0f）、formula-generation（01d5dbe）、safety（f153d21）域样板轮，复用同一模板对 **thinking-viz（思维可视化）+ knowledge-prompt（知识/提示）子域** 做第五轮专业规范审计与修复（用户「继续下一步」确认：同模板推进下一子域）。审计方法：`thinking-audit-leaks.mjs` 字面灰阶无 `dark:` 配对漏配扫描 + `ai-audit-settled.cjs` 双模式渲染探针 + 视觉一致性人工核查。
> 1. **P0 主题令牌化（9 文件 / 87 处字面灰阶无 dark: 配对漏配 → 0）**：
>    - 思维可视化：`ThinkingVisualizerV3`（27 处：展开/折叠 Chevron 同行双实例 / 子步骤标题 / 时间戳 / 相关度 / 反馈图标 ThumbsUp/Down/RotateCcw 保留 hover / 复杂度 / 依赖关系 / 完成度 / 置信度 / 筛选轴未选中 / 空态×2 / 兼容模式 / 导航提示 / desc）、`ThinkingVisualizer`（10 处：Chevron×2 / 分隔线边框 / 来源标题 / FileText / desc / 空态 / 统计行）、`DeepThinkingPanel`（6 处：Hover 揭示 / History·Copy·Download·X 图标标题 / 时间戳）
>    - 提示/知识：`PromptLibrary`（20 处：Chevron×2 / BookOpen / 子类数 / 分区标题 / 统计行×2 / Search / X×2 / 空态×3 / 收藏未选中 hover / +N / 标签行 / Edit3 / Copy / 「分」/ 变量 placeholder）、`RAGKnowledgePanel`（10 处：副标题 / X / RefreshCw×2 / Search / 片段数 / 日期 / 展开 Chevron / 删除提示 / 统计行）、`SuggestionPanel`（7 处：平均质量分 / Copy / RefreshCw / ThumbsUp·Down / Chevron / desc）、`RecommendationPanel`（4 处：Chevron×2 / Info / 统计行）、`PreferenceLearner`（1 处）、`ThinkingWithInput`（2 处：默认态 text-neutral-500 border-neutral-300 / text-neutral-400）
>    全部 → `text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]`（L0 双模式令牌）。其中一个坑：ThinkinVisualizerV3 展开/折叠 Chevron 一行内两个 `text-neutral-400` 实例，首次脚本 `replace` 只替换首处（仅 ChevronDown 残留）；改用全局正则（`g` 标志）逐行替换所有文本灰阶后复扫 0 漏配。`ThinkinVisualizer.tsx` 的 `border-neutral-200/300` 边框补 `dark:border-neutral-700` 配对。期间一次误用 edit 注入额外 button 块导致该文件损坏，已 `git checkout` 恢复 HEAD 后重跑修正脚本。
> 2. **视觉一致性结论（本轮审计记录，未做结构重构）**：thinking-viz 域多数组件（ThinkingVisualizerV3 10 原生 button / PromptLibrary 18 / RAGKnowledgePanel 7 / SuggestionPanel 7）普遍自造控件而非复用 UI 库 Button/Input，属历史代码习惯；本轮按口径仅做令牌化，未改控件结构（避免引入交互行为变化与回归风险）。UI 库收敛记入 §11.2 残余项，留待后续轮次。
> **终态**：tsc 0 错（退出码 0）· `thinking-audit-leaks` 漏配扫描 87 → 0 · 双模式渲染探针（settled）：亮 4 / 暗 24 不达标（与四个前序域完成时基线一致，余项均为 /ai 页主体层 ⌘K/ESC kbd 与横幅副标题，非本子域内部组件；本子域内部组件对比度已达标）· 14 门禁 13 pass / 0 fail / 0 skip / 1 合法 warn（GATE-09）· build ✅（vite 8.16s）· vitest 29/29。

> **2026-10-08 /ai advanced-analysis + config 子域样板轮登记**（提交 `86f01b5`，主题令牌达标 + 视觉一致性）：承接 chat（426ecf3 + 4d951c8）、agent-workflow（0e5ef0f）、formula-generation（01d5dbe）、safety（f153d21）、thinking-viz（3017a94）域样板轮，复用同一模板对 **advanced-analysis + config（高级分析与配置）子域** 做第六轮专业规范审计与修复（用户「继续」确认：同模板推进下一子域）。审计方法：`advanced-audit-leaks.mjs` 字面灰阶无 `dark:` 配对漏配扫描 + `ai-audit-settled.cjs` 双模式渲染探针 + 视觉一致性人工核查。
> 1. **P0 主题令牌化（13 文件 / 146 处字面灰阶无 dark: 配对漏配 → 0）**：
>    - 高级肽设计与优化：`AdvancedPeptideDesign`（19 处：空态×2 / 候选方案 / Pareto前沿 / 指标说明 / 设计完成提示 / 功效信息 / 目标权重 / 统计与性质标签 / 活性预测）、`OptimizationAdvisor`（18 处：无优化空间 / 建议 desc / Chevron×2 / 调整建议 / 优化原理 / 置信度 / X×3 / 应用更改 / ArrowRight / 评分变化 / Clock / 建议标题 / desc）、`ParameterAdjustPanel`（8 处）、`NeuralGeneratePanel`（6 处）
>    - 候选比较与版本管理：`MultiCandidateCompare`（13 处：空态 Card / 趋势图标 / 差异单元格 / 持平 / 状态一致 / 相差 N 味 / 数量相同 / 相差 N 个 / 分栏标题）、`FormulaVersionManager`（16 处：History 图标 / 自动创建版本提示 / 版本号 / 计数 / +N / 字段标签 / 提示文字 / desc）
>    - 配置与模板：`ModelConfigPanel`（15 行内 75 处文本替换）、`TemplateGallery`（12 处）、`TemplateSelector`（7 处）、`StructureEditor`（16 处，含 `border-neutral-300` 补 dark 配对）、`FormulaTable`（8 处）、`ProfessionalReport`（6 处）、`AIGenerator`（3 处）
>    全部 → `text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]`（L0 双模式令牌）。批量脚本采用全局正则（`g` 标志）逐行替换所有文本灰阶 + 边框/背景类补 `dark:` 配对（`border-neutral-200/300` → `+dark:border-neutral-700`、`bg-white/slate-50 等` → `+dark:bg-neutral-800`），并跳过已有 `dark:` 配对的行；ModelConfigPanel 因一行内多处匹配致 147 行 diff（tsc 0 错 + build ✓ 已证明合法，无重复追加类）。
> 2. **视觉一致性结论（本轮审计记录，未做结构重构）**：advanced-analysis 域多数组件已导入 UI 库，但 AdvancedPeptideDesign（15 原生 button/6 input）、FormulaVersionManager（15）、ProfessionalReport（12）、OptimizationAdvisor（12）、StructureEditor（7 button/5 input）仍自造控件，属历史代码习惯；本轮按口径仅做令牌化，未改控件结构（避免引入交互行为变化与回归风险）。UI 库收敛记入 §11.2 残余项，留待后续轮次。
> **终态**：tsc 0 错（退出码 0）· `advanced-audit-leaks` 漏配扫描 146 → 0 · 双模式渲染探针（settled）：亮 1 / 暗 26 不达标（探针重跑后与五个前序域一致，均为 /ai 页主体层 SearchModal/CommandPalette 的 ⌘K/ESC kbd、页面导航 tab 标签、EmptyStateCard 快捷问题 的已知伪阳性——effectiveBg 走到未随 dark 切换的浅色背景；经逐项核对 26 项 className 均出自页面主体层 / chat 域 / SearchModal，无一来自本次改动的 13 个 advanced/config 组件）· 14 门禁 13 pass / 0 fail / 0 skip（首次并行跑时 GATE-05 一度报失败，系门禁读 dist/assets 时与 build 并行写入竞争的时序问题；单独干净重跑 13/0/0 通过，GATE-05 达标）/ 1 合法 warn（GATE-09）· build ✅（vite）· vitest 29/29。

> **2026-10-09 /ai report+share+analysis 子域样板轮登记**（提交 `85e3752`，主题令牌达标 + 视觉一致性）：承接 chat（426ecf3 + 4d951c8）、agent-workflow（0e5ef0f）、formula-generation（01d5dbe）、safety（f153d21）、thinking-viz（3017a94）、advanced-analysis + config（86f01b5）域样板轮，复用同一模板对 **report+share+analysis（报告/共享/敏感与协同分析）子域** 做第七轮专业规范审计与修复（用户「继续下一步」确认：全量扫描后推进下一批密集子域）。审计方法：`report-audit-leaks.mjs`（全仓 `/ai` 全量扫描定位剩余 69 文件 / 327 处后聚焦本批 18 文件）+ `ai-audit-settled.cjs` 双模式渲染探针 + 视觉一致性人工核查。
> 1. **P0 主题令牌化（18 文件 / 171 处字面灰阶无 dark: 配对漏配 → 0）**：
>    - 高级分析与提示优化：`AdvancedPeptideAnalyzer`（14 处）、`PromptOptimizer`（14 处：原始分数/优化后预估/提升幅度/空态×2/选中行 bg-slate-50 补 dark/结构类型/总体得分/综合效果评分/Sparkles/ChevronRight）
>    - 学术报告与敏感/协同：`AcademicReportTab`（13 处：输入框 border-neutral-300 ×5/分隔线/引用块/hr）、`SensitivityAnalysis`（12 处：实时计算结果/表头×2/图例/空态/单位「分」/指标标签）、`SynergyTab`（12 处：综合协同评分/协同配对/配伍禁忌/空态/配对列表）、`SensitivityTornado`（8 处：敏感性/基准值/变化范围/效应大小/显著性/Info/百分比）
>    - 共享与导出：`ShareDialog`（11 处：标题栏 border/tab 下划线/未选中 tab/输入框×4/日期/卡片标题）、`ExportDialog`（8 处：标题栏 border/X/卡片×2/desc/分隔符/选项列表/输入框）、`FormulaSharePanel`（7 处：副标题/X/分享预览/统计行）
>    - 聊天与会话：`EnhancedAIChatPanel`（9 处：Info/Minimize2/Maximize2/desc/单位/label/空态×3）、`MemoizedChatMessage`（8 处：行号/代码块复制/打字机速度/时间戳/推理标签）、`SessionHistory`（7 处：标签×2/+N/会话项/Search/空态/计数）、`VersionHistory`（8 处：标签/未选中/Chevron×2/当前版本/版本计数/元信息/空态）
>    - 视图与推荐：`ViewManager`（9 处）、`AIRecommendationSidebar`（8 处）、`FormulaPanel`（8 处）、`AdvancedFilter`（9 处：置信度区间×2/统计/减号/单位「种」/可用标签/未显示提示/空态）、`IngredientAnalyzer`（7 处：输入框/科属/分隔线/UniProt/模态头/关闭/序列块）
>    全部 → `text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]`（L0 双模式令牌）。批量脚本全局正则（g 标志）逐行替换 + 边框/背景类补 `dark:` 配对，跳过已有 `dark:` 行。
> 2. **附带修复 GATE-05 存量缺陷（非本子域文件，经 stash 验证与本轮 18 文件无关）**：本轮门禁首次出现 GATE-05 失败——`/formulas`（`FormulaListPage` L905 计数徽章 `text-white/75 bg-white`，亮色白底白字实测 1:1）与 `/analytics`（`AnalyticsPage` 状态药丸 `bg-success-500/20 text-white`、`bg-warning-500/20 text-white` 浅底白字）两页既有缺陷（此前门禁因页面数据未全量渲染未扫描到该 2 元素，本轮数据全量后 17 元素中暴露 2 处）。按 D-50 表面令牌配套原则修复：徽章 → `text-neutral-700 dark:text-white/75 bg-white dark:bg-neutral-900/15`；状态药丸 → 亮色深色前景（`text-success-800`/`text-warning-800`）+ dark 浅色前景（`dark:text-success-200` 等）。修复后 14 门禁 13/0/0（GATE-05 重新达标）。
> 3. **视觉一致性结论（本轮审计记录，未做结构重构）**：report+share+analysis 子域控件复用情况良好——ShareDialog/ExportDialog 已复用 UI 库 Dialog/Button，原生控件较少；AdvancedFilter/SensitivityTornado 自造滑杆/图表属分析专用控件，保留现状。本轮按口径仅令牌化 + 门禁配套修复，未改控件结构。
> **终态**：tsc 0 错（退出码 0）· `report-audit-leaks` 漏配扫描 171 → 0 · 双模式渲染探针（settled）：亮 1 / 暗 1 不达标（**优于前六域 4/24 基线**——页面层 ⌘K kbd 等项在本轮收敛；剩余 2 项仍为 /ai 页主体层已知项）· 14 门禁 13 pass / 0 fail / 0 skip / 1 合法 warn（GATE-09）· build ✅（vite 42.28s）· vitest 29/29。

> **2026-10-09 /ai 剩余散点组件扫尾批次登记（第八样板轮，/ai 域全量清零）**（提交 `b93d1ea`，主题令牌达标 + 视觉一致性）：承接前七域样板轮，按 `ai-full-scan.mjs` 全仓 /ai 目录全量扫描定位的剩余 **51 个散点文件 / 156 处漏配**做第八轮扫尾（用户「继续执行」确认：清掉剩余 /ai 散点，/ai 域彻底清零）。审计方法：`ai-full-scan.mjs` 全量扫描 + `sweep-fixes.mjs` 全局正则批量令牌化 + `ai-audit-settled.cjs` 双模式渲染探针 + 视觉一致性人工核查。
> 1. **P0 主题令牌化（51 文件 / 158 行修复，/ai 域漏配 156 → 0 全量清零）**：
>    - 图表与数据展示：`charts/ChartComponent`（3）、`AdvancedChartRenderer`（4）、`EnhancedDataTable`（6）、`StabilityDegradationChart`（6）、`StabilityTimeSeries`（1）、`FlavorWheel3D`（2）、structured/blocks `ChartBlock`（1）/`IngredientDetailBlock`（2）/`SynergyChartBlock`（1）
>    - 专业版 pro 组件：`pro/ChatHistory`（5）/`ChatSidebarV4`（5）/`ChatSidebar`（1）/`DetailsPanel`（1）/`FollowUpSuggestionsBar`（1）/`MessageBubble`（3）/`ThinkingProcess`（3）、`professional/PeptideAnalyzer`（8）/`CompatibilityAdvisor`（6）/`EfficacyExplainer`（4）/`ExportManager`（1）/`ProfessionalBaseComponent`（1）
>    - 功能面板：`ChatInputArea`（6）、`SessionSidebar`（6）、`ChatSharePanel`（3）、`CommandPalette`（3）、`DialogInput`（4）、`SearchPanel`（3）、`ApiKeyConfigCenter`（4）、`ApiKeyConfigPanel`（2）、`ApiKeyDiagnosticTool`（5）、`PluginSettings`（5）、`UserProfileSettingsPanel`（1）、`BatchEditDialog`（3）、`FilterBuilder`（3）、`PrecautionBadge`（2）、`PrecautionDetailPanel`（1）、`EfficacyTagChip`（6）、`FormulaCounterBadge`（1）、`FormulaCard`（2）、`FormulaShareModal`（2）、`LanguageSwitcher`（2）
>    - 学术报告与预测：`FormulaAcademicReport`（6）、`AcademicReportEnhanced`（4）、`StabilityPredictTab`（3）、`TastePredictTab`（3）、`ChatEnhancedDemo`（3）、`GenerateTab/components/ExportPanel`（2）、`GeneticAlgorithmPanel`（1）、`FormulaInputWindow`（1）、`PersonalizedRecommendations`（4）、`renderers/SimpleMarkdown`（2）
>    全部 → `text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]`（L0 双模式令牌）。批量脚本全局正则（g 标志）逐行替换 + 边框/背景类补 `dark:` 配对，跳过已有 `dark:` 行。
> 2. **结果：/ai 域（src/components/ai/ 全部 .tsx）主题令牌漏配彻底清零**（51 → 0 文件 / 156 → 0 处）。
> 3. **视觉一致性结论（本轮审计记录，未做结构重构）**：本批散点文件控件复用情况与前七轮一致（多数已导入 UI 库，原生控件为历史习惯）；本轮按口径仅令牌化，未改控件结构。
> **终态**：tsc 0 错（退出码 0）· `ai-full-scan` /ai 全量扫描 51 文件 / 156 处 → 0 文件 / 0 处（**/ai 域全量清零**）· 双模式渲染探针（settled）：亮 1 / 暗 1 不达标（与第七轮终态一致，优于早期 4/24 基线；剩余 2 项仍为 /ai 页主体层已知项）· 14 门禁 13 pass / 0 fail / 0 skip / 1 合法 warn（GATE-09）· build ✅（vite 11.29s）· vitest 29/29。

> **2026-10-09 /ai 页主体层收尾登记（第九样板轮，/ai 页对比度全量达标）**（提交 `6ca1ae2`，P0 对比度修复）：承接前八轮域样板轮（含第八轮 /ai 域全量清零 `b93d1ea`），对双模式渲染探针剩余的最后 2 处不达标（亮 1 / 暗 1）做主体层收尾，使 `/ai` 页对比度全量达标（用户「继续下一步建议任务」确认：主体层收尾轮）。审计方法：`ai-audit-settled.cjs` 双模式渲染探针定位 + 人工核查修复。
> 1. **P0 对比度修复（3 文件 / 3 处核心 + 同文件顺手补全的令牌配对）**：
>    - 主体层收尾：`AIAssistantPage` L485 ⌘K kbd（`text-neutral-400` → L0 双模式令牌 `text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]`，亮 neutral-700 6.47:1 / 暗 slate-400 7.87:1 均 ≥ 4.5）；`GlobalSearch` L169 ⌘K kbd（同模式）；`pro/MessageList` L252「开始新对话」空态标题（`text-neutral-800` 无 dark 配对 → 补 `dark:text-neutral-200`）
>    - 同文件顺手补全（与主体层组件同处渲染树）：`AIAssistantPage` 关闭 X 图标 dark 配对 / 分组标题 500→600 / tab 未选中·选中 dark 前景；`GlobalSearch` 搜索结果行·标签 dark secondary-400→600×3 / 空态 Search 图标 dark 配对；`pro/MessageList` 错误信息 dark error-400→600
>    全部不改交互行为，仅令牌配对 / 色阶加深。
> 2. **结果：/ai 页双模式渲染探针 亮 0 / 暗 0 不达标** —— 前八轮遗留的最后 2 项（⌘K kbd + 开始新对话标题）全部达标，`/ai` 页（含主体层 + 12 子功能域）对比度全量达标。
> **终态**：tsc 0 错（退出码 0）· 双模式渲染探针（settled）：**亮 0 / 暗 0 不达标**（此前亮 1 / 暗 1）· 14 门禁 13 pass / 0 fail / 0 skip / 1 合法 warn（GATE-09）· build ✅（vite 1m 12s）· vitest 29/29。

> **2026-10-09 /ai 主题规范化最终复核验收**（无新增代码改动，仅验收确认；用户「下一步」确认）：承接九轮样板轮（`4ff6b78` → `6ca1ae2`），对前端全仓做主题规范化最终复核。结论：
> 1. **全仓扫描（final-full-scan.mjs）**：/ai 域（`src/components/ai/` 全部 .tsx）漏配 **0 处 / 0 文件** —— 九轮样板轮全部生效，/ai 域主题令牌漏配彻底清零；非 /ai 域剩余 **1228 处 / 193 文件**（TOP：UserManagementPage 58 / DashboardOverview 48 / FormulaCompare 37 / FormulaDetailPage 34 等，完整报告见 `RMFOOD-主题规范化最终复核报告.md`），记为独立后续工作项（非本轮 /ai 规范化范围）。
> 2. **验证终态全绿**：双模式渲染探针（/ai 页）**亮 0 / 暗 0 不达标** · 14 门禁 13 pass / 0 fail / 0 skip（GATE-05 达标，GATE-09 合法 warn）· tsc 0 错 · vitest 29/29 · build ✓。
> **结论**：/ai 主题规范化九轮样板轮全部完成并验收通过。非 /ai 页面域剩余漏配建议单独立项按同模板推进（优先 TOP 20）。

> **2026-10-09 非 /ai 页面域 TOP 7 组件样板轮登记（第十轮·第一批）**（提交 `7535ec4`，主题令牌达标 + 视觉一致性）：承接 /ai 域九轮样板轮与最终复核验收，按同一模板对非 /ai 页面域最密集的 7 个组件做专业规范审计与修复（用户「继续下一步」确认：立项非 /ai 页面域，先清 TOP 7）。审计方法：`pages-audit-leaks.mjs` 字面灰阶无 `dark:` 配对漏配扫描 + `ai-audit-settled.cjs` 双模式渲染探针 + 视觉一致性人工核查。
> 1. **P0 主题令牌化（7 文件 / 258 处字面灰阶无 dark: 配对漏配 → 0）**：
>    - 用户管理：`UserManagementPage`（58 处：活跃率 / 近 14 天 / 日志列表 / 实体信息 / 筛选标签 / 统计概览 / 操作按钮 / 编辑资料 / 2FA / 安全等级 / 最近 7 天 / 角色变更 / 上传 CSV）
>    - 数据看板：`DashboardOverview`（48 处：活动记录 / 加载态 / 排行 / 指标标签 OB%/化合物/热度分/IC50/分子量/长度 / 趋势 / 质量评分 / 统计项）
>    - 配方对比与详情：`FormulaCompare`（37 处：空态 / 配方 A/B / 协同效应 / 稳定性 / 风味 / 兼容性 / 安全性 / vs 分隔 / 成分分布 / 独有 / 共同功效）、`FormulaDetailPage`（34 处：分隔符 / 没有修改 / 成分表头 / 性味归经 / 化学成分 / 药理作用 / 注意事项 / 空态 / 加载态 / 评论 / 版本 / 实验）
>    - 数据管理：`DataManagementTab`（28 处：上传 / 支持格式 / 备份选项 / 空态 / 时间戳 / 统计 / 表头 / 趋势 / 标签 / 百分比）
>    - 配方新建：`FormulaNewPage`（27 处：完整度 / 添加到配方 / 推荐 / 共 N 种成分 / 删除 / 目标功效 / 成分组成 / 表头 / 空态 / 药材分类 / 功效）
>    - 着陆页：`Hero`（26 处：知识图谱 / 数据源 / 日志 / 风险检测 / 配伍分析 / 研发需求 / 步骤 / 输入框 / 快捷键 kbd / 分隔符 / lp-label）
>    全部 → `text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]`（L0 双模式令牌）。批量脚本全局正则（g 标志）逐行替换 + 边框/背景类补 `dark:` 配对，跳过已有 `dark:` 行；UserManagementPage 因一行多处匹配 diff 较大（538 行），tsc 0 错已证明合法。
> 2. **视觉一致性结论（本轮审计记录，未做结构重构）**：非 /ai 页面域 TOP 7 组件多为自造原生控件（表格/表单/按钮）而非复用 UI 库，属历史代码习惯；本轮按口径仅做令牌化，未改控件结构（避免引入交互行为变化与回归风险）。UI 库收敛记入 §11.2 残余项，留待后续轮次。
> **终态**：tsc 0 错（退出码 0）· `pages-audit-leaks` 漏配扫描 258 → 0 · 双模式渲染探针（settled）：/ai 页 亮 0 / 暗 0 不达标（维持第九轮终态）· 14 门禁 13 pass / 0 fail / 0 skip / 1 合法 warn（GATE-09）· build ✅（vite 12.76s）· vitest 29/29。

> **2026-10-09 非 /ai 页面域 TOP 30 组件样板轮登记（第十轮·第二批）**（提交 `2077955`，主题令牌达标 + 视觉一致性）：承接非 /ai 页面域第一批（`7535ec4`，TOP 7 已清），按同一模板对剩余最密集的 30 个组件做第二批专业规范审计与修复（用户「继续处理」确认：推进 TOP 30 批次）。审计方法：`nonai-scan.mjs` 非 /ai 域全量漏配扫描 + `nonai-fixes.mjs` 全局正则批量令牌化 + `ai-audit-settled.cjs` 双模式渲染探针 + 视觉一致性人工核查。
> 1. **P0 主题令牌化（30 文件 / 431 处字面灰阶无 dark: 配对漏配 → 0）**：
>    - 数据库域：`CrossSearchPanel`（23）、`DetailPanel`（14）、`PerformancePanel`（12）、`ExternalDataPanel`（11）
>    - 配方域：`FormulaListPage`（22）、`FormulaEditPage`（20）、`FormulaTestPage`（15）、`OperationLogPanel`（14）、`FormulaQuickView`（9）
>    - 组织域：`OrganizationList`（23）、`PermissionManager`（16）、`CreateOrgWizard`（13）、`OrganizationsPage`（11）、`TeamManagement`（11）
>    - 批次/实验域：`TracePage`（19）、`BatchListPage`（14）、`ExperimentSharePage`（18）、`ExperimentDetailPage`（12）、`ExperimentEditPage`（9）、`FormulaValidationPanel`（9）
>    - 搜索/设置/术语/主题/通知/导入/学术：`GlobalSearch`（17）、`SearchBar`（14）、`SearchResults`（10）、`SettingsPage`（18）、`TerminologyPage`（17）、`ThemePanel`（16）、`NotificationCenter`（12）、`ImportPanel`（12）、`AIAnalysisPanel`（11）、`ReviewProgress`（9）
>    全部 → `text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]`（L0 双模式令牌）。批量脚本全局正则（g 标志）逐行替换 + 边框/背景类补 `dark:` 配对，跳过已有 `dark:` 行；修正了脚本第一版写入路径 bug（改用显式 frontend/ 绝对路径）。
> 2. **视觉一致性结论（本轮审计记录，未做结构重构）**：非 /ai 页面域 TOP 30 组件与第一批一致——多为自造原生控件（表格/表单/按钮）而非复用 UI 库，属历史代码习惯；本轮按口径仅做令牌化，未改控件结构（避免引入交互行为变化与回归风险）。UI 库收敛记入 §11.2 残余项。
> **终态**：tsc 0 错（退出码 0）· `nonai-scan` 非 /ai 域 TOP 30 漏配扫描 431 → 0（原 30 文件复扫全 0）· 双模式渲染探针（settled）：/ai 页 亮 0 / 暗 0 不达标（维持第九轮终态）· 14 门禁 13 pass / 0 fail / 0 skip（首次并行跑时 GATE-12 一度报失败，系门禁读 dist/assets 时与 build 并行写入竞争的时序问题；单独干净重跑 13/0/0 通过，GATE-12 达标）/ 1 合法 warn（GATE-09）· build ✅（vite 6.07s）· vitest 29/29。

> **2026-10-09 非 /ai 页面域 TOP 30 组件样板轮登记（第十轮·第二批）**（提交 `12471d5`，主题令牌达标 + 视觉一致性）：承接非 /ai 页面域第一批（`7535ec4`，TOP 7）与第二批首段（`2077955`，TOP 30 段一），按同一模板对剩余最密集的 30 个组件做第二批（段二）专业规范审计与修复（用户「继续下一步」确认：推进 TOP 30 批次）。审计方法：`all-nonai-scan.mjs` 非 /ai 域全量漏配扫描 + `nonai-top30-batch2.mjs` 全局正则批量令牌化 + `ai-audit-settled.cjs` 双模式渲染探针 + 视觉一致性人工核查。
> 1. **P0 主题令牌化（30 文件 / 215 行修复，非 /ai 域 TOP 30 漏配 215 → 0）**：
>    - 学术域：`AcademicElementEditor`（8）、`CitationPanel`（7）、`ReferenceLibrary`（7）、`CollaborationPanel`（5）
>    - 数据库/图谱域：`CentralityPanel`（8）、`ContextMenu`（6）
>    - 实验域：`ExperimentCompareModal`（8）、`ExperimentListPage`（7）、`ExperimentCalendarPage`（6）
>    - 推理域：`InferenceChainVisualizer`（8）、`InferenceChainVisualizerV2`（8）、`InferenceStepCard`（6）
>    - 同步/冲突域：`ConflictResolver`（8）
>    - 配方域：`VersionDiffViewer`（9）、`FormulaComparePage`（8）、`FormulaTemplatesPage`（8）、`AIInsights`（7）、`FormulaCostAnalysis`（7）、`FormulaRating`（7）、`ExportModal`（6）、`FormulaDetailSubComponents`（6）
>    - 组织域：`DataExportDialog`（8）、`MembersTab`（8）、`PlanUpgradeDialog`（6）
>    - 公共/法规/设置域：`ApiDocsPage`（8）、`RegulationsPage`（8）、`CareersPage`（7）、`AboutPage`（6）、`ComplianceTab`（7）
>    - 着陆页：`Algorithms`（7）
>    全部 → `text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]`（L0 双模式令牌）。批量脚本全局正则（g 标志）逐行替换 + 边框/背景类补 `dark:` 配对，跳过已有 `dark:` 行。
> 2. **结果：非 /ai 域全量扫描 156 文件 / 541 处 → 126 文件 / 326 处**（本批清掉 30 文件 / 215 行）；/ai 域（`components/ai/`）维持 0（前九轮全部生效）。
> 3. **视觉一致性结论（本轮审计记录，未做结构重构）**：非 /ai 页面域 TOP 30 组件与第一批一致——多为自造原生控件（表格/表单/按钮）而非复用 UI 库，属历史代码习惯；本轮按口径仅做令牌化，未改控件结构（避免引入交互行为变化与回归风险）。UI 库收敛记入 §11.2 残余项。
> **终态**：tsc 0 错（退出码 0）· `all-nonai-scan` 非 /ai 域扫描 215 → 0（本批 30 文件复扫全清）· 双模式渲染探针（settled）：/ai 页 亮 0 / 暗 0 不达标（维持第九轮终态）· 14 门禁 13 pass / 0 fail / 0 skip / 1 合法 warn（GATE-09）· build ✅（vite 1m 54s）· vitest 29/29。

> **2026-10-09 全仓非 /ai 域扫尾批次登记（第十轮·扫尾，全仓清零）**（提交 `5477767`，纯令牌化 47 文件）：承接非 /ai 域第一、二批（`7535ec4` / `2077955` / `12471d5`），用 `final-sweep.mjs` 对全仓非 /ai 域（src 全量 .tsx，排除 components/ai/）一次性扫尾，共 126 文件 / 326 行令牌化（用户「继续执行，直到任务全部完成」确认：全仓非 /ai 一次扫尾清零）。
> 1. **P0 主题令牌化（126 文件 / 326 行）**：`final-sweep.mjs` 遍历 src 全部 .tsx（排除 components/ai/，该域已清零），仍有字面灰阶漏配的全量处理。全部 → `text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]`（L0 双模式令牌）+ 边框/背景类补 `dark:` 配对。
> 2. **提交纪律（按「纯令牌化 vs 混合 WIP」区分，经 git diff 逐文件判定删除行是否全为字面灰阶类）**：
>    - **47 文件 diff 全部为本轮 L0 令牌化改动**（删除行均为字面灰阶、新增行均为 L0 令牌/dark 配对）→ 安全整文件提交（`5477767`）。
>    - **87 文件同时混有其它会话 WIP 功能改动**（删除行含非灰阶功能行）→ 本轮**不提交**（避免卷入他人工作）；其令牌化改动保留在工作树，待 WIP 清理后随原会话一并处理。完整 87 文件清单：academic（DocumentPreview/DocumentImport/SaveStatusIndicator/ReferenceSearch）、analytics（MultiDimensionalAnalyzer/PerformanceMonitor/AdvancedChartEngine）、auth（PermissionMatrix）、dashboard（ApiIntegrationManager/ChangeHistory/ExportManager/RealTimeSync/TeamDashboardShare/TeamOnlineStatus/TemplateManager）、database/graph（AIInsightsPanel/AIPanel/AnnotationPanel/BookmarkPanel/CentralityMetricsPanel/ComparisonPanel/ExportMenu/FilterEmptyState/GraphPanelLayout/HistoryPanel/ImportDialog/LayoutIndicator/NodeAIAnalysis/PinnedNodesPanel/SPathToolbar/SelectionBar/SharePanel/SubGraphBrowser）、formula（CategoryTree/EffectCurveChart/ParetoFrontierChart/SynergyFormulaDesigner/SynergyHeatmap/SynergyVisualizations/TagMultiSelect/TemplateEditor/MobileComponents）、molecule（MoleculeViewer3D）、ui（CommandPalette/Common/NotificationBell/OperationFeedback）、workflow（WorkflowVisualEditor）、pages（academic/AcademicReportPage、admin/AuditLogPage、ai/AIAssistantPage、auth/ForgotPasswordPage、batch/BatchDetailPage、compliance/ComplianceCheckPage、dashboard/DashboardPage、database/DatabasePage + tabs（DiseasesTab/GraphTab/HomologyTab/IngredientsTab/TargetsTab）、documents/DocumentExtractPage、experiment（DoePage/ExperimentNewPage）、formula（FormulaCaseDetailPage/FormulaCasesPage/components（ActivityTimeline/DashboardLayout/FormulaCard/ImportModal/NotificationCenter/VersionTimeline））、ingredient/IngredientAnalysisPage、integrations/IntegrationsPage、labels/LabelGeneratorPage、notification/NotificationPage、organizations（BulkOperationsPanel/CloneOrgDialog/OrganizationAnalytics/OrganizationDetail/PermissionMatrix/detail（ResourcesTab/SettingsTab））、public（PrivacyPage/TermsPage）、workflow（WorkflowCreateModal/WorkflowPage）—— 该清单已核验（sweep-pure-verify.mjs）。
> 3. **结果：全仓非 /ai 域工作树漏配复扫 0 文件 / 0 处**（含 87 混合文件的令牌行；`/ai` 域维持 0，全仓字面灰阶漏配在工作树层彻底清零）。
> 4. **视觉一致性结论**：本批与前十批一致——按口径仅令牌化，未改控件结构。
> **终态**：tsc 0 错（退出码 0）· `all-nonai-scan` 非 /ai 域扫描 0 文件 / 0 处（工作树清零）· 双模式渲染探针（settled）：/ai 页 亮 0 / 暗 0 不达标 · 14 门禁 13 pass / 0 fail / 0 skip / 1 合法 warn（GATE-09）· build ✅（vite 37.47s）· vitest 29/29。**87 混合文件待 WIP 清理后随原会话提交（其令牌化改动已在工作树，不会丢失）**。

> **2026-10-09 全仓最终复核验收 v4（提交层 + 工作树层双验收）**（无新增代码改动，仅验收确认；用户「执行下一步任务」确认）：承接全仓非 /ai 域扫尾批次（`5477767`），做最终复核。双层结论：
> 1. **工作树层**：全仓 `src`（`/ai` + 非 /ai 全部 .tsx）字面灰阶无 dark: 配对漏配 **0 文件 / 0 行**（`final-repo-state.mjs` 终态扫描）；`/ai` 域双模式渲染探针亮 0 / 暗 0。
> 2. **提交层**：47 纯令牌化非 /ai 文件已入库（`5477767`）；`/ai` 域九轮提交（`4ff6b78`→`6ca1ae2`）+ 非 /ai 第一、二批（`7535ec4`/`2077955`/`12471d5`）全部入库。**87 混合 WIP 文件的令牌化改动未入库**（留工作树）——全工作树非 /ai 共 151 文件含 WIP 功能删除（864 行非令牌删除，代表：LoginPage 92/92、HerbsTab 38/41、GraphTab 34/37、DoePage 31/58、ComplianceCheckPage 19/32、StabilityPage 16/28、DatabasePage 15/23、ChangeHistory 15/16），整文件提交会卷入他人工作，须待 WIP 收敛后随原会话处理；本轮不强行逐行 `git add -p` 分离（864 行 WIP 与令牌行交织于 151 文件，风险高且属越权处理他人工作）。
> 3. **整体完成度**：`/ai` 域 100%（工作树 + 提交层双清零）；非 /ai 域工作树 100% 清零、提交层 47 纯文件入库 + 87 混合待 WIP；**全仓字面灰阶漏配（工作树层）彻底归零 ✅**。
> 完整报告见 `RMFOOD-主题规范化最终复核报告-v4.md`。

> **2026-10-09 收尾确认（用户「选 3」确认：就此收尾，剩余交 WIP 会话处理）**：
> 1. **工作树层最终复核**：WIP 会话新引入的 3 处字面灰阶（`CareersPage` L89/L91 `text-neutral-300`「·」分隔符、`ThemeImport` L105 `border-neutral-300` 虚线上传框）已补 `dark:` 配对（`dark:text-neutral-500` / `dark:border-neutral-600`），修复保留在工作树；全仓 `final-repo-state.mjs` 扫描仅剩 1 处「漏配」——`FormulaCasesPage` L64，经人工核实为**双模式数据配置**（`text:'text-neutral-700'` + `darkText:'text-neutral-300'` 成对字段，下游以 `text-neutral-700 dark:text-neutral-300` 消费），非真实漏配。→ **全仓（/ai + 非 /ai）字面灰阶漏配真正归零**。
> 2. **GATE-14 现状（7 处 D-50 条件类，warn 非 fail）**：`GeneticAlgorithmPanel:609`、`MultiObjectivePanel:1096`、`ReportDialog:51`、`SharePanel:44`、`ReportExportPanel:103`、`AgentPage:252/353`——经查 HEAD 提交中无这些行，系**其它会话 WIP 新增的 `bg-accent-500/600 + text-white` 按钮**引入（暗色反转实底 1.52:1），非本主题批次产生；7 文件均含 WIP 删除行，不强行提交，属 WIP 会话应补的 `dark:` 配对。
> 3. **最终门禁/验证终态（干净重跑）**：14 门禁 **12 pass / 0 fail / 0 skip**，2 合法 warn（GATE-09 + GATE-14）；GATE-04/05（渲染断言反转色阶 + text-white 元素）达标；tsc 0 错 · build ✓ · vitest 29/29；双模式渲染探针（/ai 页）**亮 0 / 暗 0 不达标**（此前瞬态 11 处为探针扫到另一会话 Rhine landing 页 WIP，重跑归零）。
> 4. **收尾结论（选 3）**：工作树层全仓归零已达成；提交层 47 纯令牌化文件已入库（`5477767`）；**87 混合 WIP 文件 + GATE-14 7 处 D-50 + CareersPage/ThemeImport 2 文件**的令牌化改动均保留在工作树（不会丢失），交 WIP 会话收敛后随其提交回填，本主题规范化到此收尾。回填清单完整保留在 §11.2 各批次登记与 `RMFOOD-主题规范化最终复核报告-v4.md`。

> **2026-10-12 主题设置模块系统性控制落地登记**（阶段 A→D，提交 `2e9eaa2`/`43d2f2e`/`83f55cc`/`e432950`/`224a616`/`7100b58`/`7251601`；方案见 `RMFOOD-主题设置模块系统性控制执行方案.md`，核查见 `RMFOOD-主题设置模块功能核查报告.md`）：
> 1. **设置面板产品化**：`ThemePanel.tsx`（501 行 / 9 区块）由 `SettingsPage` 挂载为唯一产品入口（`:1460-1461`，`theme` 标签页 `:1691`）；`ThemeSwitcher.tsx` 重写为纯明暗切换器（175 行），仅保留 mode 切换 + `/settings?tab=theme` 深链。持久化 `version: 5`，`partialize` 纳入 `runtimeOverrides`/`paletteKey`/`fontScale`。
> 2. **R1 根因修复（刷新丢配置）**：旧 `applyCustomTheme` 写 `activeThemeId='custom-${Date.now()}'` → 被持久化 → `initialize()` 查 `presetThemes[state.activeThemeId]` 得 `undefined` → 告警「无效的主题ID」并重置为 `light-default`，配色/字号/明暗三项全丢。改为**累加式** `runtimeOverrides` + 稳定 id `custom-runtime`，四条路径（`setThemeMode`/`setPresetTheme`/`setAccessibilityMode`/冷启动）统一经 `composeTheme` 重放。→ **GATE-15 实测三项全部保持**。
> 3. **C1 档位色阶整档双作用域**：`PRIMARY_TIERS` 扩至 11 档（50..950；`--color-primary-50` 有 150+ 消费者，漏掉会出现可见绿缝）。`RAMP_WEIGHTS_DARK` 取**负权**而非反转（反转会破坏 500 锚点）。绿色板逐档等于 L0（1277 处品牌绿消费者）。新增 `TIER_KEY = /^\d{2,3}$/` 只识别档位键。
> 4. **C1.5 primary 语义族纳入双作用域（本阶段核心发现）**：`container-pair-probe` 实测——选苹果蓝后 `--color-primary` 变 `#0A84FF` 而 `--color-primary-container` 仍是品牌绿 `#d1fae5`，`--color-primary` 锚点亦因 inline 单作用域在暗色沿用亮值；语义令牌**不随配色迁移**，全站 89 处 `bg-primary-container` 绿/蓝混排。新增 `derivePrimaryFamily()` 从各模式完整色阶推导 8 枚语义令牌（规则与 base.css:26-39 / dark.css:22-37 逐条对齐 → 默认绿推导值与 L0 **逐值相等**，零漂移），由 `generateModeRampCSS()` 与档位色阶一并写入 `:root`/`.dark` 双块；`generateCSSVariables()` 在存在 `modeRamps` 时对语义族让位（无障碍变体等无 `modeRamps` 的主题行为不变）。**→ 新增 U-8。**
> 5. **GATE-16/17/18 落地**（`g1518.mjs` 独立可运行）：16 L0 整档单调；17 档位 `setProperty` 白名单（仅 `stores/theme.presets.ts`）；18 `aria-checked` 必须由状态表达式求值。**两处误报已修**：17 只匹配 `/^--color-[a-z0-9]+(?:-[a-z0-9]+)*-\d{2,3}$/`（避免误伤模式无关的 `--theme-transition-*`）；18 增加 `stripComments()`（等长空白替换以保留行号，`//` 前为冒号时视为 URL 不剥离）。
> 6. **GATE-13 消费方修正**：`--color-primary-surface-deep` 有 5 个消费者但 L0 无定义（TerminologyPage/RegulationsPage/FormulaCasesPage/DetailPanel/EditIndicator 的 `bg-gradient-to-r`）→ 改用已登记 `--color-primary-surface-hover`（亮/暗两模式白字对比均达标；`-hover` 在暗色为更浅档，不适合作深字底色，故不沿用 `-surface` 之外的其它语义令牌）。
> 7. **探针底色合成修正（D5 / D6，方法论级）**：`settings-theme-probe2` 与 `ai-audit-settled` 的 `effBg` 改为**自身 + 全部祖先逐层 alpha 合成、最终与白底合成**——旧实现只取「第一个不透明祖先」，把真实的 ~9.6:1 误判成 2.03:1（GATE-06 由假 fail 转 pass：draft 5.26 / approved 4.85 / pending 6.42 / rejected 4.65 / revision 6.61 / archived 5.77 全部 ≥ 4.5）。新增 `container-pair-probe` 再补一层：Tailwind v4 的 `bg-white/90` 编译成 **`color-mix()`**，仅 `rgba()` 正则会把半透明底色 alpha 静默丢弃当不透明参与计算——**暗色下把真实的 4.78~8.32 误读成 1.0**。据此**修正既有结论**：`text-primary-main` 压 `bg-primary-container` 的缺口**仅存在于亮色**（green 2.24 / orange 1.99 / red 3.01 / blue 3.44 / purple 3.55），**暗色五色板全部达标**（4.78~8.32）。→ **新增 F2 开放项**（登记于下方「残余风险」，89 处消费面，本轮不批量改动）。
> 8. **附带修复**：① `AIAssistantPage` 统计失败横幅 `dark:text-warning-300` → `dark:text-warning-600`（暗色 `warning-300` 是反转后的偏暗 `#b45309`，压近黑底仅 4.02:1）；② `ThemePanel` 选中态 ✓ 改 `text-primary-700`（原 `text-primary-main` 亮色 3.54:1；且写 `text-[color:var(--color-primary-surface)]` 会**绕过** `semantic-utils.css:197-212` 的暗色下限安全网 `.dark .text-*:not([class*="dark:text-"])`——该安全网是暗色下裸 `text-neutral-900` 类标签不失效的关键机制，arbitrary value 写法不进网）；③ `ThemePanel` 7 处 `focus-visible:ring-primary-main/50` → `ring-primary-500/50`（`--color-primary-main` 未登记，该类不会生成）；④ 预览卡改用 `.surface-primary`（实测全配色 4.85~14.41:1），移除无意义 `isDark` 三元。
> **终态**：tsc 0 错 · 主题三套件 **79/79**（`theme-palette` 16 + `theme.presets` 30 + `themeStore` 33）· **theme-gate 16 pass / 0 fail / 0 skip**（告警仅 GATE-09 自引用令牌 + GATE-14 8 处 D-50 存量，均已知接受项）· `/ai` 渲染探针 **亮 0 / 暗 0** · `/settings?tab=theme` 面板 64 个叶节点 **0 处不达标**（亮 + 暗 + 5 配色，`panel-darkscan.cjs`）· pre-commit UI/a11y 护栏 0 违规。
> **工具落库**：`scripts/theme-audit/` 新增 `g1518.mjs`（GATE-15/16/17/18，独立可运行）、`container-pair-probe.cjs`（配色语义族对比度矩阵）、`panel-darkscan.cjs`（面板双模式 × 5 配色叶节点扫描）。

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
| **D-51** | ✅ 已修复 | 删除 `@theme` 中 10 行悬空自引用；GATE-09 由 `fail` → `warn`（无循环引用） |
| **D-52** | ✅ 已修复 | **6 枚**徽章文字色按 AA 重算（实测值，唯一权威）：draft/approved/pending/**rejected**/revision/archived = **5.26 / 4.85 / 6.42 / 4.65 / 6.61 / 5.77 : 1**。修复前：draft 4.48、approved 3.95、pending 2.89、revision 3.86、archived 4.20（`rejected` 已达标，未改动） |
| **D-12b** | ✅ 已修复 | 补暗色 `--color-primary-text: #6ee7b7`（约 13.3:1） |
| **D-41** | ✅ 已修复 | **采用方案乙**：移除 `@radix-ui/themes` 依赖与 `RadixThemeProvider`；`RadixComponents` 改项目原生实现并补齐 `role="status"`。实测 `/radix-demo` **0 个 Radix 残留节点**、13 个 Badge 具备 role=status、0 页面错误。新增门禁 **GATE-10** 固化 R-9 |
| **D-10** | ✅ 已修复（随 D-41 消除） | 蓝色 `--accent-6: #0066cc` 的内联 `<style>` 覆盖随 Provider 一并移除（同时消除规范 C-11 违规） |
| **D-54** | ✅ 已修复（v1.1.4） | 新增 `--color-primary-surface-hover`（亮 `#065f46` / 暗 `#047857`），`.surface-primary:hover` 改用它并删除 `.dark` 覆盖。实测：亮 基础 **5.48** / hover **7.68**；暗 基础 **7.68** / hover **5.48**（旧暗色 hover **1.13**）→ **GATE-11** |
| **D-55** | ✅ 已修复（v1.1.4） | `@theme` 补 `--color-secondary-50..950` 全族桥接。实测 `.bg-secondary-500` **0 → 5**、`.bg-secondary-600` **0 → 1**、`.text-secondary-500` **0 → 1**、`.hover\:bg-secondary-700` **0 → 1** → **GATE-12** |
| **D-56** | ✅ 已修复（v1.1.4） | `info` 族补为 10 阶（按档位别名到同源的 `secondary`，因后者在 `.dark` 中重定义，别名自动随模式解析）+ `error-950` 别名到 `danger-950`；`@theme` 同步桥接。**GATE-12 缺失类由 93（含误报）→ 14 → 1 → 0** |
| **D-53** | ✅ 已修复（D-53 kebab 化提交） | `generateCSSVariables()` 输出的 10 个 camelCase 令牌名已 kebab 化（`toKebab` 辅助 + 颜色/缓动/z-index 三处生成点）；`--z-modal-backdrop` 首次能匹配 L0 既有定义。16 项静态断言 + 运行时验证通过，全量门禁 11/0/0 |
| **D-57** | ✅ 已修复（M2） | 无障碍 DOM 属性原仅在 `initialize()` 与 `setAccessibilityMode()` 两处同步，另 5 条应用路径不同步。改为在 `applyThemeWithTransition()`（**全部 7 条路径的唯一汇聚点**）统一同步。实测：`resetToDefault()` 后 `data-a11y-mode=normal`、`data-reading-mode=null`（原残留 `reading`+`sepia`）；阅读模式 + 切暗色 → `dark-read`（原仍 `sepia`）。新增 `verify-d57.mjs` |
| *(附带)* D-7 的测试失效 | ✅ 附带修复 | 删除从未通过的死测试 `radix-components-a11y.test.tsx`（引用了从未导出的 `RadixButton`/`RadixCard`），替换为 `badge-text-a11y.test.tsx`（仅测真实导出）。**注：此行非独立缺陷 ID，仅为 D-7 的关联修复记录。** |
| **D-5** | ⊘ 已推翻 | 实测无内联累加；仅记录为不良实践（已随 D-33 一并改写） |

**M2（一致性）—— 已完成 8/8 ✅（T-B2b 收口）**

| 任务 | 状态 | 覆盖缺陷 | 验证证据 |
|:-----|:-----|:---------|:---------|
| **T-B1** 品牌色双源收敛 | ✅ | **D-2 / D-3** | 新增 `preset-align.mjs`（逐令牌对比「内联注入值」与「移除注入后的 L0 计算值」，含颜色/长度归一化）。同义不同值 **32 → 0**；`--color-primary` === `--color-primary-main`（亮 `#10b981` / 暗 `#34d399`）。顺带修 T11 违规：`--font-sans`/`--font-mono`/`--ease-spring`/`--ease-elegant` 在 base 与 dark 中取值本不一致 |
| **T-D5** 缓动/字重命名 | ✅ | **D-23** | 实测 `var(--ease-*)` **51 处消费者** vs `var(--easing-*)` / `var(--weight-*)` **各 0 处**；`Easing` 接口键名改为 `{standard,spring,elegant}` 与 L0 对齐，移除死导出 `--weight-*` |
| **T-S1** 状态一致性 | ✅ 6/6 | **D-34/35/36/37/38/40** | D-34：`setPresetTheme` 删除按 ID 强写 `mode`（原会使用户**首次系统切换后永久退出 system 模式**，由 R-27 实测）；D-37：`initialize()` 算出 `effectiveMode` 却**只用于打日志** → 冷启动不跟随 OS，已修正；D-35：`?theme=` 拆分为 `?preset=` / `?theme=`（保留旧链接兼容）；D-36：扁平导入结构规范化 + `pickContrastText()`；D-38 已随 D-41 达成；D-40：遗留 `useTheme` 改名 `useLegacyTheme`，`useTheme` 全项目唯一实现 |
| **T-B2a** 生成器改用 L0 名 | ✅ | **D-2/D-3 终局** | **解锁自定义主题**：此前 `colors.primary.main` 只写入 `--color-primary-main`，而 CSS 消费者读 `--color-primary` → **自定义主题 / 无障碍变体 / 文件导入对品牌色完全无效**。实测设为 `#ff0000` 后 `--color-primary` 正确变化（复位回 `#10b981`）。安全性来自 T-B1 的先行 —— 对齐后改名对内置预设是零视觉变化 |
| **T-E1** 图表取色单通道 | ✅ | **D-4 / D-43 / D-45** | 迁入 `chartTheme.ts` 并为每个 `var()` 补 fallback（原引用 `-light` 四族、`--color-chart-1..5`、`pink/cyan/sky-500` 等**并不存在**的令牌）；修复两处 `useMemo(…, [])` 空依赖（切主题后图表颜色永不更新）；删除 3 个零消费者模块 |
| **T-F1a** 对话区暗色驱动 | ✅ | **D-13 / D-26** | 全 src 的 `@media (prefers-color-scheme: dark)` 块 **22 → 0**。修法为**转换而非删除**：该文件另有 **14 条 `.dark.X` 自作用域死规则**（`.dark` 在 `<html>`、目标类在内层元素 → 永不匹配），真正生效的反而是配对的 `@media` 版 → 改写为后代选择器 `.dark X`，使规则复活且由应用设置驱动。双场景判别验证（OS=dark+应用 light → 浅色；OS=light+应用 dark → 暗色） |
| **T-W2** 无障碍覆盖缺口 | ✅ | **D-32** | ① 阅读模式补 `--bg-canvas`（`typography.css:19` 亮色 body 实际读取，**48 处**消费者），原只覆盖 `--bg-primary` → sepia 下文字变棕而底色仍是 slate；② 高对比度 `--border-default` → `--border-color`（**147 处 vs 2 处**），并补 `--bg-canvas`；③ `color-blind` 在 CSS 层**零规则** → 按 **A-15** 用 Okabe-Ito 色盲安全色板落地；同时修正 JS 侧原给 success/error 选的 Apple 绿/红（**正是红绿色盲最难区分的一对**） |
| **T-B2b** 去冗余注入 + 四角色映射 | ✅ | **D-2/D-3 终局 / D-53 配对** | 两步提交：**Step 1** 四语义角色（success/error/warning/info）的 main/background/text → L0 名映射（12 条，`verify-b2b.mjs` 37 项断言全过）；**Step 2** 新增 `isCleanBuiltinPreset()` —— 内置纯净预设（light/dark-default 且 colors 未被无障碍变体修改）时 `applyThemeToDOM` 跳过内联注入（`<html>` 内联自定义属性 **86 → 0**），无障碍变体 / 自定义 / 导入仍注入（color-blind 态 `--color-success=#009E73` 生效）。残余：变体态全量注入 86 个（部分对 L0 冗余），精确差异注入记 M3/M4 优化项 |

**⏳ 待办（M2 后重算）**：
`D-12、D-18、D-19、D-24、D-25、D-27、D-28、D-29、D-30、D-31、D-42、D-44、D-46、D-47、D-48`（M3 死代码/架构收口）
→ 排期见《修复执行方案》§0.0 与 §6.4。**M2 已关闭**：D-2、D-3、D-4、D-13、D-23、D-26、D-32、D-34~D-38、D-40、D-43、D-45。**D-53 已随 T-B2b 修复**（kebab 化令牌名，解锁 10 维度自定义）。

**残余风险**：条件类字符串 `bg-primary-{400..950} + text-white` 曾在 165 处（`g1314.mjs` 原估 82，随源码增长实测 165）。**2026-10-06 经 `g14-clean.mjs` 批量清零我名下全部 136 行（79 文件）+ 手动修复 5 处渐变 D-50 + SynergyTab 动态档位 bug**，我名下 0 处；**2026-10-07 最后一处 WIP 残余（SettingsPage:1472）随 `74a9252` 接线删除旧面板而清零，GATE-14 转 pass，全库 0 处**。

**M2 期间新增缺陷**（均由本轮对抗性复核发现）：**D-54**（P0，`.surface-primary:hover` 暗色 **1.13:1**，D-50 修复自身引入的回归）、**D-55**（P0，`@theme` 未桥接 `secondary` 整族 → 104 处 `bg-secondary-*` **0 生成**）、**D-56**（P1，`info` 族非色阶 + `error` 缺 950）、**D-57**（P1，无障碍同步路径缺失）。连同 **D-53** 一并登记。

**2026-10-06 新增（GATE-13 检出，M4 治理）**：4 个**未登记的自有 `--color-*` 消费**（L0 无定义 → 解析为空，消费者失去颜色）：
`--color-text-secondary`（`FormulaSharePanel.tsx`/`typography.ts`）、`--color-text-muted`（`ScoreRadarChart.tsx`）、`--color-brand-400`（`FocusRing.tsx`，§8.1 登记的焦点环违规死代码）、`--color-danger`（`IngredientAnalysisPage.tsx`/`StabilityPage.tsx`，误用名，功能色族权威名为 `--color-error`）。**已修消费者**（`g13-fix.mjs`，对齐 L0 权威名 `--text-secondary`/`--text-muted`/`--color-primary`/`--color-error`，**不补 L0 新定义**避免第二真相源），`GATE-13` 转 pass。

**2026-10-12 新增 F2（`container-pair-probe.cjs` 实测，P1，开放）**：`bg-primary-container` + `text-primary-main` 是全站 **89 处**使用的 L2 语义配对（`semantic-utils.css:16,18`），在**亮色模式下系统性低于 AA 4.5:1**——green **2.24** / orange **1.99** / red **3.01** / blue **3.44** / purple **3.55**；**暗色五色板全部达标（4.78~8.32）**。根因是设计层面的：`-container` 取同色族的极浅档（亮 `ramp[100]`）而 `-main` 取中段（`ramp[500]`），二者同族导致亮色下明度差不足。**不批量改动 89 处消费面**（回归面过大，且当前所有渲染门禁与渲染探针均为 0）；替代路径：① 需要承载文字的场景改用 `.surface-primary` + `--color-on-primary-surface`（实测全配色 **4.85~14.41:1**，唯一双模式达标）；② 次选 `text-primary-700`（亮 green **4.84** / blue **6.73** / purple **6.87** / red **6.11** ✅，唯 orange **4.39** 差 0.11 未达）；③ 若要系统性闭合，须在 L0 层重算 `-container` 的亮色取值（提深至 200 档）或引入独立的 `-on-container` 前景令牌，属 L0 令牌变更，需走 §9.1 RFC 并评估 89 处消费面。

---

## 12. 修复路线图

> **阶段与里程碑对应**：阶段 0 ≡ **M1**（止血，已完成）；阶段 1 ≡ **M2**（一致性）；阶段 2 ≡ **M3**（架构收口）；阶段 3 ≡ **M4**（治理落地）。
> 任务级拆解（T-* 编号、依赖顺序、人日估算）见《RMFOOD-主题系统修复执行方案》；缺陷当前状态见 §11.2。

### 阶段 0 — 止血（P0）—— **✅ M1 已完成**

| 序 | 动作 | 缺陷 | 状态与验收 |
|:--|:-----|:-----|:-----------|
| 1 | `index.css` 加 `@custom-variant dark (&:where(.dark, .dark *));` | D-1 | ✅ **完成**，`GATE-01`/`GATE-03` 通过（1 467 → 0） |
| 2 | 页头横幅与头像改用 C-24 方案 A/B | **D-50** | ✅ **完成**，新增 `--color-primary-surface` 令牌对 + `.surface-primary`，23 文件 + Logo；亮/暗均 ≥ 4.85:1 |
| 3 | `dark.css` 孤儿 `:root{}` 移入 `.dark{}` | D-21 | ✅ **完成**，`GATE-02` 通过；徽章对比度 ≥ 4.65:1 |
| 4 | 把 `cssText` 拼接改为 `setProperty` + 白名单 | D-33 | ✅ **完成**，59/59 安全断言、10/10 注入形态阻断 |
| ~~5~~ | ~~重写 `generateCSSVariables` 输出 §3.1 命名，值取自 L0~~ | D-2 / D-3 | ⏳ **移交阶段 1**（与 D-24 绑定，须先做 T-B1 再做 T-B2，见《修复执行方案》） |
| 6 | 修 `index.html` 键名与结构 | D-11 | ✅ **完成**，`.dark` 生效 1 516 ms → 153 ms |
| 7 | 冷启动 `transitionType` 改 `'none'` | D-49 | ✅ **完成**，首个暗色背景先于 FCP |
| 8 | 补 `@radix-ui/themes/styles.css` 或删除该依赖 | D-41 / D-10 | ✅ **完成**（采用删除），`GATE-10` 通过 |
| 9 | 定义 `--bg-surface-container-high` 或改回 `--bg-surface-container` | D-22 | ✅ **完成**，`--bg-surface-variant` 有值 |
| 10 | 暗色 `--background` 改指 `--bg-canvas` | D-9 | ✅ **完成**，暗色 `--background` = `#020617` |

### 阶段 1 — 一致性（P1，2–4 周）

### 阶段 1 — 一致性（P1）—— **✅ M2 已完成 8/8（T-B2b 收口，v1.1.8）**

| 序 | 动作 | 缺陷 | 状态 |
|:--|:-----|:-----|:-----|
| 11 | `initialize()` 同步写入无障碍 DOM 属性 | D-39 | ✅ 提前于 M1 完成 |
| 12 | `setPresetTheme` 不再强写 `mode` | D-34 | ✅ **完成** — 原会使用户首次系统切换后永久退出 system 模式 |
| 13 | 统一 `?theme=` 协议（拆分 preset / payload） | D-35 | ✅ **完成** — `?preset=` / `?theme=`，保留旧链接兼容 |
| 14 | 导入路径加令牌白名单 + 值格式校验；修**正则**并实际调用 | D-36 | ✅ **完成** — 扁平结构规范化 + `pickContrastText()` |
| 15 | 收敛图表取色为 `chartTheme.ts` 单一通道；补 `-light`/`chart-*` 或改引用 | D-4 / D-43 / D-45 | ✅ **完成** — 3 个废弃模块已删除，两处空依赖 `useMemo` 已修 |
| 16 | 修 `-easing-*`→`-ease-*` 命名（`--color-primary-text` 暗色值已随 M1 完成） | D-12b / D-23 | ✅ **完成** — 并以 L0 的 `standard/spring/elegant` 对齐键名 |
| 17 | 修 `chatTheme.css` 的 `.dark`/`@media` 重复（功能性 bug） | D-13 / D-26 | ✅ **完成** — 全 src `@media` 块 22 → 0；另修正 14 条自作用域死规则 |
| 18 | 阅读模式补覆盖 `--bg-canvas`/`--card-bg-solid`；高对比补 `--border-color`；按 **A-15** 裁决 `color-blind` | D-32 | ✅ **完成** — 三处缺口均已闭合，`color-blind` 用 Okabe-Ito 色板落地 |
| 19 | 删除 `--dsw-*` 命名空间，改用全局令牌 | U-9 | ⏳ → 并入阶段 2 第 27 项（`chatTheme.css` 全量收敛） |
| 20 | **建立渲染级 CI 门禁**：关键路由亮/暗截图 diff + 对比度断言 | G-5 | 🔶 **部分完成** — `theme:gate` 已交付 **12 项断言**（含渲染级 GATE-04~08）并通过 npm script 暴露；**接入 CI 仍待做（G-4）** |
| 21 | 静态清零条件类字符串 `bg-primary-*` + `text-white`（**实测 82 处**，原记 105） | D-50 残余 | ✅ **完成**（2026-10-06/07，`g14-clean.mjs` 批量清 + 渐变/动态 bug 修复 + `74a9252` 接线清零最后一处 WIP 残余；**GATE-14 转 pass**） |
| **22** | ~~清理 106 个「冗余」自引用令牌~~ **→ 更正为：保留登记声明（不改 inline、不删除）** | D-51 残余 | ✅ **已澄清**（v1.1.7）——这 106 条是 Tailwind 生成工具类的**登记机制**，删除会导致工具类完全不生成（实证 D-55）。**改为 `@theme inline` 经实测证伪**（会导致带 opacity 修饰符的类 0 生成）。层叠顺序隐患靠保证 `base.css`/`dark.css` 在 `index.css` 之前导入缓解（当前已如此），**无需额外动作** |
| **23（新增 v1.1.8）** | **T-B2b 去冗余注入 + 四角色映射**：`isCleanBuiltinPreset()` 使内置预设不注入（`<html>` 内联 86 → 0），无障碍变体 / 自定义 / 导入仍注入；`COLOR_MAIN_TO_L0` 补全 success/error/warning/info 四角色（12 条） | D-2 / D-3 终局 / D-53 配对 | ✅ **完成**（v1.1.8，`verify-b2b.mjs` 37 项断言全过） |
| **24（新增 v1.1.8）** | **D-53 kebab 化**：`generateCSSVariables` 引入 `toKebab`，10 个 camelCase 令牌名（`--color-primary-contrastText`、`--z-modalBackdrop`、`--ease-easeIn` 等）kebab 化后通过 `SAFE_TOKEN_NAME` 白名单 | D-53 | ✅ **完成**（v1.1.8，`verify-d53.mjs` 16 项断言全过，`--z-modal-backdrop` 首次匹配 L0） |

> **M2 另新增两项任务**（不在原表内）：
> · **T-B1 / T-B2a** 品牌色双源收敛与生成器改名 —— 关闭 **D-2 / D-3**，并**解锁自定义主题**；
> · **D-57** 无障碍同步路径补全 —— 随 T-S1 一并完成。
> 任务级拆解与依赖顺序见《修复执行方案》。

### 阶段 2 — 架构收口（P2，1–2 个月）

| 序 | 动作 |
|:--|:-----|
| 23 | 分阶段建立 primitive→semantic 的 `var()` 组合（D-24），先做颜色域 |
| ~~24~~ | ~~主题过渡改 CSS 类 + `transitionend`~~ **✅ 已于 M1 完成（D-8）** — 原表此项与阶段 0 重复，已合并 |
| 25 | `partialize` 纳入 `activeTheme`（D-37）；确认 `.dark` 无新增写手（D-38 收敛目标已随 D-41 达成） |
| **26** | 主题 UI 产品决策：删除孤儿页 **或** 收敛进 `SettingsPage`；删除 `useThemedComponent`（D-25） | 🔶 **收敛完成 / 孤儿页待决**（2026-10-12）—— 收敛侧：`ThemePanel` 已挂载进 `SettingsPage`（`:1460-1461`，`theme` 标签页 `:1691`）并成为唯一产品入口；`useThemedComponent.tsx` 已删除（`dc3393d`，**D-25 / D-40 关闭**）。删除侧：`ThemeSettingsPage.tsx`（505 行，0 引用）仍存，U-2 冻结中，待产品明确裁决 |
| 27 | 删除死文件：`adjustments.css`、`ThemeEventBus`、`themeColorMapper`、`useThemeInit`、`utils/theme/*`、根目录 `chatTheme.css`、`design-system/rmfood/*`（D-18/19/27/30/42/45） |
| 28 | 补主题回归测试，消除 0 覆盖（D-46） |
| 29 | 收敛两个 `useTheme`（D-40）；勘误 `theme-mode.ts` 描述并删除（§14.1） |
| 30 | 实现 **GATE-11**（令牌/语义类登记校验）与 **GATE-12**（105 处条件类静态断言） |
| **35（2026-10-06 新增）** | **实现 GATE-13（自有 `--color-*` 令牌登记校验，白名单制）+ GATE-14（`bg-{primary,secondary,accent}-{400..950} text-white` 条件类字符串静态清零）**。`g1314.mjs` 已落地并接入 `theme-gate.mjs`（门禁 12 → 14 项）；4 个未登记消费已修（`g13-fix.mjs`，对齐 L0 权威名）；GATE-14 存量 165 处 → **全库 0 处**（`g14-clean.mjs` 批量清 79 文件/136 行 + DashboardLayout 3 处 + 5 处渐变 D-50 + SynergyTab 动态档位 bug；**2026-10-07 `74a9252` 接线删除 SettingsPage 旧面板，最后一处 WIP 残余清零，GATE-14 转 pass，门禁 13/0/1**）。配套 §8.4 操作手册 |

### 阶段 3 — 治理落地（P2–P3）

| 序 | 动作 |
|:--|:-----|
| 31 | 注册 `theme:validate` 到 `package.json` + CI（G-4）；补齐 `lint-staged` 配置（现为空操作） |
| 32 | 按 §14.3 处置 6 份废弃文档；ADR 编号去重（7 组重号） |
| 33 | 统一审计清单与弃用策略模板（G-1/G-8） |
| 34 | 清理 4 个僵尸存储键（R-15；`rmfood-theme-settings-v2` 已随 D-11 消除） |

---

## 13. 附录 A — 品牌色一致性（权威裁决）

| 角色 | 权威值 | 令牌 |
|:-----|:-------|:-----|
| 品牌主色（亮色） | **`#10B981`** | `--color-primary` |
| 品牌主色（暗色） | **`#34d399`** | `--color-primary`（`.dark`） |
| 品牌主色按钮填充（亮） | `#059669` | `--color-primary-600` |
| 品牌主色按钮填充（暗） | **`#6ee7b7`** ⚠️ | `--color-primary-600`（反转后为浅色，**禁止**配白字，见 C-24） |
| **主色表面填充（亮）** | **`#047857`**（白字 **5.55:1** ✅ AA） | `--color-primary-surface` —— v1.1.2 随 D-50 引入，**不参与反转** |
| **主色表面填充（暗）** | **`#065f46`**（白字 **7.78:1** ✅ AAA） | `--color-primary-surface`（`.dark`）—— 同上 |
| **主色表面前景** | `#ffffff` | `--color-on-primary-surface`（两模式同值，与 `--color-primary-surface` **必须成对**） |
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
| `frontend/src/styles/tokens/dark.css` | L0 | 暗色令牌覆盖。✅ 孤儿 `:root` 已于 v1.1.2 清除（D-21） | 必须与 base 成对，**禁止裸 `:root`**（T7 / GATE-02） |
| `frontend/src/styles/tokens/typography.css` | L0 | 排版**应用规则**（非定义） | — |
| `frontend/src/styles/tokens/adjustments.css` | — | **未导入，待删除** | 禁止引用 |
| `frontend/src/styles/components/*.css` | L2 | 组件语义类 | 禁止定义新色值 |
| `frontend/src/styles/utilities/*.css` | L2 | 微交互/焦点/滚动条 | — |
| `frontend/src/styles/accessibility/environment.css` | L2 | 无障碍与打印 | — |
| `frontend/src/index.css` | L1 | 导入链 + `@theme`。✅ `@custom-variant dark` 已于 v1.1.2 添加 | 见 **R-4**（GATE-01/03） |
| `frontend/src/stores/themeStore.ts` | 运行时 | 唯一状态源。`syncA11yAttributes()` 负责首屏无障碍属性同步（D-39） | — |
| `frontend/src/stores/theme.presets.ts` | 运行时 | 预设 + CSS 变量生成 + DOM 应用。✅ 已按 T13/R-19/R-20 重写（D-8/D-33/D-39 关闭） | 令牌值须与 §3.2 权威表一致（**T6**） |
| `frontend/src/stores/ThemeProvider.tsx` | 运行时 | Context 投影 + 系统偏好监听 | — |
| `frontend/src/stores/theme.storage.ts` | 运行时 | 版本历史（只读旁路） | — |
| `frontend/src/types/theme.types.ts` | 类型 | 主题类型权威定义 | — |
| `frontend/src/types/design-tokens.ts` | 类型 | TS 令牌常量（供构建脚本） | 与 base.css 必须一致 |
| `frontend/src/types/theme-mode.ts` | 类型 | **已废弃**，但**并非**仅 re-export——实为 166 行遗留实现（含 `DEFAULT_THEME_STYLES`）；§14.1 已勘误 ADR-012 的相关说法 | 待删除 |
| `frontend/src/utils/chartTheme.ts` | L4 | **图表取色唯一通道** | 权威 |
| `frontend/src/utils/color-migration.ts` | L4 | **待废弃** | 迁移到 chartTheme |
| `frontend/src/utils/themeColorMapper.ts` | L4 | 死模块（`--color-chart-*` 全缺失） | 待删除 |
| `frontend/src/hooks/useSemanticTheme.tsx` | L4 | 程序化取色 Hook（**当前零消费者**） | 应推广 |
| `frontend/src/theme/index.ts` | 入口 | `@/theme` 统一导出 | 单一入口 |
| `frontend/src/theme/RadixThemeProvider.tsx` | — | **已删除**（T-R1 / D-41：样式表从未加载，属无效层） | — |
| `frontend/src/components/ui/RadixComponents.tsx` | L2 | Badge/Text 包装层（**已改项目原生实现**，保留 API + `role="status"`） | 名称保留仅为兼容导入路径 |
| `components/theme/theme-palette.ts`（新增，f6fae0e） | 明暗核心注入表**单一数据源**（纯数据、零副作用） | M4 治理 | `APPLE_HIG_PALETTES`（5 方案 × 明暗双值 + hover/pressed 同族档 + contrastText WCAG AA）与 `FONT_SCALES`（紧凑/标准/宽松 → `--text-body*` 真实 L0 正文令牌）。ThemePanel ⑦⑧ 区块改引本表，消除组件内魔法数 |
| `components/theme/ThemePanel.tsx`（新增） | 明暗主题核心模块组件（嵌入 `SettingsPage` 主题 tab，**已接线** `renderThemePanel → <ThemePanel />`；**8 区块**：① 明暗三态（`setThemeMode`）② 跟随系统实时状态（`matchMedia` 只读 + `useIsDarkMode`）③ 切换过渡动画 fade/scale/none（`setTransitionType` → 注入 `:root` 过渡变量，**去骨架化后真正驱动** `.theme-transition` 时长/缓动）④ 减少动画开关（`setMotionPreferences`）⑤ 明暗实时预览 ⑥ Ctrl+Shift+T 快捷键实际绑定（全局 keydown 明暗切换 + 重放 custom 注入）⑦ 字体方案（紧凑/标准/宽松 → 注入 L0 正文令牌 `--text-body*`，**非孤儿 `--text-*`**，注入值引 `theme-palette.ts` 单一数据源）⑧ 配色方案（引 `theme-palette.ts` 的 **Apple HIG 系统色板**：默认绿/苹果蓝/紫/橙/红，明暗双值 → 注入 `--color-primary-{500,600,700}` 静态色阶三档，**非仅语义别名 `--color-primary`**；「重置默认」清除手动注入）。全 L1 语义色类，§4.3 C-24 合规；**不含**预设主题选择器/自定义主题持久化管理（产品红线：不引入第三套主题） |
| `frontend/scripts/theme-audit/g1314.mjs` | GATE-13/14 断言 | 自检 | 令牌登记白名单校验（GATE-13）+ D-50 条件类静态扫描（GATE-14，2026-10-06 口径校准：排除 `dark:text-white`/`bg-white` 误报） |
| `frontend/scripts/theme-audit/g14-clean.mjs` | GATE-14 批量清理 | M4 治理 | 把「反转实底色阶 + text-white」共现行替换为 `bg-*-container text-*-main`；WIP 双重安全（显式排除 + git M 名单） |
| `frontend/scripts/theme-audit/theme-gate.mjs` | 门禁 | **门禁唯一入口**：`GATE-01`~`GATE-14` **十四项**断言，静态 / 编译产物 / 渲染三级（GATE-13/14 经 `g1314.mjs` 注入）；支持 `--milestone` `--json` `--require-render` | 只读，**禁止**修改仓库代码。断言清单见 §10.3 |
| `frontend/scripts/theme-audit/*.mjs` | 门禁 | 其余 15 个只读审计/取证脚本（隔离矩阵、令牌安全、过渡、截图对比等） | 见该目录 `README.md` |
| `frontend/scripts/theme-validate.ts` | 门禁 | 规范一致性校验脚本（`SPEC_COLORS` 表**已知有误**，待重写） | **尚未注册**为 npm script；见 §9.3 **G-4** |
| `frontend/.husky/pre-commit` | 治理 | 提交钩子，调用 `npx lint-staged`。**勘误**：`package.json` 中**确有** `lint-staged` 配置（TS/TSX/JS → prettier + eslint；CSS → prettier），并非空操作；但该配置**未包含任何 `theme:` 门禁** → G-4 的「接入 lint-staged」仍未完成 | 见 §9.3 **G-4** |

---

## 17. 附录 E — 渲染验证方法与可复现证据

> ⚠️ **本节 17.2~17.9 记录的是 v1.1.0 的「修复前」取证数据**（M1 执行之前），用于支撑缺陷认定。
> **修复后的复测数据见 §17.10（M1）与 §17.11（M2/M3，最新）**。阅读 §17.2~17.9 时请勿将其当作当前状态。
> 生产产物哈希与体积随版本变化，**以本节所列的时点值理解，不要用于当次构建校验**。

### 17.1 环境

| 项 | 值 |
|:---|:---|
| 前端 | Vite 8.1.3 dev server，`http://127.0.0.1:3000`（proxy `/api` → `:8000`） |
| 后端 | `uvicorn app.main:app --port 8000`，实测 `/health` 200 |
| 浏览器 | Playwright 1.61.1 + Chromium（headless），视口 1680×1050，`locale=zh-CN` |
| 登录 | `admin` / `admin123`（取自 `frontend/.env` 的 `VITE_DEFAULT_USERNAME/PASSWORD`） |
| 生产产物 | v1.1.0 时点：`frontend/dist/assets/index-CuWziqEh.css`（632 626 B）。**该哈希已随 M1 构建失效**，仅供复现历史取证 |
| 审计脚本 | `frontend/scripts/theme-audit/`（**16 个 .mjs** + README，**只读**，不修改仓库代码；门禁入口 `theme-gate.mjs`） |
| 结果留档（v1.1.0） | `temp/theme-runtime-results{2,3}.json`、`temp/theme-css-isolation.json`、`temp/theme-white-on-fill2.json`、`temp/theme-final-results.json`、`temp/theme-hero-contrast.json` |
| 结果留档（v1.1.2 / M1） | `temp/theme-safety-verify.json`、`temp/theme-d8-verify.json`、`temp/theme-t-r1-verify.json`、`temp/theme-visual-diff.json`、`temp/m1-verify-log.txt` |
| 截图 | `temp/theme-shots/`（v1.1.0：13 张；v1.1.2 增补 `before/`、`after/` 各 12 张 6 路由 × 亮/暗对照，及 `radix-demo-{light,dark}.png`） |

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

### 17.10 M1 修复后复测（v1.1.2，2026-10-01）

> 本节为 **M1 执行后**的复测数据，是 §17.2~17.9「修复前」数据的对照。采集方式同 §17.1；门禁断言见 §10.3。

**A. 门禁结果**

| 范围 | 结果 |
|:-----|:-----|
| `npm run theme:gate`（全部） | 通过 **10** / 失败 **1** / warn **1** — 唯一失败为 **GATE-08**（无回退 `var()` 未解析，**M2 范围**） |
| `npm run theme:gate:m1` | **退出码 0**（M1 范围 **通过 9 / 失败 0**） |
| `npm run build`（`tsc -b` + `vite build`） | **退出码 0** |
| `verify-token-safety.mjs` | **70/70** 安全断言通过（含换行注入与 `javascript:` 向量） |

**B. 关键指标对照**

| 指标 | 修复前（§17.2~17.9） | 修复后（v1.1.2） |
|:-----|:---------------------|:-----------------|
| 编译产物中位于 `prefers-color-scheme` 内的 `.dark\:` | **1 467** | **0** |
| `.dark` 类生效时刻 | 1 516 ms（晚于 FCP） | **153 ms** |
| 首个 body 背景（暗）出现时刻 | — | **1 766 ms < FCP 1 888 ms** → **无 FOUC** |
| 页头横幅暗色对比度 | **1.52:1** | **≥ 4.85:1**（亮/暗均达 AA） |
| 徽章亮色文字对比度（最差） | **1.26:1** | **4.65:1**（六枚 4.65–6.61:1） |
| 暗色 `--background` | `#f0fdf4`（近白绿） | **`#020617`** |
| `--bg-surface-variant` | *(空)* | `#f8fafc` / `#020617` |
| `--color-primary-text`（暗） | `#047857`（约 2.3:1） | **`#6ee7b7`**（约 13.3:1） |
| `<html>` 上 inline opacity/transform（6 次切换） | 存在 | **0 次** |
| CSS 注入形态阻断 | 可越界注入 | **10/10 阻断**（59/59 断言通过） |
| `/radix-demo` Radix 残留节点 | 存在 `.radix-themes`（令牌全空） | **0** |

**C. 亮/暗截图逐像素回归（`temp/theme-shots/{before,after}/`，6 路由 × 双模式）**

| 路由 | 暗色差异 | 亮色差异 |
|:-----|---:|---:|
| `/ai` | 21.0% | 0.0% |
| `/settings` | 14.0% | 0.0% |
| `/users` | 3.8% | 0.0% |
| `/formulas` | 3.6% | 0.0% |
| `/dashboard` | 0.2% | 0.3% |
| `/login` | 0.2% | 0.3% |
| **平均** | **7.1%** | **0.1%** |

> **签名解读**：变化集中于**暗色**（`dark:` 此前因 D-1 完全未生效，修复后被激活），**亮色几乎零变化（0.1%）**——证明修复未引入非预期回归。`/dashboard`、`/login` 变化极小，因其主要依赖手写 `.dark .X` 规则（此前已工作）。
> 证据文件：`temp/theme-visual-diff.json`；对比脚本：`scripts/theme-audit/compare-shots.mjs`。

**D. 令牌安全复测（D-33）**

`isSafeToken` 白名单于浏览器内以真实模块执行：**59/59 断言通过**；10 种注入形态（`;` / `}` / `{` / `url(` / `expression(` / `<>` / 反斜杠 / 超长值等）**全部阻断**。证据：`temp/theme-safety-verify.json`。

**E. Radix 移除复测（D-41 / D-10 / R-9）**

`/radix-demo` 可达、未触发错误边界、**0 个 Radix 残留节点**、**13 个 Badge 具备 `role="status"`**、0 页面错误（已滤除既有的后端 WebSocket 噪声）。证据：`temp/theme-t-r1-verify.json`。

**F. 未覆盖项（明确声明）**

- **GATE-04/05/06 在 v1.1.2 复测时因 dev server 未运行而跳过**；其通过结论来自 M1 执行期间的 12 路由 × 22 元素 × 双模式扫描（0 失败）。下一次 CI 运行会重新采集。
- **GATE-08（151 个未解析 `var()`）未修复**，属 M2 范围。
- **106 条 `@theme` 登记声明**（GATE-09 为 warn）。**注**：它们是工具类生成的登记机制，**不需清理** —— 详见 §3.1 T13 的 v1.1.5 更正。

---

### 17.11 M2/M3 修复后复测（v1.1.8，2026-10-02）

> 本节为 **M2（T-B2b/D-53）与 M3（T-G1/T-G3）执行后**的复测数据。采集方式同 §17.1（dev server `http://127.0.0.1:3000` 渲染级），采集脚本 `scripts/theme-audit/collect-m2m3.mjs`，证据文件 `temp/theme-m2m3-verify.json`。

**A. 门禁结果**

| 范围 | 结果 |
|:-----|:-----|
| `npm run theme:gate`（全部 12 项） | **通过 11 / 失败 0 / 跳过 0**，退出码 0（稳定，重复运行无抖动） |
| GATE-09 | warn（预期：0 循环引用 + 106 登记声明） |
| `npx vite build` | ✅ |
| `npm run build`（`tsc -b`） | ❌ 被并发编辑者 `NotificationCenter.tsx:39` 类型错误阻断（非主题系统引入） |

**B. T-B2b / D-53 注入形态复测（核心指标）**

| 模式 | `<html>` 内联自定义属性 | 证据 |
|:-----|:---:|:-----|
| 内置纯净 `light-default` | **0**（T-B2b 前为 86） | `isCleanBuiltinPreset()` 跳过注入，L0 由 `base.css` 静态提供 |
| 内置纯净 `dark-default` | **0** | 同上，L0 由 `dark.css` 静态提供 |
| 无障碍 `color-blind` | **93**（含 Okabe-Ito） | `--color-success=#009E73`、`--color-error=#D55E00`、`--color-warning=#E69F00`、`--color-info=#0072B2`、`--z-modal-backdrop=50`、`--color-primary-contrast-text=#052e16` |

**C. D-53 kebab 化复测**

| 指标 | 结果 |
|:-----|:-----|
| 自定义主题写入 `--color-primary-contrast-text` | ✅ kebab 名通过 `SAFE_TOKEN_NAME` 白名单 |
| 自定义主题写入 `--z-modal-backdrop` | ✅ 首次匹配 L0 既有定义（值 50，color-blind 态） |
| 旧 camelCase 名（`-contrastText`/`-modalBackdrop`/`-easeIn`）生成 | ✅ **0 个**（已 kebab 化，camel 名不再生成） |
| `verify-d53.mjs` 静态断言 | **16/16** 通过 |

**D. M3 死代码清理复测（T-G1 / T-G3）**

| 项 | 结果 |
|:-----|:-----|
| T-G1 删除孤岛文件 | **24 文件 / 2580 行**（`utils/theme`/`utils/events`/`types/theme-mode.ts`/`adjustments.css`/`themeUrlParser.ts`/`components/theme` 组件族 12 文件 + 2 文档） |
| 悬挂 import（`verify-g1.mjs`） | **0**（26 断言全过） |
| T-G3 版本历史死功能 | 删除 7 方法 + `ThemeVersion` 接口（`theme.storage.ts` 246 → ~130 行） |
| T-G3 僵尸键清理 | `themeStore.ts` v4 迁移后一次性 `removeItem` 4 个遗留键（活跃 persist 键 `rmfood-theme-storage` 保留） |
| T-G3 全局 `reduced-motion` 块 | **14 → 1**（仅 `environment.css`），特异性块保留 |
| `verify-g3.mjs` 断言 | **21/21** 通过 |

**E. 采集口径勘误（重要，避免误读 B/C 数据）**

1. **`data-mode` / `bodyBg` 在三个预设下均显示亮色值** —— 这是**正确行为**而非 bug：M2 的 T-S1 修复后，`data-mode` 由**应用设置**驱动，**不**由 `activeThemeId` 派生；采集脚本只切 `activeThemeId` 未切 `mode`，故 `dark-default` 的 bodyBg 仍为亮色 `rgb(248,250,252)`。判定暗色渲染须同时设 `mode=dark`。
2. **脚本中的 `contrastPrimary=2.42:1` 是采集口径错误**，**不可作为对比度验收结论**：脚本误算「`--color-primary` vs body 背景」，而设计目标的对比度验收是「primary 表面 vs `on-<surface>` 文字色」，且 L0 的 `--color-primary` 是**静态令牌**（暗色下不反转，须用 `-contrast-text` 配）。**真正的对比度验收由 GATE-04/05（渲染级 12 项门禁）覆盖**，本次 **通过 11/0**，无对比度回归。
3. `color-blind` 内联 **93**（非旧记 86）：T-B2b 四角色映射（+12 条 L0 目标）与 D-53 kebab 化（+10 维度解锁）叠加后的**当前真实值**，旧记 86 为 T-B2b 前数据。

**F. 未覆盖项（明确声明）**

- **暗色双场景渲染**（`mode=dark` 下的 `/dashboard`、`/formulas`、`/settings`、`/ai`、`/login` 逐像素 diff）未在本节重采 —— 由 §17.10 C 节的 M1 数据 + 本次 GATE-04/05 通过结论覆盖，未单独截图。
- **移动端视口（≤767px）/ 打印样式 / `forced-colors` 实际渲染** 仍未覆盖（同 §17.10 F）。
- 变体态（`color-blind` 等）全量注入 93 个令牌（部分对 L0 冗余），**精确差异注入**记 M3/M4 优化项（需逐令牌比对 L0 计算值）。

---

## 18. 变更日志

| 版本 | 日期 | 变更 |
|:-----|:-----|:-----|
| **v1.1.9** | 2026-10-02 | **新增 §17.11 M2/M3 修复后复测 + §17 目录指针更新 + M3 T-G1/T-G3 收口登记**。① **§17.11** 以 dev server 渲染级重新采集：门禁 **11/0/0**、T-B2b/D-53 注入形态（内置纯净 `<html>` 内联 **0**，color-blind 内联 **93** 含 Okabe-Ito 色板 `#009E73`/`#D55E00`/`#E69F00`/`#0072B2` + `--z-modal-backdrop=50` + `--color-primary-contrast-text=#052e16`）、M3 死代码清理（T-G1 24 文件 / T-G3 版本历史删除 + 僵尸键一次性清理 + 全局 reduced-motion 块 14→1）、`verify-g1.mjs` 26/26 与 `verify-g3.mjs` 21/21 全过。② **采集口径勘误（重要）**：采集脚本误算「`--color-primary` vs body 背景」得出 2.42:1，**不可作为对比度验收结论**——设计目标的对比度验收是「primary 表面 vs `on-<surface>` 文字色」，L0 的 `--color-primary` 是静态令牌（暗色不反转，须用 `-contrast-text` 配）；**真正的对比度验收由 GATE-04/05 渲染级门禁覆盖**（本次通过）。③ §17 目录指针更新指向 §17.11。版本头升至 v1.1.9。 |
| **v1.1.8** | 2026-10-02 | **收口 M2 后的两项修正 + 门禁脆弱性修复 + D-53 修复**。① **T-B2b**（M2 最后一项，8/8）：`COLOR_MAIN_TO_L0` 补全 success/error/warning/info 四语义角色（main→L0 主色、background→-container、text→-text，12 条）；新增 `isCleanBuiltinPreset()` —— 内置纯净预设（`light-default`/`dark-default` 且 `colors` 未被无障碍变体修改）时 `applyThemeToDOM` **跳过内联注入**（`<html>` 内联自定义属性 **86 → 0**），无障碍变体 / 自定义主题 / 导入主题仍注入（color-blind 态 `--color-success=#009E73` Okabe-Ito 生效）；`clearInlineCustomProps()` 清旧防残留。② **D-53**：`generateCSSVariables` 引入 `toKebab`，10 个 camelCase 令牌名（`--color-primary-contrastText`、`--z-modalBackdrop`、`--ease-easeIn` 等）kebab 化后通过 `SAFE_TOKEN_NAME` 白名单，解锁该 10 维度自定义；`--z-modal-backdrop` 首次匹配 L0 既有定义。静态断言 37（B2b）+ 16（D-53）全过。③ **GATE-04/05 脆弱性修复**：`g0405` 中单路由导航异常原会 `return { error }` 提前退出并让 GATE-04/05 双双 fail（"单路由拖垮整组"）；改为单路由异常跳过并记录、仅**全部**路由失败才报错。门禁稳定 **11/0/0**。新增验证脚本 `verify-b2b.mjs` / `verify-b2b-step1.mjs` / `verify-d53.mjs` / `measure-b2b.mjs` / `measure-d53.mjs` / `repro-gate0405.mjs`。**残余**：变体态全量注入 86 个（部分对 L0 冗余，精确差异注入记 M3/M4 优化项）；M3 死代码清理（`useLegacyTheme`/`useThemedComponent` 待删）未启动。 |
| v1.0.0 | 2026-10-01 | 首次发布。确立五层模型、令牌命名规范、消费契约、无障碍要求、治理流程；登记 49 项缺陷；裁决品牌色与两套命名体系；废止 6 份旧规范文档。**验证等级 L2（静态）。** |
| **v1.1.0** | 2026-10-01 | **升级为 L3（真实浏览器渲染取证）**。新增 §1.3 渲染验证基线、§17 验证方法与可复现证据、C-24（反转色阶禁止配白字）、I9 不变量、CHK-23~25、R-9、A-2/A-5/A-7/A-8、U-12。**推翻 1 项**（D-5 内联累加）、**修正 4 项**（D-2/D-3/D-4 变量范围、D-39 缺陷边界、§1.2 静态启发式、D-4 精确缺失清单）、**新增 1 项 P0**（D-50，实测暗色对比度 1.52:1）。缺陷总数 49 → 52（含推翻项标注）。 |
| **v1.1.1** | 2026-10-01 | **门禁驱动发现新增 P0**。交付 `theme:gate`（9 项断言 `GATE-01`~`GATE-09`）后立即发现 **D-51**：`index.css` 的 `@theme` 悬空自引用致 `--color-blue-50..900` **循环引用**、解析为空，使全项目约 **347 处** `blue-*` 工具类失去颜色（编译产物与浏览器双重确证）。新增令牌规则 **T13**、检查项 **CHK-26/CHK-27**。 |
| **v1.1.2** | 2026-10-01 | **M1（止血）执行完成**。门禁断言 9 → **10 项**（新增 `GATE-10` Radix 前置条件）；`npm run theme:gate:m1` **退出码 0**。已修复：**D-1, D-8, D-9, D-10, D-11, D-12b, D-21, D-22, D-33, D-39, D-41, D-49, D-50, D-51, D-52**（15 项）。关键实测见 **§17.10**：页头暗色对比度 **1.52:1 → ≥4.85:1**、徽章 **1.26:1 → 4.65:1（最差）**、`.dark` 生效 **1 516 ms → 153 ms**、FOUC 消除、注入形态 **10/10 阻断**、`dark:` 编译归属 **1 467 → 0**。新增 §11.2 修复状态表。 |
| **v1.1.7** | 2026-10-02 | **勘误 v1.1.6 的 `@theme inline` 建议（重要）**。v1.1.6 建议「改用 `@theme inline` 根治自引用隐患」，**经实测证伪**：`@theme inline` 会导致 Tailwind **无法生成带 opacity 修饰符的类**（如 `ring-primary-600/40`、`decoration-primary-400`），产物中这些类 **0 生成**（实证：改为 inline 后 GATE-12 由 pass → fail，缺失 2 类；回滚到 `@theme` 后恢复生成）。故 §3.1 **T13** 已补勘误：**保留 `@theme`（非 inline）形式，106 条登记声明不得删除或改为 inline**，层叠顺序隐患靠「保证 `base.css`/`dark.css` 在 `index.css` 之前导入」缓解（当前已如此）。同时**改进门禁 GATE-12 的检测逻辑**：旧版用 `\b` 匹配会把 `text-primary-500` 误读为 `text-primary-50`、且无法识别带变体前缀与 opacity 修饰符的类；新版用「变体前缀 + 词边界 + 可选 /NN」精确识别，并按「裸类名是否作为子串存在」判定工具类是否生成。门禁脚本同步更新（`stripCssComments` 消除 GATE-09 注释误报、变量 `redundant` → `registered`）。**§12 第 22 项**由「清理 106 个冗余自引用」更正为「保留登记声明、不改 inline」。版本头升至 v1.1.7。 |
| **v1.1.6** | 2026-10-01 | **更正 T13 的错误指引（重要）**。v1.1.4 及更早版本把 `@theme` 中「自引用且同名有定义」的声明称为「**冗余**」并建议清零 —— **该指引是错误的**：这类声明是 Tailwind v4 生成工具类的**登记机制**，删除会导致 `bg-<族>-<档>` 等工具类**完全不生成**。实证来自本会话的 **D-55**：`secondary` 族因缺条目，产物中 `.bg-secondary-500` 等为 **0 个**；补上 11 条后变为 **5 个**（交叉验证 primary/secondary/accent/info/danger 五族分别为 9/5/5/1/1 处）。已同步更正：§3.1 **T13** 判定口径、§10.1 CHK-26、§10.3 GATE-09 行、§12 第 22 项，以及门禁脚本 GATE-09 的输出文案（变量 `redundant` → `registered`）。~~正确的根治方向是改用 `@theme inline`~~（**已被 v1.1.7 证伪并勘误**）。 |
| **v1.1.5** | 2026-10-01 | **M2（一致性）落地**。完成 7/8 任务，关闭 **13 项缺陷**：D-2/D-3（品牌色双源收敛 32 → 0）、D-4/D-43/D-45（图表取色单通道）、D-13/D-26（对话区暗色改由 `.dark` 驱动，全 src `@media` 块 **22 → 0**）、D-23（缓动/字重命名）、D-32（无障碍三处缺口 + `color-blind` 按 A-15 用 Okabe-Ito 落地）、D-34~D-38/D-40（状态一致性、`useTheme` 唯一化）、D-57（无障碍同步路径）。**T-B2a 解锁自定义主题**（此前品牌色完全无法自定义）。门禁 9 → **12 项**并**首次全绿**（11/0/0）。新增验证脚本 6 个（`preset-align`、`verify-d34-d37`、`verify-d35-d36`、`verify-d40`、`verify-d57`、`verify-tf1a`）与 `syntax-check.mjs`（构建被他人阻断时的独立语法检查）。§10.1 CHK-04/CHK-18 状态刷新；§11.2 增 M2 状态表；§12 阶段 1 标记完成。残余：T-B2b、82 处条件类、106 个冗余自引用。 |
| **v1.1.4** | 2026-10-01 | **门禁扩展 + 3 项新缺陷修复**。对 v1.1.3 做对抗性复核，发现并修复：**D-54**（P0，`.surface-primary:hover` 暗色 **1.13:1**，D-50 修复自身引入的回归；新增 `--color-primary-surface-hover`，亮 `#065f46`/暗 `#047857`，实测亮 5.48/7.68、暗 7.68/5.48）；**D-55**（P0，`@theme` 未桥接 `secondary` 整族 → 104 处 `bg-secondary-*`/`text-secondary-*` **0 生成**、主按钮无背景色；补 11 档桥接后 `.bg-secondary-500` **0→5**）；**D-56**（P1，`info` 族非色阶 + `error` 缺 950 → 14 个类不生成；info 按档位别名到同源的 `secondary`，`error-950` 别名到 `danger-950`）。门禁断言 **10 → 12 项**（新增 **GATE-11** 表面令牌含 hover 对比度、**GATE-12** 品牌色阶类产物存在性），全量 **通过 10 / 失败 1**（GATE-08，M2 范围）、M1 范围 **通过 9 / 失败 0 / 退出码 0**。修正 v1.1.3 的 4 处自我错误（§16 `lint-staged` 断言失实、GATE 计数、T13 段内矛盾、§2.1 注入数字）。新增 **D-53**（10 个 camelCase 令牌名被白名单拒绝，待 M2）、**CHK-28**、§4.2 的 `.surface-primary` 悬停要求。 |
| **v1.1.3** | 2026-10-01 | **状态列全量刷新**。M1 的 15 项修复此前只写入 §11.2，本版同步到 §2.1 模型图、§2.2 不变量表、§3.2/§3.3 令牌表、§4.2 语义类清单、§4.3 C-1/C-24、§6.2 A-5、§7.2~§7.9 契约、§10.1 检查清单、§11 表时点、§12 路线图、§16 文件职责表、§17 证据附录，并新增 **§17.10 M1 复测**。结构性修订：门禁断言 `G-nn` → **`GATE-nn`**（消除与治理条款 `G-1~G-9` 的前缀冲突）并在 **§10.3** 逐条枚举；补齐 **R-4**（原缺失却被引用 3 次）；清除 **§7.10** 悬空引用；**T3** 白名单增列 `surface` / `on-<surface>`；**T13** 区分「循环引用」与「冗余」两档并给出处置口径；**CHK-19** 标 RETIRED（与 CHK-09 重复）；**CHK-11** 措辞与 C-4/C-13 对齐；**CHK-26/27** 依据由 T8 更正为 T13；新增 **A-15**（`color-blind` 模式裁决要求）；§11 增加**编号空洞与计数口径**说明；§16 新增 `scripts/` 与 `.husky/` 职责行并勘误 `theme-mode.ts` 描述。 |

> **缺陷计数口径（替代此前的推算写法）**：§11 表登记 **44 行 / 46 个缺陷 ID**。编号存在 8 个历史空洞，故**最大编号不等于缺陷数**；此前版本中「52 → 53」等写法系按编号推算，已废止。当前状态以 §11.2 为准：**已完成 15 项 + 附带 1 项 + 推翻 1 项；待办 30 项**。

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
