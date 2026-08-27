/**
 * 滚动触发动画 hook — 供所有 section 复用
 */
import { useRef, useEffect } from 'react';

export function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('lp-visible'); obs.disconnect(); } },
      { threshold: 0.08, rootMargin: '0px 0px -16px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}
