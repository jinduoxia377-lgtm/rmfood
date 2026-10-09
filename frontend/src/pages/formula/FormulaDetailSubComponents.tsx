/**
 * FormulaDetailPage sub-components extracted
 */
import React, { useState, useCallback, useEffect } from 'react'
import { CheckCircle2, AlertTriangle, Lightbulb, RefreshCw, Sparkles, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui'
import { useComplianceCheck } from '@/api/compliance'
import { explainabilityApi } from '@/api/explainability'
import { ExplainabilityReport } from '@/components/report/ExplainabilityReport'

  export const renderSynergyResult = (r: any) => (
    <div className="space-y-4">
      {r.overall_si !== null && r.overall_si !== undefined && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
            <p className="text-xs text-violet-600 dark:text-violet-400 mb-1">综合协同指数 SI</p>
            <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">{r.overall_si.toFixed(2)}</p>
          </div>
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">成分对数量</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{r.pairs?.length ?? 0}</p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">成分总数</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{r.ingredient_count ?? 0}</p>
          </div>
        </div>
      )}
      {r.pairs?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">成分对分析详情</p>
          {r.pairs.map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
              <span className="text-sm font-medium">{p.pair}</span>
              <div className="flex items-center gap-3">
                {p.dominant_mechanism && (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 max-w-[120px] truncate" title={p.dominant_mechanism}>
                    {p.dominant_mechanism.replace(/_/g, ' ')}
                  </span>
                )}
                {p.overall_si !== undefined && (
                  <span className={`text-sm font-semibold ${
                    p.overall_si > 0.7 ? 'text-emerald-600' : p.overall_si > 0.4 ? 'text-amber-600' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">预测货架期</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{r.predicted_shelf_life_months?.toFixed(0) ?? '—'} 月</p>
        </div>
        <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
          <p className="text-xs text-violet-600 dark:text-violet-400 mb-1">稳定性评分</p>
          <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">{r.stability_score?.toFixed(1) ?? '—'}/100</p>
        </div>
      </div>
      {r.risk_factors?.length > 0 && (
        <div>
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">风险因素 ({r.risk_factors.length})</p>
          {r.risk_factors.map((f: any, i: number) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-900/20 mb-1">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">{f.description || f.factor}</span>
            </div>
          ))}
        </div>
      )}
      {r.storage_recommendations?.length > 0 && (
        <div>
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">储存建议</p>
          {r.storage_recommendations.map((s: string, i: number) => (
            <p key={i} className="text-sm text-neutral-600 dark:text-neutral-400 ml-4">• {s}</p>
          ))}
        </div>
      )}
    </div>
  );

  export const renderTasteResult = (r: any) => {
    const tp = r.taste_profile || {};
    const max = Math.max(tp.bitter, tp.sweet, tp.umami, tp.astringent, tp.sour, 0.01);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-2">
          {(['bitter', 'sweet', 'umami', 'astringent', 'sour'] as const).map((key) => {
            const labels: Record<string, string> = { bitter: '苦', sweet: '甜', umami: '鲜', astringent: '涩', sour: '酸' };
            const colors: Record<string, string> = { bitter: 'bg-rose-400', sweet: 'bg-pink-400', umami: 'bg-amber-400', astringent: 'bg-purple-400', sour: 'bg-lime-400' };
            const val = tp[key] ?? 0;
            return (
              <div key={key} className="text-center">
                <div className={`h-16 rounded-lg ${colors[key]} opacity-70`} style={{ height: `${Math.max(8, val * 64)}px`, marginTop: 'auto' }} />
                <p className="text-xs font-medium mt-1 text-neutral-700 dark:text-neutral-300">{labels[key]}</p>
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{val.toFixed(2)}</p>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <p className="text-xs text-emerald-600 dark:text-emerald-400">风味平衡度</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{r.balance_score?.toFixed(2) ?? '—'}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <p className="text-xs text-blue-600 dark:text-blue-400">接受度</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{r.acceptability?.toFixed(2) ?? '—'}</p>
          </div>
        </div>
        {r.optimization_suggestions?.length > 0 && (
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">优化建议</p>
            {r.optimization_suggestions.slice(0, 3).map((s: any, i: number) => (
              <p key={i} className="text-sm text-neutral-600 dark:text-neutral-400">• {s.description || s.action}</p>
            ))}
          </div>
        )}
      </div>
    );
  };

  export const renderEffectResult = (r: any) => (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Tmax (h)', value: r.peak_time?.toFixed(1) ?? '—', color: 'violet' },
          { label: 'Cmax (μg/mL)', value: r.peak_concentration?.toFixed(2) ?? '—', color: 'blue' },
          { label: 'Emax', value: r.max_effect?.toFixed(3) ?? '—', color: 'emerald' },
          { label: '效应持续时间 (h)', value: r.effect_duration?.toFixed(1) ?? '—', color: 'amber' },
        ].map((m) => (
          <div key={m.label} className={`p-3 rounded-lg bg-${m.color}-50 dark:bg-${m.color}-900/20 border border-${m.color}-200 dark:border-${m.color}-800`}>
            <p className={`text-xs text-${m.color}-600 dark:text-${m.color}-400 mb-1`}>{m.label}</p>
            <p className={`text-lg font-bold text-${m.color}-700 dark:text-${m.color}-300`}>{m.value}</p>
          </div>
        ))}
      </div>
      {r.optimal_window?.length === 2 && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">最佳服用时间窗口</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {r.optimal_window[0]?.toFixed(1)} ~ {r.optimal_window[1]?.toFixed(1)} 小时
          </p>
        </div>
      )}
      <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">AUC (曲线下面积): <span className="font-semibold text-neutral-800 dark:text-neutral-200">{r.auc?.toFixed(2) ?? '—'}</span></p>
      </div>
    </div>
  );

  export const renderCompatResult = (r: any) => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">兼容分数</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{r.overall_score?.toFixed(0) ?? '—'}/100</p>
        </div>
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">通过检测</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{r.passed_checks ?? 0}/{r.total_checks ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800">
          <p className="text-xs text-rose-600 dark:text-rose-400 mb-1">问题数</p>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">{r.error_count ?? 0} 错误 / {r.warning_count ?? 0} 警告</p>
        </div>
      </div>
      {r.issues?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">检测问题 ({r.issues.length})</p>
          {r.issues.slice(0, 5).map((issue: any, i: number) => (
            <div key={i} className={`p-3 rounded-lg border ${
              issue.level === 'ERROR' ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' :
              issue.level === 'WARNING' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
              'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm font-medium ${
                  issue.level === 'ERROR' ? 'text-rose-700 dark:text-rose-300' :
                  issue.level === 'WARNING' ? 'text-amber-700 dark:text-amber-300' :
                  'text-blue-700 dark:text-blue-300'
                }`}>{issue.category || issue.level}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  issue.level === 'ERROR' ? 'bg-rose-200 dark:bg-rose-800 text-rose-800 dark:text-rose-200' :
                  issue.level === 'WARNING' ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200' :
                  'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                }`}>{issue.level}</span>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{issue.description}</p>
              {issue.suggestion && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">💡 {issue.suggestion}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  export const renderSafetyResult = (r: any) => (
    <div className="space-y-4">
      <div className={`p-4 rounded-xl border ${
        r.is_safe
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
          : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800'
      }`}>
        <div className="flex items-center gap-3">
          {r.is_safe
            ? <CheckCircle2 size={24} className="text-emerald-500" />
            : <AlertTriangle size={24} className="text-rose-500" />
          }
          <div>
            <p className={`text-lg font-bold ${r.is_safe ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
              {r.is_safe ? '配方安全' : '存在安全风险'}
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              风险评分: {r.overall_risk_score?.toFixed(1) ?? '—'} / 100
              {r.blocked_by_critical && <span className="ml-2 text-rose-600 font-medium">⚠️ 已被关键问题阻断</span>}
            </p>
          </div>
        </div>
      </div>
      {r.alerts?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">安全告警 ({r.alerts.length})</p>
          {r.alerts.map((a: any, i: number) => (
            <div key={i} className={`p-3 rounded-lg border ${
              a.level === 'CRITICAL' ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' :
              a.level === 'WARNING' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
              'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">{a.ingredient || '未知成分'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  a.level === 'CRITICAL' ? 'bg-rose-200 dark:bg-rose-800 text-rose-800 dark:text-rose-200' :
                  a.level === 'WARNING' ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200' :
                  'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                }`}>{a.level}</span>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{a.message}</p>
              {a.recommendation && <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">💡 {a.recommendation}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );


export function ComplianceCheckSection({
  ingredients,
  targetEffects,
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
        <span className="inline-block w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
        检查合规性...
      </div>
    );
  }

  if (!result) return null;

  const cfg =
    result.status === 'compliant'
      ? 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      : result.status === 'warning'
      ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      : 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';

  return (
    <div className={`rounded-xl border p-4 ${cfg}`}>
      <div className="flex items-center gap-3">
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">
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
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <ExplainabilityReport result={result} />
      )}

      {!result && !loading && (
        <div className="p-6 rounded-xl bg-gray-50 dark:bg-gray-800 text-center text-sm text-gray-500">
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
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-violet-500">{icon}</span>
          <span className="font-medium text-neutral-900 dark:text-white text-sm">{title}</span>
          {result && <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">已完成</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={(e) => { e.stopPropagation(); onRun() }} disabled={loading}>
            重新分析
          </Button>
          <ChevronDown size={14} className={`text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {expanded && (
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
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
