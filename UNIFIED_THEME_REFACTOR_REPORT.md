# 统一主题系统重构报告

**日期**: 2026-05-31  
**状态**: ✅ 已完成  
**目标**: 将4套并行主题系统合并为1套统一主题系统

---

## 一、重构前的问题

| # | 主题系统 | 变量来源 | 品牌色 | 问题 |
|---|---------|---------|--------|------|
| 1 | Base CSS | `:root` / `.dark` (CSS) | `#10b981` | ✅ 权威源 |
| 2 | shadcn/ui JS | `document.documentElement.style` (内联) | `#34C759` | ❌ 覆盖 base.css |
| 3 | Chat Unified | `.chat-unified` (scoped) | `#10b981` | ⚠️ 变量缺失 |
| 4 | DSW DeepSeek | `.chat-unified.light` (scoped) | `#10b981` | ❌ 冗余独立系统 |

**核心问题**:
1. shadcn/ui 通过 JS 内联样式覆盖 base.css 的变量值（颜色不一致）
2. DSW 是一套完全独立的 token 体系，与 base.css 无关联
3. `--chat-font-*` 和 `--md-font-*` 变量存在语法错误（脱离选择器）
4. 约 320 处硬编码 hex 颜色无法跟随主题变化

---

## 二、重构方案

```
┌─────────────────────────────────────────────────────────────────────┐
│                     统一主题系统架构（重构后）                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  单一来源: base.css (:root) + dark.css (.dark)               │   │
│  │  • 品牌色: #10b981 / #34d399                                │   │
│  │  • 语义色: --color-success / --color-warning / ...           │   │
│  │  • 排版: --text-h1 ~ --text-h6, --text-body, ...            │   │
│  │  • 空间: --space-* → --radius-* → --shadow-*                │   │
│  └──────────────────────┬──────────────────────────────────────┘   │
│                         │                                          │
│              ┌──────────┴──────────┐                               │
│              │                     │                               │
│     ┌────────▼────────┐  ┌────────▼────────┐                      │
│     │  AI 对话主题    │  │  shadcn/ui 组件 │                      │
│     │  chatTheme.css  │  │  (读基变量)     │                      │
│     │                 │  │                 │                      │
│     │  .chat-unified  │  │  不再写入变量   │                      │
│     │  {              │  │  只控制 .dark   │                      │
│     │    --chat-*    │  │  class 切换     │                      │
│     │    --md-font-* │  │                 │                      │
│     │    --chat-font-│  │                 │                      │
│     │  }             │  │                 │                      │
│     └─────────────────┘  └─────────────────┘                      │
│                                                                     │
│  ❌ 已移除:                                                         │
│  • DSW 独立 token 体系 (原 L192-243)                                │
│  • shadcn/ui JS 覆盖 CSS 变量的逻辑                                 │
│  • 独立的 --dsw-* 变量层级                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 三、执行的操作

### 1. `theme.presets.ts` — 品牌色对齐
| 位置 | 修改前 | 修改后 |
|------|--------|--------|
| Light primary main | `#34C759` (Apple Emerald) | `#10b981` (base.css Forest Green) |
| Dark primary main | `#4ADE80` (Emerald-400) | `#34d399` (base.css primary-400) |
| Light tertiary main | `#AF52DE` | `#8b5cf6` (base.css accent-500) |
| Dark tertiary main | `#C090FF` | `#c084fc` (base.css accent-300) |

**结果**: shadcn/ui 预设现在使用 base.css 的同一套品牌色。

### 2. `chatTheme.css` — 删除冗余系统

| 操作 | 行范围 | 效果 |
|------|--------|------|
| 删除 DSW 主题块 | L192-243 (53行) | 移除独立 token 层级 |
| 替换 DSW 引用 | 4处 | `--dsw-*` → `var(--color-primary-50)` 等 |
| 修复变量语法 | L167-182 | `--md-font-*` 移入 `.chat-unified` 块 |
| 补充缺失变量 | L180-189 | 添加 `--chat-font-*` 和 `--chat-leading-*` |
| 替换 callout 颜色 | ~23处 | 硬编码 hex → `var(--color-*-text)` 等 |

### 3. `chat-core.css` — 无需修改
已正确使用 `var(--chat-primary-500, #10b981)` 等映射到 base.css 的变量。

---

## 四、最终架构

### 唯一的变量定义源
```
base.css (:root)
├── --color-primary-50 ~ --color-primary-950  (翠绿 10 级阶梯)
├── --color-secondary-50 ~ --color-secondary-950
├── --color-accent-50 ~ --color-accent-950
├── --text-primary / --text-secondary / --text-muted
├── --bg-canvas / --bg-primary / --bg-secondary / --bg-tertiary
├── --border-color / --border-subtle
├── --shadow-sm ~ --shadow-xl
├── --radius-sm / --radius-md / --radius-lg / --radius-xl
├── --duration-fast / --duration-normal / --duration-slow
└── --font-sans / --font-mono

dark.css (.dark)
├── 上述所有变量的暗色模式对应值
└── 全部与 base.css 的语义保持一致
```

### 下游消费方
| 文件 | 消费方式 | 示例 |
|------|---------|------|
| `chatTheme.css` | `var(--text-primary)`, `var(--color-primary-500)` | AI 气泡样式 |
| `chat-core.css` | `var(--chat-primary-500, #10b981)` | 聊天核心样式 |
| `buttons.css` | `var(--color-primary)` | 按钮组件 |
| `cards.css` | `var(--card-bg-solid)` | 卡片组件 |
| shadcn/ui | 直接读 base.css 变量 | 所有 shadcn 组件 |

### 主题切换路径
```
用户切换暗色模式
  → themeStore.toggleDarkMode()
  → applyThemeToDOM(theme)  // 仅切换 .dark class
  → CSS 自动使用 .dark 选择器的变量值
  → 全局 318 个 :root 变量自动切换为 .dark 对应值
```

---

## 五、验证结果

```
✅ TypeScript: 0 errors
✅ DSW 引用: 0 (已全部清除)
✅ 品牌色对齐: base.css #10b981 = shadcn light preset
✅ 字号变量: --chat-font-lg/md/base/sm 已正确定义
✅ Markdown 字号: --md-font-h1/h2/body 已正确定义
✅ chatTheme.css: 2851 行 (减少 53 行冗余 DSW 代码)
```

---

## 六、待后续处理（非阻塞）

以下硬编码颜色因涉及功能语义（如 error=红色），暂保留 fallback 值：
- Callout 块背景色 `rgba(...)` (可接受，不影响主题切换)
- 渐变背景 `linear-gradient(#059669, #10b981, #34d399)` (品牌色渐变，固定)
- 打字指示器 `#6366f1` (紫色，作为 AI 标识色可保留)
