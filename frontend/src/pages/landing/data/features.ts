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
    desc: 'MCTS 蒙特卡洛树搜索 + 模拟退火双引擎，在安全性约束下自动寻找最优配方组合，支持梯度下降求解器。',
    tag: 'AI 智能研发',
    dimension: 'ai',
    keyMetric: '3 种求解器',
    techLabel: 'MCTS · Simulated Annealing',
    steps: [{ label: '约束建模', detail: '将业务规则转化为数学约束' }, { label: '搜索空间展开', detail: '穷举所有可行解空间' }, { label: '帕累托最优筛选', detail: '多目标优化找到最优平衡点' }],
  },
  {
    id: 'safety',
    icon: 'Shield',
    title: '安全合规引擎',
    desc: '实时检测配伍禁忌与过敏原风险，对接卫健委药食同源目录与食品安全国家标准，全自动合规预判。',
    tag: '安全保障',
    dimension: 'ai',
    keyMetric: '130+ 条目',
    techLabel: '实时同步 · 多级校验',
    steps: [{ label: '原料扫描', detail: '遍历全量原料数据库' }, { label: '配伍禁忌检测', detail: '基于药性理论进行冲突分析' }, { label: '合规报告生成', detail: '自动输出法规合规性报告' }],
  },
  {
    id: 'kg',
    icon: 'Database',
    title: '知识图谱检索',
    desc: 'TCMSP + DFBP + Neo4j 跨库联合查询，128K 实体节点多维关联，支持药材–成分–靶点–疾病全链路追溯。',
    tag: '数据能力',
    dimension: 'data',
    keyMetric: '128K 节点',
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
    keyMetric: '5,200+ 结构',
    techLabel: 'RDKit · PyTorch',
    steps: [{ label: '序列提取', detail: '从文献中提取化合物序列' }, { label: '理化性质计算', detail: '预测分子理化特性' }, { label: 'ADMET 预测', detail: '吸收、分布、代谢、排泄、毒性预测' }],
  },
  {
    id: 'collab',
    icon: 'GitBranch',
    title: '团队协作',
    desc: '多租户行级隔离，RBAC 5 级角色权限，实时协同编辑 + 变更审计追踪，WebSocket 实时推送，满足 GLP 合规要求。',
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

/** 各维度的颜色配置 */
export const dimensionConfig: Record<Dimension, {
  primary: string;
  primaryLight: string;
  primaryBorder: string;
  primaryRGB: string;
  iconBg: string;
  stepActive: string;
}> = {
  ai: {
    primary: '#059669',
    primaryLight: '#ecfdf5',
    primaryBorder: '#a7f3d0',
    primaryRGB: '5,150,105',
    iconBg: 'linear-gradient(135deg, #059669, #34d399)',
    stepActive: '#059669',
  },
  data: {
    primary: '#2563eb',
    primaryLight: '#eff6ff',
    primaryBorder: '#bfdbfe',
    primaryRGB: '37,99,235',
    iconBg: 'linear-gradient(135deg, #2563eb, #60a5fa)',
    stepActive: '#2563eb',
  },
  team: {
    primary: '#d97706',
    primaryLight: '#fffbeb',
    primaryBorder: '#fde68a',
    primaryRGB: '217,119,6',
    iconBg: 'linear-gradient(135deg, #d97706, #fbbf24)',
    stepActive: '#d97706',
  },
};
