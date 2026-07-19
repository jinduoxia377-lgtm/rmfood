/**
 * BatchOperationBar - 批量操作栏组件 (v1.0)
 *
 * 职责：当用户选中1个或多个配方时，在面板底部显示的操作栏。
 * 提供全选、导出、打标签、删除、取消选择等批量管理功能。
 *
 * 核心功能模块：
 * 1. 选择状态显示 - 已选择数量/总数统计
 * 2. 全选/取消全选 - 快速选择所有配方
 * 3. 批量导出 - 支持 JSON/CSV/Excel/PDF 四种格式
 * 4. 批量打标签 - 弹窗式标签选择器（含常用标签）
 * 5. 批量合并 - 可选的配方合并功能
 * 6. 批量删除 - 危险操作，需二次确认
 * 7. 取消选择 - 清空当前选中项
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-20
 */

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  CheckSquare,
  Square,
  Download,
  Tag,
  Trash2,
  XCircle,
  Layers,
  ChevronDown,
} from 'lucide-react'

/** 导出格式类型 */
export type ExportFormat = 'json' | 'csv' | 'excel' | 'pdf'

/** BatchOperationBar 组件属性接口 */
interface BatchOperationBarProps {
  /** 当前选中的配方数量 */
  selectedCount: number
  /** 配方总数 */
  totalCount: number
  /** 批量导出回调（参数为导出格式） */
  onExport: (format: ExportFormat) => void
  /** 批量删除回调（需二次确认） */
  onDelete: () => void
  /** 批量打标签回调（参数为标签数组） */
  onTagAdd: (tags: string[]) => void
  /** 批量合并回调（可选功能） */
  onMerge?: () => void
  /** 全选所有配方回调 */
  onSelectAll: () => void
  /** 取消选择回调 */
  onClearSelection: () => void
  /** 是否为紧凑模式（移动端优化） */
  compact?: boolean
}

/** 常用标签列表（可配置化） */
const COMMON_TAGS = [
  '补气',
  '补血',
  '健脾',
  '抗氧化',
  '安神',
  '清热',
  '祛湿',
  '滋阴',
  '温阳',
  '活血',
]

/** 导出格式选项 */
const EXPORT_FORMATS: { value: ExportFormat; label: string; description: string }[] = [
  { value: 'json', label: 'JSON 格式', description: '结构化数据，适合程序处理' },
  { value: 'csv', label: 'CSV 格式', description: '表格数据，适合 Excel 打开' },
  { value: 'excel', label: 'Excel 格式', description: '.xlsx 文件，保留样式' },
  { value: 'pdf', label: 'PDF 报告', description: '专业报告文档' },
]

/**
 * BatchOperationBar - 批量操作栏组件
 *
 * 使用 React.memo 进行性能优化，避免不必要的重新渲染。
 * 固定在底部显示，采用 sticky 定位。
 *
 * 样式规范：
 * - 背景：bg-primary-50 dark:bg-primary-900/20
 * - 边框：border-t border-primary-200
 * - 圆角：rounded-b-xl
 * - 阴影：shadow-lg
 *
 * @param props - BatchOperationBarProps 属性对象
 * @returns JSX.Element 批量操作栏的完整UI结构
 */
