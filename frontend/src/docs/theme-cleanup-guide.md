# RMFOOD 主题系统清理指南

## 审查结论

项目当前存在 **5 套主题系统** 并存，导致：
- 代码重复严重（颜色定义、CSS 变量、类型定义多处重复）
- 维护困难（修改一个系统需要同步其他 4 个）
- 运行时性能下降（多个 Provider 叠加、重复 localStorage 读写）
- 打包体积膨胀（未使用的代码也被打包）

## 保留的核心系统（Zustand + Provider）

| 文件 | 用途 | 状态 |
|------|------|------|
| `stores/themeStore.ts` | Zustand 状态管理 | ✅ 保留 |
| `stores/ThemeProvider.tsx` | React Context Provider | ✅ 保留 |
| `stores/theme.presets.ts` | 预设主题配置（9个预设） | ✅ 保留 |
| `stores/theme.storage.ts` | 持久化存储 | ✅ 保留 |
| `types/theme.types.ts` | 类型定义 | ✅ 保留 |
| `theme/index.ts` | 统一导出 | ✅ 保留 |

这两套主题（Light/Dark）通过 `presetThemes` 中的 `light-*` 和 `dark-*` 前缀实现，
支持 8 个预设主题 × 2 个明暗模式 = 16 种组合。

## 需要删除的文件

### 1. 完全未使用的代码

```
design-system/theme-manager.ts          # 独立类，无任何外部引用
design-system/ThemeProvider.tsx          # 另一个 Provider，无外部引用
design-system/components/ThemeSwitcher.tsx  # 旧版组件，无外部引用
hooks/useThemePersistence.ts             # Zustand 已有持久化
hooks/useThemeQuery.ts                   # 无人引用
hooks/useThemeSubscription.ts            # 事件总线，无人引用
hooks/useCustomTheme.ts                  # 独立主题系统，无人引用
config/theme.config.ts                   # 导出但无人消费（仅被 legacy hook 使用）
types/custom-theme.types.ts              # 仅被 useCustomTheme 使用
hooks/theme-system-implementation.md     # 过时文档
styles/tokens.css                        # 全注释文件
styles/colors.css                        # 变量已在 index.css 定义
styles/generated/                        # 自动生成目录
styles.backup/                           # 三层嵌套备份
stores/__tests__/themeStore.test.ts      # 测试文件（如需保留测试请重写）
```

### 2. 需要重构的文件

```
hooks/useTheme.tsx                       # 1455行 → 简化为薄兼容层
hooks/index.ts                           # 移除已删除文件的导出
config/index.ts                          # 移除 PROFESSIONAL_THEMES 导出
```

## 一键清理命令

在项目根目录运行：

```powershell
cd D:\RMFOOD配方平台\frontend\src

# 删除完全未使用的目录和文件
Remove-Item -Recurse -Force "styles.backup"
Remove-Item -Recurse -Force "styles\generated"
Remove-Item -Force "styles\tokens.css"
Remove-Item -Force "styles\colors.css"
Remove-Item -Force "hooks\useThemePersistence.ts"
Remove-Item -Force "hooks\useThemeQuery.ts"
Remove-Item -Force "hooks\useThemeSubscription.ts"
Remove-Item -Force "hooks\useCustomTheme.ts"
Remove-Item -Force "config\theme.config.ts"
Remove-Item -Force "types\custom-theme.types.ts"
Remove-Item -Force "hooks\theme-system-implementation.md"
Remove-Item -Force "design-system\theme-manager.ts"
Remove-Item -Force "design-system\ThemeProvider.tsx"
Remove-Item -Force "design-system\components\ThemeSwitcher.tsx"
Remove-Item -Force "stores\__tests__\themeStore.test.ts"

# 删除 design-system 目录（整个目录无外部引用）
Remove-Item -Recurse -Force "design-system"
```

## 需要修改的文件

### 1. hooks/index.ts
删除以下导出行：
```typescript
// 删除这行
export { useTheme } from './useTheme';
export { useThemePersistence } from './useThemePersistence';
```

### 2. config/index.ts
删除以下导出行：
```typescript
// 删除这行
export { PROFESSIONAL_THEMES } from './theme.config';
```

### 3. hooks/useTheme.tsx
**不要删除！** 将其简化为薄兼容层（约 50 行）：
- 删除所有类型定义、颜色配置、预设主题（已迁移到 stores/）
- 删除 Provider 组件
- 保留 `useTheme()` hook，内部转发到 `@/theme` (Zustand)
- 删除 `COMPLETE_THEME_PRESETS`、`FONT_OPTIONS` 等（从 stores/theme.presets.ts 获取）
- 保留 `colorUtils` 工具函数（从 design-system/tokens/color.ts 导入）

### 4. 更新引用
以下文件需要从 `@/hooks/useTheme` 改为 `@/theme`：
- `components/ai/DarkModeChartTheme.tsx`
- `components/analytics/AnalyticsDashboard.tsx`
- `components/analytics/charts/AdvancedChartEngine.tsx`
- `pages/settings/SettingsPage.tsx`

**注意：** `@/hooks/useTheme` 目前通过 fallback 机制也能工作（因为 App.tsx 使用了 stores/ThemeProvider），
但直接改为 `@/theme` 更清晰且性能更好。

## 清理后的架构

```
frontend/src/
├── stores/
│   ├── themeStore.ts          # Zustand store（核心）
│   ├── ThemeProvider.tsx      # React Context Provider
│   ├── theme.presets.ts       # 预设主题 + 工具函数
│   └── theme.storage.ts       # 持久化存储
├── types/
│   └── theme.types.ts         # 类型定义
├── theme/
│   └── index.ts               # 统一导出（给组件用）
├── hooks/
│   └── useTheme.tsx           # 薄兼容层（转发到 @/theme）
├── styles/
│   ├── theme.css              # 仅 sr-only 工具类
│   └── motion.css             # 动画相关
└── index.css                  # Tailwind + 设计 Token
```

## 验证步骤

清理完成后：
1. 运行 `npm run build` 确认编译通过
2. 打开应用，测试主题切换（浅色/深色）
3. 测试预设主题切换
4. 测试无障碍模式切换
5. 检查浏览器控制台无报错
