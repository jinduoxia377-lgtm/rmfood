/**
 * FollowUpSuggestionsBar 双轨竞速 / 三态降级测试
 *
 * 覆盖「可以继续追问」功能线的竞速与降级路径（此前无自动化覆盖）：
 * - 本地兜底先显：AI 回复完成即渲染 3 条本地建议（不等后端）
 * - LLM 成功替换：后端 source==='llm' 时本地池被替换
 * - fallback 降级：source==='fallback' 时保留本地池 + 轻量降级徽标
 * - unavailable 降级：网络失败/超时（API 返回 unavailable）静默保留本地池，不崩、无错误 toast
 * - 竞态防护：dynamicRequestSeqRef 序号——只采纳最后一次请求，过期响应不覆盖
 * - 加载守卫：isLoading 或 content 为空时不出栏（防 answer="" 触发 422）
 * - 防卸载：组件卸载后不 setState（isMountedRef）
 *
 * 约定：跟随本目录既有测试（ChatHistory.test.tsx）——vitest + jsdom + @testing-library/react
 * + 真实 i18n（I18nextProvider，setup.ts 已初始化 zh-CN），文案用真实译文断言。
 * 业务源码零改动；后端轨 fetchDynamicFollowUpSuggestions 与本地轨引擎均注入受控 mock。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import type { Mock } from 'vitest'
import FollowUpSuggestionsBar from '../FollowUpSuggestionsBar'
import { fetchDynamicFollowUpSuggestions } from '@/components/ai/features/services/followUpSuggestionApi'
import { followUpSuggestionEngine } from '@/components/ai/features/services/followUpSuggestionService'
import type { FollowUpSuggestion } from '@/components/ai/features/services/followUpSuggestionService'
import type { DynamicFollowUpResult } from '@/components/ai/features/services/followUpSuggestionApi'

// ── 受控 mock：后端轨 API ────────────────────────────────────────────────
vi.mock('@/components/ai/features/services/followUpSuggestionApi', () => ({
  fetchDynamicFollowUpSuggestions: vi.fn(),
}))

// ── 受控 mock：本地规则引擎（单例）────────────────────────────────────────
vi.mock('@/components/ai/features/services/followUpSuggestionService', () => ({
  followUpSuggestionEngine: {
    updateContext: vi.fn(),
    generateSuggestions: vi.fn(),
    reset: vi.fn(),
  },
}))

// ── 受控 mock：用户画像 / 结构化解析（避免副作用与重依赖）───────────────────
vi.mock('@/components/ai/features/services/userPreferencesService', () => ({
  userPreferencesService: {
    getUserProfile: vi.fn(() => null),
    generatePromptSummary: vi.fn(() => ''),
  },
}))
vi.mock('@/components/ai/features/components/structured/utils', () => ({
  detectStructuredContent: vi.fn(() => null),
}))
vi.mock('@/components/ai/features/services/formulaExtractorService', () => ({
  extractFormulaFromContent: vi.fn(() => null),
}))

// ── 测试数据 ────────────────────────────────────────────────────────────
/** 本地兜底 3 条（question 文本互不相同，便于按文本断言替换/保留） */
function makeLocalSuggestions(): FollowUpSuggestion[] {
  return [
    { id: 'local-1', question: '本地兜底问题一', category: '配方设计', categoryKey: 'formulaDesign', confidence: 0.9, source: 'local' },
    { id: 'local-2', question: '本地兜底问题二', category: '安全合规', categoryKey: 'safetyCompliance', confidence: 0.8, source: 'local' },
    { id: 'local-3', question: '本地兜底问题三', category: '体质辨识', categoryKey: 'constitution', confidence: 0.7, source: 'local' },
  ]
}

/** LLM 动态 3 条 */
function makeLlmSuggestions(prefix = 'LLM动态问题'): FollowUpSuggestion[] {
  return [
    { id: 'dynamic-1', question: `${prefix}一`, category: '药材知识', categoryKey: 'herbKnowledge', confidence: 1, source: 'llm' },
    { id: 'dynamic-2', question: `${prefix}二`, category: '配伍知识', categoryKey: 'compatibilityKnowledge', confidence: 1, source: 'llm' },
    { id: 'dynamic-3', question: `${prefix}三`, category: '安全合规', categoryKey: 'safetyCompliance', confidence: 1, source: 'llm' },
  ]
}

