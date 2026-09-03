/**
 * PublicLayout — 公开页面统一布局
 * 轻量导航栏 + 内容区 + 页脚，适用于 landing 以外的公开页面
 */
import { Link } from 'react-router-dom';
import { Beaker } from 'lucide-react';
import { BRAND_CONFIG, RHINE_BRAND_CONFIG } from '@/config';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#fafafa', color: '#0f172a' }}>
      {/* 导航栏 */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', height: 56, display: 'flex', alignItems: 'center' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: '#059669' }}>
              <Beaker size={14} color="white" strokeWidth={2.2} />
            </div>
            <span className="font-bold text-[15px] tracking-tight" style={{ color: '#0f172a' }}>{BRAND_CONFIG.name}</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/landing" className="text-[13px] font-medium" style={{ color: '#475569' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#0f172a'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#475569'; }}
            >首页</Link>
            <Link to="/login" className="text-[13px] font-semibold px-4 py-2 rounded-md text-white" style={{ background: '#0f172a' }}>
              免费试用
            </Link>
          </div>
        </div>
      </nav>

      {/* 内容区 */}
      <main className="flex-1">
        {children}
      </main>

      {/* 页脚 */}
      <footer style={{ background: '#fff', borderTop: '1px solid #e2e8f0' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#059669' }}>
                  <Beaker size={12} color="white" strokeWidth={2.2} />
                </div>
                <span className="font-bold text-sm" style={{ color: '#0f172a' }}>{BRAND_CONFIG.name}</span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: '#64748b' }}>{RHINE_BRAND_CONFIG.description}</p>
            </div>
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#0f172a' }}>资源</h4>
              <ul className="space-y-2">
                {[
                  { label: '使用文档', href: '/docs' },
                  { label: 'API 参考', href: '/api-docs' },
                  { label: '常见问题', href: '/faqs' },
                ].map(l => (
                  <li key={l.label}>
                    <Link to={l.href} className="text-[12px] transition-colors hover:underline" style={{ color: '#64748b' }}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#0f172a' }}>公司</h4>
              <ul className="space-y-2">
                {[
                  { label: '关于莱茵分子', href: '/about' },
                  { label: '加入我们', href: '/careers' },
                  { label: '隐私政策', href: '/privacy' },
                  { label: '服务条款', href: '/terms' },
                ].map(l => (
                  <li key={l.label}>
                    <Link to={l.href} className="text-[12px] transition-colors hover:underline" style={{ color: '#64748b' }}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#0f172a' }}>联系</h4>
              <ul className="space-y-2">
                <li><span className="text-[12px]" style={{ color: '#64748b' }}>contact@rmfood.cn</span></li>
                <li><span className="text-[12px]" style={{ color: '#64748b' }}>厦门 · 中国</span></li>
              </ul>
            </div>
          </div>
          <div className="pt-5 border-t flex flex-col sm:flex-row items-center justify-between gap-2" style={{ borderColor: '#e2e8f0' }}>
            <p className="text-[11px]" style={{ color: '#94a3b8' }}>© {new Date().getFullYear()} {RHINE_BRAND_CONFIG.fullName}</p>
            <p className="text-[10px] font-mono" style={{ color: '#cbd5e1' }}>闽ICP备XXXXXXXX号</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
