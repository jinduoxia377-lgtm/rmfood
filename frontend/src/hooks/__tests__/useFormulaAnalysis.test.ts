/**
 * useFormulaAnalysis Hook - 单元测试
 * 测试覆盖：初始状态、分析流程、阶段进度、取消分析、错误处理与显式降级（degraded）。
 *
 * P1-5 变更：
 * - 移除 setTimeout(300) 人为延时，测试不再依赖 fake timers 推进；
 * - 分析接口失败时不再伪造默认评分，而是置 degraded=true 并保持对应分数字段缺失。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/utils/safeLogger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

vi.mock('@/api/ai', () => ({
  aiApi: {
    safetyCheck: vi.fn(),
    synergyAnalysis: vi.fn(),
    tastePredict: vi.fn(),
    stabilityPredict: vi.fn(),
  },
}));

vi.mock('@/utils/formulaParser', () => ({
  parseFormulaTable: vi.fn(),
}));

import { useFormulaAnalysis } from '../useFormulaAnalysis';
import { aiApi } from '@/api/ai';
import { parseFormulaTable } from '@/utils/formulaParser';

const mockParsedFormula = {
  name: 'Test Formula',
  ingredients: [
    { name: 'Ingredient A', amount: '10', unit: 'g', efficacyTags: ['primary'], precautions: [] },
    { name: 'Ingredient B', amount: '5', unit: 'g', efficacyTags: ['secondary'], precautions: [] },
  ],
};

const mockSafetyResult = {
  passed: true,
  checks: {},
  warnings: [],
  errors: [],
  summary: 'Safety check passed',
};

const mockSynergyResult = {
  score: 0.85,
  synergy_pairs: [],
  antagonism_warnings: [],
  shared_pathways: [],
  heat_map: {},
  summary: 'Good synergy',
};

const mockTasteResult = {
  sweetness: 0.7,
  bitterness: 0.2,
  astringency: 0.1,
  overall_score: 0.8,
  flavor_notes: ['pleasant'],
};

const mockStabilityResult = {
  stability_score: 0.9,
  estimated_shelf_life_months: 24,
  risk_factors: [],
  monthly_curve: [],
  storage_advice: ['Store in cool place'],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useFormulaAnalysis', () => {
  beforeEach(() => {
    vi.mocked(parseFormulaTable).mockReturnValue(mockParsedFormula as any);
    vi.mocked(aiApi.safetyCheck).mockResolvedValue(mockSafetyResult as any);
    vi.mocked(aiApi.synergyAnalysis).mockResolvedValue(mockSynergyResult as any);
    vi.mocked(aiApi.tastePredict).mockResolvedValue(mockTasteResult as any);
    vi.mocked(aiApi.stabilityPredict).mockResolvedValue(mockStabilityResult as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have idle progress and no results', () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      expect(result.current.result.candidate).toBeNull();
      expect(result.current.result.isLoading).toBe(false);
      expect(result.current.result.progress).toBe(0);
      expect(result.current.result.error).toBeNull();
    });

    it('should have idle progress stage', () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      expect(result.current.progress.stage).toBe('idle');
      expect(result.current.progress.message).toBe('');
      expect(result.current.progress.percent).toBe(0);
    });
  });

  describe('analyzeFormula - loading state', () => {
    it('should set isLoading to true when analysis starts and stay pending until API returns', async () => {
      // 让安全检查保持 pending，验证加载态真实存在（而非依赖人为延时）
      const d = deferred<any>();
      vi.mocked(aiApi.safetyCheck).mockReturnValue(d.promise);

      const { result } = renderHook(() => useFormulaAnalysis());

      let promise: Promise<unknown> | null = null;
      act(() => {
        promise = result.current.analyzeFormula('test content');
      });

      expect(result.current.result.isLoading).toBe(true);

      await act(async () => {
        d.resolve(mockSafetyResult as any);
        await promise;
      });

      expect(result.current.result.isLoading).toBe(false);
      expect(result.current.result.candidate).not.toBeNull();
    });
  });

  describe('analyzeFormula - stage progress updates', () => {
    it('should progress through stages and complete', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        await result.current.analyzeFormula('test content');
      });

      expect(result.current.progress.stage).toBe('complete');
      expect(result.current.progress.percent).toBe(100);
      expect(result.current.result.candidate).not.toBeNull();
    });

    it('should call all five AI stages', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        await result.current.analyzeFormula('test content');
      });

      expect(parseFormulaTable).toHaveBeenCalledWith('test content');
      expect(aiApi.safetyCheck).toHaveBeenCalled();
      expect(aiApi.synergyAnalysis).toHaveBeenCalled();
      expect(aiApi.tastePredict).toHaveBeenCalled();
      expect(aiApi.stabilityPredict).toHaveBeenCalled();
    });

    it('should produce a candidate result on success with real scores and degraded=false', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      let candidate: unknown = null;
      await act(async () => {
        candidate = await result.current.analyzeFormula('test content');
      });

      expect(candidate).not.toBeNull();
      expect(result.current.result.candidate).not.toBeNull();
      expect(result.current.result.error).toBeNull();
      expect(result.current.result.candidate?.degraded).toBe(false);
      expect(result.current.result.candidate?.synergy_score).toBe(0.85);
      expect(result.current.result.candidate?.taste_score).toBe(0.8);
      expect(result.current.result.candidate?.stability_score).toBe(0.9);
      expect(result.current.result.candidate?.overall_score).toBeTypeOf('number');
    });
  });

  describe('analyzeFormula - abort / cancel', () => {
    it('should reset state when cancelAnalysis is called', async () => {
      const d = deferred<any>();
      vi.mocked(aiApi.safetyCheck).mockReturnValue(d.promise);

      const { result } = renderHook(() => useFormulaAnalysis());

      act(() => {
        result.current.analyzeFormula('test content');
      });
      expect(result.current.result.isLoading).toBe(true);

      act(() => {
        result.current.cancelAnalysis();
      });

      expect(result.current.result.isLoading).toBe(false);
      expect(result.current.result.candidate).toBeNull();
      expect(result.current.result.error).toBeNull();
      expect(result.current.progress.stage).toBe('idle');
    });

    it('should abort previous analysis when a new one starts', async () => {
      const d1 = deferred<any>();
      vi.mocked(aiApi.safetyCheck).mockReturnValueOnce(d1.promise);

      const { result } = renderHook(() => useFormulaAnalysis());

      let p1: Promise<unknown> | null = null;
      act(() => {
        p1 = result.current.analyzeFormula('first content');
      });

      // 第二次分析会 abort 第一次
      await act(async () => {
        const p2 = result.current.analyzeFormula('second content');
        await p2;
      });

      expect(parseFormulaTable).toHaveBeenCalledWith('second content');
    });
  });

  describe('analyzeFormula - error handling', () => {
    it('should set error when content is empty', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const candidate = await result.current.analyzeFormula('');
        expect(candidate).toBeNull();
      });

      expect(result.current.result.error).toBe('配方内容不能为空');
      expect(result.current.result.isLoading).toBe(false);
    });

    it('should set error when content is whitespace only', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const candidate = await result.current.analyzeFormula('   ');
        expect(candidate).toBeNull();
      });

      expect(result.current.result.error).toBe('配方内容不能为空');
    });

    it('should set error when parsing returns no ingredients', async () => {
      vi.mocked(parseFormulaTable).mockReturnValue({ name: 'Empty', ingredients: [] } as any);
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const candidate = await result.current.analyzeFormula('invalid content');
        expect(candidate).toBeNull();
      });

      expect(result.current.result.error).toContain('未能解析到配方成分');
      expect(result.current.result.isLoading).toBe(false);
    });

    it('should set error when parsing returns null', async () => {
      vi.mocked(parseFormulaTable).mockReturnValue(null as any);
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const candidate = await result.current.analyzeFormula('bad content');
        expect(candidate).toBeNull();
      });

      expect(result.current.result.error).toBeDefined();
      expect(result.current.result.isLoading).toBe(false);
    });

    it('should set error stage on unexpected exception', async () => {
      vi.mocked(parseFormulaTable).mockImplementation(() => {
        throw new Error('Unexpected crash');
      });

      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const candidate = await result.current.analyzeFormula('test content');
        expect(candidate).toBeNull();
      });

      expect(result.current.result.error).toContain('Unexpected crash');
      expect(result.current.progress.stage).toBe('error');
    });
  });

  describe('analyzeFormula - degraded (显式降级，禁止伪造默认分)', () => {
    it('should set degraded=true and keep safety fields missing when safetyCheck API fails', async () => {
      vi.mocked(aiApi.safetyCheck).mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useFormulaAnalysis());

      let candidate: any = null;
      await act(async () => {
        candidate = await result.current.analyzeFormula('test content');
      });

      expect(candidate).not.toBeNull();
      expect(candidate.degraded).toBe(true);
      // 安全评分不再伪造：passed 为 undefined，safety_details 缺失
      expect(candidate.safety_passed).toBeUndefined();
      expect(candidate.safety_details).toBeUndefined();
      // 其余真实接口仍返回评分
      expect(candidate.synergy_score).toBe(0.85);
      expect(candidate.taste_score).toBe(0.8);
      expect(candidate.stability_score).toBe(0.9);
      expect(result.current.result.error).toBeNull();
    });

    it('should set degraded=true and keep synergy score missing when synergyAnalysis API fails', async () => {
      vi.mocked(aiApi.synergyAnalysis).mockRejectedValue(new Error('Timeout'));
      const { result } = renderHook(() => useFormulaAnalysis());

      let candidate: any = null;
      await act(async () => {
        candidate = await result.current.analyzeFormula('test content');
      });

      expect(candidate).not.toBeNull();
      expect(candidate.degraded).toBe(true);
      expect(candidate.synergy_score).toBeUndefined();
      expect(candidate.safety_passed).toBe(true);
      expect(result.current.result.error).toBeNull();
    });

    it('should set degraded=true and keep taste score missing when tastePredict API fails', async () => {
      vi.mocked(aiApi.tastePredict).mockRejectedValue(new Error('Service unavailable'));
      const { result } = renderHook(() => useFormulaAnalysis());

      let candidate: any = null;
      await act(async () => {
        candidate = await result.current.analyzeFormula('test content');
      });

      expect(candidate).not.toBeNull();
      expect(candidate.degraded).toBe(true);
      expect(candidate.taste_score).toBeUndefined();
      expect(result.current.result.error).toBeNull();
    });

    it('should set degraded=true and keep stability score missing when stabilityPredict API fails', async () => {
      vi.mocked(aiApi.stabilityPredict).mockRejectedValue(new Error('Server error'));
      const { result } = renderHook(() => useFormulaAnalysis());

      let candidate: any = null;
      await act(async () => {
        candidate = await result.current.analyzeFormula('test content');
      });

      expect(candidate).not.toBeNull();
      expect(candidate.degraded).toBe(true);
      expect(candidate.stability_score).toBeUndefined();
      expect(result.current.result.error).toBeNull();
    });

    it('should set degraded=true and overall_score undefined when all API stages fail', async () => {
      vi.mocked(aiApi.safetyCheck).mockRejectedValue(new Error('fail'));
      vi.mocked(aiApi.synergyAnalysis).mockRejectedValue(new Error('fail'));
      vi.mocked(aiApi.tastePredict).mockRejectedValue(new Error('fail'));
      vi.mocked(aiApi.stabilityPredict).mockRejectedValue(new Error('fail'));
      const { result } = renderHook(() => useFormulaAnalysis());

      let candidate: any = null;
      await act(async () => {
        candidate = await result.current.analyzeFormula('test content');
      });

      expect(candidate).not.toBeNull();
      expect(candidate.degraded).toBe(true);
      expect(candidate.synergy_score).toBeUndefined();
      expect(candidate.taste_score).toBeUndefined();
      expect(candidate.stability_score).toBeUndefined();
      expect(candidate.safety_passed).toBeUndefined();
      // 全部维度缺失时综合评分为 undefined，而非伪造 0.7
      expect(candidate.overall_score).toBeUndefined();
      expect(result.current.result.error).toBeNull();
    });
  });

  describe('resetResult', () => {
    it('should reset all state to initial values', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        await result.current.analyzeFormula('test content');
      });

      expect(result.current.result.candidate).not.toBeNull();

      act(() => {
        result.current.resetResult();
      });

      expect(result.current.result.candidate).toBeNull();
      expect(result.current.result.isLoading).toBe(false);
      expect(result.current.result.progress).toBe(0);
      expect(result.current.result.error).toBeNull();
      expect(result.current.progress.stage).toBe('idle');
      expect(result.current.progress.percent).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very long formula content', async () => {
      const longContent = 'A'.repeat(10000);
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        await result.current.analyzeFormula(longContent);
      });

      expect(parseFormulaTable).toHaveBeenCalledWith(longContent);
    });

    it('should handle content with special characters', async () => {
      const specialContent = 'Formula with <script>alert("xss")</script> & special chars';
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        await result.current.analyzeFormula(specialContent);
      });

      expect(parseFormulaTable).toHaveBeenCalledWith(specialContent);
    });

    it('should handle content with unicode characters', async () => {
      const unicodeContent = '配方：人参 10g、黄芪 15g';
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        await result.current.analyzeFormula(unicodeContent);
      });

      expect(parseFormulaTable).toHaveBeenCalledWith(unicodeContent);
    });

    it('should handle cancelAnalysis when no analysis is running', () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      act(() => {
        result.current.cancelAnalysis();
      });

      expect(result.current.result.isLoading).toBe(false);
      expect(result.current.progress.stage).toBe('idle');
    });

    it('should handle resetResult when no result exists', () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      act(() => {
        result.current.resetResult();
      });

      expect(result.current.result.candidate).toBeNull();
      expect(result.current.result.isLoading).toBe(false);
    });

    it('should handle multiple sequential analyses', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        await result.current.analyzeFormula('formula 1');
      });

      expect(result.current.result.candidate).not.toBeNull();

      await act(async () => {
        await result.current.analyzeFormula('formula 2');
      });

      expect(result.current.result.candidate).not.toBeNull();
      expect(parseFormulaTable).toHaveBeenCalledTimes(2);
    });
  });
});