const USER_MSG = { id: 'u1', role: 'user', content: '帮我设计一个助眠配方' }
const DONE_ANSWER = '黄芪 10g、枸杞 5g 助眠方。'

type BarMessage = Parameters<typeof FollowUpSuggestionsBar>[0]['messages'][number]

/** 构造一条「回复完成」的 assistant 消息（isLoading=false、content 非空） */
function doneAssistant(id = 'a1', content = DONE_ANSWER): BarMessage {
  return { id, role: 'assistant', content, isLoading: false }
}

interface RenderOpts {
  messages?: BarMessage[]
  isVisible?: boolean
}

function renderBar(opts: RenderOpts = {}) {
  const messages = opts.messages ?? [USER_MSG, doneAssistant()]
  const isVisible = opts.isVisible ?? true
  const props = {
    onSendSuggestion: vi.fn(),
    messages,
    isVisible,
    ragChunks: undefined,
  }
  const view = render(
    <I18nextProvider i18n={i18n}>
      <FollowUpSuggestionsBar {...props} />
    </I18nextProvider>,
  )
  return view
}

/** 可手动 resolve/reject 的 deferred（驱动异步后端轨） */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(followUpSuggestionEngine.generateSuggestions).mockReturnValue(makeLocalSuggestions())
  // 默认后端轨挂起（永不 resolve）——用于「本地先显」与守卫类用例，隔离后端轨影响
  vi.mocked(fetchDynamicFollowUpSuggestions).mockImplementation(() => new Promise(() => {}))
})

afterEach(async () => {
  await i18n.changeLanguage('zh-CN')
})

// ── 1. 本地兜底先显 ─────────────────────────────────────────────────────
describe('1. 本地兜底先显', () => {
  it('AI 回复完成后立即渲染 3 条本地建议（不等后端 LLM）', async () => {
    renderBar()
    // 本地轨同步生成并显示，无需等待后端
    expect(await screen.findByText('可以继续追问')).toBeInTheDocument()
    expect(screen.getByText('本地兜底问题一')).toBeInTheDocument()
    expect(screen.getByText('本地兜底问题二')).toBeInTheDocument()
    expect(screen.getByText('本地兜底问题三')).toBeInTheDocument()
    // 恰好 3 条追问选项
    expect(screen.getAllByRole('button').filter(b => b.textContent?.includes('本地兜底问题')).length).toBe(3)
    // generateSuggestions 以 3 调用（maxCount=3）
    expect(followUpSuggestionEngine.generateSuggestions).toHaveBeenCalledWith(3)
  })

  it('后端轨挂起时不替换本地池（本地兜底持续可见）', async () => {
    renderBar()
    expect(await screen.findByText('本地兜底问题一')).toBeInTheDocument()
    // 后端从未返回，本地池保持
    await waitFor(() => {
      expect(screen.getByText('本地兜底问题一')).toBeInTheDocument()
      expect(screen.getByText('本地兜底问题二')).toBeInTheDocument()
    })
  })
})

// ── 2. LLM 成功替换 ─────────────────────────────────────────────────────
describe('2. LLM 成功替换', () => {
  it('后端返回 source=llm 时，本地 3 条被 LLM 结果替换', async () => {
    vi.mocked(fetchDynamicFollowUpSuggestions as Mock).mockResolvedValue({
      source: 'llm',
      suggestions: makeLlmSuggestions(),
    } satisfies DynamicFollowUpResult)

    renderBar()

    // 先本地显示，随后被 LLM 替换
    expect(await screen.findByText('LLM动态问题一')).toBeInTheDocument()
    expect(screen.getByText('LLM动态问题二')).toBeInTheDocument()
    expect(screen.getByText('LLM动态问题三')).toBeInTheDocument()
    // 本地池已被替换（不再出现）
    expect(screen.queryByText('本地兜底问题一')).not.toBeInTheDocument()
    // LLM 成功不显示降级徽标
    expect(screen.queryByText(i18n.t('ai.chat.quick.followUpFallback'))).not.toBeInTheDocument()
  })
})

