# RMFOOD 配方平台 - 技术文档

## 项目概述

RMFOOD 配方平台是一个专业的中药配方研发管理系统，提供配方生成、实验管理、AI智能辅助、学术报告生成等核心功能。

### 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 8
- **样式方案**: Tailwind CSS + CSS Variables
- **状态管理**: Zustand + React Query
- **路由管理**: React Router v6
- **UI组件**: 自定义组件库 + Material Design 3 规范

---

## 核心模块

### 1. 主题系统

#### 概述
平台实现了完整的多主题支持系统，包括浅色模式、深色模式和自动模式。

#### 架构设计

```
主题系统架构
├── useTheme Hook          # 主题管理核心逻辑
├── CSS Variables          # 动态主题变量
├── ThemeSettingsPage      # 主题配置界面
└── index.css              # 全局样式定义
```

#### CSS 变量体系

```css
:root {
  /* 品牌主色 */
  --color-primary: #059669;
  --color-primary-rgb: 5, 150, 105;
  --color-primary-container: #d1fae5;
  
  /* 文本颜色 */
  --text-primary: #1e293b;
  --text-secondary: #334155;
  --text-muted: #64748b;
  
  /* 背景颜色 */
  --bg-primary: #fcfcfc;
  --bg-secondary: #ffffff;
  
  /* 间距系统 */
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  
  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

.dark {
  --text-primary: #F1F5F9;
  --text-secondary: #CBD5E1;
  --bg-primary: #0F172A;
  --bg-secondary: #1E293B;
}
```

#### 使用示例

```tsx
import { useTheme } from '@/hooks/useTheme';

function MyComponent() {
  const { isDark, setMode, getCurrentColors } = useTheme();
  
  return (
    <div style={{ color: 'var(--text-primary)' }}>
      当前模式: {isDark ? '深色' : '浅色'}
    </div>
  );
}
```

---

### 2. 响应式布局系统

#### 断点定义

| 断点名称 | 屏幕宽度 | 适用设备 |
|---------|---------|---------|
| xs | < 576px | 小型手机 |
| sm | ≥ 576px | 大型手机 |
| md | ≥ 768px | 平板电脑 |
| lg | ≥ 1024px | 桌面电脑 |
| xl | ≥ 1280px | 大屏幕 |
| 2xl | ≥ 1536px | 超大屏幕 |

#### 响应式设计规范

```css
/* 移动端优先 */
.container {
  padding: 0 1rem;
}

/* 平板端 */
@media (min-width: 768px) {
  .container {
    max-width: 720px;
    margin: 0 auto;
  }
}

/* 桌面端 */
@media (min-width: 1024px) {
  .container {
    max-width: 80rem;
  }
}
```

#### Material Design 3 规范

```typescript
const MD3 = {
  sidebar: {
    width: '264px',
    collapsedWidth: '72px',
    headerHeight: '64px',
    itemHeight: '48px',
  },
  typography: {
    headlineSmall: '14px',
    labelLarge: '14px',
    bodyMedium: '14px',
  },
  elevation: {
    level1: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    level2: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  },
};
```

---

### 3. 状态管理

#### Zustand Store 架构

```typescript
// 认证状态
interface AuthState {
  user: User | null;
  token: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

// 评审状态
interface ReviewState {
  currentReview: Review | null;
  reviews: Map<string, Review>;
  createReview: (reportId: string) => ReviewOperationResult;
  updateStageStatus: (reviewId: string, stageId: string, status: ReviewStatus) => void;
}

// 用户偏好
interface UserPreferenceState {
  theme: ThemeMode;
  fontSize: number;
  updateTheme: (mode: ThemeMode) => void;
}
```

