# 配料表核查页 UI/UX 设计系统合规审计报告

- **审计对象**：`frontend/src/pages/label/` 下 LabelCheckPage / RiskBoard / IngredientList / FilterBar / HistoryPanel / TemplatePicker / ParseWarnings / labelCheckMeta
- **规范依据**：`frontend/design-system/DESIGN.md` v1.0（871 行）；令牌源 `src/styles/tokens/base.css`、`tokens/dark.css`、`tokens/typography.css`
- **审计方式**：只读代码 + 对照规范逐项核查，未修改任何 .tsx/.ts/.css
- **审计日期**：2026-11-11

---

## 一、结论摘要

整体评价：页面结构清晰、图标全部使用 Lucide（✅ 无 emoji）、暗色模式无 #000 硬编码、字段读取大量 `??` 兜底，工程质量良好。但存在 **3 处🔴级（三色语义 / 无障碍对比度）**、**4 类 P1（触摸目标 / 低于 12px 字号地板 / 正文滥用 text-xs）** 偏离，需要优先修。

### 分级统计表

| 级别 | 数量 | 说明 |
|------|------|------|
| 🔴 严重（三色语义 / WCAG 无障碍） | 3 | 必须修，阻断上线 |
| P1 明显偏离规范 | 4 类（约 20+ 处） | 强烈建议修 |
| P2 建议优化 | 5 | 择机优化 |

---

## 二、逐文件审计详情

### 1. LabelCheckPage.tsx

#### 🔴-1 三色语义违规：欢迎横幅把 primary 渐变到 accent(Bio Purple)
- **位置**：`LabelCheckPage.tsx:134`
  ```tsx
  <div className="rounded-xl bg-gradient-to-r from-[var(--color-primary-surface)] to-[var(--color-accent-surface)] p-4 sm:p-6 text-white shadow-md">
  ```
