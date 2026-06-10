# RMFOOD 主题系统应用指南

## 1. 交付物概览

### 1.1 交付内容

| 交付物 | 格式 | 位置 | 用途 |
|--------|------|------|------|
| 主题设计规范文档 | Markdown | `design-system/RMFOOD-主题系统设计规范.md` | 详细设计原则和规范 |
| CSS 变量文件 | CSS | `design-system/rmfood/theme.css` | 样式变量定义 |
| 设计令牌文件 | JSON | `design-system/rmfood/tokens.json` | 设计令牌数据 |
| 主题应用指南 | Markdown | `design-system/rmfood/APPLICATION-GUIDE.md` | 实施指南和最佳实践 |

### 1.2 系统要求

- **前端框架**：React 19+，TypeScript 5+
- **构建工具**：Vite 6+
- **样式方案**：Tailwind CSS 4+ 或原生 CSS
- **浏览器支持**：Chrome 90+、Firefox 88+、Safari 14+、Edge 90+

## 2. 实施步骤

### 2.1 基础设置

**步骤 1：安装依赖**

```bash
# 安装核心依赖
npm install react@latest typescript@latest vite@latest

# 安装样式依赖（可选）
npm install tailwindcss@latest postcss@latest autoprefixer@latest
```

**步骤 2：导入样式文件**

在 `src/index.css` 中导入主题 CSS 变量：

```css
/* src/index.css */
@import '../design-system/rmfood/theme.css';

/* 基础样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-family-sans);
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--text-primary);
  background-color: var(--bg-secondary);
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: var(--scrollbar-width);
}

::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
}

::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: var(--radius-sm);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}
```

### 2.2 组件集成

**步骤 1：创建基础组件**

```tsx
// src/components/ui/Button.tsx
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const variants = {
    primary: 'bg-forest-green-600 text-white hover:bg-forest-green-700',
    secondary: 'border border-ocean-blue-600 text-ocean-blue-600 hover:bg-ocean-blue-50',
    ghost: 'border border-gray-300 text-gray-600 hover:bg-gray-50',
    danger: 'bg-danger-500 text-white hover:bg-danger-600',
    ai: 'bg-gradient-to-r from-bio-purple-600 to-tech-cyan-500 text-white hover:opacity-90'
  };

  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-9.5 px-6 text-base',
    lg: 'h-11 px-8 text-base',
    xl: 'h-13 px-10 text-lg'
  };

  return (
    <button
      className={`
        rounded-md font-medium transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-forest-green-500 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};
