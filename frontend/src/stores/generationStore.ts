/**
 * 配方生成全局状态 Store
 *
 * 将 GenerateTab / GeneticAlgorithmPanel / MultiObjectivePanel 的生成结果、
 * 生成中状态、版本历史提升到全局 Zustand store，
 * 使 AIAssistantPage 切换 tab（组件卸载）后，切回时结果仍在。
 * 仅会话内存级（不持久化到 localStorage），避免跨会话残留旧配方。
 */
import { create } from 'zustand'
import type { AICandidate, GeneticGenerateResponse, GenerationRecord, MultiObjectiveResponse } from '@/api/ai'

export type GenerationGeneratorType = 'rule_engine' | 'ga' | 'llm' | 'neural_network'

export interface FormulaVersionData {
  id: string
  versionNumber: number
  formulaName: string
  effects: string[]
  ingredients: { name: string; dosage: string; role: string }[]
  scores: { synergy: number; taste: number; stability: number; overall: number }
  createdAt: number
  remark: string
}

interface GenerationStoreState {
  // ═══════════════ GenerateTab（配方生成） ═══════════════
  /** 最近一次生成结果（切 tab 后保留） */
  generateResult: AICandidate[] | null
  /** 生成器类型（rule_engine/ga/llm/neural_network） */
  generator: GenerationGeneratorType
  /** 生成错误信息（切 tab 后保留） */
  errorMessage: string | null
  /** 生成中状态（跨挂载保留） */
  isGenerating: boolean
  /** 配方版本历史（切 tab 后保留） */
  formulaVersions: FormulaVersionData[]
  /** 最近一次已处理的候选结果 ID（用于重挂载后去重，避免重复写入版本/历史） */
  lastProcessedResultId: string | null
  /** 已保存候选映射（候选 ID → 配方 ID/保存时间，切 tab 后保留，防止重复保存） */
  savedFormulas: Map<string, { formulaId: number; savedAt: number }>
  /** 保存成功提示（切 tab 后保留，与 generateResult 同生命周期） */
  saveSuccess: { formulaId: number; formulaName: string } | null

  // ═══════════════ GeneticAlgorithmPanel（遗传算法） ═══════════════
  /** 遗传算法结果（候选列表 + 运行元信息，切 tab 后保留） */
  geneticResult: GeneticGenerateResponse | null
  /** 遗传算法流式进化曲线数据（切 tab 后保留） */
  geneticLiveHistory: GenerationRecord[]
  /** 遗传算法是否运行中（跨挂载保留） */
  geneticIsRunning: boolean
  /** 遗传算法错误信息（切 tab 后保留） */
  geneticError: string | null

  // ═══════════════ MultiObjectivePanel（多目标优化） ═══════════════
  /** 多目标优化结果（切 tab 后保留） */
  moResult: MultiObjectiveResponse | null
  /** 多目标优化流式进化曲线数据（切 tab 后保留） */
  moLiveHistory: GenerationRecord[]
  /** 多目标优化是否运行中（跨挂载保留） */
  moIsRunning: boolean
  /** 多目标优化错误信息（切 tab 后保留） */
  moError: string | null

  // ── GenerateTab actions ──
  setGenerateResult: (result: AICandidate[] | null) => void
  setGenerator: (generator: GenerationGeneratorType) => void
  setErrorMessage: (message: string | null) => void
  setIsGenerating: (isGenerating: boolean) => void
  setFormulaVersions: (versions: FormulaVersionData[]) => void
  addFormulaVersion: (version: FormulaVersionData) => void
  setLastProcessedResultId: (id: string | null) => void
  setSavedFormulas: (savedFormulas: Map<string, { formulaId: number; savedAt: number }>) => void
  setSaveSuccess: (saveSuccess: { formulaId: number; formulaName: string } | null) => void
  resetSavedFormulas: () => void
  /** 重置生成结果/错误/生成中状态/已处理标记/已保存映射（保留版本历史） */
  resetGeneration: () => void

