# useChatInputState Hook 迁移指南

## 概述

本指南帮助您将 `ChatInputArea.tsx` 组件从内联状态管理迁移到使用 `useChatInputState` 自定义Hook。

## 迁移前后对比

### 迁移前 (ChatInputArea.tsx)

**问题：**
- 22个useState hooks
- 11个useEffect hooks
- 状态管理与UI渲染混合
- 约1063行代码

### 迁移后 (使用useChatInputState)

**优势：**
- Hook封装所有状态逻辑（608行）
- 组件只负责UI渲染
- 易于测试和维护
- 支持受控/非受控模式

## 快速开始

### 1. 导入Hook

```typescript
import { useChatInputState } from '../hooks/useChatInputState'
```

### 2. 在组件中使用

```typescript
export const ChatInputArea = memo(function ChatInputArea({
  value: externalValue,
  onChange,
  onSend,
  isStreaming,
  disabled,
  placeholder = '输入您的问题...',
  maxLength,
  deepThinking: externalDeepThinking,
  smartSearch: externalSmartSearch,
  onDeepThinkingChange,
  onSmartSearchChange,
  conversationHistory = [],
}: ChatInputAreaProps) {
  
  const state = useChatInputState({
    initialValue: externalValue || '',
    maxLength,
    externalDeepThinking,
    externalSmartSearch,
    onDeepThinkingChange,
    onSmartSearchChange,
    conversationHistory,
  })
  
  // 使用state中的所有属性和方法...
})
```

## 详细迁移步骤

### 步骤1：替换所有useState声明

**删除这些代码：**
```typescript
// ❌ 删除这些useState
const [inputHeight, setInputHeight] = useState(44)
const [isFocused, setIsFocused] = useState(false)
const [charCount, setCharCount] = useState(0)
const [showSuggestions, setShowSuggestions] = useState(false)
// ... 其他19个useState
```

**替换为：**
```typescript
// ✅ 使用Hook
const {
  inputHeight,
  isFocused,
  charCount,
  showSuggestions,
  setShowSuggestions,
  // ... 所有其他状态
} = useChatInputState({ /* options */ })
```

### 步骤2：替换ref声明

**删除：**
```typescript
// ❌ 删除
const inputRef = useRef<HTMLTextAreaElement>(null)
const fileInputRef = useRef<HTMLInputElement>(null)
```

**使用：**
```typescript
// ✅ 从Hook获取
const { inputRef, fileInputRef } = useChatInputState({ /* options */ })
```

### 步骤3：简化useEffect

**删除这些useEffect：**
```typescript
// ❌ 删除所有11个useEffect
// 1. 用户偏好订阅
// 2. 语言检测
// 3. 字符计数和格式验证
// 4. 输入框自适应高度
// 5. 建议面板显示/隐藏
// 6. 点击外部关闭面板
// 7. 粘贴处理
// 8. 拖拽区域设置
// 9. 附件事件监听
```

**替换为：**
```typescript
// ✅ 在useEffect中调用setupEventListeners
useEffect(() => {
  const cleanup = state.setupEventListeners()
  return cleanup
}, [])
```

### 步骤4：简化回调函数

**删除这些函数：**
```typescript
// ❌ 删除
const handleAttachmentsAdded = ...
const handleDeepThinkingChange = ...
const handleSmartSearchChange = ...
const triggerDeepThinking = ...
const triggerSearch = ...
const applySuggestion = ...
const selectSearchResult = ...
const removeAttachment = ...
const handleFileSelect = ...
const clearAll = ... (如果存在)
```

**使用Hook提供的方法：**
```typescript
// ✅ 直接使用
const {
  toggleDeepThinking,
  toggleSmartSearch,
  triggerDeepThinking,
  triggerSearch,
  applySuggestion,
  selectSearchResult,
  addAttachments,
  removeAttachment,
  handleFileSelect,
  clearAll,
} = state
```

### 步骤5：更新事件处理器

**修改onFocus/onBlur：**
```typescript
// ❌ 之前
<textarea 
  onFocus={() => setIsFocused(true)}
  onBlur={() => setIsFocused(false)}
/>

// ✅ 之后
<textarea 
  onFocus={state.onFocus}
  onBlur={state.onBlur}
/>
```

