# Dashboard 仪表盘深度功能分析报告

> 分析时间：2026-08-28  
> 分析对象：`http://localhost:3000/dashboard`  
> 报告类型：功能完整性诊断 + 改进优先级建议

---

## 一、当前功能全览

### 已实现卡片（14个默认 + 12个高级）

| 类别 | 卡片名称 | 数据来源 | 状态 |
|------|----------|----------|------|
| **统计类** | 配方总数 / 实验总数 / 进行中实验 / 完成实验 | `/dashboard/statistics` | ✅ 完整 |
| **图表类** | 研发趋势 / 配方状态饼图 / 实验状态柱图 | `/dashboard/statistics` + `/dashboard/trends` | ✅ 完整 |
| **列表类** | 最近配方 / 最近实验 | `/formulas` + `/experiments` | ✅ 完整 |
| **操作类** | 快捷操作 | 硬编码导航链接 | ✅ 完整 |
| **任务类** | 待办事项 / 待审核配方 | `/activity/todos` + `/activity/review-queue` | ✅ 完整 |
| **动态类** | 最近动态 | `/activity/timeline` | ✅ 完整 |
| **AI类** | AI智能洞察 / AI分析面板 | 混合（真实+派生） | ✅ 已修复 |
| **高级类** | KPI监控 / WebSocket状态 / 实时同步 / 团队共享 / 在线状态 / 变更历史 / 模板管理 / 数据导出 / API集成 | 部分真实、部分模拟 | ⚠️ 部分可用 |

### 缺失功能（空白区域）

| # | 功能 | 优先级 | 说明 |
|---|------|--------|------|
| M-001 | 全局通知中心完整页面 | P1 | 现有 NotificationCenter 仅弹窗，无独立页面 |
| M-002 | 实时数据刷新机制 | P1 | 无定时刷新，无下拉刷新，依赖 staleTime |
| M-003 | 数据图表导出 | P2 | 趋势图/饼图/柱图仅展示，无可导出为图片功能 |
| M-004 | 卡片折叠/收起 | P2 | 点击卡片标题无法折叠内容区域 |
| M-005 | 全局搜索框 | P1 | 欢迎横幅无搜索入口，需在侧边导航搜索 |
| M-006 | 快捷操作可自定义 | P1 | QuickActions 硬编码，用户无法增删改 |
| M-007 | 统计卡片数值单位优化 | P2 | 大数字无千分位分隔符 |
| M-008 | 趋势图时间单位显示 | P2 | X轴显示 ISO 日期，非友好格式 |
| M-009 | 最近列表可点击跳转 | P1 | 配方/实验列表缺少跳转链接 |
| M-010 | 看板视图（Kanban） | P2 | 仅有列表视图，无看板视图切换 |

---

## 二、P1 核心功能缺陷

### 缺陷 1：快捷操作完全硬编码，不可自定义

**文件：** `frontend/src/components/dashboard/cards/QuickActions.tsx`

```typescript
const ACTIONS: Action[] = [
  { to: '/formulas/new', ... },   // 固定5个动作
  { to: '/experiments', ... },
  // ... 共5个，无法增减
]
```

**问题：**
- 用户无法添加自定义快捷操作
- 无偏好设置持久化
- 不同角色看到的快捷操作相同（研究者 vs 审核员）

**修复方案：**
```typescript
// 从 localStorage 读取用户自定义快捷操作
const DEFAULT_ACTIONS = [/* 系统默认5个 */]
const getUserActions = () => {
  const stored = localStorage.getItem('rmfood_quick_actions')
  if (stored) return JSON.parse(stored)
  return DEFAULT_ACTIONS
}
// 编辑模式下支持增删改
```

---

### 缺陷 2：统计卡片数值无千分位格式化

**文件：** `frontend/src/components/ui/StatCard.tsx`

```tsx
// 当前：直接渲染数字
<div className="text-3xl font-bold">{total}</div>
// 结果：1234567 显示为 1234567（难读）
```

**修复方案：**
```tsx
{new Intl.NumberFormat('zh-CN').format(total)}
// 结果：1,234,567
```

---

### 缺陷 3：趋势图 X 轴日期格式不友好

**文件：** `frontend/src/components/dashboard/cards/TrendChart.tsx`

```typescript
// 当前：直接截取日期字符串
date: d.date.slice(5),  // 输出 "08-28"
```

**问题：** 只显示月-日，缺少年份和星期信息

