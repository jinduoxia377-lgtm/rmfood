# Dashboard 骨架屏深度分析报告 & 开发方案

> 分析时间：2026-08-28  
> 分析对象：`http://localhost:3000/dashboard`  
> 报告类型：技术架构分析 + 开发实施方案

---

## 一、骨架问题诊断

### 1.1 整体数据流架构

```
DashboardPage.tsx
├─ useDashboardStatistics()        ← stats (立即需要)
├─ useDashboardTrends('30d')       ← trendsData (图表数据)
├─ useFormulas({ page:1, size:5 }) ← formulasData (最近列表)
├─ useExperiments({ page:1, size:5})← experimentsData (最近列表)
├─ useQuery(['activity-timeline']) ← timeline (延迟5min缓存)
├─ useQuery(['activity-todos'])    ← todos (延迟5min缓存)
└─ useQuery(['activity-review-queue'])← reviewQueue (延迟5min缓存)
```

**7个并行数据源，0个全局加载状态。**

---

### 1.2 各卡片骨架现状矩阵

| 卡片类型 | 数据源 | 骨架实现 | 问题等级 | 具体表现 |
|----------|--------|----------|----------|----------|
| **StatsCards×4** | stats | ❌ 无 | 🔴 P0 | data=null时显示"0"，无任何占位 |
| **TrendChart** | trendsData | ❌ 无 | 🔴 P0 | data=null时只显示空白区域 |
| **FormulaPieChart** | stats.formulas.by_status | ❌ 无 | 🔴 P0 | data=[]时显示"暂无数据"文字，非骨架 |
| **ExperimentBarChart** | stats.experiments.by_status | ❌ 无 | 🔴 P0 | 同上 |
| **RecentFormulas** | formulasData | ✅ 有 | ✅ 正常 | loading=true时显示3条Skeleton |
| **RecentExperiments** | experimentsData | ✅ 有 | ✅ 正常 | loading=true时显示3条Skeleton |
| **TodosList** | todosData | ❌ 无 | ⚠️ P1 | items=[]时显示"暂无待办"，无骨架 |
| **ReviewQueueList** | reviewQueueData | ❌ 无 | ⚠️ P1 | items=[]时显示"暂无待审核"，无骨架 |
| **ActivityTimeline** | timelineData | ❌ 无 | ⚠️ P1 | items=[]时显示"暂无动态"，无骨架 |
| **QuickActions** | 无API | N/A | ✅ 正常 | 静态组件，无需骨架 |

---

### 1.3 发现的问题

#### 🔴 P0 - 严重骨架缺失（影响首屏体验）

| # | 问题 | 位置 | 用户感知 |
|---|------|------|----------|
| S-001 | StatsCards 无骨架，data=null时显示"0" | `DashboardPage.tsx:580` → `StatsCards` → `StatCard` | 4个统计数字先闪0，再跳真实值 |
| S-002 | TrendChart 无骨架，data=null时留白 | `DashboardPage.tsx:581` → `TrendChart` | 面积图区域持续空白数秒 |
| S-003 | FormulaPieChart 无骨架，data=[]时显示文字 | `DashboardPage.tsx:580` → `FormulaPieChart` | 饼图区域先空白再显示提示文字 |
| S-004 | ExperimentBarChart 无骨架 | 同上 | 柱状图区域先空白再显示提示文字 |
| S-005 | 6个查询无 coordinated loading | `DashboardPage.tsx:241-261` | 各卡片各自闪烁，体验割裂 |

#### ⚠️ P1 - 中等问题（次屏体验）

| # | 问题 | 位置 | 用户感知 |
|---|------|------|----------|
| S-006 | TodosList 无骨架 | `DashboardPage.tsx:252-253` | 加载完成后突然弹出6条列表 |
| S-007 | ReviewQueueList 无骨架 | `DashboardPage.tsx:257-258` | 同上 |
| S-008 | ActivityTimeline 无骨架 | `DashboardPage.tsx:247-248` | 同上 |
| S-009 | 无错误状态处理 | 多处 | API失败时卡片静默空白，无重试入口 |
| S-010 | 无 LoadingProgress 进度指示 | `DashboardPage.tsx` 根层 | 用户不知道页面是否还在加载 |

---

## 二、开发方案

### 2.1 架构设计

