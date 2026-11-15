/**
 * Landing Page — 核心能力数据层 v7
 *
 * 三维度分组：
 *   dimension: 'ai'      → 智能研发（翡翠绿系）
 *   dimension: 'data'    → 数据能力（靛蓝+紫色系）
 *   dimension: 'team'    → 企业协作（琥珀色系）
 *
 * 每条包含：
 *   keyMetric  → 关键数字（增强可信度）
 *   techLabel  → 技术实现标签（来自项目手册）
 *   steps      → 核心流程步骤（展示产品逻辑）
 */
import { LucideProps, Brain, FlaskConical, Shield, Database, TestTubes, GitBranch } from 'lucide-react';

export type Dimension = 'ai' | 'data' | 'team';

export interface FeatureItem {
  id: string;
  icon: string;
  title: string;
  desc: string;
  tag: string;
  dimension: Dimension;
  /** 关键数字，如 "3种求解器" */
  keyMetric?: string;
  /** 技术实现标签 */
  techLabel?: string;
  /** 流程步骤 */
  steps?: { label: string; detail?: string }[];
}

export const sectionLabel = '核心能力';
export const sectionTitle = '从想法到配方\n一气呵成';
export const sectionDesc = '六大核心模块覆盖研发全流程，AI 驱动、数据支撑、团队协作。';

export const features: FeatureItem[] = [
  {
    id: 'ai-chat',
    icon: 'Brain',
    title: 'AI 配方对话',
    desc: '用自然语言描述需求，多模型混合推理给出有依据的配方建议。支持 DeepSeek / GPT-4 / 智谱 / 通义千问自定义端点。',
    tag: 'AI 智能研发',
    dimension: 'ai',
    keyMetric: '5+ LLM',
    techLabel: 'SSE 流式 · 多端点适配',
    steps: [{ label: '自然语言输入', detail: '用户描述需求或意图' }, { label: '意图理解', detail: 'AI解析需求并提取关键参数' }, { label: '配方生成', detail: '基于知识图谱生成候选配方' }],
  },
  {
    id: 'multi-opt',
    icon: 'FlaskConical',
    title: '多目标优化',
    desc: '7 种算法引擎（GA / NSGA-III / 贝叶斯 / MOEAD-CMAES / BinaryGA-MILP / Bandit 自动求解器 / 神经网络）统一调度，NSGA-III 支持 8 维目标 Pareto 优化，UCB1 Bandit 自动选择最优策略，完整管线 P95 约 3.2s（实验室内部压测示例）。',
    tag: 'AI 智能研发',
    dimension: 'ai',
    keyMetric: '7 种引擎',
    techLabel: 'NSGA-III · Bandit · GP',
    steps: [{ label: '智能策略选择', detail: 'Bandit UCB1 自动匹配最优算法' }, { label: '多目标 Pareto 优化', detail: '功效/安全/口感/成本 四维寻优' }, { label: '协同机制量化', detail: '5 种数学模型综合协同指数 SI' }],
  },
  {
    id: 'safety',
    icon: 'Shield',
    title: '安全合规引擎',
    desc: '三级预警系统（INFO/WARN/CRITICAL），61 类内置安全阈值（多肽/多糖/皂苷/黄酮/生物碱等），PopPK/PD 药效动力学模型支持最佳服用时间窗口计算，适配孕妇/儿童/老年人特殊人群剂量调整。',
    tag: '安全保障',
    dimension: 'ai',
    keyMetric: '61 类阈值',
    techLabel: '三级预警 · PopPK/PD',
    steps: [{ label: '原料扫描', detail: '遍历全量原料数据库' }, { label: '配伍禁忌 + 安全阈值', detail: '106 种法定条目 · 61 类阈值检测' }, { label: '合规报告生成', detail: '自动输出法规合规性报告' }],
  },
  {
    id: 'kg',
    icon: 'Database',
    title: '知识图谱检索',
    desc: 'TCMSP + DFBP + Neo4j 跨库联合查询，约 14.7K 实体节点、24 万关联边多维关联，支持药材–成分–靶点–疾病全链路追溯。',
    tag: '数据能力',
    dimension: 'data',
    keyMetric: '14.7K 节点',
    techLabel: 'Cypher · D3.js 可视化',
    steps: [{ label: '跨库联合查询', detail: '同时访问多个数据库' }, { label: '关系图谱展开', detail: '构建知识图谱关联关系' }, { label: '关联推演', detail: '推理潜在关联规律' }],
  },
  {
    id: 'peptide',
    icon: 'TestTubes',
    title: '肽序列分析',
    desc: 'PepINVENT 引擎集成，RDKit + PyTorch 管线：理化性质 → 二级结构 → ADMET → 毒性致敏性全流程评估。',
    tag: '科研工具',
    dimension: 'data',
    keyMetric: '7,660+ 结构',
    techLabel: 'RDKit · PyTorch',
    steps: [{ label: '序列提取', detail: '从文献中提取化合物序列' }, { label: '理化性质计算', detail: '预测分子理化特性' }, { label: 'ADMET 预测', detail: '吸收、分布、代谢、排泄、毒性预测' }],
  },
  {
    id: 'collab',
    icon: 'GitBranch',
    title: '团队协作',
    desc: '多租户行级隔离，RBAC 5 级角色权限，实时协同编辑 + 变更审计追踪，WebSocket 实时推送，按 GLP 数据完整性要求组织记录与审计留痕。',
    tag: '企业协作',
    dimension: 'team',
    keyMetric: 'RBAC 5 级',
    techLabel: 'WebSocket · GLP 审计',
    steps: [{ label: '多人协同编辑', detail: '多人同时编辑同一配方' }, { label: '版本差异对比', detail: '可视化显示版本变更' }, { label: '变更审计追踪', detail: '记录所有操作历史' }],
  },
];

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  Brain,
  FlaskConical,
  Shield,
  Database,
  TestTubes,
  GitBranch,
};

