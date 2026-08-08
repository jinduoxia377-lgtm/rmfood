/** Barrel exports for the graph module */

export type { GraphNode, GraphEdge, SimNode, SimEdge, LayoutType, ThemeConfig } from './types'
export {
  TYPE_CONFIG, DEFAULT_TYPE, TYPE_ORDER, EDGE_COLORS, EDGE_TYPE_LABELS,
  PERF_THRESHOLD, THEME_PRESETS,
  getTypeConf, getDensityScale, calcNodeRadius, isCoreNode,
  calcInitialPosition, curvedLinkPath, calcEdgeWidth,
} from './types'

// Analytics
export * as analytics from './analytics'
export { detectCommunities, generateCommunityColors, computeCentrality,
  computeDegreeStats, computeLegendData, findPathBFS, findSmartPath } from './analytics'
export type { CommunityResult, CentralityResult, GraphStats, DegreeStats, LegendData, SmartPathResult } from './analytics'
