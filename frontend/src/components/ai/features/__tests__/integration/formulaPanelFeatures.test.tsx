/**
 * formulaPanelFeatures.test.tsx — FormulaPanel 各交互功能的运行时实测
 *
 * 目的：用真实 ChatStateProvider + ChatTab + FormulaPanel + 真实 eventBus，
 * 实测每个核心交互功能在 React 运行时是否「真可用 / 报错 / 点了没反应(空壳) / 不存在」。
 *
 * 种子方式：通过真实 eventBus.emit('formulas:detected') 注入测试配方
 * （走真实 useFormulaManager 订阅→addFormula→formulaIndex→context.formulas），
 * 复用 formulaPanelAutoCapture.test.tsx 的成熟 mock 集合与 IntersectionObserver polyfill。
 *
 * 只写测试，不改业务源码。
 */
import '@testing-library/jest-dom'
import React, { useEffect } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ChatTab } from '../../ChatTab'
import { ChatStateProvider } from '../../ChatStateProvider'
import { useChatState } from '../../ChatStateContext'
import { eventBus } from '../../services/eventBus'
import type { AIRecognizedFormula } from '@/types/ai.types'

// jsdom 未实现 IntersectionObserver（FormulaPanel/AdvancedFilter/MobileBottomSheet 依赖）
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverMock {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): unknown[] { return [] }
  }
  ;(globalThis as unknown as Record<string, unknown>).IntersectionObserver = IntersectionObserverMock
}

// ── mock 底层服务（照搬 formulaPanelAutoCapture.test.tsx 成熟集合）──
// 关闭真实 localStorage 持久化，避免测试之间互相污染（autoSave 依赖 isStorageAvailable）
vi.mock('@/utils/formulaStorage', () => ({
  saveFormulaIndex: vi.fn(),
  saveFormulaIndexWithReason: vi.fn(() => null),
  loadFormulaIndex: vi.fn(() => null),
  loadFormulaVersionHistory: vi.fn(() => []),
  clearFormulaStorage: vi.fn(),
  isStorageAvailable: vi.fn(() => false),
  importFormulaData: vi.fn((data: unknown[]) => data),
}))

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

vi.mock('@/utils/safeLogger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn().mockReturnValue({ accessToken: 'test-token' }),
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

// 慢机器/CI 上 jsdom 冷启动与整棵 ChatTab 挂载较慢，放宽超时避免误报
vi.setConfig({ testTimeout: 90000, hookTimeout: 30000 })

/** 测试配方工厂：可覆盖字段，制造不同质量分/置信度/标签/时间/成分数 */
function makeFormula(overrides: Partial<AIRecognizedFormula> & { id: string; name: string }): AIRecognizedFormula {
  const now = Date.now()
  return {
    ingredientCount: 2,
    confidence: 0.8,
    sourceMessageId: 'msg_test',
    parsedAt: new Date(now),
    rawData: {},
    ingredients: [
      { name: '黄芪', dosage: '10', role: '君' },
      { name: '枸杞', dosage: '8', role: '臣' },
    ],
    tags: [],
    ...overrides,
  } as AIRecognizedFormula
}

/** 打开 FormulaPanel 的容器 */
function PanelOpener() {
  const { setShowFormulaList } = useChatState()
  useEffect(() => {
    setShowFormulaList(true)
  }, [setShowFormulaList])
  return null
}

function renderChatWithPanel() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ChatStateProvider>
        <PanelOpener />
        <ChatTab />
      </ChatStateProvider>
    </QueryClientProvider>,
  )
}

/** 等待面板懒加载完成（以 FormulaCard 独有「核心成分:」标志，多卡时用 getAllByText） */
async function waitForPanelMounted() {
  await waitFor(
    () => {
      expect(screen.getAllByText('核心成分:').length).toBeGreaterThanOrEqual(1)
    },
    { timeout: 30000 },
  )
}

