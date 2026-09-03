/**
 * 肽序列模拟生成器 — 当 PepINVERT ML 服务不可用时提供降级方案
 */

const AMINO_ACIDS = 'ACDEFGHIKLMNPQRSTVWY'

function randomSeq(length: number): string {
  let seq = ''
  for (let i = 0; i < length; i++) {
    seq += AMINO_ACIDS[Math.floor(Math.random() * AMINO_ACIDS.length)]
  }
  return seq
}

function calcMw(seq: string): number {
  const weights: Record<string, number> = {
    A: 89.09, R: 174.20, N: 132.12, D: 133.10, C: 121.16,
    E: 147.13, Q: 146.15, G: 75.07, H: 155.16, I: 131.17,
    L: 131.17, K: 146.19, M: 149.21, F: 165.19, P: 115.13,
    S: 105.09, T: 119.12, W: 204.23, Y: 181.19, V: 117.15,
  }
  return seq.split('').reduce((sum, aa) => sum + (weights[aa] || 110), 0) - (seq.length - 1) * 18.02
}

function calcLogP(seq: string): number {
  const hydrophobicity: Record<string, number> = {
    A: 1.8, R: -4.5, N: -3.5, D: -3.5, C: 2.5,
    E: -3.5, Q: -3.5, G: -0.4, H: -3.2, I: 4.5,
    L: 3.8, K: -3.9, M: 1.9, F: 2.8, P: -1.6,
    S: -0.8, T: -0.7, W: -0.9, Y: -1.3, V: 4.2,
  }
  return seq.split('').reduce((sum, aa) => sum + (hydrophobicity[aa] || 0), 0) / seq.length
}

const EFFECT_MODELS: Record<string, (seq: string) => Record<string, number>> = {
  ACE_inhibitory: (seq) => {
    const c = (seq.match(/C/g) || []).length
    const k = (seq.match(/K/g) || []).length
    const base = 40 + c * 8 + k * 5 + Math.random() * 20
    return { ACE_inhibitory: Math.min(98, Math.max(10, base)) }
  },
  antioxidant: (seq) => {
    const w = (seq.match(/W/g) || []).length
    const y = (seq.match(/Y/g) || []).length
    const base = 35 + w * 10 + y * 8 + Math.random() * 20
    return { antioxidant: Math.min(98, Math.max(10, base)) }
  },
  DPP_IV_inhibitory: (seq) => {
    const pro = (seq.match(/P/g) || []).length
    const base = 38 + pro * 6 + Math.random() * 22
    return { DPP_IV_inhibitory: Math.min(98, Math.max(10, base)) }
  },
  permeability: (seq) => {
    const i = (seq.match(/I/g) || []).length
    const l = (seq.match(/L/g) || []).length
    const base = 30 + i * 5 + l * 4 + Math.random() * 25
    return { permeability: Math.min(98, Math.max(10, base)) }
  },
  stability: (seq) => {
    const c = (seq.match(/C/g) || []).length
    const base = 35 + c * 7 + Math.random() * 20
    return { stability: Math.min(98, Math.max(10, base)) }
  },
}

export interface SimulatedPeptideResult {
  sequence: string
  molecular_weight: number
  logp: number
  activity_scores: Record<string, number>
  composite_score: number
}

export function generateSimulatedPeptides(
  targetEffects: string[],
  maxCandidates: number,
): SimulatedPeptideResult[] {
  const results: SimulatedPeptideResult[] = []
  const length = 4 + Math.floor(Math.random() * 5) // 4-8 amino acids

  for (let i = 0; i < maxCandidates; i++) {
    const seq = randomSeq(length)
    const mw = calcMw(seq)
    const logp = calcLogP(seq)

    const scores: Record<string, number> = {}
    for (const effect of targetEffects) {
      const model = EFFECT_MODELS[effect]
      if (model) {
        Object.assign(scores, model(seq))
      }
    }

    const scoreValues = Object.values(scores)
    const composite = scoreValues.length > 0
      ? Math.round((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) * 100) / 100
      : 0.5

    results.push({
      sequence: seq,
      molecular_weight: Math.round(mw * 100) / 100,
      logp: Math.round(logp * 100) / 100,
      activity_scores: scores,
      composite_score: composite,
    })
  }

  return results.sort((a, b) => b.composite_score - a.composite_score)
}
