/**
 * SmartSuggestions — 上下文感知智能回复建议
 *
 * 基于 AI 最后回复内容，动态生成 3-5 个专业级后续追问选项
 */
import React, { useMemo } from 'react'
import {
  Lightbulb, ArrowRight, FlaskConical, FileText, Search, Beaker,
  Microscope, BookOpen, BarChart3, ShieldCheck, Leaf
} from 'lucide-react'

interface Suggestion {
  icon: React.ReactNode
  title: string
  description: string
  action: string
  category: 'optimize' | 'verify' | 'expand' | 'report' | 'compare' | 'safety'
}

interface SmartSuggestionsProps {
  onSelect: (action: string) => void
  context?: string        // AI 最后一条回复的内容
  messagesCount?: number  // 当前对话消息总数
}

// 基于关键词匹配的建议规则引擎
function generateSuggestions(context: string): Suggestion[] {
  if (!context) return []

  const lower = context.toLowerCase()
  const suggestions: Suggestion[] = []

  // 配方相关 → 优化/验证/对比
  if (lower.includes('配方') || lower.includes('formula') || lower.includes('成分')) {
    suggestions.push(
      { icon: <FlaskConical className="w-3.5 h-3.5" />, title: '优化配方比例', description: '调整组分配比以提升功效', action: '请优化当前配方的各组分比例，重点提升生物利用度', category: 'optimize' },
      { icon: <Microscope className="w-3.5 h-3.5" />, title: '验证安全性', description: '评估配方的毒理学风险', action: '请对该配方进行全面的安全性评估，包括急性毒性、致敏性等', category: 'safety' },
      { icon: <BarChart3 className="w-3.5 h-3.5" />, title: '成本分析', description: '计算配方原料成本', action: '请分析该配方的原料成本构成，并提供降本方案', category: 'optimize' },
    )
  }

  // 药材/中药相关
  if (lower.includes('药材') || lower.includes('中药') || lower.includes('药食同源')) {
    suggestions.push(
      { icon: <Leaf className="w-3.5 h-3.5" />, title: '药材配伍分析', description: '分析君臣佐使配伍合理性', action: '请从君臣佐使角度分析上述药材配伍的科学性', category: 'verify' },
      { icon: <BookOpen className="w-3.5 h-3.5" />, title: '文献依据查询', description: '查找相关的现代研究文献', action: '请提供支持上述结论的现代科学研究文献和临床数据', category: 'expand' },
      { icon: <Beaker className="w-3.5 h-3.5" />, title: '提取工艺设计', description: '制定最佳提取工艺参数', action: '请设计针对上述配方的工业化提取工艺方案', category: 'optimize' },
    )
  }

  // 实验相关
  if (lower.includes('实验') || lower.includes('检测') || lower.includes('测定')) {
    suggestions.push(
      { icon: <Search className="w-3.5 h-3.5" />, title: '方法学验证', description: '建立分析方法验证方案', action: '请按照 ICH 指导原则建立完整的方法学验证方案', category: 'verify' },
      { icon: <FileText className="w-3.5 h-3.5" />, title: '实验报告模板', description: '生成标准实验报告格式', action: '请将以上内容整理为符合 GLP 规范的完整实验报告', category: 'report' },
    )
  }

  // 安全/法规相关
  if (lower.includes('安全') || lower.includes('毒性') || lower.includes('法规') || lower.includes('gb') || lower.includes('标准')) {
    suggestions.push(
      { icon: <ShieldCheck className="w-3.5 h-3.5" />, title: '合规性审查', description: '对照国家标准逐条审查', action: '请对照 GB2760 和 GB14881 标准进行合规性审查', category: 'safety' },
      { icon: <BookOpen className="w-3.5 h-3.5" />, title: '法规解读', description: '解释相关法规条款要求', action: '请详细解读与此产品相关的最新食品安全法规要求', category: 'expand' },
    )
  }

  // 默认通用建议（当没有匹配到具体类别时）
  if (suggestions.length === 0) {
    suggestions.push(
      { icon: <FlaskConical className="w-3.5 h-3.5" />, title: '深入分析', description: '对当前话题进行更深入的专业分析', action: '请对上述内容进行更深入的专业分析和扩展说明', category: 'expand' },
      { icon: <FileText className="w-3.5 h-3.5" />, title: '生成报告', description: '整理为专业学术报告', action: '请将以上对话内容整理为一份专业的学术报告', category: 'report' },
      { icon: <Lightbulb className="w-3.5 h-3.5" />, title: '应用场景', description: '探讨实际应用场景', action: '请探讨上述技术方案在实际生产中的应用场景和注意事项', category: 'expand' },
    )
  }

  // 限制最多 5 条
  return suggestions.slice(0, 5)
}

export default function SmartSuggestions({ onSelect, context, messagesCount = 0 }: SmartSuggestionsProps) {
  const suggestions = useMemo(() => generateSuggestions(context || ''), [context])

  // 仅在有上下文且至少有一轮对话时显示
  if (!context || messagesCount < 2) return null

  return (
    <div className="px-3 py-2.5 bg-gradient-to-r from-slate-50/80 to-indigo-50/30 dark:from-slate-900/20 dark:to-indigo-900/10 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-1.5 mb-2">
        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 tracking-wide">智能续问</span>
        <span className="text-[10px] text-gray-300 dark:text-gray-600 ml-auto">{suggestions.length} 个建议</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSelect(s.action)}
            className={`
              flex items-start gap-2 px-3 py-2 rounded-lg text-left
              transition-all duration-200 group
              ${s.category === 'optimize' ? 'hover:bg-emerald-50 dark:hover:bg-emerald-900/15 hover:border-emerald-200 dark:hover:border-emerald-800' : ''}
              ${s.category === 'verify' ? 'hover:bg-blue-50 dark:hover:bg-blue-900/15 hover:border-blue-200 dark:hover:border-blue-800' : ''}
              ${s.category === 'expand' ? 'hover:bg-violet-50 dark:hover:bg-violet-900/15 hover:border-violet-200 dark:hover:border-violet-800' : ''}
              ${s.category === 'report' ? 'hover:bg-amber-50 dark:hover:bg-amber-900/15 hover:border-amber-200 dark:hover:border-amber-800' : ''}
              ${s.category === 'safety' ? 'hover:bg-red-50 dark:hover:bg-red-900/15 hover:border-red-200 dark:hover:border-red-800' : ''}
              ${s.category === 'compare' ? 'hover:bg-cyan-50 dark:hover:bg-cyan-900/15 hover:border-cyan-200 dark:hover:border-cyan-800' : ''}
              bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800
            `}
          >
            <span className={`flex-shrink-0 mt-0.5 text-gray-400 group-hover:transition-colors
              ${s.category === 'optimize' ? 'group-hover:text-emerald-500' : ''}
              ${s.category === 'verify' ? 'group-hover:text-blue-500' : ''}
              ${s.category === 'expand' ? 'group-hover:text-violet-500' : ''}
              ${s.category === 'report' ? 'group-hover:text-amber-500' : ''}
              ${s.category === 'safety' ? 'group-hover:text-red-500' : ''}
              ${s.category === 'compare' ? 'group-hover:text-cyan-500' : ''}
            `}>
              {s.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                {s.title}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 line-clamp-1 mt-0.5">
                {s.description}
              </div>
            </div>
            <ArrowRight className="w-3 h-3 text-gray-200 group-hover:text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-1 transition-all self-start" />
          </button>
        ))}
      </div>
    </div>
  )
}
