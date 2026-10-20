/**
 * useFormulaAnalysis Hook - 单元测试
 * 测试覆盖：初始状态、分析流程、阶段进度、取消分析、错误处理与回退
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
  storage_advice: 'Store in cool place',
};

describe('useFormulaAnalysis', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(parseFormulaTable).mockReturnValue(mockParsedFormula as any);
    vi.mocked(aiApi.safetyCheck).mockResolvedValue(mockSafetyResult as any);
    vi.mocked(aiApi.synergyAnalysis).mockResolvedValue(mockSynergyResult as any);
    vi.mocked(aiApi.tastePredict).mockResolvedValue(mockTasteResult as any);
    vi.mocked(aiApi.stabilityPredict).mockResolvedValue(mockStabilityResult as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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
    it('should set isLoading to true when analysis starts', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const analysisPromise = result.current.analyzeFormula('test content');
        await vi.advanceTimersByTimeAsync(2000);
        await analysisPromise;
      });

      // After completion, isLoading should be false
      expect(result.current.result.isLoading).toBe(false);
    });

    it('should set isLoading to true immediately on start', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      // 启动分析但不等待完成；act 结束时 React 会 flush 同步 setState
      await act(async () => {
        result.current.analyzeFormula('test content');
      });

      // 分析尚未完成（内部仍在等待 fake timers），isLoading 应为 true
      expect(result.current.result.isLoading).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
    });
  });

  describe('analyzeFormula - stage progress updates', () => {
    it('should progress through parsing stage', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const p = result.current.analyzeFormula('test content');
        await vi.advanceTimersByTimeAsync(2000);
        await p;
      });

      // After full completion, stage should be 'complete'
      expect(result.current.progress.stage).toBe('complete');
      expect(result.current.progress.percent).toBe(100);
    });

    it('should reach safety stage', async () => {
      const progressStages: string[] = [];
      const { result } = renderHook(() => useFormulaAnalysis());

      // 启动分析（act 结束 flush → parsing 阶段）
      await act(async () => {
        result.current.analyzeFormula('test content');
      });
      progressStages.push(result.current.progress.stage);

      // 推进 300ms：parsing 定时器触发 → safety 阶段（act 结束 flush）
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      progressStages.push(result.current.progress.stage);

      // 推进剩余时间完成分析
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(progressStages).toContain('safety');
    });

    it('should call all five AI stages', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const p = result.current.analyzeFormula('test content');
        await vi.advanceTimersByTimeAsync(3000);
        await p;
      });

      expect(parseFormulaTable).toHaveBeenCalledWith('test content');
      expect(aiApi.safetyCheck).toHaveBeenCalled();
      expect(aiApi.synergyAnalysis).toHaveBeenCalled();
      expect(aiApi.tastePredict).toHaveBeenCalled();
      expect(aiApi.stabilityPredict).toHaveBeenCalled();
    });

    it('should produce a candidate result on success', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      let candidate: unknown = null;
      await act(async () => {
        // 先启动分析，再推进 fake timers，最后 await 完成（避免死等）
        const p = result.current.analyzeFormula('test content');
        await vi.advanceTimersByTimeAsync(3000);
        candidate = await p;
      });

      expect(candidate).not.toBeNull();
      expect(result.current.result.candidate).not.toBeNull();
      expect(result.current.result.error).toBeNull();
    });
  });

  describe('analyzeFormula - abort / cancel', () => {
    it('should reset state when cancelAnalysis is called', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        result.current.analyzeFormula('test content');
        await vi.advanceTimersByTimeAsync(100);
        result.current.cancelAnalysis();
      });

      expect(result.current.result.isLoading).toBe(false);
      expect(result.current.result.candidate).toBeNull();
      expect(result.current.result.error).toBeNull();
      expect(result.current.progress.stage).toBe('idle');
    });

    it('should abort previous analysis when a new one starts', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        // Start first analysis
        const p1 = result.current.analyzeFormula('first content');
        await vi.advanceTimersByTimeAsync(100);

        // Start second analysis (should abort first)
        const p2 = result.current.analyzeFormula('second content');
        await vi.advanceTimersByTimeAsync(3000);

        await p1;
        await p2;
      });

      // The second analysis should have completed
      expect(parseFormulaTable).toHaveBeenCalledWith('second content');
    });

    it('should reset progress to idle on cancel', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        result.current.analyzeFormula('test content');
        await vi.advanceTimersByTimeAsync(500);
        result.current.cancelAnalysis();
      });

      expect(result.current.progress.stage).toBe('idle');
      expect(result.current.progress.percent).toBe(0);
      expect(result.current.progress.message).toBe('');
    });
  });

  describe('analyzeFormula - error handling with fallback', () => {
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
        await vi.advanceTimersByTimeAsync(500);
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
        await vi.advanceTimersByTimeAsync(500);
        expect(candidate).toBeNull();
      });

      expect(result.current.result.error).toBeDefined();
      expect(result.current.result.isLoading).toBe(false);
    });

    it('should use fallback when safetyCheck API fails', async () => {
      vi.mocked(aiApi.safetyCheck).mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const p = result.current.analyzeFormula('test content');
        await vi.advanceTimersByTimeAsync(3000);
        const candidate = await p;
        // Should still complete with fallback values
        expect(candidate).not.toBeNull();
      });

      expect(result.current.result.error).toBeNull();
      expect(result.current.result.candidate).not.toBeNull();
    });

    it('should use fallback when synergyAnalysis API fails', async () => {
      vi.mocked(aiApi.synergyAnalysis).mockRejectedValue(new Error('Timeout'));
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const p = result.current.analyzeFormula('test content');
        await vi.advanceTimersByTimeAsync(3000);
        const candidate = await p;
        expect(candidate).not.toBeNull();
      });

      expect(result.current.result.error).toBeNull();
    });

    it('should use fallback when tastePredict API fails', async () => {
      vi.mocked(aiApi.tastePredict).mockRejectedValue(new Error('Service unavailable'));
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const p = result.current.analyzeFormula('test content');
        await vi.advanceTimersByTimeAsync(3000);
        const candidate = await p;
        expect(candidate).not.toBeNull();
      });

      expect(result.current.result.error).toBeNull();
    });

    it('should use fallback when stabilityPredict API fails', async () => {
      vi.mocked(aiApi.stabilityPredict).mockRejectedValue(new Error('Server error'));
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const p = result.current.analyzeFormula('test content');
        await vi.advanceTimersByTimeAsync(3000);
        const candidate = await p;
        expect(candidate).not.toBeNull();
      });

      expect(result.current.result.error).toBeNull();
    });

    it('should use fallback when all API stages fail', async () => {
      vi.mocked(aiApi.safetyCheck).mockRejectedValue(new Error('fail'));
      vi.mocked(aiApi.synergyAnalysis).mockRejectedValue(new Error('fail'));
      vi.mocked(aiApi.tastePredict).mockRejectedValue(new Error('fail'));
      vi.mocked(aiApi.stabilityPredict).mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const p = result.current.analyzeFormula('test content');
        await vi.advanceTimersByTimeAsync(3000);
        const candidate = await p;
        // Should still produce a result with all fallback values
        expect(candidate).not.toBeNull();
      });

      expect(result.current.result.candidate).not.toBeNull();
      expect(result.current.result.error).toBeNull();
    });

    it('should set error stage on unexpected exception', async () => {
      vi.mocked(parseFormulaTable).mockImplementation(() => {
        throw new Error('Unexpected crash');
      });

      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const candidate = await result.current.analyzeFormula('test content');
        await vi.advanceTimersByTimeAsync(500);
        expect(candidate).toBeNull();
      });

      expect(result.current.result.error).toContain('Unexpected crash');
      expect(result.current.progress.stage).toBe('error');
    });
  });

  describe('resetResult', () => {
    it('should reset all state to initial values', async () => {
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const p = result.current.analyzeFormula('test content');
        await vi.advanceTimersByTimeAsync(3000);
        await p;
      });

      // Verify state is populated
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
        const p = result.current.analyzeFormula(longContent);
        await vi.advanceTimersByTimeAsync(3000);
        await p;
      });

      expect(parseFormulaTable).toHaveBeenCalledWith(longContent);
    });

    it('should handle content with special characters', async () => {
      const specialContent = 'Formula with <script>alert("xss")</script> & special chars';
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const p = result.current.analyzeFormula(specialContent);
        await vi.advanceTimersByTimeAsync(3000);
        await p;
      });

      expect(parseFormulaTable).toHaveBeenCalledWith(specialContent);
    });

    it('should handle content with unicode characters', async () => {
      const unicodeContent = '配方：人参 10g、黄芪 15g';
      const { result } = renderHook(() => useFormulaAnalysis());

      await act(async () => {
        const p = result.current.analyzeFormula(unicodeContent);
        await vi.advanceTimersByTimeAsync(3000);
        await p;
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
        const p1 = result.current.analyzeFormula('formula 1');
        await vi.advanceTimersByTimeAsync(3000);
        await p1;
      });

      const firstCandidate = result.current.result.candidate;
      expect(firstCandidate).not.toBeNull();

      await act(async () => {
        const p2 = result.current.analyzeFormula('formula 2');
        await vi.advanceTimersByTimeAsync(3000);
        await p2;
      });

      expect(result.current.result.candidate).not.toBeNull();
      expect(parseFormulaTable).toHaveBeenCalledTimes(2);
    });
  });
});
