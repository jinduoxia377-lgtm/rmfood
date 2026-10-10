/**
 * 组织管理快捷键 Hook
 * 支持：
 *   - n: 新建组织
 *   - /: 搜索聚焦
 *   - g o: 概览
 *   - g m: 我的组织
 *   - g a: 全部
 *   - g t: 数据分析
 *   - Escape: 关闭弹窗
 */
import { useEffect, useRef } from 'react';

export type OrgKey = 'new' | 'search' | 'overview' | 'myOrgs' | 'all' | 'analytics' | 'escape';

interface UseKeyboardShortcutsProps {
  onAction: (action: OrgKey) => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({ onAction, enabled = true }: UseKeyboardShortcutsProps) {
  const lastKeyRef = useRef('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Single key shortcuts
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onAction('new');
        return;
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onAction('search');
        return;
      }
      if (e.key === 'Escape') {
        onAction('escape');
        return;
      }

      // Two-key sequence shortcuts (g + letter)
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        lastKeyRef.current = 'g';
        clearTimeout(timeoutRef.current ?? 0);
        timeoutRef.current = setTimeout(() => {
          lastKeyRef.current = '';
        }, 800);
        return;
      }

      if (lastKeyRef.current === 'g') {
        clearTimeout(timeoutRef.current ?? 0);
        lastKeyRef.current = '';
        switch (e.key.toLowerCase()) {
          case 'o':
            e.preventDefault();
            onAction('overview');
            return;
          case 'm':
            e.preventDefault();
            onAction('myOrgs');
            return;
          case 'a':
            e.preventDefault();
            onAction('all');
            return;
          case 't':
            e.preventDefault();
            onAction('analytics');
            return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeoutRef.current ?? 0);
    };
  }, [onAction, enabled]);
}

/** 快捷键提示组件 */
export function ShortcutHints() {
  const hints = [
    { keys: 'n', label: '新建' },
    { keys: '/', label: '搜索' },
    { keys: 'g o', label: '概览' },
    { keys: 'g m', label: '我的组织' },
    { keys: 'g a', label: '全部' },
    { keys: 'g t', label: '数据' },
  ];

  return (
    <div className="hidden xl:flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-400">
      {hints.map((h) => (
        <span key={h.keys} className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700 font-mono text-neutral-500 dark:text-neutral-400">
            {h.keys}
          </kbd>
          <span>{h.label}</span>
        </span>
      ))}
    </div>
  );
}

export default useKeyboardShortcuts;
