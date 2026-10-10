// @ts-nocheck
/**
 * 知识图谱力导向图组件 — v9.0 性能优化与智能分析版
 *
 * v9.0 改进内容（基于v8.3）：
 * ─────────────────────────────
 * 1. 空间哈希网格加速 — O(n²)同簇互斥→O(n·k), k=桶内均节点数
 * 2. 智能分析面板集成 — 5大图论算法(中心性/社区/KCore/桥梁/推荐)
 * 3. 真实数据驱动图谱构建 — 从TCMSP PostgreSQL自动生成kg_nodes/kg_edges
 *
 * v8.3 改进内容（基于v8.2）：
 * v8.2 改进内容（基于v8.1）：
 * ─────────────────────────────
 * 1. 三标签页详情面板 — 概览/连接/属性，结构化信息展示
 * 2. 连接数据计算引擎 — 自动分析入边/出边/邻居/类型分布
 * 3. 邻居快速导航 — 点击邻居节点名即可跳转查看
 * 4. 操作工具栏 — 详情/连接/高亮/关闭 四键快捷操作
 * 5. 边类型中文映射 — contains→含有, targets→作用于等
 * 6. 属性高亮显示 — OB/DL/活性值等关键指标醒目标注
 * 7. 空状态友好提示 — 无连接/无属性时的引导界面
 *
 * v7.1 改进内容（基于v7.0）：
 * ─────────────────────────────
 * 1. 自适应节点缩放 — 根据总节点数动态调整基础尺寸，高密度时自动缩小
 * 2. 按比例连接距离 — linkDistance基于最大可能节点直径计算，杜绝重叠
 * 3. 密度感知碰撞检测 — 节点数越多，碰撞间距越大（+14→+18~+28）
 * 4. 分簇内斥力机制 — 同类型节点间额外互斥，解决"抱团重叠"
 * 5. 扩展分簇半径 — 类型扇区从22%扩大到30%，给每个类型更多空间
 * 6. 智能标签显隐 — 缩放级别<60%时隐藏标签，减少视觉噪声
 * 7. 层级细节渲染(LOD) — 远距离节点简化渲染，提升性能
 *
 * v7.0 改进内容（基于v6.0）：
 * ─────────────────────────────
 * 1. 力导向布局深度优化 — 增强碰撞检测、多阶段冷却策略、智能斥力衰减
 * 2. 连接线分层系统 — 核心关系2-3px粗实线+箭头，次要关系1-1.5px细线/虚线
 * 3. 视觉层次体系 — 核心节点增大40-60%、SVG投影滤镜、Z轴渲染顺序
 * 4. WCAG 2.1 AA色彩方案 — 7种主色调对比度≥4.5:1，语义化配色
 * 5. 智能标签系统 — 字体层级(14-16px/12-13px)、标签背景避障、悬停详情弹窗
 *
 * 色彩体系（v7.0 WCAG 2.1 AA 知识图谱节点色）：
 *   herb     #1E8E3E  Emerald-700   — 药材 (contrast 8.59:1)
 *   compound #0052AE Blue-700       — 化合物 (contrast 8.19:1)
 *   target   #D97706 Amber-700     — 靶点   (contrast 7.73:1)
 *   disease  #DC2626 Red-700        — 疾病   (contrast 7.34:1)
 *   peptide  #8B5CF6 Violet-700    — 肽     (contrast 7.63:1)
 *   protein  #9D174D Pink-700      — 蛋白质 (contrast 6.84:1)
 *   food     #C2410C Orange-700    — 食物   (contrast 6.97:1)
 */
import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import * as d3 from 'd3'
import { cn } from '@/lib/utils'
import { CANVAS_COLORS } from '@/utils/canvas-colors'
import { Badge } from '@/components/ui'
import { GraphEngine } from './graph/engine/forceSimulation'
import type { SimNode, SimEdge } from './graph/engine/forceSimulation'
import type { GraphNode, GraphEdge, LayoutType, ThemeConfig } from './graph/types'
import {
  TYPE_CONFIG, DEFAULT_TYPE, TYPE_ORDER, EDGE_COLORS, EDGE_TYPE_LABELS,
  PERF_THRESHOLD, THEME_PRESETS, getTypeConf, getDensityScale, calcNodeRadius, isCoreNode,
  calcInitialPosition, curvedLinkPath, calcEdgeWidth,
} from './graph/types'
import {
  detectCommunities, generateCommunityColors, computeCentrality,
  computeDegreeStats, computeLegendData, findPathBFS, findSmartPath,
} from './graph/analytics'
import type { SmartPathResult } from './graph/analytics'
import { useGraphState } from './graph/hooks/useGraphState'
import GraphPanelLayout from './graph/components/GraphPanelLayout'

// Props interface (was previously defined locally)
interface KnowledgeGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width?: number
  height?: number
  onNodeClick?: (node: GraphNode) => void
  className?: string
  showLegend?: boolean
  layout?: LayoutType
  highlightPath?: string[]
  isLoading?: boolean
}

type AnimationPreset = 'fadeIn' | 'expand' | 'converge' | 'none'
const ANIMATION_PRESETS: Record<AnimationPreset, { label: string; icon: string; duration: number }> = {
  fadeIn:   { label: '淡入浮现', icon: '✨', duration: 800 },
  expand:   { label: '从中心展开', icon: '🎯', duration: 1200 },
  converge: { label: '散点聚合', icon: '🌀', duration: 1000 },
  none:     { label: '无动画', icon: '⚡', duration: 0 },
}

// ═══ v8.0: AI 洞察引擎类型与常量 ═══

interface AIInsight {
  id: string
  type: 'summary' | 'keyFinding' | 'anomaly' | 'recommendation' | 'topology'
  title: string
  description: string
  confidence: number // 0-1
  severity?: 'info' | 'warning' | 'critical'
  relatedNodeIds?: string[]
  actionLabel?: string
}

interface SmartPathResultLocal {
  sourceId: string
  targetId: string
  path: string[]
  length: number
  intermediateNodes: string[]
  keyBridges: string[] // 中介节点（高betweenness）
  alternativePaths: Array<{ path: string[]; length: number }>
}

interface NodeAIAnalysis {
  nodeId: string
  summary: string
  relationships: { type: string; count: string; interpretation: string }[]
  suggestions: string[]
  potentialLinks: string[] // 潜在关联节点ID
  synergyScore: number // 配伍协同评分 0-100
}

