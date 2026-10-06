/**
 * 批量操作工具栏面板
 */
import React, { memo, useState, useCallback } from 'react'
import {
  Shield, Download, Table, Archive, Trash2,
  X, CheckCircle2, AlertTriangle, Loader2,
} from 'lucide-react'
import type { Role } from '@/types/organization.types'

interface BulkOperationsPanelProps {
  selectedIds: Set<number>
  onClearSelection: () => void
  onBulkChangePermissions: (ids: number[], role: Role) => Promise<void>
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
  onBulkChangePermissions,
  onBulkExport,
  onBulkArchive,
  onBulkDelete,
  isProcessing = false,
  progress = 0,
  processedCount = 0,
  totalCount = 0,
}) => {
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role>('admin')
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel' | 'pdf'>('excel')
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [operationResult, setOperationResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const count = selectedIds.size

  const handleBulkChangePermissions = useCallback(async () => {
    try {
      await onBulkChangePermissions(Array.from(selectedIds), selectedRole)
      setShowPermissionModal(false)
      setOperationResult({ type: 'success', message: `成功修改 ${count} 个组织的权限` })
    } catch (error) {
      setOperationResult({ type: 'error', message: `操作失败: ${error instanceof Error ? error.message : '未知错误'}` })
    }
  }, [selectedIds, selectedRole, count, onBulkChangePermissions])

  const handleBulkExport = useCallback(async () => {
    try {
      await onBulkExport(Array.from(selectedIds), selectedFormat)
      setShowExportModal(false)
      setOperationResult({ type: 'success', message: `正在生成 ${selectedFormat.toUpperCase()} 导出文件...` })
    } catch (error) {
      setOperationResult({ type: 'error', message: `导出失败: ${error instanceof Error ? error.message : '未知错误'}` })
    }
  }, [selectedIds, selectedFormat, onBulkExport])

  const handleBulkArchive = useCallback(async () => {
    try {
      await onBulkArchive(Array.from(selectedIds))
      setShowArchiveConfirm(false)
      setOperationResult({ type: 'success', message: `成功归档 ${count} 个组织` })
      onClearSelection()
    } catch (error) {
      setOperationResult({ type: 'error', message: `归档失败: ${error instanceof Error ? error.message : '未知错误'}` })
    }
  }, [selectedIds, count, onBulkArchive, onClearSelection])

  const handleBulkDelete = useCallback(async () => {
    if (deleteConfirmText !== 'DELETE') return

    try {
      await onBulkDelete(Array.from(selectedIds))
      setShowDeleteConfirm(false)
      setDeleteConfirmText('')
      setOperationResult({ type: 'success', message: `成功删除 ${count} 个组织` })
      onClearSelection()
    } catch (error) {
      setOperationResult({ type: 'error', message: `删除失败: ${error instanceof Error ? error.message : '未知错误'}` })
    }
  }, [selectedIds, count, deleteConfirmText, onBulkDelete, onClearSelection])

  if (count === 0 && !isProcessing) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 animate-in slide-in-from-bottom-4">
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-primary-600" />
          <span className="font-medium text-neutral-900 dark:text-white">
            已选择 <span className="text-primary-600 font-bold">{count}</span> 个组织
          </span>
        </div>
        <button
          onClick={onClearSelection}
          className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 flex items-center gap-1"
        >
          <X className="w-4 h-4" />
          取消选择
        </button>
      </div>

      {/* 操作按钮 */}
      <div className="px-6 py-4 flex items-center gap-4 border-b border-neutral-100 dark:border-neutral-800">
        <button
          onClick={() => setShowPermissionModal(true)}
          disabled={isProcessing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <Shield className="w-4 h-4" />
          修改权限
        </button>

        <button
          onClick={() => setShowExportModal(true)}
          disabled={isProcessing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          导出数据
        </button>

        <button
          onClick={() => setShowArchiveConfirm(true)}
          disabled={isProcessing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-yellow-600 bg-yellow-50 hover:bg-yellow-100 border border-yellow-300 rounded-lg transition-colors disabled:opacity-50"
        >
          <Archive className="w-4 h-4" />
          归档
        </button>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isProcessing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-error-600 bg-error-50 hover:bg-error-100 border border-red-300 rounded-lg transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          删除
        </button>
      </div>

      {/* 进度条 */}
      {isProcessing && (
        <div className="px-5 pb-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">处理进度...</span>
            <span className="font-medium text-neutral-900 dark:text-white">
              {processedCount || 0}/{totalCount || count}
            </span>
          </div>
          <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress || 0, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* 操作结果通知 */}
      {operationResult && (
        <div className={`mx-5 mb-4 p-3 rounded-lg flex items-start gap-3 ${
          operationResult.type === 'success'
            ? 'bg-success-50 dark:bg-success-900/20 text-success-800 dark:text-success-200'
            : 'bg-error-50 dark:bg-error-900/20 text-error-800 dark:text-error-200'
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
    </div>
  )
})

// 权限选择 Modal 内容
export const PermissionSelectModal: React.FC<{
  open: boolean
  onClose: () => void
  onConfirm: (role: Role) => void
}> = ({ open, onClose, onConfirm }) => {
  const [role, setRole] = useState<Role>('admin')

  if (!open) return null

  const roles: { value: Role; label: string; desc: string }[] = [
    { value: 'owner', label: 'Owner (所有者)', desc: '拥有所有权限，可删除组织' },
    { value: 'admin', label: 'Admin (管理员)', desc: '可管理成员和大部分设置' },
    { value: 'editor', label: 'Editor (编辑者)', desc: '可编辑内容，无法管理用户' },
    { value: 'viewer', label: 'Viewer (查看者)', desc: '只读权限，仅可查看数据' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">批量修改权限</h3>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-sm text-neutral-500">为选中的组织选择新的角色级别：</p>
          {roles.map(r => (
            <label
              key={r.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                role === r.value
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={role === r.value}
                onChange={() => setRole(r.value)}
                className="mt-1"
              />
              <div>
                <p className="font-medium text-neutral-900 dark:text-white">{r.label}</p>
                <p className="text-xs text-neutral-500">{r.desc}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800 dark:hover:text-neutral-300"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(role)}
            className="px-4 py-2 bg-primary-container text-primary-main text-sm font-medium rounded-lg hover:bg-primary-container"
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
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-error-100 dark:bg-error-900/30 rounded-full flex items-center justify-center">
            <Trash2 className="w-8 h-8 text-error-600" />
          </div>

          <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
            确定要永久删除这些组织吗？
          </h3>

          <p className="text-neutral-500 dark:text-neutral-400 mb-6 text-sm leading-relaxed">
            此操作<span className="font-bold text-error-600">不可逆</span>！
            所有数据将永久丢失，包括成员、团队、配方、实验等。
          </p>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
              请输入 <strong>DELETE</strong> 以确认：
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="DELETE"
              className="mt-2 w-full px-3 py-2 border border-yellow-400 rounded-md bg-white dark:bg-neutral-900 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800"
            >
              取消
            </button>
            <button
              onClick={() => confirmText === 'DELETE' ? onConfirm() : null}
              disabled={confirmText !== 'DELETE'}
              className="px-4 py-2 bg-error-600 text-white text-sm font-medium rounded-lg hover:bg-error-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
