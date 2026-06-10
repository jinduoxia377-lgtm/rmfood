# Structured Content Block Renderer — AI智能对话结构化内容渲染引擎

**版本:** v1.0  
**日期:** 2026-06-06  
**状态:** 待实施  
**优先级:** P0 — 核心体验升级

---

## 1. 概述

为 AI 智能对话模块引入**结构化内容块渲染引擎**，使 AI 回复从纯 Markdown 文本升级为专业级结构化信息展示，包含数据表格、可视化图表、分析列表、KPI 指标卡、摘要提示框等丰富的区块组件。

### 目标
- AI 回复以结构化 JSON 格式输出，前端按区块类型差异化渲染
- 每个区块组件具备专业级排版、交互和视觉设计
- 100% 向后兼容现有纯文本/ Markdown 回复
- 复用现有的 `EnhancedDataTable`、`ScoreCards`、`RadarChart`、`FormulaCard` 等资产

### 非目标
- 不改造后端 API 协议（`ChatMessage.content` 保持 string 类型）
- 不修改 `useChatMessages` 核心逻辑
- 不引入新的第三方依赖

## 2. 架构设计

### 2.1 数据流

```
API 返回 → chatService.sendMessage()
  → { content: "{ \"type\":\"report\", \"blocks\":[...] }" }
  → ChatMessage { id, role, content: string, ... }
  → ChatMessages 渲染循环
    → detectStructuredContent(content) ?
      ├─ true  → StructuredMessageRenderer { blocks }
      └─ false → MarkdownRenderer { content }  (现有逻辑, 不变)
```

### 2.2 智能检测

在 `ChatMessages.tsx` 的 `renderMessageContent()` 中增加检测逻辑：

```typescript
function detectStructuredContent(content: string): StructuredContent | null {
  if (!content || content.length < 10) return null
  const trimmed = content.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && parsed.blocks && Array.isArray(parsed.blocks)) {
      return parsed as StructuredContent
    }
    return null
  } catch {
    return null
  }
}
```

性能保障：仅在 content 以 `{` 开头且长度 > 10 时才尝试解析，零开销于纯文本消息。

### 2.3 组件树

```
ChatMessages
├── MarkdownRenderer (existing)       ← 纯文本/ Markdown
└── StructuredMessageRenderer          ← 结构化 JSON
    ├── HeaderBlock
    ├── DataTableBlock
    │   └── EnhancedDataTable (reuse)
    ├── ChartBlock
    │   ├── RadarChart (reuse)
    │   ├── BarChart (reuse)
    │   └── ScoreCards (reuse)
    ├── ListBlock
    ├── MetricsBlock
    │   └── ScoreCards pattern (reuse)
    ├── CalloutBlock
    │   └── CalloutBlock style (reuse from MarkdownRenderer)
    └── DividerBlock
```

## 3. 类型系统

```typescript
// === 核心类型 ===

export type BlockType =
  | 'header'       // 标题区
  | 'data-table'   // 数据表格
  | 'chart'        // 可视化图表
  | 'list'         // 分析列表
  | 'callout'      // 提示框
  | 'metrics'      // KPI 指标卡
  | 'divider'      // 分隔线

export interface ContentBlock<T = unknown> {
  type: BlockType
  data: T
}

export interface StructuredContent {
  responseType: 'analysis_report' | 'comparison' | 'recommendation' | 'general'
  title?: string
  blocks: ContentBlock[]
}

// === Block 数据合约 ===

export interface HeaderData {
  title: string
  description?: string
  level?: 1 | 2 | 3
  metadata?: Array<{ label: string; value: string }>
}

export interface ColumnDef {
  key: string
  label: string
  type?: 'text' | 'number' | 'percentage' | 'tag'
  align?: 'left' | 'center' | 'right'
  width?: string
}

export interface DataTableData {
  title?: string
  columns: ColumnDef[]
  rows: Array<Record<string, unknown>>
  summary?: string
}

export interface ChartData {
  chartType: 'radar' | 'bar' | 'score-cards'
  title?: string
  data: Record<string, unknown>
}

export interface ListItem {
  label: string
  description?: string
  value?: string
  status?: 'positive' | 'negative' | 'neutral' | 'info'
}

export interface ListData {
  title?: string
  variant: 'bullet' | 'number' | 'analysis' | 'checklist'
  items: ListItem[]
}

export interface CalloutData {
  variant: 'info' | 'success' | 'warning' | 'summary'
  title?: string
  content: string
  details?: string[]
}

export interface MetricItem {
  label: string
  value: string | number
  unit?: string
  trend?: 'up' | 'down' | 'stable'
  color?: string
}

export interface MetricsData {
  title?: string
  items: MetricItem[]
}

export interface DividerData {
  variant?: 'solid' | 'dashed' | 'dotted'
  label?: string
}
```

