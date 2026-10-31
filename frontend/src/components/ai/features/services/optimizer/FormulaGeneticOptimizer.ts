/**
 * FormulaGeneticOptimizer — 遗传算法配方优化器 v2.0
 *
 * ⚠️ @deprecated 前端遗留引擎（task-4 死代码治理）：
 * - 本优化器基于 FormulaKnowledgeGraph 的硬编码英文-key 小数据集（18 个 id），
 *   无业务运行时调用点，仅作为历史实现保留。
 * - GenerateTab 主流程不依赖本模块：真实 GA 由后端
 *   POST /api/v1/ai/generate（run_ga_generation）与 /ai/generate/genetic 提供。
 * - 新代码请直接调用 @/api/ai 的 aiApi.generateGenetic / unifiedOptimize。
 *
 * 实数编码遗传算法，多目标优化
 * NSGA-II 非支配排序 + 拥挤度距离
 */
import { knowledgeGraph, EdgeType } from '../knowledge/FormulaKnowledgeGraph'
import type { GraphNode } from '../knowledge/FormulaKnowledgeGraph'
import {
  FGO_SAFE_HIGH_RATIO,
  FGO_SAFE_MEDIUM_RATIO,
  FGO_SAFE_HIGH_SCORE,
  FGO_SAFE_MEDIUM_SCORE,
  FGO_SAFE_LOW_SCORE,
  FGO_SCORE_FLOOR,
  FGO_BITTER_PENALTY,
  FGO_WEIGHTS,
} from '@/config/ai/constants'

export interface Chromosome { selection: boolean[]; dosages: number[] }
export interface FitnessVector {
  efficacy: number; safety: number; taste: number
  stability: number; cost: number; compatibility: number
  overall: number
}
export interface Individual {
  chromosome: Chromosome; fitness: FitnessVector
  ingredients: GraphNode[]; rank: number; crowdingDistance: number
}
export interface GAResult {
  best: Individual; paretoFront: Individual[]
  history: Array<{ generation: number; bestFitness: number; avgFitness: number }>
  converged: boolean
}

export class FormulaGeneticOptimizer {
  private popSize = 50
  private maxGen = 30
  private cxRate = 0.85
  private mutRate = 0.12
  private tourSize = 3
  private elite = 2
  private maxIng = 8
  private minIng = 3
  private ingredients: GraphNode[] = []

  constructor() {
    const ids = ['astragalus','angelica','ginseng','schisandra','licorice','goji','dang_shen','tumeric','collagen_peptide','soy_peptide','inulin','vitamin_c','zinc','astaxanthin','probiotic_blend','reishi','cordyceps','hawthorn']
    for (const id of ids) { const n = knowledgeGraph.getNode(id); if (n) this.ingredients.push(n) }
  }

