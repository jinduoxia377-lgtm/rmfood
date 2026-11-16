/**
 * formulaPanelAutoCapture.test.tsx — React 运行时端到端权威验证
 *
 * 目的：证明「智能对话输出配方后，配方自动出现在『已识别的配方』(FormulaPanel)」
 * 这条链在 React 运行时真正闭合——真实挂载 ChatStateProvider + ChatTab，
 * 触发 sendMessage（mock chatService 返回**真实 e2e 响应 content**），
 * 走真实 eventBus 单例（不 mock），断言 FormulaPanel 渲染出配方名 + 4 成分。
 *
 * 与纯函数探针(e2e_extraction_probe.test.ts)的区别：本测试不直接调用
 * detect/extract/build，而是让真实 sendMessage → captureFormulasFromReply →
 * eventBus.emit('formulas:detected') → useFormulaManager 订阅 → addFormula →
 * formulaIndex → context.formulas → ChatTab <FormulaPanel> 整条 React 链自然跑通。
 *
 * 采用方案 A（最贴近真实）：mock 掉 chatService.sendMessageStream 返回真实 content，
 * 其余（eventBus / useChatMessages / useFormulaManager / FormulaPanel）全部真实。
 */
import '@testing-library/jest-dom'
import { readFileSync } from 'fs'
import React, { useEffect } from 'react'
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'

// 慢机器/CI 上 jsdom 冷启动与整棵 ChatTab 挂载较慢，放宽超时避免误报
vi.setConfig({ testTimeout: 90000, hookTimeout: 30000 })
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ChatTab } from '../../ChatTab'
import { ChatStateProvider } from '../../ChatStateProvider'
import { useChatState } from '../../ChatStateContext'
import { chatService } from '../../services/chatService'

// 真实 e2e 响应 content（后端 POST /api/v1/ai/chat 返回的 content 字段原文，```json 包裹的结构化 blocks）
const REAL_CONTENT_PATH = 'D:/RMFOODFP/docs/reviews/e2e_chat_response.txt'
const realContent = readFileSync(REAL_CONTENT_PATH, 'utf8')

// jsdom 未实现 IntersectionObserver（FormulaPanel/AdvancedFilter/MobileBottomSheet 依赖），补空实现
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverMock {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): unknown[] { return [] }
  }
  ;(globalThis as unknown as Record<string, unknown>).IntersectionObserver = IntersectionObserverMock
}

// ── mock 底层服务（参照 chatFlow.test.tsx）──
// 关键：**不 mock eventBus**——必须用真实 eventBus 单例，emit→subscribe 才是真实链路。
vi.mock('@/components/ai/features/services/chatService', () => ({
  chatService: {
    sendMessage: vi.fn(),
    sendMessageStream: vi.fn(),
    retryLastMessage: vi.fn(),
    setAuthToken: vi.fn(),
    clearAuthToken: vi.fn(),
    closeAllPendingRequests: vi.fn(),
    abortCurrentStream: vi.fn(),
    getRateLimitStatus: vi.fn().mockReturnValue({ remaining: 100, resetAt: null, limit: 1000 }),
    getStateMachine: vi.fn(() => ({
      state: 'idle',
      transition: vi.fn(),
      canTransition: vi.fn().mockReturnValue(true),
      addStateListener: vi.fn().mockReturnValue(vi.fn()),
    })),
  },
}))

vi.mock('@/components/ai/features/capabilities/storage/ChatEventLog', () => ({
  chatEventLog: {
    onChange: vi.fn().mockReturnValue(vi.fn()),
    append: vi.fn(),
    deriveMessages: vi.fn().mockReturnValue([]),
  },
}))

vi.mock('@/components/ai/features/services/userPreferencesService', () => ({
  userPreferencesService: {
    extractAndSavePreferencesFromContent: vi.fn().mockReturnValue(null),
    getUserProfile: vi.fn().mockReturnValue(undefined),
    getPreferences: vi.fn().mockReturnValue({}),
    generatePromptSummary: vi.fn().mockReturnValue(''),
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    setHealthGoals: vi.fn(),
    setAllergens: vi.fn(),
    setDietRestrictions: vi.fn(),
  },
}))