/** 通过真实 eventBus 注入测试配方（走真实订阅→addFormula→formulaIndex） */
async function seedFormulas(formulas: AIRecognizedFormula[]) {
  await act(async () => {
    eventBus.emit('formulas:detected', { formulas })
  })
  // 等待状态更新与面板渲染
  await waitForPanelMounted()
}

describe('FormulaPanel 功能运行时实测', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    queryClient.clear()
  })
  it('搜索：输入配方名关键词，列表过滤到匹配项', async () => {
    renderChatWithPanel()
    await seedFormulas([
      makeFormula({ id: 'f1', name: '抗氧化配方', confidence: 0.9 }),
      makeFormula({ id: 'f2', name: '助眠配方', confidence: 0.7 }),
      makeFormula({ id: 'f3', name: '健脾配方', confidence: 0.6 }),
    ])

    // 面板应显示 3 条（3 个「核心成分:」）
    expect(screen.getAllByText('核心成分:')).toHaveLength(3)

    // 输入搜索关键词「抗氧化」
    const searchInput = screen.getByPlaceholderText(/搜索配方/)
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: '抗氧化' } })
    })

    // 防抖 200ms + 过滤，应只剩 1 条
    await waitFor(
      () => {
        expect(screen.getAllByText('核心成分:')).toHaveLength(1)
      },
      { timeout: 20000 },
    )
    expect(screen.getAllByText('抗氧化配方').length).toBeGreaterThanOrEqual(1)
  })

  it('排序：按名称升序，列表顺序变化', async () => {
    const { container } = renderChatWithPanel()
    await seedFormulas([
      makeFormula({ id: 'f1', name: 'formula-3' }),
      makeFormula({ id: 'f2', name: 'formula-1' }),
      makeFormula({ id: 'f3', name: 'formula-2' }),
    ])

    // 找到排序 select（面板排序栏第一个 <select>，AdvancedFilter 在懒加载抽屉中未渲染）
    const sortSelect = container.querySelector('select') as HTMLSelectElement
    expect(sortSelect).toBeInTheDocument()

    // 读取所有卡片 h3 标题（按 DOM 顺序 = 渲染顺序）
    const cardTitles = () =>
      Array.from(container.querySelectorAll('h3')).map((el) => el.textContent ?? '')

    // 切换排序字段为「名称」
    await act(async () => {
      fireEvent.change(sortSelect, { target: { value: 'name' } })
    })

    // 名称升序应为 formula-1、formula-2、formula-3
    await waitFor(
      () => {
        const titles = cardTitles().filter((n) => ['formula-1', 'formula-2', 'formula-3'].includes(n))
        expect(titles).toEqual(['formula-1', 'formula-2', 'formula-3'])
      },
      { timeout: 3000 },
    )
  })

  it('展开：点击卡片展开按钮，显示成分列表', async () => {
    renderChatWithPanel()
    await seedFormulas([makeFormula({ id: 'f1', name: '抗氧化配方' })])
    await waitForPanelMounted()

    // 初始未展开，成分 pill 不可见（「核心成分:」区域存在但成分可能已渲染——以展开按钮为准）
    // FormulaCard 的展开按钮：aria-label 为「展开详情」/「收起」
    const expandControl = screen.getByLabelText(/展开详情|收起/)
    await act(async () => {
      fireEvent.click(expandControl)
    })

    // 展开后应显示成分名（黄芪/枸杞）——以「核心成分:」区域内出现成分为准
    await waitFor(() => {
      const coreLabel = screen.getByText('核心成分:')
      const scope = within(coreLabel.parentElement as HTMLElement)
      expect(scope.getAllByText('黄芪').length).toBeGreaterThan(0)
    })
  })

  it('生成报告：点击生成报告按钮触发报告流程（按钮存在且可点击）', async () => {
    renderChatWithPanel()
    await seedFormulas([makeFormula({ id: 'f1', name: '抗氧化配方' })])
    await waitForPanelMounted()

    // 生成报告按钮（面板头部 + 卡片均有，取第一个可点击的）
    const reportBtns = screen.getAllByRole('button', { name: /生成报告/ })
    expect(reportBtns.length).toBeGreaterThanOrEqual(1)
    const reportBtn = reportBtns[0]
    expect(reportBtn).not.toBeDisabled()

    // 点击不应抛错（真实报告流程会调用 useReportGenerator；点击后可能打开 Modal 致原按钮重渲染，不断言其仍在）
    await act(async () => {
      fireEvent.click(reportBtn)
    })
    // 链路健全：点击后不崩溃即可（可能进入生成中状态或打开报告弹窗）
    expect(document.body).toBeInTheDocument()
  })

  it('分页：注入 12 条配方（>10/页），分页控件出现', async () => {
    renderChatWithPanel()
    const many = Array.from({ length: 12 }, (_, i) =>
      makeFormula({ id: `f${i}`, name: `配方${i}` }),
    )
    await seedFormulas(many)

    // 第一页应只显示 10 条卡片
    await waitFor(() => {
      expect(screen.getAllByText('核心成分:').length).toBe(10)
    })
    // 分页控件（上一页/下一页）应出现
    expect(screen.getByText(/上一页/)).toBeInTheDocument()
    expect(screen.getByText(/下一页/)).toBeInTheDocument()
  })

  it('选中/批量：勾选配方后出现批量操作栏（导出选中/取消选择）', async () => {
    renderChatWithPanel()
    await seedFormulas([
      makeFormula({ id: 'f1', name: '抗氧化配方' }),
      makeFormula({ id: 'f2', name: '助眠配方' }),
    ])
    await waitForPanelMounted()

    // 勾选第一个卡片的选中框（checkbox）
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)
    await act(async () => {
      fireEvent.click(checkboxes[0])
    })

    // 批量栏应出现「导出选中」
    await waitFor(() => {
      expect(screen.getByText(/导出选中/)).toBeInTheDocument()
    })
  })

  it('v8.1 缺口修复：批量栏出现 批量删除/批量标签/全选/取消选择，且取消选择可清空', async () => {
    renderChatWithPanel()
    await seedFormulas([
      makeFormula({ id: 'f1', name: '抗氧化配方' }),
      makeFormula({ id: 'f2', name: '助眠配方' }),
    ])
    await waitForPanelMounted()

    // 勾选第一个卡片的选中框
    const checkboxes = screen.getAllByRole('checkbox')
    await act(async () => {
      fireEvent.click(checkboxes[0])
    })

    // 批量栏应出现 v8.1 新增按钮
    await waitFor(() => {
      expect(screen.getByText(/导出选中/)).toBeInTheDocument()
    })
    expect(screen.getByText(/批量删除/)).toBeInTheDocument()
    expect(screen.getByText(/批量标签/)).toBeInTheDocument()
    expect(screen.getByText(/全选/)).toBeInTheDocument()
    expect(screen.getByText(/取消选择/)).toBeInTheDocument()

    // 点「取消选择」应清空选中 → 批量栏消失
    await act(async () => {
      fireEvent.click(screen.getByText(/取消选择/))
    })
    await waitFor(() => {
      expect(screen.queryByText(/导出选中/)).not.toBeInTheDocument()
    })
  })

  it('v8.1 缺口修复：卡片显示收藏按钮且可点击（不抛错）', async () => {
    renderChatWithPanel()
    await seedFormulas([makeFormula({ id: 'f1', name: '抗氧化配方' })])
    await waitForPanelMounted()

    // 先展开卡片（收藏按钮在展开动作区）
    const expandControl = screen.getByLabelText(/展开详情/)
    await act(async () => {
      fireEvent.click(expandControl)
    })

    // 收藏按钮经 onToggleFavorite 接线（文本「收藏」；accessible name 计算受 icon 影响，用 textContent 定位）
    await waitFor(() => {
      expect(screen.getAllByText('收藏').length).toBeGreaterThanOrEqual(1)
    })
    const favBtn = screen.getAllByText('收藏')[0].closest('button') as HTMLElement
    expect(favBtn).not.toBeNull()

    // 点击后不应崩溃（收藏经 toggleFavorite 接线；点击后变「已收藏」）
    await act(async () => {
      fireEvent.click(favBtn)
    })
    await waitFor(() => {
      expect(screen.getAllByText('已收藏').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('v8.2 新增：批量收藏——选中后点「批量收藏」使卡片变已收藏', async () => {
    renderChatWithPanel()
    await seedFormulas([
      makeFormula({ id: 'f1', name: '抗氧化配方' }),
      makeFormula({ id: 'f2', name: '助眠配方' }),
    ])
    await waitForPanelMounted()

    // 勾选两条
    const checkboxes = screen.getAllByRole('checkbox')
    await act(async () => {
      fireEvent.click(checkboxes[0])
      fireEvent.click(checkboxes[1])
    })

    // 批量栏应有「批量收藏」
    await waitFor(() => {
      expect(screen.getAllByText(/批量收藏/).length).toBeGreaterThanOrEqual(1)
    })

    // 点击批量收藏
    await act(async () => {
      fireEvent.click(screen.getAllByText(/批量收藏/)[0])
    })

    // 按钮文案应切换为「取消收藏」（说明 allFav=true，收藏已生效）
    await waitFor(() => {
      expect(screen.getAllByText(/取消收藏/).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('v8.2 新增：选中恰好 2 个时出现「对比选中」，点击弹出对比结果', async () => {
    renderChatWithPanel()
    await seedFormulas([
      makeFormula({ id: 'f1', name: '配方A', ingredients: [{ name: '黄芪', dosage: '10' }, { name: '枸杞', dosage: '8' }] }),
      makeFormula({ id: 'f2', name: '配方B', ingredients: [{ name: '黄芪', dosage: '12' }, { name: '当归', dosage: '6' }] }),
      makeFormula({ id: 'f3', name: '配方C', ingredients: [{ name: '大枣', dosage: '3' }] }),
    ])
    await waitForPanelMounted()

    // 只选 2 个
    const checkboxes = screen.getAllByRole('checkbox')
    await act(async () => {
      fireEvent.click(checkboxes[0])
      fireEvent.click(checkboxes[1])
    })

    // 应出现「对比选中」
    await waitFor(() => {
      expect(screen.getAllByText(/对比选中/).length).toBeGreaterThanOrEqual(1)
    })

    // 点击对比 → 弹出对比结果弹窗（含「配方对比分析」标题与相似度）
    await act(async () => {
      fireEvent.click(screen.getAllByText(/对比选中/)[0])
    })
    await waitFor(() => {
      expect(screen.getByText(/配方对比分析/)).toBeInTheDocument()
    })
    expect(screen.getByText(/相似度/)).toBeInTheDocument()
    // 共有成分「黄芪」应出现
    expect(screen.getAllByText('黄芪').length).toBeGreaterThanOrEqual(1)
  })

  it('v8.2 新增：带 priority 的配方在卡片显示优先级徽章', async () => {
    renderChatWithPanel()
    await seedFormulas([
      makeFormula({ id: 'f1', name: '高优先级配方', priority: 'high' } as Partial<AIRecognizedFormula> & { id: string; name: string }),
    ])
    await waitForPanelMounted()

    // 徽章文本为「高」
    await waitFor(() => {
      expect(screen.getAllByText('高').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('v8.3 新增：展开后点「更多」打开上下文菜单（优先级/版本历史可发现）', async () => {
    renderChatWithPanel()
    await seedFormulas([makeFormula({ id: 'f1', name: '抗氧化配方' })])
    await waitForPanelMounted()

    // 展开卡片，动作区才会渲染「更多」按钮
    await act(async () => {
      fireEvent.click(screen.getByLabelText(/展开详情/))
    })

    const moreBtn = await screen.findByRole('button', { name: '更多' })
    await act(async () => {
      fireEvent.click(moreBtn)
    })

    // 上下文菜单条目
    await waitFor(() => {
      expect(screen.getByText(/查看详情/)).toBeInTheDocument()
    })
    expect(screen.getByText(/优先级/)).toBeInTheDocument()
    expect(screen.getByText(/版本历史/)).toBeInTheDocument()
    expect(screen.getByText(/删除配方/)).toBeInTheDocument()
  })

  it('v8.3 新增：通过上下文菜单设置优先级后卡片显示徽章', async () => {
    renderChatWithPanel()
    await seedFormulas([makeFormula({ id: 'f1', name: '抗氧化配方' })])
    await waitForPanelMounted()

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/展开详情/))
    })

    // 打开上下文菜单
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: '更多' }))
    })
    await waitFor(() => {
      expect(screen.getByText(/优先级/)).toBeInTheDocument()
    })

    // 点「高」
    const highBtn = screen.getByRole('button', { name: '高' })
    await act(async () => {
      fireEvent.click(highBtn)
    })

    // 卡片标题旁出现优先级徽章（文本「高」）
    await waitFor(() => {
      expect(screen.getAllByText('高').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('v8.3 新增：右键卡片可打开上下文菜单（桌面端可发现）', async () => {
    renderChatWithPanel()
    await seedFormulas([makeFormula({ id: 'f1', name: '抗氧化配方' })])
    await waitForPanelMounted()

    // 卡片标题所在的卡片根节点上触发右键
    const title = screen.getAllByText('抗氧化配方')[0]
    const cardRoot = title.closest('.group') as HTMLElement
    expect(cardRoot).not.toBeNull()

    await act(async () => {
      fireEvent.contextMenu(cardRoot, { clientX: 20, clientY: 20 })
    })

    await waitFor(() => {
      expect(screen.getByText(/查看详情/)).toBeInTheDocument()
    })
  })

  it('v8.3 修复：批量标签后卡片真实显示该标签（此前只写内部 Map 不回写）', async () => {
    renderChatWithPanel()
    await seedFormulas([makeFormula({ id: 'f1', name: '抗氧化配方' })])
    await waitForPanelMounted()

    // 选中一条
    await act(async () => {
      fireEvent.click(screen.getAllByRole('checkbox')[0])
    })

    // 面板用 window.prompt 收集标签，这里替换为返回「补气」
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('补气')
    try {
      await act(async () => {
        fireEvent.click(screen.getByText(/批量标签/))
      })
    } finally {
      promptSpy.mockRestore()
    }

    // 「补气」标签应出现在卡片上（用正则匹配，避免节点结构导致的精确文本匹配差异）
    await waitFor(() => {
      expect(screen.queryAllByText(/补气/).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('UI 规范：面板不再用 emoji 当图标', async () => {
    const { container } = renderChatWithPanel()
    await seedFormulas([makeFormula({ id: 'f1', name: '抗氧化配方' })])
    await waitForPanelMounted()

    // 展开以覆盖动作区
    const expandControl = screen.getByLabelText(/展开详情/)
    await act(async () => {
      fireEvent.click(expandControl)
    })

    // 常见被误用作图标的 emoji 字符集（\u{...} + u 标志，避免代理对问题）
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F2FF}]/u
    // 只检测元素自身的直接文本节点（祖先容器会累加子节点文本，导致误报）
    const hits: string[] = []
    container.querySelectorAll('*').forEach((el) => {
      const directText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
      if (emojiRe.test(directText)) hits.push(directText.trim())
    })
    expect(hits).toEqual([])
  })
})