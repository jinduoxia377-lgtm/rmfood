---
version: 1.0
name: RMFOOD-design-system
description: RMFOOD配方平台设计系统 — 基于 Supabase 极简翠绿 + Notion 温暖极简风格，专为中药配方研发与数据管理平台打造。深翠绿主色传达自然与信任，海洋蓝辅助色体现科学与精确，生物紫点缀 AI 与创新。CJK 优化的字体系统确保中英文混合排版品质。
---

## Overview

RMFOOD 配方平台的设计语言追求**专业、清晰、可信赖**。作为一款中药配方研发与数据管理工具，界面需要在科学严谨性与传统中医药文化之间取得平衡。

**核心设计原则：**
- **翠绿即品牌**：深翠绿主色（`{colors.primary}`）是界面上唯一的色彩事件 — 用于主 CTA 按钮、选中态、品牌标识
- **白色画布**：大面积留白让数据说话，无装饰性渐变背景
- **近黑文字**：`{colors.ink}` 近黑而非纯黑，减轻视觉疲劳
- **CJK 优先**：字体系统针对中英文混排优化，确保汉字清晰可读
- **数据驱动**：表格、图表、统计卡片是核心 UI 元素，需保持高信息密度下的可读性

## Colors

### Brand Colors

| Token | Hex | Role |
|-------|-----|------|
| `{colors.primary}` | `#059669` | 主品牌色 — 按钮、选中态、品牌标识 |
| `{colors.primary-deep}` | `#047857` | 主色深色 — 按压态 |
| `{colors.primary-soft}` | `#34D399` | 主色浅色 — 图表、标签 |
| `{colors.primary-bg}` | `#ECFDF5` | 主色背景 — 选中行、hover 态 |
| `{colors.secondary}` | `#2563EB` | 辅助色 — 链接、信息、次要按钮 |
| `{colors.secondary-deep}` | `#1D4ED8` | 辅助色深色 — 按压态 |
| `{colors.accent}` | `#7C3AED` | 点缀色 — AI 功能、创新标识 |
| `{colors.accent-soft}` | `#EDE9FE` | 点缀色背景 |

### Surface Colors

| Token | Hex | Role |
|-------|-----|------|
| `{colors.canvas}` | `#F8FAFC` | 页面背景 |
| `{colors.surface}` | `#FFFFFF` | 卡片、容器背景 |
| `{colors.surface-raised}` | `#FFFFFF` | 浮层（Modal、Dropdown） |
| `{colors.surface-hover}` | `#F1F5F9` | 悬停态表面 |

### Ink (Text) Colors

| Token | Hex | Role |
|-------|-----|------|
| `{colors.ink}` | `#0F172A` | 主文字 — 标题、正文 |
| `{colors.ink-secondary}` | `#334155` | 次要文字 — 辅助说明 |
| `{colors.ink-muted}` | `#64748B` | 弱化文字 — 占位符、禁用态 |
| `{colors.ink-faint}` | `#94A3B8` | 极弱文字 — 水印、装饰 |
| `{colors.on-primary}` | `#FFFFFF` | 主色上的文字 |

### Border Colors

| Token | Hex | Role |
|-------|-----|------|
| `{colors.hairline}` | `#E2E8F0` | 默认边框 |
| `{colors.hairline-strong}` | `#CBD5E1` | 强调边框 — 输入框焦点 |

### Semantic Colors

| Token | Hex | Role |
|-------|-----|------|
| `{colors.success}` | `#16A34A` | 成功 — 审核通过、保存成功 |
| `{colors.warning}` | `#D97706` | 警告 — 待审核、库存不足 |
| `{colors.danger}` | `#DC2626` | 危险 — 删除、驳回 |
| `{colors.info}` | `#0891B2` | 信息 — 提示、帮助 |

### Formula Status Colors

| Token | Hex | Status |
|-------|-----|--------|
| `{colors.status-draft}` | `#94A3B8` | 草稿 |
| `{colors.status-pending}` | `#F59E0B` | 待审核 |
| `{colors.status-approved}` | `#059669` | 已通过 |
| `{colors.status-rejected}` | `#EF4444` | 已驳回 |
| `{colors.status-revision}` | `#F97316` | 修订中 |

### Dark Mode Adjustments

