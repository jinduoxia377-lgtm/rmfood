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
  if (score >= 80) return { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' };
  if (score >= 60) return { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800' };
  return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' };
};

const ROLE_BADGE: Record<string, string> = {
  core: '君',
  primary: '臣',
  supporting: '佐',
  moderator: '使',
};

const ROLE_COLOR: Record<string, string> = {
  core: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  primary: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  supporting: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  moderator: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
};

export function ExplainabilityReport({ result, loading, error }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
        <span className="inline-block w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
        生成解释报告中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
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
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">综合评分</div>
          </div>
          <div className="flex-1 grid grid-cols-3 gap-3">
            {[
              { label: '功效匹配', value: result.scores.efficacy, color: 'text-violet-600' },
              { label: '安全评分', value: result.scores.safety, color: 'text-green-600' },
              { label: '成本评分', value: result.scores.cost, color: 'text-blue-600' },
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
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">📋</span>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">报告摘要</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          {result.summary}
        </p>
      </div>

      {/* 君臣佐使 */}
      {result.core_ingredients.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🏛️</span>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">君臣佐使</h3>
          </div>
          <div className="space-y-2">
            {result.core_ingredients.map((ing) => (
              <div key={ing.name} className="flex items-start gap-3 p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ROLE_COLOR['core']}`}>君</span>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{ing.name}</div>
                  {ing.mechanism && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{ing.mechanism}</div>
                  )}
                  {ing.evidence && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 italic mt-0.5">
                      依据: {ing.evidence}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {result.primary_ingredients.map((ing) => (
              <div key={ing.name} className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ROLE_COLOR['primary']}`}>臣</span>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{ing.name}</div>
                  {ing.mechanism && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">{ing.mechanism}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 协同效应 */}
      {result.synergies.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🤝</span>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">协同效应</h3>
          </div>
          <div className="space-y-2">
            {result.synergies.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{s.a}</span>
                  <span className="text-green-600 dark:text-green-400">+</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{s.b}</span>
                </div>
                <div className="flex-1 text-xs text-gray-500 dark:text-gray-400">{s.desc}</div>
                <div className="text-xs font-mono text-green-600 dark:text-green-400">
                  强度 {Math.round(s.strength * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 拮抗/禁忌 */}
      {result.antagonisms.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 p-4 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">⚠️</span>
            <h3 className="font-semibold text-red-700 dark:text-red-300">禁忌搭配</h3>
          </div>
          {result.antagonisms.map((a, i) => (
            <div key={i} className="text-sm text-red-600 dark:text-red-400">
              {a.a} + {a.b} (强度 {Math.round(a.strength * 100)}%)
            </div>
          ))}
        </div>
      )}

      {/* 合规说明 */}
      {result.compliance_notes.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">✅</span>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">合规说明</h3>
          </div>
          <div className="space-y-1 text-sm">
            {result.compliance_notes.map((note, i) => (
              <div key={i} className={`px-2 py-1 rounded ${
                note.startsWith('✓') ? 'text-green-600 dark:text-green-400' :
                note.startsWith('⚠') ? 'text-yellow-600 dark:text-yellow-400' :
                note.startsWith('✗') ? 'text-red-600 dark:text-red-400' :
                'text-gray-500 dark:text-gray-400'
              }`}>
                {note}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 建议 */}
      {result.recommendations.length > 0 && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 p-4 bg-violet-50 dark:bg-violet-900/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">💡</span>
            <h3 className="font-semibold text-violet-700 dark:text-violet-300">改进建议</h3>
          </div>
          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-violet-500 mt-0.5">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
