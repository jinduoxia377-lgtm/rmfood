/**
 * mechanismNetwork 单元测试 - 机理网络药理聚合
 */
import { buildMechanismNetwork } from '../mechanismNetwork'
import type { MechanismHerbEntry } from '../mechanismNetwork'

describe('buildMechanismNetwork', () => {
  const sample: MechanismHerbEntry[] = [
    {
      herb: '黄芪',
      compounds: ['黄芪多糖', '黄芪甲苷'],
      targets: ['IL-6', 'NF-κB', 'TNF-α'],
    },
    {
      herb: '党参',
      compounds: ['党参多糖'],
      targets: ['IL-6', 'COX-2'],
    },
    {
      herb: '茯苓',
      compounds: ['茯苓多糖', '茯苓酸'],
      targets: ['NF-κB'],
    },
  ]

  it('聚合药材节点（化合物数/靶点数）', () => {
    const net = buildMechanismNetwork(sample)
    expect(net.stats.herbCount).toBe(3)
    const huangqi = net.herbs.find((h) => h.name === '黄芪')
    expect(huangqi?.compoundCount).toBe(2)
    expect(huangqi?.targetCount).toBe(3)
  })

  it('靶点按命中药材数降序，统计靶点总数', () => {
    const net = buildMechanismNetwork(sample)
    expect(net.stats.targetCount).toBe(4) // IL-6, NF-κB, TNF-α, COX-2
    // NF-κB 被 黄芪+茯苓=2味命中；IL-6 被 黄芪+党参=2味
    expect(net.targets[0].herbCount).toBeGreaterThanOrEqual(net.targets[1].herbCount)
  })

  it('识别共享靶点（≥2 味药材命中=协同物质基础）', () => {
    const net = buildMechanismNetwork(sample)
    expect(net.stats.sharedTargetCount).toBe(2) // IL-6, NF-κB
    const names = net.sharedTargets.map((t) => t.name)
    expect(names).toContain('IL-6')
    expect(names).toContain('NF-κB')
    expect(names).not.toContain('TNF-α') // 仅黄芪命中
    const nfkb = net.sharedTargets.find((t) => t.name === 'NF-κB')
    expect(nfkb?.herbs).toEqual(expect.arrayContaining(['黄芪', '茯苓']))
    expect(nfkb?.isShared).toBe(true)
  })

  it('边去重（同药材同靶点只算一次）', () => {
    const dup: MechanismHerbEntry[] = [
      { herb: '黄芪', targets: ['IL-6', 'IL-6'] },
    ]
    const net = buildMechanismNetwork(dup)
    expect(net.stats.edgeCount).toBe(1)
    const huangqi = net.herbs.find((h) => h.name === '黄芪')
    expect(huangqi?.targetCount).toBe(1)
  })

  it('空/undefined 输入返回空网络不报错', () => {
    const empty = buildMechanismNetwork(undefined)
    expect(empty.stats.herbCount).toBe(0)
    expect(empty.stats.sharedTargetCount).toBe(0)
    expect(empty.herbs).toEqual([])
    expect(empty.targets).toEqual([])
  })

  it('全部单味命中时无共享靶点', () => {
    const single: MechanismHerbEntry[] = [
      { herb: 'A', targets: ['T1'] },
      { herb: 'B', targets: ['T2'] },
    ]
    const net = buildMechanismNetwork(single)
    expect(net.stats.sharedTargetCount).toBe(0)
  })

  it('maxHerbsPerTarget 反映最高命中数', () => {
    const net = buildMechanismNetwork(sample)
    expect(net.stats.maxHerbsPerTarget).toBe(2)
  })
})