// ── 3. fallback 降级 ────────────────────────────────────────────────────
describe('3. fallback 降级', () => {
  it('后端返回 source=fallback 时，保留本地池 + 显示轻量降级徽标', async () => {
    // 后端虽返回固定兜底问题，但组件不应采用（本地池质量更优）
    vi.mocked(fetchDynamicFollowUpSuggestions as Mock).mockResolvedValue({
      source: 'fallback',
      suggestions: makeLlmSuggestions('后端固定池问题'),
    } satisfies DynamicFollowUpResult)

    renderBar()

    // 本地池保留（未被后端固定池替换）
    expect(await screen.findByText('本地兜底问题一')).toBeInTheDocument()
    expect(screen.getByText('本地兜底问题二')).toBeInTheDocument()
    expect(screen.getByText('本地兜底问题三')).toBeInTheDocument()
    // 后端固定池问题未渲染
    expect(screen.queryByText('后端固定池问题一')).not.toBeInTheDocument()
    // 显示轻量降级徽标（标题 + tooltip）
    expect(screen.getByText(i18n.t('ai.chat.quick.followUpFallback'))).toBeInTheDocument()
    const badge = screen.getByText(i18n.t('ai.chat.quick.followUpFallback')).closest('span')
    expect(badge).toHaveAttribute('title', i18n.t('ai.chat.quick.followUpFallbackTip'))
  })
})

