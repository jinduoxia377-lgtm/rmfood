import { PenLine, Trash2 } from 'lucide-react'

export interface AnnotationControlsProps {
  isAddingAnnotation: boolean
  annotationsCount: number
  onToggleAddAnnotation: () => void
  onClearAllAnnotations: () => void
}

export default function AnnotationControls({
  isAddingAnnotation,
  annotationsCount,
  onToggleAddAnnotation,
  onClearAllAnnotations,
}: AnnotationControlsProps) {
  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-35 flex items-center gap-2">
      {isAddingAnnotation && (
        <div className="px-3 py-1.5 rounded-lg bg-[var(--color-warning-surface)] text-white text-xs font-semibold shadow-lg animate-pulse flex items-center gap-1.5">
          <PenLine className="w-3.5 h-3.5" /> 点击图谱添加标注 — 按 Esc 取消
        </div>
      )}
      {!isAddingAnnotation && (
        <button
          onClick={onToggleAddAnnotation}
          className="w-7 h-7 rounded-lg bg-white/85 dark:bg-neutral-800/85 backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/50 shadow-sm hover:shadow-md hover:bg-warning-50 dark:hover:bg-warning-900/20 transition-all flex items-center justify-center group"
          title="添加标注 (Shift+N)"
        >
          <PenLine className="w-4 h-4 text-[var(--text-muted)] dark:text-[var(--text-secondary)] group-hover:scale-110 transition-transform" />
        </button>
      )}
      {annotationsCount > 0 && !isAddingAnnotation && (
        <button
          onClick={onClearAllAnnotations}
          className="w-7 h-7 rounded-lg bg-white/85 dark:bg-neutral-800/85 backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/50 shadow-sm hover:shadow-md hover:bg-error-50 dark:hover:bg-error-900/20 transition-all flex items-center justify-center group"
          title={`清除全部标注 (${annotationsCount})`}
        >
          <Trash2 className="w-4 h-4 text-[var(--text-muted)] dark:text-[var(--text-secondary)]" />
        </button>
      )}
    </div>
  )
}
