import { Undo2, Redo2, Bold, Italic, List, ListOrdered, RotateCcw } from 'lucide-react'

interface SimpleEditToolbarProps {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onFormat: (type: 'bold' | 'italic' | 'bullet' | 'numbered') => void
  onReset: () => void
}

export function SimpleEditToolbar({ canUndo, canRedo, onUndo, onRedo, onFormat, onReset }: SimpleEditToolbarProps) {
  return (
    <div className="flex items-center gap-1 p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex-wrap shadow-sm">
      <div className="flex items-center gap-0.5 px-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded-lg transition-all duration-200 ${
            !canUndo
              ? 'opacity-40 cursor-not-allowed hover:bg-transparent'
              : 'hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:scale-105 active:scale-95'
          }`}
          title="撤销"
        >
          <Undo2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 rounded-lg transition-all duration-200 ${
            !canRedo
              ? 'opacity-40 cursor-not-allowed hover:bg-transparent'
              : 'hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:scale-105 active:scale-95'
          }`}
          title="重做"
        >
          <Redo2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>
      <div className="w-px h-6 bg-neutral-300 dark:bg-neutral-600 mx-1" />
      <div className="flex items-center gap-0.5 px-1">
        <button
          onClick={() => onFormat('bold')}
          className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-200 hover:scale-105 active:scale-95"
          title="加粗"
        >
          <Bold className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <button
          onClick={() => onFormat('italic')}
          className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-200 hover:scale-105 active:scale-95"
          title="斜体"
        >
          <Italic className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>
      <div className="w-px h-6 bg-neutral-300 dark:bg-neutral-600 mx-1" />
      <div className="flex items-center gap-0.5 px-1">
        <button
          onClick={() => onFormat('bullet')}
          className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-200 hover:scale-105 active:scale-95"
          title="无序列表"
        >
          <List className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <button
          onClick={() => onFormat('numbered')}
          className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-200 hover:scale-105 active:scale-95"
          title="有序列表"
        >
          <ListOrdered className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>
      <div className="w-px h-6 bg-neutral-300 dark:bg-neutral-600 mx-1" />
      <button
        onClick={onReset}
        className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-200 hover:scale-105 active:scale-95"
        title="重置到初始状态"
      >
        <RotateCcw className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
      </button>
    </div>
  )
}

export default SimpleEditToolbar
