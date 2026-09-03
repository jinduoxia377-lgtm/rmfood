/**
 * useKeyboardSearch — 全局搜索快捷键（已通过 useGlobalShortcuts 统一管理）
 *
 * 保留此 hook 以兼容现有调用点，实际快捷键注册在 AIAssistantPage 中统一使用 useGlobalShortcuts。
 */
import { useState, useCallback, useRef } from 'react';

export function useKeyboardSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // 暴露 handler 供 useGlobalShortcuts 使用
  const searchToggleHandler = useCallback(() => toggle(), [toggle]);

  return { isOpen, toggle, close, searchToggleHandler };
}

