/**
 * Footer 组件 v3 — 企业官网级专业版
 *
 * 升级要点（v3）：
 *   - 深色背景 + 清晰层级（品牌 / 导航 / 资源 / 联系）
 *   - 社交媒体使用 Lucide 图标（微信/知乎/GitHub）
 *   - 备案信息与版权分离，排版专业
 *   - 底部细线分隔 + 页脚安全区
 */
import { Link } from 'react-router-dom';
import { Beaker, Mail, MapPin, Globe, Github, MessageCircle } from 'lucide-react';
import { RHINE_BRAND_CONFIG } from '@/config';

const navSections = [
  {
    title: '产品',
    links: [
      { label: '核心功能', href: '/landing#features' },
      { label: '算法引擎', href: '/landing#algorithms' },
      { label: '应用场景', href: '/landing#use-cases' },
      { label: '数据底座', href: '/landing#data-sources' },
      { label: '定价方案', href: '/landing#pricing' },
      { label: '常见问题', href: '/landing#faq' },
    ],
  },
  {
    title: '资源',
    links: [
      { label: '使用文档', href: '/docs' },
      { label: 'API 参考', href: '/api-docs' },
      { label: '更新日志', href: '/changelog' },
      { label: '社区论坛', href: '/community' },
    ],
  },
  {
    title: '公司',
    links: [
      { label: '关于莱茵分子', href: '/about' },
      { label: '加入我们', href: '/careers' },
      { label: '隐私政策', href: '/privacy' },
      { label: '服务条款', href: '/terms' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="lp-footer">
      {/* 主内容区 */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* 品牌区 */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#059669' }}>
                <Beaker size={13} color="white" strokeWidth={2.2} />
              </div>
              <span className="font-bold text-sm tracking-tight" style={{ color: '#f1f5f9' }}>莱茵分子</span>
            </div>
            <p className="lp-footer-desc mb-4 leading-relaxed">
              {RHINE_BRAND_CONFIG.description}
            </p>
            <div className="flex items-center gap-3 mt-4">
              {[
                { icon: Github, label: 'GitHub', href: 'https://github.com/rmfood' },
                { icon: MessageCircle, label: '微信', href: '#' },
              ].map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-11 h-11 flex items-center justify-center transition-colors"
                  style={{ color: '#94a3b8', border: '1px solid #1e293b' }}
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          {/* 导航列 */}
          {navSections.map(col => (
            <div key={col.title}>
              <h4 className="lp-footer-label mb-3.5">{col.title}</h4>
              <ul className="space-y-0.5">
                {col.links.map(link => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="lp-footer-link text-[13px]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* 联系信息 */}
          <div>
            <h4 className="lp-footer-label mb-3.5">联系我们</h4>
            <ul className="space-y-0.5">
              {[
                { icon: Mail, text: 'contact@rmfood.cn' },
                { icon: Globe, text: 'www.rmfood.cn' },
                { icon: MapPin, text: '厦门市思明区' },
              ].map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-center gap-2 text-[13px] text-slate-400 min-h-[44px]">
                  <Icon size={14} className="shrink-0 opacity-60" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 底部分隔线 */}
      <div className="border-t lp-footer-bottom">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[12px] text-slate-400">
              &copy; {new Date().getFullYear()} {RHINE_BRAND_CONFIG.fullName}
            </p>
            <div className="flex items-center gap-4">
              <span className="lp-mono text-[11px] text-slate-400">闽ICP备2025XXXXXX号-1</span>
              <span className="text-[11px] text-slate-500">·</span>
              <span className="lp-mono text-[11px] text-slate-400">网络经营备案</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
