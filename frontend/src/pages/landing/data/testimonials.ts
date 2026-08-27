/**
 * Landing Page — 客户评价数据
 */
export interface Testimonial {
  text: string;
  author: string;
  role: string;
}

export interface PartnerOrg {
  name: string;
}

export const sectionLabel = '客户评价';

export const sectionTitle = '一线研发团队的真实反馈';

export const testimonials: Testimonial[] = [
  {
    text: '配方生成效率提升了约四成，合规检查帮我们规避了多次潜在的配伍风险。',
    author: '张研究员',
    role: '某中医药大学食品科学实验室',
  },
  {
    text: '知识图谱检索极大缩短了中药材筛选时间，多目标优化生成的方案质量超出预期。',
    author: '李工程师',
    role: '某功能性食品企业研发总监',
  },
];

export const partnerOrgs: PartnerOrg[] = [
  { name: '某中医药大学' },
  { name: '某省级食品药品研究院' },
  { name: '某保健食品龙头企业' },
  { name: '某三甲医院营养科' },
];
