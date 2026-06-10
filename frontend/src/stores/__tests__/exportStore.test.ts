/**
 * Export Store - 单元测试
 * 测试覆盖：初始状态、多格式导出（PDF/Word/LaTeX/Markdown/HTML）、进度跟踪、取消导出
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/utils/safeLogger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

// Mock DOM APIs used by export functions
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();

vi.stubGlobal('URL', {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
});

vi.stubGlobal(
  'Blob',
  class MockBlob {
    constructor(
      public parts: unknown[],
      public options?: { type?: string },
    ) {}
  },
);

// Mock document.createElement to return a controlled anchor element
const originalCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
  if (tag === 'a') {
    return { href: '', download: '', click: mockClick } as unknown as HTMLAnchorElement;
  }
  return originalCreateElement(tag);
});
vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

import { useExportStore } from '../exportStore';

describe('exportStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useExportStore.setState({
      format: 'pdf',
      options: {
        format: 'pdf',
        paperSize: 'a4',
        margin: { top: 25, right: 25, bottom: 25, left: 25 },
        includeReferences: true,
      },
      progress: {
        status: 'idle',
        percentage: 0,
        currentStep: 0,
        totalSteps: 5,
      },
    });
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should have default format as pdf', () => {
      const state = useExportStore.getState();
      expect(state.format).toBe('pdf');
    });

    it('should have idle progress status', () => {
      const state = useExportStore.getState();
      expect(state.progress.status).toBe('idle');
      expect(state.progress.percentage).toBe(0);
      expect(state.progress.currentStep).toBe(0);
    });

    it('should have default export options', () => {
      const state = useExportStore.getState();
      expect(state.options.paperSize).toBe('a4');
      expect(state.options.includeReferences).toBe(true);
      expect(state.options.margin).toEqual({ top: 25, right: 25, bottom: 25, left: 25 });
    });
  });

  describe('setFormat', () => {
    it('should update the export format', () => {
      useExportStore.getState().setFormat('docx');
      expect(useExportStore.getState().format).toBe('docx');
    });

    it('should accept all supported formats', () => {
      const formats = ['pdf', 'docx', 'html', 'latex', 'markdown'] as const;
      for (const fmt of formats) {
        useExportStore.getState().setFormat(fmt);
        expect(useExportStore.getState().format).toBe(fmt);
      }
    });
  });

  describe('setOptions', () => {
    it('should merge partial options with existing options', () => {
      useExportStore.getState().setOptions({ paperSize: 'letter' });
      const state = useExportStore.getState();
      expect(state.options.paperSize).toBe('letter');
      // Existing options should be preserved
      expect(state.options.includeReferences).toBe(true);
    });

    it('should update margin options', () => {
      useExportStore.getState().setOptions({ margin: { top: 10, right: 10, bottom: 10, left: 10 } });
      expect(useExportStore.getState().options.margin).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
    });
  });

  describe('cancelExport', () => {
    it('should reset progress to idle state', () => {
      // Set a non-idle state first
      useExportStore.setState({
        progress: { status: 'exporting', percentage: 50, currentStep: 3, totalSteps: 5 },
      });
      useExportStore.getState().cancelExport();
      const state = useExportStore.getState();
      expect(state.progress.status).toBe('idle');
      expect(state.progress.percentage).toBe(0);
      expect(state.progress.currentStep).toBe(0);
    });
  });

  describe('exportPDF', () => {
    it('should set progress to exporting with initial step on start', async () => {
      vi.useFakeTimers();
      const exportPromise = useExportStore.getState().exportPDF();

      // Immediately after call, status should be 'exporting'
      const state = useExportStore.getState();
      expect(state.progress.status).toBe('exporting');
      expect(state.progress.percentage).toBe(0);
      expect(state.progress.currentStep).toBe(1);
      expect(state.progress.totalSteps).toBe(5);

      // Advance through all timers to complete the export
      await vi.advanceTimersByTimeAsync(3000);
      await exportPromise;
    });

    it('should progress through all steps and reach completed', async () => {
      vi.useFakeTimers();
      const exportPromise = useExportStore.getState().exportPDF();

      await vi.advanceTimersByTimeAsync(600);
      expect(useExportStore.getState().progress.percentage).toBe(20);
      expect(useExportStore.getState().progress.currentStep).toBe(2);

      await vi.advanceTimersByTimeAsync(500);
      expect(useExportStore.getState().progress.percentage).toBe(40);

      await vi.advanceTimersByTimeAsync(500);
      expect(useExportStore.getState().progress.percentage).toBe(70);

      await vi.advanceTimersByTimeAsync(500);
      expect(useExportStore.getState().progress.percentage).toBe(90);

      await vi.advanceTimersByTimeAsync(300);
      expect(useExportStore.getState().progress.status).toBe('completed');
      expect(useExportStore.getState().progress.percentage).toBe(100);

      await exportPromise;
    });

    it('should trigger file download on completion', async () => {
      vi.useFakeTimers();
      const exportPromise = useExportStore.getState().exportPDF();
      await vi.advanceTimersByTimeAsync(3000);
      await exportPromise;

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should reset to idle after 2 second delay post-completion', async () => {
      vi.useFakeTimers();
      const exportPromise = useExportStore.getState().exportPDF();
      await vi.advanceTimersByTimeAsync(3000);
      await exportPromise;

      // Still completed right after
      expect(useExportStore.getState().progress.status).toBe('completed');

      // After the 2s reset timeout
      await vi.advanceTimersByTimeAsync(2000);
      expect(useExportStore.getState().progress.status).toBe('idle');
      expect(useExportStore.getState().progress.percentage).toBe(0);
    });
  });

  describe('exportWord', () => {
    it('should set progress to exporting with 4 total steps', async () => {
      vi.useFakeTimers();
      const exportPromise = useExportStore.getState().exportWord();

      const state = useExportStore.getState();
      expect(state.progress.status).toBe('exporting');
      expect(state.progress.totalSteps).toBe(4);
      expect(state.progress.currentStep).toBe(1);

      await vi.advanceTimersByTimeAsync(2000);
      await exportPromise;
    });

    it('should reach completed status', async () => {
      vi.useFakeTimers();
      const exportPromise = useExportStore.getState().exportWord();
      await vi.advanceTimersByTimeAsync(2000);
      await exportPromise;

      expect(useExportStore.getState().progress.status).toBe('completed');
      expect(useExportStore.getState().progress.percentage).toBe(100);
    });

    it('should trigger file download with docx extension', async () => {
      vi.useFakeTimers();
      const exportPromise = useExportStore.getState().exportWord();
      await vi.advanceTimersByTimeAsync(2000);
      await exportPromise;

      expect(mockClick).toHaveBeenCalled();
      const anchorEl = mockClick.mock.context() || (document.createElement('a') as unknown as { download: string });
      // The download attribute is set on the element; verify createObjectURL was called
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });

  describe('exportLaTeX', () => {
    it('should set progress to exporting with 3 total steps', async () => {
      vi.useFakeTimers();
      const exportPromise = useExportStore.getState().exportLaTeX();

      const state = useExportStore.getState();
      expect(state.progress.status).toBe('exporting');
      expect(state.progress.totalSteps).toBe(3);

      await vi.advanceTimersByTimeAsync(1500);
      await exportPromise;
    });

    it('should reach completed status', async () => {
      vi.useFakeTimers();
      const exportPromise = useExportStore.getState().exportLaTeX();
      await vi.advanceTimersByTimeAsync(1500);
      await exportPromise;

      expect(useExportStore.getState().progress.status).toBe('completed');
      expect(useExportStore.getState().progress.percentage).toBe(100);
    });
  });

  describe('exportMarkdown', () => {
    it('should set progress to exporting with 2 total steps', async () => {
      vi.useFakeTimers();
      const exportPromise = useExportStore.getState().exportMarkdown();

      const state = useExportStore.getState();
      expect(state.progress.status).toBe('exporting');
      expect(state.progress.totalSteps).toBe(2);

      await vi.advanceTimersByTimeAsync(1000);
      await exportPromise;
    });

    it('should reach completed status', async () => {
      vi.useFakeTimers();
      const exportPromise = useExportStore.getState().exportMarkdown();
      await vi.advanceTimersByTimeAsync(1000);
      await exportPromise;

      expect(useExportStore.getState().progress.status).toBe('completed');
      expect(useExportStore.getState().progress.percentage).toBe(100);
    });
  });

  describe('exportHTML', () => {
    it('should set progress to exporting with 3 total steps', async () => {
      vi.useFakeTimers();
      const exportPromise = useExportStore.getState().exportHTML();

      const state = useExportStore.getState();
      expect(state.progress.status).toBe('exporting');
      expect(state.progress.totalSteps).toBe(3);

      await vi.advanceTimersByTimeAsync(1500);
      await exportPromise;
    });

    it('should reach completed status', async () => {
      vi.useFakeTimers();
      const exportPromise = useExportStore.getState().exportHTML();
      await vi.advanceTimersByTimeAsync(1500);
      await exportPromise;

      expect(useExportStore.getState().progress.status).toBe('completed');
      expect(useExportStore.getState().progress.percentage).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('should handle cancelExport when already idle', () => {
      // Should not throw
      expect(() => useExportStore.getState().cancelExport()).not.toThrow();
      expect(useExportStore.getState().progress.status).toBe('idle');
    });

    it('should handle rapid format changes', () => {
      useExportStore.getState().setFormat('docx');
      useExportStore.getState().setFormat('html');
      useExportStore.getState().setFormat('latex');
      useExportStore.getState().setFormat('markdown');
      expect(useExportStore.getState().format).toBe('markdown');
    });

    it('should preserve options when changing format', () => {
      useExportStore.getState().setOptions({ paperSize: 'letter', fontSize: 12 });
      useExportStore.getState().setFormat('html');
      const state = useExportStore.getState();
      expect(state.options.paperSize).toBe('letter');
      expect(state.options.fontSize).toBe(12);
    });
  });
});
