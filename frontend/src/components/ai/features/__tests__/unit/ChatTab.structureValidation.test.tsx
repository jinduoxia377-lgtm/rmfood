/**
 * ChatTab 保存前 AI 配方校验测试
 *
 * 覆盖 handleStructureSave 的四条分支：
 * 1. blocked_by_critical=true → 阻止保存并展示错误摘要
 * 2. 有 warnings 未阻断 → 继续保存，并把校验建议追加到 payload.notes（【AI校验】前缀）
 * 3. 校验通过（安全） → 原样保存，不追加 AI 校验备注
 * 4. 校验接口异常 → 不阻断保存但提示（诚实降级）
 */
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import * as React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChatTab, buildValidationErrorSummary } from '../../ChatTab'
import { ChatStateProvider } from '../../ChatStateProvider'
import { validateAiFormula } from '@/api/ai'
import { createFormula } from '@/api/formula'

// ===== Mock 外部依赖 =====
// ChatTab 是纯布局组件，业务逻辑在 ChatStateProvider 中初始化。
// 这里沿用 chatFlow.test.tsx 的 mock 方式，并把 components/pro 替换为测试桩，
// 通过桩上的按钮直接触发 ChatTab 内部的 handleStructureSave。
vi.mock('@/api/ai', () => ({
  validateAiFormula: vi.fn(),
  retrieveHerbKnowledge: vi.fn(),
  aiApi: {
    validateAiFormula: vi.fn(),
    retrieveHerbKnowledge: vi.fn(),
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

// components/pro 测试桩：ChatMessages 暴露一个按钮直接调用 onStructureSave
vi.mock('../../components/pro', () => {
  const structuredJson = JSON.stringify({
    responseType: 'formula',
    blocks: [
      { type: 'header', data: { title: '补气养血方', description: '适合气虚体质人群' } },
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
      { type: 'callout', data: { variant: 'warning', title: '注意事项', content: '孕妇慎用' } },
      { type: 'callout', data: { variant: 'info', title: '预期功效', content: '改善气血不足；提升机体免疫力' } },
    ],
  })
  return {
    ChatMessages: (props: { onStructureSave?: (messageId: string, content: string) => void }) =>
      React.createElement(
        'button',
        {
          'data-testid': 'trigger-structure-save',
          onClick: () => props.onStructureSave?.('msg-1', structuredJson),
        },
        '保存到配方库',
      ),
    ChatInputPro: () => React.createElement('input', { placeholder: '描述您的配方需求...' }),
    ChatHistory: () => null,
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

describe('ChatTab handleStructureSave 保存前 AI 校验', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // createFormula 默认成功返回，供放行分支使用
    ;(createFormula as Mock).mockResolvedValue({ id: 1, name: '测试配方' })
    // 静默 provider 内部的会话列表等网络调用
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
  })

  it('blocked_by_critical=true 时弹出成分级报告并阻止保存（确认按钮禁用）', async () => {
    ;(validateAiFormula as Mock).mockResolvedValue({
      valid: false,
      blocked_by_critical: true,
      risk_score: 86,
      alerts: [
        {
          level: 'critical',
          ingredient: '人参',
          message: '人参用量 30g 超过每日限量 3g',
          recommendation: '减量至 3g 以内',
          blocking: true,
        },
      ],
      errors: ['含违禁成分'],
      recommendations: ['请移除违禁成分'],
    })

    renderChatTab()
    fireEvent.click(screen.getByTestId('trigger-structure-save'))

    // 校验被调用，且成分携带 name + dosage_g
    await waitFor(() => {
      expect(validateAiFormula).toHaveBeenCalledWith({
        formula_name: '补气养血方',
        ingredients: [
          { name: '黄芪', dosage_g: 15 },
          { name: '当归', dosage_g: 10 },
        ],
        target_effects: ['改善气血不足', '提升机体免疫力'],
      })
    })

    // 弹出成分级校验报告
    await waitFor(() => {
      expect(screen.getByTestId('formula-validation-modal')).toBeInTheDocument()
    })
    expect(screen.getByText(/人参用量 30g 超过每日限量 3g/)).toBeInTheDocument()
    expect(screen.getByText(/减量至 3g 以内/)).toBeInTheDocument()

    // CRITICAL 阻断：确认保存按钮禁用，且未调用 createFormula
    expect(screen.getByTestId('validation-confirm-save')).toBeDisabled()
    expect(createFormula).not.toHaveBeenCalled()
  })

  it('有 warnings 未阻断时弹窗确认后继续保存，并把校验建议追加到 notes（【AI校验】前缀）', async () => {
    ;(validateAiFormula as Mock).mockResolvedValue({
      valid: true,
      blocked_by_critical: false,
      risk_score: 45,
      alerts: [
        {
          level: 'warning',
          ingredient: '甘草',
          message: '甘草用量接近限量',
          recommendation: '建议控制在 6g 以内',
          blocking: false,
        },
      ],
      warnings: ['甘草用量接近限量'],
      suggestions: ['甘草用量建议控制在 6g 以内'],
      recommendations: ['甘草用量建议控制在 6g 以内'],
    })

    renderChatTab()
    fireEvent.click(screen.getByTestId('trigger-structure-save'))

    // 先弹出校验报告
    await waitFor(() => {
      expect(screen.getByTestId('formula-validation-modal')).toBeInTheDocument()
    })
    // 未确认前不保存
    expect(createFormula).not.toHaveBeenCalled()

    // 用户确认保存
    fireEvent.click(screen.getByTestId('validation-confirm-save'))

    await waitFor(() => {
      expect(createFormula).toHaveBeenCalledTimes(1)
    })

    const payload = (createFormula as Mock).mock.calls[0][0]
    expect(payload.notes).toContain('【AI校验】')
    expect(payload.notes).toContain('甘草用量建议控制在 6g 以内')
    expect(payload.name).toBe('补气养血方')
  })

  it('校验通过（安全）时弹窗确认后原样保存，不追加 AI 校验备注', async () => {
    ;(validateAiFormula as Mock).mockResolvedValue({
      valid: true,
      blocked_by_critical: false,
      risk_score: 10,
      alerts: [],
    })

    renderChatTab()
    fireEvent.click(screen.getByTestId('trigger-structure-save'))

    // 有校验结果时也先展示报告，用户确认后才保存
    await waitFor(() => {
      expect(screen.getByTestId('formula-validation-modal')).toBeInTheDocument()
    })
    expect(createFormula).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('validation-confirm-save'))

    await waitFor(() => {
      expect(createFormula).toHaveBeenCalledTimes(1)
    })

    const payload = (createFormula as Mock).mock.calls[0][0]
    expect(payload.notes).not.toContain('【AI校验】')
    // 原有注意事项保留
    expect(payload.notes).toContain('【注意事项】')
  })

  it('校验接口异常时不阻断保存但提示（诚实降级，不弹窗）', async () => {
    ;(validateAiFormula as Mock).mockRejectedValue(new Error('network down'))

    renderChatTab()
    fireEvent.click(screen.getByTestId('trigger-structure-save'))

    // 降级：不弹窗，仍然保存
    await waitFor(() => {
      expect(createFormula).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByTestId('formula-validation-modal')).not.toBeInTheDocument()

    // 提示校验服务不可用
    await waitFor(() => {
      expect(screen.getByText(/校验服务暂不可用/)).toBeInTheDocument()
    })
  })
})

describe('buildValidationErrorSummary 错误摘要生成', () => {
  it('应汇总 CRITICAL 预警（含超限成分与建议）', () => {
    const summary = buildValidationErrorSummary({
      valid: false,
      blocked_by_critical: true,
      alerts: [
        {
          level: 'critical',
          ingredient: '人参',
          message: '人参用量 30g 超过每日限量 3g',
          recommendation: '减量至 3g 以内',
          blocking: true,
        },
      ],
    })

    expect(summary).toContain('校验未通过')
    expect(summary).toContain('「人参」')
    expect(summary).toContain('减量至 3g 以内')
  })

  it('应追加 errors 与 recommendations 文本', () => {
    const summary = buildValidationErrorSummary({
      blocked_by_critical: true,
      alerts: [],
      errors: ['含违禁成分'],
      recommendations: ['请移除违禁成分'],
    })

    expect(summary).toContain('含违禁成分')
    expect(summary).toContain('建议：请移除违禁成分')
  })

  it('无阻断信息时返回兜底文案', () => {
    const summary = buildValidationErrorSummary({
      blocked_by_critical: true,
      alerts: [],
    })

    expect(summary).toBe('配方存在安全性问题，已阻止保存')
  })
})