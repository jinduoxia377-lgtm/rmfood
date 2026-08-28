# 导航栏尺寸修复报告（最终版）

> 基于 2026-07-25 审查报告执行
> 三轮修复完整执行，所有可操作问题已修复

---

## 变更文件清单

| 文件 | 修复内容 |
|------|---------|
| `frontend/src/hooks/useMobile.ts` | 断点 1200→1024, getContainerMaxWidth 1200→1280 |
| `frontend/src/components/layout/MainLayout.tsx` | 触摸目标/padding/safe-area/字号/z-index/paddingLeft/键盘按钮显隐 |
| `frontend/src/styles/tokens/base.css` | 新增 --z-sidebar:301, --z-header:100 |
| `frontend/src/components/ui/CommandPalette.tsx` | z-[60]/z-[70] → var(--z-overlay)/var(--z-sidebar) |
| `frontend/src/components/ai/features/components/pro/MarkdownRenderer.tsx` | 全部 Indigo 硬编码 → Forest Green |
| `frontend/src/components/ai/features/components/StartConversationCard.tsx` | rgba(99,102,241) → rgba(16,185,129) |
| `frontend/src/components/ai/features/GenerateTab/config/generateTabConfig.ts` | SLEEP 色值 #6366f1 → #10b981 |
| `frontend/src/components/ai/features/components/PreferenceLearner.tsx` | 末位 #6366f1 → #34d399 |
| `frontend/src/components/ai/features/components/StabilityTimeSeries.tsx` | 稳定性指标 indigo → primary green |
| `frontend/src/components/database/KnowledgeGraph.tsx` | viewport dot + linkHighlight blue → primary green |

---

## 完整修复记录

### 第1轮 — 导航栏尺寸（P0/P1/P2）

#### P0 — 触摸目标 WCAG 2.1 AA 合规

所有交互按钮从 `40×40px` 扩大到 `44×44px`（共 11 处声明）：

| 行号 | 元素 | 修复前 | 修复后 |
|------|------|--------|--------|
| 227–228 | Logo 图标容器 | 40×40 | **44×44** |
| 269–270 | 移动端关闭按钮 | 40×40 | **44×44** |
| 424–425 | 用户头像按钮 | 40×40 | **44×44** |
| 468–469 | 退出按钮 | 40×40 | **44×44** |
| 664–665 | 汉堡/菜单按钮 | 40×40 | **44×44** |
| 684 | 折叠/展开按钮 | 40×40 | **44×44** |

✅ 无 `40px` 按钮硬编码残留。

#### P0 — 断点定义与 DESIGN.md 对齐

| 位置 | 修改前 | 修改后 |
|------|--------|--------|
| BREAKPOINTS.desktop | `1200` | **`1024`** |
| getContainerMaxWidth desktop | `return 1200` | **`return 1280`** |

#### P1 — 内容区对齐

| 行号 | 修改前 | 修改后 |
|------|--------|--------|
| 814 | `'p-5'` (20px) | `'p-6'` (24px) — 与 header `px-6` 对齐 |

#### P2 — Safe Area 语义修正

| 行号 | 修改前 | 修改后 |
|------|--------|--------|
| 640 | `paddingBottom: 'var(--safe-area-inset-top, 0px)'` | `paddingBottom: 'var(--safe-area-inset-bottom, 0px)'` |

#### P2 — 导航项字号规范对齐

| 行号 | 元素 | 修改前 | 修改后 |
|------|------|--------|--------|
| 355 | 导航项标签文本 | `text-body-sm (14px)` | **`text-overline (11px)`** |
| 440 | 用户全名（恢复） | `text-overline (11px)` ← 误改 | **`text-body-sm (14px)`** |

---

### 第2轮 — Z-Index 体系统一

**base.css** 新增两个 z-index 变量：
```css
--z-sidebar: 301;       /* sidebar 在 overlay 之上 */
--z-header: 100;        /* 顶栏在内容之上、overlay 之下 */
```