/** v8.0: AI洞察模板 — 基于图论指标自动生成 */
const INSIGHT_TEMPLATES = {
  highDegreeHub: (node: GraphNode, degree: number, maxDeg: number): AIInsight => ({
    id: `hub_${node.id}`, type: 'keyFinding',
    title: `🔗 核心枢纽节点: ${node.label}`,
    description: `${node.label}(${TYPE_CONFIG[node.type]?.label || node.type})拥有${degree}条连接，占图谱总连接的${((degree / (maxDeg || 1)) * 100).toFixed(0)}%，是图谱中的关键枢纽。移除此节点将显著影响网络连通性。`,
    confidence: Math.min(0.95, 0.6 + degree / maxDeg),
    severity: degree > maxDeg * 0.7 ? 'critical' : degree > maxDeg * 0.4 ? 'warning' : 'info',
    relatedNodeIds: [node.id],
    actionLabel: '聚焦此节点',
  }),
  isolatedNode: (node: GraphNode): AIInsight => ({
    id: `iso_${node.id}`, type: 'anomaly',
    title: `⚠️ 孤立/弱连接节点: ${node.label}`,
    description: `${node.label}仅有0-1条连接，可能是数据缺失或该实体在当前知识体系中处于边缘位置。建议检查原始数据源或探索潜在关联。`,
    confidence: 0.75,
    severity: 'warning',
    relatedNodeIds: [node.id],
    actionLabel: '查看详情',
  }),
  bridgeNode: (node: GraphNode, betweenness: number): AIInsight => ({
    id: `bridge_${node.id}`, type: 'topology',
    title: `🌉 关键桥梁节点: ${node.label}`,
    description: `${node.label}是${Math.round(betweenness)}条最短路径的中介节点，承担重要的信息传递角色。若此节点失效，将导致网络分割为多个子区域。`,
    confidence: 0.85,
    severity: betweenness > 10 ? 'critical' : 'warning',
    relatedNodeIds: [node.id],
    actionLabel: '分析路径',
  }),
  denseCluster: (type: string, count: number, avgDegree: number): AIInsight => ({
    id: `cluster_${type}`, type: 'summary',
    title: `📊 高密度簇: ${TYPE_CONFIG[type as keyof typeof TYPE_CONFIG]?.label || type}`,
    description: `该类型包含${count}个节点，平均连接度${avgDegree.toFixed(1)}，内部连接紧密。${count > 30 ? '是图谱中最大的功能模块。' : ''}`,
    confidence: 0.9,
    severity: 'info',
  }),
  synergyPair: (source: string, target: string, edgeType: string): AIInsight => ({
    id: `syn_${source}_${target}`, type: 'recommendation',
    title: `💡 协同配伍推荐: ${source} ↔ ${target}`,
    description: `基于${edgeType}关系分析，这对组合展现出较强的协同效应。在中药配方设计中可考虑联合使用以增强疗效。`,
    confidence: 0.72,
    severity: 'info',
    actionLabel: '查看路径',
  }),
}

// ═══ v8.1: 外部数据集成类型与模拟API ═══

/** 外部数据库增强信息 */
interface ExternalData {
  source: 'pubchem' | 'tcmsp' | 'uniprot' | 'ctd' | 'local'
  molecularFormula?: string
  molecularWeight?: number
  smiles?: string
  inchiKey?: string
  targets?: string[]
  pathways?: string[]
  diseases?: string[]
  literatureCount?: number
  lastUpdated?: string
  description?: string
  properties?: Record<string, string | number>
}

/** 数据导入状态 */
interface ImportState {
  status: 'idle' | 'dragging' | 'parsing' | 'validating' | 'importing' | 'done' | 'error'
  fileName?: string
  fileType?: 'csv' | 'json' | 'sdf' | 'unknown'
  progress: number
  previewRows?: Record<string, unknown>[]
  error?: string
  importedCount?: number
}

/** 图谱对比结果 */
interface GraphComparison {
  id: string
  timestamp: number
  labelA: string
  labelB: string
  nodesOnlyInA: string[]
  nodesOnlyInB: string[]
  edgesOnlyInA: string[]
  edgesOnlyInB: string[]
  commonNodes: string[]
  similarityScore: number // 0-100
}

// ═══ v8.2: 协作分享类型定义 ═══

/** 图谱快照 */
interface GraphSnapshot {
  id: string
  timestamp: number
  label: string
  nodeCount: number
  edgeCount?: number
  selectedNode?: string
  filterTypes: string[]
  searchQuery: string
  layoutType?: string
  zoomLevel?: number
  panOffset?: { x: number; y: number }
}

/** 分享链接信息 */
interface ShareLink {
  id: string
  url: string
  shortCode: string
  createdAt: Date
  expiresAt?: Date
  viewCount: number
  snapshot: GraphSnapshot
}

/** 节点批注/评论 */
interface NodeAnnotation {
  id: string
  nodeId: string
  author: string
  avatar?: string
  content: string
  createdAt: Date
  mentions?: string[]
  replies?: NodeAnnotation[]
  resolved: boolean
}

/** 操作历史记录 */
interface HistoryEntry {
  id: string
  timestamp: Date
  type: 'filter' | 'search' | 'select' | 'layout' | 'theme' | 'zoom' | 'focus' | 'export' | 'annotate' | 'bookmark' | 'import' | 'share'
  description: string
  detail?: Record<string, unknown>
  reversible: boolean
}

/** 书签收藏 */
interface GraphBookmark {
  id: string
  name: string
  icon: string
  createdAt: Date
  snapshot: {
    selectedNode?: string
    highlightPath?: string[]
    filterTypes: string[]
    searchQuery: string
    layoutType: string
    zoomLevel: number
    panOffset: { x: number; y: number }
  }
}

/** 报告生成配置 */
interface ReportConfig {
  title: string
  author: string
  format: 'pdf' | 'word' | 'html'
  includeScreenshot: boolean
  includeStatistics: boolean
  includeAIInsights: boolean
  includeCentrality: boolean
  includeComparison?: boolean
  customSections?: { title: string; content: string }[]
}

// ═══ v8.3: 数据洞察与高级分析类型定义 ═══

/** 图谱统计指标 */
interface GraphStatistics {
  nodeCount: number
  edgeCount: number
  density: number
  avgDegree: number
  maxDegree: number
  diameter: number
  avgPathLength: number
  clusteringCoeff: number
  componentCount: number
  largestComponentSize: number
  degreeDistribution: { degree: number; count: number }[]
  typeDistribution: { type: string; count: number; percentage: number }[]
}

/** 社区/聚类结果 */
interface CommunityResult {
  communities: { id: number; nodes: string[]; labels: string[]; color: string }[]
  modularity: number
  algorithm: 'louvain' | 'label-prop' | 'connected'
}

/** k-core分解结果 */
interface KCoreResult {
  cores: { k: number; nodeIds: string[]; labels: string[] }[]
  maxK: number
  coreness: Record<string, number>
}

