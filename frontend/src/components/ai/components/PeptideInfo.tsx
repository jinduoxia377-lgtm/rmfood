import { Brain } from 'lucide-react'

interface Peptide {
  sequence?: string
  source?: string
}

interface PeptideInfoProps {
  peptideCandidates: Peptide[]
}

export function PeptideInfo({ peptideCandidates }: PeptideInfoProps) {
  if (!peptideCandidates || peptideCandidates.length === 0) return null

  return (
    <div className="pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4" style={{ color: 'var(--color-accent-500)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          活性肽信息
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          ({peptideCandidates.length}条)
        </span>
      </div>
      <div className="space-y-2">
        {peptideCandidates.slice(0, 3).map((peptide, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2 px-3 rounded-xl bg-accent-500/6 dark:bg-accent-500/12"
          >
            <span className="text-xs font-mono" style={{ color: 'var(--color-accent-600)' }}>
              {typeof peptide.sequence === 'string' ? peptide.sequence : '未知序列'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md text-gray-500 dark:text-gray-400 bg-accent-500/10 dark:bg-accent-500/16">
              {typeof peptide.source === 'string' ? peptide.source : '未知来源'}
            </span>
          </div>
        ))}
        {peptideCandidates.length > 3 && (
          <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
            还有 {peptideCandidates.length - 3} 条活性肽...
          </p>
        )}
      </div>
    </div>
  )
}

export default PeptideInfo
