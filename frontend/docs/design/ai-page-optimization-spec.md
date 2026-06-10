
# AI智能助手页面设计优化规范

&gt; 参照: http://localhost:3000/databases

---

## 1. 布局框架设计规范

### 1.1 页面容器结构

| 元素 | 数据库页面 | AI页面（优化目标）|
|-----|----------|----------------|
| 最大宽度 | `max-w-7xl` | ✅ `max-w-7xl` |
| 水平内边距 | `px-4 sm:px-6 lg:px-8` | ✅ `px-4 sm:px-6 lg:px-8` |
| 垂直间距 | `space-y-6` | ✅ `space-y-6` |
| 进入动画 | `animate-page-enter` | ✅ `animate-page-enter` |

### 1.2 页面分区结构

```
┌─────────────────────────────────────────────────────┐
│  1. PageHeader (标题 + 描述)                        │
├─────────────────────────────────────────────────────┤
│  2. 全局搜索栏 (带快捷键提示)                      │
├─────────────────────────────────────────────────────┤
│  3. 统计卡片网格 (2列/5列响应式)                   │
├─────────────────────────────────────────────────────┤
│  4. 图表区域 (可选，数据库页面特有)                │
├─────────────────────────────────────────────────────┤
│  5. Tabs导航 + Tab内容                             │
└─────────────────────────────────────────────────────┘
```

### 1.3 间距规范

| 间距类型 | 值 | 使用场景 |
|---------|----|---------|
| 容器水平内边距 (移动端) | `px-4` | 手机 |
| 容器水平内边距 (平板) | `px-6` | 平板 |
| 容器水平内边距 (桌面) | `px-8` | 桌面 |
| 主区域间距 | `space-y-6` | 各主要模块间 |
| 统计卡片间距 | `gap-4` | 卡片网格 |
| 图表间距 | `gap-6` | 图表网格 |
| 卡片内边距 | `p-4` 或 `p-5` | 统计卡片/图表卡片 |

### 1.4 响应式布局规则

| 屏幕尺寸 | 布局调整 |
|---------|---------|
| `&lt;640px` | 统计卡片: `grid-cols-2` |
| `640-1024px` | 统计卡片: `grid-cols-5` |
| `&gt;1024px` | 完整布局 |

---

## 2. 图标设计规范

### 2.1 图标库

统一使用: `lucide-react`

### 2.2 图标尺寸规范

| 使用场景 | 尺寸 | 示例 |
|---------|------|------|
| 统计卡片图标 | `w-5 h-5` | 中药材/智能对话 |
| 标题图标 | `w-4 h-4` | 图表标题/配置标题 |
| 搜索栏图标 | `w-5 h-5` | Search |
| 导航图标 | `w-5 h-5` (内部使用) | TabsTrigger |

### 2.3 图标色彩系统

| 状态 | 颜色类 | 用途 |
|-----|--------|------|
| 主色 | `text-primary-600` / `dark:text-primary-400` | 主要功能、激活状态 |
| 信息色 | `text-blue-600` / `dark:text-blue-400` | 信息类 |
| 警告色 | `text-amber-600` / `dark:text-amber-400` | 警告类 |
| 成功色 | `text-emerald-600` / `dark:text-emerald-400` | 成功/在线 |
| 危险色 | `text-red-600` / `dark:text-red-400` | 错误/离线 |
| 强调色 | `text-accent-600` / `dark:text-accent-400` | 强调 |

### 2.4 图标背景色

| 主题 | 背景色 | 边框色 |
|-----|--------|--------|
| 主色 | `bg-primary-50` / `dark:bg-primary-950/40` | `border-primary-100` / `dark:border-primary-900/30` |
| 蓝色 | `bg-blue-50` / `dark:bg-blue-950/40` | `border-blue-100` / `dark:border-blue-900/30` |
| 琥珀色 | `bg-amber-50` / `dark:bg-amber-950/40` | `border-amber-100` / `dark:border-amber-900/30` |
| 翠绿色 | `bg-emerald-50` / `dark:bg-emerald-950/40` | `border-emerald-100` / `dark:border-emerald-900/30` |
| 红色 | `bg-red-50` / `dark:bg-red-950/40` | `border-red-100` / `dark:border-red-900/30` |

### 2.5 图标交互效果

| 效果 | 类名 | 说明 |
|-----|------|------|
| 悬停阴影 | `hover:shadow-md` | 鼠标悬停 |
| 点击缩放 | `active:scale-95` | 点击反馈 |
| 平滑过渡 | `transition-all` | 所有属性过渡 |

---

## 3. 组件设计规范

### 3.1 PageHeader 组件

**结构:**
```typescript
&lt;PageHeader
  title="页面标题"
  description="功能描述"
/&gt;
```

**规范:**
- 标题: 主标题
- 描述: 功能列表，用 `·` 分隔

### 3.2 搜索栏组件

