# 汉堡导航栏深度分析报告 & 修复报告

> 审查范围: MainLayout.tsx + DESIGN.md + useMobile.ts
> 审查标准: WCAG 2.1 AA + DESIGN.md 规范

---

## 一、发现的所有问题（17项）

### P0 Bug（4项）

| # | 问题 | 影响 |
|---|------|------|
| 1 | header 有两个独立 `style={{}}` 属性 | React prop 重复警告，第二个覆盖第一个 |
| 2 | 搜索按钮 className 同时含 `hidden` + 条件 `flex` | Tailwind display 冲突，依赖 CSS 加载顺序 |
| 3 | sidebar `height: 100vh` | 移动端 Safari 地址栏收起时底部被遮挡 |
| 4 | overlay 遮罩在所有设备都渲染 | tablet/desktop 图标条模式下出现多余遮罩层 |

### P0 设计规范偏差（4项）

| # | DESIGN.md 规范 | 实际实现 |
|---|--------------|---------|
| 5 | tablet (768-1023px): Sidebar → **图标模式 w-16** | tablet 被当作 mobile drawer (fixed overlay)，无图标条 |
| 6 | 导航项 **44px 高** | `height: '48px'` |
| 7 | hover bg: `{colors.primary.50}` | `hover:bg-[var(--bg-surface-hover)]`（中性灰） |
| 8 | Active 项: `border-l-3 border-primary-500` | 无左侧指示器，仅背景色变化 |

### P1 无障碍问题（2项）

| # | 问题 |
|---|------|
| 9 | nav item icon 容器 36×36px，不满足 44px WCAG 触摸目标 |
| 10 | useFocusTrap 仅在 mobile/tablet 生效，desktop 展开态键盘焦点失控 |

### P1 交互问题（3项）

| # | 问题 |
|---|------|
| 11 | 只能左滑关闭，无法从左侧边缘右滑打开抽屉 |
| 12 | tablet 时主内容区加了 overflow-hidden（图标条在 flex 流中不需要） |
| 13 | tablet 时主内容区加了 paddingLeft 偏移（图标条在 flex 流中不需要） |

### P2 代码质量问题（1项）

| # | 问题 |
|---|------|
| 14 | group title padding 硬编码 `'16px'`，未使用 CSS 变量 |

---

## 二、修复执行结果

| # | 修复 | 文件 | 行号 |
|---|------|------|------|
| 1 | header 两个 style 合并为一个 | MainLayout.tsx | L638-648 |
| 2 | 移除搜索按钮冗余 `hidden` class | MainLayout.tsx | L710 |
| 3 | `100vh` → `100dvh` | MainLayout.tsx | L605 |
| 4 | overlay 改为 `{isMobile && sidebarOpen && (...)}` | MainLayout.tsx | L561-583 |
| 5 | **新增 tablet 图标条模式** | MainLayout.tsx | L541, L587, L601 |
| 6 | nav item `height: '48px'` → `'44px'` | MainLayout.tsx | L322 |
| 7 | hover `bg-surface-hover` → `primary-50` | MainLayout.tsx | L319 |
| 8 | 添加 `borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent'` | MainLayout.tsx | L326 |
| 9 | icon 容器 `36×36` → `44×44` | MainLayout.tsx | L335-336 |
| 10 | useFocusTrap 扩展至 desktop 展开态 | MainLayout.tsx | L555-556 |
| 11 | 新增 `onSwipeRight: () => setSidebarOpen(true)` | MainLayout.tsx | L505-507 |
| 12 | main content `overflow-hidden` 改为仅 mobile | MainLayout.tsx | L628 |
| 13 | main content `paddingLeft` 改为仅 mobile | MainLayout.tsx | L635 |
| 14 | group title padding `'16px'` → `var(--space-4, 16px)` | MainLayout.tsx | L301 |
| 15 | 移除 stray `};` 残留（编辑过程修复） | MainLayout.tsx | L510 |
| 16 | 恢复 useFocusTrap + sidebarRef 声明 | MainLayout.tsx | L555-556 |
| 17 | 修复 aside className 重复 | MainLayout.tsx | L584-585 |
| 18 | 修复主内容注释块格式 | MainLayout.tsx | L621-625 |

**括号平衡**: 283 `{` / 283 `}` ✅

---

## 三、核心设计变更：Tablet 图标条模式

**之前（错误）：**
```
768-1023px (tablet): isDesktop=false → sidebar = fixed overlay drawer（与mobile相同）
```

**之后（正确）：**
```
768-1023px (tablet): isTablet=true
  → sidebarCollapsed = true（强制图标条）
  → position: relative, width: 64px（inline rail，在 flex 流中）
  → boxShadow: none（无投影，与桌面展开态一致）
  → 主内容区: paddingLeft=0（sidebar 占据左侧空间）
```

---

## 四、修改文件清单

| 文件 | 变更行数 |
|------|---------|
| `frontend/src/components/layout/MainLayout.tsx` | ~30 行 |
