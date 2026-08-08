/**
 * Focus trap hook for dialogs/modals.
 *
 * Captures Tab/Shift+Tab within the dialog, returns focus to the trigger
 * element on close, and handles Escape key to dismiss.
 */
import { useEffect, useRef } from 'react';

/** A selector matching native focusable elements inside the trapped container. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen || !ref.current) return;

    // Store the element that had focus before the dialog opened.
    triggerRef.current = document.activeElement as HTMLElement;

    // Focus the first focusable element inside the dialog.
    const focusable = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      // Fallback: make the dialog container itself focusable.
      ref.current.tabIndex = -1;
      ref.current.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape → close
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Tab → trap focus
      if (e.key === 'Tab' && ref.current) {
        const focusableElements = Array.from(
          ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        if (focusableElements.length === 0) return;

        const firstEl = focusableElements[0];
        const lastEl = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift+Tab: wrap to last element
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          // Tab: wrap to first element
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Return focus to the element that triggered the dialog.
      if (triggerRef.current) {
        (triggerRef.current as HTMLElement).focus();
      }
    };
  }, [isOpen, ref, onClose]);
}
