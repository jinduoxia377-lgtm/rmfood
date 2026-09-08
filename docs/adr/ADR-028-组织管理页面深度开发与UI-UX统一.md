# ADR-028: 组织管理页面深度开发与 UI/UX 统一

> Architecture Decision Record — 记录组织管理页面的深度开发决策

| # | 标题 | 状态 | 日期 | 领域 |
|:-:|:-----|:----:|:----:|:-----|
| 028 | [组织管理页面深度开发与 UI/UX 统一](./ADR-028-组织管理页面深度开发与UI-UX统一.md) | ✅ 已执行 | 2026-08-28 | 前端/UI/UX |

## 背景与动机

组织管理页面 (`/organizations`) 是 RMFOOD 平台的核心管理功能之一，但在开发过程中发现了以下问题：

1. **UI/UX 风格不一致**：各子组件间距过密，与 Dashboard 页面的宽松排版风格不统一
2. **功能缺失**：回收站为空占位、批量操作部分功能未实现、数据使用 Mock
3. **类型安全问题**：多处使用 `any` 类型，存在 TypeScript 编译隐患
4. **用户体验不足**：缺少 Logo 上传、邀请成员步骤、权限批量修改等功能

## 决策

### Phase 1: UI/UX 一致性修复

**目标**：对齐 Dashboard 页面设计标准，解决排版紧密问题

**变更内容**：
- 全局增加 `py-10` padding（原 `py-8`）
- 卡片间距从 `gap-5` 统一为 `gap-6`
- Section 间距从 `space-y-6` 统一为 `space-y-8`
- 表格行高从 `py-3` 统一为 `py-4` / `py-5`
- Tab 导航内边距从 `p-1` 统一为 `p-1.5`

**涉及文件**：
- `OrganizationsPage.tsx`
- `OrganizationList.tsx`
- `OrganizationDetail.tsx`
- `detail/OverviewTab.tsx`
- `detail/MembersTab.tsx`
- `detail/TeamsTab.tsx`
- `detail/ResourcesTab.tsx`
- `detail/SettingsTab.tsx`
- `detail/IntegrationsTab.tsx`
- `OrganizationAnalytics.tsx`
- `PermissionManager.tsx`
- `BulkOperationsPanel.tsx`
- `DataExportDialog.tsx`

### Phase 2: 功能补全

**2.1 回收站功能**
- 新增 `trashedOrganizations` 状态管理
- 实现 `fetchTrashedOrganizations()` API 调用
- 实现 `restoreOrganization()` 恢复功能
- 实现 `permanentDeleteOrganization()` 永久删除功能
- 更新 Trash Tab 显示真实数据和操作按钮

**2.2 批量操作完善**
- 实现批量归档 (`api.patch('/organizations/${id}/archive')`)
- 实现批量删除 (`api.delete('/organizations/${id}')`)
- 添加处理进度状态 (`isProcessing`)

**2.3 数据层真实化**
- `OrganizationAnalytics` 对接 `/organizations/analytics` API
- 保留 Mock 数据作为 fallback
- `OverviewTab` 活动记录基于真实成员数据生成

**2.4 创建向导增强**
- 新增 Logo 上传步骤（支持 Base64 预览）
- 新增邀请首名成员步骤
- 步骤指示器从 3 步扩展为 4 步

**2.5 集成配置完善**
- API 密钥管理从 `coming-soon` 升级为 `available`
- 添加 `ArrowRight` 图标替代 `Clock`

### Phase 3: 类型安全与代码质量

**变更内容**：
- 消除所有 `@ts-expect-error` 注释（原 2 处）
- 将 detail 组件中的 `organization: any` 替换为结构化类型定义
- 修复 `onToggleSelect` 参数类型不匹配问题

## 影响

| 维度 | 影响 |
|------|------|
| 用户可见 | 页面间距更宽松，视觉呼吸感更强；回收站可正常使用；批量操作可用 |
| 开发体验 | 类型安全提升，减少运行时错误；Mock 数据有 fallback 保障 |
| 性能 | 基本无变化（未引入虚拟滚动等重型优化） |
| 兼容性 | 向后兼容，不影响现有路由和接口 |

## 备选方案

1. **虚拟滚动**：考虑引入 `react-window` 实现大数据量下的虚拟滚动，但当前组织数量级较低，暂不引入额外依赖
2. **React Query 替代 useReducer**：考虑将 `useOrganizations` 迁移至 React Query，但当前状态管理可满足需求
3. **Full-page 回收站**：考虑将回收站独立为 `/organizations/trash` 路由，但当前 Tab 内嵌方式更简洁

## 后续行动

1. 后端 API `/organizations?status=deleted` 和 `/organizations/${id}/restore` 接口需同步实现
2. Analytics API `/organizations/analytics` 需后端数据支持
3. 考虑为大型组织添加分页虚拟滚动