  calculateFitness(c: Chromosome): FitnessVector {
    const sel = c.selection.map((s,i) => s ? this.ingredients[i] : null).filter(Boolean) as GraphNode[]
    if (sel.length === 0) return { efficacy:0, safety:0, taste:0, stability:0, cost:0, compatibility:0, overall:0 }
    let eff=0, safe=0, taste=0, stab=0, cost=0, compat=0
    for (let i = 0; i < sel.length; i++) {
      const ing = sel[i]; const p = ing.properties as Record<string, unknown>
      const edges = knowledgeGraph.getEdgesFrom(ing.id).filter(e => e.type === EdgeType.HAS_EFFECT)
      // v2.1: 目标功效加权 — 匹配目标功效的边权重加倍
      const targetEffects = this.cachedEffects || []
      const weightedEdges = edges.map(e => ({
        ...e,
        weight: targetEffects.includes(e.targetId) ? e.weight * 1.5 : e.weight,
      }))
      const ae = weightedEdges.length ? weightedEdges.reduce((s,e) => s+(e.weight as number), 0)/weightedEdges.length : 0
      eff += (i === 0 ? ae*1.2 : ae) as number
      const idx = this.ingredients.indexOf(ing)
      const d = c.dosages[idx] as number; const lim = (p.safetyLimit as number) || 30; const r = d/lim
      safe += (r > FGO_SAFE_HIGH_RATIO ? FGO_SAFE_HIGH_SCORE : r > FGO_SAFE_MEDIUM_RATIO ? FGO_SAFE_MEDIUM_SCORE : FGO_SAFE_LOW_SCORE) as number
      taste += (p.tasteScore ?? 0.5) as number
      const sm: Record<string,number> = { cold:0.7, cool:0.75, neutral:0.9, warm:0.8, hot:0.65 }
      stab += (sm[(p.nature as string) ?? 'neutral'] ?? 0.7)
      cost += (p.costFactor ?? 0.5) as number
    }
    const n = sel.length
    eff = Math.min(1, eff/n); safe = safe/n
    taste = Math.max(FGO_SCORE_FLOOR, Math.min(1, taste/n - sel.filter(i => !!((i.properties as Record<string, unknown>)?.flavor as string || '').includes('苦')).length * FGO_BITTER_PENALTY))
    stab = stab/n; cost = Math.max(FGO_SCORE_FLOOR, 1 - cost/n)
    const pairs = new Set<string>()
    for (let i = 0; i < n; i++) {
      for (let j = i+1; j < n; j++) {
        pairs.add([sel[i].id,sel[j].id].sort().join('|'))
        const inter = knowledgeGraph.getInteractionBetween(sel[i].id, sel[j].id)
        compat += inter ? (inter.type === EdgeType.ENHANCES ? inter.weight : -inter.weight*2) : 0.3
      }
    }
    compat = pairs.size ? Math.max(0, Math.min(1, (compat/pairs.size+1)/2)) : 0.5
    const overall = eff * FGO_WEIGHTS.efficacy + safe * FGO_WEIGHTS.safety + taste * FGO_WEIGHTS.taste + stab * FGO_WEIGHTS.stability + cost * FGO_WEIGHTS.cost + compat * FGO_WEIGHTS.compatibility
    return { efficacy:+eff.toFixed(2), safety:+safe.toFixed(2), taste:+taste.toFixed(2), stability:+stab.toFixed(2), cost:+cost.toFixed(2), compatibility:+compat.toFixed(2), overall:+overall.toFixed(2) }
  }

  optimize(effects: string[], constraints?: { maxIngredients?: number; minIngredients?: number }): GAResult {
    if (constraints) { this.maxIng = constraints.maxIngredients ?? 8; this.minIng = constraints.minIngredients ?? 3 }
    // v2.1: 基于目标功效偏向初始化种群
    this.cachedEffects = effects
    let pop = Array.from({length:this.popSize}, () => {
      const c = this.effectBiasedRandomChrome(effects)
      return { chromosome:c, fitness:this.calculateFitness(c), ingredients:c.selection.map((s,i) => s?this.ingredients[i]:null).filter(Boolean) as GraphNode[], rank:0, crowdingDistance:0 }
    })
    const history: GAResult['history'] = []
    for (let gen = 0; gen < this.maxGen; gen++) {
      this.fastNDSort(pop); this.calcCrowd(pop)
      pop.sort((a,b) => a.rank !== b.rank ? a.rank-b.rank : b.crowdingDistance-a.crowdingDistance)
      const next = pop.slice(0, this.elite)
      while (next.length < this.popSize) {
        const p1 = this.tournament(pop), p2 = this.tournament(pop)
        const [c1,c2] = this.xover(p1,p2)
        next.push(this.mutate(c1))
        if (next.length < this.popSize) next.push(this.mutate(c2))
      }
      pop = next
      const fits = pop.map(i => i.fitness.overall)
      history.push({ generation:gen, bestFitness:Math.max(...fits), avgFitness:fits.reduce((s,v)=>s+v,0)/fits.length })
      if (gen >= 5) { const r = history.slice(-5); if (Math.max(...r.map(h=>h.bestFitness)) - r[0].bestFitness < 0.01) break }
    }
    this.fastNDSort(pop); this.calcCrowd(pop)
    pop.sort((a,b) => a.rank !== b.rank ? a.rank-b.rank : b.crowdingDistance-a.crowdingDistance)
    return { best:pop[0], paretoFront:pop.filter(i => i.rank === 1).slice(0,10), history, converged:history.length < this.maxGen }
  }

