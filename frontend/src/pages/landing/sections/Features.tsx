/**
 * Features 组件 v8 — 学术卡片风格
 *
 * 设计理念：
 *   - 去渐变、去发光、去旋转动画
 *   - 卡片如论文摘要，信息密度高
 *   - 编号列表替代步骤按钮
 *   - 单一绿色作为唯一强调色
 */
import { useState } from 'react';
import { getFeatureIcon } from '../data/features';
import { Reveal } from '../shared/Reveal';
import { cn } from '@/lib/utils';
import {
  sectionLabel, sectionTitle, sectionDesc, features, dimensionConfig,
} from '../data/features';
import type { Dimension } from '../data/features';

const dimensionOrder: Dimension[] = ['ai', 'data', 'team'];

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const [hovered, setHovered] = useState(false);
  const cfg = dimensionConfig[feature.dimension];
  const IconComp = getFeatureIcon(feature.icon);

  return (
    <Reveal delay={`lp-reveal-delay-${(index % 3) + 1}`}>
      <div
        className="relative rounded-sm overflow-hidden transition-all duration-200 cursor-default"
        style={{
          background: hovered ? '#fff' : '#fafafa',
          border: `1px solid ${hovered ? cfg.primary : '#e2e8f0'}`,
          boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="p-5">
          {/* 头部：图标 + 标题行 */}
          <div className="flex items-start gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: cfg.primaryLight, color: cfg.primary, border: `1px solid ${cfg.primaryBorder}` }}
            >
              <IconComp size={15} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-[14px] font-bold text-slate-900">{feature.title}</h3>
                {feature.keyMetric && (
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">{feature.keyMetric}</span>
                )}
              </div>
              <span className="text-[10px] text-slate-400">{feature.tag}</span>
            </div>
          </div>

          {/* 描述 */}
          <p className="text-[13px] leading-relaxed text-slate-600 mb-4 min-h-[52px]">
            {feature.desc}
          </p>

          {/* 技术标签 */}
          {feature.techLabel && (
            <div className="flex items-center gap-1.5 mb-4 pt-3 border-t border-slate-100">
              <div className="w-1 h-1 rounded-full" style={{ background: cfg.primary }} />
              <span className="text-[10px] font-mono text-slate-400">{feature.techLabel}</span>
            </div>
          )}

          {/* 流程步骤（编号列表） */}
          {feature.steps && feature.steps.length > 0 && (
            <ol className="lp-numbered">
              {feature.steps.map((step, i) => (
                <li key={step.label} className="text-[12px] text-slate-500 leading-relaxed">
                  <span className="font-medium text-slate-700">{step.label}</span>
                  {step.detail && <span className="text-slate-400 ml-1">— {step.detail}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Reveal>
  );
}

function DimensionHeader({ dimension }: { dimension: Dimension }) {
  const cfg = dimensionConfig[dimension];
  const labels: Record<Dimension, string> = { ai: '智能研发', data: '数据能力', team: '企业协作' };

  return (
    <div className="mb-6">
      <span
        className="text-[10px] font-semibold uppercase tracking-widest px-3 py-1.5 shrink-0"
        style={{ background: cfg.primaryLight, color: cfg.primary, border: `1px solid ${cfg.primaryBorder}` }}
      >
        {labels[dimension]}
      </span>
    </div>
  );
}

export default function Features() {
  const titleLines = sectionTitle.split('\n');

  return (
    <section id="features" className="py-20 lg:py-24" style={{ background: '#fff' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* 标题区 */}
        <Reveal>
          <div className="max-w-2xl mb-12">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-3">
              {sectionLabel}
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.15] mb-4 tracking-tight text-slate-900"
                style={{ fontFamily: 'var(--font-sans)' }}>
              {titleLines.map((line, i) => <span key={i}>{line}{i < titleLines.length - 1 && <br />} </span>)}
            </h2>
            <p className="text-[14px] leading-[1.75] text-slate-600 max-w-lg">
              {sectionDesc}
            </p>
          </div>
        </Reveal>

        {/* 按维度分组 */}
        {dimensionOrder.map((dim, dimIdx) => {
          const dimFeatures = features.filter(f => f.dimension === dim);
          return (
            <div key={dim} className="mb-10 last:mb-0">
              <DimensionHeader dimension={dim} />
              <div className={cn(
                'grid gap-3',
                dim === 'ai' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
                dim === 'data' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2' :
                'grid-cols-1 md:grid-cols-2 lg:grid-cols-1 max-w-2xl'
              )}>
                {dimFeatures.map((f, i) => (
                  <FeatureCard key={f.id} feature={f} index={dimIdx * 3 + i} />
                ))}
              </div>
            </div>
          );
        })}

      </div>
    </section>
  );
}
