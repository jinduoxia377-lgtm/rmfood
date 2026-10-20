/**
 * 可解释性报告展示组件
 *
 * 展示配方来源分析、贡献度、相互作用和优化依据
 */
'use client';

import React from 'react';
import { type ExplainabilityResult } from '@/api/explainability';

interface Props {
  result: ExplainabilityResult | null;
  loading?: boolean;
  error?: string;
}

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return { color: 'text-success-600 dark:text-success-700', bg: 'bg-success-50 dark:bg-success-300/20', border: 'border-success-200 dark:border-success-800' };
  if (score >= 60) return { color: 'text-warning-600 dark:text-warning-700', bg: 'bg-warning-50 dark:bg-warning-300/20', border: 'border-warning-200 dark:border-warning-800' };
  return { color: 'text-error-600 dark:text-error-700', bg: 'bg-error-50 dark:bg-error-300/20', border: 'border-error-200 dark:border-error-800' };
};

const ROLE_BADGE: Record<string, string> = {
  core: '君',
  primary: '臣',
  supporting: '佐',
  moderator: '使',
};

const ROLE_COLOR: Record<string, string> = {
  core: 'bg-accent-100 dark:bg-accent-300/25 text-accent-700 dark:text-accent-700',
  primary: 'bg-secondary-100 dark:bg-secondary-300/25 text-secondary-700 dark:text-secondary-700',
  supporting: 'bg-success-100 dark:bg-success-300/25 text-success-700 dark:text-success-700',
  moderator: 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300',
};

export function ExplainabilityReport({ result, loading, error }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
        <span className="inline-block w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
        生成解释报告中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 rounded-xl bg-error-50 dark:bg-error-300/20 border border-error-200 dark:border-error-800 text-sm text-error-600 dark:text-error-700">
        {error}
      </div>
    );
  }

  if (!result) return null;

  const scoreCfg = SCORE_COLOR(result.scores.overall);

  return (
    <div className="space-y-4">
      {/* 综合评分卡片 */}
      <div className={`rounded-2xl border p-5 ${scoreCfg.bg} ${scoreCfg.border}`}>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className={`text-4xl font-bold ${scoreCfg.color}`}>
              {result.scores.overall}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">综合评分</div>
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: '功效匹配', value: result.scores.efficacy, color: 'text-accent-600' },
              { label: '安全评分', value: result.scores.safety, color: 'text-success-600' },
              { label: '成本评分', value: result.scores.cost, color: 'text-secondary-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <div className={`text-xl font-semibold ${color}`}>{value}</div>
                <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 摘要 */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-800">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">📋</span>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">报告摘要</h3>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
          {result.summary}
        </p>
      </div>

      {/* 君臣佐使 */}
      {result.core_ingredients.length > 0 && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🏛️</span>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">君臣佐使</h3>
          </div>
          <div className="space-y-2">
            {result.core_ingredients.map((ing) => (
              <div key={ing.name} className="flex items-start gap-3 p-3 rounded-lg bg-accent-50 dark:bg-accent-300/20">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ROLE_COLOR['core']}`}>君</span>
                <div className="flex-1">
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">{ing.name}</div>
                  {ing.mechanism && (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{ing.mechanism}</div>
                  )}
                  {ing.evidence && (
                    <div className="text-xs text-neutral-400 dark:text-neutral-500 italic mt-0.5">
                      依据: {ing.evidence}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {result.primary_ingredients.map((ing) => (
              <div key={ing.name} className="flex items-start gap-3 p-3 rounded-lg bg-secondary-50 dark:bg-secondary-300/20">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ROLE_COLOR['primary']}`}>臣</span>
                <div className="flex-1">
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">{ing.name}</div>
                  {ing.mechanism && (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">{ing.mechanism}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 协同效应 */}
      {result.synergies.length > 0 && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🤝</span>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">协同效应</h3>
          </div>
          <div className="space-y-2">
            {result.synergies.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-success-50 dark:bg-success-300/20">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{s.a}</span>
                  <span className="text-success-600 dark:text-success-700">+</span>
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{s.b}</span>
                </div>
                <div className="flex-1 text-xs text-neutral-500 dark:text-neutral-400">{s.desc}</div>
                <div className="text-xs font-mono text-success-600 dark:text-success-700">
                  强度 {Math.round(s.strength * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 拮抗/禁忌 */}
      {result.antagonisms.length > 0 && (
        <div className="rounded-xl border border-error-200 dark:border-error-800 p-4 bg-error-50 dark:bg-error-300/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">⚠️</span>
            <h3 className="font-semibold text-error-700 dark:text-error-700">禁忌搭配</h3>
          </div>
          {result.antagonisms.map((a, i) => (
            <div key={i} className="text-sm text-error-600 dark:text-error-700">
              {a.a} + {a.b} (强度 {Math.round(a.strength * 100)}%)
            </div>
          ))}
        </div>
      )}

      {/* 合规说明 */}
      {result.compliance_notes.length > 0 && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">✅</span>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">合规说明</h3>
          </div>
          <div className="space-y-1 text-sm">
            {result.compliance_notes.map((note, i) => (
              <div key={i} className={`px-2 py-1 rounded ${
                note.startsWith('✓') ? 'text-success-600 dark:text-success-700' :
                note.startsWith('⚠') ? 'text-warning-600 dark:text-warning-700' :
                note.startsWith('✗') ? 'text-error-600 dark:text-error-700' :
                'text-neutral-500 dark:text-neutral-400'
              }`}>
                {note}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 建议 */}
      {result.recommendations.length > 0 && (
        <div className="rounded-xl border border-accent-200 dark:border-accent-800 p-4 bg-accent-50 dark:bg-accent-300/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">💡</span>
            <h3 className="font-semibold text-accent-700 dark:text-accent-700">改进建议</h3>
          </div>
          <ul className="space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-accent-500 mt-0.5">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
