/**
 * MarkdownRenderer — 专业级 Markdown 渲染引擎（零外部依赖）
 *
 * 支持：标题层级、粗体/斜体/删除线/高亮/键盘键/上下标、链接、图片、
 *       专业表格（对齐/斑马纹/sticky表头/响应式）、嵌套引用块、
 *       嵌套列表+任务列表、Callout提示块、增强代码块（行号/文件名/折叠）、
 *       数学公式（行内/块级）、脚注、自动目录、分隔线变体、FormulaCard集成
 */
import React, { useState } from 'react'
import {
  Copy, Check, ChevronDown, ChevronUp,
  Info, AlertTriangle, CheckCircle, XCircle, Lightbulb, MessageSquare,
  Image as ImageIcon, Link2, Hash
} from 'lucide-react'
import FormulaCard from './FormulaCard'
import type { FormulaData } from './FormulaCard'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MarkdownRendererProps {
  content: string
}

type AlignType = 'left' | 'center' | 'right'

type CalloutType = 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR' | 'TIP' | 'NOTE'

interface HeadingInfo {
  level: number
  text: string
  id: string
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CALLOUT_CONFIG: Record<CalloutType, {
  icon: typeof Info
  label: string
  bgColor: string
  borderColor: string
  iconColor: string
  titleColor: string
}> = {
  INFO:     { icon: Info,          label: '信息',   bgColor: 'bg-blue-50 dark:bg-blue-950/40', borderColor: 'border-blue-200 dark:border-blue-800', iconColor: 'text-blue-500',    titleColor: 'text-blue-700 dark:text-blue-300' },
  WARNING:  { icon: AlertTriangle,  label: '警告',   bgColor: 'bg-amber-50 dark:bg-amber-950/40', borderColor: 'border-amber-200 dark:border-amber-800', iconColor: 'text-amber-500',  titleColor: 'text-amber-700 dark:text-amber-300' },
  SUCCESS:  { icon: CheckCircle,    label: '成功',   bgColor: 'bg-green-50 dark:bg-green-950/40', borderColor: 'border-green-200 dark:border-green-800', iconColor: 'text-green-500',  titleColor: 'text-green-700 dark:text-green-300' },
  ERROR:    { icon: XCircle,       label: '错误',   bgColor: 'bg-red-50 dark:bg-red-950/40', borderColor: 'border-red-200 dark:border-red-800', iconColor: 'text-red-500',    titleColor: 'text-red-700 dark:text-red-300' },
  TIP:      { icon: Lightbulb,     label: '提示',   bgColor: 'bg-indigo-50 dark:bg-indigo-950/40', borderColor: 'border-indigo-200 dark:border-indigo-800', iconColor: 'text-indigo-500',  titleColor: 'text-indigo-700 dark:text-indigo-300' },
  NOTE:     { icon: MessageSquare,  label: '注意',   bgColor: 'bg-gray-50 dark:bg-gray-900/40', borderColor: 'border-gray-200 dark:border-gray-700', iconColor: 'text-gray-500',   titleColor: 'text-gray-700 dark:text-gray-300' },
}

const LANG_COLORS: Record<string, string> = {
  python: '#3776ab', javascript: '#f7df1e', typescript: '#3178c6',
  java: '#ed8b00', go: '#00add8', rust: '#dea584', cpp: '#00599c',
  c: '#555555', ruby: '#cc342d', php: '#777bb4', swift: '#fa7343',
  kotlin: '#7f52ff', shell: '#89e051', bash: '#89e051',
  json: '#292929', sql: '#e38c28', html: '#e34c26', css: '#264de4',
  yaml: '#cb171e', markdown: '#083fa1', default: '#6b7280',
}

const BULLET_STYLES = ['\u2022', '\u25CB', '\u25AA'] /* • ◦ ▪ */

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** 生成安全的 anchor id */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** 解析表格分隔行获取列对齐方式 */
function parseAlignments(separatorRow: string[]): AlignType[] {
  return separatorRow.map(cell => {
    const trimmed = cell.trim()
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center'
    if (trimmed.endsWith(':')) return 'right'
    return 'left'
  })
}

/** 检测 callout 类型 */
function detectCalloutType(line: string): CalloutType | null {
  const m = line.match(/^>\s*\[!(INFO|WARNING|SUCCESS|ERROR|TIP|NOTE)\]\s*(.*)/)
  if (!m) return null
  return m[1] as CalloutType
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null

  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  const headings: HeadingInfo[] = []

  // --- 状态机变量 ---
  let inCodeBlock = false
  let codeContent = ''
  let codeLang = ''
  let codeFilename = ''

  let inTable = false
  let tableRows: string[][] = []

  let inBlockquote = false
  let bqLines: string[] = []
  let bqNestLevel = 0

  let inCallout = false
  let calloutType: CalloutType | null = null
  let calloutTitle = ''
  let calloutLines: string[] = []

  let inMathBlock = false
  let mathContent = ''

  // --- 脚注收集 ---
  const footnotes: Map<string, string> = new Map()

  /* ---- flush helpers ---- */

  const flushTable = () => {
    if (tableRows.length < 2) { tableRows = []; return }
    elements.push(
      <TableRenderer key={`table-${elements.length}`} rows={tableRows} />
    )
    tableRows = []
  }

  const flushBlockquote = () => {
    if (bqLines.length > 0) {
      elements.push(
        <BlockquoteRenderer key={`bq-${elements.length}`} lines={bqLines} nestLevel={bqNestLevel} />
      )
      bqLines = []
      bqNestLevel = 0
    }
  }

  const flushCallout = () => {
    if (calloutLines.length > 0 && calloutType) {
      elements.push(
        <CalloutBlock key={`callout-${elements.length}`}
          type={calloutType} title={calloutTitle} lines={calloutLines}
        />
      )
      calloutLines = []
      calloutType = null
      calloutTitle = ''
    }
    inCallout = false
  }

  /* ---- 主循环 ---- */

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    // ====== 代码块 ======
    if (trimmedLine.startsWith('```')) {
      // 先关闭其他状态
      if (inTable) { flushTable(); inTable = false }
      if (inBlockquote) { flushBlockquote(); inBlockquote = false }
      if (inCallout) flushCallout()

      if (inCodeBlock) {
        elements.push(
          <CodeBlockEnhanced key={`code-${elements.length}`}
            code={codeContent} lang={codeLang} filename={codeFilename}
          />
        )
        codeContent = ''
        codeLang = ''
        codeFilename = ''
        inCodeBlock = false
      } else {
        inCodeBlock = true
        const langStr = trimmedLine.slice(3).trim()
        // 支持语言:文件名 语法
        const colonIdx = langStr.indexOf(':')
        if (colonIdx > 0) {
          codeLang = langStr.slice(0, colonIdx).trim()
          codeFilename = langStr.slice(colonIdx + 1).trim()
        } else {
          codeLang = langStr
          codeFilename = ''
        }
      }
      continue
    }

    if (inCodeBlock) {
      codeContent += (codeContent ? '\n' : '') + line
      continue
    }

    // ====== 块级数学公式 $$...$$ ======
    if (trimmedLine.startsWith('$$')) {
      if (inTable) { flushTable(); inTable = false }
      if (inBlockquote) { flushBlockquote(); inBlockquote = false }
      if (inCallout) flushCallout()

      if (inMathBlock) {
        elements.push(
          <div key={`math-${elements.length}`} className="my-3 flex justify-center">
            <FormulaCard data={{ name: '公式', description: mathContent, ingredients: [], effects: [] }} />
          </div>
        )
        mathContent = ''
        inMathBlock = false
      } else {
        inMathBlock = true
      }
      continue
    }

    if (inMathBlock) {
      mathContent += (mathContent ? '\n' : '') + line
      continue
    }

    // ====== 表格 ======
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      if (inBlockquote) { flushBlockquote(); inBlockquote = false }
      if (inCallout) flushCallout()

      const cells = line.split('|').filter(c => c !== '')
      if (!inTable) { inTable = true; tableRows = [] }
      tableRows.push(cells)
      continue
    } else if (inTable) {
      // 表格结束：检查下一行是否还是表格（处理空行在表格中间的情况）
      if (trimmedLine === '' && i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
        continue // 表格内的空行跳过
      }
      flushTable()
      inTable = false
    }

