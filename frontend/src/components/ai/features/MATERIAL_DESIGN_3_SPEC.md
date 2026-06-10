# RMFOOD智能对话模块 v9.0 - Material Design 3 组件规范

## 📋 文档概述

**文档版本**: v9.0.0  
**设计规范**: Material Design 3 (MD3)  
**适用范围**: AI智能对话模块所有UI组件  
**最后更新**: 2026-05-17

---

## 🏛️ Material Design 3 核心原则

### 1. 动态色彩系统
- 使用主题色彩生成器创建和谐的色彩方案
- 支持浅色/深色主题自动切换
- 色彩对比度符合WCAG 2.1 AA标准

### 2. 质感与光影
- 采用真实物理光照模型
- 阴影层级表达组件深度
- 圆角设计柔和自然

### 3. 交互反馈
- 悬停状态变化明显
- 点击反馈及时响应
- 过渡动画流畅自然

### 4. 排版层级
- 清晰的字体大小层级
- 行高和字间距优化
- 响应式字体缩放

---

## 🎨 色彩系统

### 主题色彩配置

| 色彩角色 | RMFOOD映射 | 色值 | 使用场景 |
|---------|-----------|------|----------|
| Primary | Forest Green | `#059669` | 主按钮、强调元素 |
| On Primary | White | `#FFFFFF` | 主按钮文字、图标 |
| Primary Container | Forest Green 100 | `#D1FAE5` | 选中状态背景 |
| On Primary Container | Forest Green 900 | `#064E3B` | 选中状态文字 |
| Secondary | Ocean Blue | `#2563EB` | 次要按钮、链接 |
| On Secondary | White | `#FFFFFF` | 次要按钮文字 |
| Tertiary | Bio Purple | `#7C3AED` | AI功能、特殊强调 |
| On Tertiary | White | `#FFFFFF` | AI功能文字 |
| Error | Danger | `#EF4444` | 错误状态、危险操作 |
| On Error | White | `#FFFFFF` | 错误状态文字 |
| Surface | White | `#FFFFFF` | 卡片背景 |
| On Surface | Gray 900 | `#111827` | 主要文字 |
| Surface Variant | Gray 100 | `#F3F4F6` | 次要背景 |
| On Surface Variant | Gray 600 | `#4B5563` | 次要文字 |
| Background | Gray 50 | `#F9FAFB` | 页面背景 |
| On Background | Gray 900 | `#111827` | 页面文字 |
| Outline | Gray 300 | `#D1D5DB` | 边框 |
| Outline Variant | Gray 200 | `#E5E7EB` | 次要边框 |

### 色彩使用规范

**主色调使用规则**
- 主按钮、主要操作使用 Primary 色
- 选中状态、高亮区域使用 Primary Container
- 确保文字与背景对比度 ≥4.5:1

**辅助色使用规则**
- 链接、可点击文字使用 Secondary 色
- AI相关功能、智能推荐使用 Tertiary 色
- 信息提示使用 Info 色

**功能色使用规则**
- 成功状态：Success 500 (`#10B981`)
- 警告状态：Warning 500 (`#F59E0B`)
- 错误状态：Error (`#EF4444`)
- 信息提示：Info 500 (`#3B82F6`)

---

## 📝 排版系统

### 字体配置

| 字体类型 | 字体名称 | 权重 | 用途 |
|---------|---------|------|------|
| Display | Noto Serif SC | 700 | 大标题 |
| Headline | Noto Serif SC | 600 | 章节标题 |
| Title | Noto Sans SC | 600 | 卡片标题 |
| Body | Noto Sans SC | 400 | 正文 |
| Label | Noto Sans SC | 500 | 标签、按钮 |
| Mono | JetBrains Mono | 400 | 数据、代码 |

### 字体大小层级

| 类型 | 桌面端 | 移动端 | 行高 | 字重 | 用途 |
|------|--------|--------|------|------|------|
| Display Large | 57px | 42px | 1.1 | 700 | 页面主标题 |
| Display Medium | 45px | 36px | 1.15 | 700 | 大标题 |
| Display Small | 36px | 30px | 1.2 | 700 | 次级标题 |
| Headline Large | 32px | 28px | 1.25 | 600 | 章节标题 |
| Headline Medium | 28px | 24px | 1.25 | 600 | 子章节标题 |
| Headline Small | 24px | 20px | 1.3 | 600 | 小标题 |
| Title Large | 22px | 18px | 1.35 | 600 | 卡片标题 |
| Title Medium | 16px | 16px | 1.4 | 500 | 标签、按钮 |
| Title Small | 14px | 14px | 1.4 | 500 | 小标签 |
| Body Large | 16px | 16px | 1.5 | 400 | 正文 |
| Body Medium | 14px | 14px | 1.5 | 400 | 次要文本 |
| Body Small | 12px | 12px | 1.5 | 400 | 辅助文本 |
| Label Large | 14px | 14px | 1.4 | 500 | 表单标签 |
| Label Medium | 12px | 12px | 1.4 | 500 | 小标签 |
| Label Small | 11px | 11px | 1.5 | 500 | 极小文本 |