  private cachedEffects: string[] = []
  /** 基于目标功效偏向的随机染色体生成 */
  private effectBiasedRandomChrome(effects: string[]): Chromosome {
    const n = this.ingredients.length
    // 找出与目标功效相关的成分索引
    const relevant: number[] = []
    const others: number[] = []
    for (let i = 0; i < n; i++) {
      const ing = this.ingredients[i]
      const edges = knowledgeGraph.getEdgesFrom(ing.id).filter(e => e.type === EdgeType.HAS_EFFECT)
      const matchesEffect = edges.some(e => effects.includes(e.targetId))
      if (matchesEffect) relevant.push(i)
      else others.push(i)
    }
    // 至少选minIng个，优先从相关成分中选择
    const cnt = this.minIng + Math.floor(Math.random()*(this.maxIng-this.minIng+1))
    const shuffledRel = [...relevant].sort(() => Math.random()-0.5)
    const shuffledOth = [...others].sort(() => Math.random()-0.5)
    const selected = [...shuffledRel, ...shuffledOth].slice(0, cnt)
    const set = new Set(selected)
    const sel: boolean[] = []; const dos: number[] = []
    for (let i = 0; i < n; i++) {
      sel.push(set.has(i))
      const p = this.ingredients[i].properties as Record<string, unknown>; const [mn,mx] = (p.dosageRange as [number,number]) || [3,9]
      dos.push(+(mn + Math.random()*(mx-mn)).toFixed(1))
    }
    return { selection:sel, dosages:dos }
  }

  private randomChrome(): Chromosome {
    const n = this.ingredients.length
    const cnt = this.minIng + Math.floor(Math.random()*(this.maxIng-this.minIng+1))
    const set = new Set(Array.from({length:n},(_,i)=>i).sort(()=>Math.random()-0.5).slice(0,cnt))
    const sel: boolean[] = []; const dos: number[] = []
    for (let i = 0; i < n; i++) {
      sel.push(set.has(i))
      const p = this.ingredients[i].properties as Record<string, unknown>; const [mn,mx] = (p.dosageRange as [number,number]) || [3,9]
      dos.push(+(mn + Math.random()*(mx-mn)).toFixed(1))
    }
    return { selection:sel, dosages:dos }
  }

  private tournament(pop: Individual[]): Individual {
    const t: Individual[] = []
    for (let i = 0; i < this.tourSize; i++) t.push(pop[Math.floor(Math.random()*pop.length)])
    t.sort((a,b) => a.rank !== b.rank ? a.rank-b.rank : b.crowdingDistance-a.crowdingDistance)
    return t[0]
  }

