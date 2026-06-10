/**
 * Toast Store - 单元测试
 * 测试覆盖：添加/移除/清除 toast、最大数量限制、自动消失
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useToastStore } from '../toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start with empty toasts', () => {
      expect(useToastStore.getState().toasts).toEqual([]);
    });
  });

  describe('addToast', () => {
    it('should add a toast', () => {
      useToastStore.getState().addToast({ type: 'success', title: 'Done' });
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
    it('should generate unique ids', () => {
      const id1 = useToastStore.getState().addToast({ type: 'info', message: 'A' });
      const id2 = useToastStore.getState().addToast({ type: 'info', message: 'B' });
      expect(id1).not.toBe(id2);
    });
    it('should store all provided fields', () => {
      useToastStore.getState().addToast({ type: 'error', title: 'Err', message: 'Detail', duration: 10000 });
      const toast = useToastStore.getState().toasts[0];
      expect(toast.type).toBe('error');
      expect(toast.title).toBe('Err');
      expect(toast.message).toBe('Detail');
    });
  });

  describe('max toasts limit', () => {
    it('should keep at most 3 toasts', () => {
      const s = useToastStore.getState();
      s.addToast({ type: 'info', message: '1' });
      s.addToast({ type: 'info', message: '2' });
      s.addToast({ type: 'info', message: '3' });
      s.addToast({ type: 'info', message: '4' });
      expect(useToastStore.getState().toasts).toHaveLength(3);
    });
    it('should remove oldest when exceeding 3', () => {
      const s = useToastStore.getState();
      s.addToast({ type: 'info', message: 'first' });
      s.addToast({ type: 'info', message: 'second' });
      s.addToast({ type: 'info', message: 'third' });
      s.addToast({ type: 'info', message: 'fourth' });
      const messages = useToastStore.getState().toasts.map((t) => t.message);
      expect(messages).not.toContain('first');
      expect(messages).toContain('fourth');
    });
  });

  describe('removeToast', () => {
    it('should remove a toast by id', () => {
      const s = useToastStore.getState();
      const id = s.addToast({ type: 'info', message: 'remove me' });
      s.removeToast(id);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });
    it('should only remove the specified toast', () => {
      const s = useToastStore.getState();
      s.addToast({ type: 'info', message: 'keep' });
      const id = s.addToast({ type: 'info', message: 'remove' });
      s.addToast({ type: 'info', message: 'keep too' });
      s.removeToast(id);
      expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['keep', 'keep too']);
    });
  });

  describe('clearAll', () => {
    it('should remove all toasts', () => {
      const s = useToastStore.getState();
      s.addToast({ type: 'info', message: '1' });
      s.addToast({ type: 'info', message: '2' });
      s.clearAll();
      expect(useToastStore.getState().toasts).toEqual([]);
    });
  });

  describe('auto-dismiss', () => {
    it('should auto-remove after default duration', () => {
      vi.useFakeTimers();
      useToastStore.getState().addToast({ type: 'info', message: 'auto' });
      expect(useToastStore.getState().toasts).toHaveLength(1);
      vi.advanceTimersByTime(5001);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });
    it('should auto-remove after custom duration', () => {
      vi.useFakeTimers();
      useToastStore.getState().addToast({ type: 'info', message: 'custom', duration: 2000 });
      vi.advanceTimersByTime(1999);
      expect(useToastStore.getState().toasts).toHaveLength(1);
      vi.advanceTimersByTime(2);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });
    it('should not auto-dismiss when duration is 0', () => {
      vi.useFakeTimers();
      useToastStore.getState().addToast({ type: 'info', message: 'persistent', duration: 0 });
      vi.advanceTimersByTime(10000);
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
  });

  describe('getCurrentToasts', () => {
    it('should return current toasts', () => {
      useToastStore.getState().addToast({ type: 'info', message: 'test' });
      expect(useToastStore.getState().getCurrentToasts()).toHaveLength(1);
    });
    it('should return empty when no toasts', () => {
      expect(useToastStore.getState().getCurrentToasts()).toEqual([]);
    });
  });
});
