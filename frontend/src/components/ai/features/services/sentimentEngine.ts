/**
 * 细粒度情感分析引擎 (Phase 1.2)
 *
 * 替换原有简单词袋模型，支持：
 * - 8 类细粒度情绪识别（satisfied/confused/anxious/frustrated/curious/excited/neutral/unknown）
 * - 强度评分算法（0-100，基于关键词密度+感叹号加强）
 * - 极性判定（positive/negative/neutral）
 * - 对话情感趋势分析
 * - LRU 缓存（最近200条），单次分析 < 1ms
 */

import {
  SENTI_BASE_SCORE_CAP,
  SENTI_WEIGHT_RATIO,
  SENTI_KEYWORD_SCORE,
  SENTI_DENSITY_MIN,
  SENTI_DENSITY_MAX,
  SENTI_DENSITY_FACTOR,
  SENTI_EXCLAMATION_BOOST_CAP,
  SENTI_EXCLAMATION_SCORE,
  SENTI_QUESTION_SCORE,
  SENTI_REPEATED_WORD_SCORE,
  SENTI_REPEAT_COUNT_THRESHOLD,
} from '@/config/ai/constants'

// ===== 类型定义 =====

/** 细粒度情绪类别 */
export type EmotionCategory =
  | 'satisfied'      // 满意/认可 — "太好了"、"正是我想要的"
  | 'confused'       // 困惑/不确定 — "不太懂"、"什么意思"、"能解释一下吗"
  | 'anxious'        // 焦虑/急切 — "着急用"、"很担心"、"会不会有副作用"
  | 'frustrated'     // 挫败/不满 — "还是不行"、"试了很多次了"、"不满意"
  | 'curious'        // 好奇/探索 — "为什么"、"怎么做到的"、"原理是什么"
  | 'excited'        // 兴奋/期待 — "期待效果"、"看起来很棒"
  | 'neutral'        // 平静/客观 — 纯信息查询，无情绪色彩
  | 'unknown'        // 无法判断

export interface EmotionResult {
  /** 主情绪类别 */
  primary: EmotionCategory
  /** 次要情绪（如有） */
  secondary?: EmotionCategory
  /** 主情绪强度 0-100 */
  intensity: number
  /** 极性：正面 / 负面 / 中性 */
  polarity: 'positive' | 'negative' | 'neutral'
  /** 匹配到的关键词列表 */
  matchedKeywords: string[]
  /** 置信度 0-1 */
  confidence: number
  /** 处理耗时(ms) */
  processingTimeMs: number
}

/** 情感趋势结果 */
export interface SentimentTrend {
  trend: 'improving' | 'declining' | 'stable' | 'fluctuating'
  dominantEmotion: EmotionCategory
  negativeStreak: number
  avgIntensity: number
}

// ===== 内部类型 =====

interface KeywordEntry {
  category: EmotionCategory
  weight: number
}

interface CategoryScore {
  category: EmotionCategory
  score: number
  matchedKeywords: string[]
}

// ===== 情感分析引擎 =====

export class SentimentEngine {
  /** 单例实例 */
  static readonly instance = new SentimentEngine()

  /** 关键词字典（O(1) 查找） */
  private keywordMap: Map<string, KeywordEntry>

  /** 短语模式字典 */
  private phrasePatterns: Map<EmotionCategory, RegExp[]>

  /** LRU 缓存（纯 Map 实现，利用 Map 插入序保证 LRU 语义） */
  private cache = new Map<string, EmotionResult>()
  private readonly maxCacheSize = 200

  /** 正面情绪集合 */
  private static readonly POSITIVE_CATEGORIES: Set<EmotionCategory> = new Set<EmotionCategory>(['satisfied', 'excited'] as EmotionCategory[])

  /** 负面情绪集合 */
  private static readonly NEGATIVE_CATEGORIES: Set<EmotionCategory> = new Set<EmotionCategory>(['frustrated', 'anxious'] as EmotionCategory[])

