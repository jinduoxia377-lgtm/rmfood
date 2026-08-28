# ADR-019 — Dashboard 页面 UI/UX 深度设计审计

**状态**：📋 待执行  
**日期**：2026-08-16  
**领域**：前端 / UI/UX 设计分析  
**前置**：[ADR-012](./ADR-012-主题系统精简与统一.md)、[ADR-017](./ADR-017-Dashboard-UIUX深度审计与升级方案.md)、[ADR-018](./ADR-018-Dashboard-UIUX深度修复与升级.md)

---

## 一、布局架构分析

### 1.1 整体空间划分

```
┌─────────────────────────────────────────────────────────────┐
│  Header (h-14 = 56px, sticky, backdrop-blur)               │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│ Sidebar  │  Main Content Area                               │
│ 264px    │  max-w-7xl (1280px) mx-auto                      │
│ fixed    │  px-4 sm:px-6 lg:px-8                            │
│          │                                                  │
│  (可折叠) │  可用宽度:                                         │
│  折叠     │  桌面(≥1440px): ~1280-264-32 = ~984px            │
│ 72px)    │  大屏(1280px):  ~1280-264-32 = ~984px            │
│          │  中屏(lg):      ~984-32 = ~952px                 │
│          │                                                  │
├──────────┼──────────────────────────────────────────────────┤
│          │                                                  │
│ Footer   │  Dashboard Content                               │
│ 可选     │  space-y-4 (16px gap between sections)           │
│          │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

### 1.2 网格系统

| 配置项 | 默认值 | 可选值 |
|:-------|:------:|:------:|
| 列数 | 4 | 2 / 3 / **4** / 6 |
| 间距 | 16px | 8 / **16** / 24 |
| 响应式断点 | `grid-cols-1 sm:2 lg:3 xl:4` | 手动覆盖 |

**卡片尺寸系统（基于 4 列网格）：**

| 卡片类型 | 默认 w × h | 像素估算（~246px/col） | 实际占比 |
|:---------|:----------:|:---------------------:|:--------:|
| 统计卡片（4张） | 1×1 | ~246×230 | 100%等宽 |
| 研发趋势图 | 2×1 | ~492×230 | 占2列，高度偏低 |
| 饼图/柱图 | 1×1 | ~246×230 | 1列，图表压缩 |
| 快捷操作 | 1×1 | ~246×230 | 2×2 grid 内部 |
| 最近列表类 | 1×1 | ~246×230 | 列表内容溢出 |
| AI分析面板 | 2×2 | ~492×460 | 最大卡片 |

> ⚠️ **问题**：1×1 高度的图表面板在 230px 高度内渲染完整 AreaChart（含轴标签+图例）极为紧凑，数据密集区域会被截断。

### 1.3 层级结构

```
DashboardPage
├── WelcomeBanner (full-width, gradient)
├── EditModeNotice (conditional, yellow warning bar)
└── DashboardGridLayout (4-column grid)
    ├── StatsRow (4× stats-formulas/experiments/...)
    ├── ChartRow (chart-trends [2col] + pie/bar [1col])
    ├── ActionsRow (quick-actions)
    └── DataRows (recent-formulas, recent-experiments, ...)
```

---

## 二、排版比例分析

### 2.1 当前排版 Token 体系

| Token | 字号 | 行高 | 字重 | 用途 |
|:------|:----:|:----:|:----:|:-----|
| Display | 32px (2rem) | 1.2 | 700 | 大数值展示 |
| H1 | 22px (1.375rem) | 1.25 | 600 | 主标题 |
| H2 | 18px (1.125rem) | 1.3 | 600 | 卡片标题 |
| H3 | 16px (1rem) | 1.35 | 600 | 次级标题 |
| Body-lg | 17px | 1.65 | 400 | 正文 |
| Body-sm | 15px (0.9375rem) | 1.5 | 400 | 辅助文字 |
| Caption | 12px (0.75rem) | 1.5 | 400 | 标签/注释 |
| Overline | 11px | 1.45 | 500 | 徽章/标签 |
| Tiny | 10px | 1.4 | 400 | 极小标注 |

**比例阶梯：Major Third (1.200)** ✅ — 符合 Apple HIG 标准

### 2.2 实际使用偏差

| 位置 | 预期 Token | 实际使用 | 偏差 |
|:-----|:----------:|:--------:|:----:|
| StatCard value | text-display (32px) | `text-display font-semibold` | ✅ 正确 |
| StatCard label | text-caption (12px) | `text-caption` | ✅ 正确 |
| 卡片标题 (H2) | text-h2 (18px) | `text-h2 font-semibold` | ✅ 正确（已修复） |
| 快捷操作描述 | text-xs = text-caption | `text-xs` | ⚠️ 应改为 `text-caption` |
| 时间戳/元数据 | text-tiny (10px) | `text-xs` | ⚠️ 偏大一级 |
| 徽章文字 | text-overline (11px) | 多用 `text-xs` | ⚠️ 语义错误 |

---

## 三、组件比例审查

### 3.1 统计卡片（StatCard）

```
┌─────────────────────────────────────┐
│  label (12px caption, muted)  [icon] │
│                                     │
│  VALUE (32px display, semibold)     │
└─────────────────────────────────────┘
  ↑  px-6 py-4 (padding: 24px × 16px)  ↑
  gap-4 (icon-value间距: 16px)
