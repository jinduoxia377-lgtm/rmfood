# Dashboard AI 模块骨架深度分析报告

> 分析时间：2026-08-28  
> 分析对象：`ai-insights`（AI智能洞察）和 `ai-analysis`（AI分析面板）  
> 报告类型：技术架构分析 + 问题诊断

---

## 一、模块定位

### 1.1 两个 AI 模块的定义

| 模块 | 卡片类型 | 组件路径 | 默认可见性 | 懒加载 |
|------|----------|----------|------------|--------|
| **AI智能洞察** | `ai-insights` | `AIInsights.tsx` | ❌ 不在默认布局 | ❌ 无 |
| **AI分析面板** | `ai-analysis` | `AIAnalysisPanel.tsx` | ✅ 在默认布局但隐藏 | ✅ 有 |

### 1.2 在 DashboardPage.tsx 中的注册方式

```tsx
// Line 88 — ai-insights：直接渲染，无懒加载
'ai-insights': () => <AIInsights />,

// Line 93 — ai-analysis：有 Suspense + 骨架兜底
'ai-analysis': () => (
  <Suspense fallback={<CardSkeletonComp className="h-32" />}>
    <AIAnalysisPanel />
  </Suspense>
),
```

---

## 二、骨架现状诊断

### 2.1 ai-insights（AI智能洞察）

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 全局骨架占位 | ❌ 缺失 | DashboardSkeleton 未包含 AI 区域 |
| 卡片级骨架 | ⚠️ 部分 | 组件内部有列表骨架，无卡片级骨架 |
| 父级 loading 控制 | ❌ 缺失 | DashboardPage 未传递 loading prop |
| 父级 error 控制 | ❌ 缺失 | DashboardPage 未传递 error prop |
| 父级 retry 控制 | ❌ 缺失 | DashboardPage 未传递 onRetry prop |
| React Query 加载状态 | ✅ 有 | useAIInsights/useAIPredictions/useKPIProgress |
| 内部 Skeleton 实现 | ✅ 有 | insightsLoading/predictionsLoading/KPI isLoading |

**渲染行为：**
```
页面加载 → 等待 stats/trends/formulas/experiments 完成
           ↓
       isInitialLoading = false → 显示真实内容
           ↓
       AIInsights 组件挂载
           ↓
       3个并行 API 请求启动
           ↓
       insightsLoading=true → 显示3条列表骨架
       predictionsLoading=true → 显示2条预测骨架
       kpiLoading=true → 显示2条KPI骨架
```

**问题：** 三个 API 相互独立，加载时间不同，可能出现部分内容已显示、部分内容仍在骨架的状态（视觉跳跃）。

### 2.2 ai-analysis（AI分析面板）

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 全局骨架占位 | ❌ 缺失 | DashboardSkeleton 未包含 AI 区域 |
| 卡片级骨架 | ✅ 有 | Suspense fallback 显示 CardSkeleton |
| 父级 loading 控制 | ❌ 缺失 | DashboardPage 未传递 loading prop |
| 父级 error 控制 | ❌ 缺失 | DashboardPage 未传递 error prop |
| 父级 retry 控制 | ❌ 缺失 | DashboardPage 未传递 onRetry prop |
| React Query 加载状态 | ❌ 无 | 使用手动 fetch，非 React Query |
| 内部 Skeleton 实现 | ⚠️ 弱 | isLoading 由用户点击触发，非自动 |

**渲染行为：**
```
页面加载 → 等待 stats/trends/formulas/experiments 完成
           ↓
       isInitialLoading = false → 显示真实内容
           ↓
       AIAnalysisPanel 组件懒加载启动
           ↓
       显示 CardSkeleton (h-32) ← 固定高度骨架
           ↓
       组件加载完成 → 显示空白面板（无自动加载）
           ↓
       用户需手动点击按钮触发分析
```

**问题：** 
1. CardSkeleton 固定高度 `h-32` 与实际内容高度不匹配
2. 加载完成后显示空白面板，需用户手动操作才能看到内容
3. 无自动数据加载，用户体验断裂

---

## 三、核心问题汇总