  constructor() {
    this.keywordMap = this.buildKeywordMap()
    this.phrasePatterns = this.buildPhrasePatterns()
    this.cache = new Map()
  }

  // ===== 词典构建 =====

  /** 构建关键词 → 类别的映射表 */
  private buildKeywordMap(): Map<string, KeywordEntry> {
    const map = new Map<string, KeywordEntry>()

    // satisfied (满意) - 正面评价词
    const satisfiedKeywords: [string, number][] = [
      ['好', 3], ['优秀', 4], ['满意', 4], ['喜欢', 3], ['推荐', 3], ['有效', 3],
      ['安全', 3], ['成功', 4], ['完美', 5], ['棒', 3], ['赞', 3], ['清晰', 3],
      ['实用', 3], ['有帮助', 3], ['不错', 3], ['很好', 3], ['太好了', 5],
      ['谢谢', 3], ['感谢', 3], ['解决了问题', 4], ['明白了', 3], ['正是我要的', 5],
      ['给力', 3], ['靠谱', 3], ['专业', 3]
    ]
    satisfiedKeywords.forEach(([kw, w]) => map.set(kw, { category: 'satisfied', weight: w }))

    // confused (困惑) - 不理解信号
    const confusedKeywords: [string, number][] = [
      ['不太懂', 4], ['什么意思', 4], ['能解释吗', 4], ['没看懂', 4], ['不理解', 3],
      ['有点晕', 3], ['复杂', 2], ['太专业了', 3], ['说人话', 4], ['翻译一下', 3],
      ['为什么呢', 3], ['怎么回事', 3], ['如何理解', 3], ['这是什么意思', 4],
      ['也就是说', 2], ['不懂', 3], ['疑惑', 3], ['糊涂', 3], ['晕', 2],
      ['搞不懂', 4], ['不明白', 3], ['能否说明', 3], ['啥意思', 4]
    ]
    confusedKeywords.forEach(([kw, w]) => map.set(kw, { category: 'confused', weight: w }))

    // anxious (焦虑) - 担忧词汇
    const anxiousKeywords: [string, number][] = [
      ['担心', 3], ['害怕', 4], ['焦虑', 4], ['急切', 3], ['着急', 3], ['怕', 3],
      ['不安', 3], ['紧张', 3], ['会不会', 3], ['万一', 3], ['风险', 3],
      ['副作用', 4], ['有害', 4], ['赶时间', 3], ['尽快', 3], ['马上要', 3],
      ['急需', 4], ['等不了', 3], ['担心出问题', 4], ['怕出错', 3], ['心里没底', 4],
      ['忐忑', 3], ['慌', 3], ['着急用', 4]
    ]
    anxiousKeywords.forEach(([kw, w]) => map.set(kw, { category: 'anxious', weight: w }))

    // frustrated (挫折) - 不满表达
    const frustratedKeywords: [string, number][] = [
      ['还是不行', 5], ['不好用', 4], ['没用', 4], ['失望', 4], ['烦', 3],
      ['气人', 4], ['浪费时间', 4], ['垃圾', 5], ['骗人', 5], ['假的', 5],
      ['不靠谱', 4], ['试了很多次', 4], ['都不行', 4], ['还是错了', 4],
      ['又失败', 4], ['没办法了', 4], ['放弃吧', 5], ['不满意', 4], ['坑', 4],
      ['烂', 4], ['无语', 3], ['受够了', 4], ['折腾', 3], ['怎么还不行', 5]
    ]
    frustratedKeywords.forEach(([kw, w]) => map.set(kw, { category: 'frustrated', weight: w }))

    // curious (好奇) - 探索词汇
    const curiousKeywords: [string, number][] = [
      ['为什么', 3], ['怎么', 2], ['如何', 2], ['原理', 3], ['机制', 3],
      ['原因', 3], ['什么情况', 3], ['能不能', 2], ['是否可以', 2], ['呢', 1],
      ['吗', 1], ['想了解', 3], ['想学', 3], ['请教', 3], ['告诉我', 2],
      ['科普一下', 3], ['详细说说', 2], ['为啥', 3], ['究竟', 2], ['到底', 2],
      ['请问', 2], ['请教一下', 3], ['想问', 2], ['好奇', 3]
    ]
    curiousKeywords.forEach(([kw, w]) => map.set(kw, { category: 'curious', weight: w }))

    // excited (兴奋) - 期待词汇
    const excitedKeywords: [string, number][] = [
      ['期待', 4], ['希望', 3], ['看起来', 3], ['感觉会', 3], ['应该不错', 3],
      ['很想', 3], ['迫不及待', 5], ['太棒了', 5], ['厉害', 4], ['牛', 4],
      ['相信', 3], ['肯定', 3], ['一定会', 3], ['有信心', 4], ['哇', 3],
      ['太赞了', 5], ['激动', 4], ['开心', 3], ['惊喜', 4], ['期待效果', 4],
      ['感觉很不错', 4], ['厉害了', 4], ['强', 3], ['牛逼', 4]
    ]
    excitedKeywords.forEach(([kw, w]) => map.set(kw, { category: 'excited', weight: w }))

    // neutral (中性) - 纯查询
    const neutralKeywords: [string, number][] = [
      ['什么是', 2], ['有哪些', 2], ['多少', 1], ['哪个', 1], ['列出', 2],
      ['给个', 1], ['请提供', 2], ['帮我查', 2], ['介绍一下', 2], ['说明一下', 2],
      ['关于', 1], ['根据', 1], ['查询', 2], ['搜索', 2], ['找一下', 2],
      ['看一下', 1], ['麻烦', 1], ['劳驾', 1], ['请问有什么', 2], ['我想知道', 2],
      ['告诉我关于', 2], ['查一下', 2], ['有什么', 1], ['哪些', 1]
    ]
    neutralKeywords.forEach(([kw, w]) => map.set(kw, { category: 'neutral', weight: w }))

    return map
  }