```

**步骤 2：使用设计令牌**

```tsx
// src/components/ui/Card.tsx
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'standard' | 'glass' | 'interactive';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'standard',
  className = '',
  ...props
}) => {
  const variants = {
    standard: 'bg-white shadow-md',
    glass: 'bg-glass-bg backdrop-blur-sm border border-glass-border',
    interactive: 'bg-white shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300'
  };

  return (
    <div
      className={`
        rounded-lg p-4
        ${variants[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};
```

### 2.3 主题配置

**Tailwind CSS 配置**

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'forest-green': {
          50: 'var(--color-forest-green-50)',
          100: 'var(--color-forest-green-100)',
          200: 'var(--color-forest-green-200)',
          300: 'var(--color-forest-green-300)',
          400: 'var(--color-forest-green-400)',
          500: 'var(--color-forest-green-500)',
          600: 'var(--color-forest-green-600)',
          700: 'var(--color-forest-green-700)',
          800: 'var(--color-forest-green-800)',
          900: 'var(--color-forest-green-900)',
        },
        'ocean-blue': {
          50: 'var(--color-ocean-blue-50)',
          100: 'var(--color-ocean-blue-100)',
          500: 'var(--color-ocean-blue-500)',
          600: 'var(--color-ocean-blue-600)',
          700: 'var(--color-ocean-blue-700)',
        },
        'bio-purple': {
          50: 'var(--color-bio-purple-50)',
          100: 'var(--color-bio-purple-100)',
          500: 'var(--color-bio-purple-500)',
          600: 'var(--color-bio-purple-600)',
          700: 'var(--color-bio-purple-700)',
        },
      },
      fontFamily: {
        'serif': ['var(--font-family-serif)', 'serif'],
        'sans': ['var(--font-family-sans)', 'sans-serif'],
        'mono': ['var(--font-family-mono)', 'monospace'],
      },
      spacing: {
        'xs': 'var(--spacing-xs)',
        'sm': 'var(--spacing-sm)',
        'md': 'var(--spacing-md)',
        'lg': 'var(--spacing-lg)',
        'xl': 'var(--spacing-xl)',
        '2xl': 'var(--spacing-2xl)',
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
      },
    },
  },
  plugins: [],
}
```

## 3. 最佳实践

### 3.1 组件开发

**命名规范**
- 组件名称：PascalCase（如 `Button`、`Card`）
- 变量名称：camelCase（如 `buttonVariant`、`cardSize`）
- 类名：kebab-case（如 `btn-primary`、`card-standard`）

**文件结构**
```
src/
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── index.ts
│   ├── layout/
│   │   ├── MainLayout.tsx
│   │   └── Sidebar.tsx
│   └── common/
│       ├── PageHeader.tsx
│       └── SectionTitle.tsx
```

**组件设计**
- 单一职责：每个组件只负责一个功能
- 可复用性：设计通用组件，支持不同变体
- 可定制性：通过 props 支持自定义样式
- 类型安全：使用 TypeScript 类型定义

### 3.2 样式管理

**CSS 变量使用**
- 优先使用 CSS 变量而非硬编码值
- 遵循设计令牌命名规范
- 避免直接修改 CSS 变量值

**响应式设计**
- 使用 CSS 媒体查询：`@media (min-width: var(--breakpoint-md))`
- 移动优先：先设计移动端，再扩展到桌面端
- 断点使用：遵循定义的 5 个断点

**性能优化**
- 避免过度使用动画和过渡效果
- 合理使用阴影和模糊效果
- 优化字体加载：使用 `font-display: swap`

### 3.3 交互设计

**动画原则**
- 微交互：100-150ms 动画
- 标准过渡：200-300ms 动画
- 复杂动画：300-500ms 动画
- 强调动画：500-800ms 动画

**反馈机制**
- 视觉反馈：按钮状态变化、加载动画
- 听觉反馈：重要操作的声音提示（可选）
- 触觉反馈：移动设备的振动反馈（可选）

**无障碍性**
- 键盘导航：支持 Tab 键导航
- 屏幕阅读器：添加 ARIA 标签
- 色彩对比度：确保符合 WCAG 标准
- 焦点状态：清晰的焦点指示器

## 4. 常见问题解答

### 4.1 技术问题

**Q: 如何覆盖默认主题颜色？**
A: 在项目的 `index.css` 文件中重定义 CSS 变量：

```css
:root {
  /* 覆盖主色调 */
  --color-forest-green-600: #047857;
  
  /* 覆盖辅助色 */
  --color-ocean-blue-600: #1E40AF;
}
```

**Q: 如何创建自定义组件？**
A: 基于基础组件扩展，遵循设计规范：

```tsx
// 自定义按钮组件
import { Button } from './Button';

export const PrimaryButton: React.FC<ButtonProps> = (props) => (
  <Button variant="primary" {...props} />
);

export const AIAssistantButton: React.FC<ButtonProps> = (props) => (
  <Button variant="ai" {...props} />
);
```

**Q: 如何处理特殊布局？**
A: 使用网格系统和 Flexbox：

```css
/* 响应式网格布局 */
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-md);
}

/* 响应式 Flex 布局 */
.flex-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

