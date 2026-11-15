/**
 * SocialProof 组件 v11 — 学术引用风格（升级 v11）
 *
 * 升级要点（v11）：
 *   - 星级评分从实色填充改为空心描边风格（学术克制感）
 *   - 圆角统一 rounded-sm → rounded-[var(--radius-Apple-sm)] / rounded-sm
 *   - 指标卡片改用 lp-metric-card CSS 类
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Reveal } from '../shared/Reveal';
import { cn } from '@/lib/utils';
import { Users, Zap, FileText, Clock, Quote } from 'lucide-react';
import {
  trustMetrics, partnerOrgs, testimonials, categoryStyle, categoryLabel,
  PARTNER_ORGS_DISCLAIMER_KEY, TESTIMONIALS_DISCLAIMER_KEY,
} from '../data/socialProof';

const iconMap: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  Users,
  Zap,
  FileText,
  Clock,
};

function TrustMetrics() {
  return (
    <Reveal>
      <div className="mb-10">
        <div className="lp-section-tag mb-[var(--space-apple-md)]">
          平台数据 · {new Date().getFullYear()}
        </div>
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-[var(--space-apple-sm)]">
          {trustMetrics.map((m) => {
            const IconComp = iconMap[m.icon];
            return (
              <div key={m.label} className="lp-metric-card">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-7 h-7 rounded-[var(--radius-Apple-sm)] flex items-center justify-center shrink-0"
                    style={{ background: m.color + '18', color: m.color, boxShadow: `0 0 0 1px ${m.color}20` }}
                  >
                    {IconComp ? <IconComp size={14} strokeWidth={1.8} /> : null}
                  </div>
                  <span className="lp-caption" style={{ color: m.color }}>{m.sub}</span>
                </div>
                <div className="text-xl font-bold font-mono text-neutral-900">{m.value}</div>
                <div className="lp-caption mt-0.5" style={{ color: 'var(--text-secondary)' }}>{m.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Reveal>
  );
}

function PartnerLogos() {
  const [hovered, setHovered] = useState<string | null>(null);
  const { t } = useTranslation();

  return (
    <Reveal delay="lp-reveal-delay-1">
      <div className="mb-10">
        <div className="lp-section-tag mb-[var(--space-apple-md)]">
          合作机构
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {partnerOrgs.map((org) => {
            const s = categoryStyle[org.category];
            const label = categoryLabel[org.category];
            const isHovered = hovered === org.name;
            return (
              <div
                key={org.name}
                className="rounded-[var(--radius-Apple-sm)] px-[var(--space-apple-sm)] py-2 text-center transition-all duration-200 cursor-default"
                style={{
                  background: isHovered ? '#fff' : s.bg,
                  border: `1px solid ${isHovered ? s.border : s.border}`,
                  boxShadow: isHovered ? 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' : 'none',
                }}
                onMouseEnter={() => setHovered(org.name)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="lp-label" style={{ color: 'var(--text-primary)' }}>{org.name}</div>
                <span className="text-[12px] font-mono" style={{ color: s.text }}>
                  [{label}]
                </span>
                <div className="mt-1.5 text-[12px] text-[var(--text-secondary)] leading-relaxed">
                  {org.category === 'university' && '中医药学术研究'}
                  {org.category === 'hospital' && '临床验证与处方研究'}
                  {org.category === 'enterprise' && '药食同源产品研发'}
                  {org.category === 'government' && '政策标准制定'}
                </div>
              </div>
            );
          })}
        </div>
        {/* TODO(legal): 匿名示例免责，措辞待法务最终确认 */}
        <p className="mt-3 text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          {t(PARTNER_ORGS_DISCLAIMER_KEY)}
        </p>
      </div>
    </Reveal>
  );
}

function Testimonials() {
  const [hovered, setHovered] = useState<number | null>(null);
  const { t } = useTranslation();

  return (
    <Reveal delay="lp-reveal-delay-2">
      <div>
        <div className="lp-section-tag mb-[var(--space-apple-md)]">
          用户评价
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className={cn(
                'relative rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-md)] transition-all duration-200 cursor-default',
                hovered === i && 'translate-y-[-1px]'
              )}
              style={{
                background: 'var(--bg-surface-raised)',
                border: `1px solid ${hovered === i ? 'var(--color-primary-600, #059669)' : 'var(--color-neutral-200, #e2e8f0)'}`,
                boxShadow: hovered === i ? 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' : 'none',
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* 引用符号 */}
              <Quote size={14} className="mb-2 opacity-25" style={{ color: 'var(--color-primary-700, #047857)' }} />

              {/* TODO(legal): 已移除 5 星评分渲染——不给示意性文案打满分；待法务确认是否恢复 */}
              {/* 引言 */}
              <div className="text-[14px] leading-[1.7] text-[var(--text-secondary)] mb-[var(--space-apple-sm)] min-h-[60px] lp-quote">
                {t.quote}
              </div>

              {/* 作者 */}
              <div className="flex items-center gap-2 pt-2.5 border-t border-[var(--border-color)]">
                <div
                  className="w-7 h-7 rounded-[var(--radius-pill)] flex items-center justify-center lp-label text-white shrink-0"
                  style={{ background: t.gradient, boxShadow: 'var(--shadow-md, 0 2px 8px rgba(0,0,0,0.06))' }}
                >
                  {t.name[0]}
                </div>
                <div>
                  <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t.name}</div>
                  <div className="text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t.role} · {t.org}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* TODO(legal): 示意性评价免责，措辞待法务最终确认 */}
        <p className="mt-5 text-[12px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          {t(TESTIMONIALS_DISCLAIMER_KEY)}
        </p>
      </div>
    </Reveal>
  );
}

export default function SocialProof() {
  return (
    <section id="social-proof" aria-label="信任证明与合作机构" className="py-16 lg:py-20" style={{ background: 'var(--bg-canvas)', borderTop: '1px solid var(--color-neutral-200, #e2e8f0)' }}>
      <div className="max-w-6xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8">

        {/* 标题 */}
        <Reveal>
          <div className="mb-10">
            <span className="lp-section-tag block mb-[var(--space-apple-sm)]">
              信任证明
            </span>
            <h2 className="lp-h2">
              200+ 研发团队信赖
            </h2>
            <p className="text-[15px] leading-relaxed max-w-lg text-[var(--text-secondary)] mt-2">
              从高校实验室到大型企业研发中心，覆盖全国 6 所重点中医药院校及 Top 50 药企。
            </p>
          </div>
        </Reveal>

        <TrustMetrics />
        <PartnerLogos />
        <Testimonials />

      </div>
    </section>
  );
}