**修改onChange：**
```typescript
// ❌ 之前
<textarea 
  value={value}
  onChange={(e) => onChange(e.target.value)}
/>

// ✅ 之后（如果使用非受控模式）
<textarea 
  ref={state.inputRef}
  value={state.value}
  onChange={(e) => state.onChange(e.target.value)}
/>

// 或者保持受控模式（推荐）
<textarea 
  ref={state.inputRef}
  value={externalValue}
  onChange={(e) => onChange(e.target.value)}
/>
```

### 步骤6：更新计算属性

**删除：**
```typescript
// ❌ 删除
const canSend = !disabled && !isStreaming && value.trim().length > 0 && !showFormatError
const isOverLimit = maxLength && charCount > maxLength * 0.9
const isExceeded = maxLength && charCount > maxLength
```

**使用：**
```typescript
// ✅ 使用Hook提供的计算属性
const canSend = state.canSend(disabled, isStreaming)
// state.isOverLimit 和 state.isExceeded 直接可用
```

### 步骤7：保留纯UI逻辑

以下代码应**保留在组件中**：
- UI渲染JSX
- 样式类名计算
- 图标映射函数（getAttachmentIcon, getIntentLabel等）
- 条件渲染逻辑
- 辅助显示函数

## 完整示例

### 迁移后的ChatInputArea.tsx

```typescript
import React, { memo, useEffect } from 'react'
import { Button } from '@/components/ui'
import { useChatInputState } from '../hooks/useChatInputState'

interface ChatInputAreaProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  isStreaming: boolean
  disabled?: boolean
  placeholder?: string
  maxLength?: number
  deepThinking?: boolean
  smartSearch?: boolean
  onDeepThinkingChange?: (enabled: boolean) => void
  onSmartSearchChange?: (enabled: boolean) => void
  conversationHistory?: string[]
}

export const ChatInputArea = memo(function ChatInputArea({
  value: externalValue,
  onChange,
  onSend,
  isStreaming,
  disabled,
  placeholder = '输入您的问题...',
  maxLength,
  deepThinking: externalDeepThinking,
  smartSearch: externalSmartSearch,
  onDeepThinkingChange,
  onSmartSearchChange,
  conversationHistory = [],
}: ChatInputAreaProps) {
  
  const state = useChatInputState({
    initialValue: externalValue || '',
    maxLength,
    externalDeepThinking,
    externalSmartSearch,
    onDeepThinkingChange,
    onSmartSearchChange,
    conversationHistory,
  })

  useEffect(() => {
    const cleanup = state.setupEventListeners()
    return cleanup
  }, [])

  // 同步外部值到内部状态（受控模式）
  useEffect(() => {
    if (externalValue !== undefined && externalValue !== state.value) {
      state.onChange(externalValue)
    }
  }, [externalValue])

  const canSend = state.canSend(disabled || false, isStreaming)

  return (
    <div className="border-t border-gray-200">
      {/* UI渲染部分 - 大幅简化 */}
      <textarea
        ref={state.inputRef}
        value={state.value}
        onChange={(e) => {
          state.onChange(e.target.value)
          onChange?.(e.target.value)
        }}
        onFocus={state.onFocus}
        onBlur={state.onBlur}
        style={{ height: `${state.inputHeight}px` }}
      />
      
      {/* 其他UI元素... */}
      <button 
        onClick={() => {
          if (canSend) {
            onSend()
            state.onChange('')
          }
        }}
        disabled={!canSend}
      >
        发送
      </button>
    </div>
  )
})
```

## API参考

### UseChatInputStateOptions

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `initialValue` | `string` | `''` | 初始输入值 |
| `maxLength` | `number` | `undefined` | 最大字符数限制 |
| `externalDeepThinking` | `boolean` | `undefined` | 外部控制的深度思考状态 |
| `externalSmartSearch` | `boolean` | `undefined` | 外部控制的智能搜索状态 |
| `onDeepThinkingChange` | `(enabled: boolean) => void` | `undefined` | 深度思考状态变更回调 |
| `onSmartSearchChange` | `(enabled: boolean) => void` | `undefined` | 智能搜索状态变更回调 |
| `conversationHistory` | `string[]` | `[]` | 对话历史记录 |

