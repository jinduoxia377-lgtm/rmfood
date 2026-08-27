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
  { icon: 'Users',          value: '200+', label: '研发机构',        sub: '入驻平台',            color: '#059669' },
  { icon: 'Zap',            value: '12,000+', label: '日均 AI 请求', sub: '+18% 月增长',       color: '#7c3aed' },
  { icon: 'FileText',       value: '3,800+', label: '配方方案生成',  sub: '已交付文档',         color: '#2563eb' },
  { icon: 'Clock',          value: '72h',   label: '平均研发周期',   sub: '较传统缩短 60%',     color: '#d97706' },
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
    gradient: 'linear-gradient(135deg, #059669, #34d399)',
  },
  {
    name: '李思涵',
    role: '研发总监',
    org: '同仁堂健康药业',
    quote: '合规引擎让配方审核一次通过率从 60% 提升到 92%，极大地减少了反复修改的成本。',
    rating: 5,
    gradient: 'linear-gradient(135deg, #2563eb, #60a5fa)',
  },
  {
    name: '王浩然',
    role: '博士后',
    org: '上海医药工业研究院',
    quote: '肽序列 ADME 预测准确率超过 94%，为新产品管线筛选提供了量化依据，是团队不可或缺的工具。',
    rating: 5,
    gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
  },
];

// ── 合作机构分类标签样式 ──────────────────────────────────────────
export const categoryStyle: Record<string, { bg: string; text: string; border: string }> = {
  university:  { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  hospital:    { bg: '#fef2f2', text: '#dc2626', border: '#fecaca'  },
  enterprise:  { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  government:  { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
};

export const categoryLabel: Record<string, string> = {
  university:  '高校',
  hospital:    '医院',
  enterprise:  '企业',
  government:  '政府',
};
