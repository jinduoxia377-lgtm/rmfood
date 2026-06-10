# RMFOOD 配方平台前端维护文档

## 1. 项目结构

### 1.1 目录结构

```
frontend/
├── public/              # 静态资源
├── src/
│   ├── api/            # API 调用
│   ├── assets/         # 静态资源
│   ├── components/      # 组件
│   ├── config/          # 配置
│   ├── contexts/        # 上下文
│   ├── hooks/           # 自定义钩子
│   ├── lib/             # 工具库
│   ├── pages/           # 页面
│   ├── services/        # 服务
│   ├── stores/          # 状态管理
│   ├── tests/           # 测试
│   ├── types/           # 类型定义
│   ├── utils/           # 工具函数
│   ├── App.tsx          # 应用根组件
│   ├── index.css        # 全局样式
│   ├── main.tsx         # 应用入口
│   └── vite-env.d.ts    # Vite 类型定义
├── .gitignore           # Git 忽略文件
├── README.md            # 项目说明
├── package.json         # 依赖管理
├── tsconfig.json        # TypeScript 配置
├── tsconfig.test.json   # 测试 TypeScript 配置
├── vite.config.ts       # Vite 配置
└── MAINTENANCE.md       # 维护文档
```

### 1.2 核心模块

- **AI 助手**：`src/pages/ai/AIAssistantPage.tsx` - AI 配方生成和分析
- **数据库**：`src/pages/database/DatabasePage.tsx` - 知识图谱和数据管理
- **配方管理**：`src/pages/formula/` - 配方的创建、编辑、列表和比较
- **仪表板**：`src/pages/dashboard/DashboardPage.tsx` - 数据可视化和分析
- **用户认证**：`src/pages/auth/LoginPage.tsx` - 登录和身份验证
- **主题设置**：`src/pages/settings/ThemeSettingsPage.tsx` - 主题个性化配置

## 2. 技术栈

- **框架**：React 19.2.4
- **语言**：TypeScript 6.0.3
- **构建工具**：Vite 8.0.10
- **状态管理**：Zustand 5.0.5
- **路由**：React Router 7.14.2
- **数据获取**：React Query 5.100.5
- **UI 组件**：自定义组件 + Tailwind CSS 4.2.4
- **图表**：Recharts 2.15.4
- **数据可视化**：D3.js 7.9.0
- **HTTP 客户端**：Axios 1.15.2
- **图标**：Lucide React 0.525.0

## 3. 主题系统

### 3.1 主题系统架构

主题系统基于 Material Design 3 标准构建，提供完整的全局主题管理能力。

#### 核心文件

| 文件 | 描述 |
|------|------|
| `src/hooks/useTheme.tsx` | 主题状态管理 Hook，提供主题切换、颜色管理、字体设置等功能 |
| `src/config/theme.config.ts` | Material Design 3 配色方案配置，包含预设主题定义 |
| `src/pages/settings/ThemeSettingsPage.tsx` | 主题设置页面 UI |
| `src/index.css` | CSS 变量定义和过渡动画 |
| `src/tests/useTheme.test.ts` | 主题系统单元测试 |

#### 主题模式

```typescript
type ThemeMode = 'light' | 'dark' | 'auto';
```

- **Light（浅色）**：明亮的浅色背景，适合日常使用
- **Dark（深色）**：深色背景，减少眼睛疲劳
- **Auto（自动）**：跟随系统偏好设置

### 3.2 主题配置接口

```typescript
interface ThemeSettings {
  mode: ThemeMode;                    // 主题模式
  customColors?: {                    // 自定义颜色
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    surface?: string;
  };
  fontFamily?: string;                // 字体系列
  fontSize?: number;                 // 字体大小 (12-24)
  visualSettings?: {                  // 视觉属性
    borderRadius?: number;            // 圆角 (0-24)
    shadowIntensity?: number;          // 阴影强度 (0-1)
    spacing?: number;                 // 间距倍数 (0.5-2)
    transparency?: number;            // 透明度 (0-1)
  };
  cloudSync?: boolean;                // 云端同步
}
```

### 3.3 CSS 变量系统

主题系统使用 CSS 变量实现动态主题切换：

```css
/* 文本颜色 */
--text-primary       /* 主文本颜色 */
--text-secondary     /* 次要文本颜色 */
--text-muted         /* 弱化文本颜色 */

/* 背景颜色 */
--bg-primary         /* 主背景 */
--bg-secondary       /* 次要背景 */
--surface            /* 卡片/面板背景 */

/* 边框颜色 */
--border-color       /* 边框颜色 */
--border-hover       /* 悬停边框颜色 */

/* 主色调 */
--primary            /* 主色 */
--primary-hover      /* 主色悬停 */
--primary-muted      /* 主色弱化 */

/* 语义颜色 */
--success            /* 成功状态 */
--warning            /* 警告状态 */
--error              /* 错误状态 */
--info               /* 信息状态 */

/* 视觉属性 */
--radius             /* 圆角值 */
--shadow-sm          /* 小阴影 */
--shadow-md          /* 中阴影 */
--shadow-lg          /* 大阴影 */
```

