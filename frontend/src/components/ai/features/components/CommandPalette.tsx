/**
 * CommandPalette - 命令面板组件 (v7.0)
 *
 * 职责：
 * - 提供快捷命令搜索和执行功能
 * - 支持 Ctrl+K 快捷键唤起
 * - 支持快捷问题推荐
 * - 支持命令分类展示
 * - 支持键盘导航
 * - 支持模糊搜索匹配
 * - 支持自定义命令扩展
 *
 * @version 7.0.0
 * @lastUpdated 2026-05-16
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Sparkles, MessageSquare, Settings, Download, Upload, Trash2, Bookmark, RotateCcw, HelpCircle, FileText, Zap, BookOpen, Wand2 } from 'lucide-react'
import { logger } from '@/utils/safeLogger'

// ===== 类型定义 =====

export interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  category: string
  shortcut?: string[]
  action: () => void
}

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  quickQuestions?: string[]
  onQuickQuestion?: (question: string) => void
  onGenerateReport?: () => void
  onClearChat?: () => void
  onExportChat?: () => void
  onImportChat?: () => void
  onRetryLast?: () => void
  onShowBookmarks?: () => void
  onShowSettings?: () => void
  onShowHelp?: () => void
}

// ===== 常量定义 =====

const DEFAULT_QUICK_QUESTIONS = [
  '帮我设计一个补气养血的配方',
  '分析这个配方的安全性',
  '推荐一些针对降血压的原料',
  '预测这个配方的口感评分',
  '评估配方的稳定性',
]

const COMMAND_CATEGORIES = {
  quick: '快捷问题',
  actions: '操作',
  tools: '工具',
  help: '帮助',
}

// ===== 主组件 =====

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  quickQuestions = DEFAULT_QUICK_QUESTIONS,
  onQuickQuestion,
  onGenerateReport,
  onClearChat,
  onExportChat,
  onImportChat,
  onRetryLast,
  onShowBookmarks,
  onShowSettings,
  onShowHelp,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const commands = useMemo((): CommandItem[] => {
    const items: CommandItem[] = []

    quickQuestions.forEach((question, index) => {
      items.push({
        id: `quick-${index}`,
        label: question,
        description: '发送快捷问题',
        icon: <Sparkles className="w-4 h-4 text-warning-500" />,
        category: COMMAND_CATEGORIES.quick,
        action: () => {
          onQuickQuestion?.(question)
          onClose()
        },
      })
    })

    if (onGenerateReport) {
      items.push({
        id: 'generate-report',
        label: '生成专业报告',
        description: '基于当前对话生成学术报告',
        icon: <FileText className="w-4 h-4 text-secondary-500" />,
        category: COMMAND_CATEGORIES.actions,
        shortcut: ['R'],
        action: () => {
          onGenerateReport()
          onClose()
        },
      })
    }

    if (onRetryLast) {
      items.push({
        id: 'retry-last',
        label: '重试上一条消息',
        description: '重新发送并获取新的回复',
        icon: <RotateCcw className="w-4 h-4 text-success-500" />,
        category: COMMAND_CATEGORIES.actions,
        shortcut: ['Shift', 'R'],
        action: () => {
          onRetryLast()
          onClose()
        },
      })
    }

    if (onShowBookmarks) {
      items.push({
        id: 'show-bookmarks',
        label: '查看书签',
        description: '查看收藏的重要消息',
        icon: <Bookmark className="w-4 h-4 text-warning-500" />,
        category: COMMAND_CATEGORIES.tools,
        shortcut: ['B'],
        action: () => {
          onShowBookmarks()
          onClose()
        },
      })
    }

    if (onExportChat) {
      items.push({
        id: 'export-chat',
        label: '导出对话',
        description: '将对话历史导出为文件',
        icon: <Download className="w-4 h-4 text-success-500" />,
        category: COMMAND_CATEGORIES.tools,
        shortcut: ['E'],
        action: () => {
          onExportChat()
          onClose()
        },
      })
    }

    if (onImportChat) {
      items.push({
        id: 'import-chat',
        label: '导入对话',
        description: '从文件导入对话历史',
        icon: <Upload className="w-4 h-4 text-info-500" />,
        category: COMMAND_CATEGORIES.tools,
        shortcut: ['I'],
        action: () => {
          onImportChat()
          onClose()
        },
      })
    }

    if (onClearChat) {
      items.push({
        id: 'clear-chat',
        label: '清空对话',
        description: '清除当前会话的所有消息',
        icon: <Trash2 className="w-4 h-4 text-error-500" />,
        category: COMMAND_CATEGORIES.actions,
        shortcut: ['Shift', 'D'],
        action: () => {
          onClearChat()
          onClose()
        },
      })
    }

    if (onShowSettings) {
      items.push({
        id: 'show-settings',
        label: '打开设置',
        description: '配置对话偏好和模型参数',
        icon: <Settings className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />,
        category: COMMAND_CATEGORIES.help,
        shortcut: ['S'],
        action: () => {
          onShowSettings()
          onClose()
        },
      })
    }

    if (onShowHelp) {
      items.push({
        id: 'show-help',
        label: '帮助中心',
        description: '查看使用指南和常见问题',
        icon: <HelpCircle className="w-4 h-4 text-accent-500" />,
        category: COMMAND_CATEGORIES.help,
        shortcut: ['?'],
        action: () => {
          onShowHelp()
          onClose()
        },
      })
    }

    items.push({
      id: 'new-chat',
      label: '新建对话',
      description: '开始新的对话会话',
      icon: <MessageSquare className="w-4 h-4 text-primary-500" />,
      category: COMMAND_CATEGORIES.actions,
      shortcut: ['N'],
      action: () => {
        logger.info('[CommandPalette] 新建对话')
        onClose()
      },
    })

    items.push({
      id: 'ai-guide',
      label: 'AI 能力介绍',
      description: '了解 AI 助手能做什么',
      icon: <Wand2 className="w-4 h-4 text-danger-500" />,
      category: COMMAND_CATEGORIES.help,
      action: () => {
        logger.info('[CommandPalette] 打开 AI 能力介绍')
        onClose()
      },
    })

    items.push({
      id: 'knowledge-base',
      label: '知识库',
      description: '浏览配方知识库',
      icon: <BookOpen className="w-4 h-4 text-warning-500" />,
      category: COMMAND_CATEGORIES.tools,
      action: () => {
        logger.info('[CommandPalette] 打开知识库')
        onClose()
      },
    })

    items.push({
      id: 'quick-actions',
      label: '快捷操作',
      description: '常用功能快速访问',
      icon: <Zap className="w-4 h-4 text-warning-400" />,
      category: COMMAND_CATEGORIES.tools,
      action: () => {
        logger.info('[CommandPalette] 打开快捷操作')
        onClose()
      },
    })

    return items
  }, [quickQuestions, onQuickQuestion, onGenerateReport, onClearChat, onExportChat, onImportChat, onRetryLast, onShowBookmarks, onShowSettings, onShowHelp, onClose])

  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) {
      return commands
    }

    const query = searchQuery.toLowerCase()

    return commands.filter(command => {
      const labelMatch = command.label.toLowerCase().includes(query)
      const descriptionMatch = command.description?.toLowerCase().includes(query)
      const categoryMatch = command.category.toLowerCase().includes(query)
      return labelMatch || descriptionMatch || categoryMatch
    })
  }, [commands, searchQuery])

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}
    Object.values(COMMAND_CATEGORIES).forEach(category => {
      groups[category] = filteredCommands.filter(cmd => cmd.category === category)
    })
    return groups
  }, [filteredCommands])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      case 'Tab':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
        break
    }
  }, [filteredCommands, selectedIndex, onClose])

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchQuery('')
       
      setSelectedIndex(0)
    }
  }, [isOpen])

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (!isOpen) {
          logger.info('[CommandPalette] Ctrl+K pressed but palette already handled')
        }
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
         role="button" tabIndex={0} onClick={onClose}
      />

      {/* Command Panel */}
      <div
        className="relative w-full max-w-xl mx-4 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden animate-scale-in"
        style={{ animationDuration: '150ms' }}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
          <Search className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="搜索命令或输入问题..."
            className="flex-1 bg-transparent text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 outline-none text-sm"
            autoFocus
          />
          <div className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded">
            <span>ESC</span>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              <Search className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">未找到匹配的命令</p>
              <p className="text-xs mt-1">尝试其他关键词</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, items]) => {
              if (items.length === 0) return null
              return (
                <div key={category} className="py-2">
                  <div className="px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    {category}
                  </div>
                  {items.map((command) => {
                    const globalIndex = filteredCommands.indexOf(command)
                    const isSelected = globalIndex === selectedIndex
                    return (
                      <button
                        key={command.id}
                        onClick={command.action}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-primary-50 dark:bg-primary-300/20 text-primary-700 dark:text-primary-700'
                            : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                        }`}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        <span className={`p-2 rounded-lg ${isSelected ? 'bg-primary-100 dark:bg-primary-800/30' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
                          {command.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{command.label}</div>
                          {command.description && (
                            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                              {command.description}
                            </div>
                          )}
                        </div>
                        {command.shortcut && command.shortcut.length > 0 && (
                          <div className="flex gap-1">
                            {command.shortcut.map((key, i) => (
                              <span key={i} className="px-1.5 py-0.5 text-xs font-medium text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded">
                                {key}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-100 dark:border-neutral-700 text-xs text-neutral-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">↑↓</span>
              导航
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">Enter</span>
              执行
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">ESC</span>
              关闭
            </span>
          </div>
          <span className="text-primary-500 font-medium">RMFOOD AI</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
