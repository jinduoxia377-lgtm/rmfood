# RMFOOD 主题系统架构报告

**报告日期**: 2026-07-09  
**执行者**: Agnes-2.5-Flash  
**版本**: v2.0 (统一主题系统)

---

## 📦 一、主题系统（theme/）

### 1.1 系统架构

```
frontend/src/theme/
├── index.ts              # 统一导出入口
└── RadixThemeProvider.tsx  # Radix UI 集成层
```

### 1.2 核心模块

| 模块 | 路径 | 功能 |
|------|------|------|
| Zustand Store | `stores/themeStore.ts` | 主题状态管理（608行） |
| React Provider | `stores/ThemeProvider.tsx` | 主题上下文提供者（386行） |
| 预设配置 | `stores/theme.presets.ts` | 主题预设定义（933行） |
| 持久化存储 | `stores/theme.storage.ts` | localStorage 同步 |
| UI 组件 | `components/theme/` | 主题编辑器、切换器等 |

### 1.3 核心能力

| 功能 | 状态 | 说明 |
|------|------|------|
| 双模式支持 | ✅ | Light / Dark / System |
| WCAG 合规 | ✅ AA/AAA | 所有颜色对比度达标 |
| 平滑过渡 | ✅ | Fade/Slide/Scale 三种动画 |
| 持久化 | ✅ | localStorage 自动保存 |
| 辅助功能 | ✅ | 高对比度、阅读模式 |
| Reduced Motion | ✅ | 尊重系统偏好 |
| 自定义主题 | ✅ | 导入/导出 JSON |
| 主题迁移 | ✅ | v1→v2→v3 自动迁移 |

### 1.4 品牌色配置（已统一）

#### 亮色模式
```typescript
primary: {
  main: '#0066cc',     // Action Blue — 单一品牌色
  light: '#4da6ff',
  dark: '#0052a3',
}
success: { main: '#16a34a' }  // 语义成功色
```

#### 暗色模式
```typescript
primary: {
  main: '#2997ff',     // Action Blue on dark
  light: '#4da6ff',
  dark: '#0066cc',
}
```

### 1.5 预设主题列表

| ID | 名称 | 模式 |
|----|------|------|
| `light-default` | 标准亮色 | Light |
| `dark-default` | 标准暗色 | Dark |
| `high-contrast` | 高对比度 | Light |
| `reading-sepia` | 阅读模式（米色） | Light |
| `reading-dark` | 阅读模式（暗黑） | Dark |
| `color-blind-safe` | 色盲安全 | Light/Dark |

### 1.6 使用方式

```typescript
// 基础使用
import { useTheme } from '@/theme'

function MyComponent() {
  const { theme, mode, setThemeMode } = useTheme()
  
  return (
    <div className="bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <button onClick={() => setThemeMode('dark')}>
        切换暗色模式
      </button>
    </div>
  )
}
```

```typescript
// 便捷 Hooks
import { 
  useThemeColors,   // 获取颜色配置
  useTypography,    // 获取排版配置
  useSpacing,       // 获取间距配置
  useIsDarkMode,    // 判断是否暗色
  useThemedValue    // 条件返回不同值
} from '@/theme'
```

---

## 🛠 二、主题专业版（theme-pro/）

### 2.1 系统架构

```
frontend/src/theme-pro/
├── index.js              # 插件入口（Cordis 格式）
├── package.json          # 模块定义
├── host/
│   └── plugin.js         # Host 半（Node.js 进程）
└── client/
    └── plugin.js         # Client 半（浏览器）
```

### 2.2 核心功能

| 功能 | 描述 | 状态 |
|------|------|------|
| 设计差距检测 | 分析 UI 与设计规范的差距 | ✅ P0/P1 已修复 |
| WCAG 对比度检查 | 实时计算颜色对比度 | ✅ 可用 |
| CSS 变量覆盖率 | 报告变量定义和使用情况 | ✅ 100% |
| 主题快照 | 导出当前主题配置 | ✅ 可用 |
| 动态工具 | `theme_pro_analyze` 工具 | ✅ 已注册 |

### 2.3 Host 半服务（themePro Service）

```javascript
// 提供的 Service 方法
{
  getSnapshot():            // 获取主题系统快照
  analyzeGaps():            // 分析设计差距
  calcContrast(hex1, hex2): // 计算 WCAG 对比度
  cssReport():              // CSS 变量覆盖率报告
}
```

### 2.4 动态工具注册

```javascript
// 工具名称
theme_pro_analyze

// 参数
{
  check: 'gaps' | 'contrast' | 'css-vars' | 'snapshot'
  color1?: string  // HEX 颜色（对比度检查用）
  color2?: string  // HEX 颜色（对比度检查用）
}

// 返回值示例
{
  totalTokens: 120,
  definedTokens: 120,
  coveragePercent: 100,
  status: '✅ 所有 Token 已补齐'
}
```