### 3.4 使用主题 Hook

```tsx
import { useTheme } from '@/hooks/useTheme';

function MyComponent() {
  const { settings, isDark, updateSettings, resetSettings, toggleTheme } = useTheme();

  return (
    <div>
      <p>当前模式: {isDark ? '深色' : '浅色'}</p>
      <p>字体大小: {settings.fontSize}px</p>

      <button onClick={toggleTheme}>切换主题</button>

      <button onClick={() => updateSettings({ mode: 'dark' })}>
        设为深色
      </button>

      <button onClick={resetSettings}>
        重置为默认
      </button>
    </div>
  );
}
```

### 3.5 主题预设

系统内置 8 套预设主题：

| 预设名称 | 描述 | 适用场景 |
|---------|------|---------|
| 默认浅色 | 明亮清爽的浅色主题 | 日常办公 |
| 默认深色 | 柔和护眼的深色主题 | 夜间使用 |
| 专业蓝 | 蓝色系专业配色 | 商务展示 |
| 森林绿 | 自然绿色系 | 健康相关 |
| 暖色系 | 暖色调温馨风格 | 创意工作 |
| 冷色系 | 冷色调清爽风格 | 数据分析 |
| 高对比度 | 高对比度无障碍设计 | 视力障碍用户 |
| 极简灰 | 极简灰度设计 | 专注阅读 |

### 3.6 扩展主题系统

#### 添加新预设主题

在 `src/config/theme.config.ts` 中的 `PRESET_THEMES` 数组添加新预设：

```typescript
{
  id: 'custom-theme',
  name: '自定义主题',
  mode: 'light',
  colors: {
    primary: '#custom-primary-color',
    // ... 其他颜色
  },
  fontSize: 16,
  visualSettings: {
    borderRadius: 12,
    // ... 其他设置
  }
}
```

#### 添加新 CSS 变量

在 `src/index.css` 中添加新变量：

```css
:root {
  /* 在此处添加新变量 */
  --custom-variable: #value;
}

[data-theme="dark"] {
  --custom-variable: #dark-value;
}
```

#### 组件中使用主题变量

```css
.my-component {
  color: var(--text-primary);
  background: var(--surface);
  border-radius: var(--radius);
}
```

### 3.7 主题切换动画

主题切换带有平滑的 CSS 过渡动画：

```css
* {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
```

动画时长可在 `src/index.css` 中调整。

### 3.8 无障碍支持

主题系统遵循 WCAG 2.1 AA 标准：

- 所有文本对比度 ≥ 4.5:1
- 大文本对比度 ≥ 3:1
- UI 组件对比度 ≥ 3:1

内置的高对比度预设专为有视觉障碍的用户设计。

## 4. 常见问题和解决方案

### 4.1 构建错误

#### TypeScript 类型错误

**问题**：构建时出现大量 TypeScript 类型错误

**解决方案**：
1. 检查类型定义是否正确
2. 确保所有必需的属性都已提供
3. 对于可选属性，使用可选链操作符 (`?.`)
4. 对于类型不匹配的情况，使用类型断言或类型守卫

#### 依赖冲突

**问题**：依赖包版本冲突

**解决方案**：
1. 运行 `npm outdated` 检查过时的依赖
2. 运行 `npm update` 更新依赖到最新版本
3. 对于特定版本的依赖，在 package.json 中指定版本范围

### 4.2 运行时错误

#### WebSocket 连接问题

**问题**：WebSocket 连接失败

**解决方案**：
1. 检查后端服务是否运行
2. 检查 WebSocket 服务器地址是否正确
3. 检查网络连接是否正常

#### 组件渲染错误

**问题**：组件渲染失败，出现 "TypeError: Cannot convert object to primitive value"

**解决方案**：
1. 检查组件的 props 是否正确传递
2. 确保对象转换为字符串时使用正确的方法，如 `JSON.stringify()`
3. 检查数据结构是否符合组件的期望

### 4.3 性能问题

#### 页面加载缓慢

**解决方案**：
1. 实现代码分割，使用 `React.lazy()` 和 `Suspense`
2. 优化图片和静态资源
3. 使用缓存策略减少重复请求
4. 优化组件渲染，使用 `useMemo` 和 `useCallback`

#### 内存泄漏

**解决方案**：
1. 确保在组件卸载时清理定时器和事件监听器
2. 使用 `useEffect` 的清理函数
3. 避免在渲染过程中创建新的对象或函数

## 5. 测试

### 5.1 测试环境配置

- **测试框架**：Jest
- **测试库**：React Testing Library
- **测试配置**：`tsconfig.test.json` 和 `jest.config.js`

### 5.2 运行测试

```bash
npm test
```

### 5.3 测试覆盖范围

