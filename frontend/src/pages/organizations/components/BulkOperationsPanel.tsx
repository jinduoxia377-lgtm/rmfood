/**
 * 批量操作工具栏面板
 */
import React, { memo, useState, useCallback } from 'react'
import {
  Shield, Download, Archive, Trash2,
  X, CheckCircle2, AlertTriangle,
} from 'lucide-react'

interface BulkOperationsPanelProps {
  selectedIds: Set<number>
  onClearSelection: () => void
  onBulkChangePermissions: (ids: number[], plan: string) => Promise<void>
  onBulkExport: (ids: number[], format: 'csv' | 'excel' | 'pdf') => Promise<void>
  onBulkArchive: (ids: number[]) => Promise<void>
  onBulkDelete: (ids: number[]) => Promise<void>
  isProcessing?: boolean
  progress?: number
  processedCount?: number
  totalCount?: number
}

export const BulkOperationsPanel: React.FC<BulkOperationsPanelProps> = memo(({
  selectedIds,
  onClearSelection,
  onBulkExport,
  isProcessing = false,
  progress = 0,
  processedCount = 0,
  totalCount = 0,
}) => {
  const [, setShowPermissionModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [, setShowArchiveConfirm] = useState(false)
  const [, setShowDeleteConfirm] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel' | 'pdf'>('excel')
  const [operationResult, setOperationResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const count = selectedIds.size

  const handleBulkExport = useCallback(async () => {
    try {
      await onBulkExport(Array.from(selectedIds), selectedFormat)
      setShowExportModal(false)
      setOperationResult({ type: 'success', message: `正在生成 ${selectedFormat.toUpperCase()} 导出文件...` })
    } catch (error) {
      setOperationResult({ type: 'error', message: `导出失败: ${error instanceof Error ? error.message : '未知错误'}` })
    }
  }, [selectedIds, selectedFormat, onBulkExport])

  if (count === 0 && !isProcessing) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-2xl border border-[var(--border-color)] animate-in slide-in-from-bottom-4">
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-[var(--space-apple-sm)]">
          <CheckCircle2 className="w-5 h-5 text-[var(--color-primary-text)]" />
          <span className="font-medium text-[var(--text-primary)]">
            已选择 <span className="text-[var(--color-primary-text)] font-bold">{count}</span> 个组织
          </span>
        </div>
        <button
          onClick={onClearSelection}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1"
        >
          <X className="w-4 h-4" />
          取消选择
        </button>
      </div>

      {/* 操作按钮 */}
      <div className="px-6 py-4 flex items-center gap-4 border-b border-[var(--border-color)]">
        <button
          onClick={() => setShowPermissionModal(true)}
          disabled={isProcessing}
          className="flex items-center gap-2 px-[var(--space-apple-md)] py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] dark:hover:bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] transition-colors disabled:opacity-50"
        >
          <Shield className="w-4 h-4" />
          修改权限
        </button>

        <button
          onClick={() => setShowExportModal(true)}
          disabled={isProcessing}
          className="flex items-center gap-2 px-[var(--space-apple-md)] py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] dark:hover:bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          导出数据
        </button>

        <button
          onClick={() => setShowArchiveConfirm(true)}
          disabled={isProcessing}
          className="flex items-center gap-2 px-[var(--space-apple-md)] py-2 text-sm font-medium text-[var(--color-warning-text)] bg-[var(--color-warning-container)] hover:bg-[var(--color-warning-container)] border border-[var(--color-warning-border)] rounded-[var(--radius-Apple-sm)] transition-colors disabled:opacity-50"
        >
          <Archive className="w-4 h-4" />
          归档
        </button>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isProcessing}
          className="flex items-center gap-2 px-[var(--space-apple-md)] py-2 text-sm font-medium text-[var(--color-error-text)] bg-[var(--color-error-container)] hover:bg-[var(--color-error-container)] border border-[var(--color-error-border)] rounded-[var(--radius-Apple-sm)] transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          删除
        </button>
      </div>

      {/* 进度条 */}
      {isProcessing && (
        <div className="px-5 pb-[var(--space-apple-md)] space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">处理进度...</span>
            <span className="font-medium text-[var(--text-primary)]">
              {processedCount || 0}/{totalCount || count}
            </span>
          </div>
          <div className="h-2 bg-[var(--border-color)] dark:bg-[var(--bg-tertiary)] rounded-[var(--radius-pill)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-primary)] rounded-[var(--radius-pill)] transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress || 0, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* 操作结果通知 */}
      {operationResult && (
        <div className={`mx-5 mb-[var(--space-apple-md)] p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] flex items-start gap-[var(--space-apple-sm)] ${
          operationResult.type === 'success'
            ? 'bg-[var(--color-success-container)] text-[var(--color-success-text)] dark:text-[var(--color-success-text)]'
            : 'bg-[var(--color-error-container)] text-[var(--color-error-text)] dark:text-[var(--color-error-text)]'
        }`}>
          {operationResult.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm flex-1">{operationResult.message}</p>
          <button
            onClick={() => setOperationResult(null)}
            className="flex-shrink-0 opacity-70 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 导出 Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">批量导出数据</h3>
            </div>
            <div className="p-[var(--space-apple-lg)] space-y-[var(--space-apple-sm)]">
              <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                为选中的 {count} 个组织导出数据，选择导出格式：
              </p>
              <div className="grid grid-cols-1 gap-2">
                {(['csv', 'excel', 'pdf'] as const).map(f => (
                  <label
                    key={f}
                    className={`flex items-center gap-[var(--space-apple-sm)] p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border cursor-pointer transition-all ${
                      selectedFormat === f
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]'
                        : 'border-[var(--border-color)] hover:border-[var(--border-color)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="export-format"
                      value={f}
                      checked={selectedFormat === f}
                      onChange={() => setSelectedFormat(f)}
                      className="mt-0"
                    />
                    <div className="text-sm font-medium text-neutral-800 dark:text-[var(--text-primary)]">
                      {f === 'csv' ? 'CSV（合并为一个文件）' : f === 'excel' ? 'Excel（逐个下载 .xlsx）' : 'PDF（逐个下载）'}
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-[var(--space-apple-sm)] px-6 py-4 border-t border-[var(--border-color)]">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-[var(--space-apple-md)] py-2 text-sm text-[var(--text-secondary)] hover:text-neutral-800 dark:hover:text-[var(--text-muted)]"
              >
                取消
              </button>
              <button
                onClick={handleBulkExport}
                disabled={isProcessing}
                className="px-[var(--space-apple-md)] py-2 bg-primary-container text-[var(--color-primary)] text-sm font-medium rounded-[var(--radius-Apple-sm)] hover:bg-primary-container disabled:opacity-50 flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                确认导出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

// 权限/计划选择 Modal 内容
export const PermissionSelectModal: React.FC<{
  open: boolean
  onClose: () => void
  onConfirm: (plan: 'free' | 'pro' | 'enterprise') => void
}> = ({ open, onClose, onConfirm }) => {
  const [plan, setPlan] = useState<'free' | 'pro' | 'enterprise'>('pro')

  if (!open) return null

  const plans: { value: 'free' | 'pro' | 'enterprise'; label: string; desc: string }[] = [
    { value: 'free', label: '免费版', desc: '5 成员 / 2 团队 / 100 配方 / 1GB 存储' },
    { value: 'pro', label: '专业版', desc: '20 成员 / 10 团队 / 1000 配方 / 10GB 存储' },
    { value: 'enterprise', label: '企业版', desc: '无限资源 / 专属支持 / SSO / 私有部署' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">批量修改组织计划</h3>
        </div>

        <div className="p-[var(--space-apple-lg)] space-y-[var(--space-apple-sm)]">
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">为选中的组织设置新的订阅计划：</p>
          {plans.map(r => (
            <label
              key={r.value}
              className={`flex items-start gap-[var(--space-apple-sm)] p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border cursor-pointer transition-all ${
                plan === r.value
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]'
                  : 'border-[var(--border-color)] hover:border-[var(--border-color)]'
              }`}
            >
              <input
                type="radio"
                name="plan"
                value={r.value}
                checked={plan === r.value}
                onChange={() => setPlan(r.value)}
                className="mt-1"
              />
              <div>
                <p className="font-medium text-[var(--text-primary)]">{r.label}</p>
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{r.desc}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-end gap-[var(--space-apple-sm)] px-6 py-4 border-t border-[var(--border-color)]">
          <button
            onClick={onClose}
            className="px-[var(--space-apple-md)] py-2 text-sm text-[var(--text-secondary)] hover:text-neutral-800 dark:hover:text-[var(--text-muted)]"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(plan)}
            className="px-[var(--space-apple-md)] py-2 bg-primary-container text-[var(--color-primary)] text-sm font-medium rounded-[var(--radius-Apple-sm)] hover:bg-primary-container"
          >
            确认修改
          </button>
        </div>
      </div>
    </div>
  )
}

// 删除确认 Modal
export const DeleteConfirmModal: React.FC<{
  open: boolean
  onClose: () => void
  onConfirm: () => void
}> = ({ open, onClose, onConfirm }) => {
  const [confirmText, setConfirmText] = useState('')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="p-[var(--space-apple-lg)] text-center">
          <div className="w-16 h-16 mx-auto mb-[var(--space-apple-md)] bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/25 rounded-[var(--radius-pill)] flex items-center justify-center">
            <Trash2 className="w-8 h-8 text-[var(--color-error-text)]" />
          </div>

          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            确定要永久删除这些组织吗？
          </h3>

          <p className="text-[var(--text-muted)] mb-6 text-sm leading-relaxed">
            此操作<span className="font-bold text-[var(--color-error-text)]">不可逆</span>！
            所有数据将永久丢失，包括成员、团队、配方、实验等。
          </p>

          <div className="bg-[var(--color-warning-container)] border border-[var(--color-warning-border)] dark:border-[var(--color-warning)] rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-md)] mb-6">
            <p className="text-sm text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] font-medium">
              请输入 <strong>DELETE</strong> 以确认：
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="DELETE"
              className="mt-2 w-full px-[var(--space-apple-sm)] py-2 border border-[var(--color-warning)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)] text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-warning)]"
            />
          </div>

          <div className="flex items-center justify-end gap-[var(--space-apple-sm)]">
            <button
              onClick={onClose}
              className="px-[var(--space-apple-md)] py-2 text-sm text-[var(--text-secondary)] hover:text-neutral-800"
            >
              取消
            </button>
            <button
              onClick={() => confirmText === 'DELETE' ? onConfirm() : null}
              disabled={confirmText !== 'DELETE'}
              className="px-[var(--space-apple-md)] py-2 bg-[var(--color-error)] text-white text-sm font-medium rounded-[var(--radius-Apple-sm)] hover:bg-[var(--color-error)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4 mr-1" />永久删除
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

BulkOperationsPanel.displayName = 'BulkOperationsPanel'
export default BulkOperationsPanel