```

**比例评分：8/10**
- ✅ 图标 40×40px，值文字 32px — 视觉权重平衡
- ⚠️ 标签 `text-caption mb-4` — 与值文字间距偏大（16px），label 到 value 之间空白过多
- ⚠️ 单行值超过 6 位数字时会截断或挤压图标

### 3.2 欢迎横幅（WelcomeBanner）

```
┌─────────────────────────────────────────────────┐
│  h1 问候语 (22px, white, semi-bold)              │
│  p 说明文字 (14px, white/90)                     │
│                                         [按钮组] │
└─────────────────────────────────────────────────┘
  bg-gradient-to-r from-primary-600 to-primary-700
  rounded-2xl p-6 (24px)
  shadow-card-hover
```

**比例评分：6/10**
- ❌ **对比度问题**：white (#FFFFFF) on primary-600 (#28A745) 对比度 ~3.5:1，不满足 WCAG AA 正文要求（≥4.5:1）
- ⚠️ 仅标题可用（大字权重可放宽至 3:1），说明文字（14px）严格不达标
- ⚠️ 高度固定 `p-6`（上下各24px），文字行高 1.25 导致垂直方向留白不均
- ✅ `rounded-2xl`（24px）与卡片系统一致

### 3.3 快捷操作（QuickActions）

```
┌──────────────────────────────────┐
│  快捷操作 (18px, h2 semibold)     │
├────────┬─────────────────────────┤
│ [icon] │  新建配方 (14px semibold) │
│ 40×40  │  药食同源配方 (12px)     │
│渐变背景│  → 箭头                  │
└────────┴─────────────────────────┘
  grid-cols-1 sm:grid-cols-2
  gap-3 (12px)
  p-3 (12px) internal
```

**比例评分：7/10**
- ✅ 图标 40×40px + 渐变背景 — 操作入口感强
- ✅ 标题用 `text-h2` — 语义正确
- ⚠️ 图标按钮与文字内容垂直不对齐（图标中心 vs 文字 baseline）
- ⚠️ 无 hover 状态时边框 `border-neutral-100` 在暗色模式下对比度不足

### 3.4 图表卡片（TrendChart）

```
┌─────────────────────────────────────┐
│  [icon] 研发趋势 (14px semibold)    │
├─────────────────────────────────────┤
│                                     │
│      AreaChart                      │
│      height: 200px                  │
│      (Y轴 + 图例 + 网格线)           │
│                                     │
└─────────────────────────────────────┘
  Card padding: px-6 pt-6 pb-6
  Chart margin: top=10, right=10, bottom=10