测试覆盖范围配置在 `jest.config.js` 中，目标是达到 50% 的代码覆盖率。

主题系统单元测试位于 `src/tests/useTheme.test.ts`，包含以下测试用例：
- 主题初始化测试
- 主题切换测试
- 文档类更新测试
- 自定义颜色测试
- toggleTheme 函数测试
- resetSettings 函数测试
- visualSettings 应用测试

## 6. 部署

### 6.1 构建生产版本

```bash
npm run build
```

构建产物会生成在 `dist` 目录中。

### 6.2 部署到服务器

1. 将 `dist` 目录中的文件上传到服务器
2. 配置服务器的静态文件服务
3. 确保后端 API 地址正确配置

## 7. 代码规范

### 7.1 ESLint 配置

项目使用 ESLint 进行代码规范检查：

```bash
npm run lint
```

### 7.2 代码风格

- 使用 TypeScript 类型系统
- 采用函数式组件和 Hooks
- 使用 Tailwind CSS 进行样式管理
- 遵循 React 最佳实践

## 8. 维护任务

### 8.1 定期任务

1. **更新依赖**：每季度运行 `npm update` 更新依赖包
2. **代码审查**：定期审查代码，确保代码质量
3. **性能优化**：监控应用性能，及时优化
4. **安全检查**：定期检查安全漏洞

### 8.2 常见维护操作

#### 添加新组件

1. 在 `src/components` 目录中创建新组件
2. 为组件添加 TypeScript 类型定义
3. 编写测试用例
4. 在需要的地方导入和使用组件

#### 修改 API 调用

1. 在 `src/api` 目录中修改相应的 API 函数
2. 更新相关的类型定义
3. 测试 API 调用是否正常

#### 优化性能

1. 使用 React DevTools 分析组件渲染
2. 识别性能瓶颈
3. 应用性能优化技术
4. 测试优化效果

### 8.3 主题系统维护

#### 添加新颜色变量

1. 在 `src/index.css` 的 `:root` 和 `[data-theme="dark"]` 中添加新变量
2. 在 `src/config/theme.config.ts` 的颜色类型定义中添加新颜色
3. 确保新变量在所有主题模式下都有正确的值

#### 更新主题预设

1. 在 `src/config/theme.config.ts` 的 `PRESET_THEMES` 数组中修改或添加预设
2. 确保预设包含所有必需的颜色和设置
3. 测试新预设在不同主题模式下的显示效果

## 9. 故障排查

### 9.1 日志分析

- **前端日志**：浏览器控制台
- **后端日志**：服务器日志
- **网络请求**：浏览器开发者工具的网络标签

### 9.2 常见错误处理

| 错误类型 | 可能原因 | 解决方案 |
|---------|---------|--------|
| WebSocket 连接失败 | 后端服务未运行 | 启动后端服务 |
| 组件渲染错误 | 数据结构不正确 | 检查数据结构和类型定义 |
| API 调用失败 | 网络问题或后端错误 | 检查网络连接和后端服务 |
| 性能问题 | 组件渲染频繁 | 使用 `useMemo` 和 `useCallback` |
| 主题切换失效 | CSS 变量未正确定义 | 检查 index.css 中的变量定义 |
| 主题样式冲突 | 硬编码样式覆盖 | 使用 CSS 变量替代硬编码颜色 |

### 9.3 主题系统故障排查

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| 主题切换无动画 | CSS transition 未定义 | 检查 index.css 中的过渡动画 |
| 深色模式颜色异常 | CSS 变量未定义 | 确保 dark 模式下所有变量都有定义 |
| 自定义颜色不生效 | 变量名不匹配 | 检查 updateSettings 中的颜色键名 |
| 字体大小不生效 | 未应用 CSS 变量 | 使用 `font-size: var(--font-size)` |

## 10. 开发流程

### 10.1 本地开发

1. 克隆仓库
2. 安装依赖：`npm install`
3. 启动开发服务器：`npm run dev`
4. 访问：`http://localhost:5173`

### 10.2 代码提交

1. 运行 `npm run lint` 检查代码规范
2. 运行 `npm test` 确保测试通过
3. 提交代码到版本控制系统

## 11. 总结

RMFOOD 配方平台是一个基于 React 和 TypeScript 的现代化前端应用，采用了最新的前端技术栈和最佳实践。通过本维护文档，开发人员可以快速了解项目结构、技术栈、常见问题和解决方案，从而更有效地进行开发和维护工作。

主题系统是本项目的核心功能之一，基于 Material Design 3 标准构建，提供完整的主题定制能力，包括浅色/深色模式切换、自定义颜色方案、字体设置、视觉属性调节等功能。开发者在扩展或修改主题系统时，应遵循本文档中的指导原则，确保主题系统的一致性和可维护性。

定期的维护和更新是确保应用稳定运行和持续改进的关键。通过遵循本文档中的指导，开发团队可以保持代码质量，提高开发效率，为用户提供更好的使用体验。