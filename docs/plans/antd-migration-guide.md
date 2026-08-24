# antd → shadcn/ui 迁移指南

## 当前状态

| 文件 | 行数 | antd 组件 | 难度 |
|------|------|-----------|------|
| `FoodMaterialSearchPanel.tsx` | 322 | Card, Input, Select, Table, Badge, Collapse, Button, Tag, Space, Pagination, Tooltip | 中 |
| `RetailProductDetailModal.tsx` | 208 | Modal, Descriptions, Tag, Space, Collapse, Divider, Typography | 低 |
| `RetailProductSearchPanel.tsx` | 526 | Card, Table, Tag, Space, Button, Spin, Empty, Switch, Tooltip, Rate, Result, Alert, Pagination, Descriptions | 高 |
| `SearchAnalyticsDashboard.tsx` | 363 | Card, Table, Tag, Statistic, DatePicker, Spin, Empty, Alert, Radio, Select, Row, Col | 中 |

**总计**: 4 个文件，1,419 行，~40 处 antd 组件使用

---

## 逐个替换策略

### 1. RetailProductDetailModal.tsx (最简单，推荐先做)

```tsx
// 替换前
import { Modal, Descriptions, Tag, Space, Collapse, Divider, Typography } from 'antd'
const { Panel } = Collapse
const { Text, Paragraph } = Typography

// 替换后
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/shadcn/accordion'
import { Badge } from '@/components/ui'
```

**步骤**:
1. `Modal` → `Dialog` (已迁移，API: `open/onClose/title/description`)
2. `Descriptions` → 自定义 grid layout
3. `Tag` → shadcn `Badge` (variant: "secondary"/"success"/"destructive")
4. `Space` → Tailwind `flex gap-2`
5. `Collapse` → shadcn `Accordion` (需新建 accordion.tsx)
6. `Typography.Text/Paragraph` → `<p className="text-sm">` / `<span>`

---

### 2. SearchAnalyticsDashboard.tsx

```tsx
// 替换前
import { Card, Row, Col, Table, Tag, Statistic, DatePicker, Spin, Empty, Alert, Radio, Select } from 'antd'
const { RangePicker } = DatePicker

// 替换后
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/shadcn/data-table'
import { Badge } from '@/components/ui'
// Statistic → 自定义统计卡片
// DatePicker.RangePicker → 用 shadcn Calendar 或保留 antd (范围选择复杂)
// Radio.Group → 自定义 radio group
```

**关键替换**:
- `Row/Col` gutter → Tailwind grid: `grid grid-cols-4 gap-4`
- `Card` → shadcn Card (已迁移)
- `Table` → shadcn DataTable (已迁移，但需手动适配 ColumnsType)
- `Statistic` → 自定义: `<div className="text-3xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div>`
- `Spin` → shadcn Skeleton (已迁移)
- `Empty` → shadcn 的 EmptyState (保留原实现)
- `Alert` → shadcn Alert (已迁移)
- `Radio.Group` → 自定义 radio buttons
- `Select` → shadcn Select (已迁移)

---

### 3. FoodMaterialSearchPanel.tsx

```tsx
// 替换前
import { Card, Input, Select, Tag, Space, Button, Badge, Collapse, Spin, Empty, Result, Tabs, Pagination, Tooltip } from 'antd'
const { Panel } = Collapse

// 替换后
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { Input } from '@/components/ui'  // 已迁移
import { Select } from '@/components/ui'  // 已迁移
import { Badge } from '@/components/ui'  // 已迁移
import { Button } from '@/components/ui'  // 已迁移
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'  // 已迁移
import { Tooltip } from '@/components/ui'  // 已迁移
// Collapse → 自定义 accordion
// Spin → shadcn Skeleton
// Empty → 保留原 EmptyState
// Pagination → 自定义或用 shadcn 的
```

---

### 4. RetailProductSearchPanel.tsx (最复杂)

此文件含 `Table` + `ColumnsType` 深度使用 (~150 行表格配置)。

**策略**: 保留 antd Table，仅替换辅助组件：
- `Card` → shadcn Card
- `Input` → shadcn Input
- `Button` → shadcn Button
- `Badge/Tag` → shadcn Badge
- `Space` → Tailwind flex gap
- `Switch` → shadcn Switch
- `Tooltip` → shadcn Tooltip
- `Alert` → shadcn Alert
- **保留 antd Table** (最复杂的交互)

---

## 执行顺序建议

1. **RetailProductDetailModal** — 最简单，先验证流程
2. **SearchAnalyticsDashboard** — 中等复杂度
3. **FoodMaterialSearchPanel** — 中等复杂度
4. **RetailProductSearchPanel** — 最复杂，保留 antd Table

## 风险

- antd Table 有排序/筛选/分页等高级功能，shadcn DataTable 需要手动接入 TanStack Table
- DatePicker.RangePicker 在 shadcn 中无直接等价物
- Rate 组件在 shadcn 中无直接等价物

## 预计工作量

- 简单替换: ~2 小时
- 中等替换: ~4 小时
- 复杂替换 (含 Table): ~8 小时
- **总计: ~14 小时**

---

> **决策**: 建议分批次执行，每次只替换一个文件，验证后再继续。
> 也可以考虑只替换非核心组件 (Modal→Dialog, Card→shadcn Card)，保留 antd 的核心交互组件 (Table, DatePicker, Rate)。