  /** 构建正则短语模式（补充关键词匹配） */
  private buildPhrasePatterns(): Map<EmotionCategory, RegExp[]> {
    const patterns = new Map<EmotionCategory, RegExp[]>()

    patterns.set('satisfied', [
      /很(好|棒|赞|不错|满意|喜欢)/,
      /非常(好|棒|优秀|完美|满意|感谢)/,
      /确实(好|不错|有用|有效)/,
      /(终于|总算)(搞定|解决|好了|成功了)/
    ])

    patterns.set('confused', [
      /不太(理解|明白|清楚|懂)/,
      /能不能(说清楚|讲详细|再说说)/,
      /(还是|实在)(不太懂|不明白|不理解)/,
      /感觉(有点|有些)(复杂|绕|晕)/
    ])

    patterns.set('anxious', [
      /很(担心|害怕|着急|焦虑|紧张)/,
      /会不会(有问题|出事|失败|有风险)/,
      /(真的|特别|非常)(急|慌|不安)/,
      /万一(出了|发生|遇到).*(怎么办|如何)/
    ])

    patterns.set('frustrated', [
      /(总是|一直|每次|反复).*(不行|失败|出错|有问题)/,
      /(真是|简直|太).*(气人|烦人|失望|无语|坑爹)/,
      /(已经|都).*(试过很多次|试了好几次|尝试了很多方法)/,
      /根本(不行|没用|不好使|不工作)/
    ])

    patterns.set('curious', [
      /具体(来说|来讲|是什么)/,
      /从.*?(角度|方面|层面).*(来看|分析|解释)/,
      /可以(详细|具体|深入).*(说说|讲讲|介绍)/,
      /我想(知道|了解|学习).*(更多|详情|原理)/
    ])

    patterns.set('excited', [
      /(真的很|确实|感觉).*(不错|棒|好|厉害|牛)/,
      /一定(要|会|能).*(试试|尝试|体验|使用)/,
      /(超级|特别|非常).*(期待|希望|兴奋|开心)/,
      /(终于|居然|竟然).*(成功了|做到了|实现了)/
    ])

    return patterns
  }

  // ===== 核心分析方法 =====