vi.mock('@/components/ai/features/services/storageService', () => ({
  storageService: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('@/components/ai/features/capabilities/storage/ChatStorageService', () => ({
  chatStorageService: {
    saveMessages: vi.fn().mockResolvedValue(undefined),
    deleteMessages: vi.fn().mockResolvedValue(undefined),
    loadMessages: vi.fn().mockResolvedValue([]),
    restoreFromServer: vi.fn().mockResolvedValue(0),
    syncToServer: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/components/ai/features/capabilities/session/SessionCapability', () => ({
  sessionCapability: {
    listSessions: vi.fn().mockResolvedValue([]),
    createSession: vi.fn().mockResolvedValue('sess_test_1'),
    fork: vi.fn().mockResolvedValue('sess_fork_1'),
    // searchSessions 是纯函数，ChatHistory 渲染时调用
    searchSessions: vi.fn((_dtos: unknown, _q: string) => []),
    resumeTo: vi.fn().mockResolvedValue(undefined),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    renameSession: vi.fn().mockResolvedValue(undefined),
    pinSession: vi.fn().mockResolvedValue(undefined),
    setSessionTags: vi.fn().mockResolvedValue(undefined),
    exportSession: vi.fn().mockResolvedValue('f.md'),
  },
}))

vi.mock('@/api/modelClient', () => ({
  ModelClient: {
    getModelStatus: vi.fn().mockResolvedValue({ data: { available: true, models: ['default'], llm: { status: 'active', model: 'deepseek-chat' } } }),
  },
}))

vi.mock('@/api/ai', () => ({
  aiApi: { chat: vi.fn() },
}))

vi.mock('@/api/client', () => ({
  default: { post: vi.fn().mockResolvedValue({ data: {} }), get: vi.fn().mockResolvedValue({ data: {} }) },
}))

// 静音日志（eventBus / hooks 大量 logger 输出）
vi.mock('@/utils/safeLogger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn().mockReturnValue({ accessToken: 'test-token' }),
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

/** 从 context 捕获 formulas（运行时状态级证据）+ 打开 FormulaPanel */
function PanelCaptureAndOpener({ captured }: { captured: { formulas: any[]; formulaCount: number } }) {
  const { formulas, formulaCount, setShowFormulaList } = useChatState()
  useEffect(() => {
    setShowFormulaList(true)
  }, [setShowFormulaList])
  // 用 Object.assign 而非逐属性赋值：既能同步捕获，也避免「渲染期修改属性」的 lint 规则
  Object.assign(captured, { formulas, formulaCount })
  return null
}

function renderChatWithPanel(captured: { formulas: any[]; formulaCount: number }) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ChatStateProvider>
        <PanelCaptureAndOpener captured={captured} />
        <ChatTab />
      </ChatStateProvider>
    </QueryClientProvider>,
  )
}

describe('FormulaPanel 自动捕获链路（React 运行时端到端，真实 e2e 响应）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    queryClient.clear()
  })

  it('发送真实结构化配方回复后，FormulaPanel 自动渲染出「灵芝枸杞桑椹抗衰方」与 4 味成分', async () => {
    // mock 流式：一次性 yield 真实 content，再 done（复刻后端 SSE 聚合后的最终内容）
    ;(chatService.sendMessageStream as Mock).mockImplementation(async function* () {
      yield { done: false, content: realContent }
      yield { done: true, content: '' }
    })

    const captured = { formulas: [] as any[], formulaCount: 0 }
    renderChatWithPanel(captured)

    // 输入并发送
    const input = screen.getByPlaceholderText(/描述/)
    const sendButton = screen.getByRole('button', { name: '发送' })
    await act(async () => {
      fireEvent.change(input, { target: { value: '给我一个抗衰老配方' } })
      fireEvent.click(sendButton)
    })

    // ── 断言 1（运行时状态级）：context.formulas 收到 1 个配方，含 4 成分与精确克重 ──
    await waitFor(
      () => {
        expect(captured.formulaCount).toBe(1)
      },
      { timeout: 30000 },
    )
    expect(captured.formulas).toHaveLength(1)
    const f = captured.formulas[0]
    expect(f.name).toBe('灵芝枸杞桑椹抗衰方')
    expect(f.ingredients).toHaveLength(4)
    const ingMap = new Map(f.ingredients.map((i: any) => [i.name, i]))
    expect(ingMap.get('灵芝')).toMatchObject({ name: '灵芝', dosage: '10', role: '君' })
    expect(ingMap.get('枸杞')).toMatchObject({ name: '枸杞', dosage: '10', role: '臣' })
    expect(ingMap.get('桑椹')).toMatchObject({ name: '桑椹', dosage: '10', role: '臣' })
    expect(ingMap.get('大枣')).toMatchObject({ name: '大枣', dosage: '3', role: '佐' })

    // ── 断言 2（渲染级）：FormulaPanel 为 React.lazy 懒加载，需等待面板真正挂载。
    // 以 FormulaCard 独有的「核心成分:」标签作为「面板已加载且卡片已渲染」的标志。
    await waitFor(
      () => {
        expect(screen.getAllByText('核心成分:').length).toBeGreaterThanOrEqual(1)
      },
      { timeout: 30000 },
    )

    // ── 断言 3（渲染级，限定在 FormulaCard「核心成分」区域内）：4 味成分 pill 全部渲染 ──
    const coreLabel = screen.getByText('核心成分:')
    const ingredientsWrap = coreLabel.parentElement as HTMLElement
    const cardScope = within(ingredientsWrap)
    expect(cardScope.getAllByText('灵芝').length).toBeGreaterThan(0)
    expect(cardScope.getAllByText('枸杞').length).toBeGreaterThan(0)
    expect(cardScope.getAllByText('桑椹').length).toBeGreaterThan(0)
    expect(cardScope.getAllByText('大枣').length).toBeGreaterThan(0)

    // ── 断言 4（渲染级）：配方名在面板中渲染（FormulaCard h3 displayName）──
    expect(screen.getAllByText('灵芝枸杞桑椹抗衰方').length).toBeGreaterThan(0)

    // ── 断言 5（渲染级）：卡片 footer 显示「4种成分」──
    expect(screen.getAllByText(/4种成分/).length).toBeGreaterThan(0)

    // ── 断言 6：面板头部计数徽章显示 1/1（非空面板，证明非「暂未识别到任何配方」空态）──
    expect(screen.getByText('1/1')).toBeInTheDocument()
  })

  it('对照：不发送任何消息时，面板处于空态（无「核心成分」区域）', async () => {
    const captured = { formulas: [] as any[], formulaCount: 0 }
    renderChatWithPanel(captured)

    // 面板已打开但无配方：不应出现核心成分区域
    await waitFor(() => {
      expect(screen.queryByText('核心成分:')).not.toBeInTheDocument()
    })
    expect(captured.formulaCount).toBe(0)
  })
})