  // ── GeneticAlgorithmPanel actions ──
  setGeneticResult: (result: GeneticGenerateResponse | null) => void
  setGeneticLiveHistory: (history: GenerationRecord[]) => void
  appendGeneticLiveHistory: (record: GenerationRecord) => void
  setGeneticIsRunning: (isRunning: boolean) => void
  setGeneticError: (error: string | null) => void
  /** 重置遗传算法结果/曲线/错误/运行中（新生成开始时调用） */
  resetGeneticResult: () => void

  // ── MultiObjectivePanel actions ──
  setMoResult: (result: MultiObjectiveResponse | null) => void
  setMoLiveHistory: (history: GenerationRecord[]) => void
  appendMoLiveHistory: (record: GenerationRecord) => void
  setMoIsRunning: (isRunning: boolean) => void
  setMoError: (error: string | null) => void
  /** 重置多目标结果/曲线/错误/运行中（新生成开始时调用） */
  resetMoResult: () => void
}

export const useGenerationStore = create<GenerationStoreState>((set) => ({
  generateResult: null,
  generator: 'rule_engine',
  errorMessage: null,
  isGenerating: false,
  formulaVersions: [],
  lastProcessedResultId: null,
  savedFormulas: new Map(),
  saveSuccess: null,

  geneticResult: null,
  geneticLiveHistory: [],
  geneticIsRunning: false,
  geneticError: null,

  moResult: null,
  moLiveHistory: [],
  moIsRunning: false,
  moError: null,

  setGenerateResult: (generateResult) => set({ generateResult }),
  setGenerator: (generator) => set({ generator }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setFormulaVersions: (formulaVersions) => set({ formulaVersions }),
  addFormulaVersion: (version) =>
    set((state) => ({
      formulaVersions: [version, ...state.formulaVersions].slice(0, 50),
    })),
  setLastProcessedResultId: (lastProcessedResultId) => set({ lastProcessedResultId }),
  setSavedFormulas: (savedFormulas) => set({ savedFormulas }),
  setSaveSuccess: (saveSuccess) => set({ saveSuccess }),
  resetSavedFormulas: () => set({ savedFormulas: new Map(), saveSuccess: null }),
  resetGeneration: () =>
    set({
      generateResult: null,
      errorMessage: null,
      isGenerating: false,
      lastProcessedResultId: null,
      savedFormulas: new Map(),
      saveSuccess: null,
    }),

  setGeneticResult: (geneticResult) => set({ geneticResult }),
  setGeneticLiveHistory: (geneticLiveHistory) => set({ geneticLiveHistory }),
  appendGeneticLiveHistory: (record) =>
    set((state) => ({ geneticLiveHistory: [...state.geneticLiveHistory, record] })),
  setGeneticIsRunning: (geneticIsRunning) => set({ geneticIsRunning }),
  setGeneticError: (geneticError) => set({ geneticError }),
  resetGeneticResult: () =>
    set({
      geneticResult: null,
      geneticLiveHistory: [],
      geneticIsRunning: false,
      geneticError: null,
    }),

  setMoResult: (moResult) => set({ moResult }),
  setMoLiveHistory: (moLiveHistory) => set({ moLiveHistory }),
  appendMoLiveHistory: (record) =>
    set((state) => ({ moLiveHistory: [...state.moLiveHistory, record] })),
  setMoIsRunning: (moIsRunning) => set({ moIsRunning }),
  setMoError: (moError) => set({ moError }),
  resetMoResult: () =>
    set({
      moResult: null,
      moLiveHistory: [],
      moIsRunning: false,
      moError: null,
    }),
}))

/** 供测试/调试使用的 store 重置（清空全部状态） */
export function resetGenerationStoreForTest(): void {
  useGenerationStore.setState({
    generateResult: null,
    generator: 'rule_engine',
    errorMessage: null,
    isGenerating: false,
    formulaVersions: [],
    lastProcessedResultId: null,
    savedFormulas: new Map(),
    saveSuccess: null,
    geneticResult: null,
    geneticLiveHistory: [],
    geneticIsRunning: false,
    geneticError: null,
    moResult: null,
    moLiveHistory: [],
    moIsRunning: false,
    moError: null,
  })
}