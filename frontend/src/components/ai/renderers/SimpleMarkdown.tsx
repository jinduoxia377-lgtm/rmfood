import { useMemo, useState, useEffect } from 'react'
import DOMPurify from 'dompurify'
import { sanitizeHtml, sanitizeHtmlAsync } from '@/components/ai/features/utils/sanitize'

interface MarkdownBlock {
  type: string
  content: string
}

const FIELD_KEYWORDS = ['配方名称', '配方定位', '剂型', '功能主治', '主要原料', '辅料', '配方', '用量', '用法', '注意事项', '保质期', '储存条件', '执行标准', '生产企业']

function parseContent(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const lines = content.split('\n')
  let currentBlock: MarkdownBlock | null = null
  let tableRows: string[] = []
  let inTable = false

  const flushTable = () => {
    if (tableRows.length > 0) {
      blocks.push({ type: 'table', content: tableRows.join('\n') })
      tableRows = []
    }
    inTable = false
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    if (typeof line === 'string' && (/^\|.*\|$/.exec(line))) {
      if (!inTable) {
        if (currentBlock) { blocks.push(currentBlock); currentBlock = null }
        inTable = true
      }
      if (typeof line === 'string' && !(/^\|[\s\-:|]+\|$/.exec(line))) {
        tableRows.push(line)
      }
      continue
    } else if (inTable) {
      flushTable()
    }

    if (line.trim() === '---') {
      if (currentBlock) { blocks.push(currentBlock); currentBlock = null }
      blocks.push({ type: 'separator', content: '' })
    } else if (line.startsWith('# ')) {
      if (currentBlock) { blocks.push(currentBlock); currentBlock = null }
      blocks.push({ type: 'h1', content: line.slice(2) })
    } else if (line.startsWith('## ')) {
      if (currentBlock) { blocks.push(currentBlock); currentBlock = null }
      blocks.push({ type: 'h2', content: line.slice(3) })
    } else if (line.startsWith('### ')) {
      if (currentBlock) { blocks.push(currentBlock); currentBlock = null }
      blocks.push({ type: 'h3', content: line.slice(4) })
    } else if (line.startsWith('#### ')) {
      if (currentBlock) { blocks.push(currentBlock); currentBlock = null }
      blocks.push({ type: 'h4', content: line.slice(5) })
    } else if (line.startsWith('> ')) {
      if (currentBlock && currentBlock.type !== 'quote') {
        if (currentBlock.type !== 'table') blocks.push(currentBlock)
        currentBlock = null
      }
      if (!currentBlock) currentBlock = { type: 'quote', content: '' }
      currentBlock.content += (currentBlock.content ? '\n' : '') + line.slice(2)
    } else if (typeof line === 'string' && ((/^[-*] /.exec(line)) || (/^\d+\. /.exec(line)))) {
      if (currentBlock && currentBlock.type !== 'list') {
        if (currentBlock.type !== 'table') blocks.push(currentBlock)
        currentBlock = null
      }
      if (!currentBlock) currentBlock = { type: 'list', content: '' }
      currentBlock.content += (currentBlock.content ? '\n' : '') + line
    } else if (line.trim()) {
      if (currentBlock && currentBlock.type !== 'paragraph') {
        blocks.push(currentBlock)
        currentBlock = null
      }
      if (!currentBlock) currentBlock = { type: 'paragraph', content: '' }
      currentBlock.content += (currentBlock.content ? ' ' : '') + line
    } else if (currentBlock?.type === 'paragraph') {
      blocks.push(currentBlock)
      currentBlock = null
    }
  }

  if (currentBlock) {
    if (currentBlock.type !== 'table') blocks.push(currentBlock)
  }
  if (inTable) flushTable()

  return blocks
}

function renderInline(text: string): string {
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  return escapedText
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-neutral-900 dark:text-neutral-100">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-neutral-100 dark:bg-neutral-800 text-primary-600 dark:text-primary-400 px-1 py-0.5 rounded text-xs font-mono">$1</code>')
}