暗色模式下，主色向亮色偏移以保证可读性：
- `primary`: `#34D399`（而非 `#059669`）
- `ink`: `#F1F5F9`（近白而非近黑）
- `surface`: `#1E293B`（深灰蓝）
- `canvas`: `#0F172A`（深蓝黑）

## Typography

### Font Family

- **UI / 正文**：`'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', system-ui, -apple-system, sans-serif`
- **等宽 / 代码**：`'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace`
- **衬线 / 装饰**：`'Noto Serif SC', 'Source Han Serif SC', 'SimSun', serif`

### CJK-Optimized Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|-------|------|--------|-------------|----------------|-----|
| `{typography.display}` | 32px | 700 | 1.2 | -0.02em | 大屏统计数字 |
| `{typography.h1}` | 22px | 700 | 1.25 | -0.015em | 页面标题 |
| `{typography.h2}` | 18px | 600 | 1.3 | -0.01em | 区块标题 |
| `{typography.h3}` | 16px | 600 | 1.35 | -0.01em | 卡片标题 |
| `{typography.h4}` | 15px | 600 | 1.4 | 0 | 小节标题 |
| `{typography.body-lg}` | 16px | 400 | 1.7 | 0 | 大正文（移动端基准） |
| `{typography.body}` | 15px | 400 | 1.6 | 0 | 标准正文 |
| `{typography.body-sm}` | 14px | 400 | 1.5 | 0 | 紧凑正文 |
| `{typography.caption}` | 12px | 400 | 1.5 | 0.01em | 辅助说明 |
| `{typography.overline}` | 11px | 500 | 1.45 | 0.05em | 标签、表头（大写） |
| `{typography.button-md}` | 14px | 500 | 1.0 | 0 | 按钮文字 |
| `{typography.button-sm}` | 12px | 500 | 1.0 | 0 | 小按钮文字 |
| `{typography.code}` | 14px | 400 | 1.5 | 0 | 代码块 |

### CJK Typography Rules

- 中文正文行高 ≥ 1.6（确保汉字不拥挤）
- 标题字重 600-700（CJK 字体需要更重的字重来区分层级）
- 最小正文字号 14px（CJK 字符 12px 以下可读性差）
- 中英文混排时，英文单词前后加空格

## Spacing

基于 8px 基础单位：

| Token | Value | Use |
|-------|-------|-----|
| `{spacing.xs}` | 4px | 极小间距 — 图标与文字 |
| `{spacing.sm}` | 8px | 小间距 — 标签内边距 |
| `{spacing.md}` | 16px | 中等间距 — 卡片内边距 |
| `{spacing.lg}` | 24px | 大间距 — 区块间距 |
| `{spacing.xl}` | 32px | 超大间距 — 页面内边距 |
| `{spacing.2xl}` | 48px | 特大间距 — 章节间距 |
| `{spacing.3xl}` | 64px | 巨无霸间距 — Hero 区域 |

## Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `{rounded.sm}` | 4px | 标签、徽章 |
| `{rounded.md}` | 8px | 按钮、输入框、表格 |
| `{rounded.lg}` | 12px | 卡片、Modal |
| `{rounded.xl}` | 16px | 大容器 |
| `{rounded.full}` | 9999px | 药丸标签、头像 |

## Elevation

| Level | Value | Use |
|-------|-------|-----|
| 0 | `none` | 平面元素 |
| 1 | `0 1px 2px rgba(0,0,0,0.05)` | 卡片默认 |
| 2 | `0 4px 6px rgba(0,0,0,0.07)` | 卡片悬停、下拉菜单 |
| 3 | `0 10px 15px rgba(0,0,0,0.1)` | Modal 遮罩层 |
| 4 | `0 20px 25px rgba(0,0,0,0.1)` | Dialog |

## Components

### Buttons

**`button-primary`** — 主 CTA 按钮
- 背景 `{colors.primary}`，文字 `{colors.on-primary}`（白色），字号 `{typography.button-md}`
- 内边距 `10px 20px`（高度 40px），圆角 `{rounded.md}`
- 悬停：背景 `{colors.primary-deep}`，上移 1px，阴影 `{elevation.2}`
- 按压：scale(0.98)
- 禁用：opacity 0.45，cursor not-allowed
- 加载：Loader2 旋转图标 + `aria-busy="true"`

**`button-secondary`** — 次要按钮
- 透明背景，文字 `{colors.secondary}`，边框 `1.5px solid {colors.secondary}`
- 悬停：`{colors.secondary}` 5% 透明度背景