**结构:**
```typescript
&lt;div className="relative"&gt;
  &lt;div className="relative"&gt;
    &lt;Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" /&gt;
    &lt;input
      type="text"
      placeholder="搜索提示... (Ctrl+K)"
      className="w-full pl-12 pr-20 py-3 input text-base"
    /&gt;
    &lt;kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-gray-400 dark:text-gray-500 bg-slate-100 dark:bg-slate-800 rounded border border-gray-200 dark:border-gray-700"&gt;
      Ctrl+K
    &lt;/kbd&gt;
  &lt;/div&gt;
&lt;/div&gt;
```

**规范:**
- 左侧搜索图标 (Search)
- 输入框样式: `pl-12 pr-20 py-3`
- 右侧快捷键提示: `Ctrl+K`

### 3.3 统计卡片组件

**结构:**
```typescript
{[
  { 
    label: '标签', 
    value: 123, 
    icon: IconComponent, 
    color: 'text-primary-600 dark:text-primary-400', 
    bg: 'bg-primary-50 dark:bg-primary-950/40', 
    border: 'border-primary-100 dark:border-primary-900/30', 
    tab: 'target-tab' 
  },
].map(({ label, value, icon: Icon, color, bg, border, tab: tabTarget }) =&gt; (
  &lt;button
    key={label}
    onClick={() =&gt; setTab(tabTarget)}
    className={`card p-4 text-center ${bg} ${border} border hover:shadow-md transition-all active:scale-95`}
  &gt;
    &lt;Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} /&gt;
    &lt;div className="text-2xl font-bold text-text-primary dark:text-text-primary"&gt;
      {typeof value === 'number' ? value.toLocaleString() : value}
    &lt;/div&gt;
    &lt;div className="text-xs text-text-muted dark:text-text-muted mt-1"&gt;{label}&lt;/div&gt;
  &lt;/button&gt;
))}
```

**规范:**
- 图标: `w-5 h-5`，居中，底部边距 `mb-1`
- 数值: `text-2xl font-bold`
- 标签: `text-xs`
- 点击跳转到对应Tab

### 3.4 Tabs 组件

**结构:**
```typescript
&lt;Tabs value={tab} onValueChange={(v) =&gt; setTab(v)}&gt;
  &lt;TabsList&gt;
    &lt;TabsTrigger value="tab1"&gt;
      标签名称
      {count &gt; 0 &amp;&amp; &lt;Badge variant="primary" size="sm" className="ml-1.5"&gt;{count}&lt;/Badge&gt;}
    &lt;/TabsTrigger&gt;
  &lt;/TabsList&gt;
  &lt;TabsContent value="tab1"&gt;
    &lt;TabContent /&gt;
  &lt;/TabsContent&gt;
&lt;/Tabs&gt;
```

**规范:**
- TabsList: 包含所有TabsTrigger
- TabsTrigger: 支持带Badge显示数量
- TabsContent: 具体内容区域

### 3.5 Card 组件

**结构:**
```typescript
&lt;div className="card p-5"&gt;
  &lt;h3 className="text-sm font-bold text-text-primary dark:text-text-primary mb-4 flex items-center gap-2"&gt;
    &lt;Icon className="w-4 h-4 text-primary-600" /&gt;
    标题
  &lt;/h3&gt;
  &lt;!-- 内容 --&gt;
&lt;/div&gt;
```

**规范:**
- 内边距: `p-5`
- 标题: `text-sm font-bold`，带图标 (`w-4 h-4`)
- 图标与标题间距: `gap-2`
- 标题下边距: `mb-4`

---

## 4. AI页面子模块图标配置

| 子模块 | 图标 | 颜色主题 |
|------|------|---------|
| 智能对话 | `MessageSquare` | primary (主色) |
| 配方生成 | `Sparkles` | blue (信息色) |
| 安全检查 | `Shield` | amber (警告色) |
| 协同分析 | `GitMerge` | emerald (成功色) |
| 口感预测 | `Cherry` | accent (强调色) |
| 稳定性预测 | `BarChart3` | neutral (中性色) |
| 配置管理 | `Settings` | primary (主色) |
| 模型状态 | `Bot` | emerald/red (在线/离线) |

---

## 5. 一致性检查清单

- [ ] 页面容器宽度: `max-w-7xl`
- [ ] 水平内边距: `px-4 sm:px-6 lg:px-8`
- [ ] 主要间距: `space-y-6`
- [ ] 进入动画: `animate-page-enter`
- [ ] 搜索栏结构完整
- [ ] 统计卡片网格布局正确
- [ ] 图标尺寸统一: `w-5 h-5` (统计卡片)
- [ ] 图标尺寸统一: `w-4 h-4` (标题图标)
- [ ] 色彩系统一致
- [ ] Badge样式一致
- [ ] Card组件样式一致
- [ ] 响应式布局正确

---

## 6. 交付物

1. ✅ 布局设计规范文档（本文档）
2. 图标资源配置代码
3. AI页面主组件优化代码
4. 子模块模板代码
5. 对比验证报告

