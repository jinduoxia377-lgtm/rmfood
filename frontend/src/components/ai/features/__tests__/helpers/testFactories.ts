/**
 * Enhanced Test Factories - AI Chat v7.0
 * 
 * 提供完整的测试数据工厂函数，用于单元测试、集成测试和 E2E 测试。
 * 支持链式调用、批量生成、自定义变体等高级功能。
 *
 * @version 7.1.0
 * @lastUpdated 2026-05-11
 */

import { 
  ChatMessage, 
  Formula, 
  AIResponse,
  AIRecognizedFormula,
  StreamChunk,
  ClassifiedError,
  ErrorType,
  RateLimitInfo 
} from '../../types'

// ===== 核心数据工厂 =====

export function createMockMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    timestamp: Date.now(),
    content: '测试消息内容',
    ...overrides
  }
}

export function createMockAssistantMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return createMockMessage({
    role: 'assistant',
    content: '这是AI的回答内容，包含详细的技术说明和配方建议。',
    ...overrides
  })
}

export function createMockFormula(overrides: Partial<Formula> = {}): Formula {
  return {
    id: crypto.randomUUID(),
    name: '测试配方',
    category: '功能性成分',
    data: {
      ingredients: [
        { name: '胶原蛋白肽', percentage: 85, unit: '%' },
        { name: '透明质酸', percentage: 10, unit: '%' },
        { name: '维生素C', percentage: 5, unit: '%' }
      ],
      nutrition: {
        calories: 50,
        protein: 40,
        carbs: 5,
        fat: 1
      },
      process: [
        '酶解提取',
        '膜分离纯化',
        '喷雾干燥'
      ]
    },
    ...overrides
  }
}

export function createMockAIRecognizedFormula(overrides: Partial<AIRecognizedFormula> = {}): AIRecognizedFormula {
  return {
    name: '测试识别配方',
    value: 90,
    unit: '%',
    confidence: 0.95,
    ...overrides
  }
}

export function createMockAIRecognizedFormulasArray(count: number): AIRecognizedFormula[] {
  const names = [
    '胶原蛋白肽', '乳清蛋白肽', '海洋鱼肽', '大豆肽',
    '卵磷脂', '透明质酸', '维生素C', '维生素E'
  ]

  return Array.from({ length: count }, (_, i) =>
    createMockAIRecognizedFormula({
      name: names[i % names.length] || `自定义配方 ${i + 1}`,
      value: Math.floor(Math.random() * 100)
    })
  )
}

export function createMockAIResponse(overrides: Partial<AIResponse> = {}): AIResponse {
  return {
    content: '这是AI的完整回答内容，包含多个段落和结构化信息。',
    role: 'assistant',
    timestamp: Date.now(),
    formulas: [createMockAIRecognizedFormula()],
    model: 'gpt-4-turbo',
    ...overrides
  }
}

export function createMockStreamChunk(overrides: Partial<StreamChunk> = {}): StreamChunk {
  return {
    content: '流式内容片段',
    done: false,
    formula: undefined,
    ...overrides
  }
}

// ===== 批量生成工厂 =====

export function createMockMessagesArray(
  count: number, 
  options?: { includeFormulas?: boolean; longContent?: boolean }
): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => {
    const isUser = i % 2 === 0
    
    if (isUser) {
      return createMockMessage({
        content: options?.longContent 
          ? `这是第 ${i + 1} 条用户消息，包含较长的内容用于测试渲染性能和虚拟滚动效果...${'测试'.repeat(50)}`
          : `用户消息 ${i + 1}: 请问${['活性肽', '胶原蛋白', '乳清蛋白', '海洋鱼肽'][i % 4]}有哪些来源？`
      })
    } else {
      const baseContent = `助手回复 ${i + 1}: 关于${['活性肽', '胶原蛋白', '乳清蛋白', '海洋鱼肽'][i % 4]}的详细信息...`
      
      return createMockAssistantMessage({
        content: options?.longContent 
          ? `${baseContent}${'详细说明'.repeat(100)}`
          : baseContent
      })
    }
  })
}

export function createMockFormulasArray(count: number): Formula[] {
  const categories = ['功能性成分', '营养强化', '口感改良', '保鲜剂']
  const names = [
    '胶原蛋白肽', '乳清蛋白肽', '海洋鱼肽', '大豆肽', 
    '卵磷脂', '透明质酸', '维生素C', '维生素E'
  ]
  
  return Array.from({ length: count }, (_, i) =>
    createMockFormula({
      name: names[i % names.length] || `自定义配方 ${i + 1}`,
      category: categories[i % categories.length],
      data: {
        ingredients: Array.from({ length: 3 }, (_, j) => ({
          name: `成分 ${j + 1}`,
          percentage: Math.floor(Math.random() * 100),
          unit: '%'
        })),
        nutrition: {
          calories: Math.floor(Math.random() * 200),
          protein: Math.floor(Math.random() * 50),
          carbs: Math.floor(Math.random() * 30),
          fat: Math.floor(Math.random() * 10)
        },
        process: ['提取', '纯化', '干燥'].slice(0, Math.floor(Math.random() * 3) + 1)
      }
    })
  )
}

