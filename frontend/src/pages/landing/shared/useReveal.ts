/**
 * 滚动触发动画 hook — 供所有 section 复用
 */
import { useRef, useEffect } from 'react';

export function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 渐进增强：无 IntersectionObserver（旧浏览器/禁用 JS）时直接显示，
    // 避免 .lp-reveal 内容永久 opacity:0 不可见
    if (!('IntersectionObserver' in window)) {
      el.classList.add('lp-visible');
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('lp-visible'); obs.disconnect(); } },
      { threshold: 0.08, rootMargin: '0px 0px -16px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}
