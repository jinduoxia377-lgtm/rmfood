# ADR-027: Radix UI / shadcn/ui 设计系统迁移

**状态**: 已执行完成
**日期**: 2026-08-23
**最新更新**: 2026-08-27 (全部完成，0 TS 错误，antd 完全移除)
**领域**: 前端/UI/UX

---

## 背景

RMFOOD 前端目前有 ~38 个自研 UI 组件（~5,100 行代码），部分依赖 antd。组件质量参差不齐，无障碍支持不统一，维护成本高。

## 决策

采用 shadcn/ui + Radix UI primitives 作为新的组件基础层，分阶段迁移现有组件。

## 理由

1. **无障碍优先**: Radix UI 内置完整的 ARIA 属性和键盘导航
2. **全权控制**: shadcn 组件是"复制粘贴"式，完全可定制
3. **与现有栈兼容**: Tailwind v4 + CSS 自定义属性 + lucide-react
4. **渐进迁移**: 每阶段独立验证，不影响现有功能
5. **社区质量**: shadcn/ui 经过大规模社区验证

## 影响范围

- 新增依赖: `@radix-ui/themes@3.3.0` + 11 个 Radix 原语包
- 新增文件: `src/components/ui/shadcn/*.tsx` (21 个组件)
- 新增组件: `RadixBadge`, `RadixText` (品牌封装)
- 现有组件: 保持不动，逐步替换导入
- 设计 Token: 完全保留，映射到 shadcn CSS 变量

## 迁移计划

| 阶段 | 组件 | 状态 |
|------|------|------|
| Phase 1 | Button, Dialog, Select, Tabs, Checkbox, Switch | ✅ 已完成 |
| Phase 2 | Input, Textarea, Badge, Card, Skeleton, Progress, Tooltip, Toast, Alert | ✅ 已完成 |
| Phase 3 | CommandPalette, DataTable, OperationFeedback | ✅ 已完成 |
| Phase 4 | 页面级迁移 + 无障碍审计 | ✅ 已完成 |
| 补全 | InputProps 类型修复, Tooltip API 兼容性 | ✅ 已完成 |
| antd 清理 | FoodMaterialSearchPanel, RetailProductSearchPanel, SearchAnalyticsDashboard | ✅ 已完成 |
| TS 错误修复 | 114 个错误 → 0 | ✅ 已完成 |
| Landing Page 升级 | 全面重新设计 | ✅ 已完成 |

## 交付成果

### 已迁移组件 (21 个 shadcn)
```
accordion, alert, badge, button, card, checkbox, collapsible,
data-table, dialog, dropdown-menu, input, operation-feedback,
popover, progress, radio-group, select, skeleton, switch,
tabs, textarea, toast, tooltip
```

### 新增 Radix 封装
- `RadixBadge`: 使用 Radix Themes Badge，支持 dot/icon
- `RadixText`: 使用 Radix Themes Text，支持 7 级字号

### 测试覆盖
- ARIA 无障碍测试: 87 个断言
- 组件测试: shadcn-components.test.tsx
- 页面演示: `/radix-demo`

## 设计 Token 映射

| Radix Theme | RMFOOD Token |
|-------------|--------------|
| accentColor="cyan" | Forest Green (#059669) |
| grayColor="mauve" | Neutral Grays |
| radius="medium" | --radius-md (8px) |
| appearance="light/dark" | theme mode |

## 完成状态 (2026-08-27)

### TypeScript
```
TypeScript:    0 错误 (原 114 个)
```

### antd 清理
```
antd 源码引用: 0 (原 4 个文件)
```

### 生产构建
```
Vite Build:    ✓ 通过 (36s)
向后兼容:      ✓ 100%
```

### Git 提交
```
提交数:        9 commits
分支:          main
```

## 遗留类型工作区 (7 处，必要妥协)

| 文件 | 类型 | 原因 |
|------|------|------|
| `Input.tsx:4` | `@ts-ignore` | React 19 InputHTMLAttributes.size 从 string 改为 number |
| `shadcn/input.tsx:4` | `@ts-ignore` | 同上 |
| `Card.tsx:34` | `as any` | 动态组件类型推断限制 |
| `RadixComponents.tsx:38,71,73` | `as any` | Radix Themes props 类型过宽 (27+ 颜色) |
| `Select.tsx:19` | `as any` | forwardRef 类型限制 |

**分析结论**: 这些是 React 19 + Radix Themes 3.x 的结构性限制，无法在不破坏功能的情况下消除。

## 后续步骤

1. ✅ 每个 Phase 完成后运行 TypeScript 检查和构建验证
2. ✅ 每阶段结束后更新此 ADR 的状态
3. ✅ Phase 4 完成后进行全面无障碍审计
4. ✅ antd 清理完成
5. ✅ TS 错误全部修复
6. 📋 可选: Lighthouse 性能审计
7. 📋 可选: Bundle size 分析
8. 📋 可选: 组件使用文档
