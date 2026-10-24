/**
 * ChatInputPro — DSH 风格输入区 (v8.0)
 *
 * 设计原则（对标 DeepSeek Harness ComposerBar）：
 * - Flex 布局替代绝对定位，彻底消除重叠问题
 * - 左侧工具栏固定列 + 文本输入自适应列
 * - 文字 14px / leading-[22px] / 左侧工具栏固定列
 * - 发送按钮右下固定，不干扰工具栏
 * - focus ring + soft shadow 专业反馈
 *
 * @version 8.0.0
 */
import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Square, Check, Bot, Paperclip, X } from 'lucide-react'

export interface DraftAttachment {
  id: string
  file: File
  previewUrl: string
}

interface ChatInputProps {
  value: string
  onChange: (val: string) => void
  onSend: () => void
  onStop?: () => void
  isStreaming: boolean
  disabled?: boolean
  maxLength?: number
  placeholder?: string
  modelName?: string
  modelColor?: string
  attachments?: DraftAttachment[]
  onAddAttachment?: (file: File) => void
  onRemoveAttachment?: (id: string) => void
  onSlashSelect?: (command: string) => void
}

const MIN_HEIGHT = 40
const MAX_HEIGHT = 120

const MODELS: { id: string; label: string; color: string }[] = [
  { id: 'deepseek-chat', label: 'DeepSeek', color: 'text-success-500' },
  { id: 'gpt-4o-mini', label: 'GPT-4o', color: 'text-secondary-500' },
  { id: 'glm-4-flash', label: 'GLM-4', color: 'text-accent-500' },
]

const SLASH_COMMANDS = [
  { command: 'clear', descKey: 'slashClear' },
  { command: 'compact', descKey: 'slashCompact' },
  { command: 'help', descKey: 'slashHelp' },
] as const

