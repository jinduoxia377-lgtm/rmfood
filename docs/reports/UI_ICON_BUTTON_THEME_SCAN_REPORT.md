# RMFOOD UI 图标/按钮/主题系统专家级扫描报告

> 审查日期: 2026-07-09
> 审查范围: 图标系统、按钮系统、色彩搭配、主题一致性、无障碍
> 审查方法: 全量源码扫描 + 对比度计算 + 一致性分析

---

## 一、图标系统审查

### 1. 图标库：Lucide React（303 处引用）

**✅ 优点**：统一使用 Lucide React，无多库混用。

**❌ 问题 1：图标尺寸碎片化严重**

扫描发现 **18 种不同的图标尺寸**，缺乏统一标准：

| 尺寸 | 出现次数 | 来源 | 是否标准 |
|------|---------|------|---------|
| `w-3 h-3` (12px) | 27 | `size={12}` | ⚠️ 过小 |
| `w-3.5 h-3.5` (14px) | 9 | 自定义 | ⚠️ 非标准 |
| `w-4 h-4` (16px) | 872 | `size={16}` | ✅ 标准 |
| `w-5 h-5` (20px) | 292 | `size={20}` | ✅ 标准 |
| `w-6 h-6` (24px) | 55 | 自定义 | ✅ 标准 |
| `w-7 h-7` (28px) | 16 | 自定义 | ❌ 非标准 |
| `w-8 h-8` (32px) | 47 | 自定义 | ✅ 标准 |
| `w-10 h-10` (40px) | 27 | 自定义 | ✅ 标准 |
| `w-12 h-12` (48px) | 58 | 自定义 | ✅ 标准 |
| `w-16 h-16` (64px) | 28 | 自定义 | ✅ 标准 |
| `w-2 h-2` (8px) | 25 | 自定义 | ❌ 太小 |

**问题**: `w-7` (28px)、`w-3.5` (14px)、`w-2` (8px) 不在设计令牌中定义。

**修复建议**: 统一使用 `design-tokens.ts` 定义的图标尺寸：

```typescript
ICON_SIZES = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32, '2xl': 40 }
```

### 2. 图标描边宽度不统一

| 描边宽度 | 使用位置 | 问题 |
|---------|---------|------|
| `strokeWidth={1}` | RadarMiniChart | 线条过细，暗色模式下不可见 |
| `strokeWidth={1.5}` | 部分按钮图标 | 无统一规范 |
| `strokeWidth={2}` | 大多数图标 | ✅ 推荐 |

**修复建议**: 全局统一 `strokeWidth={2}`，仅在装饰性图标中使用 `1.5`。

### 3. 图标颜色硬编码

| 文件 | 问题 |
|------|------|
| `ModelDiagnosticPanel.tsx:62-65` | `text-emerald-500`, `text-amber-500`, `text-red-500`, `text-slate-400` — Tailwind 类名而非 CSS 变量 |
| `ChatMessages.tsx:175` | `text-primary-500` — 混合使用 Tailwind 类和 CSS 变量 |
| `DeepThinkingPanel.tsx:99-100` | `#34C759`, `#D97706` — 硬编码颜色 |
| `CollaborationPanel.tsx:192` | `#ef4444`, `#3b82f6` — 硬编码颜色 |

---

## 二、按钮系统审查

### 4. 按钮变体碎片化

`buttons.css` 定义了 **8 种按钮变体**：

| 变体 | 说明 | 问题 |
|------|------|------|
| `btn` | 基础 | ✅ |
| `btn-primary` | 填充 | ✅ |
| `btn-secondary` | 描边 | ✅ |
| `btn-ghost` | 透明 | ✅ |
| `btn-danger` | 红色填充 | ✅ |
| `btn-ai` | 紫→蓝渐变 | ⚠️ 渐变在暗色模式下对比度不足 |
| `btn-glass` | 毛玻璃 | ✅ |
| `btn-amber` | 琥珀色 | ⚠️ 与 `btn-warning` 重复 |
| `btn-outline` | 描边 | ⚠️ 与 `btn-secondary` 语义重复 |
| `btn-warning` | 警告色 | ⚠️ 与 `btn-amber` 重复 |

**问题**: `btn-amber` 和 `btn-warning` 完全一样（都是 `#FF9F0A`）。`btn-outline` 和 `btn-secondary` 视觉相似但语义不同。

### 5. 圆角不一致

| 位置 | 圆角值 | 问题 |
|------|--------|------|
| `buttons.css` | `var(--radius-sm, 10px)` | 默认 10px（Apple HIG 标准是 10px ✅）|
| `AcademicReportEditor.tsx` | `rounded-lg` (8px) | 与按钮系统不一致 |
| `ChapterTree.tsx` | `rounded-md` (6px) | 与按钮系统不一致 |
| `CitationPanel.tsx` | `rounded-full` | 仅用于标签 |

**问题**: 大量组件使用 Tailwind 的 `rounded-lg` (8px) 而非按钮系统的 `--radius-sm` (10px)。

### 6. 禁用状态不一致

| 文件 | 禁用样式 | 问题 |
|------|---------|------|
| `buttons.css` | `opacity: 0.45` | ✅ 统一 |
| `AcademicReportEditor.tsx` | `disabled:opacity-50` | ❌ 0.50 vs 0.45 |
| `DocumentPreview.tsx` | `disabled:opacity-50` | ❌ 同上 |

