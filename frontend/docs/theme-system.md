# RMFOOD 主题系统文档

## 概述
RMFOOD 主题系统是一个统一的主题管理平台，支持多种主题模式、自定义主题和导入导出功能。

## 架构
- **主题状态管理**: Zustand store
- **主题提供者**: React Context
- **主题 Hook**: useTheme
- **预设主题**: 10 个预设（6 浅 4 深）
- **CSS 变量**: 630 个

## 功能
1. 预设主题切换
2. 自定义主题编辑器
3. 主题导入导出
4. 无障碍模式
5. 主题持久化

## API
- \useTheme()\: 获取主题状态和方法
- \useThemeStore()\: 直接访问 Zustand store
- \ThemeEditor\: 自定义主题编辑器组件
- \ThemeImport\: 主题导入组件

## 安全
- CSS 变量注入防护
- 文件大小限制
- 格式验证
