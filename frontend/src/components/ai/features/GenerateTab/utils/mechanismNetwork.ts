/**
 * mechanismNetwork - 机理网络药理聚合（纯逻辑，无副作用，可单测）
 *
 * @description 把 candidate.mechanism.mechanisms（逐药材 compounds→targets）聚合为
 *              网络药理视图数据：药材-靶点二部关系、靶点频次、**共享靶点**（被 ≥2 味
 *              药材调控 = 配伍协同/多药理学的物质基础）。供 MechanismNetworkPanel 可视化。
 * @version 1.0.0
 */

export interface MechanismHerbEntry {
  herb?: string
  compounds?: string[]
  targets?: string[]
  effects?: string
  note?: string
}

export interface HerbNode {
  name: string
  compoundCount: number
  targetCount: number
  compounds: string[]
  targets: string[]
}

export interface TargetNode {
  name: string
  /** 调控该靶点的药材数（≥2 = 共享靶点） */
  herbCount: number
  /** 调控该靶点的药材名 */
  herbs: string[]
  /** 是否共享靶点（≥2 味药材命中，配伍协同物质基础） */
  isShared: boolean
}

export interface MechanismNetwork {
  herbs: HerbNode[]
  targets: TargetNode[]
  /** 药材→靶点边（去重） */
  edges: Array<{ herb: string; target: string }>
  /** 共享靶点（≥2 味药材），按 herbCount 降序 */
  sharedTargets: TargetNode[]
  /** 统计摘要 */
  stats: {
    herbCount: number
    targetCount: number
    edgeCount: number
    sharedTargetCount: number
    /** 靶点被多少味药材命中的分布（用于可视化着色） */
    maxHerbsPerTarget: number
  }
}

/** 规范化名称（去空白，过滤空） */
function norm(s: string | undefined): string {
  return (s || '').trim()
}

/**
 * 构建机理网络药理数据。
 * @param mechanisms candidate.mechanism.mechanisms（逐药材条目）
 * @param minHerbsForShared 共享靶点阈值（默认 2：≥2 味药材命中即视为共享/协同）
 */
export function buildMechanismNetwork(
  mechanisms: MechanismHerbEntry[] | undefined,
  minHerbsForShared = 2,
): MechanismNetwork {
  const entries = Array.isArray(mechanisms) ? mechanisms : []

  // 药材节点（去重，聚合其 compounds/targets）
  const herbMap = new Map<string, { compounds: Set<string>; targets: Set<string> }>()
  // 靶点 → 命中它的药材集合
  const targetHerbs = new Map<string, Set<string>>()
  // 边（去重）
  const edgeSet = new Set<string>()

  for (const entry of entries) {
    const herb = norm(entry.herb)
    if (!herb) continue
    if (!herbMap.has(herb)) herbMap.set(herb, { compounds: new Set(), targets: new Set() })
    const hn = herbMap.get(herb)!

    for (const c of entry.compounds || []) {
      const cn = norm(c)
      if (cn) hn.compounds.add(cn)
    }
    for (const tg of entry.targets || []) {
      const tn = norm(tg)
      if (!tn) continue
      hn.targets.add(tn)
      if (!targetHerbs.has(tn)) targetHerbs.set(tn, new Set())
      targetHerbs.get(tn)!.add(herb)
      edgeSet.add(`${herb}\u0000${tn}`)
    }
  }

  const herbs: HerbNode[] = Array.from(herbMap.entries()).map(([name, d]) => ({
    name,
    compoundCount: d.compounds.size,
    targetCount: d.targets.size,
    compounds: Array.from(d.compounds).sort((a, b) => a.localeCompare(b)),
    targets: Array.from(d.targets).sort((a, b) => a.localeCompare(b)),
  }))
  herbs.sort((a, b) => b.targetCount - a.targetCount || a.name.localeCompare(b.name))

  const maxHerbsPerTarget = Math.max(0, ...Array.from(targetHerbs.values()).map((s) => s.size))

  const targets: TargetNode[] = Array.from(targetHerbs.entries()).map(([name, herbSet]) => {
    const herbArr = Array.from(herbSet)
    return {
      name,
      herbCount: herbArr.length,
      herbs: herbArr.sort((a, b) => a.localeCompare(b)),
      isShared: herbArr.length >= minHerbsForShared,
    }
  })
  // 共享靶点优先，再按命中药材数降序
  targets.sort((a, b) => b.herbCount - a.herbCount || a.name.localeCompare(b.name))

  const sharedTargets = targets.filter((t) => t.isShared)

  const edges = Array.from(edgeSet).map((k) => {
    const [herb, target] = k.split('\u0000')
    return { herb, target }
  })

  return {
    herbs,
    targets,
    edges,
    sharedTargets,
    stats: {
      herbCount: herbs.length,
      targetCount: targets.length,
      edgeCount: edges.length,
      sharedTargetCount: sharedTargets.length,
      maxHerbsPerTarget,
    },
  }
}
