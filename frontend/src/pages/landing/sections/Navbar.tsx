/**
 * Navbar 组件 v4 — 专业学术风格导航栏
 *
 * 升级要点（v4）：
 *   - Logo 尺寸提升：图标 20px，容器 36px
 *   - 导航链接 hover/active 样式提取为 CSS 类（lp-nav-link / lp-nav-active）
 *   - CTA "免费试用" → "免费开始研发"（行动暗示更强）
 *   - 移动端菜单增加过渡动画
 */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Beaker, Menu, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/shadcn';
import { useAuthStore } from '@/stores/auth';
import { navLinks, navbarCTA, logoPath, logoSize, isImageLogo } from '../data/navbar';
import { cn } from '@/lib/utils';

export default function Navbar() {
  const { isAuthenticated } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 焦点管理：菜单关闭时将焦点归还给触发按钮
  useEffect(() => {
    if (!mobileOpen && wasOpenRef.current) {
      wasOpenRef.current = false;
      const timer = setTimeout(() => triggerRef.current?.focus(), 200);
      return () => clearTimeout(timer);
    }
    if (mobileOpen) wasOpenRef.current = true;
    return undefined;
  }, [mobileOpen]);

  // Escape 键关闭菜单
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    const sections = ['features', 'algorithms', 'use-cases', 'data-sources', 'social-proof', 'pricing', 'faq'];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            return;
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );
    for (const id of sections) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const isActive = (href: string) => activeSection === href.replace('#', '');

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled && 'navbar-scrolled'
      )}
      style={{
        background: scrolled ? 'color-mix(in srgb, #ffffff 97%, transparent)' : 'color-mix(in srgb, #ffffff 95%, transparent)',
        borderBottom: scrolled ? '1px solid var(--color-neutral-200, #e2e8f0)' : '1px solid color-mix(in srgb, var(--color-neutral-200, #e2e8f0) 30%, transparent)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        height: '64px',
        boxShadow: scrolled ? '0 1px 0 var(--hover-bg, rgba(0,0,0,0.04)), 0 2px 8px var(--hover-bg, rgba(0,0,0,0.04))' : 'none',
      }}
      aria-label="主导航"
    >
      <div className="max-w-6xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 h-full flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group min-h-[44px]" aria-label="莱茵分子 — 返回首页" style={{ color: 'var(--text-primary)' }}>
          {isImageLogo ? (
            <div className="shrink-0 rounded-[var(--radius-Apple-sm)] overflow-hidden" style={{ width: logoSize.image, height: logoSize.image }}>
                <img
                  src={logoPath}
                  alt="莱茵分子 logo"
                  className="w-full h-full object-contain"
                  fetchPriority="high"
                />
            </div>
          ) : (
            <div
              className="shrink-0 rounded-[var(--radius-Apple-sm)] flex items-center justify-center transition-transform duration-200 group-hover:rotate-[-5deg]"
              style={{ width: logoSize.image, height: logoSize.image, background: 'var(--color-primary-700, #047857)' }}
            >
              <Beaker size={logoSize.icon} color="white" strokeWidth={2.2} />
            </div>
          )}
          <span
            className="font-bold text-[16px] tracking-tight leading-none"
            style={{ color: 'var(--text-primary)' }}
          >
            莱茵分子
          </span>
        </Link>

        {/* 桌面导航 */}
        <div className="hidden md:flex items-center gap-2">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={cn('lp-nav-link', isActive(l.href) && 'lp-nav-active')}
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="lp-nav-link"
            >
              {navbarCTA.dashboardLabel}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden sm:inline-flex lp-nav-link"
              >
                登录
              </Link>
              <Link
                to="/login?redirect=/landing"
                className="inline-flex items-center gap-1.5 text-[15px] font-semibold px-[var(--space-apple-md)] min-h-[44px] rounded-[var(--radius-Apple-sm)] text-white transition-all hover:opacity-90"
                style={{
                  background: 'var(--color-neutral-900, #0f172a)',
                  boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))',
                }}
              >
                {navbarCTA.trialLabel}
              </Link>
            </>
          )}

          {/* 移动端菜单按钮 */}
          <Collapsible open={mobileOpen} onOpenChange={setMobileOpen}>
            <CollapsibleTrigger asChild>
              <button
                ref={triggerRef}
                type="button"
                className="md:hidden w-11 h-11 flex items-center justify-center rounded-[var(--radius-Apple-sm)] ml-1 transition-colors lp-nav-link"
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu-content"
                aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
                onClick={() => {
                  setMobileOpen(!mobileOpen);
                }}
              >
                {mobileOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent id="mobile-menu-content" className="md:hidden overflow-hidden" style={{ animation: 'lp-mobile-menu 0.2s ease' }}>
              <div style={{ background: 'var(--bg-surface-container)', borderTop: '1px solid var(--color-neutral-200, #e2e8f0)', boxShadow: 'var(--shadow-md, 0 2px 8px rgba(0,0,0,0.06))' }}>
                <div className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] space-y-0.5">
                  {navLinks.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'block text-[15px] font-medium py-2.5 px-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] transition-colors min-h-[44px] flex items-center',
                        isActive(l.href) ? 'text-[var(--text-primary)] bg-[var(--bg-tertiary)]' : 'text-[var(--text-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                      )}
                    >
                      {l.label}
                    </a>
                  ))}
                  <div className="pt-2 mt-2 border-t border-[var(--border-color)]">
                    <Link
                      to="/login?redirect=/landing"
                      className="w-full text-center text-[15px] font-semibold py-[var(--space-apple-md)] rounded-[var(--radius-Apple-sm)] text-white block transition-opacity hover:opacity-90 min-h-[44px] flex items-center justify-center"
                      style={{ background: '#047857' }}
                    >
                      {navbarCTA.trialLabel}
                    </Link>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </nav>
  );
}
