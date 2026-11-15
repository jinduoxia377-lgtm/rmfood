/**
 * CTABanner 组件 v6 — 学术行动召唤（升级 v6：完整预约表单）
 *
 * 升级要点（v6）：
 *   - 增加 loading 状态指示（提交中按钮显示 spinner）
 *   - 增加提交后的成功/失败动画反馈（fade-in / shake）
 *   - 增加防重复提交保护（disabled + ref guard）
 *   - 增加公司行业选择器（制药、保健品、食品、科研机构、其他）
 *   - 增加预算范围选择（<10万、10-50万、50-100万、>100万）
 *   - 增加备注输入框
 *   - 使用共享 apiClient（10s 超时 + 友好错误消息）
 *   - 优雅降级：后端不可用时不崩溃、不白屏
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronUp, CheckCircle, AlertCircle } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/shadcn';
import { Reveal } from '../shared/Reveal';
import { cn } from '@/lib/utils';
import { submitDemoBooking, friendlyError } from '../shared/apiClient';

// ── 表单选项 ────────────────────────────────────────────────────

const INDUSTRY_OPTIONS = [
  { value: '制药', labelKey: 'pages.landing.cta.industries.pharma' },
  { value: '保健品', labelKey: 'pages.landing.cta.industries.supplement' },
  { value: '食品', labelKey: 'pages.landing.cta.industries.food' },
  { value: '科研机构', labelKey: 'pages.landing.cta.industries.research' },
  { value: '其他', labelKey: 'pages.landing.cta.industries.other' },
];

const BUDGET_OPTIONS = [
  { value: '<10万', labelKey: 'pages.landing.cta.budgets.lt10' },
  { value: '10-50万', labelKey: 'pages.landing.cta.budgets.b10to50' },
  { value: '50-100万', labelKey: 'pages.landing.cta.budgets.b50to100' },
  { value: '>100万', labelKey: 'pages.landing.cta.budgets.gt100' },
];

// ── 通用样式 ────────────────────────────────────────────────────

const inputBase = 'w-full h-11 px-[var(--space-apple-sm)] text-[15px] rounded-[var(--radius-Apple-sm)] border focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40';
const inputStyle: React.CSSProperties = {
  borderColor: 'var(--border-color)',
  background: 'var(--bg-surface-container)',
  color: 'var(--text-primary)',
};

export default function CTABanner() {
  const { t } = useTranslation();
  const [showScrollTop, setShowScrollTop] = useState(false);

  // 表单字段
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState('');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');

  // 提交状态
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [feedbackAnimKey, setFeedbackAnimKey] = useState(0);

  // 防重复提交引用
  const isSubmittingRef = useRef(false);

  // ── 滚动监听 ──────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // ── 表单重置 ──────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setName('');
    setEmail('');
    setCompany('');
    setIndustry('');
    setBudget('');
    setNotes('');
    setSubmitted(false);
    setSubmitError('');
    setSuccessMessage('');
  }, []);

  // ── 表单提交 ──────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (isSubmittingRef.current || submitting) return;
    setSubmitError('');

    // 字段校验
    if (!name.trim() || !email.trim()) {
      setSubmitError(t('pages.landing.cta.errNameEmail'));
      setFeedbackAnimKey((k) => k + 1);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubmitError(t('pages.landing.cta.errEmail'));
      setFeedbackAnimKey((k) => k + 1);
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const result = await submitDemoBooking({
        name: name.trim(),
        email: email.trim(),
        company: company.trim() || undefined,
        industry: industry || undefined,
        budget: budget || undefined,
        notes: notes.trim() || undefined,
      });
      setSubmitted(true);
      setSuccessMessage(
        t('pages.landing.cta.successBody', { email: email.trim(), id: result.id }),
      );
    } catch (err) {
      setSubmitError(friendlyError(err, t('pages.landing.cta.errSubmit')));
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
      setFeedbackAnimKey((k) => k + 1);
    }
  }, [name, email, company, industry, budget, notes, submitting, t]);

  // ── 键盘 Enter 提交 ──────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <section id="cta" aria-label={t('pages.landing.cta.ariaSection')} className="py-16 relative bg-neutral-900">
      <style>{`
        @keyframes lp-fade-in-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lp-scale-in {
          0% { opacity: 0; transform: scale(0.9); }
          60% { transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes lp-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
        .lp-feedback-in { animation: lp-fade-in-up 0.3s ease-out; }
        .lp-success-pop { animation: lp-scale-in 0.4s ease-out; }
        .lp-error-shake { animation: lp-shake 0.4s ease-out; }
      `}</style>

      <div className="max-w-6xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 text-center">
        <Reveal>
          <h2 className="lp-h3 text-white! mb-2">{t('pages.landing.cta.title')}</h2>
          <p className="lp-body-sm mb-7 text-neutral-300!">{t('pages.landing.cta.sub')}</p>
          <div className="flex items-center justify-center gap-[var(--space-apple-sm)] flex-wrap">
            {/* 主 CTA：免费注册 — 白色大按钮 */}
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-7 min-h-[44px] rounded-[var(--radius-Apple-sm)] text-[15px] font-semibold transition-opacity hover:opacity-90 lp-label bg-card text-neutral-900"
            >
              {t('pages.landing.cta.free')}
              <ArrowRight size={14} />
            </Link>
            {/* 副 CTA：预约演示 — 次要 outlined 样式 */}
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-[15px] font-medium px-6 py-[var(--space-apple-md)] rounded-[var(--radius-Apple-sm)] transition-colors hover:text-white border min-h-[44px] lp-body-sm text-neutral-300! border-neutral-600"
                  >
                  {t('pages.landing.cta.demo')}
                </button>
              </DialogTrigger>
              <DialogContent size="sm" className="bg-card text-[var(--text-primary)]">
                <DialogHeader>
                  <DialogTitle>{t('pages.landing.cta.dialogTitle')}</DialogTitle>
                  <DialogDescription>{t('pages.landing.cta.dialogDesc')}</DialogDescription>
                </DialogHeader>
                {submitted ? (
                  <div key={feedbackAnimKey} className="lp-success-pop flex items-start gap-[var(--space-apple-sm)] py-4">
                    <CheckCircle size={22} className="shrink-0 mt-0.5 text-primary-main" />
                    <div>
                      <p className="text-[15px] font-semibold text-neutral-900">{t('pages.landing.cta.successTitle')}</p>
                      <p className="text-[12px] mt-1 text-text-muted">
                        {successMessage}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-[var(--space-apple-sm)]">
                    <div>
                      <label className="lp-label mb-1 block" htmlFor="demo-booking-name">{t('pages.landing.cta.labelName')} <span className="text-danger-500">*</span></label>
                      <input
                        id="demo-booking-name"
                        aria-label={t('pages.landing.cta.phName')}
                        className={inputBase}
                        style={inputStyle}
                        placeholder={t('pages.landing.cta.phName')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={submitting}
                      />
                    </div>
                    <div>
                      <label className="lp-label mb-1 block" htmlFor="demo-booking-email">{t('pages.landing.cta.labelEmail')} <span className="text-danger-500">*</span></label>
                      <input
                        id="demo-booking-email"
                        aria-label={t('pages.landing.cta.phEmail')}
                        className={inputBase}
                        style={inputStyle}
                        placeholder={t('pages.landing.cta.phEmail')}
                        type="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={submitting}
                      />
                    </div>
                    <div>
                      <label className="lp-label mb-1 block" htmlFor="demo-booking-company">{t('pages.landing.cta.labelCompany')}</label>
                      <input
                        id="demo-booking-company"
                        aria-label={t('pages.landing.cta.phCompany')}
                        className={inputBase}
                        style={inputStyle}
                        placeholder={t('pages.landing.cta.phCompany')}
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={submitting}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-[var(--space-apple-sm)]">
                      <div>
                        <label className="lp-label mb-1 block" htmlFor="demo-booking-industry">{t('pages.landing.cta.labelIndustry')}</label>
                        <select
                          id="demo-booking-industry"
                          aria-label={t('pages.landing.cta.placeholder')}
                          className={inputBase}
                          style={inputStyle}
                          value={industry}
                          onChange={(e) => setIndustry(e.target.value)}
                          disabled={submitting}
                        >
                          <option value="">{t('pages.landing.cta.placeholder')}</option>
                          {INDUSTRY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="lp-label mb-1 block" htmlFor="demo-booking-budget">{t('pages.landing.cta.labelBudget')}</label>
                        <select
                          id="demo-booking-budget"
                          aria-label={t('pages.landing.cta.placeholder')}
                          className={inputBase}
                          style={inputStyle}
                          value={budget}
                          onChange={(e) => setBudget(e.target.value)}
                          disabled={submitting}
                        >
                          <option value="">{t('pages.landing.cta.placeholder')}</option>
                          {BUDGET_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="lp-label mb-1 block" htmlFor="demo-booking-notes">{t('pages.landing.cta.labelNotes')}</label>
                      <input
                        id="demo-booking-notes"
                        aria-label={t('pages.landing.cta.phNotes')}
                        className={inputBase}
                        style={inputStyle}
                        placeholder={t('pages.landing.cta.phNotes')}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={submitting}
                      />
                    </div>
                    {submitError && (
                      <p key={feedbackAnimKey} className="lp-error-shake text-[12px] text-danger-600 flex items-center gap-1" role="alert">
                        <AlertCircle size={12} className="shrink-0" />
                        {submitError}
                      </p>
                    )}
                  </div>
                )}
                <DialogFooter>
                  {submitted ? (
                    <Button onClick={resetForm} variant="outline">
                      {t('pages.landing.cta.continueBooking')}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      loading={submitting}
                      disabled={submitting}
                      className="w-full sm:w auto bg-[var(--color-primary-surface)] text-white"
                    >
                      {submitting ? t('pages.landing.cta.submitting') : (
                        <>
                          <ArrowRight size={14} className="mr-1" />
                          {t('pages.landing.cta.submit')}
                        </>
                      )}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Reveal>
      </div>

      {/* 回到顶部 — 滚动超过 600px 后淡入显示 */}
      <button
        type="button"
        onClick={scrollToTop}
        className={cn(
          'absolute bottom-4 right-8 w-11 h-11 rounded-[var(--radius-pill)] flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5',
          'lp-scroll-top',
          showScrollTop && 'lp-scroll-top-visible'
        )}
        style={{ background: 'color-mix(in srgb, #ffffff 8%, transparent)', border: '1px solid color-mix(in srgb, #ffffff 12%, transparent)', color: 'var(--color-neutral-400, #94a3b8)' }}
        aria-label={t('pages.landing.cta.backToTop')}
      >
        <ChevronUp size={14} />
      </button>
    </section>
  );
}