import React, { useState, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  FileText,
  CheckSquare,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Chapter } from '@/types/academicReport';

interface ChapterTreeProps {
  chapters: Chapter[];
  onUpdate: (chapters: Chapter[]) => void;
  selectedChapterId?: string;
  onSelect: (id: string) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onBatchDelete?: (ids: string[]) => void;
  onBatchMove?: (ids: string[], targetId: string | null) => void;
  onBatchExport?: (ids: string[]) => void;
  showBatchToolbar?: boolean;
}

interface ChapterItemProps {
  chapter: Chapter;
  depth: number;
  isSelected: boolean;
  selectedChapterId?: string;
  onSelect: (id: string) => void;
  onExpand: (id: string) => void;
  isExpanded: boolean;
  onAddSection: (chapterId: string) => void;
  onDelete: (id: string) => void;
  onEditTitle: (id: string, title: string) => void;
  onStartEdit: (chapter: Chapter) => void;
  editingId: string | null;
  editValue: string;
  onEditChange: (value: string) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onBatchDelete?: (ids: string[]) => void;
  onBatchMove?: (ids: string[], targetId: string | null) => void;
  onBatchExport?: (ids: string[]) => void;
  showBatchToolbar?: boolean;
}

export function ChapterTree({
  chapters,
  onUpdate,
  selectedChapterId,
  onSelect,
  selectedIds = new Set(),
  onSelectionChange,
  showBatchToolbar = false,
}: ChapterTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleAddSection = useCallback((chapterId: string) => {
    const newChapters = chapters.map(chapter => {
      if (chapter.id === chapterId) {
        const children = chapter.children || [];
        const newSection: Chapter = {
          id: `section-${Date.now()}`,
          title: '新章节',
          content: '',
          level: (chapter.level || 1) + 1,
          order: children.length + 1,
          children: [],
        };
        return { ...chapter, children: [...children, newSection] };
      }
      return chapter;
    });
    onUpdate(newChapters);
  }, [chapters, onUpdate]);

  const handleDeleteChapter = useCallback((id: string) => {
    const newChapters = chapters.filter(chapter => chapter.id !== id);
    onUpdate(newChapters);
    if (selectedChapterId === id) {
      onSelect(newChapters[0]?.id || '');
    }
  }, [chapters, onUpdate, selectedChapterId, onSelect]);

  const handleEditTitle = useCallback((id: string, title: string) => {
    const newChapters = chapters.map(chapter => {
      if (chapter.id === id) {
        return { ...chapter, title };
      }
      return chapter;
    });
    onUpdate(newChapters);
    setEditingId(null);
  }, [chapters, onUpdate]);

  const handleStartEdit = useCallback((chapter: Chapter) => {
    setEditingId(chapter.id);
    setEditValue(chapter.title);
  }, []);

  return (
    <div className="space-y-1">
      {chapters.map((chapter) => (
        <ChapterItem
          key={chapter.id}
          chapter={chapter}
          depth={0}
          isSelected={selectedChapterId === chapter.id}
          selectedChapterId={selectedChapterId}
          onSelect={onSelect}
          onExpand={handleExpand}
          isExpanded={expandedIds.has(chapter.id)}
          onAddSection={handleAddSection}
          onDelete={handleDeleteChapter}
          onEditTitle={handleEditTitle}
          onStartEdit={handleStartEdit}
          editingId={editingId}
          editValue={editValue}
          onEditChange={setEditValue}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          showBatchToolbar={showBatchToolbar}
        />
      ))}
    </div>
  );
}

function ChapterItem({
  chapter,
  depth,
  isSelected,
  selectedChapterId,
  onSelect,
  onExpand,
  isExpanded,
  onAddSection,
  onDelete,
  onEditTitle,
  onStartEdit,
  editingId,
  editValue,
  onEditChange,
  selectedIds = new Set(),
  onSelectionChange,
  showBatchToolbar = false,
}: ChapterItemProps) {
  const isEditing = editingId === chapter.id;
  const isItemSelected = selectedIds.has(chapter.id);
  const children = chapter.children || [];

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSelectionChange) return;

    const newSelection = new Set(selectedIds);
    if (newSelection.has(chapter.id)) {
      newSelection.delete(chapter.id);
    } else {
      newSelection.add(chapter.id);
    }
    onSelectionChange(newSelection);
  };

  return (
    <div className="relative group">
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors duration-200',
          isSelected
            ? 'bg-primary/10 text-primary'
            : isItemSelected
            ? 'bg-secondary-50 dark:bg-secondary-900/20'
            : 'hover:bg-neutral-100 dark:bg-neutral-800 text-neutral-700',
        )}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
         role="button" tabIndex={0} onClick={() => !showBatchToolbar && onSelect(chapter.id)}
      >
        {showBatchToolbar && onSelectionChange && (
          <button
            type="button"
            onClick={handleCheckboxClick}
            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors flex-shrink-0"
          >
            {isItemSelected ? (
              <CheckSquare className="w-4 h-4 text-secondary-500" />
            ) : (
              <Square className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
            )}
          </button>
        )}

        {children.length > 0 && !showBatchToolbar && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExpand(chapter.id);
            }}
            className="p-1 hover:bg-neutral-200 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}
        {children.length === 0 && !showBatchToolbar && <span className="w-5" />}

        <span className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              onBlur={() => onEditTitle(chapter.id, editValue)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onEditTitle(chapter.id, editValue);
                } else if (e.key === 'Escape') {
                  onEditChange(chapter.title);
                  onEditTitle(chapter.id, chapter.title);
                }
              }}
              className="w-full px-2 py-1 text-sm border border-primary rounded focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          ) : (
            <span className="truncate flex items-center gap-2">
              <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-xs">{chapter.order}.</span>
              {chapter.title}
            </span>
          )}
        </span>

        {!showBatchToolbar && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit(chapter);
              }}
              className="p-1 hover:bg-neutral-200 rounded transition-colors"
              title="编辑"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {children.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSection(chapter.id);
                }}
                className="p-1 hover:bg-neutral-200 rounded transition-colors"
                title="添加子章节"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(chapter.id);
              }}
              className="p-1 hover:bg-error-100 hover:text-error-600 rounded transition-colors"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {isExpanded && children.length > 0 && !showBatchToolbar && (
        <div className="ml-4 mt-1">
          {children.map((section) => (
            <div
              key={section.id}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors',
                selectedChapterId === section.id
                  ? 'bg-primary/5 text-primary'
                  : 'hover:bg-slate-50 dark:bg-neutral-800 text-neutral-600',
              )}
              style={{ paddingLeft: `${depth * 16 + 24}px` }}
               role="button" tabIndex={0} onClick={() => onSelect(section.id)}
            >
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span className="truncate text-sm">
                {section.order}. {section.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
