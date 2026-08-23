# ADR-027: Radix UI / shadcn/ui 设计系统迁移

**状态**: 已接受
**日期**: 2026-08-23
**领域**: 前端/UI/UX

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

- 新增依赖: `@radix-ui/react-{dialog,select,tabs,checkbox,switch,tooltip,toast,alert-dialog,progress,slider,command}` + `class-variance-authority` + `tailwindcss-animate`
- 新增文件: `src/components/ui/shadcn/*.tsx` (6 个组件)
- 现有组件: 保持不动，逐步替换导入
- 设计 Token: 完全保留，映射到 shadcn CSS 变量

## 迁移计划

| 阶段 | 组件 | 状态 |
|------|------|------|
| Phase 1 | Button, Dialog, Select, Tabs, Checkbox, Switch | ✅ 完成 |
| Phase 2 | Input, Textarea, Badge, Card, Skeleton, Progress, Tooltip, Toast, Alert | 待实施 |
| Phase 3 | CommandPalette, DataTable, OperationFeedback | 待实施 |
| Phase 4 | 页面级迁移 + 无障碍审计 | 待实施 |

## 替代方案

1. **直接 Radix 包装**: 更手动，但完全控制样式 — 放弃，shadcn 提供更好基线
2. **仅替换部分组件**: 不一致的 API — 放弃，shadcn 保证统一接口
3. **继续维护自研组件**: 技术债务持续增长 — 放弃

## 后续步骤

- 每个 Phase 完成后运行 TypeScript 检查和构建验证
- 每阶段结束后更新此 ADR 的状态
- Phase 4 完成后进行全面无障碍审计
