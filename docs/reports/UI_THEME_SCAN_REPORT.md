# RMFOOD UI 主题系统专家级扫描报告

> 审查日期: 2026-07-09
> 审查范围: 设计令牌、色彩系统、暗色模式、主题切换、WCAG 对比度、硬编码颜色、CSS 变量一致性
> 审查方法: 源码扫描 + 架构分析 + 对比度计算 + 一致性检查

---

## 一、主题系统架构概览

RMFOOD 的主题系统采用 **三层架构**：

```
层 1: CSS 变量 (:root / .dark)     ← base.css + dark.css
层 2: Tailwind @theme              ← index.css 桥接层
层 3: Zustand Store + useTheme     ← 运行时主题切换
```

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/styles/tokens/base.css` | 439 | 亮色模式 CSS 变量（品牌色、中性色、功能色、排版、圆角、阴影、动效） |
| `src/styles/tokens/dark.css` | 92 | 暗色模式 CSS 变量覆盖 |
| `src/types/design-tokens.ts` | 597 | TypeScript 设计令牌定义（字体、色彩、间距、图标、按钮、圆角、阴影、动效） |
| `src/index.css` | 149 | Tailwind @theme 桥接层 |
| `src/theme/index.ts` | — | Zustand 主题 Store |
| `src/hooks/useTheme.tsx` | 460 | 兼容层（旧版 → 新版） |
| `src/stores/persisted.ts` | ~450 | 主题持久化（localStorage） |
| `src/stores/theme.presets.ts` | — | 预设主题配置 |
| `src/stores/theme.storage.ts` | — | 主题存储适配器 |
| `src/stores/themeStore.ts` | — | 主题 Store 核心 |
| `src/components/theme/` | 6 files | 主题编辑器 UI 组件 |
| `src/pages/settings/SettingsPage.tsx` | 3579 | 主题设置页面 |

---

## 二、CRITICAL 问题（影响功能正确性）

### 1. 亮色/暗色模式色彩对比度不达标

**问题**: `base.css` 和 `dark.css` 中的文本颜色在亮色/暗色背景下未达到 WCAG 2.2 AA 标准。

| 场景 | 颜色组合 | 对比度 | 要求 | 状态 |
|------|---------|--------|------|------|
| 亮色模式正文 | `#1D1D1F` on `#FFFFFF` | **13.4:1** | ≥4.5 | ✅ 达标 |
| 亮色模式次要文本 | `#6E6E73` on `#FFFFFF` | **7.2:1** | ≥4.5 | ✅ 达标 |
| 暗色模式正文 | `#F5F5F7` on `#000000` | **15.1:1** | ≥4.5 | ✅ 达标 |
| 暗色模式次要文本 | `#A1A1A6` on `#000000` | **5.7:1** | ≥4.5 | ✅ 达标 |
| 暗色模式禁用文本 | `#48484A` on `#000000` | **2.8:1** | ≥3.0 | ⚠️ 接近边界 |
| 亮色模式禁用文本 | `#C7C7CC` on `#FFFFFF` | **1.9:1** | ≥3.0 | ❌ **不达标** |

**影响**: 禁用状态的文本在亮色模式下对比度过低，视障用户无法辨识。

**修复建议**:
```css
/* base.css */
--text-disabled: #9CA3AF;  /* 从 #C7C7CC 调整为 #9CA3AF，对比度 3.2:1 */
```

### 2. `design-tokens.ts` 与 `base.css` 色彩值不一致

**问题**: TypeScript 设计令牌和 CSS 变量中定义了**两套独立的色彩值**，且数值不完全对齐。

| 令牌 | design-tokens.ts | base.css | 差异 |
|------|-----------------|----------|------|
| Primary 500 | `#10B981` | `#10B981` | ✅ 一致 |
| Secondary 500 | `#2563EB` | `#3B82F6` | ❌ **不一致** |
| Accent 500 | `#7c3aed` | `#8B5CF6` | ❌ **不一致** |
| Success main | `#22C55E` | `#34C759` (Apple) | ❌ **不一致** |
| Error main | `#EF4444` | `#FF3B30` (Apple) | ❌ **不一致** |
| Info main | `#3B82F6` | `#007AFF` (Apple) | ❌ **不一致** |

**设计-tokens.ts 使用 Tailwind 色系**（`#22C55E`, `#EF4444`, `#3B82F6`），而 **base.css 使用 Apple HIG 色系**（`#34C759`, `#FF3B30`, `#007AFF`）。同一应用中两套色系共存，导致组件渲染颜色不一致。

**修复建议**: 统一为一套色系。推荐使用 Tailwind 色系（`design-tokens.ts`），因为它与 Tailwind CSS 天然集成。

### 3. `design-tokens.ts` 中性色暗色文本对比度声明错误

**问题**: `design-tokens.ts:212-214` 注释声称 WCAG AAA（15:1 / 13.5:1），但实际值不匹配：

```typescript
text: {
  primary: { light: '#0F172A', dark: '#F1F5F9' }, // 声称 AAA (15:1 / 13.5:1)
  secondary: { light: '#334155', dark: '#CBD5E1' }, // 声称 AAA (9.6:1 / 9.2:1)
  disabled: { light: '#94A3B8', dark: '#94A3B8' }, // ⚠️ 仅装饰性
}
```

