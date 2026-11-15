/**
 * Landing Page — 算法引擎数据层 v1
 *
 * 展示后端已实现的 7 种优化算法引擎、5 种协同机制、性能基准。
 *
 * 注：performanceMetrics（性能基准）为实验室内部压测示例，非生产实测基准。
 *
 * 算法引擎对应后端路径：
 *   app/services/ai/algorithms/
 *     - unified_optimizer.py      → UnifiedFormulaOptimizer（统一调度器 + Bandit）
 *     - genetic_formula_optimizer.py → GeneticFormulaOptimizer（标准 GA）
 *     - nsga3_optimizer.py        → NSGAIIIOptimizer（高维多目标）
 *     - binary_ga_optimizer.py    → BinaryGAOptimizer（混合 MILP）
 *     - bayesian_formula_optimizer.py → BayesianFormulaOptimizer（GP 代理模型）
 *     - moead_cmaes_strategies.py → MOEAD + CMA-ES 分解策略
 *     - neural_formula_network.py → NeuralFormulaNetwork（神经网络架构搜索）
 *     - auto_solver.py            → AutoSolver（UCB1 Bandit 自动策略选择）
 */
import { Beaker, Brain, GitBranch, Shield, TrendingUp, Zap, Network } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

// ── 类型定义 ──────────────────────────────────────────────────────
export type AlgoCategory = 'optimizer';

export interface Algorithm {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  desc: string;
  tech: string[];
  category: AlgoCategory;
  /** 关键指标 */
  metric?: { value: string; label: string };
  /** 适用场景 */
  applicable?: string[];
  /** 后端类名 */
  backendClass?: string;
}

export interface SynergyMechanism {
  id: string;
  name: string;
  formula: string;
  desc: string;
  weight: string;
}

export interface PerformanceMetric {
  operation: string;
  p50: string;
  p95: string;
  p99: string;
  sla: string;
}

// ── 图标映射 ──────────────────────────────────────────────────────
const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  Beaker, Brain, GitBranch, Shield, TrendingUp, Zap, Network,
};

export function getAlgoIcon(name: string) {
  return iconMap[name] ?? Beaker;
}

// ── 7 大优化算法引擎 ──────────────────────────────────────────────
export const algorithms: Algorithm[] = [
  {
    id: 'genetic',
    icon: 'GitBranch',
    title: '遗传算法 (GA)',
    subtitle: 'Genetic Formula Optimizer',
    desc: '标准进化算法，种群驱动全局搜索。采用锦标赛选择 + 精英保留策略，单点/算术交叉，高斯变异 + 边界重置，适应度函数综合评估功效/安全/口感/成本四维评分。',
    tech: ['锦标赛选择 · 精英保留 · SBX交叉 · 高斯变异'],
    category: 'optimizer',
    metric: { value: 'N=80', label: '种群规模' },
    applicable: ['5 味以内配方', '多目标初步探索'],
    backendClass: 'GeneticFormulaOptimizer',
  },
  {
    id: 'nsga3',
    icon: 'TrendingUp',
    title: 'NSGA-III',
    subtitle: '高维多目标遗传算法',
    desc: '基于参考点的多目标进化算法，专为 8+ 维目标设计。使用 Das-Dennis 单纯形拉丁超立方方法生成均匀参考点，ε-连续精英策略保证 Pareto 前沿多样性，支持 Pareto/加权/ε-约束三种优化模式。',
    tech: ['参考点分解 · ε-精英策略 · 自适应参数', '8 维目标函数'],
    category: 'optimizer',
    metric: { value: '8 维', label: '目标维度' },
    applicable: ['复杂配方多目标权衡', 'Pareto 前沿可视化'],
    backendClass: 'NSGAIIIOptimizer',
  },
  {
    id: 'binary-ga',
    icon: 'Beaker',
    title: 'Binary GA + MILP',
    subtitle: '混合整数规划引擎',
    desc: '二进制编码遗传算法与混合整数线性规划 (MILP) 的混合引擎。GA 负责全局离散变量选择，MILP 负责连续剂量精确求解，在硬约束（安全阈值、归一化）下保证可行解。',
    tech: ['二进制编码 · MILP 精确求解 · 硬约束处理'],
    category: 'optimizer',
    metric: { value: '100%', label: '约束满足率' },
    applicable: ['有严格法规约束的配方', '剂量精确计算'],
    backendClass: 'BinaryGAOptimizer',
  },
  {
    id: 'bayesian',
    icon: 'Brain',
    title: '贝叶斯优化',
    subtitle: 'Gaussian Process + EI 采集函数',
    desc: '将配方生成建模为黑箱优化问题：使用高斯过程 (GP) 作为代理模型拟合功效/安全/口感等高维响应面，Expected Improvement (EI) 采集函数指导采样，先验知识注入 TCMSP 配伍规则。',
    tech: ['GP 代理模型 · EI 采集函数 · 先验知识注入'],
    category: 'optimizer',
    metric: { value: '< 2s', label: '收敛耗时' },
    applicable: ['样本有限的高价值配方', '冷启动场景'],
    backendClass: 'BayesianFormulaOptimizer',
  },
  {
    id: 'moead',
    icon: 'Network',
    title: 'MOEAD + CMA-ES',
    subtitle: '分解型多目标 + 连续优化',
    desc: '多目标进化算法基于分解 (MOEAD) 将多目标问题分解为若干单目标子问题，结合 CMA-ES (协方差矩阵自适应进化策略) 在连续空间高效寻优，适合高维连续剂量优化问题。',
    tech: ['Tchebycheff 分解 · CMA-ES · 邻居交换'],
    category: 'optimizer',
    metric: { value: '200', label: '子问题数' },
    applicable: ['连续剂量优化', '高维配方空间'],
    backendClass: 'MOEADOptimizer / CMAESEOptimizer',
  },
  {
    id: 'bandit',
    icon: 'Zap',
    title: 'Bandit 自动求解器',
    subtitle: 'UCB1 在线学习策略选择',
    desc: '统一优化调度器内置 BanditLearner，基于 UCB1 公式动态平衡探索与利用，自动从 7 种算法引擎中选择最优策略。同时维护历史检索缓存，相似配方直接复用结果，命中率 > 60%。',
    tech: ['UCB1 公式 · 历史缓存复用 · 策略自适应'],
    category: 'optimizer',
    metric: { value: '> 60%', label: '缓存命中率' },
    applicable: ['自动化批量优化', '策略无感调用'],
    backendClass: 'UnifiedFormulaOptimizer',
  },
  {
    id: 'neural',
    icon: 'Brain',
    title: '神经配方网络',
    subtitle: 'Neural Formula Network',
    desc: '基于 PyTorch 的神经网络配方架构搜索引擎。使用变分自编码器 (VAE) 学习配方分布隐空间，结合强化学习 (RL) 策略梯度在隐空间中导航，生成符合功效目标的新颖配方结构。',
    tech: ['VAE 隐空间 · RL 策略梯度 · PyTorch'],
    category: 'optimizer',
    metric: { value: '≈77%', label: 'balanced_accuracy（5 折验证）' },
    applicable: ['新颖配方设计', '结构创新探索'],
    backendClass: 'NeuralFormulaNetwork',
  },
];

