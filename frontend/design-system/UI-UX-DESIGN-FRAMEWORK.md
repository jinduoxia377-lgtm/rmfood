# RMFOOD 配方制作平台 — UI/UX 专业设计框架

> 版本 2.0 | 2026-04-14
> 面向药食同源功能性食品的专业配方研发平台

---

## 一、设计哲学与定位

### 1.1 核心原则

**科学严谨**：作为医药食品研发平台，视觉语言必须传达可信感与精确性。避免过度活泼或轻浮的视觉元素，色彩和排版要体现实验室级别的专业度。

**信息密度平衡**：研究人员需要在有限屏幕空间内获取大量数据。设计要在信息密度和可读性之间找到平衡点——紧凑但不拥挤，丰富但不混乱。

**效率优先**：日常高频操作（搜索配方、查看实验状态、AI对话）必须 2 步内可达。减少不必要的点击层级，让工具感而非展示感成为主导。

**渐进式复杂度**：简单任务简单完成（一键查询），复杂任务有足够的深度支持（多维筛选、数据导出、AI辅助分析）。

### 1.2 品牌调性

| 维度 | 描述 |
|------|------|
| 关键词 | 专业、科学、可信、优雅 |
| 情感联想 | 实验室、中药材、分子结构、精密仪器 |
| 视觉隐喻 | 草本纹理、分子连线、数据流、自然色调 |
| 差异化 | 医疗级的严谨 + 东方药学的文化底蕴 |

---

## 二、信息架构

### 2.1 全局导航结构

```
RMFOOD 配方平台
├── 工作台 (Dashboard)          — 首页、数据概览、快捷操作
├── 配方管理 (Formulas)         — CRUD、审核流程、版本管理
│   ├── 配方列表
│   ├── 新建配方
│   └── 配方详情 / 编辑
├── 实验管理 (Experiments)      — 实验全生命周期
│   ├── 实验列表
│   ├── 新建实验
│   └── 实验详情 / 编辑
├── AI 智能助手 (AI)            — 四大 AI 能力
│   ├── 智能对话
│   ├── 配方生成
│   ├── 安全检查
│   └── 协同分析
├── 数据库检索 (Database)       — 五大数据中心
│   ├── 中药材 (TCMSP)
│   ├── 活性肽 (DFBP)
│   ├── 知识图谱
│   ├── 药食同源目录
│   └── 数据管理/同步
├── 用户管理 (Users)            — 仅 admin 可见
└── 系统设置 (Settings)         — 个人资料 / 密码 / 主题
```

### 2.2 页面层级

| 层级 | 说明 | 典型页面 |
|------|------|---------|
| L0: 入口 | 无需登录 | LoginPage |
| L1: 概览 | 信息聚合与导航 | DashboardPage |
| L2: 列表 | 数据浏览与筛选 | FormulaListPage, ExperimentListPage |
| L3: 详情 | 单项深度操作 | FormulaDetailPage, ExperimentDetailPage |
| L3: 工具 | 独立功能模块 | AIAssistantPage, DatabasePage |
| L4: 设置 | 用户配置 | SettingsPage, UserManagementPage |

---

## 三、设计系统 (Design Tokens)

### 3.1 色彩体系

**主色 (Primary)**: 采用中医草本色调——深沉的青绿（Teal），传达自然、医药、可信赖感。

```
Light Mode                          Dark Mode
─────────────────────────────────    ─────────────────────────────────
primary-50:  #F0FDFA                primary-50:  rgba(20,184,166,0.08)
primary-100: #CCFBF1                primary-100: rgba(20,184,166,0.15)
primary-200: #99F6E4                primary-200: rgba(20,184,166,0.22)
primary-300: #5EEAD4                primary-300: rgba(20,184,166,0.35)
primary-400: #2DD4BF                primary-400: #2DD4BF
primary-500: #14B8A6                primary-500: #2DD4BF  (略提亮)
primary-600: #0D9488                primary-600: #14B8A6
primary-700: #0F766E                primary-700: #2DD4BF
primary-800: #115E59                primary-800: #5EEAD4
primary-900: #134E4A                primary-900: #99F6E4
```

**语义色彩 (Semantic)**:

