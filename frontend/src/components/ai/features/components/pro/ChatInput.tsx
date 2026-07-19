/**
 * ChatInput — 专业版输入区组件（增强版）
 *
 * - 自动扩高多行输入（44px~200px，平滑过渡）
 * - 防抖 onChange（300ms）
 * - 模型快速切换
 * - 字符计数
 * - 发送/停止按钮
 * - 完整键盘快捷键（Enter/Shift+Enter/Ctrl+Enter/Escape/ArrowUp/Tab）
 * - 桌面端快捷键提示条
 */
import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Send, Square, Sparkles, ChevronDown, Code, Table2, Bold, Italic, List, Sigma, Keyboard, Check, AlertTriangle } from 'lucide-react'

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
  onModelChange?: (model: string) => void
  availableModels?: string[]
  charCount?: number
  onInsertFormat?: (format: 'code' | 'formula' | 'table' | 'bold' | 'italic' | 'list') => void
  /** 防抖回调：输入停止 300ms 后触发，用于实时字数统计、智能提示等 */
  onDebouncedChange?: (val: string) => void
  /** ArrowUp 时编辑上一条用户消息 */
  onEditLast?: () => void
  /** Tab 触发 AI 补全建议 */
  onTriggerSuggest?: () => void
}

const MODELS = [
  { id: 'deepseek-chat', label: 'DeepSeek', desc: '深度推理', color: 'text-secondary-600' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: '快速响应', color: 'text-primary-600' },
  { id: 'glm-4-flash', label: 'GLM-4 Flash', desc: '本地优化', color: 'text-accent-600' },
]

const MIN_HEIGHT = 44
const MAX_HEIGHT = 200
const DEBOUNCE_MS = 300