**`button-ghost`** — 幽灵按钮
- 透明背景，文字 `{colors.ink-secondary}`，边框 `1px solid {colors.hairline}`
- 悬停：`{colors.surface-hover}` 背景

**`button-danger`** — 危险操作按钮
- 背景 `{colors.danger}`，文字白色
- 悬停：深红色 `#B91C1C`

**`button-ai`** — AI 功能按钮
- 渐变背景 `{colors.accent}` → `{colors.secondary}`（紫→蓝）
- 文字白色，悬停上移 1px

### Cards

**`card-default`** — 标准卡片
- 背景 `{colors.surface}`，圆角 `{rounded.lg}`，边框 `1px solid {colors.hairline}`
- 阴影 `{elevation.1}`，内边距 `{spacing.lg}`（24px）
- 悬停：阴影 `{elevation.2}`，边框色微变

**`card-glass`** — 毛玻璃卡片
- 背景 `rgba(255,255,255,0.72)`，backdrop-filter blur(16px)
- 圆角 `{rounded.xl}`，内边距 `{spacing.xl}`

**`card-interactive`** — 可交互卡片
- 同 card-default，添加 cursor-pointer
- 悬停：上移 2px + `{elevation.2}`

### Stat Cards

**`stat-card`** — 统计数字卡片
- 居中布局，内边距 `{spacing.lg}`
- 数值：`{typography.display}` 字号，`{colors.primary}` 颜色，`{font-mono}` 等宽字体
- 标签：`{typography.caption}` 字号，`{colors.ink-muted}` 颜色
- 图标：左上角小图标，`{colors.ink-muted}` 颜色

### Data Tables

**`data-table`** — 数据表格
- 表头：`{colors.primary-bg}` 背景，`{colors.primary}` 文字，字号 `{typography.overline}`（11px），加粗
- 表格行：`{typography.body-sm}` 字号，`{colors.ink-secondary}` 文字
- 行悬停：`{colors.primary-bg}` 背景
- 边框：底部 `1px solid {colors.hairline}`
- 斑马纹：可选，偶数行 `{colors.canvas}` 背景

### Inputs

**`input-default`** — 标准输入框
- 高度 38px，内边距 `0 14px`，圆角 `{rounded.md}`
- 边框 `1.5px solid {colors.hairline}`，背景 `{colors.surface}`
- 焦点：边框 `{colors.primary}`，外发光 `0 0 0 3px rgba(5,150,105,0.1)`
- 错误：边框 `{colors.danger}`，下方红色提示文字

### Tabs

**`tabs-list`** — 标签页容器
- 水平排列，间距 3px，内边距 4px
- 背景 `{colors.surface}`，圆角 `{rounded.md}`，边框 `1px solid {colors.hairline}`

**`tabs-trigger`** — 标签页按钮
- 内边距 `8px 16px`，字号 `{typography.body-sm}`，字重 500
- 默认：`{colors.ink-secondary}` 文字
- 悬停：`{colors.ink}` 文字 + `{colors.surface-hover}` 背景
- 激活：`{colors.primary}` 背景，白色文字，字重 600

### Badges & Tags

**`badge-status`** — 状态徽章
- 圆角 `{rounded.full}`，内边距 `3px 10px`
- 字号 `{typography.overline}`（11px），字重 600
- 每种状态有独立配色（草稿灰/待审核黄/通过绿/驳回红/修订橙）

**`tag`** — 分类标签
- 圆角 `{rounded.full}`，内边距 `2px 9px`
- 字号 10.5px，字重 600
- 7 种颜色变体（绿/蓝/紫/琥珀/红/青/灰）

## Layout Principles

### Page Layout
- **侧边栏**：264px 展开 / 72px 折叠
- **顶栏**：64px 高度
- **内容区**：最大宽度 1280px，水平居中
- **页面内边距**：`{spacing.xl}`（32px）桌面端，`{spacing.md}`（16px）移动端

### Grid System
- 12 列网格，列间距 `{spacing.lg}`（24px）
- 统计卡片：4 列（桌面）/ 2 列（平板）/ 1 列（移动）
- 列表 + 详情：8:4 或 9:3 分割

