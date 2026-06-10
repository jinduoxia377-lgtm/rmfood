# 智能对话模块 v6.0 - 单元测试套件

## 测试框架配置

### 安装依赖

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest
```

### package.json 脚本配置

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --reporters=default --reporters=jest-junit"
  }
}
```

### jest.config.js 配置

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.spec.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/components/ai/features/**/*.{ts,tsx}',
    '!src/components/ai/features/**/*.d.ts',
    '!src/components/ai/features/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/components/ai/features/hooks/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/components/ai/features/utils/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  setupFilesAfterSetup: ['<rootDir>/jest.setup.ts'],
}
```

---

## 测试用例清单

### 1. useChatMessages Hook 测试

**文件**: `__tests__/hooks/useChatMessages.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react'
import { useChatMessages } from '../../hooks/useChatMessages'

describe('useChatMessages', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('应成功发送消息', () => {
    const { result } = renderHook(() => useChatMessages())

    act(() => {
      result.current.setInput('测试消息')
      result.current.sendMessage()
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].content).toBe('测试消息')
    expect(result.current.messages[0].role).toBe('user')
  })

  test('应处理流式输出状态', () => {
    const { result } = renderHook(() => useChatMessages())

    expect(result.current.isStreaming).toBe(false)

    act(() => {
      result.current.setIsStreaming(true)
    })

    expect(result.current.isStreaming).toBe(true)
  })

  test('应保存消息历史到 localStorage', () => {
    const { result } = renderHook(() => useChatMessages())

    act(() => {
      result.current.addMessage({
        id: 'msg-1',
        role: 'user',
        content: '持久化测试',
        timestamp: Date.now(),
      })
    })

    const stored = localStorage.getItem('rmfood_ai_chat_history_v4')
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed).toHaveLength(1)
  })

  test('应限制最大消息数', () => {
    const { result } = renderHook(() =>
      useChatMessages({ maxMessages: 5 })
    )

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.addMessage({
          id: `msg-${i}`,
          role: 'user',
          content: `消息 ${i}`,
          timestamp: Date.now(),
        })
      }
    })

    expect(result.current.messages).toHaveLength(5)
  })

  test('应清空所有消息', () => {
    const { result } = renderHook(() => useChatMessages())

    act(() => {
      result.current.addMessage({
        id: 'msg-1',
        role: 'user',
        content: '待删除',
        timestamp: Date.now(),
      })
      result.current.clearMessages()
    })

    expect(result.current.messages).toHaveLength(0)
  })
})
```

**预期覆盖率**: ≥90%

---

### 2. useFormulaManager Hook 测试

**文件**: `__tests__/hooks/useFormulaManager.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react'
import { useFormulaManager } from '../../hooks/useFormulaManager'

const mockFormula = {
  id: 'FMT-test-1',
  name: '气血双补配方',
  confidence: 0.92,
  ingredientCount: 8,
  sourceMessageId: 'msg-1',
  parsedAt: Date.now(),
  ingredients: [],
}

describe('useFormulaManager', () => {
  test('应添加新配方', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(mockFormula)
    })

    expect(result.current.formulaCount).toBe(1)
    expect(result.current.formulas[0].id).toBe(mockFormula.id)
  })

  test('应删除指定配方', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(mockFormula)
      result.current.removeFormula(mockFormula.id)
    })

    expect(result.current.formulaCount).toBe(0)
  })

  test('应切换展开/收起状态', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(mockFormula)
    })

    expect(result.current.isExpanded(mockFormula.id)).toBe(false)

    act(() => {
      result.current.toggleExpand(mockFormula.id)
    })

    expect(result.current.isExpanded(mockFormula.id)).toBe(true)

    act(() => {
      result.current.toggleExpand(mockFormula.id)
    })

    expect(result.current.isExpanded(mockFormula.id)).toBe(false)
  })

  test('应根据关键词搜索配方', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula({ ...mockFormula, name: '人参养荣汤' })
      result.current.addFormula({ ...mockFormula, id: 'FMT-2', name: '归脾汤' })
    })

    const results = result.current.searchFormulas('人参')
    expect(results).toHaveLength(1)
    expect(results[0].name).toContain('人参')
  })

  test('应导出为 JSON 格式', () => {
    const { result } = renderHook(() => useFormulaManager())

    act(() => {
      result.current.addFormula(mockFormula)
    })

    // Mock download function
    global.URL.createObjectURL = jest.fn()
    const spy = jest.spyOn(global, 'URL')

    act(() => {
      result.current.exportFormulas('json')
    })

    expect(spy.createObjectURL).toHaveBeenCalled()
    spy.mockRestore()
  })
})
```

**预期覆盖率**: ≥90%

---

### 3. reportEngine 工具函数测试

**文件**: `__tests__/utils/reportEngine.test.ts`

```typescript
import {
  generateSingleFormulaReport,
  generateComprehensiveReport,
} from '../../utils/reportEngine'