// ── 4. unavailable 降级 ─────────────────────────────────────────────────
describe('4. unavailable 降级（网络/超时，静默保留本地池）', () => {
  it('后端返回 source=unavailable 时静默保留本地池，不显示降级徽标、不崩溃', async () => {
    vi.mocked(fetchDynamicFollowUpSuggestions as Mock).mockResolvedValue({
      source: 'unavailable',
      suggestions: null,
    } satisfies DynamicFollowUpResult)

    renderBar()

    // 本地池保留
    expect(await screen.findByText('本地兜底问题一')).toBeInTheDocument()
    expect(screen.getByText('本地兜底问题二')).toBeInTheDocument()
    // 静默：不显示 fallback 徽标
    expect(screen.queryByText(i18n.t('ai.chat.quick.followUpFallback'))).not.toBeInTheDocument()
  })

  it('后端轨 reject（网络异常）时不崩、保留本地池、无错误 toast', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(fetchDynamicFollowUpSuggestions as Mock).mockRejectedValue(new Error('network down'))

    renderBar()

    // 本地池保留，组件未崩溃
    expect(await screen.findByText('本地兜底问题一')).toBeInTheDocument()
    expect(screen.getByText('本地兜底问题二')).toBeInTheDocument()
    expect(screen.queryByText(i18n.t('ai.chat.quick.followUpFallback'))).not.toBeInTheDocument()
    // 无错误 toast / console.error（catch 分支静默）
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('AbortController 超时（API 层映射为 unavailable）→ 静默保留本地池', async () => {
    // 真实 API 在 35s 超时后返回 {source:'unavailable'}；此处以等价的 unavailable 结果
    // 驱动组件，验证超时降级路径在 UI 层的表现（API 内部超时逻辑另见 followUpSuggestionApi 测试）
    vi.mocked(fetchDynamicFollowUpSuggestions as Mock).mockResolvedValue({
      source: 'unavailable',
      suggestions: null,
    } satisfies DynamicFollowUpResult)

    renderBar()

    expect(await screen.findByText('本地兜底问题一')).toBeInTheDocument()
    expect(screen.queryByText(i18n.t('ai.chat.quick.followUpFallback'))).not.toBeInTheDocument()
  })
})

// ── 5. 竞态防护 ─────────────────────────────────────────────────────────
describe('5. 竞态防护（dynamicRequestSeqRef 只采纳最后一次）', () => {
  it('过期响应（第一次请求）不覆盖最新结果，仅采纳最后一次', async () => {
    const stale = deferred<DynamicFollowUpResult>()
    const latest = deferred<DynamicFollowUpResult>()
    ;(fetchDynamicFollowUpSuggestions as Mock)
      .mockReturnValueOnce(stale.promise)   // 第一次请求（seq=1）
      .mockReturnValueOnce(latest.promise)  // 第二次请求（seq=2）

    const view = renderBar({ messages: [USER_MSG, doneAssistant('a1', '回答甲，内容长度甲')] })

    // 本地先显
    expect(await screen.findByText('本地兜底问题一')).toBeInTheDocument()

    // 追问一次 → 触发第二次请求（新 assistant 消息，processKey 变化）
    view.rerender(
      <I18nextProvider i18n={i18n}>
        <FollowUpSuggestionsBar
          onSendSuggestion={vi.fn()}
          messages={[USER_MSG, doneAssistant('a2', '回答乙，内容长度乙更长')]}
          isVisible={true}
        />
      </I18nextProvider>,
    )

    expect(fetchDynamicFollowUpSuggestions).toHaveBeenCalledTimes(2)

    // 过期响应（seq=1）先回来（带 LLM 结果）：因序号已过期，不应覆盖
    stale.resolve({ source: 'llm', suggestions: makeLlmSuggestions('过期响应') })
    await waitFor(() => {
      expect(screen.queryByText('过期响应一')).not.toBeInTheDocument()
    })
    // 本地池仍在（过期响应被丢弃，未替换）
    expect(screen.getByText('本地兜底问题一')).toBeInTheDocument()

    // 最新响应（seq=2）回来：正常替换
    latest.resolve({ source: 'llm', suggestions: makeLlmSuggestions('最新响应') })
    expect(await screen.findByText('最新响应一')).toBeInTheDocument()
    expect(screen.getByText('最新响应二')).toBeInTheDocument()
    expect(screen.queryByText('本地兜底问题一')).not.toBeInTheDocument()
    expect(screen.queryByText('过期响应一')).not.toBeInTheDocument()
  })
})

// ── 6. 加载守卫 ─────────────────────────────────────────────────────────
describe('6. 加载守卫（isLoading / content 空时不出栏）', () => {
  it('isLoading=true（AI 仍在生成）时不出栏', () => {
    const { container } = renderBar({
      messages: [USER_MSG, { id: 'a1', role: 'assistant', content: DONE_ANSWER, isLoading: true }],
    })
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('可以继续追问')).not.toBeInTheDocument()
    // 不触发后端动态追问（防 answer="" 触发 422 的守卫前置）
    expect(fetchDynamicFollowUpSuggestions).not.toHaveBeenCalled()
  })

  it('content 为空（answer=""）时不出栏、不请求后端', () => {
    const { container } = renderBar({
      messages: [USER_MSG, { id: 'a1', role: 'assistant', content: '', isLoading: false }],
    })
    expect(container).toBeEmptyDOMElement()
    expect(fetchDynamicFollowUpSuggestions).not.toHaveBeenCalled()
  })

  it('content 仅空白字符时不出栏（trim 后为空）', () => {
    const { container } = renderBar({
      messages: [USER_MSG, doneAssistant('a1', '   ')],
    })
    expect(container).toBeEmptyDOMElement()
    expect(fetchDynamicFollowUpSuggestions).not.toHaveBeenCalled()
  })

  it('isVisible=false 时不出栏', () => {
    const { container } = renderBar({ isVisible: false })
    expect(container).toBeEmptyDOMElement()
  })

  it('无 assistant 消息时不出栏', () => {
    const { container } = renderBar({ messages: [USER_MSG] })
    expect(container).toBeEmptyDOMElement()
  })
})

// ── 7. 防卸载 ───────────────────────────────────────────────────────────
describe('7. 防卸载（卸载后不 setState）', () => {
  it('组件卸载后后端响应到达，不触发 setState、不崩溃', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const pending = deferred<DynamicFollowUpResult>()
    vi.mocked(fetchDynamicFollowUpSuggestions as Mock).mockReturnValue(pending.promise)

    const view = renderBar()

    // 本地先显后卸载（后端仍挂起）
    expect(await screen.findByText('本地兜底问题一')).toBeInTheDocument()
    view.unmount()

    // 卸载后后端才返回 LLM 结果——isMountedRef 守卫应阻止 setState
    pending.resolve({ source: 'llm', suggestions: makeLlmSuggestions('卸载后响应') })
    await Promise.resolve()
    await Promise.resolve()

    // 无 React「setState on unmounted / not wrapped in act」错误
    const errTexts = consoleError.mock.calls.map(c => String(c[0])).join('\n')
    expect(errTexts).not.toMatch(/setState|unmounted|not wrapped in act/i)
    consoleError.mockRestore()
  })
})
