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
import { Link, useNavigate } from 'react-router-dom';
import { Check, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/shadcn';
import { Reveal } from '../shared/Reveal';
import { cn } from '@/lib/utils';
import { sectionLabel, sectionTitle, sectionSub, plans } from '../data/pricing';
import { submitDemoBooking, friendlyError } from '../shared/apiClient';

type Billing = 'monthly' | 'yearly';

// ── 联系销售对话框 ──────────────────────────────────────────────

function ContactSalesDialog() {
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
    background: 'var(--bg-secondary)',
    color: 'var(--color-neutral-900, #0f172a)',
  };

  const handleSubmit = useCallback(async () => {
    if (isSubmittingRef.current || submitting) return;
    setSubmitError('');

    if (!name.trim() || !email.trim()) {
      setSubmitError('请填写姓名和邮箱');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubmitError('邮箱格式不正确');
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
      setSubmitError(friendlyError(err, '提交失败，请稍后重试'));
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [name, email, company, description, submitting]);

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
            联系销售
          </Button>
        </DialogTrigger>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>联系销售</DialogTitle>
            <DialogDescription>留下您的信息，我们的销售团队将在 1 个工作日内与您联系。</DialogDescription>
          </DialogHeader>
          {submitted ? (
            <div className="flex items-start gap-[var(--space-apple-sm)] py-4">
              <CheckCircle size={22} className="shrink-0 mt-0.5 text-primary-main" />
              <div>
                <p className="text-[15px] font-semibold text-neutral-900">提交成功</p>
                <p className="text-[12px] mt-1 text-text-muted">
                  已收到您的咨询信息，销售团队将在 1 个工作日内与您联系。
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-[var(--space-apple-sm)]">
              <div>
                <label className="lp-label mb-1 block">姓名 <span className="text-danger-500">*</span></label>
                <input
                  className={inputBase}
                  style={inputStyle}
                  placeholder="请输入您的姓名"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="lp-label mb-1 block">邮箱 <span className="text-danger-500">*</span></label>
                <input
                  className={inputBase}
                  style={inputStyle}
                  placeholder="company@example.com"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="lp-label mb-1 block">公司</label>
                <input
                  className={inputBase}
                  style={inputStyle}
                  placeholder="请输入公司名称"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="lp-label mb-1 block">需求描述</label>
                <textarea
                  className="w-full min-h-[72px] px-[var(--space-apple-sm)] py-2 text-[15px] rounded-[var(--radius-Apple-sm)] border resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                  style={inputStyle}
                  placeholder="请描述您的需求（团队规模、使用场景等）"
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
                继续咨询
              </Button>
            ) : (
              <>
                <DialogClose asChild>
                  <Button variant="outline">取消</Button>
                </DialogClose>
                <Button
                  onClick={handleSubmit}
                  loading={submitting}
                  disabled={submitting}
                  className="w-full sm:w-auto bg-neutral-900"
                >
                  {submitting ? '提交中…' : '提交咨询'}
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
  const [billing, setBilling] = useState<Billing>('monthly');
  const [animKey, _setAnimKey] = useState(0);
  const navigate = useNavigate();

  /**
   * 根据方案名称决定 CTA 行为：
   *   - 科研版 → /login?redirect=/dashboard
   *   - 专业版 → /login?redirect=/pricing
   *   - 企业版 → 打开联系销售对话框
   */
  const renderCTA = (p: (typeof plans)[0]) => {
    if (p.name === '企业版') {
      return <ContactSalesDialog />;
    }

    const target = p.name === '科研版'
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
          {p.cta}
        </Button>
      </Link>
    );
  };

  return (
    <section id="pricing" aria-label="定价方案" className="py-16 lg:py-20 lp-grid-bg bg-card">
      <div className="max-w-6xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-10">
            <span className="lp-section-tag block mb-[var(--space-apple-sm)]">{sectionLabel}</span>
            <h2 className="lp-h2 mb-2">{sectionTitle}</h2>
            <p className="lp-body-sm max-w-sm mx-auto text-[var(--text-secondary)]">{sectionSub}</p>

            <div className="mt-5 inline-flex items-center gap-0.5 p-0.5 rounded-[var(--radius-Apple-sm)] bg-neutral-subtle border border-border">
              {(['monthly', 'yearly'] as const).map((m) => (
                <button key={m} onClick={() => setBilling(m)}
                  className={cn(
                    "lp-label rounded-[var(--radius-Apple-sm)] transition-colors px-[var(--space-apple-md)] py-2 min-h-[44px] flex items-center",
                    billing === m ? "bg-card text-neutral-900 border border-border" : "bg-transparent text-text-muted"
                  )}
                  style={billing === m ? { boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' } : undefined}
                >{m === 'monthly' ? '月付' : '年付'}</button>
              ))}
              {billing === 'yearly' && <span key={animKey} className="text-[12px] font-mono ml-1.5 px-1.5 py-0.5 rounded-[var(--radius-Apple-sm)] animate-in fade-in duration-200" style={{ background: 'var(--color-success-50, #ecfdf5)', color: 'var(--color-primary-700, #047857)', border: '1px solid var(--color-success-200, #a7f3d0)' }}>省 17%</span>}
            </div>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={`lp-reveal-delay-${i + 1}`}>
              <div className={cn(
                  'h-full flex flex-col rounded-[var(--radius-Apple-sm)] p-5 border',
                  p.popular ? 'bg-neutral-900 ring-1 ring-[var(--color-primary)]/40' : 'bg-neutral-50 border-border'
                )}
                style={p.popular ? { borderColor: 'color-mix(in srgb, var(--color-primary-500, #10b981) 35%, transparent)' } : undefined}
              >
                {p.popular && <span className="lp-popular-badge mb-[var(--space-apple-sm)] block">推荐方案</span>}
                <h3 className={cn('text-base font-bold mb-0.5', p.popular ? 'text-white' : 'text-neutral-900')}>{p.name}</h3>
                <p className={cn('lp-caption mb-[var(--space-apple-md)]', p.popular ? 'text-white' : 'text-text-muted')}>{p.desc}</p>
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
                {renderCTA(p)}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
