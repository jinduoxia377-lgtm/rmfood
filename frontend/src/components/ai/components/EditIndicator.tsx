import { Edit2, AlertTriangle, Loader2 } from 'lucide-react'

interface EditIndicatorProps {
  isAutoSaving: boolean
  hasUnsavedChanges: boolean
}

export function EditIndicator({ isAutoSaving, hasUnsavedChanges }: EditIndicatorProps) {
  return (
    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary-500 to-primary-600 text-white text-xs py-2 px-4 flex items-center justify-between z-20 shadow-md">
      <span className="flex items-center gap-2">
        <Edit2 className="w-3.5 h-3.5" />
        <span className="font-medium">编辑模式</span>
      </span>
      {hasUnsavedChanges && (
        <span className="flex items-center gap-1.5">
          {isAutoSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>自动保存中...</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>未保存</span>
            </>
          )}
        </span>
      )}
    </div>
  )
}

export default EditIndicator
