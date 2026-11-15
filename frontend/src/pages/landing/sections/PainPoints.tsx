/**
 * PainPoints 组件 — 「痛点共鸣」区块
 *
 * 设计依据：docs/marketing/02_设计_区块架构与视觉.md §1.1
 * 文案/i18n：docs/marketing/04_i18n_双语键位方案.md §3.1（pages.landing.painPoints.*）
 *
 * 4 层信息层级：图标 → tag（行业卡点）→ 痛点标题 → 共情描述。
 * 复用 Features 的卡片语言（lp-card-white / dimensionConfig 700 级深色 / Reveal 错峰）。
 * 配色只引用现有 CSS 变量（经 dimensionConfig），文本对比度满足 WCAG AA 4.5:1。
 * 响应式：<480px 单列，480px–lg 两列，lg+ 三列。
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Reveal } from '../shared/Reveal';
import { getFeatureIcon, dimensionConfig } from '../data/features';
import {
  ariaLabelKey, sectionLabelKey, sectionTitleKey, sectionSubKey, painItems,
} from '../data/painPoints';
import type { PainItem } from '../data/painPoints';

function PainCard({ item, index }: { item: PainItem; index: number }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const cfg = dimensionConfig[item.dimension];
  const IconComp = getFeatureIcon(item.icon);

  return (
    <Reveal delay={`lp-reveal-delay-${(index % 3) + 1}`}>
      <div
        className="lp-card-white h-full transition-all duration-200 cursor-default"
        style={{
          border: `1px solid ${hovered ? cfg.primary : 'var(--border-color, #e2e8f0)'}`,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="p-[var(--space-apple-lg)]">
          {/* 图标（视觉锚点） */}
          <div
            className="w-8 h-8 rounded-[var(--radius-Apple-sm)] flex items-center justify-center shrink-0 mb-[var(--space-apple-sm)]"
            style={{ background: cfg.primaryLight, color: cfg.primary, border: `1px solid ${cfg.primaryBorder}` }}
          >
            {/* eslint-disable-next-line react-hooks/static-components */}
            <IconComp size={15} strokeWidth={1.8} aria-hidden="true" />
          </div>

          {/* 行业卡点标签 */}
          <span
            className="inline-block lp-section-tag px-[var(--space-apple-sm)] py-1 mb-2"
            style={{ background: cfg.primaryLight, color: cfg.primary, border: `1px solid ${cfg.primaryBorder}` }}
          >
            {t(item.tagKey)}
          </span>

          {/* 痛点标题（一句话戳中） */}
          <h3 className="text-[18px] font-semibold text-neutral-900 mb-[var(--space-apple-sm)]">
            {t(item.titleKey)}
          </h3>

          {/* 共情描述（展开场景） */}
          <p className="text-[14px] leading-[1.7] text-[var(--text-secondary)]">
            {t(item.descKey)}
          </p>

          {/* 转折句（问题 → 解药收口，左色条 + primary 引导符） */}
          <div
            className="mt-[var(--space-apple-md)] pt-[var(--space-apple-sm)] border-l-2 pl-[var(--space-apple-sm)]"
            style={{ borderColor: cfg.primary }}
          >
            <p className="text-[14px] font-medium leading-[1.6] text-[var(--text-primary)]">
              <span aria-hidden="true" style={{ color: cfg.primary }}>→ </span>
              {t(item.turnKey)}
            </p>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export default function PainPoints() {
  const { t } = useTranslation();

  return (
    <section
      id="pain-points"
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

        {/* 三卡等宽网格（移动单列 / 平板两列 / 桌面三列） */}
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-5">
          {painItems.map((item, i) => (
            <PainCard key={item.id} item={item} index={i} />
          ))}
        </div>

      </div>
    </section>
  );
}
