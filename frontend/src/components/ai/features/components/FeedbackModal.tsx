/**
 * FeedbackModal — 配方效果反馈模态框（二期「反馈闭环」）
 *
 * 能力：
 * - 评分 1-5（星级选择）
 * - 症状变化文本
 * - 指标复查列表（动态增删，提交为 metric_updates）
 * - 备注
 * - 提交调用 submitFormulaFeedback（POST /ai/formula/feedback）
 * - 展示历史反馈 getFormulaFeedback（GET /ai/formula/{formula_id}/feedback）
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Star, X, Plus, Trash2, History, Send, Loader2 } from 'lucide-react'
import {
  submitFormulaFeedback,
  getFormulaFeedback,
  type FormulaFeedbackItem,
  type FormulaMetricUpdate,
} from '@/api/ai'
import { logger } from '@/utils/safeLogger'

interface FeedbackModalProps {
  /** 配方 ID */
  formulaId: number
  /** 配方名称（仅用于展示） */
  formulaName?: string
  /** 关闭回调 */
  onClose: () => void
}

/** 空指标复查行 */
const EMPTY_METRIC_ROW = (): FormulaMetricUpdate => ({ metric_name: '', baseline_value: '', current_value: '', unit: '' })

export function FeedbackModal({ formulaId, formulaName, onClose }: FeedbackModalProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [symptomChange, setSymptomChange] = useState('')
  const [metricUpdates, setMetricUpdates] = useState<FormulaMetricUpdate[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  // ── 历史反馈 ──
  const [history, setHistory] = useState<FormulaFeedbackItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  /** 仅拉取历史反馈数据，不触碰任何 state（供 effect 与事件处理器复用） */
  const fetchHistory = useCallback(async (): Promise<FormulaFeedbackItem[]> => {
    const res = await getFormulaFeedback(formulaId)
    return Array.isArray(res.items) ? res.items : []
  }, [formulaId])

  /**
   * 加载历史反馈（供提交成功后的刷新使用）。
   * @param showLoading 是否先进入加载态（事件处理器中调用，允许同步 setState）
   */
  const loadHistory = useCallback(async (showLoading = false) => {
    if (showLoading) setHistoryLoading(true)
    try {
      const items = await fetchHistory()
      setHistory(items)
    } catch (e) {
      // 历史反馈读取失败不阻断表单，静默记录
      logger.warn('[FeedbackModal] 读取历史反馈失败:', e)
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [fetchHistory])

  useEffect(() => {
    // 首次挂载加载历史：不在 effect 内同步 setState，所有 setState 都在 promise 回调中
    let cancelled = false
    fetchHistory()
      .then(items => { if (!cancelled) setHistory(items) })
      .catch(() => { if (!cancelled) setHistory([]) })
      .finally(() => { if (!cancelled) setHistoryLoading(false) })
    return () => { cancelled = true }
  }, [fetchHistory])

  const updateMetric = (index: number, patch: Partial<FormulaMetricUpdate>) => {
    setMetricUpdates(prev => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  const handleSubmit = async () => {
    setSubmitMessage(null)
    if (rating < 1 || rating > 5) {
      setSubmitMessage({ kind: 'error', text: '请先选择 1-5 星效果评分' })
      return
    }
    const cleanedMetrics = metricUpdates
      .filter(m => m.metric_name?.trim())
      .map(m => ({
        metric_name: m.metric_name?.trim(),
        baseline_value: m.baseline_value !== '' ? m.baseline_value : undefined,
        current_value: m.current_value !== '' ? m.current_value : undefined,
        unit: m.unit?.trim() || undefined,
        status: m.status?.trim() || undefined,
        notes: m.notes?.trim() || undefined,
      }))

    setSubmitting(true)
    try {
      const res = await submitFormulaFeedback({
        formula_id: formulaId,
        rating,
        symptom_change: symptomChange.trim() || undefined,
        metric_updates: cleanedMetrics.length > 0 ? cleanedMetrics : undefined,
        notes: notes.trim() || undefined,
      })
      if (res.success) {
        setSubmitMessage({ kind: 'success', text: res.message || '反馈提交成功，感谢您的反馈！' })
        // 重置表单并刷新历史
        setRating(0)
        setSymptomChange('')
        setMetricUpdates([])
        setNotes('')
        void loadHistory(true)
      } else {
        setSubmitMessage({ kind: 'error', text: res.message || '反馈提交失败，请稍后重试' })
      }
    } catch (e) {
      logger.error('[FeedbackModal] 反馈提交失败:', e)
      setSubmitMessage({ kind: 'error', text: '反馈提交失败：' + (e instanceof Error ? e.message : '服务端未接受请求') })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="配方效果反馈">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl
        border border-neutral-200 dark:border-neutral-700 overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col">

        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary-500" />
            <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">提交效果反馈</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="关闭">
            <X className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          </button>
        </div>

        {/* 内容区（可滚动） */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {formulaName && (
            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700">
              <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{formulaName}</div>
              <div className="text-xs text-neutral-400 dark:text-neutral-400">配方 ID：{formulaId}</div>
            </div>
          )}

          {/* 评分 */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              效果评分 <span className="text-error-500">*</span>
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  aria-label={`${star} 星`}
                  className="p-0.5 transition-transform hover:scale-110"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= (hoverRating || rating)
                        ? 'text-warning-400 fill-warning-400'
                        : 'text-neutral-300 dark:text-neutral-600'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-xs text-neutral-400 dark:text-neutral-400">
                {rating > 0 ? `${rating} / 5` : '未评分'}
              </span>
            </div>
          </div>

          {/* 症状变化 */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5" htmlFor="feedback-symptom">
              症状变化
            </label>
            <textarea
              id="feedback-symptom"
              value={symptomChange}
              onChange={e => setSymptomChange(e.target.value)}
              rows={2}
              placeholder="如：连续服用 2 周后，睡眠质量有所改善，晨起口干减轻……"
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400 resize-y focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
          </div>

          {/* 指标复查列表 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">指标复查</label>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-700 hover:underline"
                onClick={() => setMetricUpdates(prev => [...prev, EMPTY_METRIC_ROW()])}
              >
                <Plus className="w-3 h-3" /> 添加指标
              </button>
            </div>
            {metricUpdates.length === 0 ? (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 px-1">
                可添加体检/复查指标（如 空腹血糖、甘油三酯 等）的前后对比。
              </p>
            ) : (
              <div className="space-y-2">
                {metricUpdates.map((metric, i) => (
                  <div key={i} className="p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        value={metric.metric_name ?? ''}
                        onChange={e => updateMetric(i, { metric_name: e.target.value })}
                        placeholder="指标名称（如 空腹血糖）"
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                      />
                      <input
                        value={metric.unit ?? ''}
                        onChange={e => updateMetric(i, { unit: e.target.value })}
                        placeholder="单位"
                        className="w-16 px-2 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                      />
                      <button
                        type="button"
                        aria-label="删除该指标"
                        className="p-1.5 rounded-md text-neutral-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10"
                        onClick={() => setMetricUpdates(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        value={metric.baseline_value ?? ''}
                        onChange={e => updateMetric(i, { baseline_value: e.target.value })}
                        placeholder="调理前"
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                      />
                      <span className="text-xs text-neutral-400">→</span>
                      <input
                        value={metric.current_value ?? ''}
                        onChange={e => updateMetric(i, { current_value: e.target.value })}
                        placeholder="复查后"
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5" htmlFor="feedback-notes">
              备注
            </label>
            <textarea
              id="feedback-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="其他想补充的信息（如服用方式、不良反应等）……"
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400 resize-y focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
          </div>

          {/* 提交状态提示 */}
          {submitMessage && (
            <div
              role="status"
              className={`px-3 py-2 rounded-lg text-xs font-medium ${
                submitMessage.kind === 'success'
                  ? 'bg-success-50 dark:bg-success-500/15 text-success-700 dark:text-success-600'
                  : 'bg-error-50 dark:bg-error-500/15 text-error-700 dark:text-error-600'
              }`}
            >
              {submitMessage.kind === 'success' ? '✓ ' : '⚠ '}{submitMessage.text}
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
              bg-gradient-to-r from-[var(--color-primary-surface)] to-[var(--color-success-surface-deep)] text-white text-sm font-medium
              hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? '提交中...' : '提交反馈'}
          </button>

          {/* 历史反馈 */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <History className="w-3.5 h-3.5 text-neutral-400" />
              <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">历史反馈</h3>
            </div>
            {historyLoading ? (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 px-1">加载中...</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 px-1">暂无历史反馈记录。</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {history.map(item => (
                  <div key={item.feedback_id ?? item.id ?? item.created_at ?? `${item.formula_id}-${item.rating}`} className="p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star key={star} className={`w-3 h-3 ${star <= item.rating ? 'text-warning-400 fill-warning-400' : 'text-neutral-300 dark:text-neutral-600'}`} />
                        ))}
                      </div>
                      {item.created_at && (
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                          {new Date(item.created_at).toLocaleString('zh-CN', { hour12: false })}
                        </span>
                      )}
                    </div>
                    {item.symptom_change && <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">{item.symptom_change}</p>}
                    {Array.isArray(item.metric_updates) && item.metric_updates.length > 0 && (
                      <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                        {item.metric_updates
                          .filter(m => m?.metric_name)
                          .map(m => `${m.metric_name}${m.current_value != null ? ` ${m.current_value}${m.unit ?? ''}` : ''}`)
                          .join('；')}
                      </p>
                    )}
                    {item.notes && <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">{item.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeedbackModal