/**
 * ComplianceTab — 合规检测 Tab
 *
 * 从 Hero.tsx 拆出（v11 性能优化）：
 *   - COMPLIANCE_RULES 规则表
 *   - 检测流程（模拟进度 + 结果汇总）
 *
 * 该组件仅依赖 React + lucide-react 图标。
 */
import { useState } from 'react';
import { ShieldCheck, Loader2, CheckCircle, AlertTriangle, XCircle, FileText } from 'lucide-react';

// ── 类型定义 ────────────────────────────────────────────────────
interface ComplianceResult {
  status: 'idle' | 'scanning' | 'done';
  score: number;
  hazards: { label: string; severity: 'safe' | 'warn' | 'error'; detail: string }[];
  analysis: { label: string; result: 'pass' | 'warn'; detail: string }[];
}

// ── 合规规则表 ──────────────────────────────────────────────────
const COMPLIANCE_RULES: Record<string, { hazards?: { label: string; severity: 'safe' | 'warn' | 'error'; detail: string }[]; compat?: { label: string; result: 'pass' | 'warn'; detail: string }[] }> = {
  '黄芪': { hazards: [{ label: '安全性', severity: 'safe', detail: '无已知配伍禁忌，孕期慎用' }], compat: [{ label: '黄芪+枸杞', result: 'pass', detail: '经典补益组合，协同增效' }, { label: '黄芪+甘草', result: 'pass', detail: '补气调和，剂量合理' }] },
  '枸杞': { hazards: [{ label: '安全性', severity: 'safe', detail: '药食同源，常规用量安全' }], compat: [{ label: '枸杞+菊花', result: 'pass', detail: '清肝明目经典配伍' }] },
  '甘草': { hazards: [{ label: '甘草酸累积', severity: 'warn', detail: '长期大剂量（>6g/日）可能引起血压升高' }], compat: [{ label: '甘草+黄芪', result: 'pass', detail: '调和诸药，剂量在安全范围' }, { label: '甘草+海藻', result: 'warn', detail: '十八反禁忌，避免同用' }] },
  '当归': { hazards: [{ label: '活血作用', severity: 'warn', detail: '经期及孕妇慎用，可能增加出血风险' }], compat: [{ label: '当归+黄芪', result: 'pass', detail: '气血双补经典配伍' }] },
  '金银花': { hazards: [{ label: '寒凉属性', severity: 'safe', detail: '脾胃虚寒者慎用' }], compat: [{ label: '金银花+连翘', result: 'pass', detail: '银翘散核心药对，协同清热' }] },
  '连翘': { hazards: [{ label: '苦寒', severity: 'safe', detail: '无特殊禁忌' }], compat: [{ label: '连翘+金银花', result: 'pass', detail: '清热解毒经典组合' }] },
};

