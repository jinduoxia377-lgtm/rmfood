/**
 * ChatTab 二期：结构化输出兜底（修复按钮触发）+ 反馈闭环（FeedbackModal 提交/历史）
 *
 * 覆盖：
 * 1. handleStructureRepair 触发：点击「修复为结构化配方」→ 调用 repairStructuredFormula
 *    → 成功后转成结构化 JSON 复用 handleStructureSave（最终 createFormula 被调用）
 * 2. 修复失败（后端返回 success=false）→ 提示错误且不保存
 * 3. 修复接口异常 → 提示错误且不保存
 * 4. FeedbackModal：评分+症状+备注提交 → 调用 submitFormulaFeedback
 * 5. FeedbackModal：展示 getFormulaFeedback 历史
 */
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import * as React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChatTab } from '../../ChatTab'
import { ChatStateProvider } from '../../ChatStateProvider'
import { FeedbackModal } from '../../components/FeedbackModal'
import {
  validateAiFormula,
  repairStructuredFormula,
  submitFormulaFeedback,
  getFormulaFeedback,
} from '@/api/ai'
import { createFormula } from '@/api/formula'

// ===== Mock 外部依赖 =====
vi.mock('@/api/ai', () => ({
  validateAiFormula: vi.fn(),
  retrieveHerbKnowledge: vi.fn(),
  repairStructuredFormula: vi.fn(),
  submitFormulaFeedback: vi.fn(),
  getFormulaFeedback: vi.fn(),
  aiApi: {
    validateAiFormula: vi.fn(),
    retrieveHerbKnowledge: vi.fn(),
    repairStructuredFormula: vi.fn(),
    submitFormulaFeedback: vi.fn(),
    getFormulaFeedback: vi.fn(),
  },
}))

vi.mock('@/api/formula', () => ({
  createFormula: vi.fn(),
}))

vi.mock('@/components/ai/features/services/chatService', () => ({
  chatService: {
    sendMessage: vi.fn().mockResolvedValue({ content: '非流式回复', role: 'assistant', formulas: [], timestamp: 0 }),
    sendMessageStream: vi.fn(),
    clearAuthToken: vi.fn(),
    closeAllPendingRequests: vi.fn(),
    retryLastMessage: vi.fn(),
    getStateMachine: vi.fn(() => ({ addStateListener: () => () => {} })),
  },
}))

vi.mock('@/components/ai/features/services/eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
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
  },
}))

vi.mock('@/api/modelClient', () => ({
  ModelClient: {
    getModelStatus: vi.fn().mockResolvedValue({ data: { available: true, models: ['default'] } }),
  },
}))

vi.mock('@/api/client', () => ({
  default: { post: vi.fn().mockResolvedValue({ data: {} }), get: vi.fn().mockResolvedValue({ data: {} }) },
}))

vi.mock('@/utils/safeLogger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))

// components/pro 测试桩：暴露 onStructureSave / onStructureRepair 两个触发按钮
vi.mock('../../components/pro', () => {
  return {
    ChatMessages: (props: {
      onStructureSave?: (messageId: string, content: string) => void
      onStructureRepair?: (messageId: string, content: string) => void
    }) =>
      React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          {
            'data-testid': 'trigger-structure-save',
            onClick: () => props.onStructureSave?.('msg-1', ''),
          },
          '保存到配方库',
        ),
        React.createElement(
          'button',
          {
            'data-testid': 'trigger-structure-repair',
            onClick: () => props.onStructureRepair?.('msg-1', '黄芪15g、当归10g，水煎服，适合气血两虚人群'),
          },
          '修复为结构化配方',
        ),
      ),
    ChatInputPro: () => React.createElement('input', { placeholder: '描述您的配方需求...' }),
    ChatHistory: () => null,
    ChatProgressBar: () => null,
    TopBar: () => null,
    EmptyStateCard: () => null,
  }
})

vi.mock('../../components/pro/ComposerStatusBar', () => ({ default: () => null }))
vi.mock('../../components/pro/DetailsPanel', () => ({ default: () => null }))
vi.mock('../../components/pro/FollowUpSuggestionsBar', () => ({ default: () => null }))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderChatTab() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ChatStateProvider>
        <ChatTab />
      </ChatStateProvider>
    </QueryClientProvider>,
  )
}

/** 修复后返回的 blocks：含 header + data-table，供 formulaExtractorService 提取 */
function buildRepairedBlocks() {
  return [
    { type: 'header', data: { title: '补气养血方', description: '适合气血不足人群' } },
    {
      type: 'data-table',
      data: {
        columns: [
          { key: 'name', label: '成分' },
          { key: 'dosage', label: '用量' },
          { key: 'function', label: '功效' },
        ],
        rows: [
          { name: '黄芪', dosage: '15g', function: '补气升阳' },
          { name: '当归', dosage: '10g', function: '补血活血' },
        ],
      },
    },
    { type: 'callout', data: { variant: 'info', title: '预期功效', content: '改善气血不足' } },
  ]
}