### 🔴 P0 - 严重问题

| # | 问题 | 影响 | 修复方向 |
|---|------|------|----------|
| A-001 | 两个 AI 模块均无父级 loading 控制 | 全局骨架显示后，AI 卡片区域仍可能空白 | 在 renderCard 中为 AI 卡片添加 loading/error/retry |
| A-002 | DashboardSkeleton 未包含 AI 区域骨架 | 全局骨架不完整，AI 区域在加载后突然出现在正确位置 | 更新 DashboardSkeleton 加入 AI 卡片骨架位 |
| A-003 | ai-analysis 使用手动 fetch 而非 React Query | 无法利用 staleTime 缓存，每次切换布局都重新请求 | 重构为 React Query 管理模式 |

### ⚠️ P1 - 中等问题

| # | 问题 | 影响 | 修复方向 |
|---|------|------|----------|
| A-004 | ai-insights 的三组 API 加载不同步 | 部分内容先显示、部分后显示，视觉闪烁 | 统一 loading 判断或串行加载 |
| A-005 | AIInsights 头部有渐变背景 `from-purple-500 to-pink-500` | 破坏品牌色统一性 | 改用 Design Token 纯色 |
| A-006 | ai-analysis CardSkeleton 固定高度 h-32 | 实际内容超出时截断，或高度浪费 | 动态高度或移除固定高度 |

### 💡 P2 - 体验优化

| # | 问题 | 影响 | 修复方向 |
|---|------|------|----------|
| A-007 | ai-analysis 无自动加载 | 用户需手动点击才能触发分析 | 组件挂载时自动请求一次 |
| A-008 | ai-analysis 无错误重试入口 | API 失败时只能刷新页面 | 添加 ErrorCard + 重试按钮 |
| A-009 | 两个 AI 模块命名不一致 | `ai-insights` vs `ai-analysis` 造成困惑 | 统一命名或明确区分用途 |

---

## 四、架构对比：其他卡片 vs AI 卡片

| 特性 | 统计卡片 | 图表卡片 | 列表卡片 | AI 卡片 |
|------|----------|----------|----------|---------|
| 父级 loading | ✅ | ✅ | ✅ | ❌ |
| 父级 error | ✅ | ✅ | ✅ | ❌ |
| 父级 retry | ✅ | ✅ | ✅ | ❌ |
| 全局骨架占位 | ✅ | ✅ | ✅ | ❌ |
| 卡片级骨架 | ✅ CardSkeleton | ✅ ChartSkeleton | ✅ ListSkeleton | ⚠️ 部分 |
| React Query 管理 | ✅ | ✅ | ✅ | ❌ (ai-analysis) |
| 错误状态显示 | ✅ ErrorCard | ✅ ErrorCard | ✅ ErrorCard | ❌ |

**结论：AI 模块是骨架系统的唯一盲区。**

---

## 五、修复方案

### 5.1 方案概述

```
Phase 1: DashboardSkeleton 增加 AI 区域骨架占位
Phase 2: renderCard 为 AI 卡片添加 loading/error/retry 透传
Phase 3: AIInsights 组件统一内部 loading 状态
Phase 4: AIAnalysisPanel 重构为 React Query 管理
Phase 5: 去除 AIInsights 渐变背景，统一 Design Token
```

### 5.2 Phase 1: 更新 DashboardSkeleton

**文件：** `frontend/src/components/dashboard/DashboardSkeleton.tsx`

在底部区域增加 AI 卡片骨架占位：

```tsx
{/* AI智能洞察骨架 */}
<div className="card p-5 space-y-4">
  <div className="flex items-center gap-3">
    <div className="skeleton w-10 h-10 rounded-xl" />
    <div className="space-y-2 flex-1">
      <div className="skeleton h-4 w-28 rounded" />
      <div className="skeleton h-3 w-40 rounded" />
    </div>
    <div className="skeleton h-5 w-10 rounded-full" />
  </div>
  {/* 标签骨架 */}
  <div className="flex gap-2">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="skeleton h-6 w-16 rounded-full" />
    ))}
  </div>
  {/* 内容骨架 */}
  {Array.from({ length: 3 }).map((_, i) => (
    <div key={i} className="p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 space-y-3">
      <div className="flex items-start gap-3">
        <div className="skeleton w-10 h-10 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-2/3 rounded" />
          <div className="skeleton h-3 w-full rounded" />
        </div>
      </div>
    </div>
  ))}
</div>
```

