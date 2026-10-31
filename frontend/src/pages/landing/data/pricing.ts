/**
 * Landing Page — 定价方案数据
 *
 * v2 优化：
 *   - 增强方案描述，突出差异化价值
 *   - 免费版限制合理化，体现专业价值
 *   - 专业版增加"性价比"价值说明
 *   - CTA 文案更具行动导向
 */
export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface PricingPlan {
  name: string;
  desc: string;
  priceMonthly: string;
  priceYearly: string;
  cta: string;
  popular?: boolean;
  features: PlanFeature[];
}

export const sectionLabel = '定价方案';

export const sectionTitle = '透明的定价';

export const sectionSub = '科研版永久免费，按需升级，30 天无理由退款。';

export const plans: PricingPlan[] = [
  {
    name: '科研版',
    desc: '个人研究者与小型课题组起步首选',
    priceMonthly: '免费',
    priceYearly: '免费',
    cta: '免费注册',
    features: [
      { text: '3 个配方项目', included: true },
      { text: '每日 20 次 AI 对话', included: true },
      { text: 'TCMSP 中药材基础检索', included: true },
      { text: '基础实验记录与导出', included: true },
      { text: '社区技术支持', included: true },
      { text: 'DFFP 活性肽数据库', included: false },
      { text: '安全合规引擎', included: false },
      { text: '团队协作 >3 人', included: false },
    ],
  },
  {
    name: '专业版',
    desc: '中型研发团队与实验室日常使用',
    priceMonthly: '¥299',
    priceYearly: '¥2,899',
    cta: '免费试用 14 天',
    popular: true,
    features: [
      { text: '无限配方项目', included: true },
      { text: '每日 200 次 AI 对话', included: true },
      { text: 'TCMSP + DFBP 全库检索', included: true },
      { text: '肽序列深度分析', included: true },
      { text: '安全合规引擎', included: true },
      { text: '团队协作 ≤10 人', included: true },
      { text: '实验数据可视化', included: true },
      { text: '邮件优先技术支持', included: true },
    ],
  },
  {
    name: '企业版',
    desc: '大型企业与多团队协作，私有化部署',
    priceMonthly: '联系销售',
    priceYearly: '联系销售',
    cta: '获取定制方案',
    features: [
      { text: '全部专业版功能', included: true },
      { text: '多租户组织架构', included: true },
      { text: 'SSO / LDAP 集成', included: true },
      { text: '私有化部署', included: true },
      { text: '7×24 专属技术支持', included: true },
      { text: 'SLA 99.9% 保障', included: true },
      { text: '定制开发服务', included: true },
    ],
  },
];