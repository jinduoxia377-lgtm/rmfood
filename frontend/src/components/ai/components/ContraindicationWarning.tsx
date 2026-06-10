import { AlertTriangle } from 'lucide-react'

interface ContraindicationWarningProps {
  contraindications: string | undefined
}

export function ContraindicationWarning({ contraindications }: ContraindicationWarningProps) {
  if (!contraindications || typeof contraindications !== 'string') return null

  return (
    <div className="p-4 rounded-xl flex items-start gap-3 bg-amber-500/8 dark:bg-amber-500/14">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500/12 dark:bg-amber-500/20">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
      </div>
      <div>
        <p className="text-xs font-medium mb-0.5 text-amber-700 dark:text-amber-500">使用注意</p>
        <p className="text-xs leading-relaxed text-amber-600 dark:text-amber-400">
          {contraindications}
        </p>
      </div>
    </div>
  )
}

export default ContraindicationWarning
