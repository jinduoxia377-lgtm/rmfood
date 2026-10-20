/**
 * FollowUpSuggestionsBar — 追问建议栏组件
 *
 * 在AI回复完成后展示快捷追问选项
 * 支持点击直接发送，支持关闭
 */
import React, { useEffect, useState } from 'react'
import { X, Sparkles, Send } from 'lucide-react'
import { followUpSuggestionEngine, type FollowUpSuggestion } from '../../services/followUpSuggestionService'

interface FollowUpSuggestionsBarProps {
  onSendSuggestion: (question: string) => void
  messages: Array<{ role: string; content: string; id: string }>
  isVisible: boolean
}

function FollowUpSuggestionsBar({ onSendSuggestion, messages, isVisible }: FollowUpSuggestionsBarProps) {
  const [suggestions, setSuggestions] = useState<FollowUpSuggestion[]>([])
  const [isVisibleLocal, setIsVisibleLocal] = useState(false)

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

    // 更新上下文
    const content = lastAssistantMsg.content
    const hasFormulaOutput = content.includes('"data-table"') || content.includes('配方')
    const hasSafetyWarning = content.includes('注意事项') || content.includes('warning')

    followUpSuggestionEngine.updateContext({
      hasFormulaOutput,
      hasSafetyWarning,
      messageCount: messages.length,
      topicKeywords: extractKeywords(content),
      entities: extractEntities(content),
    })

    // 生成追问建议
    const sugs = followUpSuggestionEngine.generateSuggestions(3)
    setSuggestions(sugs)
    setIsVisibleLocal(true)
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
            可以继续追问
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
              {sug.category}
            </span>
            <span className="text-xs text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200 truncate max-w-[200px]">
              {sug.question}
            </span>
            <Send className="w-3 h-3 text-neutral-300 dark:text-neutral-400 group-hover:text-primary-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>

      {/* 手动输入提示 */}
      <div className="mt-2 text-xs text-neutral-400 dark:text-neutral-400">
        或直接输入您的问题...
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
