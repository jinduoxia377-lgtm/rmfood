import React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface SectionProps {
  id: string
  title: string
  icon: React.ElementType
  children: React.ReactNode
  isExpanded: boolean
  onToggle: (id: string) => void
}

export const Section: React.FC<SectionProps> = ({
  id,
  title,
  icon: Icon,
  children,
  isExpanded,
  onToggle,
}) => (
  <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
    <button
      onClick={() => onToggle(id)}
      className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-neutral-800/30 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon size={20} className="text-neutral-500 dark:text-neutral-400" />
        <span className="font-semibold text-neutral-900 dark:text-neutral-100">{title}</span>
      </div>
      {isExpanded ? <ChevronUp size={20} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" /> : <ChevronDown size={20} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
    </button>
    {isExpanded && (
      <div className="p-6 border-t border-neutral-200 dark:border-neutral-700">
        {children}
      </div>
    )}
  </div>
)