```
┌──────────────────────────────────────────────────────────────┐
│                    DashboardPage                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  DashboardSkeleton (全局骨架)                          │   │
│  │  - 统计卡片行：4个 CardSkeleton (w:1,h:1)              │   │
│  │  - 图表区：TrendChartSkeleton (w:2,h:1)               │   │
│  │  - 饼图+柱图：PieSkeleton + BarSkeleton (w:1,h:1)     │   │
│  │  - 列表区：ListSkeleton × 3 (w:1,h:1)                 │   │
│  │  - 快捷操作：ActionsSkeleton (w:1,h:1)                │   │
│  └──────────────────────────────────────────────────────┘   │
│  显示条件：所有关键数据未加载完毕                             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    卡片级 Skeleton                           │
│  ┌─────────────┬────────────────────────────────────────┐   │
│  │ StatCard    │ 当对应统计数据未就绪时                   │   │
│  │             │ 显示 CardSkeleton                       │   │
│  ├─────────────┼────────────────────────────────────────┤   │
│  │ TrendChart  │ 当趋势数据未就绪时                       │   │
│  │             │ 显示 ChartSkeleton                      │   │
│  ├─────────────┼────────────────────────────────────────┤   │
│  │ PieChart    │ 当配方状态数据未就绪时                   │   │
│  │             │ 显示 ChartSkeleton                      │   │
│  ├─────────────┼────────────────────────────────────────┤   │
│  │ BarChart    │ 当实验状态数据未就绪时                   │   │
│  │             │ 显示 ChartSkeleton                      │   │
│  ├─────────────┼────────────────────────────────────────┤   │
│  │ TodosList   │ 当待办数据未就绪时                       │   │
│  │             │ 显示 ListSkeleton                       │   │
│  ├─────────────┼────────────────────────────────────────┤   │
│  │ ReviewList  │ 当审核队列未就绪时                       │   │
│  │             │ 显示 ListSkeleton                       │   │
│  ├─────────────┼────────────────────────────────────────┤   │
│  │ Timeline    │ 当动态数据未就绪时                       │   │
│  │             │ 显示 ListSkeleton                       │   │
│  └─────────────┴────────────────────────────────────────┘   │
```

---

### 2.2 实施计划

#### Phase 1: 全局骨架屏（P0，30min）

**目标：** 当 dashboard 关键数据全部未就绪时，显示统一的页面级骨架。

**新增文件：** `frontend/src/components/dashboard/DashboardSkeleton.tsx`

```tsx
/**
 * Dashboard 全局骨架屏
 * 当统计数据、趋势数据全部未加载时展示
 */
import { CardSkeleton, ChartSkeleton, ListSkeleton } from '@/components/ui/SkeletonPresets'

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* 欢迎横幅骨架 */}
      <div className="rounded-xl bg-neutral-100 dark:bg-neutral-800 h-20 skeleton" />

      {/* 统计卡片行 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="skeleton h-4 w-16 rounded" />
              <div className="skeleton w-8 h-8 rounded-lg" />
            </div>
            <div className="skeleton h-8 w-20 rounded" />
            <div className="skeleton h-3 w-24 rounded" />
          </div>
        ))}
      </div>

      {/* 图表区：趋势图(2列) + 饼图(1列) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2">
          <ChartSkeleton hasLegend />
        </div>
        <div className="lg:col-span-1">
          <ChartSkeleton hasLegend={false} />
        </div>
        <div className="lg:col-span-1">
          <ChartSkeleton hasLegend={false} />
        </div>
      </div>

      {/* 底部区域：快捷操作 + 列表 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 space-y-3">
          <div className="skeleton h-5 w-24 rounded" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton w-9 h-9 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3 w-3/4 rounded" />
                <div className="skeleton h-2.5 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="card p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="skeleton h-5 w-20 rounded" />
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3">
                <div className="skeleton h-3 w-3 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3 w-3/4 rounded" />
                  <div className="skeleton h-2.5 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="skeleton h-5 w-20 rounded" />
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3">
                <div className="skeleton h-3 w-3 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3 w-3/4 rounded" />
                  <div className="skeleton h-2.5 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5 space-y-3">
          <div className="skeleton h-5 w-24 rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton w-6 h-6 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3 w-3/4 rounded" />
                <div className="skeleton h-2.5 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

**修改文件：** `frontend/src/pages/dashboard/DashboardPage.tsx`

```tsx
// 第241行附近，添加 loading 追踪
const { data: stats, isLoading: statsLoading } = useDashboardStatistics()
const { data: trendsData, isLoading: trendsLoading } = useDashboardTrends(trendPeriod)

// 判断是否需要显示全局骨架
const isInitialLoading = statsLoading || trendsLoading

