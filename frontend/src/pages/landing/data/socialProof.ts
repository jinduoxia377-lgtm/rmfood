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

// ── 核心指标 ──────────────────────────────────────────────────────
export interface TrustMetric {
  icon: string;       // 对应 lucide-react 图标名
  value: string;
  label: string;
  sub?: string;
  color: string;
}

/** 平台指标（最保守默认）
 * 合规说明（口径已定，非待办）：
 *   已移除「研发机构 9」「累计 AI 调用 41」「配方方案 12」三条内部统计——
 *   量级过小反削弱可信度，且为易过期的运营快照数据。仅保留有据的
 *   「优化算法引擎 7」（已实现的算法数量，属能力描述，非运营绩效）。
 *   如需恢复须有真实、可公开、可持续更新的运营数据并经法务书面复核。
 * 本文件全部「合规口径（已定，非待办）」条目依据 docs/marketing/05 D2/D3/D6 与 03 审计矩阵落地；如需改变对外宣称须经法务书面复核。
 */
export const trustMetrics: TrustMetric[] = [
  { icon: 'Clock',          value: '7',     label: '优化算法引擎',    sub: '已实现',            color: 'var(--color-warning-700, #b45309)' },
];

// ── 合作机构 ──────────────────────────────────────────────────────
export interface PartnerOrg {
  name: string;
  category: 'university' | 'hospital' | 'enterprise' | 'government';
}

/** 合作伙伴（匿名化示例，避免冒用真实机构名义；如需展示具体机构须取得书面授权）
 * 说明：以下为"示例/匿名"合作伙伴标识，不构成对任何真实机构的合作背书。
 */
export const partnerOrgs: PartnerOrg[] = [
  { name: '某中医药大学',     category: 'university'    },
  { name: '某省级食品药品研究院', category: 'government'  },
  { name: '某保健食品企业',    category: 'enterprise'   },
  { name: '某三甲医院营养科',  category: 'hospital'     },
  { name: '某中药企业',        category: 'enterprise'   },
  { name: '某药检机构',        category: 'government'   },
  { name: '某中医药院校',      category: 'university'    },
  { name: '某医药集团',        category: 'enterprise'   },
];

/** 合作机构免责文案 i18n key（口径已定，非待办）
 * 供区块（SocialProof）在合作机构列表紧邻处渲染，明确以下为匿名示例。
 * 值为 i18n 键名，组件用 t(PARTNER_ORGS_DISCLAIMER_KEY) 取本地化文案。
 */
export const PARTNER_ORGS_DISCLAIMER_KEY = 'pages.landing.disclaimers.partnerOrgs';

// ── 用户评价 ──────────────────────────────────────────────────────
export interface Testimonial {
  name: string;
  role: string;
  org: string;
  quote: string;
  // 合规口径（已定，非待办）：已移除 rating 字段——不给示意性文案打满分（避免"5 星好评"暗示真实评价）。
  // 如后续恢复真实用户评分，须经法务确认并补用户授权。
  gradient: string;
}

export const testimonials: Testimonial[] = [
  {
    name: '张研究员',
    role: '高级研究员',
    org: '某中医药大学',
    // 合规口径（已定，非待办）：能力描述，已移除"从数天缩短到数十分钟"未验证绩效承诺。
    quote: 'AI 配方对话提供原料筛选与知识图谱关联推理能力，帮助梳理配伍规律、辅助研究思路。',
    /* P0 对比度修复：白字落点色改为 800/900 级，保证 #fff 对比 ≥4.5:1
   （原 500/400 级中点 var(--color-success-500, #10b981)/var(--color-secondary-400, #60a5fa)/var(--color-accent-400, #a78bfa) 对白字仅 2.2–2.9:1） */
gradient: 'linear-gradient(135deg, var(--color-primary-800, #065f46), var(--color-primary-700, #047857))',
  },
  {
    name: '李工程师',
    role: '研发总监',
    org: '某保健食品企业',
    // 合规口径（已定，非待办）：降级为能力描述，已移除"一次通过率明显提升""周期显著缩短"未验证绩效承诺。
    quote: '合规引擎提供配伍禁忌检测与合规校验能力，辅助团队在研发阶段自查、复核配方。',
    gradient: 'linear-gradient(135deg, var(--color-secondary-800, #1e40af), var(--color-secondary-700, #1d4ed8))',
  },
  {
    name: '王博士',
    role: '博士后',
    org: '某科研院所',
    quote: '肽序列 ADME 预测为候选肽初筛提供参考，NSGA-III 多目标优化可辅助完成配方的协同效应排序。',
    gradient: 'linear-gradient(135deg, var(--color-accent-800, #5b21b6), var(--color-accent-700, #6d28d9))',
  },
  {
    name: '陈医师',
    role: '临床营养科主治医师',
    org: '某医院营养科',
    // 合规口径（已定，非待办）：已移除疗效/临床效果暗示（"患者接受度明显提高"），改为纯功能性描述。
    quote: '平台提供配伍禁忌检测与剂量参考功能，辅助我在制定食疗方案时核对配伍与用量。',
    gradient: 'linear-gradient(135deg, var(--color-danger-800, #991b1b), var(--color-danger-700, #b91c1c))',
  },
  {
    name: '刘工',
    role: '联合创始人',
    org: '某初创企业',
    // 合规口径（已定，非待办）：降级为能力描述，已移除"大幅缩短了知识积累阶段"未验证绩效承诺。
    quote: '平台的 AI 对话提供药食同源知识检索与梳理能力，可作为小团队研发起步阶段的辅助参考。',
    gradient: 'linear-gradient(135deg, var(--color-warning-800, #92400e), var(--color-warning-700, #b45309))',
  },
];

/** 用户评价免责文案 i18n key（口径已定，非待办）
 * 供区块（SocialProof）在评价列表紧邻处渲染，明确以下为示意性文案、非真实证言。
 * 值为 i18n 键名，组件用 t(TESTIMONIALS_DISCLAIMER_KEY) 取本地化文案。
 */
export const TESTIMONIALS_DISCLAIMER_KEY = 'pages.landing.disclaimers.testimonials';

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