function renderTable(tableContent: string): string {
  const rows = tableContent.split('\n').filter(r => r.trim())
  if (rows.length < 2) return DOMPurify.sanitize(tableContent)

  const parseCells = (row: string) => row.split('|').slice(1, -1).map(c => c.trim())

  const headerCells = parseCells(rows[0] ?? '')
  const bodyRows = rows.slice(1)

  const hasRoleColumn = headerCells.some(h => /角色|组分类型|组方位置/i.test(h))

  let html = '<div class="overflow-x-auto my-4 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm bg-white dark:bg-neutral-800">'
  html += '<table class="w-full border-collapse min-w-[600px] md:min-w-0">'
  html += '<thead><tr class="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/40 dark:to-primary-800/30">'
  headerCells.forEach((cell, idx) => {
    const isCenter = /组分类型|角色|用量|单袋用量|100份用量|作用定位|核心依据/i.test(cell)
    const isSticky = idx === 0 && hasRoleColumn
    html += `<th class="px-3 py-3.5 ${isCenter ? 'text-center' : 'text-left'} text-xs font-bold text-primary-800 dark:text-primary-200 border-b-2 border-primary-300 dark:border-primary-600 tracking-wide uppercase ${isSticky ? 'sticky left-0 bg-primary-100/90 dark:bg-primary-900/60 z-10' : ''}">${renderInline(cell)}</th>`
  })
  html += '</tr></thead><tbody>'
  bodyRows.forEach((row, idx) => {
    const cells = parseCells(row)
    const zebraClass = idx % 2 === 0 ? 'bg-white dark:bg-neutral-800' : 'bg-slate-50/70 dark:bg-neutral-900/30'
    html += `<tr class="${zebraClass} hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition-colors duration-150">`
    cells.forEach((cell, cIdx) => {
      const isCenter = cIdx === 0 || /用量|剂量/.test(headerCells[cIdx] ?? '')
      const isSticky = cIdx === 0 && hasRoleColumn
      const isHighlight = /君|臣|佐|使/i.test(cell)
      const cellClass = isHighlight
        ? 'font-semibold text-primary-700 dark:text-primary-300'
        : 'text-neutral-700 dark:text-neutral-300'
      const bgClass = isHighlight ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''
      html += `<td class="px-3 py-2.5 text-sm ${isCenter ? 'text-center' : 'text-left'} ${cellClass} ${bgClass} ${cIdx < cells.length - 1 ? 'border-r border-neutral-100 dark:border-neutral-700/50' : ''} ${isSticky ? 'sticky left-0 z-10 ' + zebraClass : ''}">${renderInline(cell)}</td>`
    })
    html += '</tr>'
  })
  html += '</tbody></table></div>'
  return html
}

function isFieldLine(text: string): { isField: boolean; fieldName: string; fieldValue: string } {
  for (const kw of FIELD_KEYWORDS) {
    if (text.startsWith(kw) && text.length > kw.length) {
      const rest = text.slice(kw.length).trim()
      if (rest.startsWith(':') || rest.startsWith('：') || rest.startsWith('-') || rest.startsWith('—')) {
        return { isField: true, fieldName: kw, fieldValue: rest.slice(1).trim() }
      }
    }
  }
  return { isField: false, fieldName: '', fieldValue: '' }
}

export interface SimpleMarkdownProps {
  content: string
  className?: string
}

