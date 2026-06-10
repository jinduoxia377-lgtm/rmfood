/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 活性肽详情内容组件（增强版）
 * 包含氨基酸序列可视化（彩色编码）、属性指标
 */
import { ExternalLink } from 'lucide-react'
import type { BioactivePeptide } from '@/types'

// ─── 氨基酸单字母映射 ───
const AA_NAMES: Record<string, string> = {
  A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', E: 'Glu', Q: 'Gln',
  G: 'Gly', H: 'His', I: 'Ile', L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe',
  P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val',
}

// ─── 氨基酸颜色 ───
const AA_COLORS: Record<string, string> = {
  A: '#94A3B8', R: '#7C3AED', N: '#2563EB', D: '#DC2626', C: '#D97706',
  E: '#10B981', Q: '#06B6D4', G: '#F59E0B', H: '#EC4899', I: '#059669',
  L: '#059669', K: '#7C3AED', M: '#D97706', F: '#DC2626', P: '#F59E0B',
  S: '#2563EB', T: '#2563EB', W: '#EC4899', Y: '#D97706', V: '#059669',
}

export function PeptideDetailContent({ peptide }: { peptide: BioactivePeptide }) {
  const sequence = peptide.sequence || ''
  const aaCount = sequence.length

  // 序列片段渲染（每10个一组）
  const sequenceChunks: string[] = []
  for (let i = 0; i < aaCount; i += 10) {
    sequenceChunks.push(sequence.slice(i, i + 10))
  }

  return (
    <div className="space-y-4">
      {/* 序列可视化 */}
      <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-xl p-4 border border-[rgba(148,163,184,0.12)]">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">氨基酸序列</h4>
          <span className="text-xs font-mono text-[#94A3B8]">{aaCount} aa</span>
        </div>
        <div className="space-y-1">
          {sequenceChunks.map((chunk, chunkIdx) => (
            <div key={chunkIdx} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#94A3B8] w-6 text-right">{chunkIdx * 10 + 1}</span>
              <div className="flex gap-0.5 flex-wrap">
                {chunk.split('').map((aa, idx) => (
                  <span key={idx} title={`${AA_NAMES[aa] || aa} (${aa})`}
                    className="w-6 h-7 flex items-center justify-center rounded text-xs font-bold transition-all hover:scale-110 cursor-default"
                    style={{ backgroundColor: `${AA_COLORS[aa] || '#94A3B8'}18`, color: AA_COLORS[aa] || '#94A3B8' }}>
                    {aa}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* 图例 */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[rgba(148,163,184,0.1)]">
          {Object.entries(AA_NAMES).slice(0, 10).map(([letter, name]) => (
            <div key={letter} className="flex items-center gap-1 text-[10px]">
              <div className="w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-bold"
                style={{ backgroundColor: `${AA_COLORS[letter]}18`, color: AA_COLORS[letter] }}>{letter}</div>
              <span className="text-[#94A3B8]">{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 属性指标 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {[
          { label: '来源蛋白', value: peptide.source_protein || '-', bg: 'bg-primary-50 dark:bg-primary-950/40' },
          { label: '来源生物', value: peptide.source_organism || '-', bg: 'bg-blue-50 dark:bg-blue-950/40' },
          { label: '活性类型', value: peptide.activity_type || '-', bg: 'bg-accent-50 dark:bg-accent-950/40' },
          { label: '活性值', value: peptide.activity_value != null ? `${peptide.activity_value} ${peptide.activity_unit || ''}` : '-', bg: 'bg-amber-50 dark:bg-amber-950/40' },
          { label: '分子量 (Da)', value: peptide.molecular_weight?.toFixed(2) || '-', bg: 'bg-cyan-50 dark:bg-cyan-950/40' },
          { label: '水解酶', value: (peptide as any).hydrolysis_enzyme || '-', bg: 'bg-rose-50 dark:bg-rose-950/40' },
        ].map(({ label, value, bg }) => (
          <div key={label} className={`p-3 rounded-xl ${bg} dark:bg-opacity-20`}>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">{label}</span>
            <div className="font-medium mt-0.5 text-sm text-[#0f172a] dark:text-[#f1f5f1]">{value}</div>
          </div>
        ))}
      </div>

      {/* 文献 DOI */}
      {(peptide as any).dfbp_id && (
        <div className="flex items-center gap-2 p-3 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-[rgba(148,163,184,0.12)]">
          <ExternalLink className="w-4 h-4 text-[#94A3B8]" />
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">DFBP ID:</span>
          <span className="text-xs font-mono text-[#0f172a] dark:text-[#f1f5f9]">{(peptide as any).dfbp_id}</span>
          {(peptide as any).literature_doi && (
            <>
              <span className="text-xs text-[#94A3B8] ml-2">DOI:</span>
              <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{(peptide as any).literature_doi}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
