/**
 * Features 组件 v9 — 学术卡片风格（升级 v9）
 *
 * 升级要点（v9）：
 *   - 卡片间距 gap-3 → gap-5，增加呼吸感
 *   - 卡片 padding p-5 → p-6
 *   - 圆角 rounded-sm → rounded-md
 *   - 移除 techLabel 展示（非技术决策者无意义）
 *   - 第一排 AI 能力卡片增加"核心能力"角标
 */
import { useState } from 'react';
import { getFeatureIcon } from '../data/features';
import { Reveal } from '../shared/Reveal';
import { cn } from '@/lib/utils';
import {
  sectionLabel, sectionTitle, sectionDesc, features, dimensionConfig,
} from '../data/features';
import type { Dimension } from '../data/features';
import { Sparkles } from 'lucide-react';

const dimensionOrder: Dimension[] = ['ai', 'data', 'team'];
const coreFeatureIds = new Set(['ai-chat', 'multi-opt', 'safety']);

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const [hovered, setHovered] = useState(false);
  const cfg = dimensionConfig[feature.dimension];
  const IconComp = getFeatureIcon(feature.icon);
  const isCore = coreFeatureIds.has(feature.id);

  return (
    <Reveal delay={`lp-reveal-delay-${(index % 3) + 1}`}>
      <div
        className="lp-card-white relative overflow-hidden transition-all duration-200 cursor-default"
        style={{
          border: `1px solid ${hovered ? cfg.primary : 'var(--border-color, #e2e8f0)'}`,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* 核心能力角标 */}
        {isCore && (
          <div
            className="absolute top-0 right-0 px-2 py-0.5 text-[12px] font-semibold uppercase tracking-wider"
            style={{ background: '#047857', color: '#fff' }}
          >
            核心
          </div>
        )}

        <div className="p-6">
          {/* 头部：图标 + 标题行 */}
          <div className="flex items-start gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: cfg.primaryLight, color: cfg.primary, border: `1px solid ${cfg.primaryBorder}` }}
            >
              <IconComp size={15} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-[15px] font-bold text-slate-900">{feature.title}</h3>
                {feature.keyMetric && (
                  <span className="lp-caption font-mono shrink-0" style={{ color: '#047857' }}>{feature.keyMetric}</span>
                )}
              </div>
              <span className="text-[12px] text-slate-500">{feature.tag}</span>
            </div>
          </div>

          {/* 描述 */}
          <p className="text-[13px] leading-relaxed text-neutral-600 mb-4 min-h-[52px]">
            {feature.desc}
          </p>

          {/* 流程步骤（编号列表） */}
          {feature.steps && feature.steps.length > 0 && (
            <ol className="lp-numbered">
              {feature.steps.map((step, i) => (
                <li key={step.label} className="text-[12px] text-slate-600 leading-relaxed">
                  <span className="font-medium text-slate-700">{step.label}</span>
                  {step.detail && <span className="text-slate-500 ml-1">— {step.detail}</span>}
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
        className="lp-section-tag px-3 py-1.5 shrink-0"
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
    <section id="features" className="py-20 lg:py-24" style={{ background: 'var(--bg-canvas, #f8fafc)', borderTop: '1px solid #e2e8f0' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* 标题区 */}
        <Reveal>
          <div className="max-w-2xl mb-12">
            <span className="lp-section-tag block mb-3">
              {sectionLabel}
            </span>
            <h2 className="lp-h2 mb-4">
              {titleLines.map((line, i) => <span key={i}>{line}{i < titleLines.length - 1 && <br />} </span>)}
            </h2>
            <p className="lp-body-sm max-w-lg" style={{ color: '#475569' }}>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