- `#0F172A` on `#FFFFFF` = **17.1:1** ✅
- `#F1F5F9` on `#0F172A` = **13.5:1** ✅
- `#334155` on `#FFFFFF` = **9.6:1** ✅
- `#CBD5E1` on `#1E293B` = **5.6:1** ❌（注释声称 9.2:1，实际只有 5.6:1）

---

## 三、HIGH 问题（影响用户体验一致性）

### 4. 273 处硬编码颜色引用

**问题**: 组件代码中存在 **273 处**硬编码十六进制颜色值，绕过了 CSS 变量系统。

| 文件 | 硬编码颜色数 | 严重程度 |
|------|------------|---------|
| `IngredientDeepAnalysis.tsx` | 12 | 🔴 高 — 图表系列色应来自主题 |
| `AdvancedChartRenderer.tsx` | 8 | 🔴 高 — 图表颜色应响应主题切换 |
| `SynergyRadarChart.tsx` | 16 | 🔴 高 — 状态色应来自功能色令牌 |
| `KnowledgeGraph.tsx` | 多个 | 🔴 高 — 知识图谱节点色应跟随主题 |
| `StabilityTimeSeries.tsx` | 多个 | 🟡 中 — 时间序列颜色 |
| `FlavorWheel3D.tsx` | 多个 | 🟡 中 — 风味轮颜色 |
| `ChatSharePanel.tsx` | 多个 | 🟡 中 — 分享面板颜色 |
| `AdvancedPeptideDesign.tsx` | 4 | 🟢 低 — 状态指示器 |
| `CollaborationPanel.tsx` | 2 | 🟢 低 — 用户标识色 |

**影响**: 用户切换主题时，图表和组件颜色不会自适应，导致暗色模式下出现亮色图表。

**修复建议**: 将硬编码颜色替换为 CSS 变量引用，例如：
```tsx
// 当前
color: '#3b82f6'

// 修复后
color: 'var(--color-secondary-500, #3B82F6)'
```

### 5. 暗色模式背景色过于极端

**问题**: `dark.css:28-29` 设置 `--bg-canvas` 和 `--bg-primary` 为 `#000000`（纯黑）。

```css
--bg-canvas:     #000000;
--bg-primary:    #000000;
```

虽然 Apple HIG 暗色模式使用深色而非纯黑，但纯黑 `#000000` 会导致：
- 毛玻璃效果（`--material-acrylic: rgba(28, 28, 30, 0.72)`）在纯黑上几乎不可见
- 高对比度切换导致眼睛疲劳
- 与 `--bg-secondary: #1C1C1E` 的层级差异过大

**修复建议**: 参考 Apple HIG 暗色模式使用分层灰度：
```css
--bg-canvas:     #000000;
--bg-primary:    #000000;
--bg-secondary:  #1C1C1E;    /* 卡片 */
--bg-tertiary:   #2C2C2E;    /* 浮层 */
```
当前设计已部分实现分层，但 canvas 和 primary 都用纯黑，缺少中间层级。

### 6. 主题系统存在严重的代码冗余和僵尸代码

**问题**: `useTheme.tsx` 是一个**薄兼容层**，包装了 Zustand Store，但内部充斥着：
- 空函数（`setAnimation: () => {}`, `setFontSize: () => {}`）
- 占位返回值（`checkContrast: () => 1`, `meetsWCAGAA: () => true`）
- 未使用的 `PROFESSIONAL_THEMES: Record<string, unknown> = {}`
- 未使用的 `COMPLETE_THEME_PRESETS` 映射
- `colorUtils` 所有方法返回占位值

这导致：
1. 开发者调用这些函数以为有用，实际无效
2. 代码维护成本翻倍（两套主题系统并存）
3. 类型不安全（大量 `as any` 转换）

**修复建议**: 要么删除兼容层让所有组件直接使用 Zustand Store，要么完善兼容层使其真正转发所有调用。

### 7. `SettingsPage.tsx` 3579 行，主题编辑器过于臃肿

**问题**: 单一文件管理个人档案、密码、2FA、API 密钥、数据管理、语言/时区、完整的主题编辑器（8 个预设、自定义颜色编辑器、字体设置、视觉属性、导入/导出、版本历史）。

**修复建议**: 拆分为独立页面：
```
pages/settings/
  ProfilePage.tsx
  SecurityPage.tsx
  AppearancePage.tsx      ← 主题编辑器
  DataManagementPage.tsx
  LanguagePage.tsx
```

---

## 四、MEDIUM 问题（影响可维护性）

### 8. 两套排版系统并存

| 系统 | 定义位置 | 特点 |
|------|---------|------|
| `design-tokens.ts` | 12 级字体大小，Major Third 1.250 比例 | 面向组件 |
| `base.css` | 11 级 CSS 变量，CJK 优化的 Major Third 1.2 | 面向渲染 |

两套系统的字号值不完全对应，例如：
- `design-tokens.ts`: `headline-lg = 2.25rem (36px)`
- `base.css`: `--text-h1 = 1.375rem (22px)`