  private xover(p1: Individual, p2: Individual): [Individual, Individual] {
    const c1: Chromosome = { selection:[...p1.chromosome.selection], dosages:[...p1.chromosome.dosages] }
    const c2: Chromosome = { selection:[...p2.chromosome.selection], dosages:[...p2.chromosome.dosages] }
    for (let i = 0; i < this.ingredients.length; i++) {
      if (Math.random() > this.cxRate) continue
      const eta = 20; const u = Math.random()
      const beta = u <= 0.5 ? Math.pow(2*u, 1/(eta+1)) : Math.pow(1/(2*(1-u)), 1/(eta+1))
      const d1 = p1.chromosome.dosages[i], d2 = p2.chromosome.dosages[i]
      c1.dosages[i] = +(0.5*((1+beta)*d1+(1-beta)*d2)).toFixed(1)
      c2.dosages[i] = +(0.5*((1-beta)*d1+(1+beta)*d2)).toFixed(1)
      const p = this.ingredients[i].properties as Record<string, unknown>; const [mn,mx] = ((p as Record<string, number[]>).dosageRange as [number,number]) || [1,10]
      c1.dosages[i] = Math.max(mn, Math.min(mx, c1.dosages[i]))
      c2.dosages[i] = Math.max(mn, Math.min(mx, c2.dosages[i]))
    }
    if (Math.random() < this.cxRate) {
      const pt = Math.floor(Math.random()*this.ingredients.length)
      for (let i = pt; i < this.ingredients.length; i++) { c1.selection[i] = p2.chromosome.selection[i]; c2.selection[i] = p1.chromosome.selection[i] }
    }
    this.repair(c1); this.repair(c2)
    return [
      { chromosome:c1, fitness:this.calculateFitness(c1), ingredients:c1.selection.map((s,i)=>s?this.ingredients[i]:null).filter(Boolean) as GraphNode[], rank:0, crowdingDistance:0 },
      { chromosome:c2, fitness:this.calculateFitness(c2), ingredients:c2.selection.map((s,i)=>s?this.ingredients[i]:null).filter(Boolean) as GraphNode[], rank:0, crowdingDistance:0 },
    ]
  }

  private mutate(ind: Individual): Individual {
    const c: Chromosome = { selection:[...ind.chromosome.selection], dosages:[...ind.chromosome.dosages] }
    for (let i = 0; i < this.ingredients.length; i++) {
      if (Math.random() > this.mutRate) continue
      const p = this.ingredients[i].properties as Record<string, unknown>; const [mn,mx] = ((p as Record<string, number[]>).dosageRange as [number,number]) || [1,10]
      const eta = 20; const u = Math.random(); const norm = (c.dosages[i]-mn)/(mx-mn)
      const delta = u < 0.5 ? Math.pow(2*u, 1/(eta+1))-1 : 1-Math.pow(2*(1-u), 1/(eta+1))
      c.dosages[i] = +Math.max(mn, Math.min(mx, mn+(norm+delta)*(mx-mn))).toFixed(1)
      if (Math.random() < 0.05) c.selection[i] = !c.selection[i]
    }
    this.repair(c)
    return { chromosome:c, fitness:this.calculateFitness(c), ingredients:c.selection.map((s,i)=>s?this.ingredients[i]:null).filter(Boolean) as GraphNode[], rank:0, crowdingDistance:0 }
  }

  private repair(c: Chromosome): void {
    const cnt = c.selection.filter(Boolean).length
    if (cnt < this.minIng) {
      const unsel = c.selection.map((s,i)=>({i,s})).filter(x=>!x.s).map(x=>x.i)
      unsel.sort((a,b) => knowledgeGraph.getEdgesFrom(this.ingredients[b].id).length - knowledgeGraph.getEdgesFrom(this.ingredients[a].id).length)
      for (const idx of unsel) {
        if (c.selection.filter(Boolean).length >= this.minIng) break
        c.selection[idx] = true
        const p = this.ingredients[idx].properties as Record<string, unknown>; const [mn,mx] = ((p as Record<string, number[]>).dosageRange as [number,number]) || [3,9]
        c.dosages[idx] = +(mn+(mx-mn)*0.5).toFixed(1)
      }
    }
    if (cnt > this.maxIng) {
      const sel = c.selection.map((s,i)=>({i,s})).filter(x=>x.s)
      sel.sort((a,b) => knowledgeGraph.getEdgesFrom(this.ingredients[a.i].id).reduce((s,e)=>s+(e.weight as number),0) - knowledgeGraph.getEdgesFrom(this.ingredients[b.i].id).reduce((s,e)=>s+(e.weight as number),0))
      for (const {i:idx} of sel) {
        if (c.selection.filter(Boolean).length <= this.maxIng) break
        c.selection[idx] = false
      }
    }
  }

