import { useState, useRef, useCallback } from 'react';
import { useIntersectionObserver } from '@/hooks/usePerformance';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  width?: number;
  height?: number;
  onLoad?: () => void;
  onError?: () => void;
}

export function LazyImage({
  src,
  alt,
  className = '',
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Crect fill="%23f3f4f6" width="200" height="200"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3E加载中...%3C/text%3E%3C/svg%3E',
  width,
  height,
  onLoad,
  onError,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback((isIntersecting: boolean) => {
    if (isIntersecting && !isLoaded && !hasError) {
      setIsLoaded(true);
    }
  }, [isLoaded, hasError]);

  const setRef = useIntersectionObserver<HTMLDivElement>(handleIntersect, {
    rootMargin: '100px',
  });

  const handleRef = useCallback(
    (node: HTMLDivElement | null) => {
      setRef(node);
      if (node) {
        imgRef.current = node;
      }
    },
    [setRef],
  );

  const handleImageLoad = useCallback(() => {
    onLoad?.();
  }, [onLoad]);

  const handleImageError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  return (
    <div
      ref={handleRef}
      className={`relative overflow-hidden bg-gray-100 ${className}`}
      style={{ width, height }}
    >
      {!isLoaded && !hasError && (
        <img
          src={placeholder}
          alt=""
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
      )}

      {isLoaded && (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover transition-opacity duration-300"
          style={{
            opacity: isLoaded ? 1 : 0,
          }}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      )}

      {hasError && (
        <div className="flex items-center justify-center w-full h-full bg-gray-100">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
