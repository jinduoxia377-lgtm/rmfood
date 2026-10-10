/**
 * 配方版本 Diff 对比组件
 * 左右分栏显示两个版本的数据差异
 */
import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Plus, Minus, Edit2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VersionData {
  id: number
  version: string
  snapshot: Record<string, unknown>
  created_at: string
  change_summary?: string
}

interface DiffItem {
  path: string
  type: 'added' | 'removed' | 'modified' | 'unchanged'
  oldValue?: unknown
  newValue?: unknown
}

interface VersionDiffViewerProps {
  leftVersion: VersionData | null
  rightVersion: VersionData | null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function computeDiff(
  oldObj: Record<string, unknown> | unknown[] | null,
  newObj: Record<string, unknown> | unknown[] | null,
  path = '',
): DiffItem[] {
  const result: DiffItem[] = []

  if (oldObj === null && newObj === null) return result

  if (oldObj === null) {
    if (isObject(newObj)) {
      Object.entries(newObj).forEach(([key, value]) => {
        result.push(...computeDiff(null, { [key]: value }, path ? `${path}.${key}` : key))
      })
    } else {
      result.push({ path, type: 'added', newValue: newObj })
    }
    return result
  }

  if (newObj === null) {
    if (isObject(oldObj)) {
      Object.entries(oldObj).forEach(([key, value]) => {
        result.push(...computeDiff({ [key]: value }, null, path ? `${path}.${key}` : key))
      })
    } else {
      result.push({ path, type: 'removed', oldValue: oldObj })
    }
    return result
  }

  if (isArray(oldObj) && isArray(newObj)) {
    const maxLen = Math.max(oldObj.length, newObj.length)
    for (let i = 0; i < maxLen; i++) {
      const oldItem = oldObj[i]
      const newItem = newObj[i]
      const itemPath = `${path}[${i}]`

      if (i >= oldObj.length) {
        result.push({ path: itemPath, type: 'added', newValue: newItem })
      } else if (i >= newObj.length) {
        result.push({ path: itemPath, type: 'removed', oldValue: oldItem })
      } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
        if (isObject(oldItem) && isObject(newItem)) {
          result.push(...computeDiff(oldItem, newItem, itemPath))
        } else {
          result.push({ path: itemPath, type: 'modified', oldValue: oldItem, newValue: newItem })
        }
      } else {
        result.push({ path: itemPath, type: 'unchanged', oldValue: oldItem, newValue: newItem })
      }
    }
    return result
  }

  if (isObject(oldObj) && isObject(newObj)) {
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])

    allKeys.forEach((key) => {
      const oldVal = oldObj[key]
      const newVal = newObj[key]
      const keyPath = path ? `${path}.${key}` : key

      if (!(key in oldObj)) {
        result.push({ path: keyPath, type: 'added', newValue: newVal })
      } else if (!(key in newObj)) {
        result.push({ path: keyPath, type: 'removed', oldValue: oldVal })
      } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        if (isObject(oldVal) && isObject(newVal)) {
          result.push(...computeDiff(oldVal, newVal, keyPath))
        } else {
          result.push({ path: keyPath, type: 'modified', oldValue: oldVal, newValue: newVal })
        }
      } else {
        result.push({ path: keyPath, type: 'unchanged', oldValue: oldVal, newValue: newVal })
      }
    })
    return result
  }

  if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
    result.push({ path, type: 'modified', oldValue: oldObj, newValue: newObj })
  } else {
    result.push({ path, type: 'unchanged', oldValue: oldObj, newValue: newObj })
  }

  return result
}

function DiffLine({ item, expanded, onToggle }: { item: DiffItem; expanded: boolean; onToggle: () => void }) {
  const [isOpen, setIsOpen] = useState(expanded)
  const hasChildren = isObject(item.oldValue) || isObject(item.newValue) || isArray(item.oldValue) || isArray(item.newValue)
  const isComplex = hasChildren && item.type !== 'unchanged'

  const bgClass = {
    added: 'bg-[var(--color-success-container,#DCFCE7)]',
    removed: 'bg-[var(--color-error-container,#FFE0E0)]',
    modified: 'bg-[var(--color-warning-container,#FFF3CD)]',
    unchanged: '',
  }[item.type]

  const icon = {
    added: <Plus size={12} className="text-success-600 shrink-0" />,
    removed: <Minus size={12} className="text-error-600 shrink-0" />,
    modified: <Edit2 size={12} className="text-warning-600 shrink-0" />,
    unchanged: null,
  }[item.type]

  const valueClass = {
    added: 'text-success-700 dark:text-success-600',
    removed: 'text-error-700 dark:text-error-600',
    modified: 'text-warning-700 dark:text-warning-700',
    unchanged: 'text-neutral-500 dark:text-neutral-400',
  }[item.type]

  const renderValue = (val: unknown): string => {
    if (val === undefined) return 'undefined'
    if (val === null) return 'null'
    if (typeof val === 'string') return `"${val}"`
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  }

  return (
    <div className="text-sm font-mono">
      <div
        className={cn(
          'flex items-start gap-2 py-1 px-2 rounded',
          bgClass,
          isOpen && isComplex && 'border-b border-neutral-200 dark:border-neutral-700',
        )}
      >
        <button
          onClick={() => isComplex && (setIsOpen(!isOpen), onToggle())}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              if (isComplex) {
                setIsOpen(!isOpen)
                onToggle()
              }
            }
          }}
          className={cn('shrink-0 mt-0.5', !isComplex && 'invisible')}
          aria-expanded={isComplex ? isOpen : undefined}
          aria-label={isComplex ? (isOpen ? '折叠详情' : '展开详情') : undefined}
        >
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {icon}
          <span className="text-neutral-500 dark:text-neutral-400 truncate">{item.path}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-[2]">
          {item.type === 'removed' || item.type === 'modified' ? (
            <span className={cn('truncate', valueClass)}>{renderValue(item.oldValue)}</span>
          ) : (
            <span className="truncate text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">-</span>
          )}
          {item.type === 'added' || item.type === 'modified' ? (
            <span className={cn('truncate', valueClass)}>{renderValue(item.newValue)}</span>
          ) : (
            <span className="truncate text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">-</span>
          )}
        </div>
      </div>
      {isOpen && isComplex && (
        <div className="pl-6 border-l-2 border-neutral-200 dark:border-neutral-700 ml-2">
          {isObject(item.oldValue) && isObject(item.newValue) && (
            <NestedDiff oldObj={item.oldValue} newObj={item.newValue} path={item.path} />
          )}
          {isArray(item.oldValue) && isArray(item.newValue) && (
            <NestedArrayDiff oldArr={item.oldValue} newArr={item.newValue} path={item.path} />
          )}
          {isObject(item.oldValue) && !isObject(item.newValue) && (
            <NestedDiff oldObj={item.oldValue} newObj={{}} path={item.path} />
          )}
          {!isObject(item.oldValue) && isObject(item.newValue) && (
            <NestedDiff oldObj={{}} newObj={item.newValue} path={item.path} />
          )}
        </div>
      )}
    </div>
  )
}

