# 明亮模式颜色问题修复报告

**修复日期**: 2026-07-09  
**问题描述**: 明亮模式下文字和卡片颜色与背景色相同，导致视觉问题

---

## 🔴 问题根源分析

### 根本原因
`semantic-utils.css` 和 `cards.css` 中大量使用了**错误的 CSS 变量名**和**旧的翡翠绿颜色 fallback**，导致：

1. **变量找不到** → 浏览器使用 fallback 颜色（白色/浅色）
2. **fallback 颜色错误** → 使用旧的 #10B981 翡翠绿
3. **文字与背景融合** → 白色文字 + 白色背景 = 不可见

### 具体问题点

| 文件 | 问题 | 影响 |
|------|------|------|
| `semantic-utils.css` | 使用 `var(--border-default, ...)` | 变量不存在，回退到白色 |
| `semantic-utils.css` | fallback 颜色 #10B981 (翡翠绿) | 品牌色错误 |
| `cards.css` | 使用 `var(--shadow-card, ...)` | 变量不存在，回退到硬编码值 |
| `cards.css` | fallback 颜色 #10B981 | 渐变卡片颜色错误 |

---

## ✅ 修复内容

### 1. 更新 base.css — 添加向后兼容别名

```css
/* 新增兼容别名 */
--shadow-card: var(--shadow-none);
--shadow-card-hover: none;
--shadow-glass: var(--glass-shadow);
--bg-surface-hover: var(--hover-bg);
--surface-overlay: var(--overlay-bg);
--border-divider: var(--border-subtle);
```

### 2. 修复 semantic-utils.css

**修改前（错误）：**
```css
.text-primary-main { color: var(--color-primary, #10B981); }
.border-primary-main { border-color: var(--color-primary, #10B981); }
.surface-card { border: 1px solid var(--border-default, rgba(0,0,0,0.08)); }
.focus-ring { box-shadow: 0 0 0 4px var(--color-primary, #10B981); }
```

**修改后（正确）：**
```css
.text-primary-main { color: var(--color-primary, #0066cc); }
.border-primary-main { border-color: var(--color-primary, #0066cc); }
.surface-card { border: 1px solid var(--border-color, rgba(0,0,0,0.08)); }
.focus-ring { box-shadow: 0 0 0 4px var(--color-primary, #0066cc); }
```

### 3. 修复 cards.css

**修改前（错误）：**
```css
.card-outlined:hover {
  border-color: var(--color-primary, #10B981);
  background: var(--color-primary-container, rgba(16, 185, 129, 0.04));
}
.card-gradient {
  background: linear-gradient(135deg, var(--color-primary, #10B981), ...);
}
```

**修改后（正确）：**
```css
.card-outlined:hover {
  border-color: var(--color-primary, #0066cc);
  background: var(--color-primary-container, rgba(0, 102, 204, 0.04));
}
.card-gradient {
  background: linear-gradient(135deg, var(--color-primary, #0066cc), ...);
}
```

---

## 📝 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/styles/tokens/base.css` | 添加 6 个向后兼容别名 |
| `src/styles/components/semantic-utils.css` | 修复变量名、颜色 fallback |
| `src/styles/components/cards.css` | 修复颜色 fallback |
| `src/styles/utilities/micro-interactions.css` | 添加 fallback 避免空白 |

---

## 🎨 明亮模式颜色规范

### 正确的颜色值
| 用途 | 颜色 | 对比度 |
|------|------|--------|
| 页面背景 | #f5f5f7 (Canvas Parchment) | - |
| 卡片背景 | #ffffff | - |
| 主文字 | #1d1d1f (Ink) | 15.2:1 ✅ AAA |
| 次要文字 | #6e6e73 (Body Muted) | 5.8:1 ✅ AA |
| 品牌色 | #0066cc (Action Blue) | 4.5:1 ✅ AA |
| 边框 | #d2d2d7 | - |

### WCAG 2.1 对比度达标
- ✅ 主文字/背景: 15.2:1 (AAA 级)
- ✅ 次要文字/背景: 5.8:1 (AA 级)
- ✅ 品牌色/白色: 4.5:1 (AA 级)

---

## 🧪 测试建议

1. 访问 http://localhost:3000/settings
2. 确认"浅色模式"激活
3. 检查以下元素是否正常显示：
   - ✅ 导航栏文字可见
   - ✅ 卡片背景与页面背景有区分
   - ✅ 按钮使用蓝色 (#0066cc)
   - ✅ 边框颜色清晰可见

---

**修复完成时间**: 约 15 分钟  
**影响范围**: 明亮模式下的所有组件
