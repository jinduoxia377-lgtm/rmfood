# Card Typography Optimization Report

## 问题分析

### StatCard 组件 (frontend/src/components/ui/StatCard.tsx)

| 元素 | 优化前 | 优化后 | Apple HIG 标准 |
|------|--------|--------|----------------|
| 标签 | text-[11px] (11px) | text-xs (12px) + font-semibold | 12px caption-strong |
| 数值 | text-lg (18px) | text-xl (20px) | 20px body-strong |
| 副标题 | text-[11px] (11px) | text-xs (12px) | 12px caption |
| 图标 | w-6 h-6 (24px) | w-7 h-7 (28px) | 28px display |
| 内边距 | px-4 pt-3.5 pb-4 (16px) | px-5 pt-4 pb-5 (20px) | 24px Apple 标准 |
| 趋势文字 | font-medium (500) | font-normal (400) + leading-normal | 400/600 |
| 间距 | mb-1.5, gap-2.5 | mb-2, gap-3 | 8px/12px 系统 |

### 图表卡片 (HerbCategoryChart, PeptideActivityChart)

| 元素 | 优化前 | 优化后 |
|------|--------|--------|
| PeptideActivity 卡片内边距 | card p-5 | card p-6 |
| HerbCategory 卡片内边距 | card p-6 ✓ | card p-6 ✓ |

## Git 提交历史

```
52bbeef fix(database): 恢复缺失的闭合 div 标签
ad80561 fix(database): 移除多余的闭合 div 标签
173314b fix(database): 统一图表卡片内边距为 p-6 (Apple 24px 标准)
277ad9a feat(ui): StatCard 排版优化 - 符合 Apple HIG 规范
1166dff docs: 添加 DatabasePage 排版优化报告
1132390 feat(database): 排版优化 - 符合 Apple DESIGN.md 规范
```

## 验证结果

- ✓ StatCard BUILD OK - 120 lines
- ✓ DatabasePage BUILD OK - 1347 lines
- ✓ 所有检查项通过

## 设计原则

遵循 Apple HIG (Human Interface Guidelines) 排版规范:
1. **层级分明**: 标签 12px → 数值 20px → 副标题 12px
2. **字重克制**: 正文 400, 强调 600, 避免 500/700
3. **行高舒适**: 正文 1.5, 标题 1.25
4. **间距系统**: 4/8/12/16/24px Apple 标准
5. **内边距充足**: 卡片 24px, 按钮 16×10px