### Whitespace
- 区块间距：`{spacing.2xl}`（48px）
- 卡片间距：`{spacing.lg}`（24px）
- 表单元素间距：`{spacing.md}`（16px）
- 段落间距：`{spacing.md}`（16px）

## Do's and Don'ts

### Do
- ✅ 使用 `{colors.primary}` 翠绿仅用于主 CTA、选中态、品牌元素 — 做减法
- ✅ 数据表格使用 11px 表头 + 14px 行高，保持信息密度
- ✅ 中英文混排时英文前后加空格
- ✅ 按钮最小高度 32px（移动端），触摸目标 ≥ 40px
- ✅ 使用 `{typography.caption}` 作为辅助文字，`{typography.overline}` 作为标签
- ✅ 暗色模式使用偏亮的主色（`#34D399` vs `#059669`）
- ✅ 按钮使用药丸形状（`border-radius: 9999px`）
- ✅ 标题使用 600 (semibold) 字重，非 700 (bold)
- ✅ 正文基准字号 17px（Apple editorial reading pace）
- ✅ 卡片和按钮无装饰性阴影，层级通过边框和背景对比建立

### Don't
- ❌ 不要新增非系统颜色 — 图表中的紫/黄/粉仅用于数据可视化
- ❌ 不要使用纯黑文字（`#000`）— 始终使用 `{colors.ink}` 近黑
- ❌ 不要在白色背景上使用浅色文字 — 对比度需 ≥ 4.5:1
- ❌ 不要使用装饰性渐变背景 — 白色画布是设计本身
- ❌ 不要使用装饰性阴影 — 卡片/按钮无阴影, 层级通过边框和背景对比建立
- ❌ 不要使用装饰性背景环境光 (body::before/after radial gradients)
- ❌ 不要使用 12px 以下的中文字号 — CJK 字符可读性要求
- ❌ 不要使用 700 字重作为标题 — 标题使用 600 (semibold)

## Responsive Behavior

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Desktop | ≥ 1024px | 侧边栏 + 内容区，最大 1280px |
| Tablet | 768–1023px | 折叠侧边栏（图标模式），卡片 2 列 |
| Mobile | < 768px | 隐藏侧边栏（汉堡菜单），卡片 1 列 |

### Mobile Adaptations
- 按钮高度缩减（32px → 28px 移动端）
- 表格横向滚动
- 标题字号缩减（22px → 20px → 18px）
- 统计卡片全宽单列

## Motion

| Token | Duration | Easing | Use |
|-------|----------|--------|-----|
| `{motion.fast}` | 150ms | ease-out | 微交互（hover 颜色变化） |
| `{motion.normal}` | 200ms | ease-in-out | 标准过渡（展开/折叠） |
| `{motion.slow}` | 300ms | ease-out | 页面进入动画 |
| `{motion.modal}` | 400ms | cubic-bezier(0.16,1,0.3,1) | Modal 弹入 |

- `prefers-reduced-motion` 时所有动画时长归零
- 使用 `transform` 和 `opacity` 做动画（GPU 加速）

## Agent Prompt Guide

### Quick Start
复制此 DESIGN.md 到项目根目录，然后在与 AI 编程助手对话时使用以下提示词：

```
请参考 DESIGN.md 中的设计系统，帮我在 RMFOOD 配方平台中构建[组件名/页面名]。
使用 DESIGN.md 中定义的颜色 token、字体 token 和组件规格。
```

### Color Quick Reference
- 主按钮：`bg-[#059669] text-white hover:bg-[#047857] rounded-full`
- 次要按钮：`border-[#2563EB] text-[#2563EB] rounded-full`
- 卡片：`bg-white border border-[#E2E8F0]`（无阴影）
- 标题：`text-[#0F172A] font-semibold`（600 非 700）
- 正文：`text-[#334155] text-[17px]`
- 辅助：`text-[#64748B]`
- 成功：`text-[#16A34A]`
- 警告：`text-[#D97706]`
- 危险：`text-[#DC2626]`

### Typography Quick Reference
- 页面标题：`text-[22px] font-bold leading-[1.25]`
- 区块标题：`text-[18px] font-semibold leading-[1.3]`
- 卡片标题：`text-[16px] font-semibold leading-[1.35]`
- 正文：`text-[15px] leading-[1.6]`
- 辅助文字：`text-[12px] text-[#64748B]`
- 标签/表头：`text-[11px] font-medium uppercase tracking-wider`