/**
 * SocialProof 组件 v11 — 学术引用风格（升级 v11）
 *
 * 升级要点（v11）：
 *   - 星级评分从实色填充改为空心描边风格（学术克制感）
 *   - 圆角统一 rounded-sm → rounded-md / rounded-sm
 *   - 指标卡片改用 lp-metric-card CSS 类
 */
import { useState } from 'react';
import { Reveal } from '../shared/Reveal';
import { cn } from '@/lib/utils';
import { Users, Zap, FileText, Clock, Star, Quote } from 'lucide-react';
import {
  trustMetrics, partnerOrgs, testimonials, categoryStyle, categoryLabel,
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
        <div className="lp-section-tag mb-4">
          平台数据 · {new Date().getFullYear()}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {trustMetrics.map((m) => {
            const IconComp = iconMap[m.icon];
            return (
              <div key={m.label} className="lp-metric-card">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: m.color + '18', color: m.color, boxShadow: `0 0 0 1px ${m.color}20` }}
                  >
                    {IconComp ? <IconComp size={14} strokeWidth={1.8} /> : null}
                  </div>
                  <span className="lp-caption" style={{ color: m.color }}>{m.sub}</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">{m.value}</div>
                <div className="lp-caption mt-0.5">{m.label}</div>
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

  return (
    <Reveal delay="lp-reveal-delay-1">
      <div className="mb-10">
        <div className="lp-section-tag mb-4">
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
                className="rounded-md px-3 py-2 text-center transition-all duration-200 cursor-default"
                style={{
                  background: isHovered ? '#fff' : s.bg,
                  border: `1px solid ${isHovered ? s.border : s.border}`,
                  boxShadow: isHovered ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                }}
                onMouseEnter={() => setHovered(org.name)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="lp-label leading-tight mb-1">
                  {org.name}
                </div>
                <span className="text-[9px] font-mono" style={{ color: isHovered ? s.text : s.text + '99' }}>
                  [{label}]
                </span>
                {isHovered && (
                  <div className="mt-1.5 text-[9px] text-slate-500 leading-relaxed">
                    {org.category === 'university' && '中医药学术研究'}
                    {org.category === 'hospital' && '临床验证与处方研究'}
                    {org.category === 'enterprise' && '药食同源产品研发'}
                    {org.category === 'government' && '政策标准制定'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Reveal>
  );
}

function Testimonials() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Reveal delay="lp-reveal-delay-2">
      <div>
        <div className="lp-section-tag mb-4">
          用户评价
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className={cn(
                'relative rounded-md p-4 transition-all duration-200 cursor-default',
                hovered === i && 'translate-y-[-1px]'
              )}
              style={{
                background: hovered === i ? '#fff' : '#fafafa',
                border: `1px solid ${hovered === i ? '#059669' : '#e2e8f0'}`,
                boxShadow: hovered === i ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* 引用符号 */}
              <Quote size={14} className="mb-2 opacity-20" style={{ color: '#059669' }} />

              {/* 星级 — 空心描边风格（学术克制） */}
              <div className="flex items-center gap-0.5 mb-2.5">
                {[...Array(t.rating)].map((_, si) => (
                  <Star
                    key={si}
                    size={10}
                    fill="none"
                    stroke="#059669"
                    strokeWidth={1.8}
                  />
                ))}
              </div>

              {/* 引言 */}
              <div className="text-[13px] leading-[1.7] text-slate-600 mb-3 min-h-[60px] lp-quote">
                {t.quote}
              </div>

              {/* 作者 */}
              <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center lp-label text-white shrink-0"
                  style={{ background: t.gradient, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
                >
                  {t.name[0]}
                </div>
                <div>
                  <div className="lp-label font-semibold text-slate-800">{t.name}</div>
                  <div className="text-[9px] text-slate-400">{t.role} · {t.org}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

export default function SocialProof() {
  return (
    <section id="social-proof" className="py-16 lg:py-20" style={{ background: '#fff', borderTop: '1px solid #e2e8f0' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* 标题 */}
        <Reveal>
          <div className="mb-10">
            <span className="lp-section-tag block mb-3">
              信任证明
            </span>
            <h2 className="lp-h2">
              200+ 研发团队信赖
            </h2>
            <p className="text-[13px] leading-relaxed max-w-lg text-slate-600 mt-2">
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