### UseChatInputStateReturn - 状态属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `inputRef` | `RefObject<HTMLTextAreaElement>` | 输入框引用 |
| `fileInputRef` | `RefObject<HTMLInputElement>` | 文件输入引用 |
| `value` | `string` | 当前输入值 |
| `isFocused` | `boolean` | 是否聚焦 |
| `inputHeight` | `number` | 输入框高度 |
| `charCount` | `number` | 字符计数 |
| `showSuggestions` | `boolean` | 显示建议面板 |
| `showDeepThinkingPanel` | `boolean` | 显示深度思考面板 |
| `showSearchPanel` | `boolean` | 显示搜索面板 |
| `showAttachments` | `boolean` | 显示附件面板 |
| `showFormatError` | `boolean` | 显示格式错误 |
| `errorMessage` | `string` | 错误消息 |
| `deepThinkingAnalysis` | `DeepThinkingAnalysis \| null` | 深度分析结果 |
| `searchResults` | `SearchResult[]` | 搜索结果列表 |
| `isAnalyzing` | `boolean` | 正在分析 |
| `isSearching` | `boolean` | 正在搜索 |
| `attachments` | `Attachment[]` | 附件列表 |
| `isDragging` | `boolean` | 正在拖拽 |
| `detectedLanguage` | `LanguageCode` | 检测到的语言 |
| `deepThinking` | `boolean` | 深度思考模式启用状态 |
| `smartSearch` | `boolean` | 智能搜索模式启用状态 |
| `suggestions` | `SmartSuggestion[]` | 建议列表 |
| `inputBehavior` | `InputBehaviorConfig` | 用户偏好配置 |
| `isOverLimit` | `boolean` | 接近字符限制 |
| `isExceeded` | `boolean` | 超过字符限制 |

### UseChatInputStateReturn - 方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `onChange` | `(value: string)` | `void` | 更新输入值 |
| `onFocus` | - | `void` | 设置聚焦状态 |
| `onBlur` | - | `void` | 取消聚焦状态 |
| `setShowSuggestions` | `(show: boolean)` | `void` | 设置建议面板显示 |
| `toggleDeepThinking` | - | `void` | 切换深度思考模式 |
| `toggleSmartSearch` | - | `void` | 切换智能搜索模式 |
| `triggerDeepThinking` | - | `void` | 触发深度思考分析 |
| `triggerSearch` | - | `void` | 触发智能搜索 |
| `applySuggestion` | `(suggestion: SmartSuggestion)` | `void` | 应用建议 |
| `selectSearchResult` | `(result: SearchResult)` | `void` | 选择搜索结果 |
| `addAttachments` | `(files: Attachment[])` | `void` | 添加附件 |
| `removeAttachment` | `(id: string)` | `void` | 删除附件 |
| `clearAll` | - | `void` | 清空所有状态 |
| `canSend` | `(disabled: boolean, isStreaming: boolean)` | `boolean` | 检查是否可发送 |
| `setupEventListeners` | - | `() => void` | 设置事件监听器（返回清理函数） |
| `handleFileSelect` | `(e: ChangeEvent<HTMLInputElement>)` | `Promise<void>` | 处理文件选择 |

## 受控 vs 非受控模式

### 非受控模式（推荐用于简单场景）

```typescript
const state = useChatInputState({
  initialValue: 'Hello',
})

// 直接使用state.value和state.onChange
<textarea value={state.value} onChange={(e) => state.onChange(e.target.value)} />
```

### 受控模式（推荐用于复杂场景）

```typescript
const [value, setValue] = useState('')

const state = useChatInputState({
  initialValue: value,
})

// 双向同步
useEffect(() => {
  if (value !== state.value) {
    state.onChange(value)
  }
}, [value])

<textarea 
  value={value} 
  onChange={(e) => {
    setValue(e.target.value)
    state.onChange(e.target.value)
  }} 
/>
```

