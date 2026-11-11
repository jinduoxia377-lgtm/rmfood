/**
 * FollowUpSuggestionsBar — 追问建议栏组件
 *
 * 在AI回复完成后展示快捷追问选项
 * 支持点击直接发送，支持关闭
 */
import React, { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Sparkles, Send, Info } from 'lucide-react'
import { followUpSuggestionEngine, type FollowUpSuggestion } from '../../services/followUpSuggestionService'
import { fetchDynamicFollowUpSuggestions } from '../../services/followUpSuggestionApi'
import { userPreferencesService } from '../../services/userPreferencesService'
import { detectStructuredContent } from '../structured/utils'
import { extractFormulaFromContent } from '../../services/formulaExtractorService'
import type { RAGChunkResult } from '@/api/rag'

interface FollowUpSuggestionsBarProps {
  onSendSuggestion: (question: string) => void
  messages: Array<{
    role: string
    content: string
    id: string
    isLoading?: boolean
    /** AI 识别的配方（用于构建 formula_context） */
    formulas?: Array<{ name: string; value: number; unit?: string; confidence?: number }>
    /** 辨证分析（SSE dialectics 事件，用于构建 constitution/dialectics_summary） */
    dialectics?: {
      constitution_tendency?: string
      syndrome_points?: string
      regulation_goals?: string[]
    }
  }>
  isVisible: boolean
  /**
   * RAG 最近一次检索命中的知识块（从 ChatTab 传入）。
   * 引用稳定性：上游 useRAGContext 已用 useMemo 包裹返回值、chunks 为 useState 数组，
   * 引用在两次检索之间稳定，不会触发本组件 useEffect 无限循环（见历史 pitfall）。
   */
  ragChunks?: RAGChunkResult[]
}

