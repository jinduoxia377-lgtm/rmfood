/**
 * ChatExport — 对话导出功能
 *
 * 支持多种格式导出：
 * - Markdown (.md)
 * - PDF (通过浏览器打印)
 * - Word (.docx，通过 HTML 转 Word)
 * - 纯文本 (.txt)
 */
import React, { useState, useCallback, useMemo } from 'react'
import { Download, FileText, FileDown, FileType, Check, Loader2 } from 'lucide-react'
import type { ChatMessage } from '../../hooks/useChatMessages'

interface ChatExportProps {
  messages: ChatMessage[]
  conversationTitle?: string
  visible?: boolean
  onClose?: () => void
}

export type ExportFormat = 'markdown' | 'pdf' | 'word' | 'txt'

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: React.ReactNode; ext: string; mime: string }[] = [
  { value: 'markdown', label: 'Markdown', icon: <FileType className="w-4 h-4" />, ext: '.md', mime: 'text/markdown' },
  { value: 'pdf', label: 'PDF 文档', icon: <FileText className="w-4 h-4" />, ext: '.pdf', mime: 'application/pdf' },
  { value: 'word', label: 'Word 文档', icon: <FileDown className="w-4 h-4" />, ext: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { value: 'txt', label: '纯文本', icon: <FileType className="w-4 h-4" />, ext: '.txt', mime: 'text/plain' },
]

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function toMarkdown(messages: ChatMessage[], title?: string): string {
  let md = ''
  if (title) md += `# ${title}\n\n`
  md += `> 导出时间：${formatTimestamp(Date.now())}\n\n---\n\n`

  for (const msg of messages) {
    if (msg.isRetracted) continue
    const roleLabel = msg.role === 'user' ? '**用户**' : '**AI 助手**'
    md += `### ${roleLabel} · ${formatTimestamp(msg.timestamp)}\n\n`
    md += `${msg.content}\n\n`
    if (msg.isEdited) md += `*（已编辑）*\n\n`
    md += '---\n\n'
  }
  return md
}

function toPlainText(messages: ChatMessage[], title?: string): string {
  let txt = ''
  if (title) txt += `${title}\n${'='.repeat(title.length)}\n\n`
  txt += `导出时间：${formatTimestamp(Date.now())}\n\n`

  for (const msg of messages) {
    if (msg.isRetracted) continue
    const roleLabel = msg.role === 'user' ? '[用户]' : '[AI]'
    txt += `${roleLabel} ${formatTimestamp(msg.timestamp)}\n`
    txt += `${msg.content}\n\n`
  }
  return txt
}

function toWordHtml(messages: ChatMessage[], title?: string): string {
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${title || 'AI对话记录'}</title><body>`
  if (title) html += `<h1>${title}</h1>`
  html += `<p style="color:#888;font-size:11pt;">导出时间：${formatTimestamp(Date.now())}</p><hr/>`

  for (const msg of messages) {
    if (msg.isRetracted) continue
    const bgColor = msg.role === 'user' ? '#e8f4fd' : '#f5f5f5'
    const roleLabel = msg.role === 'user' ? '用户' : 'AI 助手'
    html += `<div style="margin:12px 0;padding:12px;background:${bgColor};border-radius:8px;">`
    html += `<strong>${roleLabel}</strong> <span style="font-size:10pt;color:#999;">${formatTimestamp(msg.timestamp)}</span>`
    html += `<div style="white-space:pre-wrap;margin-top:6px;">${msg.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>`
    html += '</div>'
  }
  html += '</body></html>'
  return html
}

export default function ChatExport({ messages, conversationTitle = 'AI 对话记录', visible = true, onClose }: ChatExportProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('markdown')
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)

  const preview = useMemo(() => {
    switch (selectedFormat) {
      case 'markdown': return toMarkdown(messages, conversationTitle).substring(0, 500) + (messages.length > 3 ? '\n...' : '')
      case 'txt': return toPlainText(messages, conversationTitle).substring(0, 500)
      default: return ''
    }
  }, [selectedFormat, messages, conversationTitle])

  const doExport = useCallback(async () => {
    setExporting(true)

    try {
      let content: string
      let filename: string
      let mimeType: string
      const ts = new Date().toISOString().slice(0, 10)

      switch (selectedFormat) {
        case 'markdown':
          content = toMarkdown(messages, conversationTitle)
          filename = `rmfood-chat-${ts}.md`
          mimeType = 'text/markdown;charset=utf-8'
          break

        case 'txt':
          content = toPlainText(messages, conversationTitle)
          filename = `rmfood-chat-${ts}.txt`
          mimeType = 'text/plain;charset=utf-8'
          break

        case 'word': {
          content = toWordHtml(messages, conversationTitle)
          filename = `rmfood-chat-${ts}.docx`
          mimeType = 'application/vnd.ms-word'  // 浏览器会正确处理
          break
        }

        case 'pdf': {
          // PDF: 打开打印对话框
          const printWindow = window.open('', '_blank')
          if (printWindow) {
            printWindow.document.write(`
              <html><head><title>${conversationTitle}</title>
              <style>body{font-family:'Microsoft YaHei','PingFang SC',sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.8;}
              h1{text-align:center;border-bottom:2px solid #333;padding-bottom:10px;}
              .user-msg{background:#f0f7ff;border-left:4px solid #1976d2;padding:12px 16px;margin:12px 0;border-radius:0 8px 8px 0;}
              .ai-msg{background:#fafafa;border-left:4px solid #666;padding:12px 16px;margin:12px 0;border-radius:0 8px 8px 0;}
              .meta{color:#999;font-size:11px;margin-top:4px;}
              pre{background:#f5f5f5;padding:12px;border-radius:6px;overflow-x:auto;code{font-size:13px}}</style>
              </head><body>
              <h1>${conversationTitle}</h1>
              <p class="meta">导出时间：${formatTimestamp(Date.now())}</p><hr/>
              ${messages.filter(m => !m.isRetracted).map(m => `
                <div class="${m.role}-user ? 'user-msg' : 'ai-msg'}">
                  <strong>${m.role === 'user' ? '用户' : 'AI 助手'}</strong>
                  <span class="meta">${formatTimestamp(m.timestamp)}</span>
                  <div>${m.content}</div>
                </div>
              `).join('')}
              </body></html>
            `)
            printWindow.document.close()
            printWindow.print()
          }
          setExported(true)
          setTimeout(() => setExported(false), 2000)
          return
        }

        default:
          throw new Error('Unsupported format')
      }

      // Blob 下载方式
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExported(true)
      setTimeout(() => setExported(false), 2000)
    } catch (err) {
      console.error('[ChatExport] 导出失败:', err)
    } finally {
      setExporting(false)
    }
  }, [selectedFormat, messages, conversationTitle])

  if (!visible) return null

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">导出对话</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 text-sm">✕</button>
        )}
      </div>

      {/* 格式选择 */}
      <div className="grid grid-cols-4 gap-2">
        {FORMAT_OPTIONS.map(fmt => (
          <button
            key={fmt.value}
            onClick={() => setSelectedFormat(fmt.value)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
              selectedFormat === fmt.value
                ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <span className={`${selectedFormat === fmt.value ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}>
              {fmt.icon}
            </span>
            <span className={`text-xs font-medium ${selectedFormat === fmt.value ? 'text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400'}`}>
              {fmt.label}
            </span>
            <span className="text-[10px] text-gray-400">{fmt.ext}</span>
          </button>
        ))}
      </div>

      {/* 预览（Markdown/TXT） */}
      {(selectedFormat === 'markdown' || selectedFormat === 'txt') && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-3 max-h-32 overflow-y-auto">
          <pre className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-pre-wrap leading-relaxed font-mono">{preview}</pre>
        </div>
      )}

      {/* 统计信息 */}
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span>{messages.filter(m => !m.isRetracted).length} 条消息 · {conversationTitle}</span>
        <span>格式: {FORMAT_OPTIONS.find(f => f.value === selectedFormat)?.label}</span>
      </div>

      {/* 导出按钮 */}
      <button
        onClick={doExport}
        disabled={exporting || messages.length === 0}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-medium
          hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        {exporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> 正在导出...
          </>
        ) : exported ? (
          <>
            <Check className="w-4 h-4" /> 导出成功
          </>
        ) : (
          <>
            <Download className="w-4 h-4" /> 开始导出
          </>
        )}
      </button>
    </div>
  )
}
