# ThinkingWithInput 组件使用文档

## 📋 概述

`ThinkingWithInput` 是一个集成了 AI 思考过程展示和文本输入功能的复合组件，提供了完整的对话交互体验。

## 🎯 功能特性

### 核心功能
- ✅ **AI 思考过程展示** - 可视化 AI 的思考步骤和推理过程
- ✅ **打字机效果** - 动态展示思考内容，增强交互体验
- ✅ **代码块高亮** - 支持代码片段展示和一键复制
- ✅ **时间戳显示** - 展示每个思考步骤的时间信息
- ✅ **输入验证** - 实时字数统计和输入校验
- ✅ **响应式设计** - 完美适配各种屏幕尺寸
- ✅ **深色/浅色模式** - 自动适配系统主题

### 增强特性
- 📊 **置信度指标** - 显示 AI 对每个步骤的置信度
- 🔄 **状态指示** - 清晰的步骤状态（待处理/处理中/已完成/错误）
- ⌨️ **快捷键支持** - Enter 发送，Shift+Enter 换行
- 📋 **复制功能** - 一键复制思考内容
- 🎨 **动画过渡** - 平滑的视觉效果和状态转换

## 🚀 快速开始

### 基本用法

```tsx
import { ThinkingWithInput, ThinkingStep } from './ThinkingWithInput'

function MyComponent() {
  const [input, setInput] = useState('')
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [isThinkingVisible, setIsThinkingVisible] = useState(true)

  const handleSend = () => {
    // 处理发送逻辑
    setIsThinking(true)
  }

  return (
    <ThinkingWithInput
      // 思考过程配置
      thinkingSteps={thinkingSteps}
      isThinking={isThinking}
      currentStepIndex={thinkingSteps.length - 1}
      isThinkingVisible={isThinkingVisible}
      onToggleThinking={() => setIsThinkingVisible(!isThinkingVisible)}
      
      // 输入配置
      inputValue={input}
      onInputChange={setInput}
      onSend={handleSend}
      isStreaming={false}
      
      // 可选配置
      showTypewriter={true}
      showTimestamps={true}
    />
  )
}
```

### 完整状态管理示例

```tsx
import { useState, useCallback } from 'react'
import { ThinkingWithInput, ThinkingStep } from './ThinkingWithInput'

function ChatContainer() {
  const [inputValue, setInputValue] = useState('')
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [isThinkingVisible, setIsThinkingVisible] = useState(true)
  const [error, setError] = useState<string | undefined>()

  // 模拟思考过程
  const simulateThinking = useCallback(async (question: string) => {
    setIsThinking(true)
    setError(undefined)
    setThinkingSteps([])
    setCurrentStepIndex(-1)

    const steps: Omit<ThinkingStep, 'id' | 'timestamp'>[] = [
      {
        title: '分析用户问题',
        content: `正在理解您的需求: "${question}"...`,
        confidence: 0.9,
        status: 'processing'
      },
      {
        title: '搜索相关知识',
        content: '正在查询配方数据库和相关资料...',
        confidence: 0.85,
        status: 'pending'
      },
      {
        title: '生成响应',
        content: '正在根据上下文生成专业的回答...',
        confidence: 0.92,
        status: 'pending'
      }
    ]

    for (let i = 0; i < steps.length; i++) {
      const step: ThinkingStep = {
        ...steps[i],
        id: `step-${Date.now()}-${i}`,
        timestamp: Date.now()
      }
      
      setThinkingSteps(prev => [...prev, step])
      setCurrentStepIndex(i)
      
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500))
      
      setThinkingSteps(prev => 
        prev.map((s, idx) => 
          idx === i ? { ...s, status: 'completed' } : s
        )
      )
    }

    setIsThinking(false)
  }, [])

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return
    
    simulateThinking(inputValue)
    setInputValue('')
  }, [inputValue, simulateThinking])

  return (
    <div className="h-full">
      <ThinkingWithInput
        thinkingSteps={thinkingSteps}
        isThinking={isThinking}
        currentStepIndex={currentStepIndex}
        isThinkingVisible={isThinkingVisible}
        onToggleThinking={() => setIsThinkingVisible(!isThinkingVisible)}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSend={handleSend}
        isStreaming={false}
        error={error}
        onClearError={() => setError(undefined)}
      />
    </div>
  )
}
```

## 📐 API 参考

