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
import { useTranslation } from 'react-i18next';
import { Beaker, Mail, MapPin, Globe, Github, MessageCircle, ShieldCheck, Award, FileCheck, UserCheck } from 'lucide-react';
import { RHINE_BRAND_CONFIG } from '@/config';
import { trustSignals, ICP_CONFIG } from '../data/trustSignals';

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
      { label: '更新日志', href: '/docs' },
      { label: '社区论坛', href: '/faqs' },
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
  const { t } = useTranslation();
  return (
    <footer aria-label="页脚 — 品牌信息与导航" className="lp-footer">
      {/* 主内容区 */}
      <div className="max-w-6xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* 品牌区 */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-[var(--space-apple-sm)]">
              <div className="w-7 h-7 rounded-[var(--radius-Apple-sm)] flex items-center justify-center surface-primary">
                <Beaker size={13} color="white" strokeWidth={2.2} />
              </div>
              <span className="font-bold text-sm tracking-tight text-neutral-100">莱茵分子</span>
            </div>
            <p className="lp-footer-desc mb-[var(--space-apple-md)] leading-relaxed">
              {RHINE_BRAND_CONFIG.description}
            </p>
            <div className="flex items-center gap-[var(--space-apple-sm)] mt-[var(--space-apple-md)]">
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
                  className="w-11 h-11 flex items-center justify-center transition-colors text-neutral-400 border border-neutral-800"
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          {/* 导航列 */}
          {navSections.map(col => (
            <div key={col.title}>
              <h2 className="lp-footer-label mb-3.5">{col.title}</h2>
              <ul className="space-y-0.5">
                {col.links.map(link => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="lp-footer-link text-[15px]"
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
            <h2 className="lp-footer-label mb-3.5">联系我们</h2>
            <ul className="space-y-0.5">
              {[
                { icon: Mail, text: 'contact@rmfood.cn' },
                { icon: Globe, text: 'www.rmfood.cn' },
                { icon: MapPin, text: '厦门市思明区' },
              ].map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-center gap-2 text-[15px] min-h-[44px] text-neutral-400!">
                  <Icon size={14} className="shrink-0 opacity-60 text-neutral-200" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 底部分隔线 */}
      {/* 安全合规认证标识 */}
      <div className="border-t border-t-neutral-800" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-6xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {trustSignals.map(s => {
              const IconMap: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
                ShieldCheck, Award, FileCheck, UserCheck,
              };
              const Icon = IconMap[s.icon] || ShieldCheck;
              return (
                <div key={s.name} className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-Apple-sm)] transition-colors hover:bg-[rgba(255,255,255,0.04)]" style={{ border: '1px solid var(--color-neutral-800, #1e293b)' }}>
                  <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] flex items-center justify-center shrink-0" style={{ background: `${s.color}15`, border: `1px solid ${s.color}30` }}>
                    <Icon size={14} color={s.color} />
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-neutral-200">{s.name}</div>
                    <div className="text-[12px] text-neutral-400!">{s.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* 合规口径（已定，非待办）：认证免责声明走 i18n 键 pages.landing.disclaimers.certifications，
              全页统一「按标准开展架构设计与数据治理、不代表已取得第三方认证证书」口径。
              依据 docs/marketing/05 D1；如需改变对外宣称须经法务书面复核。样式沿用现有文本层级与 CSS 变量，无新增色值。 */}
          <p className="mt-4 text-center text-[12px] leading-relaxed text-neutral-500 max-w-3xl mx-auto">
            {t('pages.landing.disclaimers.certifications')}
          </p>
        </div>
      </div>

      <div className="border-t lp-footer-bottom">
        <div className="max-w-6xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[12px] text-neutral-400!">
              &copy; {new Date().getFullYear()} {RHINE_BRAND_CONFIG.fullName}
            </p>
            <div className="flex items-center gap-4">
              <span className="lp-mono text-[12px] text-neutral-400!">{ICP_CONFIG.icp}</span>
              <span className="text-[12px] text-neutral-400!">·</span>
              <span className="lp-mono text-[12px] text-neutral-400!">{ICP_CONFIG.businessLicense}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
