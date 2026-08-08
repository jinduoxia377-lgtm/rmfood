/**
 * useKeyboardSearch — Ctrl+K / Cmd+K 快捷键
 *
 * 监听键盘事件，打开/关闭搜索模态框。
 */
import { useState, useCallback, useEffect } from 'react';

export function useKeyboardSearch() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle, close, isOpen]);

  return { isOpen, toggle, close };
}
