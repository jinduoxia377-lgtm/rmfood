/**
 * Landing Page — 研发全链路数据层
 *
 * 5 环节端到端流程，配色按「研发前段 → 后段」渐进（暗示从研发走向交付）：
 *   1 配方设计 → 'ai'（翡翠绿）
 *   2 安全合规 → 'ai'（翡翠绿）
 *   3 实验验证 → 'data'（靛蓝）
 *   4 COA 出具 → 'data'（靛蓝）
 *   5 学术报告 → 'team'（琥珀）
 *
 * 纯键引用范式：只导出 *Key 常量，组件用 t(key) 取值。
 * 键前缀 pages.landing.pipeline.*。
 * 口径：61 类阈值 / 106 条法定禁忌 / 7 引擎等数字均来自已合规审计文案，不新增数据。
 */
import { LucideProps, FlaskConical, Shield, TestTubes, FileCheck, FileText } from 'lucide-react';
import type { Dimension } from './features';

const P = 'pages.landing.pipeline';

export const ariaLabelKey = `${P}.ariaLabel`;
export const sectionLabelKey = `${P}.sectionLabel`;
export const sectionTitleKey = `${P}.sectionTitle`;
export const sectionSubKey = `${P}.sectionSub`;
export const ctaKey = `${P}.cta`;
/** 可交付物 chip 前缀（如 "可交付："） */
export const deliverablePrefixKey = `${P}.deliverablePrefix`;

export interface PipelineStep {
  id: string;
  /** 展示序号 1–5 */
  order: number;
  /** lucide 图标名 */
  icon: string;
  dimension: Dimension;
  stepKey: string;
  titleKey: string;
  descKey: string;
  /** 可交付物 chip（环节产出物，呼应"证据链"卖点） */
  deliverableKey: string;
}

export const pipelineSteps: PipelineStep[] = [
  {
    id: 'design', order: 1, icon: 'FlaskConical', dimension: 'ai',
    stepKey: `${P}.steps.0.step`, titleKey: `${P}.steps.0.title`, descKey: `${P}.steps.0.desc`,
    deliverableKey: `${P}.steps.0.deliverable`,
  },
  {
    id: 'compliance', order: 2, icon: 'Shield', dimension: 'ai',
    stepKey: `${P}.steps.1.step`, titleKey: `${P}.steps.1.title`, descKey: `${P}.steps.1.desc`,
    deliverableKey: `${P}.steps.1.deliverable`,
  },
  {
    id: 'validation', order: 3, icon: 'TestTubes', dimension: 'data',
    stepKey: `${P}.steps.2.step`, titleKey: `${P}.steps.2.title`, descKey: `${P}.steps.2.desc`,
    deliverableKey: `${P}.steps.2.deliverable`,
  },
  {
    id: 'coa', order: 4, icon: 'FileCheck', dimension: 'data',
    stepKey: `${P}.steps.3.step`, titleKey: `${P}.steps.3.title`, descKey: `${P}.steps.3.desc`,
    deliverableKey: `${P}.steps.3.deliverable`,
  },
  {
    id: 'report', order: 5, icon: 'FileText', dimension: 'team',
    stepKey: `${P}.steps.4.step`, titleKey: `${P}.steps.4.title`, descKey: `${P}.steps.4.desc`,
    deliverableKey: `${P}.steps.4.deliverable`,
  },
];

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  FlaskConical,
  Shield,
  TestTubes,
  FileCheck,
  FileText,
};

/** 根据图标名称字符串获取组件 */
export function getPipelineIcon(name: string) {
  return iconMap[name] ?? FlaskConical;
}
