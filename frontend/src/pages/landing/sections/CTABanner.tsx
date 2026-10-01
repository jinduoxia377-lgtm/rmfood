/**
 * CTABanner 组件 v5 — 学术行动召唤（升级 v5）
 *
 * 升级要点（v5）：
 *   - max-w-4xl → max-w-6xl，与其他 section 对齐
 *   - 主 CTA（免费注册）加粗加大
 *   - 副 CTA（预约演示）降为次要 outlined 样式
 *   - 回到顶部按钮默认隐藏，仅滚动超过首屏后显示
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronUp, CheckCircle } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/shadcn';
import { Reveal } from '../shared/Reveal';
import { cn } from '@/lib/utils';

export default function CTABanner() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  /** P0 表单修复：原 3 个 input 无状态、无校验、提交即丢弃数据跳 /login（假输入损害信任）。
   *  现接入 /api/v1/leads 真实留资接口（后端未就绪时明确报错，不再静默丢弃）。 */
  async function handleSubmit() {
    setSubmitError('');
    if (!name.trim() || !email.trim()) {
      setSubmitError('请填写姓名和邮箱');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubmitError('邮箱格式不正确');
      return;
    }
    try {
      const res = await fetch('/api/v1/leads/demo-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, company }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitted(true);
    } catch {
      setSubmitError('提交失败：预约服务暂未就绪，请稍后重试或直接注册体验');
    }
  }

  return (
    <section className="py-16 relative" style={{ background: 'var(--color-neutral-900, #0f172a)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Reveal>
          <h2 className="lp-h3 text-white mb-2">开始您的配方研发</h2>
          <p className="lp-body-sm mb-7" style={{ color: 'var(--color-neutral-300, #cbd5e1)' }}>科研版永久免费，无需信用卡，30 秒完成注册。</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {/* 主 CTA：免费注册 — 白色大按钮 */}
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-7 min-h-[44px] rounded-md text-[15px] font-semibold transition-opacity hover:opacity-90 lp-label"
              style={{ background: '#fff', color: 'var(--color-neutral-900, #0f172a)' }}
            >
              免费注册
              <ArrowRight size={14} />
            </Link>
            {/* 副 CTA：预约演示 — 次要 outlined 样式 */}
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium px-6 py-3 rounded-md transition-colors hover:text-white border min-h-[44px] lp-body-sm"
                  style={{ color: 'var(--color-neutral-300, #cbd5e1)', borderColor: '#475569' }}
                >
                  预约演示
                </button>
              </DialogTrigger>
              <DialogContent size="sm" style={{ background: '#fff', color: 'var(--color-neutral-900, #0f172a)' }}>
                <DialogHeader>
                  <DialogTitle>预约产品演示</DialogTitle>
                  <DialogDescription>留下您的联系方式，我们的顾问将在 24 小时内与您联系，为您安排专属的产品演示。</DialogDescription>
                </DialogHeader>
                {submitted ? (
                  <div className="flex items-start gap-3 py-4">
                    <CheckCircle size={20} className="shrink-0 mt-0.5" style={{ color: '#047857' }} />
                    <div>
                      <p className="text-[15px] font-semibold text-slate-900">预约成功</p>
                      <p className="text-[12px] text-slate-500 mt-1">
                        已收到您的预约信息（{email}），顾问将在 24 小时内与您联系。
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="lp-label mb-1 block" htmlFor="demo-booking-name">姓名</label>
                      <input
                        id="demo-booking-name"
                        aria-label="请输入您的姓名"
                        className="w-full h-11 px-3 text-[15px] rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
                        placeholder="请输入您的姓名"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="lp-label mb-1 block" htmlFor="demo-booking-email">邮箱</label>
                      <input
                        id="demo-booking-email"
                        aria-label="请输入您的公司邮箱"
                        className="w-full h-11 px-3 text-[15px] rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
                        placeholder="company@example.com"
                        type="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="lp-label mb-1 block" htmlFor="demo-booking-company">公司名称（选填）</label>
                      <input
                        id="demo-booking-company"
                        aria-label="请输入公司名称"
                        className="w-full h-11 px-3 text-[15px] rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
                        placeholder="请输入公司名称"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                      />
                    </div>
                    {submitError && (
                      <p className="text-[12px] text-red-600" role="alert">{submitError}</p>
                    )}
                  </div>
                )}
                <DialogFooter>
                  {submitted ? (
                    <Button onClick={() => { setSubmitted(false); setName(''); setEmail(''); setCompany(''); }} variant="outline">
                      继续预约
                    </Button>
                  ) : (
                    <Button style={{ background: 'var(--color-neutral-900, #0f172a)' }} onClick={handleSubmit} className="w-full sm:w-auto">
                      <ArrowRight size={13} className="mr-1" />
                      提交预约
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
          'absolute bottom-4 right-8 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5',
          'lp-scroll-top',
          showScrollTop && 'lp-scroll-top-visible'
        )}
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--color-neutral-400, #94a3b8)' }}
        aria-label="回到顶部"
      >
        <ChevronUp size={14} />
      </button>
    </section>
  );
}
