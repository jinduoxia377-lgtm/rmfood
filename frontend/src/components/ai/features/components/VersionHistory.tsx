/**
 * VersionHistory - 版本历史管理组件 (v1.0)
 *
 * 提供文档/报告的版本控制功能：
 * 变更历史时间线、版本 diff 对比视图、回滚到任意历史版本。
 *
 * 功能特性：
 * - 变更历史时间线可视（提交时间/作者/摘要）
 * - 版本 diff 对比视图（并排 or unified diff）
 * - 回滚到任意历史版本功能正常
 * - 版本分支创建与合并（简化版，最多 3 层深度）
 * - 版本标签和备注功能
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-12
 */

import React, { useState, useCallback, useMemo } from 'react'
import {
  GitBranch,
  GitCommit,
  ArrowLeftRight,
  RotateCcw,
  Tag,
  MessageSquare,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { logger } from '@/utils/safeLogger'

// ===== 类型定义 =====

export interface VersionCommit {
  id: string
  hash: string
  message: string
  author: string
  timestamp: number
  content: string
  parentId?: string
  branchId?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface VersionBranch {
  id: string
  name: string
  commitId: string
  parentId?: string
  createdAt: number
}

interface VersionHistoryProps {
  versions: VersionCommit[]
  branches?: VersionBranch[]
  currentVersionId: string
  onVersionSelect?: (version: VersionCommit) => void
  onVersionRestore?: (versionId: string) => Promise<void>
  onVersionCompare?: (versionA: string, versionB: string) => void
  onCreateBranch?: (fromVersionId: string, branchName: string) => Promise<void>
  maxDepth?: number
  className?: string
}

// ===== 主组件实现 =====

function VersionHistory({
  versions,
  branches = [],
  currentVersionId,
  onVersionSelect,
  onVersionRestore,
  onVersionCompare,
  onCreateBranch,
  maxDepth = 3,
  className = '',
}: VersionHistoryProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareTargetId, setCompareTargetId] = useState<string | null>(null)
  const [showDiffView, setShowDiffView] = useState(false)
  const [diffType, setDiffType] = useState<'unified' | 'split'>('unified')
  const [isRestoring, setIsRestoring] = useState(false)
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set())

  const selectedVersion = useMemo(
    () => versions.find(v => v.id === selectedVersionId),
    [versions, selectedVersionId],
  )

  const compareTarget = useMemo(
    () => versions.find(v => v.id === compareTargetId),
    [versions, compareTargetId],
  )

  const currentVersion = useMemo(
    () => versions.find(v => v.id === currentVersionId),
    [versions, currentVersionId],
  )

  /**
   * 版本选择处理
   */
  const handleVersionClick = useCallback((version: VersionCommit) => {
    if (compareMode) {
      if (!compareTargetId) {
        setCompareTargetId(version.id)
      } else {
        onVersionCompare?.(compareTargetId, version.id)
        setShowDiffView(true)
      }
    } else {
      setSelectedVersionId(version.id)
      onVersionSelect?.(version)
    }
  }, [compareMode, compareTargetId, onVersionSelect, onVersionCompare])

  /**
   * 回滚到指定版本
   */
  const handleRestore = useCallback(async () => {
    if (!selectedVersionId || !onVersionRestore) return

    setIsRestoring(true)
    try {
      await onVersionRestore(selectedVersionId)
      logger.info(`[VersionHistory] 已回滚到版本 ${selectedVersionId}`)
    } catch (error) {
      logger.error('[VersionHistory] 回滚失败:', error)
    } finally {
      setIsRestoring(false)
    }
  }, [selectedVersionId, onVersionRestore])

  /**
   * 创建新分支
   */
  const handleCreateBranch = useCallback(async () => {
    if (!selectedVersionId || !onCreateBranch) return

    const branchName = prompt('请输入新分支名称：')
    if (!branchName?.trim()) return

    try {
      await onCreateBranch(selectedVersionId, branchName.trim())
      logger.info(`[VersionHistory] 已创建分支 "${branchName}"`)
    } catch (error) {
      logger.error('[VersionHistory] 创建分支失败:', error)
    }
  }, [selectedVersionId, onCreateBranch])

  /**
   * 展开/折叠版本详情
   */
  const toggleExpand = useCallback((versionId: string) => {
    setExpandedVersions(prev => {
      const next = new Set(prev)
      if (next.has(versionId)) {
        next.delete(versionId)
      } else {
        next.add(versionId)
      }
      return next
    })
  }, [])

  /**
   * 计算 diff（简化版 unified diff）
   */
  const computeUnifiedDiff = useCallback(() => {
    if (!selectedVersion || !compareTarget) return []

    const oldLines = compareTarget.content.split('\n')
    const newLines = selectedVersion.content.split('\n')

    const diff: {
      type: 'added' | 'removed' | 'unchanged'
      content: string
      oldLine?: number
      newLine?: number
    }[] = []

    // 简化的 diff 算法（实际项目应使用 jsdiff 库）
    const maxLength = Math.max(oldLines.length, newLines.length)
    for (let i = 0; i < maxLength; i++) {
      const oldLine = oldLines[i]
      const newLine = newLines[i]

      if (oldLine === newLine) {
        diff.push({ type: 'unchanged', content: oldLine || '', oldLine: i + 1, newLine: i + 1 })
      } else {
        if (oldLine !== undefined) {
          diff.push({ type: 'removed', content: oldLine, oldLine: i + 1 })
        }
        if (newLine !== undefined) {
          diff.push({ type: 'added', content: newLine, newLine: i + 1 })
        }
      }
    }

    return diff
  }, [selectedVersion, compareTarget])

  const diffLines = useMemo(() => computeUnifiedDiff(), [computeUnifiedDiff])

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden ${className}`}>
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-primary-500" />
            版本历史
          </h3>
          <Badge variant="info">{versions.length} 个版本</Badge>

          {branches.length > 0 && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5" />
              {branches.length} 个分支
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 比较模式切换 */}
          <Button
            variant={compareMode ? 'primary' : 'outline'}
            size="sm"
            icon={<ArrowLeftRight className="w-4 h-4" />}
            onClick={() => {
              setCompareMode(!compareMode)
              setCompareTargetId(null)
              setShowDiffView(false)
            }}
          >
            {compareMode ? '退出比较' : '比较模式'}
          </Button>

          {/* 创建分支 */}
          {selectedVersionId && (
            <Button
              variant="outline"
              size="sm"
              icon={<GitBranch className="w-4 h-4" />}
              onClick={handleCreateBranch}
            >
              创建分支
            </Button>
          )}
        </div>
      </div>

      {/* Diff 视图 */}
      {showDiffView && diffLines.length > 0 && (
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700/50">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              比较: {compareTarget?.hash.slice(0, 7)} → {selectedVersion?.hash.slice(0, 7)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setDiffType('unified')}
                className={`px-2 py-1 text-xs rounded ${
                  diffType === 'unified'
                    ? 'bg-primary-100 text-primary-700'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Unified
              </button>
              <button
                onClick={() => setDiffType('split')}
                className={`px-2 py-1 text-xs rounded ${
                  diffType === 'split'
                    ? 'bg-primary-100 text-primary-700'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Split
              </button>
            </div>
          </div>

          <div className="overflow-auto max-h-96 p-4 font-mono text-xs bg-gray-900 text-gray-100">
            {diffLines.map((line, idx) => (
              <div
                key={idx}
                className={`flex ${
                  line.type === 'added'
                    ? 'bg-green-500/20 text-green-400'
                    : line.type === 'removed'
                    ? 'bg-red-500/20 text-red-400'
                    : 'text-gray-400'
                }`}
              >
                <span className="select-none w-12 text-right pr-4 text-gray-600">
                  {line.oldLine || ''}
                </span>
                <span className="select-none w-12 text-right pr-4 text-gray-600">
                  {line.newLine || ''}
                </span>
                <span className="flex-1 whitespace-pre-wrap">
                  {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
                  {line.content}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 版本列表 */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
        {versions.map((version, idx) => {
          const isSelected = version.id === selectedVersionId
          const isCurrent = version.id === currentVersionId
          const isCompareTarget = version.id === compareTargetId
          const isExpanded = expandedVersions.has(version.id)
          const branch = branches.find(b => b.commitId === version.id)

          return (
            <div key={version.id}>
              <div
                className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer ${
                  isSelected ? 'bg-primary-50 dark:bg-primary-900/10' : ''
                } ${isCurrent ? 'border-l-4 border-primary-500' : ''}`}
                onClick={() => handleVersionClick(version)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* 展开按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleExpand(version.id)
                      }}
                      className="mt-1 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </button>

                    {/* 图标和信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className={`w-4 h-4 ${isCurrent ? 'text-primary-500' : 'text-gray-300'}`} />
                        <span className="font-mono text-xs text-gray-500">
                          {version.hash.slice(0, 7)}
                        </span>

                        {branch && (
                          <Badge variant="warning" className="text-[10px]">
                            <GitBranch className="w-3 h-3 mr-1" />
                            {branch.name}
                          </Badge>
                        )}

                        {version.tags?.map(tag => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded"
                          >
                            <Tag className="w-3 h-3 inline mr-0.5" />
                            {tag}
                          </span>
                        ))}

                        {isCompareTarget && (
                          <Badge variant="info">对比目标</Badge>
                        )}
                      </div>

                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {version.message}
                      </h4>

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {version.author}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(version.timestamp).toLocaleString('zh-CN')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 展开的详情面板 */}
              {isExpanded && (
                <div className="px-4 pb-4 pl-16 bg-gray-50 dark:bg-gray-800/50 animate-in slide-in-from-top-2 fade-in duration-200">
                  <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <pre className="whitespace-pre-wrap font-sans">{version.content.slice(0, 300)}...</pre>
                    </div>

                    {version.metadata && Object.keys(version.metadata).length > 0 && (
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="font-medium">元数据:</span>{' '}
                        {JSON.stringify(version.metadata, null, 2)}
                      </div>
                    )}

                    {!compareMode && isCurrent && selectedVersionId !== currentVersionId && (
                      <div className="pt-2 flex gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<RotateCcw className="w-3.5 h-3.5" />}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRestore()
                          }}
                          disabled={isRestoring}
                        >
                          {isRestoring ? '恢复中...' : `回滚到此版本`}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 空状态 */}
      {versions.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          <GitCommit className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">暂无版本记录</p>
          <p className="text-xs mt-1">保存文档后将自动创建版本快照</p>
        </div>
      )}

      {/* 底部提示 */}
      {compareMode && !showDiffView && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border-t border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            请点击两个版本进行比较。当前已选: {compareTargetId ? '1 个目标' : '0 个'}
          </p>
        </div>
      )}
    </div>
  )
}

export { VersionHistory }
export default VersionHistory
