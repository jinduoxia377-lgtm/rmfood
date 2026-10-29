/**
 * TerminologyLookup - 术语词典速查（知识库面板内嵌）
 *
 * 读取本地 `src/knowledge/terminology-dict.json`（经 @/knowledge/terminology 加载），
 * 提供药食同源 / 多肽领域术语的中英定义、缩写、单位与示例。
 * 这是该 JSON 词典在代码库中的真实使用点。
 */

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { searchTerminology, TERMINOLOGY_ENTRIES } from '@/knowledge/terminology'
import { Card } from '@/components/ui'

const POPULAR_TERMS = ['药食同源', '抗氧化', '君臣佐使', '口服生物利用度', '生物活性']

export function TerminologyLookup() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)

  const results = useMemo(() => searchTerminology(query, 8), [query])
  const visibleTerms = useMemo(() => {
    if (query.trim()) return results
    return TERMINOLOGY_ENTRIES.filter((e) => POPULAR_TERMS.includes(e.term)).slice(0, 5)
  }, [query, results])

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary-500" />
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            {t('ai.knowledge.termLookup')}
          </h3>
          <span className="text-xs text-[var(--text-muted)]">
            {t('ai.knowledge.builtinTerms', { count: TERMINOLOGY_ENTRIES.length })}
          </span>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1"
        >
          {expanded ? t('ai.knowledge.collapseDetails') : t('ai.knowledge.expand')} <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      {expanded && (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('ai.knowledge.searchTermPlaceholder')}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-[var(--border-color)] rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            {visibleTerms.length === 0 ? (
              <div className="text-center py-4 text-sm text-[var(--text-muted)]">{t('ai.knowledge.noTermMatch')}</div>
            ) : (
              visibleTerms.map((entry) => (
                <div key={entry.term} className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-primary-700 dark:text-primary-700">{entry.term}</span>
                    <span className="text-xs text-[var(--text-muted)]">{entry.categoryName}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">{entry.zh}</p>
                  <p className="text-xs text-[var(--text-muted)]">{entry.en}</p>
                  {(entry.abbreviation || entry.unit) && (
                    <p className="text-xs text-[var(--text-muted)]">
                      {entry.abbreviation && <>{t('ai.knowledge.abbreviation', { value: entry.abbreviation })}</>}
                      {entry.abbreviation && entry.unit && ' · '}
                      {entry.unit && <>{t('ai.knowledge.unit', { value: entry.unit })}</>}
                    </p>
                  )}
                  {entry.examples && entry.examples.length > 0 && (
                    <p className="text-xs text-[var(--text-muted)]">{t('ai.knowledge.example', { value: entry.examples.join('、') })}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-left text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1"
        >
          <ChevronUp className="w-3 h-3" /> {t('ai.knowledge.termLookupHint')}
        </button>
      )}
    </Card>
  )
}

export default TerminologyLookup