/**
 * Landing Page — 应用场景数据层 v8
 *
 * 三个真实研发场景，每个有独立品牌色和专属工作流：
 *   scenario: 'tcm'   → 药食同源配方研发（翡翠绿）
 *   scenario: 'peptide'→ 生物活性肽设计（靛蓝）
 *   scenario: 'eln'   → 实验数据管理（琥珀金）
 */
import type { LucideProps } from 'lucide-react';

export type Scenario = 'tcm' | 'peptide' | 'eln';

export interface UseCaseItem {
  id: string;
  icon: string;
  title: string;
  desc: string;
  /** 工作流步骤 */
  workflow: { label: string; detail: string }[];
  /** 场景专属指标（真实意义） */
  metrics: { label: string; value: string; unit?: string }[];
  ctaText: string;
}

export const sectionLabel = '应用场景';
export const sectionTitle = '为真实研发场景而生';
export const sectionDesc = '覆盖药食同源配方研发、生物活性肽设计、实验数据管理三大核心场景，AI 赋能全流程。';

/** 各场景品牌配置
 * P0 修复：primary 用于 12px+ 文本与图标色，需 WCAG AA 4.5:1 → 700 级深色。
 * gradient 保留装饰色阶（非文本用途）。
 */
export const scenarioConfig: Record<Scenario, {
  primary: string;
  primaryLight: string;
  primaryBorder: string;
  primaryRGB: string;
  gradient: string;
  metricBg: string;
}> = {
  tcm: {
    primary: '#047857',
    primaryLight: '#ecfdf5',
    primaryBorder: '#a7f3d0',
    primaryRGB: '5,150,105',
    gradient: 'linear-gradient(135deg, #047857, #10b981, #34d399)',
    metricBg: '#ecfdf5',
  },
  peptide: {
    primary: '#1d4ed8',
    primaryLight: '#eff6ff',
    primaryBorder: '#bfdbfe',
    primaryRGB: '37,99,235',
    gradient: 'linear-gradient(135deg, #1d4ed8, #3b82f6, #60a5fa)',
    metricBg: '#eff6ff',
  },
  eln: {
    primary: '#b45309',
    primaryLight: '#fffbeb',
    primaryBorder: '#fde68a',
    primaryRGB: '217,119,6',
    gradient: 'linear-gradient(135deg, #b45309, #f59e0b, #fbbf24)',
    metricBg: '#fffbeb',
  },
};

export const useCases: (UseCaseItem & { scenario: Scenario })[] = [
  {
    id: 'tcm',
    scenario: 'tcm',
    icon: 'Microscope',
    title: '药食同源配方研发',
    desc: '基于 TCMSP 与药食同源知识图谱，AI 辅助快速筛选原料组合，自动生成包含剂量建议与配伍禁忌标注的完整配方报告，一键导出 GLP 合规文档。',
    workflow: [
      { label: '原料筛选', detail: 'TCMSP 16版 · 29,361味药材' },
      { label: '配伍推理', detail: 'Neo4j 知识图谱 · 128K节点' },
      { label: '合规校验', detail: '卫健委目录 · 实时同步' },
      { label: '报告生成', detail: 'DOCX/PDF · GLP 模板' },
    ],
    metrics: [
      { label: '药材库', value: '29,361', unit: '味' },
      { label: '配伍规则', value: '1,240', unit: '条' },
      { label: '日均方案', value: '860', unit: '组' },
    ],
    ctaText: '查看配方研发',
  },
  {
    id: 'peptide',
    scenario: 'peptide',
    icon: 'Bot',
    title: '生物活性肽设计',
    desc: '从食物蛋白序列预测活性肽片段，RDKit + PyTorch 管线完成 ADMET 评估、毒性致敏性分析及理性突变设计，加速功能性肽产品研发周期。',
    workflow: [
      { label: '序列预测', detail: 'PepINVENT 引擎 · RDKit' },
      { label: '结构分析', detail: '二级结构 · 理化性质' },
      { label: 'ADMET', detail: '吸收/分布/代谢/排泄/毒性' },
      { label: '优化迭代', detail: '亲和性 · 突变设计' },
    ],
    metrics: [
      { label: '活性肽库', value: '5,200+', unit: '结构' },
      { label: '预测准确率', value: '94.2', unit: '%' },
      { label: '优化迭代', value: '3-5', unit: '轮/项目' },
    ],
    ctaText: '了解肽设计',
  },
  {
    id: 'eln',
    scenario: 'eln',
    icon: 'BarChart3',
    title: '实验数据管理',
    desc: '电子实验记录本 (ELN) 标准化实验流程，自动解析 HPLC/GC/MS 原始数据，支持多租户协作与变更审计追踪，一键生成符合 NMPA 申报要求的完整实验报告。',
    workflow: [
      { label: '实验记录', detail: '结构化模板 · 版本控制' },
      { label: '数据解析', detail: 'HPLC/GC/MS 自动导入' },
      { label: '统计分析', detail: '趋势分析 · 异常检测' },
      { label: '报告导出', detail: 'NMPA 格式 · 审计追溯' },
    ],
    metrics: [
      { label: 'GLP 报告', value: '100', unit: '% 覆盖' },
      { label: '审计追溯', value: '全量', unit: '留痕' },
      { label: '协作团队', value: '50+', unit: '机构' },
    ],
    ctaText: '查看实验管理',
  },
];
