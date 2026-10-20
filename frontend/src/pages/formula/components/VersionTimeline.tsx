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
        <GitBranch size={32} className="mx-auto text-[var(--text-muted)] dark:text-[var(--text-muted)] mb-2" />
        <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">暂无版本记录</p>
      </div>
    )
  }

  const sortedVersions = [...versions].sort((a, b) => b.version - a.version)

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--border-color)]" />
      <div className="space-y-[var(--space-apple-sm)]">
        {sortedVersions.map((v, index) => {
          const isCurrent = currentVersion !== undefined ? v.version === currentVersion : index === 0
          const isExpanded = expandedId === v.id

          return (
            <div key={v.id} className="relative pl-10">
              <div
                className={cn(
                  'absolute left-0 w-8 h-8 rounded-[var(--radius-pill)] flex items-center justify-center shrink-0 z-10',
                  'bg-[var(--bg-tertiary)] border-2',
                  isCurrent
                    ? 'border-[var(--color-primary)] dark:border-[var(--color-primary)] bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/25'
                    : 'border-[var(--border-color)]',
                )}
              >
                <GitBranch size={14} className={isCurrent ? 'text-[var(--color-primary-text)]0' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'} />
              </div>

              <div
                className={cn(
                  'bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] border transition-all cursor-pointer',
                  isCurrent
                    ? 'border-[var(--color-primary-border)] dark:border-[var(--color-primary)] shadow-sm hover:shadow-md'
                    : 'border-[var(--border-color)] dark:border-neutral-800 hover:border-[var(--border-color)] dark:hover:border-neutral-700',
                  isExpanded && 'shadow-md',
                )}
                 role="button" tabIndex={0} onClick={() => toggleExpand(v.id)}
              >
                <div className="p-[var(--space-apple-sm)]">
                  <div className="flex items-start justify-between gap-[var(--space-apple-sm)]">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'text-sm font-semibold',
                          isCurrent ? 'text-[var(--color-primary-text)]' : 'text-[var(--text-primary)]',
                        )}>
                          v{v.version}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/30 text-[var(--color-primary-text)] rounded">
                            当前版本
                          </span>
                        )}
                      </div>

                      {v.change_summary && (
                        <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                          {v.change_summary}
                        </p>
                      )}

                      <div className="flex items-center gap-[var(--space-apple-sm)] mt-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
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

                    <div className="flex items-center gap-1 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      {isExpanded ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-[var(--space-apple-sm)] pb-3 border-t border-[var(--border-color)] pt-3">
                    <div className="space-y-2">
                      <div className="text-xs">
                        <span className="text-[var(--text-muted)]">版本号：</span>
                        <span className="text-[var(--text-primary)]">v{v.version}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-[var(--text-muted)]">创建时间：</span>
                        <span className="text-[var(--text-primary)]">
                          {new Date(v.created_at).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      {v.creator_name && (
                        <div className="text-xs">
                          <span className="text-[var(--text-muted)]">创建人ID：</span>
                          <span className="text-[var(--text-primary)]">{v.created_by}</span>
                        </div>
                      )}
                      {v.change_summary && (
                        <div className="text-xs">
                          <span className="text-[var(--text-muted)]">变更摘要：</span>
                          <span className="text-[var(--text-primary)]">{v.change_summary}</span>
                        </div>
                      )}
                      <div className="text-xs">
                        <span className="text-[var(--text-muted)]">快照数据：</span>
                        <pre className="mt-1 p-2 bg-[var(--bg-tertiary)] rounded text-xs overflow-auto max-h-32 text-[var(--text-secondary)]">
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