  private fastNDSort(pop: Individual[]): void {
    for (const p of pop) p.rank = 0
    const n = pop.length; const dc = new Array(n).fill(0); const db: Set<number>[] = Array.from({length:n},()=>new Set())
    for (let i = 0; i < n; i++) {
      for (let j = i+1; j < n; j++) {
        const d = this.dom(pop[i].fitness, pop[j].fitness)
        if (d > 0) { db[i].add(j); dc[j]++ } else if (d < 0) { db[j].add(i); dc[i]++ }
      }
    }
    const f1: number[] = []; for (let i = 0; i < n; i++) { if (dc[i] === 0) { f1.push(i); pop[i].rank = 1 } }
    let cf = f1; let r = 1
    while (cf.length > 0) {
      r++; const nf: number[] = []
      for (const p of cf) { for (const q of db[p]) { dc[q]--; if (dc[q] === 0) { nf.push(q); pop[q].rank = r } } }
      cf = nf
    }
    for (let i = 0; i < n; i++) { if (pop[i].rank === 0) pop[i].rank = r }
  }

  private dom(a: FitnessVector, b: FitnessVector): number {
    const dims: (keyof FitnessVector)[] = ['efficacy','safety','taste','stability','cost','compatibility']
    let aB=false, bB=false
    for (const d of dims) { if (a[d] > b[d]) aB = true; if (b[d] > a[d]) bB = true }
    return aB && !bB ? 1 : bB && !aB ? -1 : 0
  }

  private calcCrowd(pop: Individual[]): void {
    const grp = new Map<number, Individual[]>()
    for (const ind of pop) { if (!grp.has(ind.rank)) grp.set(ind.rank, []); grp.get(ind.rank)!.push(ind) }
    for (const [, front] of grp) {
      if (front.length <= 2) { for (const f of front) f.crowdingDistance = Infinity; continue }
      for (const f of front) f.crowdingDistance = 0
      const dims: (keyof FitnessVector)[] = ['efficacy','safety','taste','stability','cost','compatibility']
      for (const d of dims) {
        front.sort((a,b) => a.fitness[d] - b.fitness[d])
        const r = front[front.length-1].fitness[d] - front[0].fitness[d]
        front[0].crowdingDistance = Infinity; front[front.length-1].crowdingDistance = Infinity
        for (let i = 1; i < front.length-1; i++) { if (r > 0) front[i].crowdingDistance += (front[i+1].fitness[d] - front[i-1].fitness[d]) / r }
      }
    }
  }

  resultToBlocks(result: GAResult) {
    if (!result.best || result.best.ingredients.length === 0) return []
    const b = result.best; const roles = ['君药','臣药','佐药','使药']
    return [
      { type: 'metrics', data: { title: 'GA优化评分', items: [
        { label:'功效', value:Math.round(b.fitness.efficacy*100), unit:'分', trend:'up' },
        { label:'安全', value:Math.round(b.fitness.safety*100), unit:'分', trend:'up' },
        { label:'口感', value:Math.round(b.fitness.taste*100), unit:'分', trend:b.fitness.taste>0.6?'up':'stable' },
        { label:'兼容', value:Math.round(b.fitness.compatibility*100), unit:'分', trend:'up' },
        { label:'成本', value:Math.round(b.fitness.cost*100), unit:'分', trend:b.fitness.cost>0.5?'up':'down' },
      ]}},
      { type: 'data-table', data: { title:'配方组成(GA)', columns:[
        { key:'role', label:'角色', type:'tag' }, { key:'name', label:'成分' },
        { key:'dosage', label:'用量(g)', type:'number', align:'right' },
      ], rows: b.ingredients.slice(0,8).map((ing,i) => {
        const idx = this.ingredients.indexOf(ing)
        return { role: i<4?roles[i]:'佐药', name: ing.label, dosage: idx>=0?b.chromosome.dosages[idx]:5 }
      }) }},
    ]
  }
}
