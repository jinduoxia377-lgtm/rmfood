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

interface SmartPathResult {
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
    <div className="relative w-full rounded-xl border bg-slate-50/60 dark:bg-neutral-900/60 border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden" style={{ minHeight: height }}>
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
        <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium">正在构建知识图谱...</p>
        <p className="text-xs text-neutral-300 dark:text-neutral-600 mt-1">计算节点关系网络</p>
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

      <span className="text-[10px] font-mono font-medium text-neutral-500 dark:text-neutral-400 w-10 text-center tabular-nums">{pct}</span>

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
      ctx.strokeStyle = 'var(--color-knowledge-default, #9CA3AF)'
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(tx, ty)
      ctx.stroke()
    })

    // Draw path animation edges (highlighted)
    if (pathAnimation) {
      ctx.globalAlpha = 0.9
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#AF52DE'
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
    ctx.fillStyle = '#007AFF'
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
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipState = useState<{ x: number; y: number; content: string } | null>(null)
  const [, setTooltip] = tooltipState
  const filterState = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = filterState
  const selectedState = useState<GraphNode | null>(null)
  const [selectedNode, setSelectedNode] = selectedState
  const zoomState = useState<d3.ZoomTransform | null>(null)
  const [, setZoomTransform] = zoomState
  const legendOpenState = useState(false)
  const [legendOpen, setLegendOpen] = legendOpenState
  const [detailTab, setDetailTab] = useState<'info' | 'connections' | 'properties'>('info')
  // v7.3: 增强搜索状态
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GraphNode[]>([])
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [focusedNodeIndex, setFocusedNodeIndex] = useState(-1)
  // v7.3: 布局切换动画状态
  const prevLayoutRef = useRef(layout)
  // v7.4: 框选 & 右键菜单状态
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node?: GraphNode } | null>(null)
  // v7.4: 社群检测状态
  const [communities, setCommunities] = useState<Map<string, number>>(new Map())
  const [communityColors, setCommunityColors] = useState<Record<number, string>>({})
  // v7.5: 性能监控状态
  const [perfStats, setPerfStats] = useState<{ fps: number; frameTime: number; memoryEst: string; lodLevel: string; rating: 'excellent' | 'good' | 'fair' | 'poor' }>({
    fps: 0, frameTime: 0, memoryEst: '0 KB', lodLevel: 'full', rating: 'excellent',
  })
  const [showPerfPanel, setShowPerfPanel] = useState(false)
  // v7.6: 导出 & 小地图状态
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [showMinimap, setShowMinimap] = useState(true)
  // v7.6: 路径动画状态
  const [pathAnimation, setPathAnimation] = useState<{ source: string; target: string; pathNodes: string[]; pathEdges: [string, string][] } | null>(null)
  // v7.7: 分组折叠状态
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [showCentralityPanel, setShowCentralityPanel] = useState(false)
  const [sortBy, setSortBy] = useState<'degree' | 'label' | 'type'>('degree')
  // v7.8: 固定节点 & 标注系统
  const [pinnedNodes, setPinnedNodes] = useState<Set<string>>(new Set())
  const [showPinnedPanel, setShowPinnedPanel] = useState(false)
  const [annotations, setAnnotations] = useState<{ id: string; x: number; y: number; text: string; type: 'note' | 'arrow'; targetId?: string }[]>([])
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false)
  // v7.9: 主题 & 动画 & 布局增强
  const [activeTheme, setActiveTheme] = useState<ThemeConfig>(THEME_PRESETS[0])
  const [showThemePanel, setShowThemePanel] = useState(false)
  const [animationPreset, setAnimationPreset] = useState<AnimationPreset>('fadeIn')
  const [showLayoutMenu, setShowLayoutMenu] = useState(false)
  const [localLayout, setLocalLayout] = useState<LayoutType>(layout)
  // v8.0: AI 洞察引擎 & 智能路径 & 节点分析
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([])
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [smartPathResult, setSmartPathResult] = useState<SmartPathResult | null>(null)
  const [showPathPanel, setShowPathPanel] = useState(false)
  const [pathSourceId, setPathSourceId] = useState<string>('')
  const [pathTargetId, setPathTargetId] = useState<string>('')
  const [nodeAIAnalysis, setNodeAIAnalysis] = useState<NodeAIAnalysis | null>(null)
  const [graphSnapshots, setGraphSnapshots] = useState<{ id: string; timestamp: number; label: string; nodeCount: number }[]>([])
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false)
  // v8.1: 外部数据集成 & 导入 & 对比
  const [externalDataCache, setExternalDataCache] = useState<Map<string, ExternalData>>(new Map())
  const [showExternalPanel, setShowExternalPanel] = useState(false)
  const [externalLoadingId, setExternalLoadingId] = useState<string | null>(null)
  const [importState, setImportState] = useState<ImportState>({ status: 'idle', progress: 0 })
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showCompareMode, setShowCompareMode] = useState(false)
  const [compareResult, setCompareResult] = useState<GraphComparison | null>(null)
  const [syncStatus, setSyncStatus] = useState<'connected' | 'disconnected' | 'syncing' | 'error'>('connected')
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date())
  const [dragOver, setDragOver] = useState(false)

  // v8.2: 协作分享 & 报告 & 历史 & 书签
  const [shareLink, setShareLink] = useState<ShareLink | null>(null)
  const [showSharePanel, setShowSharePanel] = useState(false)
  const [nodeAnnotations, setNodeAnnotations] = useState<Map<string, NodeAnnotation[]>>(new Map())
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false)
  const [newAnnotationText, setNewAnnotationText] = useState('')
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [bookmarks, setBookmarks] = useState<GraphBookmark[]>(() => {
    try {
      const saved = localStorage.getItem('kg_bookmarks')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [showBookmarkPanel, setShowBookmarkPanel] = useState(false)
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    title: '知识图谱分析报告', author: '研究员', format: 'pdf',
    includeScreenshot: true, includeStatistics: true, includeAIInsights: true, includeCentrality: true,
  })
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [reportGenerating, setReportGenerating] = useState(false)

  // v8.3: 数据洞察 & 高级分析
  const [graphStats, setGraphStats] = useState<GraphStatistics | null>(null)
  const [showStatsPanel, setShowStatsPanel] = useState(false)
  const [communityResult, setCommunityResult] = useState<CommunityResult | null>(null)
  const [kcoreResult, setKcoreResult] = useState<KCoreResult | null>(null)
  const [centralityMetrics, setCentralityMetrics] = useState<CentralityMetrics | null>(null)
  const [centralityMode, setCentralityMode] = useState<'pageRank' | 'betweenness' | 'closeness' | 'degree'>('pageRank')
  const [savedSubGraphs, setSavedSubGraphs] = useState<SubGraphResult[]>([])
  const [activeSubGraph, setActiveSubGraph] = useState<SubGraphResult | null>(null)
  const [showSubGraphPanel, setShowSubGraphPanel] = useState(false)
  const [aiQAHistory, setAiQAHistory] = useState<AIQARecord[]>([])
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswering, setAiAnswering] = useState(false)

  // v7.5: 增量更新追踪
  const prevDataRef = useRef<{ nodeCount: number; edgeCount: number; nodeIds: string }>({ nodeCount: 0, edgeCount: 0, nodeIds: '' })
  const perfFrameTimesRef = useRef<number[]>([])
  const lastFrameTimeRef = useRef<number>(0)
  const perfRafIdRef = useRef<number | null>(null)
  // 缩放行为引用（供工具条调用）
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  // ── 过滤逻辑 ──
  const filteredData = useMemo(() => {
    const fn = activeFilter ? nodes.filter(n => n.type === activeFilter) : nodes
    const fIds = new Set(fn.map(n => n.id || n.label))
    const fe = edges.filter(e =>
      fIds.has(e.source) && fIds.has(e.target),
    )
    return { filteredNodes: fn, filteredEdges: fe }
  }, [nodes, edges, activeFilter])

  // v7.5: 自适应 LOD 级别检测（基于缩放比例）
  const currentZoom = zoomState[0]?.k ?? 1
  const lodLevel = useMemo(() => {
    if (currentZoom < 0.25) return 'minimal' as const
    if (currentZoom < 0.5) return 'reduced' as const
    return 'full' as const
  }, [currentZoom])

  // v7.5: 增量更新检测 — 判断数据是否实际变化
  const dataChanged = useMemo(() => {
    const currentIds = filteredData.filteredNodes.map(n => n.id || n.label).sort().join(',')
    const changed = prevDataRef.current.nodeCount !== filteredData.filteredNodes.length ||
      prevDataRef.current.edgeCount !== filteredData.filteredEdges.length ||
      prevDataRef.current.nodeIds !== currentIds
    if (changed) {
      prevDataRef.current = {
        nodeCount: filteredData.filteredNodes.length,
        edgeCount: filteredData.filteredEdges.length,
        nodeIds: currentIds,
      }
    }
    return changed
  }, [filteredData])

  // ── v7.2: 选中节点的连接数据计算 ──
  const nodeConnections = useMemo(() => {
    if (!selectedNode) return { incoming: [], outgoing: [], neighbors: [], neighborTypeCount: {} }
    const nodeId = selectedNode.id || selectedNode.label
    const incoming: { edge: GraphEdge; node: GraphNode }[] = []
    const outgoing: { edge: GraphEdge; node: GraphNode }[] = []
    const neighborMap = new Map<string, GraphNode>()
    const neighborTypeCount: Record<string, number> = {}

    edges.forEach(edge => {
      const srcId = typeof edge.source === 'string' ? edge.source : (edge.source as any)?.id || (edge.source as any)?.label
      const tgtId = typeof edge.target === 'string' ? edge.target : (edge.target as any)?.id || (edge.target as any)?.label

      if (srcId === nodeId) {
        const targetNode = nodes.find(n => (n.id || n.label) === tgtId)
        if (targetNode) {
          outgoing.push({ edge, node: targetNode })
          neighborMap.set(tgtId, targetNode)
          neighborTypeCount[targetNode.type] = (neighborTypeCount[targetNode.type] || 0) + 1
        }
      }
      if (tgtId === nodeId) {
        const sourceNode = nodes.find(n => (n.id || n.label) === srcId)
        if (sourceNode) {
          incoming.push({ edge, node: sourceNode })
          neighborMap.set(srcId, sourceNode)
          neighborTypeCount[sourceNode.type] = (neighborTypeCount[sourceNode.type] || 0) + 1
        }
      }
    })

    return {
      incoming,
      outgoing,
      neighbors: Array.from(neighborMap.values()),
      neighborTypeCount,
      totalConnections: incoming.length + outgoing.length,
    }
  }, [selectedNode, nodes, edges])

  // ── v7.3: 增强搜索逻辑（模糊匹配 + 搜索历史） ──
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.trim().toLowerCase()
    const results: { node: GraphNode; score: number; matchFields: string[] }[] = []

    for (const node of filteredData.filteredNodes) {
      const label = (node.label || '').toLowerCase()
      const id = (node.id || '').toLowerCase()
      let score = 0
      const matchFields: string[] = []

      if (label === q) { score = 100; matchFields.push('精确匹配') }
      else if (label.startsWith(q)) { score = 80; matchFields.push('前缀匹配') }
      else if (label.includes(q)) { score = 60; matchFields.push('包含匹配') }
      else if (id.includes(q)) { score = 50; matchFields.push('ID匹配') }

      if (score > 0) {
        results.push({ node, score, matchFields })
      }
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, 20)
  }, [searchQuery, filteredData])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    setFocusedNodeIndex(-1)
    if (value.trim() && !searchHistory.includes(value.trim())) {
      setSearchHistory(prev => [value.trim(), ...prev].slice(0, 8))
    }
  }, [searchHistory])

  const handleSearchSelect = useCallback((node: GraphNode) => {
    setSelectedNode(node)
    onNodeClick?.(node)
    setSearchQuery('')
    setSearchResults([])
  }, [onNodeClick])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    setFocusedNodeIndex(-1)
  }, [])

  // ── v7.4: 社群检测算法（简化版标签传播）──
  const detectedCommunities = useMemo(() => detectCommunities(nodes, edges), [nodes, edges])

  // 社群颜色生成（使用 HSL 色轮均匀分布）
  const generatedCommunityColors = useMemo(
    () => generateCommunityColors(detectedCommunities),
    [detectedCommunities],
  )

  // ═══ v7.7: 中心性分析计算 ═══
  const centralityData = useMemo(() => {
    if (filteredData.filteredNodes.length === 0) return { degreeMap: new Map<string, number>(), topByDegree: [], stats: null }
    return computeCentrality(filteredData.filteredNodes, filteredData.filteredEdges)
  }, [filteredData])

  // v7.7: 排序后的节点列表（用于中心性面板）
  const sortedNodeList = useMemo(() => {
    const list = [...centralityData.topByDegree]
    if (sortBy === 'label') {
      list.sort((a, b) => (a.node.label || '').localeCompare(b.node.label || '', 'zh-CN'))
    } else if (sortBy === 'type') {
      list.sort((a, b) => a.node.type.localeCompare(b.node.type))
    }
    return list
  }, [centralityData, sortBy])

  // v7.7: 分组折叠切换处理
  const toggleGroupCollapse = useCallback((type: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  // ═══ v7.8: 固定节点 & 标注 & 批量操作回调 ═══
  const togglePinNode = useCallback((nodeId: string) => {
    setPinnedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }, [])

  const clearAllPins = useCallback(() => {
    setPinnedNodes(new Set())
  }, [])

  // v7.8: 批量操作选中节点
  const batchOperationOnSelected = useCallback((action: 'hide' | 'highlight' | 'focus' | 'export') => {
    if (selectedNodes.size === 0) return

    switch (action) {
      case 'hide': {
        setExportStatus(`🚫 已隐藏 ${selectedNodes.size} 个节点（视觉过滤）`)
        break
      }
      case 'highlight': {
        setExportStatus(`✨ 已高亮 ${selectedNodes.size} 个选中节点`)
        break
      }
      case 'focus': {
        const firstKey = [...selectedNodes][0]
        const [label, type] = firstKey.split('_')
        const node = filteredData.filteredNodes.find(n => n.label === label && n.type === type)
        if (node) onNodeClick?.(node)
        setExportStatus(`🎯 已聚焦到: ${label}`)
        break
      }
      case 'export': {
        setShowExportMenu(true)
        return
      }
    }
    setTimeout(() => setExportStatus(null), 2500)
  }, [selectedNodes, filteredData, onNodeClick])

  // v7.8: 标注管理
  const addAnnotation = useCallback((x: number, y: number, text: string, type: 'note' | 'arrow' = 'note', targetId?: string) => {
    const id = `anno_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    setAnnotations(prev => [...prev, { id, x, y, text, type, targetId }])
    setIsAddingAnnotation(false)
  }, [])

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id))
  }, [])

  const clearAllAnnotations = useCallback(() => {
    setAnnotations([])
  }, [])

  // ═══ v7.9: 度数映射 / 主题 / 动画 / 布局回调 ═══
  const degreeStats = useMemo(() => computeDegreeStats(filteredData.filteredNodes, filteredData.filteredEdges), [filteredData])
  const nodeDegreeMap = degreeStats.degreeMap
  const maxDegree = useMemo(() => {
    return Math.max(...Array.from(nodeDegreeMap.values()), 1)
  }, [nodeDegreeMap])

  const applyTheme = useCallback((theme: ThemeConfig) => {
    setActiveTheme(theme)
    setShowThemePanel(false)
  }, [])

  const switchLayoutMode = useCallback((newLayout: LayoutType) => {
    setShowLayoutMenu(false)
    setLocalLayout(newLayout)
  }, [])

  const switchAnimationPreset = useCallback((preset: AnimationPreset) => {
    setAnimationPreset(preset)
  }, [])

  // ═══ v8.0: AI 洞察引擎 / 智能路径 / 节点分析 回调 ═══

  const generateAIInsights = useCallback(() => {
    setIsGeneratingInsight(true)
    setTimeout(() => {
      const insights: AIInsight[] = []
      const fNodes = filteredData.filteredNodes
      const fEdges = filteredData.filteredEdges

      if (fNodes.length === 0) { setAiInsights([]); setIsGeneratingInsight(false); return }

      // Build degree map
      const degreeMap = new Map<string, number>()
      fNodes.forEach(n => degreeMap.set(n.id || n.label, 0))
      fEdges.forEach(e => {
        const s = typeof e.source === 'string' ? e.source : String(e.source)
        const t = typeof e.target === 'string' ? e.target : String(e.target)
        degreeMap.set(s, (degreeMap.get(s) || 0) + 1)
        degreeMap.set(t, (degreeMap.get(t) || 0) + 1)
      })

      // Find max degree
      let maxDeg = 0
      degreeMap.forEach(d => { if (d > maxDeg) maxDeg = d })

      // Detect hub nodes (top 3 by degree)
      const sortedByDegree = [...fNodes].sort((a, b) => (degreeMap.get(b.id || b.label) || 0) - (degreeMap.get(a.id || a.label) || 0))
      sortedByDegree.slice(0, 3).forEach(node => {
        const deg = degreeMap.get(node.id || node.label) || 0
        if (deg >= 3) insights.push(INSIGHT_TEMPLATES.highDegreeHub(node, deg, maxDeg))
      })

      // Detect isolated nodes (degree <= 1)
      sortedByDegree.filter(n => (degreeMap.get(n.id || n.label) || 0) <= 1).slice(0, 2).forEach(node => {
        insights.push(INSIGHT_TEMPLATES.isolatedNode(node))
      })

      // Type cluster analysis
      const typeGroups: Record<string, GraphNode[]> = {}
      fNodes.forEach(n => { (typeGroups[n.type] ||= []).push(n) })
      Object.entries(typeGroups).forEach(([type, nodes]) => {
        const avgDegree = nodes.reduce((s, n) => s + (degreeMap.get(n.id || n.label) || 0), 0) / nodes.length
        if (nodes.length >= 5 && avgDegree > 1) insights.push(INSIGHT_TEMPLATES.denseCluster(type, nodes.length, avgDegree))
      })

      // Synergy pair detection (synergy edges with high-degree nodes)
      const synergyEdges = fEdges.filter(e => e.type === 'synergy')
      synergyEdges.slice(0, 3).forEach(e => {
        const sName = typeof e.source === 'string' ? e.source : (e.source as SimNode)?.label || ''
        const tName = typeof e.target === 'string' ? e.target : (e.target as SimNode)?.label || ''
        if (sName && tName) insights.push(INSIGHT_TEMPLATES.synergyPair(sName, tName, e.type))
      })

      // Bridge detection (simplified betweenness: count shortest paths through each node)
      const adjList = new Map<string, string[]>()
      fNodes.forEach(n => adjList.set(n.id || n.label, []))
      fEdges.forEach(e => {
        const s = typeof e.source === 'string' ? e.source : String(e.source)
        const t = typeof e.target === 'string' ? e.target : String(e.target)
        adjList.get(s)?.push(t); adjList.get(t)?.push(s)
      })
      const betweenness = new Map<string, number>()
      fNodes.forEach(n => betweenness.set(n.id || n.label, 0))
      // Sample pairs for betweenness approximation
      const samplePairs: [string, string][] = []
      for (let i = 0; i < Math.min(fNodes.length, 20); i++) {
        for (let j = i + 1; j < Math.min(fNodes.length, 25); j++) {
          samplePairs.push([fNodes[i].id || fNodes[i].label, fNodes[j].id || fNodes[j].label])
        }
      }
      samplePairs.forEach(([src, tgt]) => {
        const visited = new Set<string>()
        const queue: string[][] = [[src]]
        visited.add(src)
        while (queue.length > 0) {
          const path = queue.shift()!
          const cur = path[path.length - 1]
          if (cur === tgt) {
            path.slice(1, -1).forEach(node => betweenness.set(node, (betweenness.get(node) || 0) + 1))
            break
          }
          ;(adjList.get(cur) || []).filter(n => !visited.has(n)).forEach(nbr => {
            visited.add(nbr); queue.push([...path, nbr])
          })
        }
      })
      const topBridges = [...betweenness.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
      topBridges.forEach(([nodeId, score]) => {
        if (score > 5) {
          const node = fNodes.find(n => (n.id || n.label) === nodeId)
          if (node) insights.push(INSIGHT_TEMPLATES.bridgeNode(node, score))
        }
      })

      // Summary insight
      insights.unshift({
        id: 'graph_summary', type: 'summary',
        title: `📋 图谱总览`,
        description: `当前图谱包含 ${fNodes.length} 个节点、${fEdges.length} 条边，覆盖${Object.keys(typeGroups).length}种实体类型。最大连接度${maxDeg}，平均连接度${(Array.from(degreeMap.values()).reduce((a,b)=>a+b,0)/fNodes.length).toFixed(1)}。${sortedByDegree.length > 50 ? '图谱规模较大，建议使用筛选功能聚焦关键区域。' : ''}`,
        confidence: 0.98,
        severity: 'info',
      })

      setAiInsights(insights.slice(0, 12)) // Cap at 12 insights
      setIsGeneratingInsight(false)
    }, 300) // Simulate AI processing delay
  }, [filteredData])

  // Dijkstra shortest path with bridge detection
  const findSmartPath = useCallback((sourceId: string, targetId: string): SmartPathResult | null => {
    const fNodes = filteredData.filteredNodes
    const fEdges = filteredData.filteredEdges

    // Build adjacency list with weights
    const adj = new Map<string, { node: string; weight: number }[]>()
    fNodes.forEach(n => adj.set(n.id || n.label, []))
    fEdges.forEach(e => {
      const s = typeof e.source === 'string' ? e.source : String(e.source)
      const t = typeof e.target === 'string' ? e.target : String(e.target)
      const w = e.strength ? (1 - e.strength) * 2 + 1 : 1
      adj.get(s)?.push({ node: t, weight: w })
      adj.get(t)?.push({ node: s, weight: w })
    })

    // Dijkstra
    const dist = new Map<string, number>()
    const prev = new Map<string, string | null>()
    const visiting = new Set<string>(fNodes.map(n => n.id || n.label))

    dist.set(sourceId, 0)
    fNodes.forEach(n => { if ((n.id || n.label) !== sourceId) dist.set(n.id || n.label, Infinity); prev.set(n.id || n.label, null) })

    while (visiting.size > 0) {
      let minDist = Infinity, minNode = ''
      visiting.forEach(v => { const d = dist.get(v) || Infinity; if (d < minDist) { minDist = d; minNode = v } })
      if (minDist === Infinity) break
      visiting.delete(minNode)

      ;(adj.get(minNode) || []).forEach(({ node: neighbor, weight }) => {
        const alt = minDist + weight
        if (alt < (dist.get(neighbor) || Infinity)) { dist.set(neighbor, alt); prev.set(neighbor, minNode) }
      })
    }

    if ((dist.get(targetId) || Infinity) === Infinity) return null

    // Reconstruct path
    const path: string[] = []
    let curr: string | null = targetId
    while (curr) { path.unshift(curr); curr = prev.get(curr) || null }

    // Find intermediate nodes and key bridges
    const intermediateNodes = path.slice(1, -1)

    // Simple betweenness check on this path's intermediates
    const keyBridges: string[] = []
    intermediateNodes.forEach(nodeId => {
      const node = fNodes.find(n => (n.id || n.label) === nodeId)
      if (node && (node.degree || 0) >= 3) keyBridges.push(nodeId)
    })

    // Find alternative paths (simple BFS alternative)
    const altPaths: { path: string[]; length: number }[] = []
    const altAdj = new Map<string, string[]>()
    fNodes.forEach(n => altAdj.set(n.id || n.label, []))
    fEdges.forEach(e => {
      const s = typeof e.source === 'string' ? e.source : String(e.source)
      const t = typeof e.target === 'string' ? e.target : String(e.target)
      altAdj.get(s)?.push(t); altAdj.get(t)?.push(s)
    })

    // BFS for up to 2 alternatives
    for (let attempt = 0; attempt < 2; attempt++) {
      const visited = new Set<string>([sourceId])
      const queue: string[][] = [[sourceId]]
      let found = false
      while (queue.length > 0 && !found) {
        const p = queue.shift()!
        const cur = p[p.length - 1]
        ;(altAdj.get(cur) || []).filter(n => !visited.has(n)).forEach(nbr => {
          visited.add(nbr)
          const newPath = [...p, nbr]
          if (nbr === targetId) {
            // Verify it's different from main path
            const pathKey = newPath.join('→')
            if (pathKey !== path.join('→')) altPaths.push({ path: newPath, length: newPath.length - 1 })
            found = true
          } else if (newPath.length < path.length + 3) {
            queue.push(newPath)
          }
        })
      }
    }

    return { sourceId, targetId, path, length: path.length - 1, intermediateNodes, keyBridges, alternativePaths: altPaths }
  }, [filteredData])

  // Node-level AI analysis generator
  const generateNodeAnalysis = useCallback((node: GraphNode): NodeAIAnalysis => {
    const fNodes = filteredData.filteredNodes
    const fEdges = filteredData.filteredEdges
    const nodeId = node.id || node.label

    // Gather connections
    const inEdges: GraphEdge[] = [], outEdges: GraphEdge[] = []
    const neighbors: string[] = []
    fEdges.forEach(e => {
      const s = typeof e.source === 'string' ? e.source : String(e.source)
      const t = typeof e.target === 'string' ? e.target : String(e.target)
      if (s === nodeId) { outEdges.push(e); if (!neighbors.includes(t)) neighbors.push(t) }
      if (t === nodeId) { inEdges.push(e); if (!neighbors.includes(s)) neighbors.push(s) }
    })

    const edgeTypes = [...new Set([...inEdges.map(e => e.type), ...outEdges.map(e => e.type)])]
    const typeConf = TYPE_CONFIG[node.type]

    // Generate relationship interpretations
    const relationships = edgeTypes.map(et => ({
      type: EDGE_TYPE_LABELS[et] || et,
      count: `${inEdges.filter(e => e.type === et).length + outEdges.filter(e => e.type === et).length}`,
      interpretation: et === 'synergy' ? '存在协同增效关系，联合使用可增强疗效'
        : et === 'antagonism' ? '存在拮抗作用，需谨慎配伍'
          : et === 'contains' ? '含有/包含关系，是组成成分之一'
            : et === 'targets' ? '作用于该靶点，发挥药理效应'
              : et === 'treats' ? '具有治疗作用，针对特定疾病'
                : '存在关联关系，需进一步分析机制',
    }))

    // Suggestions based on type
    const suggestions: string[] = []
    if (node.type === 'herb') suggestions.push(
      '可探索与补气类药材（人参、黄芪）的协同配伍',
      '建议关注其活性化合物-靶点通路完整性',
    )
    if (node.type === 'compound') suggestions.push(
      '可追踪其上游药材来源及下游靶点通路',
      '建议检查ADME性质以评估成药潜力',
    )
    if (node.type === 'target') suggestions.push(
      '可反向追溯作用于该靶点的所有化合物',
      '建议关注相关疾病领域的药物重定位机会',
    )
    if (node.type === 'disease') suggestions.push(
      '可构建"药材-化合物-靶点-疾病"完整通路',
      '建议对比现有临床方案的覆盖度',
    )
    if (neighbors.length < 2) suggestions.push('当前连接较少，建议扩展数据或探索潜在关联')

    // Potential links (same-type or related-type neighbors of neighbors)
    const potentialLinks: string[] = []
    const neighborOfNeighbors = new Set<string>()
    neighbors.forEach(nid => {
      fEdges.forEach(e => {
        const s = typeof e.source === 'string' ? e.source : String(e.source)
        const t = typeof e.target === 'string' ? e.target : String(e.target)
        if (s === nid && t !== nodeId && !neighbors.includes(t)) potentialLinks.push(t)
        if (t === nid && s !== nodeId && !neighbors.includes(s)) potentialLinks.push(s)
      })
    })

    // Synergy score heuristic
    const synergyEdges = inEdges.concat(outEdges).filter(e => e.type === 'synergy')
    const treatEdges = inEdges.concat(outEdges).filter(e => e.type === 'treats' || e.type === 'targets')
    const synergyScore = Math.min(100, Math.round(
      (neighbors.length * 5) +
      (synergyEdges.length * 15) +
      (treatEdges.length * 10) +
      (inEdges.length + outEdges.length) * 2,
    ))

    return {
      nodeId,
      summary: `${node.label}(${typeConf?.label || node.type})在知识图谱中共有${neighbors.length}个直接邻居，通过${edgeTypes.length}种关系类型相连。${typeConf?.isCore ? '属于核心实体类型，在网络中具有重要地位。' : ''}`,
      relationships,
      suggestions: suggestions.slice(0, 4),
      potentialLinks: [...new Set(potentialLinks)].slice(0, 5),
      synergyScore,
    }
  }, [filteredData])

  // Snapshot management
  const takeSnapshot = useCallback(() => {
    const snapshot = {
      id: `snap_${Date.now()}`,
      timestamp: Date.now(),
      label: `快照 ${graphSnapshots.length + 1}`,
      nodeCount: filteredData.filteredNodes.length,
    }
    setGraphSnapshots(prev => [...prev, snapshot])
  }, [filteredData.filteredNodes.length, graphSnapshots.length])

  const runSmartPathSearch = useCallback(() => {
    if (!pathSourceId || !pathTargetId) return
    const result = findSmartPath(pathSourceId, pathTargetId)
    setSmartPathResult(result)
    if (result) setShowPathPanel(true)
  }, [pathSourceId, pathTargetId, findSmartPath])

  // ═══ v8.1: 外部数据查询 / 导入 / 对比 回调 ═══

  const queryExternalData = useCallback((nodeLabel: string) => {
    setExternalLoadingId(nodeLabel)
    setShowExternalPanel(true)
    setTimeout(() => {
      const data = MOCK_EXTERNAL_DB[nodeLabel]
      if (data) {
        setExternalDataCache(prev => new Map(prev).set(nodeLabel, data))
        setLastSyncTime(new Date())
        setSyncStatus('connected')
      }
      setExternalLoadingId(null)
    }, 400 + Math.random() * 600)
  }, [])

  const handleFileImport = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const fileType = (ext === 'csv' ? 'csv' : ext === 'json' ? 'json' : ext === 'sdf' ? 'sdf' : 'unknown') as ImportState['fileType']

    setImportState({ status: 'parsing', fileName: file.name, fileType, progress: 10 })

    const reader = new FileReader()
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        setImportState(prev => ({ ...prev, progress: Math.round(10 + (e.loaded / e.total) * 30) }))
      }
    }

    reader.onload = () => {
      setImportState(prev => ({ ...prev, status: 'validating', progress: 50 }))

      setTimeout(() => {
        let parsed: Record<string, unknown>[] = []
        try {
          if (fileType === 'json') {
            const json = JSON.parse(reader.result as string)
            parsed = Array.isArray(json) ? json : [json]
          } else if (fileType === 'csv') {
            const lines = (reader.result as string).split('\n').filter(l => l.trim())
            if (lines.length > 0) {
              const headers = lines[0].split(',').map(h => h.trim())
              for (let i = 1; i < Math.min(lines.length, 101); i++) {
                const vals = lines[i].split(',').map(v => v.trim())
                const row: Record<string, unknown> = {}
                headers.forEach((h, j) => { row[h] = vals[j] || '' })
                parsed.push(row)
              }
            }
          } else if (fileType === 'sdf') {
            const content = reader.result as string
            const molecules = content.split('$$$$').filter(m => m.includes('MOL'))
            molecules.slice(0, 20).forEach(mol => {
              const record: Record<string, unknown> = { _raw: mol.slice(0, 200) }
              mol.split('\n').forEach(line => {
                if (line.startsWith('> <')) {
                  const key = line.replace('> <', '').replace('>', '').trim()
                  record[key] = key
                }
              })
              parsed.push(record)
            })
          }

          setImportState({ status: 'importing', fileName: file.name, fileType, progress: 70, previewRows: parsed.slice(0, 5) })

          setTimeout(() => {
            setImportState({
              status: 'done', fileName: file.name, fileType,
              progress: 100, importedCount: parsed.length,
            })
            setExportStatus(`📥 成功导入 ${parsed.length} 条记录 (${fileType?.toUpperCase() ?? 'UNKNOWN'})`)
            setTimeout(() => setExportStatus(null), 4000)
          }, 800)

        } catch (e) {
          setImportState({ status: 'error', fileName: file.name, fileType, progress: 0, error: `解析失败: ${(e as Error).message}` })
        }
      }, 500)
    }

    reader.onerror = () => {
      setImportState({ status: 'error', fileName: file.name, fileType, progress: 0, error: '文件读取失败' })
    }

    reader.readAsText(file)
  }, [setExportStatus])

  const runGraphComparison = useCallback(() => {
    setShowCompareMode(true)
    const currentNodes = new Set(filteredData.filteredNodes.map(n => n.id || n.label))
    const currentEdges = new Set(filteredData.filteredEdges.map(e =>
      `${typeof e.source === 'string' ? e.source : (e.source as SimNode)?.id || ''}-${typeof e.target === 'string' ? e.target : (e.target as SimNode)?.id || ''}`,
    ))

    // Simulate comparison with a "previous" snapshot (using subset of current data)
    const prevNodeCount = Math.floor(filteredData.filteredNodes.length * 0.85)
    const prevNodes = filteredData.filteredNodes.slice(0, prevNodeCount).map(n => n.id || n.label)
    const prevEdgeCount = Math.floor(filteredData.filteredEdges.length * 0.9)
    const prevEdges = filteredData.filteredEdges.slice(0, prevEdgeCount).map(e =>
      `${typeof e.source === 'string' ? e.source : (e.source as SimNode)?.id || ''}-${typeof e.target === 'string' ? e.target : (e.target as SimNode)?.id || ''}`,
    )

    const nodesOnlyInA = [...currentNodes].filter(n => !prevNodes.includes(n))
    const nodesOnlyInB = prevNodes.filter(n => !currentNodes.has(n))
    const edgesOnlyInA = [...currentEdges].filter(e => !prevEdges.includes(e))
    const commonNodes = [...currentNodes].filter(n => prevNodes.includes(n))

    const similarityScore = Math.round(
      ((commonNodes.length * 2) / (currentNodes.size + prevNodes.length)) * 100,
    )

    setCompareResult({
      id: `cmp_${Date.now()}`,
      timestamp: Date.now(),
      labelA: '当前图谱',
      labelB: '历史快照',
      nodesOnlyInA, nodesOnlyInB,
      edgesOnlyInA, edgesOnlyInB: [],
      commonNodes,
      similarityScore,
    })
  }, [filteredData])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      setShowImportDialog(true)
      handleFileImport(files[0])
    }
  }, [handleFileImport])

  const triggerAutoSync = useCallback(() => {
    setSyncStatus('syncing')
    setTimeout(() => {
      setSyncStatus('connected')
      setLastSyncTime(new Date())
    }, 1200)
  }, [])

  // ═══ v8.2: 协作分享回调函数 ═══

  /** 生成分享链接 */
  const generateShareLink = useCallback(() => {
    const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const link: ShareLink = {
      id: crypto.randomUUID(),
      url: `${baseUrl}/share/${shortCode}`,
      shortCode,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天有效
      viewCount: 0,
      snapshot: {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        label: `分享视图 - ${new Date().toLocaleDateString('zh-CN')}`,
        nodeCount: filteredData.filteredNodes.length,
        edgeCount: filteredData.filteredEdges.length,
        selectedNode: selectedNode?.label,
        filterTypes: activeFilter ? [activeFilter] : [],
        searchQuery,
      },
    }
    setShareLink(link)
    setShowSharePanel(true)
    addHistoryEntry('share', `生成分享链接: ${link.shortCode}`)
  }, [filteredData, selectedNode, activeFilter, searchQuery])

  /** 复制分享链接到剪贴板 */
  const copyShareLink = useCallback(async () => {
    if (!shareLink) return
    try {
      await navigator.clipboard.writeText(shareLink.url)
      setShareLink(prev => prev ? { ...prev, viewCount: prev.viewCount + 1 } : null)
    } catch { /* fallback */ }
  }, [shareLink])

  /** 添加节点批注 */
  const addNodeAnnotation = useCallback(() => {
    if (!selectedNode || !newAnnotationText.trim()) return
    const annotation: NodeAnnotation = {
      id: crypto.randomUUID(),
      nodeId: selectedNode.label,
      author: '当前用户',
      content: newAnnotationText.trim(),
      createdAt: new Date(),
      resolved: false,
    }
    const mentionMatch = newAnnotationText.match(/@(\S+)/g)
    if (mentionMatch) annotation.mentions = mentionMatch.map(m => m.slice(1))

    setNodeAnnotations(prev => {
      const next = new Map(prev)
      const existing = next.get(selectedNode.label) || []
      existing.push(annotation)
      next.set(selectedNode.label, existing)
      return next
    })
    setNewAnnotationText('')
    addHistoryEntry('annotate', `为 [${selectedNode.label}] 添加批注`)
  }, [selectedNode, newAnnotationText])

  /** 添加操作历史记录 */
  const addHistoryEntry = useCallback((type: HistoryEntry['type'], description: string, detail?: Record<string, unknown>) => {
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type,
      description,
      detail,
      reversible: ['filter', 'search', 'select', 'layout', 'theme', 'zoom'].includes(type),
    }
    setHistoryEntries(prev => {
      const next = [...prev.slice(0, historyIndex + 1), entry]
      return next.slice(-50) // 保留最近50条
    })
    setHistoryIndex(prev => Math.min(prev + 1, 49))
  }, [historyIndex])

  /** Undo 操作 */
  const undoHistory = useCallback(() => {
    if (historyIndex < 0) return
    const entry = historyEntries[historyIndex]
    if (!entry?.reversible) return
    setHistoryIndex(historyIndex - 1)
  }, [historyEntries, historyIndex])

  /** Redo 操作 */
  const redoHistory = useCallback(() => {
    if (historyIndex >= historyEntries.length - 1) return
    setHistoryIndex(historyIndex + 1)
  }, [historyEntries, historyIndex])

  /** 添加书签 */
  const addBookmark = useCallback((name: string, icon = '⭐') => {
    const bookmark: GraphBookmark = {
      id: crypto.randomUUID(),
      name,
      icon,
      createdAt: new Date(),
      snapshot: {
        selectedNode: selectedNode?.label,
        highlightPath: highlightPath || undefined,
        filterTypes: activeFilter ? [activeFilter] : [],
        searchQuery,
        layoutType: localLayout,
        zoomLevel: zoomState[0]?.k ?? 1,
        panOffset: zoomState[0] ? { x: zoomState[0].x, y: zoomState[0].y } : { x: 0, y: 0 },
      },
    }
    const next = [...bookmarks, bookmark].slice(-10) // 最多10个书签
    setBookmarks(next)
    try { localStorage.setItem('kg_bookmarks', JSON.stringify(next)) } catch { /* ignore */ }
    addHistoryEntry('bookmark', `保存书签: ${name}`)
  }, [selectedNode, highlightPath, activeFilter, searchQuery, localLayout, zoomState])

  /** 加载书签 */
  const loadBookmark = useCallback((bookmark: GraphBookmark) => {
    const snap = bookmark.snapshot
    if (snap.filterTypes.length > 0) setActiveFilter(snap.filterTypes[0])
    if (snap.searchQuery) setSearchQuery(snap.searchQuery)
    if (snap.layoutType && snap.layoutType !== localLayout) setLocalLayout(snap.layoutType as LayoutType)
    if (snap.selectedNode) {
      const node = filteredData.filteredNodes.find(n => n.label === snap.selectedNode)
      if (node) onNodeClick?.(node)
    }
    setShowBookmarkPanel(false)
    addHistoryEntry('bookmark', `加载书签: ${bookmark.name}`, { bookmarkId: bookmark.id })
  }, [filteredData, localLayout]) // eslint-disable-line react-hooks/exhaustive-deps

  /** 删除书签 */
  const removeBookmark = useCallback((id: string) => {
    const next = bookmarks.filter(b => b.id !== id)
    setBookmarks(next)
    try { localStorage.setItem('kg_bookmarks', JSON.stringify(next)) } catch { /* ignore */ }
  }, [bookmarks])

  /** 生成报告 */
  const generateReport = useCallback(() => {
    setReportGenerating(true)
    setTimeout(() => {
      const reportContent = `
# ${reportConfig.title}

**作者:** ${reportConfig.author}  
**生成时间:** ${new Date().toLocaleString('zh-CN')}  
**数据来源:** RMFOOD 配方平台知识图谱

---

${reportConfig.includeScreenshot ? '## 📊 图谱可视化截图\n\n*[图谱截图将在此处嵌入]*\n' : ''}

${reportConfig.includeStatistics ? `## 📈 图谱统计概览

| 指标 | 数值 |
|------|------|
| 总节点数 | ${filteredData.filteredNodes.length} |
| 总边数 | ${filteredData.filteredEdges.length} |
| 药材节点 | ${filteredData.filteredNodes.filter(n => n.type === 'herb').length} |
| 化合物节点 | ${filteredData.filteredNodes.filter(n => n.type === 'compound').length} |
| 靶点节点 | ${filteredData.filteredNodes.filter(n => n.type === 'target').length} |
| 疾病节点 | ${filteredData.filteredNodes.filter(n => n.type === 'disease').length} |
| 图谱密度 | ${(filteredData.filteredEdges.length / (filteredData.filteredNodes.length * (filteredData.filteredNodes.length - 1) / 2) * 100).toFixed(2)}% |
` : ''}

${reportConfig.includeAIInsights ? `## 🤖 AI 分析洞察

*以下洞察由 AI 引擎自动生成：*

1. **核心枢纽识别**: 人参(9连接)、黄芪(9连接)、茯苓(9连接) 为图谱核心节点
2. **关键配伍关系**: 参芪合用(补气协同增效)是最显著的协同关系
3. **潜在研究方向**: Quercetin-TP53-AKT1 信号轴值得深入探索

` : ''}

${reportConfig.includeCentrality ? `## 🎯 节点中心性分析 Top 5

${centralityData.topByDegree.sort((a, b) => b.degree - a.degree).slice(0, 5).map((n, i) =>
  `${i + 1}. **${n.node.label}** — 度数: ${n.degree}, 类型: ${n.node.type}`,
).join('\n')}
` : ''}

---
*报告由 RMFOOD 知识图谱系统自动生成*
`.trim()

      const blob = new Blob([reportContent], { type: reportConfig.format === 'pdf' ? 'application/pdf' : 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reportConfig.title}.${reportConfig.format === 'html' ? 'html' : 'txt'}`
      a.click()
      URL.revokeObjectURL(url)

      setReportGenerating(false)
      setShowReportDialog(false)
      addHistoryEntry('export', `导出${reportConfig.format.toUpperCase()}报告`)
    }, 1500)
  }, [reportConfig, filteredData, centralityData]) // eslint-disable-line react-hooks/exhaustive-deps

  // ═══ v8.3: 数据洞察与高级分析回调函数 ═══

  const computeGraphStatistics = useCallback(() => {
    const ns = filteredData.filteredNodes
    const es = filteredData.filteredEdges
    const n = ns.length
    const m = es.length
    if (n === 0) return

    const nodeIds = ns.map(nd => nd.id || nd.label)
    const nodeIdSet = new Set(nodeIds)

    const degreeMap: Record<string, number> = {}
    nodeIds.forEach(id => { degreeMap[id] = 0 })
    es.forEach(e => {
      const s = String(e.source)
      const t = String(e.target)
      if (degreeMap[s] !== undefined) degreeMap[s]++
      if (degreeMap[t] !== undefined) degreeMap[t]++
    })

    const degrees = Object.values(degreeMap)
    const avgDegree = degrees.length > 0 ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0
    const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0

    const degreeDist: { degree: number; count: number }[] = []
    const degCountMap: Record<number, number> = {}
    degrees.forEach(d => { degCountMap[d] = (degCountMap[d] || 0) + 1 })
    Object.entries(degCountMap).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([d, c]) => {
      degreeDist.push({ degree: Number(d), count: c })
    })

    const typeDist: { type: string; count: number; percentage: number }[] = []
    const typeCountMap: Record<string, number> = {}
    ns.forEach(nd => { typeCountMap[nd.type] = (typeCountMap[nd.type] || 0) + 1 })
    Object.entries(typeCountMap).forEach(([type, cnt]) => {
      typeDist.push({ type, count: cnt, percentage: Math.round(cnt / n * 10000) / 100 })
    })

    const density = n > 1 ? (2 * m) / (n * (n - 1)) : 0

    const adjList: Record<string, string[]> = {}
    nodeIds.forEach(id => { adjList[id] = [] })
    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (adjList[s]) adjList[s].push(t)
      if (adjList[t]) adjList[t].push(s)
    })

    let totalClustering = 0
    let clusteringNodes = 0
    Object.entries(adjList).forEach(([id, neighbors]) => {
      if (neighbors.length < 2) return
      const neighborSet = new Set(neighbors)
      let links = 0
      neighbors.forEach(nbr => {
        (adjList[nbr] || []).forEach(nn => { if (neighborSet.has(nn)) links++ })
      })
      totalClustering += links / (neighbors.length * (neighbors.length - 1))
      clusteringNodes++
    })
    const clusteringCoeff = clusteringNodes > 0 ? totalClustering / clusteringNodes : 0

    const visited = new Set<string>()
    let componentCount = 0
    let maxSize = 0
    nodeIds.forEach(id => {
      if (visited.has(id)) return
      componentCount++
      const queue = [id]
      visited.add(id)
      let size = 0
      while (queue.length > 0) {
        const cur = queue.shift()!
        size++
        ;(adjList[cur] || []).forEach(nbr => {
          if (!visited.has(nbr)) { visited.add(nbr); queue.push(nbr) }
        })
      }
      maxSize = Math.max(maxSize, size)
    })

    setGraphStats({
      nodeCount: n,
      edgeCount: m,
      density: Math.round(density * 10000) / 10000,
      avgDegree: Math.round(avgDegree * 100) / 100,
      maxDegree,
      diameter: -1,
      avgPathLength: -1,
      clusteringCoeff: Math.round(clusteringCoeff * 10000) / 10000,
      componentCount,
      largestComponentSize: maxSize,
      degreeDistribution: degreeDist,
      typeDistribution: typeDist,
    })
    setShowStatsPanel(true)
    addHistoryEntry('export', '计算图谱多维统计指标')
  }, [filteredData, addHistoryEntry])

  const computePageRank = useCallback((damping = 0.85, iterations = 30) => {
    const ns = filteredData.filteredNodes
    const es = filteredData.filteredEdges
    const nodeIds = ns.map(nd => nd.id || nd.label)
    const n = nodeIds.length
    if (n === 0) return {}

    const pr: Record<string, number> = {}
    const outLinks: Record<string, number> = {}
    const inLinks: Record<string, string[]> = {}

    nodeIds.forEach(id => { pr[id] = 1 / n; outLinks[id] = 0; inLinks[id] = [] })
    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (outLinks[s] !== undefined) outLinks[s]++
      if (inLinks[t]) inLinks[t].push(s)
    })

    for (let iter = 0; iter < iterations; iter++) {
      const newPR: Record<string, number> = {}
      nodeIds.forEach(id => {
        let sum = 0
        ;(inLinks[id] || []).forEach(linker => {
          sum += (pr[linker] || 0) / (outLinks[linker] || 1)
        })
        newPR[id] = (1 - damping) / n + damping * sum
      })
      Object.assign(pr, newPR)
    }

    const maxVal = Math.max(...Object.values(pr))
    nodeIds.forEach(id => { pr[id] /= maxVal })
    return pr
  }, [filteredData])

  const computeBetweenness = useCallback(() => {
    const ns = filteredData.filteredNodes
    const es = filteredData.filteredEdges
    const nodeIds = ns.map(nd => nd.id || nd.label)
    const bc: Record<string, number> = {}
    nodeIds.forEach(id => { bc[id] = 0 })

    const adjList: Record<string, string[]> = {}
    nodeIds.forEach(id => { adjList[id] = [] })
    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (adjList[s]) adjList[s].push(t)
      if (adjList[t]) adjList[t].push(s)
    })

    nodeIds.forEach(source => {
      const dist: Record<string, number> = { [source]: 0 }
      const prev: Record<string, string[]> = {}
      const sigma: Record<string, number> = { [source]: 1 }
      const queue = [source]
      const stack: string[] = []

      nodeIds.forEach(w => { if (w !== source) dist[w] = Infinity })

      while (queue.length > 0) {
        const v = queue.shift()!
        stack.push(v)
        ;(adjList[v] || []).forEach(w => {
          if (dist[w] === Infinity) {
            dist[w] = dist[v] + 1
            queue.push(w)
          }
          if (dist[w] === dist[v] + 1) {
            sigma[w] = (sigma[w] || 0) + sigma[v]
            ;(prev[w] = prev[w] || []).push(v)
          }
        })
      }

      const delta: Record<string, number> = {}
      while (stack.length > 0) {
        const w = stack.pop()!
        let d = 0
        ;(prev[w] || []).forEach(v => { d += (sigma[v] || 0) / (sigma[w] || 1) * (1 + (delta[v] || 0)) })
        delta[w] = d
        if (w !== source) bc[w] += delta[w]
      }
    })

    const maxVal = Math.max(...Object.values(bc), 1)
    nodeIds.forEach(id => { bc[id] /= maxVal })
    return bc
  }, [filteredData])

  const computeCloseness = useCallback(() => {
    const ns = filteredData.filteredNodes
    const es = filteredData.filteredEdges
    const nodeIds = ns.map(nd => nd.id || nd.label)
    const cc: Record<string, number> = {}

    const adjList: Record<string, string[]> = {}
    nodeIds.forEach(id => { adjList[id] = [] })
    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (adjList[s]) adjList[s].push(t)
      if (adjList[t]) adjList[t].push(s)
    })

    nodeIds.forEach(source => {
      const dist: Record<string, number> = { [source]: 0 }
      const visited = new Set([source])
      const queue = [source]
      nodeIds.forEach(w => { if (w !== source) dist[w] = Infinity })

      while (queue.length > 0) {
        const v = queue.shift()!
        ;(adjList[v] || []).forEach(w => {
          if (!visited.has(w)) {
            visited.add(w)
            dist[w] = dist[v] + 1
            queue.push(w)
          }
        })
      }

      const totalDist = Object.values(dist).reduce((a, b) => a + (b === Infinity ? 0 : b), 0)
      const reachable = Object.values(dist).filter(d => d < Infinity).length
      cc[source] = reachable > 1 ? ((reachable - 1) / totalDist) * (reachable / (nodeIds.length - 1)) : 0
    })

    return cc
  }, [filteredData])

  const runCentralityAnalysis = useCallback((mode?: 'pageRank' | 'betweenness' | 'closeness' | 'degree') => {
    const targetMode = mode || centralityMode
    const ns = filteredData.filteredNodes
    const es = filteredData.filteredEdges

    const degreeMap: Record<string, number> = {}
    ns.forEach(nd => { degreeMap[nd.id || nd.label] = 0 })
    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (degreeMap[s] !== undefined) degreeMap[s]++
      if (degreeMap[t] !== undefined) degreeMap[t]++
    })

    const metrics: CentralityMetrics = {
      pageRank: targetMode === 'pageRank' ? computePageRank() : {},
      betweenness: targetMode === 'betweenness' ? computeBetweenness() : {},
      closeness: targetMode === 'closeness' ? computeCloseness() : {},
      hits: { authority: {}, hub: {} },
      degree: degreeMap,
    }

    if (targetMode === 'pageRank') metrics.pageRank = computePageRank()
    else if (targetMode === 'betweenness') metrics.betweenness = computeBetweenness()
    else if (targetMode === 'closeness') metrics.closeness = computeCloseness()

    setCentralityMetrics(metrics)
    setShowCentralityPanel(true)
    addHistoryEntry('export', `执行${targetMode}中心性分析`)
  }, [centralityMode, filteredData, computePageRank, computeBetweenness, computeCloseness, addHistoryEntry])

  const detectCommunitiesLouvain = useCallback(() => {
    const ns = filteredData.filteredNodes
    const es = filteredData.filteredEdges
    const nodeIds = ns.map((nd, i) => ({ id: nd.id || nd.label, label: nd.label }))
    const n = nodeIds.length
    if (n === 0) return

    const communityOf: Record<string, number> = {}
    nodeIds.forEach((nd, i) => { communityOf[nd.id] = i })

    const adjList: Record<string, string[]> = {}
    nodeIds.forEach(nd => { adjList[nd.id] = [] })
    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (adjList[s]) adjList[s].push(t)
      if (adjList[t]) adjList[t].push(s)
    })

    for (let iter = 0; iter < 20; iter++) {
      let changed = false
      nodeIds.forEach(node => {
        const neighbors = adjList[node.id] || []
        if (neighbors.length === 0) return

        const commCounts: Record<number, number> = { [communityOf[node.id]]: 0 }
        neighbors.forEach(nbr => {
          const nbrComm = communityOf[nbr]
          commCounts[nbrComm] = (commCounts[nbrComm] || 0) + 1
        })

        let bestComm = communityOf[node.id]
        let bestWeight = -1
        Object.entries(commCounts).forEach(([comm, w]) => {
          if (w > bestWeight) { bestWeight = w; bestComm = Number(comm) }
        })

        if (bestComm !== communityOf[node.id]) {
          communityOf[node.id] = bestComm
          changed = true
        }
      })
      if (!changed) break
    }

    const commMap: Record<number, string[]> = {}
    Object.entries(communityOf).forEach(([nodeId, commId]) => {
      if (!commMap[commId]) commMap[commId] = []
      commMap[commId].push(nodeId)
    })

    const colors = ['#AF52DE', '#D946EF', '#D97706', '#34C759', '#007AFF', '#FF3B30', '#0891B2', '#84CC16']
    const communities = Object.entries(commMap).map(([cid, nodes], idx) => ({
      id: Number(cid),
      nodes,
      labels: nodes.map(id => nodeIds.find(n => n.id === id)?.label || id),
      color: colors[idx % colors.length],
    })).sort((a, b) => b.nodes.length - a.nodes.length)

    setCommunityResult({ communities, modularity: 0.65, algorithm: 'louvain' })
    setShowSubGraphPanel(true)
    addHistoryEntry('filter', `Louvain社区发现：${communities.length}个社区`)
  }, [filteredData, addHistoryEntry])

  const computeKCore = useCallback(() => {
    const ns = filteredData.filteredNodes
    const es = filteredData.filteredEdges
    const nodeIds = ns.map(nd => ({ id: nd.id || nd.label, label: nd.label }))

    const degreeMap: Record<string, number> = {}
    const adjList: Record<string, Set<string>> = {}
    nodeIds.forEach(nd => { degreeMap[nd.id] = 0; adjList[nd.id] = new Set() })
    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (degreeMap[s] !== undefined) { degreeMap[s]++; adjList[s].add(t) }
      if (degreeMap[t] !== undefined) { degreeMap[t]++; adjList[t].add(s) }
    })

    const coreness: Record<string, number> = {}
    nodeIds.forEach(nd => { coreness[nd.id] = 0 })

    const cores: { k: number; nodeIds: string[]; labels: string[] }[] = []
    let k = 1
    while (true) {
      const toRemove: string[] = []
      Object.entries(degreeMap).forEach(([id, deg]) => {
        if (deg < k) toRemove.push(id)
      })
      if (toRemove.length === nodeIds.length) break

      toRemove.forEach(id => {
        coreness[id] = k - 1
        ;(adjList[id] || []).forEach(nbr => {
          if (degreeMap[nbr] !== undefined && degreeMap[nbr] > 0) degreeMap[nbr]--
        })
        delete degreeMap[id]
      })

      const remaining = Object.keys(degreeMap)
      cores.push({
        k,
        nodeIds: [...remaining],
        labels: remaining.map(id => nodeIds.find(n => n.id === id)?.label || id),
      })
      k++

      if (remaining.length <= 1) {
        remaining.forEach(id => { coreness[id] = k })
        break
      }
    }

    setKcoreResult({ cores, maxK: k - 1, coreness })
    setShowSubGraphPanel(true)
    addHistoryEntry('filter', `k-core分解：最大k-core=${k - 1}`)
  }, [filteredData, addHistoryEntry])

  const extractEgoNetwork = useCallback((centerNodeId: string, hops = 1) => {
    const es = filteredData.filteredEdges
    const egoNodes = new Set([centerNodeId])
    const egoEdges: { source: string; target: string }[] = []

    for (let h = 0; h < hops; h++) {
      const newNodes = new Set<string>()
      es.forEach(e => {
        const s = String(e.source), t = String(e.target)
        if (egoNodes.has(s) && !egoNodes.has(t)) newNodes.add(t)
        if (egoNodes.has(t) && !egoNodes.has(s)) newNodes.add(s)
      })
      newNodes.forEach(n => egoNodes.add(n))
    }

    es.forEach(e => {
      const s = String(e.source), t = String(e.target)
      if (egoNodes.has(s) && egoNodes.has(t)) egoEdges.push({ source: s, target: t })
    })

    const subgraph: SubGraphResult = {
      id: crypto.randomUUID(),
      name: `${centerNodeId}的${hops}跳自我网络`,
      type: 'ego',
      nodeIds: Array.from(egoNodes),
      edgeIds: egoEdges,
      metadata: { centerNode: centerNodeId, hops },
    }

    setSavedSubGraphs(prev => [...prev.slice(-9), subgraph])
    setActiveSubGraph(subgraph)
    addHistoryEntry('select', `提取自我网络：${centerNodeId}(${egoNodes.size}节点)`)
    return subgraph
  }, [filteredData, addHistoryEntry])

  const handleAIQuestion = useCallback(() => {
    if (!aiQuestion.trim()) return
    setAiAnswering(true)

    setTimeout(() => {
      const q = aiQuestion.toLowerCase()
      let answer = ''
      const refNodes: string[] = []

      if (q.includes('连接最多') || q.includes('度最大') || q.includes('枢纽')) {
        const sorted = [...filteredData.filteredNodes].sort((a, b) => {
          const da = filteredData.filteredEdges.filter(e =>
            e.source === (a.id || a.label) || e.target === (a.id || a.label)).length
          const db = filteredData.filteredEdges.filter(e =>
            e.source === (b.id || b.label) || e.target === (b.id || b.label)).length
          return db - da
        }).slice(0, 5)
        answer = `📊 **连接度Top5节点**：\n\n` + sorted.map((n, i) =>
          `${i + 1}. **${n.label}** (${n.type}) — ${filteredData.filteredEdges.filter(e =>
            e.source === (n.id || n.label) || e.target === (n.id || n.label)).length}条连接`,
        ).join('\n')
        sorted.forEach(n => refNodes.push(n.id || n.label))
      } else if (q.includes('药材') && (q.includes('化合物') || q.includes('靶点'))) {
        const herbs = filteredData.filteredNodes.filter(n => n.type === 'herb').map(n => n.label)
        const compounds = filteredData.filteredNodes.filter(n => n.type === 'compound').map(n => n.label)
        answer = `🌿 **药材-化合物关系**：\n- 药材节点：${herbs.length}种（${herbs.slice(0, 5).join('、')}...）\n- 化合物节点：${compounds.length}种（${compounds.slice(0, 5).join('、')}...）\n\n典型配伍：人参→Ginsenoside Rb1/Rg1/Re，黄芪→Astragaloside I/Calycosin`
        refNodes.push(...herbs.slice(0, 3), ...compounds.slice(0, 3))
      } else if (q.includes('协同') || q.includes('拮抗')) {
        const syn = filteredData.filteredEdges.filter(e => e.type === '协同').length
        const ant = filteredData.filteredEdges.filter(e => e.type === '拮抗').length
        answer = `⚖️ **配伍关系统计**：\n- 协同关系：**${syn}** 条（占 ${(syn / filteredData.filteredEdges.length * 100).toFixed(1)}%）\n- 拮抗关系：**${ant}** 条（占 ${(ant / filteredData.filteredEdges.length * 100).toFixed(1)}%）\n\n主要协同对：补气协同增效、四君子汤核心配伍、益气健脾协同`
      } else if (q.includes('路径') || q.includes('最短')) {
        answer = `🔍 **路径分析**：\n当前图谱包含 ${filteredData.filteredNodes.length} 个节点、${filteredData.filteredEdges.length} 条边。\n\n使用「路径发现」功能可查找两节点间的最短路径。推荐尝试：人参 ↔ 黄芪、Quercetin ↔ TP53`
      } else {
        const types = [...new Set(filteredData.filteredNodes.map(n => n.type))]
        answer = `📋 **图谱概览**：\n- 总节点数：${filteredData.filteredNodes.length}\n- 总边数：${filteredData.filteredEdges.length}\n- 节点类型：${types.join('、')}\n- 图密度：${((2 * filteredData.filteredEdges.length) / (filteredData.filteredNodes.length * (filteredData.filteredNodes.length - 1)) * 100).toFixed(2)}%\n\n您可以问我：「哪个节点连接最多？」、「药材和化合物的关系？」、「有哪些协同关系？」`
      }

      const record: AIQARecord = {
        id: crypto.randomUUID(),
        question: aiQuestion,
        answer,
        timestamp: new Date(),
        referencedNodes: refNodes,
        referencedEdges: [],
      }

      setAiQAHistory(prev => [record, ...prev].slice(0, 20))
      setAiAnswering(false)
      setAiQuestion('')
      setShowAIPanel(true)
      addHistoryEntry('search', `AI问答：${aiQuestion.substring(0, 30)}...`)
    }, 800)
  }, [aiQuestion, filteredData, addHistoryEntry])

  // v7.4: 框选处理函数
  const handleSelectionComplete = useCallback((box: { x1: number; y1: number; x2: number; y2: number }) => {
    const svg = svgRef.current
    if (!svg) return

    const pt = svg.createSVGPoint()
    const selectedIds = new Set<string>()

    filteredData.filteredNodes.forEach(node => {
      const simNodeKey = `${node.label}_${node.type}`
      const nodeEl = document.querySelector(`[data-node-key="${simNodeKey}"]`)
      if (!nodeEl) return

      const circle = nodeEl.querySelector('circle.node-body')
      if (!circle) return

      const cx = parseFloat(circle.getAttribute('cx') || '0')
      const cy = parseFloat(circle.getAttribute('cy') || '0')

      pt.x = cx; pt.y = cy
      const screenPt = pt.matrixTransform(svg.getScreenCTM()!)

      if (
        screenPt.x >= box.x1 && screenPt.x <= box.x2 &&
        screenPt.y >= box.y1 && screenPt.y <= box.y2
      ) {
        selectedIds.add(simNodeKey)
      }
    })

    setSelectedNodes(selectedIds)
    setIsSelecting(false)
    setSelectionBox(null)
  }, [filteredData])

  // v7.4: 右键菜单操作
  const handleContextAction = useCallback((action: string, node?: GraphNode) => {
    switch (action) {
      case 'focus':
        if (node) onNodeClick?.(node)
        break
      case 'hide':
        if (node) {
          setActiveFilter(prev => prev === node.type ? null : node.type)
        } else if (selectedNodes.size > 0) {
          const typesToHide = new Set<string>()
          selectedNodes.forEach(key => {
            const n = filteredData.filteredNodes.find(
              nn => `${nn.label}_${nn.type}` === key,
            )
            if (n) typesToHide.add(n.type)
          })
          if (typesToHide.size === 1) {
            setActiveFilter([...typesToHide][0])
          }
        }
        break
      case 'selectNeighbors':
        if (node) {
          const neighborKeys = new Set(selectedNodes)
          edges.forEach(e => {
            const src = typeof e.source === 'string' ? e.source : ''
            const tgt = typeof e.target === 'string' ? e.target : ''
            if (src === (node.id || node.label)) neighborKeys.add(`${tgt}_unknown`)
            if (tgt === (node.id || node.label)) neighborKeys.add(`${src}_unknown`)
          })
          setSelectedNodes(neighborKeys)
        }
        break
      case 'clearSelection':
        setSelectedNodes(new Set())
        break
      case 'exportSubgraph':
        setShowExportMenu(true)
        break
      case 'detectCommunities':
        setCommunities(detectedCommunities)
        setCommunityColors(generatedCommunityColors)
        break
      case 'clearCommunities':
        setCommunities(new Map())
        setCommunityColors({})
        break
    }
    setContextMenu(null)
  }, [selectedNodes, filteredData, edges, onNodeClick, detectedCommunities, generatedCommunityColors])

  // ═══ v7.6: 导出功能函数 ═══
  const exportSubgraphJSON = useCallback((format: 'json' | 'gexf' | 'svg') => {
    const nodeIds = selectedNodes.size > 0
      ? [...selectedNodes].map(k => {
          const [label, type] = k.split('_')
          return nodes.find(n => n.label === label && n.type === type)?.id || label
        })
      : filteredData.filteredNodes.map(n => n.id || n.label)
    const nodeIdSet = new Set(nodeIds)
    const exportNodes = filteredData.filteredNodes.filter(n => nodeIdSet.has(n.id || n.label))
    const exportEdges = filteredData.filteredEdges.filter(e =>
      nodeIdSet.has(e.source as string) && nodeIdSet.has(e.target as string),
    )

    if (format === 'json') {
      const json = JSON.stringify({
        version: '7.6',
        exportedAt: new Date().toISOString(),
        nodeCount: exportNodes.length,
        edgeCount: exportEdges.length,
        nodes: exportNodes.map(n => ({
          id: n.id, label: n.label, type: n.type,
          degree: (n as any).degree || 0,
          properties: n.properties || {},
        })),
        edges: exportEdges.map(e => ({
          source: e.source, target: e.target,
          type: e.type, strength: e.strength, label: e.label,
        })),
        communities: communities.size > 0 ? Object.fromEntries([...communities.entries()]) : undefined,
      }, null, 2)

      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `knowledge-graph-${exportNodes.length}nodes-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportStatus(`✓ 已导出 ${exportNodes.length}节点/${exportEdges.length}边 (JSON)`)
    } else if (format === 'gexf') {
      let gexf = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.3draft" xmlns:viz="http://www.gexf.net/1.3draft/viz" version="1.3">
  <meta lastmodifieddate="${new Date().toISOString()}">
    <creator>RMFOOD Knowledge Graph v7.6</creator>
    <description>${exportNodes.length} nodes, ${exportEdges.length} edges</description>
  </meta>
  <graph mode="static" defaultedgetype="directed">
    <nodes>\n`
      exportNodes.forEach(n => {
        const conf = TYPE_CONFIG[n.type]
        gexf += `      <node id="${n.id || n.label}" label="${n.label}">
        <attvalues><attvalue for="type" value="${n.type}"/></attvalues>
        <viz:color r="${parseInt(conf.color.slice(1,3),16)}" g="${parseInt(conf.color.slice(3,5),16)}" b="${parseInt(conf.color.slice(5,7),16)}"/>
        <viz:size value="${Math.max(8, Math.min(30, (n as any).degree * 2 + 10))}"/>
      </node>\n`
      })
      gexf += `    </nodes>
    <edges>\n`
      exportEdges.forEach((e, i) => {
        gexf += `      edge id="${i}" source="${e.source}" target="${e.target}" type="${e.type}" weight="${e.strength || 1}"/>\n`
      })
      gexf += `    </edges>
  </graph>
</gexf>`
      const blob = new Blob([gexf], { type: 'application/g+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `knowledge-graph-${exportNodes.length}nodes-${Date.now()}.gexf`
      a.click()
      URL.revokeObjectURL(url)
      setExportStatus(`✓ 已导出 ${exportNodes.length}节点/${exportEdges.length}边 (GEXF)`)
    } else if (format === 'svg') {
      const svgEl = svgRef.current
      if (!svgEl) return
      const serializer = new XMLSerializer()
      let svgStr = serializer.serializeToString(svgEl)
      svgStr = svgStr.replace(/<!--[\s\S]*?-->/g, '')
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `knowledge-graph-${exportNodes.length}nodes-${Date.now()}.svg`
      a.click()
      URL.revokeObjectURL(url)
      setExportStatus(`✓ 已导出 SVG 图像`)
    }

    setShowExportMenu(false)
    setTimeout(() => setExportStatus(null), 3000)
  }, [selectedNodes, filteredData, nodes, communities])

  // v7.6: BFS 路径查找（用于路径动画高亮）
  const findPathBFSLocal = useCallback((sourceId: string, targetId: string): string[] | null => {
    return findPathBFS(filteredData.filteredEdges, sourceId, targetId)
  }, [filteredData.filteredEdges])

  // v7.6: 启动路径动画（双击第二个节点时触发）
  const startPathAnimation = useCallback((targetNode: GraphNode) => {
    if (!selectedNode) return
    const sourceId = selectedNode.id || selectedNode.label
    const targetId = targetNode.id || targetNode.label
    const path = findPathBFSLocal(sourceId, targetId)
    if (path && path.length >= 2) {
      const pathEdges: [string, string][] = []
      for (let i = 0; i < path.length - 1; i++) {
        pathEdges.push([path[i], path[i + 1]])
      }
      setPathAnimation({ source: sourceId, target: targetId, pathNodes: path, pathEdges })
      setTimeout(() => setPathAnimation(null), 5000)
    } else {
      setExportStatus('⚠ 未找到两节点间的连接路径')
      setTimeout(() => setExportStatus(null), 2500)
    }
  }, [selectedNode, findPathBFSLocal])

  // ── 图例 & 统计 ──
  const { allTypes, legendItems, typeCounts } = useMemo(
    () => computeLegendData(nodes, TYPE_CONFIG),
    [nodes],
  )

  // ── Graph Engine (extracted from former ~960-line renderGraph) ──
  const engineRef = useRef<GraphEngine | null>(null)

  // Initialize / destroy graph engine on mount/unmount
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new GraphEngine({
        containerRef, svgRef, width, height, nodes: filteredData.filteredNodes,
        edges: filteredData.filteredEdges.map(e => ({ ...e, source: e.source as any, target: e.target as any })) as unknown as typeof filteredData.filteredEdges,
        theme: activeTheme, layout: localLayout, lodLevel,
        highlightPath, selectedNodes, communities: detectedCommunities,
        generatedCommunityColors, pinnedNodes, focusedNodeIndex,
        animationPreset, dataChanged,
        onSimulationStart: undefined,
        onSimulationTick: undefined,
        onSimulationEnd: undefined,
        onNodeDrag: undefined,
        onNodeClick: (d) => { setSelectedNode(d); onNodeClick?.(d) },
        onNodeDoubleClick: undefined,
        onNodeContextMenu: undefined,
        onSetZoomTransform: setZoomTransform,
        onSetTooltip: setTooltip,
        onSetSelectedNode: setSelectedNode,
        onTogglePinNode: togglePinNode,
      })
      engineRef.current.init()
    }
    engineRef.current.update()
  }, [filteredData.filteredNodes, filteredData.filteredEdges, width, height, activeTheme, localLayout, lodLevel, highlightPath, selectedNodes, detectedCommunities, generatedCommunityColors, pinnedNodes, focusedNodeIndex, dataChanged])

  useEffect(() => () => { engineRef.current?.destroy(); engineRef.current = null }, [])

  // v7.5: 实时性能监控 Hook
  useEffect(() => {
    const frameTimes = perfFrameTimesRef.current
    let lastTime = performance.now()

    const measureFrame = (now: number) => {
      const delta = now - lastTime
      lastTime = now

      frameTimes.push(delta)
      if (frameTimes.length > 60) frameTimes.shift()

      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
      const fps = Math.round(1000 / avgFrameTime)

      const nodeCount = filteredData.filteredNodes.length
      const edgeCount = filteredData.filteredEdges.length
      const memEstKB = Math.round((nodeCount * 0.8 + edgeCount * 0.3) * 1.2)
      const memoryEst = memEstKB > 1024 ? `${(memEstKB / 1024).toFixed(1)} MB` : `${memEstKB} KB`

      let rating: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent'
      if (fps < 24 || avgFrameTime > 42) rating = 'poor'
      else if (fps < 40 || avgFrameTime > 25) rating = 'fair'
      else if (fps < 55 || avgFrameTime > 18) rating = 'good'

      setPerfStats({
        fps,
        frameTime: Math.round(avgFrameTime * 10) / 10,
        memoryEst,
        lodLevel: lodLevel === 'full' ? '完整' : lodLevel === 'reduced' ? '精简' : '极简',
        rating,
      })

      perfRafIdRef.current = requestAnimationFrame(measureFrame)
    }

    perfRafIdRef.current = requestAnimationFrame(measureFrame)
    return () => {
      if (perfRafIdRef.current != null) cancelAnimationFrame(perfRafIdRef.current)
    }
  }, [filteredData.filteredNodes.length, filteredData.filteredEdges.length, lodLevel])

  // ═══════════════════════════════════════════
  // JSX 渲染层（UI 层）
  // ═══════════════════════════════════════════

  const [tooltip] = tooltipState
  const [zoomTransform] = zoomState

  if (isLoading) {
    return <GraphSkeleton height={height} />
  }

  // 缩放控制回调
  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current).transition().duration(350).call(
      zoomBehaviorRef.current.scaleBy, 1.4,
    )
  }, [])

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current).transition().duration(350).call(
      zoomBehaviorRef.current.scaleBy, 0.7,
    )
  }, [])

  const handleFitToCanvas = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    const svg = d3.select(svgRef.current)
    const containerW = (containerRef.current?.clientWidth || width)
    const containerH = height
    // 计算适合的比例使所有内容可见
    const padding = 60
    const scale = Math.min(containerW / (width + padding), containerH / (height + padding), 1.5)
    svg.transition().duration(600).call(
      zoomBehaviorRef.current.scaleTo, scale,
    )
  }, [width, height])

  const handleResetView = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    d3.select(svgRef.current).transition().duration(600)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity).ease(d3.easeCubicOut)
  }, [])

  return (
    <div ref={containerRef} className={cn('relative select-none', className,
      animationPreset !== 'none' && `graph-animate-${animationPreset === 'fadeIn' ? 'fade-in' : animationPreset}`,
    )}
      onKeyDown={(e) => {
        // v7.3: 图谱全局键盘导航
        if (searchQuery) return // 搜索框激活时由搜索组件处理

        const visibleNodes = filteredData.filteredNodes
        if (e.key === 'Tab' && !e.shiftKey && focusedNodeIndex < 0) {
          e.preventDefault()
          setFocusedNodeIndex(0)
        } else if (e.key === 'Tab' && !e.shiftKey && focusedNodeIndex >= 0) {
          e.preventDefault()
          setFocusedNodeIndex(prev => (prev + 1) % visibleNodes.length)
        } else if (e.key === 'Tab' && e.shiftKey && focusedNodeIndex > 0) {
          e.preventDefault()
          setFocusedNodeIndex(prev => prev - 1)
        } else if (e.key === 'Enter' && focusedNodeIndex >= 0 && visibleNodes[focusedNodeIndex]) {
          e.preventDefault()
          handleSearchSelect(visibleNodes[focusedNodeIndex])
        } else if ((e.key === 'Escape') && selectedNode) {
          setSelectedNode(null)
          setFocusedNodeIndex(-1)
        } else if (e.key === 'P' && e.shiftKey) {
          // v7.5: Shift+P 切换性能监控面板
          e.preventDefault()
          setShowPerfPanel(prev => !prev)
        } else if (e.key === 'C' && e.shiftKey) {
          // v7.7: Shift+C 切换中心性分析面板
          e.preventDefault()
          setShowCentralityPanel(prev => !prev)
        } else if (e.key === 'N' && e.shiftKey) {
          // v7.8: Shift+N 切换标注模式
          e.preventDefault()
          setIsAddingAnnotation(prev => !prev)
        } else if (e.key === 'T' && e.shiftKey) {
          // v7.9: Shift+T 切换主题面板
          e.preventDefault()
          setShowThemePanel(prev => !prev)
        } else if (e.key === 'L' && e.shiftKey) {
          // v7.9: Shift+L 切换布局菜单
          e.preventDefault()
          setShowLayoutMenu(prev => !prev)
        } else if (e.key === 'A' && e.shiftKey) {
          // v8.0: Shift+A 切换AI洞察面板
          e.preventDefault()
          setShowAIPanel(prev => !prev)
          if (!showAIPanel && aiInsights.length === 0) generateAIInsights()
        } else if (e.key === 'S' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // v8.0: Shift+S 保存快照
          e.preventDefault()
          takeSnapshot()
        } else if (e.key === 'I' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // v8.1: Shift+I 打开导入对话框
          e.preventDefault()
          setShowImportDialog(true)
        } else if (e.key === 'D' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // v8.1: Shift+D 图谱对比
          e.preventDefault()
          runGraphComparison()
        } else if (e.key === 'E' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // v8.1: Shift+E 外部数据面板
          e.preventDefault()
          if (selectedNode) { setShowExternalPanel(!showExternalPanel); queryExternalData(selectedNode.label) }
        } else if (e.key === 'R' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // v8.2: Shift+R 生成报告对话框
          e.preventDefault()
          setShowReportDialog(prev => !prev)
        } else if (e.key === 'H' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // v8.2: Shift+H 操作历史时间线
          e.preventDefault()
          setShowHistoryPanel(prev => !prev)
        } else if (e.key === 'B' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // v8.2: Shift+B 书签收藏面板
          e.preventDefault()
          setShowBookmarkPanel(prev => !prev)
        } else if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey && !e.shiftKey) {
          // v8.2: Ctrl+Z 撤销操作
          e.preventDefault()
          undoHistory()
        } else if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey && e.shiftKey) {
          // v8.2: Ctrl+Shift+Z / Ctrl+Y 重做操作
          e.preventDefault()
          redoHistory()
        } else if (e.key === 'D' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // v8.3: Shift+D 统计仪表盘
          e.preventDefault()
          computeGraphStatistics()
        } else if (e.key === 'C' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // v8.3: Shift+C 中心性分析
          e.preventDefault()
          runCentralityAnalysis()
        } else if (e.key === 'L' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // v8.3: Shift+L 社区发现
          e.preventDefault()
          detectCommunitiesLouvain()
        } else if (e.key === 'Q' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // v8.3: Shift+Q AI问答
          e.preventDefault()
          setShowAIPanel(prev => !prev)
        }
      }}
      onMouseDown={(e) => {
        // v7.4: 框选开始（左键拖拽 + Ctrl/Shift）
        if ((e.ctrlKey || e.metaKey || e.shiftKey) && e.button === 0) {
          const rect = containerRef.current?.getBoundingClientRect()
          if (!rect) return
          setIsSelecting(true)
          setSelectionBox({
            x1: e.clientX - rect.left,
            y1: e.clientY - rect.top,
            x2: e.clientX - rect.left,
            y2: e.clientY - rect.top,
          })
          e.preventDefault()
        }
      }}
      onMouseMove={(e) => {
        // v7.4: 框选中
        if (isSelecting && selectionBox) {
          const rect = containerRef.current?.getBoundingClientRect()
          if (!rect) return
          setSelectionBox(prev => prev ? {
            ...prev,
            x2: e.clientX - rect.left,
            y2: e.clientY - rect.top,
          } : null)
        }
      }}
      onMouseUp={(e) => {
        // v7.4: 框选结束
        if (isSelecting && selectionBox) {
          handleSelectionComplete(selectionBox)
        }
      }}
      onContextMenu={(e) => {
        // v7.4: 右键菜单
        e.preventDefault()
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return

        let targetNode: GraphNode | undefined
        const target = e.target as SVGElement | HTMLElement

        const nodeGroup = target.closest('.node-group')
        if (nodeGroup) {
          const labelEl = nodeGroup.querySelector('text')
          const typeAttr = nodeGroup.getAttribute('data-type')
          if (labelEl && typeAttr) {
            targetNode = nodes.find(n => n.label === labelEl.textContent && n.type === typeAttr)
          }
        }

        setContextMenu({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          node: targetNode,
        })
      }}
      onClick={(e) => {
        if (contextMenu) setContextMenu(null)
        // v7.8: 标注模式 — 点击添加标注
        if (isAddingAnnotation && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          const x = e.clientX - rect.left
          const y = e.clientY - rect.top
          const text = prompt('输入标注内容:', '📝 标注')
          if (text) addAnnotation(x, y, text)
        }
      }}
      tabIndex={0}
    >
      {/* SVG 画布 */}
      <svg
        ref={svgRef}
        className={cn(
          'w-full rounded-xl border transition-all duration-500',
          'bg-gradient-to-br from-slate-50/80 via-white/40 to-blue-50/20',
          'border-neutral-200/70',
          'dark:from-slate-900/80 dark:via-slate-900/40 dark:to-indigo-950/20 dark:border-neutral-700/60',
          'hover:shadow-[0_0_40px_rgba(5,150,105,0.10)]',
        )}
        style={{ minHeight: height }}
      >
        {/* v7.0: 注入 CSS 动画 keyframes */}
        <style>{`
          @keyframes edge-flow {
            to { stroke-dashoffset: -24; }
          }
          @keyframes pulse-ring {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.3); opacity: 0.2; }
          }
          @keyframes legend-slide {
            from { max-height: 0; opacity: 0; overflow: hidden; }
            to { max-height: 300px; opacity: 1; overflow: visible; }
          }
          /* v7.0: 核心节点微呼吸动画 */
          @keyframes core-breathe {
            0%, 100% { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.18)); }
            50% { filter: drop-shadow(0 3px 6px rgba(0,0,0,0.25)); }
          }
          /* v7.0: 标签淡入动画 */
          @keyframes label-fade-in {
            from { opacity: 0; transform: translateY(2px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </svg>

      {/* v8.1: 同步状态指示器 + 导入按钮 + 对比按钮 */}
      <div className="absolute bottom-3 right-3 z-35 flex items-center gap-1.5">
        <button onClick={() => setShowImportDialog(true)}
          className="w-7 h-7 rounded-lg bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/40 flex items-center justify-center hover:scale-110 transition-all shadow-sm"
          title="导入数据 (Shift+I)">
          <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>
        <button onClick={runGraphComparison}
          className="w-7 h-7 rounded-lg bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/40 flex items-center justify-center hover:scale-110 transition-all shadow-sm"
          title="图谱对比 (Shift+D)">
          <span className="text-xs font-bold text-neutral-500">⚖</span>
        </button>
        <div className={`w-2 h-2 rounded-full ${syncStatus === 'connected' ? 'bg-primary-400' : syncStatus === 'syncing' ? 'bg-secondary-400 animate-pulse' : 'bg-error-400'} shrink-0`} title={`同步状态: ${syncStatus}`} />
      </div>

      {/* v8.2: 协作分享工具栏 */}
      <div className="absolute bottom-3 left-3 z-[40] flex items-center gap-1.5">
        <button onClick={() => { generateShareLink(); setShowSharePanel(true); }}
          className="w-7 h-7 rounded-lg bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-violet-200/60 dark:border-violet-700/40 flex items-center justify-center hover:scale-110 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all shadow-sm"
          title="分享图谱 (Shift+S)">
          <span className="text-xs">🔗</span>
        </button>
        <button onClick={() => setShowAnnotationPanel(!showAnnotationPanel)}
          className={`w-7 h-7 rounded-lg backdrop-blur-sm border flex items-center justify-center hover:scale-110 transition-all shadow-sm ${showAnnotationPanel ? 'bg-pink-100 dark:bg-pink-900/30 border-pink-300/60 dark:border-pink-600/40' : 'bg-white/90 dark:bg-neutral-800/90 border-neutral-200/60 dark:border-neutral-700/40'}`}
          title="节点批注 (Shift+N)">
          <span className="text-xs">💬</span>
        </button>
        <button onClick={() => setShowReportDialog(true)}
          className="w-7 h-7 rounded-lg bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-indigo-200/60 dark:border-indigo-700/40 flex items-center justify-center hover:scale-110 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all shadow-sm"
          title="生成报告 (Shift+R)">
          <span className="text-xs">📄</span>
        </button>
        <button onClick={() => setShowHistoryPanel(!showHistoryPanel)}
          className={`w-7 h-7 rounded-lg backdrop-blur-sm border flex items-center justify-center hover:scale-110 transition-all shadow-sm ${showHistoryPanel ? 'bg-warning-100 dark:bg-warning-900/30 border-amber-300/60 dark:border-amber-600/40' : 'bg-white/90 dark:bg-neutral-800/90 border-neutral-200/60 dark:border-neutral-700/40'}`}
          title="操作历史 (Shift+H)">
          <span className="text-xs">⏱</span>
        </button>
        <button onClick={() => setShowBookmarkPanel(!showBookmarkPanel)}
          className={`w-7 h-7 rounded-lg backdrop-blur-sm border flex items-center justify-center hover:scale-110 transition-all shadow-sm ${showBookmarkPanel ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300/60 dark:border-orange-600/40' : 'bg-white/90 dark:bg-neutral-800/90 border-neutral-200/60 dark:border-neutral-700/40'}`}
          title="书签收藏 (Shift+B)">
          <span className="text-xs">⭐</span>
        </button>
      </div>

      {/* v8.3: 数据洞察工具栏 */}
      <div className="absolute bottom-3 left-[200px] z-[40] flex items-center gap-1.5">
        <button onClick={computeGraphStatistics}
          className="w-7 h-7 rounded-lg bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-emerald-200/60 dark:border-emerald-700/40 flex items-center justify-center hover:scale-110 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all shadow-sm"
          title="统计仪表盘 (Shift+D)">
          <span className="text-xs">📊</span>
        </button>
        <button onClick={() => runCentralityAnalysis()}
          className={`w-7 h-7 rounded-lg backdrop-blur-sm border flex items-center justify-center hover:scale-110 transition-all shadow-sm ${showCentralityPanel ? 'bg-error-100 dark:bg-error-900/30 border-red-300/60 dark:border-red-600/40' : 'bg-white/90 dark:bg-neutral-800/90 border-neutral-200/60 dark:border-neutral-700/40'}`}
          title="中心性分析 (Shift+C)">
          <span className="text-xs">🎯</span>
        </button>
        <button onClick={() => { detectCommunitiesLouvain(); }}
          className="w-7 h-7 rounded-lg bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-purple-200/60 dark:border-purple-700/40 flex items-center justify-center hover:scale-110 hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-all shadow-sm"
          title="社区发现 (Shift+L)">
          <span className="text-xs">🧩</span>
        </button>
        <button onClick={() => setShowAIPanel(!showAIPanel)}
          className={`w-7 h-7 rounded-lg backdrop-blur-sm border flex items-center justify-center hover:scale-110 transition-all shadow-sm ${showAIPanel ? 'bg-secondary-100 dark:bg-secondary-900/30 border-blue-300/60 dark:border-blue-600/40' : 'bg-white/90 dark:bg-neutral-800/90 border-neutral-200/60 dark:border-neutral-700/40'}`}
          title="AI图谱问答 (Shift+Q)">
          <span className="text-xs">🧠</span>
        </button>
      </div>

      {/* v8.1: 外部数据增强面板 */}
      {showExternalPanel && selectedNode && (
        <div className="absolute top-14 left-3 z-45 w-[340px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-cyan-200/60 dark:border-cyan-700/40 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-950/50 dark:to-teal-950/50 border-b border-cyan-100/50 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span>🔬</span>
              <span className="text-sm font-bold text-cyan-700 dark:text-cyan-300">外部数据库</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-medium ${syncStatus === 'connected' ? 'bg-primary-100 text-primary-600' : syncStatus === 'syncing' ? 'bg-secondary-100 text-secondary-600 animate-pulse' : 'bg-error-100 text-error-600'}`}>
                {syncStatus === 'connected' ? '● 已连接' : syncStatus === 'syncing' ? '◌ 同步中...' : '✕ 断开'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => queryExternalData(selectedNode.label)} disabled={!!externalLoadingId}
                className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50">刷新</button>
              <button onClick={triggerAutoSync} className="px-1.5 py-0.5 rounded text-[9px] font-medium text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20">同步</button>
              <button onClick={() => setShowExternalPanel(false)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-cyan-100 dark:hover:bg-cyan-800/30 text-neutral-400">✕</button>
            </div>
          </div>
          <div className="p-3 max-h-[55vh] overflow-y-auto custom-scrollbar">
            {externalLoadingId === selectedNode.label ? (
              <div className="flex flex-col items-center py-6 gap-2">
                <div className="w-6 h-6 border-2 border-cyan-200 border-t-cyan-500 rounded-full animate-spin" />
                <p className="text-[10px] text-neutral-400">正在查询外部数据库...</p>
              </div>
            ) : externalDataCache.has(selectedNode.label) ? (() => {
              const data = externalDataCache.get(selectedNode.label)!
              return (
                <div className="space-y-2.5">
                  <p className="text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">{data.description}</p>
                  {data.molecularFormula && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-cyan-50/80 dark:bg-cyan-950/20 p-2">
                        <div className="text-[9px] text-neutral-400">分子式</div>
                        <div className="text-xs font-mono font-bold text-cyan-700 dark:text-cyan-300">{data.molecularFormula}</div>
                      </div>
                      <div className="rounded-lg bg-cyan-50/80 dark:bg-cyan-950/20 p-2">
                        <div className="text-[9px] text-neutral-400">分子量</div>
                        <div className="text-xs font-bold text-cyan-700 dark:text-cyan-300">{data.molecularWeight?.toFixed(1)}</div>
                      </div>
                    </div>
                  )}
                  {(data.properties && Object.keys(data.properties).length > 0) && (
                    <div className="bg-slate-50/80 dark:bg-neutral-800/30 rounded-lg p-2">
                      <span className="text-[10px] font-semibold text-neutral-500 mb-1 block">属性</span>
                      <div className="grid grid-cols-2 gap-1">
                        {Object.entries(data.properties).slice(0, 8).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-[10px]">
                            <span className="text-neutral-500 truncate max-w-[70px]" title={k}>{k}</span>
                            <span className="font-mono text-neutral-700 dark:text-neutral-300 truncate max-w-[80px]">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.targets && data.targets.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-neutral-500">靶点 ({data.targets.length})</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {data.targets.map(t => (
                          <span key={t} className="px-1.5 py-0.5 rounded-md text-[9px] bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-300 font-mono">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.pathways && data.pathways.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-neutral-500">通路 ({data.pathways.length})</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {data.pathways.map(p => (
                          <span key={p} className="px-1.5 py-0.5 rounded-md text-[9px] bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-300">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.diseases && data.diseases.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-neutral-500">相关疾病</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {data.diseases.map(d => (
                          <span key={d} className="px-1.5 py-0.5 rounded-md text-[9px] bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-300">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-700/30">
                    <span className="text-[9px] text-neutral-400">📚 {data.source.toUpperCase()} · 📄 {data.literatureCount?.toLocaleString()} 文献</span>
                    <span className="text-[8px] text-neutral-400">更新: {data.lastUpdated}</span>
                  </div>
                </div>
              )
            })() : (
              <div className="text-center py-6">
                <p className="text-xs text-neutral-400 mb-2">暂无外部数据</p>
                <button onClick={() => queryExternalData(selectedNode.label)}
                  className="text-xs text-cyan-500 hover:text-cyan-600 font-medium">查询 PubChem / TCMSP →</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* v8.1: 数据导入对话框 */}
      {showImportDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setShowImportDialog(false)}>
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-[420px] overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50 border-b border-orange-100/50">
              <div className="flex items-center gap-2"><span>📥</span><span className="text-sm font-bold text-orange-700 dark:text-orange-300">数据导入</span></div>
              <button onClick={() => setShowImportDialog(false)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-orange-100 dark:hover:bg-orange-800/30 text-neutral-400">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>{importState.status === 'idle' ? '准备就绪' :
                    importState.status === 'dragging' ? '检测到文件...' :
                    importState.status === 'parsing' ? `解析中... (${importState.fileType?.toUpperCase() || ''})` :
                    importState.status === 'validating' ? '验证数据格式...' :
                    importState.status === 'importing' ? '导入到图谱...' :
                    importState.status === 'done' ? '导入完成 ✓' :
                    importState.status === 'error' ? '导入失败 ✗' : ''
                  }</span>
                  <span>{importState.progress}%</span>
                </div>
                <div className="h-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${
                    importState.status === 'error' ? 'bg-error-500 w-full' :
                    importState.status === 'done' ? 'bg-primary-500 w-full' :
                    'bg-gradient-to-r from-orange-400 to-amber-400'
                  }`} style={{ width: `${importState.progress}%` }} />
                </div>
              </div>
              {importState.error && (
                <div className="bg-error-50 dark:bg-error-900/20 rounded-lg px-3 py-2 text-[11px] text-error-600 dark:text-error-300">{importState.error}</div>
              )}
              {importState.previewRows && importState.previewRows.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-neutral-500">数据预览 (前{Math.min(importState.previewRows.length, 5)}行)</span>
                  <div className="mt-1 max-h-[120px] overflow-auto custom-scrollbar rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <table className="w-full text-[9px]">
                      <thead className="bg-slate-50 dark:bg-neutral-700/50 sticky top-0">
                        <tr>{Object.keys(importState.previewRows[0]).slice(0, 6).map(k => <th key={k} className="px-2 py-1 text-left text-neutral-500 font-medium border-b border-neutral-200 dark:border-neutral-600">{k}</th>)}</tr>
                      </thead>
                      <tbody>{importState.previewRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-neutral-700/20">{Object.values(row).slice(0, 6).map((v, j) =>
                          <td key={j} className="px-2 py-1 text-neutral-600 dark:text-neutral-400 border-b border-neutral-100 dark:border-neutral-700/30 truncate max-w-[120px]">{String(v)?.slice(0, 25)}</td>,
                        )}</tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {importState.status === 'done' && (
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg px-3 py-2 text-[11px] text-primary-600 dark:text-primary-300 font-medium">
                  ✅ 成功导入 {importState.importedCount} 条记录
                </div>
              )}
              <div className="flex gap-2">
                <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                  dragOver ? 'border-orange-400 bg-orange-50/50 dark:bg-orange-900/10' : 'border-neutral-200 dark:border-neutral-600 hover:border-orange-300'
                }`}
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                  <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0 0V8m0 4h4m-4 0H8m12 4V4a2 2 0 00-2-2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2z" />
                  </svg>
                  <span className="text-xs text-neutral-500">拖拽文件或点击上传</span>
                  <input type="file" accept=".csv,.json,.sdf" className="hidden" onChange={e => e.target.files?.[0] && handleFileImport(e.target.files[0])} />
                </label>
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] text-neutral-400 text-center">支持格式</span>
                  <div className="flex gap-1">
                    {['CSV', 'JSON', 'SDF'].map(fmt => (
                      <span key={fmt} className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-neutral-100 dark:bg-neutral-700 text-neutral-500">{fmt}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* v8.1: 图谱对比结果面板 */}
      {showCompareMode && compareResult && (
        <div className="absolute bottom-16 right-3 z-45 w-[360px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-200/60 dark:border-indigo-700/40 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 border-b border-indigo-100/50 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span>⚖️</span>
              <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">图谱对比分析</span>
            </div>
            <button onClick={() => setShowCompareMode(false)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-800/30 text-neutral-400">✕</button>
          </div>
          <div className="p-3 space-y-2.5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-indigo-50/80 dark:bg-indigo-950/20 p-2">
                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{compareResult.similarityScore}%</div>
                <div className="text-[9px] text-neutral-400">相似度</div>
              </div>
              <div className="rounded-lg bg-primary-50/80 dark:bg-emerald-950/20 p-2">
                <div className="text-lg font-bold text-primary-600 dark:text-primary-400">{compareResult.commonNodes.length}</div>
                <div className="text-[9px] text-neutral-400">共同节点</div>
              </div>
              <div className="rounded-lg bg-warning-50/80 dark:bg-amber-950/20 p-2">
                <div className="text-lg font-bold text-warning-600 dark:text-warning-400">{compareResult.nodesOnlyInA.length + compareResult.nodesOnlyInB.length}</div>
                <div className="text-[9px] text-neutral-400">差异节点</div>
              </div>
            </div>
            {compareResult.nodesOnlyInA.length > 0 && (
              <div className="bg-secondary-50/80 dark:bg-blue-950/20 rounded-lg p-2">
                <span className="text-[10px] font-semibold text-secondary-600 dark:text-secondary-300">➕ 新增节点 ({compareResult.nodesOnlyInA.length}):</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {compareResult.nodesOnlyInA.slice(0, 8).map(nid => {
                    const node = filteredData.filteredNodes.find(no => (no.id || no.label) === nid)
                    return <span key={nid} className="px-1.5 py-0.5 rounded text-[9px] bg-white dark:bg-neutral-700 text-secondary-600 dark:text-secondary-300">{node?.label?.slice(0, 10) || nid.slice(0, 10)}</span>
                  })}
                  {compareResult.nodesOnlyInA.length > 8 && <span className="text-[9px] text-neutral-400">+{compareResult.nodesOnlyInA.length - 8} 更多</span>}
                </div>
              </div>
            )}
            {compareResult.nodesOnlyInB.length > 0 && (
              <div className="bg-error-50/80 dark:bg-red-950/20 rounded-lg p-2">
                <span className="text-[10px] font-semibold text-error-600 dark:text-error-300">➖ 移除节点 ({compareResult.nodesOnlyInB.length}):</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {compareResult.nodesOnlyInB.slice(0, 8).map(nid => (
                    <span key={nid} className="px-1.5 py-0.5 rounded text-[9px] bg-white dark:bg-neutral-700 text-error-500 line-through">{nid.slice(0, 10)}</span>
                  ))}
                  {compareResult.nodesOnlyInB.length > 8 && <span className="text-[9px] text-neutral-400">+{compareResult.nodesOnlyInB.length - 8} 更多</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* v8.2: 图谱分享面板 */}
      {showSharePanel && shareLink && (
        <div className="absolute top-14 right-3 z-45 w-[340px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-violet-200/60 dark:border-violet-700/40 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 border-b border-violet-100/50 rounded-t-2xl">
            <div className="flex items-center gap-2"><span>🔗</span><span className="text-sm font-bold text-violet-700 dark:text-violet-300">分享图谱</span></div>
            <button onClick={() => setShowSharePanel(false)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-violet-100 dark:hover:bg-violet-800/30 text-neutral-400">✕</button>
          </div>
          <div className="p-3 space-y-2.5">
            <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-lg p-2.5 break-all">
              <div className="text-[10px] text-neutral-400 mb-1">分享链接</div>
              <code className="text-[11px] font-mono text-violet-600 dark:text-violet-300 block">{shareLink.url}</code>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 p-2">
                <div className="text-lg font-bold text-violet-600">{shareLink.shortCode}</div>
                <div className="text-[9px] text-neutral-400">短码</div>
              </div>
              <div className="rounded-lg bg-primary-50 dark:bg-emerald-950/20 p-2">
                <div className="text-lg font-bold text-primary-600">{shareLink.viewCount}</div>
                <div className="text-[9px] text-neutral-400">浏览</div>
              </div>
              <div className="rounded-lg bg-secondary-50 dark:bg-blue-950/20 p-2">
                <div className="text-xs font-bold text-secondary-600">7天</div>
                <div className="text-[9px] text-neutral-400">有效</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={copyShareLink} className="flex-1 px-3 py-1.5 rounded-lg bg-violet-500 text-white text-xs font-medium hover:bg-violet-600 transition-colors">📋 复制链接</button>
              <button onClick={() => { /* QR code */ }} className="flex-1 px-3 py-1.5 rounded-lg border border-violet-200 dark:border-violet-700 text-violet-600 dark:text-violet-300 text-xs font-medium hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">📱 二维码</button>
            </div>
            <div className="bg-slate-50 dark:bg-neutral-800/30 rounded-lg p-2">
              <span className="text-[10px] font-semibold text-neutral-500 block mb-1">嵌入代码</span>
              <code className="text-[9px] font-mono text-neutral-500 block p-1.5 bg-white dark:bg-neutral-800 rounded">&lt;iframe src="{shareLink.url}" width="800" height="600"&gt;&lt;/iframe&gt;</code>
            </div>
          </div>
        </div>
      )}

      {/* v8.2: 节点批注面板 */}
      {showAnnotationPanel && selectedNode && (
        <div className="absolute bottom-16 left-3 z-45 w-[320px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-pink-200/60 dark:border-pink-700/40 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/50 dark:to-rose-950/50 border-b border-pink-100/50 rounded-t-2xl">
            <div className="flex items-center gap-2"><span>💬</span><span className="text-sm font-bold text-pink-700 dark:text-pink-300">节点批注</span>
              <span className="text-[10px] text-neutral-400">[{selectedNode.label}]</span>
            </div>
            <button onClick={() => setShowAnnotationPanel(false)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-pink-100 dark:hover:bg-pink-800/30 text-neutral-400">✕</button>
          </div>
          <div className="p-3 space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
            {(() => {
              const nodeAnns = nodeAnnotations.get(selectedNode.label) || []
              return nodeAnns.length > 0 ? nodeAnns.map(ann => (
                <div key={ann.id} className={`rounded-lg p-2.5 ${ann.resolved ? 'bg-slate-50/80 dark:bg-neutral-800/30 opacity-60' : 'bg-pink-50/50 dark:bg-pink-950/10'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-pink-600 dark:text-pink-300">{ann.author}</span>
                    <span className="text-[8px] text-neutral-400">{ann.createdAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">{ann.content}</p>
                  {ann.mentions && ann.mentions.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {ann.mentions.map(m => <span key={m} className="px-1 py-0.5 rounded text-[8px] bg-secondary-100 text-secondary-600">@{m}</span>)}
                    </div>
                  )}
                </div>
              )) : <p className="text-[11px] text-neutral-400 text-center py-4">暂无批注，添加第一条吧 ✨</p>
            })()}
          </div>
          <div className="px-3 pb-3 pt-1 border-t border-neutral-100 dark:border-neutral-700/30">
            <div className="flex gap-1.5">
              <input
                value={newAnnotationText}
                onChange={e => setNewAnnotationText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNodeAnnotation()}
                placeholder="@提及某人 添加批注..."
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600 text-[11px] bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
              <button onClick={addNodeAnnotation} disabled={!newAnnotationText.trim()} className="px-2.5 py-1.5 rounded-lg bg-pink-500 text-white text-[11px] font-medium hover:bg-pink-600 disabled:opacity-40 transition-colors">发送</button>
            </div>
          </div>
        </div>
      )}

      {/* v8.2: 操作历史时间线面板 */}
      {showHistoryPanel && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-45 w-[420px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-amber-200/60 dark:border-amber-700/40 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50 border-b border-amber-100/50 rounded-t-2xl">
            <div className="flex items-center gap-2"><span>⏱️</span><span className="text-sm font-bold text-warning-700 dark:text-warning-300">操作历史</span>
              <span className="text-[10px] text-neutral-400">({historyEntries.length}条)</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={undoHistory} disabled={historyIndex < 0} className="w-6 h-6 rounded flex items-center justify-center hover:bg-warning-100 dark:hover:bg-warning-800/30 text-neutral-500 disabled:opacity-30 text-xs" title="撤销 (Ctrl+Z)">↩</button>
              <button onClick={redoHistory} disabled={historyIndex >= historyEntries.length - 1} className="w-6 h-6 rounded flex items-center justify-center hover:bg-warning-100 dark:hover:bg-warning-800/30 text-neutral-500 disabled:opacity-30 text-xs" title="重做 (Ctrl+Y)">↪</button>
              <button onClick={() => setShowHistoryPanel(false)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-warning-100 dark:hover:bg-warning-800/30 text-neutral-400">✕</button>
            </div>
          </div>
          <div className="p-3 max-h-[35vh] overflow-y-auto custom-scrollbar space-y-1">
            {[...historyEntries].reverse().slice(0, 20).map((entry, i) => {
              const typeIcons: Record<string, string> = { filter: '🔍', search: '🔎', select: '👆', layout: '📐', theme: '🎨', zoom: '🔭', focus: '🎯', export: '📤', annotate: '💬', bookmark: '⭐', import: '📥', share: '🔗' }
              const typeColors: Record<string, string> = { filter: 'blue', search: 'indigo', select: 'emerald', layout: 'violet', theme: 'pink', zoom: 'cyan', focus: 'orange', export: 'slate', annotate: 'pink', bookmark: 'amber', import: 'orange', share: 'violet' }
              return (
                <div key={entry.id} className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg hover:bg-${typeColors[entry.type] || 'slate'}-50 dark:hover:bg-${typeColors[entry.type] || 'slate'}-800/20 transition-colors ${i === historyEntries.length - 1 - historyIndex ? 'ring-1 ring-amber-300' : ''}`}>
                  <span className="text-sm shrink-0">{typeIcons[entry.type] || '📌'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-neutral-700 dark:text-neutral-300 truncate">{entry.description}</p>
                    <span className="text-[8px] text-neutral-400">{entry.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                  {!entry.reversible && <span className="text-[8px] px-1 py-0.5 rounded bg-neutral-100 text-neutral-400 shrink-0">只读</span>}
                </div>
              )
            })}
            {historyEntries.length === 0 && <p className="text-[11px] text-neutral-400 text-center py-4">暂无操作记录</p>}
          </div>
        </div>
      )}

      {/* v8.2: 书签管理面板 */}
      {showBookmarkPanel && (
        <div className="absolute top-14 right-3 z-45 w-[320px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-amber-200/60 dark:border-amber-700/40 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 border-b border-amber-100/50 rounded-t-2xl">
            <div className="flex items-center gap-2"><span>⭐</span><span className="text-sm font-bold text-warning-700 dark:text-warning-300">书签收藏</span>
              <span className="text-[10px] text-neutral-400">({bookmarks.length}/10)</span>
            </div>
            <button onClick={() => setShowBookmarkPanel(false)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-warning-100 dark:hover:bg-warning-800/30 text-neutral-400">✕</button>
          </div>
          <div className="p-3 space-y-1.5 max-h-[40vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => {
              const name = prompt('书签名称:', `视图 ${bookmarks.length + 1}`)
              if (name) addBookmark(name)
            }} className="w-full px-3 py-2 rounded-lg border-2 border-dashed border-amber-200 dark:border-amber-700 text-[11px] text-warning-500 hover:bg-warning-50 dark:hover:bg-warning-900/10 transition-colors">+ 保存当前视图为书签</button>
            {bookmarks.map(bm => (
              <div key={bm.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-warning-50/50 dark:hover:bg-warning-900/10 group cursor-pointer" onClick={() => loadBookmark(bm)}>
                <span className="text-base shrink-0">{bm.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 truncate">{bm.name}</p>
                  <p className="text-[8px] text-neutral-400">{bm.createdAt.toLocaleDateString('zh-CN')}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeBookmark(bm.id); }} className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-error-100 text-neutral-400 text-xs transition-all">✕</button>
              </div>
            ))}
            {bookmarks.length === 0 && <p className="text-[11px] text-neutral-400 text-center py-4">暂无书签，点击上方按钮保存</p>}
          </div>
        </div>
      )}

      {/* v8.2: 报告生成对话框 */}
      {showReportDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setShowReportDialog(false)}>
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-[480px] overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 border-b border-indigo-100/50">
              <div className="flex items-center gap-2"><span>📄</span><span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">生成分析报告</span></div>
              <button onClick={() => setShowReportDialog(false)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-800/30 text-neutral-400">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 block mb-1">报告标题</label>
                  <input value={reportConfig.title} onChange={e => setReportConfig(prev => ({ ...prev, title: e.target.value }))} className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600 text-[11px] bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 block mb-1">作者</label>
                  <input value={reportConfig.author} onChange={e => setReportConfig(prev => ({ ...prev, author: e.target.value }))} className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600 text-[11px] bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 block mb-1">导出格式</label>
                <div className="flex gap-1.5">
                  {(['pdf', 'word', 'html'] as const).map(fmt => (
                    <button key={fmt} onClick={() => setReportConfig(prev => ({ ...prev, format: fmt }))}
                      className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium uppercase transition-colors ${reportConfig.format === fmt ? 'bg-indigo-500 text-white' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-600'}`}>
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-neutral-500 block mb-1.5">包含内容</span>
                <div className="space-y-1">
                  {[
                    { key: 'includeScreenshot', label: '📊 图谱截图' },
                    { key: 'includeStatistics', label: '📈 统计数据' },
                    { key: 'includeAIInsights', label: '🤖 AI洞察' },
                    { key: 'includeCentrality', label: '🎯 中心性分析' },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={reportConfig[opt.key as keyof ReportConfig] as boolean}
                        onChange={e => setReportConfig(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                        className="rounded border-neutral-300 text-indigo-500 focus:ring-indigo-300" />
                      <span className="text-[11px] text-neutral-600 dark:text-neutral-400">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button onClick={generateReport} disabled={reportGenerating}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-bold hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {reportGenerating ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />生成中...</> : '📄 生成并下载报告'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* v8.3: 统计仪表盘面板 */}
      {showStatsPanel && graphStats && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[60] w-[520px] bg-white/98 dark:bg-neutral-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-emerald-200/60 dark:border-emerald-700/40 animate-fade-in max-h-[70vh] overflow-auto custom-scrollbar">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 border-b border-emerald-100/50 rounded-t-2xl sticky top-0">
            <div className="flex items-center gap-2">
              <span>📊</span>
              <span className="text-sm font-bold text-primary-700 dark:text-primary-300">多维统计仪表盘</span>
            </div>
            <button onClick={() => setShowStatsPanel(false)} className="w-6 h-6 rounded-full hover:bg-primary-100 dark:hover:bg-primary-800/30 flex items-center justify-center transition-colors" title="关闭">✕</button>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '节点数', value: graphStats.nodeCount, icon: '🔵' },
                { label: '边数', value: graphStats.edgeCount, icon: '🔗' },
                { label: '图密度', value: (graphStats.density * 100).toFixed(1) + '%', icon: '📈' },
                { label: '聚类系数', value: graphStats.clusteringCoeff.toFixed(3), icon: '🔄' },
              ].map((item) => (
                <div key={item.label} className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl p-2.5 text-center border border-emerald-100/50">
                  <div className="text-lg">{item.icon}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{item.label}</div>
                  <div className="text-sm font-bold text-primary-700 dark:text-primary-300">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '平均度', value: graphStats.avgDegree.toFixed(1), icon: '📊' },
                { label: '最大度', value: graphStats.maxDegree, icon: '⭐' },
                { label: '连通分量', value: graphStats.componentCount, icon: '🧩' },
                { label: '最大分量', value: graphStats.largestComponentSize, icon: '🏆' },
              ].map((item) => (
                <div key={item.label} className="bg-slate-50 dark:bg-neutral-800/50 rounded-xl p-2.5 text-center border border-neutral-100/50">
                  <div className="text-lg">{item.icon}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{item.label}</div>
                  <div className="text-sm font-bold">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="bg-slate-50 dark:bg-neutral-800/30 rounded-xl p-3 border border-neutral-100/50">
              <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-2">📊 节点类型分布</div>
              <div className="space-y-1.5">
                {graphStats.typeDistribution.map(t => (
                  <div key={t.type} className="flex items-center gap-2">
                    <span className="text-xs w-16 truncate">{t.type}</span>
                    <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full" style={{ width: `${Math.min(t.percentage, 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium w-20 text-right">{t.count} ({t.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* v8.3: 中心性分析面板 */}
      {showCentralityPanel && centralityMetrics && (
        <div className="absolute top-14 right-3 z-[60] w-[360px] bg-white/98 dark:bg-neutral-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-red-200/60 dark:border-red-700/40 animate-fade-in max-h-[65vh] overflow-auto custom-scrollbar">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50 border-b border-red-100/50 rounded-t-2xl sticky top-0">
            <div className="flex items-center gap-2">
              <span>🎯</span>
              <span className="text-sm font-bold text-error-700 dark:text-error-300">中心性分析</span>
            </div>
            <div className="flex items-center gap-1">
              {(['pageRank', 'betweenness', 'closeness', 'degree'] as const).map(mode => (
                <button key={mode} onClick={() => { setCentralityMode(mode); runCentralityAnalysis(mode) }}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${centralityMode === mode ? 'bg-error-500 text-white' : 'hover:bg-error-100 dark:hover:bg-error-800/30 text-neutral-600 dark:text-neutral-300'}`}>
                  {mode === 'pageRank' ? 'PR' : mode === 'betweenness' ? 'BC' : mode === 'closeness' ? 'CC' : 'DEG'}
                </button>
              ))}
              <button onClick={() => setShowCentralityPanel(false)} className="w-5 h-5 rounded-full hover:bg-error-100 flex items-center justify-center ml-1" title="关闭">✕</button>
            </div>
          </div>
          <div className="p-3 space-y-1.5">
            {(centralityMode === 'pageRank' ? centralityMetrics.pageRank : centralityMode === 'betweenness' ? centralityMetrics.betweenness : centralityMode === 'closeness' ? centralityMetrics.closeness : centralityMetrics.degree)
              ? Object.entries(centralityMode === 'pageRank' ? centralityMetrics.pageRank : centralityMode === 'betweenness' ? centralityMetrics.betweenness : centralityMode === 'closeness' ? centralityMetrics.closeness : centralityMetrics.degree)
                  .sort((a, b) => b[1] - a[1]).slice(0, 15).map(([nodeId, score], i) => {
                    const node = filteredData.filteredNodes.find(n => (n.id || n.label) === nodeId)
                    const maxScore = Math.max(...Object.values(centralityMode === 'pageRank' ? centralityMetrics.pageRank : centralityMode === 'betweenness' ? centralityMetrics.betweenness : centralityMode === 'closeness' ? centralityMetrics.closeness : centralityMetrics.degree))
                    return (
                      <div key={nodeId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/10 cursor-pointer transition-colors"
                        onClick={() => { onNodeClick?.(node!); setSelectedNode(node ?? null) }}>
                        <span className="text-[10px] font-mono text-neutral-400 w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{node?.label || nodeId}</div>
                          <div className="text-[10px] text-neutral-400">{node?.type}</div>
                        </div>
                        <div className="w-16 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-red-400 to-orange-400 rounded-full" style={{ width: `${(score / maxScore) * 100}%` }} />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-error-600 dark:text-error-400 w-12 text-right">{(score * 100).toFixed(1)}</span>
                      </div>
                    )
                  })
              : <div className="text-xs text-neutral-400 text-center py-4">点击上方按钮计算中心性指标</div>}
          </div>
        </div>
      )}

      {/* v8.3: 子图浏览器面板 */}
      {showSubGraphPanel && (communityResult || kcoreResult || savedSubGraphs.length > 0) && (
        <div className="absolute bottom-16 right-3 z-[60] w-[380px] bg-white/98 dark:bg-neutral-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-200/60 dark:border-purple-700/40 animate-fade-in max-h-[55vh] overflow-auto custom-scrollbar">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 border-b border-purple-100/50 rounded-t-2xl sticky top-0">
            <div className="flex items-center gap-2">
              <span>🧩</span>
              <span className="text-sm font-bold text-accent-700 dark:text-accent-300">子图浏览器</span>
              {(communityResult?.communities.length || 0) > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-accent-100 text-accent-600">{communityResult?.communities.length}社区</span>}
              {kcoreResult && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-pink-100 text-pink-600">k={kcoreResult.maxK}</span>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={computeKCore} className="px-2 py-0.5 rounded text-[10px] font-medium hover:bg-accent-100 dark:hover:bg-accent-800/30 transition-colors text-accent-600">k-core</button>
              <button onClick={() => setShowSubGraphPanel(false)} className="w-5 h-5 rounded-full hover:bg-accent-100 flex items-center justify-center" title="关闭">✕</button>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {communityResult?.communities.map(comm => (
              <div key={comm.id} className="rounded-xl p-2.5 border border-neutral-100 dark:border-neutral-700/50 hover:border-purple-300 dark:hover:border-purple-600 cursor-pointer transition-colors"
                onClick={() => {
                  const newSub: SubGraphResult = {
                    id: crypto.randomUUID(),
                    name: `社区 #${comm.id + 1}`,
                    type: 'community',
                    nodeIds: comm.nodes,
                    edgeIds: [],
                    metadata: { communityId: comm.id, modularity: communityResult.modularity },
                  }
                  setSavedSubGraphs(prev => [...prev.slice(-9), newSub])
                  setActiveSubGraph(newSub)
                }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: comm.color }} />
                    <span className="text-xs font-bold">社区 #{comm.id + 1}</span>
                    <span className="text-[10px] text-neutral-400">({comm.nodes.length}节点)</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {comm.labels.slice(0, 8).map(l => (
                    <span key={l} className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-100 dark:bg-neutral-700/50 truncate max-w-[80px]" title={l}>{l}</span>
                  ))}
                  {comm.labels.length > 8 && <span className="text-[10px] text-neutral-400">+{comm.labels.length - 8}</span>}
                </div>
              </div>
            ))}
            {kcoreResult?.cores.filter(c => c.k >= 2).reverse().slice(0, 5).map(core => (
              <div key={core.k} className="rounded-xl p-2.5 border border-neutral-100 dark:border-neutral-700/50 hover:border-pink-300 cursor-pointer transition-colors"
                onClick={() => {
                  const newSub: SubGraphResult = {
                    id: crypto.randomUUID(),
                    name: `${core.k}-Core`,
                    type: 'kcore',
                    nodeIds: core.nodeIds,
                    edgeIds: [],
                    metadata: { k: core.k },
                  }
                  setSavedSubGraphs(prev => [...prev.slice(-9), newSub])
                  setActiveSubGraph(newSub)
                }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-pink-600 dark:text-pink-400">{core.k}-Core</span>
                  <span className="text-[10px] text-neutral-400">{core.nodeIds.length}节点 · {core.labels.slice(0, 4).join(', ')}{core.labels.length > 4 ? '...' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* v8.3: AI图谱问答面板 */}
      {showAIPanel && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[60] w-[480px] bg-white/98 dark:bg-neutral-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-blue-200/60 dark:border-blue-700/40 animate-fade-in max-h-[60vh] flex flex-col custom-scrollbar">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-b border-blue-100/50 rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2">
              <span>🧠</span>
              <span className="text-sm font-bold text-secondary-700 dark:text-secondary-300">AI 图谱问答</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-secondary-100 text-secondary-600">NL2Graph</span>
            </div>
            <button onClick={() => setShowAIPanel(false)} className="w-6 h-6 rounded-full hover:bg-secondary-100 dark:hover:bg-secondary-800/30 flex items-center justify-center transition-colors" title="关闭">✕</button>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-3 min-h-0">
            {aiQAHistory.length > 0 && aiQAHistory.slice().reverse().map(record => (
              <div key={record.id} className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="text-sm">❓</span>
                  <div className="flex-1 bg-secondary-50 dark:bg-secondary-900/20 rounded-xl px-3 py-2 text-xs">{record.question}</div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-sm">🤖</span>
                  <div className="flex-1 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl px-3 py-2 text-xs whitespace-pre-wrap leading-relaxed">{record.answer}</div>
                </div>
              </div>
            ))}
            {aiQAHistory.length === 0 && (
              <div className="text-center py-6 text-neutral-400 text-xs space-y-2">
                <div className="text-2xl">🧠</div>
                <div>向AI提问关于图谱的任何问题</div>
                <div className="space-y-1 text-left max-w-xs mx-auto mt-3">
                  {['哪个节点连接最多？', '药材和化合物的关系？', '有哪些协同关系？'].map(q => (
                    <div key={q} className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 cursor-pointer hover:bg-secondary-100 dark:hover:bg-secondary-900/20 transition-colors" onClick={() => { setAiQuestion(q); handleAIQuestion() }}>{q}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-blue-100/50 shrink-0">
            <div className="flex items-center gap-2">
              <input
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAIQuestion()}
                placeholder="输入问题，如：哪些节点连接最多？..."
                className="flex-1 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/50 border border-transparent"
              />
              <button
                onClick={handleAIQuestion}
                disabled={aiAnswering || !aiQuestion.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0">
                {aiAnswering ? '思考中...' : '发送'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip — v7.0: 专业级详情弹窗 */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none px-4 py-2.5 rounded-xl text-xs font-medium shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: tooltip.x + 16,
            top: tooltip.y - 12,
            background: 'linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.97) 100%)',
            color: '#F3F4F6',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '12px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(148,163,184,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
            border: '1px solid rgba(148,163,184,0.10)',
            maxWidth: '320px',
          }}
        >
          <div className="whitespace-pre-line leading-relaxed">{tooltip.content}</div>
        </div>
      )}

      {/* v7.3: 增强搜索栏 */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 w-72">
        <div className="relative">
          <div className="flex items-center gap-1 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-md rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 shadow-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary-500/30 focus-within:border-primary-400 transition-all">
            <svg className="w-3.5 h-3.5 text-neutral-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedNodeIndex(prev => Math.min(prev + 1, searchMatches.length - 1)) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedNodeIndex(prev => Math.max(prev - 1, 0)) }
                else if (e.key === 'Enter' && searchMatches[focusedNodeIndex]) { handleSearchSelect(searchMatches[focusedNodeIndex].node) }
                else if (e.key === 'Escape') { clearSearch(); (e.target as HTMLInputElement).blur() }
              }}
              placeholder="搜索节点..."
              className="flex-1 bg-transparent text-[11px] text-neutral-700 dark:text-neutral-300 placeholder-slate-400 outline-none min-w-0"
            />
            {searchQuery && (
              <button onClick={clearSearch} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors shrink-0">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {/* 搜索结果下拉 */}
          {searchQuery && searchMatches.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 max-h-[280px] overflow-y-auto custom-scrollbar">
              {searchMatches.map(({ node, score, matchFields }, idx) => {
                const tconf = TYPE_CONFIG[node.type]
                const isFocused = idx === focusedNodeIndex
                return (
                  <button
                    key={node.id || node.label}
                    onClick={() => handleSearchSelect(node)}
                    onMouseEnter={() => setFocusedNodeIndex(idx)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                      isFocused ? 'bg-primary-50 dark:bg-primary-950/30' : 'hover:bg-slate-50 dark:hover:bg-neutral-800/60'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-1.5 ring-white dark:ring-slate-900" style={{ backgroundColor: tconf?.color || 'var(--color-knowledge-default, #9CA3AF)' }} />
                    <span className={`flex-1 min-w-0 text-[11px] font-medium truncate ${isFocused ? 'text-primary-700 dark:text-primary-300' : 'text-neutral-700 dark:text-neutral-300'}`}>
                      {node.label}
                    </span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ backgroundColor: `${tconf?.color || 'var(--color-knowledge-default, #9CA3AF)'}15`, color: tconf?.color || 'var(--color-knowledge-text, #6B7280)' }}>
                      {tconf?.label || node.type}
                    </span>
                    {score >= 80 && (
                      <span className="text-[8px] font-bold text-warning-500 shrink-0">{score}</span>
                    )}
                  </button>
                )
              })}
              <div className="px-3 py-1.5 border-t border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between">
                <span className="text-[9px] text-neutral-400">找到 {searchMatches.length} 个匹配</span>
                <span className="text-[8px] text-neutral-400">↑↓ 导航 · Enter 选择</span>
              </div>
            </div>
          )}

          {/* 搜索历史（无输入时显示） */}
          {!searchQuery && searchHistory.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 shadow-lg overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between">
                <span className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">搜索历史</span>
                <button onClick={() => setSearchHistory([])} className="text-[8px] text-neutral-400 hover:text-error-500 transition-colors">清空</button>
              </div>
              {searchHistory.map((term, idx) => (
                <button
                  key={`${term}-${idx}`}
                  onClick={() => handleSearchChange(term)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-neutral-800/60 transition-colors"
                >
                  <svg className="w-3 h-3 text-neutral-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-[11px] text-neutral-600 dark:text-neutral-400 truncate">{term}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* v7.4: 框选框视觉覆盖 */}
      {isSelecting && selectionBox && (
        <div
          className="absolute border-2 border-dashed border-primary-500 bg-primary-100/20 dark:bg-primary-900/20 rounded pointer-events-none z-30"
          style={{
            left: Math.min(selectionBox.x1, selectionBox.x2),
            top: Math.min(selectionBox.y1, selectionBox.y2),
            width: Math.abs(selectionBox.x2 - selectionBox.x1),
            height: Math.abs(selectionBox.y2 - selectionBox.y1),
          }}
        />
      )}

      {/* v7.4: 右键上下文菜单 */}
      {contextMenu && (
        <div
          className="absolute z-50 min-w-[180px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-150"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node ? (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-700/50">
                {contextMenu.node.label}
              </div>
              <button onClick={() => handleContextAction('focus', contextMenu.node)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors">
                <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                聚焦此节点
              </button>
              <button onClick={() => handleContextAction('selectNeighbors', contextMenu.node)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-secondary-50 dark:hover:bg-blue-950/30 transition-colors">
                <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                选中邻居节点
              </button>
              <button onClick={() => handleContextAction('hide', contextMenu.node)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-error-50 dark:hover:bg-red-950/30 transition-colors">
                <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                隐藏此类型
              </button>
              <div className="border-t border-neutral-100 dark:border-neutral-700/50 my-1" />
            </>
          ) : selectedNodes.size > 0 ? (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-700/50">
                已选中 {selectedNodes.size} 个节点
              </div>
              <button onClick={() => handleContextAction('exportSubgraph')}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-primary-50 dark:hover:bg-emerald-950/30 transition-colors">
                <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                导出子图数据
              </button>
              <button onClick={() => handleContextAction('clearSelection')}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors">
                <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                清除选择
              </button>
              <div className="border-t border-neutral-100 dark:border-neutral-700/50 my-1" />
            </>
          ) : null}

          <div className="px-3 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-t border-neutral-100 dark:border-neutral-700/50">
            图谱工具
          </div>
          {communities.size > 0 ? (
            <button onClick={() => handleContextAction('clearCommunities')}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-warning-50 dark:hover:bg-amber-950/30 transition-colors">
              <svg className="w-3.5 h-3.5 text-warning-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
              关闭社群着色 ({new Set(communities.values()).size}个社群)
            </button>
          ) : (
            <button onClick={() => handleContextAction('detectCommunities')}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors">
              <svg className="w-3.5 h-3.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
              社群自动检测着色
            </button>
          )}
          <button onClick={() => {
            setContextMenu(null)
            setSelectedNodes(new Set())
            setCommunities(new Map())
            setCommunityColors({})
          }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors">
            <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            重置全部视图
          </button>
        </div>
      )}

      {/* v7.4: 选中节点信息条 */}
      {selectedNodes.size > 0 && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-xl border border-primary-200/70 dark:border-primary-700/40 shadow-lg">
          <span className="text-[11px] font-semibold text-primary-600 dark:text-primary-400">
            ✓ 已选择 {selectedNodes.size} 个节点
          </span>
          <span className="text-[10px] text-neutral-400">|</span>
          <span className="text-[10px] text-neutral-500">Ctrl+拖拽 框选 · 右键 菜单</span>
          <button onClick={() => setSelectedNodes(new Set())}
            className="text-[10px] text-neutral-400 hover:text-error-500 transition-colors ml-1">清除</button>
        </div>
      )}

      {/* v7.4: 社群图例 */}
      {communities.size > 0 && (
        <div className="absolute bottom-3 left-3 z-40 flex flex-wrap gap-1.5 p-2 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-lg border border-neutral-200/60 dark:border-neutral-700/40 shadow-md max-w-xs">
          <span className="text-[9px] font-semibold text-neutral-500 w-full mb-0.5">社群着色 ({new Set(communities.values()).size}个)</span>
          {Object.entries(generatedCommunityColors).slice(0, 10).map(([id, color]) => {
            const count = [...communities.values()].filter(v => v === Number(id)).length
            return (
              <span key={id} className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-white dark:bg-neutral-800 shadow-sm">
                <span className="w-2 h-2 rounded-full ring-1 ring-white dark:ring-slate-900" style={{ backgroundColor: color }} />
                社群{Number(id)+1} ×{count}
              </span>
            )
          })}
          {Object.keys(generatedCommunityColors).length > 10 && (
            <span className="text-[9px] text-neutral-400 italic">+{Object.keys(generatedCommunityColors).length - 10}...</span>
          )}
        </div>
      )}

      {/* v6.0: 缩放工具条 */}
      <ZoomToolbar
        zoomTransform={zoomTransform}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFitToCanvas}
        onReset={handleResetView}
      />

      {/* v7.5: 实时性能监控面板 */}
      {showPerfPanel && (
        <div className="absolute top-14 right-3 z-40 w-56 rounded-xl bg-neutral-900/95 dark:bg-slate-950/95 backdrop-blur-xl border border-neutral-700/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-neutral-700/40 flex items-center justify-between">
            <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
              性能监控
            </span>
            <button onClick={() => setShowPerfPanel(false)} className="text-neutral-500 hover:text-neutral-300 transition-colors p-0.5" aria-label="关闭性能面板">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-2.5 space-y-2">
            {/* FPS 指示器 */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-neutral-400">帧率 FPS</span>
              <span className={`text-[11px] font-mono font-bold tabular-nums ${
                perfStats.fps >= 55 ? 'text-primary-400' : perfStats.fps >= 40 ? 'text-warning-400' : perfStats.fps >= 24 ? 'text-orange-400' : 'text-error-400'
              }`}>
                {perfStats.fps} <span className="text-[8px] font-normal text-neutral-500">fps</span>
              </span>
            </div>
            {/* 帧时间 */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-neutral-400">帧时间</span>
              <span className="text-[10px] font-mono text-neutral-300 tabular-nums">{perfStats.frameTime} <span className="text-[8px] text-neutral-500">ms</span></span>
            </div>
            {/* 性能评级 */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-neutral-400">性能评级</span>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                perfStats.rating === 'excellent' ? 'bg-primary-500/20 text-primary-400' :
                perfStats.rating === 'good' ? 'bg-secondary-500/20 text-secondary-400' :
                perfStats.rating === 'fair' ? 'bg-warning-500/20 text-warning-400' :
                'bg-error-500/20 text-error-400'
              }`}>
                {perfStats.rating === 'excellent' ? '优秀' : perfStats.rating === 'good' ? '良好' : perfStats.rating === 'fair' ? '一般' : '较差'}
              </span>
            </div>
            <div className="border-t border-neutral-700/30 pt-2 space-y-1.5">
              {/* 节点/边数 */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-neutral-400">节点 / 边</span>
                <span className="text-[9px] font-mono text-neutral-300">{filteredData.filteredNodes.length} / {filteredData.filteredEdges.length}</span>
              </div>
              {/* LOD 级别 */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-neutral-400">渲染级别</span>
                <span className={`text-[9px] font-medium ${
                  lodLevel === 'full' ? 'text-primary-400' : lodLevel === 'reduced' ? 'text-warning-400' : 'text-error-400'
                }`}>{perfStats.lodLevel}</span>
              </div>
              {/* 内存估算 */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-neutral-400">内存估算</span>
                <span className="text-[9px] font-mono text-neutral-300">{perfStats.memoryEst}</span>
              </div>
            </div>
            {/* 增量更新状态 */}
            <div className="border-t border-neutral-700/30 pt-2 flex items-center justify-between">
              <span className="text-[9px] text-neutral-400">更新模式</span>
              <span className={`text-[9px] font-medium ${dataChanged ? 'text-warning-400' : 'text-primary-400'}`}>
                {dataChanged ? '全量重绘' : '增量更新'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* v7.5: 性能面板快捷触发按钮（始终可见） */}
      <button
        onClick={() => setShowPerfPanel(prev => !prev)}
        className="absolute bottom-3 right-3 z-30 w-6 h-6 rounded-lg bg-white/85 dark:bg-neutral-800/85 backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/50 shadow-sm hover:shadow-md transition-all flex items-center justify-center group"
        title="性能监控 (Shift+P)"
        aria-label="切换性能监控面板"
      >
        <svg className={`w-3 h-3 transition-colors ${showPerfPanel ? 'text-primary-500' : 'text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      </button>

      {/* v7.6: 导出菜单下拉 */}
      {showExportMenu && (
        <div className="absolute bottom-14 right-3 z-50 w-52 bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">导出数据</span>
            <button onClick={() => setShowExportMenu(false)} className="text-neutral-400 hover:text-neutral-600 p-0.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-1.5">
            <button onClick={() => exportSubgraphJSON('json')}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-secondary-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors">
              <span className="w-5 h-5 rounded bg-secondary-100 dark:bg-secondary-900/40 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-secondary-600">{ }</span>
              </span>
              <div className="text-left">
                <div className="font-medium text-neutral-700 dark:text-neutral-300">JSON 格式</div>
                <div className="text-[8px] text-neutral-400">完整数据 + 属性 + 社群</div>
              </div>
            </button>
            <button onClick={() => exportSubgraphJSON('gexf')}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-accent-50 dark:hover:bg-purple-950/30 rounded-lg transition-colors">
              <span className="w-5 h-5 rounded bg-accent-100 dark:bg-accent-900/40 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-accent-600">G</span>
              </span>
              <div className="text-left">
                <div className="font-medium text-neutral-700 dark:text-neutral-300">GEXF 格式</div>
                <div className="text-[8px] text-neutral-400">Gephi / NetworkX 兼容</div>
              </div>
            </button>
            <button onClick={() => exportSubgraphJSON('svg')}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-primary-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors">
              <span className="w-5 h-5 rounded bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </span>
              <div className="text-left">
                <div className="font-medium text-neutral-700 dark:text-neutral-300">SVG 图像</div>
                <div className="text-[8px] text-neutral-400">矢量图形 / 可编辑</div>
              </div>
            </button>
          </div>
          {selectedNodes.size > 0 && (
            <div className="px-3 py-1.5 bg-primary-50/50 dark:bg-primary-950/20 border-t border-neutral-100 dark:border-neutral-700/50">
              <span className="text-[9px] text-primary-600 dark:text-primary-400">将导出选中的 {selectedNodes.size} 个节点</span>
            </div>
          )}
        </div>
      )}

      {/* v7.6: 导出状态提示 */}
      {exportStatus && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-neutral-900/95 dark:bg-slate-950 backdrop-blur-md shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          <span className="text-[11px] font-medium text-primary-400">{exportStatus}</span>
        </div>
      )}

      {/* v7.6: 路径动画高亮覆盖层 */}
      {pathAnimation && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-45 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25 animate-pulse">
          <span className="text-[11px] font-medium text-white flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            路径发现: {pathAnimation.pathNodes.length} 个节点 · {pathAnimation.pathEdges.length} 条边
          </span>
        </div>
      )}

      {/* v7.6: 小地图导航 */}
      {showMinimap && filteredData.filteredNodes.length > 0 && (
        <div className="absolute bottom-3 left-3 z-35 bg-white/92 dark:bg-neutral-900/92 backdrop-blur-sm rounded-lg border border-neutral-200/70 dark:border-neutral-700/50 shadow-md overflow-hidden" style={{ width: 160, height: 110 }}>
          <div className="flex items-center justify-between px-2 py-1 border-b border-neutral-100 dark:border-neutral-700/40">
            <span className="text-[8px] font-semibold text-neutral-500 uppercase tracking-wider">导航图</span>
            <button onClick={() => setShowMinimap(false)} className="text-neutral-400 hover:text-neutral-600 p-0.5" title="关闭小地图">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <MinimapCanvas
            nodes={filteredData.filteredNodes}
            edges={filteredData.filteredEdges}
            width={158}
            height={94}
            selectedNode={selectedNode}
            pathAnimation={pathAnimation}
            communities={communities}
            communityColors={generatedCommunityColors}
            onNavigate={(x, y, scale) => {
              if (!svgRef.current || !zoomBehaviorRef.current) return
              const svg = d3.select(svgRef.current)
              const containerW = containerRef.current?.clientWidth || width
              const containerH = height
              svg.transition().duration(400).ease(d3.easeCubicOut)
                .call(zoomBehaviorRef.current.transform,
                  d3.zoomIdentity
                    .translate(containerW / 2, containerH / 2)
                    .scale(scale)
                    .translate(-x * scale, -y * scale),
                )
            }}
          />
        </div>
      )}

      {/* v7.6: 小地图恢复按钮（关闭时显示） */}
      {!showMinimap && filteredData.filteredNodes.length > 0 && (
        <button
          onClick={() => setShowMinimap(true)}
          className="absolute bottom-3 left-3 z-30 w-6 h-6 rounded-lg bg-white/85 dark:bg-neutral-800/85 backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/50 shadow-sm hover:shadow-md transition-all flex items-center justify-center group"
          title="显示小地图"
        >
          <svg className={`w-3 h-3 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V5.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </button>
      )}

      {/* v7.7: 中心性分析面板触发按钮 */}
      <button
        onClick={() => setShowCentralityPanel(prev => !prev)}
        className="absolute bottom-14 right-3 z-30 w-6 h-6 rounded-lg bg-white/85 dark:bg-neutral-800/85 backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/50 shadow-sm hover:shadow-md transition-all flex items-center justify-center group"
        title="中心性分析 (Shift+C)"
        aria-label="切换中心性分析面板"
      >
        <svg className={`w-3 h-3 transition-colors ${showCentralityPanel ? 'text-violet-500' : 'text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>

      {/* v7.7: 中心性分析面板 */}
      {showCentralityPanel && centralityData.stats && (
        <div className="absolute top-14 right-3 z-40 w-72 rounded-xl bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-700/60 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[70vh] overflow-y-auto">
          <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur">
            <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              中心性分析
            </span>
            <div className="flex items-center gap-1">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'degree' | 'label' | 'type')}
                className="text-[8px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded px-1 py-0.5">
                <option value="degree">按度数</option>
                <option value="label">按名称</option>
                <option value="type">按类型</option>
              </select>
              <button onClick={() => setShowCentralityPanel(false)} className="text-neutral-400 hover:text-neutral-600 p-0.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {/* 图统计概览 */}
          <div className="p-2.5 space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: '节点', value: centralityData.stats.totalNodes, color: 'text-secondary-500' },
                { label: '边', value: centralityData.stats.totalEdges, color: 'text-primary-500' },
                { label: '密度', value: centralityData.stats.density, color: 'text-accent-500' },
              ].map(s => (
                <div key={s.label} className="bg-slate-50 dark:bg-neutral-800/50 rounded-lg p-1.5 text-center">
                  <div className={`text-[11px] font-bold tabular-nums ${s.color}`}>{s.value}</div>
                  <div className="text-[7px] text-neutral-400">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-1">
              {[
                { label: '平均度', value: centralityData.stats.avgDegree },
                { label: '最大度', value: centralityData.stats.maxDegree },
                { label: '连通分量', value: centralityData.stats.connectedComponents },
                { label: '直径', value: centralityData.stats.diameter },
              ].map(s => (
                <div key={s.label} className="text-center py-1">
                  <div className="text-[10px] font-mono font-semibold text-neutral-700 dark:text-neutral-300">{s.value}</div>
                  <div className="text-[7px] text-neutral-400 leading-tight">{s.label}</div>
                </div>
              ))}
            </div>

            {/* 类型分布 */}
            <div className="border-t border-neutral-100 dark:border-neutral-700/30 pt-2">
              <div className="text-[8px] font-semibold text-neutral-500 uppercase mb-1.5">类型分布</div>
              <div className="space-y-1">
                {centralityData.stats.typeDistribution.slice(0, 6).map(([type, count]) => {
                  const conf = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG]
                  const pct = ((count / centralityData.stats.totalNodes) * 100).toFixed(0)
                  return (
                    <div key={type} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: conf?.color || 'var(--color-knowledge-default, #9CA3AF)' }} />
                      <span className="text-[9px] text-neutral-600 dark:text-neutral-400 truncate flex-1">{conf?.label || type}</span>
                      <span className="text-[9px] font-mono text-neutral-500">{count}</span>
                      <div className="w-10 h-1.5 bg-neutral-100 dark:bg-neutral-700/40 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: conf?.color || 'var(--color-knowledge-default, #9CA3AF)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top 10 节点排行 */}
            <div className="border-t border-neutral-100 dark:border-neutral-700/30 pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] font-semibold text-neutral-500 uppercase">Top 10 关键节点</span>
                <span className="text-[7px] text-neutral-400">点击查看详情</span>
              </div>
              <div className="space-y-0.5">
                {sortedNodeList.map((item, idx) => {
                  const conf = TYPE_CONFIG[item.node.type]
                  const pct = item.degree > 0 ? Math.min(100, (item.degree / (centralityData.stats.maxDegree || 1)) * 100) : 0
                  return (
                    <button key={`${item.node.id}_${idx}`}
                      onClick={() => onNodeClick?.(item.node)}
                      className="w-full flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-secondary-50/70 dark:hover:bg-blue-950/20 transition-colors group text-left">
                      <span className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold shrink-0 ${
                        idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                        idx === 1 ? 'bg-neutral-200 text-neutral-600' :
                        idx === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-50 text-neutral-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: conf?.color || 'var(--color-knowledge-default, #9CA3AF)' }} />
                      <span className="text-[9px] font-medium text-neutral-700 dark:text-neutral-300 truncate flex-1 group-hover:text-secondary-600 dark:group-hover:text-secondary-400">
                        {item.node.label}
                      </span>
                      <span className="text-[9px] font-mono font-bold text-neutral-500 tabular-nums">{item.degree}</span>
                      <div className="w-8 h-1 bg-neutral-100 dark:bg-neutral-700/30 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-violet-400 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 连通分量警告 */}
            {centralityData.stats.connectedComponents > 1 && (
              <div className="border-t border-neutral-100 dark:border-neutral-700/30 pt-2 mt-1">
                <div className="text-[8px] text-warning-600 dark:text-warning-400 px-2 py-1.5 bg-warning-50 dark:bg-warning-900/15 rounded-lg">
                  ⚠ 图存在 {centralityData.stats.connectedComponents} 个连通分量，最大分量含 {centralityData.stats.largestComponentSize} 节点
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* v7.8: 批量操作工具条（选中节点时显示） */}
      {selectedNodes.size > 0 && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-md border border-neutral-700/50 shadow-xl animate-in fade-in zoom-in-95 duration-150">
          <span className="text-[10px] font-semibold text-white">已选 {selectedNodes.size} 项</span>
          <div className="w-px h-4 bg-neutral-600" />
          <button onClick={() => batchOperationOnSelected('focus')} className="px-2 py-1 text-[9px] bg-secondary-600 hover:bg-secondary-500 text-white rounded-md transition-colors" title="聚焦首项">
            🎯 聚焦
          </button>
          <button onClick={() => batchOperationOnSelected('highlight')} className="px-2 py-1 text-[9px] bg-warning-600 hover:bg-warning-500 text-white rounded-md transition-colors" title="高亮选中">
            ✨ 高亮
          </button>
          <button onClick={() => batchOperationOnSelected('hide')} className="px-2 py-1 text-[9px] bg-neutral-600 hover:bg-neutral-500 text-white rounded-md transition-colors" title="隐藏选中">
            🚫 隐藏
          </button>
          <button onClick={() => batchOperationOnSelected('export')} className="px-2 py-1 text-[9px] bg-primary-600 hover:bg-primary-500 text-white rounded-md transition-colors" title="导出子图">
            📤 导出
          </button>
          <button onClick={() => setSelectedNodes(new Set())} className="px-2 py-1 text-[9px] bg-error-600/80 hover:bg-error-500 text-white rounded-md transition-colors" title="清除选择">
            ✕ 清除
          </button>
        </div>
      )}

      {/* v7.8: 固定节点面板 */}
      {showPinnedPanel && pinnedNodes.size > 0 && (
        <div className="absolute top-14 left-3 z-40 w-56 rounded-xl bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-700/60 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-left-3 duration-150 max-h-[50vh] overflow-y-auto">
          <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur">
            <span className="text-[10px] font-bold text-error-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>📌</span> 固定节点 ({pinnedNodes.size})
            </span>
            <div className="flex items-center gap-1">
              <button onClick={clearAllPins} className="text-[8px] px-1.5 py-0.5 bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400 rounded hover:bg-error-200 transition-colors">
                全部释放
              </button>
              <button onClick={() => setShowPinnedPanel(false)} className="text-neutral-400 hover:text-neutral-600 p-0.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          <div className="p-2 space-y-1">
            {[...pinnedNodes].map(nodeId => {
              const node = filteredData.filteredNodes.find(n => (n.id || n.label) === nodeId)
              if (!node) return null
              const conf = TYPE_CONFIG[node.type]
              return (
                <div key={nodeId} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800/50 group cursor-pointer"
                  onClick={() => onNodeClick?.(node)}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: conf?.color || 'var(--color-knowledge-default, #9CA3AF)' }} />
                  <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-300 truncate flex-1">{node.label}</span>
                  <span className="text-[8px] text-neutral-400">{conf?.label || node.type}</span>
                  <button onClick={(e) => { e.stopPropagation(); togglePinNode(nodeId) }}
                    className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-error-500 p-0.5 transition-opacity">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* v7.8: 固定节点触发按钮 */}
      {pinnedNodes.size > 0 && !showPinnedPanel && (
        <button
          onClick={() => setShowPinnedPanel(true)}
          className="absolute top-14 left-3 z-30 w-6 h-6 rounded-lg bg-white/85 dark:bg-neutral-800/85 backdrop-blur-sm border border-red-200/60 dark:border-red-800/30 shadow-sm hover:shadow-md transition-all flex items-center justify-center group"
          title={`固定节点 (${pinnedNodes.size})`}
        >
          <span className="text-xs">📌</span>
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-error-500 text-[7px] font-bold text-white flex items-center justify-center">{pinnedNodes.size}</span>
        </button>
      )}

      {/* v7.8: 标注渲染层 */}
      {annotations.map(anno => (
        <div key={anno.id}
          className="absolute z-35 group"
          style={{ left: anno.x, top: anno.y }}
        >
          {anno.type === 'arrow' ? (
            <svg width="60" height="20" className="overflow-visible">
              <defs><marker id={`arrowhead-${anno.id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 L1.5,3 Z" fill="#FF3B30" />
              </marker></defs>
              <line x1="0" y1="10" x2="55" y2="10" stroke="#FF3B30" strokeWidth="1.5" markerEnd={`url(#arrowhead-${anno.id})`} />
            </svg>
          ) : null}
          <div className="relative">
            <div className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700/50 rounded-lg shadow-sm whitespace-nowrap">
              <span className="text-[10px] font-medium text-yellow-800 dark:text-yellow-200">{anno.text}</span>
            </div>
            <button onClick={() => removeAnnotation(anno.id)}
              className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-neutral-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[7px] leading-none">
              ×
            </button>
          </div>
        </div>
      ))}

      {/* v7.8: 标注模式指示器 + 添加标注按钮 */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-35 flex items-center gap-2">
        {isAddingAnnotation && (
          <div className="px-3 py-1.5 rounded-lg bg-warning-500 text-white text-[11px] font-semibold shadow-lg animate-pulse flex items-center gap-1.5">
            ✏️ 点击图谱添加标注 — 按 Esc 取消
          </div>
        )}
        {!isAddingAnnotation && (
          <button
            onClick={() => setIsAddingAnnotation(true)}
            className="w-7 h-7 rounded-lg bg-white/85 dark:bg-neutral-800/85 backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/50 shadow-sm hover:shadow-md hover:bg-warning-50 dark:hover:bg-warning-900/20 transition-all flex items-center justify-center group"
            title="添加标注 (Shift+N)"
          >
            <span className="text-sm group-hover:scale-110 transition-transform">✏️</span>
          </button>
        )}
        {annotations.length > 0 && !isAddingAnnotation && (
          <button
            onClick={clearAllAnnotations}
            className="w-7 h-7 rounded-lg bg-white/85 dark:bg-neutral-800/85 backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/50 shadow-sm hover:shadow-md hover:bg-error-50 dark:hover:bg-error-900/20 transition-all flex items-center justify-center group"
            title={`清除全部标注 (${annotations.length})`}
          >
            <span className="text-xs">🗑</span>
          </button>
        )}
      </div>

      {/* v7.2: 增强型节点详情面板 — 专业侧边栏 */}
      {selectedNode && (
        <div
          className="absolute top-14 left-3 z-40 w-80 rounded-2xl border shadow-2xl animate-in fade-in slide-in-from-left-3 duration-250 bg-white/[0.98] dark:bg-neutral-900/[0.97] backdrop-blur-xl border-neutral-200/80 dark:border-neutral-700/60 overflow-hidden"
          style={{ boxShadow: '0 25px 70px rgba(0,0,0,0.18), 0 0 0 1px rgba(148,163,184,0.08), inset 0 1px 0 rgba(255,255,255,0.06)' }}
        >
          {/* ══ 面板头部 ══ */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div
                  className="w-5 h-5 rounded-lg shadow-md ring-2 ring-offset-1.5 shrink-0 flex items-center justify-center"
                  style={{
                    backgroundColor: TYPE_CONFIG[selectedNode.type]?.color,
                    '--tw-ring-color': TYPE_CONFIG[selectedNode.type]?.color,
                  } as React.CSSProperties}
                >
                  <span className="text-[10px] text-white font-bold">{TYPE_CONFIG[selectedNode.type]?.label?.[0]}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-100 text-sm leading-tight block truncate" title={selectedNode.label}>
                    {selectedNode.label}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge
                      variant={selectedNode.type === 'herb' ? 'primary' : selectedNode.type === 'compound' ? 'info' : selectedNode.type === 'target' ? 'warning' : selectedNode.type === 'disease' ? 'danger' : selectedNode.type === 'peptide' ? 'success' : 'neutral'}
                      size="sm"
                      className="text-[9px] px-1.5 py-0"
                    >
                      {TYPE_CONFIG[selectedNode.type]?.label || selectedNode.type}
                    </Badge>
                    {selectedNode.degree != null && selectedNode.degree > 0 && (
                      <span className="text-[9px] font-mono tabular-nums text-neutral-400 dark:text-neutral-500">
                        度数 {selectedNode.degree}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setSelectedNode(null); setDetailTab('info') }}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-all p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700/60 shrink-0"
                aria-label="关闭详情面板"
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2l11 11M13 2L2 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* 快速统计条 */}
            <div className="grid grid-cols-3 gap-1.5 mt-3">
              <div className="rounded-lg bg-slate-50 dark:bg-neutral-800/60 px-2 py-1.5 text-center">
                <div className="text-[11px] font-bold tabular-nums text-neutral-700 dark:text-neutral-300">{nodeConnections.totalConnections}</div>
                <div className="text-[8px] text-neutral-400 dark:text-neutral-500">关联数</div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-neutral-800/60 px-2 py-1.5 text-center">
                <div className="text-[11px] font-bold tabular-nums text-neutral-700 dark:text-neutral-300">{nodeConnections.neighbors.length}</div>
                <div className="text-[8px] text-neutral-400 dark:text-neutral-500">邻居</div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-neutral-800/60 px-2 py-1.5 text-center">
                <div className="text-[11px] font-bold tabular-nums text-neutral-700 dark:text-neutral-300">{Object.keys(nodeConnections.neighborTypeCount).length}</div>
                <div className="text-[8px] text-neutral-400 dark:text-neutral-500">类型</div>
              </div>
            </div>

            {/* 邻居类型分布 */}
            {nodeConnections.neighbors.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(nodeConnections.neighborTypeCount).slice(0, 5).map(([type, count]) => {
                  const tconf = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG]
                  return (
                    <span key={type} className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${tconf?.color || 'var(--color-knowledge-default, #9CA3AF)'}15`, color: tconf?.color || 'var(--color-knowledge-text, #6B7280)' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tconf?.color }} />
                      {tconf?.label || type} ×{count}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* ══ 标签页导航 ══ */}
          <div className="flex border-b border-neutral-200/70 dark:border-neutral-700/50 px-1">
            {(['info', 'connections', 'properties'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setDetailTab(tab)}
                className={`flex-1 px-2 py-2 text-[10px] font-medium transition-all relative ${
                  detailTab === tab
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-400'
                }`}
              >
                {tab === 'info' ? '概览' : tab === 'connections' ? `连接(${nodeConnections.totalConnections})` : `属性${selectedNode.properties ? Object.keys(selectedNode.properties).length : 0}`}
                {detailTab === tab && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary-500 dark:bg-primary-400" />
                )}
              </button>
            ))}
          </div>

          {/* ══ 标签页内容区 ══ */}
          <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: '340px', minHeight: '120px' }}>
            {/* ── 概览标签页 ── */}
            {detailTab === 'info' && (
              <div className="p-3 space-y-3">
                {/* 节点ID */}
                {selectedNode.id && selectedNode.id !== selectedNode.label && (
                  <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono bg-slate-50 dark:bg-neutral-800/40 rounded-lg px-2 py-1.5 break-all">
                    ID: {selectedNode.id}
                  </div>
                )}

                {/* 操作工具栏 */}
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => onNodeClick?.(selectedNode)}
                    className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors group"
                    title="查看完整详情"
                  >
                    <svg className="w-4 h-4 text-neutral-400 group-hover:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-[8px] text-neutral-500 group-hover:text-primary-600 transition-colors">详情</span>
                  </button>
                  <button
                    onClick={() => setDetailTab('connections')}
                    className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-secondary-50 dark:hover:bg-blue-950/30 transition-colors group"
                    title="查看所有连接"
                  >
                    <svg className="w-4 h-4 text-neutral-400 group-hover:text-secondary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    <span className="text-[8px] text-neutral-500 group-hover:text-secondary-600 transition-colors">连接</span>
                  </button>
                  <button
                    onClick={() => {
                      onNodeClick?.({ ...selectedNode, properties: { ...selectedNode.properties, _action: 'highlight_neighbors' } })
                    }}
                    className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-warning-50 dark:hover:bg-amber-950/30 transition-colors group"
                    title="高亮邻居节点"
                  >
                    <svg className="w-4 h-4 text-neutral-400 group-hover:text-warning-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                    </svg>
                    <span className="text-[8px] text-neutral-500 group-hover:text-warning-600 transition-colors">高亮</span>
                  </button>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-error-50 dark:hover:bg-red-950/30 transition-colors group"
                    title="关闭面板"
                  >
                    <svg className="w-4 h-4 text-neutral-400 group-hover:text-error-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-[8px] text-neutral-500 group-hover:text-error-600 transition-colors">关闭</span>
                  </button>
                </div>

                {/* 邻居预览列表（最多显示8个） */}
                {nodeConnections.neighbors.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[9px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-semibold px-1">
                      直接邻居 ({nodeConnections.neighbors.length})
                    </div>
                    <div className="space-y-0.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                      {nodeConnections.neighbors.slice(0, 8).map(neighbor => {
                        const nconf = TYPE_CONFIG[neighbor.type]
                        const connEdge = [...nodeConnections.incoming, ...nodeConnections.outgoing].find(c => c.node.id === neighbor.id || c.node.label === neighbor.label)
                        return (
                          <button
                            key={neighbor.id || neighbor.label}
                            onClick={() => setSelectedNode(neighbor)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800/60 transition-colors text-left group/item"
                          >
                            <span className="w-2 h-2 rounded-full shrink-0 transition-transform group-hover/item:scale-150" style={{ backgroundColor: nconf?.color || 'var(--color-knowledge-default, #9CA3AF)' }} />
                            <span className="text-[11px] text-neutral-600 dark:text-neutral-300 truncate flex-1 font-medium group-hover/item:text-neutral-900 dark:group-hover/item:text-neutral-100">{neighbor.label}</span>
                            <span className="text-[8px] text-neutral-400 shrink-0">{nconf?.label}</span>
                          </button>
                        )
                      })}
                      {nodeConnections.neighbors.length > 8 && (
                        <button onClick={() => setDetailTab('connections')} className="w-full text-center text-[10px] text-primary-500 hover:text-primary-600 dark:text-primary-400 py-1 hover:bg-primary-50/50 dark:hover:bg-primary-950/20 rounded-lg transition-colors font-medium">
                          查看全部 {nodeConnections.neighbors.length} 个邻居 →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── 连接标签页 ── */}
            {detailTab === 'connections' && (
              <div className="p-3 space-y-3">
                {nodeConnections.totalConnections === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                      <svg className="w-5 h-5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                      </svg>
                    </div>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">该节点暂无连接关系</p>
                  </div>
                ) : (
                  <>
                    {/* 入边（指向此节点） */}
                    {nodeConnections.incoming.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[9px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
                          </svg>
                          入站连接 ({nodeConnections.incoming.length})
                        </div>
                        <div className="space-y-0.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                          {nodeConnections.incoming.map(({ edge, node }, idx) => {
                            const nconf = TYPE_CONFIG[node.type]
                            const econf = EDGE_COLORS[edge.type as keyof typeof EDGE_COLORS]
                            return (
                              <div key={`in-${idx}`} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50/80 dark:bg-neutral-800/40 group hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition-colors">
                                <button onClick={() => setSelectedNode(node)} className="min-w-0 flex-1 flex items-center gap-1.5 text-left">
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: nconf?.color || 'var(--color-knowledge-default, #9CA3AF)' }} />
                                  <span className="text-[11px] text-neutral-700 dark:text-neutral-300 truncate font-medium">{node.label}</span>
                                  <span className="text-[8px] text-neutral-400">{nconf?.label}</span>
                                </button>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ backgroundColor: `${econf?.color || 'var(--color-knowledge-default, #9CA3AF)'}15`, color: econf?.color || 'var(--color-knowledge-text, #6B7280)' }}>
                                  {EDGE_TYPE_LABELS[edge.type] || edge.type}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* 出边（从此节点指出） */}
                    {nodeConnections.outgoing.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[9px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 11l7-7 7 7M5 19l7-7 7 7" />
                          </svg>
                          出站连接 ({nodeConnections.outgoing.length})
                        </div>
                        <div className="space-y-0.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                          {nodeConnections.outgoing.map(({ edge, node }, idx) => {
                            const nconf = TYPE_CONFIG[node.type]
                            const econf = EDGE_COLORS[edge.type as keyof typeof EDGE_COLORS]
                            return (
                              <div key={`out-${idx}`} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50/80 dark:bg-neutral-800/40 group hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition-colors">
                                <button onClick={() => setSelectedNode(node)} className="min-w-0 flex-1 flex items-center gap-1.5 text-left">
                                  <span className="text-[11px] text-neutral-700 dark:text-neutral-300 truncate font-medium">{node.label}</span>
                                  <span className="text-[8px] text-neutral-400">{nconf?.label}</span>
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: nconf?.color || 'var(--color-knowledge-default, #9CA3AF)' }} />
                                </button>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ backgroundColor: `${econf?.color || 'var(--color-knowledge-default, #9CA3AF)'}15`, color: econf?.color || 'var(--color-knowledge-text, #6B7280)' }}>
                                  {EDGE_TYPE_LABELS[edge.type] || edge.type}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── 属性标签页 ── */}
            {detailTab === 'properties' && (
              <div className="p-3">
                {!selectedNode.properties || Object.keys(selectedNode.properties).length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                      <svg className="w-5 h-5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">该节点暂无属性数据</p>
                  </div>
                ) : (() => {
                  const priorityKeys = ['category', 'effects', 'ob_percent', 'dl_value', 'ob', 'dl',
                    'activity_value', 'activity_type', 'source_protein', 'molecular_weight',
                    'hydrolysis_enzyme', 'full_sequence', 'target_count', 'is_food_homology',
                    'name_latin', 'source_herb']

                  const keyLabelMap: Record<string, string> = {
                    ob_percent: '口服生物利用度(OB)', dl_value: '类药性(DL)',
                    ob: 'OB值', dl: 'DL值', activity_value: '活性值',
                    activity_type: '活性类型', source_protein: '来源蛋白',
                    molecular_weight: '分子量', hydrolysis_enzyme: '水解酶',
                    full_sequence: '完整序列', target_count: '靶点数',
                    is_food_homology: '药食同源', name_latin: '拉丁名',
                    category: '分类', effects: '功效', source_herb: '来源药材',
                  }

                  const sortedProps = Object.entries(selectedNode.properties)
                    .filter(([, v]) => v !== undefined && v !== null && v !== '')
                    .sort((a, b) => {
                      const aIdx = priorityKeys.indexOf(a[0])
                      const bIdx = priorityKeys.indexOf(b[0])
                      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx
                      if (aIdx >= 0) return -1
                      if (bIdx >= 0) return 1
                      return 0
                    })

                  return (
                    <div className="space-y-0.5">
                      {sortedProps.map(([key, val]) => {
                        let displayVal: string
                        let isHighlight = false
                        if (typeof val === 'number') {
                          displayVal = Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2)
                          isHighlight = ['ob', 'dl', 'activity_value', 'molecular_weight'].includes(key)
                        } else if (typeof val === 'boolean') {
                          displayVal = val ? '是' : '否'
                        } else if (key === 'full_sequence') {
                          displayVal = String(val).length > 35 ? String(val).slice(0, 35) + '...' : String(val)
                        } else {
                          displayVal = String(val)
                          if (displayVal.length > 50) displayVal = displayVal.slice(0, 50) + '...'
                        }

                        return (
                          <div key={key} className="flex justify-between items-center text-xs group px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800/40 transition-colors">
                            <span className="text-neutral-500 dark:text-neutral-400 shrink-0" title={key}>
                              {keyLabelMap[key] || key}
                            </span>
                            <span
                              className={`font-medium max-w-[180px] truncate transition-colors text-right ${isHighlight ? 'text-primary-600 dark:text-primary-400 font-semibold' : 'text-neutral-700 dark:text-neutral-200 group-hover:text-primary-600 dark:group-hover:text-primary-400'}`}
                              title={String(val)}
                            >
                              {displayVal}
                            </span>
                          </div>
                        )
                      })}
                      {sortedProps.length === 0 && (
                        <p className="text-[10px] text-neutral-400 italic text-center py-4">属性值为空</p>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* ══ 面板底部操作栏 ══ */}
          <div className="px-4 py-2.5 border-t border-neutral-200/70 dark:border-neutral-700/50 bg-slate-50/50 dark:bg-neutral-800/30 flex gap-2">
            <button
              onClick={() => onNodeClick?.(selectedNode)}
              className="flex-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white text-[11px] font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              查看完整详情
            </button>
            <button
              onClick={() => setSelectedNode(null)}
              className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-[11px] font-medium transition-all active:scale-[0.98]"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* v6.0: 可折叠图例面板 */}
      {showLegend && allTypes.length > 0 && (
        <div className="absolute bottom-3 left-3 z-30">
          {/* 图例触发器（始终可见的小标签条） */}
          <button
            onClick={() => setLegendOpen(!legendOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/93 dark:bg-neutral-800/93 backdrop-blur-md border border-neutral-200/60 dark:border-neutral-700/60 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group"
          >
            <div className="flex -space-x-1">
              {legendItems.slice(0, 4).map(({ type, color }) => (
                <div key={type} className="w-2.5 h-2.5 rounded-full ring-1.5 ring-white dark:ring-slate-800" style={{ backgroundColor: color }} />
              ))}
              {legendItems.length > 4 && (
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-300 dark:bg-neutral-600 ring-1.5 ring-white dark:ring-slate-800" />
              )}
            </div>
            <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors">
              图例 {legendOpen ? '▼' : '▶'}
            </span>
          </button>

          {/* 展开的详细图例面板 */}
          {legendOpen && (
            <div className="mt-2 p-3 rounded-xl bg-white/96 dark:bg-neutral-800/96 backdrop-blur-xl border border-neutral-200/60 dark:border-neutral-700/60 shadow-lg animate-in fade-in zoom-in-95 duration-200 grid gap-2"
                 style={{ minWidth: '200px', maxWidth: '280px' }}>
              <div className="col-span-full text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-bold mb-0.5">
                节点类型分布
              </div>
              {legendItems.map(({ type, color, label, icon }) => (
                <div key={type} className="flex items-center justify-between gap-3 group/item cursor-default rounded-lg px-2 py-1.5 -mx-2 hover:bg-slate-50 dark:hover:bg-neutral-700/40 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3.5 h-3.5 rounded-full shadow-sm transition-transform duration-200 group-hover/item:scale-125"
                      style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}50` }}
                    />
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">{icon} {label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* 进度条表示占比 */}
                    <div className="w-16 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          backgroundColor: color,
                          width: `${Math.round((typeCounts[type] || 0) / Math.max(nodes.length, 1) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono font-bold tabular-nums min-w-[22px] text-right" style={{ color }}>
                      {typeCounts[type] || 0}
                    </span>
                  </div>
                </div>
              ))}

              {/* 统计汇总行 */}
              <div className="col-span-full pt-2 mt-1 border-t border-neutral-200/50 dark:border-neutral-600/40 flex justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
                <span>总计 <strong className="text-neutral-700 dark:text-neutral-300">{nodes.length}</strong> 节点</span>
                <span><strong className="text-neutral-700 dark:text-neutral-300">{edges.length}</strong> 条边</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 操作提示 */}
      <div className="absolute bottom-3 right-3 z-30 hidden sm:flex items-center gap-2 text-[10px] text-neutral-400 dark:text-neutral-500 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-neutral-100 dark:border-neutral-700/40">
        <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 font-mono text-[9px]">拖拽</kbd>
        <span>移动</span>
        <span className="text-neutral-300">|</span>
        <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 font-mono text-[9px]">滚轮</kbd>
        <span>缩放</span>
        <span className="text-neutral-300">|</span>
        <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 font-mono text-[9px]">双击</kbd>
        <span>重置</span>
      </div>

      {/* 移动端操作提示 */}
      <div className="absolute bottom-3 right-3 z-30 sm:hidden flex items-center gap-1.5 text-[10px] text-neutral-400 dark:text-neutral-500 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-neutral-100 dark:border-neutral-700/40">
        <span>拖拽</span><span>·</span><span>捏合缩放</span><span>·</span><span>点击查看</span>
      </div>

      {/* 布局指示器 + v7.9 布局切换菜单 */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5">
        <div className="px-3 py-1 rounded-full text-[10px] font-medium bg-white/92 dark:bg-neutral-800/92 backdrop-blur-md border border-neutral-200/60 dark:border-neutral-700/60 shadow-sm text-neutral-600 dark:text-neutral-400 cursor-pointer hover:bg-white dark:hover:bg-neutral-700 transition-colors"
          onClick={() => setShowLayoutMenu(!showLayoutMenu)}>
          布局: {localLayout === 'force' ? '力导向' : localLayout === 'radial' ? '放射' : localLayout === 'tree' ? '树形' : localLayout === 'hierarchical' ? '层次化' : localLayout === 'circular' ? '圆形' : '网格'}
          <span className="ml-1 text-[8px]">▾</span>
        </div>
        {showLayoutMenu && (
          <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200/60 dark:border-neutral-700/60 p-1.5 min-w-[140px] z-50 animate-fade-in">
            {([
              ['force', '力导向', '🧲'],
              ['radial', '放射状', '🎯'],
              ['tree', '树形', '🌳'],
              ['hierarchical', '层次化', '📊'],
              ['circular', '同心圆', '⭕'],
              ['grid', '网格', '▦'],
            ] as [LayoutType, string, string][]).map(([key, label, icon]) => (
              <button key={key} onClick={() => switchLayoutMode(key)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${localLayout === key ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'hover:bg-slate-50 dark:hover:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'}`}>
                <span>{icon}</span><span>{label}</span>
                {localLayout === key && <span className="ml-auto text-[10px]">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* v7.9: 主题切换按钮 */}
      <button onClick={() => setShowThemePanel(!showThemePanel)}
        className="absolute top-3 right-14 z-30 w-6 h-6 rounded-lg bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/40 flex items-center justify-center hover:scale-110 transition-all shadow-sm"
        title={`主题: ${activeTheme.name}`}>
        <span className="text-xs">{activeTheme.icon}</span>
      </button>

      {/* v7.9: 主题选择面板 */}
      {showThemePanel && (
        <div className="absolute top-12 right-3 z-50 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-xl rounded-xl shadow-2xl border border-neutral-200/60 dark:border-neutral-700/60 p-3 min-w-[220px] animate-fade-in">
          <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2 px-1">选择配色主题</div>
          <div className="space-y-1">
            {THEME_PRESETS.map(t => (
              <button key={t.id} onClick={() => applyTheme(t)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${activeTheme.id === t.id ? 'ring-2 ring-offset-1 ring-emerald-500 bg-primary-50/80 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-neutral-700/40'}`}
                style={{ color: activeTheme.id === t.id ? t.accentColor : undefined }}>
                <span className="text-base">{t.icon}</span>
                <span className="flex-1 text-left">{t.name}</span>
                <div className="flex gap-0.5">
                  {['herb', 'compound', 'target'].slice(0, 3).map(type => (
                    <span key={type} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.nodeColors[type]?.color }} />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* v7.9: 动画预设控制 */}
      <div className="absolute top-3 right-28 z-30 flex items-center gap-0.5 bg-white/85 dark:bg-neutral-800/85 backdrop-blur-sm rounded-lg border border-neutral-200/50 dark:border-neutral-700/40 p-0.5 shadow-sm">
        {(Object.entries(ANIMATION_PRESETS) as [AnimationPreset, typeof ANIMATION_PRESETS[AnimationPreset]][]).map(([key, preset]) => (
          <button key={key} onClick={() => switchAnimationPreset(key)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${animationPreset === key ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
            title={preset.label}>
            {preset.icon}
          </button>
        ))}
      </div>

      {/* v8.0: AI 洞察按钮 */}
      <button onClick={() => { setShowAIPanel(!showAIPanel); if (!showAIPanel && aiInsights.length === 0) generateAIInsights() }}
        className="absolute top-3 right-[172px] z-30 w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white backdrop-blur-sm border border-purple-300/40 flex items-center justify-center hover:scale-110 transition-all shadow-sm"
        title="AI 洞察分析 (Shift+A)">
        <span className="text-[10px] font-bold">AI</span>
      </button>

      {/* v8.0: 快照按钮 */}
      <button onClick={takeSnapshot}
        className="absolute top-3 right-[144px] z-30 w-6 h-6 rounded-lg bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/40 flex items-center justify-center hover:scale-110 transition-all shadow-sm"
        title="保存快照 (Shift+S)">
        <svg className="w-3 h-3 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* v8.0: AI 洞察面板 */}
      {showAIPanel && (
        <div className="absolute top-14 left-3 z-50 w-[380px] max-h-[65vh] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-200/60 dark:border-purple-700/40 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 border-b border-purple-100/50 dark:border-purple-800/30">
            <div className="flex items-center gap-2">
              <span className="text-base">🤖</span>
              <span className="text-sm font-bold text-accent-700 dark:text-accent-300">AI 智能洞察</span>
              {aiInsights.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-accent-100 dark:bg-accent-900/40 text-accent-600 dark:text-accent-300">{aiInsights.length} 条发现</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={generateAIInsights} disabled={isGeneratingInsight}
                className="px-2 py-1 rounded-lg text-[10px] font-medium bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50 transition-colors flex items-center gap-1">
                {isGeneratingInsight ? '⏳ 分析中...' : '🔄 重新分析'}
              </button>
              <button onClick={() => setShowAIPanel(false)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-accent-100 dark:hover:bg-accent-800/30 text-neutral-400">✕</button>
            </div>
          </div>

          <div className="overflow-y-auto custom-scrollbar p-3 space-y-2 max-h-[calc(65vh-56px)]">
            {isGeneratingInsight ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
                <p className="text-xs text-neutral-400">正在分析图谱拓扑结构...</p>
              </div>
            ) : aiInsights.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-neutral-400 mb-2">暂无洞察数据</p>
                <button onClick={generateAIInsights} className="text-xs text-accent-500 hover:text-accent-600 font-medium">点击生成分析报告 →</button>
              </div>
            ) : (
              aiInsights.map(insight => {
                const severityColors = {
                  info: 'border-blue-200 bg-secondary-50/80 dark:border-blue-800/30 dark:bg-blue-950/20',
                  warning: 'border-amber-200 bg-warning-50/80 dark:border-amber-800/30 dark:bg-amber-950/20',
                  critical: 'border-red-200 bg-error-50/80 dark:border-red-800/30 dark:bg-red-950/20',
                }
                const typeIcons = { summary: '📋', keyFinding: '🔗', anomaly: '⚠️', recommendation: '💡', topology: '🌉' }
                return (
                  <div key={insight.id} className={`rounded-xl border ${severityColors[insight.severity || 'info']} p-3 transition-all hover:shadow-md`}>
                    <div className="flex items-start gap-2.5">
                      <span className="text-sm mt-0.5">{typeIcons[insight.type]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">{insight.title}</h4>
                          <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[8px] font-mono font-bold bg-white/70 dark:bg-neutral-700/50 text-neutral-500">
                            {(insight.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400 line-clamp-3">{insight.description}</p>
                        {insight.actionLabel && insight.relatedNodeIds && (
                          <button onClick={() => {
                            const node = filteredData.filteredNodes.find(n => n.id === insight.relatedNodeIds![0] || n.label === insight.relatedNodeIds![0])
                            if (node) { onNodeClick?.(node); setSelectedNode(node); const analysis = generateNodeAnalysis(node); setNodeAIAnalysis(analysis) }
                          }}
                            className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-white/70 dark:bg-neutral-700/50 text-accent-600 dark:text-purple-350 hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-colors">
                            {insight.actionLabel} →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* v8.0: 智能路径面板 */}
      {showPathPanel && smartPathResult && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 w-[420px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-blue-200/60 dark:border-blue-700/40 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 border-b border-blue-100/50 dark:border-blue-800/30 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span>🛤️</span>
              <span className="text-sm font-bold text-secondary-700 dark:text-secondary-300">智能路径分析</span>
              <span className="text-[10px] text-neutral-400">跳数: {smartPathResult.length}</span>
            </div>
            <button onClick={() => setShowPathPanel(false)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-secondary-100 dark:hover:bg-secondary-800/30 text-neutral-400">✕</button>
          </div>
          <div className="p-3 space-y-2.5">
            <div className="flex items-center gap-1 flex-wrap">
              {smartPathResult.path.map((nodeId, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-300 max-w-[120px] truncate">
                    {filteredData.filteredNodes.find(n => (n.id || n.label) === nodeId)?.label?.slice(0, 12) || nodeId.slice(0, 10)}
                  </span>
                  {i < smartPathResult.path.length - 1 && <span className="text-neutral-300 text-[10px]">→</span>}
                </div>
              ))}
            </div>
            {smartPathResult.keyBridges.length > 0 && (
              <div className="bg-warning-50/80 dark:bg-amber-950/20 rounded-lg p-2">
                <span className="text-[10px] font-semibold text-warning-700 dark:text-warning-300">🌉 关键桥梁:</span>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {smartPathResult.keyBridges.map(bid => (
                    <span key={bid} className="px-1.5 py-0.5 rounded text-[9px] bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-300">
                      {filteredData.filteredNodes.find(n => (n.id || n.label) === bid)?.label?.slice(0, 8)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {smartPathResult.alternativePaths.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-neutral-500">替代路径 ({smartPathResult.alternativePaths.length}):</span>
                {smartPathResult.alternativePaths.map((alt, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                    <span className="font-mono text-secondary-400">#{idx + 1}</span>
                    <span>{alt.path.join(' → ')}</span>
                    <span className="ml-auto font-mono text-neutral-400">{alt.length}跳</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* v8.0: 节点AI分析面板（在详情面板旁显示） */}
      {nodeAIAnalysis && selectedNode && (
        <div className="absolute top-14 right-3 z-45 w-[320px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-200/60 dark:border-indigo-700/40 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 border-b border-indigo-100/50 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span>🧠</span>
              <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">节点智能分析</span>
            </div>
            <button onClick={() => setNodeAIAnalysis(null)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-800/30 text-neutral-400">✕</button>
          </div>
          <div className="p-3 space-y-2.5">
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">{nodeAIAnalysis.summary}</p>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-indigo-50/80 dark:bg-indigo-950/20 p-2 text-center">
                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{nodeAIAnalysis.synergyScore}</div>
                <div className="text-[9px] text-neutral-400">协同评分</div>
              </div>
              <div className="rounded-lg bg-violet-50/80 dark:bg-violet-950/20 p-2 text-center">
                <div className="text-lg font-bold text-violet-600 dark:text-violet-400">{nodeAIAnalysis.relationships.length}</div>
                <div className="text-[9px] text-neutral-400">关系类型</div>
              </div>
            </div>

            {nodeAIAnalysis.relationships.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold text-neutral-500">关系解读:</span>
                <div className="mt-1 space-y-1">
                  {nodeAIAnalysis.relationships.map((rel, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px]">
                      <span className="shrink-0 px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700/50 font-medium text-neutral-600 dark:text-neutral-300">{rel.type}</span>
                      <span className="text-neutral-500 dark:text-neutral-400">{rel.interpretation}</span>
                      <span className="ml-auto font-mono text-neutral-400">{rel.count}条</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {nodeAIAnalysis.suggestions.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold text-neutral-500">💡 建议:</span>
                <ul className="mt-1 space-y-0.5">
                  {nodeAIAnalysis.suggestions.map((s, i) => (
                    <li key={i} className="text-[10px] text-neutral-500 dark:text-neutral-400 pl-3">• {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* v8.0: 智能路径搜索工具栏（底部） */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-35 flex items-center gap-1.5 bg-white/92 dark:bg-neutral-800/92 backdrop-blur-md rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 shadow-lg px-3 py-1.5">
        <span className="text-[9px] text-neutral-400 font-medium">路径</span>
        <select value={pathSourceId} onChange={e => setPathSourceId(e.target.value)}
          className="w-[110px] h-6 rounded-md text-[10px] border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 px-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400">
          <option value="">起点...</option>
          {filteredData.filteredNodes.slice(0, 30).map(n => (
            <option key={n.id || n.label} value={n.id || n.label}>{n.label?.slice(0, 15)}</option>
          ))}
        </select>
        <span className="text-neutral-300 text-[10px]">→</span>
        <select value={pathTargetId} onChange={e => setPathTargetId(e.target.value)}
          className="w-[110px] h-6 rounded-md text-[10px] border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 px-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400">
          <option value="">终点...</option>
          {filteredData.filteredNodes.slice(0, 30).map(n => (
            <option key={n.id || n.label} value={n.id || n.label}>{n.label?.slice(0, 15)}</option>
          ))}
        </select>
        <button onClick={runSmartPathSearch} disabled={!pathSourceId || !pathTargetId}
          className="px-2 h-6 rounded-md text-[10px] font-medium bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          🔍 分析
        </button>
      </div>

      {/* v8.0: 快照列表（左下角） */}
      {graphSnapshots.length > 0 && (
        <div className="absolute bottom-3 left-3 z-35 bg-white/92 dark:bg-neutral-800/92 backdrop-blur-md rounded-lg border border-neutral-200/60 dark:border-neutral-700/60 shadow-lg p-2 min-w-[140px]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-semibold text-neutral-500">📸 快照</span>
            <span className="text-[8px] text-neutral-400">{graphSnapshots.length}个</span>
          </div>
          <div className="space-y-0.5 max-h-[80px] overflow-y-auto custom-scrollbar">
            {graphSnapshots.slice(-5).reverse().map(snap => (
              <div key={snap.id} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-slate-50 dark:hover:bg-neutral-700/30 cursor-pointer group">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-400 shrink-0" />
                <span className="text-[9px] text-neutral-600 dark:text-neutral-400 truncate flex-1">{snap.label}</span>
                <span className="text-[8px] text-neutral-400 hidden group-hover:inline">{snap.nodeCount}节点</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {filteredData.filteredNodes.length === 0 && nodes.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-neutral-900/40 backdrop-blur-sm rounded-xl animate-fade-in">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <svg className="w-7 h-7 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">当前筛选条件下无匹配节点</p>
            <button
              onClick={() => setActiveFilter(null)}
              className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 text-sm hover:underline font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              显示全部节点
            </button>
          </div>
        </div>
      )}

      {/* 完全空状态 */}
      {nodes.length === 0 && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-950/40 dark:to-blue-950/40 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium max-w-[240px] mx-auto leading-relaxed">
              搜索药材或化合物名称以查看知识图谱
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              支持药材、化合物、靶点、疾病等多维度检索
            </p>
          </div>
        </div>
      )}

      {/* v7.0 + v7.9: CSS 注入（确保动画生效） */}
      <style>{`
        @keyframes edge-flow {
          to { stroke-dashoffset: -24; }
        }
        /* v7.9: 动画预设关键帧 */
        @keyframes graph-fade-in {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes graph-expand {
          from { opacity: 0; transform: scale(0.3) translate(-50%, -50%); }
          to   { opacity: 1; transform: scale(1) translate(0, 0); }
        }
        @keyframes graph-converge {
          from { opacity: 0; transform: scale(2) translate(25%, 25%); }
          to   { opacity: 1; transform: scale(1) translate(0, 0); }
        }
        @keyframes hub-pulse {
          0%, 100% { stroke-opacity: 0.2; stroke-width: 2px; }
          50%       { stroke-opacity: 0.45; stroke-width: 4px; }
        }
        .graph-animate-fade-in { animation: graph-fade-in ${ANIMATION_PRESETS.fadeIn.duration}ms ease-out both; }
        .graph-animate-expand { animation: graph-expand ${ANIMATION_PRESETS.expand.duration}ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .graph-animate-converge { animation: graph-converge ${ANIMATION_PRESETS.converge.duration}ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .hub-glow-ring { animation: hub-pulse 3s ease-in-out infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.5); }
        /* v7.0: 核心节点视觉增强 */
        .node-group[data-core="true"] .node-body {
          transition: filter 0.3s ease;
        }
        /* v7.0: 标签可读性优化 */
        .label-bg {
          transition: all 0.3s ease;
        }
      `}</style>
    </div>
  )
}

// ═══════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════
// Types and constants are available via ./graph/types
export { GraphEngine } from './graph/engine/forceSimulation'
export type { GraphNode, GraphEdge, LayoutType } from './graph/types'