export function SimpleMarkdown({ content, className = '' }: SimpleMarkdownProps) {
  const blocks = useMemo(() => parseContent(typeof content === 'string' ? content : ''), [content])

  const rawHtml = useMemo(() => {
    return blocks.map((block) => {
      switch (block.type) {
        case 'h1':
          return `<h1 class="text-[26px] font-bold text-neutral-900 dark:text-neutral-100 pb-3 mb-4 border-b-2 border-primary-200 dark:border-primary-800 leading-tight">${renderInline(block.content)}</h1>`
        case 'h2':
          return `<h2 class="text-[20px] font-bold text-neutral-900 dark:text-neutral-100 mt-6 mb-3 pl-3 border-l-4 border-primary-500 leading-snug">${renderInline(block.content)}</h2>`
        case 'h3':
          return `<h3 class="text-[16px] font-bold text-neutral-800 dark:text-neutral-200 mt-4 mb-2 leading-snug">${renderInline(block.content)}</h3>`
        case 'h4':
          return `<h4 class="text-[14px] font-medium text-neutral-700 dark:text-neutral-300 mt-3 mb-1 leading-snug">${renderInline(block.content)}</h4>`
        case 'separator':
          return `<div class="my-5 border-t-2 border-dashed border-neutral-200 dark:border-neutral-700"></div>`
        case 'quote':
          return `<blockquote class="my-3 pl-4 pr-3 py-2 border-l-4 border-primary-400 bg-primary-50/50 dark:bg-primary-900/10 rounded-r-lg italic text-neutral-700 dark:text-neutral-300 text-sm leading-relaxed">${renderInline(block.content.replace(/\n/g, '<br />'))}</blockquote>`
        case 'table':
          return renderTable(block.content)
        case 'list': {
          const items = block.content.split('\n')
          const listClass = /^\d/.exec(items[0]) ? 'list-decimal' : 'list-disc'
          const listItems = items.map(item => {
            const text = item.replace(/^[-*] /, '').replace(/^\d+\. /, '')
            return `<li class="ml-6 mb-1 text-neutral-700 dark:text-neutral-300 leading-relaxed">${renderInline(text)}</li>`
          }).join('')
          return `<ul class="my-3 space-y-1 ${listClass} text-sm">${listItems}</ul>`
        }
        case 'paragraph': {
          const field = isFieldLine(block.content)
          if (field.isField) {
            return `<div class="my-3 p-3 bg-slate-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-100 dark:border-neutral-700/50">
              <span class="text-sm font-semibold text-primary-600 dark:text-primary-400">${field.fieldName}</span>
              <span class="text-neutral-400 mx-1">:</span>
              <span class="text-sm text-neutral-800 dark:text-neutral-200">${renderInline(field.fieldValue)}</span>
            </div>`
          }
          return `<p class="my-3 text-sm text-neutral-700 dark:text-neutral-300 leading-[1.7]">${renderInline(block.content)}</p>`
        }
        default:
          return ''
      }
    }).join('')
  }, [blocks])

  const [sanitizedHtml, setSanitizedHtml] = useState<string>('')
  const [isSanitizing, setIsSanitizing] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function performSanitization() {
      if (!rawHtml) {
        setSanitizedHtml('')
        return
      }

      setIsSanitizing(true)

      try {
        const result = await sanitizeHtmlAsync(rawHtml)

        if (isMounted) {
          setSanitizedHtml(result)
        }
      } catch (error) {
        if (isMounted) {
          const fallbackResult = sanitizeHtml(rawHtml)
          setSanitizedHtml(fallbackResult)
        }
      } finally {
        if (isMounted) {
          setIsSanitizing(false)
        }
      }
    }

    performSanitization()

    return () => {
      isMounted = false
    }
  }, [rawHtml])

  if (isSanitizing && !sanitizedHtml) {
    return (
      <div className={`animate-pulse bg-neutral-100 dark:bg-neutral-800 rounded-lg h-32 ${className}`} />
    )
  }

  // 🔒 P0 安全修复: 确保 sanitizedHtml 存在才渲染
  // 消毒失败时返回安全的占位符，绝不回退到未消毒的 rawHtml
  if (!sanitizedHtml) {
    // 消毒失败时返回安全占位符，不显示可能包含恶意脚本的内容
    return (
      <div className={`text-sm leading-[1.7] space-y-1 ${className}`}>
        <span className="text-neutral-500 italic">[内容已过滤]</span>
      </div>
    )
  }

  return (
    <div
      className={`text-sm leading-[1.7] space-y-1 ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}