- **问题**：配料表核查是**信息比对功能，不是 AI 功能**。横幅从 Forest Green(`--color-primary-surface`=#047857) 渐变到 Bio Purple(`--color-accent-surface`=#6d28d9)，等于把 accent 强调色铺满了整个页面顶部主视觉。
- **DESIGN.md 依据**：Do's and Don'ts（L753-754、L758）「Bio Purple 仅用于 AI 功能标识、AI 生成按钮、智能推荐相关元素」「不要混淆三色语义」。Colors 节 L550-551 明确 accent-500/600 = 「AI 功能标识 / AI 按钮」。整页无任何 AI 功能，却用紫渐变。
- **修正建议**：横幅改为单一 Forest Green 实底或绿色系渐变，去掉 accent 端点：
  ```tsx
  // 方案A：实底（推荐，最稳）
  className="rounded-xl bg-[var(--color-primary-surface)] p-4 sm:p-6 text-white shadow-sm"
  // 方案B：绿色系渐变（若要保留渐变质感）
  className="rounded-xl bg-gradient-to-r from-[var(--color-primary-surface)] to-[var(--color-primary-hover)] p-4 sm:p-6 text-white shadow-sm"
  ```

#### 🔴-2 WCAG 对比度：副标题 `text-white/80` 压在渐变底上不达标
- **位置**：`LabelCheckPage.tsx:141`
  ```tsx
  <p className="text-sm text-white/80 mt-1">{t('pages.labelCheck.subtitle')}</p>
  ```
- **问题**：副标题为 14px(`text-sm`) 常规字重，属"正文"级，需 ≥4.5:1。白色 80% 透明叠在绿色端 `#047857` 上，混合后约 `#CDE4DD`，对比度实测约 **3.7:1 < 4.5:1 ❌**（在紫色端约 5.3:1 达标，但渐变左半段不达标）。`typography.css:39-43` 已有同类案例记录（`.surface-primary` 上 `text-white/80` 实测 1.89:1 的历史缺陷）。
- **DESIGN.md 依据**：Accessibility 节 L800「文本对比度 ≥4.5:1 (正文)」；Do's L755「色彩对比 ≥4.5:1（正文）」。
- **修正建议**：改为纯白并适当降低视觉权重（用字重/字号而非透明度）：
  ```tsx
  <p className="text-sm text-white/95 mt-1">{t('pages.labelCheck.subtitle')}</p>
  // 或更稳：直接 text-white，靠 text-sm 与标题形成层级
  <p className="text-sm text-white mt-1 opacity-95">{t('pages.labelCheck.subtitle')}</p>
  ```
  若保留 `from-…to-accent` 渐变，至少将副标题限定在深色端，或给文字加 `drop-shadow`；但根本解法是先修🔴-1 去掉渐变。

#### P2-1 横幅 `shadow-md` 偏离 hairline + 微阴影规范
- **位置**：`LabelCheckPage.tsx:134`
- **DESIGN.md 依据**：Do's L757「卡片使用 hairline 边框 + 微阴影，不使用大阴影」；Elevation L648 Level-1 默认卡 = `0 1px 3px rgba(0,0,0,0.08)`（≈`shadow-sm`）。
- **修正建议**：`shadow-md` → `shadow-sm`。

#### P1-A 正文滥用 `text-xs`(12px) 当辅助说明
- **位置**：`LabelCheckPage.tsx:189`（OCR 文本回显）、`222`（reportId）
- **说明**：OCR 文本回显是正文性质内容，用 12px caption 偏小。
- **修正建议**：`:189` 改 `text-xs` → `text-sm`（14px body-sm）；`:222` reportId 属时间戳/注释，保留 `text-xs`(12px) 合规。

#### P2-2 硬编码任意值
- **位置**：`LabelCheckPage.tsx:164` `min-h-[120px]`、`:216` `min-w-[240px]`
- **说明**：`min-h-[120px]` 与 DESIGN `chat-input.minHeight:120px` 数值一致但未走令牌。
- **修正建议**：Textarea 用行数控制即可（已有 `rows={5}`），移除 `min-h-[120px]`；或封装为 `.min-h-input` 令牌类。`min-w-[240px]` 属布局断点，可保留。

---

### 2. RiskBoard.tsx

#### P1-B 低于 12px 字号地板 + 硬编码字号
- **位置与修正**：
  - `RiskBoard.tsx:42` `<span className="text-[10px] text-muted-foreground">/ 100</span>` → `text-[10px]` 低于地板，改 `text-xs`(12px)。
  - `RiskBoard.tsx:91` `text-[11px] …riskNote` → 改 `text-xs`(12px)。
  - `RiskBoard.tsx:100` `text-[11px] …needsReviewNote` → 改 `text-xs`(12px)。
  - `RiskBoard.tsx:156` `text-[11px] …allergenNote` → 改 `text-xs`(12px)。
- **DESIGN.md 依据**：Typography L601 caption=12px 为最小注释档；`base.css:313-317`（A-11）已明确「11px 汉字笔画已糊，最小可读地板抬到 12px，overline 与 caption 合并」。`text-[10px]/[11px]` 同时违反"字号令牌化、禁任意值"。
- **说明**：这些 note 均为注释性文案，`text-xs`(12px) 正好对应 caption 档，语义也正确。

#### P2-3 "目录比对提示分"仪表用 Forest Green，可能被误读为成功态
- **位置**：`RiskBoard.tsx:37` `className="stroke-primary"`、`:41` `text-primary-600`（分数数字）
- **说明**：文件头 L4-9 红线明确 risk_score 是"中性指标，非安全评分、不得定级"。但进度弧与分数用 primary 绿，绿色在设计中承载"健康/成功/良好"语义，用户易将其误读为"分数高=好/安全"。
- **DESIGN.md 依据**：Don'ts L758「不要把 Forest Green 用于成功态以外的语义」。
- **修正建议**：仪表弧与分数改用中性/信息色，避免成功暗示：
  ```tsx
  // 弧
  className="stroke-secondary"   // Ocean Blue = 数据图表语义
  // 分数
  <span className="text-3xl font-bold text-secondary-700 dark:text-secondary-300">{clamped}</span>
  ```
  （Ocean Blue 按 DESIGN L753 正是"数据可视化图表"用色，最贴合"中性指标仪表"。）

#### P2-4 `text-[10px]`/`text-xs` 混用（同一面板字号不成阶）
- **位置**：`RiskBoard.tsx:85,120,128` 用 `text-xs`，而 `:42` 用 `text-[10px]`，`:91,100,156` 用 `text-[11px]`
- **修正建议**：统一到 12px caption 档（见 P1-B），消除三档混用。

---

### 3. IngredientList.tsx

#### P1-C 明细行 `text-xs`(12px) 承载正文级字段内容
- **位置**：`IngredientList.tsx:16`（DetailRow 根）、`:87`、`:95`、`:112`、`:120`、`:128`（别名/注意/来源法规/风险贡献/子成分各 DetailRow 均为 `text-xs`）
- **说明**：展开后的"匹配方式/置信度/限量/功能/来源法规/风险贡献"是核心参考信息，属正文性质，用 12px 偏小、可读性差。
- **DESIGN.md 依据**：Typography L599-600「body 15px 标准正文⭐️ / body-sm 14px 辅助说明」；Do's L754「中文正文使用 15px，不要用 14px（对中文偏小）」。
- **修正建议**：DetailRow 根类与各处 `text-xs` → `text-sm`(14px，作为表格/明细辅助说明档)；标签列 `w-28` 的 label 可保持 `text-muted-foreground`。若要严格贴 body 档，关键 value 列用 `text-sm`、说明性 label 用 `text-xs` 分层即可，不必全 15px。
  ```tsx
  // DetailRow
  <div className="flex gap-2 text-sm">
    <span className="text-muted-foreground shrink-0 w-28">{label}</span>
    ...
  ```

#### P2-5 展开行内嵌 Badge 图标 `w-3 h-3`(12px) 偏小
- **位置**：`IngredientList.tsx:53` `<match.icon className="w-3 h-3" />`、`:61`、`:64`
- **DESIGN.md 依据**：按钮尺寸表 L690-694（sm 档 icon=14px）；图标应 ≥14px 保证可辨。
- **修正建议**：Badge 内图标 `w-3 h-3` → `w-3.5 h-3.5`(14px)。

#### ✅ 合规点
- 折叠/展开按钮虽为 `<button>`，但 `p-3`(12px)+多行内容，实际高度远超 44px，触摸目标达标；`aria-expanded`、`disabled={!hasDetail}` 无障碍属性到位。

---

### 4. FilterBar.tsx

#### 🔴-3 三色语义违规：过滤 chip hover 用 accent(Bio Purple)
- **位置**：`FilterBar.tsx:43`、`:51`、`:64`、`:74`（四个 chip 按钮的未选中态）
  ```tsx
  className={`... ${active ? 'bg-primary text-primary-foreground border-transparent' : 'border-border hover:bg-accent'}`}
  ```
- **问题**：`--accent`(shadcn) = `var(--color-accent-700)` = **Bio Purple #6d28d9**（`base.css:452`）。鼠标悬停分类/级别/致敏过滤 chip 时背景变紫，把 AI 专属强调色用于普通数据筛选交互。
- **DESIGN.md 依据**：同🔴-1，Bio Purple 仅限 AI 功能（L753、L550-551）。
- **修正建议**：hover 改为中性 hover 色（与 Ghost 按钮一致，DESIGN L684 `hover:bg-slate-100 dark:hover:bg-slate-800`）：
  ```tsx
  : 'border-border hover:bg-neutral-subtle dark:hover:bg-neutral-800'
  // 或用语义 token：hover:bg-[var(--color-neutral-subtle)]
  ```

#### P1-D 过滤 chip 触摸目标远低于 44×44px
- **位置**：`FilterBar.tsx:41-46`、`:48-55`、`:61-68`、`:71-78`（全部 4 组过滤按钮）
  ```tsx
  className="text-xs rounded-full px-2.5 py-1 border ..."
  ```
- **问题**：`py-1`(4px)+`text-xs`(12px 行高~16px) → 按钮实际高度仅约 **24px**，宽度也偏窄，远低于 44×44px 触摸目标；移动端难点中。
- **DESIGN.md 依据**：Do's L755「所有交互元素满足 44×44px 触摸目标(WCAG 2.1 AA)」；Touch Targets 表 L783-784「按钮 44×44px / 链接 44×44px（padding 扩展点击区域）」。
- **修正建议**：给 chip 增加内边距与最小高度，保留 pill 圆角：
  ```tsx
  className="text-sm rounded-full px-3.5 min-h-[44px] inline-flex items-center border transition-colors ..."
  ```
  或最小改法：`px-2.5 py-1` → `px-3 py-2`，并加 `min-h-[36px]`（若受密度限制，至少 ≥36px，并确保 chip 间 `gap` 提供足够落点；理想仍为 44px）。

#### P2-6 chip 字号 `text-xs` 偏小
- **位置**：同上 chip 按钮
- **修正建议**：随 P1-D 一并改 `text-sm`(14px)。

---

### 5. HistoryPanel.tsx

#### P1-E 图标按钮触摸目标 < 44px
- **位置**：`HistoryPanel.tsx:73`（复查）、`:76`（删除）
  ```tsx
  <Button variant="ghost" size="icon" onClick={...} aria-label={...}>
  ```
- **问题**：`size="icon"` 在 shadcn 默认为 `h-9 w-9`(36px) < 44px 触摸目标。历史条目删除/复查是高频操作，移动端难点。
- **DESIGN.md 依据**：Touch Targets L783；Do's L755。
- **修正建议**：给这两个 icon 按钮补尺寸类：
  ```tsx
  <Button variant="ghost" size="icon" className="h-11 w-11" ...>  // 44px
  ```
  （`h-11 w-11` = 44px，符合触摸目标；或项目统一把 Button icon 档提到 44px。）

#### P1-B（续） 低于 12px 字号地板 + 硬编码字号
- **位置与修正**：
  - `HistoryPanel.tsx:61` `text-[11px]`（时间戳）→ `text-xs`(12px)
  - `HistoryPanel.tsx:62` `text-[10px]`（类型 Badge）→ `text-xs`(12px)
  - `HistoryPanel.tsx:66` `text-[10px]`（需核实数 Badge）→ `text-xs`(12px)
  - `HistoryPanel.tsx:85` `text-[11px]`（隐私提示）→ `text-xs`(12px)
- **依据**：同 P1-B（base.css A-11：12px 地板）。

#### P1-C（续） 历史条目正文 `text-xs`
- **位置**：`HistoryPanel.tsx:57` `<p className="text-xs font-medium truncate">`（历史输入内容摘要）
- **说明**：这是历史记录正文预览，属正文性质。
- **修正建议**：`text-xs` → `text-sm`(14px)。

---

### 6. TemplatePicker.tsx

#### P1-B（续） + P1-D
- **位置与修正**：
  - `TemplatePicker.tsx:59` `<Badge ... className="mr-1 text-[10px]">{tpl.tag}</Badge>` → `text-[10px]` 低于地板，改 `text-xs`(12px)。
  - `:58` 模板按钮 `size="sm"`（32px 高）承载可点击模板卡，触摸目标 < 44px。建议模板按钮也提至 `min-h-[44px]`（或保持 sm 但确保包裹间距；理想 44px）。
- **其余**：`:39` 标题 `text-xs font-medium` 属 overline 标签档，合规；`:50/:53` 空态/错误提示 `text-xs` 属注释档，合规。

---

### 7. ParseWarnings.tsx

#### P1-C（续） 告警正文 `text-xs`
- **位置**：`ParseWarnings.tsx:18` `<ul className="... text-xs text-muted-foreground">`（解析告警明细）
- **说明**：解析告警（未闭合括号/嵌套截断）是用户需读并据以修正输入的正文信息，12px + muted 偏弱。
- **修正建议**：`text-xs` → `text-sm`(14px)；标题行 `:15` `text-xs font-semibold` 可保留（作为 overline 标题）或升 `text-sm`。

#### ✅ 合规点
- 配色 `border-warning-200 bg-warning-50 dark:bg-warning-900/10 text-warning-700 dark:text-warning-300` 正确使用 warning 语义族，符合 Status Badges/语义色规范。

---

### 8. labelCheckMeta.ts

#### ✅ 合规（含一处需注意）
- `LEVEL_META`/`MATCH_META` 图标全部来自 Lucide（Info/AlertTriangle/ShieldAlert/CircleCheck），✅ 无 emoji。
- `textClass` 用 `text-info-500`/`text-warning-500`/`text-danger-500`，语义色族使用正确。
- **P2-7 注意**：`info: textClass 'text-info-500'`。`info` 族在 `base.css:134` `--color-info: var(--color-info-500)`，而 500 档为 `#3b82f6`，在白色卡片底上对比度约 **3.68:1 < 4.5:1**，若该 textClass 用于正文级小图标/文字在白底上偏弱。用于图标(≥3:1 UI 组件)尚可，用于正文文字需提档到 `text-info-700`。当前仅用于 4px 图标着色（`IngredientList:46`），属 UI 组件 3:1 档，**勉强达标**，建议观察，必要时统一提到 `-600/-700`。

---

## 三、按优先级排序的修正清单（供实施者直接照做）

### 🔴 必须修（阻断上线）

| # | 文件:行 | 问题 | 改为 |
|---|---------|------|------|
| 1 | LabelCheckPage.tsx:134 | 横幅 `from-primary-surface to-accent-surface` 把 Bio Purple 用于非 AI 功能 | 改单一绿实底 `bg-[var(--color-primary-surface)]`，或绿系渐变 `from-[var(--color-primary-surface)] to-[var(--color-primary-hover)]` |
| 2 | LabelCheckPage.tsx:141 | 副标题 `text-white/80` 压渐变绿端仅约 3.7:1 <4.5:1 | 改 `text-white`（或 `text-white/95`），层级靠 `text-sm` 体现 |
| 3 | FilterBar.tsx:43,51,64,74 | 过滤 chip `hover:bg-accent` = Bio Purple，AI 色用于普通筛选 | 改 `hover:bg-neutral-subtle dark:hover:bg-neutral-800`（中性 hover） |

### P1 强烈建议修

| # | 文件:行 | 问题 | 改为 |
|---|---------|------|------|
| 4 | FilterBar.tsx:41-78（全部 chip） | 触摸目标仅约 24px <44px | `text-sm rounded-full px-3.5 min-h-[44px] inline-flex items-center`（至少 `px-3 py-2 min-h-[36px]`） |
| 5 | HistoryPanel.tsx:73,76 | `size="icon"` 仅 36px <44px | 加 `className="h-11 w-11"` |
| 6 | RiskBoard.tsx:42,91,100,156；HistoryPanel.tsx:61,62,66,85；TemplatePicker.tsx:59 | 硬编码 `text-[10px]/[11px]` 低于 12px 地板 + 违反字号令牌化 | 全部改 `text-xs`(12px) |
| 7 | IngredientList.tsx:16,87,95,112,120,128；HistoryPanel.tsx:57；ParseWarnings.tsx:18 | 明细/告警/历史正文滥用 `text-xs`(12px) 当正文 | 正文性质改 `text-sm`(14px)；纯注释/时间戳保留 `text-xs` |

### P2 择机优化

| # | 文件:行 | 问题 | 改为 |
|---|---------|------|------|
| 8 | LabelCheckPage.tsx:134 | 横幅 `shadow-md` 偏重 | `shadow-sm`（hairline+微阴影） |
| 9 | RiskBoard.tsx:37,41 | 中性"提示分"用 primary 绿，易误读为成功/安全 | 弧 `stroke-secondary`、分数 `text-secondary-700 dark:text-secondary-300` |
| 10 | LabelCheckPage.tsx:164 | `min-h-[120px]` 任意值 | 移除（已有 `rows={5}`）或封装令牌类 |
| 11 | IngredientList.tsx:53,61,64 | Badge 内图标 `w-3 h-3`(12px) 偏小 | `w-3.5 h-3.5`(14px) |
| 12 | labelCheckMeta.ts:13 | `text-info-500`(#3b82f6) 白底 3.68:1，仅够 UI 3:1 | 若用于正文提至 `text-info-700`；当前仅着色图标可暂留 |

---

## 四、合规确认项（无需修改）

- **图标**：8 个文件全部使用 Lucide React，✅ 无 emoji 作 UI 图标（DESIGN Don'ts L760）。
- **暗色 canvas**：被审计文件无 `#000`/`black` 硬编码，暗色底走令牌（`bg-warning-900/10`、`dark:bg-neutral-*` 等），✅ 符合 slate-950 规范（Don'ts L761）。
- **三色体系纯净度**：未引入第四品牌色（仅 primary/secondary/accent + 语义 success/warning/error/info），✅。
- **免责声明红线**：LabelCheckPage `:272-290` 无论有无结果始终渲染免责声明，✅ 符合合规红线。
- **字段兜底**：RiskBoard/IngredientList 大量 `??` 兜底可选字段，✅ 抗字段漂移。
- **圆角**：卡片 `rounded-xl`(16px)、明细行 `rounded-xl`、chip `rounded-full`，均落在规范区间（Shapes L664-673），✅。

---

## 五、核心根因小结

1. **三色语义意识缺失**（🔴1、🔴3）：把 accent(Bio Purple) 当作"通用强调/装饰色"用于横幅渐变和 hover，而非严格限定 AI 功能。这是全页最需纠正的认知——**配料表核查是数据比对功能，全页不应出现 Bio Purple**。
2. **触摸目标普遍被忽视**（P1-4、P1-5）：chip 与 icon 按钮按视觉密度设计，未按 44×44px 下限兜底。
3. **字号档位混乱**（P1-6、P1-7）：出现 `text-[10px]/[11px]` 任意值（低于 12px 地板），且正文/明细大量误用 12px caption 档。建议统一心智模型：**正文 15px / 辅助说明 14px / 注释时间戳 12px / 标签徽章 12px(overline 已抬级)**。

> 本报告仅审计 UI/UX 合规性，未改动任何代码；风险措辞、合规红线等业务语义未作评判，相关内容见页面内固定免责声明。
