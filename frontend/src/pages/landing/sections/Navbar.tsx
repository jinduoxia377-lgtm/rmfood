/**
 * Navbar 组件 v3 — 专业学术风格导航栏
 *
 * 升级要点：
 *   - 高度 56px → 64px，增加呼吸感
 *   - Logo 16px → 20px，更醒目
 *   - 导航链接 13px → 14px，字重 500→600
 *   - CTA 按钮更大更醒目
 *   - 滚动后更明显的阴影分隔
 *   - 去版本号标签
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
    const onScroll = () => setScrolled(window.scrollY > 8);
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

  const activeLinkStyle = (href: string) => {
    const sectionId = href.replace('#', '');
    const isActive = activeSection === sectionId;
    return {
      color: isActive ? '#0f172a' : '#475569',
      background: isActive ? 'rgba(15,23,42,0.06)' : 'transparent',
      borderBottom: isActive ? '2px solid #0f172a' : '2px solid transparent',
    };
  };

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
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:rotate-[-5deg]"
              style={{ background: '#059669' }}
            >
              <Beaker size={logoSize.icon + 2} color="white" strokeWidth={2.2} />
            </div>
          )}
          <span
              className="font-bold text-[15px] tracking-tight leading-none"
              style={{ color: '#0f172a' }}
            >
              {BRAND_CONFIG.name}
            </span>
        </Link>

        {/* 桌面导航 */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[14px] font-medium px-3 py-2 rounded-md transition-colors"
              style={{ color: '#475569', borderBottom: '2px solid transparent' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#0f172a';
                e.currentTarget.style.background = 'rgba(15,23,42,0.04)';
              }}
              onMouseLeave={(e) => {
                const isActive = activeSection === l.href.replace('#', '');
                e.currentTarget.style.color = isActive ? '#0f172a' : '#475569';
                e.currentTarget.style.background = isActive ? 'rgba(15,23,42,0.06)' : 'transparent';
                e.currentTarget.style.borderBottomColor = isActive ? '#0f172a' : 'transparent';
              }}
              {...(activeSection === l.href.replace('#', '') && {
                style: { color: '#0f172a', background: 'rgba(15,23,42,0.06)', borderBottom: '2px solid #0f172a' }
              })}
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
              className="text-[14px] font-medium px-3 py-2 rounded-md transition-colors"
              style={{ color: '#475569' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#0f172a';
                e.currentTarget.style.background = 'rgba(15,23,42,0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#475569';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {navbarCTA.dashboardLabel}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden sm:inline-flex text-[14px] font-medium px-3 py-2 rounded-md transition-colors"
                style={{ color: '#475569' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#0f172a';
                  e.currentTarget.style.background = 'rgba(15,23,42,0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#475569';
                  e.currentTarget.style.background = 'transparent';
                }}
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
                className="md:hidden p-2 rounded-md ml-1 transition-colors"
                style={{ color: '#475569' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(15,23,42,0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                aria-expanded={mobileOpen}
                aria-label="菜单"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="md:hidden overflow-hidden">
              <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                <div className="px-4 py-3 space-y-0.5">
                  {navLinks.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={() => setMobileOpen(false)}
                      className="block text-[14px] font-medium py-2.5 px-3 rounded-md transition-colors"
                      style={{ color: '#334155' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(15,23,42,0.04)';
                        e.currentTarget.style.color = '#0f172a';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#334155';
                      }}
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
