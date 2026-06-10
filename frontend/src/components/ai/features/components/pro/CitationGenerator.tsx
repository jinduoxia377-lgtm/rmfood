/**
 * CitationGenerator — 学术引用格式生成器
 *
 * 支持多种学术引用格式：
 * - GB/T 7714（中国国家标准）
 * - APA 第7版
 * - MLA 第9版
 * - IEEE
 * - Chicago 注释-参考文献格式
 */
import React, { useState, useMemo } from 'react'
import { Quote, Copy, Check, ChevronDown, BookMarked } from 'lucide-react'

export type CitationStyle = 'GB7714' | 'APA7' | 'MLA9' | 'IEEE' | 'Chicago'

interface CitationSource {
  authors: string       // 作者列表，逗号分隔
  title: string         // 文献标题
  journal?: string      // 期刊名称
  year: number          // 发表年份
  volume?: string       // 卷号
  issue?: string        // 期号
  pages?: string        // 页码
  doi?: string          // DOI
  publisher?: string    // 出版社（用于书籍）
  url?: string          // URL
}

interface CitationGeneratorProps {
  sources?: CitationSource[]
  onAddSource?: (source: CitationSource) => void
  visible?: boolean
  onClose?: () => void
}

const STYLE_OPTIONS: { value: CitationStyle; label: string; desc: string }[] = [
  { value: 'GB7714', label: 'GB/T 7714-2015', desc: '中国国家标准' },
  { value: 'APA7', label: 'APA 第7版', desc: '美国心理学会' },
  { value: 'MLA9', label: 'MLA 第9版', desc: '现代语言协会' },
  { value: 'IEEE', label: 'IEEE', desc: '电气电子工程师学会' },
  { value: 'Chicago', label: 'Chicago 17th', desc: '芝加哥格式' },
]

// 引用格式化函数
function formatCitation(source: CitationSource, style: CitationStyle): string {
  const { authors, title, journal, year, volume, issue, pages, doi, publisher, url } = source

  switch (style) {
    case 'GB7714':
      // 张三, 李四. 食品配方优化研究[J]. 食品科学, 2024, 45(3): 123-130.
      return `${authors}. ${title}${journal ? '[J]. ' + journal : ''}, ${year}${volume ? ', ' + volume : ''}${issue ? '(' + issue + ')' : ''}${pages ? ': ' + pages : ''}.${doi ? ' DOI: ' + doi : ''}`

    case 'APA7':
      // Zhang, S., & Li, S. (2024). Food formula optimization research. Food Science, 45(3), 123–130.
      const apaAuthors = authors.split(/[,，]/).map(a => a.trim()).join(', & ')
      return `${apaAuthors} (${year}). ${title}${journal ? '. ' + journal : ''}${volume ? ', ' + volume : ''}${issue ? '(' + issue + ')' : ''}${pages ? ', ' + pages.replace('-', '–') : '.'}`

    case 'MLA9':
      // Zhang, San, and Li Si. "Food Formula Optimization Research." Food Science, vol. 45, no. 3, 2024, pp. 123-30.
      const mlaAuthors = authors.split(/[,，]/).map(a => a.trim()).join(', and ')
      return `${mlaAuthors}. "${title}"${journal ? '. ' + journal : ''}${volume ? ', vol. ' + volume : ''}${issue ? ', no. ' + issue : ''}${year ? ', ' + year : ''}${pages ? ', pp. ' + pages : '.'}`

    case 'IEEE':
      // S. Zhang and S. Li, "Food formula optimization research," Food Science, vol. 45, no. 3, pp. 123-130, 2024.
      const ieeeAuthors = authors.split(/[,，]/).map((a, i) => {
        const parts = a.trim().split(/\s+/)
        return parts.length > 1 ? parts[parts.length - 1] + '. ' + parts.slice(0, -1).join(' ') : a.trim()
      }).join(', ')
      return `${ieeeAuthors}, "${title},"${journal ? ' ' + journal : ''}${volume ? ', vol. ' + volume : ''}${issue ? ', no. ' + issue : ''}${pages ? ', pp. ' + pages : ''}, ${year}.`

    case 'Chicago':
      // Zhang, San, and Li Si. "Food Formula Optimization Research." Food Science 45, no. 3 (2024): 123-30.
      const chiAuthors = authors.split(/[,，]/).map(a => a.trim()).join(', ')
      return `${chiAuthors}. "${title}"${journal ? '. ' + journal : ''} ${volume}${issue ? ', no. ' + issue : ''} (${year})${pages ? ': ' + pages : '.'}`

    default:
      return ''
  }
}