/** 根据图标名称字符串获取组件 */
export function getFeatureIcon(name: string) {
  return iconMap[name] ?? Brain;
}

/** 各维度的颜色配置
 * P0 修复：primary 用于文本对比（12px 标签 / 14px 标题 / 图标色），
 * 需满足 WCAG AA 4.5:1 → 全部改用 700 级深色。
 */
export const dimensionConfig: Record<Dimension, {
  primary: string;
  primaryLight: string;
  primaryBorder: string;
  primaryRGB: string;
  iconBg: string;
  stepActive: string;
}> = {
  ai: {
    primary: 'var(--color-primary-700, #047857)',
    primaryLight: 'var(--color-success-50, #ecfdf5)',
    primaryBorder: 'var(--color-success-200, #a7f3d0)',
    primaryRGB: '5,150,105',
    iconBg: 'linear-gradient(135deg, var(--color-primary-700, #047857), var(--color-success-500, #34d399))',
    stepActive: 'var(--color-primary-700, #047857)',
  },
  data: {
    primary: 'var(--color-secondary-700, #1d4ed8)',
    primaryLight: 'var(--color-secondary-50, #eff6ff)',
    primaryBorder: 'var(--color-secondary-200, #bfdbfe)',
    primaryRGB: '37,99,235',
    iconBg: 'linear-gradient(135deg, var(--color-secondary-700, #1d4ed8), var(--color-secondary-400, #60a5fa))',
    stepActive: 'var(--color-secondary-700, #1d4ed8)',
  },
  team: {
    primary: 'var(--color-warning-700, #b45309)',
    primaryLight: 'var(--color-warning-50, #fffbeb)',
    primaryBorder: 'var(--color-warning-200, #fde68a)',
    primaryRGB: '217,119,6',
    iconBg: 'linear-gradient(135deg, var(--color-warning-700, #b45309), var(--color-warning-400, #fbbf24))',
    stepActive: 'var(--color-warning-700, #b45309)',
  },
};