const mockFormula = {
  id: 'FMT-test-1',
  name: '测试配方',
  confidence: 0.88,
  ingredientCount: 6,
  parsedAt: Date.now(),
  ingredients: [
    { name: '人参', dosage: '10g' },
    { name: '白术', dosage: '15g' },
  ],
}

describe('reportEngine', () => {
  test('应生成完整的7个章节', () => {
    const report = generateSingleFormulaReport(mockFormula as any)

    expect(report.sections).toHaveLength(7)
    expect(report.sections[0].type).toBe('cover')
    expect(report.sections[1].type).toBe('executive-summary')
    expect(report.sections[6].type).toBe('appendix')
  })

  test('封面章节包含正确的标题和日期', () => {
    const report = generateSingleFormulaReport(mockFormula as any)
    const coverSection = report.sections.find(s => s.type === 'cover')

    expect(coverSection?.title).toContain(mockFormula.name)
    expect(coverSection?.content).toBeDefined()
  })

  test('成分分析章节列出所有成分', () => {
    const report = generateSingleFormulaReport(mockFormula as any)
    const analysisSection = report.sections.find(s => s.type === 'ingredient-analysis')

    expect(analysisSection?.content).toContain('人参')
    expect(analysisSection?.content).toContain('白术')
  })

  test('综合报告合并多配方数据', () => {
    const formula2 = { ...mockFormula, id: 'FMT-2', name: '配方2' }
    const report = generateComprehensiveReport([mockFormula, formula2] as any[])

    expect(report.metadata.totalFormulas).toBe(2)
    expect(report.title).toContain('综合对比')
  })

  test('应校验必要字段存在性', () => {
    const invalidFormula = {} as any

    expect(() => generateSingleFormulaReport(invalidFormula)).toThrow()
  })
})
```

**预期覆盖率**: ≥95%

---

### 4. MessageList 组件测试

**文件**: `__tests__/components/MessageList.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import MessageList from '../../components/MessageList'

const mockMessages = [
  {
    id: 'msg-1',
    role: 'user' as const,
    content: '用户消息',
    timestamp: Date.now(),
  },
  {
    id: 'msg-2',
    role: 'assistant' as const,
    content: 'AI 回复',
    timestamp: Date.now() + 1000,
  },
]

describe('MessageList', () => {
  test('应正确渲染消息列表', () => {
    render(<MessageList messages={mockMessages} showReportButton={false} highlightedMessageId={null} isStreaming={false} />)

    expect(screen.getByText('用户消息')).toBeInTheDocument()
    expect(screen.getByText('AI 回复')).toBeInTheDocument()
  })

  test('空消息时应显示空状态', () => {
    render(<MessageList messages={[]} showReportButton={false} highlightedMessageId={null} isStreaming={false} />)

    expect(screen.getByText('暂无消息')).toBeInTheDocument()
  })

  test('高亮消息应有特殊样式', () => {
    render(
      <MessageList
        messages={mockMessages}
        showReportButton={false}
        highlightedMessageId="msg-1"
        isStreaming={false}
      />
    )

    const highlightedMessage = screen.getByTestId('message-msg-1')
    expect(highlightedMessage).toHaveClass('highlight-formula-message')
  })

  test('流式输出时显示骨架屏', () => {
    const streamingMessage = {
      id: 'msg-3',
      role: 'assistant' as const,
      content: '',
      timestamp: Date.now(),
    }

    render(
      <MessageList
        messages={[streamingMessage]}
        showReportButton={false}
        highlightedMessageId={null}
        isStreaming={true}
      />
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
```

**预期覆盖率**: ≥70%

---

## 运行测试命令

```bash
# 运行所有测试
npm run test

# 监听模式（开发时使用）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# CI 环境（输出 JUnit XML）
npm run test:ci
```

## 预期覆盖率目标

| 模块 | 目标覆盖率 | 当前预估 |
|------|-----------|---------|
| **总体** | ≥80% | - |
| **Hooks (核心逻辑)** | ≥90% | - |
| **Utils (工具函数)** | ≥95% | - |
| **Components (UI 组件)** | ≥70% | - |

## 性能基准测试脚本

在浏览器控制台中运行：

```javascript
// performance-benchmark.js
async function runBenchmark() {
  console.log('🚀 开始性能基准测试...\n')

  // 1. 首屏渲染时间
  const navigation = performance.getEntriesByType('navigation')[0]
  console.log(`[1] 首屏渲染时间: ${(navigation.loadEventEnd - navigation.startTime).toFixed(2)}ms`)

  // 2. 内存占用
  if (performance.memory) {
    console.log(`[3] 内存使用:`)
    console.log(`   - 已分配: ${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   - 分配上限: ${(performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`)
  }

  console.log('\n✅ 基准测试完成')
}

runBenchmark()
```
