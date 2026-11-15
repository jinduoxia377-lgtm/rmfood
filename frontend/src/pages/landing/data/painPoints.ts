/**
 * Landing Page — 痛点共鸣数据层
 *
 * 3 张痛点卡，复用 features.ts 的 dimension 配色（问题 → 解药同色呼应）：
 *   卡 1 依据 → dimension 'data'（靛蓝）
 *   卡 2 合规 → dimension 'ai'（翡翠绿）
 *   卡 3 交付 → dimension 'team'（琥珀）
 *
 * 纯键引用范式（对齐 data/pricing.ts / data/faqs.ts）：
 * 只导出稳定 *Key 字符串常量，组件用 t(key) 取值，不硬编码文案。
 * 键前缀 pages.landing.painPoints.*（落地页迁移到正确的 pages.landing.* 命名）。
 */
import type { Dimension } from './features';

const P = 'pages.landing.painPoints';

export const ariaLabelKey = `${P}.ariaLabel`;
export const sectionLabelKey = `${P}.sectionLabel`;
export const sectionTitleKey = `${P}.sectionTitle`;
export const sectionSubKey = `${P}.sectionSub`;

export interface PainItem {
  id: string;
  /** lucide 图标名，复用 features.ts 的 getFeatureIcon（Database / Shield / GitBranch） */
  icon: string;
  /** 复用 features.ts 三维配色语义 */
  dimension: Dimension;
  tagKey: string;
  titleKey: string;
  descKey: string;
  /** 转折句（引向平台能力，把痛点收口到"有解"） */
  turnKey: string;
}

export const painItems: PainItem[] = [
  {
    id: 'rationale',
    icon: 'Database',
    dimension: 'data',
    tagKey: `${P}.items.0.tag`,
    titleKey: `${P}.items.0.title`,
    descKey: `${P}.items.0.desc`,
    turnKey: `${P}.items.0.turn`,
  },
  {
    id: 'compliance',
    icon: 'Shield',
    dimension: 'ai',
    tagKey: `${P}.items.1.tag`,
    titleKey: `${P}.items.1.title`,
    descKey: `${P}.items.1.desc`,
    turnKey: `${P}.items.1.turn`,
  },
  {
    id: 'delivery',
    icon: 'GitBranch',
    dimension: 'team',
    tagKey: `${P}.items.2.tag`,
    titleKey: `${P}.items.2.title`,
    descKey: `${P}.items.2.desc`,
    turnKey: `${P}.items.2.turn`,
  },
];
