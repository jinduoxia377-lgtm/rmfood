# 智能对话反馈内容字体层级修正报告

**问题**: AI 回复内容字体过大，不符合主题系统规范  
**根因**: ① chatTheme.css 存在重复定义块 L692-705（em 相对值冲突）；② MDStyles 独立定义未引用 chatTheme 令牌；③ 字体层级对标页面级标题而非对话内容  
**日期**: 2026-05-31  
**状态**: ✅ 修复完成

---

## 一、根因分析

### 1.1 三套字体系统同时存在

| 来源 | 规则块 | 覆盖范围 | 问题 |
|------|--------|---------|------|
| `chatTheme.css` L434-479 | `.chat-bubble-ai h1` 等 | 纯 HTML 标签 | ✅ 正确 |
| `chatTheme.css` L692-705 | `.chat-bubble-ai h1` 等 | 同上，重复定义 | ❌ **冲突** — 用 em 相对值，h1=18.6px |
| `MarkdownRenderer.tsx` MDStyles 注入 | `.chat-md-h1` 等 | 实际渲染的类名 | ⚠️ 独立运行，字号为 24px/18px 过大 |

### 1.2 字体层级错位

修复前 MDStyles 将对话内容标题对标**页面级**标题：

```
修复前 (MDStyles):
  h1 = 24px  ← 对标页面 H3，但对话内不需要这么粗
  h2 = 18px  ← 接近页面 H4
  h3 = 16px  ← 接近页面 Body-lg
  p  = 15px
  ↑ 整体偏大，与用户界面其他内容对比失衡
```

---

## 二、修正方案

### 2.1 删除重复块

移除 `chatTheme.css` L691-711 的旧版 Markdown 内部样式块（含 `1.33em`/`1.17em` 等 em 相对值）。

### 2.2 统一字体层级（对话专用紧凑层级）

对话气泡内的内容不是页面标题，应该使用**紧凑层级**：

```
聊天内容层级:
  h1 → 16px (Body-lg)    对应页面 Body-lg
  h2 → 15px (Body)       对应页面 Body
  h3/h4 → 14px (Body-sm) 对应页面 Body-sm
  p/ul/li → 14px (Body-sm)
  code → 12px (Caption)
```

### 2.3 MDStyles 同步修正

`--md-font-*` 令牌定义对齐 `--chat-font-*` 令牌，确保两套系统输出一致。

---

## 三、最终字体大小对照

### 3.1 chatTheme.css（权威定义）

| 元素 | 变量引用 | 实际大小 |
|------|----------|---------|
| h1 | `var(--chat-font-lg, 1rem)` | **16px** |
| h2 | `var(--chat-font-md, 0.9375rem)` | **15px** |
| h3 | `var(--chat-font-base, 0.875rem)` | **14px** |
| h4 | `var(--chat-font-base, 0.875rem)` | **14px** |
| p | `var(--chat-font-base, 0.875rem)` | **14px** |
| ul/ol/li | `var(--chat-font-base, 0.875rem)` | **14px** |
| code | `var(--chat-font-sm, 0.75rem)` | **12px** |

### 3.2 MDStyles（注入 CSS）

| 元素 | 变量引用 | 实际大小 |
|------|----------|---------|
| h1 | `var(--md-font-h1, 1rem)` | **16px** |
| h2 | `var(--md-font-h2, 0.9375rem)` | **15px** |
| h3 | `var(--md-font-h3, 0.875rem)` | **14px** |
| h4 | `var(--md-font-h4, 0.875rem)` | **14px** |
| p | `var(--md-font-body, 0.875rem)` | **14px** |
| table/th/td | `var(--md-font-sm, 0.75rem)` | **12px** |

---

## 四、修复前后对比

```
修复前 (过大):          修复后 (符合规范):
h1: 24px (H3层级)  →   16px (Body-lg)
h2: 18px            →   15px (Body)
h3: 16px            →   14px (Body-sm)
p:  15px            →   14px (Body-sm)
code: 12px          →   12px (Caption)
表格: 13px          →   12px (Caption)
```

**视觉影响**: 标题与正文差距缩小，整体更紧凑，阅读体验更接近消息对话界面而非文档页面。

---

## 五、验证结果

```
✅ TypeScript: 0 errors
✅ 重复 .chat-bubble-ai h1/h2 块: 0
✅ L1-700 硬编码 px font-size: 0
✅ 两套系统字号一致: h1=16px, h2=15px, h3=h4=p=14px
```

---

## 六、变更文件

| 文件 | 变更 |
|------|------|
| `features/styles/chatTheme.css` | 删除 L691-711 旧块；h1~p 字号从 24/18/16px 下调至 16/15/14px |
| `features/components/pro/MarkdownRenderer.tsx` | `--md-font-*` 令牌下调；所有 `.chat-md-*` 规则同步；fallback 值统一 |
