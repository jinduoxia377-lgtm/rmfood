import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { DEFAULTS } from '@/config'

interface ErrorMessageProps {
  message: string
  onClose: () => void
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  onClose,
}) => {
  return (
    <div className="px-6 py-4 bg-danger-50 dark:bg-danger-500/10 border-b border-danger-200 dark:border-danger-500/20 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-danger-100 dark:bg-danger-500/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-danger-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-danger-700 dark:text-danger-400">
            {DEFAULTS.PLACEHOLDER_TEXTS.ERROR_NOTICE_TITLE}
          </p>
          <p className="text-sm text-danger-600 dark:text-danger-400 mt-0.5">
            {message}
          </p>
          <button
            onClick={onClose}
            className="text-xs text-danger-500 hover:text-danger-600 mt-2 transition-colors"
          >
            {DEFAULTS.PLACEHOLDER_TEXTS.CLOSE_NOTICE_BUTTON}
          </button>
        </div>
      </div>
    </div>
  )
}
