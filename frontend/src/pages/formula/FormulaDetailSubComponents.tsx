/**
 * FormulaDetailPage sub-components extracted
 */
import React, { useState, useCallback, useEffect } from 'react'
import { CheckCircle2, AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui'
import { useComplianceCheck } from '@/api/compliance'
import { explainabilityApi } from '@/api/explainability'
import { ExplainabilityReport } from '@/components/report/ExplainabilityReport'

  export const renderSynergyResult = (r: any) => (
    <div className="space-y-[var(--space-apple-md)]">
      {r.overall_si !== null && r.overall_si !== undefined && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-apple-sm)]">
          <div className="p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] bg-[var(--color-accent-container)] border border-[var(--color-accent-border)] dark:border-[var(--color-accent)]">
            <p className="text-xs text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)] mb-1">综合协同指数 SI</p>
            <p className="text-2xl font-bold text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]">{r.overall_si.toFixed(2)}</p>
          </div>
          <div className="p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 border border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)]">
            <p className="text-xs text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] mb-1">成分对数量</p>
            <p className="text-2xl font-bold text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]">{r.pairs?.length ?? 0}</p>
          </div>
          <div className="p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] bg-[var(--color-success-container)] border border-[var(--color-success-border)] dark:border-[var(--color-success)]">
            <p className="text-xs text-[var(--color-success-text)] dark:text-[var(--color-success-text)] mb-1">成分总数</p>
            <p className="text-2xl font-bold text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">{r.ingredient_count ?? 0}</p>
          </div>
        </div>
      )}
      {r.pairs?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">成分对分析详情</p>
          {r.pairs.map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)]/50">
              <span className="text-sm font-medium">{p.pair}</span>
              <div className="flex items-center gap-[var(--space-apple-sm)]">
                {p.dominant_mechanism && (
                  <span className="text-xs text-[var(--text-muted)] max-w-[120px] truncate" title={p.dominant_mechanism}>
                    {p.dominant_mechanism.replace(/_/g, ' ')}
                  </span>
                )}
                {p.overall_si !== undefined && (
                  <span className={`text-sm font-semibold ${
                    p.overall_si > 0.7 ? 'text-[var(--color-success-text)]' : p.overall_si > 0.4 ? 'text-[var(--color-warning-text)]' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'
                  }`}>
                    SI: {p.overall_si.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  export const renderStabilityResult = (r: any) => (
    <div className="space-y-[var(--space-apple-md)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
        <div className="p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] bg-[var(--color-success-container)] border border-[var(--color-success-border)] dark:border-[var(--color-success)]">
          <p className="text-xs text-[var(--color-success-text)] dark:text-[var(--color-success-text)] mb-1">预测货架期</p>
          <p className="text-2xl font-bold text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">{r.predicted_shelf_life_months?.toFixed(0) ?? '—'} 月</p>
        </div>
        <div className="p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] bg-[var(--color-accent-container)] border border-[var(--color-accent-border)] dark:border-[var(--color-accent)]">
          <p className="text-xs text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)] mb-1">稳定性评分</p>
          <p className="text-2xl font-bold text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]">{r.stability_score?.toFixed(1) ?? '—'}/100</p>
        </div>
      </div>
      {r.risk_factors?.length > 0 && (
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)] mb-2">风险因素 ({r.risk_factors.length})</p>
          {r.risk_factors.map((f: any, i: number) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded bg-[var(--color-warning-container)] mb-1">
              <AlertTriangle size={14} className="text-[var(--color-warning-text)]0 mt-0.5 shrink-0" />
              <span className="text-sm text-[var(--text-primary)]">{f.description || f.factor}</span>
            </div>
          ))}
        </div>
      )}
      {r.storage_recommendations?.length > 0 && (
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)] mb-2">储存建议</p>
          {r.storage_recommendations.map((s: string, i: number) => (
            <p key={i} className="text-sm text-[var(--text-secondary)] ml-4">• {s}</p>
          ))}
        </div>
      )}
    </div>
  );

  export const renderTasteResult = (r: any) => {
    const tp = r.taste_profile || {};
    return (
      <div className="space-y-[var(--space-apple-md)]">
        <div className="grid grid-cols-5 gap-2">
          {(['bitter', 'sweet', 'umami', 'astringent', 'sour'] as const).map((key) => {
            const labels: Record<string, string> = { bitter: '苦', sweet: '甜', umami: '鲜', astringent: '涩', sour: '酸' };
            const colors: Record<string, string> = { bitter: 'bg-danger-400', sweet: 'bg-danger-400', umami: 'bg-[var(--color-warning)]', astringent: 'bg-[var(--color-accent)]', sour: 'bg-[var(--color-success)]' };
            const val = tp[key] ?? 0;
            return (
              <div key={key} className="text-center">
                <div className={`h-16 rounded-[var(--radius-Apple-sm)] ${colors[key]} opacity-70`} style={{ height: `${Math.max(8, val * 64)}px`, marginTop: 'auto' }} />
                <p className="text-xs font-medium mt-1 text-[var(--text-primary)]">{labels[key]}</p>
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{val.toFixed(2)}</p>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
          <div className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--color-success-container)]">
            <p className="text-xs text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">风味平衡度</p>
            <p className="text-xl font-bold text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">{r.balance_score?.toFixed(2) ?? '—'}</p>
          </div>
          <div className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20">
            <p className="text-xs text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]">接受度</p>
            <p className="text-xl font-bold text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]">{r.acceptability?.toFixed(2) ?? '—'}</p>
          </div>
        </div>
        {r.optimization_suggestions?.length > 0 && (
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)] mb-2">优化建议</p>
            {r.optimization_suggestions.slice(0, 3).map((s: any, i: number) => (
              <p key={i} className="text-sm text-[var(--text-secondary)]">• {s.description || s.action}</p>
            ))}
          </div>
        )}
      </div>
    );
  };

  export const renderEffectResult = (r: any) => (
    <div className="space-y-[var(--space-apple-md)]">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[var(--space-apple-sm)]">
        {[
          { label: 'Tmax (h)', value: r.peak_time?.toFixed(1) ?? '—', color: 'violet' },
          { label: 'Cmax (μg/mL)', value: r.peak_concentration?.toFixed(2) ?? '—', color: 'blue' },
          { label: 'Emax', value: r.max_effect?.toFixed(3) ?? '—', color: 'emerald' },
          { label: '效应持续时间 (h)', value: r.effect_duration?.toFixed(1) ?? '—', color: 'amber' },
        ].map((m) => (
          <div key={m.label} className={`p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-${m.color}-50 dark:bg-${m.color}-900/20 border border-${m.color}-200 dark:border-${m.color}-800`}>
            <p className={`text-xs text-${m.color}-600 dark:text-${m.color}-400 mb-1`}>{m.label}</p>
            <p className={`text-lg font-bold text-${m.color}-700 dark:text-${m.color}-300`}>{m.value}</p>
          </div>
        ))}
      </div>
      {r.optimal_window?.length === 2 && (
        <div className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--color-success-container)] border border-[var(--color-success-border)] dark:border-[var(--color-success)]">
          <p className="text-sm font-medium text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">最佳服用时间窗口</p>
          <p className="text-2xl font-bold text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">
            {r.optimal_window[0]?.toFixed(1)} ~ {r.optimal_window[1]?.toFixed(1)} 小时
          </p>
        </div>
      )}
      <div className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)]/50">
        <p className="text-sm text-[var(--text-secondary)]">AUC (曲线下面积): <span className="font-semibold text-neutral-800 dark:text-[var(--text-primary)]">{r.auc?.toFixed(2) ?? '—'}</span></p>
      </div>
    </div>
  );

  export const renderCompatResult = (r: any) => (
    <div className="space-y-[var(--space-apple-md)]">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-apple-sm)]">
        <div className="p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] bg-[var(--color-success-container)] border border-[var(--color-success-border)] dark:border-[var(--color-success)]">
          <p className="text-xs text-[var(--color-success-text)] dark:text-[var(--color-success-text)] mb-1">兼容分数</p>
          <p className="text-2xl font-bold text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">{r.overall_score?.toFixed(0) ?? '—'}/100</p>
        </div>
        <div className="p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 border border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)]">
          <p className="text-xs text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] mb-1">通过检测</p>
          <p className="text-2xl font-bold text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]">{r.passed_checks ?? 0}/{r.total_checks ?? 0}</p>
        </div>
        <div className="p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] bg-danger-50 dark:bg-danger-300/20 border border-danger-200 dark:border-danger-800">
          <p className="text-xs text-danger-600 dark:text-danger-700 mb-1">问题数</p>
          <p className="text-2xl font-bold text-danger-700 dark:text-danger-700">{r.error_count ?? 0} 错误 / {r.warning_count ?? 0} 警告</p>
        </div>
      </div>
      {r.issues?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">检测问题 ({r.issues.length})</p>
          {r.issues.slice(0, 5).map((issue: any, i: number) => (
            <div key={i} className={`p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border ${
              issue.level === 'ERROR' ? 'bg-danger-50 dark:bg-danger-300/20 border-danger-200 dark:border-danger-800' :
              issue.level === 'WARNING' ? 'bg-[var(--color-warning-container)] border-[var(--color-warning-border)] dark:border-[var(--color-warning)]' :
              'bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)]'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm font-medium ${
                  issue.level === 'ERROR' ? 'text-danger-700 dark:text-danger-700' :
                  issue.level === 'WARNING' ? 'text-[var(--color-warning-text)]' :
                  'text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]'
                }`}>{issue.category || issue.level}</p>
                <span className={`text-xs px-2 py-0.5 rounded-[var(--radius-pill)] ${
                  issue.level === 'ERROR' ? 'bg-danger-200 dark:bg-danger-800 text-danger-800 dark:text-danger-200' :
                  issue.level === 'WARNING' ? 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)] text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]' :
                  'bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]'
                }`}>{issue.level}</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{issue.description}</p>
              {issue.suggestion && <p className="text-xs text-[var(--text-muted)] mt-1">💡 {issue.suggestion}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  export const renderSafetyResult = (r: any) => (
    <div className="space-y-[var(--space-apple-md)]">
      <div className={`p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border ${
        r.is_safe
          ? 'bg-[var(--color-success-container)] border-[var(--color-success-border)] dark:border-[var(--color-success)]'
          : 'bg-danger-50 dark:bg-danger-300/20 border-danger-200 dark:border-danger-800'
      }`}>
        <div className="flex items-center gap-[var(--space-apple-sm)]">
          {r.is_safe
            ? <CheckCircle2 size={24} className="text-[var(--color-success-text)]0" />
            : <AlertTriangle size={24} className="text-danger-500" />
          }
          <div>
            <p className={`text-lg font-bold ${r.is_safe ? 'text-[var(--color-success-text)] dark:text-[var(--color-success-text)]' : 'text-danger-700 dark:text-danger-700'}`}>
              {r.is_safe ? '配方安全' : '存在安全风险'}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              风险评分: {r.overall_risk_score?.toFixed(1) ?? '—'} / 100
              {r.blocked_by_critical && <span className="ml-2 text-danger-600 font-medium">⚠️ 已被关键问题阻断</span>}
            </p>
          </div>
        </div>
      </div>
      {r.alerts?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">安全告警 ({r.alerts.length})</p>
          {r.alerts.map((a: any, i: number) => (
            <div key={i} className={`p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border ${
              a.level === 'CRITICAL' ? 'bg-danger-50 dark:bg-danger-300/20 border-danger-200 dark:border-danger-800' :
              a.level === 'WARNING' ? 'bg-[var(--color-warning-container)] border-[var(--color-warning-border)] dark:border-[var(--color-warning)]' :
              'bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)]'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">{a.ingredient || '未知成分'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-[var(--radius-pill)] ${
                  a.level === 'CRITICAL' ? 'bg-danger-200 dark:bg-danger-800 text-danger-800 dark:text-danger-200' :
                  a.level === 'WARNING' ? 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)] text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]' :
                  'bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]'
                }`}>{a.level}</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{a.message}</p>
              {a.recommendation && <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">💡 {a.recommendation}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );


export function ComplianceCheckSection({
  ingredients,
}: {
  ingredients: Array<{ name: string; dosage_mg: number }>;
  targetEffects: string[];
}) {
  const { result, loading, check } = useComplianceCheck(ingredients, 'adults');

  useEffect(() => {
    check();
  }, [ingredients, check]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
        <span className="inline-block w-2 h-2 rounded-[var(--radius-pill)] bg-[var(--color-accent-container)]0 animate-pulse" />
        检查合规性...
      </div>
    );
  }

  if (!result) return null;

  const cfg =
    result.status === 'compliant'
      ? 'text-[var(--color-success-text)] bg-[var(--color-success-container)] border-[var(--color-success-border)] dark:border-[var(--color-success)]'
      : result.status === 'warning'
      ? 'text-[var(--color-warning-text)] bg-[var(--color-warning-container)] border-[var(--color-warning-border)] dark:border-[var(--color-warning)]'
      : 'text-[var(--color-error-text)] bg-[var(--color-error-container)] border-[var(--color-error-border)] dark:border-[var(--color-error)]';

  return (
    <div className={`rounded-[var(--radius-Apple-md)] border p-[var(--space-apple-md)] ${cfg}`}>
      <div className="flex items-center gap-[var(--space-apple-sm)]">
        <span className="text-2xl font-bold">{result.score}</span>
        <div className="flex-1">
          <div className="font-semibold">合规评分</div>
          <div className="text-sm opacity-75">
            {result.violations.length > 0
              ? `${result.violations.length} 项违规`
              : '配方合规'}
          </div>
        </div>
        {result.violations.length > 0 && (
          <div className="text-sm opacity-75">
            {result.violations[0].message}
          </div>
        )}
        {result.suggestions.length > 0 && (
          <div className="text-xs opacity-60 mt-1">💡 {result.suggestions[0]}</div>
        )}
      </div>
    </div>
  );
}

// ── 子组件：可解释性报告区块 ──────────────────────────────
export function ExplainabilityReportSection({
  formulaName,
  ingredients,
  targetEffects,
}: {
  formulaName: string;
  ingredients: Array<{ name: string; dosage_mg: number }>;
  targetEffects: string[];
}) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await explainabilityApi.analyze({
        formula_name: formulaName,
        ingredients: ingredients.map((i) => ({
          name: i.name,
          dosage_mg: i.dosage_mg,
        })),
        target_effects: targetEffects,
      });
      if (resp.success && resp.data) {
        setResult(resp.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setLoading(false);
    }
  }, [formulaName, ingredients, targetEffects]);

  return (
    <div className="space-y-[var(--space-apple-sm)]">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--text-primary)]">
          成分贡献与相互作用分析
        </h3>
        <Button
          variant="secondary"
          size="sm"
          onClick={generateReport}
          loading={loading}
        >
          {loading ? '生成中...' : '生成报告'}
        </Button>
      </div>

      {error && (
        <div className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-md)] bg-[var(--color-error-container)] text-sm text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">
          {error}
        </div>
      )}

      {result && (
        <ExplainabilityReport result={result} />
      )}

      {!result && !loading && (
        <div className="p-[var(--space-apple-lg)] rounded-[var(--radius-Apple-md)] bg-[var(--bg-tertiary)] text-center text-sm text-[var(--text-muted)]">
          点击「生成报告」分析配方可解释性
        </div>
      )}
    </div>
  );
}

// ── 深度分析卡片组件 ──
export function AnalysisCard({
  title,
  icon,
  result,
  loading,
  onRun,
  children,
}: {
  title: string
  icon: React.ReactNode
  result: any
  loading: boolean
  onRun: () => void
  children?: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(!!result)
  if (!expanded && !result) return null
  return (
    <div className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-[var(--space-apple-md)] bg-[var(--bg-tertiary)]/50 hover:bg-[var(--bg-secondary)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-accent-text)]0">{icon}</span>
          <span className="font-medium text-[var(--text-primary)] text-sm">{title}</span>
          {result && <span className="text-xs text-[var(--color-success-text)] dark:text-[var(--color-success-text)] bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/25 px-2 py-0.5 rounded-[var(--radius-pill)]">已完成</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={(e) => { e.stopPropagation(); onRun() }} disabled={loading}>
            重新分析
          </Button>
          <ChevronDown size={14} className={`text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {expanded && (
        <div className="p-[var(--space-apple-md)] border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          {loading && !result ? (
            <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              <RefreshCw size={14} className="animate-spin" /> 正在分析...
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  )
}