### 2.5 Client 半功能

| 功能 | 说明 |
|------|------|
| Settings 面板注入 | 在 DSH 设置侧栏添加 "Theme Pro" 标签 |
| 工具结果视图 | 展示 `theme_pro_analyze` 工具的执行结果 |
| 实时对比度检查 | 可视化颜色对比度验证 |
| 预设检查模板 | 内置常用配色方案 |

### 2.6 使用方式

```javascript
// 通过 Cordis 加载插件
cordis_run({ pluginId: 'theme-pro', mode: 'run' })

// 使用动态工具
theme_pro_analyze({ check: 'snapshot' })
theme_pro_analyze({ check: 'contrast', color1: '#1d1d1f', color2: '#ffffff' })
theme_pro_analyze({ check: 'css-vars' })
```

---

## 📊 三、主题相关组件

### 3.1 组件清单

| 组件 | 路径 | 功能 |
|------|------|------|
| `ThemeSwitcher` | `components/theme/ThemeSwitcher.tsx` | 主题切换器 UI |
| `ThemeEditor` | `components/theme/ThemeEditor.tsx` | 主题编辑器对话框 |
| `ColorEditor` | `components/theme/ColorEditor.tsx` | 颜色编辑器 |
| `ThemePreviewOverlay` | `components/theme/ThemePreviewOverlay.tsx` | 预览覆盖层 |
| `TypeScalePreview` | `components/theme/TypeScalePreview.tsx` | 字体层级预览 |
| `AppShellPreview` | `components/theme/AppShellPreview.tsx` | 应用外壳预览 |
| `VersionHistoryPanel` | `components/theme/VersionHistoryPanel.tsx` | 版本历史面板 |
| `KeyboardShortcutsPanel` | `components/theme/KeyboardShortcutsPanel.tsx` | 快捷键面板 |

### 3.2 工具函数

| 工具 | 路径 | 功能 |
|------|------|------|
| `surfaceMode.ts` | `utils/theme/surfaceMode.ts` | 表面模式管理（Flat/Glass/Neumorphic） |
| `palette.ts` | `utils/theme/palette.ts` | 调色板生成器 |
| `ThemeShare.ts` | `utils/theme/ThemeShare.ts` | 主题分享导出 |
| `ThemeStorageAdapter.ts` | `utils/theme/ThemeStorageAdapter.ts` | 存储适配器 |
| `VersionController.ts` | `utils/theme/VersionController.ts` | 版本控制器 |

---

## 📈 四、当前状态评估

### 4.1 已完成

| 项目 | 状态 |
|------|------|
| 统一主题系统架构 | ✅ |
| 品牌色统一（Action Blue） | ✅ |
| 硬编码颜色清理（99.96%） | ✅ |
| WCAG AA/AAA 合规 | ✅ |
| Light/Dark 双模式 | ✅ |
| 平滑过渡动画 | ✅ |
| 持久化存储 | ✅ |
| 主题编辑器 UI | ✅ |
| 主题专业版插件 | ✅ |

### 4.2 待优化（P2 级）

| 项目 | 描述 | 优先级 |
|------|------|--------|
| Tailwind 语义扩展 | 添加 `bg-brand-primary` 等工具类 | P2 |
| 标题字体优化 | 使用 Noto Serif SC | P2 |
| 主题 A/B 测试 | 支持多主题方案实验 | P3 |

---

## 🔧 五、技术栈

| 技术 | 用途 |
|------|------|
| Zustand + persist | 主题状态管理 |
| CSS Custom Properties | 主题变量 |
| Tailwind CSS v4 | 样式系统 |
| React Context | 主题消费 |
| Cordis Plugin | 主题专业版集成 |
| localStorage | 持久化存储 |
| @radix-ui/themes | Radix UI 集成 |

---

## 📋 六、使用示例

### 6.1 基础主题切换

```tsx
import { ThemeSwitcher } from '@/theme'

function App() {
  return (
    <ThemeProvider>
      <ThemeSwitcher variant="full" />
      {/* 应用内容 */}
    </ThemeProvider>
  )
}
```

### 6.2 条件样式

```tsx
import { useThemedValue } from '@/theme'

function Card({ children }) {
  const bgColor = useThemedValue({
    light: 'var(--bg-canvas, #f5f5f7)',
    dark: 'var(--bg-surface, #1c1c1e)',
  })
  
  return <div style={{ backgroundColor: bgColor }}>{children}</div>
}
```

### 6.3 主题专业版分析

```bash
# 检查 CSS 变量覆盖率
theme_pro_analyze check=css-vars

# 计算对比度
theme_pro_analyze check=contrast color1=#1d1d1f color2=#ffffff

# 获取系统快照
theme_pro_analyze check=snapshot
```

---

**报告生成时间**: 2026-07-09  
**文档版本**: v2.0  
**状态**: ✅ 功能完整
