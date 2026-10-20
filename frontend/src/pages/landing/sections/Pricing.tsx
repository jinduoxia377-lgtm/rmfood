/**
 * Pricing 组件 v4 — 学术定价表风格（升级 v4）
 *
 * 升级要点（v4）：
 *   - max-w-4xl → max-w-6xl，与其他 section 对齐
 *   - 免费版不可用功能标注"升级解锁"
 *   - 圆角统一 rounded-sm → rounded-[var(--radius-Apple-sm)]
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Lock } from 'lucide-react';
import { Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/shadcn';
import { Reveal } from '../shared/Reveal';
import { cn } from '@/lib/utils';
import { sectionLabel, sectionTitle, sectionSub, plans } from '../data/pricing';

type Billing = 'monthly' | 'yearly';

export default function Pricing() {
  const [billing, setBilling] = useState<Billing>('monthly');
  const [animKey, setAnimKey] = useState(0);

  const handleBillingChange = (m: Billing) => {
    if (m !== billing) {
      setAnimKey(k => k + 1);
      setBilling(m);
    }
  };

  return (
    <section id="pricing" className="py-16 lg:py-20 lp-grid-bg" style={{ background: '#fff' }}>
      <div className="max-w-6xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-10">
            <span className="lp-section-tag block mb-[var(--space-apple-sm)]">{sectionLabel}</span>
            <h2 className="lp-h2 mb-2">{sectionTitle}</h2>
            <p className="lp-body-sm max-w-sm mx-auto text-[var(--text-secondary)]" style={{ color: 'var(--color-neutral-600, #475569)' }}>{sectionSub}</p>

            <div className="mt-5 inline-flex items-center gap-0.5 p-0.5 rounded-[var(--radius-Apple-sm)]" style={{ background: 'var(--color-neutral-100, #f1f5f9)', border: '1px solid var(--color-neutral-200, #e2e8f0)' }}>
              {(['monthly', 'yearly'] as const).map((m) => (
                <button key={m} onClick={() => setBilling(m)}
                  className="lp-label rounded-[var(--radius-Apple-sm)] transition-colors px-[var(--space-apple-md)] py-2 min-h-[44px] flex items-center"
                  style={billing === m ? { background: '#fff', color: 'var(--color-neutral-900, #0f172a)', border: '1px solid var(--color-neutral-200, #e2e8f0)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' } : { background: 'transparent', color: 'var(--color-neutral-600, #475569)' }}
                >{m === 'monthly' ? '月付' : '年付'}</button>
              ))}
              {billing === 'yearly' && <span key={animKey} className="text-[12px] font-mono ml-1.5 px-1.5 py-0.5 rounded-[var(--radius-Apple-sm)] animate-in fade-in duration-200" style={{ background: 'var(--color-success-50, #ecfdf5)', color: 'var(--color-primary-700, #047857)', border: '1px solid var(--color-success-200, #a7f3d0)' }}>省 17%</span>}
            </div>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={`lp-reveal-delay-${i + 1}`}>
              <div className={cn('h-full flex flex-col rounded-[var(--radius-Apple-sm)] p-5', p.popular && 'ring-1 ring-[var(--color-primary)]/40')}
                style={{ background: p.popular ? 'var(--color-neutral-900, #0f172a)' : 'var(--color-neutral-50, #fafafa)', border: p.popular ? '1px solid color-mix(in srgb, var(--color-primary-500, #10b981) 35%, transparent)' : '1px solid var(--color-neutral-200, #e2e8f0)' }}
              >
                {p.popular && <span className="lp-popular-badge mb-[var(--space-apple-sm)] block">推荐方案</span>}
                <h3 className={cn('text-base font-bold mb-0.5', p.popular ? 'text-white' : 'text-neutral-900')}>{p.name}</h3>
                <p className="lp-caption mb-[var(--space-apple-md)]" style={{ color: p.popular ? '#ffffff' : 'var(--color-neutral-600, #475569)' }}>{p.desc}</p>
                <div className={cn('mb-[var(--space-apple-md)] flex items-baseline gap-1', p.popular ? 'text-white' : 'text-neutral-900')}>
                  <span key={`${p.name}-${animKey}`} className="text-2xl font-bold font-mono animate-in fade-in duration-200">
                    {p.name === '专业版' ? (billing === 'monthly' ? p.priceMonthly : p.priceYearly) : p.priceMonthly}
                  </span>
                  {p.name === '专业版' && <span className="text-xs font-normal" style={{ color: p.popular ? 'var(--color-neutral-300, #cbd5e1)' : 'var(--color-neutral-500, #64748b)' }}>{billing === 'monthly' ? '/月' : '/年'}</span>}
                </div>
                <ul className="space-y-1.5 mb-5 flex-1">
                  {p.features.map((f) => (
                    <li key={f.text} className="flex items-start gap-2">
                      {f.included ? (
                        <Check size={14} className="mt-0.5 shrink-0" style={{ color: p.popular ? 'var(--color-success-500, #34d399)' : 'var(--color-primary-700, #047857)' }} />
                      ) : (
                        <Lock size={12} className="mt-0.5 shrink-0" style={{ color: p.popular ? 'var(--color-neutral-400, #94a3b8)' : 'var(--color-neutral-500, #64748b)' }} />
                      )}
                      <span className="lp-label" style={{ color: f.included ? (p.popular ? 'var(--color-neutral-50, #f8fafc)' : 'var(--color-neutral-600, #475569)') : (p.popular ? 'var(--color-neutral-300, #cbd5e1)' : 'var(--color-neutral-600, #475569)') }}>
                        {f.text}
                        {!f.included && p.name !== '企业版' && (
                          <span className="ml-1.5 lp-mono" style={{ color: p.popular ? 'var(--color-neutral-400, #94a3b8)' : 'var(--color-neutral-500, #64748b)' }}>升级解锁</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant={p.popular ? 'default' : 'outline'}
                      className={cn('w-full min-h-[44px] lp-label rounded-[var(--radius-Apple-sm)]')}
                      style={p.popular
                        ? { background: '#fff', color: 'var(--color-neutral-900, #0f172a)', border: 'none' }
                        : { borderColor: 'var(--color-neutral-200, #e2e8f0)', color: 'var(--color-neutral-600, #475569)' }}
                    >
                      {p.cta}
                    </Button>
                  </DialogTrigger>
                  <DialogContent size="sm">
                    <DialogHeader>
                      <DialogTitle>{p.name}</DialogTitle>
                      <DialogDescription>包含以下所有功能，无隐藏限制。</DialogDescription>
                    </DialogHeader>
                    <ul className="space-y-1.5">
                      {p.features.filter((f) => f.included).map((f) => (
                        <li key={f.text} className="flex items-center gap-2 lp-caption text-[var(--text-secondary)]">
                          <Check size={12} style={{ color: 'var(--color-primary-700, #047857)' }} /> {f.text}
                        </li>
                      ))}
                    </ul>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">取消</Button>
                      </DialogClose>
                      <Link to="/login" className="w-full sm:w-auto"><Button className="w-full" style={{ background: 'var(--color-neutral-900, #0f172a)' }}>{p.cta}</Button></Link>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