function FollowUpSuggestionsBar({ onSendSuggestion, messages, isVisible, ragChunks }: FollowUpSuggestionsBarProps) {
  const { t } = useTranslation()
  const [suggestions, setSuggestions] = useState<FollowUpSuggestion[]>([])
  const [isVisibleLocal, setIsVisibleLocal] = useState(false)
  // 后端返回 source==='fallback'（LLM 未走通）时为 true：UI 据此渲染轻量降级标识。
  // isFallbackRef 在 .then 内同步设置（供本轮判断），isFallbackVisible 触发重渲染显示标识。
  const isFallbackRef = useRef(false)
  const [isFallbackVisible, setIsFallbackVisible] = useState(false)

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

    // 更新本地规则引擎上下文（降级路径使用）。
    // 同时传入领域上下文（配方成分/体质/辨证/约束/合规），使 LLM 失败时本地兜底
    // 也围绕当前需求生成贴需求问题（而非固定 14 条通用问题）。见 followUpSuggestionService。
    const hasFormulaOutput = content.includes('"data-table"') || content.includes('配方')
    const hasSafetyWarning = content.includes('注意事项') || content.includes('warning')

    const formulaContext = buildFormulaContext(messages)
    const dialectics = lastAssistantMsg?.dialectics
    const constitution =
      dialectics?.constitution_tendency ??
      userPreferencesService.getUserProfile()?.constitutionType ??
      null
    const dialecticsSummary = buildDialecticsSummary(dialectics)
    const complianceContext = buildComplianceContext(messages)
    const profileSummary = userPreferencesService.generatePromptSummary()
    const userConstraints = profileSummary.trim().length > 0 ? profileSummary : null

    followUpSuggestionEngine.updateContext({
      hasFormulaOutput,
      hasSafetyWarning,
      messageCount: messages.length,
      topicKeywords: extractKeywords(content),
      entities: extractEntities(content),
      domain: {
        ingredients: parseFormulaIngredients(formulaContext),
        constitution,
        syndromePoints: dialectics?.syndrome_points ?? null,
        regulationGoals: dialectics?.regulation_goals ?? null,
        userConstraints,
        complianceContext,
      },
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

    // 收集结构化领域上下文，透传给后端 LLM 使追问贴合当前需求（全部可选，取不到就不传）。
    // 注意：这些值在本 effect 体内同步构建并直接传给 fetch，不作为依赖 → 不引入引用稳定性问题。
    // rag_context：RAG 最近命中的知识块内容（无检索结果时不传）
    const ragContext = ragChunks && ragChunks.length > 0
      ? ragChunks.map(c => c.content).filter(c => c && c.trim().length > 0)
      : null

    const requestSeq = ++dynamicRequestSeqRef.current
    // 新一轮请求：先清除上一轮的降级标识（本轮结果回来后再据 source 决定是否标记）
    isFallbackRef.current = false

    void fetchDynamicFollowUpSuggestions({
      question: lastUserMsg?.content ?? '',
      answer: content,
      history,
      maxSuggestions: 3,
      formula_context: formulaContext,
      constitution,
      user_constraints: userConstraints,
      rag_context: ragContext,
      dialectics_summary: dialecticsSummary,
      compliance_context: complianceContext,
    }).then((result) => {
      // 防竞态：仅当仍是最新一次请求（对应最新 assistant 消息）且组件仍挂载时应用
      if (requestSeq !== dynamicRequestSeqRef.current || !isMountedRef.current) return

      if (result.source === 'llm' && result.suggestions.length > 0) {
        // LLM 动态结果走通：替换本地池，清除降级标识
        isFallbackRef.current = false
        setSuggestions(result.suggestions)
      } else if (result.source === 'fallback') {
        // 后端 LLM 未走通（返回固定兜底问题）：保留本地规则池展示（本地池已按领域上下文
        // 增强，质量优于后端固定 3 条泛泛问题），仅标记降级态让 UI 给出轻量提示。
        // 不弹窗、不打断主流程。
        isFallbackRef.current = true
        setIsFallbackVisible(true)
      }
      // result.source === 'unavailable'（网络/超时/无效响应）：静默保留本地池，不打扰用户
    }).catch(() => {
      // 不应发生：fetchDynamicFollowUpSuggestions 内部已捕获所有异常并返回 unavailable
    })
    // ragChunks 引用稳定（上游 useMemo + useState），加入依赖不会触发无限循环；
    // 即便检索结果变化导致 effect 重跑，上方 processKey 守卫也会直接 return，不会重复请求。
  }, [isVisible, messages, ragChunks])

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
          {/* 轻量降级标识：后端 LLM 未走通（source==='fallback'）时显示。
              极不显眼的小徽标 + tooltip，让用户知道当前是降级态而非智能态；
              不弹窗、不打断主流程。样式用语义 neutral token（暗色兼容）。 */}
          {isFallbackVisible && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded
                bg-neutral-100 dark:bg-neutral-800
                border border-neutral-200 dark:border-neutral-700
                text-[10px] leading-none text-neutral-400 dark:text-neutral-500"
              title={t('ai.chat.quick.followUpFallbackTip')}
            >
              <Info className="w-2.5 h-2.5 flex-shrink-0" />
              {t('ai.chat.quick.followUpFallback')}
            </span>
          )}
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
 * 从消息列表构建当前配方上下文（向后找最近一条含配方的消息）。
 * 返回如「黄芪 15g(君)、党参 9g(臣)、茯苓 10g(使)」的文本；无配方时返回 null（不传给后端）。
 *
 * 君臣佐使 role 的数据源：ChatMessage.formulas 被拍平成 {name,value,unit,confidence}（丢弃了 role），
 * 但助手消息的原始 content 是 structured JSON（data-table 含 role 列「君/臣/佐/使」）。
 * 故对命中消息的 content 复用 detectStructuredContent + extractFormulaFromContent 还原 role，
 * 按「成分名」与 formulas 对齐后追加。role 取不到时降级为纯「名 克重」（不凭空造数据）。
 */
function buildFormulaContext(
  messages: FollowUpSuggestionsBarProps['messages'],
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    const formulas = msg?.formulas
    if (formulas && formulas.length > 0) {
      // 仅对命中消息解析一次 role 映射（成分名 → 君/臣/佐/使）
      const roleMap = extractRoleMapFromContent(msg.content)
      const parts = formulas
        .filter(f => f.name && typeof f.value === 'number')
        .map(f => {
          const base = `${f.name} ${f.value}${f.unit ?? ''}`
          const role = roleMap.get(f.name)
          return role ? `${base}(${role})` : base
        })
      if (parts.length > 0) return parts.join('、')
    }
  }
  return null
}

/**
 * 从 formula_context 文本解析出成分列表（供本地规则引擎生成领域兜底问题）。
 * 输入形如「黄芪 15g(君)、党参 9g(臣)、茯苓 10g」；解析失败返回空数组（不造数据）。
 */