**修复方案：**
```typescript
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return `${d.getMonth()+1}月${d.getDate()}日`
}
```

---

### 缺陷 4：全局搜索缺失

**问题：** Dashboard 页面顶部欢迎横幅区域没有搜索入口，用户需要跳转到搜索页才能查找配方/实验

**修复方案：** 在欢迎横幅右侧添加搜索输入框，使用防抖调用后端搜索 API

---

### 缺陷 5：通知中心仅弹窗，无完整管理页面

**文件：** `frontend/src/pages/formula/components/NotificationCenter.tsx`

- 当前只有弹层展示最近通知
- 无"全部通知"独立页面
- 无通知分类筛选（系统/审核/协作）
- 无通知已读/未读批量操作

---

## 三、P2 体验优化项

### 优化 1：图表数据导出为图片

当前趋势图、饼图、柱图无导出按钮，用户无法将图表插入报告

**实现方案：** 使用 `recharts` 内置导出或 `html2canvas` 截图导出

---

### 优化 2：卡片折叠功能

用户可能希望暂时收起某些卡片以聚焦重点内容

**实现方案：** 卡片标题栏添加折叠/展开按钮，状态存入 localStorage

---

### 优化 3：实时数据刷新

当前依赖 `staleTime` 缓存，用户无法主动刷新

**实现方案：** 添加下拉刷新手势或刷新按钮，调用所有 query 的 `refetch()`

---

### 优化 4：最近列表可跳转

当前「最近配方」「最近实验」列表仅展示名称和状态，无法直接点击跳转

**修复方案：** 在 `RecentFormulas.tsx` 和 `RecentExperiments.tsx` 中添加 `<Link>` 跳转

---

## 四、P3 潜在增强功能

| # | 功能 | 说明 | 工时估算 |
|---|------|------|----------|
| E-001 | 主题色切换 | 除当前深色/浅色外，增加 Forest Green / Deep Blue 主题 | 2h |
| E-002 | 卡片尺寸记忆 | 记住每张卡片的自定义尺寸（当前仅记住可见性） | 1h |
| E-003 | 桌面推送通知 | 浏览器 Notification API，审核通过时推送 | 3h |
| E-004 | 月度报告生成 | 基于 dashboard 数据自动生成 PDF 月度报告 | 6h |
| E-005 | 数据对比视图 | 两个时间段的数据对比（如本月 vs 上月） | 4h |

---

## 五、数据完整性检查

### 后端 API 覆盖率

| API 端点 | 前端调用 | 后端实现 | 数据真实性 |
|----------|----------|----------|------------|
| `/dashboard/statistics` | ✅ | ✅ 真实 SQL | ✅ 100% |
| `/dashboard/trends` | ✅ | ✅ 真实 SQL | ✅ 100% |
| `/activity/timeline` | ✅ | ✅ 真实 SQL | ✅ 100% |
| `/activity/todos` | ✅ | ✅ 真实 SQL | ✅ 100% |
| `/activity/review-queue` | ✅ | ✅ 真实 SQL | ✅ 100% |
| `/notifications/v2/*` | ⚠️ 仅 unreadCount | ✅ 完整 | ✅ 100% |
| `/ai/analyze/formula` | ✅ | ⚠️ 依赖 formula_id | ⚠️ 需传入 ID |
| `/ai/analyze/experiment` | ✅ | ⚠️ 依赖 experiment_id | ⚠️ 需传入 ID |
| `/ai/predict/trends` | ✅ | ✅ 混合（真实基数+估算增幅） | ⚠️ 70% |

---

## 六、优先级修复建议

### Phase 1：核心缺陷修复（预计 2h）

1. **StatCard 数值千分位格式化** — 10min
2. **趋势图日期友好化** — 15min
3. **快捷操作硬编码问题** — 30min（支持自定义 + 角色适配）
4. **Dashboard 顶部搜索框** — 30min
5. **最近配方/实验列表可跳转** — 20min

### Phase 2：体验优化（预计 3h）

6. **通知中心完整页面** — 45min
7. **图表导出图片** — 30min
8. **卡片折叠功能** — 30min
9. **全局下拉刷新** — 20min
10. **快捷操作持久化** — 25min

### Phase 3：增强功能（预计 8h+）

11. 月度报告生成
12. 数据对比视图
13. 桌面推送通知
14. 主题色扩展

---

**报告生成时间：** 2026-08-28  
**下一步：** 请确认是否执行 Phase 1 修复，或告知需要优先处理的功能点