    // ====== 引用块 / Callout ======
    if (trimmedLine.startsWith('>')) {
      // 检测是否是 callout 起始
      const ct = detectCalloutType(trimmedLine)
      if (ct && !inCallout && !inBlockquote) {
        // 关闭之前的引用
        if (inBlockquote) flushBlockquote()
        inCallout = true
        calloutType = ct
        const titleMatch = trimmedLine.match(/^>\s*\[!\w+\]\s*(.*)/)
        calloutTitle = titleMatch?.[1] || ''
        calloutLines = []
        continue
      }

      if (inCallout) {
        // callout 内的 > 行作为内容继续
        const contentLine = trimmedLine.replace(/^>\s*/, '')
        calloutLines.push(contentLine)
        continue
      }

      if (!inBlockquote) {
        inBlockquote = true
        bqLines = []
        bqNestLevel = 0
      }

      // 计算嵌套层级
      let lvl = 0
      let rest = trimmedLine
      while (rest.startsWith('>')) { lvl++; rest = rest.slice(1).trimStart() }
      if (lvl > bqNestLevel) bqNestLevel = lvl
      bqLines.push(rest)
      continue
    } else {
      if (inBlockquote) { flushBlockquote(); inBlockquote = false }
      if (inCallout) flushCallout()
    }

    // ====== 脚注定义 ======
    const fnDefMatch = trimmedLine.match(/^\[\^(\d+)\]:\s*(.*)/)
    if (fnDefMatch) {
      footnotes.set(fnDefMatch[1], fnDefMatch[2])
      continue
    }

    // ====== 空行 ======
    if (trimmedLine === '') {
      elements.push(<div key={`sp-${i}`} className="h-2" />)
      continue
    }

