/**
 * extractStructuredFallback 结构化渲染兜底测试（task-20）
 *
 * 覆盖：
 * - ```json 代码块包裹的 blocks JSON → 成功提取
 * - 无代码块但有前后说明文字的 JSON → 扫描提取成功
 * - 未知 block type 被过滤，仅保留合法块
 * - 非 JSON / 无 blocks → null
 */
import { describe, it, expect } from 'vitest'
import { extractStructuredFallback, repairTruncatedJson } from '@/components/ai/features/components/structured/utils'

const validBlocksJson = JSON.stringify({
  responseType: 'recommendation',
  title: '测试配方',
  blocks: [
    { type: 'header', data: { title: '测试配方', level: 1 } },
    { type: 'data-table', data: { title: '配方组成', columns: [], rows: [] } },
    { type: 'timeline', data: { title: '服用周期', duration_days: 28, phases: [], items: [] } },
  ],
})

describe('extractStructuredFallback', () => {
  it('从 ```json 代码块中提取 blocks JSON', () => {
    const content = '```json\n' + validBlocksJson + '\n```\n以上是配方。'
    const result = extractStructuredFallback(content)
    expect(result).not.toBeNull()
    expect(result!.blocks.length).toBe(3)
    expect(result!.title).toBe('测试配方')
  })

  it('无代码块但有前后说明文字时扫描提取', () => {
    const content = '根据您的需求，推荐以下配方：\n' + validBlocksJson + '\n（请遵医嘱）'
    const result = extractStructuredFallback(content)
    expect(result).not.toBeNull()
    expect(result!.blocks.length).toBe(3)
  })

  it('过滤未知 block type，仅保留合法块', () => {
    const content = JSON.stringify({
      blocks: [
        { type: 'header', data: { title: '配方' } },
        { type: 'unknown-block', data: {} },
        { type: 'metrics', data: { items: [] } },
      ],
    })
    const result = extractStructuredFallback(content)
    expect(result).not.toBeNull()
    expect(result!.blocks.length).toBe(2)
    expect(result!.blocks.every((b: any) => !['unknown-block'].includes(b.type))).toBe(true)
  })

  it('非 JSON 内容返回 null', () => {
    expect(extractStructuredFallback('纯文本内容，没有 blocks')).toBeNull()
    expect(extractStructuredFallback('')).toBeNull()
    expect(extractStructuredFallback(null as unknown as string)).toBeNull()
  })

  it('JSON 无 blocks 数组返回 null', () => {
    expect(extractStructuredFallback('{"foo":"bar"}')).toBeNull()
  })

  it('旧格式配方 JSON（英文键 product_name/ingredients）自动转换为 blocks', () => {
    const legacy = JSON.stringify({
      product_name: '经典补气基础方',
      target_health_goals: ['血糖管理', '增强免疫'],
      formula_rationale: '益气养阴，辅助调节代谢',
      ingredients: [
        { role: '君', name: '黄芪', dosage: '10g', rationale: '补气升阳' },
        { role: '臣', name: '西洋参', dosage: '3g', rationale: '益气养阴' },
      ],
      preparation_instructions: '加水煎煮30分钟；每日一次',
      contraindications_and_warnings: ['孕妇慎用'],
      regulatory_compliance: '药食同源',
    })
    const result = extractStructuredFallback(legacy)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('经典补气基础方')
    expect(result!.blocks.length).toBeGreaterThanOrEqual(3)
    const header = result!.blocks.find((b: any) => b.type === 'header')
    expect(header).toBeDefined()
    const table = result!.blocks.find((b: any) => b.type === 'data-table')
    expect(table).toBeDefined()
    expect((table as any).data.rows.length).toBe(2)
  })

  it('旧格式配方 JSON（中文键）仍可转换', () => {
    const legacy = JSON.stringify({
      配方名称: '稳糖饮',
      配方组分: [{ 角色: '君', 原料: '苦瓜多肽', 剂量: '500mg', 依据: '降糖' }],
      安全与禁忌: ['1型糖尿病禁用'],
    })
    const result = extractStructuredFallback(legacy)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('稳糖饮')
    expect(result!.blocks.some((b: any) => b.type === 'data-table')).toBe(true)
  })

  it('识别「主配方_单人份_500ml水」键并生成配方组成表（字符串配料表）', () => {
    const legacy = JSON.stringify({
      配方名称: '玉泉生津·稳糖饮',
      核心目标: '辅助平稳血糖',
      适用人群: '2型糖尿病前期人群',
      主配方_单人份_500ml水: '黄芪 5g\n西洋参 1g\n葛根 8g\n罗汉果甜苷 0.1g',
      制备工艺: '沸水冲泡15分钟；每日1-2次',
      禁忌排除说明: ['孕妇慎用'],
      每日用量上限校验: '每日不超过1份',
      特殊人群提示: '孕妇慎用',
      口感与稳定性说明: '低甜度',
    })
    const result = extractStructuredFallback(legacy)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('玉泉生津·稳糖饮')
    // 配方组成表存在，且包含黄芪/西洋参
    const table = result!.blocks.find((b: any) => b.type === 'data-table')
    expect(table).toBeDefined()
    const rows = (table as any).data.rows as Array<{ name: string; dosage: string }>
    expect(rows.length).toBeGreaterThanOrEqual(4)
    expect(rows.some(r => r.name === '黄芪' && r.dosage === '5g')).toBe(true)
    expect(rows.some(r => r.name === '罗汉果甜苷')).toBe(true)
    // 安全/每日上限/特殊人群均生成 callout
    const callouts = result!.blocks.filter((b: any) => b.type === 'callout')
    expect(callouts.length).toBeGreaterThanOrEqual(3)
  })

  it('识别「配方成分/健康目标/核心原理/制备方法/注意事项与禁忌/安全依据」键并完整渲染', () => {
    const legacy = JSON.stringify({
      配方名称: '稳糖清心·桑菊饮（改良版）',
      适用人群: '高血糖人群、胰岛素抵抗者',
      健康目标: ['血糖管理', '肝脏养护', '抗氧化'],
      核心原理: '桑叶DNJ抑制α-葡萄糖苷酶',
      配方成分: '桑叶 6g\n菊花 4g\n山楂 5g\n罗汉果甜苷 0.1g',
      冲突说明: '脾胃虚寒者减量',
      制备方法: '沸水冲泡；每日1-2次',
      注意事项与禁忌: ['孕妇慎用', '低血糖患者慎用'],
      安全依据: '药食同源目录',
    })
    const result = extractStructuredFallback(legacy)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('稳糖清心·桑菊饮（改良版）')
    const table = result!.blocks.find((b: any) => b.type === 'data-table')
    expect(table).toBeDefined()
    const rows = (table as any).data.rows as Array<{ name: string; dosage: string }>
    expect(rows.length).toBeGreaterThanOrEqual(4)
    expect(rows.some(r => r.name === '桑叶')).toBe(true)
    // 制备方法 list + 安全/冲突 callout + 合规 callout（安全依据）
    expect(result!.blocks.some((b: any) => b.type === 'list')).toBe(true)
    const callouts = result!.blocks.filter((b: any) => b.type === 'callout')
    expect(callouts.length).toBeGreaterThanOrEqual(2)
  })
})