| 用途 | Light | Dark | 说明 |
|------|-------|------|------|
| 成功/通过 | emerald-500 (#10B981) | emerald-400 (#34D399) | 审核通过、操作成功 |
| 警告/待处理 | amber-500 (#F59E0B) | amber-400 (#FBBF24) | 待审核、注意事项 |
| 错误/拒绝 | rose-500 (#F43F5E) | rose-400 (#FB7185) | 审核拒绝、错误提示 |
| 信息/链接 | sky-600 (#0284C7) | sky-400 (#38BDF8) | 链接、提示信息 |
| 中性/归档 | slate-400 (#94A3B8) | slate-500 (#64748B) | 已归档、取消 |

**表面色彩 (Surface)**:

| 元素 | Light | Dark |
|------|-------|------|
| 页面背景 | slate-50 (#F8FAFC) | slate-950 (#020617) |
| 卡片背景 | white (#FFFFFF) + shadow | slate-900/80 (#0F172A/80%) |
| 玻璃态 | white/80 + blur(16px) | slate-900/60 + blur(16px) |
| 侧边栏 | white + border-r | slate-900 + border-r |
| 顶栏 | white/90 + blur(12px) + border-b | slate-900/90 + blur(12px) + border-b |
| 输入框 | white + border | slate-800 + border |

### 3.2 排版体系

**字体选择**:
- 标题字体: Inter (西文) + Noto Sans SC (中文) — 现代科学感
- 正文字体: Inter (西文) + Noto Sans SC (中文) — 高可读性
- 等宽字体: JetBrains Mono — 用于数据展示、代码

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');

--font-sans: 'Inter', 'Noto Sans SC', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

**排版比例 (Type Scale)**:

| 层级 | 字号 | 字重 | 行高 | 用途 |
|------|------|------|------|------|
| Display | 2.25rem (36px) | 700 | 1.2 | 页面主标题 (H1) |
| H2 | 1.5rem (24px) | 600 | 1.3 | 区块标题 |
| H3 | 1.125rem (18px) | 600 | 1.4 | 卡片标题 |
| H4 | 1rem (16px) | 600 | 1.4 | 子标题 |
| Body | 0.875rem (14px) | 400 | 1.6 | 正文内容 |
| Body-lg | 0.9375rem (15px) | 400 | 1.6 | 较长正文 |
| Caption | 0.75rem (12px) | 400 | 1.5 | 辅助说明 |
| Overline | 0.6875rem (11px) | 500 | 1.4 | 标签、徽章 |

### 3.3 间距系统

采用 4px 基准网格：

```
space-1:  4px   — 图标与文字间距
space-2:  8px   — 紧凑元素间距
space-3:  12px  — 相关元素间距
space-4:  16px  — 标准间距
space-5:  20px  — 区块内间距
space-6:  24px  — 区块间距
space-8:  32px  — 大区块间距
space-10: 40px  — 页面级间距
space-12: 48px  — 大模块分隔
```

### 3.4 圆角系统

```
rounded-sm:   6px   — 标签、徽章
rounded-md:   8px   — 按钮、小输入框
rounded-lg:   12px  — 卡片、下拉菜单
rounded-xl:   16px  — 大卡片、模态框
rounded-2xl:  20px  — 玻璃态容器
rounded-full: 9999px — 头像、药丸按钮
```

### 3.5 阴影体系

```
Light Mode:
shadow-sm:   0 1px 2px rgba(0,0,0,0.04)
shadow-md:   0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)
shadow-lg:   0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)
shadow-xl:   0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)

Dark Mode:
shadow-sm:   0 1px 2px rgba(0,0,0,0.2)
shadow-md:   0 4px 6px rgba(0,0,0,0.3)
shadow-lg:   0 10px 15px rgba(0,0,0,0.35)
shadow-xl:   0 20px 25px rgba(0,0,0,0.4)
```

### 3.6 动效规范

```css
/* 时长规范 */
--duration-fast:   150ms  — hover/press 微交互
--duration-normal: 200ms  — 状态切换
--duration-slow:   300ms  — 页面过渡、展开收起

/* 缓动函数 */
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1)  — 弹出/展开 (推荐)
--ease-in:     cubic-bezier(0.4, 0, 1, 1)     — 收起/消失
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)   — 通用过渡

/* prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 四、布局系统

### 4.1 整体布局 (MainLayout)

```
┌──────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────────────────────────┐  │
│  │          │  │  Header (56px sticky)        │  │
│  │  Logo    │  │  [汉堡] [面包屑] [搜索] [通知]│  │
│  │──────────│  ├──────────────────────────────┤  │
│  │          │  │                              │  │
│  │  Nav     │  │  Page Content                │  │
│  │  Items   │  │  (scrollable)                │  │
│  │          │  │                              │  │
│  │          │  │  max-w-7xl mx-auto           │  │
│  │──────────│  │                              │  │
│  │  User    │  │                              │  │
│  │  Card    │  │                              │  │
│  └──────────┘  └──────────────────────────────┘  │
│   w-64 (256px)       flex-1                      │
└──────────────────────────────────────────────────┘
```

**断点规则**:
- `lg (1024px+)`: 侧边栏常驻 + 主内容区
- `md (768px-1023px)`: 侧边栏折叠为图标模式 (w-16)
- `<768px`: 侧边栏隐藏，汉堡菜单触发抽屉

### 4.2 页面内容模板

每个页面遵循统一的内容结构：

```tsx
<div className="max-w-7xl mx-auto space-y-6">
  {/* 1. 页面标题区 */}
  <PageHeader
    title="配方管理"
    description="管理所有药食同源配方"
    actions={<Button>新建配方</Button>}
  />

  {/* 2. 工具栏（可选） */}
  <Toolbar>
    <SearchInput />
    <FilterGroup />
    <ViewToggle />
  </Toolbar>

  {/* 3. 主内容区 */}
  <Content>
    {/* 列表/表格/网格 */}
  </Content>

  {/* 4. 分页（可选） */}
  <Pagination />
</div>
```

### 4.3 内容最大宽度

| 场景 | 宽度 |
|------|------|
| 标准页面 | max-w-7xl (1280px) |
| 表单/设置 | max-w-3xl (768px) |
| AI对话面板 | max-w-5xl (1024px) |
| 图表大屏 | max-w-full (100%) |

---

## 五、组件规范

### 5.1 按钮 (Button)

```tsx
// 尺寸变体
<Btn size="sm">  // h-8 px-3 text-xs
<Btn size="md">  // h-9 px-4 text-sm  (默认)
<Btn size="lg">  // h-10 px-5 text-sm
<Btn size="xl">  // h-11 px-6 text-base

// 视觉变体
<Btn variant="primary">    // bg-primary-600 text-white
<Btn variant="secondary">  // bg-white border border-gray-300 text-gray-700
<Btn variant="ghost">      // text-gray-600 hover:bg-gray-100
<Btn variant="danger">     // bg-rose-600 text-white

// 状态
<Btn loading>     // 显示 spinner + disabled
<Btn disabled>    // opacity-50 cursor-not-allowed
```

### 5.2 卡片 (Card)

```tsx
<Card>                     // 标准卡片
<Card hoverable>           // 可点击卡片 (hover 提升效果)
<Card glass>               // 玻璃态卡片
<Card variant="outlined">  // 边框卡片
```

卡片内容布局规范：
- 内边距: p-5 (20px) 或 p-6 (24px)
- 标题 + 描述间距: space-y-1 (4px)
- 标题与正文间距: mt-3 (12px)
- 多卡片网格间距: gap-4 (16px)

### 5.3 输入框 (Input)

```tsx
<Input                    // 标准输入框 h-9
<Input size="lg">         // h-10 (表单主输入)
<Input prefix={<Search />} />  // 带前缀图标
<Input suffix={<Clear />} />  // 带后缀按钮
<Textarea />              // 多行文本域
<Select />                // 下拉选择
```

**输入框状态**:
- 默认: border-gray-300 bg-white
- Focus: border-primary-500 ring-2 ring-primary-500/20
- Error: border-rose-500 ring-2 ring-rose-500/20 + 错误提示
- Disabled: bg-gray-50 text-gray-400 cursor-not-allowed

### 5.4 标签页 (Tabs)

```tsx
<Tabs defaultValue="tab1">
  <TabsList>               // 灰色胶囊容器
    <TabsTrigger value="tab1">标签1</TabsTrigger>  // 选中: bg-white shadow
    <TabsTrigger value="tab2">标签2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">内容1</TabsContent>
  <TabsContent value="tab2">内容2</TabsContent>
</Tabs>
```

**标签页风格**:
- 容器: bg-gray-100 rounded-xl p-1
- 未选: transparent text-gray-500 hover:text-gray-700
- 选中: bg-white shadow-sm rounded-lg text-gray-900 font-medium
- 切换动画: transition-all duration-200

### 5.5 状态标签 (StatusBadge)

```
draft:          灰色    bg-slate-100 text-slate-600
pending_review: 琥珀色  bg-amber-100 text-amber-700
approved:       翠绿色  bg-emerald-100 text-emerald-700
rejected:       玫红色  bg-rose-100 text-rose-700
archived:       浅灰色  bg-slate-50 text-slate-500
planned:        蓝色    bg-sky-100 text-sky-700
in_progress:    紫色    bg-violet-100 text-violet-700
completed:      翠绿色  bg-emerald-100 text-emerald-700
failed:         玫红色  bg-rose-100 text-rose-700
cancelled:      浅灰色  bg-slate-50 text-slate-500
```

### 5.6 空状态 (EmptyState)

```tsx
<EmptyState
  icon={<FlaskConical size={48} />}
  title="暂无配方数据"
  description="点击下方按钮创建您的第一个配方"
  action={<Button>新建配方</Button>}
/>
```

### 5.7 加载状态

- **骨架屏**: 优先使用，匹配目标内容布局
- **Spinner**: 用于按钮内加载、小区域加载
- **全屏加载**: 页面级数据加载时，使用居中 spinner

### 5.8 通知/消息

- **Toast**: 操作成功/失败反馈（右上角 3s 自动消失）
- **Inline Message**: 表单验证错误（字段下方）
- **Alert Block**: 重要提示（页面顶部横幅）

---

## 六、页面级设计规范

### 6.1 LoginPage 登录页

**布局**: 左右分栏 (lg+), 左侧品牌展示区 60%, 右侧登录表单 40%

**品牌区**:
- 背景: 从 primary-700 到 primary-900 的渐变
- 叠加: 中药材分子结构 SVG 纹理 (opacity 10-15%)
- 内容: Logo + 品牌标语 + 3 个核心卖点
- 底部: 版本号 v1.0

**登录表单**:
- 容器: glass-card, max-w-md, 居中
- 表单元素: 圆角输入框 (rounded-xl)
- 按钮: 全宽 primary 按钮 + shadow
- 辅助: 默认账号提示

### 6.2 DashboardPage 仪表盘

**布局**: 单列垂直流式

**区块顺序**:
1. 欢迎横幅 (渐变背景, 带纹理)
2. 统计卡片 (4 列网格)
3. 图表区 (2:1 比例 — 趋势图占 2 列, 饼图占 1 列)
4. 活动列表 (2 列 — 最近配方 + 最近实验)
5. 快捷入口 (网格布局)

**图表规范**:
- 背景: 白色卡片
- 网格线: stroke-dasharray="3 3", stroke=#e5e7eb
- Tooltip: 玻璃态背景, 圆角 12px
- 图表色彩: 2-3 色, 主题色为主

### 6.3 FormulaListPage 配方列表

**布局**: 页头 + 工具栏 + 列表 + 分页

**工具栏**: glass-card 容器
- 左侧: 搜索框 (带图标)
- 右侧: 状态筛选标签组 + 新建按钮

**列表卡片**:
- 水平布局: 标题区 (flex-1) + 日期 (shrink)
- hover: shadow-lg + translateY(-1px)
- 标签: 目标功效标签组 (最多显示 4 个)

### 6.4 AIAssistantPage AI 智能助手

**布局**: 页头 + 标签页 + 内容区

**对话面板**:
- 高度: calc(100vh - 280px), flex 纵向布局
- 消息气泡: 用户右对齐 (primary 背景), AI 左对齐 (白卡片)
- 输入区: textarea + 发送/停止按钮
- 快捷问题: 空状态时显示，药丸按钮

**配方生成结果**:
- 3 列网格
- 每个结果卡片包含: 雷达图 + 评分网格 + 药材列表 + 安全标签

### 6.5 DatabasePage 数据库检索

**布局**: 页头 + 5 标签页 + 内容

**标签页特色**:
- 药材: 表格 + 详情展开
- 活性肽: 表格 + 颜色编码活性标签
- 知识图谱: 可视化网络图
- 药食同源: 分类浏览
- 数据管理: 同步状态 + 操作按钮

### 6.6 SettingsPage 系统设置

**布局**: 窄容器 max-w-3xl, 垂直标签页

**标签页**:
- 个人资料: 头像 + 表单网格
- 修改密码: 安全图标 + 3 个密码字段
- 主题切换: 3 选 1 卡片 (浅色/深色/跟随系统)

---

## 七、交互设计规范

### 7.1 微交互

| 元素 | 触发 | 反馈 | 时长 |
|------|------|------|------|
| 按钮 | hover | bg 变深 + shadow 增大 | 150ms |
| 按钮 | press | scale(0.98) | 100ms |
| 卡片 | hover | shadow-lg + translateY(-1px) | 200ms |
| 链接 | hover | text 变 primary 色 | 150ms |
| 图标按钮 | hover | bg-gray-100 | 150ms |
| 导航项 | active | bg-primary-50 + 文字变色 | 200ms |

### 7.2 过渡动画

```css
/* 页面入场 */
.page-enter {
  opacity: 0;
  transform: translateY(8px);
}
.page-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all 300ms var(--ease-out);
}

/* 标签切换 */
.tab-content-enter {
  opacity: 0;
}
.tab-content-active {
  opacity: 1;
  transition: opacity 200ms ease;
}

/* 模态框 */
.modal-overlay {
  opacity: 0;
  transition: opacity 200ms;
}
.modal-overlay.active {
  opacity: 1;
}
.modal-content {
  transform: scale(0.95) translateY(10px);
  transition: transform 200ms var(--ease-out);
}
.modal-content.active {
  transform: scale(1) translateY(0);
}
```

### 7.3 加载反馈

- 操作 < 300ms: 无需加载指示
- 操作 300ms-2s: 按钮 spinner + 文字变化
- 操作 > 2s: 骨架屏 + 进度提示
- 页面初始加载: 顶部进度条 (nprogress 风格)

---

## 八、深色模式规范

### 8.1 实现策略

使用 Tailwind `dark:` 变体 + CSS class 切换策略。

```tsx
// 主题切换 (设置页)
function applyTheme(mode: 'light' | 'dark' | 'system') {
  const resolved = mode === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    : mode
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  localStorage.setItem('theme', mode)
}
```

### 8.2 深色模式调整要点

- 卡片: 白色 → slate-900/80 + 玻璃态
- 文字: gray-900 → gray-100
- 次要文字: gray-500 → gray-400
- 边框: gray-200 → gray-800
- 背景: gray-50 → slate-950
- 图表网格线: #e5e7eb → rgba(75,85,99,0.3)
- 阴影: 加深透明度 (0.07 → 0.3)

### 8.3 玻璃态 (Glassmorphism) 统一规范

```css
/* Light Mode */
.glass-card {
  @apply bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-md;
}

/* Dark Mode */
.dark .glass-card {
  @apply bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl shadow-lg;
}
```

---

## 九、无障碍 (Accessibility) 规范

### 9.1 目标: WCAG 2.1 AA

| 要求 | 标准 | 实现方式 |
|------|------|---------|
| 文本对比度 | 4.5:1 (正文), 3:1 (大字) | 所有色彩组合已验证 |
| 键盘导航 | 完整 Tab 导航 | 焦点环: ring-2 ring-primary-500 ring-offset-2 |
| ARIA 标签 | 图标按钮 | aria-label 属性 |
| 表单标签 | 关联 label | <label for=""> 或 aria-labelledby |
| 跳转链接 | Skip to content | 页面顶部隐藏的跳转链接 |
| 减少动效 | prefers-reduced-motion | CSS media query 禁用动画 |
| 触摸目标 | 44x44px 最小 | 按钮和链接内边距保证 |

### 9.2 焦点状态

```css
/* 所有可交互元素 */
:focus-visible {
  outline: none;
  ring: 2px;
  ring-color: var(--color-primary-500);
  ring-offset: 2px;
}
```

---

## 十、响应式设计规范

### 10.1 断点

```
sm:  640px   — 手机横屏/小平板
md:  768px   — 平板
lg:  1024px  — 桌面 (侧边栏常驻)
xl:  1280px  — 大屏
2xl: 1536px  — 超大屏
```

### 10.2 关键响应式调整

| 组件 | < 768px | 768px-1023px | >= 1024px |
|------|---------|-------------|-----------|
| 侧边栏 | 隐藏 (抽屉) | 图标模式 w-16 | 完整 w-64 |
| 统计卡片 | 2 列 | 2 列 | 4 列 |
| 图表 | 1 列堆叠 | 1 列堆叠 | 2:1 比例 |
| 表格 | 水平滚动 | 正常 | 正常 |
| 对话面板 | 全高 | calc(100vh-200px) | calc(100vh-280px) |

---

## 十一、图标系统

**图标库**: Lucide React (已在项目中使用)

**图标尺寸规范**:

| 用途 | 尺寸 | 示例 |
|------|------|------|
| 导航图标 | 18px (size={18}) | 侧边栏菜单 |
| 操作图标 | 16px (size={16}) | 按钮内图标 |
| 页面标题图标 | 20px (size={20}) | 区块标题旁 |
| 空状态图标 | 48px (size={48}) | EmptyState |
| 品牌图标 | 22-32px | Logo, 品牌区 |

**严禁**: 使用 emoji 作为 UI 图标 (如 🔬 🧪 ⚙️)

---

## 十二、当前问题诊断与升级计划

### 12.1 当前 UI 问题

| 问题 | 严重性 | 影响范围 |
|------|--------|---------|
| 色彩体系不一致 (primary 用绿色而非设计系统的 teal) | 中 | 全局 |
| SettingsPage 使用 blue-600 而非 primary | 中 | 设置页 |
| AI页面使用 emerald 色而非统一的 primary | 中 | AI 助手 |
| 缺少统一的 Button 组件 (内联样式) | 中 | 全局 |
| 缺少 Skip to content 链接 | 低 | 无障碍 |
| 部分卡片缺少 cursor-pointer | 低 | 交互 |
| 分页组件样式较基础 | 低 | 列表页 |
| 缺少 Toast 通知组件 | 中 | 全局 |

### 12.2 升级优先级

1. **P0 (必须)**: 统一色彩体系 — 所有 primary 引用改用 teal 色调
2. **P0 (必须)**: 建立公共组件库 (Button, Card, Input, Tabs, Modal, Toast)
3. **P1 (重要)**: 升级 MainLayout 侧边栏视觉
4. **P1 (重要)**: 统一所有页面的色彩与样式
5. **P2 (优化)**: 添加动效系统和过渡动画
6. **P2 (优化)**: 完善无障碍支持
7. **P3 (锦上添花)**: 添加微交互和高级动画效果

---

## 十三、技术实现参考

### 13.1 Tailwind CSS v4 配置

```css
/* index.css */
@import "tailwindcss";

@theme {
  /* Primary - Teal 色调 */
  --color-primary-50: #F0FDFA;
  --color-primary-100: #CCFBF1;
  --color-primary-200: #99F6E4;
  --color-primary-300: #5EEAD4;
  --color-primary-400: #2DD4BF;
  --color-primary-500: #14B8A6;
  --color-primary-600: #0D9488;
  --color-primary-700: #0F766E;
  --color-primary-800: #115E59;
  --color-primary-900: #134E4A;

  /* Accent - 用于强调/CTA */
  --color-accent-500: #0D9488;
  --color-accent-600: #0F766E;

  /* 字体 */
  --font-sans: 'Inter', 'Noto Sans SC', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* 动效 */
  --animate-fade-in: fade-in 0.3s ease-out;
  --animate-slide-up: slide-up 0.3s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 13.2 组件文件结构

```
components/
├── ui/                    # 基础 UI 组件
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Textarea.tsx
│   ├── Select.tsx
│   ├── Tabs.tsx
│   ├── Modal.tsx
│   ├── Toast.tsx
│   ├── Badge.tsx
│   ├── Skeleton.tsx
│   ├── EmptyState.tsx
│   ├── Pagination.tsx
│   ├── StatusBadge.tsx
│   ├── PageHeader.tsx
│   └── Toolbar.tsx
├── layout/                # 布局组件
│   ├── MainLayout.tsx
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   └── UserCard.tsx
├── formula/               # 配方相关组件
├── experiment/            # 实验相关组件
└── charts/                # 图表封装组件
    ├── TrendChart.tsx
    ├── StatusPieChart.tsx
    ├── ExperimentBarChart.tsx
    └── ScoreRadar.tsx
```
