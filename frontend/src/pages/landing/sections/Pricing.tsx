/**
 * Pricing 组件 v4 — 学术定价表风格（升级 v4）
 *
 * 升级要点（v4）：
 *   - max-w-4xl → max-w-6xl，与其他 section 对齐
 *   - 免费版不可用功能标注"升级解锁"
 *   - 圆角统一 rounded-sm → rounded-md
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-10">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-3">{sectionLabel}</span>
            <h2 className="text-2xl lg:text-[1.75rem] font-bold text-slate-900 mb-2">{sectionTitle}</h2>
            <p className="text-[13px] text-slate-600 max-w-sm mx-auto">{sectionSub}</p>

            <div className="mt-5 inline-flex items-center gap-0.5 p-0.5 rounded-md" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
              {(['monthly', 'yearly'] as const).map((m) => (
                <button key={m} onClick={() => setBilling(m)} className="px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors"
                  style={billing === m ? { background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } : { background: 'transparent', color: '#94a3b8' }}
                >{m === 'monthly' ? '月付' : '年付'}</button>
              ))}
              {billing === 'yearly' && <span key={animKey} className="text-[9px] font-mono ml-1.5 px-1.5 py-0.5 rounded-md animate-in fade-in duration-200" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>省 17%</span>}
            </div>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={`lp-reveal-delay-${i + 1}`}>
              <div className={cn('h-full flex flex-col rounded-md p-5', p.popular && 'ring-1 ring-slate-900')}
                style={{ background: p.popular ? '#0f172a' : '#fafafa', border: p.popular ? '1px solid #0f172a' : '1px solid #e2e8f0' }}
              >
                {p.popular && <span className="text-[10px] font-mono text-slate-400 mb-3 block">推荐方案</span>}
                <h3 className={cn('text-base font-bold mb-0.5', p.popular ? 'text-white' : 'text-slate-900')}>{p.name}</h3>
                <p className={cn('text-[11px] mb-4', p.popular ? 'text-slate-400' : 'text-slate-500')}>{p.desc}</p>
                <div className={cn('mb-4 flex items-baseline gap-1', p.popular ? 'text-white' : 'text-slate-900')}>
                  <span key={`${p.name}-${animKey}`} className="text-2xl font-bold font-mono animate-in fade-in duration-200">
                    {p.name === '专业版' ? (billing === 'monthly' ? p.priceMonthly : p.priceYearly) : p.priceMonthly}
                  </span>
                  {p.name === '专业版' && <span className={cn('text-xs font-normal', p.popular ? 'text-slate-400' : 'text-slate-400')}>{billing === 'monthly' ? '/月' : '/年'}</span>}
                </div>
                <ul className="space-y-1.5 mb-5 flex-1">
                  {p.features.map((f) => (
                    <li key={f.text} className="flex items-start gap-2">
                      {f.included ? (
                        <Check size={12} className="mt-0.5 shrink-0" style={{ color: p.popular ? '#34d399' : '#059669' }} />
                      ) : (
                        <Lock size={10} className="mt-0.5 shrink-0" style={{ color: p.popular ? '#475569' : '#cbd5e1' }} />
                      )}
                      <span className="text-[12px] font-medium" style={{ color: f.included ? (p.popular ? '#f8fafc' : '#475569') : (p.popular ? '#475569' : '#cbd5e1'), opacity: f.included ? 1 : 0.55 }}>
                        {f.text}
                        {!f.included && p.name !== '企业版' && (
                          <span className="ml-1.5 text-[10px] font-mono" style={{ color: p.popular ? '#64748b' : '#94a3b8' }}>升级解锁</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant={p.popular ? 'default' : 'outline'}
                      className={cn('w-full h-9 text-[12px] font-medium rounded-md')}
                      style={!p.popular ? { borderColor: '#e2e8f0', color: '#475569' } : undefined}
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
                        <li key={f.text} className="flex items-center gap-2 text-[11px] text-slate-600">
                          <Check size={11} style={{ color: '#059669' }} /> {f.text}
                        </li>
                      ))}
                    </ul>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">取消</Button>
                      </DialogClose>
                      <Link to="/login" className="w-full sm:w-auto"><Button className="w-full" style={{ background: '#0f172a' }}>{p.cta}</Button></Link>
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