export function createMockStreamChunks(content: string, chunkSize: number = 5): StreamChunk[] {
  const chunks: StreamChunk[] = []
  
  for (let i = 0; i < content.length; i += chunkSize) {
    const chunk = content.slice(i, i + chunkSize)
    chunks.push({
      content: chunk,
      done: i + chunkSize >= content.length
    })
  }
  
  // 最后一个 chunk 标记为完成
  if (chunks.length > 0) {
    chunks[chunks.length - 1].done = true
  }
  
  return chunks
}

// ===== 错误场景工厂 =====

export function createMockNetworkError(): Error {
  const error = new Error('网络连接失败')
  error.name = 'NetworkError'
  return error
}

export function createMockTimeoutError(): Error {
  const error = new Error('请求超时 (30000ms)')
  error.name = 'TimeoutError'
  return error
}

export function createMockAuthError(): Error {
  const error = new Error('认证失败 (401): 未授权访问')
  return error
}

export function createMockRateLimitError(remaining: number = 0): Error {
  const error = new Error(`请求过于频繁 (429): 剩余 ${remaining} 次`)
  return error
}

export function createMockServerError(status: number = 500): Error {
  const error = new Error(`服务器错误 (${status}): Internal Server Error`)
  return error
}

export function createMockClassifiedError(type: ErrorType = ErrorType.Unknown): ClassifiedError {
  const errors: Record<ErrorType, ClassifiedError> = {
    [ErrorType.NetworkTimeout]: {
      type: ErrorType.NetworkTimeout,
      originalError: createMockTimeoutError(),
      userMessage: '网络连接超时',
      suggestion: '请检查您的网络连接后重试',
      canAutoRecover: true,
      retryAfter: 1000
    },
    [ErrorType.Unauthorized]: {
      type: ErrorType.Unauthorized,
      originalError: createMockAuthError(),
      userMessage: '您的登录会话已过期',
      suggestion: '请重新登录以继续使用',
      canAutoRecover: false
    },
    [ErrorType.RateLimited]: {
      type: ErrorType.RateLimited,
      originalError: createMockRateLimitError(),
      userMessage: '请求过于频繁，请等待 60s',
      suggestion: '请稍等片刻后再发送消息',
      canAutoRecover: false,
      countdown: 60
    },
    [ErrorType.ServerError]: {
      type: ErrorType.ServerError,
      originalError: createMockServerError(),
      userMessage: '服务器暂时无法处理请求',
      suggestion: '我们正在努力修复，请稍后重试',
      canAutoRecover: true,
      retryAfter: 2000
    },
    [ErrorType.StreamInterrupted]: {
      type: ErrorType.StreamInterrupted,
      originalError: new Error('流式响应中断'),
      userMessage: 'AI 响应在传输过程中被中断',
      suggestion: '是否重新生成响应？',
      canAutoRecover: true,
      retryAfter: 500
    },
    [ErrorType.Unknown]: {
      type: ErrorType.Unknown,
      originalError: new Error('发生了未知错误'),
      userMessage: '发生了未知错误',
      suggestion: '请稍后重试或联系客服获取帮助',
      canAutoRecover: true,
      retryAfter: 2000
    }
  }

  return errors[type]
}

export function createMockRateLimitInfo(overrides: Partial<RateLimitInfo> = {}): RateLimitInfo {
  return {
    remaining: 100,
    resetAt: new Date(Date.now() + 60000),
    limit: 1000,
    ...overrides
  }
}

// ===== 特殊场景工厂 =====

export function createLongConversation(count: number = 20): ChatMessage[] {
  const topics = [
    '功能性食品配方的开发趋势',
    '活性肽在抗衰老中的应用',
    '植物蛋白提取技术的创新',
    '益生菌发酵工艺优化',
    '天然色素稳定性研究'
  ]
  
  const messages: ChatMessage[] = []
  
  for (let i = 0; i < count; i++) {
    const topicIndex = i % topics.length
    
    // 用户提问
    messages.push(createMockMessage({
      content: `关于"${topics[topicIndex]}"，我想了解：${['原理是什么', '有哪些应用', '如何制备', '市场前景如何'][i % 4]}？`
    }))
    
    // AI 回复（包含配方）
    if (i % 3 === 0) {
      messages.push(createMockAssistantMessage({
        content: `关于${topics[topicIndex]}的详细回答...\n\n这是一个包含技术细节、实验数据和行业案例的完整回复。`,
      }))
    } else {
      messages.push(createMockAssistantMessage())
    }
  }
  
  return messages
}

export function createStressTestData(): {
  messages: ChatMessage[]
  formulas: Formula[]
  expectedMetrics: {
    memoryUsage: number
    renderTime: number
    scrollFPS: number
  }
} {
  const messageCount = 1000
  const formulaCount = 50
  
  return {
    messages: createMockMessagesArray(messageCount, { longContent: true }),
    formulas: createMockFormulasArray(formulaCount),
    expectedMetrics: {
      memoryUsage: 150 * 1024 * 1024, // 150 MB
      renderTime: 100, // 100 ms
      scrollFPS: 55 // 55 FPS
    }
  }
}

