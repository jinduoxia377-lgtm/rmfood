/**
 * TermTooltip — 专业术语即时解释悬浮窗
 *
 * 功能：
 * - 自动识别文本中的专业术语（食品科学/药学领域）
 * - 悬停/点击显示术语详细解释
 * - 支持自定义术语库
 * - 学术风格的解释面板
 */
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { BookOpen, ExternalLink, X, Info } from 'lucide-react'

// 预置术语库（食品科学 / 药食同源 / 配方工程）
const TERM_DATABASE: Record<string, TermDefinition> = {
  // ===== 食品科学基础 =====
  'bioavailability': {
    term: 'bioavailability',
    cn: '生物利用度',
    definition: '指药物或营养成分经口服或其他非血管途径给药后，被机体吸收进入血液循环的相对量和速率。',
    domain: '营养学',
    related: ['ADME', 'first-pass effect'],
    reference: '《食品营养学》第3章',
  },
  'adme': {
    term: 'ADME',
    cn: '药物代谢动力学四要素',
    definition: 'Absorption（吸收）、Distribution（分布）、Metabolism（代谢）、Excretion（排泄），描述外源性物质在体内的全过程。',
    domain: '药剂学',
    related: ['bioavailability', 'pharmacokinetics'],
    reference: 'ICH Q6B 指导原则',
  },
  'emulsifier': {
    term: '乳化剂',
    cn: '乳化剂',
    definition: '能使互不相溶的液体（如油和水）形成稳定乳浊液的表面活性物质，常用于饮料、酱料等产品体系。',
    domain: '食品化学',
    related: ['HLB值', '临界胶束浓度'],
    reference: 'GB 2760 食品添加剂使用标准',
  },
  'hlb': {
    term: 'HLB值',
    cn: '亲水亲油平衡值',
    definition: 'Griffin 提出的表征表面活性剂亲水亲油能力的数值指标，范围 0-40。HLB<9 亲油型，HLB>11 亲水型。',
    domain: '物理化学',
    related: ['emulsifier', 'CMC'],
    reference: 'Griffin W C (1949)',
  },
  'cmc': {
    term: 'CMC',
    cn: '临界胶束浓度',
    definition: 'Critical Micelle Concentration，表面活性剂开始形成胶束的最低浓度，是评价表面活性效率的重要参数。',
    domain: '物理化学',
    related: ['HLB值', 'emulsifier'],
    reference: '《胶体化学》第5章',
  },

  // ===== 药食同源 =====
  'medicinal_edible': {
    term: '药食同源',
    cn: '药食同源',
    definition: '国家卫健委公布的既是食品又是中药材的物质目录，目前包含 106 种物质（2023年版）。',
    domain: '中医药',
    related: ['功能性食品', '新资源食品'],
    reference: '卫法监发[2002]51号',
  },
  'jun_chen_zuo_shi': {
    term: '君臣佐使',
    cn: '君臣佐使',
    definition: '中药方剂的组方原则：君药主攻病邪，臣药辅助君药，佐药制约君臣之偏性，使药调和诸药。',
    domain: '中医方剂学',
    related: ['medicinal_edible', 'synergistic_effect'],
    reference: '《神农本草经》序例',
  },
  'synergistic_effect': {
    term: '协同效应',
    cn: '协同效应',
    definition: '两种或以上成分联合作用时产生的效果大于各自单独作用之和的现象，是复方配伍的核心原理。',
    domain: '药理学',
    related: ['jun_chen_zuo_shi', 'antagonism'],
    reference: '《中药药理研究方法学》',
  },
  'active_peptide': {
    term: '活性肽',
    cn: '活性肽',
    definition: '具有特定生物学活性的短链肽段（通常 2-20 个氨基酸残基），如抗氧化肽、降血压肽、免疫调节肽等。',
    domain: '蛋白质化学',
    related: ['enzymatic_hydrolysis', 'bioactivity'],
    reference: '《功能性肽》专著',
  },
  'enzymatic_hydrolysis': {
    term: '酶解',
    cn: '酶解',
    definition: '利用蛋白酶（如胰酶、碱性蛋白酶、风味酶等）将大分子蛋白水解为小分子肽和氨基酸的过程。',
    domain: '食品工艺',
    related: ['active_peptide', 'degree_of_hydrolysis'],
    reference: '《食品酶学》第7章',
  },

  // ===== 安全与法规 =====
  'gras': {
    term: 'GRAS',
    cn: '一般公认安全',
    definition: 'Generally Recognized As Safe，FDA 认定的一类可在食品中使用且无需审批的物质清单。',
    domain: '食品安全',
    related: ['ADI', 'NOAEL'],
    reference: '21 CFR Part 182',
  },
  'adi': {
    term: 'ADI',
    cn: '每日允许摄入量',
    definition: 'Acceptable Daily Intake，人体每日摄入某物质而不产生可检测健康风险的估计最大量，单位 mg/kg bw。',
    domain: '毒理学',
    related: ['GRAS', 'NOAEL'],
    reference: 'JECFA 评估标准',
  },
  'noael': {
    term: 'NOAEL',
    cn: '未观察到有害作用的剂量',
    definition: 'No Observed Adverse Effect Level，毒理学试验中未观察到任何有害作用的最高暴露剂量。',
    domain: '毒理学',
    related: ['ADI', 'LOAEL'],
    reference: 'OECD TG 指导原则',
  },
  'haccp': {
    term: 'HACCP',
    cn: '危害分析与关键控制点',
    definition: 'Hazard Analysis Critical Control Point，国际通用的食品安全管理体系，通过识别和控制关键环节预防危害。',
    domain: '质量管理',
    related: ['ISO22000', 'GMP'],
    reference: 'CAC/RCP 1-1969',
  },
  'iso22000': {
    term: 'ISO 22000',
    cn: '食品安全管理体系',
    definition: '国际标准化组织发布的食品安全管理标准，整合了 HACCP 原理与 ISO 9001 质量管理体系要求。',
    domain: '质量管理',
    related: ['HACCP', 'GMP'],
    reference: 'ISO 22000:2018',
  },

  // ===== 配方工程 =====
  'design_of_experiments': {
    term: 'DOE',
    cn: '试验设计',
    definition: 'Design of Experiments，通过科学的试验安排方法（正交、响应面等）高效地获取最优配方组合的技术。',
    domain: '统计学应用',
    related: ['RSM', 'orthogonal_design'],
    reference: '《试验设计与分析》',
  },
  'rsm': {
    term: 'RSM',
    cn: '响应面分析法',
    definition: 'Response Surface Methodology，利用数学模型拟合多因素与响应值的关系，寻找最优工艺条件的统计方法。',
    domain: '统计学应用',
    related: ['design_of_experiments', 'central_composite'],
    reference: 'Box & Wilson (1951)',
  },
  'stability': {
    term: '稳定性',
    cn: '产品稳定性',
    definition: '食品在一定贮存条件下保持其感官特性、理化性质和微生物安全性的能力，通常通过加速试验评估。',
    domain: '食品保藏',
    related: ['shelf_life', 'arrhenius_equation'],
    reference: 'GB 29905 食品加速试验指南',
  },
  'shelf_life': {
    term: '货架期',
    cn: '保质期',
    definition: '在规定的贮存条件下，产品保持其质量标准的期限，通常由感官评定、理化指标和微生物检验综合确定。',
    domain: '食品保藏',
    related: ['stability', 'accelerated_testing'],
    reference: 'GB 7718 预包装食品标签通则',
  },
}

