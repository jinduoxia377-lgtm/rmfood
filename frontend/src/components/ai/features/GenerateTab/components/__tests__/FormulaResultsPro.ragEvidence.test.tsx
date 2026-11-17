/**
 * RAG 证据崩溃 P0 回归测试（2026-11-17）
 *
 * 复现的线上缺陷：后端 formula_generation_service 注入的 rag_evidence 可能为 truthy
 * 但缺少 chunks / whitelist / blacklist 数组字段；旧实现裸 `as RAGEvidence` 强转 +
 * 渲染层直接读 `.chunks.length`，导致
 *   TypeError: Cannot read properties of undefined (reading 'length')
 * 整块「配方生成」结果面板被 ErrorBoundary 接管，用户看不到任何候选。
 *
 * 本测试锁定两层防御：
 *   1) api/ai.ts normalizeGenerateResponse → 残缺 rag_evidence 归一化后三个数组字段恒为数组；
 *   2) FormulaResultsPro 渲染层 → 残缺 rag_evidence 下不抛错、仍渲染候选与君臣佐使。
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { normalizeGenerateResponse } from '@/api/ai'
import { FormulaResultsPro } from '../FormulaResultsPro'
import type { AICandidate } from '@/api/ai'

/** 真实后端候选的最小可用形状 */
const makeCandidate = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'ga_candidate_test_0',
  name: '配方方案1',
  formula_name: '优化配方-1（增强免疫）',
  herb_combination: [
    { name: '茯苓', dosage: '11.7g', role: '君' },
    { name: '党参', dosage: '10.0g', role: '臣' },
    { name: '大枣', dosage: '6.0g', role: '佐' },
  ],
  peptide_candidates: [],
  efficacy_score: 0.58,
  overall_score: 0.66,
  score: 0.66,
  synergy_score: 0.5,
  taste_score: 0.6,
  stability_score: 0.8,
  safety_score: 0.9,
  cost_score: 0.85,
  safety_passed: false,
  safety_verdict: {
    status: 'needs_attention',
    is_compliant: true,
    violations: [],
    warnings: ["'茯苓' 用量 11700.0mg 接近限量 12000mg/天（80%阈值）"],
  },
  effects: ['增强免疫'],
  generated_by: 'ga_optimizer',
  generated_at: '2026-11-17T00:00:00',
  ...overrides,
})

describe('RAG 证据崩溃 P0 回归', () => {
  describe('1) normalizeGenerateResponse 归一化层', () => {
    it('残缺 rag_evidence（truthy 但缺三个数组字段）不抛错，数组字段恒为 []', () => {
      const raw = {
        candidates: [makeCandidate()],
        total: 1,
        generator: 'ga_optimizer',
        // 关键：truthy 对象，但故意不含 chunks / whitelist / blacklist
        rag_evidence: { enabled: true, query: '增强免疫', summary: '残缺证据' },
      }

      expect(() => normalizeGenerateResponse(raw)).not.toThrow()
      const res = normalizeGenerateResponse(raw)
      const rag = res.candidates[0].rag_evidence
      expect(rag).toBeTruthy()
      // 三个数组字段必须被归一化为真实数组，下游 .length / .map 才安全
      expect(Array.isArray(rag?.chunks)).toBe(true)
      expect(Array.isArray(rag?.whitelist)).toBe(true)
      expect(Array.isArray(rag?.blacklist)).toBe(true)
      expect(rag?.chunks.length).toBe(0)
      expect(rag?.whitelist.length).toBe(0)
      expect(rag?.blacklist.length).toBe(0)
    })

    it('三个数组字段为错误类型（字符串/对象/null）时也归一化为 []', () => {
      const raw = {
        candidates: [makeCandidate()],
        rag_evidence: {
          enabled: 'yes',
          query: 123,
          chunks: 'not-an-array',
          whitelist: { a: 1 },
          blacklist: null,
          summary: {},
        },
      }
      const res = normalizeGenerateResponse(raw)
      const rag = res.candidates[0].rag_evidence
      expect(Array.isArray(rag?.chunks)).toBe(true)
      expect(Array.isArray(rag?.whitelist)).toBe(true)
      expect(Array.isArray(rag?.blacklist)).toBe(true)
      // 标量字段收敛为安全类型
      expect(typeof rag?.query).toBe('string')
      expect(typeof rag?.enabled).toBe('boolean')
      expect(typeof rag?.summary).toBe('string')
    })

    it('rag_evidence 为非对象（null / 数组 / 标量）时归一化为 undefined，UI 走空态', () => {
      for (const bad of [null, [], 'evidence', 42]) {
        const res = normalizeGenerateResponse({
          candidates: [makeCandidate()],
          rag_evidence: bad,
        })
        expect(res.candidates[0].rag_evidence).toBeUndefined()
      }
    })
  })

  describe('2) FormulaResultsPro 渲染层', () => {
    const renderResults = (candidate: AICandidate) =>
      render(
        React.createElement(FormulaResultsPro, {
          generateResult: [candidate],
          generator: 'ga' as const,
          viewMode: 'card' as const,
          onViewModeChange: vi.fn(),
          selectedCategory: 'all' as const,
          onCategoryChange: vi.fn(),
          sortBy: 'score' as const,
          sortOrder: 'desc' as const,
          onToggleSort: vi.fn(),
          filteredResults: [candidate],
          formulaCategories: [],
          onViewReport: vi.fn(),
          onSelectCandidate: vi.fn(),
          selectedCompareIndex: undefined,
          onExportFormula: vi.fn(),
          effectLabels: ['增强免疫'],
        }),
      )

    it('候选携带残缺 rag_evidence 时不抛错，且仍渲染候选与君臣佐使', () => {
      // 模拟归一化后仍可能出现的残缺形状（纵深防御：绕过 API 层直接给渲染层）
      const candidate = makeCandidate({
        rag_evidence: { enabled: true, query: '增强免疫', summary: '残缺证据' },
      }) as unknown as AICandidate

      expect(() => renderResults(candidate)).not.toThrow()
      // 君臣佐使角色仍渲染 → 候选卡片未被 ErrorBoundary 吞掉
      expect(screen.getAllByText(/君|臣|佐|使/).length).toBeGreaterThan(0)
    })

    it('rag_evidence 为 undefined 时正常渲染（空态分支）', () => {
      const candidate = makeCandidate({ rag_evidence: undefined }) as unknown as AICandidate
      expect(() => renderResults(candidate)).not.toThrow()
      expect(screen.getAllByText(/君|臣|佐|使/).length).toBeGreaterThan(0)
    })
  })
})
