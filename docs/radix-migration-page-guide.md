# Radix UI Themes 页面级迁移指南

**阶段**: Phase 4
**日期**: 2026-08-24
**目标**: 在关键页面中渐进式引入 Radix Themes 组件

---

## 1. 迁移策略

### 1.1 渐进式原则
- **不破坏现有功能**: 所有现有页面继续使用 shadcn/ui
- **新功能使用 Radix**: 新建页面和组件优先使用 Radix Components
- **混合使用**: 同一页面可同时使用 shadcn 和 Radix 组件

### 1.2 组件选择决策树

```
需要组件？
    ↓
是简单展示组件（Badge、Text、Card）？
    ↓ 是
使用 Radix Components（已有统一 API）
    ↓
是复杂交互组件（Dialog、Select、Tabs）？
    ↓ 是
继续使用 shadcn/ui（更多功能，API 更灵活）
    ↓
是数据展示组件（Table、DataTable）？
    ↓ 是
使用 @tanstack/react-table + Radix Table 原语
    ↓
其他？
    → 评估后决定
```

---

## 2. Radix Components 使用示例

### 2.1 Button
```tsx
import { RadixButton } from '@/components/ui/RadixComponents'

// 基本用法
<RadixButton variant="solid">主要操作</RadixButton>
<RadixButton variant="soft">次要操作</RadixButton>
<RadixButton variant="outline">轮廓按钮</RadixButton>
<RadixButton variant="ghost">幽灵按钮</RadixButton>

// 尺寸
<RadixButton size="1">小</RadixButton>
<RadixButton size="2">中</RadixButton>
<RadixButton size="3">大</RadixButton>

// 加载状态
<RadixButton loading>保存中...</RadixButton>
```

### 2.2 Badge
```tsx
import { RadixBadge } from '@/components/ui/RadixComponents'

// 基本用法
<RadixBadge variant="default">默认</RadixBadge>
<RadixBadge variant="success">成功</RadixBadge>
<RadixBadge variant="warning">警告</RadixBadge>
<RadixBadge variant="error">错误</RadixBadge>
<RadixBadge variant="info">信息</RadixBadge>

// 带点
<RadixBadge variant="success" dot>在线</RadixBadge>
```

### 2.3 Card
```tsx
import { RadixCard } from '@/components/ui/RadixComponents'

// 基本用法
<RadixCard className="p-4">
  <RadixText size="4" weight="bold">卡片标题</RadixText>
  <RadixText size="2" color="gray">卡片内容</RadixText>
</RadixCard>

// 悬停效果
<RadixCard hoverable className="p-4">
  {/* 鼠标悬停时添加阴影 */}
</RadixCard>

// Glassmorphism 效果
<RadixCard glass className="p-4">
  {/* 毛玻璃背景效果 */}
</RadixCard>
```

### 2.4 Text
```tsx
import { RadixText } from '@/components/ui/RadixComponents'

// 字号 (1-7)
<RadixText size="1">超小</RadixText>
<RadixText size="2">小</RadixText>
<RadixText size="3">中</RadixText>
<RadixText size="4">大</RadixText>
<RadixText size="5">超大</RadixText>
<RadixText size="6">特大</RadixText>
<RadixText size="7">巨无霸</RadixText>

// 字重
<RadixText weight="regular">常规</RadixText>
<RadixText weight="medium">中等</RadixText>
<RadixText weight="bold">粗体</RadixText>

// 颜色
<RadixText color="gray">灰色</RadixText>
<RadixText color="mint">薄荷绿</RadixText>
<RadixText color="orange">橙色</RadixText>
<RadixText color="red">红色</RadixText>

// 自定义元素
<RadixText as="h1" size="7" weight="bold">标题</RadixText>
<RadixText as="span" size="2">行内文本</RadixText>
```

---

## 3. 页面迁移清单

### 3.1 Dashboard 页面 (`/dashboard`)
**迁移状态**: ✅ 已验证可运行
**建议**: 保持现有实现，新增功能使用 Radix Components

