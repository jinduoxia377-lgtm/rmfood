/**
 * 合规状态徽标组件
 *
 * 在配方编辑器中实时显示合规评分和违规提示。
 */
'use client';

import React from 'react';
import { type ComplianceResult } from '@/api/compliance';

interface Props {
  result: ComplianceResult | null;
  loading?: boolean;
  compact?: boolean;
  onFix?: () => void;
}

const STATUS_CONFIG = {
  compliant: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', label: '合规', icon: '✓' },
  warning: { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', label: '需注意', icon: '⚠' },
  non_compliant: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', label: '不合规', icon: '✗' },
};

export function ComplianceBadge({ result, loading, compact, onFix }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
        <span className="inline-block w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
        检查中...
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const cfg = STATUS_CONFIG[result.status];

  return (
    <div className={`rounded-xl border px-3 py-2 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center gap-2">
        <span className={`text-lg font-bold ${cfg.color}`}>{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
            <span className={`text-xs ${cfg.color} opacity-70`}>
              评分 {result.score}/100
            </span>
          </div>
          {!compact && result.violations.length > 0 && (
            <div className="mt-1 text-xs text-red-500 dark:text-red-400 truncate">
              {result.violations[0].message}
            </div>
          )}
          {!compact && result.suggestions.length > 0 && (
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              💡 {result.suggestions[0]}
            </div>
          )}
        </div>
        {result.status !== 'compliant' && onFix && (
          <button
            onClick={onFix}
            className="text-xs px-2 py-1 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-violet-400 transition-colors"
          >
            自动修复
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 合规进度条
 */
export function ComplianceMeter({ result }: { result: ComplianceResult }) {
  const getColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>合规度</span>
        <span className="font-medium">{result.score}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor(result.score)}`}
          style={{ width: `${result.score}%` }}
        />
      </div>
      {result.violations.length > 0 && (
        <div className="text-xs text-red-500 dark:text-red-400">
          {result.violations.length} 项违规
        </div>
      )}
    </div>
  );
}
