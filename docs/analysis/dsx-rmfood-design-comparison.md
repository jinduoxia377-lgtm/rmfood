# RMFOOD × DSH 设计系统深度对比分析报告

> 生成时间：2026-07-06  
> 分析对象：DeepSeek Harness (v0.1.1-rc.2) vs RMFOOD AI 智能对话  
> 分析方法：源码逆向解析 + CSS 令牌提取 + 组件规格对比

---

## 一、DSH 设计系统逆向工程结论

### 1.1 DSH Boot 令牌（从 vendor CSS 提取）

| 令牌 | Light 模式 | Dark 模式 |
|:-----|:----------:|:---------:|
| `--dsh-boot-bg` | `#fff` | `#151517` |
| `--dsh-boot-brand` | `#0f1115` | `#f9fafb` |
| `--dsh-boot-label-primary` | `#0f1115` | `#f9fafb` |
| `--dsh-boot-label-secondary` | `#61666b` | `#cfd3d6` |
| `--dsh-boot-label-tertiary` | `#81858c` | `#adb2b8` |
| `--dsh-boot-border` | `rgb(0 0 0 / 10%)` | `rgb(255 255 255 / 12%)` |

**关键发现**：DSH 使用 **单品牌色系统**（`#0f1115`），非多彩体系。品牌色用于进度环、焦点状态等高亮场景，而非主色调。

### 1.2 DSH 组件规格（从 index CSS 提取）

| 组件 | 规格 |
|:-----|:-----|
| **输入框容器** (`._wrap_`) | `h:32px`, `padding:0 8px`, `border-radius:8px`, `border:1px solid var(--dsw-alias-border-l2)`, `bg:var(--dsw-alias-bg-layer-1)` |
| **输入文本** (`._input_`) | `font-size:14px`, `line-height:22px`(1.57), `color:var(--dsw-alias-label-primary)` |
| **发送按钮** (`._button_`) | `border-radius:18px`(全圆胶囊), `font-size:14px`, `line-height:22px`, `padding:0 14px` |
| **工具栏按钮** (`._toolbar_`) | `background:var(--dsw-alias-button-tool-bar-fill)`, hover:`var(--dsw-alias-button-tool-bar-hover)` |
| **气泡悬浮提示** (`._bubble_`) | `border-radius:8px`, `padding:3px 7px`, `font-size:13px`, `line-height:20px` |

### 1.3 DSH 设计哲学

1. **极紧凑布局**：32px 输入容器高度，最小化屏幕占用
2. **语义化令牌**：`--dsw-alias-bg-layer-1/2/3`、`--dsw-alias-label-primary/secondary/tertiary` 三层语义体系
3. **统一行高 22px**：所有文字元素使用固定 22px line-height（与 14px 字号形成 1.57 倍率）
4. **无渐变装饰**：背景纯平色，无渐变、无阴影（除悬浮态）
5. **8px 基础圆角**：所有交互元素使用 8px 圆角，按钮使用 18px 全圆

---

## 二、RMFOOD 现有设计令牌盘点

### 2.1 当前令牌体系

| 类别 | 令牌数量 | 来源 |
|:-----|:--------:|:-----|
| `--chat-*` | 42 个 | `chatTheme.css` |
| `--dsw-*` | 18 个 | `chatTheme.css`（DSW 对齐层） |
| `BRAND_COLORS` | 10 级 | `design-tokens.ts` |
| `SPACING` | 20 档 | `design-tokens.ts` |
| `FONT_SIZES` | 12 级 | `design-tokens.ts` |
| `LINE_HEIGHTS` | 13 档 | `design-tokens.ts` |

### 2.2 当前实际规格

| 区域 | 规格 | 文件位置 |
|:-----|:-----|:--------|
| **正文基准** | `15px` / `line-height:1.6` | `chatTheme.css:302` |
| **消息行间距** | `margin-bottom:16px` | `chatTheme.css:331` |
| **AI 气泡** | `padding:12px 16px`, `max-width:780px` | `chatTheme.css:403-414` |
| **用户气泡** | `padding:12px 16px`, `max-width:780px` | `chatTheme.css:381-391` |
| **AI 头像** | `28px×28px` | `chatTheme.css:341-352` |
| **用户头像** | `32px×32px` | `chatTheme.css:358-364` |
| **输入框 MIN/MAX** | `56px / 140px` | `ChatInput.tsx:40-41` |
| **输入文字** | `text-[15px]` / `leading-6`(1.5) | `ChatInput.tsx:233` |
| **输入容器** | `rounded-2xl`(16px), `py-3`(12px) | `ChatInput.tsx:164` |
| **发送按钮** | `w-8 h-8 rounded-full`(32px 全圆) | `ChatInput.tsx:242` |
| **TopBar 高度** | `h-[44px]` | `TopBar.tsx` |
| **品牌色** | `#10b981` (emerald-500) | 多处 |