    // ====== 标题 H1-H4 ======
    const h4Match = trimmedLine.match(/^####\s+(.+)/)
    if (h4Match) {
      const text = h4Match[1]
      const id = slugify(text)
      headings.push({ level: 4, text, id })
      elements.push(
        <h4 key={i} id={id} className="chat-md-h4">
          {renderInline(text)}
        </h4>
      )
      continue
    }
    const h3Match = trimmedLine.match(/^###\s+(.+)/)
    if (h3Match) {
      const text = h3Match[1]
      const id = slugify(text)
      headings.push({ level: 3, text, id })
      elements.push(
        <h3 key={i} id={id} className="chat-md-h3">
          {renderInline(text)}
        </h3>
      )
      continue
    }
    const h2Match = trimmedLine.match(/^##\s+(.+)/)
    if (h2Match) {
      const text = h2Match[1]
      const id = slugify(text)
      headings.push({ level: 2, text, id })
      elements.push(
        <h2 key={i} id={id} className="chat-md-h2">
          {renderInline(text)}
        </h2>
      )
      continue
    }
    const h1Match = trimmedLine.match(/^#\s+(.+)/)
    if (h1Match) {
      const text = h1Match[1]
      const id = slugify(text)
      headings.push({ level: 1, text, id })
      elements.push(
        <h1 key={i} id={id} className="chat-md-h1">
          {renderInline(text)}
        </h1>
      )
      continue
    }

    // ====== 分隔线变体 ======
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmedLine)) {
      elements.push(<hr key={i} className="chat-md-hr" />)
      continue
    }

    // ====== 任务列表 ======
    const taskMatch = trimmedLine.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)/)
    if (taskMatch) {
      const indent = taskMatch[1].length
      const checked = taskMatch[2].toLowerCase() === 'x'
      const text = taskMatch[3]
      elements.push(
        <div key={i} className={`chat-md-task-item ${indent >= 2 ? 'chat-md-nested-1' : indent >= 4 ? 'chat-md-nested-2' : ''}`}>
          <span className={`chat-md-checkbox ${checked ? 'chat-md-checked' : ''}`}>
            {checked ? '\u2713' : ''}
          </span>
          <span className={`${checked ? 'line-through opacity-60' : ''}`}>{renderInline(text)}</span>
        </div>
      )
      continue
    }

    // ====== 无序列表（含嵌套） ======
    const ulMatch = trimmedLine.match(/^(\s*)[-*+]\s+(.*)/)
    if (ulMatch) {
      const indent = ulMatch[1].length
      const text = ulMatch[2]
      const depth = Math.min(Math.floor(indent / 2), 2)
      elements.push(
        <div key={i} className={`chat-md-ul-item ${depth > 0 ? `chat-md-nested-${depth}` : ''}`}>
          <span className="chat-md-bullet">{BULLET_STYLES[depth]}</span>
          <span>{renderInline(text)}</span>
        </div>
      )
      continue
    }

    // ====== 有序列表 ======
    const olMatch = trimmedLine.match(/^(\s*)(\d+)[.)]\s+(.*)/)
    if (olMatch) {
      const num = olMatch[2]
      const text = olMatch[3]
      const indent = olMatch[1].length
      const depth = Math.min(Math.floor(indent / 2), 2)
      elements.push(
        <div key={i} className={`chat-md-ol-item ${depth > 0 ? `chat-md-nested-${depth}` : ''}`}>
          <span className="chat-md-ol-num">{num}.</span>
          <span>{renderInline(text)}</span>
        </div>
      )
      continue
    }

    // ====== 图片 ======
    const imgMatch = trimmedLine.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imgMatch) {
      elements.push(
        <figure key={i} className="chat-md-figure">
          <img src={imgMatch[2]} alt={imgMatch[1]} className="chat-md-img" loading="lazy" />
          {imgMatch[1] && <figcaption className="chat-md-figcaption">{imgMatch[1]}</figcaption>}
        </figure>
      )
      continue
    }

    // ====== 普通段落（含内联公式和脚注） ======
    elements.push(
      <p key={i} className="chat-md-p">
        {renderInline(trimmedLine, footnotes)}
      </p>
    )
  }

  // ---- 收尾未闭合的状态 ----
  if (inCodeBlock && codeContent) {
    elements.push(
      <CodeBlockEnhanced key={`code-end`} code={codeContent} lang={codeLang} filename={codeFilename} />
    )
  }
  if (inTable) flushTable()
  if (inBlockquote) flushBlockquote()
  if (inCallout) flushCallout()
  if (inMathBlock && mathContent) {
    elements.push(
      <div key={`math-end`} className="my-3 flex justify-center">
        <FormulaCard data={{ name: '公式', description: mathContent, ingredients: [], effects: [] }} />
      </div>
    )
  }

  // ---- 脚注渲染 ----
  if (footnotes.size > 0) {
    elements.push(
      <footer key="footnotes" className="chat-md-footnotes">
        <div className="chat-md-footnotes-divider" />
        {Array.from(footnotes.entries()).map(([key, value]) => (
          <div key={key} className="chat-md-footnote-item">
            <sup className="chat-md-footnote-ref"><a href={`#fn-${key}`} id={`fnref-${key}`}>{key}</a></sup>
            <span>{renderInline(value)}</span>
          </div>
        ))}
      </footer>
    )
  }

  // ---- 自动目录（>=3 个 h2 时生成） ----
  const h2Headings = headings.filter(h => h.level === 2)
  const showTOC = h2Headings.length >= 3

  return (
    <div className="chat-md-root">
      {showTOC && (
        <nav className="chat-md-toc">
          <details open>
            <summary className="chat-md-toc-summary">
              <Hash className="w-3.5 h-3.5" />
              <span>目录</span>
              <ChevronDown className="w-3 h-3 chat-md-toc-chevron" />
            </summary>
            <ol className="chat-md-toc-list">
              {h2Headings.map(h => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className="chat-md-toc-link">{h.text}</a>
                </li>
              ))}
            </ol>
          </details>
        </nav>
      )}
      {elements}
    </div>
  )
}

/* ================================================================== */
/*  内联渲染引擎                                                        */
/* ================================================================== */