## 4. 文件结构

```
src/components/ai/features/components/structured/
├── index.ts
├── types.ts
├── utils.ts
├── StructuredMessageRenderer.tsx
├── BlockRegistry.tsx
├── blocks/
│   ├── HeaderBlock.tsx
│   ├── DataTableBlock.tsx
│   ├── ChartBlock.tsx
│   ├── ListBlock.tsx
│   ├── CalloutBlock.tsx
│   ├── MetricsBlock.tsx
│   └── DividerBlock.tsx
└── __tests__/
    └── StructuredMessageRenderer.test.tsx
```

## 5. 组件详细设计

### 5.1 HeaderBlock
- 专业标题排版，支持 `h1`/`h2`/`h3` 三级标题
- 副标题描述文字（灰色、较小字号）
- 元数据标签行（如 "分析时间: 2026-06-06 | 模型: GPT-4"）
- 左侧装饰色带（primary 色系）

### 5.2 DataTableBlock
- 包装现有 `EnhancedDataTable`（若 data 含 `ingredients`）
- 或使用轻量内联表格（基于 TanStack Table）
- sticky 表头 + 斑马纹 + 列对齐
- 空状态优雅降级
- 响应式滚动

### 5.3 ChartBlock
- 根据 `chartType` 分派到 `RadarChart` / `BarChart` / `ScoreCards`
- 统一的标题栏 + 卡片容器
- 加载态骨架屏

### 5.4 ListBlock
- 四种变体：bullet / number / analysis / checklist
- analysis 变体带状态图标（🟢🟡🔴）
- 支持嵌套层级
- analysis 变体每项可配有辅助描述文字

### 5.5 CalloutBlock
- 四种变体：info(蓝) / success(绿) / warning(黄) / summary(暖米)
- 复用 `MarkdownRenderer` 中的 `CALLOUT_CONFIG` 配色体系
- 图标 + 标题栏 + 内容正文
- 可选的 details 折叠列表

### 5.6 MetricsBlock
- 网格排版 KPI 指标卡（2列/3列/4列自适应）
- 每个卡片：图标 + 标签 + 数值 + 单位 + 趋势箭头
- 数值颜色根据值域自动变化（高分绿/中分黄/低分红）

### 5.7 DividerBlock
- 细分割线，三种样式
- 可选居中标签文本

## 6. 集成方案

**修改文件:**
1. `ChatMessages.tsx` — `renderMessageContent()` 中增加结构化检测 + 渲染分支
2. 新增 `structured/` 目录下所有组件

**不改动文件:**
- `ChatTab.tsx` — 不变，它只传递 content 字符串
- `useChatMessages.ts` — 不变
- `MarkdownRenderer.tsx` — 不变
- `TypewriterText.tsx` — 不变（结构化内容不经过打字机）

## 7. 错误处理

- JSON 解析失败 → 静默回退到 MarkdownRenderer
- Block 类型未注册 → 跳过该 block, 不崩溃
- Block data 字段缺失 → 组件内部优雅降级（空状态）
- 整体捕获 `ErrorBoundary` 包裹

## 8. 验收标准

- [x] 结构化 JSON 内容正确渲染为区块组件
- [x] 现有纯文本/ Markdown 回复完全不受影响
- [x] 解析失败的 JSON 回退到 Markdown 显示
- [x] 各 Block 组件均覆盖 loading / empty / error 状态
- [x] 暗色模式适配
- [x] TypeScript 严格类型检查通过
- [x] 单元测试覆盖核心逻辑
