/**
 * Pricing 组件 v5 — 学术定价表风格（升级 v5：差异化 CTA + 联系销售弹窗）
 *
 * 升级要点（v5）：
 *   - 科研版 "免费注册" → 直接跳转 /login?redirect=/dashboard
 *   - 专业版 "开始专业版" → 直接跳转 /login?redirect=/pricing
 *   - 企业版 "联系销售" → 打开联系销售对话框（含表单提交）
 *   - 所有 API 调用使用共享 apiClient（10s 超时 + 友好错误消息）
 *   - 优雅降级：后端不可用时不崩溃、不白屏
 */
import { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/shadcn';
import { Reveal } from '../shared/Reveal';
import { cn } from '@/lib/utils';
import { sectionLabelKey, sectionTitleKey, sectionSubKey, plans } from '../data/pricing';
import { submitDemoBooking, friendlyError } from '../shared/apiClient';

type Billing = 'monthly' | 'yearly';

// ── 联系销售对话框 ──────────────────────────────────────────────

function ContactSalesDialog() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const isSubmittingRef = useRef(false);

  const inputBase = 'w-full h-11 px-[var(--space-apple-sm)] text-[15px] rounded-[var(--radius-Apple-sm)] border focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40';
  const inputStyle: React.CSSProperties = {
    borderColor: 'var(--border-color)',
    background: 'var(--bg-surface-container)',
    color: 'var(--text-primary)',
  };

  const handleSubmit = useCallback(async () => {
    if (isSubmittingRef.current || submitting) return;
    setSubmitError('');

    if (!name.trim() || !email.trim()) {
      setSubmitError(t('pages.landing.pricing.errNameEmail'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubmitError(t('pages.landing.pricing.errEmail'));
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      await submitDemoBooking({
        name: name.trim(),
        email: email.trim(),
        company: company.trim() || undefined,
        notes: `企业版咨询：${description.trim() || '希望了解企业版方案'}`,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(friendlyError(err, t('pages.landing.pricing.errSubmit')));
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [name, email, company, description, submitting, t]);

  const reset = () => {
    setName('');
    setEmail('');
    setCompany('');
    setDescription('');
    setSubmitted(false);
    setSubmitError('');
  };

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full min-h-[44px] lp-label rounded-[var(--radius-Apple-sm)] border-border text-text-muted"
          >
            {t('pages.landing.pricing.contactSales')}
          </Button>
        </DialogTrigger>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t('pages.landing.pricing.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('pages.landing.pricing.dialogDesc')}</DialogDescription>
          </DialogHeader>
          {submitted ? (
            <div className="flex items-start gap-[var(--space-apple-sm)] py-4">
              <CheckCircle size={22} className="shrink-0 mt-0.5 text-primary-main" />
              <div>
                <p className="text-[15px] font-semibold text-neutral-900">{t('pages.landing.pricing.successTitle')}</p>
                <p className="text-[12px] mt-1 text-text-muted">
                  {t('pages.landing.pricing.successBody')}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-[var(--space-apple-sm)]">
              <div>
                <label className="lp-label mb-1 block">{t('pages.landing.pricing.labelName')} <span className="text-danger-500">*</span></label>
                <input
                  className={inputBase}
                  style={inputStyle}
                  placeholder={t('pages.landing.pricing.phName')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="lp-label mb-1 block">{t('pages.landing.pricing.labelEmail')} <span className="text-danger-500">*</span></label>
                <input
                  className={inputBase}
                  style={inputStyle}
                  placeholder={t('pages.landing.pricing.phEmail')}
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="lp-label mb-1 block">{t('pages.landing.pricing.labelCompany')}</label>
                <input
                  className={inputBase}
                  style={inputStyle}
                  placeholder={t('pages.landing.pricing.phCompany')}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="lp-label mb-1 block">{t('pages.landing.pricing.labelDesc')}</label>
                <textarea
                  className="w-full min-h-[72px] px-[var(--space-apple-sm)] py-2 text-[15px] rounded-[var(--radius-Apple-sm)] border resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                  style={inputStyle}
                  placeholder={t('pages.landing.pricing.phDesc')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={submitting}
                />
              </div>
              {submitError && (
                <p className="text-[12px] text-danger-600 flex items-center gap-1" role="alert">
                  <AlertCircle size={12} className="shrink-0" />
                  {submitError}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            {submitted ? (
              <Button onClick={reset} variant="outline">
                {t('pages.landing.pricing.continueConsult')}
              </Button>
            ) : (
              <>
                <DialogClose asChild>
                  <Button variant="outline">{t('pages.landing.pricing.cancel')}</Button>
                </DialogClose>
                <Button
                  onClick={handleSubmit}
                  loading={submitting}
                  disabled={submitting}
                  className="w-full sm:w-auto bg-neutral-900"
                >
                  {submitting ? t('pages.landing.pricing.submitting') : t('pages.landing.pricing.submit')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── 主组件 ──────────────────────────────────────────────────────

export default function Pricing() {
  const { t } = useTranslation();
  const [billing, setBilling] = useState<Billing>('monthly');
  const [animKey, _setAnimKey] = useState(0);

  /**
   * 根据方案名称决定 CTA 行为：
   *   - 科研版 → /login?redirect=/dashboard
   *   - 专业版 → /login?redirect=/pricing
   *   - 企业版 → 打开联系销售对话框
   */
  const renderCTA = (p: (typeof plans)[0]) => {
    if (p.name === 'enterprise') {
      return <ContactSalesDialog />;
    }

    const target = p.name === 'free'
      ? '/login?redirect=/dashboard'
      : '/login?redirect=/pricing';

    return (
      <Link to={target}>
        <Button
          variant={p.popular ? 'default' : 'outline'}
          className={cn(
            "w-full min-h-[44px] lp-label rounded-[var(--radius-Apple-sm)]",
            p.popular ? "bg-card text-neutral-900 border-0" : "border-border text-text-muted"
          )}
        >
          {t(p.ctaKey)}
        </Button>
      </Link>
    );
  };

  return (
    <section id="pricing" aria-label={t('pages.landing.pricing.ariaLabel')} className="py-16 lg:py-20 lp-grid-bg bg-card">
      <div className="max-w-6xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-10">
            <span className="lp-section-tag block mb-[var(--space-apple-sm)]">{t(sectionLabelKey)}</span>
            <h2 className="lp-h2 mb-2">{t(sectionTitleKey)}</h2>
            <p className="lp-body-sm max-w-sm mx-auto text-[var(--text-secondary)]">{t(sectionSubKey)}</p>

            <div className="mt-5 inline-flex items-center gap-0.5 p-0.5 rounded-[var(--radius-Apple-sm)] bg-neutral-subtle border border-border">
              {(['monthly', 'yearly'] as const).map((m) => (
                <button key={m} onClick={() => setBilling(m)}
                  className={cn(
                    "lp-label rounded-[var(--radius-Apple-sm)] transition-colors px-[var(--space-apple-md)] py-2 min-h-[44px] flex items-center",
                    billing === m ? "bg-card text-neutral-900 border border-border" : "bg-transparent text-[var(--text-secondary)]"
                  )}
                  style={billing === m ? { boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' } : undefined}
                >{m === 'monthly' ? t('pages.landing.pricing.monthly') : t('pages.landing.pricing.yearly')}</button>
              ))}
              {billing === 'yearly' && <span key={animKey} className="text-[12px] font-mono ml-1.5 px-1.5 py-0.5 rounded-[var(--radius-Apple-sm)] animate-in fade-in duration-200" style={{ background: 'var(--color-success-50, #ecfdf5)', color: 'var(--color-primary-700, #047857)', border: '1px solid var(--color-success-200, #a7f3d0)' }}>{t('pages.landing.pricing.save17')}</span>}
            </div>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={`lp-reveal-delay-${i + 1}`}>
              <div className={cn(
                  'lp-card-hover h-full flex flex-col rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-lg)] border',
                  p.popular ? 'bg-neutral-900 ring-1 ring-[var(--color-primary)]/40' : 'bg-[var(--bg-surface-container)] border-border'
                )}
                style={p.popular ? { borderColor: 'color-mix(in srgb, var(--color-primary-500, #10b981) 35%, transparent)' } : undefined}
              >
                {p.popular && <span className="lp-popular-badge mb-[var(--space-apple-sm)] block">{t('pages.landing.pricing.recommended')}</span>}
                <h3 className={cn('text-base font-semibold mb-0.5', p.popular ? 'text-white' : 'text-neutral-900')}>{t(p.nameKey)}</h3>
                <p className={cn('text-[14px] leading-[1.6] mb-[var(--space-apple-md)]', p.popular ? 'text-white' : 'text-text-muted')}>{t(p.descKey)}</p>
                <div className={cn('mb-[var(--space-apple-md)] flex items-baseline gap-1', p.popular ? 'text-white' : 'text-[var(--text-primary)]')}>
                  <span key={`${p.name}-${animKey}`} className="text-2xl font-bold font-mono animate-in fade-in duration-200">
                    {p.name === 'pro' ? (billing === 'monthly' ? p.priceMonthly : p.priceYearly) : p.priceMonthly}
                  </span>
                  {p.name === 'pro' && <span className="text-xs font-normal" style={{ color: p.popular ? 'var(--color-neutral-300, #cbd5e1)' : 'var(--text-secondary)' }}>{billing === 'monthly' ? t('pages.landing.pricing.perMonth') : t('pages.landing.pricing.perYear')}</span>}
                </div>
                <ul className="space-y-1.5 mb-5 flex-1">
                  {p.features.map((f) => (
                    <li key={f.textKey} className="flex items-start gap-2">
                      {f.included ? (
                        <Check size={14} className="mt-0.5 shrink-0" style={{ color: p.popular ? 'var(--color-success-500, #34d399)' : 'var(--color-primary-700, #047857)' }} />
                      ) : (
                        <Lock size={12} className="mt-0.5 shrink-0" style={{ color: p.popular ? 'var(--color-neutral-400, #94a3b8)' : 'var(--color-neutral-500, #64748b)' }} />
                      )}
                      <span className="lp-label" style={{ color: f.included ? (p.popular ? 'var(--color-neutral-50, #f8fafc)' : 'var(--text-secondary)') : (p.popular ? 'var(--color-neutral-300, #cbd5e1)' : 'var(--text-secondary)') }}>
                        {t(f.textKey)}
                        {!f.included && p.name !== 'enterprise' && (
                          <span className="ml-1.5 lp-mono" style={{ color: p.popular ? 'var(--color-neutral-400, #94a3b8)' : 'var(--text-secondary)' }}>{t('pages.landing.pricing.upgradeUnlock')}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {renderCTA(p)}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
