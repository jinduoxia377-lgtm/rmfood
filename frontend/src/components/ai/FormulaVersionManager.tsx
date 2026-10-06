/**
 * 配方历史版本管理组件
 * 支持配方版本的时间线展示、对比和回滚
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Card } from '@/components/ui'
import {
  History, GitBranch, RotateCcw, MessageSquare, ChevronRight, Clock,
  AlertTriangle, CheckCircle, X, Download, FileJson, FileText, FileType,
  ArrowRightLeft, Edit3, Save, Loader2, BarChart3, Sparkles, GitMerge,
} from 'lucide-react'

export type ExportFormat = 'json' | 'markdown' | 'pdf'

export interface FormulaVersion {
  id: string
  versionNumber: number
  formulaName: string
  effects: string[]
  ingredients: {
    name: string
    dosage: string
    role: string
  }[]
  scores: {
    synergy: number
    taste: number
    stability: number
    overall: number
  }
  createdAt: number
  remark: string
  parentId?: string
}

interface FormulaVersionManagerProps {
  versions: FormulaVersion[]
  currentVersionId?: string
  onSelectVersion?: (version: FormulaVersion) => void
  onRollback?: (version: FormulaVersion) => void
  onVersionCompare?: (v1: FormulaVersion, v2: FormulaVersion) => void
  onAddRemark?: (versionId: string, remark: string) => void
  onCreateBranch?: (version: FormulaVersion) => void
  maxVersions?: number
}

export function FormulaVersionManager({
  versions,
  currentVersionId,
  onSelectVersion,
  onRollback,
  onVersionCompare,
  onAddRemark,
  onCreateBranch,
  maxVersions = 100,
}: FormulaVersionManagerProps) {
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [editingRemark, setEditingRemark] = useState<string | null>(null)
  const [remarkText, setRemarkText] = useState('')
  const [rollbackConfirm, setRollbackConfirm] = useState<FormulaVersion | null>(null)
  const [showExportMenu, setShowExportMenu] = useState<FormulaVersion | null>(null)
  const [showComparePanel, setShowComparePanel] = useState<{ v1: FormulaVersion; v2: FormulaVersion } | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    setFeedbackMessage({ type, message })
    setTimeout(() => setFeedbackMessage(null), 3000)
  }, [])

  const sortedVersions = useMemo(() => {
    return [...versions].sort((a, b) => b.versionNumber - a.versionNumber)
  }, [versions])

  const versionTimeline = useMemo(() => {
    const timeline: { version: FormulaVersion; branches: FormulaVersion[] }[] = []
    const versionMap = new Map<string, FormulaVersion>()
    const branchMap = new Map<string, FormulaVersion[]>()

    versions.forEach((v) => {
      if (v.parentId) {
        const branches = branchMap.get(v.parentId) || []
        branches.push(v)
        branchMap.set(v.parentId, branches)
      } else {
        versionMap.set(v.id, v)
      }
    })

    versionMap.forEach((version) => {
      timeline.push({
        version,
        branches: branchMap.get(version.id) || [],
      })
    })

    return timeline.sort((a, b) => b.version.versionNumber - a.version.versionNumber)
  }, [versions])

  const handleVersionSelect = useCallback((versionId: string) => {
    setSelectedVersions((prev) => {
      if (prev.includes(versionId)) {
        return prev.filter((id) => id !== versionId)
      }
      if (prev.length >= 2) {
        return [prev[1], versionId]
      }
      return [...prev, versionId]
    })
  }, [])

  const handleCompare = useCallback(() => {
    if (selectedVersions.length === 2) {
      const v1 = versions.find((v) => v.id === selectedVersions[0])
      const v2 = versions.find((v) => v.id === selectedVersions[1])
      if (v1 && v2) {
        setShowComparePanel({ v1, v2 })
        onVersionCompare?.(v1, v2)
      }
    }
  }, [selectedVersions, versions, onVersionCompare])

  const handleAddRemark = useCallback((versionId: string) => {
    if (remarkText.length > 200) {
      showFeedback('error', '备注不能超过200字')
      return
    }
    onAddRemark?.(versionId, remarkText)
    setEditingRemark(null)
    setRemarkText('')
    showFeedback('success', '备注已保存')
  }, [remarkText, onAddRemark, showFeedback])

  const handleRollbackWithConfirm = useCallback((version: FormulaVersion) => {
    setRollbackConfirm(version)
  }, [])

  const confirmRollback = useCallback(() => {
    if (rollbackConfirm) {
      onRollback?.(rollbackConfirm)
      showFeedback('success', `已回滚到版本 ${rollbackConfirm.versionNumber}`)
      setRollbackConfirm(null)
    }
  }, [rollbackConfirm, onRollback, showFeedback])

  const handleExport = useCallback((version: FormulaVersion, format: ExportFormat) => {
    const filename = `${typeof version.formulaName === 'string' ? version.formulaName : '未知配方'}_v${version.versionNumber}`

    if (format === 'json') {
      const jsonContent = JSON.stringify({
        formulaName: typeof version.formulaName === 'string' ? version.formulaName : '未知配方',
        versionNumber: version.versionNumber,
        effects: Array.isArray(version.effects) ? version.effects.map(e => typeof e === 'string' ? e : '未知功效') : [],
        ingredients: Array.isArray(version.ingredients) ? version.ingredients.map(ing => ({
          name: typeof ing.name === 'string' ? ing.name : '未知药材',
          dosage: typeof ing.dosage === 'string' ? ing.dosage : '未知剂量',
          role: typeof ing.role === 'string' ? ing.role : '未知角色',
        })) : [],
        scores: version.scores,
        createdAt: new Date(version.createdAt).toLocaleString('zh-CN'),
        remark: typeof version.remark === 'string' ? version.remark : '',
        changeLog: [],
      }, null, 2)
      downloadFile(`${filename}.json`, jsonContent, 'application/json')
      showFeedback('success', 'JSON 导出成功')
    } else if (format === 'markdown') {
      const mdContent = generateMarkdown(version)
      downloadFile(`${filename}.md`, mdContent, 'text/markdown')
      showFeedback('success', 'Markdown 导出成功')
    } else if (format === 'pdf') {
      const mdContent = generateMarkdown(version)
      try {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>${typeof filename === 'string' ? filename : '未知配方'}</title>
            <style>
              body { font-family: 'Source Han Serif SC', 'SimSun', serif; padding: 40px; }
              h1 { color: #333; border-bottom: 2px solid #14B8A6; }
              table { border-collapse: collapse; width: 100%; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f5f5f5; }
            </style>
          </head>
          <body>
            ${markdownToHtml(mdContent)}
          </body>
          </html>
        `
        const printWindow = window.open('', '_blank')
        if (printWindow) {
          printWindow.document.write(htmlContent)
          printWindow.document.close()
          printWindow.print()
        }
        showFeedback('success', 'PDF 打印窗口已打开')
      } catch {
        showFeedback('error', 'PDF 导出失败，请使用 Markdown 格式导出后自行转换')
      }
    }
    setShowExportMenu(null)
  }, [showFeedback])

  if (versions.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
            <History className="w-6 h-6 text-neutral-400" />
          </div>
          <h3 className="font-medium text-neutral-700 dark:text-neutral-300 mb-1">暂无版本记录</h3>
          <p className="text-sm text-neutral-500">配方修改后将自动创建版本</p>
        </div>
      </Card>
    )
  }

  return (
    <>
      {feedbackMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in ${
          feedbackMessage.type === 'success'
            ? 'bg-success-500 text-white'
            : 'bg-danger-500 text-white'
        }`}>
          {feedbackMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {feedbackMessage.message}
        </div>
      )}

      {rollbackConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">确认回滚</h3>
                <p className="text-sm text-neutral-500">版本 {rollbackConfirm.versionNumber}</p>
              </div>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
              确定要回滚到版本 <strong>v{rollbackConfirm.versionNumber}</strong> 吗？<br/>
              当前版本的内容将被替换。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRollbackConfirm(null)}
                className="px-4 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmRollback}
                className="px-4 py-2 text-sm bg-success-500 text-white rounded-lg hover:bg-success-600 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                确认回滚
              </button>
            </div>
          </Card>
        </div>
      )}

      {showComparePanel && (
        <VersionComparePanel
          version1={showComparePanel.v1}
          version2={showComparePanel.v2}
          onClose={() => {
            setShowComparePanel(null)
            setSelectedVersions([])
          }}
        />
      )}

      <Card className="overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-secondary-600 dark:text-secondary-400" />
              <span className="font-medium text-secondary-700 dark:text-secondary-300">版本历史</span>
              <span className="text-xs text-neutral-500">({versions.length}/{maxVersions})</span>
            </div>
            {selectedVersions.length === 2 && (
              <button
                onClick={handleCompare}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-secondary-100 dark:bg-secondary-900/40 text-secondary-600 dark:text-secondary-400 rounded-lg hover:bg-secondary-200 dark:hover:bg-secondary-900/60 transition-colors"
              >
                <ArrowRightLeft className="w-3 h-3" />
                对比
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {versionTimeline.map(({ version, branches }) => (
            <div key={version.id} className="border-b border-slate-50 dark:border-neutral-800 last:border-b-0">
              <VersionItem
                version={version}
                isSelected={selectedVersions.includes(version.id)}
                isCurrent={version.id === currentVersionId}
                isEditing={editingRemark === version.id}
                remarkText={remarkText}
                editingRemarkId={editingRemark}
                onSelect={() => handleVersionSelect(version.id)}
                onView={() => onSelectVersion?.(version)}
                onRollback={() => handleRollbackWithConfirm(version)}
                onBranch={() => onCreateBranch?.(version)}
                onStartEdit={() => {
                  setEditingRemark(version.id)
                  setRemarkText(version.remark)
                }}
                onRemarkChange={(text) => {
                  if (text.length <= 200) {
                    setRemarkText(text)
                  }
                }}
                onSaveRemark={() => handleAddRemark(version.id)}
                onCancelEdit={() => {
                  setEditingRemark(null)
                  setRemarkText('')
                }}
                onExport={(format) => handleExport(version, format)}
                showExportMenu={showExportMenu?.id === version.id}
                onToggleExportMenu={() => setShowExportMenu(showExportMenu?.id === version.id ? null : version)}
                exportMenuRef={showExportMenu?.id === version.id ? exportMenuRef : null}
              />

              {branches.length > 0 && (
                <div className="pl-6 border-l-2 border-dashed border-neutral-200 dark:border-neutral-700 ml-4">
                  {branches.map((branch) => (
                    <VersionItem
                      key={branch.id}
                      version={branch}
                      isSelected={selectedVersions.includes(branch.id)}
                      isCurrent={branch.id === currentVersionId}
                      isEditing={editingRemark === branch.id}
                      remarkText={remarkText}
                      editingRemarkId={editingRemark}
                      isBranch
                      onSelect={() => handleVersionSelect(branch.id)}
                      onView={() => onSelectVersion?.(branch)}
                      onRollback={() => handleRollbackWithConfirm(branch)}
                      onBranch={() => onCreateBranch?.(branch)}
                      onStartEdit={() => {
                        setEditingRemark(branch.id)
                        setRemarkText(branch.remark)
                      }}
                      onRemarkChange={(text) => {
                        if (text.length <= 200) {
                          setRemarkText(text)
                        }
                      }}
                      onSaveRemark={() => handleAddRemark(branch.id)}
                      onCancelEdit={() => {
                        setEditingRemark(null)
                        setRemarkText('')
                      }}
                      onExport={(format) => handleExport(branch, format)}
                      showExportMenu={showExportMenu?.id === branch.id}
                      onToggleExportMenu={() => setShowExportMenu(showExportMenu?.id === branch.id ? null : branch)}
                      exportMenuRef={showExportMenu?.id === branch.id ? exportMenuRef : null}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

interface VersionItemProps {
  version: FormulaVersion
  isSelected: boolean
  isCurrent: boolean
  isEditing: boolean
  remarkText: string
  editingRemarkId: string | null
  isBranch?: boolean
  onSelect: () => void
  onView: () => void
  onRollback: () => void
  onBranch: () => void
  onStartEdit: () => void
  onRemarkChange: (text: string) => void
  onSaveRemark: () => void
  onCancelEdit: () => void
  onExport: (format: ExportFormat) => void
  showExportMenu: boolean
  onToggleExportMenu: () => void
  exportMenuRef: React.RefObject<HTMLDivElement | null> | null
}

function VersionItem({
  version,
  isSelected,
  isCurrent,
  isEditing,
  remarkText,
  editingRemarkId,
  isBranch,
  onSelect,
  onView,
  onRollback,
  onBranch,
  onStartEdit,
  onRemarkChange,
  onSaveRemark,
  onCancelEdit,
  onExport,
  showExportMenu,
  onToggleExportMenu,
  exportMenuRef,
}: VersionItemProps) {
  const [autoSaveTimer, setAutoSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleRemarkChange = (text: string) => {
    onRemarkChange(text)

    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
    }

    const timer = setTimeout(() => {
      if (text.length > 0 && text !== version.remark) {
        setIsSaving(true)
        onSaveRemark()
        setIsSaving(false)
      }
    }, 2000)

    setAutoSaveTimer(timer)
  }

  useEffect(() => {
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer)
      }
    }
  }, [autoSaveTimer])

  return (
    <div
      className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer ${
        isSelected ? 'bg-secondary-50 dark:bg-secondary-900/20' : ''
      } ${isBranch ? 'border-l-0' : ''}`}
       role="button" tabIndex={0} onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              isCurrent
                ? 'bg-success-500 text-white'
                : isBranch
                ? 'bg-accent-100 dark:bg-accent-900/40 text-accent-600 dark:text-accent-400'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
            }`}
          >
            v{version.versionNumber}
          </div>
          <div className="w-0.5 h-full bg-neutral-200 dark:bg-neutral-700 mt-1" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
              {typeof version.formulaName === 'string' ? version.formulaName : '未知配方'}
            </h4>
            {isCurrent && (
              <span className="text-[10px] px-1.5 py-0.5 bg-success-100 dark:bg-success-900/40 text-success-600 dark:text-success-400 rounded">
                当前
              </span>
            )}
            {isBranch && (
              <GitBranch className="w-3 h-3 text-accent-500" />
            )}
          </div>

          <div className="flex flex-wrap gap-1 mb-2">
            {version.effects.slice(0, 2).map((effect) => (
              <span
                key={effect}
                className="text-[10px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded"
              >
                {effect}
              </span>
            ))}
            {version.effects.length > 2 && (
              <span className="text-[10px] text-neutral-400">+{version.effects.length - 2}</span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[10px] text-neutral-500">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(version.createdAt).toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <span>评分: {version.scores.overall.toFixed(2)}</span>
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2"  role="button" tabIndex={0} onClick={(e) => e.stopPropagation()}>
              <div className="relative">
                <textarea
                  value={remarkText}
                  onChange={(e) => onRemarkChange(e.target.value)}
                  placeholder="添加版本说明..."
                  className="w-full px-2 py-1.5 text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 resize-none"
                  rows={3}
                />
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[10px] ${remarkText.length > 180 ? 'text-warning-500' : 'text-neutral-400'}`}>
                    {remarkText.length}/200
                  </span>
                  {isSaving && (
                    <span className="text-[10px] text-secondary-500 flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      自动保存中...
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onSaveRemark}
                  className="px-2 py-1 text-xs bg-secondary-container text-secondary-main rounded hover:bg-secondary-container flex items-center gap-1"
                >
                  <Save className="w-2.5 h-2.5" />
                  保存
                </button>
                <button
                  onClick={onCancelEdit}
                  className="px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <>
              {version.remark && (
                <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{version.remark}</p>
              )}

              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onView()
                  }}
                  className="text-[10px] px-1.5 py-0.5 text-secondary-600 dark:text-secondary-400 hover:bg-secondary-50 dark:hover:bg-secondary-900/20 rounded transition-colors"
                >
                  查看
                </button>
                {!isCurrent && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onRollback()
                      }}
                      className="text-[10px] px-1.5 py-0.5 text-success-600 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/20 rounded transition-colors flex items-center gap-0.5"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      回滚
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onBranch()
                      }}
                      className="text-[10px] px-1.5 py-0.5 text-accent-600 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/20 rounded transition-colors flex items-center gap-0.5"
                    >
                      <GitBranch className="w-2.5 h-2.5" />
                      分支
                    </button>
                  </>
                )}
                <div className="relative" ref={exportMenuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleExportMenu()
                    }}
                    className="text-[10px] px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors flex items-center gap-0.5"
                  >
                    <Download className="w-2.5 h-2.5" />
                    导出
                  </button>
                  {showExportMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-20 overflow-hidden min-w-[120px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onExport('json')
                        }}
                        className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-neutral-700 flex items-center gap-2"
                      >
                        <FileJson className="w-3.5 h-3.5 text-success-500" />
                        JSON 格式
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onExport('markdown')
                        }}
                        className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-neutral-700 flex items-center gap-2"
                      >
                        <FileText className="w-3.5 h-3.5 text-secondary-500" />
                        Markdown 格式
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onExport('pdf')
                        }}
                        className="w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-neutral-700 flex items-center gap-2"
                      >
                        <FileType className="w-3.5 h-3.5 text-error-500" />
                        PDF 格式
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onStartEdit()
                  }}
                  className="text-[10px] px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors flex items-center gap-0.5"
                >
                  <Edit3 className="w-2.5 h-2.5" />
                  备注
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface VersionComparePanelProps {
  version1: FormulaVersion
  version2: FormulaVersion
  onClose?: () => void
}

export function VersionComparePanel({ version1, version2, onClose }: VersionComparePanelProps) {
  const compareIngredients = useMemo(() => {
    const v1Ingredients = new Map(version1.ingredients.map((i) => [i.name, i]))
    const v2Ingredients = new Map(version2.ingredients.map((i) => [i.name, i]))

    const allNames = new Set([...v1Ingredients.keys(), ...v2Ingredients.keys()])
    const comparison: {
      name: string
      v1Dosage?: string
      v2Dosage?: string
      v1Role?: string
      v2Role?: string
      status: 'added' | 'removed' | 'modified' | 'unchanged'
    }[] = []

    allNames.forEach((name) => {
      const i1 = v1Ingredients.get(name)
      const i2 = v2Ingredients.get(name)

      if (!i1 && i2) {
        comparison.push({ name, v2Dosage: i2.dosage, v2Role: i2.role, status: 'added' })
      } else if (i1 && !i2) {
        comparison.push({ name, v1Dosage: i1.dosage, v1Role: i1.role, status: 'removed' })
      } else if (i1 && i2 && i1.dosage !== i2.dosage) {
        comparison.push({ name, v1Dosage: i1.dosage, v1Role: i1.role, v2Dosage: i2.dosage, v2Role: i2.role, status: 'modified' })
      } else if (i1 && i2) {
        comparison.push({ name, v1Dosage: i1.dosage, v1Role: i1.role, v2Dosage: i2.dosage, v2Role: i2.role, status: 'unchanged' })
      }
    })

    return comparison
  }, [version1, version2])

  const compareEffects = useMemo(() => {
    const v1Effects = new Set(version1.effects)
    const v2Effects = new Set(version2.effects)

    const added = [...v2Effects].filter(e => !v1Effects.has(e))
    const removed = [...v1Effects].filter(e => !v2Effects.has(e))
    const unchanged = [...v1Effects].filter(e => v2Effects.has(e))

    return { added, removed, unchanged }
  }, [version1, version2])

  const compareScores = useMemo(() => {
    return [
      { dimension: '协同', v1: version1.scores.synergy, v2: version2.scores.synergy, diff: version2.scores.synergy - version1.scores.synergy },
      { dimension: '口感', v1: version1.scores.taste, v2: version2.scores.taste, diff: version2.scores.taste - version1.scores.taste },
      { dimension: '稳定性', v1: version1.scores.stability, v2: version2.scores.stability, diff: version2.scores.stability - version1.scores.stability },
      { dimension: '综合', v1: version1.scores.overall, v2: version2.scores.overall, diff: version2.scores.overall - version1.scores.overall },
    ]
  }, [version1, version2])

  const addedCount = compareIngredients.filter(i => i.status === 'added').length
  const removedCount = compareIngredients.filter(i => i.status === 'removed').length
  const modifiedCount = compareIngredients.filter(i => i.status === 'modified').length

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-lg">版本对比</h3>
              <p className="text-xs text-neutral-500">详细对比两个版本的内容差异</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-4 mb-6">
          <div className="flex-1 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-secondary-container text-secondary-main text-xs font-bold rounded">v{version1.versionNumber}</span>
              <span className="text-xs text-secondary-600 dark:text-secondary-400">旧版本</span>
            </div>
            <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1">{typeof version1.formulaName === 'string' ? version1.formulaName : '未知配方'}</div>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <Clock className="w-3 h-3" />
              {new Date(version1.createdAt).toLocaleString('zh-CN')}
            </div>
            {version1.remark && (
              <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400 bg-white/50 dark:bg-neutral-800/50 rounded-lg p-2">
                {version1.remark}
              </p>
            )}
          </div>
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4 text-neutral-400" />
            </div>
          </div>
          <div className="flex-1 p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-accent-container text-accent-main text-xs font-bold rounded">v{version2.versionNumber}</span>
              <span className="text-xs text-accent-600 dark:text-accent-400">新版本</span>
            </div>
            <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1">{typeof version2.formulaName === 'string' ? version2.formulaName : '未知配方'}</div>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <Clock className="w-3 h-3" />
              {new Date(version2.createdAt).toLocaleString('zh-CN')}
            </div>
            {version2.remark && (
              <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400 bg-white/50 dark:bg-neutral-800/50 rounded-lg p-2">
                {version2.remark}
              </p>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            评分对比
          </h4>
          <div className="space-y-3">
            {compareScores.map((score) => (
              <div key={score.dimension} className="flex items-center gap-3">
                <span className="w-14 text-xs text-neutral-600 dark:text-neutral-400 font-medium">{score.dimension}</span>
                <div className="flex-1 flex items-center gap-2">
                  <span className="w-10 text-xs text-secondary-600 dark:text-secondary-400 font-medium text-right">{score.v1.toFixed(2)}</span>
                  <div className="flex-1 h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full relative overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all"
                      style={{ width: `${score.v1 * 100}%` }}
                    />
                    <div
                      className="absolute top-0 h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full transition-all opacity-70"
                      style={{ width: `${score.v2 * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-xs text-accent-600 dark:text-accent-400 font-medium">{score.v2.toFixed(2)}</span>
                </div>
                <span
                  className={`w-14 text-xs font-medium text-right ${
                    score.diff > 0
                      ? 'text-success-600'
                      : score.diff < 0
                      ? 'text-error-600'
                      : 'text-neutral-400'
                  }`}
                >
                  {score.diff > 0 ? '↑' : score.diff < 0 ? '↓' : '-'} {Math.abs(score.diff).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            功效对比
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-success-50 dark:bg-success-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-xs text-success-600 dark:text-success-400 mb-1">新增功效</div>
              <div className="flex flex-wrap gap-1">
                {compareEffects.added.length > 0 ? (
                  compareEffects.added.map(e => (
                    <span key={e} className="px-2 py-0.5 bg-success-100 dark:bg-success-900/40 text-success-700 dark:text-success-300 text-xs rounded">
                      {e}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-400">无</span>
                )}
              </div>
            </div>
            <div className="p-3 bg-error-50 dark:bg-error-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="text-xs text-error-600 dark:text-error-400 mb-1">移除功效</div>
              <div className="flex flex-wrap gap-1">
                {compareEffects.removed.length > 0 ? (
                  compareEffects.removed.map(e => (
                    <span key={e} className="px-2 py-0.5 bg-error-100 dark:bg-error-900/40 text-error-700 dark:text-error-300 text-xs rounded">
                      {e}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-400">无</span>
                )}
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">不变功效</div>
              <div className="flex flex-wrap gap-1">
                {compareEffects.unchanged.length > 0 ? (
                  compareEffects.unchanged.map(e => (
                    <span key={e} className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs rounded">
                      {e}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-400">无</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
              <GitMerge className="w-4 h-4" />
              药材组成对比
            </h4>
            <div className="flex items-center gap-3 text-xs">
              {addedCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-success-500"></span>
                  <span className="text-success-600 dark:text-success-400">+{addedCount} 新增</span>
                </span>
              )}
              {removedCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-error-500"></span>
                  <span className="text-error-600 dark:text-error-400">-{removedCount} 移除</span>
                </span>
              )}
              {modifiedCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-warning-500"></span>
                  <span className="text-warning-600 dark:text-warning-400">±{modifiedCount} 修改</span>
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-neutral-800/50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">药材</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-secondary-600 dark:text-secondary-400 border border-neutral-200 dark:border-neutral-700">v{version1.versionNumber} 用量</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">角色</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700"></th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-accent-600 dark:text-accent-400 border border-neutral-200 dark:border-neutral-700">v{version2.versionNumber} 用量</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">角色</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">状态</th>
                </tr>
              </thead>
              <tbody>
                {compareIngredients.map((item, idx) => (
                  <tr key={item.name} className={`${idx % 2 === 0 ? 'bg-white dark:bg-neutral-900' : 'bg-slate-50/50 dark:bg-neutral-800/30'} hover:bg-secondary-50/30 dark:hover:bg-secondary-900/10 transition-colors`}>
                    <td className="px-3 py-2 text-sm font-medium text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700">
                      {item.name}
                    </td>
                    <td className={`px-3 py-2 text-sm text-center border border-neutral-200 dark:border-neutral-700 ${
                      item.status === 'removed' || item.status === 'modified'
                        ? 'text-secondary-600 dark:text-secondary-400 bg-secondary-50/50 dark:bg-secondary-900/20'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}>
                      {item.v1Dosage || '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-center text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                      {item.v1Role || '-'}
                    </td>
                    <td className="px-3 py-2 text-center border border-neutral-200 dark:border-neutral-700">
                      {item.status === 'modified' && (
                        <ArrowRightLeft className="w-3 h-3 text-warning-500 mx-auto" />
                      )}
                    </td>
                    <td className={`px-3 py-2 text-sm text-center border border-neutral-200 dark:border-neutral-700 ${
                      item.status === 'added' || item.status === 'modified'
                        ? 'text-accent-600 dark:text-accent-400 bg-accent-50/50 dark:bg-accent-900/20'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}>
                      {item.v2Dosage || '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-center text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                      {item.v2Role || '-'}
                    </td>
                    <td className="px-3 py-2 text-center border border-neutral-200 dark:border-neutral-700">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          item.status === 'added'
                            ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300'
                            : item.status === 'removed'
                            ? 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300'
                            : item.status === 'modified'
                            ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300'
                            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {item.status === 'added'
                          ? '新增'
                          : item.status === 'removed'
                          ? '移除'
                          : item.status === 'modified'
                          ? '修改'
                          : '不变'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            关闭
          </button>
        </div>
      </Card>
    </div>
  )
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function generateMarkdown(version: FormulaVersion): string {
  const lines = [
    `# ${typeof version.formulaName === 'string' ? version.formulaName : '未知配方'}`,
    '',
    `## 版本信息`,
    '',
    `- **版本号**: v${version.versionNumber}`,
    `- **创建时间**: ${new Date(version.createdAt).toLocaleString('zh-CN')}`,
    `- **备注**: ${typeof version.remark === 'string' ? version.remark : '无'}`,
    '',
    `## 功效`,
    '',
    (Array.isArray(version.effects) ? version.effects : []).map(e => `- ${typeof e === 'string' ? e : '未知功效'}`).join('\n'),
    '',
    `## 配方评分`,
    '',
    `| 指标 | 评分 |`,
    `|------|------|`,
    `| 协同评分 | ${version.scores.synergy.toFixed(4)} |`,
    `| 口感评分 | ${version.scores.taste.toFixed(4)} |`,
    `| 稳定性评分 | ${version.scores.stability.toFixed(4)} |`,
    `| 综合评分 | ${version.scores.overall.toFixed(4)} |`,
    '',
    `## 药材组成`,
    '',
    `| 药材 | 用量 | 角色 |`,
    `|------|------|------|`,
    ...(Array.isArray(version.ingredients) ? version.ingredients : []).map(ing => `| ${typeof ing.name === 'string' ? ing.name : '未知药材'} | ${typeof ing.dosage === 'string' ? ing.dosage : '未知剂量'} | ${typeof ing.role === 'string' ? ing.role : '未知角色'} |`),
    '',
    `---`,
    `*本报告由 RMFOOD 配方设计平台生成*`,
  ]
  return lines.join('\n')
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\| (.+) \|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim() && c.trim() !== '------')
      if (cells.length > 0 && cells.every(c => /^-+$/.test(c.trim()))) {
        return ''
      }
      return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>'
    })
    .replace(/(<tr>.*<\/tr>)/gs, '<table>$1</table>')
    .replace(/<\/tr>\s*<tr>/g, '</tr><tr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^<\/p><p>/, '<p>')
    .replace(/<\/p><p>$/, '</p>')
}
