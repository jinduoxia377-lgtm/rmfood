# RMFOOD 前端导航栏尺寸设计审查报告

> 审查范围：`MainLayout.tsx` + `design-system/DESIGN.md` + `useMobile.ts`
> 审查日期: 2026-07-25
> 审查标准: WCAG 2.1 AA + DESIGN.md 规范

---

## 一、审查总览

| 维度 | 合规性 | 严重问题数 | 中等问题数 | 轻微问题数 |
|------|--------|-----------|-----------|-----------|
| 触摸目标合规性 | ❌ | 5 | — | — |
| 断点定义一致性 | ❌ | 1 | — | — |
| 布局尺寸对齐 | ⚠️ | 2 | 2 | — |
| 层级叠加管理 | ✅ | — | 1 | — |
| 安全区域适配 | ⚠️ | — | 1 | 1 |

---

## 二、❌ P0 严重问题（无障碍合规硬伤）

### 问题 1：触摸目标普遍低于 WCAG 2.1 AA 标准

**标准**：所有交互元素最小触摸区域 44×44px（WCAG 2.1 AA Criteria 2.5.5）

| 元素 | 当前尺寸 | 实际触摸区域 | 状态 |
|------|---------|------------|------|
| 导航项图标容器 | 36×48px | 36×48px（宽不足） | ❌ 宽差 8px |
| 汉堡菜单按钮 | 40×40px | 40×40px | ❌ 各差 4px |
| Logo 图标按钮 | 40×40px | 40×40px | ❌ 各差 4px |
| 用户头像按钮 | 40×40px | 40×40px | ❌ 各差 4px |
| 设置/搜索图标按钮 | 40×40px (p-1.5) | 40×40px | ❌ 各差 4px |

**根因**：`MainLayout.tsx` 多处硬编码 `width: '40px', height: '40px'`，未使用 44px 最小标准。

**DESIGN.md 自身承诺**（第 829-832 行）：
```
| 按钮 | 44×44px | 所有尺寸变体均满足 |
| 导航项 | 44px 高 | sidebar item |
```

**但实际并未满足**——这是设计规范与实际实现之间的直接矛盾。

**修复方案**：
```tsx
// 所有 40px 改为 44px
// 或用 CSS padding 扩展点击区域：
style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
```

---

### 问题 2：断点定义与设计规范不一致

**DESIGN.md 断点（第 817-822 行）**：
```
Mobile  : < 768px
Tablet  : 768 – 1023px   ← 上限 1023
Desktop : ≥ 1024px       ← 起点 1024
XL      : ≥ 1280px
```

**useMobile.ts 断点（第 17-21 行）**：
```ts
mobile: 0,     // < 768
tablet: 768,   // 768 – 1199px  ← 上限差了 176px!
desktop: 1200, // ≥ 1200px      ← 起点差了 176px!
```

**影响**：在 **1024px–1199px** 宽度区间内：
- DESIGN.md 定义此区间为桌面端（Sidebar 常驻 w-64，卡片 3-4 列）
- 实际代码执行 tablet 分支逻辑（Sidebar 图标模式 w-16，卡片 2 列）
- 用户在 1280px 屏幕分屏时可能预期桌面布局，却得到平板布局

**修复**：将 `useMobile.ts` 的 `desktop` 阈值改为 `1024`，与 DESIGN.md 对齐。

---

## 三、⚠️ P1 中等问题（设计规范与实现脱节）

### 问题 3：Header 内边距与 MAIN 内容区不一致

| 区域 | Mobile (<768) | Tablet (768-1023) | Desktop (≥1024) |
|------|--------------|-------------------|-----------------|
| Header 水平 padding | `px-3` (12px) | `px-4` (16px) | `px-6` (24px) |
| Main 内容 padding | `p-3` (12px) | `p-4` (16px) | `p-5` (20px) ⚠️ |

**问题**：Desktop 下 header padding 为 24px，main padding 为 20px，相差 4px，导致内容左边界与 header 内元素左边界不对齐。

**修复**：main 区 desktop padding 改为 `p-6`（与 header 一致）。

---

### 问题 4：content max-width 值冲突

| 来源 | 断点 | 值 |
|------|------|-----|
| `DESIGN.md`「Page Frame」 | XL ≥ 1280px | `max-w-7xl` = 80rem = **1280px** |
| `useMobile.ts` `getContainerMaxWidth` | desktop ≥ 1200 | **1200px** |
| Tailwind `max-w-7xl` 标准值 | — | **1280px** |

多个页面使用 `max-w-7xl`（1280px）但 `ResponsiveContainer` hook 限制为 1200px，产生两套不同的最大宽度约束。

