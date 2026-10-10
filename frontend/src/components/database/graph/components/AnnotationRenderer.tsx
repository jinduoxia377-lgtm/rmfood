import { GraphNode, TYPE_CONFIG } from '../types'

export interface AnnotationItem {
  id: string
  x: number
  y: number
  text: string
  type: 'note' | 'arrow'
  targetId?: string
}

export interface AnnotationRendererProps {
  [key: string]: any;
  annotations: AnnotationItem[]
  onRemoveAnnotation: (id: string) => void
}

export default function AnnotationRenderer({ annotations, onRemoveAnnotation }: AnnotationRendererProps) {
  if (annotations.length === 0) return null

  return (
    <>
      {annotations.map(anno => (
        <div key={anno.id}
          className="absolute z-35 group"
          style={{ left: anno.x, top: anno.y }}
        >
          {anno.type === 'arrow' ? (
            <svg width="60" height="20" className="overflow-visible">
              <defs><marker id={`arrowhead-${anno.id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 L1.5,3 Z" fill="#FF3B30" />
              </marker></defs>
              <line x1="0" y1="10" x2="55" y2="10" stroke="#FF3B30" strokeWidth="1.5" markerEnd={`url(#arrowhead-${anno.id})`} />
            </svg>
          ) : null}
          <div className="relative">
            <div className="px-2 py-1 bg-warning-100 dark:bg-warning-300/30 border border-warning-300 dark:border-warning-700/50 rounded-lg shadow-sm whitespace-nowrap">
              <span className="text-xs font-medium text-warning-800 dark:text-warning-200">{anno.text}</span>
            </div>
            <button onClick={() => onRemoveAnnotation(anno.id)}
              className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-neutral-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[7px] leading-none">
              ×
            </button>
          </div>
        </div>
      ))}
    </>
  )
}