### 7. 大量使用 `bg-slate` 而非语义色

扫描发现 **5126 处** `bg-slate`/`text-slate`/`border-slate` 使用，完全绕过了设计令牌系统：

```tsx
// ❌ 硬编码 Tailwind 色
className="bg-slate-100 dark:bg-slate-700 border border-slate-200"

// ✅ 应该使用
className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200"
   // 或直接使用 CSS 变量
className="bg-[var(--bg-tertiary)] border-[var(--border-subtle)]"
```

### 8. 按钮内图标尺寸未标准化

`buttons.css` 定义了图标尺寸映射：

```css
.btn-sm .icon { width: 14px; }
.btn-md .icon { width: 16px; }
.btn-lg .icon { width: 20px; }
.btn-xl .icon { width: 24px; }
```

但实际组件中大量按钮不使用 `.btn` 类名，而是手写样式，导致图标尺寸失控。

---

## 三、色彩搭配主题审查

### 9. 双色系并存（Tailwind vs CSS 变量）

**核心矛盾**：组件代码中同时存在两种配色体系：

| 体系 | 使用方式 | 占比 |
|------|---------|------|
| Tailwind 类名 | `bg-emerald-500`, `text-slate-700` | ~60% |
| CSS 变量 | `var(--color-primary)`, `var(--bg-secondary)` | ~40% |

**问题**: Tailwind 类名在主题切换时**不会自动更新**。例如 `bg-slate-100` 在暗色模式下仍然是白色背景，不会变成深色。

### 10. 暗色模式背景色断层

| 元素 | 亮色 | 暗色 | 问题 |
|------|------|------|------|
| Canvas | `#F5F5F7` | `#000000` | 断层过大，缺少中间过渡 |
| Card | `#FFFFFF` | `#1C1C1E` | ✅ 合理 |
| Tertiary | `#F5F5F7` | `#2C2C2E` | ✅ 合理 |

### 11. 语义色与品牌色混淆

```css
/* base.css 中 */
--color-primary: #34C759;      /* Apple Green */
--color-success: #34C759;      /* 与 primary 完全相同！ */
--color-chart-series-1: #34C759; /* 三者同色 */
```

**问题**: `--color-primary`、`--color-success`、`--color-chart-series-1` 全部是 `#34C759`。当用户切换主题色时，成功状态和图表颜色也会跟着变，这在某些场景下不符合语义。

### 12. 渐变按钮暗色对比度不足

```css
/* buttons.css */
.btn-ai {
  background: linear-gradient(135deg, #AF52DE, #0A84FF);
}
```

紫色 `#AF52DE` 到蓝色 `#0A84FF` 的渐变在白色背景上的对比度约为 **3.2:1**，未达 WCAG AA 的 4.5:1。暗色模式下更差。

---

## 四、无障碍审查

### 13. 触摸目标不达标

| 组件 | 实际尺寸 | 要求 | 状态 |
|------|---------|------|------|
| 导航图标按钮 | 20×20px | ≥44×44px | ❌ |
| 工具栏图标 | 16×16px | ≥44×44px | ❌ |
| 状态指示点 | 8×8px | ≥44×44px | ❌ |

### 14. 焦点环样式不统一

| 模式 | 使用次数 | 问题 |
|------|---------|------|
| `focus:outline-none focus:ring-2 focus:ring-primary` | 多数 | ✅ 标准 |
| `focus:outline-none focus:ring-1 focus:ring-primary` | 部分 | ⚠️ ring-width 不一致 |
| 无 focus 样式 | 少数 | ❌ 键盘导航不可见 |

### 15. 暗色模式焦点环可见性

```css
/* dark.css 中 */
--border-color: rgba(255, 255, 255, 0.08);
```

暗色模式下边框对比度极低（1.1:1），焦点环如果依赖边框，在暗色模式下几乎不可见。

---

## 五、正面评价

1. **Lucide React 统一图标库** — 无多库混用
2. **按钮系统 CSS 变量化** — `buttons.css` 正确使用 `var(--color-primary)` 等
3. **毛玻璃按钮实现完整** — `btn-glass` 有亮/暗双模式
4. **按钮按压缩放动画** — `scale(0.97)` 符合 Apple HIG
5. **禁用态统一 opacity 0.45** — 在 `buttons.css` 中保持一致
6. **暗色模式文本非纯白** — `#F5F5F7` 而非 `#FFFFFF`，减少刺眼

---

## 六、修复优先级

| 优先级 | 问题 | 工作量 |
|--------|------|--------|
| **P0** | 统一图标尺寸标准（移除 w-7/w-3.5/w-2） | 2h |
| **P0** | 替换 5126 处 `bg-slate`/`text-slate` 为语义色 | 1-2天 |
| **P1** | 消除 `btn-amber`/`btn-warning` 重复 | 30min |
| **P1** | 统一圆角为标准值（10px） | 4h |
| **P1** | 修复渐变按钮对比度 | 1h |
| **P2** | 统一禁用态 opacity（0.45） | 1h |
| **P2** | 统一焦点环宽度（2px） | 2h |
| **P3** | 分离语义色与品牌色 | 4h |
| **P3** | 补充暗色模式焦点环可见性 | 2h |
