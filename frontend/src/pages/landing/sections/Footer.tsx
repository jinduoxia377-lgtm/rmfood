/**
 * Footer 组件
 */
import { Link } from 'react-router-dom';
import { Beaker } from 'lucide-react';
import { BRAND_CONFIG, RHINE_BRAND_CONFIG } from '@/config';

const navSections = [
  { title: '产品', links: [{ label: '核心功能', href: '/landing#features' }, { label: '应用场景', href: '/landing#use-cases' }, { label: '定价方案', href: '/landing#pricing' }] },
  { title: '资源', links: [{ label: '使用文档', href: '/docs' }, { label: 'API 参考', href: '/api-docs' }, { label: '常见问题', href: '/faqs' }] },
  { title: '公司', links: [{ label: '关于莱茵分子', href: '/about' }, { label: '加入我们', href: '/careers' }, { label: '隐私政策', href: '/privacy' }] },
];

export default function Footer() {
  return (
    <footer style={{ background: '#fafafa', borderTop: '1px solid #e2e8f0' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: '#059669' }}>
                <Beaker size={12} color="white" strokeWidth={2.2} />
              </div>
              <span className="font-bold text-sm" style={{ color: '#0f172a' }}>{BRAND_CONFIG.name}</span>
            </div>
            <p className="text-[12px] leading-relaxed mb-2" style={{ color: '#64748b' }}>{RHINE_BRAND_CONFIG.description}</p>
            <p className="text-[11px]" style={{ color: '#94a3b8' }}>{RHINE_BRAND_CONFIG.copyright}</p>
          </div>
          {navSections.map((col) => (
            <div key={col.title} className="col-span-1">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#0f172a' }}>{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={typeof link === 'string' ? link : link.label}>
                    {typeof link === 'string' ? (
                      <a href="#" className="text-[12px] transition-colors hover:underline" style={{ color: '#64748b' }} onClick={(e) => e.preventDefault()}>{link}</a>
                    ) : (
                      <Link to={link.href} className="text-[12px] transition-colors hover:underline" style={{ color: '#64748b' }}>{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-5 border-t flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: '#e2e8f0' }}>
          <p className="text-[11px]" style={{ color: '#94a3b8' }}>© {new Date().getFullYear()} {RHINE_BRAND_CONFIG.fullName}</p>
          <p className="text-[10px] font-mono" style={{ color: '#cbd5e1' }}>闽ICP备XXXXXXXX号</p>
        </div>
      </div>
    </footer>
  );
}
