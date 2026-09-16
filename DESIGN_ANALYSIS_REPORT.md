# DESIGN.md 主题设计规范分析报告

## 文档信息

| 项目 | 内容 |
|------|------|
| 文件名 | DESIGN.md |
| 文件大小 | 37,096 字节 |
| 总行数 | 562 行 |
| 版本 | alpha |
| 设计系统 | Apple-design-analysis |
| 分析日期 | 2026-09-14 |

---

## 一、设计规范概述

### 1.1 核心理念

Apple 的网页设计是一门**以敬畏之心呈现产品摄影，由近乎隐形的 UI 框架构成**的艺术。每一页都是边缘到边缘的产品"瓦片"堆栈——交替的亮色和暗色画布，每个瓦片居中展示英雄标题、一行标签、两个小蓝药丸 CTA，以及极其清晰的产品渲染图。没有任何东西与产品竞争。 typography 自信而安静；颜色要么是纯白、米色羊皮纸，要么是近黑色的瓦片；交互元素是单一、安静的蓝色。

### 1.2 关键特征

1. **摄影优先** - UI 退居其次，让产品成为主角
2. **交替色块布局** - 白色/羊皮纸 ↔ 近黑色，颜色变化本身就是分隔线
3. **单一强调色** - Action Blue (#0066cc) 承载所有交互元素
4. **两种按钮语法** - 小型蓝色药丸 CTA 和紧凑工具矩形
5. **SF Pro Display + Text** - 显示尺寸的负字间距创造 "Apple tight" 风格
6. ** whispersoft 阴影** - 仅当产品图片需要呼吸时才使用——整个系统只有一个 drop-shadow
7. **紧凑双行导航** - 细 global-nav + 产品特定的 frosted sub-nav
8. **可预测的节律** - 亮色英雄 → 暗色产品瓦片 → 亮色工具瓦片 → 暗色瓦片 → 羊皮纸页脚

---

## 二、颜色系统

### 2.1 Brand & Accent (3种)

| Token | 颜色 | 用途 |
|-------|------|------|
| Action Blue | #0066cc | 主要交互色，所有链接、药丸 CTA、焦点环 |
| Focus Blue | #0071e3 | 键盘焦点环 (按钮 outline: 2px solid) |
| Sky Link Blue | #2997ff | 暗色表面上的内联链接 |

### 2.2 Surface (8种)

| Token | 颜色 | 用途 |
|-------|------|------|
| Canvas | #ffffff | 主画布，内容、工具卡片、商店瓦片 |
| Parchment | #f5f5f7 | 签名苹果米白色，交替亮色瓦片、页脚 |
| Pearl | #fafafc | 次要"幽灵"按钮填充 |
| Tile-1 | #272729 | 主页产品网格主暗色瓦片 |
| Tile-2 | #2a2a2c | 微亮变体，用于 Tile-1 相邻位置 |
| Tile-3 | #252527 | 微暗变体，用于堆栈底部和视频播放器 |
| Black | #000000 | 纯黑，视频播放器背景、全局导航 |
| Chip | #d2d2d7 | 半透明灰片，用于摄影上的圆形控制按钮 |

### 2.3 Text (6种)

| Token | 颜色 | 用途 |
|-------|------|------|
| Ink | #1d1d1f | 主要文本 (标题、段落、暗色工具按钮) |
| Body On Dark | #ffffff | 暗色瓦片和全局导航上的文本 |
| Body Muted | #cccccc | 暗色瓦片上的次要复制 |
| Ink Muted-80 | #333333 | Pearl 按钮表面的正文文本 |
| Ink Muted-48 | #7a7a7a | 禁用按钮文本和法律小字 |

### 2.4 Borders (2种)

| Token | 颜色 | 用途 |
|-------|------|------|
| Divider Soft | #f0f0f0 | 次要按钮的"边框"色调 |
| Hairline | #e0e0e0 | 商店工具卡片和配置器芯片的 1px 发丝线 |

---

## 三、字体系统

### 3.1 Font Family

- **Display**: `SF Pro Display, system-ui, -apple-system, sans-serif` (≥19px)
- **Body/UI**: `SF Pro Text, system-ui, -apple-system, sans-serif` (<20px)

### 3.2 Typography Scale (14级)

| Token | Size | Weight | LineHeight | LetterSpacing | 用途 |
|-------|------|--------|------------|---------------|------|
| hero-display | 56px | 600 | 1.07 | -0.28px | Hero 标题 |
| display-lg | 40px | 600 | 1.10 | 0 | 产品瓦片标题 |
| display-md | 34px | 600 | 1.47 | -0.374px | 章节头 |
| lead | 28px | 400 | 1.14 | 0.196px | 产品副标题 |
| lead-airy | 24px | 300 | 1.50 | 0 | 环境页段落 |
| tagline | 21px | 600 | 1.19 | 0.231px | 副标题/子导航 |
| body-strong | 17px | 600 | 1.24 | -0.374px | 内联强调 |
| body | 17px | 400 | 1.47 | -0.374px | 默认段落 |
| dense-link | 17px | 400 | 2.41 | 0 | 页脚链接列 |
| caption | 14px | 400 | 1.43 | -0.224px | 次要说明 |
| caption-strong | 14px | 600 | 1.29 | -0.224px | 强调说明 |
| button-large | 18px | 300 | 1.00 | 0 | 商店 hero CTA |
| button-utility | 14px | 400 | 1.29 | -0.224px | 工具按钮 |
| fine-print | 12px | 400 | 1.00 | -0.12px | 小字声明 |
| micro-legal | 10px | 400 | 1.30 | -0.08px | 法律微字 |
| nav-link | 12px | 400 | 1.00 | -0.12px | 导航链接 |

### 3.3 关键原则

- **负字间距**: 所有 ≥17px 的标题都有轻微追踪收紧 (-0.12 → -0.374px)
- **正文 17px**: Apple 打破 SaaS 惯例，段落文本使用 17px (非 16px)
- **字重 ladder**: 300 / 400 / 600 / 700 (故意缺少 500)
- **行高上下文相关**: Display 1.07-1.19 (紧凑), Body 1.47

---

## 四、布局系统

### 4.1 Spacing System

| Token | 值 | 用途 |
|-------|-----|------|
| xxs | 4px | 紧密排版调整 |
| xs | 8px | 基础单位 |
| sm | 12px | 小间距 |
| md | 17px | 中等间距 |
| lg | 24px | 大间距 (卡片内边距) |
| xl | 32px | 超大间距 |
| xxl | 48px | 节间距 |
| section | 80px | 产品瓦片垂直内边距 |

### 4.2 Grid & Container

- **最大内容宽度**: ~980px (文本密集区域), ~1440px (产品网格), 全宽 (产品瓦片)
- **列模式**: 3-5 列工具卡片网格，2 列并排瓦片，单列居中堆栈
- **Gutters**: 20-24px

---

## 五、组件系统

### 5.1 Button 类型 (7种)

| 组件 | 背景 | 文本 | 圆角 | 内边距 | 用途 |
|------|------|------|------|--------|------|
| button-primary | #0066cc | white | 9999px (pill) | 11px × 22px | 主要 CTA |
| button-secondary-pill | transparent | #0066cc | 9999px | 11px × 22px | 次要 CTA |
| button-dark-utility | #1d1d1f | white | 8px | 8px × 15px | 全局导航操作 |
| button-pearl-capsule | #fafafc | #333333 | 11px | 8px × 14px | 产品卡次要按钮 |
| button-store-hero | #0066cc | white | 9999px | 14px × 28px | 商店 hero CTA |
| button-icon-circular | rgba(210,210,215,0.64) | #1d1d1f | 9999px | 44×44px | 摄影上的圆形控制 |
| text-link | transparent | #0066cc | - | - | 内联链接 |

### 5.2 Navigation

- **global-nav**: 44px 高，黑色背景，12px 文本
- **sub-nav-frosted**: 52px 高，毛玻璃效果

### 5.3 Cards & Tiles

- **product-tile-light**: 白色画布，80px 垂直内边距
- **product-tile-parchment**: 羊皮纸画布
- **product-tile-dark**: 暗色瓦片，80px 垂直内边距
- **store-utility-card**: 18px 圆角，24px 内边距

---

## 六、响应式设计

### 6.1 Breakpoints (8个)

| 名称 | 宽度 | 关键变化 |
|------|------|----------|
| Small phone | ≤ 419px | 单列瓦片，子导航折叠 |
| Phone | 420-640px | 单列布局，产品图缩至 80% |
| Large phone | 641-735px | 瓦片内边距收紧至 48px |
| Tablet portrait | 736-833px | 全局导航折叠为汉堡菜单 |
| Tablet landscape | 834-1023px | 导航恢复，网格变 2 列 |
| Small desktop | 1024-1068px | 瓦片 2/3 宽度 |
| Desktop | 1069-1440px | 完整布局，1440px 内容最大 |
| Wide desktop | ≥ 1441px | 内容锁定 1440px |

### 6.2 Touch Targets

- 最小 44 × 44px
- button-primary: ~44 × 100px
- button-icon-circular: 44 × 44px

---

## 七、当前系统与 DESIGN.md 对齐分析

### 7.1 对比表

| 对比项 | DESIGN.md | 当前系统 | 状态 |
|--------|-----------|----------|------|
| 品牌主色 | #0066cc (蓝) | #10b981 (绿) | ⚠️ 需决策 |
| 强调色数量 | 1 个 | 3 个 (绿/蓝/紫) | ⚠️ 需调整 |
| 字体 | SF Pro | Inter/系统 | ✅ 可接受 |
| 圆角系统 | 7 级完整 | ✅ 已实现 | ✅ 已对齐 |
| 间距系统 | 8px 基础 | ✅ 已实现 | ✅ 已对齐 |
| 阴影哲学 | 仅产品图片 | ⚠️ 通用卡片阴影 | ⚠️ 需调整 |
| 暗色模式 | 微差暗色砖 | ✅ 完整深色系 | ✅ 已对齐 |
| 响应式断点 | 8 个精细 | ⚠️ 标准 5 个 | ⚠️ 可扩展 |

### 7.2 已对齐部分

1. **圆角系统** - 7 级完整实现 (none/xs/sm/md/lg/pill/full)
2. **间距系统** - 8px 基础单位
3. **CSS 变量结构** - 完整的 semantic color 体系
4. **预设主题** - 多主题支持
5. **无障碍支持** - WCAG AA/AAA 达标

### 7.3 需调整部分

1. **品牌主色** - 当前为绿色，DESIGN.md 要求蓝色 #0066cc
2. **阴影策略** - 需调整为仅产品图片使用阴影
3. **字体栈** - 可考虑优化 Inter 与 SF Pro 的对齐
4. **响应式断点** - 可从 5 个扩展至 8 个精细断点

### 7.4 缺失部分

1. **双品牌色系统支持**
2. **毛玻璃效果 (backdrop-filter)**
3. **产品瓦片交替布局组件**
4. **Design Token 导出工具**

---

## 八、对齐建议

### 8.1 优先级 P0 (立即)

#### 1. 品牌主色决策

**选项 A**: 保持现有绿色系 (#10b981) 作为 RMFOOD 品牌色
- 优点: 保持品牌一致性，符合药食同源健康主题
- 缺点: 与 DESIGN.md 不一致

**选项 B**: 切换为 Apple Blue (#0066cc)
- 优点: 完全对齐设计规范
- 缺点: 需大幅调整现有主题

**建议**: 保持绿色系，创建 RMFOOD 专属设计令牌，参考 DESIGN.md 但保留品牌识别

#### 2. 阴影策略调整

**当前问题**: 卡片、按钮、导航都使用通用阴影

**解决方案**:
```css
/* 移除通用阴影 */
.card {
  box-shadow: none; /* 或极轻微阴影 */
}

/* 仅产品图片使用 product-shadow */
.product-image {
  box-shadow: rgba(0, 0, 0, 0.22) 3px 5px 30px 0;
}
```

**文件**: `frontend/src/styles/tokens/base.css`

#### 3. 字体栈优化

**当前**: Inter/system-ui

**建议**:
```css
:root {
  --font-display: 'Inter', system-ui, -apple-system, sans-serif;
  --font-body: 'Inter', system-ui, -apple-system, sans-serif;
}

/* 添加负字间距 */
.display-lg {
  letter-spacing: -0.01em;
}

.display-md {
  letter-spacing: -0.015em;
}
```

### 8.2 优先级 P1 (短期)

#### 1. 响应式断点扩展

**当前**: 5 个断点 (sm/md/lg/xl/xxl)

**建议扩展至**:
```css
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
  
  /* 新增精细断点 */
  --breakpoint-phone: 419px;
  --breakpoint-tablet-portrait: 736px;
  --breakpoint-tablet-landscape: 834px;
  --breakpoint-small-desktop: 1024px;
  --breakpoint-wide-desktop: 1441px;
}
```

**文件**: `frontend/src/styles/tokens/base.css`, `tailwind.config.js`

#### 2. 产品瓦片组件

**新建文件**: `src/components/layout/ProductTile.tsx`

```tsx
interface ProductTileProps {
  variant: 'light' | 'parchment' | 'dark';
  children: React.ReactNode;
  className?: string;
}

export const ProductTile: React.FC<ProductTileProps> = ({ variant, children, className }) => {
  const variants = {
    light: 'bg-canvas text-ink',
    parchment: 'bg-canvas-parchment text-ink',
    dark: 'bg-surface-tile-1 text-on-dark',
  };
  
  return (
    <section className={`w-full py-section px-0 ${variants[variant]} ${className}`}>
      <div className="max-w-7xl mx-auto px-8">
        {children}
      </div>
    </section>
  );
};
```

#### 3. 毛玻璃效果

**添加 CSS 变量**:
```css
:root {
  --backdrop-blur: blur(20px) saturate(180%);
}

.sub-nav-frosted {
  background: rgba(245, 245, 247, 0.8);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
}
```

### 8.3 优先级 P2 (中期)

#### 1. Design Token 导出工具

**功能**:
- 支持 JSON/CSS/Tailwind 格式导出
- 自动从 CSS 变量生成 token 文件
- 支持主题切换时实时更新 token

#### 2. 双模式主题系统

**Light Mode**: Apple 风格 (简约、摄影优先)
**Dark Mode**: RMFOOD 健康风格 (深绿、专业)

#### 3. 组件库对齐

- Button/Card/Nav 组件对齐设计规范
- 添加新的变体和状态

---

## 九、执行计划

### 9.1 立即行动 (本周)

1. ✅ 分析 DESIGN.md 规范
2. ⏳ 确定品牌主色决策 (绿色 vs 蓝色)
3. ⏳ 调整阴影策略
4. ⏳ 优化字体栈

### 9.2 短期行动 (2 周内)

1. ⏳ 扩展响应式断点至 8 个
2. ⏳ 创建产品瓦片组件
3. ⏳ 添加毛玻璃效果支持
4. ⏳ 完善 Design Token 文档

### 9.3 中期行动 (1 个月内)

1. ⏳ 创建 Design Token 导出工具
2. ⏳ 实现双模式主题系统
3. ⏳ 组件库全面对齐

---

## 十、结论

DESIGN.md 提供了一个高质量、经过验证的 Apple 设计语言参考。当前主题系统在基础令牌（圆角、间距、CSS 变量结构）方面已经相当完善，但在品牌色、阴影哲学和组件细节上需要调整。

**关键建议**:
1. 保持 RMFOOD 绿色品牌色，但借鉴 Apple 的设计原则
2. 调整阴影策略，减少装饰性阴影
3. 扩展响应式断点系统
4. 创建产品瓦片组件实现交替色块布局

通过上述调整，可以实现既符合品牌识别又符合设计规范的统一主题系统。

---

**报告生成时间**: 2026-09-14  
**分析人员**: AI Agent  
**版本**: v1.0
