 
/**
 * 活性肽详情内容组件（增强版）
 * 包含氨基酸序列可视化（彩色编码）、属性指标
 */
import React, { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { databaseApi } from '@/api/database'
import type { BioactivePeptide } from '@/types'

// ─── 氨基酸单字母映射 ───
const AA_NAMES: Record<string, string> = {
  A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', E: 'Glu', Q: 'Gln',
  G: 'Gly', H: 'His', I: 'Ile', L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe',
  P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val',
}

// ─── 氨基酸颜色 ───
const AA_COLORS: Record<string, string> = {
  A: 'var(--text-muted, #9CA3AF)', R: 'var(--color-tertiary, var(--color-accent-500))', N: 'var(--color-secondary, #0A84FF)', D: 'var(--color-danger-600, #B91C1C)', C: 'var(--color-warning-700, #B45309)',
  E: 'var(--color-primary, var(--color-primary-400))', Q: 'var(--color-info-600, #0E7490)', G: 'var(--color-warning, #FF9F0A)', H: 'var(--color-danger-500, #D946EF)', I: 'var(--color-primary-hover, var(--color-primary-500))',
  L: 'var(--color-primary-hover, var(--color-primary-500))', K: 'var(--color-tertiary, var(--color-accent-500))', M: 'var(--color-warning-700, #B45309)', F: 'var(--color-danger-600, #B91C1C)', P: 'var(--color-warning, #FF9F0A)',
  S: 'var(--color-secondary, #0A84FF)', T: 'var(--color-secondary, #0A84FF)', W: 'var(--color-danger-500, #D946EF)', Y: 'var(--color-warning-700, #B45309)', V: 'var(--color-primary-hover, var(--color-primary-500))',
}

// ─── 氨基酸底色（10% 浓度半透明） ───
// 注意：不能写成 `${color}18` —— AA_COLORS 的值是 `var(--color-primary, …)` 引用，
// 拼上 "18" 会得到 `var(--color-primary, …)18`，这是非法 CSS，浏览器会丢弃整条
// backgroundColor 声明（实测氨基酸网格 20 格全部背景透明、无底色）。
// 用 color-mix 对任意颜色值（含 var() 引用）取 10% 浓度，等价于原意的 #RRGGBB18。
const aaBg = (c: string) => `color-mix(in srgb, ${c} 10%, transparent)`

export function PeptideDetailContent({ peptide }: { peptide: BioactivePeptide }) {
  const sequence = peptide.sequence || ''
  const aaCount = sequence.length

  const activityTypesQuery = useQuery({
    queryKey: ['db-peptide-types-detail'],
    queryFn: () => databaseApi.getActivityTypes(),
  });
  const activityTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    activityTypesQuery.data?.activity_types?.forEach((t) => { map[t.type_en] = t.type_cn || t.type_en; });
    return map;
  }, [activityTypesQuery.data]);

  // 序列片段渲染（每10个一组）
  const sequenceChunks: string[] = []
  for (let i = 0; i < aaCount; i += 10) {
    sequenceChunks.push(sequence.slice(i, i + 10))
  }

  return (
    <div className="space-y-4">
      {/* 序列可视化 */}
      <div className="bg-[var(--bg-tertiary)]/60 dark:bg-[var(--bg-tertiary)]/40 rounded-xl p-4 border border-[var(--border-subtle,rgba(0,0,0,0.06))]">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider">氨基酸序列</h4>
          <span className="text-xs font-mono text-[var(--text-muted,#9A9A9F)]">{aaCount} aa</span>
        </div>
        <div className="space-y-1">
          {sequenceChunks.map((chunk, chunkIdx) => (
            <div key={chunkIdx} className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--text-muted,#9A9A9F)] w-6 text-right">{chunkIdx * 10 + 1}</span>
              <div className="flex gap-0.5 flex-wrap">
                {chunk.split('').map((aa, idx) => (
                  <span key={idx} title={`${AA_NAMES[aa] || aa} (${aa})`}
                    className="w-6 h-7 flex items-center justify-center rounded text-xs font-bold transition-all hover:scale-110 cursor-default"
                    style={{ backgroundColor: aaBg(AA_COLORS[aa] || 'var(--text-muted, #9A9A9F)'), color: AA_COLORS[aa] || 'var(--text-muted, #9A9A9F)' }}>
                    {aa}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* 图例 */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[var(--border-subtle,rgba(0,0,0,0.06))]">
          {Object.entries(AA_NAMES).slice(0, 10).map(([letter, name]) => (
            <div key={letter} className="flex items-center gap-1 text-xs">
              <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold leading-none"
                style={{ backgroundColor: aaBg(AA_COLORS[letter]), color: AA_COLORS[letter] }}>{letter}</div>
              <span className="text-[var(--text-muted,#9A9A9F)]">{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 属性指标 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {[
          { label: '来源蛋白', value: (peptide as { source_protein?: string }).source_protein || '-', bg: 'bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/40' },
          { label: '来源生物', value: (peptide as { source_organism?: string }).source_organism || '-', bg: 'bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/40' },
          { label: '活性类型', value: activityTypeMap[(peptide as { activity_type?: string }).activity_type ?? ''] || (peptide as { activity_type?: string }).activity_type || '-', bg: 'bg-[var(--color-accent-container)] dark:bg-[var(--color-accent-container)]/40' },
          { label: '活性值', value: (peptide as { activity_value?: number; activity_unit?: string }).activity_value != null ? `${(peptide as { activity_value?: number }).activity_value} ${(peptide as { activity_unit?: string }).activity_unit || ''}` : '-', bg: 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/40' },
          { label: '分子量 (Da)', value: (peptide as { molecular_weight?: number }).molecular_weight?.toFixed(2) || '-', bg: 'bg-info-50 dark:bg-info-950/40' },
          { label: '水解酶', value: (peptide as { hydrolysis_enzyme?: string }).hydrolysis_enzyme || '-', bg: 'bg-danger-50 dark:bg-danger-950/40' },
        ].map(({ label, value, bg }) => (
          <div key={label} className={`p-3 rounded-xl ${bg} dark:bg-opacity-20`}>
            <span className="text-xs text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)]">{label}</span>
            <div className="font-medium mt-0.5 text-sm text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))]">{value}</div>
          </div>
        ))}
      </div>

      {/* 文献 DOI */}
      {(peptide.dfbp_id && (
        <div className="flex items-center gap-2 p-3 bg-[var(--bg-tertiary)]/60 dark:bg-[var(--bg-tertiary)]/40 rounded-xl border border-[var(--border-subtle,rgba(0,0,0,0.06))]">
          <ExternalLink className="w-4 h-4 text-[var(--text-muted,#9A9A9F)]" />
          <span className="text-xs text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)]">DFBP ID:</span>
          <span className="text-xs font-mono text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))]">{peptide.dfbp_id}</span>
          {peptide.literature_doi && (
            <>
              <span className="text-xs text-[var(--text-muted,#9A9A9F)] ml-2">DOI:</span>
              <span className="text-xs font-mono text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]">{peptide.literature_doi}</span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