  /**
   * 分析单条文本的情感
   * @param text 待分析文本
   * @returns 情感分析结果
   */
  analyze(text: string): EmotionResult {
    const startTime = performance.now()

    // 缓存查找
    const cacheKey = text.trim().toLowerCase()
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!
      // 更新 LRU 位置
      this.updateLRU(cacheKey)
      return {
        ...cached,
        processingTimeMs: Math.round((performance.now() - startTime) * 100) / 100
      }
    }

    // 执行分析
    const result = this.performAnalysis(text)
    result.processingTimeMs = Math.round((performance.now() - startTime) * 100) / 100

    // 写入缓存
    this.putCache(cacheKey, result)

    return result
  }

  /** 执行实际分析逻辑 */
  private performAnalysis(text: string): EmotionResult {
    if (!text || text.trim().length === 0) {
      return this.emptyResult()
    }

    const normalizedText = text.trim()
    const scores = this.computeCategoryScores(normalizedText)

    if (scores.length === 0) {
      return this.emptyResult()
    }

    // 按分数排序
    scores.sort((a, b) => b.score - a.score)

    const primary = scores[0]
    const secondary = scores.length > 1 && scores[1].score > primary.score * 0.4
      ? scores[1]
      : null

    // 计算强度
    const intensity = this.computeIntensity(normalizedText, primary, scores)

    // 判定极性
    const polarity = this.determinePolarity(primary.category, intensity, scores)

    // 计算置信度
    const confidence = this.computeConfidence(primary.score, scores)

    return {
      primary: primary.category,
      secondary: secondary?.category,
      intensity: Math.min(100, Math.max(0, intensity)),
      polarity,
      matchedKeywords: primary.matchedKeywords,
      confidence: Math.min(1, Math.max(0, confidence)),
      processingTimeMs: 0  // 由调用方设置
    }
  }

  /** 计算各类别得分 */
  private computeCategoryScores(text: string): CategoryScore[] {
    const scoreMap = new Map<EmotionCategory, CategoryScore>()

    // 关键词匹配
    Array.from(this.keywordMap.entries()).forEach(([keyword, entry]) => {
      if (text.includes(keyword)) {
        const existing = scoreMap.get(entry.category)
        if (existing) {
          existing.score += entry.weight
          existing.matchedKeywords.push(keyword)
        } else {
          scoreMap.set(entry.category, {
            category: entry.category,
            score: entry.weight,
            matchedKeywords: [keyword]
          })
        }
      }
    })

    // 短语模式匹配（额外加分）
    Array.from(this.phrasePatterns.entries()).forEach(([category, patterns]) => {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          const existing = scoreMap.get(category)
          if (existing) {
            existing.score += 4  // 短语匹配加权
            existing.matchedKeywords.push(pattern.source.slice(0, 20) + '...')
          } else {
            scoreMap.set(category, {
              category,
              score: 4,
              matchedKeywords: [pattern.source.slice(0, 20) + '...']
            })
          }
        }
      }
    })

    return Array.from(scoreMap.values())
  }

  /**
   * 强度评分算法
   * intensity = base_score * keyword_density_multiplier * exclamation_boost
   */
  private computeIntensity(
    text: string,
    primary: CategoryScore,
    allScores: CategoryScore[]
  ): number {
    // base_score: 基于匹配关键词数量和权重的基础分（0-70）
    const totalWeight = allScores.reduce((sum, s) => sum + s.score, 0)
    const baseScore = Math.min(SENTI_BASE_SCORE_CAP, (primary.score / Math.max(totalWeight, 1)) * SENTI_WEIGHT_RATIO + primary.matchedKeywords.length * SENTI_KEYWORD_SCORE)

    // keyword_density_multiplier: 关键词密度系数（1.0-1.5）
    const textLength = text.length
    const totalMatches = allScores.reduce((sum, s) => sum + s.matchedKeywords.length, 0)
    const density = textLength > 0 ? totalMatches / (textLength / 10) : 0
    const densityMultiplier = Math.min(SENTI_DENSITY_MAX, Math.max(SENTI_DENSITY_MIN, SENTI_DENSITY_MIN + density * SENTI_DENSITY_FACTOR))

    // exclamation_boost: 感叹号/重复加强（+0-30）
    const exclamationCount = (text.match(/!/g) || []).length
    const questionCount = (text.match(/\?/g) || []).length
    const repeatedWords = this.countRepeatedWords(text)
    const exclamationBoost = Math.min(SENTI_EXCLAMATION_BOOST_CAP, exclamationCount * SENTI_EXCLAMATION_SCORE + questionCount * SENTI_QUESTION_SCORE + repeatedWords * SENTI_REPEATED_WORD_SCORE)

    const intensity = baseScore * densityMultiplier + exclamationBoost
    return Math.round(Math.min(100, Math.max(0, intensity)))
  }

  /** 统计重复出现的词语（简单实现） */
  private countRepeatedWords(text: string): number {
    const words = text.split(/[\s，。！？、；：""''（）【】]/).filter(w => w.length >= 2)
    const freq = new Map<string, number>()
    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1)
    }
    let repeatCount = 0
    Array.from(freq.values()).forEach((count) => {
      if (count > SENTI_REPEAT_COUNT_THRESHOLD) repeatCount += count - 1
    })
    return repeatCount
  }

  /** 极性判定规则 */
  private determinePolarity(
    primaryCategory: EmotionCategory,
    intensity: number,
    allScores: CategoryScore[]
  ): 'positive' | 'negative' | 'neutral' {
    // 规则优先级判断
    if (SentimentEngine.POSITIVE_CATEGORIES.has(primaryCategory)) {
      return 'positive'
    }
    if (SentimentEngine.NEGATIVE_CATEGORIES.has(primaryCategory)) {
      return intensity > 60 ? 'negative' : 'neutral'
    }
    if (primaryCategory === 'confused') {
      return 'neutral'  // 困惑偏负但不算负面
    }
    if (primaryCategory === 'curious' || primaryCategory === 'neutral') {
      return 'neutral'
    }

    // 基于强度的兜底判断
    const hasStrongNegative = allScores.some(
      s => SentimentEngine.NEGATIVE_CATEGORIES.has(s.category) && s.score > 8
    )
    const hasStrongPositive = allScores.some(
      s => SentimentEngine.POSITIVE_CATEGORIES.has(s.category) && s.score > 8
    )

    if (hasStrongNegative && !hasStrongPositive) return 'negative'
    if (hasStrongPositive && !hasStrongNegative) return 'positive'
    return 'neutral'
  }

  /** 计算置信度 */
  private computeConfidence(primaryScore: number, allScores: CategoryScore[]): number {
    if (allScores.length === 0) return 0
    if (allScores.length === 1) return Math.min(0.9, primaryScore / 20)

    const totalScore = allScores.reduce((sum, s) => sum + s.score, 0)
    const ratio = primaryScore / Math.max(totalScore, 1)

    // 主类别占比越高、总匹配越多，置信度越高
    const matchBonus = Math.min(0.2, allScores.reduce((sum, s) => sum + s.matchedKeywords.length, 0) * 0.02)
    return Math.min(1, Math.max(0.1, ratio * 0.8 + matchBonus))
  }

  /** 返回空结果 */
  private emptyResult(): EmotionResult {
    return {
      primary: 'unknown',
      intensity: 0,
      polarity: 'neutral',
      matchedKeywords: [],
      confidence: 0,
      processingTimeMs: 0
    }
  }

  // ===== 批量分析与趋势 =====

  /**
   * 批量分析（用于对话历史趋势）
   * @param texts 文本数组
   * @returns 分析结果数组
   */
  analyzeBatch(texts: string[]): EmotionResult[] {
    return texts.map(text => this.analyze(text))
  }

  /**
   * 计算对话情感趋势
   * @param results 各轮次分析结果
   * @returns 趋势分析结果
   */
  computeTrend(results: EmotionResult[]): SentimentTrend {
    if (results.length === 0) {
      return {
        trend: 'stable',
        dominantEmotion: 'unknown',
        negativeStreak: 0,
        avgIntensity: 0
      }
    }

    // 统计主导情绪
    const emotionFreq = new Map<EmotionCategory, number>()
    for (const r of results) {
      emotionFreq.set(r.primary, (emotionFreq.get(r.primary) || 0) + 1)
    }
    let dominantEmotion: EmotionCategory = 'unknown'
    let maxFreq = 0
    Array.from(emotionFreq.entries()).forEach(([emotion, freq]) => {
      if (freq > maxFreq) {
        maxFreq = freq
        dominantEmotion = emotion
      }
    })

    // 计算平均强度
    const avgIntensity = Math.round(
      results.reduce((sum, r) => sum + r.intensity, 0) / results.length
    )

    // 计算连续负面轮次数
    let negativeStreak = 0
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i].polarity === 'negative') {
        negativeStreak++
      } else {
        break
      }
    }

    // 判定趋势方向
    const trend = this.determineTrendDirection(results)

    return { trend, dominantEmotion, negativeStreak, avgIntensity }
  }

  /** 判定趋势方向 */
  private determineTrendDirection(results: EmotionResult[]): SentimentTrend['trend'] {
    if (results.length < 3) return 'stable'

    // 取后半段数据计算趋势
    const halfLen = Math.floor(results.length / 2)
    const firstHalf = results.slice(0, halfLen)
    const secondHalf = results.slice(halfLen)

    const avgPolarityFirst = this.avgPolarityScore(firstHalf)
    const avgPolaritySecond = this.avgPolarityScore(secondHalf)
    const diff = avgPolaritySecond - avgPolarityFirst

    // 计算波动程度
    const variances = []
    for (let i = 1; i < results.length; i++) {
      variances.push(Math.abs(this.polarityToNum(results[i].polarity) - this.polarityToNum(results[i - 1].polarity)))
    }
    const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length

    if (avgVariance > 0.6) return 'fluctuating'
    if (diff > 0.15) return 'improving'
    if (diff < -0.15) return 'declining'
    return 'stable'
  }

  /** 将极性转为数值 */
  private polarityToNum(polarity: 'positive' | 'negative' | 'neutral'): number {
    switch (polarity) {
      case 'positive': return 1
      case 'negative': return -1
      case 'neutral': return 0
    }
  }

  /** 计算一组结果的平均极性分 */
  private avgPolarityScore(results: EmotionResult[]): number {
    if (results.length === 0) return 0
    return results.reduce((sum, r) => sum + this.polarityToNum(r.polarity), 0) / results.length
  }

  // ===== 缓存管理 =====

  /** 写入缓存（LRU 策略 — 利用 Map 插入顺序特性，O(1) 淘汰最旧条目） */
  private putCache(key: string, value: EmotionResult): void {
    if (this.cache.has(key)) {
      this.cache.delete(key) // 删除后重新插入，移到最新位置
      this.cache.set(key, value)
      return
    }

    // 超出容量时淘汰最旧条目（Map.keys().next().value 即为最早插入的 key）
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, value)
  }

  /** 更新 LRU 位置（Map.delete + Map.set 实现O(1)移动） */
  private updateLRU(key: string): void {
    const cached = this.cache.get(key)
    if (cached !== undefined) {
      this.cache.delete(key)
      this.cache.set(key, cached)
    }
  }

  /** 清空缓存 */
  clearCache(): void {
    this.cache.clear()
  }

  /** 获取缓存大小 */
  getCacheSize(): number {
    return this.cache.size
  }

  /** 获取词典规模统计 */
  getStats(): { keywordCount: number; patternCount: number; cacheSize: number } {
    let patternCount = 0
    Array.from(this.phrasePatterns.values()).forEach((patterns) => {
      patternCount += patterns.length
    })
    return {
      keywordCount: this.keywordMap.size,
      patternCount,
      cacheSize: this.cache.size
    }
  }
}

// 导出默认实例便捷引用
export const sentimentEngine = SentimentEngine.instance
