# RMFOOD 配方平台 - Storybook 组件文档

## 概述
本文档为 RMFOOD 配方平台的设计系统组件提供 Storybook 示例。每个组件都遵循院士级设计标准，包括：
- 使用设计 token (tokens.css)
- 符合 WCAG 2.2 AA 可访问性标准
- 支持暗色模式
- 提供 motion 动画

## 组件列表

### 1. Button
- **文件**: `src/components/ui/Button.tsx`
- **Storybook**: `src/components/ui/Button.stories.tsx`
- **特性**:
  - 支持多种变体 (primary, secondary, ghost, danger, ai, outline, warning)
  - 支持多种尺寸 (sm, md, lg, xl)
  - 加载态动画
  - 图标支持 (左/右)
  - 键盘导航和焦点环
  - ARIA 属性

### 2. Alert
- **文件**: `src/components/ui/Alert.tsx`
- **Storybook**: `src/components/ui/Alert.stories.tsx`
- **特性**:
  - 支持多种变体 (default, destructive, success, warning, info)
  - 语义化 ARIA 角色
  - 响应式设计
  - 动画过渡

### 3. FocusRing
- **文件**: `src/components/ui/FocusRing.tsx`
- **Storybook**: `src/components/ui/FocusRing.stories.tsx`
- **特性**:
  - 全局焦点样式
  - 可定制颜色和宽度
  - 符合 WCAG 2.2 AA

### 4. Dark Mode
- **文件**: `src/styles/tokens-dark.css`
- **Storybook**: `src/styles/tokens-dark.stories.css`
- **特性**:
  - 基于 `data-theme="dark"` 的属性切换
  - 自动检测 `prefers-color-scheme`
  - 完整的暗色 token 映射

## 使用方法

### 1. 安装 Storybook
```bash
npx storybook@latest init
```

### 2. 配置主题
```javascript
// .storybook/main.js
module.exports = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
};
```

### 3. 运行 Storybook
```bash
npx storybook dev
```

## 视觉回归测试
- 使用 Playwright 进行视觉回归测试
- 为每个组件创建基准截图
- 在 CI/CD 流水线中自动比较

## 可访问性测试
- 使用 axe-core 进行自动化可访问性检查
- 确保所有组件符合 WCAG 2.2 AA 标准
- 键盘导航测试
- 屏幕阅读器兼容性测试

## 贡献指南
1. 为新组件创建 Storybook 文件
2. 确保使用设计 token
3. 添加 ARIA 属性
4. 提供暗色模式支持
5. 编写单元测试
6. 更新本文档