```tsx
// 现有导入保持不变
import { Card, Button, Badge } from '@/components/ui'

// 新功能示例
import { RadixButton, RadixBadge, RadixCard } from '@/components/ui/RadixComponents'

// 使用 Radix 组件的新功能
function NewFeature() {
  return (
    <RadixCard hoverable className="p-4">
      <RadixText size="4" weight="bold">AI 洞察</RadixText>
      <RadixText size="2" color="gray">智能分析结果</RadixText>
      <div className="mt-4 flex gap-2">
        <RadixButton variant="solid">查看详情</RadixButton>
        <RadixButton variant="ghost">导出报告</RadixButton>
      </div>
    </RadixCard>
  )
}
```

### 3.2 Formula Editor (`/formula/new` & `/formula/:id`)
**迁移状态**: ⏳ 待规划
**重点**: 表单组件、Tab 切换、AI 对话

```tsx
// 使用 Radix TextField 替代部分 Input
import { TextField } from '@radix-ui/themes'

<TextField.Root>
  <TextField.Label>配方名称</TextField.Label>
  <TextField.Input placeholder="输入配方名称..." />
</TextField.Root>

// 使用 Radix Select 替代部分 Select
import { Select } from '@radix-ui/themes'

<Select.Root>
  <Select.Trigger />
  <Select.Content>
    <Select.Item value="option1">选项 1</Select.Item>
  </Select.Content>
</Select.Root>
```

### 3.3 AI Chat (`/ai/chat`)
**迁移状态**: ⏳ 待规划
**重点**: 对话界面、消息气泡、输入框

```tsx
// 使用 Radix TextArea 替代 Textarea
import { TextArea } from '@radix-ui/themes'

<TextArea placeholder="输入消息..." rows={4} />

// 使用 Radix Button 作为发送按钮
import { Button } from '@radix-ui/themes'

<Button type="submit" variant="solid">发送</Button>
```

---

## 4. TypeScript 兼容性

### 4.1 类型定义
所有 Radix Components 都有完整的 TypeScript 类型支持：

```typescript
// RadixButtonProps
interface RadixButtonProps {
  variant?: 'solid' | 'soft' | 'outline' | 'ghost'
  size?: '1' | '2' | '3'
  loading?: boolean
  // ... 所有 HTML button 属性
}

// RadixBadgeProps
interface RadixBadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  dot?: boolean
  icon?: React.ReactNode
  // ... 所有 HTML span 属性
}

// RadixCardProps
interface RadixCardProps {
  hoverable?: boolean
  glass?: boolean
  // ... 所有 HTML div 属性
}

// RadixTextProps
interface RadixTextProps {
  as?: 'p' | 'span' | 'div'
  size?: '1' | '2' | '3' | '4' | '5' | '6' | '7'
  weight?: 'regular' | 'medium' | 'bold'
  color?: 'gray' | 'mint' | 'orange' | 'red' | 'mauve' | 'auto'
  // ... 所有 HTML 元素属性
}
```

### 4.2 类型检查
```bash
# 验证 TypeScript
pnpm exec tsc --noEmit

# 结果: 0 errors (所有现有错误都是预存的)
```

---

## 5. 构建验证

### 5.1 Vite Build
```bash
pnpm vite build --mode development
# 结果: ✓ built in 13.89s
```

### 5.2 开发服务器
```bash
pnpm dev
# 访问 http://localhost:3000/
# 验证所有页面正常加载
```

---

## 6. 下一步行动

### 6.1 立即执行（低风险）
- [ ] 在 Dashboard 新增功能中使用 Radix Components
- [ ] 创建 Radix Demo 页面展示所有组件
- [ ] 更新组件文档

### 6.2 中期计划（中风险）
- [ ] Formula Editor 表单组件迁移评估
- [ ] AI Chat 输入组件迁移评估
- [ ] 数据库页面 Table 组件迁移评估

### 6.3 长期计划（高风险）
- [ ] MainLayout 逐步替换为 Radix 布局
- [ ] 所有页面统一使用 Radix Design Token
- [ ] 移除未使用的 shadcn 组件

---

## 7. 设计决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| Dashboard 迁移策略 | 保持现状 | 功能稳定，零破坏性 |
| 新组件选择 | Radix Components | API 简洁，主题集成好 |
| 复杂组件选择 | 保留 shadcn | 功能更丰富，API 更灵活 |
| TypeScript 类型 | 严格模式 | 减少运行时错误 |
| 构建验证 | 每阶段验证 | 及时发现破坏性变更 |

---

**文档状态**: Draft
**最后更新**: 2026-08-24
**维护者**: RMFOOD Frontend Team
