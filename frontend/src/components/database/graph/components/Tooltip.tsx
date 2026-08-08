export interface TooltipProps {
  tooltip: { x: number; y: number; content: string } | null
}

export default function Tooltip({ tooltip }: TooltipProps) {
  if (!tooltip) return null
  return (
    <div
      className="absolute z-50 pointer-events-none px-4 py-2.5 rounded-xl text-xs font-medium shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: tooltip.x + 16,
        top: tooltip.y - 12,
        background: 'linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.97) 100%)',
        color: '#F3F4F6',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '12px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(148,163,184,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
        border: '1px solid rgba(148,163,184,0.10)',
        maxWidth: '320px',
      }}
    >
      <div className="whitespace-pre-line leading-relaxed">{tooltip.content}</div>
    </div>
  )
}