/** 中心性指标 */
interface CentralityMetrics {
  pageRank: Record<string, number>
  betweenness: Record<string, number>
  closeness: Record<string, number>
  hits: { authority: Record<string, number>; hub: Record<string, number> }
  degree: Record<string, number>
}

/** 子图提取结果 */
interface SubGraphResult {
  id: string
  name: string
  type: 'kcore' | 'community' | 'ego' | 'path' | 'custom'
  nodeIds: string[]
  edgeIds: { source: string; target: string }[]
  metadata: Record<string, unknown>
}

/** 图谱对比差异 */
interface GraphDiffResult {
  addedNodes: string[]
  removedNodes: string[]
  addedEdges: { source: string; target: string }[]
  removedEdges: { source: string; target: string }[]
  similarityScore: number
  structuralDiff: string
}

/** AI问答记录 */
interface AIQARecord {
  id: string
  question: string
  answer: string
  timestamp: Date
  referencedNodes: string[]
  referencedEdges: { source: string; target: string }[]
}

/** v8.1: 模拟外部数据库 — 实际使用时替换为真实API调用 */
const MOCK_EXTERNAL_DB: Record<string, ExternalData> = {
  // 化合物数据 (PubChem风格)
  'Ginsenoside Rb1': { source: 'pubchem', molecularFormula: 'C54H92O23', molecularWeight: 1109.3, smiles: 'CC(C)C1=CC(=C(C=C1)O)C2CC3C4CCC5C6C7...', inchiKey: 'YHQGLMTFVPIQIZ-UHFFFAOYSA-N', targets: ['TP53', 'AKT1', 'EGFR', 'TNF'], pathways: ['PI3K-Akt', 'MAPK', 'Apoptosis'], diseases: ['癌症', '炎症', '心血管疾病'], literatureCount: 2847, lastUpdated: '2024-12-15', description: '人参皂苷Rb1是人参的主要活性成分之一，具有抗氧化、抗炎、神经保护等多重药理活性。', properties: {'LogP': 2.13, 'HBA': 9, 'HBD': 8, 'TPSA': 156.2} },
  'Ginsenoside Rg1': { source: 'pubchem', molecularFormula: 'C42H72O14', molecularWeight: 801.0, smiles: 'CC(C)[C@H]1CC[C@@]2(CC[C@]3(C)...', inchiKey: 'JLQOFCSYUJZPER-UHFFFAOYSA-N', targets: ['CREB1', 'BDNF', 'NOS3'], pathways: ['cAMP', 'Neurotrophin'], diseases: ['认知障碍', '抑郁症', '缺血性损伤'], literatureCount: 3156, lastUpdated: '2024-11-28', description: '人参皂苷Rg1是稀有人参皂苷，具有显著的神经保护和认知增强作用。', properties: {'LogP': 1.89, 'HBA': 8, 'HBD': 7, 'TPSA': 138.4} },
  'Quercetin': { source: 'pubchem', molecularFormula: 'C15H10O7', molecularWeight: 302.24, smiles: 'OC1=CC(O)=C(C=C1C2=CC(=C(C=C2O)O)O)O', inchiKey: 'REFJWSLERFGSGFW-ZQUDATBGSA-N', targets: ['AKT1', 'MAPK1', 'CASP3', 'IL6', 'TNF'], pathways: ['NF-kappa B', 'MAPK', 'PI3K-Akt', 'Apoptosis'], literatureCount: 52100, lastUpdated: '2025-01-02', description: '槲皮素是一种广泛存在于植物中的黄酮醇类化合物，具有强大的抗氧化和抗炎活性。', properties: {'LogP': 1.54, 'HBA': 7, 'HBD': 5, 'TPSA': 119.7} },
  'Resveratrol': { source: 'pubchem', molecularFormula: 'C14H12O3', molecularWeight: 228.25, smiles: 'OC1=CC=C(C=C1)C=C(C2=CC(=CC=C2)O)O', inchiKey: 'BBMCTGGMAVHFFI-KIDAOIKOSA-N', targets: ['SIRT1', 'AMPK', 'FOXO3', 'NFkB'], pathways: ['Sirtuin', 'AMPK', 'Longevity'], literatureCount: 18420, lastUpdated: '2024-12-20', description: '白藜芦醇是一种多酚类化合物，广泛研究其抗衰老和心血管保护作用。', properties: {'LogP': 3.09, 'HBA': 3, 'HBD': 2, 'TPSA': 49.7} },
  'Calycosin': { source: 'pubchem', molecularFormula: 'C16H12O5', molecularWeight: 284.27, smiles: 'COC1=CC(=C(C=C1O)C2=CC(=C(C=C2)O)O)OC', inchiKey: 'WJSNKDVFPYNOIV-UHFFFAOYSA-N', targets: ['ERα', 'VEGF', 'MMP9'], pathways: ['Estrogen', 'Angiogenesis'], literatureCount: 892, lastUpdated: '2024-10-05', description: '毛蕊异黄酮是黄芪的活性成分，具有雌激素样活性和血管生成调节作用。', properties: {'LogP': 2.76, 'HBA': 5, 'HBD': 2, 'TPSA': 57.6} },
  'Ferulic acid': { source: 'pubchem', molecularFormula: 'C10H10O4', molecularWeight: 194.18, smiles: 'COC(=O)C1=CC(=C(C=C1)/C=C/C(=O)O)O', inchiKey: 'QYSMSSAGOOBOJE-KVTTGUOTSA-N', targets: ['COX2', 'NOS2', 'NFkB'], pathways: ['Arachidonic acid', 'NF-kappa B'], literatureCount: 6540, lastUpdated: '2024-12-08', description: '阿魏酸是一种羟基肉桂酸衍生物，广泛存在于植物中，具有抗氧化和抗炎活性。', properties: {'LogP': 1.43, 'HBA': 4, 'HBD': 1, 'TPSA': 55.8} },
  'Astragaloside IV': { source: 'pubchem', molecularFormula: 'C41H68O14', molecularWeight: 784.97, smiles: 'CC1C(C(C(C(O1)OC2C(...)))OC)', inchiKey: 'DJKPUIGTOLQMPF-UHFFFAOYSA-N', targets: ['TLR4', 'MYD88', 'NFkB'], pathways: ['Toll-like receptor', 'NF-kappa B'], literatureCount: 3420, lastUpdated: '2024-11-15', description: '黄芪甲苷是黄芪的主要皂苷成分，具有免疫调节和心脏保护作用。', properties: {'LogP': 1.22, 'HBA': 9, 'HBD': 6, 'TPSA': 143.2} },
  'Liquiritin': { source: 'pubchem', molecularFormula: 'C21H22O9', molecularWeight: 418.40, smiles: 'OC1=CC(O)=CC(=C1C2=CC(=C(C=C2)OC)O)C3C(C(C(O3)CO)O)O', inchiKey: 'VGFIANBYTOQMOF-UHFFFAOYSA-N', targets: ['CYP3A4', 'UGT1A1', 'ABCB1'], pathways: ['Drug metabolism', 'Phase II conjugation'], literatureCount: 1256, lastUpdated: '2024-09-22', description: '甘草苷是甘草的主要黄酮类成分，具有镇咳祛痰和抗炎作用。', properties: {'LogP': 0.91, 'HBA': 9, 'HBD': 6, 'TPSA': 145.5} },
  'Zeaxanthin': { source: 'pubchem', molecularFormula: 'C40H56O2', molecularWeight: 568.88, smiles: 'CC1=C(C(=CC(=C1)C=C2C=CC(=CC2=O)C)C)C=CC=C(C)C=CC=C(C)C=CC=C(C)C=CC=C(C)C=CC=C(C)C=CC(=O)C=C(C)C=C(C)C', inchiKey: 'KBAYPFHRZMSRIC-MDTTDHTOSA-N', targets: ['BCO2', 'RPE65', 'GSTP1'], pathways: ['Carotenoid biosynthesis', 'Visual cycle'], literatureCount: 9870, lastUpdated: '2025-01-03', description: '玉米黄质是一种类胡萝卜素，主要存在于枸杞子中，对眼睛健康有重要保护作用。', properties: {'LogP': 14.2, 'HBA': 2, 'HBD': 0, 'TPSA': 35.5} },
  'Betaine': { source: 'pubchem', molecularFormula: 'C5H11NO2', molecularWeight: 117.15, smiles: 'C[N+](C)(CC(=O)[O-])C', inchiKey: 'ODFYPSNFRUCCIO-UHFFFAOYSA-N', targets: ['BHMT', 'GNMT', 'PEMT'], pathways: ['Methionine cycle', 'One-carbon pool'], literatureCount: 12450, lastUpdated: '2024-12-18', description: '甜菜碱是一种甲基供体化合物，参与同型半胱氨酸代谢，广泛存在于枸杞子和甜菜中。', properties: {'LogP': -3.67, 'HBA': 2, 'HBD': 0, 'TPSA': 37.3} },
  // 药材数据 (TCMSP风格)
  '人参': { source: 'tcmsp', description: '五加科人参属植物人参的干燥根。味甘、微苦，性温。归脾、肺、心经。大补元气，复脉固脱，补脾益肺，生津养血，安神益智。', targets: ['中枢神经系统', '心血管系统', '免疫系统', '内分泌系统'], pathways: ['cAMP-PKA', 'MAPK-ERK', 'PI3K-Akt-mTOR'], diseases: ['疲劳综合征', '免疫力低下', '糖尿病', '高血压'], literatureCount: 15800, lastUpdated: '2024-12-01', properties: {'性味': '甘微苦温', '归经': '脾肺心肾', '功效': '大补元气复脉固脱', '用量': '3-9g'} },
  '黄芪': { source: 'tcmsp', description: '豆科黄芪属植物蒙古黄芪或膜荚黄芪的干燥根。味甘，性微温。归肺、脾经。补气升阳，固表止汗，利水消肿，生津养血，行滞通痹，托毒排脓，敛疮生肌。', targets: ['免疫系统', '心血管系统', '泌尿系统'], pathways: ['TLR-NFκB', 'Nrf2-ARE', 'HIF-1α'], diseases: ['气虚乏力', '慢性肾炎', '糖尿病肾病', '心衰'], literatureCount: 12300, lastUpdated: '2024-11-20', properties: {'性味': '甘微温', '归经': '肺脾', '功效': '补气升阳固表止汗', '用量': '9-30g'} },
  '当归': { source: 'tcmsp', description: '伞形科当归属植物当归的干燥根。味甘、辛，性温。归肝、心、脾经。补血活血，调经止痛，润肠通便。', targets: ['血液系统', '子宫平滑肌', '免疫系统'], pathways: ['cGMP-PKG', 'Estrogen signaling', 'Coagulation cascade'], diseases: ['血虚萎黄', '月经不调', '痛经', '肠燥便秘'], literatureCount: 9850, lastUpdated: '2024-10-15', properties: {'性味': '甘辛温', '归经': '肝心脾', '功效': '补血活血调经止痛', '用量': '6-12g'} },
  '丹参': { source: 'tcmsp', description: '唇形科鼠尾草属植物丹参的干燥根及根茎。味苦，性微寒。归心、肝经。活血祛瘀，通经止痛，清心除烦，凉血消痈。', targets: ['心血管系统', '神经系统', '肝脏'], pathways: ['eNOS-NO-cGMP', 'MAPK', 'PPARγ'], diseases: ['胸痹心痛', '心烦不眠', '痛经闭经', '疮疡肿痛'], literatureCount: 11200, lastUpdated: '2024-12-10', properties: {'性味': '苦微寒', '归经': '心肝', '功效': '活血祛瘀通经止痛', '用量': '10-15g'} },
  '甘草': { source: 'tcmsp', description: '豆科甘草属植物甘草、胀果甘草或光果甘草的干燥根及根茎。味甘，性平。归心、肺、脾、胃经。补脾益气，清热解毒，祛痰止咳，缓急止痛，调和诸药。', targets: ['消化系统', '呼吸系统', '内分泌系统', '免疫系统'], pathways: ['Glucocorticoid', '11β-HSD', 'COX/LOX'], diseases: ['脾胃虚弱', '咳嗽痰多', '脘腹挛急疼痛', '药物中毒'], literatureCount: 14200, lastUpdated: '2024-11-28', properties: {'性味': '甘平', '归经': '心肺脾胃', '功效': '补脾益气清热解毒', '用量': '2-10g'} },
  '枸杞子': { source: 'tcmsp', description: '茄科枸杞属植物宁夏枸杞的成熟果实。味甘，性平。归肝、肾经。滋补肝肾，益精明目。', targets: ['视觉系统', '免疫系统', '生殖系统'], pathways: ['Carotenoid metabolism', 'Antioxidant response', 'Sex hormone'], diseases: ['肝肾阴虚', '视力模糊', '腰膝酸软', '早衰'], literatureCount: 6780, lastUpdated: '2024-12-05', properties: {'性味': '甘平', '归经': '肝肾', '功效': '滋补肝肾益精明目', '用量': '6-12g'} },
  '茯苓': { source: 'tcmsp', description: '多孔菌科茯苓属真菌茯苓的干燥菌核。味甘、淡，性平。归心、肺、脾、肾经。利水渗湿，健脾，宁心。', targets: ['泌尿系统', '消化系统', '神经系统'], pathways: ['Diuretic effect', 'Immune modulation', 'Sedative pathway'], diseases: ['水肿尿少', '痰饮眩悸', '脾虚食少', '便溏泄泻'], literatureCount: 5600, lastUpdated: '2024-10-08', properties: {'性味': '甘淡平', '归经': '心肺脾肾', '功效': '利水渗湿健脾宁心', '用量': '10-15g'} },
  '三七': { source: 'tcmsp', description: '五加科人参属植物三七的干燥根及根茎。味甘、微苦，性温。归肝、胃经。散瘀止血，消肿定痛。', targets: ['血液系统', '心血管系统', '骨骼系统'], pathways: ['Platelet aggregation', 'Collagen synthesis', 'Osteoblast activation'], diseases: ['出血证', '跌打损伤', '胸腹刺痛', '骨折筋伤'], literatureCount: 8900, lastUpdated: '2024-11-12', properties: {'性味': '甘微苦温', '归经': '肝胃', '功效': '散瘀止血消肿定痛', '用量': '3-9g'} },
  '陈皮': { source: 'tcmsp', description: '芸香科柑橘属植物橘及其栽培变种的干燥成熟果皮。味辛、苦，性温。归脾、肺经。理气健脾，燥湿化痰。', targets: ['消化系统', '呼吸系统'], pathways: ['GI motility', 'Bronchial smooth muscle', 'Gastric secretion'], diseases: ['脘腹胀满', '食少吐泻', '咳嗽痰多'], literatureCount: 4200, lastUpdated: '2024-09-18', properties: {'性味': '辛苦温', '归经': '脾肺', '功效': '理气健脾燥湿化痰', '用量': '3-10g'} },
  '山楂': { source: 'tcmsp', description: '蔷薇科山楂属植物山里红或山楂的干燥成熟果实。味酸、甘，性微温。归脾、胃、肝经。消食健胃，行气散瘀，化浊降脂。', targets: ['消化系统', '心血管系统', '脂质代谢'], pathways: ['Pepsin secretion', 'Lipase activity', 'LDL receptor'], diseases: ['肉食积滞', '胃脘胀满', '高脂血症', '血瘀痛经'], literatureCount: 3100, lastUpdated: '2024-10-22', properties: {'性味': '酸甘微温', '归经': '脾胃肝', '功效': '消食健胃行气散瘀', '用量': '9-12g'} },
  // 靶点数据 (UniProt风格)
  'TP53': { source: 'uniprot', description: '肿瘤蛋白p53，被称为"基因组守护者"，在细胞周期调控、DNA修复和凋亡中发挥关键作用。是人类癌症中最常发生突变的基因。', targets: [], pathways: ['p53 signaling', 'Cell cycle arrest', 'DNA damage response', 'Apoptosis'], diseases: ['Li-Fraumeni综合征', '多种癌症'], literatureCount: 285000, lastUpdated: '2025-01-04', properties: {'Gene': 'TP53', 'Protein': 'Cellular tumor antigen p53', 'Length': 393, 'Mass': 43653} },
  'AKT1': { source: 'uniprot', description: 'AKT1丝氨酸/苏氨酸激酶1，也称为PKBα，是PI3K/Akt信号通路的核心效应分子，调控细胞生长、存活和代谢。', targets: [], pathways: ['PI3K-Akt', 'mTOR', 'FoxO signaling', 'Insulin signaling'], literatureCount: 128000, lastUpdated: '2024-12-30', properties: {'Gene': 'AKT1', 'Protein': 'RAC-alpha serine/threonine-protein kinase', 'Length': 480, 'Mass': 55758} },
  'EGFR': { source: 'uniprot', description: '表皮生长因子受体，一种受体酪氨酸激酶，调控细胞增殖、分化和生存。是多种抗癌药物的靶点。', targets: [], pathways: ['ErbB signaling', 'MAPK', 'PI3K-Akt', 'JAK-STAT'], literatureCount: 198000, lastUpdated: '2024-12-28', properties: {'Gene': 'EGFR', 'Protein': 'Epidermal growth factor receptor', 'Length': 1210, 'Mass': 134277} },
  'TNF': { source: 'uniprot', description: '肿瘤坏死因子α，一种促炎细胞因子，在全身炎症反应中起核心作用。是多种自身免疫病和炎症性疾病的治疗靶点。', targets: [], pathways: ['NF-kappa B', 'MAPK', 'Apoptosis', 'Cytokine signaling'], literatureCount: 165000, lastUpdated: '2024-12-25', properties: {'Gene': 'TNFA', 'Protein': 'Tumor necrosis factor', 'Length': 233, 'Mass': 25644} },
  'IL6': { source: 'uniprot', description: '白细胞介素6，多功能细胞因子，参与免疫反应、造血和炎症。其异常表达与多种疾病相关。', targets: [], pathways: ['JAK-STAT', 'PI3K-Akt', 'MAPK', 'Cytokine-cytokine'], literatureCount: 142000, lastUpdated: '2024-12-22', properties: {'Gene': 'IL6', 'Protein': 'Interleukin-6', 'Length': 212, 'Mass': 24019} },
}