/**
 * 渲染内联格式：粗体、斜体、删除线、高亮、键盘键、上标、下标、
 *             行内代码、链接、图片、行内数学公式、脚注引用
 */
function renderInline(text: string, footnotes?: Map<string, string>): React.ReactNode {
  const parts: React.ReactNode[] = []
  let remaining = text
  let idx = 0

  while (remaining.length > 0) {
    // 按优先级匹配各种内联格式
    const patterns: Array<{
      regex: RegExp
      type: string
      groupIndex?: number
    }> = [
      // 粗体 **text** （放在前面避免被其他 * 规则捕获）
      { regex: /\*\*(.+?)\*\*/s, type: 'bold', groupIndex: 1 },
      // 斜体 *text* 或 _text_（排除已匹配的 **）
      { regex: /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/s, type: 'italic', groupIndex: 1 },
      // 删除线 ~~text~~
      { regex: /~~(.+?)~~/s, type: 'strikethrough', groupIndex: 1 },
      // 高亮 ==text==
      { regex: /==(.+?)==/s, type: 'highlight', groupIndex: 1 },
      // 键盘按键 [[text]] 或 <kbd>text</kbd>
      { regex: /\[\[(.+?)\]\]/s, type: 'kbd', groupIndex: 1 },
      { regex: /<kbd>(.+?)<\/kbd>/is, type: 'kbd', groupIndex: 1 },
      // 上标 ^text^
      { regex: /\^(.+?)\^/s, type: 'sup', groupIndex: 1 },
      // 下标 ~text~（非删除线上下文时）
      { regex: /(?<!~~)~(.+?)~(?!~~)/s, type: 'sub', groupIndex: 1 },
      // 行内代码 `code`
      { regex: /`([^`\n]+)`/, type: 'code', groupIndex: 1 },
      // 行内数学公式 $...$
      { regex: /\$(.+?)\$/, type: 'math-inline', groupIndex: 1 },
      // 图片 ![alt](url)
      { regex: /!\[([^\]]*)\]\(([^)]+)\)/, type: 'image' },
      // 链接 [text](url)
      { regex: /\[([^\]]+)\]\(([^)]+)\)/, type: 'link' },
      // 脚注引用 [^1]
      { regex: /\[\^(\d+)\]/, type: 'footnote-ref', groupIndex: 1 },
    ]

    let earliestIndex = remaining.length + 1
    let earliestMatch: RegExpMatchArray | null = null
    let matchType = ''

    for (const p of patterns) {
      const match = remaining.match(p.regex)
      if (match && match.index! < earliestIndex) {
        earliestIndex = match.index!
        earliestMatch = match
        matchType = p.type
      }
    }

    if (!earliestMatch || earliestIndex >= remaining.length) {
      parts.push(remaining)
      break
    }

    // 前缀文本
    if (earliestIndex > 0) {
      parts.push(remaining.slice(0, earliestIndex))
    }

    // 根据类型渲染
    switch (matchType) {
      case 'bold':
        parts.push(<strong key={idx++} className="chat-md-bold">{earliestMatch[1]}</strong>)
        break
      case 'italic':
        parts.push(<em key={idx++} className="chat-md-italic">{earliestMatch[1]}</em>)
        break
      case 'strikethrough':
        parts.push(<del key={idx++} className="chat-md-del">{earliestMatch[1]}</del>)
        break
      case 'highlight':
        parts.push(<mark key={idx++} className="chat-md-mark">{earliestMatch[1]}</mark>)
        break
      case 'kbd':
        parts.push(<kbd key={idx++} className="chat-md-kbd">{earliestMatch[1]}</kbd>)
        break
      case 'sup':
        parts.push(<sup key={idx++} className="chat-md-sup">{earliestMatch[1]}</sup>)
        break
      case 'sub':
        parts.push(<sub key={idx++} className="chat-md-sub">{earliestMatch[1]}</sub>)
        break
      case 'code':
        parts.push(<code key={idx++} className="chat-md-inline-code">{earliestMatch[1]}</code>)
        break
      case 'math-inline':
        parts.push(
          <span key={idx++} className="chat-md-math-inline">
            <FormulaCard data={{ name: '', description: earliestMatch[1], ingredients: [], effects: [] }} />
          </span>
        )
        break
      case 'image':
        parts.push(
          <img key={idx++} src={earliestMatch[2]} alt={earliestMatch[1] || ''} className="chat-md-inline-img" />
        )
        break
      case 'link':
        parts.push(
          <a key={idx++} href={earliestMatch[2]} target="_blank" rel="noopener noreferrer" className="chat-md-link">
            {earliestMatch[1]}
            <Link2 className="inline w-3 h-3 ml-0.5 opacity-50" />
          </a>
        )
        break
      case 'footnote-ref': {
        const refKey = earliestMatch[1]
        const hasDef = footnotes?.has(refKey)
        parts.push(
          <sup key={idx++}>
            <a href={`#fnref-${refKey}`} id={`fn-${refKey}`}
              className={`chat-md-fn-ref ${hasDef ? '' : 'chat-md-fn-missing'}`}>
              [{refKey}]
            </a>
          </sup>
        )
        break
      }
      default:
        parts.push(earliestMatch[0])
    }

    remaining = remaining.slice(earliestIndex + earliestMatch[0].length)
  }

  return parts.length > 0 ? parts : text
}

