/**
 * Navbar 组件 v4 — 专业学术风格导航栏
 *
 * 升级要点（v4）：
 *   - Logo 尺寸提升：图标 20px，容器 36px
 *   - 导航链接 hover/active 样式提取为 CSS 类（lp-nav-link / lp-nav-active）
 *   - CTA "免费试用" → "免费开始研发"（行动暗示更强）
 *   - 移动端菜单增加过渡动画
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Beaker, Menu, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/shadcn';
import { BRAND_CONFIG } from '@/config';
import { useAuthStore } from '@/stores/auth';
import { navLinks, navbarCTA, logoPath, logoSize, isImageLogo } from '../data/navbar';
import { cn } from '@/lib/utils';

export default function Navbar() {
  const { isAuthenticated } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const sections = ['features', 'use-cases', 'data-sources', 'social-proof', 'pricing', 'faq'];
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
        background: scrolled ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.92)',
        borderBottom: scrolled ? '1px solid #e2e8f0' : '1px solid rgba(226,232,240,0.5)',
        backdropFilter: scrolled ? 'blur(12px) saturate(180%)' : 'blur(8px)',
        WebkitBackdropFilter: scrolled ? 'blur(12px) saturate(180%)' : 'blur(8px)',
        height: '64px',
        boxShadow: scrolled ? '0 1px 0 rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)' : 'none',
      }}
      role="navigation"
      aria-label="主导航"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          {isImageLogo ? (
            <div className="shrink-0 rounded-md overflow-hidden" style={{ width: logoSize.image, height: logoSize.image }}>
              <img
                src={logoPath}
                alt={`${BRAND_CONFIG.name} logo`}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </div>
          ) : (
            <div
              className="shrink-0 rounded-md flex items-center justify-center transition-transform duration-200 group-hover:rotate-[-5deg]"
              style={{ width: logoSize.image, height: logoSize.image, background: '#059669' }}
            >
              <Beaker size={logoSize.icon} color="white" strokeWidth={2.2} />
            </div>
          )}
          <span
            className="font-bold text-[16px] tracking-tight leading-none"
            style={{ color: '#0f172a' }}
          >
            {BRAND_CONFIG.name}
          </span>
        </Link>

        {/* 桌面导航 */}
        <div className="hidden md:flex items-center gap-0.5">
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
                to="/login"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-md text-white transition-all hover:opacity-90 hover:translate-y-[-1px]"
                style={{
                  background: '#0f172a',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.15)',
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
                type="button"
                className="md:hidden p-2 rounded-md ml-1 transition-colors lp-nav-link"
                aria-expanded={mobileOpen}
                aria-label="菜单"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="md:hidden overflow-hidden" style={{ animation: 'lp-mobile-menu 0.2s ease' }}>
              <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                <div className="px-4 py-3 space-y-0.5">
                  {navLinks.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'block text-[14px] font-medium py-2.5 px-3 rounded-md transition-colors',
                        'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                        isActive(l.href) && 'text-slate-900 bg-slate-50'
                      )}
                    >
                      {l.label}
                    </a>
                  ))}
                  <div className="pt-2 mt-2 border-t border-slate-100">
                    <Link
                      to="/login"
                      className="w-full text-center text-[14px] font-semibold py-2.5 rounded-md text-white block transition-opacity hover:opacity-90"
                      style={{ background: '#0f172a' }}
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
