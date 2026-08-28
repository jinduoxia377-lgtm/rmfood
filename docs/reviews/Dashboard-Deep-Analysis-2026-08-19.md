# Dashboard 页面 UI/UX 深度分析报告

> 分析对象: http://localhost:3000/dashboard
> 审查标准: DESIGN.md v1.0 + WCAG 2.1 AA + Material Design 3
> 分析日期: 2026-08-19

---

## 一、框架与架构问题

### 🔴 P0 — 卡片数据映射过于复杂

**问题位置**: `DashboardPage.tsx` L122-234

**现状**:
```typescript
function renderCard({ card, data, trendsData, formulasData, ... }: CardRenderProps) {
  const props: Record<string, any> = { card, data, trendsData, ... }
  
  if (statIndexMap[card.type] !== undefined) {
    // 手动提取数据...
  }
  if (card.type === 'chart-trends') {
    props.data = trendsData?.data ?? []
  }
  if (card.type === 'chart-formula-pie') {
    // 手动处理饼图数据...
  }
  // ... 还有更多 if 判断
}
```

**问题**:
- 70+ 行条件分支逻辑，维护成本高
- 数据准备和渲染耦合
- 新增卡片类型需要修改核心函数

**建议**: 使用策略模式，将数据准备逻辑封装到各卡片组件内部。

---

### 🟡 P1 — useState 初始化重复代码

**问题位置**: `DashboardPage.tsx` L268-311

**现状**:
```typescript
const [currentLayout, setCurrentLayout] = useState<DashboardLayout>(() => {
  try {
    return DashboardConfigManager.getCurrentLayout()
  } catch (error) {
    // 16 行业务数据初始化...
  }
})
const [layouts, setLayouts] = useState<DashboardLayout[]>(() => {
  try {
    return DashboardConfigManager.getAllLayouts()
  } catch (error) {
    // 同样的 16 行初始化代码...
  }
})
```

**问题**: 初始化逻辑重复，应提取为 helper 函数。

---

## 二、布局问题

### 🔴 P0 — 网格列数硬编码限制

**问题位置**: `DashboardLayout.tsx` L62-69

**现状**:
```typescript
const handleSizeIncrease = () => {
  const newW = Math.min(card.size.w + 1, 4)  // 硬编码 max 4
  const newH = Math.min(card.size.h + 1, 3)  // 硬编码 max 3
  onUpdate(card.id, { size: { w: newW, h: newH } })
}
```

**问题**:
- 最大列数固定为 4，响应式断点变化时不匹配
- Tablet (2列) 时仍允许调整到 4列

**修复建议**:
```typescript
const getMaxColumns = () => {
  if (window.innerWidth >= 1280) return 4
  if (window.innerWidth >= 1024) return 3
  if (window.innerWidth >= 640) return 2
  return 1
}
```

---

### 🟡 P1 — 主容器宽度限制不一致

**问题位置**: `DashboardPage.tsx` L455

**现状**:
```tsx
<div className="space-y-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
```

**问题**:
- `max-w-7xl` = 1280px，但 DESIGN.md 定义 XL 断点为 ≥1280px
- 当屏幕 > 1280px 时，内容区域不再居中扩展

**设计规范要求**:
```yaml
breakpoints:
  xl: ≥ 1280px  # 标准内容宽度 1280px
```

---

## 三、卡片问题

### 🔴 P0 — CardHeader/CardContent padding 不统一

**问题位置**: 多个卡片组件

| 组件 | CardHeader | CardContent | 设计值 |
|------|-----------|-------------|--------|
| TrendChart | `px-6 pt-6 pb-4` | `px-6 pt-6 pb-6` | 20px |
| RecentFormulas | `px-6 pt-6 pb-4` | `p-0` | 20px |
| QuickActions | `px-6 pt-6 pb-4` | `px-6 pb-6 pt-0` | 20px |
| TodosList | `px-6 pt-6 pb-4` | `p-0` | 20px |
| StatCard | `px-6 py-4` | - | 20px |

**问题**:
- `p-0` 表示无边距，但卡片内部仍有内容间距
- `py-4` (16px) vs 设计规范 `padding: 20px`
- 缺少统一 CardPadding 常量

**修复建议**:
```typescript
// 统一卡片内边距
const CARD_PADDING = 'px-5 py-5'  // ≈ 20px
const CARD_HEADER_PADDING = 'px-5 pt-5 pb-3'
const CARD_CONTENT_PADDING = 'px-5 pb-5'
```

---

### 🟡 P1 — 空状态图标尺寸不一致

**问题位置**: 多个组件

| 位置 | 图标 | 尺寸 | 问题 |
|------|------|------|------|
| DashboardPage L82 | Sparkles | 48px | ✅ 正常 |
| DashboardPage L231 | Sparkles | 48px | ✅ 正常 |
| TrendChart L99 | BarChart3 | 28px | ⚠️ 不一致 |
| TrendChart L104 | Plus | 14px | ⚠️ 图标太小 |