// 第552行附近，在主要内容区域前添加
{isInitialLoading ? (
  <DashboardSkeleton />
) : (
  <DndContext ...>
    {/* 原有内容 */}
  </DndContext>
)}
```

---

#### Phase 2: 卡片级骨架（P0，40min）

**目标：** 每个卡片组件独立处理 loading 状态。

**修改 StatsCards.tsx：**

```tsx
// frontend/src/components/dashboard/cards/StatsCards.tsx
import { StatCard, CardSkeleton } from '@/components/ui'

export const StatsCards: FC<Props> = ({ statIndex, total, loading }) => {
  if (loading) {
    return <CardSkeleton count={1} className="h-full" />  // 实际只渲染1个
  }
  // ...原有逻辑
}
```

**修改 DashboardPage.tsx renderCard：**

```tsx
// 给 stats cards 传递 loading 状态
if (statIndexMap[card.type] !== undefined) {
  const idx = statIndexMap[card.type]
  // ...原有计算
  props.loading = statsLoading  // 新增
}
```

**修改 TrendChart.tsx：**

```tsx
// frontend/src/components/dashboard/cards/TrendChart.tsx
import { ChartSkeleton } from '@/components/ui'

interface Props {
  data: TrendPoint[]
  loading?: boolean  // 新增
}

export const TrendChart: FC<Props> = ({ data, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardContent className="px-6 pt-6 pb-6">
          <ChartSkeleton hasLegend />
        </CardContent>
      </Card>
    )
  }
  // ...原有逻辑
}
```

**修改 DashboardPage.tsx renderCard：**

```tsx
if (card.type === 'chart-trends') {
  props.data = trendsData?.data ?? []
  props.loading = trendsLoading  // 新增
}
```

**修改 FormulaPieChart.tsx 和 ExperimentBarChart.tsx：**

```tsx
// 同样添加 loading 参数和 ChartSkeleton
interface Props {
  data: PieData[]
  loading?: boolean
}
```

**修改 TodosList.tsx、ReviewQueueList.tsx、ActivityTimeline.tsx：**

```tsx
// 添加 loading 参数和 ListSkeleton
interface Props {
  items: TodoItem[]
  loading?: boolean  // 新增
}

export const TodosList: FC<Props> = ({ items, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardHeader className="px-6 pt-6 pb-4">
          <div className="skeleton h-5 w-20 rounded" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-6 py-3 flex items-center gap-3">
                <div className="skeleton w-2 h-2 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3 w-3/4 rounded" />
                  <div className="skeleton h-2.5 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }
  // ...原有逻辑
}
```

**修改 DashboardPage.tsx renderCard：**

```tsx
if (card.type === 'todos') {
  props.items = todos
  props.loading = !todosData  // 新增
}
if (card.type === 'review-queue') {
  props.items = reviewQueue
  props.loading = !reviewQueueData  // 新增
}
if (card.type === 'activity-timeline') {
  props.items = timeline
  props.loading = !timelineData  // 新增
}
```

---

#### Phase 3: 错误状态处理（P1，20min）

**目标：** API 失败时显示错误提示卡。

**新增：** `frontend/src/components/dashboard/cards/ErrorCard.tsx`

```tsx
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui'
import { Button } from '@/components/ui'

interface ErrorCardProps {
  title: string
  message?: string
  onRetry?: () => void
}

export const ErrorCard: React.FC<ErrorCardProps> = ({ title, message, onRetry }) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center gap-3">
        <AlertTriangle size={20} className="text-warning-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 dark:text-white">{title}</p>
          <p className="text-xs text-neutral-500 mt-0.5">{message ?? '请稍后重试'}</p>
        </div>
        {onRetry && (
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={onRetry}>
            重试
          </Button>
        )}
      </div>
    </CardContent>
  </Card>
)
```

**修改 DashboardPage.tsx，添加错误追踪：**

```tsx
const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStatistics()
const { data: trendsData, isLoading: trendsLoading, error: trendsError } = useDashboardTrends(trendPeriod)
```

**修改 renderCard，为关键卡片添加错误状态：**

```tsx
// 统计卡片
if (statIndexMap[card.type] !== undefined) {
  if (statsError) {
    return <ErrorCard title="统计数据加载失败" onRetry={refetchStats} />
  }
  if (statsLoading) {
    return <CardSkeleton count={1} />
  }
  // ...原有逻辑
}
```

---

#### Phase 4: 懒加载活动数据优化（P1，15min）

**目标：** 活动数据（todos/timeline/review）延迟到关键数据加载完成后再请求。

**修改 DashboardPage.tsx：**

```tsx
// 当前：立即请求所有活动数据
const { data: timelineData } = useQuery({
  queryKey: ['activity-timeline'],
  queryFn: ({ signal }) => activityApi.timeline(7, signal),
  staleTime: 5 * 60_000,
})

