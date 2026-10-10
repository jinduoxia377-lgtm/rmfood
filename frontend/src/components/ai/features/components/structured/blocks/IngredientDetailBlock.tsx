/**
 * IngredientDetailBlock — 药材详情卡片
 *
 * 展示单个药材/食材的详细信息：
 * - 名称（中英文）
 * - 来源
 * - 性味归经
 * - 功效
 * - 活性成分
 * - 用量范围
 * - 安全等级
 */
import React, { useState } from 'react'
import {
  Leaf, Info, Shield, Beaker, Clock, AlertCircle,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import type { IngredientDetailData } from '../types'

interface IngredientDetailBlockProps {
  data: IngredientDetailData
}

function IngredientDetailBlock({ data }: IngredientDetailBlockProps) {
  const {
    name,
    latin,
    source,
    properties,
    efficacy,
    active_compounds,
    dosage_range,
    safety_level,
    notes,
  } = data

  const [showDetails, setShowDetails] = useState(false)

  const safetyColors: Record<string, string> = {
    '药食同源': 'text-success-700 dark:text-success-600 bg-success-50 dark:bg-success-300/20 border-success-200 dark:border-success-800',
    '保健食品': 'text-secondary-700 dark:text-secondary-700 bg-secondary-50 dark:bg-secondary-300/20 border-secondary-200 dark:border-secondary-800',
    '普通食品': 'text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700',
    '慎用': 'text-warning-600 dark:text-warning-700 bg-warning-50 dark:bg-warning-300/20 border-warning-200 dark:border-warning-800',
    '禁用': 'text-error-600 dark:text-error-700 bg-error-50 dark:bg-error-300/20 border-error-200 dark:border-error-800',
  }

  const safetyClass = safety_level ? safetyColors[safety_level] || safetyColors['普通食品'] : 'text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'

  return (
    <div className="mb-3 last:mb-0 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
      {/* 头部 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary-50/50 to-transparent dark:from-primary-900/10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-success-600 flex items-center justify-center flex-shrink-0">
          <Leaf className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
              {name}
            </h3>
            {safety_level && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${safetyClass}`}>
                {safety_level}
              </span>
            )}
          </div>
          {latin && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 italic mt-0.5">
              {latin}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          {showDetails ? (
            <ChevronUp className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          )}
        </button>
      </div>

      {/* 基本信息 */}
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="grid grid-cols-2 gap-3">
          {source && (
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-primary-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-neutral-400 dark:text-neutral-400">来源</div>
                <div className="text-xs text-neutral-700 dark:text-neutral-300">{source}</div>
              </div>
            </div>
          )}
          {properties && (
            <div className="flex items-start gap-2">
              <Shield className="w-3.5 h-3.5 text-secondary-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-neutral-400 dark:text-neutral-400">性味</div>
                <div className="text-xs text-neutral-700 dark:text-neutral-300">{properties}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 展开详情 */}
      {showDetails && (
        <div className="px-4 py-3 space-y-3">
          {efficacy && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Leaf className="w-3 h-3 text-primary-500" />
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">功效</span>
              </div>
              <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">{efficacy}</p>
            </div>
          )}

          {active_compounds && active_compounds.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Beaker className="w-3 h-3 text-accent-500" />
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">活性成分</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {active_compounds.map((compound, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-full bg-accent-50 dark:bg-accent-300/20 text-accent-700 dark:text-accent-700 border border-accent-200 dark:border-accent-800"
                  >
                    {compound}
                  </span>
                ))}
              </div>
            </div>
          )}

          {dosage_range && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-warning-500 flex-shrink-0" />
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                建议用量：<span className="font-medium text-neutral-800 dark:text-neutral-200">{dosage_range}</span>
              </span>
            </div>
          )}

          {notes && (
            <div className="flex items-start gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <AlertCircle className="w-3.5 h-3.5 text-error-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default IngredientDetailBlock
