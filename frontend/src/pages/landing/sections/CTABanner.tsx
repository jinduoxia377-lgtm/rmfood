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
import { ArrowRight, ChevronUp } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/shadcn';
import { Reveal } from '../shared/Reveal';
import { cn } from '@/lib/utils';

export default function CTABanner() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <section className="py-16 relative" style={{ background: '#0f172a' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Reveal>
          <h2 className="text-xl lg:text-[1.75rem] font-bold text-white mb-2 tracking-tight">开始您的配方研发</h2>
          <p className="text-[13px] text-slate-400 mb-7">科研版永久免费，无需信用卡，30 秒完成注册。</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {/* 主 CTA：免费注册 — 白色大按钮 */}
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-7 py-3 rounded-md text-[14px] font-semibold text-slate-900 transition-opacity hover:opacity-90"
              style={{ background: '#fff' }}
            >
              免费注册
              <ArrowRight size={14} />
            </Link>
            {/* 副 CTA：预约演示 — 次要 outlined 样式 */}
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-400 px-6 py-3 rounded-md transition-colors hover:text-white border border-slate-700 hover:border-slate-500"
                >
                  预约演示
                </button>
              </DialogTrigger>
              <DialogContent size="sm" style={{ background: '#fff', color: '#0f172a' }}>
                <DialogHeader>
                  <DialogTitle>预约产品演示</DialogTitle>
                  <DialogDescription>留下您的联系方式，我们的顾问将在 24 小时内与您联系，为您安排专属的产品演示。</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-[12px] font-medium text-slate-700 mb-1 block">姓名</label>
                    <input className="w-full h-9 px-3 text-[13px] rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300" placeholder="请输入您的姓名" />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-slate-700 mb-1 block">邮箱</label>
                    <input className="w-full h-9 px-3 text-[13px] rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300" placeholder="company@example.com" type="email" />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-slate-700 mb-1 block">公司名称</label>
                    <input className="w-full h-9 px-3 text-[13px] rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300" placeholder="请输入公司名称" />
                  </div>
                </div>
                <DialogFooter>
                  <Link to="/login" className="w-full sm:w-auto"><Button style={{ background: '#0f172a' }}><ArrowRight size={13} className="mr-1" />提交预约</Button></Link>
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
          'absolute bottom-4 right-8 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5',
          'lp-scroll-top',
          showScrollTop && 'lp-scroll-top-visible'
        )}
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8' }}
        aria-label="回到顶部"
      >
        <ChevronUp size={14} />
      </button>
    </section>
  );
}
