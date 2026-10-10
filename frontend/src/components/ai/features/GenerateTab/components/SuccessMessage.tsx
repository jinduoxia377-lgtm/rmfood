import React from 'react'
import { CheckCircle } from 'lucide-react'
import { DEFAULTS } from '@/config'

interface SuccessMessageProps {
  formulaId: number
  formulaName: string
  onClose: () => void
}

export const SuccessMessage: React.FC<SuccessMessageProps> = ({
  formulaId,
  formulaName,
  onClose,
}) => {
  return (
    <div className="px-6 py-4 bg-success-50 dark:bg-success-500/10 border-b border-success-200 dark:border-success-500/20 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-success-100 dark:bg-success-500/20 flex items-center justify-center flex-shrink-0">
          <CheckCircle className="w-4 h-4 text-success-600" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-success-700 dark:text-success-600">
            {DEFAULTS.PLACEHOLDER_TEXTS.SAVE_SUCCESS_TITLE}
          </h4>
          <p className="text-sm text-success-600 dark:text-success-600 mt-0.5">
            {`${DEFAULTS.PLACEHOLDER_TEXTS.SAVE_SUCCESS_MESSAGE_PREFIX} ${formulaName} ${DEFAULTS.PLACEHOLDER_TEXTS.SAVE_SUCCESS_MESSAGE_SUFFIX} (ID: ${formulaId})`}
          </p>
          <button
            onClick={onClose}
            className="text-xs text-success-500 hover:text-success-600 mt-2 transition-colors"
          >
            {DEFAULTS.PLACEHOLDER_TEXTS.CLOSE_NOTICE_BUTTON}
          </button>
        </div>
      </div>
    </div>
  )
}