**MainLayout.tsx** 替换所有硬编码 Tailwind z-index：

| 行号 | 元素 | 修改前 | 修改后 |
|------|------|--------|--------|
| 564 | 遮罩层 overlay | `z-40` | `zIndex: 'var(--z-overlay, 300)'` |
| 586 | 侧边栏 aside | `z-50` | `zIndex: 'var(--z-sidebar, 301)'`（mobile/tablet） |
| 637 | 顶栏 header | `z-20` | `zIndex: 'var(--z-header, 100)'` |
| 632 | paddingLeft | `MD3.sidebar.width`（JS无法解析CSS变量） | `'var(--sidebar-width, 256px)'` |

**CommandPalette.tsx** 同步更新：
| 行号 | 元素 | 修改前 | 修改后 |
|------|------|--------|--------|
| 255 | 遮罩 backdrop | `z-[60]` | `style={{ zIndex: 'var(--z-overlay, 300)' }}` |
| 263 | 面板 modal | `z-[70]` | `style={{ zIndex: 'var(--z-sidebar, 301)' }}` |

---

### 第3轮 — Chat/组件 Indigo 残留清理

| 文件 | 修改 |
|------|------|
| MarkdownRenderer.tsx | `#6366f1/#4f46e5/#818cf8/#eef2ff/#a5b4fc/#4338ca` + 所有 rgba(99,102,241) → Forest Green 等价色 |
| StartConversationCard.tsx | `rgba(99,102,241,...)` → `rgba(16,185,129,...)` |
| generateTabConfig.ts | SLEEP 色值 `#6366f1` → `#10b981` |
| PreferenceLearner.tsx | 颜色数组末位 `#6366f1` → `#34d399` |
| StabilityTimeSeries.tsx | 稳定性指标 `--color-indigo-500, #6366F1` → `--color-primary, #10b981` |
| KnowledgeGraph.tsx | viewport dot `#3b82f6` + linkHighlight `#3b82f6` → `var(--color-primary, #10b981)` |

---

### 第4轮 — Header 右侧拥挤优化

| 行号 | 修改 |
|------|------|
| 800 | 键盘快捷键按钮：`isMobile ? 'hidden' : 'flex'` → `isMobile \|\| isTablet ? 'hidden' : 'flex'` |

---

## WCAG 验证结果

| 检查项 | 修复前 | 修复后 |
|--------|--------|--------|
| 最小触摸目标 | ❌ 40×40 (所有按钮) | ✅ 44×44 (全部) |
| Header/main padding 对齐 | ❌ 24px vs 20px | ✅ 24px vs 24px |
| Safe Area 底部适配 | ⚠️ 语义错误 | ✅ 正确使用 inset-bottom |
| 断点与设计文档一致 | ❌ 1200 vs 1024 | ✅ 1024 |
| 容器最大宽度 | ❌ 1200px | ✅ 1280px (max-w-7xl) |
| Z-Index 体系统一 | ❌ 两套硬编码数值 | ✅ 语义化 CSS 变量 |
| Sidebar paddingLeft 解析 | ❌ JS无法解析CSS变量 | ✅ 浏览器原生支持 |
| Chat 子系统品牌色统一 | ❌ Indigo 硬编码残留 | ✅ Forest Green 品牌色 |

---

## 无需处理项（语义化功能色）

| 位置 | 原因 |
|------|------|
| MarkdownRenderer `--md-indigo` CSS变量 | 代码块/引用边框内容渲染色，非 UI 主题色 |
| KnowledgeGraph node 色数组 | 6种化合物类型数据分类色（indigo/violet/pink/rose/orange/yellow） |
| PreferenceLearner `#8b5cf6` (violet) | 雷达图第3维度功能数据色，非主题色 |
| StabilityTimeSeries COLORS[1,3,4] | error/warning/pink 语义色，与主题色无关 |

---

## 总结

**全部 9 项导航栏审查问题 + 7 项 Indigo 残留问题已修复**，涉及 10 个文件，所有修复已通过验证。