describe('ChatTab 结构化输出兜底（修复按钮触发）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(validateAiFormula as Mock).mockResolvedValue({
      is_safe: true,
      blocked_by_critical: false,
      alerts: [],
    })
    ;(createFormula as Mock).mockResolvedValue({ id: 1, name: '补气养血方' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
  })

  it('点击修复按钮后调用 repairStructuredFormula，成功则转结构化内容并保存', async () => {
    ;(repairStructuredFormula as Mock).mockResolvedValue({
      success: true,
      structured: { blocks: buildRepairedBlocks() },
    })

    renderChatTab()
    fireEvent.click(screen.getByTestId('trigger-structure-repair'))

    // 调用修复接口，携带原始非结构化配方文本
    await waitFor(() => {
      expect(repairStructuredFormula).toHaveBeenCalledWith(
        '黄芪15g、当归10g，水煎服，适合气血两虚人群',
      )
    })

    // 修复成功 → 复用 handleStructureSave → 校验通过后弹出成分级校验报告
    await waitFor(() => {
      expect(screen.getByTestId('formula-validation-modal')).toBeInTheDocument()
    })

    // 用户在校验报告中确认保存后才真正落库
    fireEvent.click(screen.getByTestId('validation-confirm-save'))

    await waitFor(() => {
      expect(createFormula).toHaveBeenCalledTimes(1)
    })

    const payload = (createFormula as Mock).mock.calls[0][0]
    expect(payload.name).toBe('补气养血方')
    expect(payload.ingredients).toHaveLength(2)
    expect(payload.ingredients[0].name).toBe('黄芪')
  })

  it('修复失败（后端返回 success=false）时提示错误且不保存', async () => {
    ;(repairStructuredFormula as Mock).mockResolvedValue({
      success: false,
      structured: null,
      message: 'LLM 暂不可用，请稍后重试',
    })

    renderChatTab()
    fireEvent.click(screen.getByTestId('trigger-structure-repair'))

    await waitFor(() => {
      expect(screen.getByText(/LLM 暂不可用/)).toBeInTheDocument()
    })
    expect(createFormula).not.toHaveBeenCalled()
  })

  it('修复接口异常时提示错误且不保存', async () => {
    ;(repairStructuredFormula as Mock).mockRejectedValue(new Error('network down'))

    renderChatTab()
    fireEvent.click(screen.getByTestId('trigger-structure-repair'))

    await waitFor(() => {
      expect(screen.getByText(/network down/)).toBeInTheDocument()
    })
    expect(createFormula).not.toHaveBeenCalled()
  })
})

describe('FeedbackModal 反馈闭环', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getFormulaFeedback as Mock).mockResolvedValue({ items: [] })
  })

  it('提交反馈时调用 submitFormulaFeedback，携带评分/症状变化/备注', async () => {
    ;(submitFormulaFeedback as Mock).mockResolvedValue({ success: true, feedback_id: 9, message: '反馈提交成功' })

    render(
      <FeedbackModal
        formulaId={42}
        formulaName="补气养血方"
        onClose={() => {}}
      />,
    )

    // 评分 4 星
    fireEvent.click(screen.getByLabelText('4 星'))
    fireEvent.change(screen.getByLabelText('症状变化'), { target: { value: '睡眠有所改善' } })
    fireEvent.change(screen.getByLabelText('备注'), { target: { value: '持续服用两周' } })
    fireEvent.click(screen.getByRole('button', { name: /提交反馈/ }))

    await waitFor(() => {
      expect(submitFormulaFeedback).toHaveBeenCalledWith({
        formula_id: 42,
        rating: 4,
        symptom_change: '睡眠有所改善',
        metric_updates: undefined,
        notes: '持续服用两周',
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/反馈提交成功/)).toBeInTheDocument()
    })
  })

  it('未评分时提交被拦截并提示', async () => {
    render(
      <FeedbackModal
        formulaId={42}
        formulaName="补气养血方"
        onClose={() => {}}
      />,
    )

    fireEvent.change(screen.getByLabelText('症状变化'), { target: { value: '有改善' } })
    fireEvent.click(screen.getByRole('button', { name: /提交反馈/ }))

    await waitFor(() => {
      expect(screen.getByText(/请先选择 1-5 星效果评分/)).toBeInTheDocument()
    })
    expect(submitFormulaFeedback).not.toHaveBeenCalled()
  })

  it('展示历史反馈（getFormulaFeedback）', async () => {
    ;(getFormulaFeedback as Mock).mockResolvedValue({
      items: [
        {
          id: 1,
          formula_id: 42,
          rating: 5,
          symptom_change: '效果明显，气色改善',
          created_at: '2026-10-01T08:00:00Z',
        },
      ],
    })

    render(
      <FeedbackModal
        formulaId={42}
        formulaName="补气养血方"
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText(/效果明显，气色改善/)).toBeInTheDocument()
    })
    expect(getFormulaFeedback).toHaveBeenCalledWith(42)
  })
})