interface TermDefinition {
  term: string
  cn: string
  definition: string
  domain: string
  related: string[]
  reference: string
}

interface DetectedTerm {
  start: number
  end: number
  definition: TermDefinition
}

interface TermTooltipProps {
  content: string
  /** 自定义术语库（合并到预置库） */
  customTerms?: Record<string, Partial<TermDefinition>>
  /** 触发模式 */
  trigger?: 'hover' | 'click'
  /** 高亮样式 */
  highlightClassName?: string
}

// 从文本中检测术语
function detectTerms(text: string, database: Record<string, TermDefinition>): DetectedTerm[] {
  const detected: DetectedTerm[] = []
  const terms = Object.entries(database)

  for (const [key, def] of terms) {
    // 匹配英文术语（全词匹配）和中文术语
    const patterns = [def.term, def.cn]
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      let match
      while ((match = regex.exec(text)) !== null) {
        // 避免重复检测同一位置
        if (!detected.some(d => match!.index >= d.start && match!.index <= d.end)) {
          detected.push({
            start: match.index,
            end: match.index + pattern.length,
            definition: def,
          })
        }
      }
    }
  }

  // 按位置排序
  detected.sort((a, b) => a.start - b.start)
  return detected
}

export default function TermTooltip({
  content,
  customTerms,
  trigger = 'click',
  highlightClassName = '',
}: TermTooltipProps) {
  const [activeTerm, setActiveTerm] = useState<TermDefinition | null>(null)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const tooltipRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 合并术语库
  const database = useMemo(() => {
    if (!customTerms) return TERM_DATABASE
    const merged = { ...TERM_DATABASE }
    for (const [key, partial] of Object.entries(customTerms)) {
      merged[key] = { ...TERM_DATABASE[key], ...partial } as TermDefinition
    }
    return merged
  }, [customTerms])

  const detectedTerms = useMemo(() => detectTerms(content, database), [content, database])

  // 渲染带高亮的文本
  const renderContent = () => {
    if (detectedTerms.length === 0) return content

    const parts: React.ReactNode[] = []
    let lastIndex = 0

    for (const dt of detectedTerms) {
      // 添加前缀文本
      if (dt.start > lastIndex) {
        parts.push(<span key={`t-${lastIndex}-${dt.start}`}>{content.slice(lastIndex, dt.start)}</span>)
      }

      // 添加高亮术语
      parts.push(
        <span
          key={`term-${dt.start}`}
          className={`inline cursor-pointer border-b border-dashed border-primary-400 text-primary-700 dark:text-primary-300
            hover:bg-primary-50 dark:hover:bg-primary-900/20 px-0.5 rounded transition-colors ${highlightClassName}`}
          data-term-id={dt.definition.term}
          onMouseEnter={trigger === 'hover' ? (e) => showTooltip(dt.definition, e) : undefined}
          onMouseLeave={trigger === 'hover' ? hideTooltip : undefined}
          onClick={trigger === 'click' ? (e) => toggleTooltip(dt.definition, e) : undefined}
        >
          {content.slice(dt.start, dt.end)}
        </span>
      )

      lastIndex = dt.end
    }

    // 添加剩余文本
    if (lastIndex < content.length) {
      parts.push(<span key={`tail-${lastIndex}`}>{content.slice(lastIndex)}</span>)
    }

    return parts
  }

  const showTooltip = (def: TermDefinition, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setPosition({
      top: rect.bottom + window.scrollY + 8,
      left: Math.max(8, rect.left + window.scrollX - 120),
    })
    setActiveTerm(def)
  }

  const hideTooltip = () => setActiveTerm(null)

  const toggleTooltip = (def: TermDefinition, e: React.MouseEvent) => {
    if (activeTerm?.term === def.term) {
      setActiveTerm(null)
    } else {
      showTooltip(def, e)
    }
  }

  // 点击外部关闭
  useEffect(() => {
    if (!activeTerm || trigger !== 'click') return
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
          containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveTerm(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activeTerm, trigger])

  return (
    <div ref={containerRef} className="relative inline">
      {renderContent()}

      {/* 术语解释面板 */}
      {activeTerm && (
        <div
          ref={tooltipRef}
          className="fixed z-50 w-80 rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          style={{ top: position.top, left: position.left }}
        >
          {/* 头部 */}
          <div className="flex items-start justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-indigo-50 dark:from-slate-800 dark:to-indigo-900/20 border-b border-gray-100 dark:border-gray-800">
            <div>
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-primary-500" />
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{activeTerm.cn}</span>
                <span className="text-xs text-gray-400 font-mono">{activeTerm.term}</span>
              </div>
              <span className="text-[10px] text-primary-500 dark:text-primary-400 mt-1 block">{activeTerm.domain}</span>
            </div>
            <button onClick={hideTooltip} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 定义 */}
          <div className="px-4 py-3">
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{activeTerm.definition}</p>

            {/* 相关术语 */}
            {activeTerm.related.length > 0 && (
              <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">相关术语</span>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {activeTerm.related.map(r => (
                    <span key={r} className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      {TERM_DATABASE[r]?.cn || r}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 参考文献 */}
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center gap-1.5 text-[10px] text-gray-400">
              <BookOpen className="w-3 h-3" />
              <span>{activeTerm.reference}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { TERM_DATABASE, type TermDefinition, type DetectedTerm }
