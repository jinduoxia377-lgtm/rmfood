import { useState, useCallback, useMemo } from 'react';
import { CheckSquare, Square, Trash2, Move, Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/stores/toastStore';
import type { Chapter } from '@/types/academicReport';

interface BatchOperationsProps {
  chapters: Chapter[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onBatchDelete: (ids: string[]) => void;
  onBatchMove: (ids: string[], targetId: string | null) => void;
  onBatchExport: (ids: string[]) => void;
  onClose: () => void;
}

export function BatchOperations({
  chapters,
  selectedIds,
  onSelectionChange,
  onBatchDelete,
  onBatchMove,
  onBatchExport,
  onClose,
}: BatchOperationsProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const { addToast } = useToastStore();

  const flatChapters = useMemo(() => {
    const result: Chapter[] = [];
    const flatten = (chapters: Chapter[], depth = 0) => {
      chapters.forEach(chapter => {
        result.push({ ...chapter, level: depth });
        if (chapter.children && chapter.children.length > 0) {
          flatten(chapter.children, depth + 1);
        }
      });
    };
    flatten(chapters);
    return result;
  }, [chapters]);

  const handleToggleAll = useCallback(() => {
    if (selectedIds.size === flatChapters.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(flatChapters.map(c => c.id)));
    }
  }, [flatChapters, selectedIds.size, onSelectionChange]);

  const handleToggleOne = useCallback((id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    onSelectionChange(newSelection);
  }, [selectedIds, onSelectionChange]);

  const handleDelete = useCallback(() => {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(`确定要删除选中的 ${selectedIds.size} 个章节吗？此操作不可撤销。`);
    if (confirmed) {
      onBatchDelete(Array.from(selectedIds));
      addToast({
        type: 'success',
        title: '批量删除成功',
        message: `已删除 ${selectedIds.size} 个章节`,
      });
      onClose();
    }
  }, [selectedIds, onBatchDelete, onClose, addToast]);

  const handleMove = useCallback((targetId: string | null) => {
    if (selectedIds.size === 0) return;
    onBatchMove(Array.from(selectedIds), targetId);
    setShowMoveMenu(false);
    addToast({
      type: 'success',
      title: '批量移动成功',
      message: `已将 ${selectedIds.size} 个章节移动到新位置`,
    });
    onClose();
  }, [selectedIds, onBatchMove, onClose, addToast]);

  const handleExport = useCallback(() => {
    if (selectedIds.size === 0) return;
    onBatchExport(Array.from(selectedIds));
    addToast({
      type: 'success',
      title: '批量导出成功',
      message: `已导出 ${selectedIds.size} 个章节`,
    });
  }, [selectedIds, onBatchExport, addToast]);

  const availableTargets = useMemo(() => {
    return flatChapters.filter(c => !selectedIds.has(c.id));
  }, [flatChapters, selectedIds]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 p-4 z-50 min-w-[600px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            {selectedIds.size === flatChapters.length && flatChapters.length > 0 ? (
              <CheckSquare className="w-5 h-5 text-primary" />
            ) : (
              <Square className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
            )}
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {selectedIds.size === flatChapters.length ? '取消全选' : '全选'}
            </span>
          </button>

          <div className="h-6 w-px bg-neutral-300 dark:bg-neutral-600" />

          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            已选择 <span className="font-semibold text-primary">{selectedIds.size}</span> 个章节
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleDelete}
          disabled={selectedIds.size === 0}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
            selectedIds.size === 0
              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
              : 'bg-error-50 text-error-600 hover:bg-error-100',
          )}
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-sm font-medium">批量删除</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMoveMenu(!showMoveMenu)}
            disabled={selectedIds.size === 0}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              selectedIds.size === 0
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                : 'bg-secondary-50 text-secondary-600 hover:bg-secondary-100',
            )}
          >
            <Move className="w-4 h-4" />
            <span className="text-sm font-medium">批量移动</span>
          </button>

          {showMoveMenu && availableTargets.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 py-2 w-64 max-h-64 overflow-y-auto">
              <div className="px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700">
                选择目标位置
              </div>
              <button
                onClick={() => handleMove(null)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              >
                移动到根级别
              </button>
              {availableTargets.map(chapter => (
                <button
                  key={chapter.id}
                  onClick={() => handleMove(chapter.id)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
                >
                  <span style={{ paddingLeft: chapter.level * 12 }} />
                  <span className="truncate">{chapter.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleExport}
          disabled={selectedIds.size === 0}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
            selectedIds.size === 0
              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
              : 'bg-success-50 text-success-600 hover:bg-success-100',
          )}
        >
          <Download className="w-4 h-4" />
          <span className="text-sm font-medium">导出选中内容</span>
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex flex-wrap gap-2">
            {Array.from(selectedIds).slice(0, 5).map(id => {
              const chapter = flatChapters.find(c => c.id === id);
              return chapter ? (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                >
                  {chapter.title}
                  <button
                    onClick={() => handleToggleOne(id)}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : null;
            })}
            {selectedIds.size > 5 && (
              <span className="inline-flex items-center px-2 py-1 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 text-xs rounded-full">
                +{selectedIds.size - 5} 更多
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
