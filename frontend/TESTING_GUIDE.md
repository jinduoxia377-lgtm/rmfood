# RMFOOD 前端测试指南

本指南旨在帮助开发团队编写高质量的单元测试和集成测试。

---

## 1. 测试配置

### 1.1 Jest 配置

项目使用 Jest 作为测试框架，主要配置文件：
- `jest.config.js` - Jest 主配置
- `tsconfig.test.json` - TypeScript 测试配置

### 1.2 测试环境要求

```bash
# 安装测试依赖（如果缺失）
npm install --save-dev jest @testing-library/react @testing-library/jest-dom

# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm test -- --coverage

# 监听模式（文件变化时自动运行）
npm test -- --watch
```

---

## 2. 测试结构

### 2.1 测试文件位置

测试文件应放在以下位置：

```
src/
├── __tests__/
│   ├── components/    # 组件测试
│   ├── hooks/          # Hook 测试
│   ├── services/      # 服务测试
│   └── utils/         # 工具函数测试
├── tests/             # 集成测试和页面测试
└── stores/            # Store (Zustand) 测试
```

### 2.2 命名规范

- 组件测试: `ComponentName.test.tsx`
- Hook 测试: `useHookName.test.ts`
- 服务测试: `serviceName.test.ts`
- 工具测试: `utilityName.test.ts`

---

## 3. 测试编写指南

### 3.1 组件测试示例

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### 3.2 Hook 测试示例

```typescript
import { renderHook, act } from '@testing-library/react';
import { useCounter } from '@/hooks/useCounter';

describe('useCounter', () => {
  it('initializes with default value', () => {
    const { result } = renderHook(() => useCounter());
    expect(result.current.count).toBe(0);
  });

  it('increments counter', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  it('decrements counter', () => {
    const { result } = renderHook(() => useCounter(10));

    act(() => {
      result.current.decrement();
    });

    expect(result.current.count).toBe(9);
  });
});
```

### 3.3 服务测试示例

```typescript
import { exportService } from '@/services/exportService';

describe('ExportService', () => {
  describe('exportData', () => {
    it('should export data as CSV', async () => {
      const options = {
        format: 'csv' as const,
        filename: 'test.csv',
        data: [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 },
        ],
      };

      const taskId = await exportService.exportData(options);
      expect(taskId).toBeDefined();

      const task = exportService.getTaskStatus(taskId);
      expect(task?.status).toBe('completed');
    });

    it('should handle export errors gracefully', async () => {
      const options = {
        format: 'xlsx' as const,
        filename: 'test.xlsx',
        data: [], // 空数据可能导致问题
      };

      // 测试错误处理
      await expect(exportService.exportData(options)).resolves.toBeDefined();
    });
  });
});
```

### 3.4 Store 测试示例

```typescript
import { renderHook, act } from '@testing-library/react';
import { useFormulaStore } from '@/stores/formulaStore';

describe('useFormulaStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useFormulaStore.getState().reset();
  });

  it('should add a formula', () => {
    const { result } = renderHook(() => useFormulaStore());

    act(() => {
      result.current.addFormula({
        name: 'Test Formula',
        description: 'Test Description',
      });
    });

    expect(result.current.formulas).toHaveLength(1);
    expect(result.current.formulas[0].name).toBe('Test Formula');
  });
});
```

---

## 4. 测试最佳实践

### 4.1 AAA 模式（Arrange-Act-Assert）

```typescript
it('should update user profile', async () => {
  // Arrange - 准备测试数据
  const initialFormData = { fullName: 'Old Name', email: 'old@test.com' };

  // Act - 执行操作
  const { result } = renderHook(() => usePersonalInfo());
  await act(async () => {
    await result.current.updateField('fullName', 'New Name');
    await result.current.saveProfile();
  });

  // Assert - 验证结果
  expect(result.current.profile?.full_name).toBe('New Name');
});
```

### 4.2 使用 userEvent 而非 fireEvent

```typescript
import userEvent from '@testing-library/user-event';

// 优先使用 userEvent
await userEvent.click(screen.getByRole('button'));
await userEvent.type(screen.getByLabelText('Name'), 'John');
await userEvent.selectOptions(screen.getByRole('combobox'), 'Option 1');
```

### 4.3 异步测试

```typescript
it('should fetch data asynchronously', async () => {
  const { result } = renderHook(() => useFormula());

  // 使用 waitFor 等待异步操作完成
  await waitFor(() => {
    expect(result.current.data).toBeDefined();
  });

  // 或使用 findBy 查询异步加载的内容
  const element = await screen.findByText('Loaded Data');
  expect(element).toBeInTheDocument();
});
```

### 4.4 Mock 外部依赖

```typescript
// Mock API 调用
jest.mock('@/services/api', () => ({
  getFormula: jest.fn().mockResolvedValue(mockFormula),
  updateFormula: jest.fn().mockResolvedValue(mockUpdatedFormula),
}));

// Mock 组件
jest.mock('@/components/ui/Modal', () => ({
  Modal: ({ children, onClose }) => (
    <div data-testid="modal">
      <button onClick={onClose}>Close</button>
      {children}
    </div>
  ),
}));
```

---

## 5. 覆盖率要求

项目设置的覆盖率阈值：

```javascript
coverageThreshold: {
  global: {
    branches: 50,   // 分支覆盖率 ≥ 50%
    functions: 50,  // 函数覆盖率 ≥ 50%
    lines: 50,      // 行覆盖率 ≥ 50%
    statements: 50, // 语句覆盖率 ≥ 50%
  },
}
```

### 5.1 查看覆盖率报告

```bash
npm test -- --coverage
# 报告将生成在 coverage/ 目录
```

---

## 6. 常见问题解决

### 6.1 CSS 模块导入错误

如果遇到 CSS 模块导入错误，在 `jest.config.js` 中添加：

```javascript
moduleNameMapper: {
  '\\.(css|less|scss)$': 'identity-obj-proxy',
}
```

### 6.2 ES Module 导入错误

如果遇到 ES Module 导入错误（如 d3），在 `jest.config.js` 中配置：

```javascript
transformIgnorePatterns: [
  'node_modules/(?!(d3|recharts)/)',
],
```

### 6.3 异步函数测试超时

如果异步测试超时，在 `jest.config.js` 中调整：

```javascript
testTimeout: 10000, // 增加超时时间
```

---

## 7. CI/CD 集成

### 7.1 GitHub Actions 示例

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test -- --coverage
```

---

## 8. 测试维护

### 8.1 定期审查测试

- 每周审查测试覆盖率
- 每月审查测试质量
- 季度审查测试策略

### 8.2 测试重构

当业务逻辑变更时：
1. 更新相关测试
2. 确保测试通过
3. 检查覆盖率变化

---

## 9. 更多资源

- [Jest 官方文档](https://jestjs.io/)
- [Testing Library 官方文档](https://testing-library.com/)
- [React Testing Library 指南](https://testing-library.com/docs/react-testing-library/intro/)

---

*最后更新: 2026-05-01*
