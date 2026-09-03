# Card Typography Optimization Report

## 优化范围

### 涉及的模块
1. 药材分类分布 (HerbCategoryChart)
2. 活性肽类型分布 (PeptideActivityChart)
3. 数据质量评分 (DataQualityPanel)
4. 快速操作 (QuickActions)
5. 性能指标 (PerformancePanel)
6. 口服生物利用度(OB)分布 (OBDistributionChart)
7. 类药性(DL)分布 (DLDistributionChart)
8. 序列长度分布 (SeqLengthDistributionChart)
9. 统计卡片 (StatCardGrid + StatCard)

## Git 提交历史

```
1d7bdc0 feat(ui): 卡片文字排版专业级优化 - 符合 Apple HIG 规范
e6c1440 docs: 添加 Card Typography Optimization 报告
52bbeef fix(database): 恢复缺失的闭合 div 标签
ad80561 fix(database): 移除多余的闭合 div 标签
173314b fix(database): 统一图表卡片内边距为 p-6
277ad9a feat(ui): StatCard 排版优化 - 符合 Apple HIG 规范
```

## 详细优化内容

### 1. StatCard 组件 (frontend/src/components/ui/StatCard.tsx)

| 元素 | 优化前 | 优化后 | Apple HIG 标准 |
|------|--------|--------|----------------|
| 标签 | text-[11px] | text-xs (12px) + font-semibold | 12px caption-strong |
| 数值 | text-lg (18px) | text-xl (20px) | 20px body-strong |
| 副标题 | text-[11px] | text-xs (12px) | 12px caption |
| 图标 | w-6 h-6 (24px) | w-7 h-7 (28px), size 13→14 | 28px display |
| 内边距 | px-4 pt-3.5 pb-4 (16px) | px-5 pt-4 pb-5 (20px) | 24px Apple 标准 |
| 趋势文字 | font-medium (500) | font-normal (400) + leading-normal | 400/600 |
| 间距 | mb-1.5, gap-2.5 | mb-2, gap-3 | 8px/12px 系统 |

### 2. StatCardGrid (DashboardOverview.tsx)

| 元素 | 优化前 | 优化后 |
|------|--------|--------|
| 标题 | text-[10px] | text-xs (12px) + font-semibold |
| 数值 | text-lg (18px) | text-xl (20px) |
| 单位 | text-[10px] | text-xs (12px) + font-semibold |
| 趋势 | text-[10px] | text-xs (12px) |

### 3. ProgressRing (DashboardOverview.tsx)

| 元素 | 优化前 | 优化后 |
|------|--------|--------|
| 标签 | text-[10px] | text-xs (12px) + font-semibold |
| 上边距 | mt-0.5 | mt-1 |

### 4. DataQualityPanel

| 元素 | 优化前 | 优化后 |
|------|--------|--------|
| 标题 | text-[13px] font-semibold tracking-tight | text-xs font-semibold tracking-wider uppercase |

### 5. QuickActions

| 元素 | 优化前 | 优化后 |
|------|--------|--------|
| 按钮文字 | text-[13px] | text-sm (14px) + font-semibold |
| 图标 | w-[18px] h-[18px] | w-5 h-5 (20px) |
| 下拉菜单 | text-[13px] | text-sm (14px) |

### 6. PerformancePanel

| 元素 | 优化前 | 优化后 |
|------|--------|--------|
| 数值 | [font-size:26px] | text-2xl (24px) |
| 标签 | text-[13px] | text-xs (12px) + font-semibold |
| 单位 | [font-size:15px] | text-sm (14px) |

### 7. 图表组件 (OB/DL/Seq Distribution)

| 元素 | 优化前 | 优化后 |
|------|--------|--------|
| XAxis/YAxis tick | fontSize: 9 | fontSize: 12 |
| Tooltip | fontSize: 12 | fontSize: 13 |
| Legend | fontSize: 11 | fontSize: 12 |
| CardTitle | text-sm | text-base (16px) |
| Bar radius | [0,4,4,0] 或 [4,4,0,0] | [4,4,4,4] 统一 |

### 8. HerbCategoryChart & PeptideActivityChart

| 元素 | 优化前 | 优化后 |
|------|--------|--------|
| Legend 文字 | text-xs | text-sm (14px) |
| Tooltip | fontSize: 12 | fontSize: 13 |
| 图例圆点 | w-2.5 h-2.5 (10px) | w-3 h-3 (12px) |
| 间距 | gap-1.5 | gap-2 |
| 最小宽度 | min-w-[120px] | min-w-[140px] |

## 设计原则

遵循 Apple HIG (Human Interface Guidelines) 排版规范:
1. **层级分明**: 标签 12px → 数值 20-24px → 副标题 12px
2. **字重克制**: 正文 400, 强调 600, 避免 500/700
3. **行高舒适**: 正文 1.5, 标题 1.25
4. **间距系统**: 4/8/12/16/24px Apple 标准
5. **内边距充足**: 卡片 20-24px, 按钮 16×12px
6. **图标尺寸**: 16-28px 根据上下文选择

## 验证结果

- ✓ StatCard BUILD OK (120 lines)
- ✓ DashboardOverview BUILD OK (1913 lines)
- ✓ DatabasePage BUILD OK (1347 lines)
- ✓ 所有检查项通过

## 文件变更

| 文件 | 变更 |
|------|------|
| frontend/src/components/ui/StatCard.tsx | 10 处修改 |
| frontend/src/pages/database/DashboardOverview.tsx | 39 处修改 |
| frontend/src/pages/database/DatabasePage.tsx | 7 处修改 |
