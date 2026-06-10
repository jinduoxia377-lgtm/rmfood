import { useState } from 'react'
import { GitBranch, ChevronDown, ChevronUp, Clock, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FormulaVersion {
  id: number
  formula_id: number
  version: number
  snapshot: Record<string, unknown>
  change_summary: string | null
  created_by: number
  created_at: string
  creator_name?: string
}

interface VersionTimelineProps {
  versions: FormulaVersion[]
  currentVersion?: number
}

export function VersionTimeline({ versions, currentVersion }: VersionTimelineProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  if (!versions || versions.length === 0) {
    return (
      <div className="text-center py-8">
        <GitBranch size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-sm text-slate-400">暂无版本记录</p>
      </div>
    )
  }

  const sortedVersions = [...versions].sort((a, b) => b.version - a.version)

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />
      <div className="space-y-3">
        {sortedVersions.map((v, index) => {
          const isCurrent = currentVersion !== undefined ? v.version === currentVersion : index === 0
          const isExpanded = expandedId === v.id

          return (
            <div key={v.id} className="relative pl-10">
              <div
                className={cn(
                  'absolute left-0 w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10',
                  'bg-slate-100 dark:bg-slate-800 border-2',
                  isCurrent
                    ? 'border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-slate-200 dark:border-slate-700',
                )}
              >
                <GitBranch size={14} className={isCurrent ? 'text-primary-500' : 'text-slate-400'} />
              </div>

              <div
                className={cn(
                  'bg-white dark:bg-slate-900 rounded-lg border transition-all cursor-pointer',
                  isCurrent
                    ? 'border-primary-200 dark:border-primary-800 shadow-sm hover:shadow-md'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
                  isExpanded && 'shadow-md',
                )}
                onClick={() => toggleExpand(v.id)}
              >
                <div className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'text-sm font-semibold',
                          isCurrent ? 'text-primary-600 dark:text-primary-400' : 'text-slate-900 dark:text-white',
                        )}>
                          v{v.version}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded">
                            当前版本
                          </span>
                        )}
                      </div>

                      {v.change_summary && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                          {v.change_summary}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(v.created_at).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {v.creator_name && (
                          <span className="flex items-center gap-1">
                            <User size={10} />
                            {v.creator_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400">
                      {isExpanded ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="space-y-2">
                      <div className="text-xs">
                        <span className="text-slate-500 dark:text-slate-400">版本号：</span>
                        <span className="text-slate-700 dark:text-slate-300">v{v.version}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-slate-500 dark:text-slate-400">创建时间：</span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {new Date(v.created_at).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      {v.creator_name && (
                        <div className="text-xs">
                          <span className="text-slate-500 dark:text-slate-400">创建人ID：</span>
                          <span className="text-slate-700 dark:text-slate-300">{v.created_by}</span>
                        </div>
                      )}
                      {v.change_summary && (
                        <div className="text-xs">
                          <span className="text-slate-500 dark:text-slate-400">变更摘要：</span>
                          <span className="text-slate-700 dark:text-slate-300">{v.change_summary}</span>
                        </div>
                      )}
                      <div className="text-xs">
                        <span className="text-slate-500 dark:text-slate-400">快照数据：</span>
                        <pre className="mt-1 p-2 bg-slate-50 dark:bg-slate-800 rounded text-[10px] overflow-auto max-h-32 text-slate-600 dark:text-slate-400">
                          {JSON.stringify(v.snapshot, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