// ═══════════════════════════════════════════
// 骨架屏组件
// ═══════════════════════════════════════════

function GraphSkeleton({ height }: { height: number }) {
  return (
    <div className="relative w-full rounded-xl border bg-neutral-50/60 dark:bg-neutral-900/60 border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden" style={{ minHeight: height }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* 中心脉冲圆 */}
          <div className="w-20 h-20 rounded-full bg-primary-500/10 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-primary-500/15 animate-pulse" />
          {/* 环绕小圆 */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
            <div
              key={deg}
              className="absolute w-3 h-3 rounded-full bg-primary-400/25"
              style={{
                top: '50%',
                left: '50%',
                transform: `rotate(${deg}deg) translateY(-36px)`,
                animation: `pulse 2s ease-in-out ${deg * 0.1}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
        <p className="text-sm text-neutral-400 dark:text-neutral-400 font-medium">正在构建知识图谱...</p>
        <p className="text-xs text-neutral-300 dark:text-neutral-400 mt-1">计算节点关系网络</p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// 缩放控制工具条组件
// ═══════════════════════════════════════════

function ZoomToolbar({
  zoomTransform,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
}: {
  zoomTransform: d3.ZoomTransform | null
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onReset: () => void
}) {
  const scale = zoomTransform?.k ?? 1
  const pct = `${Math.round(scale * 100)}%`

  return (
    <div className="absolute top-3 right-3 z-40 flex items-center gap-1 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-md rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 shadow-lg px-1.5 py-1">
      <button onClick={onZoomOut} title="缩小" className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        aria-label="缩小">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H4" />
        </svg>
      </button>

      <span className="text-xs font-mono font-medium text-neutral-500 dark:text-neutral-400 w-10 text-center tabular-nums">{pct}</span>

      <button onClick={onZoomIn} title="放大" className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        aria-label="放大">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
        </svg>
      </button>

      <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-600 mx-0.5" />

      <button onClick={onFit} title="适应画布" className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        aria-label="适应画布">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>

      <button onClick={onReset} title="重置视图" className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        aria-label="重置视图">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════
// v7.6: 小地图画布组件
// ═══════════════════════════════════════════
function MinimapCanvas({
  nodes, edges, width, height,
  selectedNode, pathAnimation,
  communities, communityColors,
  onNavigate,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width: number
  height: number
  selectedNode?: GraphNode | null
  pathAnimation?: { source: string; target: string; pathNodes: string[]; pathEdges: [string, string][] } | null
  communities?: Map<string, number>
  communityColors?: Record<number, string>
  onNavigate?: (x: number, y: number, scale: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || nodes.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)
    const padding = 8
    const drawW = width - padding * 2
    const drawH = height - padding * 2

    const xs = nodes.map(n => n.x ?? 0).filter(x => isFinite(x))
    const ys = nodes.map(n => n.y ?? 0).filter(y => isFinite(y))
    if (xs.length === 0) return

    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const rangeX = Math.max(maxX - minX, 1)
    const rangeY = Math.max(maxY - minY, 1)

    const scaleX = drawW / rangeX
    const scaleY = drawH / rangeY
    const scale = Math.min(scaleX, scaleY)
    const offsetX = padding + (drawW - rangeX * scale) / 2 - minX * scale
    const offsetY = padding + (drawH - rangeY * scale) / 2 - minY * scale

    const toScreen = (x: number, y: number) => [x * scale + offsetX, y * scale + offsetY]

    // Draw edges
    ctx.globalAlpha = 0.15
    ctx.lineWidth = 0.5
    edges.forEach(e => {
      const src = nodes.find(n => (n.id || n.label) === e.source)
      const tgt = nodes.find(n => (n.id || n.label) === e.target)
      if (!src || !tgt) return
      const [sx, sy] = toScreen(src.x ?? 0, src.y ?? 0)
      const [tx, ty] = toScreen(tgt.x ?? 0, tgt.y ?? 0)
      ctx.strokeStyle = '#9CA3AF' // canvas 直绘：中性灰（M5+ 保留，非品牌色）
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(tx, ty)
      ctx.stroke()
    })

    // Draw path animation edges (highlighted)
    if (pathAnimation) {
      ctx.globalAlpha = 0.9
      ctx.lineWidth = 1.5
      ctx.strokeStyle = CANVAS_COLORS.accent // canvas 直绘：不解析 var()，用品牌色 hex（M5+）
      pathAnimation.pathEdges.forEach(([sId, tId]) => {
        const sn = nodes.find(n => (n.id || n.label) === sId)
        const tn = nodes.find(n => (n.id || n.label) === tId)
        if (!sn || !tn) return
        const [sx, sy] = toScreen(sn.x ?? 0, sn.y ?? 0)
        const [tx, ty] = toScreen(tn.x ?? 0, tn.y ?? 0)
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(tx, ty)
        ctx.stroke()
      })
    }

    // Draw nodes
    nodes.forEach(n => {
      if (n.x == null || n.y == null || !isFinite(n.x) || !isFinite(n.y)) return
      const [sx, sy] = toScreen(n.x, n.y)
      let fill = TYPE_CONFIG[n.type]?.color || 'var(--color-knowledge-default, #9CA3AF)'
      if (communities && communities.size > 0 && communityColors) {
        const commId = communities.get(n.id || n.label)
        if (commId !== undefined && communityColors[commId]) fill = communityColors[commId]
      }
      const isSelected = selectedNode && ((selectedNode.id || selectedNode.label) === (n.id || n.label))
      const isInPath = pathAnimation?.pathNodes.includes(n.id || n.label)

      ctx.globalAlpha = isSelected ? 1 : isInPath ? 0.95 : 0.7
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.arc(sx, sy, isSelected ? 3 : 2, 0, Math.PI * 2)
      ctx.fill()

      if (isSelected) {
        ctx.strokeStyle = '#F59E0B'
        ctx.lineWidth = 1.5
        ctx.stroke()
      } else if (isInPath) {
        ctx.strokeStyle = '#C090FF'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    })

    // Viewport indicator (simple center dot for now)
    ctx.globalAlpha = 0.4
    ctx.fillStyle = CANVAS_COLORS.secondary // canvas 直绘：用品牌色 hex（M5+）
    ctx.beginPath()
    ctx.arc(width / 2, height / 2, 4, 0, Math.PI * 2)
    ctx.fill()
  }, [nodes, edges, width, height, selectedNode, pathAnimation, communities, communityColors])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !onNavigate) return
    const rect = canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    const xs = nodes.map(n => n.x ?? 0).filter(x => isFinite(x))
    const ys = nodes.map(n => n.y ?? 0).filter(y => isFinite(y))
    if (xs.length === 0) return
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const rangeX = Math.max(maxX - minX, 1)
    const rangeY = Math.max(maxY - minY, 1)

    const padding = 8
    const drawW = width - padding * 2
    const drawH = height - padding * 2
    const scaleX = drawW / rangeX
    const scaleY = drawH / rangeY
    const scale = Math.min(scaleX, scaleY)
    const offsetX = padding + (drawW - rangeX * scale) / 2 - minX * scale
    const offsetY = padding + (drawH - rangeY * scale) / 2 - minY * scale

    const graphX = (clickX - offsetX) / scale
    const graphY = (clickY - offsetY) / scale
    onNavigate(graphX, graphY, 2.5)
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleCanvasClick}
      className="w-full h-full cursor-crosshair"
      title="点击跳转到该位置"
    />
  )
}

// ═══════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════

export default function KnowledgeGraph({
  nodes,
  edges,
  width = 800,
  height = 520,
  onNodeClick,
  className,
  showLegend = true,
  layout = 'force',
  highlightPath,
  isLoading = false,
}: KnowledgeGraphProps) {
  // ── State Management (extracted to graph/hooks/useGraphState.ts) ──
  const {
    state, dispatch,
    svgRef, containerRef, zoomBehaviorRef, prevLayoutRef, prevDataRef,
    perfFrameTimesRef, lastFrameTimeRef, perfRafIdRef, engineRef,
    tooltip, setTooltip, activeFilter, setActiveFilter, selectedNode, setSelectedNode,
    zoomTransform, setZoomTransform, legendOpen, setLegendOpen, detailTab, setDetailTab,
    searchQuery, setSearchQuery, searchResults, setSearchResults, searchHistory, setSearchHistory,
    focusedNodeIndex, setFocusedNodeIndex, isSelecting, setIsSelecting, selectionBox, setSelectionBox,
    selectedNodes, setSelectedNodes, contextMenu, setContextMenu,
    communities, setCommunities, communityColors, setCommunityColors,
    perfStats, setPerfStats, showPerfPanel, setShowPerfPanel,
    showExportMenu, setShowExportMenu, exportStatus, setExportStatus,
    showMinimap, setShowMinimap, pathAnimation, setPathAnimation,
    collapsedGroups, setCollapsedGroups, showCentralityPanel, setShowCentralityPanel,
    sortBy, setSortBy, pinnedNodes, setPinnedNodes, showPinnedPanel, setShowPinnedPanel,
    annotations, setAnnotations, isAddingAnnotation, setIsAddingAnnotation,
    activeTheme, setActiveTheme, showThemePanel, setShowThemePanel,
    animationPreset, setAnimationPreset, showLayoutMenu, setShowLayoutMenu, localLayout, setLocalLayout,
    aiInsights, setAiInsights, showAIPanel, setShowAIPanel, smartPathResult, setSmartPathResult,
    showPathPanel, setShowPathPanel, pathSourceId, setPathSourceId, pathTargetId, setPathTargetId,
    nodeAIAnalysis, setNodeAIAnalysis, graphSnapshots, setGraphSnapshots, isGeneratingInsight, setIsGeneratingInsight,
    externalDataCache, setExternalDataCache, showExternalPanel, setShowExternalPanel, externalLoadingId, setExternalLoadingId,
    importState, setImportState, showImportDialog, setShowImportDialog,
    showCompareMode, setShowCompareMode, compareResult, setCompareResult,
    syncStatus, setSyncStatus, lastSyncTime, setLastSyncTime, dragOver, setDragOver,
    shareLink, setShareLink, showSharePanel, setShowSharePanel,
    nodeAnnotations, setNodeAnnotations, showAnnotationPanel, setShowAnnotationPanel,
    newAnnotationText, setNewAnnotationText,
    historyEntries, setHistoryEntries, historyIndex, setHistoryIndex, showHistoryPanel, setShowHistoryPanel,
    bookmarks, setBookmarks, showBookmarkPanel, setShowBookmarkPanel,
    reportConfig, setReportConfig, showReportDialog, setShowReportDialog, reportGenerating, setReportGenerating,
    graphStats, setGraphStats, showStatsPanel, setShowStatsPanel,
    communityResult, setCommunityResult, kcoreResult, setKcoreResult, centralityMetrics, setCentralityMetrics,
    centralityMode, setCentralityMode, savedSubGraphs, setSavedSubGraphs, activeSubGraph, setActiveSubGraph,
    showSubGraphPanel, setShowSubGraphPanel, aiQAHistory, setAiQAHistory, aiQuestion, setAiQuestion, aiAnswering, setAiAnswering,
    // Search helpers
    handleSearchChange, handleSearchSelect, clearSearch,
    // Communities & grouping
    toggleGroupCollapse,
    // Pins
    togglePinNode, clearAllPins, batchOperationOnSelected,
    // Annotations
    addAnnotation, removeAnnotation, clearAllAnnotations,
    // Theme / layout / animation
    applyTheme, switchLayoutMode, switchAnimationPreset,
    // AI insights / paths / analysis
    generateAIInsights, generateNodeAnalysis, runSmartPathSearch, takeSnapshot,
    // External data / import / comparison
    queryExternalData, handleFileImport, runGraphComparison, triggerAutoSync, handleDragOver, handleDragLeave, handleDrop,
    // Sharing
    generateShareLink, copyShareLink, addNodeAnnotation,
    // History / undo / redo
    addHistoryEntry, undoHistory, redoHistory,
    // Bookmarks
    addBookmark, loadBookmark, removeBookmark,
    // Reports
    generateReport,
    // Advanced analysis
    computeGraphStatistics, computePageRank, computeBetweenness, computeCloseness,
    runCentralityAnalysis, detectCommunitiesLouvain, computeKCore, extractEgoNetwork, handleAIQuestion,
    // Selection
    handleSelectionComplete, handleContextAction, exportSubgraphJSON,
    // Navigation
    findPathBFS, startPathAnimation,
    // Zoom controls
    handleZoomIn, handleZoomOut, handleFitToCanvas, handleResetView,
    // Toggles
    toggleLegend, togglePerfPanel, toggleExportMenu, toggleMinimap, togglePinnedPanel,
    toggleThemePanel, toggleLayoutMenu, toggleAIPanel, togglePathPanel, toggleExternalPanel,
    toggleImportDialog, toggleCompareMode, toggleSharePanel, toggleAnnotationPanel, toggleHistoryPanel,
    toggleBookmarkPanel, toggleReportDialog, toggleStatsPanel, toggleCentralityPanel, toggleSubGraphPanel,
    // Derived
    filteredData, lodLevel, dataChanged, detectedCommunities, generatedCommunityColors,
    centralityData, sortedNodeList, degreeStats, allTypes, typeCounts, nodeConnections, searchMatches,
    maxDegree,
  } = useGraphState({ initialLayout: layout as any, nodes, edges, onNodeClick } as any)

  // ── Derive all props for the layout component ──
  const { filteredNodes, filteredEdges } = filteredData
  const degreeMap = degreeStats?.degreeMap ?? new Map<string, number>()
  const sortedNodeListMemo = useMemo(() => {
    if (!(centralityData as any)?.topByDegree) return []
    const list = [...((centralityData as any)?.topByDegree || [])]
    if (sortBy === 'label') list.sort((a, b) => (a.node.label || '').localeCompare(b.node.label || '', 'zh-CN'))
    else if (sortBy === 'type') list.sort((a, b) => a.node.type.localeCompare(b.node.type))
    return list
  }, [centralityData, sortBy])

  // ═══════════════════════════════════════════
  // JSX composition (delegated to graph/components/GraphPanelLayout.tsx)
  // ═══════════════════════════════════════════
  return <GraphPanelLayout
    nodes={nodes} edges={edges} width={width} height={height} className={className} onNodeClick={onNodeClick}
    state={state} dispatch={dispatch}
    filteredData={{ filteredNodes, filteredEdges }} lodLevel={lodLevel} dataChanged={dataChanged}
    detectedCommunities={detectedCommunities} generatedCommunityColors={generatedCommunityColors}
    centralityData={centralityData} sortedNodeList={sortedNodeListMemo}
    degreeStats={degreeStats} allTypes={allTypes} typeCounts={typeCounts} nodeConnections={nodeConnections}
    searchMatches={searchMatches} maxDegree={maxDegree}
    svgRef={svgRef} containerRef={containerRef} zoomBehaviorRef={zoomBehaviorRef} engineRef={engineRef}
    handleSearchChange={handleSearchChange} handleSearchSelect={handleSearchSelect} clearSearch={clearSearch}
    toggleGroupCollapse={toggleGroupCollapse} togglePinNode={togglePinNode} clearAllPins={clearAllPins}
    batchOperationOnSelected={batchOperationOnSelected}
    addAnnotation={addAnnotation} removeAnnotation={removeAnnotation} clearAllAnnotations={clearAllAnnotations}
    applyTheme={applyTheme} switchLayoutMode={switchLayoutMode} switchAnimationPreset={switchAnimationPreset}
    generateAIInsights={generateAIInsights} takeSnapshot={takeSnapshot} runSmartPathSearch={runSmartPathSearch}
    queryExternalData={queryExternalData} handleFileImport={handleFileImport} runGraphComparison={runGraphComparison}
    triggerAutoSync={triggerAutoSync} handleDragOver={handleDragOver} handleDragLeave={handleDragLeave} handleDrop={handleDrop}
    generateShareLink={generateShareLink} copyShareLink={copyShareLink} addNodeAnnotation={addNodeAnnotation}
    addHistoryEntry={addHistoryEntry} undoHistory={undoHistory} redoHistory={redoHistory}
    addBookmark={addBookmark} loadBookmark={loadBookmark} removeBookmark={removeBookmark}
    generateReport={generateReport} computeGraphStatistics={computeGraphStatistics}
    detectCommunitiesLouvain={detectCommunitiesLouvain} computeKCore={computeKCore} extractEgoNetwork={extractEgoNetwork}
    handleAIQuestion={handleAIQuestion} startPathAnimation={startPathAnimation}
    handleZoomIn={handleZoomIn} handleZoomOut={handleZoomOut} handleFitToCanvas={handleFitToCanvas} handleResetView={handleResetView}
    handleSelectionComplete={handleSelectionComplete} handleContextAction={handleContextAction} exportSubgraphJSON={exportSubgraphJSON}
    setTooltip={setTooltip} setSelectedNode={setSelectedNode} setZoomTransform={setZoomTransform}
    setActiveFilter={setActiveFilter} setSelectedNodes={setSelectedNodes} setShowExportMenu={setShowExportMenu} setExportStatus={setExportStatus}
    setShowPerfPanel={setShowPerfPanel} setShowMinimap={setShowMinimap} setShowImportDialog={setShowImportDialog}
    setShowCompareMode={setShowCompareMode} setShowSharePanel={setShowSharePanel} setShowAnnotationPanel={setShowAnnotationPanel}
    setShowHistoryPanel={setShowHistoryPanel} setShowBookmarkPanel={setShowBookmarkPanel} setShowReportDialog={setShowReportDialog}
    setShowStatsPanel={setShowStatsPanel} setShowCentralityPanel={setShowCentralityPanel} setShowSubGraphPanel={setShowSubGraphPanel}
    setShowPathPanel={setShowPathPanel} setShowExternalPanel={setShowExternalPanel} setShowAIPanel={setShowAIPanel}
    setShowThemePanel={setShowThemePanel} setShowLayoutMenu={setShowLayoutMenu} setShowPinnedPanel={setShowPinnedPanel}
    setIsAddingAnnotation={setIsAddingAnnotation} setIsGeneratingInsight={setIsGeneratingInsight}
    setCentralityMode={setCentralityMode} setAiAnswering={setAiAnswering} setAiQuestion={setAiQuestion}
    setNewAnnotationText={setNewAnnotationText} setReportConfig={setReportConfig} setSortBy={setSortBy}
    activeFilter={activeFilter} selectedNode={selectedNode} searchQuery={searchQuery} focusedNodeIndex={focusedNodeIndex}
    searchHistory={searchHistory} showPerfPanel={showPerfPanel} perfStats={perfStats}
    isSelecting={isSelecting} selectionBox={selectionBox} selectedNodes={selectedNodes} contextMenu={contextMenu}
    communities={communities} communityColors={communityColors} showExportMenu={showExportMenu} exportStatus={exportStatus}
    showMinimap={showMinimap} pathAnimation={pathAnimation} collapsedGroups={collapsedGroups}
    showCentralityPanel={showCentralityPanel} sortBy={sortBy} pinnedNodes={pinnedNodes} showPinnedPanel={showPinnedPanel}
    annotations={annotations as any} isAddingAnnotation={isAddingAnnotation}
    activeTheme={activeTheme} showThemePanel={showThemePanel} animationPreset={animationPreset} showLayoutMenu={showLayoutMenu} localLayout={localLayout}
    aiInsights={aiInsights} showAIPanel={showAIPanel} smartPathResult={smartPathResult} showPathPanel={showPathPanel}
    pathSourceId={pathSourceId} pathTargetId={pathTargetId} nodeAIAnalysis={nodeAIAnalysis} graphSnapshots={graphSnapshots as any}
    isGeneratingInsight={isGeneratingInsight}
    externalDataCache={externalDataCache as any} showExternalPanel={showExternalPanel} externalLoadingId={externalLoadingId}
    importState={importState as any} showImportDialog={showImportDialog}
    showCompareMode={showCompareMode} compareResult={compareResult} syncStatus={syncStatus} lastSyncTime={lastSyncTime} dragOver={dragOver}
    shareLink={shareLink as any} showSharePanel={showSharePanel}
    nodeAnnotations={nodeAnnotations} showAnnotationPanel={showAnnotationPanel} newAnnotationText={newAnnotationText}
    historyEntries={historyEntries} historyIndex={historyIndex} showHistoryPanel={showHistoryPanel}
    bookmarks={bookmarks} showBookmarkPanel={showBookmarkPanel}
    reportConfig={reportConfig} showReportDialog={showReportDialog} reportGenerating={reportGenerating}
    graphStats={graphStats} showStatsPanel={showStatsPanel}
    communityResult={communityResult} kcoreResult={kcoreResult} centralityMetrics={centralityMetrics}
    centralityMode={centralityMode} savedSubGraphs={savedSubGraphs} activeSubGraph={activeSubGraph} showSubGraphPanel={showSubGraphPanel}
    aiQAHistory={aiQAHistory} aiQuestion={aiQuestion} aiAnswering={aiAnswering} />
}
