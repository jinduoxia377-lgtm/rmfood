/**
 * Landing Page — FAQ 数据（i18n 键引用版）
 *
 * 问答文本全部通过 `pages.landing.faq.items.<i>.{q,a}` 键取 i18n 值；
 * `qKey`/`aKey` 为稳定键，供 FAQ.tsx 渲染与 SEO.tsx JSON-LD 读取。
 */
export interface FAQItem {
  qKey: string;
  aKey: string;
}

const F = 'pages.landing.faq.items';

export const sectionLabelKey = 'pages.landing.faq.sectionLabel';

export const faqs: FAQItem[] = Array.from({ length: 8 }, (_, i) => ({
  qKey: `${F}.${i}.q`,
  aKey: `${F}.${i}.a`,
}));