function parseFormulaIngredients(
  formulaContext: string | null,
): Array<{ name: string; value?: number; unit?: string; role?: string }> {
  if (!formulaContext) return []
  const ingredients: Array<{ name: string; value?: number; unit?: string; role?: string }> = []
  for (const part of formulaContext.split(/[、,，]/)) {
    const trimmed = part.trim()
    if (!trimmed) continue
    // role：括号内单个汉字（君/臣/佐/使），取不到则无 role
    const roleMatch = trimmed.match(/[（(]([君臣佐使])[)）]/)
    const role = roleMatch ? roleMatch[1] : undefined
    // 去掉 role 括号后解析「名 数字 单位」
    const withoutRole = trimmed.replace(/[（(][君臣佐使][)）]/g, '').trim()
    const m = withoutRole.match(/^(\S+?)\s*([\d.]+)\s*(g|mg|kg|克|毫克)?$/)
    if (m) {
      ingredients.push({
        name: m[1],
        value: Number(m[2]),
        unit: m[3] || 'g',
        role,
      })
    } else if (withoutRole) {
      // 仅有名无克重（不常见）——仍保留 name，value 留空
      ingredients.push({ name: withoutRole, role })
    }
  }
  return ingredients
}

/**
 * 从助手消息原始 content（structured JSON）还原「成分名 → 君臣佐使 role」映射。
 * 解析失败/非结构化/无 role 列时返回空 Map（调用方降级，不报错、不造数据）。
 */
function extractRoleMapFromContent(content: string | undefined): Map<string, string> {
  const roleMap = new Map<string, string>()
  if (!content) return roleMap
  try {
    const structured = detectStructuredContent(content)
    if (!structured) return roleMap
    const extracted = extractFormulaFromContent(structured)
    if (!extracted) return roleMap
    for (const ing of extracted.ingredients) {
      if (ing.name && ing.role) roleMap.set(ing.name, ing.role)
    }
  } catch {
    // 静默降级：role 属增强信息，取不到不影响追问主流程
  }
  return roleMap
}

/**
 * 从助手回复构建合规结论上下文（compliance_context）。
 *
 * 数据源：AI 回复的结构化内容里，后端已完成的合规/安全分析以 callout block 承载——
 *   - warning callout：安全与禁忌（含十八反十九畏/配伍禁忌）、特殊人群提示、注意事项
 *   - info callout：合规说明（药食同源目录依据）、每日用量上限校验（日用总量）
 * 取不到（非结构化/无合规 callout）返回 null，不传给后端。
 *
 * 取舍：复用消息内已有合规结论（零额外网络请求、零时延、无 useEffect 循环风险），
 * 而非在追问收集时另调 complianceApi（那会引入额外时延与失败面）。追问是低频操作，
 * 且消息内容即后端合规校验后的产物，轻量正则/结构化提取已足够可靠。
 */
function buildComplianceContext(
  messages: FollowUpSuggestionsBarProps['messages'],
): string | null {
  // 向后找最近一条 assistant 消息（合规结论针对当前 AI 回复的配方）
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  if (!lastAssistant?.content) return null
  const parts: string[] = []
  try {
    const structured = detectStructuredContent(lastAssistant.content)
    if (!structured) return null
    for (const block of structured.blocks) {
      if (block.type !== 'callout') continue
      const d = block.data as { variant?: string; title?: string; content?: string }
      const title = (d.title || '').trim()
      const text = (d.content || '').trim()
      if (!text) continue
      // 命中合规相关：warning 变体（安全与禁忌/特殊人群/注意事项）或标题含合规关键词
      const isCompliance =
        d.variant === 'warning' ||
        /合规|禁忌|安全|特殊人群|用量上限|十八反|十九畏|药食同源/.test(title)
      if (isCompliance) parts.push(`${title || '合规'}：${text}`)
    }
  } catch {
    // 静默降级：合规属增强上下文，取不到不影响追问主流程
    return null
  }
  if (parts.length === 0) return null
  // 控制体积：合规结论只作追问引导，过长截断（后端 prompt 会整体拼接）
  return parts.join('；').slice(0, 500)
}

/**
 * 从辨证分析构建摘要（证候要点 + 调理目标）。
 * 无辨证数据时返回 null（不传给后端）。
 */
function buildDialecticsSummary(
  dialectics: FollowUpSuggestionsBarProps['messages'][number]['dialectics'],
): string | null {
  if (!dialectics) return null
  const parts: string[] = []
  if (dialectics.syndrome_points) parts.push(`辨证：${dialectics.syndrome_points}`)
  if (dialectics.regulation_goals && dialectics.regulation_goals.length > 0) {
    parts.push(`调理目标：${dialectics.regulation_goals.join('、')}`)
  }
  return parts.length > 0 ? parts.join('；') : null
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