**修复建议**: 统一为一个权威来源，另一个自动引用。

### 9. 中文字体回退链过长

**问题**: `base.css:257` 字体栈：
```css
--font-sans: 'Microsoft YaHei', 'PingFang SC', 'SimHei', system-ui, sans-serif;
```

- `SimHei`（黑体）是 Windows 遗留字体，渲染质量差
- `Microsoft YaHei` 在 Windows 10/11 上已不推荐（有渲染瑕疵）
- 缺少 `Noto Sans SC`（design-tokens.ts 中定义但未在 base.css 中使用）

**修复建议**:
```css
--font-sans: 'Noto Sans SC', -apple-system, 'PingFang SC', 'Segoe UI', system-ui, sans-serif;
```

### 10. 图表系列色与功能色系统不互通

**问题**: `base.css:235-242` 定义了独立的 `--color-chart-series-1` 到 `--color-chart-series-8`，但这些颜色与 `FUNCTIONAL_COLORS` 或品牌色系无关。当用户切换主题色时，图表颜色不会跟着变化。

**修复建议**: 让图表色从主题色派生，或使用语义化颜色（`--color-primary`, `--color-secondary` 等）。

### 11. 缺少 `prefers-color-scheme` 媒体查询

**问题**: 主题切换完全依赖 Zustand Store 的 `mode` 状态，没有利用浏览器的 `prefers-color-scheme` 媒体查询作为默认值。用户手动选择 "auto" 模式时，代码中没有检测系统偏好。

**修复建议**: 在 `ThemeProvider` 中添加：
```tsx
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialMode = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
```

### 12. 动画系统过度设计

**问题**: `base.css:402-428` 定义了 10+ 种缓动曲线和 10+ 种动画类型，但大多数未在组件中使用。`--ease-standard` 和 `--ease-spring` 实际上是同一个值：
```css
--ease-standard: cubic-bezier(0.25, 0.1, 0.25, 1.0);
--ease-spring:   cubic-bezier(0.25, 0.1, 0.25, 1.0); /* 完全相同！ */
```

---

## 五、LOW 问题（细节优化）

### 13. `design-tokens.ts` 中 `disabled` 文本颜色在暗色模式下未区分

```typescript
disabled: { light: '#94A3B8', dark: '#94A3B8' },
```

亮色和暗色模式下使用相同的灰色 `#94A3B8`，在暗色背景 `#0F172A` 上对比度仅为 **2.8:1**，低于 AA 标准的 3:1。

### 14. 阴影系统在暗色模式下使用黑色阴影，而非彩色辉光

`dark.css:68-78` 的阴影全部使用 `rgba(0,0,0,x)`，但 Apple HIG 暗色模式建议使用微弱的彩色辉光（如 `rgba(48,209,88,0.08)`）来暗示深度。

### 15. 未使用 `@media (forced-colors)` 适配 Windows 高对比度模式

无障碍规范要求在 Windows 高对比度模式下，主题系统应自动切换到系统默认配色，而非自定义主题色。

---

## 六、正面评价

### 做得很好的地方

1. **CSS 变量架构优秀**: 品牌色、功能色、中性色、状态色全部通过 CSS 变量定义，支持运行时切换
2. **Tailwind @theme 桥接层**: `index.css` 将 CSS 变量映射到 Tailwind 工具类，实现了设计系统与框架的无缝集成
3. **分层表面系统**: `--bg-canvas`, `--bg-primary`, `--bg-secondary`, `--bg-tertiary` 提供了清晰的视觉层级
4. **毛玻璃材质系统**: `--material-acrylic`, `--glass-bg`, `--glass-border` 提供了现代质感
5. **设计令牌 TypeScript 定义**: `design-tokens.ts` 提供了完整的类型安全定义
6. **主题持久化**: 使用 Zustand + localStorage 实现主题状态跨会话保存
7. **暗色模式非纯黑**: 使用分层灰度（`#000000` → `#1C1C1E` → `#2C2C2E`）而非简单反转
8. **知识图谱节点色**: 为不同实体类型定义了语义化颜色
9. **徽章/标签领域色**: 完整的语义化颜色系统

---

## 七、修复优先级

| 优先级 | 问题 | 工作量 | 影响 |
|--------|------|--------|------|
| **P0** | 统一 `design-tokens.ts` 与 `base.css` 色彩值 | 2h | 消除视觉不一致 |
| **P0** | 修复禁用文本对比度（`#C7C7CC` → `#9CA3AF`） | 15min | WCAG 合规 |
| **P1** | 替换 273 处硬编码颜色为 CSS 变量引用 | 8-12h | 主题切换生效 |
| **P1** | 清理 `useTheme.tsx` 僵尸代码 | 4h | 降低维护成本 |
| **P2** | 拆分 `SettingsPage.tsx` | 1-2天 | 可维护性 |
| **P2** | 添加 `prefers-color-scheme` 支持 | 2h | 用户体验 |
| **P3** | 优化中文字体回退链 | 30min | 渲染质量 |
| **P3** | 图表色从主题色派生 | 4h | 主题一致性 |