// ── 5 种协同作用机制 ──────────────────────────────────────────────
export const synergyMechanisms: SynergyMechanism[] = [
  {
    id: 'bliss',
    name: 'Bliss 独立性协同',
    formula: 'E_synergy = E_A + E_B − E_A×E_B + α·√(E_A×E_B)',
    desc: '基于 Bliss 独立性模型计算两种成分联合功效，α 为协同系数（从知识图谱查询或实验拟合）。α > 0 表示正向协同（1+1>2），α < 0 表示拮抗。',
    weight: '25%',
  },
  {
    id: 'pk',
    name: '药代动力学协同',
    formula: 'F = F_base × (1 + β×C_inhibitor)',
    desc: '模拟成分间吸收/代谢相互作用，修正生物利用度 F。考虑肝首过效应（f_hepatic 典型值 0.15-0.30），计算有效暴露量 AUC_ratio。',
    weight: '20%',
  },
  {
    id: 'gibbs',
    name: 'Gibbs 自由能稳定性',
    formula: 'S_stability = 1 / (1 + e^(ΔG/RT))',
    desc: '通过 ΔG = ΔH − TΔS 计算复合物热力学稳定性，映射为 0-1 归一化稳定性得分。ΔG < -20 kJ/mol 为极稳定，> 20 为不稳定。',
    weight: '15%',
  },
  {
    id: 'network',
    name: '网络药理学关联',
    formula: 'J(A,B) = |T_A ∩ T_B| / |T_A ∪ T_B|  (Jaccard)',
    desc: '基于 TCMSP 靶点集合计算 Jaccard 相似系数和 Tanimoto 扩展系数，超几何检验评估通路富集显著性，量化成分间药理关联强度。',
    weight: '25%',
  },
  {
    id: 'taste',
    name: '味觉矩阵协同',
    formula: 'S_taste = Σw_i·s_i + Σt_ij·√(s_i·s_j)',
    desc: '定义 t_ij ∈ {−1,0,+1} 味觉相互作用矩阵：甜+鲜→增强 (+1)，苦+甜→掩盖 (−1)。综合加权得分评估配方整体适口性。',
    weight: '15%',
  },
];

// ── 性能基准数据 ──────────────────────────────────────────────────
export const performanceMetrics: PerformanceMetric[] = [
  { operation: '协同分析（单对）', p50: '45ms', p95: '120ms', p99: '250ms', sla: '< 500ms' },
  { operation: '配比优化（5 成分）', p50: '800ms', p95: '1800ms', p99: '2800ms', sla: '< 3000ms' },
  { operation: '兼容性检测（5 成分）', p50: '150ms', p95: '350ms', p99: '600ms', sla: '< 1000ms' },
  { operation: '效果预测（24h 模拟）', p50: '200ms', p95: '450ms', p99: '800ms', sla: '< 1000ms' },
  { operation: '安全检查（5 成分）', p50: '80ms', p95: '180ms', p99: '300ms', sla: '< 500ms' },
  { operation: '完整管线', p50: '1500ms', p95: '3200ms', p99: '5500ms', sla: '< 6000ms' },
];
