# RMFOOD 配方平台 - 主题系统完整架构报告

> **版本**: v1.0  
> **编制日期**: 2025-07  
> **维护负责人**: UI/UX 团队  
> **设计标准**: WCAG 2.1 AA/AAA, Apple HIG, Design Tokens

---

## 一、主题系统概览

### 1.1 系统定位

RMFOOD 配方平台采用**统一的主题系统架构**，基于 CSS 自定义属性（CSS Variables）和 React Context + Zustand 状态管理，实现以下核心能力：

| 能力 | 描述 |
|------|------|
| **双模式主题** | Light/Dark 两套完整设计令牌体系 |
| **无障碍支持** | 高对比度、阅读模式、色盲友好 |
| **持久化存储** | localStorage 自动保存用户偏好 |
| **平滑过渡** | Fade/Slide/Scale 三种切换动画 |
| **WCAG 合规** | 所有颜色对比度符合 AA/AAA 标准 |
| **品牌一致性** | 森林绿 (#10B981) 品牌色贯穿全系统 |

### 1.2 技术栈

- **状态管理**: Zustand + persist middleware
- **主题切换**: React Context + CSS 变量动态注入
- **样式方案**: Tailwind CSS v4 + 原生 CSS 变量
- **图标库**: Lucide React
- **第三方集成**: Radix UI Themes (可选)

---

## 二、主题系统目录结构

```
frontend/src/
├── theme/                          # 主题模块导出索引
│   ├── index.ts                    # 统一导出入口
│   └── RadixThemeProvider.tsx      # Radix UI 主题集成
│
├── theme-pro/                      # Theme Pro 分析插件 (Cordis)
│   ├── index.js                    # 插件入口
│   ├── cordis.yml                  # Cordis 配置
│   ├── host/plugin.js              # Host 端服务 (WCAG 检查、差距检测)
│   └── client/plugin.js            # Client 端 UI (Settings 面板)
│
├── types/
│   ├── theme.types.ts              # 完整 TypeScript 类型定义
│   └── theme-mode.ts               # 向后兼容层 (deprecated)
│
├── stores/
│   ├── themeStore.ts               # Zustand Store (核心状态管理)
│   ├── ThemeProvider.tsx           # React Context Provider
│   ├── theme.presets.ts            # 预设主题配置 + 工具函数
│   └── theme.storage.ts            # 持久化存储管理
│
├── styles/
│   ├── tokens/
│   │   ├── base.css                # Light 模式 CSS 变量 (120+ 变量)
│   │   ├── dark.css                # Dark 模式 CSS 变量覆盖
│   │   └── typography.css          # 排版系统
│   │
│   ├── components/
│   │   ├── buttons.css             # 按钮系统 (Primary/Secondary/Ghost/Danger/AI/Glass)
│   │   ├── cards.css               # 卡片系统 (Standard/Glass/Interactive/Outlined/Gradient)
│   │   ├── inputs.css              # 输入框系统
│   │   ├── badges-tabs.css         # 徽章/标签页系统
│   │   ├── tables-stats.css        # 表格/统计卡片
│   │   ├── tooltips.css            # Toast/Tooltip/AI 组件
│   │   └── nutrition-label.css     # 营养成分表组件
│   │
│   ├── utilities/
│   │   ├── micro-interactions.css  # 微交互 (悬浮/按压/焦点)
│   │   ├── focus-scroll.css        # 焦点环/滚动条
│   │   └── icons-selection.css     # 图标排版
│   │
│   └── accessibility/
│       └── environment.css         # 环境适配 (Reduced Motion/高对比度/打印)
│
├── components/
│   └── theme/
│       ├── ThemeSwitcher.tsx       # 主题切换器组件
│       ├── ThemeEditor.tsx         # 主题编辑器 (自定义主题)
│       ├── ColorEditor.tsx         # 颜色编辑器
│       ├── ThemePreviewOverlay.tsx # 预览覆盖层
│       ├── VersionHistoryPanel.tsx # 版本历史面板
│       ├── ThemeOnboarding.tsx     # 新用户引导
│       └── KeyboardShortcutsPanel.tsx # 快捷键面板
│
├── components/ai/
│   ├── DarkModeChartTheme.tsx      # 图表主题兼容层
│   └── features/
│       ├── components/ThemeToolbar.tsx   # 对话主题工具栏
│       ├── hooks/useChatTheme.ts         # 对话主题 Hook (统一品牌)
│       └── styles/chatTheme.css          # 对话主题样式
│
├── components/database/graph/
│   └── components/ThemePanel.tsx   # 知识图谱主题面板
│
└── index.css                       # 入口文件 (导入所有样式模块)
```

---

## 三、核心模块详解

### 3.1 状态管理模块 (stores/)

#### 3.1.1 themeStore.ts - Zustand 核心 Store

**职责**: 管理所有主题相关状态，提供状态操作 API

**核心状态**:
```typescript
interface ThemeState {
  activeThemeId: PresetThemeId | string;   // 当前激活主题 ID
  activeTheme: ThemeConfig;                 // 当前完整主题配置
  mode: ThemeMode;                          // 'light' | 'dark' | 'system'
  accessibilityMode: AccessibilityMode;     // 'normal' | 'high-contrast' | 'reading' | 'color-blind'
  motionPreferences: MotionPreferences;     // 动效偏好设置
  transitionType: TransitionType;           // 'fade' | 'slide' | 'scale' | 'none'
  isTransitioning: boolean;                 // 是否正在过渡动画中
  customThemes: ThemeConfig[];              // 用户自定义主题列表
  isInitialized: boolean;                   // 初始化状态
}
```

**核心操作**:
| 方法 | 描述 |
|------|------|
| `initialize()` | 初始化主题系统，检测系统偏好 |
| `setThemeMode(mode)` | 切换 Light/Dark/System 模式 |
| `setPresetTheme(id)` | 切换到指定预设主题 |
| `applyCustomTheme(overrides)` | 应用自定义主题覆盖 |
| `setAccessibilityMode(mode)` | 设置无障碍模式 |
| `setMotionPreferences(prefs)` | 设置动效偏好 |
| `saveCustomTheme(theme)` | 保存自定义主题 |
| `deleteCustomTheme(id)` | 删除自定义主题 |
| `exportTheme()` | 导出主题配置为 JSON |
| `importTheme(json)` | 导入主题配置 |

**持久化配置**:
- 存储键: `rmfood-theme-storage`
- 使用 `zustand/middleware` 的 `persist` 中间件
- 只持久化关键状态，避免存储完整主题对象
- 版本: v3 (包含主题ID验证和迁移逻辑)

#### 3.1.2 ThemeProvider.tsx - React Context 提供器

**职责**: 将 Zustand Store 包装为 React Context，提供 hooks

**提供的 Hooks**:
| Hook | 返回值 | 用途 |
|------|--------|------|
| `useTheme()` | ThemeContextValue | 获取完整主题上下文 |
| `useThemeColors()` | SemanticColors | 便捷获取颜色配置 |
| `useTypography()` | Typography | 便捷获取排版配置 |
| `useSpacing()` | Spacing | 便捷获取间距配置 |
| `useIsDarkMode()` | boolean | 判断是否暗色模式 |
| `useCSSVariable(name)` | string | 获取 CSS 变量值 |
| `useThemedValue(values)` | T | 根据模式返回不同值 |

**系统监听**:
- `prefers-color-scheme` 变化 → 自动切换主题
- `prefers-reduced-motion` 变化 → 自动更新动效偏好

#### 3.1.3 theme.presets.ts - 预设主题配置

**预设主题列表** (`PresetThemeId`):
```typescript
type PresetThemeId = 'light-default' | 'dark-default';
```

**色彩系统**:

| 色彩类别 | Light 模式 | Dark 模式 | 对比度 |
|----------|------------|-----------|--------|
| Primary (Forest Green) | #10B981 | #34D399 | 4.5:1 ✅ |
| Secondary (Ocean Blue) | #3B82F6 | #60A5FA | 4.5:1 ✅ |
| Tertiary (Bio Purple) | #8B5CF6 | #A78BFA | 4.5:1 ✅ |
| Success | #16A34A | #4ADE80 | 4.5:1 ✅ |
| Warning | #CA8A04 | #FACC15 | 4.5:1 ✅ |
| Error | #B91C1C | #EF4444 | 7.0:1 ✅ |
| Info | #0E7490 | #67E8F9 | 4.5:1 ✅ |
| Text Primary | #111827 | #F3F4F6 | 15.2:1 ✅ |
| Text Secondary | #4B5563 | #D1D5DB | 9.2:1 ✅ |

**辅助功能主题变体** (`getAccessibilityTheme()`):
- `high-contrast`: 黑白高对比度模式
- `reading`: Sepia 暖色调 / Dark Stone 色调
- `color-blind`: 色盲友好配色

#### 3.1.4 theme.storage.ts - 持久化存储

**存储键**:
```typescript
const STORAGE_KEYS = {
  THEME_STATE: 'rmfood-theme-state',
  CUSTOM_THEMES: 'rmfood-custom-themes',
  USER_PREFERENCES: 'rmfood-theme-preferences',
  THEME_VERSIONS: 'rmfood-theme-versions',
};
```

**版本管理**:
- 当前版本: v2
- 支持从 v1 自动迁移
- 主题历史快照 (最多 10 条)
- 支持版本回滚

---

### 3.2 类型定义模块 (types/)

#### 3.2.1 theme.types.ts - 核心类型定义

**枚举类型**:
```typescript
type ThemeMode = 'light' | 'dark' | 'system';
type AccessibilityMode = 'normal' | 'high-contrast' | 'reading' | 'color-blind';
type TransitionType = 'fade' | 'slide' | 'scale' | 'none';
```

**核心接口**:
- `SemanticColors` - 语义化颜色 Token
- `Typography` - 排版系统配置
- `Spacing` - 间距系统配置 (4pt 基准)
- `BorderRadius` - 圆角系统
- `Shadows` - 阴影系统
- `Transitions` - 动效系统配置
- `Breakpoints` - 响应式断点
- `ZIndex` - Z-index 分层管理
- `ThemeConfig` - 完整主题配置
- `CustomThemeOverrides` - 自定义主题覆盖

---

### 3.3 样式系统模块 (styles/)

#### 3.3.1 CSS 变量体系

**基础变量文件**: `base.css` / `dark.css`

**变量分类**:

| 类别 | 变量前缀 | 示例 |
|------|----------|------|
| 品牌色 | `--color-primary-*` | `--color-primary-500: #10b981` |
| 语义色 | `--color-success-*` | `--color-success-500: #10b981` |
| 背景色 | `--bg-*` | `--bg-canvas: #f8fafc` |
| 文字色 | `--text-*` | `--text-primary: #0f172a` |
| 边框色 | `--border-*` | `--border-color: #e2e8f0` |
| 圆角 | `--radius-*` | `--radius-md: 8px` |
| 间距 | `--space-*` | `--space-4: 1rem` |
| 阴影 | `--shadow-*` | `--shadow-md: 0 4px 6px ...` |
| 动效 | `--duration-*` / `--ease-*` | `--duration-normal: 200ms` |
| 布局 | `--sidebar-width` | `--sidebar-width: 256px` |
| Z-index | `--z-*` | `--z-modal: 1000` |
| 字体 | `--font-*` | `--font-sans: 'Inter', ...` |
| 字号 | `--text-*` | `--text-h1: 2.25rem` |

**总变量数**: 120+

#### 3.3.2 组件样式模块

| 文件 | 组件类型 | 状态变体 |
|------|----------|----------|
| `buttons.css` | 按钮 | Primary, Secondary, Ghost, Danger, AI, Glass, Outline |
| `cards.css` | 卡片 | Standard, Glass, Interactive, Outlined, Gradient |
| `inputs.css` | 输入框 | Default, Error, Success, Disabled, sm/lg |
| `badges-tabs.css` | 徽章/标签 | Status badges, Tags, Segmented control tabs |
| `tables-stats.css` | 表格/统计 | Data tables, Stat cards, Section titles |
| `tooltips.css` | 通知/提示 | Toast, Tooltip, AI suggestions |
| `nutrition-label.css` | 营养标签 | GB 28050 标准营养表 |

#### 3.3.3 工具类模块

| 文件 | 功能 |
|------|------|
| `micro-interactions.css` | 悬浮提升、按压反馈、骨架屏 |
| `focus-scroll.css` | 焦点环、自定义滚动条 |
| `icons-selection.css` | 图标排版、跳过链接、屏幕阅读器专用 |
| `semantic-utils.css` | 语义化类名 (`bg-primary-main`, `text-neutral-*`) |

#### 3.3.4 无障碍模块

| 特性 | 实现方式 |
|------|----------|
| Reduced Motion | `@media (prefers-reduced-motion: reduce)` + `.reduce-motion` class |
| 高对比度 | `@media (prefers-contrast: high)` + `[data-a11y-mode="high-contrast"]` |
| 强制颜色 | `@media (forced-colors: active)` |
| 打印适配 | `@media print` 强制浅色模式 |
| 颜色方案 | `color-scheme: light/dark` |

---

### 3.4 UI 组件模块 (components/theme/)

#### 3.4.1 ThemeSwitcher.tsx - 主题切换器

**功能**:
- 显示当前模式图标 (太阳/月亮/显示器)
- 下拉面板包含：
  - 主题模式选择 (Light/Dark/System)
  - 无障碍模式选择 (Normal/High-contrast/Reading/Color-blind)
  - 过渡效果选择 (Fade/Slide/Scale)
  - 快速预设切换

**快捷键**:
- `Ctrl/Cmd + Shift + L` - 切换 Light
- `Ctrl/Cmd + Shift + D` - 切换 Dark
- `Ctrl/Cmd + Shift + S` - 切换 System

#### 3.4.2 ThemeEditor.tsx - 主题编辑器

**功能**:
- 自定义主题名称和描述
- 颜色编辑 (ColorEditor 组件)
- 实时预览 (控件样本 / 上下文预览)
- 保存/重置/删除主题
- 版本历史记录

#### 3.4.3 ColorEditor.tsx - 颜色编辑器

**功能**:
- 颜色选择器 (原生 `<input type="color">`)
- HEX 输入框
- 颜色锁定机制
- 主色同步生成 Secondary/Tertiary

---

### 3.5 主题 Pro 插件 (theme-pro/)

#### 3.5.1 架构

基于 **Cordis 插件系统** 实现，分为 Host 和 Client 两部分：

```
theme-pro/
├── index.js           # 插件入口
├── cordis.yml         # Cordis 配置
├── host/plugin.js     # Host 端服务
└── client/plugin.js   # Client 端 UI
```

#### 3.5.2 Host 端服务 (themePro)

| 方法 | 描述 |
|------|------|
| `getSnapshot()` | 获取当前主题系统快照 |
| `analyzeGaps()` | 分析设计系统差距 |
| `calcContrast(hex1, hex2)` | 计算 WCAG 对比度 |
| `cssReport()` | CSS 变量覆盖率报告 |

#### 3.5.3 Client 端 UI

**注册位置**: Settings 侧栏 → Theme Pro 标签页

**功能模块**:
- Overview: 合规率评分、快速统计
- Gaps: 设计差距检测 (P0/P1/P2)
- Contrast: 对比度检查器
- Colors: 品牌色/知识图谱节点色/配方状态色展示
- CSS Vars: CSS 变量覆盖率

#### 3.5.4 动态工具 (theme_pro_analyze)

```typescript
// 使用方式
theme_pro_analyze({ check: 'gaps' })
theme_pro_analyze({ check: 'contrast', color1: '#111827', color2: '#ffffff' })
theme_pro_analyze({ check: 'css-vars' })
theme_pro_analyze({ check: 'snapshot' })
```

---

### 3.6 AI 对话主题模块

#### 3.6.1 useChatTheme.ts - 统一主题 Hook

**设计决策**: 对话区域固定使用品牌统一主题，不再支持多主题切换

```typescript
export const UNIFIED_SCHEME: DesignScheme = 'unified'
```

#### 3.6.2 chatTheme.css - 对话主题样式

**三套视觉方案**:
| 方案 | 风格 | 用途 |
|------|------|------|
| `academic` | 学术极简 | 专业内容展示 |
| `glassmorphism` | 毛玻璃 | 现代感界面 |
| `professional` | 专业商务 | 正式场景 |

**特色功能**:
- 响应式布局 (Mobile/Tablet/Desktop)
- 消息入场动画
- 打字指示器
- 代码块语言标签
- Markdown 增强渲染
- 表格/引用/Callout 样式

---

### 3.7 知识图谱主题模块

#### 3.7.1 ThemePanel.tsx - 图谱主题面板

**功能**: 为知识图谱可视化提供主题选择

**预设主题**:
- Herb (草药节点)
- Compound (化合物节点)
- Target (靶点节点)
- Peptide (肽类节点)
- Protein (蛋白质节点)
- Food (食物节点)
- Disease (疾病节点)

---

## 四、主题系统工作流程

### 4.1 初始化流程

```
应用启动
    ↓
ThemeProvider 挂载
    ↓
useThemeStore.initialize()
    ↓
检测系统偏好 (prefers-color-scheme)
    ↓
加载持久化配置 (localStorage)
    ↓
验证主题 ID 有效性
    ↓
应用初始主题到 DOM (applyThemeToDOM)
    ↓
isInitialized = true
```

### 4.2 主题切换流程

```
用户点击主题切换
    ↓
调用 setPresetTheme(id) 或 setThemeMode(mode)
    ↓
计算新主题配置 (考虑辅助功能模式)
    ↓
生成 CSS 变量
    ↓
应用过渡动画 (fade/slide/scale)
    ↓
更新 DOM 属性和 class
    ↓
保存到 localStorage
    ↓
触发 onThemeChange 回调
```

### 4.3 辅助功能主题应用

```
用户选择辅助功能模式
    ↓
调用 setAccessibilityMode(mode)
    ↓
获取基础主题
    ↓
应用 getAccessibilityTheme() 变换
    ↓
生成变体主题配置
    ↓
应用到 DOM
```

---

## 五、维护指南

### 5.1 添加新预设主题

**步骤**:
1. 在 `stores/theme.presets.ts` 中添加颜色配置
2. 在 `types/theme.types.ts` 的 `PresetThemeId` 类型中添加 ID
3. 在 `presetThemes` 对象中添加新主题
4. 更新 `themeStore.ts` 中的 legacy fallback IDs

**示例**:
```typescript
// theme.presets.ts
'light-warm': createPresetTheme(
  'light-warm',
  'Warm Light',
  'light',
  { /* 自定义颜色 */ },
),

// theme.types.ts
export type PresetThemeId = 'light-default' | 'dark-default' | 'light-warm';
```

### 5.2 修改主题变量

**推荐方式**: 修改 `styles/tokens/base.css` 和 `styles/tokens/dark.css`

**注意事项**:
- 保持变量命名规范：`--color-{category}-{key}`
- 确保暗色模式有对应覆盖
- 更新 Tailwind 配置中的变量映射

### 5.3 添加组件主题样式

**步骤**:
1. 在 `styles/components/` 创建新的 CSS 文件
2. 在 `index.css` 中导入新文件
3. 使用 CSS 变量而非硬编码颜色

### 5.4 修改无障碍模式

**步骤**:
1. 在 `types/theme.types.ts` 更新 `AccessibilityMode` 类型
2. 在 `stores/theme.presets.ts` 的 `getAccessibilityTheme()` 中添加新模式
3. 更新 `ThemeSwitcher.tsx` 的无障碍模式选项

---

## 六、已知问题与优化建议

### 6.1 当前问题

| 问题 | 影响 | 优先级 |
|------|------|--------|
| CSS 变量命名不统一 | 维护困难 | P1 |
| 部分组件硬编码颜色 | 主题切换无效 | P1 |
| 旧版主题 ID 迁移 | 用户体验 | P2 |
| 缺少主题单元测试 | 回归风险 | P2 |

### 6.2 优化建议

1. **建立 Design Token 文档**: 所有变量应在此报告中有明确记录
2. **添加主题回归测试**: 确保颜色变化不影响组件功能
3. **主题性能优化**: 批量 CSS 变量更新减少重绘
4. **暗色模式全覆盖**: 确保所有组件都有暗色模式样式
5. **主题导出/分享功能**: 允许用户分享自定义主题

---

## 七、模块独立维护建议

为实现不同模块独立维护，降低后续维护成本，建议按以下结构组织：

```
theme-system/
├── core/                     # 核心模块
│   ├── store/               # Zustand Store
│   ├── types/               # 类型定义
│   └── storage/             # 持久化存储
│
├── presets/                  # 预设主题
│   ├── light/               # Light 主题配置
│   └── dark/                # Dark 主题配置
│
├── accessibility/            # 无障碍主题
│   ├── high-contrast/       # 高对比度
│   ├── reading/             # 阅读模式
│   └── color-blind/         # 色盲友好
│
├── components/               # UI 组件
│   ├── switcher/            # 主题切换器
│   ├── editor/              # 主题编辑器
│   └── preview/             # 预览组件
│
├── styles/                   # 样式模块
│   ├── tokens/              # CSS 变量定义
│   ├── components/          # 组件样式
│   └── utilities/           # 工具类
│
├── utils/                    # 工具函数
│   ├── contrast.js          # 对比度计算
│   └── migration.js         # 版本迁移
│
└── docs/                     # 文档
    ├── TOKENS.md            # Token 文档
    └── MIGRATION.md         # 迁移指南
```

---

## 八、关键文件索引

| 文件路径 | 行数 | 主要职责 |
|----------|------|----------|
| `stores/themeStore.ts` | 584 | Zustand 状态管理核心 |
| `stores/ThemeProvider.tsx` | 369 | React Context 提供器 |
| `stores/theme.presets.ts` | 581 | 预设主题配置 + 工具函数 |
| `stores/theme.storage.ts` | 246 | 持久化存储管理 |
| `types/theme.types.ts` | 634 | 完整类型定义 |
| `styles/tokens/base.css` | 330 | Light 模式 CSS 变量 |
| `styles/tokens/dark.css` | 261 | Dark 模式 CSS 变量 |
| `styles/components/buttons.css` | 360 | 按钮组件样式 |
| `styles/components/cards.css` | 142 | 卡片组件样式 |
| `styles/components/inputs.css` | 136 | 输入框组件样式 |
| `styles/components/badges-tabs.css` | 185 | 徽章/标签页样式 |
| `styles/utilities/semantic-utils.css` | 201 | 语义化类名 |
| `styles/accessibility/environment.css` | 114 | 无障碍环境适配 |
| `components/theme/ThemeSwitcher.tsx` | 292 | 主题切换器 UI |
| `components/theme/ThemeEditor.tsx` | 319 | 主题编辑器 UI |
| `theme-pro/host/plugin.js` | 165 | Theme Pro Host 服务 |
| `theme-pro/client/plugin.js` | 324 | Theme Pro Client UI |
| `index.css` | 273 | 样式入口文件 |

---

## 九、总结

RMFOOD 配方平台的主题系统是一个**专业级、符合 WCAG 无障碍标准、支持多模式切换**的完整解决方案。系统采用 **Zustand + React Context + CSS Variables** 三层架构，实现了：

1. **状态管理**: 集中式主题状态，支持持久化和版本迁移
2. **样式系统**: 120+ CSS 变量，覆盖颜色、排版、间距、圆角、阴影、动效
3. **组件库**: 完整的按钮、卡片、输入框、徽章、表格等组件主题样式
4. **无障碍**: 支持高对比度、阅读模式、色盲友好、Reduced Motion
5. **扩展性**: 通过 Cordis 插件系统提供专业分析工具

系统已具备良好的模块化基础，建议按照第七章的模块划分进一步优化，以实现不同模块的独立维护和迭代。