const BatchOperationBar = React.memo<BatchOperationBarProps>(({
  selectedCount,
  totalCount,
  onExport,
  onDelete,
  onTagAdd,
  onMerge,
  onSelectAll,
  onClearSelection,
  compact = false,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [newTagInput, setNewTagInput] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const exportMenuRef = useRef<HTMLDivElement>(null)
  const tagPickerRef = useRef<HTMLDivElement>(null)

  const isAllSelected = selectedCount === totalCount && totalCount > 0

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
      if (tagPickerRef.current && !tagPickerRef.current.contains(event.target as Node)) {
        setShowTagPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExport = (format: ExportFormat) => {
    onExport(format)
    setShowExportMenu(false)
  }

  const handleAddTag = (tag: string) => {
    if (!tag.trim()) return
    onTagAdd([tag.trim()])
    setShowTagPicker(false)
    setNewTagInput('')
  }

  const handleAddNewTag = () => {
    if (newTagInput.trim()) {
      handleAddTag(newTagInput)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddNewTag()
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    onDelete()
    setShowDeleteConfirm(false)
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
  }

  return (
    <>
      {/* 批量操作栏 - 移动端底部固定全宽 */}
      <div className={cn(
        "bg-primary-50 dark:bg-primary-900/20 border-t border-primary-200 dark:border-primary-800 shadow-lg z-40",
        "fixed bottom-0 left-0 right-0 sm:relative sm:bottom-auto px-3 py-2 sm:px-6 sm:py-4 rounded-b-xl sm:rounded-b-none",
      )}>
        <div className="flex items-center justify-between max-w-screen-xl mx-auto">
          {/* 左侧：选择状态 - 移动端精简 */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={isAllSelected ? onClearSelection : onSelectAll}
              className={`flex items-center gap-1.5 sm:gap-2 font-medium text-primary-700 dark:text-primary-300 hover:text-primary-900 dark:hover:text-primary-100 transition-colors min-h-[44px] sm:min-h-0 ${
                compact ? 'text-xs' : 'text-sm'
              }`}
              title={isAllSelected ? '取消全选' : '全选所有'}
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Square className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
              <span className="hidden sm:inline">
                {isAllSelected ? '取消全选' : '全选'}
              </span>
            </button>

            <span className={`font-semibold text-primary-800 dark:text-primary-200 ${compact ? 'text-xs' : 'text-sm'}`}>
              ✓ {selectedCount}/{totalCount}
            </span>
          </div>

          {/* 右侧：操作按钮组 - 移动端横向滚动 */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 flex-1 justify-end">
            {/* 导出按钮（带下拉菜单） */}
            <div className="relative" ref={exportMenuRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={`flex items-center gap-1.5 whitespace-nowrap ${compact ? 'text-xs' : ''}`}
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                导出
                <ChevronDown className={`w-3 h-3.5 sm:w-3.5 sm:h-3.5 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
              </Button>

              {showExportMenu && (
                <div className={cn(
                  "bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 py-2 z-20",
                  "absolute bottom-full mb-2 right-0 sm:min-w-[220px] min-w-[180px]",
                )}>
                  <div className="px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-700">
                    选择导出格式
                  </div>
                  {EXPORT_FORMATS.map((format) => (
                    <button
                      key={format.value}
                      onClick={() => handleExport(format.value)}
                      className="w-full px-3 py-2 text-left hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors group"
                    >
                      <div className={`font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-primary-700 dark:group-hover:text-primary-300 ${compact ? 'text-sm' : 'text-sm'}`}>
                        {format.label}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 hidden sm:block">
                        {format.description}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 打标签按钮（带弹窗选择器） */}
            <div className="relative" ref={tagPickerRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTagPicker(!showTagPicker)}
                className={`flex items-center gap-1.5 whitespace-nowrap ${compact ? 'text-xs' : ''}`}
              >
                <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                打标签
              </Button>

              {showTagPicker && (
                <div className={cn(
                  "bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 p-4 z-20",
                  "absolute bottom-full mb-2 right-0 sm:min-w-[280px] min-w-[260px] max-h-[80vh] overflow-y-auto",
                )}>
                  <div className={`font-medium text-neutral-700 dark:text-neutral-300 mb-3 ${compact ? 'text-sm' : 'text-sm'}`}>
                    为选中配方添加标签
                  </div>

                  {/* 新标签输入框 */}
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入新标签..."
                    className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-neutral-700 dark:text-neutral-200 mb-3"
                    autoFocus
                  />

                  {/* 常用标签列表 */}
                  <div className="mb-3">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wider">
                      常用标签
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_TAGS.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => handleAddTag(tag)}
                          className="px-2 py-1 sm:px-2.5 sm:py-1 text-xs font-medium rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/60 transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-700">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowTagPicker(false)
                        setNewTagInput('')
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAddNewTag}
                      disabled={!newTagInput.trim()}
                    >
                      添加
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 合并按钮（可选功能） */}
            {onMerge && (
              <Button
                variant="outline"
                size="sm"
                onClick={onMerge}
                className={`flex items-center gap-1.5 whitespace-nowrap ${compact ? 'text-xs' : ''}`}
                disabled={selectedCount < 2}
                title={selectedCount < 2 ? '需要至少选择2个配方' : '合并选中的配方'}
              >
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">合并</span>
              </Button>
            )}

            {/* 删除按钮（危险操作） */}
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteClick}
              className={`flex items-center gap-1.5 whitespace-nowrap ${compact ? 'text-xs' : ''}`}
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              删除
            </Button>

            {/* 取消选择按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className={`flex items-center gap-1.5 whitespace-nowrap ${compact ? 'text-xs' : ''}`}
            >
              <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">取消</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 移动端底部安全区域（避免内容被遮挡） */}
      <div className="h-16 sm:hidden" />

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-error-600 dark:text-error-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                  确认删除
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                  确定要删除选中的 <strong className="text-error-600 dark:text-error-400">{selectedCount}</strong> 个配方吗？
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-500">
                  此操作不可撤销，请谨慎操作。
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <Button
                variant="outline"
                size="sm"
                onClick={cancelDelete}
              >
                取消
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmDelete}
              >
                确认删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

BatchOperationBar.displayName = 'BatchOperationBar'

export default BatchOperationBar
