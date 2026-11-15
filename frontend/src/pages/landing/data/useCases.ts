/**
 * Landing Page — 应用场景数据层 v8
 *
 * 三个真实研发场景，每个有独立品牌色和专属工作流：
 *   scenario: 'tcm'   → 药食同源配方研发（翡翠绿）
 *   scenario: 'peptide'→ 生物活性肽设计（靛蓝）
 *   scenario: 'eln'   → 实验数据管理（琥珀金）
 */

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
 * primaryText：白底/浅底上可阅读文本专用（与 primary 同值，保留独立字段便于 800 级场景单独收紧）。
 */
export const scenarioConfig: Record<Scenario, {
  primary: string;
  primaryText: string;
  primaryLight: string;
  primaryBorder: string;
  primaryRGB: string;
  gradient: string;
  metricBg: string;
}> = {
  tcm: {
    primary: 'var(--color-primary-700, #047857)',
    primaryText: 'var(--color-primary-700, #047857)',
    primaryLight: 'var(--color-success-50, #ecfdf5)',
    primaryBorder: 'var(--color-success-200, #a7f3d0)',
    primaryRGB: '5,150,105',
    gradient: 'linear-gradient(135deg, var(--color-primary-700, #047857), var(--color-success-500, #10b981), var(--color-success-500, #34d399))',
    metricBg: 'var(--color-success-50, #ecfdf5)',
  },
  peptide: {
    primary: 'var(--color-secondary-700, #1d4ed8)',
    primaryText: 'var(--color-secondary-700, #1d4ed8)',
    primaryLight: 'var(--color-secondary-50, #eff6ff)',
    primaryBorder: 'var(--color-secondary-200, #bfdbfe)',
    primaryRGB: '37,99,235',
    gradient: 'linear-gradient(135deg, var(--color-secondary-700, #1d4ed8), var(--color-secondary-500, #3b82f6), var(--color-secondary-400, #60a5fa))',
    metricBg: 'var(--color-secondary-50, #eff6ff)',
  },
  eln: {
    primary: 'var(--color-warning-700, #b45309)',
    primaryText: 'var(--color-warning-700, #b45309)',
    primaryLight: 'var(--color-warning-50, #fffbeb)',
    primaryBorder: 'var(--color-warning-200, #fde68a)',
    primaryRGB: '217,119,6',
    gradient: 'linear-gradient(135deg, var(--color-warning-700, #b45309), var(--color-warning-500, #f59e0b), var(--color-warning-400, #fbbf24))',
    metricBg: 'var(--color-warning-50, #fffbeb)',
  },
};

export const useCases: (UseCaseItem & { scenario: Scenario })[] = [
  {
    id: 'tcm',
    scenario: 'tcm',
    icon: 'Microscope',
    title: '药食同源配方研发',
    desc: '基于 TCMSP 与药食同源知识图谱，AI 辅助快速筛选原料组合，自动生成包含剂量建议与配伍禁忌标注的完整配方报告，一键导出 GLP 模板格式文档。',
    workflow: [
      { label: '原料筛选', detail: 'TCMSP · 612 味中药材' },
      { label: '配伍推理', detail: 'Neo4j 知识图谱 · 约 14.7K 节点' },
      { label: '合规校验', detail: '卫健委目录 · 实时同步' },
      { label: '报告生成', detail: 'DOCX/PDF · GLP 模板' },
    ],
    // 合规口径（已定，非待办）：「配伍禁忌 28 对」指配伍禁忌配对数（独立口径）；卫健委药食同源目录法定条目为 106 种，二者分列勿混淆。「612 味中药材」为已通过合规审计的库容量描述。依据 docs/marketing/03 审计矩阵；如需改变对外宣称须经法务书面复核。
    metrics: [
      { label: '中药材', value: '612', unit: '味' },
      { label: '配伍禁忌', value: '28', unit: '对' },
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
    // 合规口径（已定，非待办）：「≈77%」限定为神经配方网络 balanced_accuracy（5 折验证），不得泛化为肽 ADMET 整体准确率；「3-5 轮」为经验值限定。依据 docs/marketing/05 D4；如需改变对外宣称须经法务书面复核。
    metrics: [
      { label: '活性肽库', value: '7,660+', unit: '结构' },
      { label: '神经网络判别力 (balanced_accuracy)', value: '≈77', unit: '% · 5 折验证' },
      { label: '优化迭代', value: '3-5', unit: '轮/项目 · 经验值' },
    ],
    ctaText: '了解肽设计',
  },
  {
    id: 'eln',
    scenario: 'eln',
    icon: 'BarChart3',
    title: '实验数据管理',
    desc: '电子实验记录本 (ELN) 标准化实验流程，自动解析 HPLC/GC/MS 原始数据，支持多租户协作与变更审计追踪，一键生成参照 NMPA 申报格式的完整实验报告。',
    workflow: [
      { label: '实验记录', detail: '结构化模板 · 版本控制' },
      { label: '数据解析', detail: 'HPLC/GC/MS 自动导入' },
      { label: '统计分析', detail: '趋势分析 · 异常检测' },
      { label: '报告导出', detail: 'NMPA 格式 · 审计追溯' },
    ],
    // 合规口径（已定，非待办）：「GLP 报告」按能力描述、已去除 100% 绝对化；「机构 9 家」为实验室内部统计已移除，避免与外部客户混淆；「审计追溯全量」已加能力描述限定。依据 docs/marketing/05 D3；如需改变对外宣称须经法务书面复核。
    metrics: [
      { label: 'GLP 报告模板', value: '模板', unit: '一键导出' },
      { label: '审计追溯', value: '全量', unit: '留痕 · 能力描述' },
    ],
    ctaText: '查看实验管理',
  },
];