export default function ComplianceTab() {
  const [ingredients, setIngredients] = useState('黄芪\n枸杞\n甘草\n当归');
  const [result, setResult] = useState<ComplianceResult>({ status: 'idle', score: 0, hazards: [], analysis: [] });
  const [progress, setProgress] = useState(0);

  const runCheck = async () => {
    const lines = ingredients.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return;

    setResult({ status: 'scanning', score: 0, hazards: [], analysis: [] });
    setProgress(0);

    // 模拟检测步骤
    const steps = [
      { label: '扫描原料数据库', pct: 25, delay: 400 },
      { label: '检查配伍禁忌', pct: 50, delay: 600 },
      { label: '验证法规合规', pct: 75, delay: 500 },
      { label: '生成检测报告', pct: 100, delay: 300 },
    ];

    for (const step of steps) {
      await new Promise(r => setTimeout(r, step.delay));
      setProgress(step.pct);
    }

    const allHazards: ComplianceResult['hazards'] = [];
    const allAnalysis: ComplianceResult['analysis'] = [];
    let score = 100;

    lines.forEach(ing => {
      const rule = COMPLIANCE_RULES[ing.trim()];
      if (rule?.hazards) rule.hazards.forEach(h => {
        allHazards.push(h);
        if (h.severity === 'warn') score -= 5;
        if (h.severity === 'error') score -= 15;
      });
      if (rule?.compat) rule.compat.forEach(a => allAnalysis.push(a));
    });

    // 自动配对未匹配的组合
    if (lines.length >= 2) {
      allAnalysis.push({ label: '整体配伍评估', result: score >= 90 ? 'pass' : 'warn', detail: score >= 90 ? '配方整体安全，无严重禁忌' : '存在部分风险项，建议调整剂量' });
    }

    setResult({ status: 'done', score: Math.max(0, score), hazards: allHazards, analysis: allAnalysis });
  };

  return (
    <div className="flex flex-col h-full">
      {/* 输入区 */}
      <div className="px-[var(--space-apple-sm)] py-2 border-b" style={{ borderColor: 'var(--color-neutral-200, #e2e8f0)', background: 'var(--bg-surface-container)' }}>
        <div className="text-[12px] font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1.5 flex items-center gap-1">
          <ShieldCheck size={11} style={{ color: 'var(--color-neutral-500, #64748b)' }} />
          输入配方成分（每行一个）
        </div>
        <textarea
          value={ingredients}
          onChange={e => { setIngredients(e.target.value); setResult({ status: 'idle', score: 0, hazards: [], analysis: [] }); }}
          rows={4}
          className="w-full text-[12px] text-[var(--text-primary)] resize-none outline-none leading-[1.7] bg-transparent"
          placeholder="黄芪&#10;枸杞&#10;甘草"
        />
        <button onClick={runCheck} disabled={result.status === 'scanning'}
          className="mt-1.5 w-full min-h-[36px] rounded-[var(--radius-Apple-sm)] lp-tiny font-medium flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          style={{ background: result.status === 'scanning' ? 'var(--color-neutral-400, #94a3b8)' : '#047857', color: '#fff' }}>
          {result.status === 'scanning'
            ? <><Loader2 size={11} className="animate-spin" />检测中…</>
            : <><ShieldCheck size={11} />开始合规检测</>
          }
        </button>
      </div>

      {/* 进度条 */}
      {result.status === 'scanning' && (
        <div className="h-0.5 w-full" style={{ background: 'var(--color-neutral-100, #f1f5f9)' }}>
          <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--color-primary-600, #059669), var(--color-success-500, #34d399))' }} />
        </div>
      )}

      {/* 检测结果 */}
      <div className="flex-1 overflow-y-auto p-[var(--space-apple-sm)]">
        {result.status === 'idle' && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <ShieldCheck size={24} style={{ color: 'var(--color-neutral-300, #cbd5e1)', marginBottom: 8 }} />
            <p className="text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">输入成分后点击检测</p>
            <p className="text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">覆盖配伍禁忌 · 过敏原风险 · 法规合规</p>
          </div>
        )}

        {result.status === 'scanning' && (
          <div className="h-full flex flex-col items-center justify-center">
            <Loader2 size={20} className="animate-spin mb-2" style={{ color: 'var(--color-primary-700, #047857)' }} />
            <p className="text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">正在扫描 {progress}%</p>
          </div>
        )}

        {result.status === 'done' && (
          <div className="space-y-2">
            {/* 总评分 */}
            <div className="rounded-[var(--radius-Apple-sm)] p-2.5 flex items-center gap-[var(--space-apple-sm)]" style={{ background: result.score >= 90 ? 'var(--color-success-50, #ecfdf5)' : result.score >= 70 ? 'var(--color-warning-50, #fffbeb)' : 'var(--color-danger-50, #fef2f2)', border: `1px solid ${result.score >= 90 ? 'var(--color-success-200, #a7f3d0)' : result.score >= 70 ? 'var(--color-warning-200, #fde68a)' : 'var(--color-danger-200, #fecaca)'}` }}>
              <div className="text-center">
                <div className="text-xl font-bold font-mono leading-none" style={{ color: result.score >= 90 ? 'var(--color-primary-700, #047857)' : result.score >= 70 ? 'var(--color-warning-700, #b45309)' : 'var(--color-danger-700, #dc2626)' }}>{result.score}</div>
                <div className="text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5">安全评分</div>
              </div>
              <div className="flex-1">
                <div className="lp-tiny font-semibold" style={{ color: result.score >= 90 ? 'var(--color-primary-800, #065f46)' : result.score >= 70 ? 'var(--color-warning-800, #92400e)' : 'var(--color-danger-800, #991b1b)' }}>
                  {result.score >= 90 ? '✅ 配方整体安全' : result.score >= 70 ? '⚠️ 存在部分风险项' : '❌ 存在严重禁忌'}
                </div>
                <div className="text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5">
                  {result.hazards.filter(h => h.severity === 'warn').length} 个警告 · {result.analysis.filter(a => a.result === 'pass').length} 项通过
                </div>
              </div>
            </div>

            {/* 风险项 */}
            {result.hazards.length > 0 && (
              <div>
                <div className="text-[12px] font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1 px-1">风险检测</div>
                {result.hazards.map((h, i) => (
                  <div key={i} className="flex items-start gap-1.5 px-1.5 py-1.5 rounded-[var(--radius-Apple-sm)] mb-1" style={{ background: h.severity === 'safe' ? 'var(--color-neutral-50, #f8fafc)' : h.severity === 'warn' ? 'var(--color-warning-50, #fffbeb)' : 'var(--color-danger-50, #fef2f2)', border: `1px solid ${h.severity === 'safe' ? 'var(--color-neutral-200, #e2e8f0)' : h.severity === 'warn' ? 'var(--color-warning-200, #fde68a)' : 'var(--color-danger-200, #fecaca)'}` }}>
                    {h.severity === 'safe' ? <CheckCircle size={11} style={{ color: 'var(--color-primary-700, #047857)', flexShrink: 0, marginTop: 1 }} />
                     : h.severity === 'warn' ? <AlertTriangle size={11} style={{ color: 'var(--color-warning-700, #b45309)', flexShrink: 0, marginTop: 1 }} />
                     : <XCircle size={11} style={{ color: 'var(--color-danger-700, #dc2626)', flexShrink: 0, marginTop: 1 }} />}
                    <div>
                      <div className="lp-tiny font-medium text-[var(--text-primary)]">{h.label}</div>
                      <div className="lp-micro text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{h.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 配伍分析 */}
            {result.analysis.length > 0 && (
              <div>
                <div className="text-[12px] font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1 px-1">配伍分析</div>
                {result.analysis.map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-1.5 py-1 rounded-[var(--radius-Apple-sm)] mb-0.5" style={{ background: a.result === 'pass' ? 'var(--color-neutral-50, #f8fafc)' : 'var(--color-warning-50, #fffbeb)', border: `1px solid ${a.result === 'pass' ? 'var(--color-neutral-200, #e2e8f0)' : 'var(--color-warning-200, #fde68a)'}` }}>
                    {a.result === 'pass'
                      ? <CheckCircle size={11} style={{ color: 'var(--color-primary-700, #047857)' }} />
                      : <AlertTriangle size={11} style={{ color: 'var(--color-warning-700, #b45309)' }} />}
                    <span className="lp-tiny font-medium text-[var(--text-primary)]">{a.label}</span>
                    <span className="lp-micro text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-auto">{a.detail}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-1">
              <button onClick={runCheck} className="flex-1 h-7 rounded-[var(--radius-Apple-sm)] lp-tiny font-medium flex items-center justify-center gap-1" style={{ background: 'var(--color-neutral-50, #f8fafc)', border: '1px solid var(--color-neutral-200, #e2e8f0)', color: 'var(--color-neutral-600, #475569)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                重新检测
              </button>
              <button className="flex-1 min-h-[36px] rounded-[var(--radius-Apple-sm)] lp-tiny font-medium flex items-center justify-center gap-1" style={{ background: '#047857', color: '#fff' }}>
                <FileText size={11} />导出报告
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
