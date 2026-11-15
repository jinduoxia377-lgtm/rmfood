/**
 * Pipeline 组件 — 「研发全链路」区块
 *
 * 设计依据：docs/marketing/02_设计_区块架构与视觉.md §1.2
 * 文案/i18n：docs/marketing/04_i18n_双语键位方案.md §3.2（pages.landing.pipeline.*）
 *
 * 5 节点横向流程（桌面 flex-row / 移动 flex-col），节点间箭头连接线（右向 / 下向）。
 * 每节点：编号圆（深底白字）+ lucide 图标 + 环节名 + 一句话价值。
 * 配色经 dimensionConfig 渐进（ai→ai→data→data→team），编号圆 700 级深底白字对比充足。
 * 动效走现有 lp-reveal 体系，逐节点 (index%3)+1 错峰，尊重 prefers-reduced-motion。
 */
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowDown } from 'lucide-react';
import { Reveal } from '../shared/Reveal';
import { getPipelineIcon } from '../data/pipeline';
import { dimensionConfig } from '../data/features';
import {
  ariaLabelKey, sectionLabelKey, sectionTitleKey, sectionSubKey, ctaKey,
  deliverablePrefixKey, pipelineSteps,
} from '../data/pipeline';
import type { PipelineStep } from '../data/pipeline';

function PipelineNode({ step, index }: { step: PipelineStep; index: number }) {
  const { t } = useTranslation();
  const cfg = dimensionConfig[step.dimension];
  const IconComp = getPipelineIcon(step.icon);

  return (
    <Reveal delay={`lp-reveal-delay-${(index % 3) + 1}`} className="flex-1 min-w-0">
      <div className="lp-card-white h-full flex flex-col items-center text-center p-[var(--space-apple-lg)]">
        {/* 编号圆：700 级深底白字，对比远超 4.5:1 */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-[14px] font-mono mb-[var(--space-apple-sm)]"
          style={{ background: cfg.primary }}
        >
          {t(step.stepKey)}
        </div>

        {/* 环节图标 */}
        {/* eslint-disable-next-line react-hooks/static-components */}
        <IconComp size={22} strokeWidth={1.8} aria-hidden="true" className="mb-2" style={{ color: cfg.primary }} />

        {/* 环节名 */}
        <h3 className="text-[16px] font-semibold text-neutral-900 mb-1.5">
          {t(step.titleKey)}
        </h3>

        {/* 一句话价值 */}
        <p className="text-[13px] leading-[1.6] text-[var(--text-secondary)]">
          {t(step.descKey)}
        </p>

        {/* 可交付物 chip（浅底深字，呼应"证据链"卖点） */}
        <span
          className="lp-section-tag mt-auto pt-1 px-[var(--space-apple-sm)] py-1 text-[11px] leading-[1.5]"
          style={{ background: cfg.primaryLight, color: cfg.primary, border: `1px solid ${cfg.primaryBorder}` }}
        >
          {t(deliverablePrefixKey)}{t(step.deliverableKey)}
        </span>
      </div>
    </Reveal>
  );
}

/** 节点连接线：桌面右向箭头 / 移动下向箭头，中性色不抢节点主色 */
function Connector() {
  return (
    <div
      className="flex items-center justify-center py-2 lg:py-0 lg:px-1 shrink-0"
      aria-hidden="true"
    >
      <ArrowDown className="lg:hidden" size={20} strokeWidth={1.8} style={{ color: 'var(--color-neutral-300, #d1d5db)' }} />
      <ArrowRight className="hidden lg:block" size={20} strokeWidth={1.8} style={{ color: 'var(--color-neutral-300, #d1d5db)' }} />
    </div>
  );
}

export default function Pipeline() {
  const { t } = useTranslation();

  return (
    <section
      id="pipeline"
      aria-label={t(ariaLabelKey)}
      className="py-16 lg:py-20 bg-neutral-default border-t border-t-neutral-200"
    >
      <div className="max-w-6xl mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8">

        {/* 标题区 */}
        <Reveal>
          <div className="max-w-2xl mb-12">
            <span className="lp-section-tag block mb-[var(--space-apple-sm)]">
              {t(sectionLabelKey)}
            </span>
            <h2 className="lp-h2 mb-[var(--space-apple-md)]">
              {t(sectionTitleKey)}
            </h2>
            <p className="lp-body-sm max-w-lg text-text-muted">
              {t(sectionSubKey)}
            </p>
          </div>
        </Reveal>

        {/* 流程：移动纵向 / 桌面横向 */}
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-2 lg:gap-0">
          {pipelineSteps.map((step, i) => (
            <Fragment key={step.id}>
              <PipelineNode step={step} index={i} />
              {i < pipelineSteps.length - 1 && <Connector />}
            </Fragment>
          ))}
        </div>

        {/* 末端收口 CTA */}
        <div className="mt-10 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-[14px] font-medium hover:underline"
            style={{ color: 'var(--color-primary-700, #047857)' }}
          >
            {t(ctaKey)}
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </div>

      </div>
    </section>
  );
}