## 测试策略

### 单元测试Hook

```typescript
import { renderHook, act } from '@testing-library/react'
import { useChatInputState } from './useChatInputState'

describe('useChatInputState', () => {
  it('应正确管理输入状态', () => {
    const { result } = renderHook(() => useChatInputState())
    
    act(() => {
      result.current.onChange('Hello')
    })
    
    expect(result.current.value).toBe('Hello')
    expect(result.current.charCount).toBe(5)
  })
})
```

### 组件集成测试

```typescript
import { render, screen } from '@testing-library/react'
import { ChatInputArea } from './ChatInputArea'

describe('ChatInputArea with useChatInputState', () => {
  it('应渲染并响应用户输入', async () => {
    render(<ChatInputArea value="" onChange={() => {}} onSend={() => {}} isStreaming={false} />)
    
    const textarea = screen.getByPlaceholderText('输入您的问题...')
    
    fireEvent.change(textarea, { target: { value: 'Test' } })
    
    expect(textarea).toHaveValue('Test')
  })
})
```

## 性能优化说明

### 已实现的优化

1. **useCallback缓存方法**
   - 所有返回的方法都使用useCallback包装
   - 避免不必要的重渲染

2. **useMemo缓存计算值**
   - `suggestions`, `isOverLimit`, `isExceeded`等计算属性
   - 仅在依赖变化时重新计算

3. **合理依赖数组**
   - 所有useCallback/useMemo都有精确的依赖数组
   - 避免闭包陷阱

4. **事件监听器集中管理**
   - `setupEventListeners()`统一设置所有DOM事件
   - 返回清理函数避免内存泄漏

## 常见问题

### Q1: 如何处理外部value控制？

**A:** 使用受控模式，通过useEffect同步：

```typescript
useEffect(() => {
  if (externalValue !== state.value) {
    state.onChange(externalValue)
  }
}, [externalValue])
```

### Q2: 如何自定义深度思考分析逻辑？

**A:** 目前Hook内置了分析逻辑。如需自定义，可以：

1. 扩展Hook选项接口
2. 注入自定义分析函数
3. 或fork Hook代码进行修改

### Q3: 事件监听器何时设置？

**A:** 在组件的useEffect中调用：

```typescript
useEffect(() => {
  const cleanup = state.setupEventListeners()
  return cleanup
}, []) // 仅在挂载时执行一次
```

### Q4: 如何处理附件上传错误？

**A:** Hook已内置错误处理，会自动：
- 设置`showFormatError = true`
- 设置`errorMessage`
- 3秒后自动清除错误

可通过`state.showFormatError`和`state.errorMessage`显示错误信息。

## 迁移检查清单

- [ ] 导入useChatInputState
- [ ] 删除所有useState声明（21个）
- [ ] 删除inputRef和fileInputRef
- [ ] 删除所有useEffect（9个，保留1个调用setupEventListeners）
- [ ] 删除所有手动实现的回调函数
- [ ] 替换onFocus/onBlur处理
- [ ] 更新onChange处理（考虑受控/非受控模式）
- [ ] 使用state.canSend替代手动计算
- [ ] 使用state.isOverLimit/isExceeded
- [ ] 保留纯UI逻辑和样式
- [ ] 运行现有测试确保功能正常
- [ ] 编写新的Hook单元测试
- [ ] 性能测试对比

## 下一步

1. **渐进式迁移**: 可以先在新组件中使用Hook，逐步替换旧实现
2. **性能监控**: 迁移前后对比渲染性能
3. **团队培训**: 分享Hook使用最佳实践
4. **文档完善**: 补充组件级文档

## 相关资源

- [Hook源码](./useChatInputState.ts) - 608行完整实现
- [单元测试](./__tests__/useChatInputState.test.ts) - 覆盖主要场景
- [React Hooks官方文档](https://react.dev/reference/react)
- [自定义Hook最佳实践](https://react.dev/learn/reusing-logic-with-custom-hooks)

---

**版本**: 1.0.0  
**最后更新**: 2026-05-21  
**作者**: AI Assistant  
**许可证**: MIT