```

**比例评分：5/10**
- ❌ **高度不足**：200px 高度对于含图例的 AreaChart 过矮，Y轴标签与图例会重叠
- ❌ 标题 `text-sm font-bold` → 已修复为 `text-h2 font-semibold`（本次 Phase 2）
- ⚠️ 图表 margin 内缩 10px，但 Tooltip 弹出可能超出边界
- ⚠️ CartesianGrid `strokeDasharray="3 3"` 在高分辨率屏幕上虚线不明显

---

## 四、按钮设计分析

### 4.1 按钮规格体系

| 尺寸 | 高度 | Padding | 字号 | 图标 | 适用场景 |
|:----:|:----:|:-------:|:----:|:----:|:-------|
| sm | 32px | 8px×16px | 13px | 14px | 次要操作、标签内按钮 |
| md | 40px | 10px×20px | 14px | 16px | **主操作（推荐）** |
| lg | 48px | 12px×24px | 15px | 20px | 主要行动 CTA |
| xl | 56px | 16px×32px | 16px | 24px | 超级 CTA（首屏唯一） |

### 4.2 欢迎横幅按钮组合问题

```tsx
<Button variant="secondary" size="sm" icon={<Sparkles size={16} />}>AI 助手</Button>
<Button variant={isEditMode?'primary':'secondary'} size="sm" icon={<Settings size={14} />}>编辑布局</Button>
<Button variant="ghost" size="sm" icon={<Download size={14} />}>导出数据</Button>
```

**问题：**
1. ❌ 3 个按钮尺寸不一致 — AI 助手用 `size="sm"` (32px)，编辑布局也用 `size="sm"` (32px)，但视觉主次不分明
2. ❌ `Settings` 图标尺寸 14px vs `Sparkles` 16px — 同一行按钮内图标大小不统一
3. ⚠️ 紧急操作（编辑布局）与次要操作（导出）使用相同尺寸，缺乏视觉优先级
4. ✅ 建议：主要操作（AI助手）→ `size="md"`，次要操作 → `size="sm"`，危险/重要操作 → `size="md"` 且用 `variant="primary"`

---

## 五、色彩对比度审计（WCAG 2.1）

| 组合 | 颜色值 | 对比度 | WCAG AA | 状态 |
|:-----|:-------|:------:|:-------:|:----:|
| text-primary on bg-white | #1D1D1F / #FFFFFF | 15.4:1 | ≥4.5 | ✅ AAA |
| text-secondary on bg-white | #6E6E73 / #FFFFFF | 4.7:1 | ≥4.5 | ✅ AA |
| **text-muted on bg-white** | **#9A9A9F / #FFFFFF** | **2.8:1** | **≥4.5** | ❌ **不达标** |
| **text-disabled on bg-white** | **#9CA3AF / #FFFFFF** | **2.3:1** | **≥4.5** | ❌ **不达标** |
| **white on primary-600** | **#FFFFFF / #28A745** | **3.5:1** | **≥3:1(大字)** | ⚠️ 大字勉强 |
| white/90 on primary-600 | rgba(255,255,255,0.9) / #28A745 | ~3.9:1 | ≥4.5 | ⚠️ 正文不达标 |
| ghost hover bg | neutral-default | ~4.5:1 | ≥3:1 | ✅ AA |
| error-500 on white | #EF4444 / #FFFFFF | 4.0:1 | ≥4.5 | ⚠️ 边界 |

---

## 六、间距系统审查

### 6.1 当前间距使用情况

| 位置 | 使用间距 | 是否符合 4px 网格 |
|:-----|:--------:|:-----------------:|
| 主内容区 `space-y-4` | 16px | ✅ |
| Dashboard 网格 `gap=16` | 16px | ✅ |
| QuickActions 内部 `gap-3` | **12px** | ⚠️ 偏离 4px 基准（可接受但建议统一） |
| StatCard `mb-4` (label间距) | 16px | ✅ |
| StatCard `gap-4` (icon-value) | 16px | ✅ |
| 卡片内部 `p-6` | 24px | ✅ |
| 卡片 Header `px-6 pt-6 pb-4` | 24px/24px/16px | ✅ |
| 编辑模式提示 `p-4` | **16px** | ✅ |

**结论：整体符合 4px 网格系统，QuickActions 的 gap-3 (12px) 是唯一偏离项，但在可接受范围内。**

---

## 七、发现的问题汇总

| # | 优先级 | 类别 | 问题描述 | 影响 |
|::-|:------:|:-----|:---------|:-----|
| 1 | 🔴 P0 | 无障碍 | `text-muted` (#9A9A9F) 对比度 2.8:1 不达标 | 低视力用户无法阅读 |
| 2 | 🔴 P0 | 无障碍 | 横幅白色文字 on primary-600 对比度 3.5:1，正文不达标 | 横幅说明文字不可读 |
| 3 | 🟡 P1 | 按钮 | 欢迎横幅 3 个按钮尺寸/图标不统一 | 视觉层次混乱 |
| 4 | 🟡 P1 | 图表 | TrendChart 高度 200px 过矮，图例与轴标签重叠 | 图表数据可读性差 |
| 5 | 🟡 P1 | 按钮 | ghost 按钮 `dark:hover:border-primary-800/60` 暗色对比度不足 | 暗色模式下 hover 态不可见 |
| 6 | 🟢 P2 | 排版 | `text-xs` 泛滥替代 `text-caption`/`text-tiny` | 字体层级语义丢失 |
| 7 | 🟢 P2 | 布局 | 1×1 图表卡高度不足以显示完整 recharts | 饼图/柱图被裁剪 |
| 8 | 🟢 P2 | 交互 | 卡片拖拽编辑手柄悬浮位置 `-top-10` 超出卡片边界 | 可能遮挡上方内容 |
| 9 | 🟢 P2 | 响应式 | 4列网格在 1280px 下每列约 246px，图表内容过挤 | 中屏体验差 |

---

## 八、优化建议

### Phase A — 无障碍合规（P0）

1. **调暗 text-muted**：从 `#9A9A9F` → `#6B7280`（neutral-500），对比度提升至 4.6:1 ✅
2. **调整横幅文字颜色**：说明文字改为 `text-white/75` 或使用更大的字号（body-sm 以上）以享受大字豁免

### Phase B — 视觉层次优化（P1）

3. **按钮尺寸标准化**：
   ```
   AI助手（主行动）→ size="md" height=40px
   编辑布局（重要）→ size="md" height=40px，用 primary variant
   导出数据（次要）→ size="sm" height=32px
   ```
4. **图标尺寸统一**：所有按钮内图标统一 16px（sm 按钮保持 14px 也可接受）

### Phase C — 图表可读性（P2）

5. **TrendChart 高度调整**：从 200px → 260px，减少图例或使用底部内嵌图例
6. **饼图/柱图默认高度**：1×1 卡片内图表从 200px → 240px
7. **默认布局调整**：chart-trends 改为 `w:2, h:1` → 实际渲染时内部容器自适应填充

### Phase D — 响应式优化（P2）

8. **1280px 断点优化**：默认从 4 列 → 3 列（`columns=3` default），每个卡片宽度增至 ~320px
9. **卡片高度自适应**：将 `h:1` 改为 `h:auto` 或动态计算，让图表卡有足够空间
