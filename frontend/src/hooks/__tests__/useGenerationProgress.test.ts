/**
 * useGenerationProgress Hook - 单元测试
 * 测试覆盖：初始状态、状态机流转、错误处理、进度边界、重置
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGenerationProgress } from '../useGenerationProgress';

describe('useGenerationProgress', () => {
  describe('initial state', () => {
    it('should start with stage idle', () => {
      const { result } = renderHook(() => useGenerationProgress());
      expect(result.current.progress.stage).toBe('idle');
    });
    it('should start with progress 0', () => {
      const { result } = renderHook(() => useGenerationProgress());
      expect(result.current.progress.progress).toBe(0);
    });
    it('should start with canCancel as false', () => {
      const { result } = renderHook(() => useGenerationProgress());
      expect(result.current.progress.canCancel).toBe(false);
    });
  });

  describe('startProgress', () => {
    it('should transition to preparing stage', () => {
      const { result } = renderHook(() => useGenerationProgress());
      act(() => {
        result.current.startProgress('Starting...');
      });
      expect(result.current.progress.stage).toBe('preparing');
    });
    it('should set progress to 10', () => {
      const { result } = renderHook(() => useGenerationProgress());
      act(() => {
        result.current.startProgress('Starting...');
      });
      expect(result.current.progress.progress).toBe(10);
    });
    it('should set canCancel to true', () => {
      const { result } = renderHook(() => useGenerationProgress());
      act(() => {
        result.current.startProgress('Starting...');
      });
      expect(result.current.progress.canCancel).toBe(true);
    });
  });

  describe('updateProgress', () => {
    it('should update to generating stage', () => {
      const { result } = renderHook(() => useGenerationProgress());
      act(() => {
        result.current.updateProgress('generating', 50, 'Generating...');
      });
      expect(result.current.progress.stage).toBe('generating');
      expect(result.current.progress.progress).toBe(50);
    });
    it('should update to optimizing stage', () => {
      const { result } = renderHook(() => useGenerationProgress());
      act(() => {
        result.current.updateProgress('optimizing', 75, 'Optimizing...');
      });
      expect(result.current.progress.stage).toBe('optimizing');
    });
    it('should set canCancel to false for complete stage', () => {
      const { result } = renderHook(() => useGenerationProgress());
      act(() => {
        result.current.updateProgress('complete', 100, 'Done');
      });
      expect(result.current.progress.canCancel).toBe(false);
    });
    it('should set canCancel to false for error stage', () => {
      const { result } = renderHook(() => useGenerationProgress());
      act(() => {
        result.current.updateProgress('error', 0, 'Failed');
      });
      expect(result.current.progress.canCancel).toBe(false);
    });
  });

  describe('completeProgress', () => {
    it('should set stage to complete and progress to 100', () => {
      const { result } = renderHook(() => useGenerationProgress());
      act(() => {
        result.current.startProgress('Starting...');
      });
      act(() => {
        result.current.completeProgress();
      });
      expect(result.current.progress.stage).toBe('complete');
      expect(result.current.progress.progress).toBe(100);
    });
  });

  describe('errorProgress', () => {
    it('should set stage to error', () => {
      const { result } = renderHook(() => useGenerationProgress());
      act(() => {
        result.current.errorProgress('Something went wrong');
      });
      expect(result.current.progress.stage).toBe('error');
      expect(result.current.progress.message).toBe('Something went wrong');
    });
  });

  describe('resetProgress', () => {
    it('should reset to idle from any state', () => {
      const { result } = renderHook(() => useGenerationProgress());
      act(() => {
        result.current.startProgress('Starting...');
      });
      act(() => {
        result.current.updateProgress('generating', 75, 'Working...');
      });
      act(() => {
        result.current.resetProgress();
      });
      expect(result.current.progress.stage).toBe('idle');
      expect(result.current.progress.progress).toBe(0);
      expect(result.current.progress.message).toBe('');
    });
    it('should reset from error state', () => {
      const { result } = renderHook(() => useGenerationProgress());
      act(() => {
        result.current.errorProgress('Error');
      });
      act(() => {
        result.current.resetProgress();
      });
      expect(result.current.progress.stage).toBe('idle');
    });
  });

  describe('full lifecycle', () => {
    it('should transition through all stages to complete', () => {
      const { result } = renderHook(() => useGenerationProgress());
      act(() => {
        result.current.startProgress('Preparing...');
      });
      expect(result.current.progress.stage).toBe('preparing');
      act(() => {
        result.current.updateProgress('generating', 40, 'Generating...');
      });
      expect(result.current.progress.stage).toBe('generating');
      act(() => {
        result.current.updateProgress('optimizing', 70, 'Optimizing...');
      });
      expect(result.current.progress.stage).toBe('optimizing');
      act(() => {
        result.current.updateProgress('validating', 90, 'Validating...');
      });
      expect(result.current.progress.stage).toBe('validating');
      act(() => {
        result.current.completeProgress();
      });
      expect(result.current.progress.stage).toBe('complete');
      expect(result.current.progress.progress).toBe(100);
    });
  });

  describe('progress bounds', () => {
    it('should accept 0 and 100 as valid values', () => {
      const { result } = renderHook(() => useGenerationProgress());
      act(() => {
        result.current.updateProgress('generating', 0, 'Start');
      });
      expect(result.current.progress.progress).toBe(0);
      act(() => {
        result.current.updateProgress('generating', 100, 'End');
      });
      expect(result.current.progress.progress).toBe(100);
    });
  });
});