### 5.3 Phase 2: renderCard 增加 AI 卡片处理

**文件：** `frontend/src/pages/dashboard/DashboardPage.tsx`

```tsx
// 新增 AI 相关查询 hooks（延迟加载）
const { data: aiInsightsData, isLoading: aiInsightsLoading, error: aiInsightsError, refetch: refetchAIInsights } = useQuery({
  queryKey: ['ai-insights'],
  queryFn: () => aiInsightsApi.getInsights(),
  enabled: !isInitialLoading,  // 等关键数据加载完
  staleTime: 5 * 60_000,
})

// 在 renderCard 中添加
if (card.type === 'ai-insights') {
  props.loading = aiInsightsLoading
  props.error = aiInsightsError
  props.onRetry = refetchAIInsights
}
```

### 5.4 Phase 3: AIInsights 组件改造

**文件：** `frontend/src/pages/formula/components/AIInsights.tsx`

添加卡片级 loading 支持：

```tsx
interface AIInsightsProps {
  className?: string
  loading?: boolean   // 新增：父级控制
  error?: Error | null
  onRetry?: () => void
}

export function AIInsights({ className, loading, error, onRetry }: AIInsightsProps) {
  // 如果父级 loading 为 true，优先显示卡片级骨架
  if (loading) {
    return <CardSkeleton count={1} className={className} />
  }
  
  if (error) {
    return <ErrorCard title="AI洞察加载失败" onRetry={onRetry} className={className} />
  }
  
  // ...原有逻辑（使用内部的 insightsLoading 等）
}
```

### 5.5 Phase 4: AIAnalysisPanel 重构

**当前问题：** 手动 fetch + 按钮触发

**目标架构：**
```tsx
// 使用 React Query 管理
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['ai-analysis'],
  queryFn: () => aiInsightsApi.getAnalysis(),
  enabled: false,  // 不自动加载
})

// 组件挂载时自动触发一次
useEffect(() => {
  refetch()
}, [])
```

### 5.6 Phase 5: 去除渐变背景

**文件：** `frontend/src/pages/formula/components/AIInsights.tsx`

```tsx
// 修改前（AI味）
<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">

// 修改后（Design Token）
<div className="w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
```

---

## 六、实施计划

| 优先级 | 任务 | 文件 | 工时 |
|--------|------|------|------|
| P0 | DashboardSkeleton 增加 AI 占位 | `DashboardSkeleton.tsx` | 20min |
| P0 | renderCard 增加 AI 卡片处理 | `DashboardPage.tsx` | 15min |
| P0 | AIInsights 组件添加 loading/error/retry | `AIInsights.tsx` | 20min |
| P1 | AIInsights 渐变背景替换 | `AIInsights.tsx` | 5min |
| P1 | AIAnalysisPanel React Query 重构 | `AIAnalysisPanel.tsx` | 30min |
| P1 | AIAnalysisPanel 自动加载 + 错误处理 | `AIAnalysisPanel.tsx` | 15min |

**总计：约 105min**

---

## 七、验收标准

| # | 场景 | 预期 |
|---|------|------|
| S-001 | 全局骨架显示期间 | AI 区域有骨架占位，不突然出现 |
| S-002 | ai-insights 加载时 | 显示卡片级骨架，数据就绪后平滑切换 |
| S-003 | ai-insights 失败时 | 显示 ErrorCard，带重试按钮 |
| S-004 | ai-analysis 懒加载时 | 显示 CardSkeleton (h-32)，加载后自动请求 |
| S-005 | AIInsights 头部 | 纯色背景（accent-100），无渐变 |
| S-006 | 父级 loading 控制 | DashboardPage 可暂停/恢复 AI 数据请求 |

---

**报告生成时间：** 2026-08-28  
**下一步：** 请确认是否需要执行修复
