# RMFOOD 设计系统 v2.0

## 概述

RMFOOD设计系统是一个完整的、可扩展的设计系统，支持深色/浅色主题切换，专注于提供优秀的用户体验和可访问性。

## 目录

- [色彩系统](#色彩系统)
- [文字系统](#文字系统)
- [间距系统](#间距系统)
- [阴影层级](#阴影层级)
- [组件库](#组件库)
- [设计规范](#设计规范)

---

## 色彩系统

### 品牌色彩

#### Primary（翠绿色）
- `--color-primary-50`: `#ECFDF5`
- `--color-primary-100`: `#D1FAE5`
- `--color-primary-200`: `#A7F3D0`
- `--color-primary-300`: `#6EE7B7`
- `--color-primary-400`: `#34D399`
- `--color-primary-500`: `#10B981`
- `--color-primary-600`: `#059669`
- `--color-primary-700`: `#047857`
- `--color-primary-800`: `#065F46`
- `--color-primary-900`: `#064E3B`

#### Secondary（海洋蓝）
- `--color-blue-50`: `#EFF6FF`
- `--color-blue-100`: `#DBEAFE`
- `--color-blue-200`: `#BFDBFE`
- `--color-blue-300`: `#93C5FD`
- `--color-blue-400`: `#60A5FA`
- `--color-blue-500`: `#3B82F6`
- `--color-blue-600`: `#2563EB`
- `--color-blue-700`: `#1D4ED8`
- `--color-blue-800`: `#1E40AF`
- `--color-blue-900`: `#1E3A8A`

#### Accent（生物紫）
- `--color-accent-50`: `#F5F3FF`
- `--color-accent-100`: `#EDE9FE`
- `--color-accent-200`: `#DDD6FE`
- `--color-accent-300`: `#C4B5FD`
- `--color-accent-400`: `#A78BFA`
- `--color-accent-500`: `#8B5CF6`
- `--color-accent-600`: `#7C3AED`
- `--color-accent-700`: `#6D28D9`

### 语义色彩

#### Success（成功绿）
- `--color-success-50`: `#F0FDFA`
- `--color-success-500`: `#10B981`
- `--color-success-600`: `#059669`

#### Warning（警告橙）
- `--color-warning-50`: `#FFFBEB`
- `--color-warning-500`: `#F59E0B`
- `--color-warning-600`: `#D97706`
- `--color-warning-700`: `#B45309`
- `--color-warning-800`: `#92400E`
- `--color-warning-900`: `#78350F`

#### Danger（危险红）
- `--color-danger-50`: `#FEF2F2`
- `--color-danger-100`: `#FEE2E2`
- `--color-danger-200`: `#FECACA`
- `--color-danger-300`: `#FCA5A5`
- `--color-danger-400`: `#F87171`
- `--color-danger-500`: `#EF4444`
- `--color-danger-600`: `#DC2626`
- `--color-danger-700`: `#B91C1C`
- `--color-danger-800`: `#991B1B`
- `--color-danger-900`: `#7F1D1D`

#### Info（信息蓝）
- `--color-info-50`: `#EFF6FF`
- `--color-info-100`: `#DBEAFE`
- `--color-info-200`: `#BFDBFE`
- `--color-info-300`: `#93C5FD`
- `--color-info-400`: `#60A5FA`
- `--color-info-500`: `#3B82F6`
- `--color-info-600`: `#2563EB`
- `--color-info-700`: `#1D4ED8`
- `--color-info-800`: `#1E40AF`

### 中性色彩（Slate）
- `--color-neutral-50`: `#F8FAFC`
- `--color-neutral-100`: `#F1F5F9`
- `--color-neutral-200`: `#E2E8F0`
- `--color-neutral-300`: `#CBD5E1`
- `--color-neutral-400`: `#94A3B8`
- `--color-neutral-500`: `#64748B`
- `--color-neutral-600`: `#475569`
- `--color-neutral-700`: `#334155`
- `--color-neutral-800`: `#1E293B`
- `--color-neutral-900`: `#0F172A`

### 文本色彩
- `--text-primary`: 主要文本
- `--text-secondary`: 次要文本
- `--text-muted`: 辅助文本
- `--text-disabled`: 禁用文本

### 背景色彩
- `--bg-primary`: 主背景
- `--bg-secondary`: 次背景
- `--card-bg-solid`: 卡片背景
- `--hover-bg`: 悬停背景

### 边框色彩
- `--border-color`: 边框色

---

## 文字系统

### 标题层级

#### H1
- 字号: `2.25rem` (36px)
- 行高: `2.5rem` (40px)
- 字重: `700`
- 字间距: `-0.025em`

#### H2
- 字号: `1.875rem` (30px)
- 行高: `2.25rem` (36px)
- 字重: `700`
- 字间距: `-0.02em`

#### H3
- 字号: `1.5rem` (24px)
- 行高: `2rem` (32px)
- 字重: `600`
- 字间距: `-0.015em`

#### H4
- 字号: `1.25rem` (20px)
- 行高: `1.75rem` (28px)
- 字重: `600`
- 字间距: `-0.01em`

#### H5
- 字号: `1.125rem` (18px)
- 行高: `1.5rem` (24px)
- 字重: `600`
- 字间距: `-0.005em`

#### H6
- 字号: `0.875rem` (14px)
- 行高: `1.25rem` (20px)
- 字重: `600`
- 字间距: `0`

### 文本层级

#### Body Large
- 字号: `1rem` (16px)
- 行高: `1.625rem` (26px)
- 字重: `400`
- 类名: `text-body-lg`

#### Body
- 字号: `0.9375rem` (15px)
- 行高: `1.5rem` (24px)
- 字重: `400`
- 类名: `text-body`

#### Body Small
- 字号: `0.875rem` (14px)
- 行高: `1.375rem` (22px)
- 字重: `400`
- 类名: `text-body-sm`

#### Caption
- 字号: `0.75rem` (12px)
- 行高: `1.125rem` (18px)
- 字重: `400`
- 类名: `text-caption`

#### Tiny
- 字号: `0.625rem` (10px)
- 行高: `0.875rem` (14px)
- 字重: `400`
- 类名: `text-tiny`

#### Overline
- 字号: `0.6875rem` (11px)
- 行高: `1rem` (16px)
- 字重: `500`
- 字母间距: `0.05em`
- 大写: `uppercase`
- 类名: `text-overline`

---

## 间距系统

### 基础单位
基础间距单位为 `8px` (0.5rem)

### 间距变量
- `--space-0`: `0px`
- `--space-0.5`: `4px`
- `--space-1`: `8px`
- `--space-1.5`: `12px`
- `--space-2`: `16px`
- `--space-2.5`: `20px`
- `--space-3`: `24px`
- `--space-3.5`: `28px`
- `--space-4`: `32px`
- `--space-5`: `40px`
- `--space-6`: `48px`
- `--space-7`: `56px`
- `--space-8`: `64px`
- `--space-9`: `72px`
- `--space-10`: `80px`
- `--space-11`: `88px`
- `--space-12`: `96px`
- `--space-16`: `128px`
- `--space-20`: `160px`
- `--space-24`: `192px`

### 语义间距
- `--space-xs`: `var(--space-0.5)` (4px)
- `--space-sm`: `var(--space-1)` (8px)
- `--space-md`: `var(--space-2)` (16px)
- `--space-lg`: `var(--space-3)` (24px)
- `--space-xl`: `var(--space-4)` (32px)
- `--space-2xl`: `var(--space-6)` (48px)
- `--space-3xl`: `var(--space-8)` (64px)

### 工具类
- Padding: `p-{x}`, `px-{x}`, `py-{x}`, `pt-{x}`, `pb-{x}`, `pl-{x}`, `pr-{x}`
- Margin: `m-{x}`, `mx-{x}`, `my-{x}`, `mt-{x}`, `mb-{x}`, `ml-{x}`, `mr-{x}`

---

## 阴影层级

### 阴影变量
- `--shadow-sm`: 小阴影
- `--shadow-md`: 中阴影
- `--shadow-lg`: 大阴影
- `--shadow-xl`: 超大阴影

### 阴影参数
- `--shadow-sm`: `0 1px 2px 0 rgba(0, 0, 0, 0.05)`
- `--shadow-md`: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)`
- `--shadow-lg`: `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)`
- `--shadow-xl`: `0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)`

---

## 组件库

### Button 按钮

#### 变体 (Variants)
- `primary`: 主按钮 - 填充主色
- `secondary`: 次按钮 - 边框按钮
- `ghost`: 幽灵按钮 - 轻边框
- `danger`: 危险按钮 - 红色
- `ai`: AI按钮 - 紫蓝渐变

#### 尺寸 (Sizes)
- `sm`: 小按钮
- `md`: 中按钮 (默认)
- `lg`: 大按钮
- `xl`: 超大按钮

#### 状态
- 默认 (Default)
- 悬停 (Hover)
- 点击 (Active)
- 禁用 (Disabled)
- 加载 (Loading)

#### 使用示例
```tsx
<Button variant="primary" size="md">
  主要按钮
</Button>

<Button variant="secondary" size="md">
  次要按钮
</Button>

<Button variant="ghost" size="md">
  幽灵按钮
</Button>

<Button variant="danger" size="md">
  危险按钮
</Button>

<Button variant="ai" size="md">
  AI按钮
</Button>
```

### Input 输入框

#### 尺寸
- `sm`: 小输入框
- `md`: 中输入框 (默认)
- `lg`: 大输入框

#### 属性
- `error`: 错误状态
- `disabled`: 禁用状态
- `prefix`: 前缀图标
- `suffix`: 后缀图标

#### 使用示例
```tsx
<Input placeholder="请输入" size="md" />
<Input placeholder="请输入" error="输入错误" />
<Input placeholder="请输入" disabled />
<Input placeholder="请输入" prefix={<Search />} />
```

### Textarea 文本域

#### 属性
- `autoResize`: 自动调整高度
- `error`: 错误状态

#### 使用示例
```tsx
<Textarea placeholder="请输入内容" />
<Textarea placeholder="请输入内容" autoResize />
```

### Card 卡片

#### 变体
- `default`: 默认卡片
- `outlined`: 边框卡片

#### 其他属性
- `hoverable`: 可悬停
- `glass`: 玻璃态

#### 子组件
- `CardHeader`: 卡片头部
- `CardTitle`: 卡片标题
- `CardDescription`: 卡片描述
- `CardContent`: 卡片内容
- `CardFooter`: 卡片底部

#### 使用示例
```tsx
<Card hoverable>
  <CardHeader>
    <CardTitle>卡片标题</CardTitle>
    <CardDescription>卡片描述</CardDescription>
  </CardHeader>
  <CardContent>
    卡片内容
  </CardContent>
  <CardFooter>
    卡片底部
  </CardFooter>
</Card>
```

### Badge 徽章

#### 变体
- `primary`: 主要
- `secondary`: 次要
- `success`: 成功
- `warning`: 警告
- `danger`: 危险
- `info`: 信息
- `neutral`: 中性
- `draft`: 草稿
- `pending`: 待处理
- `approved`: 已批准
- `rejected`: 已拒绝
- `revision`: 修订
- `archived`: 已归档

#### 使用示例
```tsx
<Badge variant="primary">Primary</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
```

### Alert 提示

#### 变体
- `success`: 成功
- `warning`: 警告
- `danger`: 危险
- `info`: 信息

#### 使用示例
```tsx
<Alert variant="success">
  成功提示
</Alert>
```

### Modal 弹窗

#### 使用示例
```tsx
<Modal isOpen={isOpen} onClose={onClose}>
  <ModalContent>
    弹窗内容
  </ModalContent>
</Modal>
```

### Progress 进度条

#### 使用示例
```tsx
<Progress value={50} max={100} />
```

### Checkbox 复选框

#### 使用示例
```tsx
<Checkbox checked={checked} onChange={onChange}>
  选项
</Checkbox>
```

### Tabs 标签页

#### 使用示例
```tsx
<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">标签1</TabsTrigger>
    <TabsTrigger value="tab2">标签2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">内容1</TabsContent>
  <TabsContent value="tab2">内容2</TabsContent>
</Tabs>
```

### EmptyState 空状态

#### 使用示例
```tsx
<EmptyState
  icon={<Search />}
  title="未找到结果"
  description="尝试其他搜索词"
  action={
    <Button onClick={onReset}>重置</Button>
  }
/>
```

---

## 设计规范

### 可访问性 (Accessibility)
- **对比度**: 文本与背景对比度≥4.5:1 (WCAG AA)
- **键盘导航**: 所有交互元素支持键盘操作
- **焦点**: 清晰的焦点状态
- **语义化**: 使用合适的HTML标签

### 响应式断点
- **移动**: <768px
- **平板**: 768px - 1023px
- **桌面**: ≥1024px

### 圆角 (Radius)
- `--radius-sm`: 4px
- `--radius-md`: 8px (默认)
- `--radius-lg`: 12px
- `--radius-xl`: 16px
- `--radius-2xl`: 24px
- `--radius-full`: 9999px (圆角)

### 过渡动画
- 默认过渡时间: `0.2s`
- 过渡函数: `ease`
- 支持属性: `background-color`, `color`, `border-color`, `box-shadow`, `opacity`, `transform`

### 主题切换
- 支持深色/浅色主题自动切换
- 平滑的主题过渡动画
- CSS变量动态更新

---

## 版本控制

### 当前版本
v2.0

### 更新日志
- v2.0: 完整重构，新增深色模式、响应式系统、组件库
- v1.0: 初始版本

---

## 设计资源

### Figma
Figma设计文件请参考内部设计资源库

### 设计资源导出
- SVG图标
- 颜色配置
- 组件变体

---

## 团队协作流程

### 设计走查
1. 设计初稿完成
2. 开发团队预评估
3. 设计走查会议
4. 迭代优化
5. 最终确认

### 组件验收标准
- 功能完整
- 主题适配
- 响应式
- 可访问性
- 文档完善

---

## 联系方式
设计团队: design@rmfood.com
开发团队: dev@rmfood.com