### 排版使用规则

**标题层级**
- 每页仅使用一次 Display Large
- 章节使用 Headline Large/Medium/Small
- 卡片使用 Title Large/Medium

**正文排版**
- Body Large 用于主要内容
- Body Medium 用于次要内容
- Body Small 用于辅助说明

**数据展示**
- 使用等宽字体 JetBrains Mono
- 确保数字对齐整齐

---

## 🔲 组件规范

### 1. 按钮组件 (Button)

**变体类型**

| 变体 | 样式 | 色值 | 用途 |
|------|------|------|------|
| Filled | 填充背景 | Primary | 主要操作 |
| Filled Tonal | 柔和填充 | Primary Container | 次要操作 |
| Outlined | 边框 | Outline + On Surface | 辅助操作 |
| Text | 纯文字 | On Surface | 次要操作 |
| Elevated | 带阴影填充 | Surface | 浮层按钮 |

**尺寸配置**

| 尺寸 | 高度 | 水平内边距 | 字体大小 |
|------|------|-----------|----------|
| Extra Small | 32px | 12px | Label Small |
| Small | 36px | 16px | Label Medium |
| Medium | 40px | 24px | Label Large |
| Large | 48px | 32px | Body Medium |

**状态规范**

| 状态 | 样式变化 | 过渡时间 |
|------|---------|----------|
| Hover | 阴影增强 + Y偏移 -2px | 200ms |
| Pressed | 缩放 98% + 阴影减弱 | 100ms |
| Disabled | 50%透明度 + 不可点击 | - |
| Focused | 2px 聚焦环 | - |

**代码示例**

```tsx
interface ButtonProps {
  variant?: 'filled' | 'filled-tonal' | 'outlined' | 'text' | 'elevated'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  icon?: React.ReactNode
  children: React.ReactNode
  onClick?: () => void
}

function Button({ 
  variant = 'filled', 
  size = 'md', 
  disabled = false,
  loading = false,
  icon,
  children,
  onClick 
}: ButtonProps) {
  // MD3按钮实现
}
```

---

### 2. 卡片组件 (Card)

**变体类型**

| 变体 | 样式 | 用途 |
|------|------|------|
| Elevated | 带阴影 | 标准卡片 |
| Filled | 填充背景 | 内容卡片 |
| Outlined | 边框 | 信息卡片 |

**尺寸配置**

| 配置项 | 值 |
|--------|------|
| 圆角 | 12px (md) / 16px (lg) |
| 内边距 | 16px |
| 阴影 | Elevated: md |
| 边框 | Outlined: 1px Outline |

**结构规范**

```
Card
├── CardHeader (可选)
│   ├── Avatar (可选)
│   ├── Title
│   └── Subtitle
├── CardContent
│   └── 内容区域
├── CardActions (可选)
│   └── 操作按钮
└── CardMedia (可选)
    └── 图片区域
```

---

### 3. 输入框组件 (TextField)

**变体类型**

| 变体 | 样式 | 用途 |
|------|------|------|
| Outlined | 边框样式 | 标准输入 |
| Filled | 填充背景 | 搜索框 |

**状态规范**

| 状态 | 样式变化 |
|------|---------|
| Default | 边框 Outline |
| Focused | 边框 Primary + 浮动标签 |
| Error | 边框 Error |
| Disabled | 50%透明度 |

**尺寸配置**

| 配置项 | 值 |
|--------|------|
| 高度 | 56px |
| 圆角 | 12px |
| 内边距 | 16px |
| 标签浮动 | 聚焦时上移 |

---

### 4. 对话框组件 (Dialog)

**变体类型**

| 变体 | 样式 | 用途 |
|------|------|------|
| Alert | 居中弹窗 | 确认提示 |
| Full Screen | 全屏 | 详细表单 |
| Sheet | 底部滑入 | 操作菜单 |

**尺寸配置**

| 配置项 | 值 |
|--------|------|
| 最小宽度 | 280px |
| 最大宽度 | 560px |
| 圆角 | 28px (顶部) |
| 内边距 | 24px |

**结构规范**

```
Dialog
├── DialogTitle
├── DialogContent
└── DialogActions
    ├── Cancel Button
    └── Confirm Button
```

---

### 5. 导航组件 (Navigation)

**底部导航 (Navigation Bar)**

| 配置项 | 值 |
|--------|------|
| 高度 | 80px |
| 背景 | Surface |
| 图标大小 | 24px |
| 标签大小 | 12px |

**导航栏 (Top App Bar)**

| 配置项 | 值 |
|--------|------|
| 高度 | 64px |
| 背景 | Surface |
| 阴影 | sm |

---