export default function ChatInputPro({
  value, onChange, onSend, onStop, isStreaming, disabled,
  maxLength = 2000, placeholder,
  modelName, modelColor,
  attachments = [], onAddAttachment, onRemoveAttachment,
  onSlashSelect,
}: ChatInputProps) {
  const { t } = useTranslation()
  const resolvedPlaceholder = placeholder ?? t('ai.chat.input.placeholder')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [showModelMenu, setShowModelMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const currentModel = MODELS.find(m => m.id === modelName) || MODELS[0]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSlashMenu(false)
        setShowModelMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`
    }
  }, [value])

  useEffect(() => {
    const container = textareaRef.current?.closest('.chat-input-wrapper') as HTMLElement | null
    if (!container) return
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'))
      files.forEach(f => onAddAttachment?.(f))
    }
    container.addEventListener('drop', handleDrop)
    return () => container.removeEventListener('drop', handleDrop)
  }, [onAddAttachment])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    onChange(val)
    setShowSlashMenu(val.startsWith('/'))
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      if (!isStreaming && !disabled && value.trim()) onSend()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      if (value.length > 0) onChange('')
    }
  }, [isStreaming, disabled, value, onSend, onChange])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(f => onAddAttachment?.(f))
    e.target.value = ''
  }, [onAddAttachment])

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !isStreaming && !disabled

  const handleSend = useCallback(() => {
    if (!canSend) return
    onSend()
    setSendSuccess(true)
    setTimeout(() => setSendSuccess(false), 1000)
  }, [canSend, onSend])

  return (
    <div className="px-4 py-3 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800">
      <div className="max-w-none mx-auto chat-input-wrapper">
        {/* 附件预览行（在输入框上方） */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {attachments.map(att => (
              <div key={att.id} className="relative group inline-block">
                <img
                  src={att.previewUrl}
                  alt={att.file.name}
                  className="h-10 w-10 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700"
                />
                <button
                  onClick={() => onRemoveAttachment?.(att.id)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-neutral-800 dark:bg-neutral-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            <span className="text-xs text-neutral-400 dark:text-neutral-400">{t('ai.chat.input.imageCount', { count: attachments.length })}</span>
          </div>
        )}

        <div className="relative" ref={menuRef}>
          {/* 输入框主体 — Flex 布局，彻底消除重叠
              注意：不使用 overflow-hidden，允许发送按钮自然溢出圆角 */}
          <div className={`rounded-xl transition-all duration-200 ${
            isFocused
              ? 'ring-2 ring-success-400/30 dark:ring-success-600/30 shadow-sm'
              : ''
          }`}>
            <div className="flex items-stretch bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
              
              {/* 左侧工具栏 — 固定宽度列 */}
              <div className="flex items-center gap-0.5 px-2 py-2.5 border-r border-neutral-200/60 dark:border-neutral-800/60 flex-shrink-0">
                {/* 模型选择 */}
                <div className="relative">
                  <button
                    onClick={() => { setShowModelMenu(!showModelMenu); setShowSlashMenu(false) }}
                    title={t('ai.chat.topbar.switchModel')}
                    className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[12px] font-medium bg-transparent hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 transition-colors"
                  >
                    <span className={modelColor || currentModel.color}><Bot className="w-3.5 h-3.5" /></span>
                    <span className="hidden sm:inline text-xs">{currentModel.label}</span>
                  </button>
                  {showModelMenu && (
                    <>
                      <div className="fixed inset-0 z-30"  role="button" tabIndex={0} onClick={() => setShowModelMenu(false)} />
                      <div className="absolute top-full left-0 mt-1 z-40 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 min-w-[140px]">
                        {MODELS.map(m => (
                          <button key={m.id}
                            onClick={() => setShowModelMenu(false)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors ${m.id === modelName ? 'bg-success-50 dark:bg-success-300/20' : ''}`}
                          >
                            <span className={m.color}><Bot className="w-3.5 h-3.5" /></span>
                            <span className="text-neutral-700 dark:text-neutral-300 font-medium">{m.label}</span>
                            {m.id === modelName && <Check className="ml-auto w-3.5 h-3.5 text-success-500" aria-hidden="true" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* 分隔 */}
                <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800" />

                {/* 图片附件 */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title={t('ai.chat.input.addImage')}
                  className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[12px] font-medium bg-transparent hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange} aria-hidden="true" tabIndex={-1} />
              </div>

              {/* 文本输入区 — 自适应宽度 */}
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={resolvedPlaceholder}
                maxLength={maxLength}
                disabled={disabled || isStreaming}
                rows={1}
                className="flex-1 resize-none bg-transparent border-0 px-3 py-2.5 text-[14px] leading-[22px] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-0 disabled:opacity-50"
                style={{ minHeight: `${MIN_HEIGHT - 20}px`, maxHeight: `${MAX_HEIGHT - 20}px` }}
                aria-label={t('ai.chat.input.messageInput')}
              />
            </div>

            {/* 发送按钮 — 悬浮于右下角，不占文档流 */}
            <button
              onClick={isStreaming ? onStop : handleSend}
              disabled={!canSend && !isStreaming}
              className={`absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 ${
                sendSuccess
                  ? 'bg-success-500 text-white scale-95'
                  : isStreaming
                    ? 'bg-error-500 text-white hover:bg-error-600 active:scale-95 shadow-sm'
                    : canSend
                      ? 'bg-success-500 text-white hover:bg-success-600 active:scale-95 shadow-md hover:shadow-lg'
                      : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
              }`}
              aria-label={isStreaming ? t('ai.chat.stopGenerating') : t('ai.chat.send')}
            >
              {sendSuccess ? <Check className="w-4 h-4" /> : isStreaming ? <Square className="w-3.5 h-3.5" /> : <Send className="w-4 h-4" />}
            </button>
          </div>

          {/* 斜杠指令菜单 */}
          {showSlashMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-52 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-700">
                <span className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">{t('ai.chat.input.commands')}</span>
              </div>
              <div className="py-1">
                {SLASH_COMMANDS.map(cmd => (
                  <button key={cmd.command}
                    onClick={() => { onSlashSelect?.(cmd.command); setShowSlashMenu(false) }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-success-50 dark:hover:bg-success-900/20 flex items-center justify-between gap-2 transition-colors"
                  >
                    <span className="font-mono text-success-700 dark:text-success-600 text-xs">/{cmd.command}</span>
                    <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-xs">{t(`ai.chat.input.${cmd.descKey}`)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 提示文本 */}
        <div className="mt-1.5 px-1">
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            {t('ai.chat.input.hint')}
          </span>
        </div>
      </div>
    </div>
  )
}