**规范**: EmptyState 图标应为 48px 或 64px，强调视觉重要性。

---

### 🟡 P1 — 列表项点击区域不足

**问题位置**: `RecentFormulas.tsx` L62

**现状**:
```tsx
<Link key={f.id} to={`/formulas/${f.id}`} className="block px-6 py-3 hover:bg-neutral-subtle/60">
```

**问题**:
- `py-3` = 12px 垂直 padding
- 单行内容高度约 36px，点击区域仅 36×(100%宽)
- 触摸目标高度不足 44px

**修复**:
```tsx
className="block px-6 py-4 hover:bg-neutral-subtle/60"  // py-4 = 16px
// 或
className="block px-6 py-[14px] hover:bg-neutral-subtle/60"  // 44px - 16px(text) = 14px padding
```

---

## 四、文字大小问题

### 🔴 P0 — Typography 层级混乱

**DESIGN.md 规范**:
```
display-xl:  57px (页面标题)
display-lg:  36px
headline:    24px
title-lg:    22px
title-md:    16px
body-lg:     16px
body:        15px
body-sm:     14px
caption:     12px
overline:    11px
```

**Dashboard 实际使用**:

| 元素 | 使用 | 问题 |
|------|------|------|
| 欢迎横幅标题 | `text-h1` (应该是 `text-display-lg`) | ⚠️ 类名不匹配规范 |
| 卡片标题 | `text-h2` | ✅ 对应 headline 24px |
| 快捷操作标题 | `text-h2` | ✅ |
| 列表项文字 | `text-xs` (12px) | ✅ 对应 caption |
| 标签文字 | `text-caption` | ✅ |
| 统计数据值 | `text-display` (36px) | ✅ |

**问题**:
- `text-h1` 类未在 DESIGN.md 中定义
- 混合使用 `text-h2` 和 `text-h1`，但 H1 未定义

---

### 🟡 P1 — 图表图例字体太小

**问题位置**: `TrendChart.tsx` L90

**现状**:
```tsx
<Legend wrapperStyle={{ paddingTop: 16, fontSize: 12 }} iconType="circle" iconSize={8} />
```

**问题**:
- `fontSize: 12` 低于 body-sm (14px) 规范
- 图例应使用 body-sm 或至少 caption

**修复**:
```tsx
<Legend wrapperStyle={{ paddingTop: 16, fontSize: 14 }} iconType="circle" iconSize={10} />
```

---

### 🟡 P1 — X/Y 轴刻度字体过小

**问题位置**: `TrendChart.tsx` L87-88

**现状**:
```tsx
<XAxis dataKey="date" tick={{ fontSize: 11, fill:'var(--text-muted)' }} ... />
<YAxis tick={{ fontSize: 11, fill:'var(--text-muted)' }} ... />
```

**问题**: `fontSize: 11` 低于 caption (12px) 规范

---

## 五、图标问题

### 🔴 P0 — 图标尺寸不规范

**Lucide Icons 规范**: 16/18/20/24px

| 位置 | 图标 | 尺寸 | 问题 |
|------|------|------|------|
| DashboardPage L469 | Sparkles | 16px | ✅ 按钮图标 |
| DashboardPage L512 | Settings | 16px | ✅ 按钮图标 |
| DashboardPage L522 | Download | 14px | ❌ 非常规尺寸 |
| DashboardPage L536 | AlertTriangle | 18px | ✅ 正常 |
| TrendChart L70 | BarChart3 | 20px | ✅ 卡片标题图标 |
| TrendChart L104 | Plus | 14px | ❌ 非常规尺寸 |
| RecentFormulas L52 | ArrowRight | 14px | ❌ 非常规尺寸 |
| TodosList L27 | ClipboardList | 18px | ✅ 正常 |
| TodosList L54 | ArrowRight | 14px | ❌ 非常规尺寸 |

**修复**: 统一使用 16px 或 20px 图标

---

### 🟡 P1 — EmptyState 图标尺寸不一致

**现状**:
- DashboardPage: `Sparkles size={48}` ✅
- TrendChart: `BarChart3 size={28}` ❌

**规范**: EmptyState 图标应统一为 48px 或 64px。

---

## 六、按钮问题

### 🔴 P0 — 触摸目标不足 44px

**WCAG 2.1 AA 要求**: 所有交互元素 ≥ 44×44px

**问题组件**:

1. **DraggableCard 操作按钮** (`DashboardLayout.tsx` L132)
```tsx
className="p-1 rounded hover:bg-neutral-100"  // p-1 = 4px
// 实际触摸区域: 约 20×20px (图标 14px + padding 4px × 2)
```

2. **布局控制按钮** (`DashboardLayout.tsx` L293)
```tsx
className="px-3 py-1 rounded text-xs"  // py-1 = 4px
// 实际触摸区域: 约 24×12px
```

