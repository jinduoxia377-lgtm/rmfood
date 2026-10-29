/**
 * P0 前端响应契约适配 — 归一化函数单测
 *
 * 使用后端 genetic.py / multi-objective / hybrid 的真实响应样例，
 * 验证归一化后始终满足前端类型（ingredients/overall_score/confidence/explanation 不缺字段）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import api from '@/api/client'
import {
  aiApi,
  normalizeGeneticResponse,
  normalizeMultiObjectiveResponse,
  normalizeGeneticHybridResponse,
  normalizeUnifiedOptimizeResponse,
  normalizeGenerateCandidate,
  normalizeGenerateResponse,
} from '@/api/ai'

vi.mock('@/api/client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

// ─── 后端真实响应样例（来自 backend/app/api/ai_modules/genetic.py）───

const backendGeneticSample = {
  run_id: 'ga-123',
  candidates: [
    {
      rank: 1,
      herb_combination: [
        { name: 'gz', dosage_mg: 1200.5 },
        { name: 'dcx', dosage_mg: 800.0 },
        { name: 'fp', dosage_mg: 600.0 },
      ],
      fitness: 0.8532,
      efficacy: 0.91,
      safety: 0.88,
      taste: 0.72,
      cost: 0.65,
    },
    {
      rank: 2,
      herb_combination: [
        { name: 'hq', dosage_mg: 1500.0 },
        { name: 'gz', dosage_mg: 900.0 },
      ],
      fitness: 0.7211,
      efficacy: 0.8,
      safety: 0.75,
      taste: 0.69,
      cost: 0.58,
    },
  ],
  total_candidates: 2,
  total_generations: 40,
  best_score: 0.8532,
  execution_time_ms: 1234.5,
  stop_reason: 'completed',
  history: [
    { generation: 1, best_fitness: 0.5, avg_fitness: 0.4, min_fitness: 0.2, diversity: 0.9 },
  ],
}

const backendMOSample = {
  run_id: 'mo-456',
  candidates: [
    {
      rank: 1,
      herb_combination: [
        { name: 'gz', dosage_mg: 1000.0 },
        { name: 'dcx', dosage_mg: 500.0 },
      ],
      scores: { efficacy: 0.9, safety: 0.85, taste: 0.7, cost: 0.6 },
      fitness: 0.8123,
      is_pareto_optimal: true,
    },
  ],
  total_candidates: 1,
  total_generations: 50,
  best_score: 0.8123,
  execution_time_ms: 2345.6,
  stop_reason: 'completed',
  algorithm: 'nsga2_genetic_algorithm',
  mode: 'pareto',
}

const backendHybridSample = {
  ga_candidates: 5,
  ga_history_length: 40,
  mo_candidates: 5,
  mo_history_length: 20,
  combined_results: [
    { type: 'ga', rank: 1, fitness: 0.81, herbs: ['gz', 'dcx', 'fp'] },
    { type: 'nsga2', rank: 1, fitness: 0.87, herbs: ['hq', 'gz'] },
  ],
  algorithm: 'genetic_hybrid',
}

describe('归一化：genetic 响应（herb_combination + fitness → ingredients + overall_score）', () => {
  it('将 herb_combination 映射为 ingredients；dosage_mg 数值即克（GA 系列字段名遗留，不再 /1000）', () => {
    const result = normalizeGeneticResponse(backendGeneticSample)

    expect(result.candidates).toHaveLength(2)
    const first = result.candidates[0]
    expect(first.ingredients).toHaveLength(3)
    // task-4 契约修正：后端 genetic 系列 dosage_mg 实际是克（12 表示 12g），不再除以 1000
    expect(first.ingredients[0]).toMatchObject({ id: 'gz', name_cn: 'gz', dosage: 1200.5 })
    expect(first.ingredients[1].dosage).toBe(800)
    expect(first.ingredients[2].dosage).toBe(600)
  })

  it('overall_score 缺省取 fitness，confidence/explanation 自动填充', () => {
    const result = normalizeGeneticResponse(backendGeneticSample)
    const first = result.candidates[0]

    expect(first.overall_score).toBe(0.8532)
    expect(first.efficacy_score).toBe(0.91)
    expect(first.safety_score).toBe(0.88)
    expect(first.taste_score).toBe(0.72)
    expect(first.cost_score).toBe(0.65)
    expect(typeof first.confidence).toBe('number')
    expect(Number.isFinite(first.confidence)).toBe(true)
    expect(typeof first.explanation).toBe('string')
    expect(first.explanation!.length).toBeGreaterThan(0)
    expect(first.explanation).toContain('gz')
  })

  it('保留后端原始字段（rank/herb_combination/fitness）与顶层字段', () => {
    const result = normalizeGeneticResponse(backendGeneticSample)
    expect(result.candidates[0].rank).toBe(1)
    expect(result.candidates[0].herb_combination).toHaveLength(3)
    expect(result.candidates[0].fitness).toBe(0.8532)
    expect(result.run_id).toBe('ga-123')
    expect(result.total_generations).toBe(40)
    expect(result.best_score).toBe(0.8532)
    expect(result.history).toHaveLength(1)
  })

  it('candidates 缺失时返回空数组而不抛错', () => {
    const result = normalizeGeneticResponse({ total_generations: 0 })
    expect(result.candidates).toEqual([])
    expect(result.best_score).toBe(0)
  })
})

describe('归一化：多目标优化响应（scores/fitness/herb_combination）', () => {
  it('映射 ingredients/objective_scores/overall_fitness，并推导 objectives_config', () => {
    const result = normalizeMultiObjectiveResponse(backendMOSample)

    expect(result.candidates).toHaveLength(1)
    const cand = result.candidates[0]
    // task-4 契约修正：dosage_mg 数值即克，不再 /1000
    expect(cand.ingredients[0]).toMatchObject({ id: 'gz', name_cn: 'gz', dosage: 1000 })
    expect(cand.objective_scores).toEqual({ efficacy: 0.9, safety: 0.85, taste: 0.7, cost: 0.6 })
    expect(cand.overall_fitness).toBe(0.8123)
    expect(cand.pareto_rank).toBe(1)
    expect(cand.crowding_distance).toBe(0)
    expect(typeof cand.explanation).toBe('string')

    // objectives_config 从候选 scores 键推导
    expect(result.objectives_config?.map((o) => o.key).sort()).toEqual(
      ['efficacy', 'safety', 'taste', 'cost'].sort(),
    )
    expect(result.mode).toBe('pareto')
    expect(result.algorithm).toBe('nsga2_genetic_algorithm')
    expect(result.pareto_front).toHaveLength(1)
  })

  it('支持调用方传入 objectives 构建 objectives_config', () => {
    const result = normalizeMultiObjectiveResponse(backendMOSample, {
      objectives: [
        { key: 'efficacy', name: '功效', direction: 'maximize', weight: 0.3 },
        { key: 'cost', name: '成本', direction: 'minimize', weight: 0.2 },
      ],
    })
    expect(result.objectives_config).toEqual([
      { key: 'efficacy', name: '功效', direction: 'maximize', weight: 0.3 },
      { key: 'cost', name: '成本', direction: 'minimize', weight: 0.2 },
    ])
  })
})

describe('归一化：hybrid 响应（ga_candidates/mo_candidates/combined_results）', () => {
  it('无 candidates 时从 combined_results 构建候选，不伪造剂量', () => {
    const result = normalizeGeneticHybridResponse(backendHybridSample)

    expect(result.candidates).toHaveLength(2)
    const first = result.candidates[0]
    // 后端汇总未返回剂量 → ingredients 为空，不伪造 dosage
    expect(first.ingredients).toEqual([])
    expect(first.overall_score).toBe(0.81)
    expect(first.confidence).toBeGreaterThan(0)
    expect(first.explanation).toContain('gz')
    expect(first.explanation).toContain('未返回剂量明细')

    // 保留后端汇总字段
    expect(result.ga_candidates).toBe(5)
    expect(result.mo_candidates).toBe(5)
    expect(result.ga_history_length).toBe(40)
    expect(result.mo_history_length).toBe(20)
    expect(result.combined_results).toHaveLength(2)
    expect(result.algorithm).toBe('genetic_hybrid')
    expect(result.hybrid_mode).toBe(true)
  })

  it('有 candidates 时（hybrid 流式 complete）按 GA 候选归一化', () => {
    const streamSample = {
      candidates: [
        {
          rank: 1,
          herb_combination: [{ name: 'gz', dosage_mg: 1000.0 }],
          scores: { efficacy: 0.9 },
          fitness: 0.86,
          source: 'ga_hybrid_nsga2',
        },
      ],
      total_candidates: 1,
      ga_generations: 40,
      nsga2_generations: 20,
      algorithm: 'genetic_hybrid_nsga2',
    }
    const result = normalizeGeneticHybridResponse(streamSample)
    // task-4 契约修正：dosage_mg 数值即克，不再 /1000
    expect(result.candidates[0].ingredients[0]).toMatchObject({ name_cn: 'gz', dosage: 1000 })
    expect(result.candidates[0].overall_score).toBe(0.86)
  })
})

describe('归一化：unifiedOptimize 响应（兼容 GA / MO / hybrid 结构）', () => {
  it('hybrid 汇总结构 → 归一化为 GeneticGenerateResponse', () => {
    const result = normalizeUnifiedOptimizeResponse(backendHybridSample)
    expect(result.candidates).toHaveLength(2)
    expect(result.algorithm).toBe('genetic_hybrid')
    expect(result.hybrid_mode).toBe(true)
  })

  it('GA 结构 → 直接归一化', () => {
    const result = normalizeUnifiedOptimizeResponse(backendGeneticSample)
    expect(result.candidates[0].ingredients[0].name_cn).toBe('gz')
    expect(result.total_generations).toBe(40)
  })
})

describe('归一化：/ai/generate 主端点响应（herb_combination + overall_score → score/safety_passed/ingredients）', () => {
  const backendGenerateSample = {
    candidates: [
      {
        id: 'ga_candidate_1',
        formula_name: '优化配方-1（增强免疫）',
        name: '配方方案1',
        herb_combination: [
          { name: '黄芪', dosage: '12g', role: '君' },
          { name: '大枣', dosage: '10g', role: '臣' },
          { name: '金银花', dosage: '9g', role: '佐' },
        ],
        synergy_score: 0.6,
        taste_score: 0.7,
        stability_score: 0.65,
        safety_score: 0.88,
        cost_score: 0.7,
        efficacy_score: 0.9,
        overall_score: 0.8,
        effects: ['增强免疫'],
        generated_by: 'ga_optimizer',
        generated_at: '2026-10-27T00:00:00',
      },
    ],
    total: 1,
    generator: 'ga_optimizer',
    execution_time_ms: 100,
    strategy: 'ga',
    best_score: 0.8,
  }

  it('normalizeGenerateCandidate 补齐 score/safety_passed/ingredients 并保留原始字段', () => {
    const cand = normalizeGenerateCandidate(backendGenerateSample.candidates[0], 0)

    expect(cand.score).toBe(0.8) // score = overall_score
    expect(cand.overall_score).toBe(0.8)
    expect(cand.safety_passed).toBe(true) // safety_score 0.88 >= 0.7
    expect(cand.ingredients).toHaveLength(3)
    expect(cand.ingredients![0]).toMatchObject({ name: '黄芪', dosage: '12g', unit: 'g' })
    expect(cand.herb_combination).toHaveLength(3)
    expect(cand.effects).toEqual(['增强免疫'])
    expect(cand.generated_by).toBe('ga_optimizer')
  })

  it('safety_score < 0.7 时 safety_passed 为 false', () => {
    const cand = normalizeGenerateCandidate(
      { ...backendGenerateSample.candidates[0], safety_score: 0.5, overall_score: 0.6 },
      0,
    )
    expect(cand.safety_passed).toBe(false)
    expect(cand.score).toBe(0.6)
  })

  it('兼容后端新字段 name_cn / dosage_g（字段改名后）', () => {
    const cand = normalizeGenerateCandidate(
      {
        id: 'ga_candidate_2',
        formula_name: '优化配方-2',
        name: '配方方案2',
        herb_combination: [
          { name_cn: '茯苓', dosage_g: 15, role: '君' },
          { name_cn: '山药', dosage_g: 12, role: '臣' },
        ],
        overall_score: 0.75,
        safety_score: 0.9,
        effects: ['健脾养胃'],
      },
      1,
    )
    expect(cand.ingredients![0]).toMatchObject({ name: '茯苓', dosage: '15g', dosage_g: 15 })
    expect(cand.ingredients![1]).toMatchObject({ name: '山药', dosage: '12g', dosage_g: 12 })
    expect(cand.safety_passed).toBe(true)
  })

  it('normalizeGenerateResponse 归一化整个响应并回填 total/generator', () => {
    const result = normalizeGenerateResponse(backendGenerateSample)
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].score).toBe(0.8)
    expect(result.total).toBe(1)
    expect(result.generator).toBe('ga_optimizer')
    expect(result.execution_time_ms).toBe(100)
    expect(result.strategy).toBe('ga')
    expect(result.best_score).toBe(0.8)
  })

  it('空响应不抛错', () => {
    const result = normalizeGenerateResponse({})
    expect(result.candidates).toEqual([])
    expect(result.total).toBe(0)
    expect(result.generator).toBe('rule_engine')
  })

  it('透传响应级 rag_evidence 到响应与候选（P1）', () => {
    const ragSample = {
      ...backendGenerateSample,
      rag_evidence: {
        enabled: true,
        query: '增强免疫 药食同源 功效',
        chunks: [{ source: '本草纲目', score: 0.9, content: '黄芪补气固表...' }],
        whitelist: ['黄芪'],
        blacklist: [],
        summary: '命中 1 个知识块，推荐 黄芪',
        error: null,
      },
    }
    const result = normalizeGenerateResponse(ragSample)
    // 响应级保留
    expect(result.rag_evidence?.enabled).toBe(true)
    expect(result.rag_evidence?.whitelist).toEqual(['黄芪'])
    expect(result.rag_evidence?.query).toBe('增强免疫 药食同源 功效')
    // 归一化层透传到每个候选（FormulaResultsPro 只持有 generateResult）
    expect(result.candidates[0].rag_evidence?.enabled).toBe(true)
    expect(result.candidates[0].rag_evidence?.chunks).toHaveLength(1)
    expect(result.candidates[0].rag_evidence?.chunks[0].source).toBe('本草纲目')
  })

  it('rag_evidence 缺失时候选不含该字段（不报错）', () => {
    const result = normalizeGenerateResponse(backendGenerateSample)
    expect(result.rag_evidence).toBeUndefined()
    expect(result.candidates[0].rag_evidence).toBeUndefined()
  })
})

describe('API 方法接入归一化', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generate 调用 /ai/generate 并归一化（score/safety_passed/ingredients）', async () => {
    const generateSample = {
      candidates: [
        {
          id: 'ga_candidate_1',
          formula_name: '优化配方-1',
          name: '配方方案1',
          herb_combination: [{ name: '黄芪', dosage: '12g', role: '君' }],
          safety_score: 0.85,
          overall_score: 0.78,
          effects: ['增强免疫'],
          generated_by: 'ga_optimizer',
        },
      ],
      total: 1,
      generator: 'ga_optimizer',
    }
    vi.mocked(api.post).mockResolvedValue({ data: generateSample })

    const result = await aiApi.generate(['增强免疫'])

    expect(api.post).toHaveBeenCalledWith(
      '/ai/generate',
      expect.objectContaining({ target_effects: ['增强免疫'], use_llm: false }),
      expect.anything(),
    )
    expect(result.candidates[0].score).toBe(0.78)
    expect(result.candidates[0].safety_passed).toBe(true)
    expect(result.candidates[0].ingredients?.[0]).toMatchObject({ name: '黄芪', dosage: '12g' })
    expect(result.generator).toBe('ga_optimizer')
  })

  it('generateGenetic 调用 /ai/generate/genetic 并返回归一化结果', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: backendGeneticSample })

    const result = await aiApi.generateGenetic({ targetEffects: ['免疫调节'] })

    expect(api.post).toHaveBeenCalledWith(
      '/ai/generate/genetic',
      expect.objectContaining({ target_effects: ['免疫调节'] }),
      expect.anything(),
    )
    expect(result.candidates[0].ingredients[0].name_cn).toBe('gz')
    expect(result.candidates[0].overall_score).toBe(0.8532)
  })

  it('unifiedOptimize 调用 /ai/generate/unified 并返回归一化结果', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: backendHybridSample })

    const result = await aiApi.unifiedOptimize({ targetEffects: ['免疫调节'] })

    expect(api.post).toHaveBeenCalledWith(
      '/ai/generate/unified',
      expect.objectContaining({ target_effects: ['免疫调节'] }),
      expect.anything(),
    )
    expect(result.candidates).toHaveLength(2)
    expect(result.candidates[0].overall_score).toBe(0.81)
  })
})