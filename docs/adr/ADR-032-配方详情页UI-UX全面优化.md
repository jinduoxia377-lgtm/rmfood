# ADR-032: 配方详情页UI-UX全面优化

> Architecture Decision Record — 配方详情页参照DashboardPage设计风格全面重构

| # | 标题 | 状态 | 日期 | 领域 |
|:-:|:-----|:----:|:----:|:-----|
| 032 | [配方详情页UI-UX全面优化](./ADR-032-配方详情页UI-UX全面优化.md) | ✅ 已执行 | 2026-08-28 | 前端/产品化 |

## 背景

`/formulas/:id` 页面已有完整功能实现，但UI风格与DashboardPage存在显著差异：排版偏紧、统计卡片缺乏视觉层次、卡片标题格式不统一、缺少横幅装饰等。用户要求参照DashboardPage设计风格进行全面优化。

## 决策

### 1. 整体布局重构

**修改前：**
```
max-w-7xl mx-auto space-y-4 md:space-y-6 px-4 md:px-0
```

**修改后（对齐DashboardPage）：**
```
space-y-5 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
```

### 2. 头部横幅设计

新增渐变顶条 + 四色统计卡片：
- 顶部渐变条：`h-1.5 bg-gradient-to-r from-primary-500 via-secondary-500 to-success-500`
- 四色统计卡片：成分数(primary)、总用量(secondary)、制作步骤(success)、版本数(violet)
- 每个卡片带图标容器 + 大字号数值

### 3. 字段卡片化（基本信息Tab）

- 每个字段组使用 `rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50` 包裹
- 标签改为 `uppercase tracking-wider` 小号灰色字体
- 新增 section 分隔条（彩色竖线 + 小标题）

### 4. 配方参数卡片配色

| 参数 | 配色 |
|------|------|
| 服用剂量 | amber（琥珀色） |
| 加工工艺 | sky（天蓝色） |
| 储藏条件 | cyan（青色） |
| 保质期 | emerald（翠绿） |

### 5. 独立Card模块统一

| 模块 | 改进 |
|------|------|
| 审核区域 | 添加渐变顶条 + 统一图标尺寸 |
| 评论区 | 图标容器改为 `w-9 h-9 rounded-xl bg-primary-50` |
| 活动时间线 | 图标改为主色调 + 统一间距 |
| 关联实验 | 图标容器统一 + CardHeader padding优化 |

### 6. 代码规范

- 修复emoji `⏱️` → `<Clock>` Lucide图标
- 补充缺失的 `HardDrive` 图标导入
- 移除旧版冗余的嵌套`</CardContent></Card>`闭合标签

## 修改文件清单

| 文件 | 变更内容 |
|------|----------|
| `src/pages/formula/FormualDetailPage.tsx` | 布局、横幅、统计卡片、字段卡片化、配色优化 |

## 影响评估

| 维度 | 影响 |
|------|------|
| 用户体验 | 视觉层次清晰，色彩编码辅助信息识别，与DashboardPage风格一致 |
| 性能 | 无显著影响，仅样式改动 |
| 兼容性 | 向后兼容，无功能变更 |

## 后续优化方向

1. 成分列表表格增加横向滚动和固定列
2. 制作步骤增加拖拽排序
3. 版本历史增加可视化合Diff面板
4. 相关推荐增加横向筛选标签栏
