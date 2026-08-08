/**
 * useChatInputDeepThinking - 深度思考分析 Hook (v1.0)
 *
 * 职责：
 * - 输入文本的深度思考分析（关键词/意图/情感/复杂度）
 * - 生成建议问题
 * - 同步分析（<10ms）
 *
 * @version 1.0.0
 * @author RMFOOD Team
 */

import { useCallback, useState } from 'react'

export interface DeepThinkingAnalysis {
  keywords: string[]
  intent: string
  sentiment: 'positive' | 'negative' | 'neutral'
  complexity: number
  suggestedQuestions: string[]
}

const STOP_WORDS = ['的', '是', '在', '有', '和', '了', '我', '你', '他', 'she', 'it', 'the', 'is', 'in', 'has']

export interface UseChatInputDeepThinkingReturn {
  deepThinkingAnalysis: DeepThinkingAnalysis | null
  isAnalyzing: boolean
  triggerDeepThinking: (input: string) => void
}

export function useChatInputDeepThinking(): UseChatInputDeepThinkingReturn {
  const [deepThinkingAnalysis, setDeepThinkingAnalysis] = useState<DeepThinkingAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const extractKeywords = useCallback((text: string): string[] => {
    const words = text.split(/[\s,.!?;:，。！？、；：]/)
      .filter(w => w.length > 1 && !STOP_WORDS.includes(w.toLowerCase()))
      .slice(0, 5)
    return [...new Set(words)]
  }, [])

  const detectIntent = useCallback((text: string): string => {
    const l = text.toLowerCase()
    if (/什么是|定义|解释|what is|define/.test(l)) return 'definition'
    if (/为什么|原因|why|reason/.test(l)) return 'reasoning'
    if (/如何|步骤|how|steps/.test(l)) return 'how_to'
    if (/比较|对比|compare|vs/.test(l)) return 'comparison'
    if (/推荐|建议|recommend/.test(l)) return 'recommendation'
    if (/总结|概括|summary/.test(l)) return 'summary'
    return 'general'
  }, [])

  const analyzeSentiment = useCallback((text: string): 'positive' | 'negative' | 'neutral' => {
    const pos = ['好', '棒', '优秀', '完美', '喜欢', '满意', '推荐', 'good', 'excellent', 'great']
    const neg = ['差', '糟糕', '不好', '问题', '错误', '失败', 'bad', 'terrible']
    let pc = 0, nc = 0
    pos.forEach(w => { if (text.toLowerCase().includes(w)) pc++ })
    neg.forEach(w => { if (text.toLowerCase().includes(w)) nc++ })
    if (pc > nc) return 'positive'
    if (nc > pc) return 'negative'
    return 'neutral'
  }, [])

  const calculateComplexity = useCallback((text: string): number => {
    const lenScore = Math.min(text.length / 100, 0.3)
    const punctScore = (text.match(/[,.!?;:，。！？、；：]/g)?.length || 0) / 10
    const questionScore = /[？?吗]/.test(text) ? 0.2 : 0
    return Math.min(lenScore + punctScore + questionScore + 0.15, 1)
  }, [])

  const generateSuggestedQuestions = useCallback((keywords: string[], intent: string): string[] => {
    const questions: string[] = []
    if (keywords.length > 0) {
      questions.push(`更多关于"${keywords[0]}"的信息`)
      questions.push(`${keywords[0]}的最新趋势`)
    }
    if (intent === 'definition') questions.push('相关概念')
    if (intent === 'how_to') questions.push('常见问题')
    if (intent === 'reasoning') questions.push('底层原理')
    return questions.slice(0, 3)
  }, [])

  const analyze = useCallback((input: string): DeepThinkingAnalysis => {
    const keywords = extractKeywords(input)
    const intent = detectIntent(input)
    const sentiment = analyzeSentiment(input)
    const complexity = calculateComplexity(input)
    return {
      keywords, intent, sentiment, complexity,
      suggestedQuestions: generateSuggestedQuestions(keywords, intent),
    }
  }, [extractKeywords, detectIntent, analyzeSentiment, calculateComplexity, generateSuggestedQuestions])

  const triggerDeepThinking = useCallback((input: string) => {
    if (!input.trim()) return
    setIsAnalyzing(true)
    // 模拟短暂分析延迟以显示加载状态
    setTimeout(() => {
      setDeepThinkingAnalysis(analyze(input))
      setIsAnalyzing(false)
    }, 800)
  }, [analyze])

  return { deepThinkingAnalysis, isAnalyzing, triggerDeepThinking }
}
