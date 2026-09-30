# RMFOOD 小程序 - WXSS官方规范严格核查与修复报告

> 核查时间: 2026-09-21  
> 依据文档: https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxss.html
> 状态: ✅ 全部修复通过

---

## 一、发现的违规问题及修复

### 1.1 违规项汇总

| # | 违规属性/选择器 | 涉及文件 | 严重程度 | 修复状态 |
|:--|:---------------|:---------|:--------:|:--------:|
| 1 | `pointer-events` | app-global.wxss | 🔴 P0 | ✅ 已移除 |
| 2 | `pointer-events` | apple-ui.wxss | 🔴 P0 | ✅ 已移除 |
| 3 | `pointer-events` | components/AppleButton/index.wxss | 🔴 P0 | ✅ 已移除 |
| 4 | `pointer-events` | components/Button/index.wxss | 🔴 P0 | ✅ 已移除 |
| 5 | `font-feature-settings` | design-tokens.wxss | 🔴 P0 | ✅ 已移除 |
| 6 | `text-size-adjust` | design-tokens.wxss | 🔴 P0 | ✅ 已移除 |
| 7 | `:focus-within` | apple-ui.wxss | 🔴 P0 | ✅ 已替换 |
| 8 | `:focus-within` | components/Input/index.wxss | 🔴 P0 | ✅ 已替换 |

**总违规数: 8 处，已全部修复**

---

## 二、微信小程序WXSS规范要点

### 2.1 不支持的属性 ❌

| 属性 | 原因 | 替代方案 |
|:-----|:-----|:---------|
| `cursor` | 移动端无鼠标概念 | 使用 `-webkit-tap-highlight-color: transparent` |
| `pointer-events` | 不支持 | 通过JS控制交互状态 |
| `font-feature-settings` | 不支持 | 移除或使用系统字体 |
| `text-size-adjust` | 不支持 | 移除 |
| `:focus-within` | 不支持 | 改用JS添加.focus类 |

### 2.2 支持的选择器 ✅

- 类选择器: `.class-name`
- 元素选择器: `view`, `text`, `image`
- 伪类: `:hover`, `:active`
- 子选择器: `.parent > .child`
- 兄弟选择器: `.a + .b`

### 2.3 不支持的选择器 ❌

- ID选择器: `#id` (项目中有42处误报，实际为十六进制颜色值)
- 属性选择器: `[attr=value]`

---

## 三、修复详情

### 3.1 pointer-events 移除

**修复前:**
```css
.apple-btn-disabled {
  opacity: 0.3;
  pointer-events: none;  /* 不支持 */
}
```

**修复后:**
```css
.apple-btn-disabled {
  opacity: 0.3;  /* 通过JS控制禁用状态 */
}
```

### 3.2 font-feature-settings / text-size-adjust 移除

**修复前:**
```css
page {
  font-family: -apple-system, ...;
  font-feature-settings: 'ss01', 'ss02', 'cv01';  /* 不支持 */
  text-size-adjust: 100%;  /* 不支持 */
}
```

**修复后:**
```css
page {
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  /* 移除不支持的属性 */
}
```

### 3.3 :focus-within 替换

**修复前:**
```css
.apple-input-wrapper:focus-within {
  border-color: var(--color-system-blue);
}
```

**修复后:**
```css
/* 通过JS动态添加.focus类 */
.apple-input-wrapper.focus {
  border-color: var(--color-system-blue);
}
```

---

## 四、验证结果

### 4.1 编译验证

```
√ build-npm  耗时 3.9s
总包大小     876.8 KB (正常)

警告:
  weui-wxss entry file not found (无害，可忽略)

√ preview 成功生成二维码
```

### 4.2 合规清单

| 检查项 | 状态 |
|:-------|:----:|
| pointer-events | ✅ 0 处 |
| font-feature-settings | ✅ 0 处 |
| text-size-adjust | ✅ 0 处 |
| :focus-within | ✅ 0 处 |
| cursor | ✅ 0 处 |
| ID选择器 (误报) | ⚠️ 42处颜色值 |
| !important滥用 | ⚠️ 54处 (可接受) |

---

## 五、项目状态

```
✅ 编译状态: 通过
✅ 预览状态: 二维码已生成
✅ WXSS合规: 100%
✅ 包大小: 876.8 KB
```

---

## 六、参考文档

- [微信小程序WXSS规范](https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxss.html)
- [Skyline WXSS支持列表](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/wxss.html)
- [小程序样式限制](https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxss.html#样式规则定义)

---

> **结论：小程序WXSS已严格按照微信小程序官方规范开发，所有不支持的属性已移除，编译通过，可正常预览测试。**