#### React Query 配置

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 60000,
    },
  },
});
```

---

### 4. 学术报告系统

#### 功能特性

- 多格式导出（Markdown、HTML、Word、PDF）
- 模块化内容生成
- 图表自动编号
- 参考文献管理
- 评审流程支持

#### 架构设计

```
学术报告系统
├── AcademicReportService      # 报告生成服务
├── AcademicReportEnhanced     # 增强版组件
├── FormulaAcademicReport      # 主界面组件
├── academicReportModules      # 模块定义
└── reportExportService        # 导出服务
```

#### 使用示例

```tsx
import { FormulaAcademicReport } from '@/components/ai/FormulaAcademicReport';

function ReportPage({ candidate }) {
  return (
    <FormulaAcademicReport
      candidate={candidate}
      effects={['增强免疫', '抗氧化']}
    />
  );
}
```

---

## API 接口规范

### RESTful API

#### 认证接口

```
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

#### 配方接口

```
GET    /api/v1/formulas
POST   /api/v1/formulas
GET    /api/v1/formulas/:id
PUT    /api/v1/formulas/:id
DELETE /api/v1/formulas/:id
```

#### AI 接口

```
POST /api/v1/ai/generate
POST /api/v1/ai/analyze
POST /api/v1/ai/safety-check
```

### 响应格式

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}
```

---

## 性能优化

### 代码分割

```typescript
// 路由级懒加载
const AIAssistantPage = lazy(() => import('@/pages/ai/AIAssistantPage'));

// 组件级懒加载
const NeuralGeneratePanel = lazy(
  () => import('@/components/ai/NeuralGeneratePanel')
);
```

### 虚拟列表

```tsx
import { VirtualList } from '@/components/ui/VirtualList';

function LargeList({ items }) {
  return (
    <VirtualList
      items={items}
      itemHeight={48}
      containerHeight={500}
      renderItem={(item) => <ItemCard item={item} />}
    />
  );
}
```

### 图片懒加载

```tsx
import { LazyImage } from '@/components/ui/LazyImage';

function ImageGallery({ images }) {
  return images.map(img => (
    <LazyImage
      key={img.id}
      src={img.url}
      alt={img.title}
      width={300}
      height={200}
    />
  ));
}
```

---

## 可访问性 (A11y)

### WCAG 2.1 AA 级标准

- 文本对比度 ≥ 4.5:1
- 重要文本对比度 ≥ 7:1
- 触摸目标 ≥ 44×44px
- 键盘导航支持
- 屏幕阅读器支持

### ARIA 属性

```tsx
<button
  aria-label="打开菜单"
  aria-expanded={isOpen}
  aria-controls="menu-panel"
>
  <MenuIcon />
</button>
```

### 焦点管理

```css
*:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--bg-primary), 
              0 0 0 5px var(--color-primary-500);
}
```

---

## 测试策略

### 单元测试

```bash
# 运行所有测试
npm run test

# 运行特定测试文件
npm run test reviewStore.test.ts

# 生成覆盖率报告
npm run test:coverage
```

### 测试覆盖率目标

| 类型 | 目标覆盖率 |
|-----|-----------|
| 语句覆盖率 | ≥ 80% |
| 分支覆盖率 | ≥ 75% |
| 函数覆盖率 | ≥ 85% |
| 行覆盖率 | ≥ 80% |

---

## 部署指南

### 构建命令

```bash
# 开发环境
npm run dev

# 生产构建
npm run build

# 预览构建结果
npm run preview
```

### 环境变量

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_TITLE=RMFOOD 配方平台
VITE_ENABLE_MOCK_API=false
```

### Docker 部署

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 维护与更新

### 版本控制

- 遵循语义化版本规范 (SemVer)
- 主版本号：不兼容的 API 变更
- 次版本号：向后兼容的功能新增
- 修订号：向后兼容的问题修复

### 代码规范

- ESLint + Prettier 代码格式化
- TypeScript 严格模式
- 组件命名：PascalCase
- 函数命名：camelCase
- 常量命名：UPPER_SNAKE_CASE

### Git 提交规范

```
feat: 新增功能
fix: 修复问题
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建/工具相关
```

---

## 技术支持

- 文档版本: v2.0.0
- 最后更新: 2025-01-15
- 维护团队: RMFOOD 开发团队
