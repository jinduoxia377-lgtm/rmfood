/**
 * DetailsPanel — DSH 风格工具调用详情面板
 *
 * 参照 DSH Details 面板设计：
 * - 从消息操作栏点击「详情」触发
 * - 显示工具调用链、参数、返回结果
 * - 可折叠/展开
 * - 与对话区并列（通过 resize handle 调整宽度）
 *
 * @version 1.0.0
 */
import React, { useState } from 'react'
import { ChevronRight, ChevronDown, Code, Wrench, FileText, ExternalLink, X } from 'lucide-react'

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: string
  status: 'running' | 'completed' | 'error'
  durationMs?: number
}

export interface DetailsPanelProps {
  /** 当前选中的工具调用 */
  selectedCall?: ToolCall | null
  /** 关闭面板 */
  onClose: () => void
  /** 面板标题 */
  title?: string
}

// 工具图标映射
const TOOL_ICONS: Record<string, React.ReactNode> = {
  'read_file': <FileText className="w-3.5 h-3.5" />,
  'write_file': <FileText className="w-3.5 h-3.5" />,
  'search': <ExternalLink className="w-3.5 h-3.5" />,
  'execute_command': <Code className="w-3.5 h-3.5" />,
  'default': <Wrench className="w-3.5 h-3.5" />,
}

function getToolIcon(name: string): React.ReactNode {
  const key = name.toLowerCase().replace(/[-_\s]/g, '_')
  return TOOL_ICONS[key] ?? TOOL_ICONS['default']
}

function JsonView({ data }: { data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false)
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
      >
        <ChevronRight className="w-3 h-3" />
        展开参数 ({Object.keys(data).length} 项)
      </button>
    )
  }
  return (
    <div className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 mt-1 space-y-0.5">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="text-neutral-800 dark:text-neutral-300">{k}:</span>
          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] truncate">
            {typeof v === 'string' ? `"${v}"` : JSON.stringify(v)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function DetailsPanel({ selectedCall, onClose, title = '工具调用详情' }: DetailsPanelProps) {
  if (!selectedCall) return null

  const isRunning = selectedCall.status === 'running'
  const isCompleted = selectedCall.status === 'completed'
  const isError = selectedCall.status === 'error'

  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-950 border-l border-neutral-200 dark:border-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : isCompleted ? 'bg-emerald-500' : isError ? 'bg-red-500' : 'bg-neutral-400'}`} />
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{title}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 工具名称 */}
        <div className="flex items-center gap-2">
          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{getToolIcon(selectedCall.name)}</span>
          <span className="text-sm font-mono font-medium text-neutral-800 dark:text-neutral-200">
            {selectedCall.name}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
            isRunning ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
            isCompleted ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
            isError ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
            'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
          }`}>
            {isRunning ? '运行中' : isCompleted ? '已完成' : isError ? '错误' : '等待'}
          </span>
          {selectedCall.durationMs !== undefined && isCompleted && (
            <span className="text-[10px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-auto">{selectedCall.durationMs}ms</span>
          )}
        </div>

        {/* 参数 */}
        <div>
          <div className="text-[10px] font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider mb-1">参数</div>
          <JsonView data={selectedCall.arguments} />
        </div>

        {/* 结果 */}
        {selectedCall.result && (
          <div>
            <div className="text-[10px] font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider mb-1">结果</div>
            <div className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-2 text-[11px] font-mono text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
              {selectedCall.result}
            </div>
          </div>
        )}

        {/* 错误信息 */}
        {isError && selectedCall.result && (
          <div>
            <div className="text-[10px] font-medium text-red-400 uppercase tracking-wider mb-1">错误信息</div>
            <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-2 text-[11px] text-red-600 dark:text-red-400 whitespace-pre-wrap break-all">
              {selectedCall.result}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800 text-[10px] text-neutral-400">
        ID: {selectedCall.id}
      </div>
    </div>
  )
}