### ThinkingWithInputProps

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `thinkingSteps` | `ThinkingStep[]` | **必填** | 思考步骤数组 |
| `isThinking` | `boolean` | **必填** | AI 是否正在思考 |
| `currentStepIndex` | `number` | **必填** | 当前处理的步骤索引 |
| `isThinkingVisible` | `boolean` | **必填** | 思考区域是否可见 |
| `onToggleThinking` | `() => void` | **必填** | 切换思考区域可见性的回调 |
| `inputValue` | `string` | **必填** | 输入框的值 |
| `onInputChange` | `(value: string) => void` | **必填** | 输入变化回调 |
| `onSend` | `() => void` | **必填** | 发送消息回调 |
| `isStreaming` | `boolean` | **必填** | 是否正在流式传输 |
| `disabled` | `boolean` | `false` | 是否禁用输入 |
| `placeholder` | `string` | `'请输入您的问题...'` | 输入框占位符 |
| `maxLength` | `number` | `2000` | 最大输入长度 |
| `showTypewriter` | `boolean` | `true` | 是否显示打字机效果 |
| `showTimestamps` | `boolean` | `true` | 是否显示时间戳 |
| `error` | `string` | - | 错误信息 |
| `onClearError` | `() => void` | - | 清除错误的回调 |

### ThinkingStep 接口

```typescript
interface ThinkingStep {
  id: string                    // 步骤唯一标识
  title: string                 // 步骤标题
  content: string               // 步骤内容
  timestamp: number             // 时间戳（毫秒）
  confidence: number            // 置信度（0-1）
  status: 'pending' | 'processing' | 'completed' | 'error'  // 状态
  code?: string                 // 可选：代码片段
  language?: string             // 可选：代码语言
}
```

## 🎨 自定义样式

### 使用 Tailwind CSS 覆盖样式

```tsx
// 自定义思考区域背景
<ThinkingWithInput
  // ...其他属性
  // 通过父容器的 class 来影响样式
/>
```

### CSS 变量（如果需要）

```css
/* 可通过 CSS 变量自定义主题 */
.thinking-container {
  --thinking-bg: linear-gradient(to bottom, #f9fafb, #ffffff);
  --thinking-border: #e5e7eb;
  --thinking-text: #374151;
}

.dark .thinking-container {
  --thinking-bg: linear-gradient(to bottom, #111827, #030712);
  --thinking-border: #374151;
  --thinking-text: #f3f4f6;
}
```

## 🔧 最佳实践

### 1. 状态管理

将思考步骤状态和输入状态分开管理，确保数据流向清晰：

```tsx
// ✅ 推荐
const [thinkingState, setThinkingState] = useState({
  steps: [],
  isThinking: false,
  currentIndex: -1,
  isVisible: true
})

const [inputState, setInputState] = useState({
  value: '',
  isStreaming: false,
  error: undefined
})
```

### 2. 性能优化

对于大量思考步骤，考虑虚拟化：

```tsx
// 使用 react-window 进行虚拟化（可选优化）
import { FixedSizeList as List } from 'react-window'

// 但当前组件已内置 max-h-64 限制，通常不需要额外虚拟化
```

### 3. 错误处理

提供友好的错误恢复机制：

```tsx
<ThinkingWithInput
  // ...
  error={errorMessage}
  onClearError={() => {
    setError(undefined)
    // 可选：重置思考状态
  }}
/>
```

### 4. 可访问性

确保组件支持键盘导航和屏幕阅读器：

```tsx
// 组件内部已实现基本的 a11y
// 可以通过 aria-label 进一步增强
```

## 🐛 常见问题

### Q: 打字机效果太卡怎么办？

A: 可以通过 `showTypewriter={false}` 禁用，或调整速度参数。

### Q: 如何自定义代码高亮？

A: 当前使用的是基础样式，可以集成 `prismjs` 或 `highlight.js` 进行增强。

### Q: 思考区域高度可以调整吗？

A: 可以通过 CSS 覆盖 `.max-h-64` 类来调整：

```tsx
<div className="[&_.max-h-64]:max-h-96">
  <ThinkingWithInput ... />
</div>
```

## 📄 更新日志

### v1.0.0 (2026-05-23)

- ✨ 初始版本发布
- 🎨 实现完整的复合组件结构
- 📝 添加打字机效果和时间戳显示
- 🔗 集成复制功能和代码块展示
- 🧪 提供完整的单元测试
- 📖 完善的文档和示例

## 📞 支持与反馈

如有问题或建议，请联系 RMFOOD 开发团队。
