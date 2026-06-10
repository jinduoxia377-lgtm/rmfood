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
  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
    <button
      onClick={() => onToggle(id)}
      className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon size={20} className="text-gray-500 dark:text-gray-400" />
        <span className="font-semibold text-gray-900 dark:text-gray-100">{title}</span>
      </div>
      {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
    </button>
    {isExpanded && (
      <div className="p-6 border-t border-gray-200 dark:border-gray-700">
        {children}
      </div>
    )}
  </div>
)