@media (min-width: var(--breakpoint-md)) {
  .flex-container {
    flex-direction: row;
  }
}
```

**Q: 如何优化性能？**
A: 
- 按需导入组件
- 减少不必要的动画
- 使用 CSS 变量而非内联样式
- 优化字体加载
- 合理使用缓存

### 4.2 设计问题

**Q: 如何保持视觉一致性？**
A: 
- 严格遵循设计系统规范
- 使用统一的色彩、字体和间距
- 保持组件样式一致
- 定期进行设计审查

**Q: 如何确保品牌一致性？**
A: 
- 使用品牌主色调（森林绿）
- 遵循品牌字体规范
- 保持设计风格符合品牌调性
- 定期检查品牌元素使用情况

**Q: 如何处理不同设备的适配？**
A: 
- 使用响应式设计原则
- 优先考虑移动端体验
- 合理调整内容优先级
- 测试不同设备的显示效果

## 5. 设计决策说明

### 5.1 色彩选择理由

**森林绿**
- 象征自然、健康和生命力
- 符合药食同源的品牌理念
- 传达专业、可靠的形象
- 绿色在医药和健康领域具有积极联想

**海洋蓝**
- 提供清晰的信息层次
- 适合用于链接和信息提示
- 与森林绿形成和谐的色彩搭配
- 传达科技感和专业性

**生物紫**
- 象征科技与创新
- 适合用于 AI 相关功能
- 与绿色形成现代感的对比
- 传达前沿科技的形象

### 5.2 字体选择理由

**Noto Serif SC**
- 专业、庄重的衬线字体
- 适合标题和重要信息
- 清晰易读，适合中文显示
- 与品牌的专业形象匹配

**Noto Sans SC**
- 清晰、现代的无衬线字体
- 适合正文和表单
- 良好的可读性
- 与标题字体形成层次对比

**JetBrains Mono**
- 对齐整齐的等宽字体
- 适合数据表格和代码
- 提高数据的可读性
- 专业的技术感

### 5.3 间距系统理由

- 基于 4px 网格系统，确保一致性
- 提供足够的呼吸空间，提高可读性
- 建立清晰的视觉层次
- 符合现代 UI 设计趋势

### 5.4 组件设计理由

- **按钮**：多种变体满足不同场景需求
- **卡片**：支持不同风格，适应不同内容类型
- **表单**：清晰的状态反馈，提高用户体验
- **导航**：直观的结构，便于用户导航

## 6. 版本控制策略

### 6.1 版本号格式

```
主版本.次版本.补丁版本
```

- **主版本**：重大设计变更，可能不向后兼容
- **次版本**：功能增强和改进，向后兼容
- **补丁版本**：bug 修复和小调整，向后兼容

### 6.2 发布流程

1. **设计变更提案**
   - 提出设计变更需求
   - 评估变更影响
   - 获得设计团队批准

2. **设计审查**
   - 设计团队审查变更
   - 确保符合设计系统规范
   - 验证品牌一致性

3. **开发实现**
   - 开发团队实现变更
   - 遵循设计规范
   - 确保代码质量

4. **用户测试**
   - 进行用户测试
   - 收集反馈
   - 调整优化

5. **正式发布**
   - 发布新版本
   - 更新文档
   - 通知相关团队

### 6.3 兼容性保证

- **向后兼容**：确保旧版本代码仍能运行
- **迁移指南**：提供版本升级指南
- **废弃警告**：提前通知废弃功能
- **测试覆盖**：确保变更不破坏现有功能

### 6.4 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0.0 | 2026-04-18 | 初始版本，完整设计系统 |
| 1.1.0 | 2026-06-30 | 新增深色模式支持 |
| 1.2.0 | 2026-09-30 | 优化移动端体验 |
| 2.0.0 | 2027-01-31 | 重大设计更新，响应式重构 |

## 7. 结论

本主题系统应用指南为莱茵（厦门）分子生物科技有限公司的 RMFOOD 药食同源功能性食品专业配方研发平台提供了完整的设计实施指导。通过遵循本指南，开发团队可以：

1. **准确实现设计系统**：确保界面符合设计规范
2. **提高开发效率**：使用预定义的组件和样式
3. **保持视觉一致性**：确保整个平台的设计统一
4. **支持未来扩展**：基于模块化设计系统进行功能迭代
5. **提升用户体验**：提供专业、流畅的界面交互

设计系统的成功实施需要设计团队和开发团队的密切合作，共同维护和演进这套设计体系，为用户提供卓越的产品体验。