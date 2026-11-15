/**
 * Landing Page — 定价方案数据（i18n 键引用版）
 *
 * 显示文本全部通过 `pages.landing.pricing.plans.<id>.*` 键取 i18n 值；
 * `name` 为稳定机器 id（free/pro/enterprise），仅用于逻辑判断与 React key。
 */
export interface PlanFeature {
  textKey: string;
  included: boolean;
}

export interface PricingPlan {
  name: 'free' | 'pro' | 'enterprise';
  nameKey: string;
  descKey: string;
  priceMonthly: string;
  priceYearly: string;
  ctaKey: string;
  popular?: boolean;
  features: PlanFeature[];
}

const P = 'pages.landing.pricing.plans';

export const sectionLabelKey = 'pages.landing.pricing.sectionLabel';

export const sectionTitleKey = 'pages.landing.pricing.sectionTitle';

export const sectionSubKey = 'pages.landing.pricing.sectionSub';

export const plans: PricingPlan[] = [
  {
    name: 'free',
    nameKey: `${P}.free.name`,
    descKey: `${P}.free.desc`,
    priceMonthly: '免费',
    priceYearly: '免费',
    ctaKey: `${P}.free.cta`,
    features: [
      { textKey: `${P}.free.features.0`, included: true },
      { textKey: `${P}.free.features.1`, included: true },
      { textKey: `${P}.free.features.2`, included: true },
      { textKey: `${P}.free.features.3`, included: true },
      { textKey: `${P}.free.features.4`, included: true },
      { textKey: `${P}.free.features.5`, included: false },
      { textKey: `${P}.free.features.6`, included: false },
      { textKey: `${P}.free.features.7`, included: false },
    ],
  },
  {
    name: 'pro',
    nameKey: `${P}.pro.name`,
    descKey: `${P}.pro.desc`,
    priceMonthly: '¥199',
    priceYearly: '¥1,999',
    ctaKey: `${P}.pro.cta`,
    popular: true,
    features: [
      { textKey: `${P}.pro.features.0`, included: true },
      { textKey: `${P}.pro.features.1`, included: true },
      { textKey: `${P}.pro.features.2`, included: true },
      { textKey: `${P}.pro.features.3`, included: true },
      { textKey: `${P}.pro.features.4`, included: true },
      { textKey: `${P}.pro.features.5`, included: true },
      { textKey: `${P}.pro.features.6`, included: true },
      { textKey: `${P}.pro.features.7`, included: true },
    ],
  },
  {
    name: 'enterprise',
    nameKey: `${P}.enterprise.name`,
    descKey: `${P}.enterprise.desc`,
    priceMonthly: '¥19,990/年起',
    priceYearly: '¥19,990/年起',
    ctaKey: `${P}.enterprise.cta`,
    features: [
      { textKey: `${P}.enterprise.features.0`, included: true },
      { textKey: `${P}.enterprise.features.1`, included: true },
      { textKey: `${P}.enterprise.features.2`, included: true },
      { textKey: `${P}.enterprise.features.3`, included: true },
      { textKey: `${P}.enterprise.features.4`, included: true },
      { textKey: `${P}.enterprise.features.5`, included: true },
      { textKey: `${P}.enterprise.features.6`, included: true },
    ],
  },
];