describe('repairTruncatedJson', () => {
  it('补全被截断的未闭合 ```json 代码块（模拟 id=811 中断场景）', () => {
    const truncated = [
      '```json',
      '{',
      '  "responseType": "recommendation",',
      '  "title": "测试配方",',
      '  "blocks": [',
      '    {"type": "header", "data": {"title": "测试配方", "level": 1}},',
      '    {"type": "data-table", "data": {"title": "配方组成", "columns": [], "rows": []}},',
      '    {"type": "ingredient-detail", "data": {"name": "葛根", "source": "豆科植物野葛的干燥根", "properties": "甘、辛，凉", "efficacy": "解肌退热、生津止渴、升阳',
      '',
    ].join('\n')
    const repaired = repairTruncatedJson(truncated)
    expect(repaired).not.toBeNull()
    expect(repaired!.trim().endsWith('```')).toBe(true)
    const result = extractStructuredFallback(repaired!)
    expect(result).not.toBeNull()
    expect(result!.blocks.length).toBeGreaterThanOrEqual(2)
  })

  it('已闭合的 JSON 代码块无需修复，返回 null', () => {
    const content = '```json\n{"responseType":"recommendation","title":"x","blocks":[]}\n```'
    expect(repairTruncatedJson(content)).toBeNull()
  })

  it('不以 ```json 开头的内容返回 null', () => {
    expect(repairTruncatedJson('纯文本')).toBeNull()
    expect(repairTruncatedJson('{"a":1}')).toBeNull()
    expect(repairTruncatedJson('')).toBeNull()
    expect(repairTruncatedJson(null as unknown as string)).toBeNull()
  })

  it('括号不匹配（无法安全修复）时返回 null', () => {
    const content = '```json\n{"a": [1, 2}\n'
    expect(repairTruncatedJson(content)).toBeNull()
  })

  it('修复后的内容可被 detectStructuredContent 正常解析渲染', async () => {
    const { detectStructuredContent } = await import(
      '@/components/ai/features/components/structured/utils'
    )
    const truncated = '```json\n{"responseType":"recommendation","title":"修复配方","blocks":[{"type":"header","data":{"title":"修复配方","level":1}},{"type":"metrics","data":{"items":[]}}'
    const repaired = repairTruncatedJson(truncated)
    expect(repaired).not.toBeNull()
    const structured = detectStructuredContent(repaired!)
    expect(structured).not.toBeNull()
    expect(structured!.title).toBe('修复配方')
  })
})