3. **间距选择按钮** (`DashboardLayout.tsx` L307)
```tsx
className="w-6 h-6 rounded"  // 24×24px
// 不足 44×44px
```

**修复**:
```tsx
// 最小触摸目标 44px
className="p-2 min-w-[44px] min-h-[44px] rounded"
// 或
className="px-3 py-2 min-h-[44px] rounded"
```

---

### 🟡 P1 — Ghost 按钮图标太小

**问题位置**: `DashboardPage.tsx` L519-526

**现状**:
```tsx
<Button variant="ghost" size="sm" icon={<Download size={14} />}>
  {DASHBOARD_CONFIG.messages.exportData}
</Button>
```

**问题**: 
- `size="sm"` 可能导致按钮高度不足
- 图标 14px 配合小按钮可能视觉上不平衡

---

## 七、颜色对比度问题

### 🟡 P1 — 白色文字在渐变背景上对比度不足

**问题位置**: `DashboardPage.tsx` L457-463

**现状**:
```tsx
<div className="bg-gradient-to-r from-primary-700 to-primary-800 text-white">
  <h1 className="text-white">...</h1>
  <p className="text-white/80 text-body-sm">...</p>
</div>
```

**对比度检查**:
- `white (#ffffff)` on `primary-700 (#047857)`: 4.58:1 ✅ AA
- `white/80` on `primary-700`: ~3.5:1 ❌ FAIL AA

**修复**:
```tsx
<p className="text-white/90 text-body-sm font-medium">  // 提升不透明度
// 或使用 CSS 变量
<p className="text-[var(--text-secondary)] text-body-sm">
```

---

## 八、悬停状态问题

### 🟡 P1 — 卡片悬停效果不一致

| 组件 | 悬停效果 |
|------|---------|
| QuickActions | `hover:-translate-y-1` + `hover:shadow-card-hover` |
| RecentFormulas | `hover:bg-neutral-subtle/60` |
| StatCard | `hoverable` (Card 组件默认) |
| TrendChart | 无悬停效果 |

**建议**: 统一卡片悬停行为，添加微妙的 `translateY(-1px)` 和阴影增强。

---

### 🟢 P2 — 编辑模式提示栏样式问题

**问题位置**: `DashboardPage.tsx` L533

**现状**:
```tsx
<div className="p-4 rounded-xl bg-warning-50 dark:bg-warning-900/10 border border-amber-200">
```

**问题**:
- `bg-warning-50` 是 Tailwind 内置色，可能与设计系统不一致
- 应使用 `var(--color-warning-bg)` 语义色变量

---

## 九、响应式问题

### 🟡 P1 — 移动端统计卡片太小

**现状**: Mobile (< 640px) 所有卡片 1 列堆叠

**问题**:
- 统计卡片在移动端仍然只有 1×1 大小
- 主要指标数值不够突出

**建议**: 移动端优先显示最重要的 2-3 个统计卡片，其他折叠。

---

### 🟢 P2 — 布局列数切换体验

**现状**: 布局列数切换按钮在 edit mode 下才显示

**问题**: 用户无法在非编辑模式调整布局密度

**建议**: 添加独立的布局密度切换控件，无需进入编辑模式。

---

## 十、总结与优先级

### 🔴 P0 高优先级 (3 项)
| # | 问题 | 影响 | 修复难度 |
|---|------|------|---------|
| 1 | 卡片数据映射过于复杂 | 维护性差 | 中 |
| 2 | 网格列数硬编码限制 | 响应式失效 | 低 |
| 3 | 触摸目标不足 44px | 无障碍 FAIL | 低 |

### 🟡 P1 中优先级 (8 项)
| # | 问题 | 影响 |
|---|------|------|
| 1 | CardPadding 不统一 | 视觉不一致 |
| 2 | EmptyState 图标尺寸不一致 | 视觉不一致 |
| 3 | Typography 层级混乱 | 可读性下降 |
| 4 | 图标尺寸不规范 | 视觉不一致 |
| 5 | 图表图例字体太小 | 可读性 |
| 6 | 白色文字对比度不足 | 无障碍 FAIL |
| 7 | 列表项点击区域不足 | 触摸体验差 |
| 8 | useState 初始化重复 | 维护性 |

### 🟢 P2 低优先级 (4 项)
| # | 问题 |
|---|------|
| 1 | 悬停效果不一致 |
| 2 | 编辑提示栏样式 |
| 3 | 移动端统计卡片优化 |
| 4 | 布局密度切换体验 |

---

## 十一、修复建议优先级

```
第一步: 修复触摸目标 (P0 #3) — 影响 WCAG 合规
第二步: 修复网格限制 (P0 #2) — 影响响应式
第三步: 统一 Typography (P1 #3) — 影响品牌一致性
第四步: 统一图标尺寸 (P1 #4) — 影响视觉一致性
第五步: 重构卡片数据映射 (P0 #1) — 影响可维护性
```