// 优化：等 stats 加载完成后才请求
const { data: timelineData, isLoading: timelineLoading } = useQuery({
  queryKey: ['activity-timeline'],
  queryFn: ({ signal }) => activityApi.timeline(7, signal),
  staleTime: 5 * 60_000,
  enabled: !statsLoading,  // 新增：等 stats 加载完再请求
})
```

同理修改 `todosData` 和 `reviewQueueData` 的 query。

---

## 三、文件变更清单

| 优先级 | 文件 | 操作 | 预计工时 |
|--------|------|------|----------|
| P0 | `frontend/src/components/dashboard/DashboardSkeleton.tsx` | 新建 | 15min |
| P0 | `frontend/src/pages/dashboard/DashboardPage.tsx` | 修改 | 20min |
| P0 | `frontend/src/components/dashboard/cards/StatsCards.tsx` | 修改 | 5min |
| P0 | `frontend/src/components/dashboard/cards/TrendChart.tsx` | 修改 | 5min |
| P0 | `frontend/src/components/dashboard/cards/FormulaPieChart.tsx` | 修改 | 5min |
| P0 | `frontend/src/components/dashboard/cards/ExperimentBarChart.tsx` | 修改 | 5min |
| P1 | `frontend/src/components/dashboard/cards/TodosList.tsx` | 修改 | 5min |
| P1 | `frontend/src/components/dashboard/cards/ReviewQueueList.tsx` | 修改 | 5min |
| P1 | `frontend/src/components/dashboard/cards/ActivityTimeline.tsx` | 修改 | 5min |
| P1 | `frontend/src/components/dashboard/cards/ErrorCard.tsx` | 新建 | 10min |

**总计：** 约 80min（含测试）

---

## 四、验收标准

### 4.1 功能验收

| # | 场景 | 预期行为 |
|---|------|----------|
| A-001 | 首次进入 Dashboard | 显示全局骨架屏，统计/图表区域占位 |
| A-002 | 统计 API 返回后 | 全局骨架消失，4个统计卡片依次展示真实数据 |
| A-003 | 趋势 API 返回后 | 面积图区域从 ChartSkeleton 切换到真实图表 |
| A-004 | 列表 API 返回后 | 最近配方/实验从 LineSkeleton 切换到真实列表 |
| A-005 | API 请求失败 | 卡片显示 ErrorCard，带重试按钮 |
| A-006 | 网络恢复后 | 自动重试，数据正常加载 |

### 4.2 性能验收

| # | 指标 | 目标值 |
|---|------|--------|
| P-001 | 首屏 FCP | < 1.5s |
| P-002 | 首屏 LCP | < 2.5s |
| P-003 | 全局骨架显示时长 | < 300ms（骨架本身不阻塞渲染） |
| P-004 | 卡片级骨架切换 | 平滑，无闪烁 |

### 4.3 设计规范验收

| # | 检查项 | 标准 |
|---|--------|------|
| D-001 | 骨架颜色 | 使用 `skeleton` class (var(--fill-secondary)) |
| D-002 | 骨架动画 | shimmer 动画持续时间 1.5s |
| D-003 | 骨架圆角 | 与对应卡片内容圆角一致 |
| D-004 | 骨架尺寸 | 与真实内容布局对齐，不产生 layout shift |

---

## 五、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 全局骨架影响已有加载状态 | 低 | 中 | 使用 `statsLoading || trendsLoading` 精确判断 |
| 卡片级骨架与全局骨架重叠 | 中 | 低 | 全局骨架优先，只在 `isInitialLoading` 时显示 |
| SkeletonPresets 组件兼容 | 低 | 低 | 已有组件可直接复用 |
| 重构影响其他页面 | 低 | 低 | 仅修改 DashboardPage 及相关卡片组件 |

---

## 六、实施顺序

```
Step 1: 创建 DashboardSkeleton.tsx (全局骨架)
Step 2: 修改 DashboardPage.tsx (集成全局骨架)
Step 3: 修改 StatsCards.tsx (添加 CardSkeleton)
Step 4: 修改 TrendChart.tsx / FormulaPieChart.tsx / ExperimentBarChart.tsx
Step 5: 修改 TodosList.tsx / ReviewQueueList.tsx / ActivityTimeline.tsx
Step 6: 创建 ErrorCard.tsx (错误状态)
Step 7: 修改 DashboardPage.tsx (添加错误处理)
Step 8: 修改 DashboardPage.tsx (活动数据懒加载优化)
Step 9: 构建验证 + 手动测试
Step 10: 生成变更报告
```

---

**报告生成时间：** 2026-08-28  
**下一步：** 请确认方案后开始执行