/* ================================================================== */
/*  子组件：专业表格                                                    */
/* ================================================================== */

interface TableProps {
  rows: string[][]
}

function TableRenderer({ rows }: TableProps) {
  if (rows.length < 2) return null

  const headerRow = rows[0]
  const separatorRow = rows[1]
  const dataRows = rows.slice(2).filter(r =>
    !r.every(c => /^[-:\s]+$/.test(c))
  )

  if (headerRow.length === 0) return null

  const alignments = parseAlignments(separatorRow)
  const isLongTable = dataRows.length > 5

  const alignClass = (align: AlignType) => {
    switch (align) {
      case 'center': return 'text-center'
      case 'right':  return 'text-right'
      default:       return 'text-left'
    }
  }

  return (
    <div className="chat-md-table-wrap">
      <table className="chat-md-table">
        <thead className={isLongTable ? 'chat-md-thead-sticky' : ''}>
          <tr>
            {headerRow.map((cell, i) => (
              <th key={i} className={`chat-md-th ${alignClass(alignments[i] || 'left')}`}>
                {renderInline(cell.trim())}
              </th>
            ))}
          </tr>
        </thead>
        {dataRows.length > 0 ? (
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? 'chat-md-row-alt' : ''}>
                {row.map((cell, ci) => (
                  <td key={ci} className={`chat-md-td ${alignClass(alignments[ci] || 'left')}`}>
                    {renderInline(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ) : (
          <tbody>
            <tr>
              <td colSpan={headerRow.length} className="chat-md-empty-cell">
                <ImageIcon className="w-4 h-4 opacity-30 mb-1" />
                <span>暂无数据</span>
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  )
}

/* ================================================================== */
/*  子组件：引用块                                                      */
/* ================================================================== */

interface BlockquoteProps {
  lines: string[]
  nestLevel: number
}

function BlockquoteRenderer({ lines, nestLevel }: BlockquoteProps) {
  // 嵌套颜色递进：每层使用更淡的色调
  const borderColors = [
    'border-l-blue-400 bg-blue-50/40 dark:bg-blue-950/20',
    'border-l-purple-400 bg-purple-50/40 dark:bg-purple-950/20',
    'border-l-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20',
  ]
  const styleIdx = Math.min(nestLevel - 1, borderColors.length - 1)

  return (
    <blockquote className={`chat-md-blockquote ${borderColors[styleIdx]}`}>
      {lines.map((l, i) => (
        <p key={i} className="chat-md-bq-line">{renderInline(l)}</p>
      ))}
    </blockquote>
  )
}

/* ================================================================== */
/*  子组件：Callout 提示块                                              */
/* ================================================================== */

interface CalloutProps {
  type: CalloutType
  title: string
  lines: string[]
}

function CalloutBlock({ type, title, lines }: CalloutProps) {
  const config = CALLOUT_CONFIG[type]
  const Icon = config.icon

  return (
    <div className={`chat-md-callout ${config.bgColor} ${config.borderColor}`}>
      <div className="chat-md-callout-header">
        <Icon className={`w-4 h-4 ${config.iconColor} flex-shrink-0`} />
        <span className={`chat-md-callout-title ${config.titleColor}`}>
          {title || config.label}
        </span>
      </div>
      <div className="chat-md-callout-body">
        {lines.map((l, i) => (
          <p key={i} className="chat-md-callout-line">{renderInline(l)}</p>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  子组件：增强代码块                                                   */
/* ================================================================== */

interface CodeBlockProps {
  code: string
  lang?: string
  filename?: string
}

function CodeBlockEnhanced({ code, lang, filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const codeLines = code.split('\n')
  const isShort = codeLines.length <= 20
  const isLong = codeLines.length > 15
  // 短代码自动显示行号，长代码默认折叠
  const showLineNumbers = isShort
  const shouldCollapse = isLong

  const displayLang = lang || 'text'
  const langColor = LANG_COLORS[displayLang.toLowerCase()] || LANG_COLORS.default

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const visibleCode = expanded ? code : codeLines.slice(0, 15).join('\n')

  return (
    <div className="chat-md-code-block">
      {/* 头部栏 */}
      <div className="chat-md-code-header">
        <div className="chat-md-code-meta">
          {/* 语言标识圆点 */}
          <span
            className="chat-md-lang-dot"
            style={{ backgroundColor: langColor }}
          />
          <span className="chat-md-lang-label">{displayLang}</span>
          {filename && (
            <>
              <span className="chat-md-code-sep">:</span>
              <span className="chat-md-filename">{filename}</span>
            </>
          )}
        </div>
        <div className="chat-md-code-actions">
          {shouldCollapse && (
            <button onClick={() => setExpanded(!expanded)}
              className="chat-md-code-btn"
              title={expanded ? '收起' : '展开'}
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span className="text-[10px] ml-0.5">{expanded ? '收起' : `${codeLines.length} 行`}</span>
            </button>
          )}
          <button onClick={handleCopy} className="chat-md-code-btn" title="复制代码">
            {copied
              ? <Check className="w-3.5 h-3.5 text-green-400" />
              : <Copy className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>

      {/* 代码区 */}
      <div className="chat-md-code-body">
        {showLineNumbers ? (
          <div className="flex">
            {/* 行号 */}
            <div className="chat-md-line-numbers select-none">
              {visibleCode.split('\n').map((_, li) => (
                <div key={li} className="chat-md-ln">{li + 1}</div>
              ))}
            </div>
            {/* 代码 */}
            <pre className="chat-md-pre">
              <code>{visibleCode}</code>
            </pre>
          </div>
        ) : (
          <pre className="chat-md-pre">
            <code>{visibleCode}</code>
          </pre>
        )}
      </div>

      {/* 折叠提示 */}
      {!expanded && shouldCollapse && (
        <button onClick={() => setExpanded(true)} className="chat-md-expand-hint">
          展开全部 ({codeLines.length} 行)
          <ChevronDown className="w-3 h-3 ml-1" />
        </button>
      )}
    </div>
  )
}

/* ================================================================== */
/*  CSS-in-JS 样式（通过 <style> 注入）                                  */
/* ================================================================== */

/**
 * 所有样式使用 chat-md- 前缀，采用 CSS 自定义属性支持暗色模式。
 * 组件挂载时注入一次即可。
 */

const MDStyles = `
/* ===== Root Container ===== */
.chat-md-root {
  @apply space-y-1;
}

/* ===== Headings ===== */
.chat-md-h1 {
  font-size: 1.35em;
  font-weight: 700;
  line-height: 1.35;
  margin-top: 1.25em;
  margin-bottom: 0.65em;
  padding-bottom: 0.35em;
  color: #111827;
  border-bottom: 2px solid #e5e7eb;
  scroll-margin-top: 1em;
}
.dark .chat-md-h1 {
  color: #f3f4f6;
  border-bottom-color: #374151;
}

.chat-md-h2 {
  font-size: 1.18em;
  font-weight: 650;
  line-height: 1.4;
  margin-top: 1.15em;
  margin-bottom: 0.55em;
  padding-left: 0.65em;
  color: #1f2937;
  border-left: 3.5px solid #6366f1;
  scroll-margin-top: 1em;
}
.dark .chat-md-h2 {
  color: #e5e7eb;
  border-left-color: #818cf8;
}

.chat-md-h3 {
  font-size: 1.06em;
  font-weight: 600;
  line-height: 1.42;
  margin-top: 1em;
  margin-bottom: 0.45em;
  color: #1f2937;
  scroll-margin-top: 1em;
}
.dark .chat-md-h3 {
  color: #e5e7eb;
}

.chat-md-h4 {
  font-size: 1em;
  font-weight: 600;
  line-height: 1.45;
  margin-top: 0.85em;
  margin-bottom: 0.35em;
  color: #374151;
  scroll-margin-top: 1em;
}
.dark .chat-md-h4 {
  color: #d1d5db;
}

/* ===== Paragraph ===== */
.chat-md-p {
  font-size: 0.875rem;
  line-height: 1.7;
  color: #374151;
  padding: 0.15em 0;
}
.dark .chat-md-p {
  color: #d1d5db;
}

/* ===== Horizontal Rule ===== */
.chat-md-hr {
  border: none;
  border-top: 1.5px solid #e5e7eb;
  margin: 1em 0;
  opacity: 0.7;
}
.dark .chat-md-hr {
  border-top-color: #374151;
}

/* ===== Inline Styles ===== */
.chat-md-bold {
  font-weight: 700;
  color: #111827;
}
.dark .chat-md-bold {
  color: #f3f4f6;
}

.chat-md-italic {
  font-style: italic;
}

.chat-md-del {
  text-decoration: line-through;
  opacity: 0.6;
  color: #9ca3af;
}

.chat-md-mark {
  background-color: #fef08a;
  color: #854d0e;
  padding: 0.1em 0.25em;
  border-radius: 0.2em;
  font-weight: 500;
}
.dark .chat-md-mark {
  background-color: #854d0e;
  color: #fef08a;
}

.chat-md-kbd {
  display: inline-flex;
  align-items: center;
  padding: 0.12em 0.45em;
  font-size: 0.78em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
  border: 1px solid #d1d5db;
  border-bottom-width: 2px;
  border-radius: 0.3em;
  box-shadow: 0 1px 1px rgba(0,0,0,0.08);
  color: #374151;
  line-height: 1.4;
}
.dark .chat-md-kbd {
  background: linear-gradient(180deg, #374151 0%, #1f2937 100%);
  border-color: #4b5563;
  color: #d1d5db;
}

.chat-md-sup {
  font-size: 0.72em;
  vertical-align: super;
  line-height: 0;
}

.chat-md-sub {
  font-size: 0.72em;
  vertical-align: sub;
  line-height: 0;
}

.chat-md-inline-code {
  padding: 0.1em 0.4em;
  font-size: 0.82em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background-color: #f3f4f6;
  border-radius: 0.25em;
  color: #db2777;
  white-space: nowrap;
}
.dark .chat-md-inline-code {
  background-color: #1f2937;
  color: #f472b6;
}

.chat-md-math-inline {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.chat-md-inline-img {
  max-width: 100%;
  max-height: 1.5em;
  vertical-align: middle;
  border-radius: 0.25em;
}

.chat-md-link {
  color: #4f46e5;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: color 0.15s;
}
.chat-md-link:hover {
  color: #4338ca;
  text-decoration: underline;
}
.dark .chat-md-link {
  color: #818cf8;
}
.dark .chat-md-link:hover {
  color: #a5b4fc;
}

.chat-md-fn-ref {
  font-size: 0.7em;
  color: #6366f1;
  cursor: pointer;
  text-decoration: none;
  line-height: 0;
  vertical-align: super;
}
.chat-md-fn-ref:hover {
  text-decoration: underline;
}
.chat-md-fn-missing {
  color: #d1d5db;
  opacity: 0.5;
}

/* ===== Table System ===== */
.chat-md-table-wrap {
  overflow-x: auto;
  margin: 0.75em 0;
  min-width: 100%;
  border-radius: 0.5em;
  border: 1px solid #e5e7eb;
}
.dark .chat-md-table-wrap {
  border-color: #374151;
}

.chat-md-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  table-layout: auto;
}

.chat-md-th {
  padding: 0.6em 0.85em;
  font-weight: 600;
  font-size: 0.84em;
  color: #1f2937;
  background-color: #f9fafb;
  border-bottom: 2px solid #e5e7eb;
  border-right: 1px solid #f3f4f6;
  white-space: nowrap;
  position: relative;
}
.chat-md-th:last-child {
  border-right: none;
}
.dark .chat-md-th {
  color: #f3f4f6;
  background-color: #1f2937;
  border-bottom-color: #4b5563;
  border-right-color: #374151;
}

.chat-md-thead-sticky .chat-md-th {
  position: sticky;
  top: 0;
  z-index: 10;
}

.chat-md-td {
  padding: 0.5em 0.85em;
  color: #374151;
  border-bottom: 1px solid #f3f4f6;
  border-right: 1px solid #f9fafb;
  vertical-align: top;
}
.chat-md-td:last-child {
  border-right: none;
}
.dark .chat-md-td {
  color: #d1d5db;
  border-bottom-color: #374151;
  border-right-color: #1f2937;
}

.chat-md-row-alt {
  background-color: #fafafa;
}
.dark .chat-md-row-alt {
  background-color: rgba(31, 41, 55, 0.4);
}

.chat-md-table tbody tr:hover {
  background-color: #f3f4f6;
}
.dark .chat-md-table tbody tr:hover {
  background-color: rgba(55, 65, 81, 0.5);
}

.chat-md-empty-cell {
  padding: 2em 1em;
  text-align: center;
  color: #9ca3af;
  font-size: 0.82rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35em;
}

/* ===== Blockquote ===== */
.chat-md-blockquote {
  border-left: 4px solid;
  padding: 0.75em 1em;
  margin: 0.75em 0;
  border-radius: 0 0.4em 0.4em 0;
}

.chat-md-bq-line {
  font-size: 0.87rem;
  line-height: 1.65;
  color: #374151;
  margin: 0.25em 0;
}
.dark .chat-md-bq-line {
  color: #d1d5db;
}

/* ===== Lists ===== */
.chat-md-ul-item,
.chat-md-ol-item,
.chat-md-task-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5em;
  font-size: 0.87rem;
  line-height: 1.6;
  color: #374151;
  padding: 0.15em 0;
}
.dark .chat-md-ul-item,
.dark .chat-md-ol-item,
.dark .chat-md-task-item {
  color: #d1d5db;
}

.chat-md-bullet {
  color: #9ca3af;
  flex-shrink: 0;
  margin-top: 0.22em;
  font-size: 0.75em;
}

.chat-md-ol-num {
  color: #9ca3af;
  flex-shrink-0;
  min-width: 1.4em;
  text-align: right;
  font-size: 0.82em;
  font-feature-settings: 'tnum';
}

.chat-md-nested-1 {
  padding-left: 1.5em;
}
.chat-md-nested-2 {
  padding-left: 3em;
}

/* Task List Checkbox */
.chat-md-checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.05em;
  height: 1.05em;
  border: 1.5px solid #d1d5db;
  border-radius: 0.22em;
  flex-shrink: 0;
  margin-top: 0.18em;
  font-size: 0.72em;
  color: transparent;
  transition: all 0.15s;
}
.dark .chat-md-checkbox {
  border-color: #4b5563;
}

.chat-md-checked {
  background-color: #22c55e;
  border-color: #22c55e;
  color: white;
  font-weight: 700;
}

/* ===== Callout ===== */
.chat-md-callout {
  border-left-width: 4px;
  border-left-style: solid;
  border-radius: 0 0.6em 0.6em 0;
  margin: 0.85em 0;
  overflow: hidden;
}

.chat-md-callout-header {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.65em 0.9em;
  font-weight: 600;
  font-size: 0.85rem;
}

.chat-md-callout-title {
  font-weight: 650;
  font-size: 0.88rem;
}

.chat-md-callout-body {
  padding: 0 0.9em 0.7em;
}

.chat-md-callout-line {
  font-size: 0.86rem;
  line-height: 1.65;
  color: #374151;
  margin: 0.2em 0;
}
.dark .chat-md-callout-line {
  color: #d1d5db;
}

/* ===== Enhanced Code Block ===== */
.chat-md-code-block {
  margin: 0.75em 0;
  border-radius: 0.6em;
  overflow: hidden;
  background-color: #1e1e2e;
  border: 1px solid #313244;
}
.dark .chat-md-code-block {
  background-color: #111118;
  border-color: #2a2a3a;
}

.chat-md-code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5em 0.75em;
  background-color: #313244;
  border-bottom: 1px solid #45475a;
}

.chat-md-code-meta {
  display: flex;
  align-items: center;
  gap: 0.4em;
}

.chat-md-lang-dot {
  width: 0.7em;
  height: 0.7em;
  border-radius: 50%;
  flex-shrink: 0;
}

.chat-md-lang-label {
  font-size: 0.72rem;
  color: #a6adc8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 500;
}

.chat-md-code-sep {
  color: #585b70;
  font-size: 0.72rem;
}

.chat-md-filename {
  font-size: 0.72rem;
  color: #cba6f7;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.chat-md-code-actions {
  display: flex;
  align-items: center;
  gap: 0.25em;
}

.chat-md-code-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.25em 0.45em;
  border-radius: 0.3em;
  color: #a6adc8;
  transition: all 0.15s;
  font-size: 0.72rem;
  background: transparent;
  border: none;
  cursor: pointer;
}
.chat-md-code-btn:hover {
  background-color: #45475a;
  color: #cdd6f4;
}

.chat-md-code-body {
  overflow-x: auto;
}

.chat-md-pre {
  padding: 0.75em 1em;
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.6;
  color: #cdd6f4;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  overflow-x: auto;
  white-space: pre;
}

.chat-md-line-numbers {
  padding: 0.75em 0;
  padding-right: 0.75em;
  padding-left: 0.75em;
  text-align: right;
  user-select: none;
  border-right: 1px solid #313244;
  color: #585b70;
  font-size: 0.72rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1.6;
  min-width: 2.2em;
  flex-shrink: 0;
  background-color: #181825;
}

.chat-md-ln {
  padding: 0 0.35em;
}

.chat-md-expand-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3em;
  padding: 0.4em;
  font-size: 0.72rem;
  color: #a6adc8;
  background-color: #313244;
  border-top: 1px solid #45475a;
  cursor: pointer;
  transition: background-color 0.15s;
  width: 100%;
  border: none;
}
.chat-md-expand-hint:hover {
  background-color: #45475a;
}

/* ===== Figure / Image ===== */
.chat-md-figure {
  margin: 0.85em 0;
}

.chat-md-img {
  max-width: 100%;
  height: auto;
  border-radius: 0.5em;
  border: 1px solid #e5e7eb;
}
.dark .chat-md-img {
  border-color: #374151;
}

.chat-md-figcaption {
  text-align: center;
  font-size: 0.78rem;
  color: #9ca3af;
  margin-top: 0.5em;
  font-style: italic;
}

/* ===== Table of Contents ===== */
.chat-md-toc {
  margin: 0.75em 0 1em;
  border: 1px solid #e5e7eb;
  border-radius: 0.5em;
  background-color: #f9fafb;
  overflow: hidden;
}
.dark .chat-md-toc {
  border-color: #374151;
  background-color: #1f2937;
}

.chat-md-toc-summary {
  display: flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.55em 0.85em;
  font-size: 0.83rem;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  list-style: none;
  user-select: none;
  transition: background-color 0.15s;
}
.chat-md-toc-summary::-webkit-details-marker {
  display: none;
}
.chat-md-toc-summary:hover {
  background-color: #f3f4f6;
}
.dark .chat-md-toc-summary {
  color: #d1d5db;
}
.dark .chat-md-toc-summary:hover {
  background-color: #374151;
}

.chat-md-toc-chevron {
  margin-left: auto;
  transition: transform 0.2s;
}
details[open] .chat-md-toc-chevron {
  transform: rotate(180deg);
}

.chat-md-toc-list {
  list-style: none;
  padding: 0 0.5em 0.65em;
  margin: 0;
}
.chat-md-toc-list li {
  padding: 0.2em 0;
}

.chat-md-toc-link {
  display: block;
  padding: 0.3em 0.65em;
  font-size: 0.82rem;
  color: #4f46e5;
  text-decoration: none;
  border-radius: 0.3em;
  transition: all 0.15s;
}
.chat-md-toc-link:hover {
  background-color: #eef2ff;
  color: #4338ca;
}
.dark .chat-md-toc-link {
  color: #818cf8;
}
.dark .chat-md-toc-link:hover {
  background-color: rgba(79, 70, 229, 0.15);
  color: #a5b4fc;
}

/* ===== Footnotes ===== */
.chat-md-footnotes {
  margin-top: 1.5em;
  padding-top: 0.75em;
}

.chat-md-footnotes-divider {
  border-top: 1px solid #e5e7eb;
  margin-bottom: 0.6em;
}
.dark .chat-md-footnotes-divider {
  border-top-color: #374151;
}

.chat-md-footnote-item {
  display: flex;
  gap: 0.35em;
  font-size: 0.78rem;
  line-height: 1.6;
  color: #6b7280;
  padding: 0.15em 0;
}
.dark .chat-md-footnote-item {
  color: #9ca3af;
}

.chat-md-footnote-ref a {
  color: #6366f1;
  text-decoration: none;
  font-weight: 500;
}
.chat-md-footnote-ref a:hover {
  text-decoration: underline;
}
`

// 注入全局样式（仅一次，HMR 时先清理旧样式再重新注入）
let stylesInjected = false
function injectMDStyles() {
  if (typeof document === 'undefined') return
  // HMR 场景：模块重载时旧 style 元素仍存在，需先移除防止累积
  const existing = document.getElementById('chat-md-styles')
  if (existing) existing.remove()
  if (stylesInjected && !existing) return // 非HMR场景：已注入且DOM中存在，跳过
  const styleEl = document.createElement('style')
  styleEl.id = 'chat-md-styles'
  styleEl.textContent = MDStyles
  document.head.appendChild(styleEl)
  stylesInjected = true
}

// 在模块加载时注入样式
injectMDStyles()
