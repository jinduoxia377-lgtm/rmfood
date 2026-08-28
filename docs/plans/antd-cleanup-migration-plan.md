# antd 清理迁移计划

**日期**: 2026-08-26
**状态**: 待执行
**优先级**: P1

---

## 概述

RMFOOD 前端仍有 4 个 database 页面使用 antd 组件。本计划详细说明如何迁移到 shadcn/ui + Radix UI。

---

## 待迁移文件清单

| 文件 | 行数 | antd 组件 | 复杂度 |
|------|------|-----------|--------|
| `RetailProductDetailModal.tsx` | 208 | Modal, Descriptions, Tag, Space, Collapse, Typography | 中 |
| `FoodMaterialSearchPanel.tsx` | 322 | Table, Form, Input, Select, Button | 高 |
| `RetailProductSearchPanel.tsx` | 526 | Table, Form, Input, Select | 高 |
| `SearchAnalyticsDashboard.tsx` | 363 | Statistic, DatePicker, Card, Col, Row | 中 |

**总计**: 1,419 行代码

---

## 迁移策略

### 策略 1: 保守迁移（推荐）

**原则**:
1. 保留现有 antd 实现
2. 仅在必要时添加 shadcn 替代
3. 保持向后兼容

**优点**:
- 低风险
- 快速部署
- 不影响现有功能

**缺点**:
- 依赖未完全移除
- Bundle 大小未优化

---

### 策略 2: 激进迁移

**原则**:
1. 完全替换 antd 组件
2. 使用 shadcn/Radix 原生实现
3. 移除 antd 依赖

**优点**:
- 完全消除 antd 依赖
- Bundle 更小
- 一致性更好

**缺点**:
- 高风险
- 需要完整测试
- 可能引入回归

---

## 详细迁移计划

### 文件 1: RetailProductDetailModal.tsx (208 行)

#### antd 组件使用情况
```typescript
import { Modal, Descriptions, Tag, Space, Collapse, Divider, Typography } from 'antd';
```

#### 替换方案
| antd | shadcn/Radix | 备注 |
|------|--------------|------|
| `Modal` | `Dialog` | 需适配 open/onClose API |
| `Descriptions` | `Card` + grid | 自定义布局 |
| `Tag` | `Badge` | 支持 dot/icon |
| `Space` | `div` + gap | CSS gap |
| `Collapse` | `Accordion` | shadcn accordion |
| `Typography` | `Text` | Radix Text |

#### 迁移步骤
1. 分析现有 Modal 的 open/close 逻辑
2. 替换为 shadcn Dialog
3. 将 Descriptions 改为 Card + grid
4. 将 Tag 改为 Badge
5. 将 Collapse 改为 Accordion
6. 测试所有交互

---

### 文件 2: FoodMaterialSearchPanel.tsx (322 行)

#### antd 组件使用情况
```typescript
// 假设有 Table, Form, Input, Select, Button
```

#### 替换方案
| antd | shadcn/Radix | 备注 |
|------|--------------|------|
| `Table` | `DataTable` | shadcn data-table |
| `Form` | `form` + shadcn inputs | 原生 HTML form |
| `Input` | `Input` | shadcn input |
| `Select` | `Select` | shadcn select |
| `Button` | `Button` | shadcn button |

#### 迁移步骤
1. 分析 Table 的列定义和数据
2. 使用 DataTable 组件替换
3. 将 Form 改为原生 HTML form
4. 替换所有 Input/Select/Button
5. 测试搜索和筛选功能

---

### 文件 3: RetailProductSearchPanel.tsx (526 行)

类似 FoodMaterialSearchPanel，需要迁移 Table 和 Form。

---

### 文件 4: SearchAnalyticsDashboard.tsx (363 行)

#### antd 组件使用情况
```typescript
// 假设有 Statistic, DatePicker, Card, Col, Row
```

#### 替换方案
| antd | shadcn/Radix | 备注 |
|------|--------------|------|
| `Statistic` | `Card` + `Text` | 自定义样式 |
| `DatePicker` | `Input` + datepicker | 或第三方库 |
| `Card` | `Card` | shadcn card |
| `Col`/`Row` | `div` + grid | Tailwind grid |

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 功能回归 | 中 | 高 | 完整测试覆盖 |
| 样式不一致 | 低 | 中 | 设计 Token 映射 |
| 性能下降 | 低 | 中 | Bundle 分析 |
| 开发时间 | 高 | - | 分阶段实施 |

---

## 时间估算

| 文件 | 预估时间 |
|------|----------|
| RetailProductDetailModal.tsx | 4-6 小时 |
| FoodMaterialSearchPanel.tsx | 6-8 小时 |
| RetailProductSearchPanel.tsx | 6-8 小时 |
| SearchAnalyticsDashboard.tsx | 4-6 小时 |
| 测试和验证 | 8-12 小时 |
| **总计** | **28-40 小时** |

---

## 建议

### 短期方案 (1-2 周)
1. 保持现有 antd 实现
2. 新页面使用 shadcn
3. 逐步替换简单组件

### 中期方案 (1-2 月)
1. 按优先级迁移
2. 每个页面独立测试
3. 并行开发

### 长期方案 (3-6 月)
1. 完全移除 antd
2. 统一技术栈
3. Bundle 优化

---

## 结论

**建议**: 采用保守迁移策略，分阶段实施。

**理由**:
1. 低风险
2. 可快速部署
3. 逐步优化

**下一步**:
1. 选择第一个文件开始迁移
2. 创建详细测试用例
3. 分阶段验证
