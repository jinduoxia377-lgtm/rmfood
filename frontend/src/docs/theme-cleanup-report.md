# RMFOOD 主题系统清理报告

## 一、审查结论

项目原存在 **5 套主题系统** 并存：

| # | 系统 | 位置 | 状态 |
|---|------|------|------|
| 1 | Zustand Store（主力） | `stores/themeStore.ts` + `stores/ThemeProvider.tsx` | ✅ **唯一运行时系统** |
| 2 | Legacy Context Hook | `hooks/useTheme.tsx`（1455行） | ⚠️ 已简化为薄兼容层 |
| 3 | MD3 ThemeManager | `design-system/theme-manager.ts` | ❌ 死代码，无外部引用 |
| 4 | 配置主题 | `config/theme.config.ts` | ❌ 导出但无人消费 |
| 5 | 自定义主题 Hook | `hooks/useCustomTheme.ts` | ❌ 独立系统，无人引用 |

## 二、已完成的重构

### 1. `hooks/useTheme.tsx` — 从 1455 行简化为 ~280 行
- 删除了所有类型定义、颜色配置、预设主题、Provider 组件
- 保留 `useTheme()` 兼容层，内部转发到 Zustand store
- 补充了 `isDark`、`toggleTheme`、`settings`、`updateSettings` 等旧版字段
- 静态导出了所有 SettingsPage 需要的常量（`COMPLETE_THEME_PRESETS`、`FONT_OPTIONS` 等）
- 所有活跃引用组件（DarkModeChartTheme、AnalyticsDashboard、AdvancedChartEngine、SettingsPage）无需修改

### 2. `hooks/index.ts`
- 注释掉了 `useTheme` 和 `useThemePersistence` 的导出（无人通过 `@/hooks` 导入）

### 3. `config/index.ts`
- 注释掉了 `PROFESSIONAL_THEMES` 的导出

### 4. `theme/index.ts`
- 移除了已删除的 `ThemeSwitcher` 组件和 `THEME_CSS_PATH` 导出
- 移除了 `default as themeStore` 重命名导出

### 5. `tests/useTheme.test.ts`
- 标记为 DEPRECATED，旧版测试无法在新架构下运行

## 三、需要手动删除的文件

请在终端执行以下命令删除冗余文件：

```powershell
cd D:\RMFOOD配方平台\frontend\src

# 1. 整个 design-system 目录（无外部引用）
Remove-Item -Recurse -Force "design-system"

# 2. 已废弃的 hooks
Remove-Item -Force "hooks\useThemePersistence.ts"
Remove-Item -Force "hooks\useThemeQuery.ts"
Remove-Item -Force "hooks\useThemeSubscription.ts"
Remove-Item -Force "hooks\useCustomTheme.ts"

# 3. 已废弃的配置
Remove-Item -Force "config\theme.config.ts"

# 4. 已废弃的类型
Remove-Item -Force "types\custom-theme.types.ts"

# 5. 已过时的文档
Remove-Item -Force "hooks\theme-system-implementation.md"

# 6. 样式备份和冗余文件
Remove-Item -Recurse -Force "styles.backup"
Remove-Item -Force "styles\tokens.css"
Remove-Item -Force "styles\colors.css"

# 7. 测试文件（旧版，需重写）
Remove-Item -Force "stores\__tests__\themeStore.test.ts"
```

## 四、保留的核心文件

| 文件 | 行数 | 用途 |
|------|------|------|
| `stores/themeStore.ts` | ~600 | Zustand 状态管理（核心） |
| `stores/ThemeProvider.tsx` | ~370 | React Context Provider + hooks |
| `stores/theme.presets.ts` | ~700 | 9个预设主题 + 工具函数 |
| `stores/theme.storage.ts` | ~50 | 持久化存储 |
| `types/theme.types.ts` | ~515 | 完整类型定义 |
| `theme/index.ts` | ~40 | 统一导出 |
| `hooks/useTheme.tsx` | ~280 | 薄兼容层（转发到 Zustand） |
| `styles/theme.css` | ~43 | 无障碍工具类（sr-only, skip-link） |
| `styles/motion.css` | - | 动画相关 |
| `styles/generated/tokens.css` | - | 自动生成的 CSS 变量 |
| `styles/generated/tokens-dark.css` | - | 暗色模式 CSS 变量 |
| `index.css` | ~3040 | Tailwind + 设计 Token |

## 五、两套主题确认

Zustand 系统中的 `presetThemes` 提供了完整的 **Light + Dark** 两套主题：

| Light 主题 | Dark 主题 | 说明 |
|-----------|----------|------|
| `light-default` | `dark-default` | 默认主题（森林绿品牌色） |
| `light-warm` | `dark-oled` | 暖色 / OLED 纯黑 |
| `light-cool` | — | 冷色（青色） |
| — | `high-contrast-light` | 高对比度浅色（WCAG AAA） |
| — | `high-contrast-dark` | 高对比度深色（WCAG AAA） |
| — | `reading-sepia` | 阅读模式 - 羊皮纸 |
| — | `reading-dark` | 阅读模式 - 深色 |

两套主题通过 `data-mode` 属性和 `.dark` class 区分，CSS 变量由 `applyThemeToDOM()` 统一注入到 `:root`。

## 六、验证步骤

删除文件后执行：
1. `cd frontend && npx tsc --noEmit` — 确认 TypeScript 编译通过
2. 启动应用，测试浅色/深色切换
3. 测试设置页面的主题选择器
4. 检查浏览器控制台无报错