export default function ChatInput({
  value, onChange, onSend, onStop, isStreaming, disabled,
  maxLength = 2000, placeholder = '描述您的配方需求，例如：设计一款低糖饮料的甜味剂方案...',
  modelName, onModelChange, charCount, onInsertFormat,
  onDebouncedChange, onEditLast, onTriggerSuggest,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [activeFormat, setActiveFormat] = useState<string | null>(null)
  const currentModel = MODELS.find(m => m.id === modelName) || MODELS[0]

  // 自动调整高度（44px ~ 200px，平滑过渡）
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = `${MIN_HEIGHT}px`
      const newHeight = Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)
      el.style.height = `${newHeight}px`
    }
  }, [value])

  // 防抖处理：组件卸载时清理
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // 内部 onChange + 防抖触发
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    onChange(val)
    if (onDebouncedChange) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        onDebouncedChange(val)
      }, DEBOUNCE_MS)
    }
  }, [onChange, onDebouncedChange])

  // 完整键盘快捷键
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      if (!isStreaming && !disabled && value.trim()) onSend()
      return
    }

    // Shift+Enter — 换行（浏览器默认行为，无需 preventDefault）
    if (e.key === 'Enter' && e.shiftKey) return

    // Ctrl/Cmd+Enter — 强制换行（插入 \n）
    if ((e.key === 'Enter') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      const el = textareaRef.current
      if (el) {
        const start = el.selectionStart
        const end = el.selectionEnd
        const newValue = value.slice(0, start) + '\n' + value.slice(end)
        onChange(newValue)
        // 恢复光标位置
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = start + 1
        })
      }
      return
    }

    // Escape — 清空输入框
    if (e.key === 'Escape') {
      e.preventDefault()
      if (value.length > 0) onChange('')
      return
    }

    // ArrowUp — 输入框为空且非 streaming 时编辑上一条用户消息
    if (e.key === 'ArrowUp' && !e.shiftKey && !isStreaming && !disabled && !value.trim()) {
      // 仅当光标在首行时触发（避免影响多行文本内的上移操作）
      const el = textareaRef.current
      if (el && el.selectionStart === 0) {
        e.preventDefault()
        onEditLast?.()
      }
      return
    }

    // Tab — 触发 AI 补全建议
    if (e.key === 'Tab') {
      e.preventDefault()
      onTriggerSuggest?.()
      return
    }
  }, [isStreaming, disabled, value, onSend, onChange, onEditLast, onTriggerSuggest])

  const canSend = value.trim().length > 0 && !isStreaming && !disabled
  const isOverLimit = charCount ? charCount > maxLength * 0.9 : false
  const isExceeded = charCount ? charCount > maxLength : false

  // 字数统计颜色可视化
  const ratio = charCount ? charCount / maxLength : 0
  const countColor = !value || !charCount ? 'text-neutral-400' :
    ratio > 0.95 ? 'text-error-500 font-medium' :
    ratio > 0.8 ? 'text-warning-500' : 'text-neutral-400'

  // 发送成功闪烁后恢复
  const handleSend = useCallback(() => {
    if (!canSend) return
    onSend()
    setSendSuccess(true)
    setActiveFormat(null)
    setTimeout(() => setSendSuccess(false), 1200)
  }, [canSend, onSend])

  // 格式按钮点击 — 带活跃状态追踪
  const handleFormatInsert = useCallback((format: string) => {
    onInsertFormat?.(format as any)
    setActiveFormat(format === activeFormat ? null : format)
  }, [onInsertFormat, activeFormat])

  return (
    <div className="chat-input-area border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900
      transition-colors duration-200">
      {/* 焦点时底部渐变线（iOS 风格） */}
      {isFocused && (
        <div className="h-[2px] bg-gradient-to-r from-transparent via-primary-400 to-transparent opacity-80 transition-opacity duration-300" />
      )}
      <div className="max-w-4xl mx-auto px-3 py-2.5 space-y-2">
        {/* 输入行 */}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            {/* 格式化工具栏 — 分组：编辑类 | 插入类 */}
            <div className="flex items-center gap-0.5 pb-1.5 border-b border-neutral-100 dark:border-neutral-800 mb-2">
              {/* 左侧：编辑类 */}
              {[
                { icon: Code, label: '代码块', format: 'code' as const },
                { icon: Bold, label: '加粗', format: 'bold' as const },
                { icon: Italic, label: '斜体', format: 'italic' as const },
                { icon: List, label: '列表', format: 'list' as const },
              ].map((item) => (
                <button
                  key={item.format}
                  onClick={() => handleFormatInsert(item.format)}
                  className={`p-1.5 rounded-md transition-all duration-150
                    ${activeFormat === item.format
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  title={item.label}
                >
                  <item.icon className="w-3.5 h-3.5" />
                </button>
              ))}
              {/* 竖线分隔符 */}
              <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-600 mx-1.5 self-center" />
              {/* 右侧：插入类 */}
              {[
                { icon: Sigma, label: '公式', format: 'formula' as const },
                { icon: Table2, label: '表格', format: 'table' as const },
              ].map((item) => (
                <button
                  key={item.format}
                  onClick={() => handleFormatInsert(item.format)}
                  className={`p-1.5 rounded-md transition-all duration-150
                    ${activeFormat === item.format
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  title={item.label}
                >
                  <item.icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>

            {/* 输入框 */}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              maxLength={maxLength}
              disabled={disabled || isStreaming}
              rows={1}
              style={{
                minHeight: `${MIN_HEIGHT}px`,
                maxHeight: `${MAX_HEIGHT}px`,
                height: `${MIN_HEIGHT}px`,
                transition: 'height 0.15s ease, box-shadow 0.15s ease',
              }}
              className={`
                w-full resize-none bg-slate-50 dark:bg-neutral-800/50
                border border-neutral-200 dark:border-neutral-700
                rounded-xl px-4 py-3 pr-12
                text-sm leading-relaxed
                placeholder:text-neutral-400 dark:placeholder:text-neutral-500
                ${isFocused ? 'placeholder:opacity-30 placeholder:transition-opacity placeholder:duration-200' : ''}
                focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400
                ${isFocused ? 'shadow-sm shadow-primary-200/40 dark:shadow-primary-900/10' : ''}
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isExceeded ? 'border-red-400 focus:ring-red-500/30' : ''}
              `}
              aria-label="消息输入"
            />
          </div>

          {/* 发送/停止按钮 — 4 状态机：disabled / ready / loading / success */}
          <button
            onClick={isStreaming ? onStop : handleSend}
            disabled={!canSend && !isStreaming}
            className={`
              flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center
              transition-all duration-200 relative overflow-hidden
              ${sendSuccess
                ? 'bg-success-500 text-white scale-[1.05] shadow-md shadow-green-200'
                : isStreaming
                  ? 'bg-error-500 hover:bg-error-600 text-white'
                  : canSend
                    ? 'bg-primary-500 hover:bg-primary-600 active:scale-95 text-white shadow-sm shadow-primary-200 hover:shadow-md'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed opacity-50'
              }
            `}
            aria-label={isStreaming ? '停止' : sendSuccess ? '已发送' : '发送'}
          >
            {sendSuccess ? (
              <Check className="w-5 h-5 animate-check-bounce" />
            ) : isStreaming ? (
              <Square className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* 快捷键提示条（仅桌面端 >768px 显示） */}
        <div className="hidden md:flex items-center justify-center py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-neutral-800/60 text-[11px] text-neutral-400 dark:text-neutral-500 gap-3">
          <Keyboard className="w-3 h-3" />
          <span><kbd className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 font-mono text-[10px]">↵</kbd> 发送</span>
          <span><kbd className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 font-mono text-[10px]">⇧↵</kbd> 换行</span>
          <span><kbd className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 font-mono text-[10px]">⌃↵</kbd> 强制换行</span>
          <span><kbd className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 font-mono text-[10px]">Esc</kbd> 清空</span>
          <span><kbd className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 font-mono text-[10px]">↑</kbd> 编辑上条</span>
          <span><kbd className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 font-mono text-[10px]">Tab</kbd> AI补全</span>
        </div>

        {/* 底部工具栏 */}
        <div className="flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500 px-1">
          {/* 模型选择器 */}
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <Sparkles className={`w-3 h-3 ${currentModel.color}`} />
              <span className="text-neutral-600 dark:text-neutral-400">{currentModel.label}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showModelPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowModelPicker(false)} aria-hidden="true" />
                <div className="absolute bottom-full left-0 mb-1 z-20 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 min-w-[160px]" role="listbox">
                  {MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { onModelChange?.(m.id); setShowModelPicker(false) }}
                      role="option"
                      aria-selected={m.id === modelName}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-neutral-700/50 transition-colors
                        ${m.id === modelName ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                    >
                      <Sparkles className={`w-3 h-3 ${m.color}`} />
                      <div className="text-left">
                        <div className="text-neutral-800 dark:text-neutral-200 font-medium">{m.label}</div>
                        <div className="text-neutral-400">{m.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 字符计数 — 渐变颜色可视化 */}
          {charCount !== undefined && (
            <span className={`inline-flex items-center gap-0.5 transition-colors duration-200 ${countColor}`}>
              {charCount}/{maxLength}
              {ratio > 0.95 && <AlertTriangle className="w-3 h-3" aria-hidden="true" />}
            </span>
          )}
        </div>

        {/* 字数上限提示 — 屏幕阅读器可感知，避免静默截断 */}
        {charCount !== undefined && ratio >= 0.9 && (
          <p
            role="status"
            aria-live="polite"
            className={`px-1 text-[11px] ${isExceeded || ratio >= 1 ? 'text-error-500' : 'text-warning-500'}`}
          >
            {ratio >= 1
              ? `已达字数上限（${maxLength} 字），无法继续输入`
              : `已接近字数上限（${charCount}/${maxLength}）`}
          </p>
        )}
      </div>
    </div>
  )
}