### 6. 聊天气泡组件 (ChatBubble)

**变体类型**

| 变体 | 样式 | 用途 |
|------|------|------|
| User | 右侧气泡 | 用户消息 |
| Assistant | 左侧气泡 | AI回复 |
| System | 居中提示 | 系统消息 |

**尺寸配置**

| 配置项 | 值 |
|--------|------|
| 最大宽度 | 70% |
| 圆角 | 20px (用户) / 20px (助手) |
| 内边距 | 16px |
| 阴影 | sm |

**状态规范**

| 状态 | 样式变化 |
|------|---------|
| Loading | 打字指示器 |
| Error | 红色边框 |
| Success | 发送状态图标 |

---

### 7. 进度指示器 (Progress)

**线性进度条**

| 配置项 | 值 |
|--------|------|
| 高度 | 4px |
| 圆角 | 2px |
| 颜色 | Primary |

**圆形进度条**

| 配置项 | 值 |
|--------|------|
| 直径 | 48px |
| 线宽 | 4px |
| 颜色 | Primary |

**打字指示器**

| 配置项 | 值 |
|--------|------|
| 点数量 | 3 |
| 点大小 | 8px |
| 动画间隔 | 200ms |

---

## ✨ 交互与动画

### 状态过渡

| 过渡类型 | 持续时间 | 缓动函数 |
|---------|---------|---------|
| 快速 | 100ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| 标准 | 200ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| 慢速 | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| 复杂 | 500ms | `cubic-bezier(0.4, 0, 0.2, 1)` |

### 常用动画

**淡入淡出**
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

**滑入效果**
```css
@keyframes slideIn {
  from { 
    opacity: 0; 
    transform: translateY(20px); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
}
```

**缩放效果**
```css
@keyframes scaleIn {
  from { 
    opacity: 0; 
    transform: scale(0.95); 
  }
  to { 
    opacity: 1; 
    transform: scale(1); 
  }
}
```

---

## 📱 响应式设计

### 断点配置

| 断点 | 宽度 | 设备类型 |
|------|------|---------|
| xs | < 600px | 手机 |
| sm | 600px - 900px | 平板 |
| md | 900px - 1200px | 小桌面 |
| lg | 1200px - 1536px | 桌面 |
| xl | ≥ 1536px | 大桌面 |

### 布局适配

| 断点 | 布局策略 |
|------|---------|
| xs | 单列布局 |
| sm | 单列/双列 |
| md | 双列/三列 |
| lg | 三列/四列 |
| xl | 多列布局 |

---

## 🔧 设计令牌

### 间距系统

| 令牌 | 值 | 用途 |
|------|------|------|
| spacing-xs | 4px | 极短间距 |
| spacing-sm | 8px | 短间距 |
| spacing-md | 16px | 中等间距 |
| spacing-lg | 24px | 长间距 |
| spacing-xl | 32px | 超长间距 |
| spacing-2xl | 48px | 极大间距 |

### 圆角系统

| 令牌 | 值 | 用途 |
|------|------|------|
| radius-sm | 4px | 小元素 |
| radius-md | 8px | 中等元素 |
| radius-lg | 12px | 卡片 |
| radius-xl | 16px | 弹窗 |
| radius-full | 9999px | 圆形 |

### 阴影系统

| 令牌 | 值 | 用途 |
|------|------|------|
| shadow-sm | `0 1px 2px rgba(0,0,0,0.05)` | 轻微阴影 |
| shadow-md | `0 4px 14px rgba(5,150,105,0.25)` | 标准阴影 |
| shadow-lg | `0 8px 24px rgba(5,150,105,0.3)` | 强阴影 |
| shadow-xl | `0 12px 32px rgba(0,0,0,0.1)` | 极强阴影 |

---

## 📋 组件清单

### 基础组件
- [x] Button (按钮)
- [x] TextField (输入框)
- [x] Card (卡片)
- [x] Dialog (对话框)
- [x] Snackbar (提示条)
- [x] Chip (标签)
- [x] Badge (徽章)
- [x] Switch (开关)
- [x] Checkbox (复选框)
- [x] Radio (单选框)

### 布局组件
- [x] Top App Bar (顶部导航)
- [x] Navigation Bar (底部导航)
- [x] Navigation Rail (侧边导航)
- [x] Drawer (抽屉)
- [x] Layout Grid (布局网格)

### 数据组件
- [x] List (列表)
- [x] Data Table (数据表)
- [x] Progress Indicator (进度指示器)
- [x] Skeleton (骨架屏)

### 自定义组件
- [x] ChatBubble (聊天气泡)
- [x] MessageList (消息列表)
- [x] FormulaPanel (配方面板)
- [x] QuickActions (快捷操作)

---

## 👥 团队与贡献

**规范制定**: RMFOOD AI Assistant Team  
**审核人员**: [待补充]  
**文档版本**: 9.0.0  
**最后更新**: 2026-05-17