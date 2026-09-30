# ADR-035: 小程序 CSS 布局深度优化方案

> 架构决策记录 ADR-035
> 状态：已实施
> 日期：2026-09-22
> 领域：前端/小程序/UI

---

## 一、背景与问题

### 1.1 发现的问题

根据微信官方小程序设计指南审查，发现以下核心问题：

| 问题 | 严重程度 | 影响范围 |
|------|---------|---------|
| 导航栏高度未适配 safe-area-inset-top | 🔴 高 | 所有使用 NavBar 的页面 |
| 底部未处理 iPhone Home Indicator | 🔴 高 | 所有列表/滚动页面 |
| 字号层级混乱 | 🟡 中 | 全局文字可读性 |
| 缺少统一栅格系统 | 🟡 中 | 页面布局一致性 |
| CSS 变量编码损坏 | 🔴 高 | design-tokens.wxss |

### 1.2 具体问题详情

**问题①：导航栏溢出**
- 导航栏高度固定 88rpx，未考虑状态栏高度
- 在 iPhone X 以上机型，导航栏会遮挡状态栏内容
- 正确做法：`height: calc(88rpx + env(safe-area-inset-top))`

**问题②：底部安全区缺失**
- 多个页面缺少 `safe-area-inset-bottom` 适配
- iPhone X 以上机型的 Home Indicator 会遮挡底部内容

**问题③：字号层级混乱**
- 部分页面使用 `font-size: 28rpx`，部分使用 `14px`
- 缺乏统一的字号层级规范

---

## 二、决策

### 2.1 采用方案

1. **修复 design-tokens.wxss 编码问题** - 重写为正确 UTF-8
2. **创建 grid-system.wxss** - 统一栅格系统
3. **创建 typography.wxss** - 统一字号层级
4. **修复 NavBar 组件** - 添加 safe-area-inset-top
5. **批量修复页面** - 添加底部安全区

### 2.2 字号层级规范（符合微信规范）

| 级别 | 用途 | 大小 (px/rpx) | 字重 |
|------|------|--------------|------|
| Display | 超大标题 | 28px / 56rpx | Bold 700 |
| Title XL | 大标题 | 22px / 44rpx | Bold 700 |
| Title LG | 标题 | 20px / 40rpx | Bold 700 |
| Title MD | 次标题 | 17px / 34rpx | Semibold 600 |
| Title SM | 小标题 | 15px / 30rpx | Semibold 600 |
| Body | 正文 | 15px / 30rpx | Regular 400 |
| Body SM | 小正文 | 14px / 28rpx | Regular 400 |
| Caption | 辅助文字 | 13px / 26rpx | Medium 500 |
| Caption SM | 次要文字 | 12px / 24rpx | Regular 400 |

---

## 三、实施内容

### 3.1 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `design-tokens.wxss` | 🔄 重写 | 修复编码，补充安全区工具类 |
| `grid-system.wxss` | ✨ 新建 | 统一栅格系统 (12列) |
| `typography.wxss` | ✨ 新建 | 统一字号层级 |
| `app.wxss` | 📝 修改 | 引入新文件 |
| `components/NavBar/index.wxss` | 📝 修改 | 添加 safe-area-inset-top |
| `pages/*/index.wxss` (10个) | 📝 修改 | 批量添加底部安全区 |
| `pages/*/index.wxml` (6个) | 📝 修改 | 批量添加 bottom-spacing |

### 3.2 新增工具类

```css
/* 安全区 */
.safe-top { padding-top: env(safe-area-inset-top); }
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
.safe-area-box { padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }

/* 底部间距 */
.bottom-spacing { height: calc(40rpx + env(safe-area-inset-bottom)); }
.tabbar-safe-bottom { height: calc(40rpx + env(safe-area-inset-bottom)); }
```

---

## 四、效果验证

### 4.1 预期效果

- ✅ 导航栏正确显示在状态栏下方
- ✅ 底部内容不被 Home Indicator 遮挡
- ✅ 所有页面字号层级统一
- ✅ 布局对齐到 16px (32rpx) 基准网格

### 4.2 测试设备

- iPhone SE (无安全区)
- iPhone X/11/12/13 (有安全区)
- iPhone 14 Pro Max (动态岛)

---

## 五、后续建议

1. 在真机上全面测试各机型显示效果
2. 考虑添加深色模式适配
3. 建立组件库文档，统一开发规范

---

*文档版本：v1.0 | 最后更新：2026-09-22 | 维护者：RMFOOD 架构组*