// 示例源数据
const EXAMPLE_SOURCES: CitationSource[] = [
  {
    authors: '张三, 李四',
    title: '功能性食品配方设计与优化研究进展',
    journal: '食品科学',
    year: 2024,
    volume: '45',
    issue: '3',
    pages: '123-130',
    doi: '10.7506/spkx1002-6630-20231234-001',
  },
]

export default function CitationGenerator({ sources = EXAMPLE_SOURCES, onAddSource, visible = true, onClose }: CitationGeneratorProps) {
  const [selectedStyle, setSelectedStyle] = useState<CitationStyle>('GB7714')
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSource, setNewSource] = useState<CitationSource>({
    authors: '', title: '', year: new Date().getFullYear(),
  })

  const formattedSources = useMemo(() =>
    sources.map(s => ({ source: s, formatted: formatCitation(s, selectedStyle) })),
    [sources, selectedStyle]
  )

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const handleAdd = () => {
    if (newSource.title && newSource.authors) {
      onAddSource?.(newSource)
      setNewSource({ authors: '', title: '', year: new Date().getFullYear() })
      setShowAddForm(false)
    }
  }

  if (!visible) return null

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookMarked className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">学术引用生成器</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            ✕
          </button>
        )}
      </div>

      {/* 格式选择 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Quote className="w-3.5 h-3.5 text-gray-400" />
        {STYLE_OPTIONS.map(style => (
          <button
            key={style.value}
            onClick={() => setSelectedStyle(style.value)}
            className={`px-2.5 py-1 rounded-md text-xs transition-all ${
              selectedStyle === style.value
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium ring-1 ring-primary-200 dark:ring-primary-800'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {style.label}
          </button>
        ))}
      </div>

      {/* 引用列表 */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {formattedSources.map(({ source, formatted }, i) => (
          <div key={i} className="group relative p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed pr-16 font-mono">
              {formatted}
            </p>
            <button
              onClick={() => handleCopy(formatted, i)}
              className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity
                hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
            >
              {copiedIndex === i ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}
      </div>

      {/* 操作区 */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
        >
          + 添加文献
        </button>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showAddForm ? 'rotate-180' : ''}`} />

        {/* 全部复制 */}
        <button
          onClick={() => handleCopy(formattedSources.map(f => f.formatted).join('\n\n'), -1)}
          className="ml-auto text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
        >
          <Copy className="w-3 h-3" /> 全部复制
        </button>
      </div>

      {/* 添加表单 */}
      {showAddForm && (
        <div className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="作者（逗号分隔）" value={newSource.authors}
              onChange={e => setNewSource(s => ({ ...s, authors: e.target.value }))}
              className="col-span-2 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs focus:ring-1 focus:ring-primary-500 outline-none" />
            <input placeholder="标题" value={newSource.title}
              onChange={e => setNewSource(s => ({ ...s, title: e.target.value }))}
              className="col-span-2 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs focus:ring-1 focus:ring-primary-500 outline-none" />
            <input placeholder="期刊" value={newSource.journal || ''}
              onChange={e => setNewSource(s => ({ ...s, journal: e.target.value }))}
              className="px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs focus:ring-1 focus:ring-primary-500 outline-none" />
            <input placeholder="年份" type="number" value={newSource.year}
              onChange={e => setNewSource(s => ({ ...s, year: parseInt(e.target.value) || 2024 }))}
              className="px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs focus:ring-1 focus:ring-primary-500 outline-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowAddForm(false)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">取消</button>
            <button onClick={handleAdd} className="px-3 py-1 text-xs bg-primary-500 text-white rounded-md hover:bg-primary-600">确认添加</button>
          </div>
        </div>
      )}
    </div>
  )
}
