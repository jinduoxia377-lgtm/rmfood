/**
 * LazySection — 落地页按需懒加载容器（v7.1 性能升级）
 *
 * 解决原实现"8 个 lazy section 共用 1 个 Suspense"的问题：
 *   - 每个 section 独立 Suspense，互不阻塞
 *   - 结合 IntersectionObserver 在接近视口时才挂载（rootMargin 200px），
 *     避免首屏一次性拉取全部 8 个 chunk
 *   - 不可见时渲染占位高度，滚动进入时再加载真实内容（渐进式渲染）
 *   - 无 IntersectionObserver 环境（旧浏览器/禁用 JS）直接回退为立即渲染
 *
 * 用法：<LazySection minHeight={480}><Features /></LazySection>
 */
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

interface LazySectionProps {
  children: ReactNode;
  /** 未挂载时的占位最小高度（px），避免滚动跳动 */
  minHeight?: number;
}

export function LazySection({ children, minHeight = 480 }: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  // 无 IntersectionObserver（旧浏览器/禁用 JS）时直接渲染，避免内容永久不可见
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return true;
    return false;
  });

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref}>
      {visible ? (
        <Suspense
          fallback={
            <div className="lp-skeleton" style={{ minHeight }} aria-hidden="true">
              <div className="lp-skeleton-head" />
              <div className="lp-skeleton-sub" />
              <div className="lp-skeleton-grid">
                <div className="lp-skeleton-card" />
                <div className="lp-skeleton-card" />
                <div className="lp-skeleton-card" />
              </div>
            </div>
          }
        >
          {children}
        </Suspense>
      ) : (
        <div style={{ minHeight, width: '100%' }} aria-hidden="true" />
      )}
    </div>
  );
}