---

### 问题 5：Z-Index 层级体系存在冲突风险

| 元素 | MainLayout.tsx 中 z-index | dark.css 中 z-index | 风险 |
|------|--------------------------|---------------------|------|
| Overlay 遮罩 | `z-40` | `--z-overlay: 300` (base.css) | ⚠️ 不一致 |
| Sidebar | `z-50` | `--z-modal-backdrop: 1000` | ⚠️ 不一致 |
| Header | `z-20` | `--z-toast: 300` | ⚠️ 不一致 |
| CommandPalette | `z-[70]` | `--z-tooltip: 400` | 冲突！|

**问题**：CSS 变量定义了语义化 z-index（300/1000/1200/1300），但 MainLayout 组件硬编码了整数 z-index（20/40/50/70），两套体系共存且数值范围不重叠，极易在后续开发中产生层叠错误。

**修复**：统一使用 CSS 变量命名体系，删除所有硬编码 `z-XX` 值。

---

### 问题 6：移动端 Sidebar 打开时主内容偏移计算有隐患

`MainLayout.tsx` 第 632 行：
```tsx
paddingLeft: (isMobile || isTablet) && sidebarOpen ? MD3.sidebar.width : '0px'
```

**问题**：
1. `MD3.sidebar.width = 'var(--sidebar-width, 256px)'` 传入 inline style 时作为字符串，浏览器无法正确解析 CSS 变量引用
2. 应使用与 CSS 相同的变量名，或通过 CSS class 控制偏移，而非 inline style

---

## 四、🔵 P2 轻微问题（体验优化）

### 问题 7：Header 右侧元素过度拥挤

Desktop 模式下 header 右侧同时展示 6 个交互元素：
```
[搜索] [新建配方] [通知] [主题] [设置] [键盘]
```

在 1280px 可用宽度下（减去 sidebar 256px 和折叠图标区 80px），剩余约 944px。实际元素约占 400px，尚可接受。但在 1200px 以下宽度时可能出现压缩。

**建议**：将「键盘快捷键」和「设置」合并或仅在 hover 时显示。

---

### 问题 8：Safe Area 适配不完整

Header 正确应用了顶部安全区：
```tsx
paddingTop: 'var(--safe-area-inset-top, 0px)',
paddingBottom: 'var(--safe-area-inset-top, 0px)',  // ⚠️ 底部也用了 top 值，应为 0
```

**问题**：`paddingBottom` 不应使用 `safe-area-inset-top`，应使用 `safe-area-inset-bottom`（值为 0 时无影响，但语义错误）。另外移动端/平板端底部无 safe area 处理。

---

### 问题 9：导航项字号与设计规范不符

**DESIGN.md（第 311-312 行）**：
```yaml
badge-pending:
  typography: "{typography.overline}"  # 11px
```

**MainLayout.tsx 第 355 行**：
```tsx
fontSize: 'var(--text-body-sm, 14px)',  // 实际使用 14px
```

导航项标签字号使用 `body-sm (14px)` 而非设计规范推荐的 `overline (11px)`，视觉层级略显沉重。

---

## 五、修复优先级

| 优先级 | 问题 | 修复工作量 | 影响用户群 |
|--------|------|-----------|-----------|
| **P0** | #1 触摸目标 44px | ~15 min | 全部移动端/平板用户 |
| **P0** | #2 断点不一致 (1024 vs 1200) | ~5 min | 768-1199px 区间用户 |
| **P1** | #3 Header/Main padding 对齐 | ~2 min | 全部用户 |
| **P1** | #4 max-width 冲突 | ~10 min | XL 屏幕用户 |
| **P1** | #5 Z-index 统一 | ~15 min | 所有弹窗/面板用户 |
| **P1** | #6 Sidebar 偏移计算 | ~10 min | 移动端用户 |
| **P2** | #7 Header 拥挤优化 | ~20 min | 中小屏桌面用户 |
| **P2** | #8 Safe Area 语义修正 | ~2 min | 刘海屏设备 |
| **P2** | #9 导航项字号 | ~5 min | 全部用户 |

---

## 六、总结

导航栏系统整体架构良好（响应式、Glassmorphism、手势支持），但存在**两个关键合规问题**需立即修复：

1. **所有 40px 图标按钮违反 WCAG 2.1 AA** — 这是无障碍合规硬伤，建议通过扩大视觉尺寸或添加 invisible padding 来使触摸区域达到 44×44px
2. **断点 1024 vs 1200 的偏差** — 导致 768-1199px 区间行为与设计文档不符，建议统一到 1024px

其余为设计一致性维护问题，建议在下一迭代中依次处理。
