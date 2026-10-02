/**
 * SocialProof — 信任证明数据层 v9
 *
 * 纯数据文件，不含 JSX。图标通过 getMetricIcon 函数返回 React 元素。
 *
 * 三层结构：
 *   1. 核心指标（大数字）
 *   2. 合作机构（Logo行）
 *   3. 用户评价（引用卡片）
 */
import type { LucideProps } from 'lucide-react';

// ── 核心指标 ──────────────────────────────────────────────────────
export interface TrustMetric {
  icon: string;       // 对应 lucide-react 图标名
  value: string;
  label: string;
  sub?: string;
  color: string;
}

export const trustMetrics: TrustMetric[] = [
  { icon: 'Users',          value: '200+', label: '研发机构',        sub: '入驻平台',            color: 'var(--color-primary-700, #047857)' },
  { icon: 'Zap',            value: '12,000+', label: '日均 AI 请求', sub: '+18% 月增长',       color: 'var(--color-accent-700, #6d28d9)' },
  { icon: 'FileText',       value: '3,800+', label: '配方方案生成',  sub: '已交付文档',         color: 'var(--color-secondary-700, #1d4ed8)' },
  { icon: 'Clock',          value: '72h',   label: '平均研发周期',   sub: '较传统缩短 60%',     color: 'var(--color-warning-700, #b45309)' },
];

// ── 合作机构 ──────────────────────────────────────────────────────
export interface PartnerOrg {
  name: string;
  category: 'university' | 'hospital' | 'enterprise' | 'government';
}

export const partnerOrgs: PartnerOrg[] = [
  { name: '广东中医药大学',   category: 'university'    },
  { name: '上海医药工业研究院', category: 'government'  },
  { name: '同仁堂健康',        category: 'enterprise'   },
  { name: '华佗国医馆',        category: 'hospital'     },
  { name: '云南白药集团',      category: 'enterprise'   },
  { name: '中国食品药品检定研究院', category: 'government' },
];

// ── 用户评价 ──────────────────────────────────────────────────────
export interface Testimonial {
  name: string;
  role: string;
  org: string;
  quote: string;
  rating: number;
  gradient: string;
}

export const testimonials: Testimonial[] = [
  {
    name: '张明远',
    role: '高级研究员',
    org: '广东中医药大学生药学院',
    quote: 'AI 配方对话将原料筛选时间从 3 天缩短到 20 分钟，知识图谱的关联推理帮我们发现了以前忽略的配伍规律。',
    rating: 5,
    /* P0 对比度修复：白字落点色改为 800/900 级，保证 #fff 对比 ≥4.5:1
   （原 500/400 级中点 var(--color-success-500, #10b981)/var(--color-secondary-400, #60a5fa)/var(--color-accent-400, #a78bfa) 对白字仅 2.2–2.9:1） */
gradient: 'linear-gradient(135deg, var(--color-primary-800, #065f46), var(--color-primary-700, #047857))',
  },
  {
    name: '李思涵',
    role: '研发总监',
    org: '同仁堂健康药业',
    quote: '合规引擎让配方审核一次通过率从 60% 提升到 92%，极大地减少了反复修改的成本。',
    rating: 5,
    gradient: 'linear-gradient(135deg, var(--color-secondary-800, #1e40af), var(--color-secondary-700, #1d4ed8))',
  },
  {
    name: '王浩然',
    role: '博士后',
    org: '上海医药工业研究院',
    quote: '肽序列 ADME 预测准确率超过 94%，为新产品管线筛选提供了量化依据，是团队不可或缺的工具。',
    rating: 5,
    gradient: 'linear-gradient(135deg, var(--color-accent-800, #5b21b6), var(--color-accent-700, #6d28d9))',
  },
];

// ── 合作机构分类标签样式 ──────────────────────────────────────────
export const categoryStyle: Record<string, { bg: string; text: string; border: string }> = {
  university:  { bg: 'var(--color-success-50, #ecfdf5)', text: 'var(--color-primary-700, #047857)', border: 'var(--color-success-200, #a7f3d0)' },
  hospital:    { bg: 'var(--color-danger-50, #fef2f2)', text: 'var(--color-danger-700, #b91c1c)', border: 'var(--color-danger-200, #fecaca)'  },
  enterprise:  { bg: 'var(--color-secondary-50, #eff6ff)', text: 'var(--color-secondary-700, #1d4ed8)', border: 'var(--color-secondary-200, #bfdbfe)' },
  government:  { bg: 'var(--color-accent-50, #f5f3ff)', text: 'var(--color-accent-700, #6d28d9)', border: 'var(--color-accent-200, #ddd6fe)' },
};

export const categoryLabel: Record<string, string> = {
  university:  '高校',
  hospital:    '医院',
  enterprise:  '企业',
  government:  '政府',
};