// ===== 测试常量 =====

export const TEST_CONSTANTS = {
  // 用户输入示例
  USER_MESSAGES: {
    SHORT: '你好',
    MEDIUM: '活性肽有哪些来源和应用领域？',
    LONG: '请详细介绍功能性食品中常用的活性肽种类、提取工艺、生物利用度评价方法以及在抗衰老、增强免疫力方面的最新研究进展。',
    WITH_EMOJI: '🧪 我想了解胶原蛋白肽的制备方法 🔬',
    SPECIAL_CHARS: 'Test <script>alert("xss")</script> & special "chars"'
  },
  
  // AI 回复示例
  ASSISTANT_RESPONSES: {
    SHORT: '好的，我来为您解答。',
    MEDIUM: '活性肽的主要来源包括：\n\n1. **动物来源**：胶原蛋白肽（猪皮/鱼鳞）、乳清蛋白肽（牛奶）\n2. **植物来源**：大豆肽、玉米肽、小麦肽\n3. **微生物来源**：通过发酵工程生产的活性肽',
    WITH_MARKDOWN: `
# 活性肽研究综述

## 1. 定义与分类
活性肽是指具有**生物活性**的寡肽序列...

### 1.1 动物源活性肽
| 类型 | 来源 | 特点 |
|------|------|------|
| 胶原蛋白肽 | 猪皮/鱼鳞 | 高吸收率 |
| 乳清蛋白肽 | 牛奶 | 完整氨基酸谱 |

\`\`\`python
def extract_peptide(source):
    """从原料中提取活性肽"""
    return enzymatic_hydrolysis(source)
\`\`\`

> 💡 **提示**: 选择合适的提取方法至关重要！
    `,
    WITH_FORMULAS: '检测到以下配方成分：\n- 胶原蛋白肽 (85%)\n- 透明质酸 (10%)\n- 维生素C (5%)'
  },
  
  // 流式输出模拟数据
  STREAMING_CONTENT: {
    NORMAL: '这是一段正常的流式输出内容，会逐字显示给用户...',
    FAST: '快速'.repeat(100), // 用于性能测试
    WITH_CODE: `
\`\`\`javascript
const streamingExample = async () => {
  for await (const chunk of stream) {
    processChunk(chunk)
  }
}
\`\`\`
    `,
    MIXED: '普通文本 **加粗** *斜体* `代码` [链接](url)'
  },
  
  // 边界值测试数据
  BOUNDARY_VALUES: {
    EMPTY_STRING: '',
    VERY_LONG_STRING: 'A'.repeat(10000),
    SPECIAL_UNICODE: '🎉🧪🔬📊🎯 中文混合 English mix 日本語 한국어',
    HTML_CONTENT: '<div class="test"><p onclick="alert(1)">Click me</p></div>',
    JSON_DATA: JSON.stringify({ nested: { array: [1, 2, 3], object: { key: 'value' } } }, null, 2)
  },
  
  // 时间相关常量
  TIMEOUTS: {
    SHORT: 100,
    MEDIUM: 3000,
    LONG: 30000,
    VERY_LONG: 60000
  },

  // 防抖和节流常量
  DEBOUNCE_DELAY: 300,

  // 流式输出模拟数据
  STREAMING_CHUNKS: [
    '活性肽的主要来源',
    '包括动物来源（如胶原蛋白肽',
    '、乳清蛋白肽）和植物来源',
    '（如大豆肽、玉米肽），以及',
    '通过微生物发酵生产的活性肽。'
  ],
  
  // 性能基准
  PERFORMANCE_BASELINES: {
    MAX_MEMORY_MB: 200,
    MAX_RENDER_TIME_MS: 100,
    MIN_FPS: 30,
    MAX_VISIBLE_ITEMS: 50
  },

  // 错误消息
  ERROR_MESSAGE: '测试网络错误'
}

// ===== 工具函数 =====

/**
 * 创建延迟的 Promise（用于异步测试）
 */
export function createDelay(ms: number = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 创建可控制的 Mock 函数（记录调用历史）
 */
export function createTrackedMock<T extends (...args: any[]) => any>(fn: T): T & { callHistory: any[][] } {
  const history: any[][] = []
  
  const trackedFn = ((...args: any[]) => {
    history.push(args)
    return fn(...args)
  }) as T & { callHistory: any[][] }
  
  trackedFn.callHistory = history
  
  return trackedFn
}

/**
 * 生成随机 ID（测试专用）
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 创建时间戳序列（用于排序测试）
 */
export function generateTimestamps(count: number, intervalMs: number = 1000): number[] {
  const baseTime = Date.now() - count * intervalMs
  return Array.from({ length: count }, (_, i) => baseTime + i * intervalMs)
}
