/**
 * FollowUpSuggestionsBar — 追问建议栏组件
 *
 * 在AI回复完成后展示快捷追问选项
 * 支持点击直接发送，支持关闭
 */
import React, { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Sparkles, Send } from 'lucide-react'
import { followUpSuggestionEngine, type FollowUpSuggestion } from '../../services/followUpSuggestionService'
import { fetchDynamicFollowUpSuggestions } from '../../services/followUpSuggestionApi'

interface FollowUpSuggestionsBarProps {
  onSendSuggestion: (question: string) => void
  messages: Array<{ role: string; content: string; id: string; isLoading?: boolean }>
  isVisible: boolean
}

function FollowUpSuggestionsBar({ onSendSuggestion, messages, isVisible }: FollowUpSuggestionsBarProps) {
  const { t } = useTranslation()
  const [suggestions, setSuggestions] = useState<FollowUpSuggestion[]>([])
  const [isVisibleLocal, setIsVisibleLocal] = useState(false)

  // 防重：用「消息 id + 加载状态 + 内容长度」作为处理 key。
  // 仅用 id 会漏掉关键变化：assistant 占位消息 content 从空增长到非空（AI 回复完成），
  // 若首次处理时已记住该 id，后续内容更新将永远不会重新触发动态追问。
  const lastProcessedKeyRef = useRef<string | null>(null)

  // 动态请求序号：仅当仍是最新一次请求（对应最新 assistant 消息）时才应用结果，防止竞态
  const dynamicRequestSeqRef = useRef(0)

  // 组件挂载状态，避免卸载后 setState
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!isVisible || messages.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisibleLocal(false)
      return
    }

    // 获取最后一条AI回复
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')
    if (!lastAssistantMsg) {
      setIsVisibleLocal(false)
      return
    }

    const content = lastAssistantMsg.content || ''
    // AI 是否仍在生成：assistant 占位消息创建时 isLoading=true，回复完成/降级完成时置为 false
    const isLoading = lastAssistantMsg.isLoading === true

    // 防重 key：id + 加载状态 + 内容长度。
    // 流式过程中 content 从空增长、isLoading 保持 true；回复完成后 isLoading=false 且 content 非空，
    // key 变化 → 重新进入处理，从而在正确时机触发动态追问。
    const processKey = `${lastAssistantMsg.id}:${isLoading ? 'loading' : 'done'}:${content.length}`
    if (lastProcessedKeyRef.current === processKey) {
      return
    }
    lastProcessedKeyRef.current = processKey

    // 核心修复：AI 仍在生成（isLoading=true）或回复内容为空时，
    // 不请求动态追问（避免 answer="" 触发后端 422），也不展示追问栏（等待回复完成）。
    if (isLoading || content.trim().length === 0) {
      setIsVisibleLocal(false)
      return
    }

    // 更新本地规则引擎上下文（降级路径使用）
    const hasFormulaOutput = content.includes('"data-table"') || content.includes('配方')
    const hasSafetyWarning = content.includes('注意事项') || content.includes('warning')

    followUpSuggestionEngine.updateContext({
      hasFormulaOutput,
      hasSafetyWarning,
      messageCount: messages.length,
      topicKeywords: extractKeywords(content),
      entities: extractEntities(content),
    })

    // ① 先同步生成本地规则引擎结果，动态请求期间直接展示，避免空白等待
    const localSugs = followUpSuggestionEngine.generateSuggestions(3)
    setSuggestions(localSugs)
    setIsVisibleLocal(true)

    // ② 异步优先请求后端 LLM 动态生成追问；成功则替换，失败/超时保留本地结果（降级）
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-8)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const requestSeq = ++dynamicRequestSeqRef.current
    void fetchDynamicFollowUpSuggestions({
      question: lastUserMsg?.content ?? '',
      answer: content,
      history,
      maxSuggestions: 3,
    }).then((dynamicSugs) => {
      // 防竞态：仅当仍是最新一次请求（对应最新 assistant 消息）且组件仍挂载时替换
      if (
        dynamicSugs &&
        dynamicSugs.length > 0 &&
        requestSeq === dynamicRequestSeqRef.current &&
        isMountedRef.current
      ) {
        setSuggestions(dynamicSugs)
      }
    }).catch(() => {
      // 不应发生：fetchDynamicFollowUpSuggestions 内部已捕获所有异常并返回 null
    })
  }, [isVisible, messages])

  if (!isVisibleLocal || suggestions.length === 0) {
    return null
  }

  return (
    <div className="mt-4 mb-2 p-3 bg-gradient-to-r from-primary-50/60 to-secondary-50/40 dark:from-primary-900/10 dark:to-secondary-900/5 border border-primary-200 dark:border-primary-800/40 rounded-xl">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary-500" />
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            {t('ai.chat.quick.followUpTitle')}
          </span>
        </div>
        <button
          onClick={() => setIsVisibleLocal(false)}
          className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
        >
          <X className="w-3 h-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
        </button>
      </div>

      {/* 追问选项 */}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((sug) => (
          <button
            key={sug.id}
            onClick={() => onSendSuggestion(sug.question)}
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              bg-white dark:bg-neutral-800
              border border-neutral-200 dark:border-neutral-700
              hover:border-primary-300 dark:hover:border-primary-600
              hover:shadow-sm transition-all duration-200
              text-left"
          >
            <span className="text-xs px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-300/25 text-primary-700 dark:text-primary-700 font-medium flex-shrink-0">
              {sug.categoryKey
                ? t(`ai.chat.quick.categories.${sug.categoryKey}`, { defaultValue: sug.category })
                : sug.category}
            </span>
            <span className="text-xs text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200 truncate max-w-[200px]">
              {sug.questionKey
                ? t(`ai.chat.quick.questions.${sug.questionKey}`, { defaultValue: sug.question })
                : sug.question}
            </span>
            <Send className="w-3 h-3 text-neutral-300 dark:text-neutral-400 group-hover:text-primary-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>

      {/* 手动输入提示 */}
      <div className="mt-2 text-xs text-neutral-400 dark:text-neutral-400">
        {t('ai.chat.quick.followUpHint')}
      </div>
    </div>
  )
}

/**
 * 从内容中提取关键词
 */
function extractKeywords(content: string): string[] {
  const keywords: string[] = []
  const patterns = [
    /高血糖|血糖|糖尿病/i,
    /睡眠|失眠|安神/i,
    /血压|心血管/i,
    /免疫|抗氧化/i,
    /肝|肾|护肝/i,
    /减肥|血脂|代谢/i,
    /补气|养血|滋补/i,
    /配方|药食同源/i,
    /桑叶|苦瓜|枸杞/i,
  ]
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      const match = content.match(pattern)
      if (match) keywords.push(match[0])
    }
  }
  return keywords
}

/**
 * 从内容中提取实体
 */
function extractEntities(content: string): string[] {
  const entities: string[] = []
  const knownEntities = [
    '黄芪', '党参', '枸杞', '人参', '桑叶', '苦瓜', '肉桂', '葛根',
    '茯苓', '山药', '红枣', '菊花', '决明子', '荷叶', '山楂',
  ]
  for (const entity of knownEntities) {
    if (content.includes(entity)) {
      entities.push(entity)
    }
  }
  return entities
}

export default FollowUpSuggestionsBar