---

## 三、深度对比分析

### 3.1 设计哲学差异

| 维度 | DSH | RMFOOD | 差异分析 |
|:-----|:---:|:------:|:--------:|
| **布局密度** | 紧凑（32px 输入） | 宽松（56px 输入） | DSH 追求信息密度，RMFOOD 追求可读性 |
| **品牌表达** | 单色中性（#0f1115） | 双品牌绿（#10b981 + #047857） | RMFOOD 药食同源主题需要品牌识别度 |
| **装饰风格** | 扁平无装饰 | 渐变头像 + 呼吸光晕 | RMFOOD 更有温度感 |
| **圆角策略** | 统一 8px | 非对称气泡（16px/4px 混合） | RMFOOD 对话气泡有方向感 |
| **阴影体系** | 无（仅 border） | 4 级阴影 + 光晕 | RMFOOD 更有层次感 |
| **行高** | 固定 22px | 动态 1.6 | RMFOOD 中文适配更好 |

### 3.2 字号体系对比

| 用途 | DSH | RMFOOD 当前 | RMFOOD 建议 | 差距 |
|:-----|:---:|:-----------:|:-----------:|:----:|
| 正文基准 | 14px | 15px | **14px** | +1px 偏大 |
| 输入框文字 | 14px / lh:22px | 15px / lh:1.5 | **14px / lh:1.57** | 需调整 |
| 小字提示 | 10-11px | 10-11px | ✅ 一致 | - |
| 标题层级 | 16-24px | 16-28px | ✅ 合理 | - |
| 代码块 | monospace | monospace | ✅ 一致 | - |

### 3.3 间距体系对比

| 用途 | DSH | RMFOOD 当前 | RMFOOD 建议 |
|:-----|:---:|:-----------:|:-----------:|
| 输入容器高度 | 32px | 56px (MIN) | **40px**（降低 29%） |
| 输入文字 padding | `py:0` (在容器内) | `py-3.5`(14px) | **`py-2.5`(10px)** |
| 气泡内边距 | — | `12px 16px` | ✅ 合理 |
| 消息行间距 | — | `16px` | ✅ 合理 |
| 工具栏图标间距 | `gap:0.5`(4px) | `gap-0.5` | ✅ 一致 |
| 按钮 padding | `0 14px` | 全圆居中 | ✅ 合理 |

### 3.4 圆角体系对比

| 元素 | DSH | RMFOOD 当前 | RMFOOD 建议 |
|:-----|:---:|:-----------:|:-----------:|
| 输入容器 | 8px | 16px (rounded-2xl) | **12px** |
| 发送按钮 | 18px (全圆) | 32px (全圆 w-8) | ✅ 一致 |
| 气泡圆角 | — | 16px/4px 混合 | ✅ 特色保留 |
| 头像 | 50% | 50% | ✅ 一致 |
| 下拉菜单 | 12px | 12px | ✅ 一致 |

### 3.5 颜色体系对比

| 类别 | DSH | RMFOOD 当前 | 差异分析 |
|:-----|:---:|:-----------:|:--------:|
| **品牌主色** | `#0f1115`(近黑) | `#10b981`(翠绿) | RMFOOD 有鲜明品牌识别 |
| **背景色** | `#fff` / `#151517` | `#ffffff` / `#0f172a` | DSH dark 更中性灰 |
| **文字 primary** | `#0f1115` / `#f9fafb` | `#1a202c` / `#e2e8e6` | RMFOOD 偏暖色调 |
| **文字 secondary** | `#61666b` / `#cfd3d6` | `#4a5568` / `#cbd5e1` | 接近 |
| **边框** | `rgb(0/0/0/0.1)` | `#e2e8f0` | DSH 使用 rgba 更现代 |
| **focus ring** | `var(--dsw-alias-brand-primary)` | `emerald-400/20 ring-2` | RMFOOD 更明显 |

---

## 四、问题诊断

### 4.1 视觉层级问题

| 问题 | 严重程度 | 说明 |
|:-----|:--------:|:-----|
| 输入框过高（56px MIN） | ⚠️ 中 | 比 DSH 高出 75%，浪费垂直空间 |
| 气泡圆角过大（16px） | ⚠️ 低 | DSH 用 8px，我们偏圆润 |
| 品牌绿过于突出 | ⚡ 低 | DSH 品牌色极克制，我们更鲜艳 |
| 阴影层级过多 | ⚡ 低 | DSH 几乎无阴影，我们有 4 级 |
| 工具栏与文本层叠风险 | ✅ 已修复(v8) | 已改为 Flex 布局 |

### 4.2 与 DSH 对齐缺口

| 对齐项 | 状态 | 说明 |
|:-------|:----:|:-----|
| CSS 变量语义命名 | ⚠️ 部分 | 有 `--dsw-*` 但未完全对齐 DSH alias 体系 |
| 统一 line-height 22px | ❌ 未对齐 | 我们使用动态行高 1.6 |
| 32px 输入容器 | ❌ 未对齐 | 我们 56px |
| 8px 基础圆角 | ❌ 部分对齐 | 我们 16px/12px |
| 语义化颜色别名 | ⚠️ 部分 | 有 `--dsw-accent-*` 但缺 layer 体系 |
| focus ring 风格 | ✅ 已对齐 | ring-2 ring-emerald-400/20 |
| 发送按钮全圆 | ✅ 已对齐 | w-8 h-8 rounded-full |

---

## 五、优化建议

### 5.1 立即执行（高优先级）

| # | 改动 | 当前值 → 目标值 | 影响范围 |
|:---|:-----|:---------------:|:--------:|
| 1 | 输入容器 MIN 高度 | `56px` → `40px` | `ChatInput.tsx` |
| 2 | 输入文字字号 | `text-[15px]` → `text-[14px]` | `ChatInput.tsx` |
| 3 | 输入容器圆角 | `rounded-2xl`(16px) → `rounded-xl`(12px) | `ChatInput.tsx` |
| 4 | 气泡最大宽 | `780px` → `720px` | `chatTheme.css` |
| 5 | 工具栏文字字号 | `text-[11px]` → `text-[12px]` | `ChatInput.tsx` |

### 5.2 中期优化（中优先级）

| # | 改动 | 说明 |
|:---|:-----|:-----|
| 6 | 建立 `--dsw-alias-*` 语义令牌层 | 对齐 DSH `bg-layer-1/2/3`、`label-primary/secondary/tertiary` |
| 7 | 统一 line-height 为 22px | 或至少让所有文字元素使用相同 line-height |
| 8 | 减少阴影层级至 2 级 | 与 DSH 扁平风格对齐 |
| 9 | 边框改用 rgba | `rgba(0,0,0,0.1)` 替代 `#e2e8f0` |

### 5.3 长期建议（低优先级）

| # | 改动 | 说明 |
|:---|:-----|:-----|
| 10 | 品牌色降低饱和度 | `#10b981` → `#059669`(DSH 风格更克制) |
| 11 | 添加 DSH 风格空状态卡片 | 对标 DSH ComposerBar 空态引导 |
| 12 | 建立 DSH 风格 RAG banner | 与 DSH 工具调用面板对齐 |

---

## 六、总结

### 核心结论

1. **DSH 设计哲学**：紧凑、扁平、语义化令牌、单品牌色、极致信息密度
2. **RMFOOD 设计哲学**：宽松、有层次、双品牌色（翠绿）、温度感、专业可读性
3. **两者各有优劣**：DSH 适合工具型场景（效率优先），RMFOOD 适合专业内容场景（可读性优先）

### 最佳实践建议

**保留 RMFOOD 特色**：
- ✅ 翠绿品牌色（药食同源主题识别）
- ✅ 非对称气泡设计（对话方向感）
- ✅ 适度阴影层次（专业感）
- ✅ 较大字号（15px，中文专业内容可读性）

**对齐 DSH 规范**：
- ⚠️ 输入容器高度降低至 40px（释放 16px 垂直空间）
- ⚠️ 输入文字字号调整为 14px（与 DSH 一致）
- ⚠️ 圆角统一至 12px（平衡专业感与 DSH 风格）
- ⚠️ 建立语义化 CSS 令牌层（`bg-layer-1/2/3`、`label-primary/secondary`）

---

*报告生成完毕。请确认是否开始实施上述优化建议。*