function NestedDiff({ oldObj, newObj, path }: { oldObj: Record<string, unknown>; newObj: Record<string, unknown>; path: string }) {
  const diff = useMemo(() => computeDiff(oldObj, newObj, path), [oldObj, newObj, path])
  return (
    <div>
      {diff.filter(d => d.type !== 'unchanged').map((item) => (
        <DiffLine key={item.path} item={item} expanded={false} onToggle={() => {}} />
      ))}
    </div>
  )
}

function NestedArrayDiff({ oldArr, newArr, path }: { oldArr: unknown[]; newArr: unknown[]; path: string }) {
  const diff = useMemo(() => computeDiff(oldArr, newArr, path), [oldArr, newArr, path])
  return (
    <div>
      {diff.filter(d => d.type !== 'unchanged').map((item) => (
        <DiffLine key={item.path} item={item} expanded={false} onToggle={() => {}} />
      ))}
    </div>
  )
}

export function VersionDiffViewer({ leftVersion, rightVersion }: VersionDiffViewerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const diff = useMemo(() => {
    return computeDiff(
      leftVersion?.snapshot ?? null,
      rightVersion?.snapshot ?? null,
    )
  }, [leftVersion, rightVersion])

  const stats = useMemo(() => {
    return {
      added: diff.filter(d => d.type === 'added').length,
      removed: diff.filter(d => d.type === 'removed').length,
      modified: diff.filter(d => d.type === 'modified').length,
    }
  }, [diff])

  if (!leftVersion && !rightVersion) {
    return (
      <div className="text-center py-12 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
        <p>请选择要对比的版本</p>
      </div>
    )
  }

  const changedDiffs = diff.filter(d => d.type !== 'unchanged')

  return (
    <section
      className="space-y-4"
      aria-labelledby="version-diff-heading"
    >
      <h2 id="version-diff-heading" className="sr-only">版本对比</h2>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[var(--color-success-container,#DCFCE7)]"></span>
            <span className="text-neutral-600 dark:text-neutral-400">新增 {stats.added}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[var(--color-error-container,#FFE0E0)]"></span>
            <span className="text-neutral-600 dark:text-neutral-400">删除 {stats.removed}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[var(--color-warning-container,#FFF3CD)]"></span>
            <span className="text-neutral-600 dark:text-neutral-400">修改 {stats.modified}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-0.5">
            {leftVersion ? `v${leftVersion.version}` : '未选择'}
          </p>
          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            {leftVersion ? new Date(leftVersion.created_at).toLocaleDateString('zh-CN') : '-'}
          </p>
          {leftVersion?.change_summary && (
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{leftVersion.change_summary}</p>
          )}
        </div>
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-0.5">
            {rightVersion ? `v${rightVersion.version}` : '未选择'}
          </p>
          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            {rightVersion ? new Date(rightVersion.created_at).toLocaleDateString('zh-CN') : '-'}
          </p>
          {rightVersion?.change_summary && (
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{rightVersion.change_summary}</p>
          )}
        </div>
      </div>

      <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
        <div className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 px-3 py-2 flex items-center justify-between" role="row">
          <div className="flex items-center gap-4 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            <span className="w-4"></span>
            <span className="flex-1">路径</span>
            <span className="flex-[2]">旧值</span>
            <span className="flex-[2]">新值</span>
          </div>
        </div>
        <div
          className="max-h-96 overflow-y-auto"
          role="table"
          aria-label="版本差异详情表格"
        >
          <div role="rowgroup" aria-label="差异数据">
          {changedDiffs.length === 0 ? (
            <div className="py-8 text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" role="row">两个版本完全相同</div>
          ) : (
            changedDiffs.map((item) => (
              <DiffLine
                key={item.path}
                item={item}
                expanded={expandedPaths.has(item.path)}
                onToggle={() => toggleExpand(item.path)}
              />
            ))
          )}
          </div>
        </div>
      </div>
    </section>
  )
}
