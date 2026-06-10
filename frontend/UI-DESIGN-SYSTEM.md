# RMFOOD UI/UX 设计系统规范

> 基于 `ui-ux-design-system.html` 设计文档的完整实现

## 目录

1. [设计原则](#1-设计原则)
2. [颜色系统](#2-颜色系统)
3. [字体系统](#3-字体系统)
4. [响应式布局](#4-响应式布局)
5. [组件规范](#5-组件规范)
6. [交互设计](#6-交互设计)

---

## 1. 设计原则

### 1.1 核心价值

| 价值 | 描述 | 应用场景 |
|------|------|----------|
| **健康天然** | 森林绿为主色调，传达健康、天然的品牌理念 | 品牌标识、主按钮 |
| **科技精确** | 海洋蓝为辅色，代表科技和精确 | 数据可视化、链接 |
| **智能创新** | 生物紫为强调色，传达AI智能功能 | AI相关功能、AI按钮 |

### 1.2 设计目标

- **一致性**：所有页面遵循统一的设计语言
- **可扩展性**：组件化设计，便于扩展和维护
- **可访问性**：遵循 WCAG 2.1 AA 标准
- **响应式**：适配桌面端、平板、移动端

---

## 2. 颜色系统

### 2.1 品牌主色 - Nature Green 森林绿

```
RGB: 34, 197, 94 | HEX: #22C55E
```

| 色阶 | 用途 | CSS 变量 |
|------|------|----------|
| 50 | 极浅背景 | `--color-primary-50` |
| 100 | 浅背景 | `--color-primary-100` |
| 200 | 边框浅色 | `--color-primary-200` |
| 300 | 禁用背景 | `--color-primary-300` |
| 400 | 悬停状态 | `--color-primary-400` |
| 500 | 主色 | `--color-primary-500` |
| 600 | 深主色 | `--color-primary-600` |
| 700 | 深色 | `--color-primary-700` |
| 800 | 极深色 | `--color-primary-800` |
| 900 | 深色文字 | `--color-primary-900` |

### 2.2 品牌辅色 - Ocean Blue 海洋蓝

```
RGB: 59, 130, 246 | HEX: #3B82F6
```

传达：科技、精确、信赖、专业

### 2.3 品牌强调色 - Bio Purple 生物紫

```
RGB: 139, 92, 246 | HEX: #8B5CF6
```

传达：AI功能、智能、创新

### 2.4 功能色

| 状态 | 颜色 | HEX | 用途 |
|------|------|-----|------|
| Success | 绿色 | `#22C55E` | 成功、操作完成 |
| Warning | 橙色 | `#F59E0B` | 警告、待处理 |
| Error | 红色 | `#EF4444` | 错误、失败 |
| Info | 蓝色 | `#3B82F6` | 信息、提示 |

### 2.5 中性色 - Slate 灰阶

用于文本、背景、边框等界面元素。

| 级别 | 色阶 | 用途 |
|------|------|------|
| 50 | `#F8FAFC` | 页面背景 |
| 100 | `#F1F5F9` | 卡片背景 |
| 200 | `#E2E8F0` | 边框 |
| 300 | `#CBD5E1` | 禁用边框 |
| 400 | `#94A3B8` | 占位符文字 |
| 500 | `#64748B` | 辅助文字 |
| 600 | `#475569` | 次要文字 |
| 700 | `#334155` | 主要文字 |
| 800 | `#1E293B` | 深色文字 |
| 900 | `#0F172A` | 标题文字 |

### 2.6 深色模式颜色

```css
[data-theme="dark"] {
  --primary: var(--color-primary-400);      /* #86EFAC */
  --secondary: var(--color-secondary-400);  /* #60A5FA */
  --accent: var(--color-accent-400);        /* #A78BFA */
}
```

---

## 3. 字体系统

### 3.1 排版比例

采用 **Major Third (1.250)** 排版比例

### 3.2 字体大小级别

| 级别 | 像素 | rem | 行高 | 字间距 | 用途 |
|------|------|-----|------|--------|------|
| Display | 57px | 3.5625rem | 1.12 | -0.025em | 超大标题 |
| Display Small | 45px | 2.8125rem | 1.16 | -0.02em | 大标题 |
| Headline Large | 36px | 2.25rem | 1.22 | -0.015em | 主标题 |
| Headline Medium | 28px | 1.75rem | 1.28 | -0.01em | 副标题 |
| Headline Small | 24px | 1.5rem | 1.33 | 0 | 章节标题 |
| Title Large | 22px | 1.375rem | 1.36 | 0 | 小标题 |
| Title Medium | 16px | 1rem | 1.5 | 0 | 强调正文 |
| Title Small | 14px | 0.875rem | 1.43 | 0 | 正文 |
| Body Large | 16px | 1rem | 1.5 | 0.0015em | 大正文 |
| Body Medium | 14px | 0.875rem | 1.43 | 0 | 标准正文 |
| Body Small | 12px | 0.75rem | 1.33 | 0.002em | 小正文 |
| Label Large | 14px | 0.875rem | 1.43 | 0.01em | 大标签 |
| Label Medium | 12px | 0.75rem | 1.33 | 0.015em | 中标签 |
| Label Small | 11px | 0.6875rem | 1.45 | 0.025em | 小标签 |

### 3.3 字体系列

```css
--font-sans: 'Microsoft YaHei', 'PingFang SC', 'SimHei', system-ui, sans-serif;
--font-serif: 'Source Han Serif SC', 'SimSun', serif;
--font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
```

### 3.4 字体使用规范

| 场景 | 字体 | 大小 | 字重 | CSS 类 |
|------|------|------|------|--------|
| 页面标题 | Sans | 36px | 600 | `.text-headline-lg` |
| 卡片标题 | Sans | 22px | 600 | `.text-title-lg` |
| 正文 | Sans | 14px | 400 | `.text-body-md` |
| 辅助文字 | Sans | 12px | 400 | `.text-body-sm` |
| 按钮文字 | Sans | 14px | 500 | `.text-label-lg` |
| 代码 | Mono | 13px | 400 | `.text-code` |

---

## 4. 响应式布局

### 4.1 响应式断点

| 设备 | 断点 | 描述 |
|------|------|------|
| Mobile | < 640px | 手机设备 |
| Tablet | 640px - 1023px | 平板设备 |
| Desktop | 1024px - 1439px | 桌面设备 |
| Large Desktop | ≥ 1440px | 大屏幕设备 |

### 4.2 栅格系统

- **列数**：12列
- **间距**：24px (桌面) / 16px (移动)
- **最大宽度**：1440px

### 4.3 响应式容器

```css
.container {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 16px;  /* 移动端 */
}

@media (min-width: 640px) {
  .container { padding: 0 24px; }
}

@media (min-width: 1024px) {
  .container { padding: 0 32px; }
}
```

### 4.4 页面框架尺寸

| 元素 | 尺寸 |
|------|------|
| 页面最大宽度 | 1440px |
| 内容区域最大宽度 | 1200px |
| 侧边栏宽度（展开） | 256px |
| 侧边栏宽度（收起） | 64px |
| 卡片间距 | 24px |
| 页面边距（移动） | 16px |
| 页面边距（平板） | 24px |
| 页面边距（桌面） | 32px |

---

## 5. 组件规范

### 5.1 按钮 Button

| 类型 | 描述 | 使用场景 |
|------|------|----------|
| Primary | 主色背景，白色文字 | 主要操作 |
| Secondary | 次色背景，白色文字 | 次要操作 |
| Ghost | 透明背景，主色文字 | 辅助操作 |
| Danger | 红色背景，白色文字 | 危险操作 |
| AI | 紫色渐变背景 | AI相关功能 |
| Outline | 透明背景，主色边框 | 边框样式 |

**按钮尺寸**：
- `sm`: 高度 32px，内边距 12px
- `md`: 高度 36px，内边距 16px
- `lg`: 高度 40px，内边距 20px
- `xl`: 高度 48px，内边距 24px

### 5.2 卡片 Card

**变体**：
- `default`: 带阴影的卡片
- `outlined`: 带边框的卡片
- `glass`: 毛玻璃效果的卡片

**状态**：
- `hoverable`: 悬停时提升阴影
- 悬停效果：`-translate-y-0.5` + `shadow-lg`

### 5.3 输入框 Input

**状态**：
- Default：正常状态
- Focus：蓝色边框 + 阴影
- Error：红色边框 + 错误提示
- Disabled：灰色背景

**尺寸**：
- `sm`: 高度 32px，字体 12px
- `md`: 高度 36px，字体 14px
- `lg`: 高度 40px，字体 14px

### 5.4 导航栏 Navbar

**高度**：
- 移动端：56px
- 平板端：64px
- 桌面端：72px

**特性**：
- 固定顶部
- 响应式汉堡菜单
- 主题切换按钮

### 5.5 侧边栏 Sidebar

**宽度**：
- 收起状态：64px
- 展开状态：256px

**特性**：
- 固定左侧
- 可折叠
- 响应式隐藏/显示

---

## 6. 交互设计

### 6.1 过渡动画

| 元素 | 时长 | 缓动函数 |
|------|------|----------|
| 按钮悬停 | 150ms | ease |
| 主题切换 | 300ms | ease |
| 页面切换 | 200ms | ease-in-out |
| 下拉展开 | 150ms | ease-out |
| 模态框 | 200ms | ease-out |

### 6.2 微交互

**按钮**：
- 悬停：背景色加深 10%
- 点击：缩放 0.98
- 禁用：透明度 50%

**卡片**：
- 悬停：上移 2px + 阴影增强
- 点击：缩放 0.99

**输入框**：
- 聚焦：边框颜色变化 + 外阴影
- 错误：边框变红 + 抖动动画

### 6.3 状态反馈

| 状态 | 反馈方式 |
|------|----------|
| 加载中 | 旋转图标 + 禁用交互 |
| 成功 | 绿色提示 + 勾选动画 |
| 错误 | 红色提示 + 抖动动画 |
| 警告 | 橙色提示 |

### 6.4 无障碍支持

- 所有交互元素可通过键盘访问
- 使用 ARIA 标签
- 颜色对比度符合 WCAG 2.1 AA 标准
- 支持屏幕阅读器

---

## 附录

### A. CSS 变量速查表

```css
/* 品牌色 */
--primary: #22C55E;
--secondary: #3B82F6;
--accent: #8B5CF6;

/* 功能色 */
--success: #22C55E;
--warning: #F59E0B;
--error: #EF4444;
--info: #3B82F6;

/* 中性色 */
--gray-50: #F8FAFC;
--gray-100: #F1F5F9;
--gray-200: #E2E8F0;
--gray-300: #CBD5E1;
--gray-400: #94A3B8;
--gray-500: #64748B;
--gray-600: #475569;
--gray-700: #334155;
--gray-800: #1E293B;
--gray-900: #0F172A;

/* 文本色 */
--text-primary: #1E293B;
--text-secondary: #475569;
--text-muted: #64748B;

/* 间距 */
--spacing-1: 4px;
--spacing-2: 8px;
--spacing-3: 12px;
--spacing-4: 16px;
--spacing-6: 24px;
--spacing-8: 32px;
--spacing-12: 48px;
```

### B. 设计资源

- **图标库**：Lucide React
- **字体**：系统字体栈
- **阴影**：`--shadow-sm`, `--shadow-md`, `--shadow-lg`
- **圆角**：`--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`
