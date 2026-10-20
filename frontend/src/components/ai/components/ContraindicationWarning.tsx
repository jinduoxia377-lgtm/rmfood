import { AlertTriangle } from 'lucide-react'

interface ContraindicationWarningProps {
  contraindications: string | string[] | undefined
}

export function ContraindicationWarning({ contraindications }: ContraindicationWarningProps) {
  if (!contraindications) return null

  return (
    <div className="p-4 rounded-xl flex items-start gap-3 bg-warning-500/8 dark:bg-warning-500/14">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-warning-500/12 dark:bg-warning-500/20">
        <AlertTriangle className="w-4 h-4 text-warning-600 dark:text-warning-700" />
      </div>
      <div>
        <p className="text-xs font-medium mb-0.5 text-warning-700 dark:text-warning-700">使用注意</p>
        <p className="text-xs leading-relaxed text-warning-600 dark:text-warning-700">
          {contraindications}
        </p>
      </div>
    </div>
  )
}

export default ContraindicationWarning
